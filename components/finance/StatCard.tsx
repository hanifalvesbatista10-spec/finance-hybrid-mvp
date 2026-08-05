import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "indigo",
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "indigo" | "emerald" | "rose" | "amber";
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <Card className="overflow-hidden border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {value}
            </p>
          </div>
          <span className={`grid size-12 place-items-center rounded-2xl ${tones[tone]}`}>
            <Icon className="size-5" />
          </span>
        </div>
        <p className="mt-5 text-xs font-medium text-slate-400">{helper}</p>
      </CardContent>
    </Card>
  );
}
