import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/admin";
import { requireActiveUser } from "@/lib/server-user";
import { configuredWhatsAppNumber } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireActiveUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: connection } = await adminSupabase
    .from("whatsapp_connections")
    .select("status,wa_id,phone_e164,connected_at,last_message_at,activation_expires_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  let eventsQuery = adminSupabase
    .from("whatsapp_webhook_events")
    .select("status,wa_id,provider_message_id,message_count,error_message,created_at")
    .order("created_at", { ascending: false })
    .limit(auth.profile.system_role === "SUPER_ADMIN" ? 15 : 8);

  if (auth.profile.system_role !== "SUPER_ADMIN") {
    if (!connection?.wa_id) {
      return NextResponse.json({
        configuration: configState(request),
        connection: connection ?? null,
        webhook_events: [],
      });
    }
    eventsQuery = eventsQuery.eq("wa_id", connection.wa_id);
  }

  const { data: events } = await eventsQuery;

  return NextResponse.json({
    configuration: configState(request),
    connection: connection ?? null,
    webhook_events: events ?? [],
  });
}

function configState(request: Request) {
  const origin = new URL(request.url).origin;
  const number = configuredWhatsAppNumber();
  return {
    access_token: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim()),
    phone_number_id: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
    graph_version: Boolean(process.env.WHATSAPP_GRAPH_VERSION?.trim()),
    verify_token: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
    app_secret: Boolean(process.env.WHATSAPP_APP_SECRET?.trim()),
    agent_number: number || null,
    webhook_url: `${origin}/api/whatsapp/webhook`,
  };
}
