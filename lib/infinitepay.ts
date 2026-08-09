import { createHmac, timingSafeEqual } from "crypto";
import { adminSupabase } from "@/lib/admin";

export const INFINITEPAY_HANDLE = "aphhardcore";
export const PLAN_CONFIG = {
  PERSONAL: { amount: 1990, description: "Equity One Pessoal — Gestão Financeira" },
  BUSINESS: { amount: 5990, description: "Equity One Negócios — Gestão Financeira Empresarial" },
  MEDICAL: { amount: 5990, description: "Equity One Médicos — Gestão Financeira e Carreira Médica" },
} as const;
export type CheckoutPlan = keyof typeof PLAN_CONFIG;

type ConfirmationInput = { orderNsu:string; transactionNsu:string; invoiceSlug:string; receiptUrl?:string };
type ClaimPayload = { order_nsu:string; transaction_nsu:string; exp:number };

function claimSecret() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY não configurada no servidor.");
  return secret;
}
function sign(value:string) { return createHmac("sha256", claimSecret()).update(value).digest("base64url"); }
export function createPurchaseClaimToken(orderNsu:string, transactionNsu:string) {
  const payload:ClaimPayload = { order_nsu:orderNsu, transaction_nsu:transactionNsu, exp:Date.now()+60*60*1000 };
  const encoded = Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}
export function verifyPurchaseClaimToken(token:string) {
  const [encoded,signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected=sign(encoded), left=Buffer.from(signature), right=Buffer.from(expected);
  if (left.length!==right.length || !timingSafeEqual(left,right)) return null;
  try {
    const payload=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8")) as ClaimPayload;
    if (!payload.order_nsu || !payload.transaction_nsu || !payload.exp || payload.exp<Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function resolveCoupon(plan:CheckoutPlan, rawCode?:string) {
  const code=String(rawCode??"").trim().toUpperCase();
  const original=PLAN_CONFIG[plan].amount;
  if(!code) return { coupon:null as any, originalAmount:original, discountAmount:0, finalAmount:original };
  const now=new Date().toISOString();
  const {data:coupon,error}=await adminSupabase.from("coupons").select("*").eq("code",code).eq("is_active",true).maybeSingle();
  if(error || !coupon) throw new Error("Cupom inválido ou inativo.");
  if(coupon.starts_at && coupon.starts_at>now) throw new Error("Este cupom ainda não está disponível.");
  if(coupon.ends_at && coupon.ends_at<now) throw new Error("Este cupom expirou.");
  const products=Array.isArray(coupon.product_codes)?coupon.product_codes:[];
  if(products.length && !products.includes(plan)) throw new Error("Este cupom não é válido para este produto.");
  if(coupon.max_uses && Number(coupon.uses_count||0)>=Number(coupon.max_uses)) throw new Error("Este cupom atingiu o limite de utilizações.");
  let discount=0;
  if(coupon.discount_type==="PERCENT") discount=Math.round(original*(Number(coupon.discount_value)/100));
  else discount=Math.round(Number(coupon.discount_value)*100);
  discount=Math.max(0,Math.min(discount,original-100));
  return {coupon,originalAmount:original,discountAmount:discount,finalAmount:original-discount};
}

export async function confirmInfinitePayPayment(input:ConfirmationInput) {
  const {data:order,error:orderError}=await adminSupabase
    .from("subscription_orders")
    .select("order_nsu,amount,status,user_id,transaction_nsu,plan,coupon_id")
    .eq("order_nsu",input.orderNsu).maybeSingle();
  if (orderError || !order) return {ok:false as const,status:404,message:"Pedido não encontrado."};
  if (order.status === "ACTIVATED") return {ok:true as const,alreadyActivated:true,needsRegistration:false,periodEnd:null,claimToken:null};
  if (order.status === "PAID" && !order.user_id && order.transaction_nsu===input.transactionNsu) {
    return {ok:true as const,alreadyActivated:false,needsRegistration:true,periodEnd:null,claimToken:createPurchaseClaimToken(input.orderNsu,input.transactionNsu)};
  }

  const response=await fetch("https://api.checkout.infinitepay.io/payment_check",{
    method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
    body:JSON.stringify({handle:INFINITEPAY_HANDLE,order_nsu:input.orderNsu,transaction_nsu:input.transactionNsu,slug:input.invoiceSlug}),
    cache:"no-store",
  });
  const raw=await response.text(); let verification:any={};
  if(raw){try{verification=JSON.parse(raw)}catch{verification={}}}
  if(!response.ok) return {ok:false as const,status:502,message:"Não foi possível consultar o pagamento na InfinitePay."};
  if(!verification?.success || !verification?.paid) return {ok:false as const,status:202,message:"Pagamento ainda não confirmado."};
  const paidAmount=Number(verification.paid_amount??0), expectedAmount=Number(order.amount);
  if(!Number.isFinite(paidAmount)||paidAmount<expectedAmount) return {ok:false as const,status:400,message:"O valor confirmado não corresponde ao pedido."};

  const {data,error}=await adminSupabase.rpc("activate_subscription_order",{
    p_order_nsu:input.orderNsu,p_transaction_nsu:input.transactionNsu,p_invoice_slug:input.invoiceSlug,
    p_receipt_url:input.receiptUrl??"",p_paid_amount:paidAmount,p_capture_method:String(verification.capture_method??"")
  });
  if(error) return {ok:false as const,status:400,message:error.message};
  if(order.coupon_id) await adminSupabase.rpc("register_coupon_redemption",{p_order_nsu:input.orderNsu});
  const needsRegistration=Boolean(data?.needs_registration);
  return {ok:true as const,alreadyActivated:Boolean(data?.already_activated),needsRegistration,
    periodEnd:data?.period_end??null,
    claimToken:needsRegistration?createPurchaseClaimToken(input.orderNsu,input.transactionNsu):null};
}
