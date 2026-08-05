import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias no servidor.");
}

export const adminSupabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function requireSuperAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Não autenticado", status: 401 } as const;

  const { data: authData, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !authData.user) return { error: "Sessão inválida", status: 401 } as const;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id, system_role, status")
    .eq("id", authData.user.id)
    .single();

  if (!profile || profile.system_role !== "SUPER_ADMIN" || profile.status !== "ACTIVE") {
    return { error: "Acesso restrito ao Super Admin", status: 403 } as const;
  }

  return { user: authData.user, profile } as const;
}
