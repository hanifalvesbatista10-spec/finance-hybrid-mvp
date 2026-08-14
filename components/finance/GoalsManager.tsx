"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Goal, History, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput, brlInputToNumber } from "@/components/ui/money-input";
import { currency, dateBR } from "@/lib/finance";
import { EmptyState } from "./EmptyState";

const ACCOUNT_TYPES = [
  "Conta corrente",
  "Poupança",
  "Carteira digital",
  "Cofrinho / reserva",
  "Corretora",
  "Investimento",
  "Dinheiro",
  "Outro",
];

type GoalItem = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at: string;
};

type GoalMovement = {
  id: string;
  goal_id: string;
  movement_type: "ADD" | "WITHDRAW";
  amount: number;
  account_type: string | null;
  account_name: string | null;
  occurred_on: string;
  notes: string | null;
  created_at: string;
};

export function GoalsManager() {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<GoalItem[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [selected, setSelected] = useState<GoalItem | null>(null);
  const [movements, setMovements] = useState<GoalMovement[]>([]);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deletingMovement, setDeletingMovement] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", target: "", current: "", deadline: "" });
  const [movement, setMovement] = useState({
    movement_type: "ADD" as "ADD" | "WITHDRAW",
    amount: "",
    account_type: "Conta corrente",
    account_name: "",
    occurred_on: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else {
      const next = (data ?? []) as GoalItem[];
      setItems(next);
      if (selected) {
        const refreshed = next.find((item) => item.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    }
  }, [selected, supabase, user]);

  const loadMovements = useCallback(async (goalId: string) => {
    const { data, error } = await supabase
      .from("goal_movements")
      .select("*")
      .eq("goal_id", goalId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setMovements((data ?? []) as GoalMovement[]);
  }, [supabase]);

  useEffect(() => { void load(); }, [user]);

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const target = brlInputToNumber(form.target);
    const current = brlInputToNumber(form.current);
    if (target <= 0) return setError("Informe um valor de meta maior que zero.");
    setSaving(true); setError("");
    const { data, error } = await supabase.from("goals").insert({
      user_id: user.id,
      name: form.name.trim(),
      target_amount: target,
      current_amount: current,
      deadline: form.deadline || null,
    }).select("*").single();
    if (error) setError(error.message);
    else {
      setForm({ name: "", target: "", current: "", deadline: "" });
      setOpenCreate(false);
      await load();
      if (data) setSelected(data as GoalItem);
    }
    setSaving(false);
  }

  async function applyMovement(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const amount = brlInputToNumber(movement.amount);
    if (amount <= 0) return setError("Informe um valor válido para o movimento.");
    if (movement.movement_type === "WITHDRAW" && amount > Number(selected.current_amount)) {
      return setError("A retirada não pode ser maior que o valor acumulado na meta.");
    }
    setMoving(true); setError("");
    const { error } = await supabase.rpc("apply_goal_movement", {
      p_goal_id: selected.id,
      p_movement_type: movement.movement_type,
      p_amount: amount,
      p_account_type: movement.account_type || null,
      p_account_name: movement.account_name.trim() || null,
      p_occurred_on: movement.occurred_on,
      p_notes: movement.notes.trim() || null,
    });
    if (error) setError(error.message);
    else {
      setMovement({ movement_type: "ADD", amount: "", account_type: "Conta corrente", account_name: "", occurred_on: new Date().toISOString().slice(0, 10), notes: "" });
      await Promise.all([load(), loadMovements(selected.id)]);
    }
    setMoving(false);
  }

  async function openGoal(item: GoalItem) {
    setSelected(item);
    setMovements([]);
    setError("");
    await loadMovements(item.id);
  }

  async function removeGoal(id: string) {
    if (!window.confirm("Excluir esta meta e o histórico de aportes/retiradas?")) return;
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) setError(error.message);
    else {
      if (selected?.id === id) setSelected(null);
      await load();
    }
  }

  async function removeMovement(item: GoalMovement) {
    if (!selected || deletingMovement) return;
    const label = item.movement_type === "ADD" ? "aporte" : "retirada";
    if (!window.confirm(`Excluir somente este ${label} de ${currency.format(Number(item.amount))}? O valor acumulado da meta será recalculado automaticamente.`)) return;
    setDeletingMovement(item.id);
    setError("");
    const { error } = await supabase.rpc("equity_delete_goal_movement", { p_movement_id: item.id });
    if (error) setError(error.message);
    else await Promise.all([load(), loadMovements(selected.id)]);
    setDeletingMovement(null);
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-indigo-700">OBJETIVOS</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Metas financeiras</h1>
          <p className="mt-2 text-sm text-slate-500">Crie a meta, abra o card e registre aportes ou retiradas sem recalcular nada manualmente.</p>
        </div>
        <Button onClick={() => setOpenCreate((current) => !current)}><Plus className="size-4" /> Nova meta</Button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {openCreate && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardHeader><CardTitle>Nova meta</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createGoal} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Nome da meta"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Reserva de emergência" /></Field>
              <Field label="Valor da meta"><MoneyInput required value={form.target} onValueChange={(formatted) => setForm({ ...form, target: formatted })} /></Field>
              <Field label="Já tenho"><MoneyInput value={form.current} onValueChange={(formatted) => setForm({ ...form, current: formatted })} /></Field>
              <Field label="Prazo"><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
              <div className="flex items-end xl:col-start-4"><Button type="submit" disabled={saving} className="w-full">{saving ? "Salvando..." : "Criar meta"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
        <CardContent className="p-6">
          {items.length === 0 ? <EmptyState icon={Goal} title="Nenhuma meta cadastrada" description="Crie sua primeira meta. Depois, basta tocar nela para adicionar ou retirar valores." /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const progress = Math.min(100, Number(item.target_amount) > 0 ? (Number(item.current_amount) / Number(item.target_amount)) * 100 : 0);
                return (
                  <div key={item.id} role="button" tabIndex={0} onClick={() => void openGoal(item)} onKeyDown={(e) => e.key === "Enter" && void openGoal(item)} className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Goal className="size-5" /></span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); void removeGoal(item.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="size-4" /></button>
                    </div>
                    <h3 className="mt-5 font-black text-slate-900">{item.name}</h3>
                    <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xs text-slate-400">Acumulado</p><p className="mt-1 text-xl font-black text-slate-950">{currency.format(Number(item.current_amount))}</p></div><span className="text-sm font-black text-indigo-700">{Math.round(progress)}%</span></div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} /></div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Meta: {currency.format(Number(item.target_amount))}</span><span className="font-bold text-indigo-600">Abrir meta →</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
          <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={() => setSelected(null)} />
          <aside className="relative z-10 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 p-6 backdrop-blur">
              <div><p className="text-xs font-black uppercase tracking-wide text-indigo-600">Meta financeira</p><h2 className="mt-1 text-2xl font-black text-slate-950">{selected.name}</h2></div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
            </div>
            <div className="space-y-6 p-6">
              <GoalSummary goal={selected} />

              <Card className="border-slate-200 shadow-none">
                <CardHeader><CardTitle>Movimentar meta</CardTitle><p className="text-sm text-slate-500">Informe de onde veio o aporte ou para onde foi a retirada.</p></CardHeader>
                <CardContent>
                  <form onSubmit={applyMovement} className="grid gap-4 md:grid-cols-2">
                    <Field label="Movimento"><Select value={movement.movement_type} onChange={(e) => setMovement({ ...movement, movement_type: e.target.value as "ADD" | "WITHDRAW" })}><option value="ADD">Adicionar / Aporte</option><option value="WITHDRAW">Retirar</option></Select></Field>
                    <Field label="Valor"><MoneyInput required value={movement.amount} onValueChange={(formatted) => setMovement({ ...movement, amount: formatted })} /></Field>
                    <Field label="Tipo da conta"><Select value={movement.account_type} onChange={(e) => setMovement({ ...movement, account_type: e.target.value })}>{ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</Select></Field>
                    <Field label="Nome da conta / origem"><Input value={movement.account_name} onChange={(e) => setMovement({ ...movement, account_name: e.target.value })} placeholder="Ex.: Nubank, Caixa, XP..." /></Field>
                    <Field label="Data"><Input type="date" required value={movement.occurred_on} onChange={(e) => setMovement({ ...movement, occurred_on: e.target.value })} /></Field>
                    <Field label="Observação"><Textarea className="min-h-10" value={movement.notes} onChange={(e) => setMovement({ ...movement, notes: e.target.value })} placeholder="Opcional" /></Field>
                    <div className="md:col-span-2"><Button type="submit" disabled={moving} className={`w-full ${movement.movement_type === "WITHDRAW" ? "bg-rose-600 hover:bg-rose-700" : ""}`}>{moving ? "Salvando..." : movement.movement_type === "ADD" ? "Adicionar à meta" : "Retirar da meta"}</Button></div>
                  </form>
                </CardContent>
              </Card>

              <div>
                <div className="mb-3 flex items-center gap-2"><History className="size-4 text-slate-500" /><h3 className="font-black text-slate-900">Histórico da meta</h3></div>
                {movements.length === 0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Nenhum aporte ou retirada registrado ainda.</div> : <div className="space-y-2">{movements.map((item) => {
                  const add = item.movement_type === "ADD";
                  return <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-200 hover:bg-slate-50/60"><span className={`grid size-10 place-items-center rounded-xl ${add ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{add ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">{add ? "Aporte" : "Retirada"} · {item.account_name || item.account_type || "Conta não informada"}</p><p className="mt-1 text-xs text-slate-400">{dateBR.format(new Date(`${item.occurred_on}T12:00:00`))}{item.account_type ? ` · ${item.account_type}` : ""}{item.notes ? ` · ${item.notes}` : ""}</p></div><div className="flex items-center gap-2"><p className={`text-sm font-black ${add ? "text-emerald-700" : "text-rose-700"}`}>{add ? "+" : "-"} {currency.format(Number(item.amount))}</p><button type="button" disabled={deletingMovement===item.id} onClick={()=>void removeMovement(item)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50" title="Excluir somente este movimento"><Trash2 className="size-4" /></button></div></div>;
                })}</div>}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function GoalSummary({ goal }: { goal: GoalItem }) {
  const progress = Math.min(100, Number(goal.target_amount) > 0 ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100 : 0);
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  return <div className="rounded-3xl bg-slate-950 p-6 text-white"><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Acumulado</p><p className="mt-1 text-xl font-black">{currency.format(Number(goal.current_amount))}</p></div><div><p className="text-xs text-slate-500">Falta</p><p className="mt-1 text-xl font-black">{currency.format(remaining)}</p></div><div><p className="text-xs text-slate-500">Progresso</p><p className="mt-1 text-xl font-black text-[#dfbf70]">{Math.round(progress)}%</p></div></div><div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#d4ad55]" style={{ width: `${progress}%` }} /></div>{goal.deadline && <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><CalendarDays className="size-4" /> Prazo: {dateBR.format(new Date(`${goal.deadline}T12:00:00`))}</p>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}
