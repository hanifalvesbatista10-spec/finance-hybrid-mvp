"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Power, Ticket, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Coupon = {
  id: string;
  code: string;
  discount_type: "PERCENT" | "FIXED";
  discount_value: number;
  product_codes: string[];
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses_count: number;
  per_customer_limit: number;
};

const productLabel: Record<string, string> = {
  PERSONAL: "Pessoal",
  BUSINESS: "Negócios",
  MEDICAL: "Médicos",
};

export default function CouponsPage() {
  const { session, profile, loading } = useAuth();
  const [items, setItems] = useState<Coupon[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discount_type: "PERCENT",
    discount_value: "",
    products: ["MEDICAL"] as string[],
    starts_at: "",
    ends_at: "",
    max_uses: "",
    per_customer_limit: "1",
  });

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    }),
    [session?.access_token],
  );

  const load = useCallback(async () => {
    if (!session) return;
    const response = await fetch("/api/admin/coupons", { headers, cache: "no-store" });
    const json = await response.json();
    if (response.ok) setItems(json.coupons ?? []);
    else setError(json.error || "Não foi possível carregar os cupons.");
  }, [headers, session]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || profile?.system_role !== "SUPER_ADMIN") {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Validando acesso...</div>;
  }

  async function create() {
    if (creating) return;
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code: form.code,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          product_codes: form.products,
          starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          per_customer_limit: Number(form.per_customer_limit) || 1,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível criar o cupom.");

      setMessage(`Cupom ${json.code || form.code.toUpperCase()} criado com sucesso.`);
      setOpen(false);
      setForm({ code: "", discount_type: "PERCENT", discount_value: "", products: ["MEDICAL"], starts_at: "", ends_at: "", max_uses: "", per_customer_limit: "1" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o cupom.");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(coupon: Coupon) {
    if (busyId) return;
    setBusyId(coupon.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível alterar o cupom.");
      setItems((current) => current.map((item) => item.id === coupon.id ? { ...item, is_active: Boolean(json.is_active) } : item));
      setMessage(`Cupom ${coupon.code} ${coupon.is_active ? "desativado" : "ativado"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar o cupom.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(coupon: Coupon) {
    if (busyId) return;
    const question = coupon.uses_count > 0
      ? `O cupom ${coupon.code} já possui ${coupon.uses_count} uso(s). Excluir pode ser bloqueado para preservar o histórico. Deseja tentar excluir mesmo assim?`
      : `Excluir definitivamente o cupom ${coupon.code}?`;
    if (!window.confirm(question)) return;

    setBusyId(coupon.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/coupons?id=${encodeURIComponent(coupon.id)}`, {
        method: "DELETE",
        headers,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível excluir o cupom.");
      if (!json.ok) throw new Error("A exclusão não foi confirmada pelo servidor.");

      setItems((current) => current.filter((item) => item.id !== coupon.id));
      setMessage(`Cupom ${coupon.code} excluído definitivamente.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir o cupom.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleProduct(code: string) {
    setForm((current) => ({
      ...current,
      products: current.products.includes(code)
        ? current.products.filter((item) => item !== code)
        : [...current.products, code],
    }));
  }

  return (
    <main className="min-h-screen bg-[#f4f3ef] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-black"><ArrowLeft className="size-4" /> Super Admin</Link>
            <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#9a762b]">Comercial</p>
            <h1 className="mt-2 text-3xl font-black">Cupons de desconto</h1>
            <p className="mt-2 text-sm text-slate-500">Crie, pause e remova campanhas diretamente pelo painel administrativo.</p>
          </div>
          <Button onClick={() => setOpen((value) => !value)} className="bg-[#0d0f13]"><Plus className="size-4" /> Novo cupom</Button>
        </header>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}

        {open && (
          <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Input placeholder="Código: MEDICO20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              <Select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}><option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option></Select>
              <Input type="number" min="0" step="0.01" placeholder="Valor do desconto" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
              <Input type="number" min="1" placeholder="Limite total (opcional)" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              <Input type="number" min="1" placeholder="Usos por cliente" value={form.per_customer_limit} onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {[["PERSONAL", "Pessoal"], ["BUSINESS", "Negócios"], ["MEDICAL", "Médicos"]].map(([code, label]) => (
                <button key={code} type="button" onClick={() => toggleProduct(code)} className={`rounded-full border px-4 py-2 text-xs font-black ${form.products.includes(code) ? "border-[#c9a34d] bg-[#c9a34d]/10 text-[#8b6a25]" : "border-slate-200 text-slate-500"}`}>{label}</button>
              ))}
            </div>
            <Button onClick={() => void create()} disabled={creating || !form.code || !form.discount_value || !form.products.length} className="mt-6 bg-[#0d0f13]">{creating ? <Loader2 className="size-4 animate-spin" /> : null}{creating ? "Salvando..." : "Salvar cupom"}</Button>
          </section>
        )}

        <section className="grid gap-4">
          {items.map((coupon) => {
            const busy = busyId === coupon.id;
            return (
              <article key={coupon.id} className="flex flex-col gap-5 rounded-3xl border border-black/5 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[#c9a34d]/10 text-[#9a762b]"><Ticket className="size-5" /></span>
                  <div>
                    <div className="flex items-center gap-2"><h2 className="text-lg font-black">{coupon.code}</h2><span className={`rounded-full px-2 py-1 text-[10px] font-black ${coupon.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{coupon.is_active ? "ATIVO" : "INATIVO"}</span></div>
                    <p className="mt-1 text-sm text-slate-500">
                      {coupon.discount_type === "PERCENT" ? `${coupon.discount_value}%` : `R$ ${Number(coupon.discount_value).toFixed(2).replace(".", ",")}`}
                      {" · "}{(coupon.product_codes ?? []).map((code) => productLabel[code] || code).join(" · ")}
                      {" · "}{coupon.uses_count ?? 0}{coupon.max_uses ? `/${coupon.max_uses}` : ""} usos
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={Boolean(busyId)} onClick={() => void toggle(coupon)}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}{coupon.is_active ? "Desativar" : "Ativar"}</Button>
                  <Button variant="outline" disabled={Boolean(busyId)} onClick={() => void remove(coupon)} title={`Excluir ${coupon.code}`} className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800">{busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}<span className="sr-only">Excluir cupom</span></Button>
                </div>
              </article>
            );
          })}
          {!items.length && <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">Nenhum cupom criado.</div>}
        </section>
      </div>
    </main>
  );
}
