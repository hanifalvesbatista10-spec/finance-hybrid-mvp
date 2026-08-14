"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {ArrowDownRight,ArrowUpRight,ChevronRight,CreditCard,Landmark,Wallet} from "lucide-react";
import Link from "next/link";
import {useAuth} from "@/context/AuthContext";
import {currency,type Transaction} from "@/lib/finance";
import {UpcomingAlertsBanner} from "@/components/finance/UpcomingAlertsBanner";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ActivityTimeline} from "@/components/finance/ActivityTimeline";
import {MonthNavigator} from "@/components/finance/MonthNavigator";
import {MonthlyCashFlowChart} from "@/components/finance/MonthlyCashFlowChart";

type Account={id:string;name:string;institution:string|null;opening_balance:number;current_balance:number;include_in_total:boolean;is_active:boolean;created_at:string};
type Entry={account_id:string;entry_type:string;amount:number;occurred_on:string};
type Invoice={id:string;card_id:string;status:string;total_amount:number;paid_amount:number;due_date:string|null;reference_month:string};

const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const keyOf=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
const validKey=(value:string|null)=>Boolean(value&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value));
function bounds(key:string){const [year,month]=key.split("-").map(Number);return {start:`${key}-01`,end:iso(new Date(year,month,0)),date:new Date(year,month-1,1)};}

