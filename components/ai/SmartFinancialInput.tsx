"use client";

import { useRef, useState } from "react";
import { BrainCircuit, Check, Loader2, Mic, MicOff, PencilLine, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput, brlInputToNumber } from "@/components/ui/money-input";
import type { AiFinancialEntry, AiProduct } from "@/lib/ai-finance";
import { currency } from "@/lib/finance";

export function SmartFinancialInput({product,institutional=false,onSaved}:{product:AiProduct;institutional?:boolean;onSaved?:()=>void|Promise<void>}) {
  const {session,supabase,user}=useAuth();
  const [text,setText]=useState("");
  const [entries,setEntries]=useState<AiFinancialEntry[]>([]);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[recording,setRecording]=useState(false),[error,setError]=useState("");
  const recorder=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]);

  async function analyze(nextText=text){
    if(!session?.access_token||!nextText.trim())return;
    setLoading(true);setError("");setEntries([]);
    try{
      const r=await fetch("/api/ai/financial-entry",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({product,text:nextText,now_iso:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Não foi possível interpretar.");
      setEntries(j.entries||[]);
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível interpretar.")}finally{setLoading(false)}
  }

  async function toggleRecording(){
    if(recording){recorder.current?.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia){setError("Seu navegador não disponibiliza gravação de áudio.");return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const r=new MediaRecorder(stream);chunks.current=[];recorder.current=r;
      r.ondataavailable=(e)=>{if(e.data.size)chunks.current.push(e.data)};
      r.onstop=async()=>{
        setRecording(false);stream.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunks.current,{type:r.mimeType||"audio/webm"});
        const fd=new FormData();fd.append("audio",blob,"lancamento.webm");
        setLoading(true);setError("");
        try{
          const res=await fetch("/api/ai/transcribe",{method:"POST",headers:{Authorization:`Bearer ${session?.access_token||""}`},body:fd});
          const j=await res.json();if(!res.ok)throw new Error(j.error||"Não foi possível transcrever.");
          setText(j.text);await analyze(j.text);
        }catch(e){setError(e instanceof Error?e.message:"Não foi possível transcrever.")}finally{setLoading(false)}
      };
      r.start();setRecording(true);
    }catch{setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.")}
  }

  function patch(index:number,changes:Partial<AiFinancialEntry>){setEntries(current=>current.map((e,i)=>i===index?{...e,...changes}:e))}
  function remove(index:number){setEntries(current=>current.filter((_,i)=>i!==index))}

  async function confirm(){
    if(!user||!entries.length)return;setSaving(true);setError("");
    try{
      if(product==="MEDICAL"){
        const rows=entries.map(e=>({user_id:user.id,transaction_date:e.occurred_on,occurred_at:e.occurred_at,kind:e.kind,category:e.categories[0]||"Outras despesas",amount:e.amount,description:e.description,merchant:e.merchant,entry_source:"AI",ai_original_text:text,ai_confidence:e.confidence}));
        const {error}=await supabase.from("medical_professional_transactions").insert(rows);if(error)throw error;
      }else{
        const rows=entries.map(e=>({user_id:user.id,description:e.description,amount:e.amount,type:e.kind==="INCOME"?"INCOME":"EXPENSE",category:e.categories[0]||"Outros",categories:e.categories,cost_center:institutional?null:null,occurred_on:e.occurred_on,occurred_at:e.occurred_at,merchant:e.merchant,notes:e.notes,entry_source:"AI",ai_original_text:text,ai_confidence:e.confidence}));
        const {error}=await supabase.from("transactions").insert(rows);if(error)throw error;
      }
      setEntries([]);setText("");await onSaved?.();
    }catch(e:any){setError(e?.message||"Não foi possível salvar os lançamentos.")}finally{setSaving(false)}
  }

  return <section className="rounded-[1.75rem] border border-[#d5b35e]/20 bg-gradient-to-br from-[#111318] to-[#17191f] p-5 text-white shadow-xl">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2 text-[#e0bd67]"><BrainCircuit className="size-5"/><span className="text-xs font-black uppercase tracking-[.18em]">Adicionar com IA</span></div><h3 className="mt-2 text-xl font-black">Conte o que aconteceu. O Equity One organiza.</h3><p className="mt-2 text-sm leading-6 text-slate-400">Ex.: “Comprei no Assaí por 500 reais e abasteci 200 no Shell.”</p></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>void toggleRecording()} className={`border-white/10 bg-white/[.06] text-white hover:bg-white/10 hover:text-white ${recording?"ring-2 ring-rose-500":""}`}>{recording?<MicOff className="size-4"/>:<Mic className="size-4"/>}{recording?"Parar":"Falar"}</Button></div></div>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void analyze()}}} placeholder="Ex.: paguei 350 de energia hoje" className="h-12 border-white/10 bg-white/[.07] text-white placeholder:text-slate-500"/><Button type="button" onClick={()=>void analyze()} disabled={loading||!text.trim()} className="h-12 bg-[#d5b35e] font-black text-black hover:bg-[#e4c97d]">{loading?<Loader2 className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}{loading?"Interpretando...":"Organizar"}</Button></div>
    {error&&<p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
    {entries.length>0&&<div className="mt-5 space-y-3"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Confira antes de salvar</p><span className="text-xs text-slate-500">{entries.length} lançamento(s)</span></div>{entries.map((e,i)=><div key={`${i}-${e.description}`} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><div className="flex items-start gap-3"><span className={`mt-1 size-2 rounded-full ${e.kind==="INCOME"?"bg-emerald-400":"bg-rose-400"}`}/><div className="min-w-0 flex-1"><div className="grid gap-3 md:grid-cols-[1.5fr_.7fr_.7fr]"><label><span className="text-[10px] font-black uppercase text-slate-500">Descrição</span><Input value={e.description} onChange={x=>patch(i,{description:x.target.value})} className="mt-1 border-white/10 bg-black/20 text-white"/></label><label><span className="text-[10px] font-black uppercase text-slate-500">Valor</span><MoneyInput value={String(e.amount.toFixed(2)).replace('.',',')} onValueChange={x=>patch(i,{amount:brlInputToNumber(x)})} className="mt-1 border-white/10 bg-black/20 text-white"/></label><label><span className="text-[10px] font-black uppercase text-slate-500">Data</span><Input type="date" value={e.occurred_on} onChange={x=>patch(i,{occurred_on:x.target.value})} className="mt-1 border-white/10 bg-black/20 text-white"/></label></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-white/10 px-2.5 py-1 font-bold">{e.kind==="INCOME"?"Receita":e.kind==="TAX"?"Imposto":"Despesa"}</span>{e.merchant&&<span className="rounded-full bg-white/10 px-2.5 py-1">{e.merchant}</span>}{e.categories.map((c,ci)=><span key={c} className="rounded-full bg-[#d5b35e]/10 px-2.5 py-1 text-[#e5ca82]">{ci===0?"Principal · ":""}{c}</span>)}<span className="ml-auto text-slate-500">Confiança {Math.round(e.confidence*100)}%</span></div></div><button type="button" onClick={()=>remove(i)} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-rose-300"><Trash2 className="size-4"/></button></div></div>)}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setEntries([])} className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"><X className="size-4"/>Cancelar</Button><Button type="button" onClick={()=>void confirm()} disabled={saving} className="bg-emerald-500 font-black text-white hover:bg-emerald-600">{saving?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}{saving?"Salvando...":"Confirmar lançamentos"}</Button></div></div>}
  </section>
}
