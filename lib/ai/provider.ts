import type { AiFinancialEntry, AiProduct } from "@/lib/ai-finance";
import { allowedCategories, normalizeAiEntries } from "@/lib/ai-finance";

export type InterpretFinancialInput = {
  product: AiProduct;
  text: string;
  nowIso: string;
  timezone: string;
};

export type InterpretFinancialResult = {
  provider: "GEMINI";
  model: string;
  entries: AiFinancialEntry[];
};

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

function getApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new AiProviderError(
      "A inteligência financeira ainda não foi configurada pelo administrador.",
      503,
      "GEMINI_NOT_CONFIGURED",
    );
  }
  return key;
}

export class AiProviderError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(message: string, status = 502, code = "AI_PROVIDER_ERROR", details?: string) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildInstructions(input: InterpretFinancialInput) {
  const categories = allowedCategories(input.product);
  return [
    "Você é o interpretador financeiro do Equity One.",
    `Produto atual: ${input.product}.`,
    `Agora: ${input.nowIso}. Fuso do usuário: ${input.timezone}.`,
    "Converta a mensagem do usuário em lançamentos financeiros estruturados.",
    "Retorne SOMENTE JSON válido, sem markdown, sem texto antes ou depois.",
    "Use exatamente este formato: {\"entries\":[{\"kind\":\"EXPENSE\",\"description\":\"Compra\",\"merchant\":\"Assaí\",\"amount\":300,\"categories\":[\"Supermercado\"],\"occurred_on\":\"YYYY-MM-DD\",\"occurred_at\":\"ISO-8601\",\"notes\":null,\"confidence\":0.95}]}",
    "Regras obrigatórias:",
    "1. Separe múltiplos gastos/receitas da mesma mensagem em lançamentos distintos.",
    "2. kind deve ser INCOME ou EXPENSE; no produto MEDICAL também pode ser TAX.",
    "3. Resolva hoje, agora, ontem, amanhã e datas relativas usando Agora e o fuso informados.",
    "4. Nunca invente um valor ausente. Se não houver valor financeiro identificável, retorne {\"entries\":[]}.",
    "5. Para despesas, use a categoria mais específica da lista permitida como primeira categoria.",
    "6. O primeiro item de categories é sempre a categoria principal; até três adicionais podem complementar sem duplicar valores.",
    "7. Preencha merchant quando houver estabelecimento, empresa, hospital, cliente ou fornecedor identificável.",
    "8. confidence deve ser um número entre 0 e 1.",
    "9. Quando não houver outra moeda explicitada, interprete valores como reais brasileiros.",
    "10. Preserve a intenção do usuário; não transforme transferência, investimento ou pagamento em receita sem evidência.",
    `Receitas permitidas: ${categories.income.join(" | ") || "nenhuma"}.`,
    `Despesas permitidas: ${categories.expense.join(" | ") || "nenhuma"}.`,
    `Impostos permitidos: ${categories.tax.join(" | ") || "nenhuma"}.`,
  ].join("\n");
}

function extractGeminiText(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
}

function stripJsonFence(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseGeminiError(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return {
      message: String(parsed?.error?.message ?? ""),
      status: String(parsed?.error?.status ?? ""),
    };
  } catch {
    return { message: raw.slice(0, 500), status: "" };
  }
}

function friendlyGeminiError(statusCode: number, raw: string) {
  const parsed = parseGeminiError(raw);
  const details = [parsed.status, parsed.message].filter(Boolean).join(": ");

  if (statusCode === 400) return new AiProviderError("A Gemini recusou a requisição enviada pelo sistema.", 502, "GEMINI_BAD_REQUEST", details);
  if (statusCode === 401 || statusCode === 403) return new AiProviderError("A chave do Gemini não foi aceita. Revise a GEMINI_API_KEY na Vercel.", 503, "GEMINI_AUTH", details);
  if (statusCode === 404) return new AiProviderError("O modelo Gemini configurado não foi encontrado.", 502, "GEMINI_MODEL_NOT_FOUND", details);
  if (statusCode === 429) return new AiProviderError("O limite gratuito da Gemini foi atingido temporariamente. Tente novamente em alguns instantes.", 429, "GEMINI_RATE_LIMIT", details);
  if (statusCode === 503) return new AiProviderError("A Gemini está temporariamente indisponível. Tente novamente em alguns instantes.", 503, "GEMINI_UNAVAILABLE", details);
  return new AiProviderError(`Não foi possível interpretar o lançamento agora. Gemini HTTP ${statusCode}.`, 502, "GEMINI_ERROR", details);
}

