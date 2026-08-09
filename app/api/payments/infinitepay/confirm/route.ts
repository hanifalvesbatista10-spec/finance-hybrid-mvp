import { NextResponse } from "next/server";
import { confirmInfinitePayPayment } from "@/lib/infinitepay";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  const body=await request.json();
  const orderNsu=String(body.order_nsu??""), transactionNsu=String(body.transaction_nsu??""),
    invoiceSlug=String(body.slug??body.invoice_slug??""), receiptUrl=String(body.receipt_url??"");
  if(!orderNsu||!transactionNsu||!invoiceSlug) return NextResponse.json({error:"Dados da transação incompletos."},{status:400});
  const result=await confirmInfinitePayPayment({orderNsu,transactionNsu,invoiceSlug,receiptUrl});
  if(!result.ok) return NextResponse.json({error:result.message,pending:result.status===202},{status:result.status});
  return NextResponse.json({success:true,already_activated:result.alreadyActivated,needs_registration:result.needsRegistration,
    claim_token:result.claimToken,period_end:result.periodEnd});
}
