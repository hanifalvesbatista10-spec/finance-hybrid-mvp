export type TransactionType = "INCOME" | "EXPENSE";

export interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  cost_center: string | null;
  occurred_on: string;
  notes: string | null;
  created_at: string;
}

export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const dateBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
