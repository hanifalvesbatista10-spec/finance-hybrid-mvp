import { NextResponse } from "next/server";
import { resolveCoupon, type CheckoutPlan } from "@/lib/infinitepay";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  try{
    const body=await request.json();
    const plan=String(body.plan??"").toUpperCase() as CheckoutPlan;
    if(!["PERSONAL","BUSINESS","MEDICAL"].includes(plan)) return NextResponse.json({error:"Produto inválido."},{status:400});
    const pricing=await resolveCoupon(plan,body.coupon_code);
    if(!pricing.coupon) return NextResponse.json({error:"Informe um cupom."},{status:400});
    return NextResponse.json({valid:true,code:pricing.coupon.code,original_amount:pricing.originalAmount,discount_amount:pricing.discountAmount,final_amount:pricing.finalAmount});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Cupom inválido."},{status:400})}
}
