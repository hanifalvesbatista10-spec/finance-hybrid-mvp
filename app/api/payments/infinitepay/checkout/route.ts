import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { adminSupabase } from "@/lib/admin";
import {
  INFINITEPAY_HANDLE,
  PLAN_CONFIG,
  type CheckoutPlan,
} from "@/lib/infinitepay";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 },
    );
  }

  const { data: authData, error: authError } =
    await adminSupabase.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Sessão inválida." },
      { status: 401 },
    );
  }

  const user = authData.user;

  const [{ data: profile }, { data: subscription }] =
    await Promise.all([
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

  if (!profile || profile.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "Conta indisponível para pagamento." },
      { status: 403 },
    );
  }

  const plan: CheckoutPlan =
    subscription?.plan === "BUSINESS" ||
    profile.role === "INSTITUTIONAL"
      ? "BUSINESS"
      : "PERSONAL";

  const config = PLAN_CONFIG[plan];
  const orderNsu = `FH-${plan}-${randomUUID().toUpperCase()}`;
  const origin = new URL(request.url).origin;

  const { error: insertError } = await adminSupabase
    .from("subscription_orders")
    .insert({
      user_id: user.id,
      order_nsu: orderNsu,
      plan,
      amount: config.amount,
      description: config.description,
      status: "PENDING",
    });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 400 },
    );
  }

  const infinitePayResponse = await fetch(
    "https://api.checkout.infinitepay.io/links",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
        customer: {
          name:
            profile.full_name ||
            user.user_metadata?.full_name ||
            "Cliente Finance Hybrid",
          email: user.email,
        },
      }),
      cache: "no-store",
    },
  );

  const infinitePayJson = await infinitePayResponse.json();

  if (!infinitePayResponse.ok || !infinitePayJson?.url) {
    await adminSupabase
      .from("subscription_orders")
      .update({
        status: "FAILED",
        failure_reason:
          infinitePayJson?.message ||
          "Falha ao criar checkout na InfinitePay.",
      })
      .eq("order_nsu", orderNsu);

    return NextResponse.json(
      {
        error:
          infinitePayJson?.message ||
          "Não foi possível gerar o checkout.",
      },
      { status: 502 },
    );
  }

  await adminSupabase
    .from("subscription_orders")
    .update({
      status: "CHECKOUT_CREATED",
      checkout_url: infinitePayJson.url,
    })
    .eq("order_nsu", orderNsu);

  return NextResponse.json({
    url: infinitePayJson.url,
    order_nsu: orderNsu,
    plan,
    amount: config.amount,
  });
}
