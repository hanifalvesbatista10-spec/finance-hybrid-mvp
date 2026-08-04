"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Landmark, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  supabase,
  useAuth,
  type ProfileRole,
} from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<ProfileRole>("PERSONAL");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role,
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "Cadastro realizado. Confirme seu e-mail antes de entrar.",
          );
        } else {
          router.replace("/dashboard");
        }

        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a autenticação.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-white text-slate-950">
            <Landmark className="size-6" />
          </span>
          <div>
            <p className="font-bold">Finance Hybrid</p>
            <p className="text-xs text-slate-400">
              Pessoal e institucional
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Gestão financeira inteligente
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-tight">
            Uma plataforma. Duas experiências financeiras.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Controle pessoal objetivo e gestão institucional com visão
            corporativa, permissões e centros de custo.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          MVP seguro com Next.js e Supabase.
        </p>
      </section>

      <section className="grid place-items-center bg-slate-50 p-4 sm:p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {mode === "login" ? "Acessar sua conta" : "Criar uma conta"}
            </CardTitle>
            <p className="text-sm text-slate-500">
              {mode === "login"
                ? "Entre com suas credenciais."
                : "Escolha o perfil inicial da sua experiência."}
            </p>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <>
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Nome completo
                    </label>
                    <input
                      id="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      autoComplete="name"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-slate-700">
                      Tipo de conta
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          id: "PERSONAL" as const,
                          label: "Pessoal",
                          icon: UserRound,
                        },
                        {
                          id: "INSTITUTIONAL" as const,
                          label: "Empresa",
                          icon: Building2,
                        },
                      ].map((option) => {
                        const Icon = option.icon;
                        const selected = role === option.id;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setRole(option.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold",
                              selected
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-slate-200 bg-white text-slate-700",
                            )}
                          >
                            <Icon className="size-4" />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {errorMessage && (
                <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                  {errorMessage}
                </p>
              )}

              {message && (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                  {message}
                </p>
              )}

              <Button className="w-full" disabled={submitting}>
                {submitting
                  ? "Processando..."
                  : mode === "login"
                    ? "Entrar"
                    : "Criar conta"}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode((current) =>
                  current === "login" ? "register" : "login",
                );
                setErrorMessage(null);
                setMessage(null);
              }}
              className="mt-5 w-full text-center text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              {mode === "login"
                ? "Ainda não possui conta? Cadastre-se"
                : "Já possui conta? Entrar"}
            </button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
