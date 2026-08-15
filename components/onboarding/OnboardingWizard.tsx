"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, Goal, Landmark, Sparkles, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MoneyInput, brlInputToNumber } from "@/components/ui/money-input";
import { EquityOneLogo } from "@/components/EquityOneLogo";

const STEPS = [
  { n: 1, label: "Boas-vindas", icon: Sparkles },
  { n: 2, label: "Primeira conta", icon: Landmark },
  { n: 3, label: "Cartão", icon: CreditCard },
  { n: 4, label: "Meta", icon: Goal },
  { n: 5, label: "Categorias", icon: Tags },
];

type AccountOption = { id:string; name:string; institution:string|null };

export function OnboardingWizard() {
  const router = useRouter();
  const { supabase, user, profile } = useAuth();
  const [step,setStep] = useState(1);
  const [accounts,setAccounts] = useState<AccountOption[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [account,setAccount] = useState({name:"Conta principal",institution:"",account_type:"CHECKING",opening_balance:""});
  const [card,setCard] = useState({nickname:"",issuer:"",brand:"Mastercard",last_four:"",credit_limit:"",closing_day:"1",due_day:"10",payment_account_id:""});
  const [goal,setGoal] = useState({name:"",target:"",deadline:""});
  const [categories,setCategories] = useState({expense:"",income:""});

  const institutional = profile?.role === "INSTITUTIONAL";
  const productName = institutional ? "Equity One Negócios" : "Equity One Pessoal";
  const progress = useMemo(()=>Math.round((step/5)*100),[step]);

  useEffect(()=>{
    if(!user)return;
    let active=true;
    (async()=>{
      setLoading(true);
      const [onboardingResult,accountsResult] = await Promise.all([
        supabase.from("user_onboarding").select("current_step,completed").eq("user_id",user.id).maybeSingle(),
        supabase.from("financial_accounts").select("id,name,institution").eq("is_active",true).order("created_at",{ascending:true}),
      ]);
      if(!active)return;
      if(onboardingResult.data?.completed){router.replace("/dashboard");return;}
      if(!onboardingResult.data && !onboardingResult.error){
        await supabase.from("user_onboarding").insert({user_id:user.id,current_step:1,completed:false});
      }
      const loadedStep=Math.min(5,Math.max(1,Number(onboardingResult.data?.current_step||1)));
      setStep(loadedStep);
      setAccounts((accountsResult.data??[]) as AccountOption[]);
      if(accountsResult.data?.[0])setCard(v=>({...v,payment_account_id:accountsResult.data![0].id}));
      setLoading(false);
    })();
    return()=>{active=false};
  },[router,supabase,user]);

  async function saveStep(next:number){
    if(!user)return;
    await supabase.from("user_onboarding").upsert({user_id:user.id,current_step:next,completed:false,updated_at:new Date().toISOString()});
    setStep(next);
    setError("");
  }

  async function saveAccount(event:FormEvent){
    event.preventDefault();
    setSaving(true);setError("");
    const {data,error:e}=await supabase.rpc("equity_onboarding_create_account",{
      p_name:account.name.trim(),
      p_institution:account.institution.trim()||null,
      p_account_type:account.account_type,
      p_opening_balance:brlInputToNumber(account.opening_balance),
    });
    if(e){setError(e.message);setSaving(false);return;}
    const id=(data as any)?.account_id as string|undefined;
    const nextAccount=id?{id,name:account.name.trim(),institution:account.institution.trim()||null}:null;
    if(nextAccount){setAccounts(prev=>[...prev,nextAccount]);setCard(v=>({...v,payment_account_id:v.payment_account_id||id!}));}
    setSaving(false);setStep(3);
  }

  async function saveCard(event:FormEvent){
    event.preventDefault();
    if(!user)return;
    const limit=brlInputToNumber(card.credit_limit);
    if(!card.nickname.trim()||limit<=0||card.last_four.length!==4){setError("Informe nome, limite e os 4 últimos dígitos do cartão.");return;}
    setSaving(true);setError("");
    const {error:e}=await supabase.from("cards").insert({
      user_id:user.id,nickname:card.nickname.trim(),brand:card.brand,issuer:card.issuer.trim()||null,last_four:card.last_four,
      credit_limit:limit,current_invoice:0,closing_day:Number(card.closing_day||1),due_day:Number(card.due_day||10),
      payment_account_id:card.payment_account_id||null,is_active:true,
    });
    if(e){setError(e.message);setSaving(false);return;}
    await saveStep(4);setSaving(false);
  }

  async function saveGoal(event:FormEvent){
    event.preventDefault();
    if(!user)return;
    const target=brlInputToNumber(goal.target);
    if(!goal.name.trim()||target<=0){setError("Informe o nome e o valor da meta.");return;}
    setSaving(true);setError("");
    const {error:e}=await supabase.from("goals").insert({user_id:user.id,name:goal.name.trim(),target_amount:target,current_amount:0,deadline:goal.deadline||null});
    if(e){setError(e.message);setSaving(false);return;}
    await saveStep(5);setSaving(false);
  }

  async function finish(){
    if(!user)return;
    setSaving(true);setError("");
    const product=institutional?"BUSINESS":"PERSONAL";
    for(const [type,name] of [["EXPENSE",categories.expense],["INCOME",categories.income]] as const){
      const trimmed=name.trim();
      if(!trimmed)continue;
      const {error:e}=await supabase.from("user_categories").insert({user_id:user.id,product,type,name:trimmed,archived:false});
      if(e && e.code!=="23505"){setError(e.message);setSaving(false);return;}
    }
    const {error:e}=await supabase.rpc("equity_finish_onboarding");
    if(e){setError(e.message);setSaving(false);return;}
    window.location.href="/dashboard";
  }

  if(loading)return <div className="grid min-h-screen place-items-center bg-[#f4f3ef] text-sm text-slate-500">Preparando seu Equity One...</div>;

  return <div className="min-h-screen bg-[#f4f3ef] px-4 py-8 md:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <EquityOneLogo className="h-16 w-auto md:h-20"/>
        <div className="text-right"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#9a762b]">Configuração inicial</p><p className="mt-1 text-sm font-bold text-slate-700">{productName}</p></div>
      </div>

      <div className="mt-7 overflow-hidden rounded-[2rem] border border-black/[.06] bg-white shadow-[0_24px_70px_rgba(15,23,42,.08)]">
        <div className="border-b border-slate-100 px-5 py-5 md:px-8">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400"><span>Passo {step} de 5</span><span>{progress}%</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#c9a34d] transition-all" style={{width:`${progress}%`}}/></div>
          <div className="mt-5 hidden grid-cols-5 gap-2 md:grid">{STEPS.map(({n,label,icon:Icon})=><div key={n} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${n===step?"bg-[#d4ad55]/12 text-[#8a6826]":n<step?"text-emerald-700":"text-slate-400"}`}><span className={`grid size-7 place-items-center rounded-lg ${n<step?"bg-emerald-50":n===step?"bg-[#d4ad55]/15":"bg-slate-50"}`}>{n<step?<Check className="size-4"/>:<Icon className="size-4"/>}</span><span className="truncate">{label}</span></div>)}</div>
        </div>

        <div className="p-5 md:p-8 lg:p-10">
          {error&&<div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

          {step===1&&<div className="mx-auto max-w-2xl text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#d4ad55]/12 text-[#9a762b]"><Sparkles className="size-7"/></span>
            <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-[#9a762b]">Seu espaço financeiro começa aqui</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-.04em] text-slate-950 md:text-5xl">Vamos deixar o Equity One pronto para você usar.</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-500">Em poucos passos você configura a base da sua gestão. O que não quiser preencher agora pode ser concluído depois dentro do dashboard.</p>
            <Button className="mt-8 h-13 rounded-xl bg-[#0b0d11] px-7 font-black" onClick={()=>void saveStep(2)}>Começar configuração<ArrowRight className="size-4"/></Button>
          </div>}

          {step===2&&<StepShell icon={Landmark} eyebrow="PASSO ESSENCIAL" title="Qual é a primeira conta que você quer acompanhar?" description="Cadastre banco, carteira ou dinheiro. O saldo informado vira o ponto de partida do seu histórico financeiro.">
            <form onSubmit={saveAccount} className="grid gap-4 md:grid-cols-2">
              <Field label="Nome da conta"><Input required value={account.name} onChange={e=>setAccount({...account,name:e.target.value})} placeholder="Ex.: Conta principal"/></Field>
              <Field label="Banco / instituição"><Input value={account.institution} onChange={e=>setAccount({...account,institution:e.target.value})} placeholder="Ex.: Nubank, Itaú, Caixa..."/></Field>
              <Field label="Tipo"><Select value={account.account_type} onChange={e=>setAccount({...account,account_type:e.target.value})}><option value="CHECKING">Conta corrente</option><option value="SAVINGS">Poupança</option><option value="WALLET">Carteira digital</option><option value="PAYMENT">Conta de pagamento</option><option value="CASH">Dinheiro</option><option value="INVESTMENT">Investimentos</option><option value="OTHER">Outra</option></Select></Field>
              <Field label="Saldo atual"><MoneyInput value={account.opening_balance} onValueChange={v=>setAccount({...account,opening_balance:v})}/></Field>
              <Actions back={()=>void saveStep(1)} skip={()=>void saveStep(3)} saving={saving} primary="Salvar conta e continuar"/>
            </form>
          </StepShell>}

          {step===3&&<StepShell icon={CreditCard} eyebrow="OPCIONAL" title="Quer cadastrar seu cartão principal agora?" description="Isso permite acompanhar limite, compras, parcelas e faturas desde o início.">
            <form onSubmit={saveCard} className="grid gap-4 md:grid-cols-2">
              <Field label="Nome do cartão"><Input required value={card.nickname} onChange={e=>setCard({...card,nickname:e.target.value})} placeholder="Ex.: Nubank Platinum"/></Field>
              <Field label="Banco / emissor"><Input value={card.issuer} onChange={e=>setCard({...card,issuer:e.target.value})} placeholder="Ex.: Nubank"/></Field>
              <Field label="Bandeira"><Select value={card.brand} onChange={e=>setCard({...card,brand:e.target.value})}><option>Mastercard</option><option>Visa</option><option>Elo</option><option>Amex</option><option>Hipercard</option><option>Outro</option></Select></Field>
              <Field label="Últimos 4 dígitos"><Input required maxLength={4} value={card.last_four} onChange={e=>setCard({...card,last_four:e.target.value.replace(/\D/g,"")})} placeholder="1234"/></Field>
              <Field label="Limite"><MoneyInput required value={card.credit_limit} onValueChange={v=>setCard({...card,credit_limit:v})}/></Field>
              <Field label="Conta para pagamento"><Select value={card.payment_account_id} onChange={e=>setCard({...card,payment_account_id:e.target.value})}><option value="">Definir depois</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.institution?`${a.institution} · `:""}{a.name}</option>)}</Select></Field>
              <Field label="Dia de fechamento"><Input type="number" min="1" max="31" value={card.closing_day} onChange={e=>setCard({...card,closing_day:e.target.value})}/></Field>
              <Field label="Dia de vencimento"><Input type="number" min="1" max="31" value={card.due_day} onChange={e=>setCard({...card,due_day:e.target.value})}/></Field>
              <Actions back={()=>void saveStep(2)} skip={()=>void saveStep(4)} saving={saving} primary="Salvar cartão e continuar"/>
            </form>
          </StepShell>}

          {step===4&&<StepShell icon={Goal} eyebrow="OPCIONAL" title="Defina uma primeira meta financeira." description="Pode ser reserva de emergência, viagem, patrimônio ou qualquer objetivo que você queira acompanhar.">
            <form onSubmit={saveGoal} className="grid gap-4 md:grid-cols-2">
              <Field label="Nome da meta"><Input required value={goal.name} onChange={e=>setGoal({...goal,name:e.target.value})} placeholder="Ex.: Reserva de emergência"/></Field>
              <Field label="Valor objetivo"><MoneyInput required value={goal.target} onValueChange={v=>setGoal({...goal,target:v})}/></Field>
              <Field label="Prazo"><Input type="date" value={goal.deadline} onChange={e=>setGoal({...goal,deadline:e.target.value})}/></Field>
              <Actions back={()=>void saveStep(3)} skip={()=>void saveStep(5)} saving={saving} primary="Salvar meta e continuar"/>
            </form>
          </StepShell>}

          {step===5&&<StepShell icon={Tags} eyebrow="ÚLTIMO PASSO" title="Suas categorias padrão já estão prontas." description="Se quiser, crie agora uma categoria personalizada de despesa e/ou receita. Você poderá criar outras depois.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Categoria personalizada de despesa"><Input value={categories.expense} onChange={e=>setCategories({...categories,expense:e.target.value})} placeholder="Ex.: Filhos, Obra, Clínica..."/></Field>
              <Field label="Categoria personalizada de receita"><Input value={categories.income} onChange={e=>setCategories({...categories,income:e.target.value})} placeholder="Ex.: Plantões, Projeto X..."/></Field>
              <div className="md:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800"><b>Categorias padrão já disponíveis.</b> Alimentação, moradia, transporte, saúde, trabalho e várias outras já podem ser usadas imediatamente.</div>
              <div className="md:col-span-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="ghost" onClick={()=>void saveStep(4)}><ArrowLeft className="size-4"/>Voltar</Button><Button type="button" disabled={saving} onClick={()=>void finish()} className="h-12 rounded-xl bg-[#0b0d11] px-7 font-black">{saving?"Preparando dashboard...":"Concluir e abrir meu dashboard"}<ArrowRight className="size-4"/></Button></div>
            </div>
          </StepShell>}
        </div>
      </div>
    </div>
  </div>;
}

function StepShell({icon:Icon,eyebrow,title,description,children}:{icon:any;eyebrow:string;title:string;description:string;children:React.ReactNode}){
  return <div className="mx-auto max-w-3xl"><span className="grid size-12 place-items-center rounded-2xl bg-[#d4ad55]/12 text-[#9a762b]"><Icon className="size-5"/></span><p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-[#9a762b]">{eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-slate-950 md:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p><div className="mt-7">{children}</div></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>}
function Actions({back,skip,saving,primary}:{back:()=>void;skip:()=>void;saving:boolean;primary:string}){return <div className="md:col-span-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="ghost" onClick={back}><ArrowLeft className="size-4"/>Voltar</Button><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={skip}>Configurar depois</Button><Button type="submit" disabled={saving} className="bg-[#0b0d11] font-black">{saving?"Salvando...":primary}<ArrowRight className="size-4"/></Button></div></div>}
