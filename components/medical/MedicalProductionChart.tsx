"use client";

import { useMemo } from "react";
import { medicalCurrency, type MedicalReceivable, type MedicalShift } from "@/lib/medical";

type Tx = { kind: string; amount: number; transaction_date: string };

export function MedicalProductionChart({ shifts, receivables, transactions }: { shifts: MedicalShift[]; receivables: MedicalReceivable[]; transactions: Tx[] }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
      const produced = shifts.filter((s) => s.shift_date.startsWith(key) && s.status !== "CANCELED").reduce((sum, s) => sum + Number(s.total_value), 0);
      const received = transactions.filter((t) => t.transaction_date.startsWith(key) && t.kind === "INCOME").reduce((sum, t) => sum + Number(t.amount), 0);
      const pending = receivables.filter((r) => (r.service_date || r.expected_payment_date || "").startsWith(key) && r.status !== "RECEIVED").reduce((sum, r) => sum + Number(r.amount), 0);
      return { label, produced, received, pending };
    });
  }, [receivables, shifts, transactions]);

  const max = Math.max(...months.flatMap((m) => [m.produced, m.received, m.pending]), 1);
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_35px_rgba(15,76,129,.05)]">
      <div>
        <h2 className="text-xl font-black">Produção × recebimento</h2>
        <p className="mt-1 text-sm text-slate-500">Compare o que sua carreira produziu, o que entrou no caixa e o que ainda está pendente.</p>
      </div>
      <div className="mt-6 grid h-64 grid-cols-6 items-end gap-3 rounded-2xl bg-slate-50 p-5">
        {months.map((month) => (
          <div key={month.label} className="flex h-full flex-col justify-end gap-2">
            <div className="flex flex-1 items-end justify-center gap-1.5">
              <div title={`Produzido: ${medicalCurrency.format(month.produced)}`} className="w-2.5 rounded-t-full bg-[#0f4c81]" style={{ height: `${Math.max(month.produced / max * 100, month.produced ? 4 : 0)}%` }} />
              <div title={`Recebido: ${medicalCurrency.format(month.received)}`} className="w-2.5 rounded-t-full bg-emerald-500" style={{ height: `${Math.max(month.received / max * 100, month.received ? 4 : 0)}%` }} />
              <div title={`Pendente: ${medicalCurrency.format(month.pending)}`} className="w-2.5 rounded-t-full bg-amber-400" style={{ height: `${Math.max(month.pending / max * 100, month.pending ? 4 : 0)}%` }} />
            </div>
            <p className="text-center text-[11px] font-bold uppercase text-slate-400">{month.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-5 text-xs font-bold text-slate-500"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#0f4c81]"/>Produzido</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-emerald-500"/>Recebido</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-amber-400"/>Pendente</span></div>
    </section>
  );
}
