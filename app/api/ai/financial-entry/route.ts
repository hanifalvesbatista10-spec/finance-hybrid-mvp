import { NextResponse } from "next/server";
import type { AiProduct } from "@/lib/ai-finance";
import { AiProviderError } from "@/lib/ai/provider";
import { runFinancialAgent } from "@/lib/ai/agent";
import { detectDeepAgentAction } from "@/lib/ai/deep-actions";
import { requireActiveUser } from "@/lib/server-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const product = String(body.product ?? "").toUpperCase() as AiProduct;
    if (!["PERSONAL", "BUSINESS", "MEDICAL"].includes(product)) {
      return NextResponse.json({ error: "Produto inválido." }, { status: 400 });
    }

    const auth = await requireActiveUser(request, product);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const text = String(body.text ?? "").trim();
    if (text.length < 3) return NextResponse.json({ error: "Escreva sua mensagem com um pouco mais de detalhe." }, { status: 400 });
    if (text.length > 1200) return NextResponse.json({ error: "A mensagem está muito longa. Resuma em até 1.200 caracteres." }, { status: 400 });

    const requestData = {
      product,
      userId: auth.user.id,
      text,
      nowIso: String(body.now_iso || new Date().toISOString()),
      timezone: String(body.timezone || "America/Sao_Paulo"),
    };

    const deepAction = await detectDeepAgentAction(requestData);
    const result = deepAction ?? await runFinancialAgent({ channel: "WEB", ...requestData });

    if (result.action === "ANSWER") {
      return NextResponse.json({
        action: result.action,
        message: result.message,
        data: result.data,
        requires_confirmation: false,
      });
    }

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
