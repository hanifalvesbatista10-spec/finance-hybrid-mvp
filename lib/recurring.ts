import type { TransactionType } from "@/lib/finance";

export interface RecurringEntry {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  cost_center: string | null;
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}
