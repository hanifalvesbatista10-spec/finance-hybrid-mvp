"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { categoryGroups } from "@/lib/transaction-categories";

export function CategoryMultiSelect({
  institutional,
  type,
  value,
  onChange,
}: {
  institutional: boolean;
  type: "INCOME" | "EXPENSE";
  value: string[];
  onChange: (items: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const groups = useMemo(() => categoryGroups(institutional, type), [institutional, type]);
  const normalized = search.trim().toLowerCase();

  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const customAvailable = Boolean(normalized) && !allItems.some((item) => item.toLowerCase() === normalized);

  const filtered = useMemo(
    () => groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !normalized || `${group.group} ${item}`.toLowerCase().includes(normalized)),
    })).filter((group) => group.items.length > 0),
    [groups, normalized],
  );

  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter((current) => current !== item) : [...value, item]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm outline-none transition hover:border-slate-300"
      >
        <span className={value.length ? "font-semibold text-slate-800" : "text-slate-400"}>
          {value.length ? `${value.length} selecionada(s)` : "Escolher categoria(s)"}
        </span>
        <ChevronDown className="size-4 text-slate-400" />
      </button>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <span key={item} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
              {index === 0 && <span className="text-[9px] uppercase text-indigo-400">Principal</span>}
              {item}
              <button type="button" onClick={() => toggle(item)} aria-label={`Remover ${item}`}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 border-b border-slate-100 bg-white p-3">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3">
              <Search className="size-4 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ex.: supermercado, combustível..."
                className="h-10 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">A primeira seleção será usada como categoria principal. Você pode marcar outras para detalhar a compra.</p>
          </div>
          <div className="max-h-[290px] overflow-y-auto p-2">
            {customAvailable && (
              <button
                type="button"
                onClick={() => {
                  const custom = search.trim();
                  if (custom && !value.includes(custom)) onChange([...value, custom]);
                  setSearch("");
                }}
                className="mb-2 flex w-full items-center justify-between rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2.5 text-left text-sm font-bold text-indigo-700"
              >
                <span>+ Usar “{search.trim()}” como categoria</span>
              </button>
            )}
            {filtered.map((group) => (
              <div key={group.group} className="mb-3 last:mb-0">
                <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{group.group}</p>
                {group.items.map((item) => {
                  const selected = value.includes(item);
                  return (
                    <button
                      type="button"
                      key={item}
                      onClick={() => toggle(item)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${selected ? "bg-indigo-50 font-bold text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      <span>{item}</span>
                      {selected && <Check className="size-4" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 p-3">
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">Concluir seleção</button>
          </div>
        </div>
      )}
    </div>
  );
}
