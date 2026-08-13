"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, Landmark, Plus, WalletCards } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { currency } from "@/lib/finance";

const accountTypes: Record<string,string> = {
  CHECKING:"Conta corrente", SAVINGS:"Poupança", WALLET:"Carteira digital", CASH:"Dinheiro",
  INVESTMENT:"Investimentos", PAYMENT:"Conta de pagamento", OTHER:"Outra",
};

type Account = {
  id:string; name:string; institution:string|null; account_type:string;
  opening_balance:number; current_balance:number; is_active:boolean; include_in_total:boolean;
};

type Entry = {id:string;account_id:string;entry_type:string;amount:number;description:string;occurred_on:string;created_at:string};

function toNumber(value:string){ return Number((value||"0").replace(/\./g,"").replace(",",".")) || 0; }

export function FinancialAccountsManager(){
  const {supabase,user}=useAuth();
  const [accounts,setAccounts]=useState<Account[]>([]),[entries,setEntries]=useState<Entry[]>([]);
  const [open,setOpen]=useState(false),[transferOpen,setTransferOpen]=useState(false),[adjustOpen,setAdjustOpen]=useState<string|null>(null);
  const [form,setForm]=useState<Record<string,string>>({account_type:"CHECKING"}),[transfer,setTransfer]=useState<Record<string,string>>({}),[adjust,setAdjust]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!user)return; setLoading(true); setError("");
    const [a,e]=await Promise.all([
      supabase.from("financial_accounts").select("*").order("created_at",{ascending:true}),
      supabase.from("financial_account_entries").select("*").order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(50),
    ]);
    if(a.error)setError(a.error.message); else setAccounts((a.data??[]) as Account[]);
    if(e.error && !String(e.error.message).includes("does not exist"))setError(e.error.message); else setEntries((e.data??[]) as Entry[]);
    setLoading(false);
  },[supabase,user]);
  useEffect(()=>{void load()},[load]);

  const total=useMemo(()=>accounts.filter(a=>a.is_active&&a.include_in_total).reduce((s,a)=>s+Number(a.current_balance||0),0),[accounts]);

  async function createAccount(ev:FormEvent){
    ev.preventDefault(); if(!user)return; setSaving(true);setError("");
    const opening=toNumber(form.opening_balance||"0");
    const {data,error}=await supabase.from("financial_accounts").insert({user_id:user.id,name:form.name,institution:form.institution||null,account_type:form.account_type||"CHECKING",opening_balance:opening,current_balance:opening,is_active:true,include_in_total:true}).select("id").single();
    if(error){setError(error.message);setSaving(false);return;}
    if(opening!==0) {
      const {error:entryError}=await supabase.from("financial_account_entries").insert({user_id:user.id,account_id:data.id,entry_type:"OPENING",amount:opening,description:"Saldo inicial",occurred_on:new Date().toISOString().slice(0,10)});
      if(entryError){setError(entryError.message);setSaving(false);return;}
    }
    setForm({account_type:"CHECKING"});setOpen(false);setSaving(false);await load();
  }

  async function saveAdjustment(ev:FormEvent){
    ev.preventDefault(); if(!user||!adjustOpen)return; setSaving(true);setError("");
    const amount=toNumber(adjust.amount||"0")*(adjust.direction==="OUT"?-1:1);
    const account=accounts.find(a=>a.id===adjustOpen); if(!account||amount===0){setSaving(false);return;}
    const {error:e1}=await supabase.from("financial_account_entries").insert({user_id:user.id,account_id:account.id,entry_type:"ADJUSTMENT",amount,description:adjust.description||"Ajuste de saldo",occurred_on:adjust.date||new Date().toISOString().slice(0,10)});
    if(e1){setError(e1.message);setSaving(false);return;}
    const {error:e2}=await supabase.from("financial_accounts").update({current_balance:Number(account.current_balance)+amount,updated_at:new Date().toISOString()}).eq("id",account.id);
    if(e2)setError(e2.message); else {setAdjust({});setAdjustOpen(null);await load();}
    setSaving(false);
  }

  async function saveTransfer(ev:FormEvent){
    ev.preventDefault(); if(!user)return; const amount=toNumber(transfer.amount||"0");
    const from=accounts.find(a=>a.id===transfer.from),to=accounts.find(a=>a.id===transfer.to);
    if(!from||!to||from.id===to.id||amount<=0){setError("Selecione contas diferentes e um valor válido.");return;}
    setSaving(true);setError(""); const date=transfer.date||new Date().toISOString().slice(0,10); const description=transfer.description||"Transferência entre contas";
    const {data:t,error:te}=await supabase.from("account_transfers").insert({user_id:user.id,from_account_id:from.id,to_account_id:to.id,amount,occurred_on:date,description}).select("id").single();
    if(te){setError(te.message);setSaving(false);return;}
    const {error:ee}=await supabase.from("financial_account_entries").insert([
      {user_id:user.id,account_id:from.id,entry_type:"TRANSFER_OUT",amount:-amount,description,occurred_on:date,metadata:{transfer_id:t.id}},
      {user_id:user.id,account_id:to.id,entry_type:"TRANSFER_IN",amount,description,occurred_on:date,metadata:{transfer_id:t.id}},
    ]);
    if(ee){setError(ee.message);setSaving(false);return;}
    const [u1,u2]=await Promise.all([
      supabase.from("financial_accounts").update({current_balance:Number(from.current_balance)-amount,updated_at:new Date().toISOString()}).eq("id",from.id),
      supabase.from("financial_accounts").update({current_balance:Number(to.current_balance)+amount,updated_at:new Date().toISOString()}).eq("id",to.id),
    ]);
    if(u1.error||u2.error)setError(u1.error?.message||u2.error?.message||"Falha ao atualizar saldos."); else {setTransfer({});setTransferOpen(false);await load();}
    setSaving(false);
  }

  return <div className="space-y-7">
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9b772c]">Fundação financeira</p><h1 className="mt-2 text-3xl font-black tracking-tight">Contas financeiras</h1><p className="mt-2 text-sm text-slate-500">Veja onde seu dinheiro está, mantenha saldos por conta e faça transferências internas.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>setTransferOpen(v=>!v)}><ArrowLeftRight className="size-4"/>Transferir</Button><Button onClick={()=>setOpen(v=>!v)} className="bg-[#101116]"><Plus className="size-4"/>Nova conta</Button></div></section>

    {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

    <section className="grid gap-4 md:grid-cols-3"><Card className="border-0"><CardContent className="p-6"><p className="text-sm text-slate-500">Saldo total das contas</p><p className="mt-2 text-3xl font-black">{loading?"—":currency.format(total)}</p></CardContent></Card><Card className="border-0"><CardContent className="p-6"><p className="text-sm text-slate-500">Contas ativas</p><p className="mt-2 text-3xl font-black">{accounts.filter(a=>a.is_active).length}</p></CardContent></Card><Card className="border-0"><CardContent className="p-6"><p className="text-sm text-slate-500">Movimentações recentes</p><p className="mt-2 text-3xl font-black">{entries.length}</p></CardContent></Card></section>

    {open&&<Card><CardHeader><CardTitle>Adicionar conta financeira</CardTitle></CardHeader><CardContent><form onSubmit={createAccount} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Nome"><Input required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Nubank principal"/></Field><Field label="Instituição"><Input value={form.institution||""} onChange={e=>setForm({...form,institution:e.target.value})} placeholder="Nubank, Itaú, Santander..."/></Field><Field label="Tipo"><Select value={form.account_type||"CHECKING"} onChange={e=>setForm({...form,account_type:e.target.value})}>{Object.entries(accountTypes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></Field><Field label="Saldo atual / inicial"><Input inputMode="decimal" value={form.opening_balance||""} onChange={e=>setForm({...form,opening_balance:e.target.value})} placeholder="0,00"/></Field><div className="md:col-span-2 xl:col-span-4 flex justify-end"><Button type="submit" disabled={saving}>{saving?"Salvando...":"Salvar conta"}</Button></div></form></CardContent></Card>}

    {transferOpen&&<Card><CardHeader><CardTitle>Transferência entre contas</CardTitle></CardHeader><CardContent><form onSubmit={saveTransfer} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Field label="Conta de origem"><Select required value={transfer.from||""} onChange={e=>setTransfer({...transfer,from:e.target.value})}><option value="">Selecione</option>{accounts.filter(a=>a.is_active).map(a=><option key={a.id} value={a.id}>{a.name} · {currency.format(Number(a.current_balance))}</option>)}</Select></Field><Field label="Conta de destino"><Select required value={transfer.to||""} onChange={e=>setTransfer({...transfer,to:e.target.value})}><option value="">Selecione</option>{accounts.filter(a=>a.is_active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field><Field label="Valor"><Input required inputMode="decimal" value={transfer.amount||""} onChange={e=>setTransfer({...transfer,amount:e.target.value})}/></Field><Field label="Data"><Input type="date" value={transfer.date||new Date().toISOString().slice(0,10)} onChange={e=>setTransfer({...transfer,date:e.target.value})}/></Field><Field label="Descrição"><Input value={transfer.description||""} onChange={e=>setTransfer({...transfer,description:e.target.value})}/></Field><div className="md:col-span-2 xl:col-span-5 flex justify-end"><Button type="submit" disabled={saving}>Confirmar transferência</Button></div></form></CardContent></Card>}

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{accounts.map(a=><Card key={a.id} className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]"><CardContent className="p-6"><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-[#d2aa51]/10 text-[#9b772c]"><Landmark className="size-5"/></span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${a.is_active?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{a.is_active?"Ativa":"Inativa"}</span></div><h3 className="mt-5 text-lg font-black">{a.name}</h3><p className="text-sm text-slate-500">{a.institution||accountTypes[a.account_type]||a.account_type}</p><p className="mt-5 text-2xl font-black">{currency.format(Number(a.current_balance||0))}</p><p className="mt-1 text-xs text-slate-400">Saldo inicial: {currency.format(Number(a.opening_balance||0))}</p><Button variant="outline" className="mt-5 w-full" onClick={()=>setAdjustOpen(adjustOpen===a.id?null:a.id)}>Ajustar saldo</Button>{adjustOpen===a.id&&<form onSubmit={saveAdjustment} className="mt-4 space-y-3"><Select value={adjust.direction||"IN"} onChange={e=>setAdjust({...adjust,direction:e.target.value})}><option value="IN">Adicionar ao saldo</option><option value="OUT">Retirar do saldo</option></Select><Input required inputMode="decimal" placeholder="Valor" value={adjust.amount||""} onChange={e=>setAdjust({...adjust,amount:e.target.value})}/><Input placeholder="Motivo do ajuste" value={adjust.description||""} onChange={e=>setAdjust({...adjust,description:e.target.value})}/><Button type="submit" disabled={saving} className="w-full">Salvar ajuste</Button></form>}</CardContent></Card>)}</section>

    {accounts.length===0&&!loading&&<Card className="border-0"><CardContent className="grid min-h-64 place-items-center text-center"><div><WalletCards className="mx-auto size-10 text-slate-300"/><h3 className="mt-4 font-black">Nenhuma conta financeira cadastrada</h3><p className="mt-2 text-sm text-slate-500">Cadastre banco, carteira ou dinheiro para o Equity One começar a controlar saldos reais.</p></div></CardContent></Card>}

    {entries.length>0&&<Card className="border-0"><CardHeader><CardTitle>Últimas movimentações das contas</CardTitle></CardHeader><CardContent className="divide-y divide-slate-100">{entries.slice(0,12).map(e=><div key={e.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-bold">{e.description}</p><p className="text-xs text-slate-400">{e.occurred_on.split("-").reverse().join("/")}</p></div><span className={`text-sm font-black ${Number(e.amount)>=0?"text-emerald-700":"text-rose-700"}`}>{Number(e.amount)>=0?"+":""}{currency.format(Number(e.amount))}</span></div>)}</CardContent></Card>}
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>}