function modelCandidates(envValue?: string | null) {
  const configured = envValue?.trim();
  return Array.from(new Set([configured, ...FALLBACK_MODELS].filter(Boolean))) as string[];
}

async function callGeminiText(apiKey: string, model: string, input: InterpretFinancialInput) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildInstructions(input) }] },
      contents: [{ role: "user", parts: [{ text: input.text }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
    cache: "no-store",
  });

  const raw = await response.text();
  return { response, raw };
}

export async function interpretFinancialMessage(input: InterpretFinancialInput): Promise<InterpretFinancialResult> {
  const apiKey = getApiKey();
  const candidates = modelCandidates(process.env.GEMINI_FINANCE_MODEL);
  let last404 = "";

  for (const model of candidates) {
    const { response, raw } = await callGeminiText(apiKey, model, input);

    if (response.status === 404) {
      console.warn("Gemini model not found, trying fallback", model, raw.slice(0, 500));
      last404 = raw;
      continue;
    }

    if (!response.ok) {
      console.error("Gemini financial-entry error", model, response.status, raw.slice(0, 1000));
      throw friendlyGeminiError(response.status, raw);
    }

    let responseJson: any = {};
    try {
      responseJson = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AiProviderError("A Gemini retornou uma resposta inválida.", 502, "GEMINI_INVALID_RESPONSE");
    }

    const outputText = stripJsonFence(extractGeminiText(responseJson));
    if (!outputText) {
      const finishReason = String(responseJson?.candidates?.[0]?.finishReason ?? "");
      throw new AiProviderError(
        finishReason ? `A Gemini não retornou um lançamento utilizável (${finishReason}).` : "A Gemini não retornou lançamentos utilizáveis.",
        502,
        "GEMINI_EMPTY_RESPONSE",
      );
    }

    let parsed: { entries?: AiFinancialEntry[] };
    try {
      parsed = JSON.parse(outputText);
    } catch {
      console.error("Gemini invalid JSON", model, outputText.slice(0, 1000));
      throw new AiProviderError("Não foi possível organizar o lançamento retornado pela Gemini.", 502, "GEMINI_INVALID_JSON");
    }

    const entries = normalizeAiEntries(Array.isArray(parsed.entries) ? parsed.entries : [], input.product);
    if (!entries.length) {
      throw new AiProviderError("Não encontrei um valor financeiro válido nessa descrição.", 400, "NO_FINANCIAL_ENTRY");
    }

    return { provider: "GEMINI", model, entries };
  }

  throw friendlyGeminiError(404, last404 || "Nenhum modelo Gemini compatível foi encontrado para esta chave.");
}

export async function transcribeAudioWithGemini(file: File) {
  const apiKey = getApiKey();
  const candidates = modelCandidates(process.env.GEMINI_AUDIO_MODEL);
  const bytes = Buffer.from(await file.arrayBuffer());
  let last404 = "";

  for (const model of candidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Transcreva fielmente esta mensagem de voz em português do Brasil. Retorne somente a transcrição, sem explicações, sem markdown e sem aspas.",
              },
              {
                inlineData: {
                  mimeType: file.type || "audio/webm",
                  data: bytes.toString("base64"),
                },
              },
            ],
          },
        ],
      }),
      cache: "no-store",
    });

    const raw = await response.text();

    if (response.status === 404) {
      console.warn("Gemini audio model not found, trying fallback", model, raw.slice(0, 500));
      last404 = raw;
      continue;
    }

    if (!response.ok) {
      console.error("Gemini transcription error", model, response.status, raw.slice(0, 1000));
      throw friendlyGeminiError(response.status, raw);
    }

    let payload: any = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AiProviderError("Não foi possível transcrever o áudio.", 502, "GEMINI_AUDIO_INVALID_RESPONSE");
    }

    const text = extractGeminiText(payload).trim();
    if (!text) throw new AiProviderError("Não consegui entender essa mensagem de voz.", 400, "GEMINI_AUDIO_EMPTY");
    return { provider: "GEMINI" as const, model, text };
  }

  throw friendlyGeminiError(404, last404 || "Nenhum modelo Gemini compatível com áudio foi encontrado para esta chave.");
}
