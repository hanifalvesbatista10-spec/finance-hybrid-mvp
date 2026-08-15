-- Equity One V5.26 — WhatsApp 2.0
-- Confirmação transacional, ações profundas e diagnóstico de webhook.

create table if not exists public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_id text not null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  original_text text,
  status text not null default 'WAITING_CONFIRMATION',
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pending_actions add column if not exists executed_at timestamptz;
alter table public.agent_pending_actions add column if not exists result jsonb;
alter table public.agent_pending_actions add column if not exists last_error text;

create index if not exists agent_pending_actions_waiting_idx
  on public.agent_pending_actions(user_id, wa_id, status, created_at desc);

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'WEBHOOK',
  status text not null default 'RECEIVED',
  wa_id text,
  provider_message_id text,
  message_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_webhook_events_created_idx
  on public.whatsapp_webhook_events(created_at desc);
create index if not exists whatsapp_webhook_events_message_idx
  on public.whatsapp_webhook_events(provider_message_id)
  where provider_message_id is not null;

-- Reforça colunas utilizadas pelo agente/WhatsApp.
alter table public.transactions add column if not exists entry_source text;
alter table public.transactions add column if not exists ai_original_text text;
alter table public.transactions add column if not exists ai_confidence numeric;
alter table public.transactions add column if not exists merchant text;
alter table public.transactions add column if not exists occurred_at timestamptz;

