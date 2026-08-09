import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";
import { verifyPurchaseClaimToken } from "@/lib/infinitepay";
export const dynamic="force-dynamic"; export const runtime="nodejs";
export async function POST(request:Request){
  const body=await request.json(); const token=String(body.token??""),fullName=String(body.full_name??"").trim(),email=String(body.email??"").trim().toLowerCase(),password=String(body.password??"");
  if(!token||!fullName||!email||password.length<6) return NextResponse.json({error:"Preencha nome, e-mail e uma senha com pelo menos 6 caracteres."},{status:400});
  const claim=verifyPurchaseClaimToken(token); if(!claim) return NextResponse.json({error:"Esta autorização de cadastro é inválida ou expirou."},{status:403});
  const {data:order,error:orderError}=await adminSupabase.from("subscription_orders").select("id,order_nsu,transaction_nsu,plan,status,user_id,claimed_at").eq("order_nsu",claim.order_nsu).maybeSingle();
  if(orderError||!order) return NextResponse.json({error:"Compra não encontrada."},{status:404});
  if(order.transaction_nsu!==claim.transaction_nsu||order.status!=="PAID"||order.user_id||order.claimed_at) return NextResponse.json({error:"Esta compra já foi utilizada ou não está disponível para cadastro."},{status:409});
  const profileRole=order.plan==="BUSINESS"?"INSTITUTIONAL":"PERSONAL";
  const {data:created,error:createError}=await adminSupabase.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,role:profileRole}});
  if(createError||!created.user) return NextResponse.json({error:createError?.message||"Não foi possível criar a conta."},{status:400});
  const userId=created.user.id,now=new Date(),end=new Date(now.getTime()+30*86400000);
  const cleanup=async()=>{await adminSupabase.auth.admin.deleteUser(userId)};
  const {error:profileError}=await adminSupabase.from("profiles").upsert({id:userId,full_name:fullName,role:profileRole,system_role:"USER",status:"ACTIVE"}); if(profileError){await cleanup();return NextResponse.json({error:profileError.message},{status:400})}
  const {error:subError}=await adminSupabase.from("subscriptions").upsert({user_id:userId,plan:order.plan,status:"ACTIVE",starts_at:now.toISOString(),current_period_start:now.toISOString(),current_period_end:end.toISOString(),access_mode:"PROVIDER",payment_provider:"INFINITEPAY",provider_subscription_id:order.transaction_nsu,last_payment_at:now.toISOString(),next_payment_at:end.toISOString(),notes:"Primeiro acesso liberado após pagamento InfinitePay"},{onConflict:"user_id"}); if(subError){await cleanup();return NextResponse.json({error:subError.message},{status:400})}
  await adminSupabase.from("user_products").upsert({user_id:userId,product_code:String(order.plan),status:"ACTIVE"},{onConflict:"user_id,product_code"});
  if(order.plan==="MEDICAL") await adminSupabase.from("medical_profiles").upsert({user_id:userId,onboarding_completed:false});
  const {data:claimed,error:orderUpdateError}=await adminSupabase.from("subscription_orders").update({user_id:userId,status:"ACTIVATED",activated_at:now.toISOString(),claimed_at:now.toISOString(),claim_email:email}).eq("id",order.id).is("user_id",null).select("id").maybeSingle();
  if(orderUpdateError||!claimed){await cleanup();return NextResponse.json({error:orderUpdateError?.message||"Esta compra já foi vinculada a outra conta."},{status:409})}
  await adminSupabase.from("coupon_redemptions").update({user_id:userId}).eq("order_nsu",order.order_nsu);
  await adminSupabase.from("audit_logs").insert({actor_id:userId,action:"PAID_USER_REGISTERED",target_user_id:userId,metadata:{order_nsu:order.order_nsu,plan:order.plan,email}});
  return NextResponse.json({success:true,email,plan:order.plan,destination:order.plan==="MEDICAL"?"/medicos/onboarding":"/dashboard"});
}
