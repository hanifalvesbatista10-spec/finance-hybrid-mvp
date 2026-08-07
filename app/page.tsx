"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  FileText,
  Landmark,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const recursos = [
  ["Controle financeiro real", "Receitas, despesas, cartões, metas e recorrências.", WalletCards],
  ["Calendário financeiro", "Valores positivos e negativos organizados por dia.", CalendarDays],
  ["Relatórios em um clique", "Documentos profissionais prontos para salvar em PDF.", FileText],
  ["Dados protegidos", "Cada usuário acessa apenas as próprias informações.", ShieldCheck],
] as const;


type CheckoutSettings = {
  personal_checkout_enabled: boolean;
  business_checkout_enabled: boolean;
};
const fallbackSettings: CheckoutSettings = { personal_checkout_enabled: true, business_checkout_enabled: true };

export default function HomePage() {
  const [checkoutSettings,setCheckoutSettings]=useState<CheckoutSettings>(fallbackSettings);
  const [buyingPlan,setBuyingPlan]=useState<"PERSONAL"|"BUSINESS"|null>(null);
  const [checkoutError,setCheckoutError]=useState("");

  useEffect(()=>{fetch("/api/admin/settings",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{
    if(data)setCheckoutSettings({personal_checkout_enabled:data.personal_checkout_enabled!==false,business_checkout_enabled:data.business_checkout_enabled!==false});
  }).catch(()=>undefined)},[]);

  async function startCheckout(plan:"PERSONAL"|"BUSINESS"){
    setBuyingPlan(plan);setCheckoutError("");
    try{
      const response=await fetch("/api/payments/infinitepay/public-checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan}),cache:"no-store"});
      const raw=await response.text();let json:any={};if(raw){try{json=JSON.parse(raw)}catch{json={}}}
      if(!response.ok||!json.url){setCheckoutError(json.error||"Não foi possível abrir o checkout agora.");return}
      window.location.assign(json.url);
    }catch{setCheckoutError("Não foi possível conectar ao checkout. Tente novamente.")}finally{setBuyingPlan(null)}
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white"><Landmark className="size-5"/></span><strong>FINANCE HYBRID</strong></Link>
          <Link href="/login"><Button variant="outline">Já sou cliente</Button></Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[.18em] text-indigo-600">CONTROLE FINANCEIRO SIMPLES E PROFISSIONAL</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">Escolha seu plano e comece pelo pagamento.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-500">Você paga com segurança pela InfinitePay e cria sua conta somente depois da confirmação do pagamento.</p>
        </div>
        {checkoutError&&<div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{checkoutError}</div>}
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Plan title="Finance Hybrid Personal" icon={UserRound} enabled={checkoutSettings.personal_checkout_enabled} buttonLabel="Começar minha gestão pessoal" loading={buyingPlan==="PERSONAL"} onBuy={()=>void startCheckout("PERSONAL")} items={["Visão mensal completa","Receitas e despesas fixas","Metas e cartões","Relatórios e calendário"]}/>
          <Plan title="Finance Hybrid Business" icon={Building2} enabled={checkoutSettings.business_checkout_enabled} buttonLabel="Começar minha gestão empresarial" loading={buyingPlan==="BUSINESS"} onBuy={()=>void startCheckout("BUSINESS")} items={["Fluxo de caixa","Centros de custo","Permissões internas","Relatórios empresariais"]} dark/>
        </div>
      </section>
    </main>
  );
}

function Plan({title,icon:Icon,items,buttonLabel,enabled,loading,onBuy,dark=false}:{title:string;icon:typeof UserRound;items:string[];buttonLabel:string;enabled:boolean;loading:boolean;onBuy:()=>void;dark?:boolean}){
  return <article className={`rounded-[2rem] border p-8 ${dark?"border-indigo-600 bg-[#0b1020] text-white":"border-slate-200 bg-white"}`}>
    <span className={`grid size-12 place-items-center rounded-2xl ${dark?"bg-white/10 text-indigo-300":"bg-indigo-50 text-indigo-700"}`}><Icon className="size-6"/></span>
    <h3 className="mt-6 text-2xl font-black">{title}</h3>
    <div className="mt-7 space-y-3">{items.map(item=><div key={item} className="flex items-center gap-3 text-sm"><Check className="size-4 text-emerald-500"/>{item}</div>)}</div>
    {enabled?<Button type="button" onClick={onBuy} disabled={loading} className={`mt-8 h-14 w-full rounded-2xl text-base shadow-lg ${dark?"bg-indigo-500 hover:bg-indigo-400":"bg-slate-950 hover:bg-slate-800"}`}>{loading?"Abrindo pagamento...":buttonLabel}<ArrowRight className="size-5"/></Button>:<Button disabled className="mt-8 h-14 w-full rounded-2xl">Inscrições temporariamente pausadas</Button>}
    <div className={`mt-3 flex items-center justify-center gap-2 text-xs ${dark?"text-slate-400":"text-slate-500"}`}><ShieldCheck className="size-4 text-emerald-500"/>Pagamento seguro pela InfinitePay</div>
  </article>
}
