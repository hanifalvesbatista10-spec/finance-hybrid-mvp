"use client";

import { RecurringEntriesManager } from "@/components/finance/RecurringEntriesManager";
import { useAuth } from "@/context/AuthContext";

export default function RecorrenciasPage() {
  const { profile, adminPreviewProduct, ownerProductAccess } = useAuth();

  return (
    <RecurringEntriesManager
      institutional={ownerProductAccess ? adminPreviewProduct === "BUSINESS" : profile?.role === "INSTITUTIONAL"}
    />
  );
}
