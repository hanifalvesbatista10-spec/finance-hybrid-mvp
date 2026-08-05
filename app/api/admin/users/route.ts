import { NextResponse } from "next/server";
import { adminSupabase, requireSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: listed, error } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = listed.users.map((u) => u.id);
  const { data: profiles } = ids.length
    ? await adminSupabase.from("profiles").select("id,full_name,role,system_role,status,created_at,last_seen_at").in("id", ids)
    : { data: [] as any[] };
  const map = new Map((profiles ?? []).map((p:any) => [p.id, p]));

  return NextResponse.json({
    users: listed.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned_until: u.banned_until,
      ...map.get(u.id),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { email, password, full_name, role = "PERSONAL", system_role = "USER" } = body;
  if (!email || !password || !full_name) return NextResponse.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 });

  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error || !data.user) return NextResponse.json({ error: error?.message || "Falha ao criar usuário" }, { status: 400 });

  await adminSupabase.from("profiles").upsert({
    id: data.user.id, full_name, role, system_role, status: "ACTIVE",
  });
  await adminSupabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "USER_CREATED", target_user_id: data.user.id, metadata: { email, role, system_role } });
  return NextResponse.json({ ok: true, id: data.user.id });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const { id, action, role, system_role } = body;
  if (!id) return NextResponse.json({ error: "Usuário obrigatório" }, { status: 400 });
  if (id === auth.user.id && (action === "SUSPEND" || action === "DELETE")) return NextResponse.json({ error: "Você não pode bloquear sua própria conta." }, { status: 400 });

  if (action === "SUSPEND") {
    const { error } = await adminSupabase.auth.admin.updateUserById(id, { ban_duration: "876000h" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await adminSupabase.from("profiles").update({ status: "SUSPENDED" }).eq("id", id);
  } else if (action === "ACTIVATE") {
    const { error } = await adminSupabase.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await adminSupabase.from("profiles").update({ status: "ACTIVE" }).eq("id", id);
  } else if (action === "UPDATE") {
    await adminSupabase.from("profiles").update({ role, system_role }).eq("id", id);
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  await adminSupabase.from("audit_logs").insert({ actor_id: auth.user.id, action: `USER_${action}`, target_user_id: id, metadata: { role, system_role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id === auth.user.id) return NextResponse.json({ error: "Usuário inválido" }, { status: 400 });
  const { error } = await adminSupabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await adminSupabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "USER_DELETED", metadata: { deleted_user_id: id } });
  return NextResponse.json({ ok: true });
}
