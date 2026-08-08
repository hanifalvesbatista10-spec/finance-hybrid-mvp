"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Landmark, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
export function PaidRegistrationClient({token}:{token:string}){
  const [form,setForm]=useState({full_name:"",email:"",password:"",confirm:""});
  const [saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setError("");
    if(!token){setError("A autorização desta compra não foi encontrada.");return}
    if(form.password!==form.confirm){setError("As senhas não coincidem.");return}
    setSaving(true);
    try{const response=await fetch("/api/auth/paid-register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,full_name:form.full_name,email:form.email,password:form.password})});
      const raw=await response.text();let json:any={};if(raw){try{json=JSON.parse(raw)}catch{json={}}}
      if(!response.ok||!json.success){setError(json.error||"Não foi possível concluir seu cadastro.");return} setSuccess(true);
    }catch{setError("Não foi possível conectar ao servidor. Tente novamente.")}finally{setSaving(false)}}
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><Card className="w-full max-w-lg border-0 shadow-2xl"><CardHeader className="items-center text-center">
    <Link href="/" className="mb-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-indigo-600 text-white"><Landmark className="size-5"/></span><strong>EQUITY ONE</strong></Link>
    <span className="grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">{success?<CheckCircle2 className="size-6"/>:<LockKeyhole className="size-6"/>}</span>
    <CardTitle className="mt-4 text-2xl">{success?"Conta criada com sucesso":"Pagamento confirmado"}</CardTitle>
    <p className="mt-2 text-sm leading-6 text-slate-500">{success?"Seu acesso de 30 dias está liberado.":"Agora crie sua conta para liberar seu acesso."}</p></CardHeader>
    <CardContent>{success?<Link href="/login"><Button className="h-12 w-full">Entrar no Equity One<ArrowRight className="size-4"/></Button></Link>:
      <form onSubmit={submit} className="space-y-4">
        <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Nome completo</span><Input required autoComplete="name" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label>
        <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">E-mail</span><Input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Senha</span><Input required type="password" minLength={6} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
        <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Confirmar senha</span><Input required type="password" minLength={6} autoComplete="new-password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})}/></label>
        {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        <Button type="submit" className="h-12 w-full" disabled={saving}>{saving?"Criando conta...":"Criar minha conta e acessar"}<ArrowRight className="size-4"/></Button>
      </form>}</CardContent></Card></main>
}
