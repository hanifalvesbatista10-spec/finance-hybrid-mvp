import { NextResponse } from "next/server";
import { adminSupabase, requireSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: listed, error } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = listed.users.map((user) => user.id);
  const [profilesResult, subscriptionsResult, ordersResult, productsResult] = await Promise.all([
    ids.length ? adminSupabase.from("profiles").select("id,full_name,role,system_role,status,created_at,last_seen_at").in("id", ids) : Promise.resolve({ data: [] as any[], error: null }),
    ids.length ? adminSupabase.from("subscriptions").select("*").in("user_id", ids) : Promise.resolve({ data: [] as any[], error: null }),
    ids.length ? adminSupabase.from("subscription_orders").select("user_id,status,amount,order_nsu,created_at,receipt_url").in("user_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[], error: null }),
    ids.length ? adminSupabase.from("user_products").select("user_id,product_code,status").in("user_id", ids).eq("product_code", "MEDICAL") : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]));
  const subscriptionMap = new Map((subscriptionsResult.data ?? []).map((subscription: any) => [subscription.user_id, subscription]));
  const productMap = new Map((productsResult.data ?? []).map((item: any) => [item.user_id, item]));
  const latestOrderMap = new Map();
  for (const order of ordersResult.data ?? []) if (!latestOrderMap.has(order.user_id)) latestOrderMap.set(order.user_id, order);

  return NextResponse.json({
    users: listed.users.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      banned_until: user.banned_until,
      ...profileMap.get(user.id),
      subscription: subscriptionMap.get(user.id) ?? null,
      latest_order: latestOrderMap.get(user.id) ?? null,
      medical_product: productMap.get(user.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { email, password, full_name, plan = "PERSONAL", role: legacyRole, access_days = 30 } = body;

  if (String(body.system_role || "USER").toUpperCase() === "SUPER_ADMIN") {
    return NextResponse.json({ error: "A plataforma possui um único Super Admin. Novos acessos manuais são sempre de cliente." }, { status: 403 });
  }

  const selectedPlan = ["PERSONAL", "BUSINESS", "MEDICAL"].includes(plan)
    ? plan
    : legacyRole === "INSTITUTIONAL" ? "BUSINESS" : "PERSONAL";
  const role = selectedPlan === "BUSINESS" ? "INSTITUTIONAL" : "PERSONAL";
  const systemRole = "USER";

  if (!email || !password || !full_name) return NextResponse.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 });

  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error || !data.user) return NextResponse.json({ error: error?.message || "Falha ao criar usuário." }, { status: 400 });

  await adminSupabase.from("profiles").upsert({
    id: data.user.id,
    full_name,
    role,
    system_role: systemRole,
    status: "ACTIVE",
  });

  const now = new Date();
  const end = new Date(now.getTime() + Math.max(1, Number(access_days) || 30) * 86400000);
  await adminSupabase.from("subscriptions").upsert({
    user_id: data.user.id,
    plan: selectedPlan,
    status: "ACTIVE",
    starts_at: now.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    access_mode: "MANUAL",
    updated_by: auth.user.id,
    notes: `Criado pelo Super Admin com ${access_days} dia(s)`,
  }, { onConflict: "user_id" });

  await adminSupabase.from("user_products").upsert(
    { user_id: data.user.id, product_code: selectedPlan, status: "ACTIVE" },
    { onConflict: "user_id,product_code" },
  );

  await adminSupabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    action: "USER_CREATED",
    target_user_id: data.user.id,
    metadata: { email, role, plan: selectedPlan, system_role: systemRole, access_days },
  });

  return NextResponse.json({ ok: true, id: data.user.id });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, action, role, system_role, days, period_end } = body;
  if (!id) return NextResponse.json({ error: "Usuário obrigatório." }, { status: 400 });

  if (String(system_role || "").toUpperCase() === "SUPER_ADMIN" && id !== auth.user.id) {
    return NextResponse.json({ error: "Não é permitido criar ou promover outro Super Admin." }, { status: 403 });
  }

  if (id === auth.user.id && ["SUSPEND", "DELETE", "SUBSCRIPTION_SUSPEND", "UPDATE", "SUBSCRIPTION_SET_END"].includes(action)) {
    return NextResponse.json({ error: "A conta Super Admin principal é protegida contra esta alteração." }, { status: 400 });
  }

  if (action === "SUSPEND") {
    const { error } = await adminSupabase.auth.admin.updateUserById(id, { ban_duration: "876000h" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await adminSupabase.from("profiles").update({ status: "SUSPENDED" }).eq("id", id);
  } else if (action === "ACTIVATE") {
    const { error } = await adminSupabase.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await adminSupabase.from("profiles").update({ status: "ACTIVE" }).eq("id", id);
  } else if (action === "UPDATE") {
    await adminSupabase.from("profiles").update({ role, system_role: "USER" }).eq("id", id);
    await adminSupabase.from("subscriptions").update({
      plan: role === "INSTITUTIONAL" ? "BUSINESS" : "PERSONAL",
      access_mode: "MANUAL",
    }).eq("user_id", id);
  } else if (action === "SUBSCRIPTION_EXTEND") {
    const extensionDays = Math.max(1, Number(days) || 30);
    const { data: current } = await adminSupabase.from("subscriptions").select("current_period_end").eq("user_id", id).maybeSingle();
    const now = new Date();
    const currentEnd = current?.current_period_end ? new Date(current.current_period_end) : now;
    const base = currentEnd.getTime() > now.getTime() ? currentEnd : now;
    const nextEnd = new Date(base.getTime() + extensionDays * 86400000);
    await adminSupabase.from("subscriptions").upsert({
      user_id: id,
      status: "ACTIVE",
      starts_at: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: nextEnd.toISOString(),
      access_mode: "MANUAL",
      updated_by: auth.user.id,
      notes: `Acesso prorrogado por ${extensionDays} dia(s)`,
    }, { onConflict: "user_id" });
    await adminSupabase.from("profiles").update({ status: "ACTIVE" }).eq("id", id);
    await adminSupabase.auth.admin.updateUserById(id, { ban_duration: "none" });
  } else if (action === "SUBSCRIPTION_SET_END") {
    if (!period_end) return NextResponse.json({ error: "Informe a data de vencimento." }, { status: 400 });
    const end = new Date(`${period_end}T23:59:59.999Z`);
    await adminSupabase.from("subscriptions").upsert({
      user_id: id,
      status: end.getTime() > Date.now() ? "ACTIVE" : "EXPIRED",
      current_period_start: new Date().toISOString(),
      current_period_end: end.toISOString(),
      access_mode: "MANUAL",
      updated_by: auth.user.id,
      notes: "Data de vencimento definida pelo Super Admin",
    }, { onConflict: "user_id" });
  } else if (action === "SUBSCRIPTION_SUSPEND") {
    await adminSupabase.from("subscriptions").update({ status: "SUSPENDED", updated_by: auth.user.id, notes: "Assinatura suspensa pelo Super Admin" }).eq("user_id", id);
  } else if (action === "SUBSCRIPTION_ACTIVATE") {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 86400000);
    const { data: current } = await adminSupabase.from("subscriptions").select("current_period_end").eq("user_id", id).maybeSingle();
    const validCurrentEnd = current?.current_period_end && new Date(current.current_period_end).getTime() > Date.now() ? current.current_period_end : end.toISOString();
    await adminSupabase.from("subscriptions").upsert({
      user_id: id,
      status: "ACTIVE",
      starts_at: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: validCurrentEnd,
      access_mode: "MANUAL",
      updated_by: auth.user.id,
      notes: "Assinatura reativada pelo Super Admin",
    }, { onConflict: "user_id" });
  } else if (action === "PRODUCT_GRANT_MEDICAL") {
    await adminSupabase.from("user_products").upsert({ user_id: id, product_code: "MEDICAL", status: "ACTIVE", granted_by: auth.user.id }, { onConflict: "user_id,product_code" });
  } else if (action === "PRODUCT_REVOKE_MEDICAL") {
    await adminSupabase.from("user_products").delete().eq("user_id", id).eq("product_code", "MEDICAL");
  } else {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  await adminSupabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    action: `USER_${action}`,
    target_user_id: id,
    metadata: { role, system_role: id === auth.user.id ? "SUPER_ADMIN" : "USER", days, period_end },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id || id === auth.user.id) return NextResponse.json({ error: "A conta Super Admin principal não pode ser excluída." }, { status: 400 });

  const { data: targetProfile } = await adminSupabase.from("profiles").select("system_role").eq("id", id).maybeSingle();
  if (targetProfile?.system_role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não é permitido excluir uma conta Super Admin por esta rota." }, { status: 403 });
  }

  const { error } = await adminSupabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await adminSupabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    action: "USER_DELETED",
    metadata: { deleted_user_id: id },
  });

  return NextResponse.json({ ok: true });
}
