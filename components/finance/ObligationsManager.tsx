"use client";

import {
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/finance/EmptyState";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currency, dateBR } from "@/lib/finance";
import {
  AVAILABLE_REMINDER_DAYS,
  daysUntil,
  dueLabel,
  localToday,
  type Obligation,
  type ObligationKind,
  type ReminderPreferences,
} from "@/lib/obligations";
import { cn } from "@/lib/utils";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const initialForm = {
  description: "",
  amount: "",
  kind: "PAYABLE" as ObligationKind,
  category: "Outros",
  cost_center: "",
  due_date: isoDate(localToday()),
  notes: "",
};

export function ObligationsManager({
  institutional,
}: {
  institutional: boolean;
}) {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<Obligation[]>([]);
  const [preferences, setPreferences] =
    useState<ReminderPreferences | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formReminderDays, setFormReminderDays] =
    useState<number[]>([0, 1, 3]);
  const [openForm, setOpenForm] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [filter, setFilter] =
    useState<"PENDING" | "PAID" | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const [itemsResult, preferencesResult] = await Promise.all([
      supabase
        .from("obligations")
        .select("*")
        .order("due_date", { ascending: true }),
      supabase
        .from("reminder_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (itemsResult.error) {
      setError(itemsResult.error.message);
    } else {
      setItems((itemsResult.data ?? []) as Obligation[]);
    }

    if (preferencesResult.error) {
      setError(preferencesResult.error.message);
    } else {
      const loaded =
        (preferencesResult.data as ReminderPreferences | null) ?? {
          user_id: user.id,
          default_remind_days: [0, 1, 3],
          show_overdue: true,
        };

      setPreferences(loaded);
      setFormReminderDays(loaded.default_remind_days);
    }

    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const stats = useMemo(() => {
    const pending = items.filter((item) => item.status === "PENDING");
    const overdue = pending.filter((item) => daysUntil(item.due_date) < 0);
    const dueToday = pending.filter((item) => daysUntil(item.due_date) === 0);

    return {
      pendingPayable: pending
        .filter((item) => item.kind === "PAYABLE")
        .reduce((sum, item) => sum + Number(item.amount), 0),
      pendingReceivable: pending
        .filter((item) => item.kind === "RECEIVABLE")
        .reduce((sum, item) => sum + Number(item.amount), 0),
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
    };
  }, [items]);

  const toggleReminderDay = (
    days: number[],
    value: number,
    setter: (next: number[]) => void,
  ) => {
    setter(
      days.includes(value)
        ? days.filter((day) => day !== value)
        : [...days, value].sort((a, b) => a - b),
    );
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage("");
    setError("");

    const amount = Number(form.amount.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("obligations").insert({
      user_id: user.id,
      description: form.description.trim(),
      amount,
      kind: form.kind,
      category: form.category.trim() || "Outros",
      cost_center: institutional
        ? form.cost_center.trim() || null
        : null,
      due_date: form.due_date,
      remind_days: formReminderDays,
      notes: form.notes.trim() || null,
      status: "PENDING",
    });

    if (error) {
      setError(error.message);
    } else {
      setForm(initialForm);
      setFormReminderDays(
        preferences?.default_remind_days ?? [0, 1, 3],
      );
      setOpenForm(false);
      setMessage(
        form.kind === "PAYABLE"
          ? "Conta a pagar cadastrada."
          : "Conta a receber cadastrada.",
      );
      await load();
    }

    setSaving(false);
  };

  const complete = async (item: Obligation) => {
    const label =
      item.kind === "PAYABLE"
        ? "Marcar esta conta como paga?"
        : "Marcar esta conta como recebida?";

    if (!window.confirm(label)) return;

    setError("");
    setMessage("");

    const { error } = await supabase.rpc("complete_obligation", {
      p_obligation_id: item.id,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        item.kind === "PAYABLE"
          ? "Conta paga e despesa registrada nos lançamentos."
          : "Valor recebido e receita registrada nos lançamentos.",
      );
      await load();
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir esta conta?")) return;

    const { error } = await supabase
      .from("obligations")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      setItems((current) =>
        current.filter((item) => item.id !== id),
      );
    }
  };

  const savePreferences = async () => {
    if (!user || !preferences) return;

    setSaving(true);
    setError("");
    setMessage("");

    const { data, error } = await supabase
      .from("reminder_preferences")
      .upsert({
        user_id: user.id,
        default_remind_days: preferences.default_remind_days,
        show_overdue: preferences.show_overdue,
      })
      .select("*")
      .single();

    if (error) {
      setError(error.message);
    } else {
      setPreferences(data as ReminderPreferences);
      setFormReminderDays(
        (data as ReminderPreferences).default_remind_days,
      );
      setOpenSettings(false);
      setMessage("Preferências de alerta atualizadas.");
    }

    setSaving(false);
  };

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[.16em] text-indigo-700">
            CONTAS E ALERTAS
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Vencimentos financeiros
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Cadastre contas a pagar e a receber e escolha quando deseja
            ser avisado.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setOpenSettings((value) => !value)}
          >
            <Settings2 className="size-4" />
            Preferências
          </Button>

          <Button onClick={() => setOpenForm((value) => !value)}>
            {openForm ? (
              <X className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {openForm ? "Fechar" : "Nova conta"}
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="A pagar"
          value={currency.format(stats.pendingPayable)}
          helper="Total pendente"
          tone="rose"
          icon={CircleDollarSign}
        />
        <Metric
          title="A receber"
          value={currency.format(stats.pendingReceivable)}
          helper="Total pendente"
          tone="emerald"
          icon={CircleDollarSign}
        />
        <Metric
          title="Vence hoje"
          value={String(stats.dueTodayCount)}
          helper="Exige atenção hoje"
          tone="amber"
          icon={Clock3}
        />
        <Metric
          title="Vencidas"
          value={String(stats.overdueCount)}
          helper="Pendências em atraso"
          tone="rose"
          icon={AlertTriangle}
        />
      </section>

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

      {openSettings && preferences && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-5 text-indigo-700" />
              Preferências de alerta
            </CardTitle>
            <p className="text-sm text-slate-500">
              Esses prazos serão usados automaticamente em novas contas.
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            <ReminderSelector
              values={preferences.default_remind_days}
              onToggle={(day) =>
                toggleReminderDay(
                  preferences.default_remind_days,
                  day,
                  (next) =>
                    setPreferences({
                      ...preferences,
                      default_remind_days: next,
                    }),
                )
              }
            />

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-black text-slate-900">
                  Alertar contas vencidas
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Mantém o alerta ativo até a baixa da conta.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    show_overdue: !preferences.show_overdue,
                  })
                }
                className={cn(
                  "relative h-7 w-12 rounded-full transition",
                  preferences.show_overdue
                    ? "bg-emerald-500"
                    : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 size-5 rounded-full bg-white transition",
                    preferences.show_overdue
                      ? "left-6"
                      : "left-1",
                  )}
                />
              </button>
            </label>

            <div className="flex justify-end">
              <Button
                onClick={savePreferences}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar preferências"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {openForm && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardHeader>
            <CardTitle>Nova conta</CardTitle>
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
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="Ex.: Energia, aluguel ou cliente X"
                />
              </Field>

              <Field label="Valor">
                <Input
                  required
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      amount: event.target.value,
                    })
                  }
                  placeholder="0,00"
                />
              </Field>

              <Field label="Tipo">
                <Select
                  value={form.kind}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      kind: event.target.value as ObligationKind,
                    })
                  }
                >
                  <option value="PAYABLE">Conta a pagar</option>
                  <option value="RECEIVABLE">Conta a receber</option>
                </Select>
              </Field>

              <Field label="Categoria">
                <Input
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value,
                    })
                  }
                />
              </Field>

              {institutional && (
                <Field label="Centro de custo">
                  <Input
                    value={form.cost_center}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        cost_center: event.target.value,
                      })
                    }
                    placeholder="Ex.: Administrativo"
                  />
                </Field>
              )}

              <Field label="Vencimento">
                <Input
                  type="date"
                  required
                  value={form.due_date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      due_date: event.target.value,
                    })
                  }
                />
              </Field>

              <div className="md:col-span-2 xl:col-span-4">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Quando avisar
                </span>

                <ReminderSelector
                  values={formReminderDays}
                  onToggle={(day) =>
                    toggleReminderDay(
                      formReminderDays,
                      day,
                      setFormReminderDays,
                    )
                  }
                />
              </div>

              <Field label="Observação" wide>
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Código, contrato, forma de pagamento ou outra informação."
                />
              </Field>

              <div className="flex items-end">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Salvar conta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
        <CardHeader className="gap-4 border-b border-slate-100 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Contas cadastradas</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Ao dar baixa, o valor é lançado automaticamente como
              receita ou despesa.
            </p>
          </div>

          <div className="flex rounded-xl bg-slate-100 p-1">
            {[
              ["PENDING", "Pendentes"],
              ["PAID", "Concluídas"],
              ["ALL", "Todas"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as typeof filter)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-black transition",
                  filter === value
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Carregando contas...
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhuma conta nesta visualização"
              description="Cadastre contas a pagar ou a receber para receber alertas de vencimento."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => {
                const overdue =
                  item.status === "PENDING" &&
                  daysUntil(item.due_date) < 0;
                const dueToday =
                  item.status === "PENDING" &&
                  daysUntil(item.due_date) === 0;

                return (
                  <article
                    key={item.id}
                    className={cn(
                      "rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg",
                      overdue
                        ? "border-rose-300"
                        : dueToday
                          ? "border-amber-300"
                          : "border-slate-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className={cn(
                          "grid size-11 place-items-center rounded-xl",
                          item.kind === "PAYABLE"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {institutional ? (
                          <Building2 className="size-5" />
                        ) : (
                          <CircleDollarSign className="size-5" />
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase",
                          item.kind === "PAYABLE"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {item.kind === "PAYABLE"
                          ? "A pagar"
                          : "A receber"}
                      </span>

                      {item.status === "PAID" && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
                          Concluída
                        </span>
                      )}

                      {overdue && (
                        <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                          Vencida
                        </span>
                      )}

                      {dueToday && (
                        <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                          Vence hoje
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 font-black text-slate-900">
                      {item.description}
                    </h3>

                    <p
                      className={cn(
                        "mt-2 text-xl font-black",
                        item.kind === "PAYABLE"
                          ? "text-rose-700"
                          : "text-emerald-700",
                      )}
                    >
                      {currency.format(Number(item.amount))}
                    </p>

                    <div className="mt-4 space-y-1 text-xs text-slate-500">
                      <p>
                        Vencimento:{" "}
                        {dateBR.format(
                          new Date(`${item.due_date}T12:00:00`),
                        )}
                      </p>
                      <p>{dueLabel(item.due_date)}</p>
                      <p>
                        Alertas:{" "}
                        {item.remind_days.length
                          ? item.remind_days
                              .map((day) =>
                                day === 0
                                  ? "no dia"
                                  : `${day}d antes`,
                              )
                              .join(", ")
                          : "sem aviso"}
                      </p>
                      {institutional && (
                        <p>
                          Centro:{" "}
                          {item.cost_center || "Não informado"}
                        </p>
                      )}
                    </div>

                    {item.status === "PENDING" && (
                      <Button
                        className="mt-5 w-full"
                        onClick={() => complete(item)}
                      >
                        <CheckCircle2 className="size-4" />
                        {item.kind === "PAYABLE"
                          ? "Marcar como paga"
                          : "Marcar como recebida"}
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReminderSelector({
  values,
  onToggle,
}: {
  values: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {AVAILABLE_REMINDER_DAYS.map((day) => {
        const selected = values.includes(day);

        return (
          <button
            key={day}
            type="button"
            onClick={() => onToggle(day)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition",
              selected
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300",
            )}
          >
            {selected && <Check className="size-3.5" />}
            {day === 0
              ? "No dia"
              : day === 1
                ? "1 dia antes"
                : `${day} dias antes`}
          </button>
        );
      })}
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

function Metric({
  title,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  tone: "rose" | "emerald" | "amber";
  icon: typeof CircleDollarSign;
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {title}
            </p>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {value}
            </p>
          </div>

          <span
            className={cn(
              "grid size-11 place-items-center rounded-xl",
              tones[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
        </div>

        <p className="mt-4 text-xs text-slate-400">{helper}</p>
      </CardContent>
    </Card>
  );
}
