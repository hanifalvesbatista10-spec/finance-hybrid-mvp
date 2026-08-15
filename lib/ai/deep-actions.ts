import { adminSupabase } from "@/lib/admin";
import type { AiProduct } from "@/lib/ai-finance";

export type AgentActionProposal = {
  kind: "CREATE_GOAL" | "CREATE_OBLIGATION" | "GOAL_MOVEMENT" | "CARD_PURCHASE";
  title: string;
  summary: string;
  payload: Record<string, unknown>;
};

type Request = {
  product: AiProduct;
  userId: string;
  text: string;
  nowIso: string;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseNumberish(raw: string) {
  const value = raw.trim().toLowerCase().replace(/r\$/g, "").replace(/\s/g, "");
  const multiplier = value.endsWith("mil") ? 1000 : 1;
  const cleaned = value.replace(/mil$/, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/\.(?=\d{3}(?:\D|$))/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number * multiplier : 0;
}

function extractAmount(text: string) {
  const patterns = [
    /r\$\s*([\d.]+(?:,\d{1,2})?\s*(?:mil)?)/i,
    /(?:valor(?:\s+de)?|no valor de|por|de)\s+([\d.]+(?:,\d{1,2})?\s*(?:mil)?)/i,
    /([\d.]+(?:,\d{1,2})?)\s*(mil)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[2] ? `${match[1]}${match[2]}` : match[1];
      const amount = parseNumberish(raw);
      if (amount > 0) return amount;
    }
  }
  return 0;
}

function iso(date: Date) { return date.toISOString().slice(0, 10); }

function extractDate(text: string, nowIso: string, preferFuture = true) {
  const now = new Date(nowIso);
  const normalized = normalize(text);
  if (/\bamanha\b/.test(normalized)) return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12));
  if (/\bhoje\b/.test(normalized)) return iso(now);

  const directIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (directIso) return directIso[1];

  const br = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (br) {
    let year = br[3] ? Number(br[3]) : now.getFullYear();
    const month = Number(br[2]) - 1, day = Number(br[1]);
    let d = new Date(year, month, day, 12);
    if (!br[3] && preferFuture && d < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0)) d = new Date(year + 1, month, day, 12);
    return iso(d);
  }

  const dayMatch = normalized.match(/(?:vence|vencimento|ate|prazo)(?:\s+no)?(?:\s+dia)?\s+(\d{1,2})\b/);
  if (dayMatch) {
    const day = Math.min(28, Number(dayMatch[1]));
    let d = new Date(now.getFullYear(), now.getMonth(), day, 12);
    if (preferFuture && d < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0)) d = new Date(now.getFullYear(), now.getMonth() + 1, day, 12);
    return iso(d);
  }
  return null;
}

function cleanLabel(text: string, words: RegExp) {
  return text
    .replace(words, " ")
    .replace(/r\$\s*[\d.]+(?:,\d{1,2})?\s*(?:mil)?/gi, " ")
    .replace(/(?:no valor de|valor de|de|por)\s+[\d.]+(?:,\d{1,2})?\s*(?:mil)?/gi, " ")
    .replace(/(?:vence|vencimento|ate|até|prazo)(?:\s+no)?(?:\s+dia)?\s+\d{1,2}(?:\/\d{1,2}(?:\/20\d{2})?)?/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:\-]+|[\s,;:\-]+$/g, "")
    .trim();
}

function answer(message: string) {
  return { action: "ANSWER" as const, requiresConfirmation: false, message, data: {} };
}

function propose(proposal: AgentActionProposal) {
  return { action: "PROPOSE_AGENT_ACTION" as const, requiresConfirmation: true, proposal };
}

async function createGoalProposal(request: Request) {
  const amount = extractAmount(request.text);
  if (!amount) return answer("Entendi que você quer criar uma meta. Qual é o valor que deseja alcançar?");
  const name = cleanLabel(request.text, /(?:crie|criar|quero criar|cadastre|nova|uma|minha)*\s*(?:meta|objetivo)(?:\s+financeir[ao])?(?:\s+(?:para|de|chamada|chamado))?/gi) || "Nova meta";
  const deadline = extractDate(request.text, request.nowIso, true);
  const proposal: AgentActionProposal = {
    kind: "CREATE_GOAL",
    title: `Criar meta “${name}”`,
    summary: `${brl.format(amount)}${deadline ? ` · prazo ${new Date(`${deadline}T12:00:00`).toLocaleDateString("pt-BR")}` : " · sem prazo definido"}`,
    payload: { name, target_amount: amount, current_amount: 0, deadline },
  };
  return propose(proposal);
}

async function obligationProposal(request: Request) {
  if (request.product === "MEDICAL") return null;
  const normalized = normalize(request.text);
  const payable = /(pagar|pagamento|boleto|conta a pagar)/.test(normalized);
  const receivable = /(receber|recebimento|conta a receber)/.test(normalized);
  if (!payable && !receivable) return null;
  const amount = extractAmount(request.text);
  if (!amount) return answer(`Entendi que você quer cadastrar uma conta a ${receivable ? "receber" : "pagar"}. Qual é o valor?`);
  const due = extractDate(request.text, request.nowIso, true);
  if (!due) return answer(`Entendi o valor de ${brl.format(amount)}. Qual é a data de vencimento?`);
  const description = cleanLabel(request.text, /(?:cadastre|cadastrar|registre|registrar|adicione|adicionar|tenho|uma|um|conta|boleto|a pagar|a receber|pagar|receber)/gi) || (receivable ? "Conta a receber" : "Conta a pagar");
  return propose({
    kind: "CREATE_OBLIGATION",
    title: receivable ? "Cadastrar conta a receber" : "Cadastrar conta a pagar",
    summary: `${description} · ${brl.format(amount)} · vence ${new Date(`${due}T12:00:00`).toLocaleDateString("pt-BR")}`,
    payload: { description, amount, obligation_kind: receivable ? "RECEIVABLE" : "PAYABLE", due_date: due, category: "Outros", notes: request.text },
  });
}

