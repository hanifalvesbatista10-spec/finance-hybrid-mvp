import {ArrowRight,BarChart3,BellRing,Check,ChevronRight,CreditCard,Landmark,ReceiptText,Sparkles,Target} from "lucide-react";
import Link from "next/link";
import {Button} from "@/components/ui/button";

const flow=[
 {icon:Landmark,label:"Contas",text:"Saldo e movimentações"},
 {icon:CreditCard,label:"Cartões",text:"Compras e faturas"},
 {icon:ReceiptText,label:"Lançamentos",text:"Receitas e despesas"},
 {icon:Target,label:"Metas",text:"Objetivos e evolução"},
];

export function ProductExperienceShowcase(){
 return <section id="produto" className="border-y border-black/[.06] bg-white">
  <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
   <div className="grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
    <div><p className="text-xs font-black uppercase tracking-[.22em] text-[#9a762b]">Veja o Equity One em ação</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-[-.04em] md:text-5xl">Da movimentação à decisão, <span className="text-slate-400">sem perder o contexto.</span></h2></div>
    <div className="lg:ml-auto lg:max-w-xl"><p className="text-base leading-7 text-slate-600">O valor da plataforma não está em uma tela isolada. Está na conexão: uma movimentação altera a conta, alimenta relatórios, conversa com metas e pode ser organizada pela IA.</p><a href="#solucoes" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#8d6926]">Escolher minha experiência <ArrowRight className="size-4"/></a></div>
   </div>

   <div className="mt-10 overflow-hidden rounded-[2.4rem] border border-black/[.07] bg-[#0b0d11] p-3 shadow-[0_35px_90px_rgba(15,23,42,.18)] md:p-5">
    <div className="rounded-[1.9rem] border border-white/[.07] bg-[#f4f3ef] p-4 md:p-6">
     <div className="flex flex-col gap-4 border-b border-black/[.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#9a762b]">Visão Geral</p><h3 className="mt-2 text-2xl font-black text-slate-950">Boa noite. Aqui está o que exige sua atenção.</h3></div>
      <span className="inline-flex items-center gap-2 self-start rounded-xl border border-black/[.06] bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm"><BellRing className="size-4 text-[#9a762b]"/>3 prioridades hoje</span>
     </div>

     <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-4">
       <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Saldo das contas" value="R$ 8.420,00" note="2 contas ativas"/>
        <Metric label="Faturas em aberto" value="R$ 1.280,00" note="Próxima em 6 dias"/>
        <Metric label="Resultado do mês" value="+ R$ 2.140,00" note="Receitas − despesas" positive/>
       </div>
       <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-black/[.06] bg-white p-5 shadow-sm">
         <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">Movimentações recentes</p><p className="mt-1 font-black">Tudo conectado às contas</p></div><ReceiptText className="size-5 text-[#9a762b]"/></div>
         <div className="mt-5 divide-y divide-slate-100">{[["Recebimento cliente","Hoje","+ R$ 1.800,00","in"],["Supermercado","Hoje","- R$ 286,40","out"],["Pagamento de fatura","Ontem","- R$ 720,00","out"]].map(([a,b,c,t])=><div key={a} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-bold text-slate-900">{a}</p><p className="mt-1 text-xs text-slate-400">{b}</p></div><b className={t==="in"?"text-emerald-700":"text-rose-700"}>{c}</b></div>)}</div>
        </div>
        <div className="rounded-2xl border border-black/[.06] bg-white p-5 shadow-sm">
         <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">Evolução do mês</p><p className="mt-1 font-black">Resultado acumulado</p></div><BarChart3 className="size-5 text-[#9a762b]"/></div>
         <div className="mt-7 flex h-36 items-end gap-2">{[31,45,39,58,55,74,86,78,92].map((h,i)=><span key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#8b6726] to-[#dfbf70]" style={{height:`${h}%`}}/>)}</div>
        </div>
       </div>
      </div>

      <div className="rounded-2xl bg-[#0b0d11] p-5 text-white shadow-xl">
       <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#d4ad55]">Equity One IA</p><h4 className="mt-2 text-xl font-black">Conte o que aconteceu.</h4></div><span className="grid size-11 place-items-center rounded-2xl bg-[#d4ad55]/10 text-[#d4ad55]"><Sparkles className="size-5"/></span></div>
       <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm leading-6 text-slate-300">“Paguei R$ 286,40 no supermercado hoje pelo Nubank.”</div>
       <div className="mt-4 space-y-2">{["Despesa identificada","Conta: Nubank","Categoria: Supermercado","Data: hoje"].map(x=><div key={x} className="flex items-center gap-2 rounded-xl bg-white/[.04] px-3 py-2.5 text-xs text-slate-300"><Check className="size-3.5 text-emerald-400"/>{x}</div>)}</div>
       <div className="mt-5 rounded-2xl bg-[#d4ad55] p-4 text-black"><p className="text-xs font-black uppercase tracking-[.15em]">Pronto para confirmar</p><p className="mt-1 text-sm font-bold">A IA organiza. Você continua no controle.</p></div>
      </div>
     </div>
    </div>
   </div>

   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{flow.map(({icon:Icon,label,text},i)=><div key={label} className="group flex items-center gap-3 rounded-2xl border border-black/[.06] bg-[#f7f5ef] p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d4ad55]/10 text-[#8f6a25]"><Icon className="size-4"/></span><div className="min-w-0 flex-1"><p className="text-sm font-black">{label}</p><p className="mt-0.5 text-xs text-slate-500">{text}</p></div><ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#9a762b]"/></div>)}</div>
  </div>
 </section>
}

function Metric({label,value,note,positive=false}:{label:string;value:string;note:string;positive?:boolean}){return <div className="rounded-2xl border border-black/[.06] bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-400">{label}</p><p className={`mt-2 text-xl font-black ${positive?"text-emerald-700":"text-slate-950"}`}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{note}</p></div>}
