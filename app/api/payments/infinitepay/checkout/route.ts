import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { adminSupabase } from "@/lib/admin";
import {
  INFINITEPAY_HANDLE,
  PLAN_CONFIG,
  type CheckoutPlan,
} from "@/lib/infinitepay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let orderNsu = "";

  try {
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return jsonError("Não autenticado.", 401);
    }

    const { data: authData, error: authError } =
      await adminSupabase.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonError("Sessão inválida. Entre novamente.", 401);
    }

    const user = authData.user;

    const [
      { data: profile, error: profileError },
      { data: subscription, error: subscriptionError },
    ] = await Promise.all([
      adminSupabase
        .from("profiles")
        .select("full_name,role,status")
        .eq("id", user.id)
        .single(),
      adminSupabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (profileError || !profile) {
      return jsonError(
        "Seu perfil não foi encontrado. Atualize a página e tente novamente.",
        404,
      );
    }

    if (subscriptionError) {
      return jsonError(
        "Não foi possível consultar sua assinatura.",
        400,
      );
    }

    if (profile.status === "SUSPENDED") {
      return jsonError(
        "Sua conta está suspensa. Fale com o suporte.",
        403,
      );
    }

    const plan: CheckoutPlan =
      subscription?.plan === "MEDICAL"
        ? "MEDICAL"
        : subscription?.plan === "BUSINESS" || profile.role === "INSTITUTIONAL"
          ? "BUSINESS"
          : "PERSONAL";

    const config = PLAN_CONFIG[plan];
    orderNsu = `EQ-${plan}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
    const origin = new URL(request.url).origin;

    const { error: insertError } = await adminSupabase
      .from("subscription_orders")
      .insert({
        user_id: user.id,
        order_nsu: orderNsu,
        plan,
        amount: config.amount,
        original_amount: config.amount,
        discount_amount: 0,
        description: config.description,
        status: "PENDING",
      });

    if (insertError) {
      return jsonError(
        `Não foi possível registrar o pedido: ${insertError.message}`,
        400,
      );
    }

    const infinitePayResponse = await fetch(
      "https://api.checkout.infinitepay.io/links",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          handle: INFINITEPAY_HANDLE,
          items: [
            {
              quantity: 1,
              price: config.amount,
              description: config.description,
            },
          ],
          order_nsu: orderNsu,
          redirect_url: `${origin}/pagamento/retorno`,
          webhook_url: `${origin}/api/webhooks/infinitepay`,
        }),
        cache: "no-store",
      },
    );

    const raw = await infinitePayResponse.text();
    let infinitePayJson: {
      url?: string;
      message?: string;
      error?: string;
    } = {};

    if (raw) {
      try {
        infinitePayJson = JSON.parse(raw);
      } catch {
        infinitePayJson = {};
      }
    }

    if (!infinitePayResponse.ok || !infinitePayJson.url) {
      const reason =
        infinitePayJson.message ||
        infinitePayJson.error ||
        raw.slice(0, 300) ||
        `Resposta HTTP ${infinitePayResponse.status}`;

      await adminSupabase
        .from("subscription_orders")
        .update({
          status: "FAILED",
          failure_reason: reason,
        })
        .eq("order_nsu", orderNsu);

      return jsonError(
        `A InfinitePay recusou a criação do checkout: ${reason}`,
        502,
      );
    }

    const { error: updateError } = await adminSupabase
      .from("subscription_orders")
      .update({
        status: "CHECKOUT_CREATED",
        checkout_url: infinitePayJson.url,
        failure_reason: null,
      })
      .eq("order_nsu", orderNsu);

    if (updateError) {
      return jsonError(
        `Checkout criado, mas não foi possível salvar o link: ${updateError.message}`,
        500,
      );
    }

    return NextResponse.json({
      url: infinitePayJson.url,
      order_nsu: orderNsu,
      plan,
      amount: config.amount,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao gerar checkout.";

    if (orderNsu) {
      await adminSupabase
        .from("subscription_orders")
        .update({
          status: "FAILED",
          failure_reason: message,
        })
        .eq("order_nsu", orderNsu);
    }

    console.error("InfinitePay checkout error:", error);

    return jsonError(
      `Falha interna ao gerar o checkout: ${message}`,
      500,
    );
  }
}
