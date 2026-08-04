"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { InstitutionalDashboard } from "@/components/InstitutionalDashboard";
import { PersonalDashboard } from "@/components/PersonalDashboard";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          Preparando dashboard...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-amber-950">
          Perfil não encontrado
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Execute o arquivo supabase_schema.sql e confirme se o usuário possui
          um registro correspondente na tabela public.profiles.
        </p>
      </div>
    );
  }

  return profile.role === "INSTITUTIONAL" ? (
    <InstitutionalDashboard />
  ) : (
    <PersonalDashboard />
  );
}
