begin;

do $$ begin
  create type public.system_role as enum ('USER', 'SUPER_ADMIN');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum ('ACTIVE', 'SUSPENDED');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists system_role public.system_role not null default 'USER',
  add column if not exists status public.account_status not null default 'ACTIVE',
  add column if not exists last_seen_at timestamptz;

create table if not exists public.platform_settings (
  id integer primary key default 1 check (id = 1),
  public_signup_enabled boolean not null default true,
  signup_mode text not null default 'PUBLIC' check (signup_mode in ('PUBLIC','INVITE_ONLY','CLOSED')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists platform_settings_read_authenticated on public.platform_settings;
create policy platform_settings_read_authenticated
on public.platform_settings for select to authenticated using (true);

drop policy if exists audit_logs_super_admin_read on public.audit_logs;
create policy audit_logs_super_admin_read
on public.audit_logs for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.system_role = 'SUPER_ADMIN'
));

grant select on public.platform_settings to authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role = 'SUPER_ADMIN'
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

commit;

-- EXECUTE UMA ÚNICA VEZ, substituindo pelo UID da sua conta:
-- update public.profiles set system_role = 'SUPER_ADMIN', status = 'ACTIVE'
-- where id = 'COLE_SEU_USER_UID_AQUI';
