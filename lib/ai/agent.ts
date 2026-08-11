import type { AiProduct } from "@/lib/ai-finance";
import { allowedCategories } from "@/lib/ai-finance";
import { interpretFinancialMessage } from "@/lib/ai/provider";
import { adminSupabase } from "@/lib/admin";

export type AgentChannel = "WEB" | "WHATSAPP";

export type AgentFinancialRequest = {
  channel: AgentChannel;
  product: AiProduct;
  userId: string;
  text: string;
  nowIso: string;
  timezone: string;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function monthRange(nowIso: string) {
  const d = new Date(nowIso);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function detectCategory(product: AiProduct, text: string) {
  const haystack = normalize(text);
  const all = allowedCategories(product);
  const categories = [...all.expense, ...all.income, ...all.tax]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const exact = categories.find((category) => haystack.includes(normalize(category)));
  if (exact) return exact;

  const aliases: Record<string, string[]> = {
    Supermercado: ["supermercado", "mercado", "assai", "atacadao", "atacarejo"],
    Combustível: ["combustivel", "gasolina", "etanol", "diesel", "posto"],
    Farmácia: ["farmacia", "remedio", "medicamento"],
    Restaurante: ["restaurante", "almoco", "jantar"],
    Delivery: ["delivery", "ifood", "rappi"],
  };

  for (const [category, words] of Object.entries(aliases)) {
    if (categories.includes(category) && words.some((word) => haystack.includes(word))) return category;
  }

  return null;
}

async function readTransactions(product: AiProduct, userId: string, start: string, end: string) {
  if (product === "MEDICAL") {
    const { data, error } = await adminSupabase
      .from("medical_professional_transactions")
      .select("id,transaction_date,kind,category,amount,description,merchant")
      .eq("user_id", userId)
      .gte("transaction_date", start)
      .lte("transaction_date", end)
      .order("transaction_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((item: any) => ({
      id: item.id,
      occurred_on: item.transaction_date,
      type: item.kind === "INCOME" ? "INCOME" : "EXPENSE",
      category: item.category,
      categories: [item.category].filter(Boolean),
      amount: Number(item.amount),
      description: item.description,
      merchant: item.merchant,
    }));
  }

  const { data, error } = await adminSupabase
    .from("transactions")
    .select("id,occurred_on,type,category,categories,amount,description,merchant")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item: any) => ({ ...item, amount: Number(item.amount) }));
}

async function answerMonthSummary(request: AgentFinancialRequest) {
  const range = monthRange(request.nowIso);
  const rows = await readTransactions(request.product, request.userId, range.start, range.end);
  const income = rows.filter((r) => r.type === "INCOME").reduce((sum, r) => sum + r.amount, 0);
  const expense = rows.filter((r) => r.type !== "INCOME").reduce((sum, r) => sum + r.amount, 0);
  const balance = income - expense;
  return {
    channel: request.channel,
    action: "ANSWER" as const,
    requiresConfirmation: false,
    message: `Neste mês entraram ${brl.format(income)}, saíram ${brl.format(expense)} e o resultado dos lançamentos está em ${brl.format(balance)}.`,
    data: { income, expense, balance, count: rows.length, period: range },
  };
}

async function answerCategorySpend(request: AgentFinancialRequest, category: string) {
  const range = monthRange(request.nowIso);
  const rows = await readTransactions(request.product, request.userId, range.start, range.end);
  const needle = normalize(category);
  const matched = rows.filter((r) => {
    if (r.type === "INCOME") return false;
    const fields = [r.category, ...(Array.isArray(r.categories) ? r.categories : []), r.merchant, r.description]
      .filter(Boolean)
      .map((value) => normalize(String(value)));
    return fields.some((value) => value.includes(needle) || needle.includes(value));
  });
  const total = matched.reduce((sum, r) => sum + r.amount, 0);
  const average = matched.length ? total / matched.length : 0;
  return {
    channel: request.channel,
    action: "ANSWER" as const,
    requiresConfirmation: false,
    message: matched.length
      ? `Neste mês você gastou ${brl.format(total)} com ${category}, em ${matched.length} lançamento(s). A média foi ${brl.format(average)} por lançamento.`
      : `Não encontrei gastos com ${category} neste mês.`,
    data: { category, total, average, count: matched.length, period: range },
  };
}

