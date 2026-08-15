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
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function monthRange(nowIso: string) {
  const d = new Date(nowIso);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function detectCategory(product: AiProduct, text: string) {
  const haystack = normalize(text);
  const all = allowedCategories(product);
  const categories = [...all.expense, ...all.income, ...all.tax].filter(Boolean).sort((a, b) => b.length - a.length);
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
    const { data, error } = await adminSupabase.from("medical_professional_transactions")
      .select("id,transaction_date,kind,category,amount,description,merchant")
      .eq("user_id", userId).gte("transaction_date", start).lte("transaction_date", end)
      .order("transaction_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((item: any) => ({
      id: item.id, occurred_on: item.transaction_date, type: item.kind === "INCOME" ? "INCOME" : "EXPENSE",
      category: item.category, categories: [item.category].filter(Boolean), amount: Number(item.amount),
      description: item.description, merchant: item.merchant,
    }));
  }

  const { data, error } = await adminSupabase.from("transactions")
    .select("id,occurred_on,type,category,categories,amount,description,merchant")
    .eq("user_id", userId).gte("occurred_on", start).lte("occurred_on", end)
    .order("occurred_on", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item: any) => ({ ...item, amount: Number(item.amount) }));
}

function answer(channel: AgentChannel, message: string, data: unknown = {}) {
  return { channel, action: "ANSWER" as const, requiresConfirmation: false, message, data };
}

function answerHelp(request: AgentFinancialRequest) {
  const basic = [
    "💰 /saldo — ver o saldo das suas contas",
    "💳 /faturas — consultar faturas pendentes",
    "📊 /gastos — ver onde você mais gastou no mês",
    "🎯 /metas — acompanhar suas metas",
    "📅 /vencimentos — contas que vencem nos próximos dias",
    "❓ /ajuda — mostrar este guia",
  ];
  const actions = request.product === "MEDICAL"
    ? ["Você também pode registrar receitas e despesas falando normalmente, por exemplo: “Recebi R$ 1.500 de um plantão”."]
    : [
        "💸 “Gastei R$ 80 na farmácia hoje”",
        "💵 “Recebi R$ 1.500 de um serviço”",
        "🧾 “Cadastre uma conta de energia de R$ 220 que vence dia 20”",
        "🎯 “Crie uma meta Viagem de R$ 10.000”",
        "📈 “Adicione R$ 300 à minha meta Reserva de emergência”",
        "💳 “Comprei R$ 900 no cartão em 3x”",
      ];
  return answer(
    request.channel,
    `*Meu Agente Financeiro — Equity One*\n\nAtalhos rápidos:\n${basic.join("\n")}\n\nVocê não precisa decorar comandos. Pode falar normalmente:\n${actions.join("\n")}\n\n🔒 Consultas não alteram seus dados. Qualquer ação financeira precisa da sua confirmação.`,
    { command: "help" },
  );
}

async function answerMonthSummary(request: AgentFinancialRequest) {
  const range = monthRange(request.nowIso);
  const rows = await readTransactions(request.product, request.userId, range.start, range.end);
  const income = rows.filter((r) => r.type === "INCOME").reduce((sum, r) => sum + r.amount, 0);
  const expense = rows.filter((r) => r.type !== "INCOME").reduce((sum, r) => sum + r.amount, 0);
  const balance = income - expense;
  return answer(request.channel, `Neste mês entraram ${brl.format(income)}, saíram ${brl.format(expense)} e o resultado dos lançamentos está em ${brl.format(balance)}.`, { income, expense, balance, count: rows.length, period: range });
}

async function answerCategorySpend(request: AgentFinancialRequest, category: string) {
  const range = monthRange(request.nowIso);
  const rows = await readTransactions(request.product, request.userId, range.start, range.end);
  const needle = normalize(category);
  const matched = rows.filter((r) => {
    if (r.type === "INCOME") return false;
    const fields = [r.category, ...(Array.isArray(r.categories) ? r.categories : []), r.merchant, r.description]
      .filter(Boolean).map((value) => normalize(String(value)));
    return fields.some((value) => value.includes(needle) || needle.includes(value));
  });
  const total = matched.reduce((sum, r) => sum + r.amount, 0);
  const average = matched.length ? total / matched.length : 0;
  return answer(request.channel,
    matched.length ? `Neste mês você gastou ${brl.format(total)} com ${category}, em ${matched.length} lançamento(s). A média foi ${brl.format(average)} por lançamento.` : `Não encontrei gastos com ${category} neste mês.`,
    { category, total, average, count: matched.length, period: range });
}

async function answerLatest(request: AgentFinancialRequest) {
  const range = monthRange(request.nowIso);
  const rows = (await readTransactions(request.product, request.userId, range.start, range.end)).slice(0, 5);
  if (!rows.length) return answer(request.channel, "Você ainda não possui lançamentos neste mês.", { items: [] });
  const lines = rows.map((r, index) => `${index + 1}. ${r.description || r.category} — ${brl.format(r.amount)}`);
  return answer(request.channel, `Seus últimos lançamentos do mês são:\n${lines.join("\n")}`, { items: rows });
}

