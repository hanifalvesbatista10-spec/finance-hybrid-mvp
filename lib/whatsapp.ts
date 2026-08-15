import { adminSupabase } from "@/lib/admin";
import type { AiProduct } from "@/lib/ai-finance";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

export function normalizeWhatsAppText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function configuredWhatsAppNumber() {
  return (process.env.WHATSAPP_AGENT_NUMBER || process.env.WHATSAPP_DISPLAY_PHONE_NUMBER || "").trim();
}

export async function sendWhatsAppText(to: string, body: string) {
  const token = required("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = required("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = required("WHATSAPP_GRAPH_VERSION");
  const recipient = String(to || "").replace(/\D/g, "");
  if (!recipient) throw new Error("Número de destino do WhatsApp inválido.");

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4000) },
    }),
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("WhatsApp send error", response.status, raw.slice(0, 1000));
    throw new Error(`Falha ao responder pelo WhatsApp (${response.status}).`);
  }

  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}
  return payload;
}

export async function logAgentMessage(input: {
  userId?: string | null;
  waId?: string | null;
  direction: "IN" | "OUT";
  providerMessageId?: string | null;
  messageType?: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await adminSupabase.from("agent_messages").insert({
    user_id: input.userId ?? null,
    wa_id: input.waId ?? null,
    channel: "WHATSAPP",
    direction: input.direction,
    provider_message_id: input.providerMessageId ?? null,
    message_type: input.messageType ?? "text",
    body: input.body ?? null,
    metadata: input.metadata ?? {},
  });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.error("agent_messages insert", error);
  }
}

export async function resolveWhatsAppUser(waId: string) {
  const normalizedWaId = String(waId || "").replace(/\D/g, "");
  const { data: connection } = await adminSupabase
    .from("whatsapp_connections")
    .select("id,user_id,status")
    .eq("wa_id", normalizedWaId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!connection) return null;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id,role,system_role,status")
    .eq("id", connection.user_id)
    .maybeSingle();

  if (!profile || profile.status !== "ACTIVE") return null;

  const { data: subscription } = await adminSupabase
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", connection.user_id)
    .maybeSingle();

  if (profile.system_role !== "SUPER_ADMIN" && subscription?.status && !["ACTIVE","TRIALING"].includes(subscription.status)) {
    return null;
  }

  let product: AiProduct = "PERSONAL";
  if (subscription?.plan === "MEDICAL") product = "MEDICAL";
  else if (subscription?.plan === "BUSINESS" || profile.role === "INSTITUTIONAL") product = "BUSINESS";

  await adminSupabase.from("whatsapp_connections").update({
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);

  return { userId: connection.user_id as string, product, profile, subscription };
}

export async function activateConnectionByCode(waId: string, rawCode: string) {
  const normalizedWaId = String(waId || "").replace(/\D/g, "");
  const code = rawCode.trim().toUpperCase();
  const { data: pending } = await adminSupabase
    .from("whatsapp_connections")
    .select("id,user_id,status,activation_expires_at")
    .eq("activation_code", code)
    .eq("status", "PENDING")
    .maybeSingle();

  if (!pending) return { ok: false as const, reason: "INVALID" as const };
  if (!pending.activation_expires_at || new Date(pending.activation_expires_at).getTime() < Date.now()) {
    await adminSupabase.from("whatsapp_connections").update({ status: "DISABLED", updated_at: new Date().toISOString() }).eq("id", pending.id);
    return { ok: false as const, reason: "EXPIRED" as const };
  }

  const { data: occupied } = await adminSupabase
    .from("whatsapp_connections")
    .select("id,user_id")
    .eq("wa_id", normalizedWaId)
    .neq("id", pending.id)
    .maybeSingle();

  if (occupied) return { ok: false as const, reason: "IN_USE" as const };

  const now = new Date().toISOString();
  const { error } = await adminSupabase.from("whatsapp_connections").update({
    wa_id: normalizedWaId,
    phone_e164: `+${normalizedWaId}`,
    status: "ACTIVE",
    activation_code: null,
    activation_expires_at: null,
    connected_at: now,
    last_message_at: now,
    updated_at: now,
  }).eq("id", pending.id);

  if (error) throw error;
  return { ok: true as const, userId: pending.user_id as string };
}

export function isConfirmation(text: string) {
  const value = normalizeWhatsAppText(text);
  return /^(1|1\s*[-.)]?\s*confirmar|sim|s|confirmar|confirmo|pode|pode sim|ok|okay|beleza|registre|registrar)$/.test(value);
}

export function isCancellation(text: string) {
  const value = normalizeWhatsAppText(text);
  return /^(2|2\s*[-.)]?\s*cancelar|nao|n|cancelar|cancela|esquece|deixa|deixa pra la)$/.test(value);
}