async function goalMovementProposal(request: Request) {
  const normalized = normalize(request.text);
  if (!/(meta|objetivo)/.test(normalized) || !/(aporte|adicione|adicionar|coloque|guardar|retire|retirar|saque|sacar)/.test(normalized)) return null;
  const amount = extractAmount(request.text);
  if (!amount) return answer("Qual valor você quer movimentar na meta?");

  const { data, error } = await adminSupabase.from("goals").select("id,name,current_amount,target_amount").eq("user_id", request.userId).order("created_at", { ascending: false });
  if (error) throw error;
  const goals = data ?? [];
  if (!goals.length) return answer("Você ainda não possui metas cadastradas. Posso criar uma meta primeiro.");
  const matches = goals.filter((goal: any) => normalized.includes(normalize(goal.name)));
  const goal: any = matches.length === 1 ? matches[0] : goals.length === 1 ? goals[0] : null;
  if (!goal) return answer(`Você tem mais de uma meta. Diga em qual delas deseja movimentar o valor: ${goals.map((g: any) => g.name).join(", ")}.`);
  const withdraw = /(retire|retirar|saque|sacar)/.test(normalized);
  if (withdraw && amount > Number(goal.current_amount || 0)) return answer(`A meta “${goal.name}” tem ${brl.format(Number(goal.current_amount || 0))}. A retirada de ${brl.format(amount)} seria maior que o valor acumulado.`);
  const date = extractDate(request.text, request.nowIso, false) || iso(new Date(request.nowIso));
  return propose({
    kind: "GOAL_MOVEMENT",
    title: `${withdraw ? "Retirar de" : "Adicionar à"} meta “${goal.name}”`,
    summary: `${withdraw ? "Retirada" : "Aporte"} de ${brl.format(amount)} · ${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}`,
    payload: { goal_id: goal.id, goal_name: goal.name, movement_type: withdraw ? "WITHDRAW" : "ADD", amount, occurred_on: date, notes: request.text },
  });
}

async function cardPurchaseProposal(request: Request) {
  if (request.product === "MEDICAL") return null;
  const normalized = normalize(request.text);
  if (!/(cartao|credito)/.test(normalized) || !/(comprei|compra|gastei|paguei)/.test(normalized)) return null;
  const amount = extractAmount(request.text);
  if (!amount) return answer("Qual foi o valor da compra no cartão?");

  const { data, error } = await adminSupabase.from("cards").select("id,nickname,issuer,last_four,is_active").eq("user_id", request.userId).eq("is_active", true);
  if (error) throw error;
  const cards = data ?? [];
  if (!cards.length) return answer("Você ainda não cadastrou nenhum cartão no Equity One.");
  const matches = cards.filter((card: any) => [card.nickname, card.issuer, card.last_four].filter(Boolean).some((v) => normalized.includes(normalize(String(v)))));
  const card: any = matches.length === 1 ? matches[0] : cards.length === 1 ? cards[0] : null;
  if (!card) return answer(`Você possui mais de um cartão. Informe qual deles: ${cards.map((c: any) => c.nickname || c.issuer || `•••• ${c.last_four}`).join(", ")}.`);

  const installmentMatch = normalized.match(/(?:em\s+)?(\d{1,2})\s*x|(?:em\s+)(\d{1,2})\s+parcelas?/);
  const installments = Math.max(1, Math.min(48, Number(installmentMatch?.[1] || installmentMatch?.[2] || 1)));
  const purchaseDate = extractDate(request.text, request.nowIso, false) || iso(new Date(request.nowIso));
  const description = cleanLabel(request.text, /(?:comprei|compra|gastei|paguei|no|na|com|cartao|credito|em\s+\d+\s*x|em\s+\d+\s+parcelas?)/gi) || "Compra no cartão";
  const cardName = card.nickname || card.issuer || `Cartão •••• ${card.last_four}`;
  return propose({
    kind: "CARD_PURCHASE",
    title: `Registrar compra no ${cardName}`,
    summary: `${description} · ${brl.format(amount)}${installments > 1 ? ` em ${installments}x` : " à vista"}`,
    payload: { card_id: card.id, card_name: cardName, description, total_amount: amount, installments, purchase_date: purchaseDate, category: "Outros" },
  });
}

export async function detectDeepAgentAction(request: Request) {
  const normalized = normalize(request.text);

  if (/(crie|criar|cadastre|nova).*(meta|objetivo)|(meta|objetivo).*(crie|criar|cadastre)/.test(normalized)) {
    return createGoalProposal(request);
  }

  const movement = await goalMovementProposal(request);
  if (movement) return movement;

  const cardPurchase = await cardPurchaseProposal(request);
  if (cardPurchase) return cardPurchase;

  if (/(cadastre|cadastrar|registre|registrar|adicione|tenho).*(conta|boleto).*(pagar|receber)|(conta a pagar|conta a receber).*(cadastre|registre|adicione)/.test(normalized)) {
    return obligationProposal(request);
  }

  return null;
}
