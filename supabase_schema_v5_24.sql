-- Equity One V5.24 — Meu Agente Financeiro operacional
-- Confirmação atômica de lançamentos propostos pela IA.

alter table public.transactions add column if not exists entry_source text;
alter table public.transactions add column if not exists ai_original_text text;
alter table public.transactions add column if not exists ai_confidence numeric;
alter table public.transactions add column if not exists merchant text;
alter table public.transactions add column if not exists occurred_at timestamptz;

create or replace function public.equity_confirm_ai_entries(
  p_entries jsonb,
  p_original_text text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_id uuid;
  v_account_id uuid;
  v_touched uuid[] := array[]::uuid[];
  v_ids uuid[] := array[]::uuid[];
  v_amount numeric;
  v_type text;
  v_categories text[];
  v_description text;
  v_occurred_on date;
  v_signed numeric;
  v_payment_method text;
  v_account uuid;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries)=0 then
    raise exception 'Nenhum lançamento para confirmar';
  end if;
  if jsonb_array_length(p_entries) > 25 then
    raise exception 'Confirme no máximo 25 lançamentos por vez';
  end if;

  for v_item in select value from jsonb_array_elements(p_entries)
  loop
    v_description := trim(coalesce(v_item->>'description',''));
    v_amount := coalesce((v_item->>'amount')::numeric,0);
    v_type := upper(coalesce(v_item->>'type','EXPENSE'));
    v_occurred_on := coalesce(nullif(v_item->>'occurred_on','')::date,current_date);
    v_account_id := nullif(v_item->>'account_id','')::uuid;
    v_payment_method := nullif(trim(coalesce(v_item->>'payment_method','')),'');

    if char_length(v_description) < 2 then raise exception 'Descrição inválida'; end if;
    if v_amount <= 0 then raise exception 'Valor inválido'; end if;
    if v_type not in ('INCOME','EXPENSE') then raise exception 'Tipo inválido'; end if;

    select coalesce(array_agg(value),array[]::text[])
      into v_categories
      from jsonb_array_elements_text(coalesce(v_item->'categories','[]'::jsonb));
    if coalesce(array_length(v_categories,1),0)=0 then v_categories := array['Outros']::text[]; end if;

    if v_account_id is not null and not exists(
      select 1 from public.financial_accounts
       where id=v_account_id and user_id=v_user and is_active=true
    ) then
      raise exception 'Conta financeira inválida ou não pertence ao usuário';
    end if;

    insert into public.transactions(
      user_id,description,amount,type,category,categories,cost_center,occurred_on,occurred_at,
      merchant,notes,account_id,payment_method,transaction_status,entry_source,ai_original_text,ai_confidence
    ) values(
      v_user,v_description,v_amount,v_type::public.transaction_type,v_categories[1],v_categories,
      nullif(trim(coalesce(v_item->>'cost_center','')),''),v_occurred_on,
      coalesce(nullif(v_item->>'occurred_at','')::timestamptz,now()),
      nullif(trim(coalesce(v_item->>'merchant','')),''),
      nullif(trim(coalesce(v_item->>'notes','')),''),v_account_id,v_payment_method,'POSTED','AI',
      nullif(trim(coalesce(p_original_text,'')),''),
      least(1,greatest(0,coalesce((v_item->>'confidence')::numeric,0.5)))
    ) returning id into v_id;

    v_ids := array_append(v_ids,v_id);

    if v_account_id is not null then
      v_signed := case when v_type='INCOME' then v_amount else -v_amount end;
      insert into public.financial_account_entries(
        user_id,account_id,entry_type,amount,description,occurred_on,metadata
      ) values(
        v_user,v_account_id,v_type,v_signed,v_description,v_occurred_on,
        jsonb_build_object('transaction_id',v_id,'payment_method',v_payment_method,'source','AI')
      );
      if not v_account_id = any(v_touched) then v_touched := array_append(v_touched,v_account_id); end if;
    end if;
  end loop;

  foreach v_account in array v_touched
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

  return jsonb_build_object('ok',true,'count',coalesce(array_length(v_ids,1),0),'ids',to_jsonb(v_ids));
end;
$$;

revoke all on function public.equity_confirm_ai_entries(jsonb,text) from public,anon;
grant execute on function public.equity_confirm_ai_entries(jsonb,text) to authenticated;