async function answerUpcomingBills(request: AgentFinancialRequest) {
  if (request.product === "MEDICAL") return answer(request.channel, "A consulta de contas a vencer ainda não está conectada ao produto Médicos.", { items: [] });
  const today = new Date(request.nowIso);
  const start = today.toISOString().slice(0, 10);
  const future = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await adminSupabase.from("obligations")
    .select("id,description,amount,kind,due_date,status").eq("user_id", request.userId).eq("status", "PENDING")
    .gte("due_date", start).lte("due_date", future).order("due_date", { ascending: true }).limit(10);
  if (error) throw error;
  const items = data ?? [];
  if (!items.length) return answer(request.channel, "Você não tem contas pendentes vencendo nos próximos 7 dias.", { items: [] });
  const lines = items.map((item: any) => `${item.description} — ${brl.format(Number(item.amount))} — ${item.due_date.split("-").reverse().join("/")}`);
  return answer(request.channel, `Encontrei ${items.length} conta(s) pendente(s) nos próximos 7 dias:\n${lines.join("\n")}`, { items });
}

async function answerAccounts(request: AgentFinancialRequest) {
  if (request.product === "MEDICAL") return answer(request.channel, "A consulta de saldo por contas financeiras está disponível no Equity One Pessoal e Negócios.");
  const { data, error } = await adminSupabase.from("financial_accounts")
    .select("id,name,institution,current_balance,include_in_total,is_active")
    .eq("user_id", request.userId).eq("is_active", true).order("name");
  if (error) throw error;
  const items = data ?? [];
  if (!items.length) return answer(request.channel, "Você ainda não cadastrou nenhuma conta financeira.", { items: [] });
  const total = items.filter((item: any) => item.include_in_total !== false).reduce((sum: number, item: any) => sum + Number(item.current_balance || 0), 0);
  const lines = items.slice(0, 8).map((item: any) => `${item.institution ? `${item.institution} · ` : ""}${item.name}: ${brl.format(Number(item.current_balance || 0))}`);
  return answer(request.channel, `Seu saldo total nas contas consideradas é ${brl.format(total)}.\n${lines.join("\n")}`, { total, items });
}

async function answerInvoices(request: AgentFinancialRequest) {
  if (request.product === "MEDICAL") return answer(request.channel, "A consulta de faturas está disponível no Equity One Pessoal e Negócios.");
  const { data, error } = await adminSupabase.from("card_invoices")
    .select("id,card_id,reference_month,due_date,status,total_amount,paid_amount")
    .eq("user_id", request.userId).in("status", ["OPEN", "CLOSED", "OVERDUE"])
    .order("due_date", { ascending: true }).limit(10);
  if (error) throw error;
  const invoices = data ?? [];
  if (!invoices.length) return answer(request.channel, "Você não possui faturas pendentes no momento.", { items: [] });
  const cardIds = [...new Set(invoices.map((item: any) => item.card_id).filter(Boolean))];
  const cardsResult = cardIds.length ? await adminSupabase.from("cards").select("id,nickname,issuer,last_four").in("id", cardIds) : { data: [] as any[], error: null };
  if (cardsResult.error) throw cardsResult.error;
  const cards = new Map((cardsResult.data ?? []).map((card: any) => [card.id, card]));
  const statusPt: Record<string,string> = { OPEN: "em aberto", CLOSED: "fechada", OVERDUE: "vencida" };
  const pendingTotal = invoices.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.total_amount || 0) - Number(item.paid_amount || 0)), 0);
  const lines = invoices.map((item: any) => {
    const card: any = cards.get(item.card_id);
    const name = card?.nickname || card?.issuer || (card?.last_four ? `Cartão •••• ${card.last_four}` : "Cartão");
    const pending = Math.max(0, Number(item.total_amount || 0) - Number(item.paid_amount || 0));
    const due = item.due_date ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString("pt-BR") : "sem vencimento";
    return `${name}: ${brl.format(pending)} · ${statusPt[item.status] || "pendente"} · vence ${due}`;
  });
  return answer(request.channel, `Você tem ${invoices.length} fatura(s) pendente(s), somando ${brl.format(pendingTotal)}.\n${lines.join("\n")}`, { total: pendingTotal, items: invoices });
}

