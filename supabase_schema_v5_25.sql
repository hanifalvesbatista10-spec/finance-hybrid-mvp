-- Equity One V5.25 — ações profundas do Meu Agente Financeiro
-- Cria meta, conta a pagar/receber, movimenta meta e registra compra no cartão
-- somente após confirmação explícita do usuário.

create or replace function public.equity_confirm_agent_action(
  p_action jsonb,
  p_original_text text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_kind text := upper(coalesce(p_action->>'kind',''));
  v_payload jsonb := coalesce(p_action->'payload','{}'::jsonb);
  v_id uuid;
  v_goal public.goals%rowtype;
  v_amount numeric;
  v_target numeric;
  v_current numeric;
  v_name text;
  v_description text;
  v_date date;
  v_deadline date;
  v_movement text;
  v_card public.cards%rowtype;
  v_purchase_id uuid;
  v_installments integer;
  v_purchase_date date;
  v_first_month date;
  v_ref date;
  v_due date;
  v_invoice_id uuid;
  v_base numeric;
  v_part numeric;
  v_n integer;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;

  if v_kind='CREATE_GOAL' then
    v_name := trim(coalesce(v_payload->>'name',''));
    v_target := coalesce((v_payload->>'target_amount')::numeric,0);
    v_current := coalesce((v_payload->>'current_amount')::numeric,0);
    v_deadline := nullif(v_payload->>'deadline','')::date;
    if char_length(v_name)<2 then raise exception 'Informe o nome da meta'; end if;
    if v_target<=0 then raise exception 'O valor da meta deve ser maior que zero'; end if;
    if v_current<0 then raise exception 'O valor atual da meta não pode ser negativo'; end if;

    insert into public.goals(user_id,name,target_amount,current_amount,deadline)
    values(v_user,v_name,v_target,v_current,v_deadline)
    returning id into v_id;

    return jsonb_build_object('ok',true,'kind',v_kind,'id',v_id);
  end if;

  if v_kind='CREATE_OBLIGATION' then
    v_description := trim(coalesce(v_payload->>'description',''));
    v_amount := coalesce((v_payload->>'amount')::numeric,0);
    v_date := nullif(v_payload->>'due_date','')::date;
    if char_length(v_description)<2 then raise exception 'Informe a descrição da conta'; end if;
    if v_amount<=0 then raise exception 'O valor deve ser maior que zero'; end if;
    if v_date is null then raise exception 'Informe o vencimento'; end if;
    if upper(coalesce(v_payload->>'obligation_kind','')) not in ('PAYABLE','RECEIVABLE') then
      raise exception 'Tipo de conta inválido';
    end if;

    insert into public.obligations(
      user_id,description,amount,kind,category,cost_center,due_date,remind_days,notes,status
    ) values(
      v_user,v_description,v_amount,upper(v_payload->>'obligation_kind'),
      coalesce(nullif(trim(v_payload->>'category'),''),'Outros'),
      nullif(trim(coalesce(v_payload->>'cost_center','')),''),v_date,array[0,1,3],
      nullif(trim(coalesce(v_payload->>'notes','')),''),'PENDING'
    ) returning id into v_id;

    return jsonb_build_object('ok',true,'kind',v_kind,'id',v_id);
  end if;

  if v_kind='GOAL_MOVEMENT' then
    v_id := nullif(v_payload->>'goal_id','')::uuid;
    v_movement := upper(coalesce(v_payload->>'movement_type',''));
    v_amount := coalesce((v_payload->>'amount')::numeric,0);
    v_date := coalesce(nullif(v_payload->>'occurred_on','')::date,current_date);

    select * into v_goal from public.goals where id=v_id and user_id=v_user for update;
    if not found then raise exception 'Meta não encontrada'; end if;
    if v_movement not in ('ADD','WITHDRAW') then raise exception 'Movimento inválido'; end if;
    if v_amount<=0 then raise exception 'O valor deve ser maior que zero'; end if;
    if v_movement='WITHDRAW' and v_amount>v_goal.current_amount then
      raise exception 'A retirada é maior que o valor acumulado na meta';
    end if;

    insert into public.goal_movements(
      user_id,goal_id,movement_type,amount,account_type,account_name,occurred_on,notes
    ) values(
      v_user,v_goal.id,v_movement,v_amount,
      nullif(trim(coalesce(v_payload->>'account_type','')),''),
      nullif(trim(coalesce(v_payload->>'account_name','')),''),v_date,
      nullif(trim(coalesce(v_payload->>'notes','')),'')
    );

    update public.goals
       set current_amount = case when v_movement='ADD' then current_amount+v_amount else current_amount-v_amount end
     where id=v_goal.id and user_id=v_user;

    return jsonb_build_object('ok',true,'kind',v_kind,'id',v_goal.id);
  end if;

  if v_kind='CARD_PURCHASE' then
    v_id := nullif(v_payload->>'card_id','')::uuid;
    v_description := trim(coalesce(v_payload->>'description',''));
    v_amount := coalesce((v_payload->>'total_amount')::numeric,0);
    v_installments := greatest(1,least(48,coalesce((v_payload->>'installments')::integer,1)));
    v_purchase_date := coalesce(nullif(v_payload->>'purchase_date','')::date,current_date);

    select * into v_card from public.cards where id=v_id and user_id=v_user and is_active=true for update;
    if not found then raise exception 'Cartão não encontrado'; end if;
    if char_length(v_description)<2 then raise exception 'Informe a descrição da compra'; end if;
    if v_amount<=0 then raise exception 'O valor da compra deve ser maior que zero'; end if;

    insert into public.card_purchases(
      user_id,card_id,description,merchant,category,total_amount,installments,purchase_date
    ) values(
      v_user,v_card.id,v_description,nullif(trim(coalesce(v_payload->>'merchant','')),''),
      coalesce(nullif(trim(v_payload->>'category'),''),'Outros'),v_amount,v_installments,v_purchase_date
    ) returning id into v_purchase_id;

    v_first_month := date_trunc('month',v_purchase_date)::date;
    if extract(day from v_purchase_date)::integer > coalesce(v_card.closing_day,1) then
      v_first_month := (v_first_month + interval '1 month')::date;
    end if;
    v_base := trunc(v_amount/v_installments,2);

    for v_n in 1..v_installments loop
      v_ref := (v_first_month + make_interval(months=>v_n-1))::date;
      select id into v_invoice_id from public.card_invoices
       where user_id=v_user and card_id=v_card.id and reference_month=v_ref
       limit 1;

      if v_invoice_id is null then
        v_due := make_date(
          extract(year from v_ref)::integer,
          extract(month from v_ref)::integer,
          least(coalesce(v_card.due_day,1),28)
        );
        insert into public.card_invoices(
          user_id,card_id,reference_month,due_date,status,total_amount,paid_amount,payment_account_id
        ) values(
          v_user,v_card.id,v_ref,v_due,'OPEN',0,0,v_card.payment_account_id
        ) returning id into v_invoice_id;
      end if;

      v_part := case when v_n=v_installments then v_amount-(v_base*(v_installments-1)) else v_base end;
      insert into public.card_installments(
        user_id,purchase_id,card_id,invoice_id,installment_number,installment_count,amount,due_month,status
      ) values(
        v_user,v_purchase_id,v_card.id,v_invoice_id,v_n,v_installments,v_part,v_ref,'OPEN'
      );

      update public.card_invoices
         set total_amount=total_amount+v_part,updated_at=now()
       where id=v_invoice_id and user_id=v_user;

      v_invoice_id := null;
    end loop;

    return jsonb_build_object('ok',true,'kind',v_kind,'id',v_purchase_id);
  end if;

  raise exception 'Ação do agente não suportada';
end;
$$;

revoke all on function public.equity_confirm_agent_action(jsonb,text) from public,anon;
grant execute on function public.equity_confirm_agent_action(jsonb,text) to authenticated;
