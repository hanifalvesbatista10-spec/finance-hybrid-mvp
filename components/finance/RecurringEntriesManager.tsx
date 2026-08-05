"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarClock,
  CircleDollarSign,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/finance/EmptyState";
import { currency, type TransactionType } from "@/lib/finance";
import { monthStart, type RecurringEntry } from "@/lib/recurring";
import { cn } from "@/lib/utils";

const initialForm = {
  description: "",
  amount: "",
  type: "INCOME" as TransactionType,
  category: "Receita base",
  cost_center: "",
  day_of_month: "1",
  start_month: monthStart(),
  end_month: "",
  notes: "",
};

export function RecurringEntriesManager({
  institutional,
}: {
  institutional: boolean;
}) {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<RecurringEntry[]>([]);
  const [form, setForm] = useState(initialForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthStart().slice(0, 7));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("recurring_entries")
      .select("*")
      .order("type", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setItems((data ?? []) as RecurringEntry[]);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const active = items.filter((item) => item.active);
    return {
      income: active
        .filter((item) => item.type === "INCOME")
        .reduce((sum, item) => sum + Number(item.amount), 0),
      expense: active
        .filter((item) => item.type === "EXPENSE")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    };
  }, [items]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");
    setMessage("");

    const amount = Number(form.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor mensal válido.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("recurring_entries").insert({
      user_id: user.id,
      description: form.description.trim(),
      amount,
      type: form.type,
      category: form.category.trim() || "Outros",
      cost_center: institutional ? form.cost_center.trim() || null : null,
      day_of_month: Number(form.day_of_month),
      start_month: `${form.start_month.slice(0, 7)}-01`,
      end_month: form.end_month ? `${form.end_month.slice(0, 7)}-01` : null,
      notes: form.notes.trim() || null,
      active: true,
    });

    if (error) {
      setError(error.message);
    } else {
      setForm(initialForm);
      setOpen(false);
      setMessage("Registro mensal fixo criado.");
      await load();
    }

    setSaving(false);
  };

  const toggle = async (item: RecurringEntry) => {
    const { error } = await supabase
      .from("recurring_entries")
      .update({ active: !item.active })
      .eq("id", item.id);

    if (error) setError(error.message);
    else {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, active: !entry.active } : entry,
        ),
      );
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este registro fixo mensal?")) return;

    const { error } = await supabase
      .from("recurring_entries")
      .delete()
      .eq("id", id);

    if (error) setError(error.message);
    else setItems((current) => current.filter((item) => item.id !== id));
  };

  const generateMonth = async () => {
    setGenerating(true);
    setError("");
    setMessage("");

    const { data, error } = await supabase.rpc(
      "generate_recurring_transactions",
      { p_month: `${selectedMonth}-01` },
    );

    if (error) {
      setError(error.message);
    } else {
      const count = Number(data ?? 0);
      setMessage(
        count > 0
          ? `${count} lançamento(s) fixo(s) foram gerados para o mês selecionado.`
          : "Nenhum novo lançamento foi gerado. Os registros deste mês já existem ou não há itens ativos.",
      );
    }

    setGenerating(false);
  };

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-indigo-700">
            PLANEJAMENTO CONTÁBIL
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Receitas e despesas fixas
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Cadastre salário, pró-labore, contratos, aluguel, folha, assinaturas,
            financiamentos e outros valores que formam a base de cada mês.
          </p>
        </div>

        <Button onClick={() => setOpen((value) => !value)}>
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? "Fechar formulário" : "Novo valor fixo"}
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Summary
          title="Receita fixa mensal"
          value={currency.format(totals.income)}
          helper="Base previsível de entradas"
          tone="emerald"
        />
        <Summary
          title="Despesa fixa mensal"
          value={currency.format(totals.expense)}
          helper="Compromissos mensais ativos"
          tone="rose"
        />
        <Summary
          title="Margem fixa prevista"
          value={currency.format(totals.income - totals.expense)}
          helper="Antes dos valores variáveis"
          tone={totals.income - totals.expense >= 0 ? "indigo" : "rose"}
        />
      </section>

      <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
        <CardHeader className="gap-4 border-b border-slate-100 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>Gerar lançamentos do mês</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Transforma os valores fixos ativos em lançamentos reais, sem duplicar.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="sm:w-44"
            />
            <Button onClick={generateMonth} disabled={generating}>
              <RefreshCw className={cn("size-4", generating && "animate-spin")} />
              {generating ? "Gerando..." : "Gerar mês"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {open && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardHeader>
            <CardTitle>Novo registro mensal fixo</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={save}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              <Field label="Descrição" wide>
                <Input
                  required
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="Ex.: Salário, aluguel ou contrato mensal"
                />
              </Field>

              <Field label="Valor mensal">
                <Input
                  required
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  placeholder="0,00"
                />
              </Field>

              <Field label="Natureza">
                <Select
                  value={form.type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      type: event.target.value as TransactionType,
                      category:
                        event.target.value === "INCOME"
                          ? "Receita base"
                          : "Despesa fixa",
                    })
                  }
                >
                  <option value="INCOME">Receita fixa</option>
                  <option value="EXPENSE">Despesa fixa</option>
                </Select>
              </Field>

              <Field label="Categoria">
                <Input
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                />
              </Field>

              {institutional && (
                <Field label="Centro de custo">
                  <Input
                    value={form.cost_center}
                    onChange={(event) =>
                      setForm({ ...form, cost_center: event.target.value })
                    }
                    placeholder="Ex.: Administrativo"
                  />
                </Field>
              )}

              <Field label="Dia do lançamento">
                <Input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={form.day_of_month}
                  onChange={(event) =>
                    setForm({ ...form, day_of_month: event.target.value })
                  }
                />
              </Field>

              <Field label="Início">
                <Input
                  type="month"
                  required
                  value={form.start_month.slice(0, 7)}
                  onChange={(event) =>
                    setForm({ ...form, start_month: event.target.value })
                  }
                />
              </Field>

              <Field label="Término opcional">
                <Input
                  type="month"
                  value={form.end_month}
                  onChange={(event) =>
                    setForm({ ...form, end_month: event.target.value })
                  }
                />
              </Field>

              <Field label="Observação" wide>
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Contrato, reajuste, origem ou outra informação relevante."
                />
              </Field>

              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar valor fixo"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
        <CardHeader>
          <CardTitle>Base mensal cadastrada</CardTitle>
          <p className="text-sm text-slate-500">
            Pause um item sem perder o histórico ou exclua quando não for mais necessário.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Carregando...
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum valor fixo cadastrado"
              description="Cadastre sua receita base e seus compromissos mensais para obter projeções contábeis mais confiáveis."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-2xl border bg-white p-5 transition",
                    item.active
                      ? "border-slate-200"
                      : "border-slate-200 opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={cn(
                        "grid size-11 place-items-center rounded-xl",
                        item.type === "INCOME"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      )}
                    >
                      <CircleDollarSign className="size-5" />
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                        title={item.active ? "Pausar" : "Ativar"}
                      >
                        {item.active ? (
                          <Pause className="size-4" />
                        ) : (
                          <Play className="size-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        title="Excluir"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-5 text-sm font-black text-slate-900">
                    {item.description}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-xl font-black",
                      item.type === "INCOME"
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {currency.format(Number(item.amount))}
                  </p>

                  <div className="mt-4 space-y-1 text-xs text-slate-500">
                    <p>Categoria: {item.category}</p>
                    {institutional && (
                      <p>Centro: {item.cost_center || "Não informado"}</p>
                    )}
                    <p>Dia mensal: {item.day_of_month}</p>
                    <p>
                      Status:{" "}
                      <strong className="text-slate-700">
                        {item.active ? "Ativo" : "Pausado"}
                      </strong>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Summary({
  title,
  value,
  helper,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  tone: "emerald" | "rose" | "indigo";
}) {
  const classes = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
      <CardContent className="p-6">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase",
            classes[tone],
          )}
        >
          {title}
        </span>
        <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
        <p className="mt-2 text-xs text-slate-400">{helper}</p>
      </CardContent>
    </Card>
  );
}
