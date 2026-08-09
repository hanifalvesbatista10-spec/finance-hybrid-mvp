"use client";

import { ReportsCenter } from "@/components/finance/ReportsCenter";
import { useAuth } from "@/context/AuthContext";

export default function RelatoriosPage() {
  const { profile } = useAuth();

  return (
    <ReportsCenter institutional={profile?.role === "INSTITUTIONAL"} />
  );
}
