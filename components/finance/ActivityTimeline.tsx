"use client";

import { ArrowDownRight, ArrowUpRight, CalendarDays, Clock3, Eye, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { currency, dateBR, type Transaction } from "@/lib/finance";
import { SidePanel } from "@/components/ui/side-panel";

export type ActivityFilter = "ALL" | "INCOME" | "EXPENSE";

function fullDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function registeredAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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
  const [selected, setSelected] = useState<Transaction | null>(null);

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
    <>
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
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className="group relative flex w-full gap-4 py-3 text-left outline-none"
                  aria-label={`Ver detalhes de ${item.description}`}
                >
                  <span
                    className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-2xl ring-4 ring-white transition group-hover:scale-105 ${
                      income
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {income ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition duration-200 group-hover:border-[#d2aa51]/35 group-hover:bg-white group-hover:shadow-[0_10px_28px_rgba(15,23,42,.07)] group-focus-visible:ring-2 group-focus-visible:ring-[#d2aa51]">
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
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#9b772c] opacity-80 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                      <Eye className="size-3.5" /> Ver detalhes
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <SidePanel
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.description || "Detalhes da movimentação"}
        subtitle={selected ? `${selected.type === "INCOME" ? "Entrada" : "Saída"} · ${fullDate(selected.occurred_on)}` : undefined}
      >
        {selected && (
          <div className="space-y-6">
            <div className={`rounded-3xl p-5 ${selected.type === "INCOME" ? "bg-emerald-50" : "bg-rose-50"}`}>
              <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Valor da movimentação</p>
              <p className={`mt-2 text-3xl font-black ${selected.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
                {selected.type === "INCOME" ? "+" : "-"}{currency.format(Number(selected.amount))}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {selected.type === "INCOME" ? "Receita" : "Despesa"}
              </p>
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <Detail label="Data" value={fullDate(selected.occurred_on)} />
              <Detail label="Categoria principal" value={selected.category || "Sem categoria"} />
              {selected.cost_center && <Detail label="Centro de custo" value={selected.cost_center} />}
              <Detail label="Registrado em" value={registeredAt(selected.created_at)} />
            </section>

            {Array.isArray(selected.categories) && selected.categories.length > 0 && (
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Tags className="size-4" />
                  <p className="text-xs font-black uppercase tracking-wide">Categorias</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.categories.map((category, index) => (
                    <span key={`${category}-${index}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                      {index === 0 ? `Principal · ${category}` : category}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Descrição</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{selected.description}</p>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Observações</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selected.notes?.trim() || "Nenhuma observação registrada."}</p>
              </div>
            </section>
          </div>
        )}
      </SidePanel>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}
