"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {BarChart3,BellRing,Building2,CalendarClock,CalendarDays,ChevronDown,CreditCard,FileText,Goal,Landmark,LayoutDashboard,LogOut,Menu,ReceiptText,ShieldAlert,ShieldCheck,Upload,UserRound,X} from "lucide-react";
import {useEffect,useMemo,useState} from "react";
import {Button} from "@/components/ui/button";
import {SidePanel} from "@/components/ui/side-panel";
import {AlertCenter} from "@/components/finance/AlertCenter";
import {SubscriptionGate} from "@/components/subscription/SubscriptionGate";
import {useAuth,type ProfileRole} from "@/context/AuthContext";
import {cn} from "@/lib/utils";
import {EquityOneLogo} from "@/components/EquityOneLogo";
import {SuperAdminProductSwitcher} from "@/components/admin/SuperAdminProductSwitcher";
type Item={label:string;href:string;icon:any};
const personal:Item[]=[{label:'Visão Geral',href:'/dashboard',icon:LayoutDashboard},{label:'Contas Financeiras',href:'/dashboard/contas-financeiras',icon:Landmark},{label:'Cartões e Faturas',href:'/dashboard/cartoes',icon:CreditCard},{label:'Lançamentos',href:'/dashboard/lancamentos',icon:ReceiptText},{label:'Importações',href:'/dashboard/importacoes',icon:Upload},{label:'Contas e Alertas',href:'/dashboard/contas',icon:BellRing},{label:'Fixos mensais',href:'/dashboard/recorrencias',icon:CalendarClock},{label:'Calendário',href:'/dashboard/calendario',icon:CalendarDays},{label:'Relatórios',href:'/dashboard/relatorios',icon:FileText},{label:'Metas',href:'/dashboard/metas',icon:Goal}];
const business:Item[]=[{label:'Fluxo de Caixa',href:'/dashboard',icon:BarChart3},{label:'Contas Financeiras',href:'/dashboard/contas-financeiras',icon:Landmark},{label:'Cartões e Faturas',href:'/dashboard/cartoes',icon:CreditCard},{label:'Lançamentos',href:'/dashboard/lancamentos',icon:ReceiptText},{label:'Importações',href:'/dashboard/importacoes',icon:Upload},{label:'Contas e Alertas',href:'/dashboard/contas',icon:BellRing},{label:'Fixos mensais',href:'/dashboard/recorrencias',icon:CalendarClock},{label:'Calendário',href:'/dashboard/calendario',icon:CalendarDays},{label:'Relatórios',href:'/dashboard/relatorios',icon:FileText},{label:'Centros de Custo',href:'/dashboard/centros-de-custo',icon:Building2},{label:'Permissões',href:'/dashboard/permissoes',icon:ShieldCheck}];
const navFor=(r?:ProfileRole)=>r==='INSTITUTIONAL'?business:personal;
export default function Layout({children}:{children:React.ReactNode}){
 const pathname=usePathname(),router=useRouter();
 const {user,profile,loading,signOut,adminPreviewProduct,ownerProductAccess}=useAuth();
 const [open,setOpen]=useState(false),[userMenu,setUserMenu]=useState(false),[profileOpen,setProfileOpen]=useState(false);
 const effectiveRole:ProfileRole=ownerProductAccess?(adminPreviewProduct==='BUSINESS'?'INSTITUTIONAL':'PERSONAL'):(profile?.role??'PERSONAL');
 const nav=useMemo(()=>navFor(effectiveRole),[effectiveRole]);
 const productLabel=ownerProductAccess?(adminPreviewProduct==='BUSINESS'?'Equity One Negócios':adminPreviewProduct==='MEDICAL'?'Equity One Médicos':'Equity One Pessoal'):(effectiveRole==='INSTITUTIONAL'?'Equity One Negócios':'Equity One Pessoal');
 useEffect(()=>{if(!loading&&!user)router.replace('/login')},[loading,user,router]);
 if(loading||!user)return <div className="grid min-h-screen place-items-center bg-[#f4f3ef] text-sm text-slate-500">Carregando Equity One...</div>;
 return <div className="min-h-screen bg-[#f4f3ef]">
  {open&&<button className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={()=>setOpen(false)}/>} 
  <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[292px] flex-col bg-[#0b0d11] text-white transition-transform lg:translate-x-0',open?'translate-x-0':'-translate-x-full')}>
   <div className="flex h-24 items-center justify-between px-6"><Link href="/dashboard" className="flex items-center gap-3"><EquityOneLogo className="h-16 w-auto"/><span className="text-[10px] uppercase tracking-[.18em] text-slate-500">{effectiveRole==='INSTITUTIONAL'?'Negócios':'Pessoal'}</span></Link><Button variant="ghost" size="icon" className="text-white lg:hidden" onClick={()=>setOpen(false)}><X className="size-5"/></Button></div>
   <div className="mx-4 overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.04]">
    <button type="button" onClick={()=>setUserMenu(v=>!v)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[.035]" aria-expanded={userMenu}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d2aa51]/10 text-[#d2aa51]">{effectiveRole==='INSTITUTIONAL'?<Building2 className="size-5"/>:<UserRound className="size-5"/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{profile?.full_name||'Usuário'}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div><ChevronDown className={cn('size-4 shrink-0 text-slate-500 transition-transform',userMenu&&'rotate-180')}/></button>
    {userMenu&&<div className="border-t border-white/[.06] p-2"><button type="button" onClick={()=>{setProfileOpen(true);setUserMenu(false);setOpen(false)}} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/[.05] hover:text-white"><UserRound className="size-4"/>Minha conta</button><Link href="/dashboard/seguranca-reset" onClick={()=>{setUserMenu(false);setOpen(false)}} className={cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition',pathname.startsWith('/dashboard/seguranca-reset')?'bg-rose-500/15 text-rose-200':'text-slate-400 hover:bg-rose-500/10 hover:text-rose-200')}><ShieldAlert className="size-4"/>Segurança e Reset</Link><button type="button" onClick={async()=>{await signOut();router.replace('/login')}} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"><LogOut className="size-4"/>Sair</button></div>}
   </div>
   <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-7"><p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[.2em] text-slate-600">Gestão</p>{nav.map(i=>{const I=i.icon;const active=i.href==='/dashboard'?pathname==='/dashboard':pathname.startsWith(i.href);return <Link key={i.href} href={i.href} onClick={()=>setOpen(false)} className={cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition',active?'bg-[#d2aa51] text-[#0b0d11] shadow-lg shadow-black/20':'text-slate-400 hover:bg-white/[.05] hover:text-white')}><I className="size-5"/>{i.label}</Link>})}</nav>
   <div className="space-y-3 border-t border-white/[.06] p-4">{profile?.system_role==='SUPER_ADMIN'&&<><Link href="/admin" className="flex items-center gap-3 rounded-xl bg-[#d2aa51]/10 px-3 py-3 text-sm font-semibold text-[#d2aa51]"><ShieldCheck className="size-5"/>Super Admin</Link>{ownerProductAccess&&<SuperAdminProductSwitcher/>}</>}</div>
  </aside>
  <div className="lg:pl-[292px]"><header className="sticky top-0 z-30 flex h-16 items-center border-b border-black/5 bg-[#f4f3ef]/90 px-4 backdrop-blur-xl lg:hidden"><Button variant="ghost" size="icon" onClick={()=>setOpen(true)}><Menu className="size-5"/></Button><span className="ml-3 flex-1"><EquityOneLogo className="h-10 w-auto"/></span><AlertCenter/></header><main className="mx-auto max-w-[1600px] p-4 md:p-8 lg:p-10"><div className="mb-5 hidden justify-end lg:flex"><AlertCenter/></div><SubscriptionGate>{children}</SubscriptionGate></main></div>
  <SidePanel open={profileOpen} onClose={()=>setProfileOpen(false)} title="Minha conta" subtitle="Dados e configurações do seu acesso">
   <div className="space-y-6">
    <div className="flex items-center gap-4 rounded-2xl bg-[#0b0d11] p-5 text-white"><span className="grid size-14 place-items-center rounded-2xl bg-[#d2aa51]/15 text-[#d2aa51]"><UserRound className="size-6"/></span><div className="min-w-0"><p className="truncate text-lg font-black">{profile?.full_name||'Usuário'}</p><p className="truncate text-sm text-slate-400">{user.email}</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><Info label="Produto atual" value={productLabel}/><Info label="Perfil" value={effectiveRole==='INSTITUTIONAL'?'Negócios':'Pessoal'}/><Info label="Status" value={profile?.status==='SUSPENDED'?'Suspenso':'Ativo'}/><Info label="Acesso" value={profile?.system_role==='SUPER_ADMIN'?'Super Admin':'Usuário'}/></div>
    {profile?.created_at&&<Info label="Conta criada em" value={new Date(profile.created_at).toLocaleDateString('pt-BR')}/>} 
    <div className="space-y-2 border-t border-slate-100 pt-5"><Link href="/dashboard/seguranca-reset" onClick={()=>setProfileOpen(false)} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><span className="flex items-center gap-3"><ShieldAlert className="size-4"/>Segurança e Reset</span><ChevronDown className="size-4 -rotate-90"/></Link><button type="button" onClick={async()=>{await signOut();router.replace('/login')}} className="flex w-full items-center gap-3 rounded-xl px-4 py-4 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><LogOut className="size-4"/>Sair da conta</button></div>
   </div>
  </SidePanel>
 </div>
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-sm font-bold text-slate-900">{value}</p></div>}
