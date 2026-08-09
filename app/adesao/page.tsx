import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Landmark,
  LockKeyhole,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AdesaoPageProps = {
  searchParams: Promise<{
    plano?: string | string[];
  }>;
};

export default async function AdesaoPage({
  searchParams,
}: AdesaoPageProps) {
  const params = await searchParams;
  const rawPlan = Array.isArray(params.plano)
    ? params.plano[0]
    : params.plano;

  const plan =
    rawPlan === "INSTITUTIONAL" ? "INSTITUTIONAL" : "PERSONAL";

  const business = plan === "INSTITUTIONAL";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white">
              <Landmark className="size-5" />
            </span>
            <strong>EQUITY ONE</strong>
          </Link>

          <Link href="/login">
            <Button variant="outline">Entrar</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:px-8 lg:grid-cols-[1fr_.8fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[.18em] text-indigo-600">
            Etapa de adesão
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Confirme sua escolha
          </h1>

          <p className="mt-4 text-slate-500">
            Depois da adesão, você será direcionado para criar sua conta.
          </p>

          <Card className="mt-8 border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                  {business ? (
                    <Building2 className="size-6" />
                  ) : (
                    <UserRound className="size-6" />
                  )}
                </span>

                <div>
                  <CardTitle>
                    {business
                      ? "Equity One Business"
                      : "Equity One Personal"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {business
                      ? "Gestão financeira empresarial"
                      : "Gestão financeira pessoal"}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {(business
                ? [
                    "Fluxo de caixa",
                    "Centros de custo",
                    "Permissões",
                    "Relatórios empresariais",
                  ]
                : [
                    "Controle mensal",
                    "Metas e cartões",
                    "Fixos mensais",
                    "Relatórios",
                  ]
              ).map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm">
                  <Check className="size-4 text-emerald-600" />
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Resumo da adesão</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="rounded-2xl bg-slate-950 p-6 text-white">
              <p className="text-xs uppercase tracking-wider text-indigo-300">
                Plano selecionado
              </p>
              <p className="mt-3 text-xl font-black">
                {business ? "Business" : "Personal"}
              </p>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <LockKeyhole className="mt-0.5 size-5 text-indigo-600" />
              <p className="text-sm leading-6 text-slate-600">
                O checkout real poderá ser conectado ao seu meio de pagamento.
              </p>
            </div>

            <Link
              href={`/login?mode=register&plan=${plan}`}
              className="mt-7 block"
            >
              <Button className="h-12 w-full">
                Prosseguir para cadastro
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