export function FinanceOverviewV522({institutional}:{institutional:boolean}){
 const {supabase,user,profile}=useAuth();
 const today=new Date(),todayKey=keyOf(today),todayIso=iso(today);
 const [periodKey,setPeriodKey]=useState(todayKey),[ready,setReady]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [items,setItems]=useState<Transaction[]>([]),[accounts,setAccounts]=useState<Account[]>([]),[entries,setEntries]=useState<Entry[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]);
 const period=useMemo(()=>bounds(periodKey),[periodKey]);
 const isCurrentMonth=periodKey===todayKey;
 const balanceCutoff=isCurrentMonth?todayIso:period.end;
 const monthLabel=useMemo(()=>new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(period.date),[period.date]);

 useEffect(()=>{
  const sync=()=>{const value=new URLSearchParams(window.location.search).get("mes");setPeriodKey(validKey(value)?value!:todayKey);setReady(true)};
  sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);
 },[todayKey]);

 const changePeriod=useCallback((key:string)=>{setPeriodKey(key);const url=new URL(window.location.href);url.searchParams.set("mes",key);window.history.pushState({},"",`${url.pathname}?${url.searchParams.toString()}${url.hash}`)},[]);

 const load=useCallback(async()=>{
  if(!user||!ready)return;
  setLoading(true);setError("");
  const [t,a,e,i]=await Promise.all([
   supabase.from("transactions").select("*").gte("occurred_on",period.start).lte("occurred_on",period.end).order("occurred_on",{ascending:true}).order("created_at",{ascending:true}),
   supabase.from("financial_accounts").select("id,name,institution,opening_balance,current_balance,include_in_total,is_active,created_at").order("created_at",{ascending:true}),
   supabase.from("financial_account_entries").select("account_id,entry_type,amount,occurred_on").lte("occurred_on",balanceCutoff).order("occurred_on",{ascending:true}),
   supabase.from("card_invoices").select("id,card_id,status,total_amount,paid_amount,due_date,reference_month").eq("reference_month",period.start).order("due_date",{ascending:true}),
  ]);
  if(t.error||a.error||e.error||i.error)setError(t.error?.message||a.error?.message||e.error?.message||i.error?.message||"Falha ao carregar o período.");
  setItems((t.data??[]) as Transaction[]);setAccounts((a.data??[]) as Account[]);setEntries((e.data??[]) as Entry[]);setInvoices((i.data??[]) as Invoice[]);setLoading(false);
 },[balanceCutoff,period.end,period.start,ready,supabase,user]);

 useEffect(()=>{void load();if(!user||!ready)return;const channel=supabase.channel(`equity-period-${user.id}-${periodKey}`).on("postgres_changes",{event:"*",schema:"public",table:"transactions"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"financial_accounts"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"financial_account_entries"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"card_invoices"},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel)}},[load,periodKey,ready,supabase,user]);

 const visibleAccounts=useMemo(()=>accounts.filter(a=>a.created_at.slice(0,10)<=balanceCutoff&&(isCurrentMonth?a.is_active:true)),[accounts,balanceCutoff,isCurrentMonth]);
 const balanceByAccount=useMemo(()=>{const map=new Map<string,number>();for(const account of visibleAccounts){if(isCurrentMonth){map.set(account.id,Number(account.current_balance||0));continue}const own=entries.filter(e=>e.account_id===account.id),hasOpening=own.some(e=>e.entry_type==="OPENING"),sum=own.reduce((s,e)=>s+Number(e.amount||0),0);map.set(account.id,(hasOpening?0:Number(account.opening_balance||0))+sum)}return map},[entries,isCurrentMonth,visibleAccounts]);
 const totalBalance=useMemo(()=>visibleAccounts.filter(a=>a.include_in_total!==false).reduce((s,a)=>s+(balanceByAccount.get(a.id)||0),0),[balanceByAccount,visibleAccounts]);
 const totals=useMemo(()=>{const income=items.filter(x=>x.type==="INCOME").reduce((s,x)=>s+Number(x.amount),0),expense=items.filter(x=>x.type==="EXPENSE").reduce((s,x)=>s+Number(x.amount),0);return{income,expense,balance:income-expense}},[items]);
 const invoiceTotal=useMemo(()=>invoices.reduce((s,i)=>s+Number(i.total_amount||0),0),[invoices]);
 const invoiceOpen=useMemo(()=>invoices.reduce((s,i)=>s+Math.max(0,Number(i.total_amount||0)-Number(i.paid_amount||0)),0),[invoices]);
 const cats=useMemo(()=>{const map=new Map<string,number>();items.filter(x=>x.type==="EXPENSE").forEach(x=>{const key=institutional?x.cost_center||"Sem centro":x.category||"Outros";map.set(key,(map.get(key)||0)+Number(x.amount))});return[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)},[institutional,items]);
 const max=Math.max(...cats.map(x=>x[1]),1);

 if(!ready)return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">Preparando visão mensal...</div>;
 return <div className="space-y-7">
  {isCurrentMonth&&<UpcomingAlertsBanner/>}
  <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9b772c]">{institutional?"Equity One Negócios":"Equity One Pessoal"}</p><h1 className="mt-2 text-3xl font-black tracking-[-.03em] text-[#101116] md:text-4xl">Olá, {profile?.full_name?.split(" ")[0]||"bem-vindo"}.</h1><p className="mt-2 text-sm text-slate-500">Escolha o mês para analisar toda a sua vida financeira naquele período.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><MonthNavigator value={periodKey} onChange={changePeriod} todayKey={todayKey}/><Link href="/dashboard/lancamentos"><Button className="rounded-xl bg-[#101116]">Novo lançamento</Button></Link></div></section>
  <div className="rounded-2xl border border-[#d2aa51]/15 bg-[#d2aa51]/5 px-5 py-3 text-sm text-slate-600"><b className="capitalize text-slate-900">{monthLabel}</b> · todos os valores abaixo respeitam este período{isCurrentMonth?" até hoje":""}.</div>
  {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Kpi title={isCurrentMonth?"Saldo das contas":"Saldo no fim do mês"} value={loading?"—":currency.format(totalBalance)} icon={Wallet} tone="gold" helper={`${visibleAccounts.length} conta(s) consideradas`}/><Kpi title="Receitas no mês" value={loading?"—":currency.format(totals.income)} icon={ArrowUpRight} tone="green" helper={`${items.filter(x=>x.type==="INCOME").length} lançamento(s)`}/><Kpi title="Despesas no mês" value={loading?"—":currency.format(totals.expense)} icon={ArrowDownRight} tone="red" helper={`${items.filter(x=>x.type==="EXPENSE").length} lançamento(s)`}/><Kpi title="Faturas do mês" value={loading?"—":currency.format(invoiceTotal)} icon={CreditCard} tone="slate" helper={`${invoices.length} fatura(s) · ${currency.format(invoiceOpen)} pendente`}/></section>

  {visibleAccounts.length>0&&<Card className="equity-card border-0"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="capitalize">Saldo das contas · {monthLabel}</CardTitle><p className="mt-1 text-sm text-slate-500">{isCurrentMonth?"Onde seu dinheiro está agora.":`Posição reconstruída até ${period.end.split("-").reverse().join("/")}.`}</p></div><Link href="/dashboard/contas-financeiras" className="text-sm font-bold text-[#9b772c]">Gerenciar</Link></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleAccounts.slice(0,6).map(a=><div key={a.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#d2aa51]/10 text-[#9b772c]"><Landmark className="size-4"/></span><div><p className="text-sm font-black">{a.name}</p><p className="text-xs text-slate-400">{a.institution||"Conta financeira"}</p></div></div><p className="text-sm font-black">{currency.format(balanceByAccount.get(a.id)||0)}</p></div>)}</CardContent></Card>}

  <section className="grid gap-6 xl:grid-cols-[1.45fr_.75fr]"><MonthlyCashFlowChart items={items} periodKey={periodKey} title={institutional?"Fluxo de caixa do mês":"Evolução do mês"} description={`Entradas, saídas e resultado dentro de ${monthLabel}.`}/><Card className="equity-card border-0 bg-[#0d0f13] text-white"><CardHeader><CardTitle className="text-white">Distribuição de despesas</CardTitle><p className="text-sm text-slate-500 capitalize">Principais grupos de {monthLabel}.</p></CardHeader><CardContent>{cats.length===0?<div className="grid min-h-56 place-items-center text-center text-sm text-slate-500">Nenhuma despesa registrada neste mês.</div>:<div className="space-y-5">{cats.map(([name,value])=><div key={name}><div className="mb-2 flex justify-between gap-3"><span className="truncate text-sm font-bold text-slate-300">{name}</span><span className="text-xs font-black text-[#dec071]">{currency.format(value)}</span></div><div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#c9a34d]" style={{width:`${Math.max(6,value/max*100)}%`}}/></div></div>)}</div>}</CardContent></Card></section>
  <ActivityTimeline items={items} title={institutional?"Linha do tempo do negócio":"Linha do tempo financeira"} description={`Movimentações registradas em ${monthLabel}.`}/>
  <section className="flex justify-end"><Link href="/dashboard/lancamentos" className="flex items-center gap-1 text-sm font-bold text-[#9b772c]">Ver todos os lançamentos<ChevronRight className="size-4"/></Link></section>
 </div>
}

function Kpi({title,value,icon:Icon,tone,helper}:{title:string;value:string;icon:any;tone:"gold"|"green"|"red"|"slate";helper:string}){const cls={gold:"bg-[#c9a34d]/12 text-[#98742b]",green:"bg-emerald-50 text-emerald-700",red:"bg-rose-50 text-rose-700",slate:"bg-slate-100 text-slate-700"}[tone];return <div className="equity-card rounded-3xl bg-white p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">{title}</p><p className="mt-3 text-2xl font-black tracking-tight">{value}</p></div><span className={`grid size-11 place-items-center rounded-2xl ${cls}`}><Icon className="size-5"/></span></div><p className="mt-5 text-xs text-slate-400">{helper}</p></div>}
