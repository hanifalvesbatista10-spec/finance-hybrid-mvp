"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "./EmptyState";
import { currency, dateBR, type Transaction, type TransactionType } from "@/lib/finance";
import { cn } from "@/lib/utils";

const initialForm = {
  description: "",
  amount: "",
  type: "EXPENSE" as TransactionType,
  category: "Outros",
  cost_center: "",
  occurred_on: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function TransactionsManager({
  institutional = false,
  compact = false,
}: {
  institutional?: boolean;
  compact?: boolean;
}) {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<Transaction[]>([]);
  const [form, setForm] = useState(initialForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(compact ? 6 : 100);

    if (error) setError(error.message);
    else setItems((data ?? []) as Transaction[]);
    setLoading(false);
  }, [compact, supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.description, item.category, item.cost_center ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");

    const amount = Number(form.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      description: form.description.trim(),
      amount,
      type: form.type,
      category: form.category,
      cost_center: institutional ? form.cost_center.trim() || null : null,
      occurred_on: form.occurred_on,
      notes: form.notes.trim() || null,
    });

    if (error) {
      setError(error.message);
    } else {
      setForm(initialForm);
      setOpen(false);
      await load();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) setError(error.message);
    else setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
      <CardHeader className="gap-4 border-b border-slate-100 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{compact ? "Últimos lançamentos" : "Lançamentos financeiros"}</CardTitle>
          <p className="mt-2 text-sm text-slate-500">
            Receitas e despesas salvas diretamente no Supabase.
          </p>
        </div>
        <Button onClick={() => setOpen((value) => !value)}>
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? "Fechar" : "Novo lançamento"}
        </Button>
      </CardHeader>

      <CardContent className="p-6">
        {error && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {open && (
          <form
            onSubmit={save}
            className="mb-7 grid gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 md:grid-cols-2 xl:grid-cols-4"
          >
            <label className="xl:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Descrição
              </span>
              <Input
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Pagamento de cliente"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Valor
              </span>
              <Input
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Tipo
              </span>
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType })}
              >
                <option value="INCOME">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </Select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Categoria
              </span>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex.: Alimentação"
              />
            </label>

            {institutional && (
              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Centro de custo
                </span>
                <Input
                  value={form.cost_center}
                  onChange={(e) => setForm({ ...form, cost_center: e.target.value })}
                  placeholder="Ex.: Marketing"
                />
              </label>
            )}

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Data
              </span>
              <Input
                type="date"
                required
                value={form.occurred_on}
                onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
              />
            </label>

            <label className={institutional ? "" : "md:col-span-2"}>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Observação
              </span>
              <Textarea
                className="min-h-11"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Opcional"
              />
            </label>

            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : "Salvar lançamento"}
              </Button>
            </div>
          </form>
        )}

        {!compact && items.length > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 px-3">
            <Search className="size-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição, categoria ou centro de custo..."
              className="h-11 w-full bg-transparent text-sm outline-none"
            />
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Carregando lançamentos...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Nenhum lançamento registrado"
            description="O dashboard começa zerado. Clique em “Novo lançamento” para registrar sua primeira receita ou despesa."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 font-bold">Lançamento</th>
                  <th className="pb-3 font-bold">Categoria</th>
                  {institutional && <th className="pb-3 font-bold">Centro de custo</th>}
                  <th className="pb-3 font-bold">Data</th>
                  <th className="pb-3 text-right font-bold">Valor</th>
                  {!compact && <th className="pb-3 text-right font-bold">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const income = item.type === "INCOME";
                  return (
                    <tr key={item.id} className="group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "grid size-10 place-items-center rounded-xl",
                            income ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                          )}>
                            {income ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.description}</p>
                            {item.notes && <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{item.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-sm text-slate-600">{item.category}</td>
                      {institutional && (
                        <td className="py-4">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            {item.cost_center || "Não informado"}
                          </span>
                        </td>
                      )}
                      <td className="py-4 text-sm text-slate-500">
                        {dateBR.format(new Date(`${item.occurred_on}T12:00:00`))}
                      </td>
                      <td className={cn(
                        "py-4 text-right text-sm font-black",
                        income ? "text-emerald-700" : "text-rose-700",
                      )}>
                        {income ? "+" : "-"} {currency.format(Number(item.amount))}
                      </td>
                      {!compact && (
                        <td className="py-4 text-right">
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                            aria-label="Excluir lançamento"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
