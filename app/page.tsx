import Link from "next/link";
import {
  ArrowRight, BarChart3, BellRing, Building2, Check, ChevronRight, HeartPulse, LineChart,
  ShieldCheck, Sparkles, TrendingUp, UserRound, WalletCards
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EquityOneLogo } from "@/components/EquityOneLogo";
import { formatCurrency, getPlatformPricingSettings } from "@/lib/pricing";

const pains = [
  {icon: WalletCards, title:"Você recebe, paga, transfere… e ainda não sabe o que realmente sobrou.", text:"Quando o dinheiro está espalhado entre contas, cartões, compromissos e planilhas, o saldo sozinho deixa de contar a verdade."},
  {icon: BellRing, title:"Os problemas aparecem quando já venceram.", text:"Contas, recebimentos e compromissos sem uma visão única transformam pequenos esquecimentos em decisões caras."},
  {icon: LineChart, title:"Você olha para o passado, mas precisa decidir o próximo passo.", text:"Extrato mostra o que aconteceu. Gestão financeira precisa mostrar o que está acontecendo e o que exige atenção agora."},
];

export default async function HomePage(){
  const pricing = await getPlatformPricingSettings();
  const products = [
    {
      icon: UserRound, eyebrow:"PARA SUA VIDA FINANCEIRA", title:"Equity One Pessoal", price:formatCurrency(pricing.personal_price_cents), href:"/pessoal",
      text:"Para quem quer parar de administrar dinheiro no susto e começar a enxergar o mês inteiro antes de decidir.",
      bullets:["Contas, despesas e receitas em um só lugar","Calendário e alertas de vencimento","Metas, recorrências e orçamento","Leitura clara do resultado do mês"],
      cta:"Conhecer o Pessoal"
    },
    {
      icon: Building2, eyebrow:"PARA QUEM ADMINISTRA UMA EMPRESA", title:"Equity One Negócios", price:formatCurrency(pricing.business_price_cents), href:"/negocios",
      text:"Para transformar movimentação financeira em visão de caixa, compromissos e resultado para decidir com mais segurança.",
      bullets:["Fluxo de caixa e visão gerencial","Contas a pagar e a receber","Custos, recorrências e categorias","Relatórios para acompanhar o negócio"],
      cta:"Conhecer o Negócios", dark:true
    },
    {
      icon: HeartPulse, eyebrow:"EXCLUSIVO PARA MÉDICOS", title:"Equity One Médicos", price:formatCurrency(pricing.medical_price_cents), href:"/medicos",
      text:"Uma gestão construída para conectar plantões, vínculos, recebimentos, valor da hora, patrimônio e decisões de carreira.",
      bullets:["Plantões e vínculos profissionais","Recebido, pendente e atrasado","Valor da hora e rentabilidade por vínculo","Carreira, investimentos e patrimônio"],
      cta:"Conhecer o Médicos"
    }
  ];
  return <main className="min-h-screen overflow-hidden bg-[#f3f1eb] text-[#0b0c0f]">
    <header className="sticky top-0 z-50 border-b border-black/[.06] bg-[#f3f1eb]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[92px] max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <EquityOneLogo priority className="h-[86px] md:h-[96px] w-auto"/>
          <span className="hidden text-[11px] font-black uppercase tracking-[.22em] text-[#8e6924] lg:block">Gestão financeira inteligente</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
          <a href="#problema" className="hover:text-black">Por que Equity One</a>
          <a href="#como-funciona" className="hover:text-black">Como funciona</a>
          <a href="#solucoes" className="hover:text-black">Soluções</a>
          <a href="#seguranca" className="hover:text-black">Segurança</a>
        </nav>
        <Link href="/login"><Button variant="outline" className="h-11 rounded-xl border-black/10 bg-white px-5 font-bold">Já sou cliente</Button></Link>
      </div>
    </header>

    <section className="relative border-b border-black/[.06]">
      <div className="absolute inset-0 equity-grid opacity-60"/>
      <div className="absolute -right-40 -top-32 size-[620px] rounded-full bg-[#d0a84f]/15 blur-3xl"/>
      <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[1.02fr_.98fr] lg:items-center">
        <div>
          <div className="mb-6"><EquityOneLogo className="h-[110px] md:h-[128px] w-auto"/></div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#b99039]/20 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[.17em] text-[#8e6924] shadow-sm"><Sparkles className="size-4"/>Controle não é saber o saldo. É saber o que fazer com ele.</div>
          <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[.96] tracking-[-.055em] md:text-7xl">Pare de descobrir sua situação financeira <span className="equity-gold-text">depois que o mês já aconteceu.</span></h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">O Equity One transforma receitas, despesas, vencimentos e objetivos em uma visão simples do que você tem, do que ainda vai acontecer e do que precisa da sua decisão.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#solucoes"><Button className="h-14 rounded-2xl bg-[#0b0c0f] px-7 text-base font-black text-white hover:bg-black">Quero organizar minha gestão<ArrowRight className="size-5"/></Button></a>
            <a href="#como-funciona"><Button variant="outline" className="h-14 rounded-2xl border-black/10 bg-white px-7 text-base font-bold">Entender como funciona</Button></a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-2"><Check className="size-4 text-emerald-600"/>Sem planilhas espalhadas</span>
            <span className="flex items-center gap-2"><Check className="size-4 text-emerald-600"/>Acesso pelo celular</span>
            <span className="flex items-center gap-2"><Check className="size-4 text-emerald-600"/>Pagamento seguro</span>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2.25rem] border border-white/10 bg-[#0b0c0f] p-5 text-white shadow-[0_40px_90px_rgba(10,10,12,.28)] md:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#d4ad55]">Visão executiva</p><h3 className="mt-2 text-xl font-black">Seu mês, antes do fim do mês.</h3></div><span className="rounded-xl bg-white/[.06] p-3"><BarChart3 className="size-5 text-[#d4ad55]"/></span></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[['Saldo disponível','R$ 8.420'],['A receber','R$ 4.180'],['Próximos 7 dias','5 contas'],['Meta do mês','82%']].map(([a,b])=><div key={a} className="rounded-2xl border border-white/[.06] bg-white/[.045] p-4"><p className="text-[11px] text-slate-500">{a}</p><p className="mt-2 text-xl font-black">{b}</p></div>)}
            </div>
            <div className="mt-4 rounded-2xl border border-[#d4ad55]/15 bg-[#d4ad55]/10 p-5"><div className="flex gap-3"><BellRing className="mt-0.5 size-5 shrink-0 text-[#e3c77f]"/><div><p className="text-sm font-black text-[#ead291]">Você não deveria precisar procurar o problema.</p><p className="mt-1 text-xs leading-5 text-slate-400">O dashboard precisa colocar vencimentos, pendências e decisões importantes na sua frente.</p></div></div></div>
            <div className="mt-4 grid grid-cols-[1.35fr_.65fr] gap-3">
              <div className="rounded-2xl bg-white/[.045] p-4"><div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">Evolução do resultado</span><TrendingUp className="size-4 text-emerald-400"/></div><div className="mt-5 flex h-20 items-end gap-2">{[32,48,41,58,66,76,88].map((h,i)=><span key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-[#8c6a27] to-[#e0bf70]" style={{height:`${h}%`}}/> )}</div></div>
              <div className="rounded-2xl bg-white/[.045] p-4"><p className="text-[11px] text-slate-500">Prioridade</p><p className="mt-4 text-3xl font-black text-[#e0bf70]">3</p><p className="mt-1 text-[11px] leading-4 text-slate-400">itens exigem atenção hoje</p></div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-black/5 bg-white p-4 shadow-xl md:block"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">A lógica muda</p><p className="mt-1 text-sm font-black">de registrar → para decidir</p></div>
        </div>
      </div>
    </section>

    <section id="problema" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9a762b]">O problema real</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-[-.035em] md:text-5xl">Não é falta de dinheiro que torna a gestão confusa. <span className="text-slate-400">É falta de visão.</span></h2></div><p className="max-w-xl text-base leading-7 text-slate-600 lg:ml-auto">Você não deveria precisar abrir banco, planilha, bloco de notas e calendário para descobrir se pode assumir uma nova despesa. O Equity One existe para colocar contexto em cada número.</p></div>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">{pains.map(({icon:Icon,title,text})=><article key={title} className="rounded-[2rem] border border-black/[.06] bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,.05)]"><span className="grid size-12 place-items-center rounded-2xl bg-[#d4ad55]/10 text-[#906c25]"><Icon className="size-5"/></span><h3 className="mt-6 text-xl font-black leading-7">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{text}</p></article>)}</div>
    </section>

    <section id="como-funciona" className="border-y border-black/[.06] bg-[#0b0c0f] text-white">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-24"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.22em] text-[#d4ad55]">Como o Equity One pensa</p><h2 className="mt-5 text-4xl font-black tracking-[-.04em] md:text-5xl">Você para de olhar números soltos e passa a enxergar contexto.</h2><p className="mt-5 text-base leading-7 text-slate-400">O Equity One organiza o que entrou, o que saiu, o que ainda vai acontecer e o que exige sua decisão, transformando movimentação em gestão.</p></div><div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[["Hoje","O que precisa da sua atenção agora"],["Este mês","Quanto entrou, quanto saiu e o que ainda falta acontecer"],["Próximos dias","Contas, recebimentos e compromissos antes do vencimento"],["Evolução","Se suas decisões estão melhorando ou piorando seu resultado"]].map(([a,b],i)=><div key={a} className="rounded-[2rem] border border-white/10 bg-white/[.04] p-6"><p className="text-[11px] font-black uppercase tracking-[.16em] text-[#d4ad55]">0{i+1}</p><h3 className="mt-4 text-xl font-black">{a}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{b}</p></div>)}</div></div>
    </section>

    <section id="solucoes" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9a762b]">Escolha sua experiência</p><h2 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-5xl">Um Equity One para cada rotina.</h2></div><p className="max-w-2xl text-base leading-7 text-slate-600">A estrutura é a mesma: mais clareza, menos retrabalho e decisões melhores. O que muda é a forma como isso se adapta à sua vida, ao seu negócio ou à carreira médica.</p></div>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">{products.map((product)=><ProductCard key={product.title} {...product}/>)}</div>
    </section>

    <section id="seguranca" className="border-t border-black/[.06] bg-white"><div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 md:px-8 lg:grid-cols-[1fr_.95fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#9a762b]">Segurança e confiança</p><h2 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-5xl">Gestão premium também precisa transmitir confiança.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">O Equity One trabalha com autenticação, áreas privadas por usuário e pagamentos integrados. Você foca na gestão enquanto a plataforma organiza acesso, assinatura e operação.</p></div><div className="rounded-[2rem] border border-black/[.06] bg-[#f7f5ef] p-7 shadow-[0_18px_50px_rgba(15,23,42,.05)]"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-[#d4ad55]/10 text-[#9a762b]"><ShieldCheck className="size-6"/></span><div><h3 className="text-2xl font-black">Ambiente organizado para vender e operar.</h3><p className="mt-3 text-sm leading-6 text-slate-600">Checkout integrado, controle administrativo, cupons, dashboards específicos e navegação pensada para reduzir atrito.</p></div></div></div></div></section>

    <section className="relative overflow-hidden bg-[#0b0c0f] text-white"><div className="absolute left-1/2 top-0 h-64 w-[700px] -translate-x-1/2 rounded-full bg-[#c9a34d]/10 blur-3xl"/><div className="relative mx-auto max-w-5xl px-4 py-24 text-center md:px-8 md:py-28"><div className="mb-6 flex justify-center"><EquityOneLogo className="h-[96px] md:h-[112px] w-auto"/></div><p className="text-xs font-black uppercase tracking-[.22em] text-[#d4ad55]">A decisão começa com visibilidade</p><h2 className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-tight tracking-[-.04em] md:text-6xl">Seu dinheiro já está contando uma história. <span className="text-[#dfbf70]">O Equity One ajuda você a enxergá-la a tempo de mudar o próximo capítulo.</span></h2><p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400">Escolha a experiência correspondente à sua rotina e comece a transformar movimentação em gestão.</p><a href="#solucoes"><Button className="mt-8 h-14 rounded-2xl bg-[#d4ad55] px-8 text-base font-black text-black hover:bg-[#e0c278]">Escolher meu Equity One<ArrowRight className="size-5"/></Button></a></div></section>

    <footer className="bg-[#08090b] text-slate-500"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-xs md:flex-row md:items-center md:justify-between md:px-8"><div className="flex items-center gap-4"><EquityOneLogo className="h-16 w-auto"/><div><strong className="tracking-[.2em] text-white">EQUITY ONE</strong><p className="mt-1">Gestão financeira inteligente.</p></div></div><div className="flex gap-5"><Link href="/login" className="hover:text-white">Entrar</Link><a href="#solucoes" className="hover:text-white">Soluções</a><a href="#seguranca" className="hover:text-white">Segurança</a></div></div></footer>
  </main>
}

function ProductCard({icon:Icon,eyebrow,title,price,href,text,bullets,cta,dark=false}:{icon:any;eyebrow:string;title:string;price:string;href:string;text:string;bullets:string[];cta:string;dark?:boolean}){
  return <article className={`flex h-full flex-col rounded-[2.15rem] border p-7 ${dark?"border-black bg-[#0b0c0f] text-white shadow-2xl":"border-black/[.06] bg-[#f6f4ee]"}`}>
    <div className="flex items-start justify-between gap-4"><span className={`grid size-12 place-items-center rounded-2xl ${dark?"bg-[#d4ad55]/15 text-[#d4ad55]":"bg-[#d4ad55]/10 text-[#906c25]"}`}><Icon className="size-6"/></span><div className="text-right"><p className={`text-[10px] font-black uppercase tracking-[.16em] ${dark?"text-slate-500":"text-slate-400"}`}>a partir de</p><p className="mt-1 text-xl font-black">{price}<span className={`text-xs font-semibold ${dark?"text-slate-500":"text-slate-400"}`}>/mês</span></p></div></div>
    <p className={`mt-7 text-[10px] font-black uppercase tracking-[.18em] ${dark?"text-[#d4ad55]":"text-[#906c25]"}`}>{eyebrow}</p><h3 className="mt-2 text-2xl font-black">{title}</h3><p className={`mt-3 text-sm leading-6 ${dark?"text-slate-400":"text-slate-600"}`}>{text}</p>
    <div className="mt-6 space-y-3">{bullets.map(x=><div key={x} className="flex gap-3 text-sm font-semibold"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500"/><span>{x}</span></div>)}</div>
    <Link href={href} className="mt-auto pt-8"><Button className={`h-13 w-full rounded-2xl font-black ${dark?"bg-[#d4ad55] text-black hover:bg-[#dfc277]":"bg-[#0b0c0f] text-white hover:bg-black"}`}>{cta}<ChevronRight className="size-4"/></Button></Link>
  </article>
}
