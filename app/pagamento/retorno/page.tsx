import { PaymentReturnClient } from "./PaymentReturnClient";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

export default async function PaymentReturnPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PaymentReturnClient
      orderNsu={first(params.order_nsu)}
      transactionNsu={first(params.transaction_nsu)}
      slug={first(params.slug)}
      receiptUrl={first(params.receipt_url)}
    />
  );
}
