"use client";

import {
  Activity,
  BadgeDollarSign,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Gauge,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Settings2,
  TicketPercent,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { EquityOneLogo } from "@/components/EquityOneLogo";
import { SuperAdminProductSwitcher } from "@/components/admin/SuperAdminProductSwitcher";
import { WhatsAppDiagnostics } from "@/components/ai/WhatsAppDiagnostics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { formatSubscriptionDate, subscriptionIsActive, subscriptionStatusLabel, type Subscription } from "@/lib/subscriptions";

type AdminUser = {
  id: string;
  email?: string;
  full_name?: string;
  role?: "PERSONAL" | "INSTITUTIONAL";
  system_role?: "USER" | "SUPER_ADMIN";
  status?: "ACTIVE" | "SUSPENDED";
  created_at?: string;
  last_sign_in_at?: string;
  banned_until?: string;
  subscription: Subscription | null;
  latest_order?: {
    status?: string;
    amount?: number;
    order_nsu?: string;
    created_at?: string;
    receipt_url?: string;
  } | null;
};

type Settings = {
  public_signup_enabled: boolean;
  signup_mode: string;
  personal_price_cents: number;
  business_price_cents: number;
  medical_price_cents: number;
  personal_checkout_enabled: boolean;
  business_checkout_enabled: boolean;
  medical_checkout_enabled: boolean;
};

const initialSettings: Settings = {
  public_signup_enabled: true,
  signup_mode: "PUBLIC",
  personal_price_cents: 1990,
  business_price_cents: 7990,
  medical_price_cents: 5990,
  personal_checkout_enabled: true,
  business_checkout_enabled: true,
  medical_checkout_enabled: true,
};

const PAGE_SIZES = [25, 50, 100];

function planLabel(plan?: string | null) {
  if (plan === "BUSINESS") return "Negócios";
  if (plan === "MEDICAL") return "Médicos";
  return "Pessoal";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatMoney(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueCents / 100);
}

function formatMoneyInput(cents: number) {
  return String((cents / 100).toFixed(2)).replace(".", ",");
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 100;
  return Math.max(100, Math.round(amount * 100));
}

function daysToEnd(user: AdminUser) {
  if (user.system_role === "SUPER_ADMIN") return null;
  const end = user.subscription?.current_period_end;
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
}

function userStatus(user: AdminUser) {
  if (user.system_role === "SUPER_ADMIN") return "PERMANENT";
  if (user.status === "SUSPENDED" || Boolean(user.banned_until)) return "BLOCKED";
  if (user.subscription?.status === "SUSPENDED") return "SUSPENDED";
  const days = daysToEnd(user);
  if (subscriptionIsActive(user.subscription)) {
    if (days !== null && days <= 7) return "EXPIRING";
    return "ACTIVE";
  }
  return "EXPIRED";
}

function orderStatusLabel(value?: string | null) {
  const status = String(value || "").toUpperCase();
  if (["PAID", "APPROVED", "PAYMENT_CONFIRMED", "CONFIRMED"].includes(status)) return "Pago";
  if (["PENDING", "WAITING", "PROCESSING"].includes(status)) return "Pendente";
  if (["REFUNDED", "REFUND"].includes(status)) return "Reembolsado";
  if (["CANCELED", "CANCELLED"].includes(status)) return "Cancelado";
  if (["FAILED", "REJECTED", "DECLINED"].includes(status)) return "Não aprovado";
  return status ? "Registrado" : "—";
}

export default function AdminPage() {
  const router = useRouter();
  const { profile, session, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("RECENT");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<Settings>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", password: "", plan: "PERSONAL", system_role: "USER", access_days: "30" });

  const headers = useMemo(() => ({ Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }), [session?.access_token]);

  const load = useCallback(async () => {
    if (!session) return;
    const [usersResponse, settingsResponse] = await Promise.all([
      fetch("/api/admin/users", { headers, cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" }),
    ]);
    const usersJson = await usersResponse.json();
    const settingsJson = await settingsResponse.json();
    if (!usersResponse.ok) setError(usersJson.error || "Não foi possível carregar os clientes.");
    else setUsers(usersJson.users ?? []);
    if (settingsResponse.ok) setSettingsDraft(settingsJson);
  }, [headers, session]);

  useEffect(() => {
    if (!loading && profile?.system_role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [load, loading, profile?.system_role, router]);

  useEffect(() => setPage(1), [query, planFilter, statusFilter, sortBy, pageSize]);
  useEffect(() => {
    if (!selectedUser) return;
    const refreshed = users.find((item) => item.id === selectedUser.id);
    if (refreshed) setSelectedUser(refreshed);
  }, [users, selectedUser?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter((user) => {
      const matchesQuery = !q || `${user.full_name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(q);
      const matchesPlan = planFilter === "ALL" || user.subscription?.plan === planFilter;
      const matchesStatus = statusFilter === "ALL" || userStatus(user) === statusFilter;
      return matchesQuery && matchesPlan && matchesStatus;
    });
    return [...list].sort((a, b) => {
      if (sortBy === "NAME") return (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "", "pt-BR");
      if (sortBy === "EXPIRY") {
        const aEnd = a.subscription?.current_period_end ? new Date(a.subscription.current_period_end).getTime() : Number.MAX_SAFE_INTEGER;
        const bEnd = b.subscription?.current_period_end ? new Date(b.subscription.current_period_end).getTime() : Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  }, [planFilter, query, sortBy, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const customerUsers = users.filter((user) => user.system_role !== "SUPER_ADMIN");
  const activeCustomers = customerUsers.filter((user) => subscriptionIsActive(user.subscription));
  const expiringSoon = customerUsers.filter((user) => userStatus(user) === "EXPIRING").length;
  const blockedUsers = customerUsers.filter((user) => userStatus(user) === "BLOCKED").length;
  const planCounts = {
    PERSONAL: customerUsers.filter((user) => user.subscription?.plan === "PERSONAL").length,
    BUSINESS: customerUsers.filter((user) => user.subscription?.plan === "BUSINESS").length,
    MEDICAL: customerUsers.filter((user) => user.subscription?.plan === "MEDICAL").length,
  };
  const mrrEstimated = activeCustomers.reduce((sum, user) => {
    if (user.subscription?.plan === "BUSINESS") return sum + settingsDraft.business_price_cents;
    if (user.subscription?.plan === "MEDICAL") return sum + settingsDraft.medical_price_cents;
    return sum + settingsDraft.personal_price_cents;
  }, 0);
  const enabledCheckouts = [settingsDraft.personal_checkout_enabled, settingsDraft.business_checkout_enabled, settingsDraft.medical_checkout_enabled].filter(Boolean).length;

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const response = await fetch("/api/admin/users", { method: "POST", headers, body: JSON.stringify({ ...form, access_days: Number(form.access_days) }) });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Não foi possível criar o usuário.");
    setOpenCreate(false);
    setForm({ full_name: "", email: "", password: "", plan: "PERSONAL", system_role: "USER", access_days: "30" });
    setMessage("Usuário criado e acesso liberado.");
    await load();
  }

  async function userAction(id: string, action: string, extras: Record<string, unknown> = {}) {
    if (action === "DELETE" && !window.confirm("Excluir definitivamente este usuário e todos os dados vinculados?")) return;
    setError(""); setMessage("");
    const response = await fetch(action === "DELETE" ? `/api/admin/users?id=${id}` : "/api/admin/users", {
      method: action === "DELETE" ? "DELETE" : "PATCH",
      headers,
      body: action === "DELETE" ? undefined : JSON.stringify({ id, action, ...extras }),
    });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Não foi possível realizar a alteração.");
    if (action === "DELETE") setSelectedUser(null);
    setMessage("Alteração realizada com sucesso.");
    await load();
  }

  async function saveSettings() {
    setSavingSettings(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers, body: JSON.stringify(settingsDraft) });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Não foi possível salvar as configurações.");
    else { setSettingsDraft(json); setMessage("Preços e checkouts atualizados."); }
    setSavingSettings(false);
  }

  if (loading || profile?.system_role !== "SUPER_ADMIN") return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Validando acesso administrativo...</div>;

  return (
    <main className="min-h-screen bg-[#f4f3ef] p-4 md:p-7 lg:p-9">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0d11] text-white shadow-[0_22px_60px_rgba(15,23,42,.16)]">
          <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.45fr_.85fr] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3"><EquityOneLogo className="h-14 w-auto" /><span className="rounded-full border border-[#d2aa51]/25 bg-[#d2aa51]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-[#e4c875]">Super Admin</span></div>
              <h1 className="mt-7 text-3xl font-black tracking-[-.04em] md:text-4xl">Central de controle</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Clientes, receita recorrente, produtos, acessos e integrações críticas em uma única visão.</p>
              <div className="mt-6 max-w-2xl"><SuperAdminProductSwitcher compact /></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <Button onClick={() => setOpenCreate((value) => !value)} className="h-11 justify-start bg-[#d2aa51] font-black text-black hover:bg-[#e0be6d]"><UserPlus className="size-4" /> Novo cliente</Button>
              <Button variant="outline" onClick={() => router.push("/dashboard")} className="h-11 justify-start border-white/10 bg-white/[.05] text-white hover:bg-white/10 hover:text-white"><LayoutDashboard className="size-4" /> Abrir dashboard</Button>
              <Button variant="outline" onClick={() => router.push("/admin/cupons")} className="h-11 justify-start border-white/10 bg-white/[.05] text-white hover:bg-white/10 hover:text-white"><TicketPercent className="size-4" /> Cupons e campanhas</Button>
            </div>
          </div>
        </header>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ExecutiveMetric icon={UserCheck} label="Clientes ativos" value={String(activeCustomers.length)} helper={`${customerUsers.length} clientes cadastrados`} />
          <ExecutiveMetric icon={BadgeDollarSign} label="MRR estimado" value={formatMoney(mrrEstimated)} helper="Com base nos planos ativos" tone="gold" />
          <ExecutiveMetric icon={CalendarClock} label="Vencendo em 7 dias" value={String(expiringSoon)} helper={expiringSoon ? "Exigem acompanhamento" : "Nenhum vencimento crítico"} tone={expiringSoon ? "amber" : "default"} />
          <ExecutiveMetric icon={UserX} label="Contas bloqueadas" value={String(blockedUsers)} helper={blockedUsers ? "Bloqueio administrativo" : "Nenhuma conta bloqueada"} tone={blockedUsers ? "rose" : "default"} />
        </section>

        {openCreate && <Card className="overflow-hidden border-[#d2aa51]/30 bg-[#fffaf0] shadow-sm"><CardHeader className="border-b border-[#d2aa51]/15"><CardTitle className="flex items-center gap-2"><Plus className="size-5 text-[#9a762b]" /> Criar acesso manual</CardTitle></CardHeader><CardContent className="pt-5"><form onSubmit={createUser} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><Input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /><Input required type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Input required minLength={6} placeholder="Senha inicial" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}><option value="PERSONAL">Equity One Pessoal</option><option value="BUSINESS">Equity One Negócios</option><option value="MEDICAL">Equity One Médicos</option></Select><Select value={form.system_role} onChange={(e) => setForm({ ...form, system_role: e.target.value })}><option value="USER">Cliente</option><option value="SUPER_ADMIN">Super Admin</option></Select><div className="flex gap-2"><Input type="number" min="1" value={form.access_days} onChange={(e) => setForm({ ...form, access_days: e.target.value })} /><Button type="submit">Criar</Button></div></form><p className="mt-3 text-xs text-slate-500">Use somente para liberações manuais. Clientes do checkout seguem o fluxo comercial normal.</p></CardContent></Card>}

        <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.06)]"><CardHeader className="border-b border-slate-100"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#9a762b]">Base de clientes</p><CardTitle className="mt-1">Clientes e acessos</CardTitle><p className="mt-2 text-sm text-slate-500">Busque, filtre e abra somente a ficha que precisa administrar.</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:col-span-2"><Search className="size-4 text-slate-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome ou e-mail..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div><Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}><option value="ALL">Todos os produtos</option><option value="PERSONAL">Pessoal</option><option value="BUSINESS">Negócios</option><option value="MEDICAL">Médicos</option></Select><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">Todos os status</option><option value="ACTIVE">Ativos</option><option value="EXPIRING">Vencendo</option><option value="EXPIRED">Expirados</option><option value="SUSPENDED">Suspensos</option><option value="BLOCKED">Bloqueados</option><option value="PERMANENT">Permanentes</option></Select></div></div></CardHeader><CardContent className="p-0"><div className="hidden grid-cols-[minmax(220px,1.4fr)_135px_125px_130px_78px] gap-4 border-b border-slate-100 px-6 py-3 text-[10px] font-black uppercase tracking-wide text-slate-400 md:grid"><span>Cliente</span><span>Produto</span><span>Status</span><span>Vencimento</span><span className="text-right">Ação</span></div>{pageUsers.length === 0 ? <div className="px-6 py-12 text-center text-sm text-slate-500">Nenhum cliente encontrado.</div> : pageUsers.map((user) => <CompactUserRow key={user.id} user={user} onOpen={() => { setSelectedUser(user); setCustomDate(""); }} />)}<div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><span>{filtered.length} cliente(s)</span><Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-36"><option value="RECENT">Mais recentes</option><option value="NAME">Nome A–Z</option><option value="EXPIRY">Vencimento</option></Select><Select value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))} className="w-24">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}/pág.</option>)}</Select></div><div className="flex items-center gap-2"><Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="size-4" /></Button><span className="min-w-28 text-center text-sm font-bold text-slate-700">{currentPage} de {totalPages}</span><Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="size-4" /></Button></div></div></CardContent></Card>

          <div className="space-y-4"><Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.06)]"><CardHeader><p className="text-xs font-black uppercase tracking-[.16em] text-[#9a762b]">Produtos</p><CardTitle>Distribuição da base</CardTitle></CardHeader><CardContent className="space-y-4"><ProductShare label="Pessoal" count={planCounts.PERSONAL} total={customerUsers.length} price={settingsDraft.personal_price_cents} /><ProductShare label="Negócios" count={planCounts.BUSINESS} total={customerUsers.length} price={settingsDraft.business_price_cents} /><ProductShare label="Médicos" count={planCounts.MEDICAL} total={customerUsers.length} price={settingsDraft.medical_price_cents} /></CardContent></Card><Card className="border-0 bg-[#111318] text-white shadow-[0_12px_35px_rgba(15,23,42,.12)]"><CardContent className="p-5"><div className="flex items-center gap-2 text-[#e0bd67]"><Gauge className="size-4"/><span className="text-xs font-black uppercase tracking-[.16em]">Operação</span></div><DarkInfo label="Checkouts ativos" value={`${enabledCheckouts} de 3`} /><Button variant="outline" onClick={() => router.push("/dashboard/agente")} className="mt-4 w-full border-white/10 bg-white/[.06] text-white hover:bg-white/10 hover:text-white"><Activity className="size-4"/> Abrir Meu Agente Financeiro</Button></CardContent></Card></div>
        </section>

        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.06)]"><CardHeader className="border-b border-slate-100"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#d2aa51]/10 text-[#9a762b]"><Settings2 className="size-5"/></span><div><CardTitle>Planos e vendas</CardTitle><p className="mt-1 text-sm text-slate-500">Controle somente o que realmente afeta novas adesões: preço e disponibilidade do checkout.</p></div></div></CardHeader><CardContent className="space-y-6 pt-6"><div className="grid gap-4 md:grid-cols-3"><PlanPriceField title="Equity One Pessoal" value={formatMoneyInput(settingsDraft.personal_price_cents)} enabled={settingsDraft.personal_checkout_enabled} onEnabledChange={(value) => setSettingsDraft({ ...settingsDraft, personal_checkout_enabled: value })} onValueChange={(value) => setSettingsDraft({ ...settingsDraft, personal_price_cents: parseMoneyInput(value) })} /><PlanPriceField title="Equity One Negócios" value={formatMoneyInput(settingsDraft.business_price_cents)} enabled={settingsDraft.business_checkout_enabled} onEnabledChange={(value) => setSettingsDraft({ ...settingsDraft, business_checkout_enabled: value })} onValueChange={(value) => setSettingsDraft({ ...settingsDraft, business_price_cents: parseMoneyInput(value) })} /><PlanPriceField title="Equity One Médicos" value={formatMoneyInput(settingsDraft.medical_price_cents)} enabled={settingsDraft.medical_checkout_enabled} onEnabledChange={(value) => setSettingsDraft({ ...settingsDraft, medical_checkout_enabled: value })} onValueChange={(value) => setSettingsDraft({ ...settingsDraft, medical_price_cents: parseMoneyInput(value) })} /></div><div className="flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">A configuração técnica de cadastro permanece preservada no backend, sem ocupar espaço operacional aqui.</p><Button onClick={saveSettings} disabled={savingSettings}><Save className="size-4" />{savingSettings ? "Salvando..." : "Salvar preços e checkouts"}</Button></div></CardContent></Card>

        <section className="space-y-3"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#9a762b]">Integrações críticas</p><h2 className="mt-1 text-xl font-black text-slate-950">Saúde do WhatsApp</h2></div><Button variant="outline" onClick={() => router.push("/dashboard/agente")}><ExternalLink className="size-4"/> Abrir agente</Button></div><WhatsAppDiagnostics /></section>
      </div>
      {selectedUser && <UserDetailDrawer user={selectedUser} customDate={customDate} onCustomDateChange={setCustomDate} onClose={() => setSelectedUser(null)} onAction={(action, extras) => userAction(selectedUser.id, action, extras)} />}
    </main>
  );
}

function ExecutiveMetric({ icon: Icon, label, value, helper, tone = "default" }: { icon:any; label:string; value:string; helper:string; tone?:"default"|"gold"|"amber"|"rose" }) { const cls = tone === "gold" ? "bg-[#fff8e7] text-[#8c6822]" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"; return <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,.05)]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-black tracking-[-.03em] text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{helper}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${cls}`}><Icon className="size-4"/></span></div></div>; }
function ProductShare({ label, count, total, price }: { label:string; count:number; total:number; price:number }) { const pct = total ? Math.round((count / total) * 100) : 0; return <div><div className="flex items-end justify-between gap-3"><div><p className="font-black text-slate-900">{label}</p><p className="text-xs text-slate-500">{count} cliente(s) · {formatMoney(price)}/mês</p></div><span className="text-sm font-black text-slate-700">{pct}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#d2aa51]" style={{ width: `${pct}%` }} /></div></div>; }
function DarkInfo({ label, value }: { label:string; value:string }) { return <div className="mt-4 rounded-xl border border-white/10 bg-white/[.05] p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>; }
function CompactUserRow({ user, onOpen }: { user: AdminUser; onOpen: () => void }) { return <div className="grid gap-3 border-b border-slate-100 px-6 py-4 last:border-b-0 md:grid-cols-[minmax(220px,1.4fr)_135px_125px_130px_78px] md:items-center md:gap-4"><div className="min-w-0"><p className="truncate font-bold text-slate-900">{user.full_name || "Usuário sem nome"}</p><p className="mt-1 truncate text-sm text-slate-500">{user.email || "—"}</p></div><PlanBadge plan={user.subscription?.plan} /><UserStateBadge status={userStatus(user)} /><div className="text-sm font-semibold text-slate-700">{user.system_role === "SUPER_ADMIN" ? "Permanente" : formatSubscriptionDate(user.subscription?.current_period_end ?? null)}</div><div className="flex justify-end"><Button variant="outline" onClick={onOpen}>Ver <MoreHorizontal className="size-4" /></Button></div></div>; }
function UserDetailDrawer({ user, customDate, onCustomDateChange, onClose, onAction }: { user:AdminUser; customDate:string; onCustomDateChange:(value:string)=>void; onClose:()=>void; onAction:(action:string,extras?:Record<string,unknown>)=>void }) { const active = user.system_role === "SUPER_ADMIN" || subscriptionIsActive(user.subscription); const blocked = user.status === "SUSPENDED" || Boolean(user.banned_until); return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"><button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar"/><aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-5"><div><p className="text-xs font-black uppercase tracking-wide text-[#9a762b]">Conta do cliente</p><h2 className="mt-1 text-2xl font-black">{user.full_name || "Usuário sem nome"}</h2><p className="mt-1 text-sm text-slate-500">{user.email}</p></div><button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X className="size-5"/></button></div><div className="space-y-6 p-6"><div className="flex flex-wrap gap-2"><PlanBadge plan={user.subscription?.plan} /><UserStateBadge status={userStatus(user)} /></div><section className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><Info label="Assinatura" value={user.system_role === "SUPER_ADMIN" ? "Permanente" : subscriptionStatusLabel(user.subscription)} /><Info label="Vencimento" value={user.system_role === "SUPER_ADMIN" ? "Sem vencimento" : formatSubscriptionDate(user.subscription?.current_period_end ?? null)} /><Info label="Cadastro" value={formatDate(user.created_at)} /><Info label="Último login" value={formatDate(user.last_sign_in_at)} /></section>{user.latest_order && <section className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Último pagamento</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Info label="Situação" value={orderStatusLabel(user.latest_order.status)} /><Info label="Valor" value={typeof user.latest_order.amount === "number" ? formatMoney(user.latest_order.amount) : "—"} /><Info label="Data" value={formatDate(user.latest_order.created_at)} /><Info label="Pedido" value={user.latest_order.order_nsu || "—"} /></div></section>}{user.system_role !== "SUPER_ADMIN" && <section className="space-y-4"><p className="font-black">Acesso e assinatura</p><div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => onAction("SUBSCRIPTION_EXTEND", { days: 30 })}>Adicionar 30 dias</Button><Button variant="outline" onClick={() => onAction("SUBSCRIPTION_EXTEND", { days: 90 })}>Adicionar 90 dias</Button></div><div className="flex gap-2"><Input type="date" value={customDate} onChange={(e) => onCustomDateChange(e.target.value)} /><Button variant="outline" disabled={!customDate} onClick={() => onAction("SUBSCRIPTION_SET_END", { period_end: customDate })}>Definir vencimento</Button></div><div className="grid gap-2 sm:grid-cols-2">{active ? <Button variant="outline" onClick={() => onAction("SUBSCRIPTION_SUSPEND")}>Suspender assinatura</Button> : <Button onClick={() => onAction("SUBSCRIPTION_ACTIVATE")}>Reativar por 30 dias</Button>}{blocked ? <Button variant="outline" onClick={() => onAction("ACTIVATE")}>Desbloquear login</Button> : <Button variant="outline" onClick={() => onAction("SUSPEND")}>Bloquear login</Button>}</div></section>}<Button variant="outline" onClick={() => onAction("DELETE")} className="w-full border-rose-200 text-rose-700 hover:bg-rose-50"><Trash2 className="size-4"/> Excluir usuário definitivamente</Button></div></aside></div>; }
function PlanBadge({ plan }: { plan?: string | null }) { const cls = plan === "MEDICAL" ? "bg-sky-50 text-sky-700" : plan === "BUSINESS" ? "bg-emerald-50 text-emerald-700" : "bg-[#fff6dd] text-[#8a6720]"; return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${cls}`}>{planLabel(plan)}</span>; }
function UserStateBadge({ status }: { status:string }) { const map:Record<string,{label:string;cls:string}> = { ACTIVE:{label:"Ativo",cls:"bg-emerald-50 text-emerald-700"}, EXPIRING:{label:"Vencendo",cls:"bg-amber-50 text-amber-700"}, EXPIRED:{label:"Expirado",cls:"bg-rose-50 text-rose-700"}, SUSPENDED:{label:"Suspenso",cls:"bg-slate-100 text-slate-700"}, BLOCKED:{label:"Bloqueado",cls:"bg-rose-100 text-rose-800"}, PERMANENT:{label:"Permanente",cls:"bg-violet-50 text-violet-700"} }; const item = map[status] ?? map.EXPIRED; return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${item.cls}`}>{item.label}</span>; }
function PlanPriceField({ title, value, enabled, onEnabledChange, onValueChange }: { title:string; value:string; enabled:boolean; onEnabledChange:(value:boolean)=>void; onValueChange:(value:string)=>void }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">Preço mensal para novas adesões.</p></div><Toggle value={enabled} onChange={onEnabledChange} /></div><label className="mt-4 block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Valor mensal</span><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">R$</span><Input value={value} onChange={(e) => onValueChange(e.target.value)} className="pl-12 font-bold" inputMode="decimal" /></div></label><p className="mt-3 text-xs text-slate-500">{enabled ? "Checkout liberado." : "Novas adesões pausadas."}</p></div>; }
function Toggle({ value, onChange }: { value:boolean; onChange:(value:boolean)=>void }) { return <button type="button" onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 size-5 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} /></button>; }
function Info({ label, value }: { label:string; value:string }) { return <div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p></div>; }
