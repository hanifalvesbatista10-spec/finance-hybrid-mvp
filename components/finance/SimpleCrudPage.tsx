"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "./EmptyState";
import { currency } from "@/lib/finance";

type Kind = "goals" | "cards" | "cost_centers" | "company_members";

const configs = {
  goals: {
    title: "Metas financeiras",
    description: "Defina objetivos e atualize o valor já acumulado.",
    empty: "Nenhuma meta cadastrada",
  },
  cards: {
    title: "Cartões",
    description: "Controle limites e faturas dos seus cartões.",
    empty: "Nenhum cartão cadastrado",
  },
  cost_centers: {
    title: "Centros de custo",
    description: "Organize os gastos da empresa por áreas.",
    empty: "Nenhum centro de custo cadastrado",
  },
  company_members: {
    title: "Permissões",
    description: "Cadastre membros e defina o nível de acesso.",
    empty: "Nenhum membro cadastrado",
  },
};

export function SimpleCrudPage({ kind, icon: Icon }: { kind: Kind; icon: LucideIcon }) {
  const { supabase, user } = useAuth();
  const config = configs[kind];
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from(kind).select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setItems(data ?? []);
  }, [kind, supabase, user]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");

    let payload: Record<string, unknown> = { user_id: user.id };
    if (kind === "goals") payload = {
      ...payload,
      name: form.name,
      target_amount: Number((form.target_amount || "0").replace(",", ".")),
      current_amount: Number((form.current_amount || "0").replace(",", ".")),
      deadline: form.deadline || null,
    };
    if (kind === "cards") payload = {
      ...payload,
      nickname: form.nickname,
      brand: form.brand || "Outro",
      last_four: form.last_four,
      credit_limit: Number((form.credit_limit || "0").replace(",", ".")),
      current_invoice: Number((form.current_invoice || "0").replace(",", ".")),
      closing_day: Number(form.closing_day || 1),
      due_day: Number(form.due_day || 1),
    };
    if (kind === "cost_centers") payload = {
      ...payload,
      name: form.name,
      monthly_budget: Number((form.monthly_budget || "0").replace(",", ".")),
      description: form.description || null,
    };
    if (kind === "company_members") payload = {
      ...payload,
      name: form.name,
      email: form.email,
      permission: form.permission || "OPERATOR",
      active: true,
    };

    const { error } = await supabase.from(kind).insert(payload);
    if (error) setError(error.message);
    else {
      setForm({});
      setOpen(false);
      await load();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este registro?")) return;
    const { error } = await supabase.from(kind).delete().eq("id", id);
    if (error) setError(error.message);
    else setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-indigo-700">GESTÃO</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{config.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{config.description}</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" /> Novo registro
        </Button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {open && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardHeader><CardTitle>Novo registro</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {kind === "goals" && <>
                <Field label="Nome"><Input required value={form.name || ""} onChange={(e) => setForm({...form, name:e.target.value})} /></Field>
                <Field label="Valor da meta"><Input required inputMode="decimal" value={form.target_amount || ""} onChange={(e) => setForm({...form, target_amount:e.target.value})} /></Field>
                <Field label="Valor atual"><Input inputMode="decimal" value={form.current_amount || ""} onChange={(e) => setForm({...form, current_amount:e.target.value})} /></Field>
                <Field label="Prazo"><Input type="date" value={form.deadline || ""} onChange={(e) => setForm({...form, deadline:e.target.value})} /></Field>
              </>}
              {kind === "cards" && <>
                <Field label="Apelido"><Input required value={form.nickname || ""} onChange={(e) => setForm({...form, nickname:e.target.value})} /></Field>
                <Field label="Bandeira"><Input value={form.brand || ""} onChange={(e) => setForm({...form, brand:e.target.value})} /></Field>
                <Field label="Últimos 4 dígitos"><Input required maxLength={4} pattern="[0-9]{4}" value={form.last_four || ""} onChange={(e) => setForm({...form, last_four:e.target.value})} /></Field>
                <Field label="Limite"><Input inputMode="decimal" value={form.credit_limit || ""} onChange={(e) => setForm({...form, credit_limit:e.target.value})} /></Field>
                <Field label="Fatura atual"><Input inputMode="decimal" value={form.current_invoice || ""} onChange={(e) => setForm({...form, current_invoice:e.target.value})} /></Field>
                <Field label="Dia de fechamento"><Input type="number" min="1" max="31" value={form.closing_day || ""} onChange={(e) => setForm({...form, closing_day:e.target.value})} /></Field>
                <Field label="Dia de vencimento"><Input type="number" min="1" max="31" value={form.due_day || ""} onChange={(e) => setForm({...form, due_day:e.target.value})} /></Field>
              </>}
              {kind === "cost_centers" && <>
                <Field label="Nome"><Input required value={form.name || ""} onChange={(e) => setForm({...form, name:e.target.value})} /></Field>
                <Field label="Orçamento mensal"><Input inputMode="decimal" value={form.monthly_budget || ""} onChange={(e) => setForm({...form, monthly_budget:e.target.value})} /></Field>
                <Field label="Descrição"><Input value={form.description || ""} onChange={(e) => setForm({...form, description:e.target.value})} /></Field>
              </>}
              {kind === "company_members" && <>
                <Field label="Nome"><Input required value={form.name || ""} onChange={(e) => setForm({...form, name:e.target.value})} /></Field>
                <Field label="E-mail"><Input required type="email" value={form.email || ""} onChange={(e) => setForm({...form, email:e.target.value})} /></Field>
                <Field label="Permissão">
                  <Select value={form.permission || "OPERATOR"} onChange={(e) => setForm({...form, permission:e.target.value})}>
                    <option value="ADMIN">Administrador</option>
                    <option value="ACCOUNTANT">Contador</option>
                    <option value="OPERATOR">Operador</option>
                  </Select>
                </Field>
              </>}
              <div className="flex items-end"><Button type="submit" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
        <CardContent className="p-6">
          {items.length === 0 ? (
            <EmptyState icon={Icon} title={config.empty} description="Use o botão “Novo registro” para começar. Nenhum dado fictício será exibido." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Icon className="size-5" /></span>
                    <button type="button" onClick={() => remove(item.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="size-4" /></button>
                  </div>
                  <h3 className="mt-5 font-black text-slate-900">{item.name || item.nickname}</h3>
                  {kind === "goals" && <GoalInfo item={item} />}
                  {kind === "cards" && <CardInfo item={item} />}
                  {kind === "cost_centers" && <p className="mt-2 text-sm text-slate-500">Orçamento: {currency.format(Number(item.monthly_budget))}</p>}
                  {kind === "company_members" && <>
                    <p className="mt-2 text-sm text-slate-500">{item.email}</p>
                    <span className="mt-4 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">{item.permission}</span>
                  </>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function GoalInfo({ item }: { item: any }) {
  const progress = Math.min(100, item.target_amount > 0 ? (Number(item.current_amount) / Number(item.target_amount)) * 100 : 0);
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs font-bold text-slate-500">
        <span>{currency.format(Number(item.current_amount))}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600" style={{width:`${progress}%`}} /></div>
      <p className="mt-2 text-xs text-slate-400">Meta: {currency.format(Number(item.target_amount))}</p>
    </div>
  );
}

function CardInfo({ item }: { item: any }) {
  return (
    <div className="mt-4 space-y-1 text-sm text-slate-500">
      <p>{item.brand} •••• {item.last_four}</p>
      <p>Fatura: <strong className="text-slate-900">{currency.format(Number(item.current_invoice))}</strong></p>
      <p>Limite: {currency.format(Number(item.credit_limit))}</p>
    </div>
  );
}
