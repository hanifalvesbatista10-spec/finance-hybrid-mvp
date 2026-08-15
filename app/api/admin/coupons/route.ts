import { NextResponse } from "next/server";
import { adminSupabase, requireSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await adminSupabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return NextResponse.json({ error: "Código inválido. Use 3 a 30 letras, números, _ ou -." }, { status: 400 });

  const type = String(body.discount_type ?? "PERCENT");
  const value = Number(body.discount_value);
  if (!["PERCENT", "FIXED"].includes(type) || !Number.isFinite(value) || value <= 0 || (type === "PERCENT" && value > 100)) {
    return NextResponse.json({ error: "Desconto inválido." }, { status: 400 });
  }

  const productCodes = Array.isArray(body.product_codes)
    ? body.product_codes.filter((item: unknown) => ["PERSONAL", "BUSINESS", "MEDICAL"].includes(String(item)))
    : [];
  if (!productCodes.length) return NextResponse.json({ error: "Selecione pelo menos um produto." }, { status: 400 });

  const payload = {
    code,
    discount_type: type,
    discount_value: value,
    product_codes: productCodes,
    is_active: body.is_active !== false,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    max_uses: body.max_uses ? Number(body.max_uses) : null,
    per_customer_limit: body.per_customer_limit ? Number(body.per_customer_limit) : 1,
    created_by: auth.user.id,
  };

  const { data, error } = await adminSupabase.from("coupons").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Cupom obrigatório." }, { status: 400 });

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["is_active", "ends_at", "starts_at", "max_uses", "per_customer_limit"]) {
    if (key in body) payload[key] = key === "is_active" ? Boolean(body[key]) : body[key] || null;
  }

  const { data, error } = await adminSupabase.from("coupons").update(payload).eq("id", body.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Cupom não encontrado ou não foi alterado." }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Cupom obrigatório." }, { status: 400 });

  const { data: existing, error: readError } = await adminSupabase
    .from("coupons")
    .select("id,code,uses_count")
    .eq("id", id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "Cupom não encontrado." }, { status: 404 });

  const { data: deleted, error } = await adminSupabase
    .from("coupons")
    .delete()
    .eq("id", id)
    .select("id,code")
    .maybeSingle();

  if (error) {
    const linked = /foreign key|violates|constraint/i.test(error.message);
    return NextResponse.json(
      { error: linked ? "Este cupom possui histórico vinculado e não pode ser excluído definitivamente. Desative-o para preservar os registros." : error.message },
      { status: 400 },
    );
  }

  if (!deleted) return NextResponse.json({ error: "O banco não confirmou a exclusão do cupom." }, { status: 409 });
  return NextResponse.json({ ok: true, deleted });
}
