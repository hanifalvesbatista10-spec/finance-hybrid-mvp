import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-slate-500 shadow-sm">
          <Icon className="size-6" />
        </span>
        <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}
