import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";
import { INFINITEPAY_HANDLE, PLAN_CONFIG, createPurchaseClaimToken, resolveCoupon, type CheckoutPlan } from "@/lib/infinitepay";
export const dynamic="force-dynamic";
export const runtime="nodejs";
function jsonError(message:string,status=400){return NextResponse.json({error:message},{status})}
export async function POST(request:Request){
  let orderNsu="";
  try{
    const body=await request.json().catch(()=>({}));
    const requestedPlan=String(body.plan??"").toUpperCase();
    if(!["PERSONAL","BUSINESS","MEDICAL"].includes(requestedPlan)) return jsonError("Plano inválido.",400);
    const plan=requestedPlan as CheckoutPlan, config=PLAN_CONFIG[plan];
    const pricing=await resolveCoupon(plan,body.coupon_code);
    orderNsu=`EQ-${plan}-${randomUUID().replaceAll("-","").toUpperCase()}`;
    const origin=new URL(request.url).origin;
    const {error:insertError}=await adminSupabase.from("subscription_orders").insert({
      user_id:null,order_nsu:orderNsu,plan,amount:pricing.finalAmount,original_amount:pricing.originalAmount,
      discount_amount:pricing.discountAmount,coupon_id:pricing.coupon?.id??null,coupon_code:pricing.coupon?.code??null,
      description:config.description,status:"PENDING"
    });
    if(insertError) return jsonError(`Não foi possível registrar o pedido: ${insertError.message}`,400);

    // Cupom de 100% (ou desconto que zere o plano): não cria checkout de valor zero.
    // O pedido é validado e marcado como pago pelo próprio motor de cupons.
    if(pricing.finalAmount===0){
      const freeTransactionNsu=`COUPON-${randomUUID().replaceAll("-","").toUpperCase()}`;
      const now=new Date().toISOString();
      const {error:freeError}=await adminSupabase.from("subscription_orders").update({
        status:"PAID",transaction_nsu:freeTransactionNsu,paid_amount:0,paid_at:now,
        capture_method:"COUPON_100",failure_reason:null
      }).eq("order_nsu",orderNsu);
      if(freeError) return jsonError(`Não foi possível liberar o cupom: ${freeError.message}`,400);
      if(pricing.coupon?.id){
        const {error:redemptionError}=await adminSupabase.rpc("register_coupon_redemption",{p_order_nsu:orderNsu});
        if(redemptionError){
          await adminSupabase.from("subscription_orders").update({status:"FAILED",failure_reason:redemptionError.message}).eq("order_nsu",orderNsu);
          return jsonError(`Não foi possível registrar a utilização do cupom: ${redemptionError.message}`,400);
        }
      }
      const claimToken=createPurchaseClaimToken(orderNsu,freeTransactionNsu);
      return NextResponse.json({
        free:true,registration_url:`${origin}/cadastro-pago?token=${encodeURIComponent(claimToken)}`,
        order_nsu:orderNsu,plan,amount:0,original_amount:pricing.originalAmount,
        discount_amount:pricing.discountAmount,coupon:pricing.coupon?.code??null
      });
    }

    const r=await fetch("https://api.checkout.infinitepay.io/links",{
      method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({handle:INFINITEPAY_HANDLE,items:[{quantity:1,price:pricing.finalAmount,description:config.description}],
        order_nsu:orderNsu,redirect_url:`${origin}/pagamento/retorno`,webhook_url:`${origin}/api/webhooks/infinitepay`}),cache:"no-store"
    });
    const raw=await r.text(); let json:any={}; if(raw){try{json=JSON.parse(raw)}catch{json={}}}
    if(!r.ok||!json.url){
      const reason=json.message||json.error||raw.slice(0,300)||`HTTP ${r.status}`;
      await adminSupabase.from("subscription_orders").update({status:"FAILED",failure_reason:reason}).eq("order_nsu",orderNsu);
      return jsonError(`A InfinitePay recusou o checkout: ${reason}`,502);
    }
    await adminSupabase.from("subscription_orders").update({status:"CHECKOUT_CREATED",checkout_url:json.url,failure_reason:null}).eq("order_nsu",orderNsu);
    return NextResponse.json({url:json.url,order_nsu:orderNsu,plan,amount:pricing.finalAmount,original_amount:pricing.originalAmount,discount_amount:pricing.discountAmount,coupon:pricing.coupon?.code??null});
  }catch(error){
    const message=error instanceof Error?error.message:"Erro inesperado ao gerar checkout.";
    if(orderNsu) await adminSupabase.from("subscription_orders").update({status:"FAILED",failure_reason:message}).eq("order_nsu",orderNsu);
    return jsonError(message,400);
  }
}
