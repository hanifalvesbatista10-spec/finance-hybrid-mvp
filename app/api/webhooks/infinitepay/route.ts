import { NextResponse } from "next/server";

import { confirmInfinitePayPayment } from "@/lib/infinitepay";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderNsu = String(body.order_nsu ?? "");
    const transactionNsu = String(body.transaction_nsu ?? "");
    const invoiceSlug = String(
      body.invoice_slug ?? body.slug ?? "",
    );
    const receiptUrl = String(body.receipt_url ?? "");

    if (!orderNsu || !transactionNsu || !invoiceSlug) {
      return NextResponse.json(
        {
          success: false,
          message: "Dados do webhook incompletos.",
        },
        { status: 400 },
      );
    }

    const result = await confirmInfinitePayPayment({
      orderNsu,
      transactionNsu,
      invoiceSlug,
      receiptUrl,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: result.status === 202 ? 400 : result.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: null,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível processar o webhook.",
      },
      { status: 400 },
    );
  }
}
