"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  Calculator,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const summaryCards = [
  {
    title: "Fluxo de Caixa Atual",
    value: 184750.9,
    helper: "Disponível consolidado",
    icon: WalletCards,
  },
  {
    title: "Fluxo Projetado",
    value: 226400,
    helper: "Próximos 30 dias",
    icon: BadgeDollarSign,
  },
  {
    title: "Balanço",
    value: 41649.1,
    helper: "Resultado estimado",
    icon: Calculator,
  },
];

const transactions = [
  {
    description: "Campanha de aquisição",
    costCenter: "Marketing",
    date: "04 ago. 2026",
    type: "expense",
    value: -12800,
  },
  {
    description: "Folha de pagamento",
    costCenter: "RH",
    date: "03 ago. 2026",
    type: "expense",
    value: -48750,
  },
  {
    description: "Receita de contratos",
    costCenter: "Comercial",
    date: "02 ago. 2026",
    type: "income",
    value: 96500,
  },
  {
    description: "Infraestrutura em nuvem",
    costCenter: "Tecnologia",
    date: "01 ago. 2026",
    type: "expense",
    value: -7340.5,
  },
];

const permissions = [
  {
    id: "admin",
    label: "Admin",
    description: "Acesso total e gestão de usuários",
    icon: ShieldCheck,
  },
  {
    id: "accountant",
    label: "Contador",
    description: "Relatórios, conciliação e exportações",
    icon: UserCog,
  },
  {
    id: "operator",
    label: "Operador",
    description: "Cadastro e consulta de lançamentos",
    icon: Users,
  },
] as const;

type PermissionId = (typeof permissions)[number]["id"];

export function InstitutionalDashboard() {
  const [selectedPermission, setSelectedPermission] =
    useState<PermissionId>("admin");

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-6">
          <p className="text-sm font-medium text-indigo-700">
            Gestão institucional
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Fluxo de caixa
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Indicadores financeiros, centros de custo e governança da empresa.
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
                    <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">{item.helper}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Lançamentos recentes</CardTitle>
            <p className="text-sm text-slate-500">
              Últimas movimentações categorizadas por centro de custo.
            </p>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Lançamento</th>
                    <th className="px-6 py-3 font-semibold">Centro de Custo</th>
                    <th className="px-6 py-3 font-semibold">Data</th>
                    <th className="px-6 py-3 text-right font-semibold">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((transaction) => {
                    const income = transaction.type === "income";

                    return (
                      <tr
                        key={`${transaction.description}-${transaction.date}`}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "grid size-9 place-items-center rounded-lg",
                                income
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700",
                              )}
                            >
                              {income ? (
                                <ArrowUpRight className="size-4" />
                              ) : (
                                <ArrowDownLeft className="size-4" />
                              )}
                            </span>
                            <span className="text-sm font-medium text-slate-900">
                              {transaction.description}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {transaction.costCenter}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {transaction.date}
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 text-right text-sm font-bold",
                            income ? "text-emerald-700" : "text-slate-900",
                          )}
                        >
                          {currency.format(transaction.value)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Nível de permissão</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Simulação dos perfis internos.
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
              <Building2 className="size-5" />
            </span>
          </CardHeader>

          <CardContent className="space-y-3">
            {permissions.map((permission) => {
              const Icon = permission.icon;
              const selected = selectedPermission === permission.id;

              return (
                <button
                  key={permission.id}
                  type="button"
                  onClick={() => setSelectedPermission(permission.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                    selected
                      ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      selected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {permission.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {permission.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
