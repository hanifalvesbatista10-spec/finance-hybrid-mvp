"use client";

import { BrainCircuit, Database, ShieldCheck, Sparkles } from "lucide-react";
import { SmartFinancialInput } from "@/components/ai/SmartFinancialInput";
import { WhatsAppDiagnostics } from "@/components/ai/WhatsAppDiagnostics";
import { useAuth } from "@/context/AuthContext";
import type { AiProduct } from "@/lib/ai-finance";

export default function AgentePage() {
  const { profile, ownerProductAccess, adminPreviewProduct } = useAuth();
  const product: AiProduct = ownerProductAccess
    ? adminPreviewProduct
    : profile?.role === "INSTITUTIONAL" ? "BUSINESS" : "PERSONAL";
  const institutional = product === "BUSINESS";

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#9b772c]"><BrainCircuit className="size-4"/>Inteligência financeira</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.03em] text-slate-950 md:text-4xl">Meu Agente Financeiro</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Converse com seus próprios dados, consulte sua situação e prepare ações financeiras em linguagem natural.</p>
        </div>
        <div className="rounded-full border border-[#d2aa51]/20 bg-[#d2aa51]/10 px-4 py-2 text-xs font-black text-[#8a6826]">{product === "BUSINESS" ? "Equity One Negócios" : product === "MEDICAL" ? "Equity One Médicos" : "Equity One Pessoal"}</div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Info icon={Database} title="Dados reais" text="Saldos, faturas, metas, despesas e lançamentos vêm do seu próprio Equity One." />
        <Info icon={ShieldCheck} title="Você confirma as ações" text="Consultas são livres. Qualquer alteração financeira precisa da sua confirmação antes de ser gravada." />
        <Info icon={Sparkles} title="Linguagem natural" text="Pergunte como falaria com uma pessoa ou peça lançamentos, metas, contas e compras normalmente." />
      </section>

      <SmartFinancialInput product={product} institutional={institutional} />
      <WhatsAppDiagnostics />
    </div>
  );
}

function Info({icon:Icon,title,text}:{icon:any;title:string;text:string}) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.05)]"><span className="grid size-10 place-items-center rounded-xl bg-[#d2aa51]/10 text-[#9b772c]"><Icon className="size-4"/></span><h2 className="mt-4 font-black text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div>;
}
