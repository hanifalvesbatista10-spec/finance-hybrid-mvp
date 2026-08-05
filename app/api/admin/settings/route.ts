import { NextResponse } from "next/server";
import { adminSupabase, requireSuperAdmin } from "@/lib/admin";

export async function GET() {
  const { data, error } = await adminSupabase.from("platform_settings").select("public_signup_enabled,signup_mode").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const { data, error } = await adminSupabase.from("platform_settings").update({
    public_signup_enabled: Boolean(body.public_signup_enabled),
    signup_mode: body.signup_mode,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", 1).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await adminSupabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "SIGNUP_SETTINGS_UPDATED", metadata: body });
  return NextResponse.json(data);
}
