"use client";

import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/finance";
import {
  dueLabel,
  shouldAlert,
  type Obligation,
  type ReminderPreferences,
} from "@/lib/obligations";
import { cn } from "@/lib/utils";

export function AlertCenter() {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<Obligation[]>([]);
  const [preferences, setPreferences] =
    useState<ReminderPreferences | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    const future = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 30,
    )
      .toISOString()
      .slice(0, 10);

    const [itemsResult, preferencesResult] = await Promise.all([
      supabase
        .from("obligations")
        .select("*")
        .eq("status", "PENDING")
        .lte("due_date", future)
        .order("due_date", { ascending: true }),
      supabase
        .from("reminder_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!itemsResult.error) {
      setItems((itemsResult.data ?? []) as Obligation[]);
    }

    if (!preferencesResult.error) {
      setPreferences(
        (preferencesResult.data as ReminderPreferences | null) ?? {
          user_id: user.id,
          default_remind_days: [0, 1, 3],
          show_overdue: true,
        },
      );
    }
  }, [supabase, user]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("obligation-alerts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "obligations",
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  const alerts = useMemo(
    () =>
      items.filter((item) =>
        shouldAlert(item, preferences?.show_overdue ?? true),
      ),
    [items, preferences?.show_overdue],
  );

  const overdueCount = alerts.filter(
    (item) => new Date(`${item.due_date}T12:00:00`) < new Date(),
  ).length;

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
        aria-label="Abrir alertas"
      >
        <Bell className="size-5" />

        {alerts.length > 0 && (
          <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black leading-5 text-white">
            {alerts.length > 99 ? "99+" : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Fechar alertas"
          />

          <div className="fixed inset-x-4 top-20 z-50 max-h-[75vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[420px]">
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <p className="font-black text-slate-950">
                  Alertas financeiros
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {alerts.length === 0
                    ? "Nenhuma conta exige atenção agora."
                    : `${alerts.length} alerta(s), ${overdueCount} vencido(s).`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-3">
              {alerts.length === 0 ? (
                <div className="grid min-h-44 place-items-center text-center">
                  <div>
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="size-5" />
                    </span>
                    <p className="mt-4 text-sm font-bold text-slate-900">
                      Tudo em dia
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Seus próximos avisos aparecerão aqui.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((item) => {
                    const overdue =
                      new Date(`${item.due_date}T12:00:00`) < new Date();

                    return (
                      <Link
                        key={item.id}
                        href="/dashboard/contas"
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 transition hover:-translate-y-0.5",
                          overdue
                            ? "border-rose-200 bg-rose-50"
                            : "border-amber-200 bg-amber-50",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl",
                            overdue
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700",
                          )}
                        >
                          {overdue ? (
                            <AlertTriangle className="size-4" />
                          ) : (
                            <CalendarClock className="size-4" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-slate-900">
                            {item.description}
                          </span>
                          <span className="mt-1 block text-xs text-slate-600">
                            {dueLabel(item.due_date)} ·{" "}
                            {currency.format(Number(item.amount))}
                          </span>
                        </span>

                        <ChevronRight className="mt-2 size-4 shrink-0 text-slate-400" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-3">
              <Link
                href="/dashboard/contas"
                onClick={() => setOpen(false)}
              >
                <Button variant="outline" className="w-full">
                  Gerenciar contas e alertas
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
