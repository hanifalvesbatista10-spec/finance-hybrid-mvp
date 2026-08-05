"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  FileSpreadsheet,
  Printer,
  Scale,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/finance/StatCard";
import { currency, type Transaction } from "@/lib/finance";
import type { RecurringEntry } from "@/lib/recurring";
import { cn } from "@/lib/utils";

function rangeFromMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const previousStart = new Date(year, month - 2, 1);
  const previousEnd = new Date(year, month - 1, 0);
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  return {
    start: iso(start),
    end: iso(end),
    previousStart: iso(previousStart),
    previousEnd: iso(previousEnd),
    monthDate: start,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function ReportsCenter({
  institutional,
}: {
  institutional: boolean;
}) {
  const { supabase, user, profile } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError("");
    const range = rangeFromMonth(month);

    const [currentResult, previousResult, recurringResult] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", range.start)
        .lte("occurred_on", range.end)
        .order("occurred_on", { ascending: true }),
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", range.previousStart)
        .lte("occurred_on", range.previousEnd),
      supabase
        .from("recurring_entries")
        .select("*")
        .eq("active", true),
    ]);

    const firstError =
      currentResult.error || previousResult.error || recurringResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setTransactions((currentResult.data ?? []) as Transaction[]);
      setPreviousTransactions(
        (previousResult.data ?? []) as Transaction[],
      );
      setRecurring((recurringResult.data ?? []) as RecurringEntry[]);
    }

    setLoading(false);
  }, [month, supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const report = useMemo(() => {
    const sum = (items: Transaction[], type: "INCOME" | "EXPENSE") =>
      items
        .filter((item) => item.type === type)
        .reduce((total, item) => total + Number(item.amount), 0);

    const income = sum(transactions, "INCOME");
    const expense = sum(transactions, "EXPENSE");
    const previousIncome = sum(previousTransactions, "INCOME");
    const previousExpense = sum(previousTransactions, "EXPENSE");

    const range = rangeFromMonth(month);
    const monthStart = range.start;
    const fixedForMonth = recurring.filter(
      (item) =>
        item.start_month <= monthStart &&
        (!item.end_month || item.end_month >= monthStart),
    );

    const fixedIncome = fixedForMonth
      .filter((item) => item.type === "INCOME")
      .reduce((total, item) => total + Number(item.amount), 0);

    const fixedExpense = fixedForMonth
      .filter((item) => item.type === "EXPENSE")
      .reduce((total, item) => total + Number(item.amount), 0);

    const balance = income - expense;
    const projectedBalance = fixedIncome - fixedExpense;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;
    const fixedCommitment = fixedIncome > 0 ? (fixedExpense / fixedIncome) * 100 : 0;
    const incomeVariation =
      previousIncome > 0 ? ((income - previousIncome) / previousIncome) * 100 : null;
    const expenseVariation =
      previousExpense > 0 ? ((expense - previousExpense) / previousExpense) * 100 : null;

    const grouped = new Map<string, number>();
    transactions
      .filter((item) => item.type === "EXPENSE")
      .forEach((item) => {
        const key = institutional
          ? item.cost_center || "Sem centro de custo"
          : item.category || "Outros";
        grouped.set(key, (grouped.get(key) ?? 0) + Number(item.amount));
      });

    const categories = [...grouped.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const observations: string[] = [];
    if (transactions.length === 0) {
      observations.push("Não há lançamentos realizados no mês selecionado.");
    }
    if (fixedIncome === 0) {
      observations.push("Nenhuma receita fixa/base foi cadastrada para este período.");
    }
    if (fixedExpense > fixedIncome && fixedIncome > 0) {
      observations.push("As despesas fixas superam a receita fixa mensal.");
    }
    if (fixedCommitment > 70) {
      observations.push("Mais de 70% da receita fixa está comprometida antes das despesas variáveis.");
    }
    if (balance < 0) {
      observations.push("O resultado realizado do mês está negativo.");
    }
    if (savingsRate >= 20) {
      observations.push("A margem líquida do mês está igual ou acima de 20% da receita.");
    }
    if (expenseVariation !== null && expenseVariation > 15) {
      observations.push("As despesas cresceram mais de 15% em relação ao mês anterior.");
    }
    if (observations.length === 0) {
      observations.push("Os indicadores não apresentam alertas críticos para o período.");
    }

    return {
      income,
      expense,
      balance,
      previousIncome,
      previousExpense,
      fixedIncome,
      fixedExpense,
      projectedBalance,
      savingsRate,
      fixedCommitment,
      incomeVariation,
      expenseVariation,
      categories,
      observations,
    };
  }, [institutional, month, previousTransactions, recurring, transactions]);

  const monthLabel = useMemo(() => {
    const range = rangeFromMonth(month);
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(range.monthDate);
  }, [month]);

  const downloadCsv = () => {
    const rows = [
      ["Data", "Tipo", "Descrição", "Categoria", "Centro de custo", "Valor"],
      ...transactions.map((item) => [
        item.occurred_on,
        item.type === "INCOME" ? "Receita" : "Despesa",
        item.description,
        item.category,
        item.cost_center ?? "",
        Number(item.amount).toFixed(2).replace(".", ","),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n");

    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-financeiro-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) {
      setError("O navegador bloqueou a janela do relatório. Permita pop-ups para este site.");
      return;
    }

    const categoryRows = report.categories.length
      ? report.categories
          .map(
            ([name, value]) => `
              <tr>
                <td>${escapeHtml(name)}</td>
                <td class="right">${currency.format(value)}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="2">Sem despesas categorizadas.</td></tr>`;

    const transactionRows = transactions.length
      ? transactions
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.occurred_on.split("-").reverse().join("/"))}</td>
                <td>${item.type === "INCOME" ? "Receita" : "Despesa"}</td>
                <td>${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.category)}</td>
                <td class="right">${currency.format(Number(item.amount))}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="5">Nenhum lançamento no período.</td></tr>`;

    const observationItems = report.observations
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório financeiro - ${escapeHtml(monthLabel)}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
            }
            header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 3px solid #4f46e5;
              padding-bottom: 16px;
            }
            h1 { margin: 0; font-size: 24px; }
            h2 { margin: 24px 0 10px; font-size: 15px; }
            p { margin: 4px 0; }
            .muted { color: #64748b; }
            .cards {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-top: 18px;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
            }
            .card strong { display: block; margin-top: 6px; font-size: 17px; }
            table {
              width: 100%;
              border-collapse: collapse;
              page-break-inside: auto;
            }
            tr { page-break-inside: avoid; }
            th, td {
              border-bottom: 1px solid #e2e8f0;
              padding: 8px 6px;
              text-align: left;
            }
            th {
              background: #f8fafc;
              color: #475569;
              font-size: 10px;
              text-transform: uppercase;
            }
            .right { text-align: right; }
            .positive { color: #047857; }
            .negative { color: #be123c; }
            .observations {
              border-left: 4px solid #4f46e5;
              background: #eef2ff;
              padding: 10px 14px;
            }
            footer {
              margin-top: 25px;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              color: #64748b;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>Relatório Financeiro Mensal</h1>
              <p class="muted">${escapeHtml(monthLabel)}</p>
            </div>
            <div>
              <p><strong>${escapeHtml(profile?.full_name || "Usuário")}</strong></p>
              <p class="muted">${institutional ? "Conta institucional" : "Conta pessoal"}</p>
            </div>
          </header>

          <section class="cards">
            <div class="card"><span>Receitas realizadas</span><strong class="positive">${currency.format(report.income)}</strong></div>
            <div class="card"><span>Despesas realizadas</span><strong class="negative">${currency.format(report.expense)}</strong></div>
            <div class="card"><span>Resultado realizado</span><strong>${currency.format(report.balance)}</strong></div>
            <div class="card"><span>Receita fixa/base</span><strong>${currency.format(report.fixedIncome)}</strong></div>
            <div class="card"><span>Despesa fixa</span><strong>${currency.format(report.fixedExpense)}</strong></div>
            <div class="card"><span>Margem fixa prevista</span><strong>${currency.format(report.projectedBalance)}</strong></div>
          </section>

          <h2>Análise executiva</h2>
          <div class="observations"><ul>${observationItems}</ul></div>

          <h2>${institutional ? "Despesas por centro de custo" : "Despesas por categoria"}</h2>
          <table>
            <thead><tr><th>Grupo</th><th class="right">Total</th></tr></thead>
            <tbody>${categoryRows}</tbody>
          </table>

          <h2>Lançamentos do período</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th class="right">Valor</th>
              </tr>
            </thead>
            <tbody>${transactionRows}</tbody>
          </table>

          <footer>
            Gerado pelo Finance Hybrid em ${new Date().toLocaleString("pt-BR")}.
          </footer>

          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const maxCategory = Math.max(
    ...report.categories.map(([, value]) => value),
    1,
  );

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-indigo-700">
            ANÁLISE CONTÁBIL
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Central de relatórios
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Compare períodos, acompanhe a base fixa, identifique desvios e gere
            um relatório profissional pronto para salvar em PDF.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="sm:w-44"
          />
          <Button variant="outline" onClick={downloadCsv}>
            <FileSpreadsheet className="size-4" />
            Exportar CSV
          </Button>
          <Button onClick={printReport}>
            <Printer className="size-4" />
            Gerar relatório
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Receitas realizadas"
          value={loading ? "—" : currency.format(report.income)}
          helper={variationText(report.incomeVariation, "mês anterior")}
          icon={ArrowUpRight}
          tone="emerald"
        />
        <StatCard
          title="Despesas realizadas"
          value={loading ? "—" : currency.format(report.expense)}
          helper={variationText(report.expenseVariation, "mês anterior")}
          icon={ArrowDownRight}
          tone="rose"
        />
        <StatCard
          title="Resultado líquido"
          value={loading ? "—" : currency.format(report.balance)}
          helper={`Margem de ${report.savingsRate.toFixed(1)}% sobre as receitas`}
          icon={Scale}
          tone={report.balance >= 0 ? "indigo" : "rose"}
        />
        <StatCard
          title="Margem fixa prevista"
          value={loading ? "—" : currency.format(report.projectedBalance)}
          helper={`${report.fixedCommitment.toFixed(1)}% da receita fixa comprometida`}
          icon={TrendingUp}
          tone={report.projectedBalance >= 0 ? "indigo" : "rose"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
          <CardHeader>
            <CardTitle>
              {institutional
                ? "Despesas por centro de custo"
                : "Despesas por categoria"}
            </CardTitle>
            <p className="text-sm text-slate-500">
              Principais concentrações de gasto em {monthLabel}.
            </p>
          </CardHeader>
          <CardContent>
            {report.categories.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">
                Nenhuma despesa registrada no período.
              </p>
            ) : (
              <div className="space-y-5">
                {report.categories.map(([name, value]) => (
                  <div key={name}>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <span className="truncate text-sm font-bold text-slate-700">
                        {name}
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {currency.format(value)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{
                          width: `${Math.max(
                            4,
                            (value / maxCategory) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
          <CardHeader>
            <CardTitle>Parecer automático</CardTitle>
            <p className="text-sm text-slate-500">
              Leitura executiva baseada nos dados do período.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.observations.map((observation, index) => (
                <div
                  key={`${observation}-${index}`}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-slate-700">
                    {observation}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Resumo da base mensal</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Valores previsíveis cadastrados para planejamento.
            </p>
          </div>
          <BarChart3 className="size-5 text-indigo-600" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <MiniMetric
            label="Receita fixa/base"
            value={currency.format(report.fixedIncome)}
            tone="positive"
          />
          <MiniMetric
            label="Despesa fixa"
            value={currency.format(report.fixedExpense)}
            tone="negative"
          />
          <MiniMetric
            label="Saldo fixo previsto"
            value={currency.format(report.projectedBalance)}
            tone={report.projectedBalance >= 0 ? "positive" : "negative"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function variationText(
  value: number | null,
  suffix: string,
) {
  if (value === null) return `Sem base comparável com o ${suffix}`;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}% em relação ao ${suffix}`;
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-xl font-black",
          tone === "positive" ? "text-emerald-700" : "text-rose-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}
