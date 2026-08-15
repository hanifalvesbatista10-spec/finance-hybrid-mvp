import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";
import { runFinancialAgent } from "@/lib/ai/agent";
import { detectDeepAgentAction, type AgentActionProposal } from "@/lib/ai/deep-actions";
import type { AiFinancialEntry } from "@/lib/ai-finance";
import {
  activateConnectionByCode,
  isCancellation,
  isConfirmation,
  logAgentMessage,
  normalizeWhatsAppText,
  resolveWhatsAppUser,
  sendWhatsAppText,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Product = "PERSONAL" | "BUSINESS" | "MEDICAL";
type WhatsAppEntry = AiFinancialEntry & { account_label?: string | null };

function verifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
}

function validMetaSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const received = Buffer.from(signatureHeader);
  const calculated = Buffer.from(expected);
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function paymentLabel(value?: string | null) {
  const labels: Record<string, string> = {
    PIX: "PIX",
    DEBIT: "Débito",
    CASH: "Dinheiro",
    TRANSFER: "Transferência",
    BOLETO: "Boleto",
    OTHER: "Outro",
  };
  return value ? labels[value] || value : "não informada";
}

function inferPaymentMethod(text: string) {
  const value = normalizeWhatsAppText(text);
  if (/\bpix\b/.test(value)) return "PIX";
  if (/(debito|cartao de debito)/.test(value)) return "DEBIT";
  if (/(dinheiro|especie)/.test(value)) return "CASH";
  if (/(transferencia|transferi|ted|doc)/.test(value)) return "TRANSFER";
  if (/boleto/.test(value)) return "BOLETO";
  return null;
}

function summarizeEntries(entries: WhatsAppEntry[]) {
  const lines = entries.map((entry, index) => {
    const label = entry.kind === "INCOME" ? "Receita" : entry.kind === "TAX" ? "Imposto" : "Despesa";
    const merchant = entry.merchant ? ` · ${entry.merchant}` : "";
    const category = entry.categories?.[0] ? ` · ${entry.categories[0]}` : "";
    const account = entry.account_label ? `\n   Conta: ${entry.account_label}` : "\n   Conta: sem vínculo";
    const payment = ` · ${paymentLabel(entry.payment_method)}`;
    return `${index + 1}. ${label} — ${money(Number(entry.amount))}${merchant}${category}${account}${payment}`;
  });
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return `${lines.join("\n")}\n\nTotal: ${money(total)}\n\n*1 — CONFIRMAR*\n*2 — CANCELAR*`;
}

function summarizeProposal(proposal: AgentActionProposal) {
  return `Entendi a ação:\n\n*${proposal.title}*\n${proposal.summary}\n\nNada foi alterado ainda.\n\n*1 — CONFIRMAR*\n*2 — CANCELAR*`;
}

