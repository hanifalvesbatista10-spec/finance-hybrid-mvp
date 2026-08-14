"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const monthNames=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function parseKey(key:string){const [year,month]=key.split("-").map(Number);return {year,month};}
function keyOf(year:number,month:number){return `${year}-${String(month).padStart(2,"0")}`;}

export function MonthNavigator({value,onChange,todayKey}:{value:string;onChange:(key:string)=>void;todayKey:string}){
 const {year,month}=parseKey(value);
 const [open,setOpen]=useState(false);
 const [pickerYear,setPickerYear]=useState(year);
 const label=useMemo(()=>new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(new Date(year,month-1,1)),[year,month]);
 const move=(delta:number)=>{const date=new Date(year,month-1+delta,1);onChange(keyOf(date.getFullYear(),date.getMonth()+1));setPickerYear(date.getFullYear())};
 return <div className="relative">
  <div className="flex flex-wrap items-center gap-2">
   <Button type="button" variant="outline" size="icon" className="rounded-xl bg-white" onClick={()=>move(-1)} aria-label="Mês anterior"><ChevronLeft className="size-4"/></Button>
   <button type="button" onClick={()=>{setPickerYear(year);setOpen(v=>!v)}} className="flex min-w-[210px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black capitalize text-slate-900 shadow-sm transition hover:border-[#d2aa51]/50 hover:shadow-md"><CalendarDays className="size-4 text-[#9b772c]"/>{label}</button>
   <Button type="button" variant="outline" size="icon" className="rounded-xl bg-white" onClick={()=>move(1)} aria-label="Próximo mês"><ChevronRight className="size-4"/></Button>
   {value!==todayKey&&<Button type="button" variant="ghost" className="rounded-xl text-[#8d6926]" onClick={()=>onChange(todayKey)}>Mês atual</Button>}
  </div>
  {open&&<div className="absolute left-0 top-[54px] z-40 w-[330px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
   <div className="mb-4 flex items-center justify-between"><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={()=>setPickerYear(y=>y-1)}><ChevronLeft className="size-4"/></button><p className="font-black text-slate-900">{pickerYear}</p><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={()=>setPickerYear(y=>y+1)}><ChevronRight className="size-4"/></button></div>
   <div className="grid grid-cols-4 gap-2">{monthNames.map((name,index)=>{const key=keyOf(pickerYear,index+1),active=key===value;return <button key={name} type="button" onClick={()=>{onChange(key);setOpen(false)}} className={`rounded-xl px-2 py-3 text-xs font-black transition ${active?"bg-[#d2aa51] text-[#0b0d11]":"bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{name}</button>})}</div>
  </div>}
 </div>
}
