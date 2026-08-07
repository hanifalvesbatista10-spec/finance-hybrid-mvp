"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  FileText,
  Landmark,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const recursos = [
  ["Controle financeiro real", "Receitas, despesas, cartões, metas e recorrências.", WalletCards],
  ["Calendário financeiro", "Valores positivos e negativos organizados por dia.", CalendarDays],
  ["Relatórios em um clique", "Documentos profissionais prontos para salvar em PDF.", FileText],
  ["Dados protegidos", "Cada usuário acessa apenas as próprias informações.", ShieldCheck],
] as const;

type CheckoutSettings = {
  personal_checkout_url: string | null;
  business_checkout_url: string | null;
  personal_checkout_enabled: boolean;
  business_checkout_enabled: boolean;
};

const fallbackSettings: CheckoutSettings = {
  personal_checkout_url: "https://invoice.infinitepay.io/plans/aphhardcore/ZuBAmrcZfy",
  business_checkout_url: "https://invoice.infinitepay.io/plans/aphhardcore/JhBKukTIXw",
  personal_checkout_enabled: true,
  business_checkout_enabled: true,
};

export default function HomePage() {
  const [checkoutSettings, setCheckoutSettings] =
    useState<CheckoutSettings>(fallbackSettings);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          setCheckoutSettings({
            personal_checkout_url:
              data.personal_checkout_url || fallbackSettings.personal_checkout_url,
            business_checkout_url:
              data.business_checkout_url || fallbackSettings.business_checkout_url,
            personal_checkout_enabled:
              data.personal_checkout_enabled !== false,
            business_checkout_enabled:
              data.business_checkout_enabled !== false,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Landmark className="size-5" />
            </span>
            <div>
              <strong className="block text-sm tracking-wide">FINANCE HYBRID</strong>
              <span className="text-xs text-slate-500">Gestão pessoal e empresarial</span>
            </div>
          </Link>
          <nav className="hidden gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
            <a href="#como-funciona">Como funciona</a>
          </nav>
          <Link href="/login"><Button variant="outline">Entrar</Button></Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#08101f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.28),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,.16),transparent_35%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 md:px-8 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-indigo-200">
              <Sparkles className="size-4" /> Sua vida financeira em outro nível
            </span>
            <h1 className="mt-7 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Controle, clareza e decisão para suas finanças.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Organize finanças pessoais ou empresariais, acompanhe cada mês e gere relatórios profissionais.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#planos"><Button className="h-12 bg-indigo-500 px-6 hover:bg-indigo-400">Começar minha gestão <ArrowRight className="size-4" /></Button></a>
              <Link href="/login"><Button variant="outline" className="h-12 border-white/20 bg-white/5 px-6 text-white hover:bg-white/10">Já sou cliente</Button></Link>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              {["Sem valores fictícios", "Dados protegidos", "Acesso pelo celular"].map((item) => (
                <div key={item} className="flex items-center gap-2"><BadgeCheck className="size-4 text-emerald-400" />{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[.06] p-4 shadow-2xl">
            <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Visão do mês</p><h2 className="mt-1 text-xl font-black">Painel financeiro</h2></div>
                <span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700"><BarChart3 className="size-5" /></span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["Receitas", "R$ 18.400", "text-emerald-700"],
                  ["Despesas", "R$ 11.250", "text-rose-700"],
                  ["Resultado", "R$ 7.150", "text-indigo-700"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className={`mt-2 text-base font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <div className="mb-4 flex justify-between"><p className="text-sm font-black">Calendário financeiro</p><span className="text-xs text-slate-400">Agosto</span></div>
                <div className="grid grid-cols-7 gap-2 text-center text-[11px]">
                  {Array.from({ length: 28 }, (_, i) => (
                    <div key={i} className={`rounded-lg border p-2 ${[2,7,14,21].includes(i) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : [4,9,12,18,25].includes(i) ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-100 bg-slate-50 text-slate-400"}`}>{i+1}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="text-center"><p className="text-sm font-black uppercase tracking-[.18em] text-indigo-600">Recursos</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Muito mais do que anotar entradas e saídas</h2></div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {recursos.map(([title, description, Icon]) => (
            <article key={title} className="rounded-3xl border border-slate-200 p-6 shadow-[0_14px_40px_rgba(15,23,42,.06)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700"><Icon className="size-5" /></span>
              <h3 className="mt-5 text-lg font-black">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planos" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center"><p className="text-sm font-black uppercase tracking-[.18em] text-indigo-600">Escolha sua experiência</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Um plano para cada realidade</h2><p className="mt-4 text-slate-500">Após a adesão, você será direcionado para criar sua conta.</p></div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
            <Plan title="Finance Hybrid Personal" icon={UserRound} href="/login?mode=register&plan=PERSONAL" enabled={checkoutSettings.personal_checkout_enabled} buttonLabel="Começar minha gestão pessoal" items={["Visão mensal completa","Receitas e despesas fixas","Metas e cartões","Relatórios e calendário"]} />
            <Plan title="Finance Hybrid Business" icon={Building2} href="/login?mode=register&plan=INSTITUTIONAL" enabled={checkoutSettings.business_checkout_enabled} buttonLabel="Começar minha gestão empresarial" items={["Fluxo de caixa","Centros de custo","Permissões internas","Relatórios empresariais"]} dark />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["1","Escolha","Selecione o plano pessoal ou empresarial."],
            ["2","Adesão","Confirme seus dados e prossiga para a compra."],
            ["3","Acesso","Crie sua conta e entre no dashboard."],
          ].map(([n,t,d]) => (
            <article key={n} className="rounded-3xl border border-slate-200 p-6">
              <span className="grid size-10 place-items-center rounded-full bg-indigo-600 text-sm font-black text-white">{n}</span>
              <h3 className="mt-5 font-black">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{d}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Plan({
  title,
  icon: Icon,
  href,
  items,
  buttonLabel,
  enabled,
  dark = false,
}: {
  title: string;
  icon: typeof UserRound;
  href: string;
  items: string[];
  buttonLabel: string;
  enabled: boolean;
  dark?: boolean;
}) {
  return (
    <article className={`rounded-[2rem] border p-8 ${dark ? "border-indigo-600 bg-[#0b1020] text-white" : "border-slate-200 bg-white"}`}>
      <span className={`grid size-12 place-items-center rounded-2xl ${dark ? "bg-white/10 text-indigo-300" : "bg-indigo-50 text-indigo-700"}`}><Icon className="size-6" /></span>
      <h3 className="mt-6 text-2xl font-black">{title}</h3>
      <div className="mt-7 space-y-3">
        {items.map((item) => <div key={item} className="flex items-center gap-3 text-sm"><Check className="size-4 text-emerald-500" />{item}</div>)}
      </div>

      {enabled && href !== "#" ? (
        <Link href={href} className="mt-8 block">
          <Button className={`h-14 w-full rounded-2xl text-base shadow-lg transition hover:-translate-y-0.5 ${dark ? "bg-indigo-500 shadow-indigo-950/40 hover:bg-indigo-400" : "bg-slate-950 shadow-slate-300 hover:bg-slate-800"}`}>
            {buttonLabel}
            <ArrowRight className="size-5" />
          </Button>
        </Link>
      ) : (
        <div className="mt-8">
          <Button disabled className="h-14 w-full rounded-2xl text-base">
            Inscrições temporariamente pausadas
          </Button>
        </div>
      )}

      <div className={`mt-3 flex items-center justify-center gap-2 text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
        <ShieldCheck className="size-4 text-emerald-500" />
        Pagamento seguro pela InfinitePay
      </div>
    </article>
  );
}
