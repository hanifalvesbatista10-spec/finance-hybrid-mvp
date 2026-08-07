"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Landmark,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import {
  formatSubscriptionDate,
  subscriptionIsActive,
  subscriptionStatusLabel,
  type Subscription,
} from "@/lib/subscriptions";

type CheckoutSettings = {
  personal_checkout_url: string | null;
  business_checkout_url: string | null;
  personal_checkout_enabled: boolean;
  business_checkout_enabled: boolean;
};

export default function AssinaturaPage() {
  const { supabase, user, profile, session, loading, signOut } = useAuth();
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);
  const [settings, setSettings] =
    useState<CheckoutSettings | null>(null);
  const [checking, setChecking] = useState(true);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }

    setChecking(true);

    const [subscriptionResult, settingsResponse] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      fetch("/api/admin/settings", { cache: "no-store" }),
    ]);

    if (!subscriptionResult.error) {
      setSubscription(
        (subscriptionResult.data as Subscription | null) ?? null,
      );
    }

    if (settingsResponse.ok) {
      setSettings(await settingsResponse.json());
    }

    setChecking(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);


  async function startIntegratedCheckout() {
    if (!session?.access_token) {
      setCheckoutError(
        "Sua sessão expirou. Entre novamente para continuar.",
      );
      return;
    }

    setCreatingCheckout(true);
    setCheckoutError("");

    try {
      const response = await fetch(
        "/api/payments/infinitepay/checkout",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );

      const raw = await response.text();
      let json: { url?: string; error?: string } = {};

      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch {
          json = {};
        }
      }

      if (!response.ok || !json.url) {
        setCheckoutError(
          json.error ||
            `Não foi possível gerar o checkout. Código ${response.status}.`,
        );
        return;
      }

      window.location.assign(json.url);
    } catch (error) {
      console.error("Falha ao iniciar checkout:", error);
      setCheckoutError(
        "Não foi possível conectar ao checkout. Tente novamente em alguns instantes.",
      );
    } finally {
      setCreatingCheckout(false);
    }
  }

  const active = subscriptionIsActive(subscription);

  const checkout = useMemo(() => {
    const business =
      subscription?.plan === "BUSINESS" ||
      profile?.role === "INSTITUTIONAL";

    return {
      business,
      enabled: business
        ? settings?.business_checkout_enabled
        : settings?.personal_checkout_enabled,
      url: business
        ? settings?.business_checkout_url
        : settings?.personal_checkout_url,
    };
  }, [profile?.role, settings, subscription?.plan]);

  if (loading || checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Verificando assinatura...
      </div>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Entre para consultar sua assinatura</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Ir para o login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white">
              <Landmark className="size-5" />
            </span>
            <strong className="text-sm tracking-wide">
              FINANCE HYBRID
            </strong>
          </Link>

          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              window.location.href = "/login";
            }}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div className="text-center">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${
              active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {active ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertTriangle className="size-4" />
            )}
            {subscriptionStatusLabel(subscription)}
          </span>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            {active
              ? "Sua assinatura está ativa"
              : "Seu acesso precisa ser renovado"}
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Seus dados continuam preservados. Assim que a assinatura for
            liberada ou renovada, o acesso ao dashboard volta normalmente.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.8fr]">
          <Card className="border-0 shadow-[0_18px_50px_rgba(15,23,42,.08)]">
            <CardHeader>
              <CardTitle>Detalhes da assinatura</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <Detail
                icon={
                  checkout.business ? Building2 : UserRound
                }
                label="Plano"
                value={
                  checkout.business
                    ? "Finance Hybrid Business"
                    : "Finance Hybrid Personal"
                }
              />

              <Detail
                icon={ShieldCheck}
                label="Status"
                value={subscriptionStatusLabel(subscription)}
              />

              <Detail
                icon={CalendarClock}
                label="Acesso válido até"
                value={
                  subscription?.access_mode === "LIFETIME"
                    ? "Acesso permanente"
                    : formatSubscriptionDate(
                        subscription?.current_period_end ?? null,
                      )
                }
              />

              <Detail
                icon={CreditCard}
                label="Forma de controle"
                value={
                  subscription?.access_mode === "PROVIDER"
                    ? "Renovação automática"
                    : subscription?.access_mode === "LIFETIME"
                      ? "Acesso administrativo"
                      : "Liberação manual"
                }
              />
            </CardContent>
          </Card>

          <Card className="border-0 bg-[#0b1020] text-white shadow-2xl shadow-indigo-200">
            <CardHeader>
              <CardTitle className="text-white">
                {active ? "Continuar utilizando" : "Renovar acesso"}
              </CardTitle>
              <p className="text-sm leading-6 text-slate-300">
                {active
                  ? "Você pode voltar ao dashboard."
                  : "Realize o pagamento e aguarde a confirmação da liberação."}
              </p>
            </CardHeader>

            <CardContent>
              {active ? (
                <Link href="/dashboard">
                  <Button className="h-12 w-full bg-indigo-500 hover:bg-indigo-400">
                    Acessar dashboard
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              ) : checkout.enabled ? (
                <Button
                  className="h-12 w-full bg-indigo-500 hover:bg-indigo-400"
                  onClick={() => void startIntegratedCheckout()}
                  disabled={creatingCheckout}
                >
                  {creatingCheckout
                    ? "Gerando checkout..."
                    : "Renovar assinatura"}
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button disabled className="h-12 w-full">
                  Renovações temporariamente pausadas
                </Button>
              )}

              {checkoutError && (
                <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">
                  {checkoutError}
                </p>
              )}

              {!active && (
                <Button
                  variant="outline"
                  className="mt-3 h-12 w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => void load()}
                >
                  <RefreshCw className="size-4" />
                  Já paguei, verificar novamente
                </Button>
              )}

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-4">
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                <p className="text-xs leading-5 text-slate-300">
                  A assinatura vencida bloqueia apenas o uso do sistema.
                  Seus registros financeiros não são apagados.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-sm font-black text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}
