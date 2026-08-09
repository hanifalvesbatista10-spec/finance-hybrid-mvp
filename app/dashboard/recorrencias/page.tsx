"use client";

import { RecurringEntriesManager } from "@/components/finance/RecurringEntriesManager";
import { useAuth } from "@/context/AuthContext";

export default function RecorrenciasPage() {
  const { profile } = useAuth();

  return (
    <RecurringEntriesManager
      institutional={profile?.role === "INSTITUTIONAL"}
    />
  );
}
