-- Equity One V5.16 — Meu Agente Financeiro / WhatsApp
-- Execute uma vez no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text,
  wa_id text,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','DISABLED')),
  activation_code text,
  activation_expires_at timestamptz,
  connected_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_connections_user_unique unique (user_id),
  constraint whatsapp_connections_wa_id_unique unique (wa_id),
  constraint whatsapp_connections_activation_code_unique unique (activation_code)
);

create table if not exists public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_id text not null,
  action_type text not null default 'PROPOSE_FINANCIAL_ENTRIES',
  payload jsonb not null default '{}'::jsonb,
  original_text text,
  status text not null default 'WAITING_CONFIRMATION' check (status in ('WAITING_CONFIRMATION','CONFIRMED','CANCELLED','EXPIRED','FAILED')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_pending_actions_user_status_idx
  on public.agent_pending_actions(user_id, status, created_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  wa_id text,
  channel text not null default 'WHATSAPP',
  direction text not null check (direction in ('IN','OUT')),
  provider_message_id text,
  message_type text not null default 'text',
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_messages_provider_message_unique unique (provider_message_id)
);

create index if not exists agent_messages_user_created_idx
  on public.agent_messages(user_id, created_at desc);

alter table public.whatsapp_connections enable row level security;
alter table public.agent_pending_actions enable row level security;
alter table public.agent_messages enable row level security;

-- O cliente pode consultar somente o status da própria conexão.
drop policy if exists "users read own whatsapp connection" on public.whatsapp_connections;
create policy "users read own whatsapp connection"
on public.whatsapp_connections for select
to authenticated
using (auth.uid() = user_id);

-- As ações e mensagens do agente são operadas pelo backend com SUPABASE_SECRET_KEY.
-- Não liberamos escrita direta pelo navegador.
