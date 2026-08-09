"use client";

import { ObligationsManager } from "@/components/finance/ObligationsManager";
import { useAuth } from "@/context/AuthContext";

export default function ContasPage() {
  const { profile, adminPreviewProduct } = useAuth();

  return (
    <ObligationsManager
      institutional={profile?.system_role === "SUPER_ADMIN" ? adminPreviewProduct === "BUSINESS" : profile?.role === "INSTITUTIONAL"}
    />
  );
}
