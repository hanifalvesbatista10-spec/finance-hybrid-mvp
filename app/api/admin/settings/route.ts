import { NextResponse } from "next/server";

import { adminSupabase, requireSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const selectedFields = [
  "public_signup_enabled",
  "signup_mode",
  "personal_checkout_url",
  "business_checkout_url",
  "personal_checkout_enabled",
  "business_checkout_enabled",
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

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin(request);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const body = await request.json();

  const personalUrl =
    typeof body.personal_checkout_url === "string"
      ? body.personal_checkout_url.trim()
      : "";

  const businessUrl =
    typeof body.business_checkout_url === "string"
      ? body.business_checkout_url.trim()
      : "";

  if (personalUrl && !isValidHttpUrl(personalUrl)) {
    return NextResponse.json(
      { error: "O link do checkout Personal não é válido." },
      { status: 400 },
    );
  }

  if (businessUrl && !isValidHttpUrl(businessUrl)) {
    return NextResponse.json(
      { error: "O link do checkout Business não é válido." },
      { status: 400 },
    );
  }

  const payload = {
    public_signup_enabled: Boolean(body.public_signup_enabled),
    signup_mode: body.signup_mode,
    personal_checkout_url: personalUrl || null,
    business_checkout_url: businessUrl || null,
    personal_checkout_enabled: Boolean(body.personal_checkout_enabled),
    business_checkout_enabled: Boolean(body.business_checkout_enabled),
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
      personal_checkout_enabled: payload.personal_checkout_enabled,
      business_checkout_enabled: payload.business_checkout_enabled,
      personal_checkout_url_changed: true,
      business_checkout_url_changed: true,
    },
  });

  return NextResponse.json(data);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
