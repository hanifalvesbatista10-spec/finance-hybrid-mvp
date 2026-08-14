"use client";

import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import {Archive,ArchiveRestore,ChevronRight,FolderTree,Pencil,Plus,Search} from "lucide-react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {currency,type Transaction,type TransactionType} from "@/lib/finance";
import {categoryGroups} from "@/lib/transaction-categories";

type Category={id:string;name:string;type:TransactionType;product:string;archived:boolean;created_at?:string};
type ExtendedTransaction=Transaction&{categories?:string[]|null};
const currentPeriod=()=>new Date().toISOString().slice(0,7);
function range(period:string){const [y,m]=period.split("-").map(Number);const end=new Date(y,m,0).getDate();return{start:`${period}-01`,end:`${period}-${String(end).padStart(2,"0")}`}}

export function CategoriesManager({institutional=false}:{institutional?:boolean}){
 const {supabase,user}=useAuth();const router=useRouter();const product=institutional?"BUSINESS":"PERSONAL";
 const [categories,setCategories]=useState<Category[]>([]),[transactions,setTransactions]=useState<ExtendedTransaction[]>([]),[period,setPeriod]=useState(currentPeriod()),[search,setSearch]=useState(""),[showArchived,setShowArchived]=useState(false),[error,setError]=useState(""),[saving,setSaving]=useState(false),[editing,setEditing]=useState<Category|null>(null);
 const [form,setForm]=useState<{name:string;type:TransactionType}>({name:"",type:"EXPENSE"});

 const load=useCallback(async()=>{if(!user)return;const r=range(period);const [c,t]=await Promise.all([supabase.from("user_categories").select("*").eq("product",product).order("name"),supabase.from("transactions").select("*").gte("occurred_on",r.start).lte("occurred_on",r.end).limit(1000)]);if(c.error)setError(c.error.message);else setCategories((c.data??[]) as Category[]);if(t.error)setError(t.error.message);else setTransactions((t.data??[]) as ExtendedTransaction[])},[period,product,supabase,user]);
 useEffect(()=>{void load()},[load]);

 const usage=useMemo(()=>{const map=new Map<string,{income:number;expense:number;count:number}>();for(const tx of transactions){const cats=tx.categories?.length?tx.categories:[tx.category];for(const name of cats.filter(Boolean)){const row=map.get(name)||{income:0,expense:0,count:0};row.count+=1;if(tx.type==="INCOME")row.income+=Number(tx.amount);else row.expense+=Number(tx.amount);map.set(name,row)}}return map},[transactions]);
 const builtins=useMemo(()=>{const set=new Set<string>();(["INCOME","EXPENSE"] as TransactionType[]).forEach(type=>categoryGroups(institutional,type).forEach(g=>g.items.forEach(x=>set.add(x))));return set},[institutional]);
 const usedRows=useMemo(()=>[...usage.entries()].map(([name,stats])=>({name,...stats,custom:categories.find(c=>c.name===name)})).filter(x=>!search||x.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(b.expense+b.income)-(a.expense+a.income)),[usage,categories,search]);
 const customRows=useMemo(()=>categories.filter(c=>showArchived||!c.archived).filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())),[categories,showArchived,search]);

 async function createCategory(e:FormEvent){e.preventDefault();if(!user||!form.name.trim())return;setSaving(true);setError("");const {error:e1}=await supabase.from("user_categories").insert({user_id:user.id,product,type:form.type,name:form.name.trim(),archived:false});if(e1)setError(e1.code==="23505"?"Essa categoria já existe.":e1.message);else{setForm({name:"",type:"EXPENSE"});await load()}setSaving(false)}
 async function renameCategory(e:FormEvent){e.preventDefault();if(!editing||!form.name.trim())return;setSaving(true);setError("");const {error:e1}=await supabase.rpc("equity_rename_custom_category",{p_category_id:editing.id,p_new_name:form.name.trim()});if(e1)setError(e1.message);else{setEditing(null);setForm({name:"",type:"EXPENSE"});await load()}setSaving(false)}
 async function toggleArchive(item:Category){const {error:e}=await supabase.from("user_categories").update({archived:!item.archived,updated_at:new Date().toISOString()}).eq("id",item.id);if(e)setError(e.message);else await load()}
 function openCategory(name:string){router.push(`/dashboard/lancamentos?mes=${period}&categoria=${encodeURIComponent(name)}`)}

 return <div className="space-y-7">
  <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9b772c]">Organização financeira</p><h1 className="mt-2 text-3xl font-black">Categorias</h1><p className="mt-2 text-sm text-slate-500">Crie categorias próprias e abra os lançamentos de cada grupo com um clique.</p></div><div className="flex gap-2"><Input type="month" value={period} onChange={e=>setPeriod(e.target.value||currentPeriod())}/></div></section>
  {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

  <Card className="border-0"><CardHeader><CardTitle>{editing?`Renomear “${editing.name}”`:"Nova categoria personalizada"}</CardTitle></CardHeader><CardContent><form onSubmit={editing?renameCategory:createCategory} className="grid gap-3 md:grid-cols-[1fr_220px_auto]"><Input required placeholder="Ex.: Faculdade, Ferramentas, Viagens..." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><Select value={form.type} disabled={!!editing} onChange={e=>setForm({...form,type:e.target.value as TransactionType})}><option value="EXPENSE">Despesa</option><option value="INCOME">Receita</option></Select><div className="flex gap-2"><Button type="submit" disabled={saving}><Plus className="size-4"/>{saving?"Salvando...":editing?"Salvar nome":"Criar categoria"}</Button>{editing&&<Button type="button" variant="outline" onClick={()=>{setEditing(null);setForm({name:"",type:"EXPENSE"})}}>Cancelar</Button>}</div></form></CardContent></Card>

  <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-3"><Search className="size-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar categoria..." className="h-11 w-full bg-transparent px-2 text-sm outline-none"/></div><label className="flex items-center gap-2 text-sm font-semibold text-slate-500"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Mostrar arquivadas</label></div>

  <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
   <Card className="border-0"><CardHeader><CardTitle>Uso no mês</CardTitle><p className="text-sm text-slate-500">Categorias encontradas nos lançamentos de {new Date(`${period}-01T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}.</p></CardHeader><CardContent>{usedRows.length===0?<div className="grid min-h-56 place-items-center text-center text-sm text-slate-400"><div><FolderTree className="mx-auto mb-3 size-9 text-slate-300"/>Nenhuma categoria usada neste mês.</div></div>:<div className="space-y-2">{usedRows.map(row=><button type="button" key={row.name} onClick={()=>openCategory(row.name)} className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-[#d2aa51]/30 hover:bg-[#d2aa51]/5"><span className="grid size-10 place-items-center rounded-xl bg-[#d2aa51]/10 text-[#9b772c]"><FolderTree className="size-4"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{row.name}</p><p className="mt-1 text-xs text-slate-400">{row.count} lançamento(s){row.custom?" · Personalizada":builtins.has(row.name)?" · Padrão Equity One":""}</p></div><div className="text-right"><p className="text-xs font-bold text-emerald-700">+ {currency.format(row.income)}</p><p className="mt-1 text-xs font-bold text-rose-700">- {currency.format(row.expense)}</p></div><ChevronRight className="size-4 text-slate-300"/></button>)}</div>}</CardContent></Card>

   <Card className="border-0"><CardHeader><CardTitle>Minhas categorias</CardTitle><p className="text-sm text-slate-500">Categorias personalizadas permanecem disponíveis para novos lançamentos até serem arquivadas.</p></CardHeader><CardContent>{customRows.length===0?<div className="grid min-h-56 place-items-center text-center text-sm text-slate-400">Nenhuma categoria personalizada cadastrada.</div>:<div className="space-y-2">{customRows.map(item=><div key={item.id} className={`flex items-center gap-3 rounded-2xl border p-4 ${item.archived?"border-slate-100 bg-slate-50 opacity-60":"border-slate-100 bg-white"}`}><div className="min-w-0 flex-1"><p className="font-black text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-400">{item.type==="INCOME"?"Receita":"Despesa"}{item.archived?" · Arquivada":""}</p></div><button type="button" title="Renomear" onClick={()=>{setEditing(item);setForm({name:item.name,type:item.type})}} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"><Pencil className="size-4"/></button><button type="button" title={item.archived?"Reativar":"Arquivar"} onClick={()=>void toggleArchive(item)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900">{item.archived?<ArchiveRestore className="size-4"/>:<Archive className="size-4"/>}</button></div>)}</div>}</CardContent></Card>
  </section>
 </div>
}
