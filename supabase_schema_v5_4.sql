begin;

do $$ begin
  create type public.obligation_kind as enum ('PAYABLE', 'RECEIVABLE');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.obligation_status as enum ('PENDING', 'PAID', 'CANCELED');
exception when duplicate_object then null;
end $$;

create table if not exists public.reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_remind_days integer[] not null default array[0,1,3],
  show_overdue boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    default_remind_days <@ array[0,1,3,7,15,30]
  )
);

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(description) between 2 and 120),
  amount numeric(14,2) not null check (amount > 0),
  kind public.obligation_kind not null default 'PAYABLE',
  status public.obligation_status not null default 'PENDING',
  category text not null default 'Outros',
  cost_center text,
  due_date date not null,
  remind_days integer[] not null default array[0,1,3],
  notes text,
  paid_at timestamptz,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remind_days <@ array[0,1,3,7,15,30])
);

create index if not exists obligations_user_due_idx
  on public.obligations(user_id, status, due_date);

alter table public.reminder_preferences enable row level security;
alter table public.obligations enable row level security;

drop policy if exists reminder_preferences_own_all on public.reminder_preferences;
create policy reminder_preferences_own_all
on public.reminder_preferences
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists obligations_own_all on public.obligations;
create policy obligations_own_all
on public.obligations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
on public.reminder_preferences, public.obligations
to authenticated;

create or replace function public.set_obligation_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists obligations_set_updated_at on public.obligations;
create trigger obligations_set_updated_at
before update on public.obligations
for each row
execute function public.set_obligation_updated_at();

create or replace function public.set_reminder_preferences_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reminder_preferences_set_updated_at
on public.reminder_preferences;

create trigger reminder_preferences_set_updated_at
before update on public.reminder_preferences
for each row
execute function public.set_reminder_preferences_updated_at();

create or replace function public.complete_obligation(p_obligation_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item public.obligations;
  v_transaction_id uuid;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
  into v_item
  from public.obligations
  where id = p_obligation_id
    and user_id = v_user
  for update;

  if not found then
    raise exception 'Conta não encontrada';
  end if;

  if v_item.status = 'PAID' then
    return v_item.transaction_id;
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    type,
    category,
    cost_center,
    occurred_on,
    notes
  )
  values (
    v_user,
    v_item.description,
    v_item.amount,
    case
      when v_item.kind = 'PAYABLE'
        then 'EXPENSE'::public.transaction_type
      else 'INCOME'::public.transaction_type
    end,
    v_item.category,
    v_item.cost_center,
    current_date,
    v_item.notes
  )
  returning id into v_transaction_id;

  update public.obligations
  set
    status = 'PAID',
    paid_at = now(),
    transaction_id = v_transaction_id
  where id = p_obligation_id
    and user_id = v_user;

  return v_transaction_id;
end;
$$;

grant execute on function public.complete_obligation(uuid)
to authenticated;

insert into public.reminder_preferences (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

commit;
