"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Banknote, BriefcaseBusiness, Clock3, Hospital, Plus, ReceiptText, TrendingUp, WalletCards } from "lucide-react";
import { MedicalAppShell } from "@/components/medical/MedicalAppShell";
import { MedicalActivityTimeline } from "@/components/medical/MedicalActivityTimeline";
import { MedicalProductionChart } from "@/components/medical/MedicalProductionChart";
import { useAuth } from "@/context/AuthContext";
import { medicalCurrency, type MedicalShift, type MedicalReceivable } from "@/lib/medical";
import { Button } from "@/components/ui/button";

type Tx = { kind: string; amount: number; transaction_date: string; description?: string | null; created_at?: string };
type LinkT = { id: string; name: string; status: string };
type Invest = { current_value: number; asset_name?: string; created_at?: string; updated_at?: string };

export default function MedicalDashboard() {
  const { supabase, user, profile } = useAuth();
  const [shifts, setShifts] = useState<MedicalShift[]>([]);
  const [rec, setRec] = useState<MedicalReceivable[]>([]);
  const [tx, setTx] = useState<Tx[]>([]);
  const [links, setLinks] = useState<LinkT[]>([]);
  const [inv, setInv] = useState<Invest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    since.setDate(1);
    const sinceIso = since.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    const [a, b, c, d, e] = await Promise.all([
      supabase.from("medical_shifts").select("*").gte("shift_date", sinceIso).lte("shift_date", todayIso).order("shift_date", { ascending: false }),
      supabase.from("medical_receivables").select("*").gte("service_date", sinceIso).order("service_date", { ascending: false }),
      supabase.from("medical_professional_transactions").select("kind,amount,transaction_date,description,created_at").gte("transaction_date", sinceIso).lte("transaction_date", todayIso).order("transaction_date", { ascending: false }),
      supabase.from("professional_links").select("id,name,status").eq("status", "ACTIVE"),
      supabase.from("medical_investments").select("current_value,asset_name,created_at,updated_at"),
    ]);
    if (!a.error) setShifts((a.data ?? []) as MedicalShift[]);
    if (!b.error) setRec((b.data ?? []) as MedicalReceivable[]);
    if (!c.error) setTx((c.data ?? []) as Tx[]);
    if (!d.error) setLinks((d.data ?? []) as LinkT[]);
    if (!e.error) setInv((e.data ?? []) as Invest[]);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => { void load(); }, [load]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthShifts = useMemo(() => shifts.filter((s) => s.shift_date.startsWith(currentMonth)), [currentMonth, shifts]);
  const monthTx = useMemo(() => tx.filter((t) => t.transaction_date.startsWith(currentMonth)), [currentMonth, tx]);
  const pendingRec = useMemo(() => rec.filter((r) => ["PENDING", "OVERDUE"].includes(r.status)), [rec]);

  const stats = useMemo(() => {
    const forecast = monthShifts.filter((s) => s.status !== "CANCELED").reduce((x, s) => x + Number(s.total_value), 0);
    const received = monthTx.filter((t) => t.kind === "INCOME").reduce((x, t) => x + Number(t.amount), 0);
    const expenses = monthTx.filter((t) => t.kind !== "INCOME").reduce((x, t) => x + Number(t.amount), 0);
    const pending = pendingRec.reduce((x, r) => x + Number(r.amount), 0);
    const worked = monthShifts.filter((s) => ["WORKED", "BILLED", "AWAITING", "RECEIVED"].includes(s.status));
    const hours = worked.reduce((x, s) => x + Number(s.hours), 0);
    const generated = worked.reduce((x, s) => x + Number(s.total_value), 0);
    const invested = inv.reduce((x, i) => x + Number(i.current_value), 0);
    return { forecast, received, pending, net: received - expenses, hours, hour: hours ? generated / hours : 0, invested };
  }, [inv, monthShifts, monthTx, pendingRec]);

  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
  const empty = !loading && !shifts.length && !rec.length && !tx.length;

  return (
    <MedicalAppShell>
      <div className="space-y-7">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#0f4c81]">Equity One Médicos</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.03em] md:text-4xl">Olá, Dr. {profile?.full_name?.split(" ")[0] || "Usuário"}.</h1>
            <p className="mt-2 capitalize text-sm text-slate-500">Visão executiva · {month}</p>
          </div>
          <Link href="/medicos/plantoes"><Button className="bg-[#0f4c81]"><Plus className="size-4" />Registrar plantão</Button></Link>
        </section>

        {empty && (
          <div className="rounded-3xl border border-[#0f4c81]/15 bg-[#0f4c81]/5 p-6">
            <h2 className="font-black">Seu dashboard começa com seus dados.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Cadastre um vínculo e o primeiro plantão. Horas, produção, valor da hora, linha do tempo e contas a receber serão calculados automaticamente.</p>
            <div className="mt-4 flex flex-wrap gap-2"><Link href="/medicos/vinculos"><Button variant="outline">Cadastrar vínculo</Button></Link><Link href="/medicos/plantoes"><Button className="bg-[#0f4c81]">Registrar plantão</Button></Link></div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric title="Receita prevista" value={stats.forecast} icon={Banknote} />
          <Metric title="Recebido no mês" value={stats.received} icon={ArrowUpRight} green />
          <Metric title="A receber" value={stats.pending} icon={ReceiptText} amber />
          <Metric title="Resultado líquido" value={stats.net} icon={WalletCards} />
          <Metric title="Horas trabalhadas" text={`${stats.hours.toFixed(1).replace(".", ",")}h`} icon={Clock3} />
          <Metric title="Valor da sua hora" text={`${medicalCurrency.format(stats.hour)}/h`} icon={TrendingUp} />
          <Metric title="Patrimônio investido" value={stats.invested} icon={BriefcaseBusiness} />
          <Metric title="Vínculos ativos" text={String(links.length)} icon={Hospital} />
        </section>

        <MedicalProductionChart shifts={shifts} receivables={rec} transactions={tx} />

        <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Próximos plantões</h2><p className="mt-1 text-sm text-slate-500">Sua agenda com impacto financeiro.</p></div><Link href="/medicos/plantoes" className="text-xs font-black text-[#0f4c81]">Ver todos</Link></div>
            <div className="mt-5 space-y-3">
              {shifts.filter((s) => s.status === "SCHEDULED").slice(0, 5).map((s) => <div key={s.id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"><div><p className="font-bold">{s.hospital}</p><p className="mt-1 text-xs text-slate-400">{new Date(`${s.shift_date}T12:00:00`).toLocaleDateString("pt-BR")} · {s.hours}h</p></div><p className="font-black text-[#0f4c81]">{medicalCurrency.format(Number(s.total_value))}</p></div>)}
              {!shifts.some((s) => s.status === "SCHEDULED") && <p className="py-8 text-center text-sm text-slate-400">Nenhum plantão futuro registrado.</p>}
            </div>
          </div>
          <div className="rounded-3xl bg-[#0b2031] p-6 text-white"><h2 className="text-xl font-black">Prioridades</h2><div className="mt-5 space-y-3"><Priority label="Valores pendentes" value={medicalCurrency.format(stats.pending)} /><Priority label="Valor médio da hora" value={`${medicalCurrency.format(stats.hour)}/h`} /><Priority label="Vínculos ativos" value={String(links.length)} /></div></div>
        </section>

        <MedicalActivityTimeline shifts={shifts} receivables={rec} transactions={tx} investments={inv} />
      </div>
    </MedicalAppShell>
  );
}

function Metric({ title, value, text, icon: Icon, green, amber }: { title: string; value?: number; text?: string; icon: any; green?: boolean; amber?: boolean }) {
  return <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_35px_rgba(15,76,129,.05)]"><div className="flex justify-between"><div><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-3 text-2xl font-black">{text ?? medicalCurrency.format(value ?? 0)}</p></div><span className={`grid size-11 place-items-center rounded-2xl ${green ? "bg-emerald-50 text-emerald-700" : amber ? "bg-amber-50 text-amber-700" : "bg-[#0f4c81]/10 text-[#0f4c81]"}`}><Icon className="size-5" /></span></div></div>;
}
function Priority({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/[.06] p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 font-black">{value}</p></div>; }
