"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Landmark,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PaymentReturnClient({
  orderNsu,
  transactionNsu,
  slug,
  receiptUrl,
}: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
  receiptUrl: string;
}) {
  const [state, setState] = useState<
    "checking" | "success" | "pending" | "error"
  >("checking");
  const [message, setMessage] = useState(
    "Confirmando seu pagamento...",
  );

  async function confirm() {
    if (!orderNsu || !transactionNsu || !slug) {
      setState("error");
      setMessage(
        "A InfinitePay não retornou todos os dados da transação.",
      );
      return;
    }

    setState("checking");
    setMessage("Confirmando seu pagamento...");

    const response = await fetch(
      "/api/payments/infinitepay/confirm",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_nsu: orderNsu,
          transaction_nsu: transactionNsu,
          slug,
          receipt_url: receiptUrl,
        }),
      },
    );

    const raw = await response.text();
    let json: {
      success?: boolean;
      pending?: boolean;
      error?: string;
    } = {};

    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch {
        json = {};
      }
    }

    if (response.ok && json.success) {
      setState("success");
      setMessage(
        "Pagamento confirmado. Sua assinatura recebeu mais 30 dias.",
      );
      return;
    }

    if (response.status === 202 || json.pending) {
      setState("pending");
      setMessage(
        "O pagamento ainda está sendo processado. Aguarde alguns segundos e verifique novamente.",
      );
      return;
    }

    setState("error");
    setMessage(
      json.error || "Não foi possível confirmar o pagamento.",
    );
  }

  useEffect(() => {
    void confirm();
    // Executa apenas ao carregar o retorno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const success = state === "success";
  const checking = state === "checking";

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <Card className="w-full max-w-xl border-0 shadow-2xl">
        <CardHeader className="items-center text-center">
          <Link href="/" className="mb-4 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-indigo-600 text-white">
              <Landmark className="size-5" />
            </span>
            <strong>FINANCE HYBRID</strong>
          </Link>

          <span
            className={`grid size-16 place-items-center rounded-3xl ${
              success
                ? "bg-emerald-50 text-emerald-700"
                : state === "error"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {checking ? (
              <LoaderCircle className="size-7 animate-spin" />
            ) : success ? (
              <CheckCircle2 className="size-7" />
            ) : (
              <AlertTriangle className="size-7" />
            )}
          </span>

          <CardTitle className="mt-5 text-2xl">
            {checking
              ? "Verificando pagamento"
              : success
                ? "Assinatura liberada"
                : state === "pending"
                  ? "Pagamento em processamento"
                  : "Confirmação pendente"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-center text-sm leading-6 text-slate-600">
            {message}
          </p>

          <div className="mt-7 space-y-3">
            {success ? (
              <Link href="/dashboard">
                <Button className="h-12 w-full">
                  Acessar meu dashboard
                </Button>
              </Link>
            ) : (
              <Button
                className="h-12 w-full"
                onClick={() => void confirm()}
                disabled={checking}
              >
                <RefreshCw className="size-4" />
                Verificar novamente
              </Button>
            )}

            {receiptUrl && (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="h-12 w-full"
                >
                  <ReceiptText className="size-4" />
                  Abrir comprovante
                </Button>
              </a>
            )}

            <Link href="/assinatura">
              <Button variant="outline" className="h-12 w-full">
                Voltar para assinatura
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
