import { NextResponse } from "next/server";

import { adminSupabase, requireSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const selectedFields = [
  "public_signup_enabled",
  "signup_mode",
  "personal_price_cents",
  "business_price_cents",
  "medical_price_cents",
  "personal_checkout_enabled",
  "business_checkout_enabled",
  "medical_checkout_enabled",
  "updated_at",
].join(",");

export async function GET() {
  const { data, error } = await adminSupabase
    .from("platform_settings")
    .select(selectedFields)
    .eq("id", 1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function normalizePrice(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(100, Math.round(numeric));
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin(request);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const body = await request.json();

  const payload = {
    public_signup_enabled: Boolean(body.public_signup_enabled),
    signup_mode: String(body.signup_mode ?? "PUBLIC"),
    personal_price_cents: normalizePrice(body.personal_price_cents, 1990),
    business_price_cents: normalizePrice(body.business_price_cents, 7990),
    medical_price_cents: normalizePrice(body.medical_price_cents, 5990),
    personal_checkout_enabled: Boolean(body.personal_checkout_enabled),
    business_checkout_enabled: Boolean(body.business_checkout_enabled),
    medical_checkout_enabled: Boolean(body.medical_checkout_enabled),
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await adminSupabase
    .from("platform_settings")
    .update(payload)
    .eq("id", 1)
    .select(selectedFields)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await adminSupabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    action: "PLATFORM_SETTINGS_UPDATED",
    metadata: {
      signup_mode: payload.signup_mode,
      public_signup_enabled: payload.public_signup_enabled,
      personal_price_cents: payload.personal_price_cents,
      business_price_cents: payload.business_price_cents,
      medical_price_cents: payload.medical_price_cents,
      personal_checkout_enabled: payload.personal_checkout_enabled,
      business_checkout_enabled: payload.business_checkout_enabled,
      medical_checkout_enabled: payload.medical_checkout_enabled,
    },
  });

  return NextResponse.json(data);
}
