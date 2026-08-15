"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Clock3, Plus, TrendingUp, Trash2, WalletCards } from "lucide-react";
import { MedicalAppShell } from "@/components/medical/MedicalAppShell";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MoneyInput, brlInputToNumber } from "@/components/ui/money-input";
import { medicalCurrency, type MedicalLink, type MedicalShift } from "@/lib/medical";

type LinkPerformance = {
  workedValue: number;
  receivedValue: number;
  pendingValue: number;
  workedHours: number;
  effectiveHourly: number;
  shifts: number;
};

const EMPTY_FORM = {
  name: "",
  link_type: "Hospital",
  nature: "Plantonista",
  shift_value: "",
  hourly_value: "",
  weekly_hours: "",
  expected_payment_day: "",
};

export default function Page() {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<MedicalLink[]>([]);
  const [shifts, setShifts] = useState<MedicalShift[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!user) return;
    const [linksResult, shiftsResult] = await Promise.all([
      supabase.from("professional_links").select("*").order("created_at", { ascending: false }),
      supabase.from("medical_shifts").select("*").order("shift_date", { ascending: false }),
    ]);

    if (linksResult.error) setError(linksResult.error.message);
    else setItems((linksResult.data ?? []) as MedicalLink[]);

    if (!shiftsResult.error) setShifts((shiftsResult.data ?? []) as MedicalShift[]);
  }, [supabase, user]);

  useEffect(() => { void load(); }, [load]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthShifts = useMemo(
    () => shifts.filter((shift) => shift.shift_date?.slice(0, 7) === currentMonth && shift.status !== "CANCELED"),
    [currentMonth, shifts],
  );

  const performanceByLink = useMemo(() => {
    const map = new Map<string, LinkPerformance>();
    for (const shift of monthShifts) {
      if (!shift.professional_link_id) continue;
      const current = map.get(shift.professional_link_id) ?? {
        workedValue: 0,
        receivedValue: 0,
        pendingValue: 0,
        workedHours: 0,
        effectiveHourly: 0,
        shifts: 0,
      };
      const worked = ["WORKED", "BILLED", "AWAITING", "RECEIVED"].includes(shift.status);
      const value = Number(shift.total_value || 0);
      const hours = Number(shift.hours || 0);
      if (worked) {
        current.workedValue += value;
        current.workedHours += hours;
        current.shifts += 1;
      }
      if (shift.status === "RECEIVED") current.receivedValue += value;
      if (["BILLED", "AWAITING"].includes(shift.status)) current.pendingValue += value;
      current.effectiveHourly = current.workedHours > 0 ? current.workedValue / current.workedHours : 0;
      map.set(shift.professional_link_id, current);
    }
    return map;
  }, [monthShifts]);

  const monthWorked = monthShifts
    .filter((shift) => ["WORKED", "BILLED", "AWAITING", "RECEIVED"].includes(shift.status))
    .reduce((sum, shift) => sum + Number(shift.total_value || 0), 0);
  const monthPending = monthShifts
    .filter((shift) => ["BILLED", "AWAITING"].includes(shift.status))
    .reduce((sum, shift) => sum + Number(shift.total_value || 0), 0);
  const monthHours = monthShifts
    .filter((shift) => ["WORKED", "BILLED", "AWAITING", "RECEIVED"].includes(shift.status))
    .reduce((sum, shift) => sum + Number(shift.hours || 0), 0);
  const averageHour = monthHours > 0 ? monthWorked / monthHours : 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const shiftValue = form.shift_value ? brlInputToNumber(form.shift_value) : null;
      const hourlyValue = form.hourly_value ? brlInputToNumber(form.hourly_value) : null;
      const weeklyHours = form.weekly_hours ? Number(form.weekly_hours.replace(",", ".")) : null;
      const paymentDay = form.expected_payment_day ? Number(form.expected_payment_day) : null;

      if (!form.name.trim()) throw new Error("Informe o nome do vínculo.");
      if (shiftValue !== null && shiftValue <= 0) throw new Error("Informe um valor de plantão válido.");
      if (hourlyValue !== null && hourlyValue <= 0) throw new Error("Informe um valor por hora válido.");
      if (paymentDay !== null && (paymentDay < 1 || paymentDay > 31)) throw new Error("O dia de pagamento deve ficar entre 1 e 31.");

      const { error: insertError } = await supabase.from("professional_links").insert({
        user_id: user.id,
        name: form.name.trim(),
        link_type: form.link_type,
        nature: form.nature,
        shift_value: shiftValue,
        hourly_value: hourlyValue,
        weekly_hours: weeklyHours,
        expected_payment_day: paymentDay,
        status: "ACTIVE",
      });

      if (insertError) throw insertError;
      setForm(EMPTY_FORM);
      setOpen(false);
      setMessage("Vínculo salvo. Ele já pode ser usado nos próximos plantões.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o vínculo.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(item: MedicalLink) {
    if (!window.confirm(`Excluir o vínculo “${item.name}”?`)) return;
    setDeleting(item.id);
    setError("");
    const { error: deleteError } = await supabase.from("professional_links").delete().eq("id", item.id);
    if (deleteError) setError(deleteError.message);
    else {
      setMessage("Vínculo excluído.");
      await load();
    }
    setDeleting(null);
  }

  return (
    <MedicalAppShell>
      <div className="space-y-7">
        <Header action={() => setOpen((value) => !value)} />

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Building2} label="Vínculos ativos" value={String(items.filter((item) => item.status === "ACTIVE").length)} helper="Fontes profissionais cadastradas" />
          <Metric icon={WalletCards} label="Receita trabalhada" value={medicalCurrency.format(monthWorked)} helper="Plantões trabalhados neste mês" />
          <Metric icon={TrendingUp} label="A receber" value={medicalCurrency.format(monthPending)} helper="Plantões faturados ou aguardando" tone="amber" />
          <Metric icon={Clock3} label="Hora médica média" value={monthHours ? medicalCurrency.format(averageHour) : "—"} helper={monthHours ? `${monthHours.toFixed(1).replace(".", ",")}h trabalhadas` : "Aparece após registrar plantões"} />
        </section>

        {open && (
          <form onSubmit={save} className="rounded-[1.75rem] border border-[#0f4c81]/10 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[.16em] text-[#0f4c81]">Novo vínculo profissional</p>
              <h2 className="mt-1 text-xl font-black">Cadastre a fonte de renda uma única vez</h2>
              <p className="mt-1 text-sm text-slate-500">Os próximos plantões herdam o vínculo e alimentam automaticamente a análise de desempenho.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Instituição / vínculo">
                <Input required placeholder="Ex.: Hospital São Vicente" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Tipo de instituição">
                <Select value={form.link_type} onChange={(e) => setForm({ ...form, link_type: e.target.value })}>
                  {["Hospital", "Clínica", "Consultório", "Cooperativa", "Convênio", "Empresa", "Universidade", "Serviço público", "Outro"].map((value) => <option key={value}>{value}</option>)}
                </Select>
              </Field>
              <Field label="Forma de vínculo">
                <Select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}>
                  {["Plantonista", "PJ", "CLT", "Cooperado", "Autônomo", "Particular", "Prestador"].map((value) => <option key={value}>{value}</option>)}
                </Select>
              </Field>
              <Field label="Valor padrão do plantão">
                <MoneyInput value={form.shift_value} onValueChange={(value) => setForm({ ...form, shift_value: value })} placeholder="R$ 0,00" />
              </Field>
              <Field label="Valor contratado por hora">
                <MoneyInput value={form.hourly_value} onValueChange={(value) => setForm({ ...form, hourly_value: value })} placeholder="R$ 0,00" />
              </Field>
              <Field label="Horas semanais previstas">
                <Input inputMode="decimal" placeholder="Ex.: 24" value={form.weekly_hours} onChange={(e) => setForm({ ...form, weekly_hours: e.target.value })} />
              </Field>
              <Field label="Dia habitual de pagamento">
                <Input type="number" min="1" max="31" placeholder="Ex.: 10" value={form.expected_payment_day} onChange={(e) => setForm({ ...form, expected_payment_day: e.target.value })} />
              </Field>
              <div className="flex items-end">
                <Button type="submit" disabled={saving} className="h-12 w-full bg-[#0f4c81] font-black hover:bg-[#0c3f6b]">
                  {saving ? "Salvando..." : "Salvar vínculo"}
                </Button>
              </div>
            </div>
          </form>
        )}

        <section>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-[#0f4c81]">Desempenho por vínculo</p>
              <h2 className="mt-1 text-xl font-black">Onde sua hora médica está rendendo melhor</h2>
            </div>
            <p className="text-xs text-slate-500">Indicadores calculados com os plantões deste mês.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => {
              const perf = performanceByLink.get(item.id) ?? { workedValue: 0, receivedValue: 0, pendingValue: 0, workedHours: 0, effectiveHourly: 0, shifts: 0 };
              return (
                <article key={item.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0f4c81]/10 text-[#0f4c81]"><Building2 className="size-5" /></span>
                      <div className="min-w-0">
                        <h3 className="truncate font-black text-slate-950">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{item.link_type} · {item.nature}</p>
                      </div>
                    </div>
                    <button type="button" disabled={deleting === item.id} onClick={() => void removeLink(item)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Excluir ${item.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Small label="Padrão por plantão" value={item.shift_value ? medicalCurrency.format(Number(item.shift_value)) : "—"} />
                    <Small label="Hora contratada" value={item.hourly_value ? medicalCurrency.format(Number(item.hourly_value)) : "—"} />
                    <Small label="Gerado no mês" value={medicalCurrency.format(perf.workedValue)} />
                    <Small label="A receber" value={medicalCurrency.format(perf.pendingValue)} tone={perf.pendingValue > 0 ? "amber" : "default"} />
                  </div>

                  <div className="mt-4 rounded-2xl bg-[#0f4c81]/5 p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-[#0f4c81]/60">Valor efetivo da hora</p>
                        <p className="mt-1 text-xl font-black text-[#0f4c81]">{perf.workedHours > 0 ? medicalCurrency.format(perf.effectiveHourly) : "—"}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{perf.shifts} plantão(ões)</p>
                        <p>{perf.workedHours.toFixed(1).replace(".", ",")}h trabalhadas</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {!items.length && !open && (
              <div className="col-span-full rounded-[1.75rem] border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm text-slate-500">
                Cadastre seu primeiro vínculo profissional para começar a comparar renda e valor da hora médica.
              </div>
            )}
          </div>
        </section>
      </div>
    </MedicalAppShell>
  );
}

function Header({ action }: { action: () => void }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#0f4c81]">Carreira e renda</p>
        <h1 className="mt-2 text-3xl font-black md:text-4xl">Meus vínculos</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Compare hospitais, clínicas, consultório e outras fontes de renda pelo que realmente importa: trabalho realizado, recebimento e valor efetivo da sua hora.</p>
      </div>
      <Button onClick={action} className="bg-[#0f4c81]"><Plus className="size-4" /> Novo vínculo</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function Metric({ icon: Icon, label, value, helper, tone = "default" }: { icon: any; label: string; value: string; helper: string; tone?: "default" | "amber" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p>
          <p className={`mt-2 text-2xl font-black ${tone === "amber" ? "text-amber-700" : "text-slate-950"}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-[#0f4c81]/10 text-[#0f4c81]"}`}><Icon className="size-4" /></span>
      </div>
    </div>
  );
}

function Small({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "amber" }) {
  return <div className={`rounded-2xl p-3 ${tone === "amber" ? "bg-amber-50" : "bg-slate-50"}`}><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-sm font-black ${tone === "amber" ? "text-amber-700" : "text-slate-900"}`}>{value}</p></div>;
}
