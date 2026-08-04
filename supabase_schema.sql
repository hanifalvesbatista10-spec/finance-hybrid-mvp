-- =========================================================
-- HYBRID FINANCE MVP — SUPABASE SCHEMA
-- Execute este arquivo no SQL Editor do Supabase.
-- =========================================================

begin;

-- 1) Tipo restrito para os perfis da aplicação.
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'profile_role'
  ) then
    create type public.profile_role as enum ('PERSONAL', 'INSTITUTIONAL');
  end if;
end
$$;

-- 2) Perfil público ligado ao usuário autenticado.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.profile_role not null default 'PERSONAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfis da aplicação, vinculados 1:1 a auth.users.';

-- 3) Atualização automática do updated_at.
create or replace function public.set_updated_at()
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- 4) Cria o perfil assim que um usuário é cadastrado.
-- O cadastro pode enviar:
-- options.data.full_name
-- options.data.role = PERSONAL | INSTITUTIONAL
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.profile_role;
begin
  requested_role := upper(coalesce(new.raw_user_meta_data ->> 'role', 'PERSONAL'));

  safe_role := case
    when requested_role = 'INSTITUTIONAL'
      then 'INSTITUTIONAL'::public.profile_role
    else 'PERSONAL'::public.profile_role
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    safe_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 5) RLS.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

-- 6) Privilégios explícitos.
revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

commit;

-- OPCIONAL: criar perfis de usuários antigos que já existiam antes do trigger.
insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case
    when upper(coalesce(u.raw_user_meta_data ->> 'role', 'PERSONAL')) = 'INSTITUTIONAL'
      then 'INSTITUTIONAL'::public.profile_role
    else 'PERSONAL'::public.profile_role
  end
from auth.users u
on conflict (id) do nothing;
