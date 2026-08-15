"use client";

import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Check, Copy, Link2, Loader2, MessageCircle, Mic, MicOff, Send, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MoneyInput, brlInputToNumber } from "@/components/ui/money-input";
import type { AiFinancialEntry, AiProduct } from "@/lib/ai-finance";

const suggestions = [
  "Gastei R$ 300 no Assaí",
  "Qual meu saldo nas contas?",
  "Quais faturas estão abertas?",
  "Crie uma meta para viagem de R$ 10.000",
  "Cadastre uma conta de energia de R$ 220 que vence dia 20",
  "Adicione R$ 300 à minha meta Reserva de emergência",
  "Comprei R$ 900 no cartão em 3x",
];

type ChatItem = { role: "USER" | "AGENT"; text: string };
type FinancialAccount = { id:string; name:string; institution:string|null; current_balance:number };
type AgentActionProposal = { kind:string; title:string; summary:string; payload:Record<string,unknown> };
type WhatsAppConnection = { status?: string; phone_e164?: string | null; connected_at?: string | null; last_message_at?: string | null } | null;

export function SmartFinancialInput({product,institutional=false,onSaved}:{product:AiProduct;institutional?:boolean;onSaved?:()=>void|Promise<void>}) {
  const {session,supabase,user}=useAuth();
  const [text,setText]=useState("");
  const [entries,setEntries]=useState<AiFinancialEntry[]>([]);
  const [proposal,setProposal]=useState<AgentActionProposal|null>(null);
  const [accounts,setAccounts]=useState<FinancialAccount[]>([]);
  const [chat,setChat]=useState<ChatItem[]>([]);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[recording,setRecording]=useState(false),[error,setError]=useState("");
  const [whatsApp,setWhatsApp]=useState<WhatsAppConnection>(null);
  const [activationCode,setActivationCode]=useState("");
  const [activationExpires,setActivationExpires]=useState("");
  const [agentNumber,setAgentNumber]=useState("");
  const [metaConfigured,setMetaConfigured]=useState<boolean|null>(null);
  const [connectingWhatsApp,setConnectingWhatsApp]=useState(false);
  const recorder=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]);

  useEffect(()=>{
    if(!user||product==="MEDICAL")return;
    void (async()=>{
      const {data}=await supabase.from("financial_accounts").select("id,name,institution,current_balance").eq("is_active",true).order("name");
      setAccounts((data??[]) as FinancialAccount[]);
    })();
  },[product,supabase,user]);

  useEffect(()=>{
    if(!session?.access_token)return;
    void (async()=>{
      try{
        const r=await fetch("/api/whatsapp/connect",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
        const j=await r.json();
        if(r.ok){
          setWhatsApp(j.connection??null);
          setAgentNumber(String(j.agent_number_digits||""));
          setMetaConfigured(Boolean(j.meta_configured));
        }
      }catch{}
    })();
  },[session?.access_token]);

  async function connectWhatsApp(){
    if(!session?.access_token)return;
    setConnectingWhatsApp(true);setError("");
    try{
      const r=await fetch("/api/whatsapp/connect",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Não foi possível gerar o código do WhatsApp.");
      setActivationCode(String(j.activation_code||""));
      setActivationExpires(String(j.activation_expires_at||""));
      setAgentNumber(String(j.agent_number_digits||""));
      setMetaConfigured(Boolean(j.meta_configured));
      setWhatsApp({status:"PENDING"});
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível conectar o WhatsApp.")}finally{setConnectingWhatsApp(false)}
  }

  async function analyze(nextText=text){
    const message=nextText.trim();
    if(!session?.access_token||!message)return;
    setLoading(true);setError("");setEntries([]);setProposal(null);
    setChat(current=>[...current,{role:"USER",text:message}]);
    try{
      const r=await fetch("/api/ai/financial-entry",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({product,text:message,now_iso:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Não foi possível processar sua mensagem.");
      if(j.action==="ANSWER"){
        setChat(current=>[...current,{role:"AGENT",text:String(j.message||"Consulta concluída.")}]);
      }else if(j.action==="PROPOSE_AGENT_ACTION"){
        const next=j.proposal as AgentActionProposal;
        setProposal(next);
        setChat(current=>[...current,{role:"AGENT",text:`Preparei esta ação para você:\n${next.title}\n${next.summary}\nConfira abaixo antes de confirmar.`}]);
      }else{
        const defaultAccount=accounts.length===1?accounts[0].id:null;
        const nextEntries=((j.entries||[]) as AiFinancialEntry[]).map(entry=>({...entry,account_id:entry.account_id||defaultAccount,payment_method:entry.payment_method||"PIX"}));
        setEntries(nextEntries);
        if(nextEntries.length){
          const total=nextEntries.reduce((sum,e)=>sum+Number(e.amount||0),0);
          setChat(current=>[...current,{role:"AGENT",text:`Entendi. Encontrei ${nextEntries.length} lançamento(s), totalizando ${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(total)}. Confira os dados e a conta antes de confirmar.`}]);
        }
      }
      setText("");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível processar sua mensagem.")}finally{setLoading(false)}
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
        const fd=new FormData();fd.append("audio",blob,"mensagem.webm");
        setLoading(true);setError("");
        try{
          const res=await fetch("/api/ai/transcribe",{method:"POST",headers:{Authorization:`Bearer ${session?.access_token||""}`},body:fd});
          const j=await res.json();if(!res.ok)throw new Error(j.error||"Não foi possível transcrever.");
          setText(j.text);setLoading(false);await analyze(j.text);
        }catch(e){setError(e instanceof Error?e.message:"Não foi possível transcrever.");setLoading(false)}
      };
      r.start();setRecording(true);
    }catch{setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.")}
  }

  function patch(index:number,changes:Partial<AiFinancialEntry>){setEntries(current=>current.map((e,i)=>i===index?{...e,...changes}:e))}
  function remove(index:number){setEntries(current=>current.filter((_,i)=>i!==index))}

  async function confirmEntries(){
    if(!user||!entries.length)return;setSaving(true);setError("");
    try{
      const originalText=chat.filter(i=>i.role==="USER").at(-1)?.text||"";
      if(product==="MEDICAL"){
        const rows=entries.map(e=>({user_id:user.id,transaction_date:e.occurred_on,occurred_at:e.occurred_at,kind:e.kind,category:e.categories[0]||"Outras despesas",amount:e.amount,description:e.description,merchant:e.merchant,entry_source:"AI",ai_original_text:originalText,ai_confidence:e.confidence}));
        const {error}=await supabase.from("medical_professional_transactions").insert(rows);if(error)throw error;
      }else{
        const rows=entries.map(e=>({description:e.description,amount:e.amount,type:e.kind==="INCOME"?"INCOME":"EXPENSE",categories:e.categories,cost_center:institutional?null:null,occurred_on:e.occurred_on,occurred_at:e.occurred_at,merchant:e.merchant,notes:e.notes,confidence:e.confidence,account_id:e.account_id||null,payment_method:e.payment_method||null}));
        const {error}=await supabase.rpc("equity_confirm_ai_entries",{p_entries:rows,p_original_text:originalText});
        if(error)throw error;
      }
      const count=entries.length;setEntries([]);
      setChat(current=>[...current,{role:"AGENT",text:`Pronto. ${count} lançamento(s) confirmado(s) e registrado(s) com segurança no Equity One.`}]);
      await onSaved?.();
    }catch(e:any){setError(e?.message||"Não foi possível salvar os lançamentos.")}finally{setSaving(false)}
  }

  async function confirmAction(){
    if(!proposal)return;setSaving(true);setError("");
    try{
      const originalText=chat.filter(i=>i.role==="USER").at(-1)?.text||"";
      const {error}=await supabase.rpc("equity_confirm_agent_action",{p_action:proposal,p_original_text:originalText});
      if(error)throw error;
      const title=proposal.title;setProposal(null);
      setChat(current=>[...current,{role:"AGENT",text:`Concluído. ${title} foi confirmado e salvo no Equity One.`}]);
      await onSaved?.();
    }catch(e:any){setError(e?.message||"Não foi possível concluir a ação.")}finally{setSaving(false)}
  }

  return <section className="rounded-[1.75rem] border border-[#d5b35e]/20 bg-gradient-to-br from-[#111318] to-[#17191f] p-5 text-white shadow-xl">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div><div className="flex items-center gap-2 text-[#e0bd67]"><BrainCircuit className="size-5"/><span className="text-xs font-black uppercase tracking-[.18em]">Meu Agente Financeiro</span></div><h3 className="mt-2 text-xl font-black">Pergunte, registre ou peça uma ação. Eu uso seus dados reais.</h3><p className="mt-2 text-sm leading-6 text-slate-400">Consultas não alteram nada. Lançamentos, metas, contas e compras ficam aguardando sua confirmação.</p></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>void connectWhatsApp()} disabled={connectingWhatsApp||whatsApp?.status==="ACTIVE"} className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100">{connectingWhatsApp?<Loader2 className="size-4 animate-spin"/>:<Link2 className="size-4"/>}{whatsApp?.status==="ACTIVE"?"WhatsApp conectado":"Conectar WhatsApp"}</Button><Button type="button" variant="outline" onClick={()=>void toggleRecording()} className={`border-white/10 bg-white/[.06] text-white hover:bg-white/10 hover:text-white ${recording?"ring-2 ring-rose-500":""}`}>{recording?<MicOff className="size-4"/>:<Mic className="size-4"/>}{recording?"Parar":"Falar"}</Button></div>
    </div>

    {activationCode&&<div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[.08] p-4"><div className="text-xs font-black uppercase tracking-[.14em] text-emerald-300">Ativar Meu Agente Financeiro no WhatsApp</div><p className="mt-2 text-sm leading-6 text-slate-300">Envie o código abaixo para o número oficial do agente:</p>{agentNumber?<p className="mt-2 text-sm font-bold text-white">+{agentNumber}</p>:<p className="mt-2 text-sm text-amber-300">O número oficial ainda não foi informado na configuração do servidor.</p>}<div className="mt-3 flex flex-wrap items-center gap-2"><code className="rounded-xl bg-black/30 px-4 py-2 text-lg font-black tracking-wider text-white">{activationCode}</code><Button type="button" variant="outline" onClick={()=>void navigator.clipboard?.writeText(activationCode)} className="border-white/10 bg-white/[.05] text-white hover:bg-white/10 hover:text-white"><Copy className="size-4"/>Copiar</Button>{agentNumber&&<a href={`https://wa.me/${agentNumber}?text=${encodeURIComponent(activationCode)}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-black text-white transition hover:bg-emerald-600"><MessageCircle className="size-4"/>Abrir WhatsApp</a>}</div>{activationExpires&&<p className="mt-2 text-xs text-slate-500">Código válido por aproximadamente 30 minutos.</p>}{metaConfigured===false&&<p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">A integração da Meta ainda está incompleta no servidor. O código foi criado, mas o agente só responderá quando token, Phone Number ID, Graph Version e Verify Token estiverem configurados.</p>}</div>}
    {whatsApp?.status==="ACTIVE"&&<div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.07] px-4 py-3 text-sm text-emerald-200">✅ Seu WhatsApp está conectado ao Meu Agente Financeiro{whatsApp.phone_e164?` (${whatsApp.phone_e164})`:""}.</div>}

    {chat.length>0&&<div className="mt-5 max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">{chat.map((item,index)=><div key={`${item.role}-${index}`} className={`flex ${item.role==="USER"?"justify-end":"justify-start"}`}><div className={`max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 ${item.role==="USER"?"bg-[#d5b35e] text-black":"border border-white/10 bg-white/[.06] text-slate-100"}`}>{item.role==="AGENT"&&<div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#e0bd67]"><MessageCircle className="size-3"/>Meu Agente Financeiro</div>}{item.text}</div></div>)}</div>}

    <div className="mt-5 flex flex-wrap gap-2">{suggestions.map(s=><button key={s} type="button" onClick={()=>{setText(s);void analyze(s)}} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-left text-xs text-slate-300 transition hover:border-[#d5b35e]/40 hover:text-white">{s}</button>)}</div>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void analyze()}}} placeholder="Ex.: crie uma meta, cadastre uma conta ou gastei 300 no Assaí" className="h-12 border-white/10 bg-white/[.07] text-white placeholder:text-slate-500"/><Button type="button" onClick={()=>void analyze()} disabled={loading||!text.trim()} className="h-12 bg-[#d5b35e] font-black text-black hover:bg-[#e4c97d]">{loading?<Loader2 className="size-4 animate-spin"/>:<Send className="size-4"/>}{loading?"Pensando...":"Enviar"}</Button></div>
    {error&&<p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}

    {proposal&&<div className="mt-5 rounded-2xl border border-[#d5b35e]/35 bg-[#d5b35e]/[.08] p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d5b35e]/15 text-[#e7ca7d]"><Check className="size-5"/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#d5b35e]">Ação aguardando confirmação</p><h4 className="mt-2 text-lg font-black text-white">{proposal.title}</h4><p className="mt-2 text-sm leading-6 text-slate-300">{proposal.summary}</p><p className="mt-3 text-xs text-slate-500">Nada foi alterado ainda.</p></div></div><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={()=>setProposal(null)} className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"><X className="size-4"/>Cancelar</Button><Button type="button" onClick={()=>void confirmAction()} disabled={saving} className="bg-emerald-500 font-black text-white hover:bg-emerald-600">{saving?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}{saving?"Executando...":"Confirmar ação"}</Button></div></div>}

    {entries.length>0&&<div className="mt-5 space-y-3"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Lançamento aguardando sua confirmação</p><span className="text-xs text-slate-500">{entries.length} lançamento(s)</span></div>{entries.map((e,i)=><div key={`${i}-${e.description}`} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><div className="flex items-start gap-3"><span className={`mt-1 size-2 rounded-full ${e.kind==="INCOME"?"bg-emerald-400":"bg-rose-400"}`}/><div className="min-w-0 flex-1"><div className="grid gap-3 md:grid-cols-3"><label><span className="text-[10px] font-black uppercase text-slate-500">Descrição</span><Input value={e.description} onChange={x=>patch(i,{description:x.target.value})} className="mt-1 border-white/10 bg-black/20 text-white"/></label><label><span className="text-[10px] font-black uppercase text-slate-500">Valor</span><MoneyInput value={String(e.amount.toFixed(2)).replace('.',',')} onValueChange={x=>patch(i,{amount:brlInputToNumber(x)})} className="mt-1 border-white/10 bg-black/20 text-white"/></label><label><span className="text-[10px] font-black uppercase text-slate-500">Data</span><Input type="date" value={e.occurred_on} onChange={x=>patch(i,{occurred_on:x.target.value})} className="mt-1 border-white/10 bg-black/20 text-white"/></label></div>{product!=="MEDICAL"&&<div className="mt-3 grid gap-3 md:grid-cols-2"><label><span className="text-[10px] font-black uppercase text-slate-500">Conta financeira</span><Select value={e.account_id||""} onChange={x=>patch(i,{account_id:x.target.value||null})} className="mt-1 border-white/10 bg-black/20 text-white"><option value="" className="text-slate-900">Sem conta vinculada</option>{accounts.map(a=><option key={a.id} value={a.id} className="text-slate-900">{a.institution?`${a.institution} · `:""}{a.name} · {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(a.current_balance||0))}</option>)}</Select></label><label><span className="text-[10px] font-black uppercase text-slate-500">Forma de pagamento</span><Select value={e.payment_method||"PIX"} onChange={x=>patch(i,{payment_method:x.target.value})} className="mt-1 border-white/10 bg-black/20 text-white"><option value="PIX" className="text-slate-900">PIX</option><option value="DEBIT" className="text-slate-900">Débito</option><option value="CASH" className="text-slate-900">Dinheiro</option><option value="TRANSFER" className="text-slate-900">Transferência</option><option value="BOLETO" className="text-slate-900">Boleto</option><option value="OTHER" className="text-slate-900">Outro</option></Select></label></div>}<div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-white/10 px-2.5 py-1 font-bold">{e.kind==="INCOME"?"Receita":e.kind==="TAX"?"Imposto":"Despesa"}</span>{e.merchant&&<span className="rounded-full bg-white/10 px-2.5 py-1">{e.merchant}</span>}{e.categories.map((c,ci)=><span key={c} className="rounded-full bg-[#d5b35e]/10 px-2.5 py-1 text-[#e5ca82]">{ci===0?"Principal · ":""}{c}</span>)}<span className="ml-auto text-slate-500">Confiança {Math.round(e.confidence*100)}%</span></div></div><button type="button" onClick={()=>remove(i)} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-rose-300"><Trash2 className="size-4"/></button></div></div>)}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setEntries([])} className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"><X className="size-4"/>Cancelar</Button><Button type="button" onClick={()=>void confirmEntries()} disabled={saving} className="bg-emerald-500 font-black text-white hover:bg-emerald-600">{saving?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}{saving?"Salvando...":"Confirmar"}</Button></div></div>}
  </section>
}
