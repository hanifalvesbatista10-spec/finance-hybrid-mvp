begin;

do $$ begin
  create type public.subscription_plan as enum ('PERSONAL', 'BUSINESS');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum (
    'PENDING',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED',
    'EXPIRED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan public.subscription_plan not null default 'PERSONAL',
  status public.subscription_status not null default 'PENDING',
  starts_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  access_mode text not null default 'MANUAL'
    check (access_mode in ('MANUAL', 'PROVIDER', 'LIFETIME')),
  payment_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  last_payment_at timestamptz,
  next_payment_at timestamptz,
  canceled_at timestamptz,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_status_end_idx
  on public.subscriptions(status, current_period_end);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own
on public.subscriptions
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.is_super_admin()
);

grant select on public.subscriptions to authenticated;

create or replace function public.set_subscription_updated_at()
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

drop trigger if exists subscriptions_set_updated_at
on public.subscriptions;

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_subscription_updated_at();

create or replace function public.create_subscription_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (
    user_id,
    plan,
    status,
    access_mode
  )
  values (
    new.id,
    case
      when new.role = 'INSTITUTIONAL'
        then 'BUSINESS'::public.subscription_plan
      else 'PERSONAL'::public.subscription_plan
    end,
    case
      when new.system_role = 'SUPER_ADMIN'
        then 'ACTIVE'::public.subscription_status
      else 'PENDING'::public.subscription_status
    end,
    case
      when new.system_role = 'SUPER_ADMIN'
        then 'LIFETIME'
      else 'MANUAL'
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_profile_subscription_created
on public.profiles;

create trigger on_profile_subscription_created
after insert on public.profiles
for each row
execute function public.create_subscription_for_profile();

insert into public.subscriptions (
  user_id,
  plan,
  status,
  starts_at,
  current_period_start,
  current_period_end,
  access_mode,
  notes
)
select
  p.id,
  case
    when p.role = 'INSTITUTIONAL'
      then 'BUSINESS'::public.subscription_plan
    else 'PERSONAL'::public.subscription_plan
  end,
  case
    when p.system_role = 'SUPER_ADMIN'
      then 'ACTIVE'::public.subscription_status
    else 'ACTIVE'::public.subscription_status
  end,
  now(),
  now(),
  case
    when p.system_role = 'SUPER_ADMIN'
      then null
    else now() + interval '30 days'
  end,
  case
    when p.system_role = 'SUPER_ADMIN'
      then 'LIFETIME'
    else 'MANUAL'
  end,
  case
    when p.system_role = 'SUPER_ADMIN'
      then 'Acesso administrativo permanente'
    else 'Migração V5.5: 30 dias concedidos'
  end
from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.subscription_has_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
    where p.id = p_user_id
      and p.status = 'ACTIVE'
      and (
        p.system_role = 'SUPER_ADMIN'
        or (
          s.status = 'ACTIVE'
          and (
            s.access_mode = 'LIFETIME'
            or s.current_period_end is null
            or s.current_period_end > now()
          )
        )
      )
  );
$$;

grant execute on function public.subscription_has_access(uuid)
to authenticated;

commit;
