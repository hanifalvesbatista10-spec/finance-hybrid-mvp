"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export function MedicalProductGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, supabase, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const validateAccess = async () => {
      if (loading) return;

      if (!user) {
        if (active) setAllowed(false);
        return;
      }

      if (profile?.system_role === "SUPER_ADMIN") {
        if (active) setAllowed(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_products")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_code", "MEDICAL")
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (error) throw error;
        if (active) setAllowed(Boolean(data));
      } catch (error) {
        console.error("Não foi possível validar o acesso ao Equity One Médicos:", error);
        if (active) setAllowed(false);
      }
    };

    void validateAccess();

    return () => {
      active = false;
    };
  }, [loading, user, profile?.system_role, supabase]);

  if (loading || allowed === null) {
    return (
      <div className="grid min-h-[70vh] place-items-center text-sm text-slate-500">
        Validando Equity One Médicos...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <Link href="/login">
          <Button>Entrar para continuar</Button>
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-[#0f4c81]/10 text-[#0f4c81]">
          <LockKeyhole className="size-7" />
        </span>
        <h1 className="mt-6 text-3xl font-black">Equity One Médicos</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Este produto ainda não está liberado para sua conta. A liberação pode ser realizada pelo Super Admin.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-6">
            Voltar ao Equity One
          </Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
