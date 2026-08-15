import { NextResponse } from "next/server";
import type { AiProduct } from "@/lib/ai-finance";
import { AiProviderError } from "@/lib/ai/provider";
import { runFinancialAgent } from "@/lib/ai/agent";
import { detectDeepAgentAction } from "@/lib/ai/deep-actions";
import { adminSupabase } from "@/lib/admin";
import { requireActiveUser } from "@/lib/server-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isExplicitNewIntent(text: string) {
  const value = normalize(text);
  if (/^\//.test(value)) return true;
  return /^(gastei|recebi|paguei|comprei|crie|criar|cadastre|cadastrar|registre|registrar|adicione|adicionar|retire|retirar|qual|quais|quanto|como|onde|mostre|resumo)\b/.test(value);
}

function needsClarification(message: string) {
  const value = normalize(message);
  return /(qual (e|foi|valor|data|conta|cartao|meta)|qual deles|qual delas|em qual|informe qual|diga em qual|mais de uma meta|mais de um cartao|qual valor|qual data|qual vencimento)/.test(value);
}

function normalizeDeepActionText(text: string) {
  const value = normalize(text);
  const createsBill = /(cadastre|cadastrar|registre|registrar|adicione|adicionar).*(conta|boleto)/.test(value);
  const hasDueDate = /(vence|vencimento|dia\s+\d{1,2}|\d{1,2}\/\d{1,2})/.test(value);
  const alreadyTyped = /(pagar|receber|conta a pagar|conta a receber)/.test(value);
  if (createsBill && hasDueDate && !alreadyTyped) return `${text} como conta a pagar`;
  return text;
}

async function getWebClarification(userId: string) {
  const { data } = await adminSupabase
    .from("agent_pending_actions")
    .select("id,original_text,expires_at")
    .eq("user_id", userId)
    .eq("wa_id", "WEB")
    .eq("action_type", "CLARIFICATION")
    .eq("status", "WAITING_CONTEXT")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id?: string; original_text?: string | null; expires_at?: string | null } | null;
}

async function clearWebClarification(userId: string) {
  await adminSupabase
    .from("agent_pending_actions")
    .delete()
    .eq("user_id", userId)
    .eq("wa_id", "WEB")
    .eq("action_type", "CLARIFICATION");
}

async function saveWebClarification(userId: string, originalText: string) {
  await clearWebClarification(userId);
  await adminSupabase.from("agent_pending_actions").insert({
    user_id: userId,
    wa_id: "WEB",
    action_type: "CLARIFICATION",
    payload: { channel: "WEB" },
    original_text: originalText,
    status: "WAITING_CONTEXT",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const product = String(body.product ?? "").toUpperCase() as AiProduct;
    if (!["PERSONAL", "BUSINESS", "MEDICAL"].includes(product)) {
      return NextResponse.json({ error: "Produto inválido." }, { status: 400 });
    }

    const auth = await requireActiveUser(request, product);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rawText = String(body.text ?? "").trim();
    const pending = await getWebClarification(auth.user.id);

    if (!rawText) return NextResponse.json({ error: "Escreva sua mensagem." }, { status: 400 });
    if (!pending && rawText.length < 3) return NextResponse.json({ error: "Escreva sua mensagem com um pouco mais de detalhe." }, { status: 400 });
    if (rawText.length > 1200) return NextResponse.json({ error: "A mensagem está muito longa. Resuma em até 1.200 caracteres." }, { status: 400 });

    const continuePrevious = Boolean(pending?.original_text) && !isExplicitNewIntent(rawText);
    const conversationalText = continuePrevious ? `${pending?.original_text} ${rawText}` : rawText;
    const deepText = normalizeDeepActionText(conversationalText);

    const requestData = {
      product,
      userId: auth.user.id,
      text: deepText,
      nowIso: String(body.now_iso || new Date().toISOString()),
      timezone: String(body.timezone || "America/Sao_Paulo"),
    };

    const deepAction = await detectDeepAgentAction(requestData);
    const result = deepAction ?? await runFinancialAgent({ channel: "WEB", ...requestData, text: rawText });

    if (result.action === "ANSWER") {
      if (deepAction && needsClarification(result.message)) {
        await saveWebClarification(auth.user.id, deepText);
      } else if (pending) {
        await clearWebClarification(auth.user.id);
      }

      return NextResponse.json({
        action: result.action,
        message: result.message,
        data: result.data,
        awaiting_context: Boolean(deepAction && needsClarification(result.message)),
        requires_confirmation: false,
      });
    }

    if (pending) await clearWebClarification(auth.user.id);

    if (result.action === "PROPOSE_AGENT_ACTION") {
      return NextResponse.json({
        action: result.action,
        proposal: result.proposal,
        requires_confirmation: true,
      });
    }

    return NextResponse.json({
      action: result.action,
      entries: result.entries,
      provider: result.provider,
      model: result.model,
      requires_confirmation: result.requiresConfirmation,
    });
  } catch (error) {
    if (error instanceof AiProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Erro inesperado no Meu Agente Financeiro." }, { status: 500 });
  }
}
