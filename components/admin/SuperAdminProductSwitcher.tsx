"use client";

import { Building2, HeartPulse, ShieldCheck, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth, type AdminPreviewProduct } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const options: Array<{ product: AdminPreviewProduct; label: string; icon: typeof UserRound }> = [
  { product: "PERSONAL", label: "Pessoal", icon: UserRound },
  { product: "BUSINESS", label: "Negócios", icon: Building2 },
  { product: "MEDICAL", label: "Médicos", icon: HeartPulse },
];

export function SuperAdminProductSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ownerProductAccess, adminPreviewProduct, setAdminPreviewProduct } = useAuth();

  if (!ownerProductAccess) return null;

  function select(product: AdminPreviewProduct) {
    setAdminPreviewProduct(product);
    if (product === "MEDICAL") {
      router.push("/medicos/dashboard");
      return;
    }
    if (pathname.startsWith("/medicos")) {
      router.push("/dashboard");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className={cn("rounded-2xl border border-[#d2aa51]/20 bg-[#d2aa51]/[.07]", compact ? "p-2" : "p-3")}>
      {!compact && (
        <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[.18em] text-[#d2aa51]">
          <ShieldCheck className="size-4" /> Testar produto
        </div>
      )}
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-1")}>
        {options.map(({ product, label, icon: Icon }) => {
          const active = adminPreviewProduct === product;
          return (
            <button
              key={product}
              type="button"
              onClick={() => select(product)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition",
                active ? "bg-[#d2aa51] text-[#0b0d11]" : "bg-white/[.04] text-slate-300 hover:bg-white/[.08] hover:text-white",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
