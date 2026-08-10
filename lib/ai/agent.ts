import type { AiProduct } from "@/lib/ai-finance";
import { interpretFinancialMessage } from "@/lib/ai/provider";

export type AgentChannel = "WEB" | "WHATSAPP";

export type AgentFinancialRequest = {
  channel: AgentChannel;
  product: AiProduct;
  text: string;
  nowIso: string;
  timezone: string;
};

/**
 * Núcleo compartilhado do Agente Equity One.
 * Hoje é usado pelo site; o futuro webhook do WhatsApp chamará esta mesma função.
 * A IA apenas propõe ações. A gravação no banco continua dependendo de validação/confirmacão.
 */
export async function runFinancialAgent(request: AgentFinancialRequest) {
  const result = await interpretFinancialMessage({
    product: request.product,
    text: request.text,
    nowIso: request.nowIso,
    timezone: request.timezone,
  });

  return {
    channel: request.channel,
    action: "PROPOSE_FINANCIAL_ENTRIES" as const,
    requiresConfirmation: true,
    ...result,
  };
}
