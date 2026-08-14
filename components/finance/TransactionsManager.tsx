"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Plus, ReceiptText, Search, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput, brlInputToNumber } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/ui/side-panel";
import { EmptyState } from "./EmptyState";
import { currency, dateBR, type Transaction, type TransactionType } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { CategoryMultiSelect } from "./CategoryMultiSelect";
import { SmartFinancialInput } from "@/components/ai/SmartFinancialInput";

type FinancialAccount = { id:string; name:string; institution:string|null; current_balance:number };
type ExtendedTransaction = Transaction & { account_id?:string|null; payment_method?:string|null };

const paymentPt:Record<string,string>={PIX:"PIX",DEBIT:"Débito",CASH:"Dinheiro",TRANSFER:"Transferência",BOLETO:"Boleto",OTHER:"Outro"};
const initialForm = {
  description: "",
  amount: "",
  type: "EXPENSE" as TransactionType,
  categories: [] as string[],
  cost_center: "",
  occurred_on: new Date().toISOString().slice(0, 10),
  notes: "",
  account_id: "",
  payment_method: "PIX",
};

export function TransactionsManager({ institutional=false, compact=false }: { institutional?:boolean; compact?:boolean }) {
  const { supabase, user } = useAuth();
  const [items,setItems] = useState<ExtendedTransaction[]>([]);
  const [accounts,setAccounts] = useState<FinancialAccount[]>([]);
  const [form,setForm] = useState(initialForm);
  const [open,setOpen] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [deleting,setDeleting] = useState(false);
  const [search,setSearch] = useState("");
  const [error,setError] = useState("");
  const [selected,setSelected] = useState<ExtendedTransaction|null>(null);

  const load = useCallback(async()=>{
    if(!user)return;
    setLoading(true);
    const [transactionsResult,accountsResult] = await Promise.all([
      supabase.from("transactions").select("*").order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(compact?6:100),
      supabase.from("financial_accounts").select("id,name,institution,current_balance").eq("is_active",true).order("name"),
    ]);
    if(transactionsResult.error)setError(transactionsResult.error.message); else setItems((transactionsResult.data??[]) as ExtendedTransaction[]);
    if(!accountsResult.error)setAccounts((accountsResult.data??[]) as FinancialAccount[]);
    setLoading(false);
  },[compact,supabase,user]);

  useEffect(()=>{void load()},[load]);

  const filtered = useMemo(()=>{
    const query=search.trim().toLowerCase();
    if(!query)return items;
    return items.filter(item=>[item.description,item.category,...(item.categories??[]),item.cost_center??"",accounts.find(a=>a.id===item.account_id)?.name??""].join(" ").toLowerCase().includes(query));
  },[items,search,accounts]);

  const save = async(event:FormEvent)=>{
    event.preventDefault(); if(!user)return;
    setSaving(true); setError("");
    const amount=brlInputToNumber(form.amount);
    if(!Number.isFinite(amount)||amount<=0){setError("Informe um valor válido.");setSaving(false);return;}

    const {data:created,error:insertError}=await supabase.from("transactions").insert({
      user_id:user.id,
      description:form.description.trim(),
      amount,
      type:form.type,
      category:form.categories[0]||"Outros",
      categories:form.categories.length?form.categories:["Outros"],
      cost_center:institutional?form.cost_center.trim()||null:null,
      occurred_on:form.occurred_on,
      notes:form.notes.trim()||null,
      account_id:form.account_id||null,
      payment_method:form.payment_method||null,
      transaction_status:"POSTED",
    }).select("id").single();

    if(insertError){setError(insertError.message);setSaving(false);return;}

    if(form.account_id){
      const account=accounts.find(a=>a.id===form.account_id);
      const signed=form.type==="INCOME"?amount:-amount;
      const {error:entryError}=await supabase.from("financial_account_entries").insert({
        user_id:user.id,account_id:form.account_id,entry_type:form.type,amount:signed,
        description:form.description.trim(),occurred_on:form.occurred_on,metadata:{transaction_id:created.id,payment_method:form.payment_method},
      });
      if(entryError){setError(`Lançamento salvo, mas o saldo da conta não foi atualizado: ${entryError.message}`);setSaving(false);await load();return;}
      if(account){
        const {error:balanceError}=await supabase.from("financial_accounts").update({current_balance:Number(account.current_balance)+signed,updated_at:new Date().toISOString()}).eq("id",account.id);
        if(balanceError){setError(`Lançamento salvo, mas houve erro ao atualizar o saldo: ${balanceError.message}`);setSaving(false);await load();return;}
      }
    }

    setForm(initialForm);setOpen(false);setSaving(false);await load();
  };

  const remove=async(item:ExtendedTransaction)=>{
    if(deleting)return;
    if(!window.confirm(`Excluir apenas este registro de ${currency.format(Number(item.amount))}? O efeito financeiro será desfeito automaticamente.`))return;
    setDeleting(true);setError("");
    const {error}=await supabase.rpc("equity_delete_financial_record",{p_kind:"TRANSACTION",p_record_id:item.id});
    if(error)setError(error.message);else{setSelected(null);await load();}
    setDeleting(false);
  };

  const selectedAccount=selected?accounts.find(a=>a.id===selected.account_id):null;

  return <>
  <Card className="border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
    <CardHeader className="gap-4 border-b border-slate-100 md:flex-row md:items-center md:justify-between">
      <div><CardTitle>{compact?"Últimos lançamentos":"Lançamentos financeiros"}</CardTitle><p className="mt-2 text-sm text-slate-500">Registre receitas e despesas e, quando escolher uma conta, o saldo é atualizado automaticamente.</p></div>
      <Button onClick={()=>setOpen(v=>!v)}>{open?<X className="size-4"/>:<Plus className="size-4"/>}{open?"Fechar":"Novo lançamento"}</Button>
    </CardHeader>
    <CardContent className="p-6">
      {!compact&&<div className="mb-7"><SmartFinancialInput product={institutional?"BUSINESS":"PERSONAL"} institutional={institutional} onSaved={load}/></div>}
      {error&&<div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {open&&<form onSubmit={save} className="mb-7 grid gap-4 rounded-2xl border border-[#d2aa51]/20 bg-[#d2aa51]/5 p-5 md:grid-cols-2 xl:grid-cols-4">
        <label className="xl:col-span-2"><Label>Descrição</Label><Input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ex.: Pagamento de cliente"/></label>
        <label><Label>Valor</Label><MoneyInput required value={form.amount} onValueChange={amount=>setForm({...form,amount})}/></label>
        <label><Label>Tipo</Label><Select value={form.type} onChange={e=>setForm({...form,type:e.target.value as TransactionType,categories:[]})}><option value="INCOME">Receita</option><option value="EXPENSE">Despesa</option></Select></label>
        <div className="xl:col-span-2"><Label>Categoria(s)</Label><CategoryMultiSelect institutional={institutional} type={form.type} value={form.categories} onChange={categories=>setForm({...form,categories})}/></div>
        <label><Label>Conta financeira</Label><Select value={form.account_id} onChange={e=>setForm({...form,account_id:e.target.value})}><option value="">Sem conta vinculada</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {currency.format(Number(a.current_balance))}</option>)}</Select></label>
        <label><Label>Forma de pagamento</Label><Select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}><option value="PIX">PIX</option><option value="DEBIT">Débito</option><option value="CASH">Dinheiro</option><option value="TRANSFER">Transferência</option><option value="BOLETO">Boleto</option><option value="OTHER">Outro</option></Select></label>
        {institutional&&<label><Label>Centro de custo</Label><Input value={form.cost_center} onChange={e=>setForm({...form,cost_center:e.target.value})} placeholder="Ex.: Marketing"/></label>}
        <label><Label>Data</Label><Input type="date" required value={form.occurred_on} onChange={e=>setForm({...form,occurred_on:e.target.value})}/></label>
        <label className={institutional?"":"md:col-span-2"}><Label>Observação</Label><Textarea className="min-h-11" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Opcional"/></label>
        <div className="flex items-end"><Button type="submit" className="w-full" disabled={saving}>{saving?"Salvando...":"Salvar lançamento"}</Button></div>
      </form>}

      {!compact&&items.length>0&&<div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 px-3"><Search className="size-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar descrição, categoria, conta ou centro de custo..." className="h-11 w-full bg-transparent text-sm outline-none"/></div>}

      {loading?<div className="py-16 text-center text-sm text-slate-500">Carregando lançamentos...</div>:filtered.length===0?<EmptyState icon={ReceiptText} title="Nenhum lançamento registrado" description="Clique em “Novo lançamento” para registrar sua primeira receita ou despesa."/>:<div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400"><th className="pb-3 font-bold">Lançamento</th><th className="pb-3 font-bold">Categoria</th><th className="pb-3 font-bold">Conta</th>{institutional&&<th className="pb-3 font-bold">Centro de custo</th>}<th className="pb-3 font-bold">Data</th><th className="pb-3 text-right font-bold">Valor</th>{!compact&&<th className="pb-3 text-right font-bold">Ações</th>}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(item=>{const income=item.type==="INCOME";const account=accounts.find(a=>a.id===item.account_id);return <tr key={item.id} onClick={()=>setSelected(item)} className="cursor-pointer transition hover:bg-slate-50"><td className="py-4"><div className="flex items-center gap-3"><span className={cn("grid size-10 place-items-center rounded-xl",income?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700")}>{income?<ArrowUpRight className="size-4"/>:<ArrowDownLeft className="size-4"/>}</span><div><p className="text-sm font-bold text-slate-900">{item.description}</p>{item.payment_method&&<p className="mt-0.5 text-xs text-slate-400">{paymentPt[item.payment_method]||"Outro"}</p>}</div></div></td><td className="py-4"><div className="flex max-w-xs flex-wrap gap-1.5">{(item.categories?.length?item.categories:[item.category]).map((category,index)=><span key={`${item.id}-${category}`} className={`rounded-full px-2.5 py-1 text-xs font-bold ${index===0?"bg-[#d2aa51]/10 text-[#8b6926]":"bg-slate-100 text-slate-600"}`}>{category}</span>)}</div></td><td className="py-4 text-sm text-slate-600">{account?.name||"—"}</td>{institutional&&<td className="py-4 text-sm text-slate-600">{item.cost_center||"—"}</td>}<td className="py-4 text-sm text-slate-500">{dateBR.format(new Date(`${item.occurred_on}T12:00:00`))}</td><td className={cn("py-4 text-right text-sm font-black",income?"text-emerald-700":"text-rose-700")}>{income?"+":"-"} {currency.format(Number(item.amount))}</td>{!compact&&<td className="py-4 text-right"><button type="button" onClick={e=>{e.stopPropagation();setSelected(item)}} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"><MoreHorizontal className="size-4"/></button></td>}</tr>})}</tbody></table></div>}
    </CardContent>
  </Card>

  <SidePanel open={!!selected} onClose={()=>setSelected(null)} title={selected?.description||"Lançamento"} subtitle={selected?.type==="INCOME"?"Receita":"Despesa"} footer={selected?<div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>setSelected(null)}>Fechar</Button><Button type="button" className="flex-1 bg-rose-600 text-white hover:bg-rose-700" disabled={deleting} onClick={()=>void remove(selected)}><Trash2 className="size-4"/>{deleting?"Excluindo...":"Excluir registro"}</Button></div>:undefined}>
    {selected&&<div className="space-y-5">
      <div className={cn("rounded-3xl p-6 text-white",selected.type==="INCOME"?"bg-emerald-600":"bg-rose-600")}><p className="text-sm opacity-80">Valor</p><p className="mt-2 text-4xl font-black">{selected.type==="INCOME"?"+":"-"} {currency.format(Number(selected.amount))}</p></div>
      <Detail label="Data" value={dateBR.format(new Date(`${selected.occurred_on}T12:00:00`))}/>
      <Detail label="Conta" value={selectedAccount?`${selectedAccount.institution?selectedAccount.institution+" · ":""}${selectedAccount.name}`:"Sem conta vinculada"}/>
      <Detail label="Forma de pagamento" value={selected.payment_method?paymentPt[selected.payment_method]||"Outro":"Não informada"}/>
      <Detail label="Categoria principal" value={selected.category||"Outros"}/>
      {selected.categories?.length>1&&<Detail label="Categorias associadas" value={selected.categories.slice(1).join(", ")}/>} 
      {institutional&&<Detail label="Centro de custo" value={selected.cost_center||"Não informado"}/>} 
      {selected.notes&&<Detail label="Observação" value={selected.notes}/>} 
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Ao excluir este registro, o Equity One desfaz automaticamente o efeito no saldo da conta vinculada.</div>
    </div>}
  </SidePanel>
  </>;
}

function Detail({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>}
function Label({children}:{children:React.ReactNode}){return <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{children}</span>}
