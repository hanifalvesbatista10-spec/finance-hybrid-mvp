"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronRight,
  CreditCard,
  Goal,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth, type ProfileRole } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const personalNavigation: NavigationItem[] = [
  { label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Metas", href: "/dashboard/metas", icon: Goal },
  { label: "Cartões", href: "/dashboard/cartoes", icon: CreditCard },
];

const institutionalNavigation: NavigationItem[] = [
  { label: "Fluxo de Caixa", href: "/dashboard", icon: BarChart3 },
  {
    label: "Centros de Custo",
    href: "/dashboard/centros-de-custo",
    icon: Building2,
  },
  {
    label: "Permissões",
    href: "/dashboard/permissoes",
    icon: ShieldCheck,
  },
];

function getNavigation(role?: ProfileRole): NavigationItem[] {
  return role === "INSTITUTIONAL"
    ? institutionalNavigation
    : personalNavigation;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  const navigation = useMemo(
    () => getNavigation(profile?.role),
    [profile?.role],
  );

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      setLogoutLoading(false);
    }
  };

  if (loading || (!user && !loading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          Carregando sua conta...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white">
              <Landmark className="size-5" />
            </span>
            <span>
              <strong className="block text-sm text-slate-950">
                Finance Hybrid
              </strong>
              <span className="text-xs text-slate-500">
                {profile?.role === "INSTITUTIONAL"
                  ? "Conta institucional"
                  : "Conta pessoal"}
              </span>
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar sidebar"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-slate-700 shadow-sm">
              {profile?.role === "INSTITUTIONAL" ? (
                <Building2 className="size-5" />
              ) : (
                <UserRound className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Navegação
          </p>

          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                <Icon className="size-5" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight
                  className={cn(
                    "size-4 transition-transform group-hover:translate-x-0.5",
                    active ? "opacity-100" : "opacity-40",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            <LogOut className="size-4" />
            {logoutLoading ? "Saindo..." : "Sair"}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>

          <div className="ml-3 flex items-center gap-2 font-semibold text-slate-900">
            <WalletCards className="size-5" />
            Dashboard
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
