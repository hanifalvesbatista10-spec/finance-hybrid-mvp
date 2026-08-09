"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  TicketPercent,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/finance/StatCard";
import { EquityOneLogo } from "@/components/EquityOneLogo";
import { useAuth } from "@/context/AuthContext";
import {
  formatSubscriptionDate,
  subscriptionIsActive,
  subscriptionStatusLabel,
  type Subscription,
} from "@/lib/subscriptions";

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
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
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
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    plan: "PERSONAL",
    system_role: "USER",
    access_days: "30",
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

    const [usersResponse, settingsResponse] = await Promise.all([
      fetch("/api/admin/users", { headers, cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" }),
    ]);

    const usersJson = await usersResponse.json();
    const settingsJson = await settingsResponse.json();

    if (!usersResponse.ok) setError(usersJson.error);
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

  useEffect(() => {
    setPage(1);
  }, [query, planFilter, statusFilter, sortBy, pageSize]);

  useEffect(() => {
    if (!selectedUser) return;
    const refreshed = users.find((item) => item.id === selectedUser.id);
    if (refreshed) setSelectedUser(refreshed);
  }, [users, selectedUser?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter((user) => {
      const matchesQuery =
        !q ||
        `${user.full_name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(q);
      const matchesPlan =
        planFilter === "ALL" || user.subscription?.plan === planFilter;
      const matchesStatus =
        statusFilter === "ALL" || userStatus(user) === statusFilter;
      return matchesQuery && matchesPlan && matchesStatus;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "NAME") {
        return (a.full_name ?? a.email ?? "").localeCompare(
          b.full_name ?? b.email ?? "",
          "pt-BR",
        );
      }
      if (sortBy === "EXPIRY") {
        const aEnd = a.subscription?.current_period_end
          ? new Date(a.subscription.current_period_end).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bEnd = b.subscription?.current_period_end
          ? new Date(b.subscription.current_period_end).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
      }
      return (
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
      );
    });
  }, [planFilter, query, sortBy, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const activeSubscriptions = users.filter((user) =>
    user.system_role === "SUPER_ADMIN" ? true : subscriptionIsActive(user.subscription),
  ).length;

  const expiringSoon = users.filter((user) => userStatus(user) === "EXPIRING").length;

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...form, access_days: Number(form.access_days) }),
    });
    const json = await response.json();

    if (!response.ok) {
      setError(json.error);
      return;
    }

    setOpenCreate(false);
    setForm({
      full_name: "",
      email: "",
      password: "",
      plan: "PERSONAL",
      system_role: "USER",
      access_days: "30",
    });
    setMessage("Usuário criado e acesso liberado.");
    await load();
  }

  async function userAction(
    id: string,
    action: string,
    extras: Record<string, unknown> = {},
  ) {
    if (
      action === "DELETE" &&
      !window.confirm("Excluir definitivamente este usuário e seus dados?")
    ) {
      return;
    }

    setError("");
    setMessage("");

    const response = await fetch(
      action === "DELETE" ? `/api/admin/users?id=${id}` : "/api/admin/users",
      {
        method: action === "DELETE" ? "DELETE" : "PATCH",
        headers,
        body:
          action === "DELETE"
            ? undefined
            : JSON.stringify({ id, action, ...extras }),
      },
    );
    const json = await response.json();

    if (!response.ok) {
      setError(json.error);
      return;
    }

    if (action === "DELETE") setSelectedUser(null);
    setMessage("Alteração realizada com sucesso.");
    await load();
  }

  async function saveSettings() {
    setSavingSettings(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify(settingsDraft),
    });
    const json = await response.json();

    if (!response.ok) setError(json.error);
    else {
      setSettingsDraft(json);
      setMessage("Configurações de acesso atualizadas.");
    }
    setSavingSettings(false);
  }

  if (loading || profile?.system_role !== "SUPER_ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        Validando acesso administrativo...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-4 md:p-8 lg:p-10">
      <div className="mx-auto max-w-[1500px] space-y-7">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4"><EquityOneLogo className="h-16 w-auto" /></div>
            <p className="text-sm font-black text-[#9a762b]">SUPER ADMIN</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
              Controle da plataforma
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Gestão de clientes, assinaturas, cupons e acessos.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Voltar ao sistema</Button>
            <Button variant="outline" onClick={() => router.push("/admin/cupons")}>
              <TicketPercent className="size-4" /> Cupons
            </Button>
            <Button onClick={() => setOpenCreate((value) => !value)}>
              <UserPlus className="size-4" /> Novo usuário
            </Button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Usuários cadastrados" value={String(users.length)} helper="Total na plataforma" icon={Users} />
          <StatCard title="Assinaturas ativas" value={String(activeSubscriptions)} helper="Com período válido" icon={UserCheck} tone="emerald" />
          <StatCard title="Vencendo em 7 dias" value={String(expiringSoon)} helper="Prioridade de acompanhamento" icon={CalendarPlus} tone="amber" />
          <StatCard title="Contas bloqueadas" value={String(users.filter((user) => userStatus(user) === "BLOCKED").length)} helper="Bloqueio administrativo" icon={UserX} tone="rose" />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Equity One Pessoal" value={String(users.filter((user) => user.subscription?.plan === "PERSONAL").length)} helper="Clientes do produto pessoal" icon={UserCheck} />
          <StatCard title="Equity One Negócios" value={String(users.filter((user) => user.subscription?.plan === "BUSINESS").length)} helper="Clientes empresariais" icon={Users} tone="emerald" />
          <StatCard title="Equity One Médicos" value={String(users.filter((user) => user.subscription?.plan === "MEDICAL").length)} helper="Profissionais médicos" icon={ShieldCheck} tone="amber" />
        </section>

        {openCreate && (
          <Card className="border-[#d9c28a] bg-[#fffaf0]">
            <CardHeader><CardTitle>Criar usuário com acesso</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <Input required placeholder="Nome completo" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
                <Input required type="email" placeholder="E-mail" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <Input required minLength={6} placeholder="Senha inicial" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <Select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}>
                  <option value="PERSONAL">Equity One Pessoal</option>
                  <option value="BUSINESS">Equity One Negócios</option>
                  <option value="MEDICAL">Equity One Médicos</option>
                </Select>
                <Select value={form.system_role} onChange={(event) => setForm({ ...form, system_role: event.target.value })}>
                  <option value="USER">Cliente</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </Select>
                <div className="flex gap-2">
                  <Input type="number" min="1" value={form.access_days} onChange={(event) => setForm({ ...form, access_days: event.target.value })} title="Dias de acesso" />
                  <Button type="submit">Criar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
          <CardHeader className="gap-4 border-b border-slate-100">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle>Clientes</CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  Visão compacta. Abra um cliente somente quando precisar administrar a conta.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:col-span-2">
                  <Search className="size-4 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou e-mail..." className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </div>
                <Select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
                  <option value="ALL">Todos os produtos</option>
                  <option value="PERSONAL">Pessoal</option>
                  <option value="BUSINESS">Negócios</option>
                  <option value="MEDICAL">Médicos</option>
                </Select>
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">Todos os status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="EXPIRING">Vencendo em 7 dias</option>
                  <option value="EXPIRED">Expirados</option>
                  <option value="SUSPENDED">Suspensos</option>
                  <option value="BLOCKED">Bloqueados</option>
                  <option value="PERMANENT">Permanentes</option>
                </Select>
                <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="RECENT">Mais recentes</option>
                  <option value="NAME">Nome A–Z</option>
                  <option value="EXPIRY">Vencimento</option>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="hidden grid-cols-[minmax(220px,1.4fr)_150px_140px_150px_88px] gap-4 border-b border-slate-100 px-6 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 md:grid">
              <span>Cliente</span><span>Produto</span><span>Status</span><span>Vencimento</span><span className="text-right">Ação</span>
            </div>

            {pageUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">Nenhum cliente encontrado com esses filtros.</div>
            ) : (
              pageUsers.map((user) => (
                <CompactUserRow key={user.id} user={user} onOpen={() => { setSelectedUser(user); setCustomDate(""); }} />
              ))
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>{filtered.length} cliente(s)</span>
                <Select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))} className="w-24">
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}/pág.</option>)}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-28 text-center text-sm font-bold text-slate-700">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="size-5 text-[#9a762b]" /> Operação comercial da plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-5">
                <div>
                  <p className="font-black text-slate-900">Cadastro público</p>
                  <p className="mt-1 text-sm text-slate-500">Exibe ou oculta o cadastro no login.</p>
                </div>
                <Toggle value={settingsDraft.public_signup_enabled} onChange={(value) => setSettingsDraft({ ...settingsDraft, public_signup_enabled: value })} />
              </label>
              <label>
                <span className="mb-2 block text-xs font-black uppercase text-slate-500">Modo de entrada</span>
                <Select value={settingsDraft.signup_mode} onChange={(event) => setSettingsDraft({ ...settingsDraft, signup_mode: event.target.value, public_signup_enabled: event.target.value === "PUBLIC" })}>
                  <option value="PUBLIC">Cadastro público</option>
                  <option value="INVITE_ONLY">Somente convite/admin</option>
                  <option value="CLOSED">Fechado</option>
                </Select>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Planos e preços do checkout integrado</p>
                  <p className="mt-1 text-sm text-slate-500">Altere os valores aqui. Os próximos checkouts passam a usar automaticamente os novos preços.</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">Dinâmico</span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <PlanPriceField
                  title="Equity One Pessoal"
                  value={formatMoneyInput(settingsDraft.personal_price_cents)}
                  enabled={settingsDraft.personal_checkout_enabled}
                  onEnabledChange={(value) => setSettingsDraft({ ...settingsDraft, personal_checkout_enabled: value })}
                  onValueChange={(value) => setSettingsDraft({ ...settingsDraft, personal_price_cents: parseMoneyInput(value) })}
                />
                <PlanPriceField
                  title="Equity One Negócios"
                  value={formatMoneyInput(settingsDraft.business_price_cents)}
                  enabled={settingsDraft.business_checkout_enabled}
                  onEnabledChange={(value) => setSettingsDraft({ ...settingsDraft, business_checkout_enabled: value })}
                  onValueChange={(value) => setSettingsDraft({ ...settingsDraft, business_price_cents: parseMoneyInput(value) })}
                />
                <PlanPriceField
                  title="Equity One Médicos"
                  value={formatMoneyInput(settingsDraft.medical_price_cents)}
                  enabled={settingsDraft.medical_checkout_enabled}
                  onEnabledChange={(value) => setSettingsDraft({ ...settingsDraft, medical_checkout_enabled: value })}
                  onValueChange={(value) => setSettingsDraft({ ...settingsDraft, medical_price_cents: parseMoneyInput(value) })}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={savingSettings}><Save className="size-4" />{savingSettings ? "Salvando..." : "Salvar configurações"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          customDate={customDate}
          onCustomDateChange={setCustomDate}
          onClose={() => setSelectedUser(null)}
          onAction={(action, extras) => userAction(selectedUser.id, action, extras)}
        />
      )}
    </main>
  );
}

function CompactUserRow({ user, onOpen }: { user: AdminUser; onOpen: () => void }) {
  const status = userStatus(user);
  return (
    <div className="grid gap-3 border-b border-slate-100 px-6 py-4 last:border-b-0 md:grid-cols-[minmax(220px,1.4fr)_150px_140px_150px_88px] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{user.full_name || "Usuário sem nome"}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{user.email || "—"}</p>
      </div>
      <div><PlanBadge plan={user.subscription?.plan} /></div>
      <div><UserStateBadge status={status} /></div>
      <div className="text-sm font-semibold text-slate-700">
        {user.system_role === "SUPER_ADMIN" ? "Permanente" : formatSubscriptionDate(user.subscription?.current_period_end ?? null)}
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={onOpen} className="gap-1.5">Ver <MoreHorizontal className="size-4" /></Button>
      </div>
    </div>
  );
}

function UserDetailDrawer({
  user,
  customDate,
  onCustomDateChange,
  onClose,
  onAction,
}: {
  user: AdminUser;
  customDate: string;
  onCustomDateChange: (value: string) => void;
  onClose: () => void;
  onAction: (action: string, extras?: Record<string, unknown>) => void;
}) {
  const active = user.system_role === "SUPER_ADMIN" || subscriptionIsActive(user.subscription);
  const blocked = user.status === "SUSPENDED" || Boolean(user.banned_until);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar detalhes" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#9a762b]">Cliente</p>
            <h2 className="mt-1 truncate text-2xl font-black text-slate-950">{user.full_name || "Usuário sem nome"}</h2>
            <p className="mt-1 truncate text-sm text-slate-500">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar"><X className="size-5" /></button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap gap-2">
            <PlanBadge plan={user.subscription?.plan} />
            <UserStateBadge status={userStatus(user)} />
            {user.system_role === "SUPER_ADMIN" && <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase text-white">Super Admin</span>}
          </div>

          <section className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <Info label="Assinatura" value={user.system_role === "SUPER_ADMIN" ? "Permanente" : subscriptionStatusLabel(user.subscription)} />
            <Info label="Vencimento" value={user.system_role === "SUPER_ADMIN" ? "Sem vencimento" : formatSubscriptionDate(user.subscription?.current_period_end ?? null)} />
            <Info label="Cadastro" value={formatDate(user.created_at)} />
            <Info label="Último login" value={formatDate(user.last_sign_in_at)} />
          </section>

          {user.latest_order && (
            <section className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Último pagamento</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="Status" value={user.latest_order.status || "—"} />
                <Info label="Valor" value={typeof user.latest_order.amount === "number" ? `R$ ${(user.latest_order.amount / 100).toFixed(2).replace(".", ",")}` : "—"} />
                <Info label="Data" value={formatDate(user.latest_order.created_at)} />
                <Info label="Pedido" value={user.latest_order.order_nsu || "—"} />
              </div>
            </section>
          )}

          {user.system_role !== "SUPER_ADMIN" && (
            <section className="space-y-4">
              <div>
                <p className="font-black text-slate-900">Assinatura e acesso</p>
                <p className="mt-1 text-sm text-slate-500">Ações administrativas aparecem somente nesta ficha.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => onAction("SUBSCRIPTION_EXTEND", { days: 30 })}>+30 dias</Button>
                <Button variant="outline" onClick={() => onAction("SUBSCRIPTION_EXTEND", { days: 90 })}>+90 dias</Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="date" value={customDate} onChange={(event) => onCustomDateChange(event.target.value)} />
                <Button variant="outline" disabled={!customDate} onClick={() => onAction("SUBSCRIPTION_SET_END", { period_end: customDate })}>Definir vencimento</Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {active ? (
                  <Button variant="outline" onClick={() => onAction("SUBSCRIPTION_SUSPEND")}>Suspender assinatura</Button>
                ) : (
                  <Button onClick={() => onAction("SUBSCRIPTION_ACTIVATE")}>Reativar por 30 dias</Button>
                )}
                {blocked ? (
                  <Button variant="outline" onClick={() => onAction("ACTIVATE")}>Desbloquear conta</Button>
                ) : (
                  <Button variant="outline" onClick={() => onAction("SUSPEND")}>Bloquear login</Button>
                )}
              </div>
            </section>
          )}

          <section className="border-t border-slate-100 pt-5">
            <Button variant="outline" onClick={() => onAction("DELETE")} className="w-full border-rose-200 text-rose-700 hover:bg-rose-50">
              <Trash2 className="size-4" /> Excluir usuário definitivamente
            </Button>
          </section>
        </div>
      </aside>
    </div>
  );
}

function PlanBadge({ plan }: { plan?: string | null }) {
  const cls = plan === "MEDICAL"
    ? "bg-sky-50 text-sky-700"
    : plan === "BUSINESS"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-[#fff6dd] text-[#8a6720]";
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${cls}`}>{planLabel(plan)}</span>;
}

function UserStateBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Ativo", cls: "bg-emerald-50 text-emerald-700" },
    EXPIRING: { label: "Vencendo", cls: "bg-amber-50 text-amber-700" },
    EXPIRED: { label: "Expirado", cls: "bg-rose-50 text-rose-700" },
    SUSPENDED: { label: "Suspenso", cls: "bg-slate-100 text-slate-700" },
    BLOCKED: { label: "Bloqueado", cls: "bg-rose-100 text-rose-800" },
    PERMANENT: { label: "Permanente", cls: "bg-violet-50 text-violet-700" },
  };
  const item = map[status] ?? map.EXPIRED;
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${item.cls}`}>{item.label}</span>;
}

function PlanPriceField({
  title,
  value,
  enabled,
  onEnabledChange,
  onValueChange,
}: {
  title: string;
  value: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">Preço mensal cobrado no checkout.</p>
        </div>
        <Toggle value={enabled} onChange={onEnabledChange} />
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Valor mensal</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">R$</span>
          <Input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="0,00"
            className="pl-12 font-bold"
            inputMode="decimal"
          />
        </div>
      </label>
      <p className="mt-3 text-xs text-slate-500">{enabled ? "Checkout ativo para novas adesões." : "Novas adesões pausadas para este plano."}</p>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-emerald-500" : "bg-slate-300"}`}>
      <span className={`absolute top-1 size-5 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} />
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
