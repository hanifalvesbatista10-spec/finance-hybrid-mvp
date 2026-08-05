"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Landmark, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { currency, getMonthRange, type Transaction } from "@/lib/finance";
import { StatCard } from "@/components/finance/StatCard";
import { TransactionsManager } from "@/components/finance/TransactionsManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/finance/EmptyState";

export function FinanceOverview({ institutional }: { institutional: boolean }) {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { start, end } = getMonthRange();
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .gte("occurred_on", start)
      .lte("occurred_on", end);
    setItems((data ?? []) as Transaction[]);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("overview-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, supabase]);

  const totals = useMemo(() => {
    const income = items.filter((i) => i.type === "INCOME").reduce((sum, i) => sum + Number(i.amount), 0);
    const expense = items.filter((i) => i.type === "EXPENSE").reduce((sum, i) => sum + Number(i.amount), 0);
    return { income, expense, balance: income - expense };
  }, [items]);

  const expenseCategories = useMemo(() => {
    const grouped = new Map<string, number>();
    items.filter((i) => i.type === "EXPENSE").forEach((i) => {
      const key = institutional ? i.cost_center || "Sem centro" : i.category;
      grouped.set(key, (grouped.get(key) ?? 0) + Number(i.amount));
    });
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [institutional, items]);

  const max = Math.max(...expenseCategories.map(([, value]) => value), 1);

  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm font-bold text-indigo-700">
          {institutional ? "GESTÃO INSTITUCIONAL" : "GESTÃO PESSOAL"}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
          {institutional ? "Fluxo de caixa" : "Visão financeira"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Valores calculados exclusivamente a partir dos seus registros do mês atual.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={institutional ? "Fluxo líquido" : "Saldo do mês"}
          value={loading ? "—" : currency.format(totals.balance)}
          helper="Receitas menos despesas do mês"
          icon={Wallet}
          tone={totals.balance >= 0 ? "indigo" : "rose"}
        />
        <StatCard
          title="Receitas"
          value={loading ? "—" : currency.format(totals.income)}
          helper={`${items.filter((i) => i.type === "INCOME").length} lançamento(s)`}
          icon={ArrowUpRight}
          tone="emerald"
        />
        <StatCard
          title="Despesas"
          value={loading ? "—" : currency.format(totals.expense)}
          helper={`${items.filter((i) => i.type === "EXPENSE").length} lançamento(s)`}
          icon={ArrowDownRight}
          tone="rose"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_.55fr]">
        <TransactionsManager institutional={institutional} compact />

        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
          <CardHeader>
            <CardTitle>{institutional ? "Despesas por centro" : "Despesas por categoria"}</CardTitle>
            <p className="text-sm text-slate-500">Distribuição do mês atual.</p>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <EmptyState
                icon={institutional ? Landmark : Activity}
                title="Sem despesas no período"
                description="As categorias aparecerão aqui quando você registrar despesas."
              />
            ) : (
              <div className="space-y-5">
                {expenseCategories.map(([name, value]) => (
                  <div key={name}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-bold text-slate-700">{name}</span>
                      <span className="text-xs font-black text-slate-900">{currency.format(value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${Math.max(5, (value / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
