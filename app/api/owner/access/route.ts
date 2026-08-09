import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ allowed: false }, { status: 401 });

  const { data: authData, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ allowed: false }, { status: 401 });
  }

  const configuredEmail = String(process.env.OWNER_SUPER_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  const authenticatedEmail = String(authData.user.email ?? "").trim().toLowerCase();

  if (!configuredEmail || !authenticatedEmail || authenticatedEmail !== configuredEmail) {
    return NextResponse.json({ allowed: false });
  }

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("system_role,status")
    .eq("id", authData.user.id)
    .maybeSingle();

  const allowed = profile?.system_role === "SUPER_ADMIN" && profile?.status !== "SUSPENDED";
  return NextResponse.json({ allowed });
}
