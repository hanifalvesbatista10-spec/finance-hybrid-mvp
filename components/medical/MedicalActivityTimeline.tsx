"use client";

import { Banknote, BriefcaseBusiness, Clock3, Hospital, ReceiptText, Stethoscope, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { medicalCurrency, type MedicalReceivable, type MedicalShift } from "@/lib/medical";

type MedicalTransaction = { kind: string; amount: number; transaction_date: string; description?: string | null; created_at?: string };
type MedicalInvestment = { current_value: number; asset_name?: string; created_at?: string; updated_at?: string };

type Event = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  amount?: number;
  positive?: boolean;
  icon: any;
};

export function MedicalActivityTimeline({
  shifts,
  receivables,
  transactions,
  investments,
}: {
  shifts: MedicalShift[];
  receivables: MedicalReceivable[];
  transactions: MedicalTransaction[];
  investments: MedicalInvestment[];
}) {
  const events = useMemo<Event[]>(() => {
    const result: Event[] = [];
    for (const shift of shifts) {
      const statusLabel: Record<string, string> = {
        SCHEDULED: "Plantão agendado",
        WORKED: "Plantão trabalhado",
        BILLED: "Plantão faturado",
        AWAITING: "Plantão aguardando pagamento",
        RECEIVED: "Plantão recebido",
        CANCELED: "Plantão cancelado",
      };
      result.push({
        id: `shift-${shift.id}`,
        date: shift.shift_date,
        title: statusLabel[shift.status] ?? "Plantão",
        subtitle: `${shift.hospital} · ${Number(shift.hours).toFixed(1).replace(".", ",")}h`,
        amount: Number(shift.total_value),
        positive: shift.status === "RECEIVED",
        icon: Hospital,
      });
    }
    for (const item of receivables) {
      result.push({
        id: `receivable-${item.id}`,
        date: item.expected_payment_date || item.service_date,
        title: item.status === "RECEIVED" ? "Recebimento confirmado" : item.status === "OVERDUE" ? "Recebimento em atraso" : "Valor a receber",
        subtitle: item.source_name || item.source_type || "Receita profissional",
        amount: Number(item.amount),
        positive: item.status === "RECEIVED",
        icon: ReceiptText,
      });
    }
    transactions.forEach((item, index) => result.push({
      id: `tx-${index}-${item.transaction_date}`,
      date: item.transaction_date,
      title: item.kind === "INCOME" ? "Receita profissional" : item.kind === "TAX" ? "Imposto registrado" : "Despesa profissional",
      subtitle: item.description || "Movimentação profissional",
      amount: Number(item.amount),
      positive: item.kind === "INCOME",
      icon: item.kind === "INCOME" ? Banknote : Stethoscope,
    }));
    investments.forEach((item, index) => {
      const date = (item.updated_at || item.created_at || new Date().toISOString()).slice(0, 10);
      result.push({
        id: `investment-${index}-${date}`,
        date,
        title: "Patrimônio atualizado",
        subtitle: item.asset_name || "Investimentos",
        amount: Number(item.current_value),
        positive: true,
        icon: BriefcaseBusiness,
      });
    });
    return result.sort((a, b) => new Date(`${b.date}T12:00:00`).getTime() - new Date(`${a.date}T12:00:00`).getTime()).slice(0, 10);
  }, [investments, receivables, shifts, transactions]);

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_35px_rgba(15,76,129,.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">Linha do tempo da carreira</h2>
          <p className="mt-1 text-sm text-slate-500">Plantões, recebimentos, despesas e patrimônio em uma única sequência.</p>
        </div>
        <TrendingUp className="size-5 text-[#0f4c81]" />
      </div>
      {!events.length ? (
        <div className="mt-6 grid min-h-48 place-items-center rounded-2xl bg-slate-50 text-center text-sm text-slate-400">
          Sua linha do tempo será preenchida automaticamente conforme você usar o Equity One Médicos.
        </div>
      ) : (
        <div className="relative mt-6 space-y-1 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-slate-200">
          {events.map((event) => {
            const Icon = event.icon;
            return (
              <article key={event.id} className="relative flex gap-4 py-3">
                <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-2xl bg-[#0f4c81]/10 text-[#0f4c81] ring-4 ring-white"><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{event.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{event.subtitle}</p>
                    </div>
                    <div className="sm:text-right">
                      {event.amount !== undefined && <p className={`text-sm font-black ${event.positive ? "text-emerald-700" : "text-slate-800"}`}>{event.positive ? "+" : ""}{medicalCurrency.format(event.amount)}</p>}
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 sm:justify-end"><Clock3 className="size-3" />{new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR")}</p>
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
