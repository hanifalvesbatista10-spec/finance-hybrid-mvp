"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FinanceOverview } from "@/components/FinanceOverview";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, adminPreviewProduct, ownerProductAccess } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">Carregando sua conta...</div>;
  }

  if (!user) return null;

  if (!profile) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Perfil não encontrado. Execute o arquivo supabase_schema_v2.sql.
      </div>
    );
  }

  const institutional = ownerProductAccess
    ? adminPreviewProduct === "BUSINESS"
    : profile.role === "INSTITUTIONAL";

  return <FinanceOverview institutional={institutional} />;
}
