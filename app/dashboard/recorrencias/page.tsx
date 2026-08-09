"use client";

import { RecurringEntriesManager } from "@/components/finance/RecurringEntriesManager";
import { useAuth } from "@/context/AuthContext";

export default function RecorrenciasPage() {
  const { profile, adminPreviewProduct } = useAuth();

  return (
    <RecurringEntriesManager
      institutional={profile?.system_role === "SUPER_ADMIN" ? adminPreviewProduct === "BUSINESS" : profile?.role === "INSTITUTIONAL"}
    />
  );
}
