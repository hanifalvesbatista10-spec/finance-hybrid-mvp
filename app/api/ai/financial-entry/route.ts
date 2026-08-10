import { NextResponse } from "next/server";
import { allowedCategories, normalizeAiEntries, type AiFinancialEntry, type AiProduct } from "@/lib/ai-finance";
import { requireActiveUser } from "@/lib/server-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string") return response.output_text;
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const product = String(body.product ?? "").toUpperCase() as AiProduct;
    if (!["PERSONAL","BUSINESS","MEDICAL"].includes(product)) return NextResponse.json({error:"Produto inválido."},{status:400});
    const auth = await requireActiveUser(request, product);
    if ("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status});

    const text = String(body.text ?? "").trim();
    if (text.length < 3) return NextResponse.json({error:"Descreva o lançamento com um pouco mais de detalhe."},{status:400});
    if (text.length > 1200) return NextResponse.json({error:"A descrição está muito longa. Resuma em até 1.200 caracteres."},{status:400});

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({error:"A inteligência financeira ainda não foi configurada pelo administrador."},{status:503});

    const nowIso = String(body.now_iso || new Date().toISOString());
    const timezone = String(body.timezone || "America/Sao_Paulo");
    const categories = allowedCategories(product);
    const kindEnum = product === "MEDICAL" ? ["INCOME","EXPENSE","TAX"] : ["INCOME","EXPENSE"];

    const schema = {
      type:"object",
      additionalProperties:false,
      required:["entries"],
      properties:{
        entries:{
          type:"array", minItems:1, maxItems:12,
          items:{
            type:"object", additionalProperties:false,
            required:["kind","description","merchant","amount","categories","occurred_on","occurred_at","notes","confidence"],
            properties:{
              kind:{type:"string",enum:kindEnum},
              description:{type:"string"},
              merchant:{anyOf:[{type:"string"},{type:"null"}]},
              amount:{type:"number",exclusiveMinimum:0},
              categories:{type:"array",minItems:1,maxItems:4,items:{type:"string"}},
              occurred_on:{type:"string"},
              occurred_at:{type:"string"},
              notes:{anyOf:[{type:"string"},{type:"null"}]},
              confidence:{type:"number",minimum:0,maximum:1}
            }
          }
        }
      }
    };

    const instructions = `Você é o classificador financeiro do Equity One. Converta a fala/texto do usuário em lançamentos financeiros estruturados. Produto: ${product}. Agora: ${nowIso}. Fuso informado: ${timezone}. Regras: 1) Separe frases com vários gastos/receitas em vários lançamentos. 2) Se o usuário disser hoje/agora/ontem, resolva a data usando o horário informado. 3) Nunca invente valor. 4) Para despesas, escolha a categoria principal mais específica e, se útil, até 3 categorias adicionais da lista permitida. 5) O primeiro item de categories é sempre a categoria principal. 6) Para estabelecimento conhecido, preencha merchant. 7) Se houver ambiguidade, use a opção mais conservadora e reduza confidence. 8) Valores são em reais quando o usuário não mencionar outra moeda. Categorias de receita permitidas: ${categories.income.join(" | ")}. Categorias de despesa permitidas: ${categories.expense.join(" | ")}. Categorias de imposto permitidas: ${categories.tax.join(" | ") || "nenhuma"}.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model: process.env.OPENAI_FINANCE_MODEL || "gpt-5-mini",
        instructions,
        input:text,
        text:{format:{type:"json_schema",name:"equity_one_financial_entries",strict:true,schema}},
      }),
      cache:"no-store",
    });
    const raw = await openaiResponse.text();
    let json:any={}; try{json=raw?JSON.parse(raw):{}}catch{}
    if (!openaiResponse.ok) {
      console.error("OpenAI financial-entry error", openaiResponse.status, raw.slice(0,500));
      return NextResponse.json({error:"Não foi possível interpretar o lançamento agora."},{status:502});
    }
    const outputText = extractOutputText(json);
    if (!outputText) return NextResponse.json({error:"A IA não retornou lançamentos utilizáveis."},{status:502});
    let parsed:{entries:AiFinancialEntry[]};
    try { parsed = JSON.parse(outputText); } catch { return NextResponse.json({error:"Não foi possível organizar o lançamento."},{status:502}); }
    const entries = normalizeAiEntries(parsed.entries ?? [], product);
    if (!entries.length) return NextResponse.json({error:"Não encontrei um valor financeiro válido nessa descrição."},{status:400});
    return NextResponse.json({entries});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:"Erro inesperado ao interpretar o lançamento."},{status:500});
  }
}
