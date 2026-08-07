import { adminSupabase } from "@/lib/admin";

export const INFINITEPAY_HANDLE = "aphhardcore";

export const PLAN_CONFIG = {
  PERSONAL: {
    amount: 1990,
    description:
      "Finance Hybrid Personal — Controle Financeiro Completo",
  },
  BUSINESS: {
    amount: 5990,
    description:
      "Finance Hybrid Business — Gestão Financeira Empresarial",
  },
} as const;

export type CheckoutPlan = keyof typeof PLAN_CONFIG;

type ConfirmationInput = {
  orderNsu: string;
  transactionNsu: string;
  invoiceSlug: string;
  receiptUrl?: string;
};

export async function confirmInfinitePayPayment(
  input: ConfirmationInput,
) {
  const { data: order, error: orderError } = await adminSupabase
    .from("subscription_orders")
    .select("order_nsu,amount,status")
    .eq("order_nsu", input.orderNsu)
    .maybeSingle();

  if (orderError || !order) {
    return {
      ok: false as const,
      status: 404,
      message: "Pedido não encontrado.",
    };
  }

  if (order.status === "ACTIVATED") {
    return {
      ok: true as const,
      alreadyActivated: true,
      periodEnd: null,
    };
  }

  const response = await fetch(
    "https://api.checkout.infinitepay.io/payment_check",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle: INFINITEPAY_HANDLE,
        order_nsu: input.orderNsu,
        transaction_nsu: input.transactionNsu,
        slug: input.invoiceSlug,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      ok: false as const,
      status: 502,
      message:
        "Não foi possível consultar o pagamento na InfinitePay.",
    };
  }

  const verification = await response.json();

  if (!verification?.success || !verification?.paid) {
    return {
      ok: false as const,
      status: 202,
      message: "Pagamento ainda não confirmado.",
    };
  }

  const paidAmount = Number(verification.paid_amount ?? 0);
  const expectedAmount = Number(order.amount);

  if (!Number.isFinite(paidAmount) || paidAmount < expectedAmount) {
    return {
      ok: false as const,
      status: 400,
      message: "O valor confirmado não corresponde ao pedido.",
    };
  }

  const { data, error } = await adminSupabase.rpc(
    "activate_subscription_order",
    {
      p_order_nsu: input.orderNsu,
      p_transaction_nsu: input.transactionNsu,
      p_invoice_slug: input.invoiceSlug,
      p_receipt_url: input.receiptUrl ?? "",
      p_paid_amount: paidAmount,
      p_capture_method: String(
        verification.capture_method ?? "",
      ),
    },
  );

  if (error) {
    return {
      ok: false as const,
      status: 400,
      message: error.message,
    };
  }

  return {
    ok: true as const,
    alreadyActivated: Boolean(data?.already_activated),
    periodEnd: data?.period_end ?? null,
  };
}
