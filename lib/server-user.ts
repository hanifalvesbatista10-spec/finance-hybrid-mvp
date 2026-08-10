import { adminSupabase } from "@/lib/admin";
import type { AiProduct } from "@/lib/ai-finance";

export async function requireActiveUser(request: Request, requestedProduct?: AiProduct) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Não autenticado", status: 401 } as const;

  const { data: authData, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !authData.user) return { error: "Sessão inválida", status: 401 } as const;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id,role,system_role,status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "ACTIVE") return { error: "Conta sem acesso ativo", status: 403 } as const;

  if (requestedProduct && profile.system_role !== "SUPER_ADMIN") {
    const { data: subscription } = await adminSupabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id", authData.user.id).maybeSingle();
    const allowed = requestedProduct === "MEDICAL"
      ? subscription?.plan === "MEDICAL"
      : requestedProduct === "BUSINESS"
        ? profile.role === "INSTITUTIONAL" || subscription?.plan === "BUSINESS"
        : profile.role === "PERSONAL" && subscription?.plan !== "MEDICAL";
    if (!allowed) return { error: "Este produto não pertence à sua conta.", status: 403 } as const;
  }

  return { user: authData.user, profile } as const;
}
