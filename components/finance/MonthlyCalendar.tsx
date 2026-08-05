"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/finance/StatCard";
import { currency, type Transaction } from "@/lib/finance";
import { cn } from "@/lib/utils";

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthlyCalendar() {
  const { supabase, user } = useAuth();
  const [cursor, setCursor] = useState(new Date());
  const [items, setItems] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const start = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-01`;
  const last = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0).getDate();
  const end = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${last}`;

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("transactions").select("*").gte("occurred_on", start).lte("occurred_on", end).order("occurred_on");
    setItems((data ?? []) as Transaction[]);
  }, [end, start, supabase, user]);
  useEffect(() => { void load(); }, [load]);

  const daily = useMemo(() => {
    const map = new Map<string,{income:number;expense:number;items:Transaction[]}>();
    items.forEach(i => {
      const row = map.get(i.occurred_on) ?? { income:0, expense:0, items:[] };
      if (i.type === "INCOME") row.income += Number(i.amount); else row.expense += Number(i.amount);
      row.items.push(i); map.set(i.occurred_on,row);
    });
    return map;
  }, [items]);
  const totals = useMemo(() => items.reduce((a,i) => { i.type === "INCOME" ? a.income += Number(i.amount) : a.expense += Number(i.amount); return a; }, {income:0,expense:0}), [items]);
  const cells = Array.from({length:new Date(cursor.getFullYear(),cursor.getMonth(),1).getDay()+last},(_,i)=>i-new Date(cursor.getFullYear(),cursor.getMonth(),1).getDay()+1);
  const selectedRows = selected ? daily.get(selected)?.items ?? [] : [];

  return <div className="space-y-7">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-sm font-bold text-indigo-700">ANÁLISE MENSAL</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Calendário financeiro</h1><p className="mt-2 text-sm text-slate-500">Visualize entradas, saídas e saldo líquido de cada dia.</p></div>
      <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm"><Button variant="ghost" size="icon" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))}><ChevronLeft className="size-5"/></Button><span className="min-w-44 text-center text-sm font-black capitalize text-slate-900">{monthName.format(cursor)}</span><Button variant="ghost" size="icon" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))}><ChevronRight className="size-5"/></Button></div>
    </div>
    <div className="grid gap-4 md:grid-cols-3"><StatCard title="Receitas do mês" value={currency.format(totals.income)} helper={`${items.filter(i=>i.type==='INCOME').length} lançamento(s)`} icon={TrendingUp} tone="emerald"/><StatCard title="Despesas do mês" value={currency.format(totals.expense)} helper={`${items.filter(i=>i.type==='EXPENSE').length} lançamento(s)`} icon={TrendingDown} tone="rose"/><StatCard title="Resultado líquido" value={currency.format(totals.income-totals.expense)} helper="Receitas menos despesas" icon={Scale} tone={totals.income-totals.expense>=0?'indigo':'rose'}/></div>
    <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-indigo-600"/>Movimentação diária</CardTitle></CardHeader><CardContent>
      <div className="grid grid-cols-7 border-l border-t border-slate-200">{weekdays.map(w=><div key={w} className="border-b border-r border-slate-200 bg-slate-50 p-2 text-center text-xs font-black uppercase text-slate-400">{w}</div>)}
      {cells.map((day,idx)=>{ if(day<1)return <div key={idx} className="min-h-28 border-b border-r border-slate-200 bg-slate-50/50"/>; const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; const row=daily.get(key); const net=(row?.income??0)-(row?.expense??0); return <button type="button" key={key} onClick={()=>setSelected(key)} className={cn("min-h-28 border-b border-r border-slate-200 p-2 text-left transition hover:bg-indigo-50",selected===key&&"bg-indigo-50 ring-2 ring-inset ring-indigo-500")}><span className="text-xs font-black text-slate-600">{day}</span>{row&&<div className="mt-3 space-y-1"><p className="truncate text-[11px] font-bold text-emerald-700">+ {currency.format(row.income)}</p><p className="truncate text-[11px] font-bold text-rose-700">- {currency.format(row.expense)}</p><p className={cn("truncate text-[11px] font-black",net>=0?'text-indigo-700':'text-rose-800')}>={currency.format(net)}</p></div>}</button>})}</div>
    </CardContent></Card>
    {selected&&<Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]"><CardHeader><CardTitle>Detalhes de {new Date(`${selected}T12:00:00`).toLocaleDateString('pt-BR')}</CardTitle></CardHeader><CardContent>{selectedRows.length===0?<p className="text-sm text-slate-500">Nenhum lançamento neste dia.</p>:<div className="divide-y divide-slate-100">{selectedRows.map(i=><div key={i.id} className="flex items-center justify-between py-4"><div><p className="text-sm font-bold text-slate-900">{i.description}</p><p className="text-xs text-slate-400">{i.category}{i.cost_center?` • ${i.cost_center}`:''}</p></div><p className={cn("font-black",i.type==='INCOME'?'text-emerald-700':'text-rose-700')}>{i.type==='INCOME'?'+':'-'} {currency.format(Number(i.amount))}</p></div>)}</div>}</CardContent></Card>}
  </div>;
}
