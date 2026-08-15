import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";
import { requireActiveUser } from "@/lib/server-user";
import { configuredWhatsAppNumber } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateCode() {
  const value = Math.floor(100000 + Math.random() * 900000);
  return `EONE-${value}`;
}

function publicConfig(request: Request) {
  const agentNumber = configuredWhatsAppNumber();
  const origin = new URL(request.url).origin;
  return {
    agent_number: agentNumber || null,
    agent_number_digits: agentNumber ? agentNumber.replace(/\D/g, "") : null,
    webhook_url: `${origin}/api/whatsapp/webhook`,
    meta_configured: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_GRAPH_VERSION?.trim() &&
      process.env.WHATSAPP_VERIFY_TOKEN?.trim()
    ),
    app_secret_configured: Boolean(process.env.WHATSAPP_APP_SECRET?.trim()),
  };
}

export async function POST(request: Request) {
  const auth = await requireActiveUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await adminSupabase
    .from("whatsapp_connections")
    .upsert({
      user_id: auth.user.id,
      wa_id: null,
      phone_e164: null,
      status: "PENDING",
      activation_code: code,
      activation_expires_at: expiresAt,
      connected_at: null,
      updated_at: now,
    }, { onConflict: "user_id" })
    .select("status,activation_code,activation_expires_at")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Não foi possível gerar o código de conexão do WhatsApp." }, { status: 500 });
  }

  return NextResponse.json({
    status: data.status,
    activation_code: data.activation_code,
    activation_expires_at: data.activation_expires_at,
    instructions: "Abra o WhatsApp do Meu Agente Financeiro e envie o código de ativação.",
    ...publicConfig(request),
  });
}

export async function GET(request: Request) {
  const auth = await requireActiveUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data } = await adminSupabase
    .from("whatsapp_connections")
    .select("status,phone_e164,connected_at,last_message_at,activation_expires_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({ connection: data ?? null, ...publicConfig(request) });
}
