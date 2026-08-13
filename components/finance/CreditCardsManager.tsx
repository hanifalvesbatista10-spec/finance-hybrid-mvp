"use client";

import { useCallback,useEffect,useMemo,useState,type FormEvent } from "react";
import { CreditCard,Plus,ReceiptText,ShoppingBag,Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { currency } from "@/lib/finance";

type BankAccount={id:string;name:string;institution:string|null;current_balance:number};
type UserCard={id:string;nickname:string;brand:string;issuer:string|null;last_four:string;credit_limit:number;current_invoice:number;closing_day:number;due_day:number;payment_account_id:string|null;is_active:boolean};
type Invoice={id:string;card_id:string;reference_month:string;closing_date:string|null;due_date:string|null;status:string;total_amount:number;paid_amount:number;payment_account_id?:string|null};
type Installment={id:string;purchase_id:string;card_id:string;invoice_id:string|null;installment_number:number;installment_count:number;amount:number;due_month:string;status:string};

function moneyValue(v:string){return Number((v||"0").replace(/\./g,"").replace(",","."))||0}
function firstDay(d:Date){return new Date(d.getFullYear(),d.getMonth(),1)}
function addMonths(d:Date,n:number){return new Date(d.getFullYear(),d.getMonth()+n,1)}
function isoDate(d:Date){return d.toISOString().slice(0,10)}
function daysInMonth(year:number,month:number){return new Date(year,month+1,0).getDate()}
function safeDay(year:number,month:number,day:number){return new Date(year,month,Math.min(Math.max(day,1),daysInMonth(year,month)))}

function firstInvoiceMonth(card:UserCard,purchaseDate:Date){
  const y=purchaseDate.getFullYear(),m=purchaseDate.getMonth(),day=purchaseDate.getDate();
  const closed=day>Number(card.closing_day||1);
  const baseMonth=closed?m+1:m;
  const dueAfterClose=Number(card.due_day||1)>Number(card.closing_day||1);
  const dueMonth=dueAfterClose?baseMonth:baseMonth+1;
  return new Date(y,dueMonth,1);
}

export function CreditCardsManager(){
  const {supabase,user}=useAuth();
  const [cards,setCards]=useState<UserCard[]>([]),[accounts,setAccounts]=useState<BankAccount[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[installments,setInstallments]=useState<Installment[]>([]);
  const [open,setOpen]=useState(false),[purchaseOpen,setPurchaseOpen]=useState(false),[selected,setSelected]=useState<string|null>(null);
  const [form,setForm]=useState<Record<string,string>>({brand:"Mastercard"}),[purchase,setPurchase]=useState<Record<string,string>>({installments:"1",purchase_date:new Date().toISOString().slice(0,10)}),[payment,setPayment]=useState<Record<string,string>>({});
  const [error,setError]=useState(""),[saving,setSaving]=useState(false);

  const load=useCallback(async()=>{if(!user)return;const [c,a,i,p]=await Promise.all([
    supabase.from("cards").select("*").order("created_at",{ascending:false}),
    supabase.from("financial_accounts").select("id,name,institution,current_balance").eq("is_active",true).order("name"),
    supabase.from("card_invoices").select("*").order("reference_month",{ascending:false}),
    supabase.from("card_installments").select("*").order("due_month",{ascending:true}),
  ]);if(c.error)setError(c.error.message);else setCards((c.data??[]) as UserCard[]);if(!a.error)setAccounts((a.data??[]) as BankAccount[]);if(!i.error)setInvoices((i.data??[]) as Invoice[]);if(!p.error)setInstallments((p.data??[]) as Installment[])},[supabase,user]);
  useEffect(()=>{void load()},[load]);

  const summary=useMemo(()=>{const active=cards.filter(c=>c.is_active!==false);const limit=active.reduce((s,c)=>s+Number(c.credit_limit||0),0);const invoice=invoices.filter(i=>["OPEN","CLOSED","OVERDUE"].includes(i.status)).reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0);return{limit,invoice,available:Math.max(0,limit-invoice)}},[cards,invoices]);

  async function save(ev:FormEvent){ev.preventDefault();if(!user)return;setSaving(true);setError("");const {error}=await supabase.from("cards").insert({user_id:user.id,nickname:form.nickname,brand:form.brand||"Outro",issuer:form.issuer||null,last_four:form.last_four,credit_limit:moneyValue(form.credit_limit),current_invoice:0,closing_day:Number(form.closing_day||1),due_day:Number(form.due_day||1),payment_account_id:form.payment_account_id||null,is_active:true});if(error)setError(error.message);else{setForm({brand:"Mastercard"});setOpen(false);await load()}setSaving(false)}

  async function ensureInvoice(card:UserCard,month:Date){
    const reference=isoDate(firstDay(month));
    const existing=invoices.find(i=>i.card_id===card.id&&i.reference_month===reference);
    if(existing)return existing;
    const y=month.getFullYear(),m=month.getMonth();
    const due=isoDate(safeDay(y,m,card.due_day||1));
    const closingMonth=(card.due_day||1)>(card.closing_day||1)?m:m-1;
    const closing=isoDate(safeDay(y,closingMonth,card.closing_day||1));
    const {data,error}=await supabase.from("card_invoices").insert({user_id:user!.id,card_id:card.id,reference_month:reference,closing_date:closing,due_date:due,status:"OPEN",total_amount:0,paid_amount:0,payment_account_id:card.payment_account_id||null}).select("*").single();
    if(error)throw error;return data as Invoice;
  }

  async function savePurchase(ev:FormEvent){
    ev.preventDefault();if(!user)return;setSaving(true);setError("");
    try{
      const card=cards.find(c=>c.id===purchase.card_id);const total=moneyValue(purchase.total_amount);const count=Math.max(1,Math.min(48,Number(purchase.installments||1)));
      if(!card||total<=0)throw new Error("Selecione o cartão e informe um valor válido.");
      const outstanding=invoices.filter(i=>i.card_id===card.id&&["OPEN","CLOSED","OVERDUE"].includes(i.status)).reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0);
      if(outstanding+total>Number(card.credit_limit||0))throw new Error("Essa compra ultrapassa o limite disponível do cartão.");

      const purchaseDate=new Date(`${purchase.purchase_date||new Date().toISOString().slice(0,10)}T12:00:00`);
      const {data:created,error:purchaseError}=await supabase.from("card_purchases").insert({user_id:user.id,card_id:card.id,description:purchase.description,merchant:purchase.merchant||null,category:purchase.category||"Outros",total_amount:total,installments:count,purchase_date:purchase.purchase_date}).select("id").single();
      if(purchaseError)throw purchaseError;

      const baseAmount=Math.floor((total/count)*100)/100;
      const firstMonth=firstInvoiceMonth(card,purchaseDate);
      for(let n=0;n<count;n++){
        const month=addMonths(firstMonth,n);const invoice=await ensureInvoice(card,month);const amount=n===count-1?Number((total-baseAmount*(count-1)).toFixed(2)):baseAmount;
        const {error:instError}=await supabase.from("card_installments").insert({user_id:user.id,purchase_id:created.id,card_id:card.id,invoice_id:invoice.id,installment_number:n+1,installment_count:count,amount,due_month:isoDate(firstDay(month)),status:"OPEN"});if(instError)throw instError;
        const {error:invoiceError}=await supabase.from("card_invoices").update({total_amount:Number(invoice.total_amount||0)+amount,updated_at:new Date().toISOString()}).eq("id",invoice.id);if(invoiceError)throw invoiceError;
        invoice.total_amount=Number(invoice.total_amount||0)+amount;
      }
      setPurchase({installments:"1",purchase_date:new Date().toISOString().slice(0,10)});setPurchaseOpen(false);await load();
    }catch(e:any){setError(e?.message||"Não foi possível registrar a compra.")}finally{setSaving(false)}
  }

  async function payInvoice(invoice:Invoice){
    if(!user)return;const card=cards.find(c=>c.id===invoice.card_id);const accountId=payment[invoice.id]||invoice.payment_account_id||card?.payment_account_id||"";const account=accounts.find(a=>a.id===accountId);const due=Number(invoice.total_amount||0)-Number(invoice.paid_amount||0);
    if(!accountId||!account){setError("Selecione a conta que pagará a fatura.");return;}if(due<=0)return;
    if(!window.confirm(`Pagar ${currency.format(due)} da fatura usando ${account.name}?`))return;
    setSaving(true);setError("");
    try{
      const now=new Date().toISOString();
      const {error:entryError}=await supabase.from("financial_account_entries").insert({user_id:user.id,account_id:account.id,entry_type:"CARD_INVOICE_PAYMENT",amount:-due,description:`Pagamento de fatura ${card?.nickname||"cartão"}`,occurred_on:new Date().toISOString().slice(0,10),metadata:{invoice_id:invoice.id,card_id:invoice.card_id}});if(entryError)throw entryError;
      const {error:accountError}=await supabase.from("financial_accounts").update({current_balance:Number(account.current_balance)-due,updated_at:now}).eq("id",account.id);if(accountError)throw accountError;
      const {error:invoiceError}=await supabase.from("card_invoices").update({status:"PAID",paid_amount:Number(invoice.total_amount||0),paid_at:now,payment_account_id:account.id,updated_at:now}).eq("id",invoice.id);if(invoiceError)throw invoiceError;
      await supabase.from("card_installments").update({status:"PAID"}).eq("invoice_id",invoice.id);
      await load();
    }catch(e:any){setError(e?.message||"Não foi possível pagar a fatura.")}finally{setSaving(false)}
  }

  return <div className="space-y-7">
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9b772c]">Crédito e faturas</p><h1 className="mt-2 text-3xl font-black tracking-tight">Cartões e faturas</h1><p className="mt-2 text-sm text-slate-500">Compras, parcelas, limite, fechamento, vencimento e pagamento conectado às suas contas.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>setPurchaseOpen(v=>!v)}><ShoppingBag className="size-4"/>Nova compra</Button><Button onClick={()=>setOpen(v=>!v)} className="bg-[#101116]"><Plus className="size-4"/>Novo cartão</Button></div></section>
    {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <section className="grid gap-4 md:grid-cols-3"><Metric label="Limite total" value={summary.limit}/><Metric label="Em faturas" value={summary.invoice}/><Metric label="Limite disponível" value={summary.available}/></section>

    {open&&<Card><CardHeader><CardTitle>Novo cartão de crédito</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Nome do cartão"><Input required value={form.nickname||""} onChange={e=>setForm({...form,nickname:e.target.value})} placeholder="Ex.: Itaú Mastercard"/></Field><Field label="Banco / emissor"><Input value={form.issuer||""} onChange={e=>setForm({...form,issuer:e.target.value})} placeholder="Itaú"/></Field><Field label="Bandeira"><Select value={form.brand||"Mastercard"} onChange={e=>setForm({...form,brand:e.target.value})}><option>Mastercard</option><option>Visa</option><option>Elo</option><option>Amex</option><option>Hipercard</option><option>Outro</option></Select></Field><Field label="Últimos 4 dígitos"><Input required maxLength={4} pattern="[0-9]{4}" value={form.last_four||""} onChange={e=>setForm({...form,last_four:e.target.value})}/></Field><Field label="Limite"><Input required inputMode="decimal" value={form.credit_limit||""} onChange={e=>setForm({...form,credit_limit:e.target.value})}/></Field><Field label="Dia de fechamento"><Input required type="number" min="1" max="31" value={form.closing_day||""} onChange={e=>setForm({...form,closing_day:e.target.value})}/></Field><Field label="Dia de vencimento"><Input required type="number" min="1" max="31" value={form.due_day||""} onChange={e=>setForm({...form,due_day:e.target.value})}/></Field><Field label="Conta padrão para pagamento"><Select value={form.payment_account_id||""} onChange={e=>setForm({...form,payment_account_id:e.target.value})}><option value="">Nenhuma</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field><div className="md:col-span-2 xl:col-span-4 flex justify-end"><Button disabled={saving}>{saving?"Salvando...":"Salvar cartão"}</Button></div></form></CardContent></Card>}

    {purchaseOpen&&<Card><CardHeader><CardTitle>Registrar compra no cartão</CardTitle></CardHeader><CardContent><form onSubmit={savePurchase} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Cartão"><Select required value={purchase.card_id||""} onChange={e=>setPurchase({...purchase,card_id:e.target.value})}><option value="">Selecione</option>{cards.filter(c=>c.is_active!==false).map(c=><option key={c.id} value={c.id}>{c.nickname} · •••• {c.last_four}</option>)}</Select></Field><Field label="Descrição"><Input required value={purchase.description||""} onChange={e=>setPurchase({...purchase,description:e.target.value})} placeholder="Ex.: Notebook"/></Field><Field label="Valor total"><Input required inputMode="decimal" value={purchase.total_amount||""} onChange={e=>setPurchase({...purchase,total_amount:e.target.value})} placeholder="0,00"/></Field><Field label="Parcelas"><Input required type="number" min="1" max="48" value={purchase.installments||"1"} onChange={e=>setPurchase({...purchase,installments:e.target.value})}/></Field><Field label="Data da compra"><Input required type="date" value={purchase.purchase_date||""} onChange={e=>setPurchase({...purchase,purchase_date:e.target.value})}/></Field><Field label="Estabelecimento"><Input value={purchase.merchant||""} onChange={e=>setPurchase({...purchase,merchant:e.target.value})}/></Field><Field label="Categoria"><Input value={purchase.category||""} onChange={e=>setPurchase({...purchase,category:e.target.value})} placeholder="Ex.: Eletrônicos"/></Field><div className="flex items-end"><Button className="w-full" disabled={saving}>{saving?"Processando...":"Gerar parcelas e faturas"}</Button></div></form></CardContent></Card>}

    <section className="grid gap-5 lg:grid-cols-2">{cards.map(card=>{const invs=invoices.filter(i=>i.card_id===card.id);const openInvoices=invs.filter(i=>["OPEN","CLOSED","OVERDUE"].includes(i.status));const used=openInvoices.reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0);const limit=Number(card.credit_limit||0),available=Math.max(0,limit-used),pct=limit>0?Math.min(100,used/limit*100):0;const paymentAccount=accounts.find(a=>a.id===card.payment_account_id);return <Card key={card.id} className="overflow-hidden border-0 shadow-[0_12px_35px_rgba(15,23,42,.07)]"><CardContent className="p-0"><div className="bg-[#101116] p-6 text-white"><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[#e0bd67]"><CreditCard className="size-5"/></span><span className="text-xs font-black uppercase tracking-wider text-slate-500">•••• {card.last_four}</span></div><h3 className="mt-5 text-xl font-black">{card.nickname}</h3><p className="text-sm text-slate-400">{card.issuer||card.brand} · {card.brand}</p><div className="mt-6 grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-500">Em aberto</p><p className="mt-1 text-xl font-black">{currency.format(used)}</p></div><div><p className="text-xs text-slate-500">Disponível</p><p className="mt-1 text-xl font-black text-[#e0bd67]">{currency.format(available)}</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#d2aa51]" style={{width:`${pct}%`}}/></div></div><div className="p-6"><div className="grid grid-cols-2 gap-3 text-sm"><Info label="Limite" value={currency.format(limit)}/><Info label="Fecha" value={`Dia ${card.closing_day}`}/><Info label="Vence" value={`Dia ${card.due_day}`}/><Info label="Conta de pagamento" value={paymentAccount?.name||"Não definida"}/></div><div className="mt-5"><Button variant="outline" className="w-full" onClick={()=>setSelected(selected===card.id?null:card.id)}><ReceiptText className="size-4"/>Ver faturas</Button></div>{selected===card.id&&<div className="mt-5 space-y-3 border-t pt-4">{invs.length===0?<p className="text-sm text-slate-500">Nenhuma fatura criada.</p>:invs.map(i=>{const due=Number(i.total_amount||0)-Number(i.paid_amount||0);const count=installments.filter(p=>p.invoice_id===i.id).length;return <div key={i.id} className="rounded-xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black capitalize">{new Date(`${i.reference_month}T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</p><p className="mt-1 text-xs text-slate-400">{i.status} · vence {i.due_date?i.due_date.split("-").reverse().join("/"):"—"} · {count} parcela(s)</p></div><p className="font-black">{currency.format(Number(i.total_amount||0))}</p></div>{i.status!=="PAID"&&due>0&&<div className="mt-3 flex flex-col gap-2 sm:flex-row"><Select value={payment[i.id]||i.payment_account_id||card.payment_account_id||""} onChange={e=>setPayment({...payment,[i.id]:e.target.value})}><option value="">Conta para pagamento</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {currency.format(Number(a.current_balance))}</option>)}</Select><Button onClick={()=>void payInvoice(i)} disabled={saving}><Wallet className="size-4"/>Pagar {currency.format(due)}</Button></div>}</div>})}</div>}</div></CardContent></Card>})}</section>
    {cards.length===0&&<Card className="border-0"><CardContent className="grid min-h-64 place-items-center text-center"><div><CreditCard className="mx-auto size-10 text-slate-300"/><h3 className="mt-4 font-black">Nenhum cartão cadastrado</h3><p className="mt-2 text-sm text-slate-500">Cadastre um cartão para controlar compras, parcelas, limite e faturas.</p></div></CardContent></Card>}
  </div>
}

function Metric({label,value}:{label:string;value:number}){return <Card className="border-0"><CardContent className="p-6"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{currency.format(value)}</p></CardContent></Card>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>}
