import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/server-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireActiveUser(request);
    if ("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status});
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({error:"A inteligência financeira ainda não foi configurada."},{status:503});

    const incoming = await request.formData();
    const audio = incoming.get("audio");
    if (!(audio instanceof File)) return NextResponse.json({error:"Áudio não recebido."},{status:400});
    if (audio.size > 12 * 1024 * 1024) return NextResponse.json({error:"O áudio está muito grande. Grave uma mensagem mais curta."},{status:413});

    const form = new FormData();
    form.append("file", audio, audio.name || "lancamento.webm");
    form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    form.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method:"POST", headers:{Authorization:`Bearer ${apiKey}`}, body:form, cache:"no-store"
    });
    const raw = await response.text();
    let json:any={}; try{json=raw?JSON.parse(raw):{}}catch{}
    if (!response.ok || !json.text) {
      console.error("OpenAI transcription error", response.status, raw.slice(0,500));
      return NextResponse.json({error:"Não foi possível transcrever o áudio."},{status:502});
    }
    return NextResponse.json({text:String(json.text)});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:"Erro inesperado ao processar o áudio."},{status:500});
  }
}
