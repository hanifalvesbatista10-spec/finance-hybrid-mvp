export type BankTheme = {
  key: string;
  label: string;
  card: string;
  soft: string;
  text: string;
  accent: string;
  initials: string;
  bgColor: string;
  fgColor: string;
  softColor: string;
  textColor: string;
};

const themes: Array<{match:string[]; theme:BankTheme}> = [
  {match:["itau","itaú"],theme:{key:"itau",label:"Itaú",card:"bg-[#EC7000] text-white",soft:"bg-[#EC7000]/10",text:"text-[#B84F00]",accent:"bg-[#001E4D]",initials:"IT",bgColor:"#EC7000",fgColor:"#FFFFFF",softColor:"#FFF0E3",textColor:"#9D4200"}},
  {match:["nubank","nu pagamentos","nu"],theme:{key:"nubank",label:"Nubank",card:"bg-[#820AD1] text-white",soft:"bg-[#820AD1]/10",text:"text-[#820AD1]",accent:"bg-[#820AD1]",initials:"NU",bgColor:"#820AD1",fgColor:"#FFFFFF",softColor:"#F4E7FC",textColor:"#6D08B0"}},
  {match:["santander"],theme:{key:"santander",label:"Santander",card:"bg-[#EC0000] text-white",soft:"bg-[#EC0000]/10",text:"text-[#C40000]",accent:"bg-[#EC0000]",initials:"ST",bgColor:"#EC0000",fgColor:"#FFFFFF",softColor:"#FDE8E8",textColor:"#B60000"}},
  {match:["bradesco"],theme:{key:"bradesco",label:"Bradesco",card:"bg-[#CC092F] text-white",soft:"bg-[#CC092F]/10",text:"text-[#A60729]",accent:"bg-[#CC092F]",initials:"BR",bgColor:"#CC092F",fgColor:"#FFFFFF",softColor:"#FBE8EC",textColor:"#A60729"}},
  {match:["banco do brasil","bb"],theme:{key:"bb",label:"Banco do Brasil",card:"bg-[#F9DD16] text-[#102B72]",soft:"bg-[#F9DD16]/20",text:"text-[#102B72]",accent:"bg-[#102B72]",initials:"BB",bgColor:"#F9DD16",fgColor:"#102B72",softColor:"#FFF9C9",textColor:"#102B72"}},
  {match:["caixa","caixa economica","caixa econômica"],theme:{key:"caixa",label:"Caixa",card:"bg-[#0066B3] text-white",soft:"bg-[#0066B3]/10",text:"text-[#005291]",accent:"bg-[#F9A51A]",initials:"CX",bgColor:"#0066B3",fgColor:"#FFFFFF",softColor:"#E5F2FB",textColor:"#005291"}},
  {match:["inter","banco inter"],theme:{key:"inter",label:"Inter",card:"bg-[#FF7A00] text-white",soft:"bg-[#FF7A00]/10",text:"text-[#D76100]",accent:"bg-[#FF7A00]",initials:"IN",bgColor:"#FF7A00",fgColor:"#FFFFFF",softColor:"#FFF0E3",textColor:"#C85A00"}},
  {match:["c6","c6 bank"],theme:{key:"c6",label:"C6 Bank",card:"bg-[#171717] text-white",soft:"bg-black/5",text:"text-black",accent:"bg-[#171717]",initials:"C6",bgColor:"#171717",fgColor:"#FFFFFF",softColor:"#F0F0F0",textColor:"#171717"}},
  {match:["picpay"],theme:{key:"picpay",label:"PicPay",card:"bg-[#21C25E] text-white",soft:"bg-[#21C25E]/10",text:"text-[#168A43]",accent:"bg-[#21C25E]",initials:"PP",bgColor:"#21C25E",fgColor:"#FFFFFF",softColor:"#E6F8EC",textColor:"#168A43"}},
  {match:["mercado pago","mercadopago"],theme:{key:"mercadopago",label:"Mercado Pago",card:"bg-[#00B1EA] text-white",soft:"bg-[#00B1EA]/10",text:"text-[#007EA6]",accent:"bg-[#00B1EA]",initials:"MP",bgColor:"#00B1EA",fgColor:"#FFFFFF",softColor:"#E4F7FD",textColor:"#007EA6"}},
];

const fallback: BankTheme = {
  key:"default",label:"Instituição financeira",card:"bg-[#101116] text-white",soft:"bg-[#d2aa51]/10",text:"text-[#9b772c]",accent:"bg-[#d2aa51]",initials:"$",bgColor:"#101116",fgColor:"#FFFFFF",softColor:"#F8F1DF",textColor:"#8B6928",
};

export function getBankTheme(value?: string | null): BankTheme {
  const normalized=(value||"").trim().toLowerCase();
  if(!normalized)return fallback;
  return themes.find(({match})=>match.some(term=>normalized.includes(term)))?.theme ?? fallback;
}
