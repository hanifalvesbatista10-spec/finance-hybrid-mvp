"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Goal,
  PiggyBank,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const summaryCards = [
  {
    title: "Saldo",
    value: 12840.5,
    change: "+8,2% no mês",
    icon: Wallet,
    trend: "positive" as const,
  },
  {
    title: "Receitas",
    value: 9850,
    change: "+12,4% no mês",
    icon: ArrowUpRight,
    trend: "positive" as const,
  },
  {
    title: "Despesas",
    value: 4230.8,
    change: "-3,1% no mês",
    icon: ArrowDownRight,
    trend: "negative" as const,
  },
];

const budgetRule = [
  {
    label: "Necessidades",
    helper: "Moradia, alimentação e contas",
    target: 50,
    current: 46,
  },
  {
    label: "Desejos",
    helper: "Lazer, compras e assinaturas",
    target: 30,
    current: 27,
  },
  {
    label: "Investimentos",
    helper: "Reserva, metas e patrimônio",
    target: 20,
    current: 27,
  },
];

const goals = [
  {
    name: "Reserva de emergência",
    current: 12000,
    target: 18000,
    progress: 67,
  },
  {
    name: "Viagem em família",
    current: 4200,
    target: 8000,
    progress: 53,
  },
  {
    name: "Novo notebook",
    current: 3100,
    target: 5000,
    progress: 62,
  },
];

export function PersonalDashboard() {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-6">
          <p className="text-sm font-medium text-emerald-700">
            Finanças pessoais
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Visão geral
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Acompanhe seu dinheiro, seu orçamento e a evolução das suas metas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {item.title}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {currency.format(item.value)}
                      </p>
                    </div>
                    <span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="size-5" />
                    </span>
                  </div>

                  <p
                    className={
                      item.trend === "positive"
                        ? "mt-4 text-xs font-medium text-emerald-700"
                        : "mt-4 text-xs font-medium text-rose-700"
                    }
                  >
                    {item.change}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Regra 50/30/20</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Distribuição recomendada da renda mensal.
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <PiggyBank className="size-5" />
            </span>
          </CardHeader>

          <CardContent className="space-y-7">
            {budgetRule.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500">{item.helper}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {item.current}%
                    </p>
                    <p className="text-[11px] text-slate-400">
                      meta {item.target}%
                    </p>
                  </div>
                </div>
                <Progress value={item.current} />
              </div>
            ))}

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex gap-3">
                <CircleDollarSign className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <p className="text-sm leading-6 text-emerald-950">
                  Seus investimentos estão 7 pontos percentuais acima da
                  referência. Excelente margem para acelerar suas metas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Metas financeiras</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Progresso dos seus principais objetivos.
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-700">
              <Goal className="size-5" />
            </span>
          </CardHeader>

          <CardContent className="space-y-6">
            {goals.map((goal) => (
              <div key={goal.name}>
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {goal.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {currency.format(goal.current)} de{" "}
                      {currency.format(goal.target)}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {goal.progress}%
                  </span>
                </div>
                <Progress value={goal.progress} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
