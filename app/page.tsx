"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Building2, Check, HeartPulse, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type CheckoutSettings={personal_checkout_enabled:boolean;business_checkout_enabled:boolean};
const fallback={personal_checkout_enabled:true,business_checkout_enabled:true};

export default function HomePage(){
 const [settings,setSettings]=useState<CheckoutSettings>(fallback);
 const [buying,setBuying]=useState<"PERSONAL"|"BUSINESS"|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{fetch('/api/admin/settings',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>d&&setSettings({personal_checkout_enabled:d.personal_checkout_enabled!==false,business_checkout_enabled:d.business_checkout_enabled!==false})).catch(()=>undefined)},[]);
 async function checkout(plan:"PERSONAL"|"BUSINESS"){
  setBuying(plan);setError('');
  try{const r=await fetch('/api/payments/infinitepay/public-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan}),cache:'no-store'});const raw=await r.text();let j:any={};try{j=raw?JSON.parse(raw):{}}catch{};if(!r.ok||!j.url){setError(j.error||'Não foi possível abrir o checkout.');return}window.location.assign(j.url)}catch{setError('Não foi possível conectar ao pagamento. Tente novamente.')}finally{setBuying(null)}
 }
 return <main className="min-h-screen bg-[#f4f3ef] text-[#101116]">
  <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f4f3ef]/90 backdrop-blur-xl"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
   <Link href="/" className="flex items-center gap-3"><BrandMark/><div><strong className="block text-sm tracking-[.18em]">EQUITY ONE</strong><span className="text-[10px] uppercase tracking-[.2em] text-slate-500">Financial ecosystem</span></div></Link>
   <div className="flex items-center gap-2"><Link href="/medicos" className="hidden text-sm font-bold text-slate-600 hover:text-black md:block">Para médicos</Link><Link href="/login"><Button variant="outline" className="border-black/10 bg-white">Já sou cliente</Button></Link></div>
  </div></header>
  <section className="equity-grid relative overflow-hidden border-b border-black/5"><div className="absolute -right-32 -top-32 size-[460px] rounded-full bg-[#c9a34d]/10 blur-3xl"/><div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
   <div className="max-w-4xl"><div className="inline-flex items-center gap-2 rounded-full border border-[#c9a34d]/25 bg-[#c9a34d]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#8b6a25]"><Sparkles className="size-4"/>Gestão financeira com visão de futuro</div>
   <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[.98] tracking-[-.04em] md:text-7xl">Controle o presente.<br/><span className="equity-gold-text">Construa patrimônio.</span></h1>
   <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">Um ecossistema financeiro para vida pessoal, negócios e carreiras que exigem uma visão financeira especializada.</p></div>
  </div></section>
  <section className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20"><div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9a762b]">Escolha sua experiência</p><h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Uma marca. Diferentes necessidades.</h2></div><p className="max-w-lg text-sm leading-6 text-slate-500">Cada produto possui experiência própria, mantendo a segurança e a inteligência do ecossistema Equity One.</p></div>
   {error&&<div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
   <div className="grid gap-5 lg:grid-cols-3">
    <ProductCard title="Equity One Pessoal" subtitle="Sua vida financeira sob controle." icon={UserRound} items={["Receitas e despesas","Contas e alertas","Metas e cartões","Calendário financeiro"]} cta="Começar minha gestão" enabled={settings.personal_checkout_enabled} loading={buying==='PERSONAL'} onClick={()=>void checkout('PERSONAL')}/>
    <ProductCard title="Equity One Negócios" subtitle="Decisões financeiras para empresas." icon={Building2} items={["Fluxo de caixa","Centros de custo","Permissões internas","Relatórios empresariais"]} cta="Gerir meu negócio" enabled={settings.business_checkout_enabled} loading={buying==='BUSINESS'} onClick={()=>void checkout('BUSINESS')} dark/>
    <article className="equity-card relative overflow-hidden rounded-[2rem] bg-white p-8"><div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-[#0f4c81]/5"/><span className="grid size-12 place-items-center rounded-2xl bg-[#0f4c81]/10 text-[#0f4c81]"><HeartPulse className="size-6"/></span><p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#0f4c81]">Produto especializado</p><h3 className="mt-2 text-2xl font-black">Equity One Médicos</h3><p className="mt-2 text-sm leading-6 text-slate-500">Finanças, plantões, patrimônio e carreira médica em uma única visão.</p><div className="mt-6 space-y-3">{["Plantões e vínculos","A receber e particular","Valor da hora médica","Patrimônio e carreira"].map(x=><div key={x} className="flex items-center gap-3 text-sm"><Check className="size-4 text-emerald-600"/>{x}</div>)}</div><Link href="/medicos"><Button variant="outline" className="mt-8 h-14 w-full rounded-2xl border-[#0f4c81]/20 text-[#0f4c81]">Conhecer Equity One Médicos<ArrowRight className="size-5"/></Button></Link></article>
   </div>
  </section>
 </main>
}
function BrandMark(){return <span className="grid size-11 place-items-center rounded-2xl bg-[#0c0d10] text-[#d3ad56] shadow-lg"><BriefcaseBusiness className="size-5"/></span>}
function ProductCard({title,subtitle,icon:Icon,items,cta,enabled,loading,onClick,dark=false}:{title:string;subtitle:string;icon:any;items:string[];cta:string;enabled:boolean;loading:boolean;onClick:()=>void;dark?:boolean}){return <article className={`equity-card rounded-[2rem] p-8 ${dark?'bg-[#0d0f13] text-white':'bg-white'}`}><span className={`grid size-12 place-items-center rounded-2xl ${dark?'bg-[#c9a34d]/15 text-[#dfbd6d]':'bg-[#c9a34d]/10 text-[#9a762b]'}`}><Icon className="size-6"/></span><h3 className="mt-6 text-2xl font-black">{title}</h3><p className={`mt-2 text-sm ${dark?'text-slate-400':'text-slate-500'}`}>{subtitle}</p><div className="mt-7 space-y-3">{items.map(x=><div key={x} className="flex items-center gap-3 text-sm"><Check className="size-4 text-emerald-500"/>{x}</div>)}</div><Button onClick={onClick} disabled={!enabled||loading} className={`mt-8 h-14 w-full rounded-2xl ${dark?'bg-[#c9a34d] text-black hover:bg-[#ddbd70]':'bg-[#0d0f13] hover:bg-black'}`}>{loading?'Abrindo pagamento...':enabled?cta:'Inscrições pausadas'}<ArrowRight className="size-5"/></Button><div className={`mt-3 flex items-center justify-center gap-2 text-xs ${dark?'text-slate-500':'text-slate-400'}`}><ShieldCheck className="size-4 text-emerald-500"/>Pagamento seguro</div></article>}