create or replace function public.equity_whatsapp_execute_pending_action(
  p_pending_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_pending public.agent_pending_actions%rowtype;
  v_action_type text;
  v_product text;
  v_entries jsonb;
  v_item jsonb;
  v_proposal jsonb;
  v_kind text;
  v_payload jsonb;
  v_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_touched uuid[] := array[]::uuid[];
  v_account_id uuid;
  v_account uuid;
  v_amount numeric;
  v_type text;
  v_categories text[];
  v_description text;
  v_occurred_on date;
  v_signed numeric;
  v_payment_method text;
  v_count integer := 0;
  v_goal public.goals%rowtype;
  v_target numeric;
  v_current numeric;
  v_name text;
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
  v_message text;
begin
  select * into v_pending
    from public.agent_pending_actions
   where id=p_pending_id
   for update;

  if not found then
    return jsonb_build_object('ok',false,'message','Ação pendente não encontrada.');
  end if;

  if v_pending.status <> 'WAITING_CONFIRMATION' then
    return jsonb_build_object('ok',false,'message','Esta ação já foi concluída ou cancelada.','status',v_pending.status);
  end if;

  if v_pending.expires_at is not null and v_pending.expires_at < now() then
    update public.agent_pending_actions
       set status='EXPIRED',updated_at=now()
     where id=v_pending.id;
    return jsonb_build_object('ok',false,'expired',true,'message','Essa confirmação expirou. Envie o pedido novamente.');
  end if;

  v_action_type := upper(coalesce(v_pending.action_type,''));
  v_product := upper(coalesce(v_pending.payload->>'product','PERSONAL'));

  if v_action_type='PROPOSE_FINANCIAL_ENTRIES' then
    v_entries := coalesce(v_pending.payload->'entries','[]'::jsonb);
    if jsonb_typeof(v_entries) <> 'array' or jsonb_array_length(v_entries)=0 then
      raise exception 'Nenhum lançamento válido para confirmar';
    end if;
    if jsonb_array_length(v_entries)>25 then
      raise exception 'Confirme no máximo 25 lançamentos por vez';
    end if;

    for v_item in select value from jsonb_array_elements(v_entries)
    loop
      v_description := trim(coalesce(v_item->>'description',''));
      v_amount := coalesce((v_item->>'amount')::numeric,0);
      v_type := upper(coalesce(v_item->>'type',case when v_item->>'kind'='INCOME' then 'INCOME' else 'EXPENSE' end));
      v_occurred_on := coalesce(nullif(v_item->>'occurred_on','')::date,current_date);
      v_account_id := nullif(v_item->>'account_id','')::uuid;
      v_payment_method := nullif(trim(coalesce(v_item->>'payment_method','')),'');

      if char_length(v_description)<2 then raise exception 'Descrição inválida'; end if;
      if v_amount<=0 then raise exception 'Valor inválido'; end if;
      if v_type not in ('INCOME','EXPENSE') then raise exception 'Tipo inválido'; end if;

      select coalesce(array_agg(value),array[]::text[])
        into v_categories
        from jsonb_array_elements_text(coalesce(v_item->'categories','[]'::jsonb));
      if coalesce(array_length(v_categories,1),0)=0 then
        v_categories := array[coalesce(nullif(v_item->>'category',''),'Outros')]::text[];
      end if;

      if v_product='MEDICAL' then
        insert into public.medical_professional_transactions(
          user_id,transaction_date,occurred_at,kind,category,amount,description,merchant,
          entry_source,ai_original_text,ai_confidence
        ) values(
          v_pending.user_id,v_occurred_on,
          coalesce(nullif(v_item->>'occurred_at','')::timestamptz,now()),
          case when v_type='INCOME' then 'INCOME' else 'EXPENSE' end,
          v_categories[1],v_amount,v_description,
          nullif(trim(coalesce(v_item->>'merchant','')),''),'WHATSAPP',
          nullif(trim(coalesce(v_pending.original_text,'')),''),
          least(1,greatest(0,coalesce((v_item->>'confidence')::numeric,0.5)))
        ) returning id into v_id;
      else
        if v_account_id is not null and not exists(
          select 1 from public.financial_accounts
           where id=v_account_id and user_id=v_pending.user_id and is_active=true
        ) then
          raise exception 'Conta financeira inválida';
        end if;

        insert into public.transactions(
          user_id,description,amount,type,category,categories,cost_center,occurred_on,occurred_at,
          merchant,notes,account_id,payment_method,transaction_status,entry_source,ai_original_text,ai_confidence
        ) values(
          v_pending.user_id,v_description,v_amount,v_type::public.transaction_type,v_categories[1],v_categories,
          nullif(trim(coalesce(v_item->>'cost_center','')),''),v_occurred_on,
          coalesce(nullif(v_item->>'occurred_at','')::timestamptz,now()),
          nullif(trim(coalesce(v_item->>'merchant','')),''),
          nullif(trim(coalesce(v_item->>'notes','')),''),v_account_id,v_payment_method,'POSTED','WHATSAPP',
          nullif(trim(coalesce(v_pending.original_text,'')),''),
          least(1,greatest(0,coalesce((v_item->>'confidence')::numeric,0.5)))
        ) returning id into v_id;

        if v_account_id is not null then
          v_signed := case when v_type='INCOME' then v_amount else -v_amount end;
          insert into public.financial_account_entries(
            user_id,account_id,entry_type,amount,description,occurred_on,metadata
          ) values(
            v_pending.user_id,v_account_id,v_type,v_signed,v_description,v_occurred_on,
            jsonb_build_object('transaction_id',v_id,'payment_method',v_payment_method,'source','WHATSAPP')
          );
          if not v_account_id=any(v_touched) then
            v_touched := array_append(v_touched,v_account_id);
          end if;
        end if;
      end if;

      v_ids := array_append(v_ids,v_id);
      v_count := v_count+1;
    end loop;

    if v_product<>'MEDICAL' then
      foreach v_account in array v_touched
      loop
        update public.financial_accounts a
           set current_balance = case
             when exists(select 1 from public.financial_account_entries oe where oe.account_id=a.id and oe.entry_type='OPENING')
               then coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
             else a.opening_balance + coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
           end,
           updated_at=now()
         where a.id=v_account and a.user_id=v_pending.user_id;
      end loop;
    end if;

    v_message := format('✅ Pronto. Registrei %s lançamento(s) no seu Equity One.',v_count);

  elsif v_action_type='PROPOSE_AGENT_ACTION' then
    v_proposal := coalesce(v_pending.payload->'proposal','{}'::jsonb);
    v_kind := upper(coalesce(v_proposal->>'kind',''));
    v_payload := coalesce(v_proposal->'payload','{}'::jsonb);

    if v_kind='CREATE_GOAL' then
      v_name := trim(coalesce(v_payload->>'name',''));
      v_target := coalesce((v_payload->>'target_amount')::numeric,0);
      v_current := coalesce((v_payload->>'current_amount')::numeric,0);
      v_deadline := nullif(v_payload->>'deadline','')::date;
      if char_length(v_name)<2 then raise exception 'Informe o nome da meta'; end if;
      if v_target<=0 then raise exception 'O valor da meta deve ser maior que zero'; end if;
      if v_current<0 then raise exception 'O valor atual da meta não pode ser negativo'; end if;

      insert into public.goals(user_id,name,target_amount,current_amount,deadline)
      values(v_pending.user_id,v_name,v_target,v_current,v_deadline)
      returning id into v_id;
      v_message := format('✅ Meta “%s” criada com sucesso.',v_name);

    elsif v_kind='CREATE_OBLIGATION' then
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
        v_pending.user_id,v_description,v_amount,upper(v_payload->>'obligation_kind'),
        coalesce(nullif(trim(v_payload->>'category'),''),'Outros'),
        nullif(trim(coalesce(v_payload->>'cost_center','')),''),v_date,array[0,1,3],
        nullif(trim(coalesce(v_payload->>'notes','')),''),'PENDING'
      ) returning id into v_id;
      v_message := case when upper(v_payload->>'obligation_kind')='RECEIVABLE'
        then '✅ Conta a receber cadastrada com sucesso.'
        else '✅ Conta a pagar cadastrada com sucesso.' end;

    elsif v_kind='GOAL_MOVEMENT' then
      v_id := nullif(v_payload->>'goal_id','')::uuid;
      v_movement := upper(coalesce(v_payload->>'movement_type',''));
      v_amount := coalesce((v_payload->>'amount')::numeric,0);
      v_date := coalesce(nullif(v_payload->>'occurred_on','')::date,current_date);

      select * into v_goal from public.goals
       where id=v_id and user_id=v_pending.user_id for update;
      if not found then raise exception 'Meta não encontrada'; end if;
      if v_movement not in ('ADD','WITHDRAW') then raise exception 'Movimento inválido'; end if;
      if v_amount<=0 then raise exception 'O valor deve ser maior que zero'; end if;
      if v_movement='WITHDRAW' and v_amount>v_goal.current_amount then
        raise exception 'A retirada é maior que o valor acumulado na meta';
      end if;

      insert into public.goal_movements(
        user_id,goal_id,movement_type,amount,account_type,account_name,occurred_on,notes
      ) values(
        v_pending.user_id,v_goal.id,v_movement,v_amount,
        nullif(trim(coalesce(v_payload->>'account_type','')),''),
        nullif(trim(coalesce(v_payload->>'account_name','')),''),v_date,
        nullif(trim(coalesce(v_payload->>'notes','')),'')
      );
      update public.goals
         set current_amount=case when v_movement='ADD' then current_amount+v_amount else current_amount-v_amount end
       where id=v_goal.id and user_id=v_pending.user_id;
      v_message := case when v_movement='ADD'
        then format('✅ Aporte de %s registrado na meta “%s”.',to_char(v_amount,'FM999G999G990D00'),v_goal.name)
        else format('✅ Retirada de %s registrada na meta “%s”.',to_char(v_amount,'FM999G999G990D00'),v_goal.name) end;

    elsif v_kind='CARD_PURCHASE' then
      v_id := nullif(v_payload->>'card_id','')::uuid;
      v_description := trim(coalesce(v_payload->>'description',''));
      v_amount := coalesce((v_payload->>'total_amount')::numeric,0);
      v_installments := greatest(1,least(48,coalesce((v_payload->>'installments')::integer,1)));
      v_purchase_date := coalesce(nullif(v_payload->>'purchase_date','')::date,current_date);

      select * into v_card from public.cards
       where id=v_id and user_id=v_pending.user_id and is_active=true for update;
      if not found then raise exception 'Cartão não encontrado'; end if;
      if char_length(v_description)<2 then raise exception 'Informe a descrição da compra'; end if;
      if v_amount<=0 then raise exception 'O valor da compra deve ser maior que zero'; end if;

      insert into public.card_purchases(
        user_id,card_id,description,merchant,category,total_amount,installments,purchase_date
      ) values(
        v_pending.user_id,v_card.id,v_description,
        nullif(trim(coalesce(v_payload->>'merchant','')),''),
        coalesce(nullif(trim(v_payload->>'category'),''),'Outros'),v_amount,v_installments,v_purchase_date
      ) returning id into v_purchase_id;

      v_first_month := date_trunc('month',v_purchase_date)::date;
      if extract(day from v_purchase_date)::integer>coalesce(v_card.closing_day,1) then
        v_first_month := (v_first_month+interval '1 month')::date;
      end if;
      v_base := trunc(v_amount/v_installments,2);

      for v_n in 1..v_installments loop
        v_ref := (v_first_month+make_interval(months=>v_n-1))::date;
        select id into v_invoice_id from public.card_invoices
         where user_id=v_pending.user_id and card_id=v_card.id and reference_month=v_ref
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
            v_pending.user_id,v_card.id,v_ref,v_due,'OPEN',0,0,v_card.payment_account_id
          ) returning id into v_invoice_id;
        end if;

        v_part := case when v_n=v_installments then v_amount-(v_base*(v_installments-1)) else v_base end;
        insert into public.card_installments(
          user_id,purchase_id,card_id,invoice_id,installment_number,installment_count,amount,due_month,status
        ) values(
          v_pending.user_id,v_purchase_id,v_card.id,v_invoice_id,v_n,v_installments,v_part,v_ref,'OPEN'
        );
        update public.card_invoices
           set total_amount=total_amount+v_part,updated_at=now()
         where id=v_invoice_id and user_id=v_pending.user_id;
        v_invoice_id := null;
      end loop;

      v_id := v_purchase_id;
      v_message := format('✅ Compra registrada no cartão em %s parcela(s).',v_installments);
    else
      raise exception 'Ação do agente não suportada';
    end if;
  else
    raise exception 'Tipo de confirmação não suportado';
  end if;

  update public.agent_pending_actions
     set status='CONFIRMED',confirmed_at=now(),executed_at=now(),updated_at=now(),
         result=jsonb_build_object('ok',true,'message',v_message,'id',v_id,'ids',to_jsonb(v_ids)),
         last_error=null
   where id=v_pending.id;

  return jsonb_build_object('ok',true,'message',v_message,'id',v_id,'ids',to_jsonb(v_ids));
end;
$$;

revoke all on function public.equity_whatsapp_execute_pending_action(uuid) from public,anon,authenticated;
grant execute on function public.equity_whatsapp_execute_pending_action(uuid) to service_role;

-- Logs técnicos são somente do backend/service role.
alter table public.whatsapp_webhook_events enable row level security;
revoke all on table public.whatsapp_webhook_events from anon,authenticated;
grant all on table public.whatsapp_webhook_events to service_role;

grant all on table public.agent_pending_actions to service_role;
