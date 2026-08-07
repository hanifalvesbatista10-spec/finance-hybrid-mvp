"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  daysUntil,
  shouldAlert,
  type Obligation,
  type ReminderPreferences,
} from "@/lib/obligations";
import { cn } from "@/lib/utils";

export function UpcomingAlertsBanner() {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<Obligation[]>([]);
  const [preferences, setPreferences] =
    useState<ReminderPreferences | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const future = new Date();
    future.setDate(future.getDate() + 30);

    const [itemsResult, preferencesResult] = await Promise.all([
      supabase
        .from("obligations")
        .select("*")
        .eq("status", "PENDING")
        .lte("due_date", future.toISOString().slice(0, 10))
        .order("due_date", { ascending: true }),
      supabase
        .from("reminder_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!itemsResult.error) {
      setItems((itemsResult.data ?? []) as Obligation[]);
    } else {
      setItems([]);
    }

    if (!preferencesResult.error) {
      setPreferences(
        (preferencesResult.data as ReminderPreferences | null) ?? {
          user_id: user.id,
          default_remind_days: [0, 1, 3],
          show_overdue: true,
        },
      );
    } else {
      setPreferences({
        user_id: user.id,
        default_remind_days: [0, 1, 3],
        show_overdue: true,
      });
    }
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const alerts = useMemo(
    () =>
      items.filter((item) =>
        shouldAlert(item, preferences?.show_overdue ?? true),
      ),
    [items, preferences?.show_overdue],
  );

  if (alerts.length === 0) return null;

  const overdue = alerts.filter(
    (item) => daysUntil(item.due_date) < 0,
  ).length;

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between",
        overdue > 0
          ? "border-rose-200 bg-rose-50"
          : "border-amber-200 bg-amber-50",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            overdue > 0
              ? "bg-rose-100 text-rose-700"
              : "bg-amber-100 text-amber-700",
          )}
        >
          {overdue > 0 ? (
            <AlertTriangle className="size-5" />
          ) : (
            <CalendarClock className="size-5" />
          )}
        </span>

        <div>
          <p className="font-black text-slate-950">
            {overdue > 0
              ? `${overdue} conta(s) vencida(s)`
              : `${alerts.length} vencimento(s) exigem atenção`}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Revise suas contas a pagar e a receber.
          </p>
        </div>
      </div>

      <Link href="/dashboard/contas">
        <Button
          variant="outline"
          className="w-full bg-white md:w-auto"
        >
          Ver alertas
          <ArrowRight className="size-4" />
        </Button>
      </Link>
    </section>
  );
}