async function answerGoals(request: AgentFinancialRequest) {
  const { data, error } = await adminSupabase.from("goals")
    .select("id,name,target_amount,current_amount,deadline").eq("user_id", request.userId)
    .order("created_at", { ascending: false }).limit(10);
  if (error) throw error;
  const items = data ?? [];
  if (!items.length) return answer(request.channel, "Você ainda não possui metas financeiras cadastradas.", { items: [] });
  const lines = items.map((goal: any) => {
    const target = Number(goal.target_amount || 0), current = Number(goal.current_amount || 0);
    const pct = target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0;
    const deadline = goal.deadline ? ` · prazo ${new Date(`${goal.deadline}T12:00:00`).toLocaleDateString("pt-BR")}` : "";
    return `${goal.name}: ${brl.format(current)} de ${brl.format(target)} (${pct}%)${deadline}`;
  });
  return answer(request.channel, `Suas metas estão assim:\n${lines.join("\n")}`, { items });
}

async function answerTopExpenses(request: AgentFinancialRequest) {
  const range = monthRange(request.nowIso);
  const rows = (await readTransactions(request.product, request.userId, range.start, range.end)).filter((r) => r.type !== "INCOME");
  if (!rows.length) return answer(request.channel, "Não encontrei despesas neste mês.", { items: [] });
  const totals = new Map<string, number>();
  for (const row of rows) {
    const category = String(row.category || row.categories?.[0] || "Outros");
    totals.set(category, (totals.get(category) || 0) + Number(row.amount || 0));
  }
  const top = [...totals.entries()].sort((a,b) => b[1]-a[1]).slice(0,5);
  const grand = rows.reduce((sum,r) => sum + Number(r.amount || 0),0);
  const lines = top.map(([category,total],index) => `${index+1}. ${category}: ${brl.format(total)} (${grand ? Math.round(total/grand*100) : 0}% das despesas)`);
  return answer(request.channel, `Onde você mais gastou neste mês:\n${lines.join("\n")}`, { total: grand, items: top, period: range });
}

/** Núcleo oficial do Meu Agente Financeiro. Web e WhatsApp usam a mesma função. */
export async function runFinancialAgent(request: AgentFinancialRequest) {
  const normalized = normalize(request.text);
  const category = detectCategory(request.product, request.text);

  // Atalhos rápidos: funcionam com ou sem a barra. Não passam pelo Gemini.
  if (/^\/?(ajuda|help|menu|comandos)$/.test(normalized)) return answerHelp(request);
  if (/^\/?(saldo|contas)$/.test(normalized)) return answerAccounts(request);
  if (/^\/?(faturas|fatura)$/.test(normalized)) return answerInvoices(request);
  if (/^\/?(gastos|despesas)$/.test(normalized)) return answerTopExpenses(request);
  if (/^\/?(metas|meta)$/.test(normalized)) return answerGoals(request);
  if (/^\/?(vencimentos|vencimento|contas a vencer)$/.test(normalized)) return answerUpcomingBills(request);
  if (/^\/?(resumo|mes|mensal)$/.test(normalized)) return answerMonthSummary(request);
  if (/^\/?(ultimos|recentes|lancamentos)$/.test(normalized)) return answerLatest(request);

  const asksAccounts = /(saldo.*(conta|banco|disponivel)|quanto.*(tenho|dinheiro).*(conta|banco)|quanto tenho$)/.test(normalized);
  if (asksAccounts) return answerAccounts(request);

  const asksInvoices = /(fatura|cartao).*(abert|fechad|venc|pend|quanto|valor)|quais.*faturas|minhas faturas/.test(normalized);
  if (asksInvoices) return answerInvoices(request);

  const asksGoals = /(meta|objetivo).*(como|quanto|progres|falta|and|situacao)|como estao.*metas|minhas metas/.test(normalized);
  if (asksGoals) return answerGoals(request);

  const asksTop = /(onde|categoria).*(mais gastei|maior gasto|mais gasto)|maiores gastos|top.*(gasto|despesa)/.test(normalized);
  if (asksTop) return answerTopExpenses(request);

  const asksUpcoming = /(conta|boleto|pagamento).*(venc|proxim|semana)|venc.*(conta|boleto)/.test(normalized);
  if (asksUpcoming) return answerUpcomingBills(request);

  const asksLatest = /(ultim|recent).*(lancamento|gasto|despesa|receita)|o que eu (gastei|recebi) por ultimo/.test(normalized);
  if (asksLatest) return answerLatest(request);

  const asksCategory = category && /(quanto|total|gastei|gasto|gastos|despesa).*(mes|categoria|supermercado|mercado|combustivel|gasolina|farmacia|restaurante|delivery|assai|atacadao)/.test(normalized);
  if (asksCategory) return answerCategorySpend(request, category);

  const asksSummary = /(resumo|balanco|resultado|saldo).*(mes|mensal)|quanto (entrou|recebi|gastei|saiu).*mes|como est[aá].*(finance|mes)/.test(normalized);
  if (asksSummary) return answerMonthSummary(request);

  const result = await interpretFinancialMessage({ product: request.product, text: request.text, nowIso: request.nowIso, timezone: request.timezone });
  return { channel: request.channel, action: "PROPOSE_FINANCIAL_ENTRIES" as const, requiresConfirmation: true, ...result };
}
