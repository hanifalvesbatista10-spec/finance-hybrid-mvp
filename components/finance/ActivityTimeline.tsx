"use client";

import { ArrowDownRight, ArrowUpRight, CalendarDays, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { currency, dateBR, type Transaction } from "@/lib/finance";

export type ActivityFilter = "ALL" | "INCOME" | "EXPENSE";

export function ActivityTimeline({
  items,
  title = "Linha do tempo financeira",
  description = "Tudo o que aconteceu com seu dinheiro, em ordem cronológica.",
  limit = 8,
}: {
  items: Transaction[];
  title?: string;
  description?: string;
  limit?: number;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("ALL");
  const filtered = useMemo(() => {
    const source = filter === "ALL" ? items : items.filter((item) => item.type === filter);
    return [...source]
      .sort((a, b) => {
        const aDate = new Date(`${a.occurred_on}T12:00:00`).getTime();
        const bDate = new Date(`${b.occurred_on}T12:00:00`).getTime();
        if (aDate !== bDate) return bDate - aDate;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, limit);
  }, [filter, items, limit]);

  return (
    <section className="equity-card rounded-3xl bg-white p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["ALL", "Tudo"],
            ["INCOME", "Entradas"],
            ["EXPENSE", "Saídas"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-2 text-xs font-black transition ${
                filter === value
                  ? "bg-[#111317] text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 grid min-h-48 place-items-center rounded-2xl bg-slate-50 text-center text-sm text-slate-400">
          <div>
            <CalendarDays className="mx-auto mb-3 size-6" />
            Nenhuma atividade encontrada neste período.
          </div>
        </div>
      ) : (
        <div className="relative mt-7 space-y-1 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-slate-200">
          {filtered.map((item) => {
            const income = item.type === "INCOME";
            return (
              <article key={item.id} className="relative flex gap-4 py-3">
                <span
                  className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-2xl ring-4 ring-white ${
                    income
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {income ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.category}
                        {item.cost_center ? ` · ${item.cost_center}` : ""}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className={`text-sm font-black ${income ? "text-emerald-700" : "text-rose-700"}`}>
                        {income ? "+" : "-"}{currency.format(Number(item.amount))}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 sm:justify-end">
                        <Clock3 className="size-3" /> {dateBR.format(new Date(`${item.occurred_on}T12:00:00`))}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
