"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/AuthContext";
import {
  subscriptionIsActive,
  type Subscription,
} from "@/lib/subscriptions";

export function SubscriptionGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { supabase, user, profile, loading } = useAuth();
  const [checking, setChecking] = useState(true);

  const verify = useCallback(async () => {
    if (loading) return;

    if (!user || !profile) {
      setChecking(false);
      return;
    }

    if (profile.system_role === "SUPER_ADMIN") {
      setChecking(false);
      return;
    }

    setChecking(true);

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const subscription = (data as Subscription | null) ?? null;

    if (error || !subscriptionIsActive(subscription)) {
      const returnTo = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/assinatura?returnTo=${returnTo}`);
      return;
    }

    setChecking(false);
  }, [loading, pathname, profile, router, supabase, user]);

  useEffect(() => {
    void verify();
  }, [verify]);

  if (loading || checking) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
          Validando assinatura...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