async function answerLatest(request: AgentFinancialRequest) {
  const range = monthRange(request.nowIso);
  const rows = (await readTransactions(request.product, request.userId, range.start, range.end)).slice(0, 5);
  if (!rows.length) {
    return { channel: request.channel, action: "ANSWER" as const, requiresConfirmation: false, message: "Você ainda não possui lançamentos neste mês.", data: { items: [] } };
  }
  const lines = rows.map((r, index) => `${index + 1}. ${r.description || r.category} — ${brl.format(r.amount)}`);
  return {
    channel: request.channel,
    action: "ANSWER" as const,
    requiresConfirmation: false,
    message: `Seus últimos lançamentos do mês são:\n${lines.join("\n")}`,
    data: { items: rows },
  };
}

async function answerUpcomingBills(request: AgentFinancialRequest) {
  if (request.product === "MEDICAL") {
    return {
      channel: request.channel,
      action: "ANSWER" as const,
      requiresConfirmation: false,
      message: "A consulta de contas a vencer do produto Médicos será conectada ao módulo de recebíveis e obrigações na próxima etapa do agente.",
      data: { items: [] },
    };
  }

  const today = new Date(request.nowIso);
  const start = today.toISOString().slice(0, 10);
  const future = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await adminSupabase
    .from("obligations")
    .select("id,description,amount,kind,due_date,status")
    .eq("user_id", request.userId)
    .eq("status", "PENDING")
    .gte("due_date", start)
    .lte("due_date", future)
    .order("due_date", { ascending: true })
    .limit(10);
  if (error) throw error;
  const items = data ?? [];
  if (!items.length) {
    return { channel: request.channel, action: "ANSWER" as const, requiresConfirmation: false, message: "Você não tem contas pendentes vencendo nos próximos 7 dias.", data: { items: [] } };
  }
  const lines = items.map((item: any) => `${item.description} — ${brl.format(Number(item.amount))} — ${item.due_date.split("-").reverse().join("/")}`);
  return {
    channel: request.channel,
    action: "ANSWER" as const,
    requiresConfirmation: false,
    message: `Encontrei ${items.length} conta(s) pendente(s) nos próximos 7 dias:\n${lines.join("\n")}`,
    data: { items },
  };
}

/**
 * Núcleo oficial do Meu Agente Financeiro.
 * Site e futuro WhatsApp utilizam a mesma função.
 * Consultas podem ser respondidas imediatamente. Ações financeiras retornam proposta e exigem confirmação.
 */
export async function runFinancialAgent(request: AgentFinancialRequest) {
  const normalized = normalize(request.text);
  const category = detectCategory(request.product, request.text);

  const asksUpcoming = /(conta|boleto|pagamento).*(venc|proxim|semana)|venc.*(conta|boleto)/.test(normalized);
  if (asksUpcoming) return answerUpcomingBills(request);

  const asksLatest = /(ultim|recent).*(lancamento|gasto|despesa|receita)|o que eu (gastei|recebi) por ultimo/.test(normalized);
  if (asksLatest) return answerLatest(request);

  const asksCategory = category && /(quanto|total|gastei|gasto|gastos|despesa).*(mes|categoria|supermercado|mercado|combustivel|gasolina|farmacia|restaurante|delivery|assai|atacadao)/.test(normalized);
  if (asksCategory) return answerCategorySpend(request, category);

  const asksSummary = /(resumo|balanco|resultado|saldo).*(mes|mensal)|quanto (entrou|recebi|gastei|saiu).*mes|como est[aá].*(finance|mes)/.test(normalized);
  if (asksSummary) return answerMonthSummary(request);

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
