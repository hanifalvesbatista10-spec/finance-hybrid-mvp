import { NextResponse } from "next/server";
import { AiProviderError, transcribeAudioWithGemini } from "@/lib/ai/provider";
import { requireActiveUser } from "@/lib/server-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireActiveUser(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const incoming = await request.formData();
    const audio = incoming.get("audio");
    if (!(audio instanceof File)) return NextResponse.json({ error: "Áudio não recebido." }, { status: 400 });
    if (audio.size > 10 * 1024 * 1024) return NextResponse.json({ error: "O áudio está muito grande. Grave uma mensagem mais curta." }, { status: 413 });

    const result = await transcribeAudioWithGemini(audio);
    return NextResponse.json({ text: result.text, provider: result.provider, model: result.model });
  } catch (error) {
    if (error instanceof AiProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Erro inesperado ao processar o áudio." }, { status: 500 });
  }
}
