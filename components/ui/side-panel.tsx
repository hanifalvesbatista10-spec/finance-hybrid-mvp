"use client";
import {useEffect,type ReactNode} from "react";
import {X} from "lucide-react";
import {cn} from "@/lib/utils";

type Props={open:boolean;onClose:()=>void;title:string;subtitle?:string;children:ReactNode;footer?:ReactNode;className?:string};
export function SidePanel({open,onClose,title,subtitle,children,footer,className}:Props){
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',key);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=old}},[open,onClose]);
 return <div className={cn('fixed inset-0 z-[80] transition',open?'pointer-events-auto':'pointer-events-none')} aria-hidden={!open}>
  <button type="button" aria-label="Fechar painel" onClick={onClose} className={cn('absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity duration-200',open?'opacity-100':'opacity-0')}/>
  <aside className={cn('absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col bg-white shadow-[-18px_0_60px_rgba(15,23,42,.18)] transition-transform duration-300 ease-out',open?'translate-x-0':'translate-x-full',className)}>
   <header className="flex items-start gap-4 border-b border-slate-100 px-6 py-5"><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black text-slate-950">{title}</h2>{subtitle&&<p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div><button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"><X className="size-5"/></button></header>
   <div className="flex-1 overflow-y-auto p-6">{children}</div>
   {footer&&<footer className="border-t border-slate-100 bg-white p-4">{footer}</footer>}
  </aside>
 </div>
}
