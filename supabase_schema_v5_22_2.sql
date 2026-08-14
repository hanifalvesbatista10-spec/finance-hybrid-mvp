-- Equity One V5.22 Parte 2 — Lançamentos, categorias e ações rápidas

create table if not exists public.user_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null default 'PERSONAL' check (product in ('PERSONAL','BUSINESS')),
  type text not null check (type in ('INCOME','EXPENSE')),
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_categories_unique_name_idx
  on public.user_categories(user_id, product, type, lower(name));
create index if not exists user_categories_user_idx
  on public.user_categories(user_id, product, type, archived, name);

alter table public.user_categories enable row level security;
drop policy if exists "v522 categories own" on public.user_categories;
create policy "v522 categories own"
on public.user_categories for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.equity_create_transaction(
  p_description text,
  p_amount numeric,
  p_type text,
  p_categories text[],
  p_cost_center text,
  p_occurred_on date,
  p_notes text,
  p_account_id uuid,
  p_payment_method text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_categories text[];
  v_signed numeric;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'Informe um valor válido'; end if;
  if p_type not in ('INCOME','EXPENSE') then raise exception 'Tipo de lançamento inválido'; end if;

  v_categories := case when coalesce(array_length(p_categories,1),0)=0 then array['Outros']::text[] else p_categories end;

  insert into public.transactions(user_id,description,amount,type,category,categories,cost_center,occurred_on,notes,account_id,payment_method,transaction_status)
  values(v_user,trim(p_description),p_amount,p_type::public.transaction_type,v_categories[1],v_categories,
    nullif(trim(coalesce(p_cost_center,'')),''),p_occurred_on,nullif(trim(coalesce(p_notes,'')),''),
    p_account_id,nullif(trim(coalesce(p_payment_method,'')),''),'POSTED')
  returning id into v_id;

  if p_account_id is not null then
    v_signed := case when p_type='INCOME' then p_amount else -p_amount end;
    insert into public.financial_account_entries(user_id,account_id,entry_type,amount,description,occurred_on,metadata)
    values(v_user,p_account_id,p_type,v_signed,trim(p_description),p_occurred_on,
      jsonb_build_object('transaction_id',v_id,'payment_method',p_payment_method));

    update public.financial_accounts a
       set current_balance = case
         when exists(select 1 from public.financial_account_entries oe where oe.account_id=a.id and oe.entry_type='OPENING')
           then coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
         else a.opening_balance + coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
       end,
       updated_at=now()
     where a.id=p_account_id and a.user_id=v_user;
  end if;

  return jsonb_build_object('ok',true,'id',v_id);
end;
$$;

create or replace function public.equity_update_transaction(
  p_transaction_id uuid,
  p_description text,
  p_amount numeric,
  p_type text,
  p_categories text[],
  p_cost_center text,
  p_occurred_on date,
  p_notes text,
  p_account_id uuid,
  p_payment_method text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_old public.transactions%rowtype;
  v_categories text[];
  v_signed numeric;
  v_account uuid;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'Informe um valor válido'; end if;
  if p_type not in ('INCOME','EXPENSE') then raise exception 'Tipo de lançamento inválido'; end if;

  select * into v_old from public.transactions where id=p_transaction_id and user_id=v_user for update;
  if not found then raise exception 'Lançamento não encontrado'; end if;

  v_categories := case when coalesce(array_length(p_categories,1),0)=0 then array['Outros']::text[] else p_categories end;

  delete from public.financial_account_entries
   where user_id=v_user and metadata->>'transaction_id'=v_old.id::text;

  update public.transactions
     set description=trim(p_description),
         amount=p_amount,
         type=p_type::public.transaction_type,
         category=v_categories[1],
         categories=v_categories,
         cost_center=nullif(trim(coalesce(p_cost_center,'')),''),
         occurred_on=p_occurred_on,
         notes=nullif(trim(coalesce(p_notes,'')),''),
         account_id=p_account_id,
         payment_method=nullif(trim(coalesce(p_payment_method,'')),''),
         transaction_status='POSTED'
   where id=v_old.id and user_id=v_user;

  if p_account_id is not null then
    v_signed := case when p_type='INCOME' then p_amount else -p_amount end;
    insert into public.financial_account_entries(user_id,account_id,entry_type,amount,description,occurred_on,metadata)
    values(v_user,p_account_id,p_type,v_signed,trim(p_description),p_occurred_on,
      jsonb_build_object('transaction_id',v_old.id,'payment_method',p_payment_method));
  end if;

  for v_account in
    select distinct u.account_id
    from unnest(array[v_old.account_id,p_account_id]::uuid[]) as u(account_id)
    where u.account_id is not null
  loop
    update public.financial_accounts a
       set current_balance = case
         when exists(select 1 from public.financial_account_entries oe where oe.account_id=a.id and oe.entry_type='OPENING')
           then coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
         else a.opening_balance + coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
       end,
       updated_at=now()
     where a.id=v_account and a.user_id=v_user;
  end loop;

  return jsonb_build_object('ok',true,'id',v_old.id);
end;
$$;

create or replace function public.equity_duplicate_transaction(
  p_transaction_id uuid,
  p_occurred_on date default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_old public.transactions%rowtype;
  v_new_id uuid;
  v_date date;
  v_signed numeric;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_old from public.transactions where id=p_transaction_id and user_id=v_user;
  if not found then raise exception 'Lançamento não encontrado'; end if;

  v_date := coalesce(p_occurred_on,v_old.occurred_on);
  insert into public.transactions(user_id,description,amount,type,category,categories,cost_center,occurred_on,notes,account_id,payment_method,transaction_status)
  values(v_user,v_old.description,v_old.amount,v_old.type,v_old.category,v_old.categories,v_old.cost_center,v_date,v_old.notes,v_old.account_id,v_old.payment_method,'POSTED')
  returning id into v_new_id;

  if v_old.account_id is not null then
    v_signed := case when v_old.type='INCOME' then v_old.amount else -v_old.amount end;
    insert into public.financial_account_entries(user_id,account_id,entry_type,amount,description,occurred_on,metadata)
    values(v_user,v_old.account_id,v_old.type::text,v_signed,v_old.description,v_date,
      jsonb_build_object('transaction_id',v_new_id,'payment_method',v_old.payment_method));

    update public.financial_accounts a
       set current_balance = case
         when exists(select 1 from public.financial_account_entries oe where oe.account_id=a.id and oe.entry_type='OPENING')
           then coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
         else a.opening_balance + coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
       end,
       updated_at=now()
     where a.id=v_old.account_id and a.user_id=v_user;
  end if;

  return jsonb_build_object('ok',true,'id',v_new_id);
end;
$$;

create or replace function public.equity_rename_custom_category(
  p_category_id uuid,
  p_new_name text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_old_name text;
  v_new_name text := trim(p_new_name);
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if v_new_name='' then raise exception 'Informe o novo nome da categoria'; end if;

  select name into v_old_name from public.user_categories where id=p_category_id and user_id=v_user for update;
  if not found then raise exception 'Categoria não encontrada'; end if;

  update public.user_categories set name=v_new_name,updated_at=now() where id=p_category_id and user_id=v_user;

  update public.transactions t
     set category=case when t.category=v_old_name then v_new_name else t.category end,
         categories=case when t.categories is null then t.categories else
           array(select case when x=v_old_name then v_new_name else x end from unnest(t.categories) x)
         end
   where t.user_id=v_user
     and (t.category=v_old_name or v_old_name=any(coalesce(t.categories,array[]::text[])));

  return jsonb_build_object('ok',true,'old_name',v_old_name,'new_name',v_new_name);
end;
$$;

revoke all on function public.equity_create_transaction(text,numeric,text,text[],text,date,text,uuid,text) from public,anon;
grant execute on function public.equity_create_transaction(text,numeric,text,text[],text,date,text,uuid,text) to authenticated;
revoke all on function public.equity_update_transaction(uuid,text,numeric,text,text[],text,date,text,uuid,text) from public,anon;
grant execute on function public.equity_update_transaction(uuid,text,numeric,text,text[],text,date,text,uuid,text) to authenticated;
revoke all on function public.equity_duplicate_transaction(uuid,date) from public,anon;
grant execute on function public.equity_duplicate_transaction(uuid,date) to authenticated;
revoke all on function public.equity_rename_custom_category(uuid,text) from public,anon;
grant execute on function public.equity_rename_custom_category(uuid,text) to authenticated;
