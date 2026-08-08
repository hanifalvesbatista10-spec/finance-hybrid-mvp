"use client";

import {
  CalendarPlus,
  ExternalLink,
  Link2,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/finance/StatCard";
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
  medical_product?: { status: string } | null;
};

type Settings = {
  public_signup_enabled: boolean;
  signup_mode: string;
  personal_checkout_url: string;
  business_checkout_url: string;
  personal_checkout_enabled: boolean;
  business_checkout_enabled: boolean;
};

const initialSettings: Settings = {
  public_signup_enabled: true,
  signup_mode: "PUBLIC",
  personal_checkout_url: "",
  business_checkout_url: "",
  personal_checkout_enabled: true,
  business_checkout_enabled: true,
};

export default function AdminPage() {
  const router = useRouter();
  const { profile, session, loading } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settingsDraft, setSettingsDraft] =
    useState<Settings>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [customDates, setCustomDates] =
    useState<Record<string, string>>({});
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "PERSONAL",
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

    if (!usersResponse.ok) {
      setError(usersJson.error);
    } else {
      setUsers(usersJson.users);
    }

    if (settingsResponse.ok) {
      setSettingsDraft(settingsJson);
    }
  }, [headers, session]);

  useEffect(() => {
    if (!loading && profile?.system_role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }

    void load();
  }, [load, loading, profile?.system_role, router]);

  const filtered = useMemo(
    () =>
      users.filter((user) =>
        `${user.full_name ?? ""} ${user.email ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, users],
  );

  const activeSubscriptions = users.filter((user) =>
    user.system_role === "SUPER_ADMIN"
      ? true
      : subscriptionIsActive(user.subscription),
  ).length;

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...form,
        access_days: Number(form.access_days),
      }),
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
      role: "PERSONAL",
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
      !window.confirm(
        "Excluir definitivamente este usuário e seus dados?",
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    const response = await fetch(
      action === "DELETE"
        ? `/api/admin/users?id=${id}`
        : "/api/admin/users",
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

    if (!response.ok) {
      setError(json.error);
    } else {
      setSettingsDraft(json);
      setMessage("Configurações comerciais atualizadas.");
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
            <p className="text-sm font-black text-violet-700">
              SUPER ADMIN
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
              Controle da plataforma
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Usuários, assinaturas, acessos e regras comerciais.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              Voltar ao sistema
            </Button>
            <Button onClick={() => setOpenCreate((value) => !value)}>
              <UserPlus className="size-4" />
              Novo usuário
            </Button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Usuários cadastrados"
            value={String(users.length)}
            helper="Total na plataforma"
            icon={Users}
          />
          <StatCard
            title="Assinaturas ativas"
            value={String(activeSubscriptions)}
            helper="Com período válido"
            icon={UserCheck}
            tone="emerald"
          />
          <StatCard
            title="Acessos vencidos"
            value={String(
              users.filter(
                (user) =>
                  user.system_role !== "SUPER_ADMIN" &&
                  !subscriptionIsActive(user.subscription),
              ).length,
            )}
            helper="Precisam de renovação"
            icon={CalendarPlus}
            tone="amber"
          />
          <StatCard
            title="Contas suspensas"
            value={String(
              users.filter(
                (user) =>
                  user.status === "SUSPENDED" ||
                  Boolean(user.banned_until),
              ).length,
            )}
            helper="Bloqueio administrativo"
            icon={UserX}
            tone="rose"
          />
        </section>

        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-5 text-violet-600" />
              Controle comercial
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-5">
                <div>
                  <p className="font-black text-slate-900">
                    Cadastro público
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Exibe ou oculta o cadastro no login.
                  </p>
                </div>

                <Toggle
                  value={settingsDraft.public_signup_enabled}
                  onChange={(value) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      public_signup_enabled: value,
                    })
                  }
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-black uppercase text-slate-500">
                  Modo de entrada
                </span>
                <Select
                  value={settingsDraft.signup_mode}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      signup_mode: event.target.value,
                      public_signup_enabled:
                        event.target.value === "PUBLIC",
                    })
                  }
                >
                  <option value="PUBLIC">Cadastro público</option>
                  <option value="INVITE_ONLY">
                    Somente convite/admin
                  </option>
                  <option value="CLOSED">Fechado</option>
                </Select>
              </label>
            </div>

            <CheckoutSetting
              title="Equity One Pessoal"
              value={settingsDraft.personal_checkout_url || ""}
              enabled={settingsDraft.personal_checkout_enabled}
              onValueChange={(value) =>
                setSettingsDraft({
                  ...settingsDraft,
                  personal_checkout_url: value,
                })
              }
              onEnabledChange={(value) =>
                setSettingsDraft({
                  ...settingsDraft,
                  personal_checkout_enabled: value,
                })
              }
            />

            <CheckoutSetting
              title="Equity One Negócios"
              value={settingsDraft.business_checkout_url || ""}
              enabled={settingsDraft.business_checkout_enabled}
              onValueChange={(value) =>
                setSettingsDraft({
                  ...settingsDraft,
                  business_checkout_url: value,
                })
              }
              onEnabledChange={(value) =>
                setSettingsDraft({
                  ...settingsDraft,
                  business_checkout_enabled: value,
                })
              }
            />

            <div className="flex justify-end">
              <Button
                onClick={saveSettings}
                disabled={savingSettings}
              >
                <Save className="size-4" />
                {savingSettings
                  ? "Salvando..."
                  : "Salvar configurações"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {openCreate && (
          <Card className="border-violet-100 bg-violet-50/50">
            <CardHeader>
              <CardTitle>Criar usuário com acesso</CardTitle>
            </CardHeader>

            <CardContent>
              <form
                onSubmit={createUser}
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
              >
                <Input
                  required
                  placeholder="Nome completo"
                  value={form.full_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      full_name: event.target.value,
                    })
                  }
                />
                <Input
                  required
                  type="email"
                  placeholder="E-mail"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                />
                <Input
                  required
                  minLength={6}
                  placeholder="Senha inicial"
                  value={form.password}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      password: event.target.value,
                    })
                  }
                />
                <Select
                  value={form.role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value,
                    })
                  }
                >
                  <option value="PERSONAL">Pessoal</option>
                  <option value="INSTITUTIONAL">Empresa</option>
                </Select>
                <Select
                  value={form.system_role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      system_role: event.target.value,
                    })
                  }
                >
                  <option value="USER">Cliente</option>
                  <option value="SUPER_ADMIN">
                    Super Admin
                  </option>
                </Select>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={form.access_days}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        access_days: event.target.value,
                      })
                    }
                    title="Dias de acesso"
                  />
                  <Button type="submit">Criar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
          <CardHeader className="gap-4 border-b border-slate-100 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Usuários e assinaturas</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                Libere 30 ou 90 dias, defina uma data ou suspenda.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <Search className="size-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar usuário..."
                className="h-11 w-64 max-w-full bg-transparent text-sm outline-none"
              />
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid gap-5 xl:grid-cols-2">
              {filtered.map((user) => (
                <UserSubscriptionCard
                  key={user.id}
                  user={user}
                  customDate={customDates[user.id] || ""}
                  onCustomDateChange={(value) =>
                    setCustomDates({
                      ...customDates,
                      [user.id]: value,
                    })
                  }
                  onAction={(action, extras) =>
                    userAction(user.id, action, extras)
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function UserSubscriptionCard({
  user,
  customDate,
  onCustomDateChange,
  onAction,
}: {
  user: AdminUser;
  customDate: string;
  onCustomDateChange: (value: string) => void;
  onAction: (
    action: string,
    extras?: Record<string, unknown>,
  ) => void;
}) {
  const active =
    user.system_role === "SUPER_ADMIN" ||
    subscriptionIsActive(user.subscription);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-black text-slate-900">
              {user.full_name || "Usuário sem nome"}
            </h3>
            <StatusBadge active={active}>
              {user.system_role === "SUPER_ADMIN"
                ? "Acesso permanente"
                : subscriptionStatusLabel(user.subscription)}
            </StatusBadge>
          </div>

          <p className="mt-1 truncate text-sm text-slate-500">
            {user.email}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
              {user.role === "INSTITUTIONAL"
                ? "Business"
                : "Personal"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              {user.system_role || "USER"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAction("DELETE")}
          className="self-start rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
          title="Excluir usuário"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
        <Info
          label="Assinatura"
          value={
            user.system_role === "SUPER_ADMIN"
              ? "Permanente"
              : subscriptionStatusLabel(user.subscription)
          }
        />
        <Info
          label="Vencimento"
          value={
            user.system_role === "SUPER_ADMIN"
              ? "Sem vencimento"
              : formatSubscriptionDate(
                  user.subscription?.current_period_end ?? null,
                )
          }
        />
      </div>

      {user.system_role !== "SUPER_ADMIN" && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() =>
                onAction("SUBSCRIPTION_EXTEND", { days: 30 })
              }
            >
              +30 dias
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                onAction("SUBSCRIPTION_EXTEND", { days: 90 })
              }
            >
              +90 dias
            </Button>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              type="date"
              value={customDate}
              onChange={(event) =>
                onCustomDateChange(event.target.value)
              }
            />
            <Button
              variant="outline"
              disabled={!customDate}
              onClick={() =>
                onAction("SUBSCRIPTION_SET_END", {
                  period_end: customDate,
                })
              }
            >
              Definir vencimento
            </Button>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Produto especializado</p><p className="mt-1 text-sm font-black">Equity One Médicos</p></div>
              {user.medical_product?.status === "ACTIVE" ? (
                <Button variant="outline" onClick={() => onAction("PRODUCT_REVOKE_MEDICAL")}>Remover acesso</Button>
              ) : (
                <Button variant="outline" onClick={() => onAction("PRODUCT_GRANT_MEDICAL")}>Liberar acesso</Button>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {active ? (
              <Button
                variant="outline"
                onClick={() =>
                  onAction("SUBSCRIPTION_SUSPEND")
                }
              >
                Suspender assinatura
              </Button>
            ) : (
              <Button
                onClick={() =>
                  onAction("SUBSCRIPTION_ACTIVATE")
                }
              >
                Reativar por 30 dias
              </Button>
            )}

            {user.status === "SUSPENDED" ||
            Boolean(user.banned_until) ? (
              <Button
                variant="outline"
                onClick={() => onAction("ACTIVATE")}
              >
                Desbloquear conta
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => onAction("SUSPEND")}
              >
                Bloquear login
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function CheckoutSetting({
  title,
  value,
  enabled,
  onValueChange,
  onEnabledChange,
}: {
  title: string;
  value: string;
  enabled: boolean;
  onValueChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-black text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">
            Link utilizado para novas vendas e renovações.
          </p>
        </div>
        <Toggle value={enabled} onChange={onEnabledChange} />
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <Input
          type="url"
          value={value}
          onChange={(event) =>
            onValueChange(event.target.value)
          }
          placeholder="https://..."
        />
        <Button
          variant="outline"
          disabled={!value}
          onClick={() =>
            window.open(
              value,
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          <ExternalLink className="size-4" />
          Testar
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        value ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-white transition ${
          value ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

function StatusBadge({
  active,
  children,
}: {
  active: boolean;
  children: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {children}
    </span>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}
