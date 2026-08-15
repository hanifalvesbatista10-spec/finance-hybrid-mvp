"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

type Diagnostics = {
  configuration?: {
    access_token?: boolean;
    phone_number_id?: boolean;
    graph_version?: boolean;
    verify_token?: boolean;
    app_secret?: boolean;
    agent_number?: string | null;
    webhook_url?: string | null;
  };
  connection?: {
    status?: string;
    wa_id?: string | null;
    phone_e164?: string | null;
    connected_at?: string | null;
    last_message_at?: string | null;
  } | null;
  webhook_events?: Array<{
    status?: string;
    wa_id?: string | null;
    provider_message_id?: string | null;
    message_count?: number;
    error_message?: string | null;
    created_at?: string;
  }>;
};

export function WhatsAppDiagnostics() {
  const { session, profile } = useAuth();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!session?.access_token || profile?.system_role !== "SUPER_ADMIN") return;
    setLoading(true);
    try {
      const response = await fetch("/api/whatsapp/diagnostics", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const json = await response.json();
      if (response.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  if (profile?.system_role !== "SUPER_ADMIN") return null;

  const c = data?.configuration;
  const last = data?.webhook_events?.[0];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,.05)]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-slate-500"><ShieldAlert className="size-4"/>Super Admin</div>
          <h2 className="mt-1 font-black text-slate-950">Diagnóstico do WhatsApp</h2>
          <p className="mt-1 text-sm text-slate-500">Mostra se a Meta está configurada e se o webhook está realmente recebendo eventos.</p>
        </div>
        <span className="text-sm font-bold text-[#956f24]">{open ? "Ocultar" : "Ver diagnóstico"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5">
          <div className="mb-4 flex justify-end"><Button type="button" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`}/>Atualizar</Button></div>
          {!data ? <p className="text-sm text-slate-500">{loading ? "Consultando integração..." : "Clique em Atualizar."}</p> : <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <State label="Access Token" ok={Boolean(c?.access_token)}/>
              <State label="Phone Number ID" ok={Boolean(c?.phone_number_id)}/>
              <State label="Graph Version" ok={Boolean(c?.graph_version)}/>
              <State label="Verify Token" ok={Boolean(c?.verify_token)}/>
              <State label="App Secret" ok={Boolean(c?.app_secret)}/>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Info label="Número oficial" value={c?.agent_number || "Não configurado"}/>
              <Info label="Conexão desta conta" value={data.connection?.status || "Ainda não conectada"}/>
            </div>
            <Info label="Webhook configurado na Meta" value={c?.webhook_url || "—"} full/>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Último evento recebido</p>
              {last ? <div className="mt-2 text-sm text-slate-700"><b>{last.status || "Evento"}</b>{last.created_at ? ` · ${new Date(last.created_at).toLocaleString("pt-BR")}` : ""}{typeof last.message_count === "number" ? ` · ${last.message_count} mensagem(ns)` : ""}{last.error_message ? <p className="mt-2 text-rose-600">{last.error_message}</p> : null}</div> : <p className="mt-2 text-sm text-amber-700">Nenhum POST da Meta registrado ainda.</p>}
            </div>
          </>}
        </div>
      )}
    </section>
  );
}

function State({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${ok ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>{ok ? <CheckCircle2 className="size-4"/> : <XCircle className="size-4"/>}{label}</div>;
}

function Info({ label, value, full=false }: { label:string; value:string; full?:boolean }) {
  return <div className={`mt-3 rounded-xl border border-slate-100 p-4 ${full ? "md:col-span-2" : ""}`}><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-all text-sm font-bold text-slate-800">{value}</p></div>;
}
