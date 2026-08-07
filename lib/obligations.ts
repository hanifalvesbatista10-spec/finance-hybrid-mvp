export type ObligationKind = "PAYABLE" | "RECEIVABLE";
export type ObligationStatus = "PENDING" | "PAID" | "CANCELED";

export interface Obligation {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  kind: ObligationKind;
  status: ObligationStatus;
  category: string;
  cost_center: string | null;
  due_date: string;
  remind_days: number[];
  notes: string | null;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderPreferences {
  user_id: string;
  default_remind_days: number[];
  show_overdue: boolean;
  created_at?: string;
  updated_at?: string;
}

export const AVAILABLE_REMINDER_DAYS = [0, 1, 3, 7, 15, 30];

export function localToday() {
  const now = new Date();
  const local = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return local;
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function daysUntil(value: string) {
  const due = parseLocalDate(value);
  const today = localToday();
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function shouldAlert(
  item: Obligation,
  showOverdue = true,
) {
  if (item.status !== "PENDING") return false;

  const days = daysUntil(item.due_date);
  if (days < 0) return showOverdue;

  return item.remind_days.includes(days);
}

export function dueLabel(value: string) {
  const days = daysUntil(value);

  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1
      ? "Vencida há 1 dia"
      : `Vencida há ${overdue} dias`;
  }

  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";

  return `Vence em ${days} dias`;
}
