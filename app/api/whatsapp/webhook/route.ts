import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";
import { runFinancialAgent } from "@/lib/ai/agent";
import type { AiFinancialEntry } from "@/lib/ai-finance";
import {
  activateConnectionByCode,
  isCancellation,
  isConfirmation,
  logAgentMessage,
  resolveWhatsAppUser,
  sendWhatsAppText,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function summarizeEntries(entries: AiFinancialEntry[]) {
  const lines = entries.map((entry, index) => {
    const label = entry.kind === "INCOME" ? "Receita" : entry.kind === "TAX" ? "Imposto" : "Despesa";
    const merchant = entry.merchant ? ` · ${entry.merchant}` : "";
    const category = entry.categories?.[0] ? ` · ${entry.categories[0]}` : "";
    return `${index + 1}. ${label} — ${money(Number(entry.amount))}${merchant}${category}`;
  });
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return `${lines.join("\n")}\n\nTotal: ${money(total)}\n\nPosso registrar? Responda *sim* ou *não*.`;
}

async function sendAndLog(userId: string | null, waId: string, body: string) {
  const payload = await sendWhatsAppText(waId, body);
  await logAgentMessage({
    userId,
    waId,
    direction: "OUT",
    providerMessageId: payload?.messages?.[0]?.id ?? null,
    body,
  });
}

async function getPendingAction(userId: string, waId: string) {
  const { data } = await adminSupabase
    .from("agent_pending_actions")
    .select("id,payload,status,expires_at,original_text")
    .eq("user_id", userId)
    .eq("wa_id", waId)
    .eq("status", "WAITING_CONFIRMATION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await adminSupabase.from("agent_pending_actions").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).eq("id", data.id);
    return null;
  }
  return data;
}

async function executeEntries(userId: string, product: "PERSONAL" | "BUSINESS" | "MEDICAL", entries: AiFinancialEntry[], originalText: string) {
  if (product === "MEDICAL") {
    const rows = entries.map((entry) => ({
      user_id: userId,
      transaction_date: entry.occurred_on,
      occurred_at: entry.occurred_at,
      kind: entry.kind,
      category: entry.categories?.[0] || "Outras despesas",
      amount: entry.amount,
      description: entry.description,
      merchant: entry.merchant,
      entry_source: "WHATSAPP",
      ai_original_text: originalText,
      ai_confidence: entry.confidence,
    }));
    const { error } = await adminSupabase.from("medical_professional_transactions").insert(rows);
    if (error) throw error;
    return;
  }

  const rows = entries.map((entry) => ({
    user_id: userId,
    description: entry.description,
    amount: entry.amount,
    type: entry.kind === "INCOME" ? "INCOME" : "EXPENSE",
    category: entry.categories?.[0] || "Outros",
    categories: entry.categories ?? [],
    cost_center: null,
    occurred_on: entry.occurred_on,
    occurred_at: entry.occurred_at,
    merchant: entry.merchant,
    notes: entry.notes,
    entry_source: "WHATSAPP",
    ai_original_text: originalText,
    ai_confidence: entry.confidence,
  }));
  const { error } = await adminSupabase.from("transactions").insert(rows);
  if (error) throw error;
}

async function processTextMessage(waId: string, messageId: string, text: string) {
  const existing = await adminSupabase.from("agent_messages").select("id").eq("provider_message_id", messageId).maybeSingle();
  if (existing.data) return;

  let resolved = await resolveWhatsAppUser(waId);
  await logAgentMessage({ userId: resolved?.userId ?? null, waId, direction: "IN", providerMessageId: messageId, body: text });

  if (!resolved) {
    const codeMatch = text.trim().toUpperCase().match(/^EONE-\d{6}$/);
    if (codeMatch) {
      const activated = await activateConnectionByCode(waId, codeMatch[0]);
      if (activated.ok) {
        resolved = await resolveWhatsAppUser(waId);
        await sendAndLog(
          activated.userId,
          waId,
          "✅ WhatsApp conectado ao Equity One.\n\nEu sou o *Meu Agente Financeiro*. Você pode me contar gastos e receitas ou perguntar sobre seu financeiro.\n\nExemplo: “Gastei 80 reais na farmácia hoje.”",
        );
        return;
      }
      const reason = activated.reason === "EXPIRED"
        ? "Esse código expirou. Gere um novo código dentro do Equity One."
        : activated.reason === "IN_USE"
          ? "Este WhatsApp já está conectado a outra conta."
          : "Não encontrei esse código de ativação. Gere um novo código dentro do Equity One.";
      await sendAndLog(null, waId, `⚠️ ${reason}`);
      return;
    }

    await sendAndLog(
      null,
      waId,
      "Olá! 👋 Eu sou o *Meu Agente Financeiro* do Equity One.\n\nPara usar este número, primeiro conecte seu WhatsApp dentro da sua conta Equity One e envie aqui o código EONE-XXXXXX gerado pelo sistema.",
    );
    return;
  }

  const pending = await getPendingAction(resolved.userId, waId);
  if (pending && isConfirmation(text)) {
    const entries = Array.isArray(pending.payload?.entries) ? pending.payload.entries as AiFinancialEntry[] : [];
    try {
      await executeEntries(resolved.userId, resolved.product, entries, pending.original_text || "");
      await adminSupabase.from("agent_pending_actions").update({
        status: "CONFIRMED",
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", pending.id);
      await sendAndLog(resolved.userId, waId, `✅ Pronto. Registrei ${entries.length} lançamento(s) no seu Equity One.`);
    } catch (error) {
      console.error("WhatsApp pending action execution", error);
      await adminSupabase.from("agent_pending_actions").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", pending.id);
      await sendAndLog(resolved.userId, waId, "Não consegui registrar agora. Tente novamente em alguns instantes.");
    }
    return;
  }

  if (pending && isCancellation(text)) {
    await adminSupabase.from("agent_pending_actions").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", pending.id);
    await sendAndLog(resolved.userId, waId, "Tudo bem. Cancelei esse lançamento.");
    return;
  }

  try {
    const result = await runFinancialAgent({
      channel: "WHATSAPP",
      product: resolved.product,
      userId: resolved.userId,
      text,
      nowIso: new Date().toISOString(),
      timezone: "America/Sao_Paulo",
    });

    if (result.action === "ANSWER") {
      await sendAndLog(resolved.userId, waId, result.message);
      return;
    }

    const entries = result.entries ?? [];
    await adminSupabase.from("agent_pending_actions").update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("user_id", resolved.userId)
      .eq("wa_id", waId)
      .eq("status", "WAITING_CONFIRMATION");

    const { error } = await adminSupabase.from("agent_pending_actions").insert({
      user_id: resolved.userId,
      wa_id: waId,
      action_type: "PROPOSE_FINANCIAL_ENTRIES",
      payload: { entries },
      original_text: text,
      status: "WAITING_CONFIRMATION",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (error) throw error;

    await sendAndLog(resolved.userId, waId, `Entendi. Encontrei:\n\n${summarizeEntries(entries)}`);
  } catch (error) {
    console.error("WhatsApp agent error", error);
    await sendAndLog(resolved.userId, waId, "Não consegui interpretar essa mensagem agora. Tente escrever de outra forma.");
  }
}

function collectTextMessages(payload: any) {
  const result: { waId: string; messageId: string; text: string }[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const message of messages) {
        if (message?.type === "text" && message?.from && message?.id && message?.text?.body) {
          result.push({ waId: String(message.from), messageId: String(message.id), text: String(message.text.body) });
        }
      }
    }
  }
  return result;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === verifyToken() && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const messages = collectTextMessages(payload);
    for (const message of messages) {
      await processTextMessage(message.waId, message.messageId, message.text);
    }
  } catch (error) {
    console.error("WhatsApp webhook error", error);
  }
  return NextResponse.json({ received: true });
}
