"use client";

import { ObligationsManager } from "@/components/finance/ObligationsManager";
import { useAuth } from "@/context/AuthContext";

export default function ContasPage() {
  const { profile } = useAuth();

  return (
    <ObligationsManager
      institutional={profile?.role === "INSTITUTIONAL"}
    />
  );
}
