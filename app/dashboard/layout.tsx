"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  CreditCard,
  FileText,
  Goal,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth, type ProfileRole } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type Item = { label: string; href: string; icon: LucideIcon };

const personal: Item[] = [
  { label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Lançamentos", href: "/dashboard/lancamentos", icon: ReceiptText },
  { label: "Fixos mensais", href: "/dashboard/recorrencias", icon: CalendarClock },
  { label: "Calendário", href: "/dashboard/calendario", icon: CalendarDays },
  { label: "Relatórios", href: "/dashboard/relatorios", icon: FileText },
  { label: "Metas", href: "/dashboard/metas", icon: Goal },
  { label: "Cartões", href: "/dashboard/cartoes", icon: CreditCard },
];

const institutional: Item[] = [
  { label: "Fluxo de Caixa", href: "/dashboard", icon: BarChart3 },
  { label: "Lançamentos", href: "/dashboard/lancamentos", icon: ReceiptText },
  { label: "Fixos mensais", href: "/dashboard/recorrencias", icon: CalendarClock },
  { label: "Calendário", href: "/dashboard/calendario", icon: CalendarDays },
  { label: "Relatórios", href: "/dashboard/relatorios", icon: FileText },
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

const navFor = (role?: ProfileRole) =>
  role === "INSTITUTIONAL" ? institutional : personal;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigation = useMemo(
    () => navFor(profile?.role),
    [profile?.role],
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  const logout = async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[285px] flex-col bg-[#0b1020] text-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-24 items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/40">
              <Landmark className="size-5" />
            </span>
            <div>
              <strong className="block text-sm tracking-wide">
                FINANCE HYBRID
              </strong>
              <span className="text-xs text-slate-400">
                {profile?.role === "INSTITUTIONAL" ? "Business" : "Personal"}
              </span>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="mx-4 rounded-2xl border border-white/10 bg-white/[.06] p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10">
              {profile?.role === "INSTITUTIONAL" ? (
                <Building2 className="size-5" />
              ) : (
                <UserRound className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-7">
          <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[.2em] text-slate-500">
            Menu principal
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
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                  active
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/30"
                    : "text-slate-400 hover:bg-white/[.06] hover:text-white",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 p-4">
          {profile?.system_role === "SUPER_ADMIN" && (
            <Link
              href="/admin"
              className="flex w-full items-center gap-3 rounded-xl bg-violet-500/15 px-3 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-500/25"
            >
              <ShieldCheck className="size-5" />
              Painel administrativo
            </Link>
          )}

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="size-5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-[285px]">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <span className="ml-3 font-black text-slate-900">
            Finance Hybrid
          </span>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 md:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
