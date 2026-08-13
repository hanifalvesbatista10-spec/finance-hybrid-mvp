-- Equity One V5.17 — Fundação Financeira
-- Execute uma vez no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  account_type text not null default 'CHECKING',
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  include_in_total boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_account_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id) on delete cascade,
  entry_type text not null,
  amount numeric(14,2) not null check (amount <> 0),
  description text not null,
  occurred_on date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  to_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  description text,
  created_at timestamptz not null default now(),
  constraint account_transfer_different_accounts check (from_account_id <> to_account_id)
);

alter table public.transactions add column if not exists account_id uuid references public.financial_accounts(id) on delete set null;
alter table public.transactions add column if not exists card_id uuid;
alter table public.transactions add column if not exists invoice_id uuid;
alter table public.transactions add column if not exists payment_method text;
alter table public.transactions add column if not exists transaction_status text not null default 'POSTED';

alter table public.cards add column if not exists issuer text;
alter table public.cards add column if not exists payment_account_id uuid references public.financial_accounts(id) on delete set null;
alter table public.cards add column if not exists is_active boolean not null default true;

create table if not exists public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  reference_month date not null,
  closing_date date,
  due_date date,
  status text not null default 'OPEN',
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  paid_at timestamptz,
  payment_account_id uuid references public.financial_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_invoice_unique_month unique(card_id, reference_month)
);

create table if not exists public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  description text not null,
  merchant text,
  category text,
  total_amount numeric(14,2) not null check (total_amount > 0),
  installments integer not null default 1,
  purchase_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.card_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.card_purchases(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  invoice_id uuid references public.card_invoices(id) on delete set null,
  installment_number integer not null,
  installment_count integer not null,
  amount numeric(14,2) not null check (amount > 0),
  due_month date not null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);

alter table public.financial_accounts enable row level security;
alter table public.financial_account_entries enable row level security;
alter table public.account_transfers enable row level security;
alter table public.card_invoices enable row level security;
alter table public.card_purchases enable row level security;
alter table public.card_installments enable row level security;

drop policy if exists "v517 accounts own" on public.financial_accounts;
create policy "v517 accounts own" on public.financial_accounts for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "v517 account entries own" on public.financial_account_entries;
create policy "v517 account entries own" on public.financial_account_entries for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "v517 transfers own" on public.account_transfers;
create policy "v517 transfers own" on public.account_transfers for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "v517 invoices own" on public.card_invoices;
create policy "v517 invoices own" on public.card_invoices for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "v517 purchases own" on public.card_purchases;
create policy "v517 purchases own" on public.card_purchases for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "v517 installments own" on public.card_installments;
create policy "v517 installments own" on public.card_installments for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

create index if not exists financial_accounts_user_idx on public.financial_accounts(user_id,is_active);
create index if not exists financial_account_entries_account_idx on public.financial_account_entries(account_id,occurred_on desc);
create index if not exists card_invoices_user_idx on public.card_invoices(user_id,status,due_date);
create index if not exists card_installments_invoice_idx on public.card_installments(invoice_id,status);
