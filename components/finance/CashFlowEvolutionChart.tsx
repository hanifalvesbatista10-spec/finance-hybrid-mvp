"use client";

import { useMemo, useState } from "react";
import { currency, type Transaction } from "@/lib/finance";

type Range = 7 | 30 | 90 | 180 | 365;

type Point = {
  label: string;
  income: number;
  expense: number;
  net: number;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function CashFlowEvolutionChart({
  items,
  title = "Movimentação financeira",
  description = "Entradas, saídas e resultado acumulado ao longo do tempo.",
}: {
  items: Transaction[];
  title?: string;
  description?: string;
}) {
  const [range, setRange] = useState<Range>(30);
  const points = useMemo(() => buildPoints(items, range), [items, range]);
  const totals = useMemo(
    () => points.reduce(
      (acc, point) => ({
        income: acc.income + point.income,
        expense: acc.expense + point.expense,
        net: point.net,
      }),
      { income: 0, expense: 0, net: 0 },
    ),
    [points],
  );

  const allValues = points.flatMap((point) => [point.income, point.expense, Math.abs(point.net)]);
  const max = Math.max(...allValues, 1);
  const width = 1000;
  const height = 300;
  const left = 36;
  const right = 20;
  const top = 22;
  const bottom = 38;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (index: number) => left + (index / Math.max(points.length - 1, 1)) * plotW;
  const y = (value: number) => top + plotH - (Math.max(0, value) / max) * plotH;
  const incomePath = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.income).toFixed(1)}`).join(" ");
  const expensePath = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.expense).toFixed(1)}`).join(" ");

  return (
    <section className="equity-card rounded-3xl bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([7, 30, 90, 180, 365] as Range[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`rounded-full px-3 py-2 text-xs font-black transition ${
                range === value ? "bg-[#c9a34d] text-[#111317]" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {value === 7 ? "7 dias" : value === 30 ? "30 dias" : value === 90 ? "3 meses" : value === 180 ? "6 meses" : "1 ano"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Entradas" value={totals.income} tone="green" />
        <MiniStat label="Saídas" value={totals.expense} tone="red" />
        <MiniStat label="Resultado" value={totals.net} tone={totals.net >= 0 ? "gold" : "red"} />
      </div>

      {items.length === 0 ? (
        <div className="mt-6 grid h-64 place-items-center rounded-2xl bg-slate-50 text-sm text-slate-400">
          O gráfico será construído automaticamente com seus lançamentos.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl bg-[#faf9f6] p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full" role="img" aria-label="Gráfico de entradas e saídas por período">
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const gy = top + plotH - step * plotH;
              return <line key={step} x1={left} x2={width - right} y1={gy} y2={gy} stroke="#e5e7eb" strokeWidth="1" />;
            })}
            <path d={incomePath} fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d={expensePath} fill="none" stroke="#e11d48" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 7" />
            {points.map((point, index) => {
              if (points.length > 12 && index % Math.ceil(points.length / 8) !== 0 && index !== points.length - 1) return null;
              return (
                <text key={`${point.label}-${index}`} x={x(index)} y={height - 12} textAnchor="middle" fontSize="11" fill="#94a3b8">
                  {point.label}
                </text>
              );
            })}
          </svg>
          <div className="flex flex-wrap items-center justify-center gap-5 pb-2 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-2"><i className="h-1 w-5 rounded-full bg-emerald-600" />Entradas</span>
            <span className="flex items-center gap-2"><i className="h-1 w-5 rounded-full bg-rose-600" />Saídas</span>
          </div>
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "gold" }) {
  const style = tone === "green" ? "bg-emerald-50 text-emerald-800" : tone === "red" ? "bg-rose-50 text-rose-800" : "bg-[#c9a34d]/10 text-[#8a6826]";
  return (
    <div className={`rounded-2xl p-4 ${style}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-lg font-black">{currency.format(value)}</p>
    </div>
  );
}

function buildPoints(items: Transaction[], range: Range): Point[] {
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(today.getDate() - (range - 1));
  const source = items.filter((item) => {
    const date = startOfDay(new Date(`${item.occurred_on}T12:00:00`));
    return date >= start && date <= today;
  });

  const bucketCount = range <= 30 ? Math.min(range, 15) : range <= 90 ? 12 : 12;
  const bucketSize = Math.max(1, Math.ceil(range / bucketCount));
  const buckets = Array.from({ length: Math.ceil(range / bucketSize) }, (_, index) => ({
    index,
    income: 0,
    expense: 0,
  }));

  for (const item of source) {
    const itemDate = startOfDay(new Date(`${item.occurred_on}T12:00:00`));
    const diff = Math.floor((itemDate.getTime() - start.getTime()) / 86400000);
    const bucket = buckets[Math.min(Math.floor(diff / bucketSize), buckets.length - 1)];
    if (!bucket) continue;
    if (item.type === "INCOME") bucket.income += Number(item.amount);
    else bucket.expense += Number(item.amount);
  }

  let net = 0;
  return buckets.map((bucket) => {
    const date = new Date(start);
    date.setDate(start.getDate() + bucket.index * bucketSize);
    net += bucket.income - bucket.expense;
    return {
      label: new Intl.DateTimeFormat("pt-BR", range > 90 ? { month: "short" } : { day: "2-digit", month: "short" }).format(date).replace(".", ""),
      income: bucket.income,
      expense: bucket.expense,
      net,
    };
  });
}
