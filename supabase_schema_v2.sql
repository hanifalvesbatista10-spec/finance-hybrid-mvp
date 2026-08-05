begin;

do $$ begin
  create type public.profile_role as enum ('PERSONAL', 'INSTITUTIONAL');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_type as enum ('INCOME', 'EXPENSE');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.profile_role not null default 'PERSONAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(description) between 2 and 120),
  amount numeric(14,2) not null check (amount > 0),
  type public.transaction_type not null,
  category text not null default 'Outros',
  cost_center text,
  occurred_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 80),
  brand text not null default 'Outro',
  last_four text not null check (last_four ~ '^[0-9]{4}$'),
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  current_invoice numeric(14,2) not null default 0 check (current_invoice >= 0),
  closing_day integer check (closing_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  monthly_budget numeric(14,2) not null default 0 check (monthly_budget >= 0),
  description text,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  email text not null,
  permission text not null check (permission in ('ADMIN', 'ACCOUNTANT', 'OPERATOR')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions(user_id, occurred_on desc);
create index if not exists goals_user_idx on public.goals(user_id);
create index if not exists cards_user_idx on public.cards(user_id);
create index if not exists cost_centers_user_idx on public.cost_centers(user_id);
create index if not exists company_members_user_idx on public.company_members(user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_role text;
begin
  requested_role := upper(coalesce(new.raw_user_meta_data ->> 'role', 'PERSONAL'));

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when requested_role = 'INSTITUTIONAL'
        then 'INSTITUTIONAL'::public.profile_role
      else 'PERSONAL'::public.profile_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.cards enable row level security;
alter table public.cost_centers enable row level security;
alter table public.company_members enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','transactions','goals','cards','cost_centers','company_members']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_own_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)',
      t || '_own_all',
      t,
      case when t = 'profiles' then 'id' else 'user_id' end,
      case when t = 'profiles' then 'id' else 'user_id' end
    );
  end loop;
end $$;

grant select, insert, update, delete on public.profiles,
  public.transactions, public.goals, public.cards,
  public.cost_centers, public.company_members to authenticated;

insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case when upper(coalesce(u.raw_user_meta_data ->> 'role', 'PERSONAL')) = 'INSTITUTIONAL'
    then 'INSTITUTIONAL'::public.profile_role
    else 'PERSONAL'::public.profile_role
  end
from auth.users u
on conflict (id) do nothing;

commit;
