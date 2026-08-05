-- FINANCE HYBRID PRO V4
-- Execute depois dos schemas anteriores.

begin;

alter table public.transactions
  add column if not exists recurring_entry_id uuid,
  add column if not exists competence_month date;

create table if not exists public.recurring_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(description) between 2 and 120),
  amount numeric(14,2) not null check (amount > 0),
  type public.transaction_type not null,
  category text not null default 'Outros',
  cost_center text,
  day_of_month integer not null default 1 check (day_of_month between 1 and 31),
  start_month date not null default date_trunc('month', current_date)::date,
  end_month date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  check (end_month is null or end_month >= start_month)
);

alter table public.transactions
  drop constraint if exists transactions_recurring_entry_id_fkey;

alter table public.transactions
  add constraint transactions_recurring_entry_id_fkey
  foreign key (recurring_entry_id)
  references public.recurring_entries(id)
  on delete set null;

create index if not exists recurring_entries_user_idx
  on public.recurring_entries(user_id, active);

create unique index if not exists transactions_recurring_month_unique
  on public.transactions(user_id, recurring_entry_id, competence_month)
  where recurring_entry_id is not null and competence_month is not null;

alter table public.recurring_entries enable row level security;

drop policy if exists recurring_entries_own_all on public.recurring_entries;
create policy recurring_entries_own_all
on public.recurring_entries
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
on public.recurring_entries
to authenticated;

create or replace function public.generate_recurring_transactions(p_month date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', p_month)::date;
  v_last_day integer :=
    extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::integer;
  v_inserted integer := 0;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    type,
    category,
    cost_center,
    occurred_on,
    notes,
    recurring_entry_id,
    competence_month
  )
  select
    r.user_id,
    r.description,
    r.amount,
    r.type,
    r.category,
    r.cost_center,
    make_date(
      extract(year from v_month)::integer,
      extract(month from v_month)::integer,
      least(r.day_of_month, v_last_day)
    ),
    r.notes,
    r.id,
    v_month
  from public.recurring_entries r
  where r.user_id = v_user
    and r.active = true
    and r.start_month <= v_month
    and (r.end_month is null or r.end_month >= v_month)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

grant execute on function public.generate_recurring_transactions(date)
to authenticated;

commit;
