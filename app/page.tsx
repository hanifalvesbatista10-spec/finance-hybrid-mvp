import {DarkLandingPage,type LandingProduct} from "@/components/landing/DarkLandingPage";
import {formatCurrency,getPlatformPricingSettings} from "@/lib/pricing";

export default async function HomePage(){
  const pricing=await getPlatformPricingSettings();
  const supportEmail=(process.env.NEXT_PUBLIC_SUPPORT_EMAIL||"hanifalves99@gmail.com").trim();
  const supportWhatsapp=(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP||"5588993765491").replace(/\D/g,"");
  const whatsappHref=`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent("Olá! Preciso de suporte com o Equity One.")}`;

  const products:LandingProduct[]=[
    {icon:"personal",eyebrow:"PARA SUA VIDA FINANCEIRA",title:"Equity One Pessoal",price:formatCurrency(pricing.personal_price_cents),href:"/pessoal",text:"Organize sua vida financeira com contas, lançamentos, calendário, metas e relatórios no mesmo ambiente.",bullets:["Contas, despesas e receitas","Calendário e vencimentos","Metas e acompanhamento","Relatórios e organização"],cta:"Conhecer o Pessoal"},
    {icon:"business",eyebrow:"PARA QUEM ADMINISTRA UMA EMPRESA",title:"Equity One Negócios",price:formatCurrency(pricing.business_price_cents),href:"/negocios",text:"Transforme movimentação em visão de caixa, compromissos e resultado para acompanhar o negócio com mais clareza.",bullets:["Fluxo de caixa","Contas a pagar e receber","Custos e categorias","Relatórios gerenciais"],cta:"Conhecer o Negócios"},
    {icon:"medical",eyebrow:"EXCLUSIVO PARA MÉDICOS",title:"Equity One Médicos",price:formatCurrency(pricing.medical_price_cents),href:"/medicos",text:"Conecte plantões, vínculos, recebimentos, valor da hora, patrimônio e decisões de carreira em um só produto.",bullets:["Plantões e vínculos","Recebido e pendente","Valor da hora","Carreira e patrimônio"],cta:"Conhecer o Médicos"},
  ];

  return <DarkLandingPage products={products} supportEmail={supportEmail} whatsappHref={whatsappHref}/>;
}
