-- Equity One V5.23 — Onboarding seguro para novos clientes
-- Não cria onboarding retroativo para usuários já existentes.

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step integer not null default 1 check (current_step between 1 and 6),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;
drop policy if exists "v523 onboarding own" on public.user_onboarding;
create policy "v523 onboarding own"
on public.user_onboarding for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_onboarding to authenticated;

-- Somente perfis criados DEPOIS desta migration receberão onboarding automaticamente.
create or replace function public.equity_create_onboarding_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.user_onboarding(user_id,current_step,completed)
  values(new.id,1,false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists equity_profile_onboarding_created on public.profiles;
create trigger equity_profile_onboarding_created
after insert on public.profiles
for each row execute function public.equity_create_onboarding_for_new_profile();

-- Criação atômica da primeira conta durante o onboarding.
create or replace function public.equity_onboarding_create_account(
  p_name text,
  p_institution text,
  p_account_type text,
  p_opening_balance numeric
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_account_id uuid;
  v_balance numeric := coalesce(p_opening_balance,0);
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if trim(coalesce(p_name,''))='' then raise exception 'Informe o nome da conta'; end if;
  if p_account_type not in ('CHECKING','SAVINGS','WALLET','CASH','INVESTMENT','PAYMENT','OTHER') then
    raise exception 'Tipo de conta inválido';
  end if;

  insert into public.financial_accounts(
    user_id,name,institution,account_type,opening_balance,current_balance,is_active,include_in_total
  ) values(
    v_user,trim(p_name),nullif(trim(coalesce(p_institution,'')),''),p_account_type,v_balance,v_balance,true,true
  ) returning id into v_account_id;

  if v_balance <> 0 then
    insert into public.financial_account_entries(
      user_id,account_id,entry_type,amount,description,occurred_on,metadata
    ) values(
      v_user,v_account_id,'OPENING',v_balance,'Saldo inicial',current_date,
      jsonb_build_object('source','ONBOARDING')
    );
  end if;

  update public.user_onboarding
     set current_step=greatest(current_step,3),updated_at=now()
   where user_id=v_user;

  return jsonb_build_object('ok',true,'account_id',v_account_id);
end;
$$;

create or replace function public.equity_finish_onboarding()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;

  insert into public.user_onboarding(user_id,current_step,completed,completed_at,updated_at)
  values(v_user,6,true,now(),now())
  on conflict (user_id) do update
    set current_step=6,completed=true,completed_at=now(),updated_at=now();

  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.equity_onboarding_create_account(text,text,text,numeric) from public,anon;
grant execute on function public.equity_onboarding_create_account(text,text,text,numeric) to authenticated;
revoke all on function public.equity_finish_onboarding() from public,anon;
grant execute on function public.equity_finish_onboarding() to authenticated;
