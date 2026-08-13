export type BankTheme = {
  key: string;
  label: string;
  card: string;
  soft: string;
  text: string;
  accent: string;
  initials: string;
};

const themes: Array<{match:string[]; theme:BankTheme}> = [
  {match:["itau","itaú"],theme:{key:"itau",label:"Itaú",card:"bg-[#EC7000] text-white",soft:"bg-[#EC7000]/10",text:"text-[#B84F00]",accent:"bg-[#001E4D]",initials:"IT"}},
  {match:["nubank","nu pagamentos","nu"],theme:{key:"nubank",label:"Nubank",card:"bg-[#820AD1] text-white",soft:"bg-[#820AD1]/10",text:"text-[#820AD1]",accent:"bg-[#820AD1]",initials:"NU"}},
  {match:["santander"],theme:{key:"santander",label:"Santander",card:"bg-[#EC0000] text-white",soft:"bg-[#EC0000]/10",text:"text-[#C40000]",accent:"bg-[#EC0000]",initials:"ST"}},
  {match:["bradesco"],theme:{key:"bradesco",label:"Bradesco",card:"bg-[#CC092F] text-white",soft:"bg-[#CC092F]/10",text:"text-[#A60729]",accent:"bg-[#CC092F]",initials:"BR"}},
  {match:["banco do brasil","bb"],theme:{key:"bb",label:"Banco do Brasil",card:"bg-[#F9DD16] text-[#102B72]",soft:"bg-[#F9DD16]/20",text:"text-[#102B72]",accent:"bg-[#102B72]",initials:"BB"}},
  {match:["caixa","caixa economica","caixa econômica"],theme:{key:"caixa",label:"Caixa",card:"bg-[#0066B3] text-white",soft:"bg-[#0066B3]/10",text:"text-[#005291]",accent:"bg-[#F9A51A]",initials:"CX"}},
  {match:["inter","banco inter"],theme:{key:"inter",label:"Inter",card:"bg-[#FF7A00] text-white",soft:"bg-[#FF7A00]/10",text:"text-[#D76100]",accent:"bg-[#FF7A00]",initials:"IN"}},
  {match:["c6","c6 bank"],theme:{key:"c6",label:"C6 Bank",card:"bg-[#171717] text-white",soft:"bg-black/5",text:"text-black",accent:"bg-[#171717]",initials:"C6"}},
  {match:["picpay"],theme:{key:"picpay",label:"PicPay",card:"bg-[#21C25E] text-white",soft:"bg-[#21C25E]/10",text:"text-[#168A43]",accent:"bg-[#21C25E]",initials:"PP"}},
  {match:["mercado pago","mercadopago"],theme:{key:"mercadopago",label:"Mercado Pago",card:"bg-[#00B1EA] text-white",soft:"bg-[#00B1EA]/10",text:"text-[#007EA6]",accent:"bg-[#00B1EA]",initials:"MP"}},
];

const fallback: BankTheme = {
  key:"default",label:"Instituição financeira",card:"bg-[#101116] text-white",soft:"bg-[#d2aa51]/10",text:"text-[#9b772c]",accent:"bg-[#d2aa51]",initials:"$",
};

export function getBankTheme(value?: string | null): BankTheme {
  const normalized=(value||"").trim().toLowerCase();
  if(!normalized)return fallback;
  return themes.find(({match})=>match.some(term=>normalized.includes(term)))?.theme ?? fallback;
}
