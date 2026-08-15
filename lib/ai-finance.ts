import { BUSINESS_EXPENSE_CATEGORIES, BUSINESS_INCOME_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES, PERSONAL_INCOME_CATEGORIES } from "@/lib/transaction-categories";

export type AiProduct = "PERSONAL" | "BUSINESS" | "MEDICAL";
export type AiEntryKind = "INCOME" | "EXPENSE" | "TAX";

export type AiFinancialEntry = {
  kind: AiEntryKind;
  description: string;
  merchant: string | null;
  amount: number;
  categories: string[];
  occurred_on: string;
  occurred_at: string;
  notes: string | null;
  confidence: number;
  account_id?: string | null;
  payment_method?: string | null;
};

const medicalIncome = ["Plantões", "Consultas", "Procedimentos", "Cirurgias", "Convênios", "Cooperativas", "Docência", "Consultoria", "Particular", "Outras receitas"];
const medicalExpense = ["CRM", "Contabilidade", "Cursos", "Congressos", "Passagens", "Hospedagens", "Equipamentos", "Instrumentais", "Seguro profissional", "Marketing", "Secretária", "Aluguel", "Software", "Assinaturas", "Combustível", "Estacionamento", "Alimentação profissional", "Outras despesas"];
const medicalTax = ["Impostos", "INSS", "ISS", "IR", "Outros tributos"];

function flat(groups: {group:string;items:string[]}[]) { return groups.flatMap((g) => g.items); }

export function allowedCategories(product: AiProduct) {
  if (product === "PERSONAL") return { income: flat(PERSONAL_INCOME_CATEGORIES), expense: flat(PERSONAL_EXPENSE_CATEGORIES), tax: [] as string[] };
  if (product === "BUSINESS") return { income: flat(BUSINESS_INCOME_CATEGORIES), expense: flat(BUSINESS_EXPENSE_CATEGORIES), tax: [] as string[] };
  return { income: medicalIncome, expense: medicalExpense, tax: medicalTax };
}

export function normalizeAiEntries(entries: AiFinancialEntry[], product: AiProduct) {
  const allowed = allowedCategories(product);
  const today = new Date().toISOString().slice(0,10);
  return entries
    .filter((entry) => Number.isFinite(Number(entry.amount)) && Number(entry.amount) > 0)
    .map((entry) => {
      const kind: AiEntryKind = product !== "MEDICAL" && entry.kind === "TAX" ? "EXPENSE" : entry.kind;
      const pool = kind === "INCOME" ? allowed.income : kind === "TAX" ? allowed.tax : allowed.expense;
      const categories = (entry.categories ?? []).filter((c) => pool.includes(c));
      return {
        ...entry,
        kind,
        description: String(entry.description || "Lançamento").slice(0,180),
        merchant: entry.merchant ? String(entry.merchant).slice(0,120) : null,
        amount: Math.round(Number(entry.amount) * 100) / 100,
        categories: categories.length ? categories : [kind === "INCOME" ? (pool[0] || "Outros") : (pool.includes("Outros") ? "Outros" : pool[0] || "Outros")],
        occurred_on: /^\d{4}-\d{2}-\d{2}$/.test(entry.occurred_on) ? entry.occurred_on : today,
        occurred_at: entry.occurred_at || new Date().toISOString(),
        notes: entry.notes ? String(entry.notes).slice(0,280) : null,
        confidence: Math.max(0, Math.min(1, Number(entry.confidence) || 0.5)),
        account_id: entry.account_id || null,
        payment_method: entry.payment_method || null,
      };
    });
}