async function logWebhookEvent(input: {
  status: string;
  waId?: string | null;
  providerMessageId?: string | null;
  messageCount?: number;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await adminSupabase.from("whatsapp_webhook_events").insert({
      event_type: "WEBHOOK",
      status: input.status,
      wa_id: input.waId ?? null,
      provider_message_id: input.providerMessageId ?? null,
      message_count: input.messageCount ?? 0,
      error_message: input.error ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {}
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
    .select("id,action_type,payload,status,expires_at,original_text")
    .eq("user_id", userId)
    .eq("wa_id", waId)
    .eq("status", "WAITING_CONFIRMATION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await adminSupabase.from("agent_pending_actions").update({
      status: "EXPIRED",
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    return null;
  }
  return data;
}

async function cancelWaiting(userId: string, waId: string, reason = "Substituída por nova solicitação") {
  await adminSupabase.from("agent_pending_actions").update({
    status: "CANCELLED",
    last_error: reason,
    updated_at: new Date().toISOString(),
  })
    .eq("user_id", userId)
    .eq("wa_id", waId)
    .eq("status", "WAITING_CONFIRMATION");
}

async function enrichEntriesWithAccount(userId: string, product: Product, text: string, entries: AiFinancialEntry[]) {
  const payment = inferPaymentMethod(text);
  if (product === "MEDICAL") {
    return entries.map((entry) => ({ ...entry, payment_method: entry.payment_method || payment })) as WhatsAppEntry[];
  }

  const { data } = await adminSupabase.from("financial_accounts")
    .select("id,name,institution,current_balance")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name");
  const accounts = data ?? [];
  const normalized = normalizeWhatsAppText(text);
  const matched = accounts.filter((account: any) =>
    [account.name, account.institution]
      .filter(Boolean)
      .some((value) => normalized.includes(normalizeWhatsAppText(String(value))))
  );
  const chosen: any = matched.length === 1 ? matched[0] : accounts.length === 1 ? accounts[0] : null;

  return entries.map((entry) => ({
    ...entry,
    account_id: entry.account_id || chosen?.id || null,
    account_label: chosen ? `${chosen.institution ? `${chosen.institution} · ` : ""}${chosen.name}` : null,
    payment_method: entry.payment_method || payment || "PIX",
  })) as WhatsAppEntry[];
}

async function executePending(pendingId: string) {
  const { data, error } = await adminSupabase.rpc("equity_whatsapp_execute_pending_action", {
    p_pending_id: pendingId,
  });
  if (error) throw error;
  return data as { ok?: boolean; message?: string; expired?: boolean } | null;
}

async function processTextMessage(waIdRaw: string, messageId: string, text: string, messageType = "text") {
  const waId = String(waIdRaw || "").replace(/\D/g, "");
  const existing = await adminSupabase.from("agent_messages").select("id").eq("provider_message_id", messageId).maybeSingle();
  if (existing.data) return;

  let resolved = await resolveWhatsAppUser(waId);
  await logAgentMessage({
    userId: resolved?.userId ?? null,
    waId,
    direction: "IN",
    providerMessageId: messageId,
    messageType,
    body: text,
  });

  if (!resolved) {
    const codeMatch = text.trim().toUpperCase().match(/^EONE-\d{6}$/);
    if (codeMatch) {
      const activated = await activateConnectionByCode(waId, codeMatch[0]);
      if (activated.ok) {
        await sendAndLog(
          activated.userId,
          waId,
          "✅ *WhatsApp conectado ao Equity One.*\n\nEu sou o *Meu Agente Financeiro*. Posso consultar seus dados, registrar lançamentos e preparar ações financeiras.\n\nConsultas respondem direto. Qualquer ação que altere seus dados sempre pedirá confirmação.\n\nExemplo: “Gastei 80 reais na farmácia hoje pelo PIX.”",
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
      "Olá! 👋 Eu sou o *Meu Agente Financeiro* do Equity One.\n\nPara usar este número, conecte seu WhatsApp dentro da sua conta Equity One e envie aqui o código *EONE-XXXXXX* gerado pelo sistema.",
    );
    return;
  }

  const pending = await getPendingAction(resolved.userId, waId);

  if (pending && isConfirmation(text)) {
    try {
      const result = await executePending(pending.id);
      await sendAndLog(
        resolved.userId,
        waId,
        result?.message || (result?.expired ? "Essa confirmação expirou. Envie o pedido novamente." : "✅ Ação confirmada no Equity One."),
      );
    } catch (error: any) {
      console.error("WhatsApp pending action execution", error);
      await adminSupabase.from("agent_pending_actions").update({
        status: "FAILED",
        last_error: String(error?.message || "Falha ao executar"),
        updated_at: new Date().toISOString(),
      }).eq("id", pending.id);
      await sendAndLog(resolved.userId, waId, "⚠️ Não consegui concluir essa ação. Ela não foi aplicada. Envie o pedido novamente em alguns instantes.");
    }
    return;
  }

  if (pending && isCancellation(text)) {
    await adminSupabase.from("agent_pending_actions").update({
      status: "CANCELLED",
      updated_at: new Date().toISOString(),
    }).eq("id", pending.id);
    await sendAndLog(resolved.userId, waId, "Tudo certo. A ação foi cancelada e nenhum dado foi alterado.");
    return;
  }

  try {
    const requestData = {
      product: resolved.product,
      userId: resolved.userId,
      text,
      nowIso: new Date().toISOString(),
      timezone: "America/Sao_Paulo",
    };

    const deepAction = await detectDeepAgentAction(requestData);
    const result = deepAction ?? await runFinancialAgent({ channel: "WHATSAPP", ...requestData });

    if (result.action === "ANSWER") {
      await sendAndLog(resolved.userId, waId, result.message);
      return;
    }

    await cancelWaiting(resolved.userId, waId);

    if (result.action === "PROPOSE_AGENT_ACTION") {
      const { error } = await adminSupabase.from("agent_pending_actions").insert({
        user_id: resolved.userId,
        wa_id: waId,
        action_type: "PROPOSE_AGENT_ACTION",
        payload: { product: resolved.product, proposal: result.proposal },
        original_text: text,
        status: "WAITING_CONFIRMATION",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
      await sendAndLog(resolved.userId, waId, summarizeProposal(result.proposal));
      return;
    }

    const entries = await enrichEntriesWithAccount(
      resolved.userId,
      resolved.product,
      text,
      result.entries ?? [],
    );

    if (!entries.length) {
      await sendAndLog(resolved.userId, waId, "Não encontrei nenhum lançamento válido nessa mensagem. Tente informar o valor e o que aconteceu.");
      return;
    }

    const { error } = await adminSupabase.from("agent_pending_actions").insert({
      user_id: resolved.userId,
      wa_id: waId,
      action_type: "PROPOSE_FINANCIAL_ENTRIES",
      payload: { product: resolved.product, entries },
      original_text: text,
      status: "WAITING_CONFIRMATION",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (error) throw error;

    const withoutAccount = resolved.product !== "MEDICAL" && entries.some((entry) => !entry.account_id);
    const accountWarning = withoutAccount
      ? "\n\nℹ️ Há mais de uma conta financeira e eu não consegui identificar qual usar. Se confirmar, o lançamento será salvo sem alterar o saldo de uma conta específica. Para vincular, cancele e reenvie citando o nome da conta."
      : "";
    await sendAndLog(resolved.userId, waId, `Entendi. Confira antes de registrar:\n\n${summarizeEntries(entries)}${accountWarning}`);
  } catch (error: any) {
    console.error("WhatsApp agent error", error);
    await logWebhookEvent({ status: "PROCESS_ERROR", waId, providerMessageId: messageId, error: String(error?.message || error) });
    await sendAndLog(resolved.userId, waId, "Não consegui interpretar essa mensagem agora. Tente escrever de outra forma.");
  }
}

function collectMessages(payload: any) {
  const result: { waId: string; messageId: string; text: string; messageType: string }[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const message of messages) {
        if (!message?.from || !message?.id) continue;
        let text = "";
        let messageType = String(message.type || "unknown");
        if (message.type === "text") text = String(message?.text?.body || "");
        else if (message.type === "button") text = String(message?.button?.text || message?.button?.payload || "");
        else if (message.type === "interactive") {
          text = String(
            message?.interactive?.button_reply?.id ||
            message?.interactive?.button_reply?.title ||
            message?.interactive?.list_reply?.id ||
            message?.interactive?.list_reply?.title ||
            "",
          );
        }
        if (text.trim()) {
          result.push({ waId: String(message.from), messageId: String(message.id), text: text.trim(), messageType });
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
  const startedAt = Date.now();
  try {
    const rawBody = await request.text();
    if (!validMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      await logWebhookEvent({ status: "INVALID_SIGNATURE" });
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const messages = collectMessages(payload);
    await logWebhookEvent({
      status: "RECEIVED",
      messageCount: messages.length,
      metadata: { object: payload?.object || null, duration_ms: Date.now() - startedAt },
    });

    for (const message of messages) {
      await processTextMessage(message.waId, message.messageId, message.text, message.messageType);
      await logWebhookEvent({
        status: "PROCESSED",
        waId: message.waId,
        providerMessageId: message.messageId,
        messageCount: 1,
        metadata: { type: message.messageType },
      });
    }
  } catch (error: any) {
    console.error("WhatsApp webhook error", error);
    await logWebhookEvent({ status: "WEBHOOK_ERROR", error: String(error?.message || error) });
  }
  return NextResponse.json({ received: true });
}
