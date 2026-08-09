"use client";

import { ReportsCenter } from "@/components/finance/ReportsCenter";
import { useAuth } from "@/context/AuthContext";

export default function RelatoriosPage() {
  const { profile, adminPreviewProduct, ownerProductAccess } = useAuth();

  return (
    <ReportsCenter institutional={ownerProductAccess ? adminPreviewProduct === "BUSINESS" : profile?.role === "INSTITUTIONAL"} />
  );
}
