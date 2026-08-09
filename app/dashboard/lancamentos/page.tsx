"use client";

import { TransactionsManager } from "@/components/finance/TransactionsManager";
import { useAuth } from "@/context/AuthContext";

export default function LancamentosPage() {
  const { profile, adminPreviewProduct, ownerProductAccess } = useAuth();

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-bold text-indigo-700">MOVIMENTAÇÕES</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Lançamentos</h1>
        <p className="mt-2 text-sm text-slate-500">Cadastre, consulte e exclua suas receitas e despesas.</p>
      </div>
      <TransactionsManager institutional={ownerProductAccess ? adminPreviewProduct === "BUSINESS" : profile?.role === "INSTITUTIONAL"} />
    </div>
  );
}
