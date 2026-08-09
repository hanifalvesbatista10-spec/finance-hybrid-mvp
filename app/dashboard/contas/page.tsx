"use client";

import { ObligationsManager } from "@/components/finance/ObligationsManager";
import { useAuth } from "@/context/AuthContext";

export default function ContasPage() {
  const { profile, adminPreviewProduct, ownerProductAccess } = useAuth();

  return (
    <ObligationsManager
      institutional={ownerProductAccess ? adminPreviewProduct === "BUSINESS" : profile?.role === "INSTITUTIONAL"}
    />
  );
}
