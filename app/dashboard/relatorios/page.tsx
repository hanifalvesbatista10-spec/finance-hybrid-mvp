"use client";

import { ReportsCenter } from "@/components/finance/ReportsCenter";
import { useAuth } from "@/context/AuthContext";

export default function RelatoriosPage() {
  const { profile, adminPreviewProduct } = useAuth();

  return (
    <ReportsCenter institutional={profile?.system_role === "SUPER_ADMIN" ? adminPreviewProduct === "BUSINESS" : profile?.role === "INSTITUTIONAL"} />
  );
}
