import { NextResponse } from "next/server";
import { adminSupabase, requireSuperAdmin } from "@/lib/admin";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  const auth=await requireSuperAdmin(request); if("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status});
  const {data,error}=await adminSupabase.from("coupons").select("*").order("created_at",{ascending:false});
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({coupons:data??[]});
}
export async function POST(request:Request){
  const auth=await requireSuperAdmin(request); if("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status});
  const b=await request.json(); const code=String(b.code??"").trim().toUpperCase();
  if(!/^[A-Z0-9_-]{3,30}$/.test(code)) return NextResponse.json({error:"Código inválido. Use 3 a 30 letras, números, _ ou -."},{status:400});
  const type=String(b.discount_type??"PERCENT"); const value=Number(b.discount_value);
  if(!["PERCENT","FIXED"].includes(type)||!Number.isFinite(value)||value<=0||(type==="PERCENT"&&value>100)) return NextResponse.json({error:"Desconto inválido."},{status:400});
  const productCodes=Array.isArray(b.product_codes)?b.product_codes.filter((x:any)=>["PERSONAL","BUSINESS","MEDICAL"].includes(String(x))):[];
  const payload={code,discount_type:type,discount_value:value,product_codes:productCodes,is_active:b.is_active!==false,starts_at:b.starts_at||null,ends_at:b.ends_at||null,max_uses:b.max_uses?Number(b.max_uses):null,per_customer_limit:b.per_customer_limit?Number(b.per_customer_limit):1,created_by:auth.user.id};
  const {data,error}=await adminSupabase.from("coupons").insert(payload).select("*").single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json(data);
}
export async function PATCH(request:Request){
  const auth=await requireSuperAdmin(request); if("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status});
  const b=await request.json(); if(!b.id) return NextResponse.json({error:"Cupom obrigatório."},{status:400});
  const payload:any={updated_at:new Date().toISOString()};
  for(const k of ["is_active","ends_at","starts_at","max_uses","per_customer_limit"]){if(k in b) payload[k]=b[k]||null}
  const {data,error}=await adminSupabase.from("coupons").update(payload).eq("id",b.id).select("*").single();
  if(error) return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
}
export async function DELETE(request:Request){
  const auth=await requireSuperAdmin(request); if("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status});
  const id=new URL(request.url).searchParams.get("id"); if(!id) return NextResponse.json({error:"Cupom obrigatório."},{status:400});
  const {error}=await adminSupabase.from("coupons").delete().eq("id",id); if(error) return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({ok:true});
}
