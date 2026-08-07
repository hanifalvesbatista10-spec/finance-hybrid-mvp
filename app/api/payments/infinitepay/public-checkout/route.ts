import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";
import { INFINITEPAY_HANDLE, PLAN_CONFIG, type CheckoutPlan } from "@/lib/infinitepay";
export const dynamic="force-dynamic";
export const runtime="nodejs";
function jsonError(message:string,status=400){return NextResponse.json({error:message},{status})}
export async function POST(request:Request){
  let orderNsu="";
  try{
    const body=await request.json().catch(()=>({}));
    const requestedPlan=String(body.plan??"").toUpperCase();
    if(requestedPlan!=="PERSONAL"&&requestedPlan!=="BUSINESS") return jsonError("Plano inválido.",400);
    const plan=requestedPlan as CheckoutPlan, config=PLAN_CONFIG[plan];
    orderNsu=`FH-${plan}-${randomUUID().replaceAll("-","").toUpperCase()}`;
    const origin=new URL(request.url).origin;
    const {error:insertError}=await adminSupabase.from("subscription_orders").insert({
      user_id:null,order_nsu:orderNsu,plan,amount:config.amount,description:config.description,status:"PENDING"
    });
    if(insertError) return jsonError(`Não foi possível registrar o pedido: ${insertError.message}`,400);
    const r=await fetch("https://api.checkout.infinitepay.io/links",{
      method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({handle:INFINITEPAY_HANDLE,items:[{quantity:1,price:config.amount,description:config.description}],
        order_nsu:orderNsu,redirect_url:`${origin}/pagamento/retorno`,webhook_url:`${origin}/api/webhooks/infinitepay`}),cache:"no-store"
    });
    const raw=await r.text(); let json:any={}; if(raw){try{json=JSON.parse(raw)}catch{json={}}}
    if(!r.ok||!json.url){
      const reason=json.message||json.error||raw.slice(0,300)||`HTTP ${r.status}`;
      await adminSupabase.from("subscription_orders").update({status:"FAILED",failure_reason:reason}).eq("order_nsu",orderNsu);
      return jsonError(`A InfinitePay recusou o checkout: ${reason}`,502);
    }
    await adminSupabase.from("subscription_orders").update({status:"CHECKOUT_CREATED",checkout_url:json.url,failure_reason:null}).eq("order_nsu",orderNsu);
    return NextResponse.json({url:json.url,order_nsu:orderNsu,plan,amount:config.amount});
  }catch(error){
    const message=error instanceof Error?error.message:"Erro inesperado ao gerar checkout.";
    if(orderNsu) await adminSupabase.from("subscription_orders").update({status:"FAILED",failure_reason:message}).eq("order_nsu",orderNsu);
    return jsonError(`Falha interna ao gerar o checkout: ${message}`,500);
  }
}
