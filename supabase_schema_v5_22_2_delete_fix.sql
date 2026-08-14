-- Equity One V5.22 Parte 2 — correção da exclusão individual e recálculo de saldo
-- Executar junto com supabase_schema_v5_22_2.sql

create or replace function public.equity_delete_financial_record(
  p_kind text,
  p_record_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_tx public.transactions%rowtype;
  v_entry public.financial_account_entries%rowtype;
  v_purchase public.card_purchases%rowtype;
  v_invoice_id uuid;
  v_account_id uuid;
  v_transfer_id uuid;
  v_from_account uuid;
  v_to_account uuid;
  v_invoice_ids uuid[];
  v_account uuid;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;

  if p_kind='TRANSACTION' then
    select * into v_tx from public.transactions where id=p_record_id and user_id=v_user for update;
    if not found then raise exception 'Lançamento não encontrado'; end if;

    delete from public.financial_account_entries
     where user_id=v_user and metadata->>'transaction_id'=v_tx.id::text;
    delete from public.transactions where id=v_tx.id and user_id=v_user;

    if v_tx.account_id is not null then
      update public.financial_accounts a
         set current_balance = case
           when exists(select 1 from public.financial_account_entries oe where oe.account_id=a.id and oe.entry_type='OPENING')
             then coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
           else a.opening_balance + coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0)
         end,
         updated_at=now()
       where a.id=v_tx.account_id and a.user_id=v_user;
    end if;
    return jsonb_build_object('ok',true,'kind','TRANSACTION','id',p_record_id);
  end if;

  if p_kind='ACCOUNT_ENTRY' then
    select * into v_entry from public.financial_account_entries where id=p_record_id and user_id=v_user for update;
    if not found then raise exception 'Movimentação não encontrada'; end if;

    v_account_id:=v_entry.account_id;
    v_invoice_id:=nullif(v_entry.metadata->>'invoice_id','')::uuid;
    v_transfer_id:=nullif(v_entry.metadata->>'transfer_id','')::uuid;

    if v_entry.entry_type='OPENING' then
      raise exception 'O saldo inicial deve ser alterado pela edição da conta, não excluído como movimentação';
    end if;

    if v_transfer_id is not null then
      select from_account_id,to_account_id into v_from_account,v_to_account
        from public.account_transfers where id=v_transfer_id and user_id=v_user;
      delete from public.financial_account_entries where user_id=v_user and metadata->>'transfer_id'=v_transfer_id::text;
      delete from public.account_transfers where id=v_transfer_id and user_id=v_user;
    else
      delete from public.financial_account_entries where id=v_entry.id and user_id=v_user;
    end if;

    if v_invoice_id is not null and v_entry.entry_type='CARD_INVOICE_PAYMENT' then
      update public.card_invoices set status='OPEN',paid_amount=0,paid_at=null,updated_at=now()
       where id=v_invoice_id and user_id=v_user;
      update public.card_installments set status='OPEN' where invoice_id=v_invoice_id and user_id=v_user;
    end if;

    for v_account in
      select distinct u.account_id from unnest(array[v_account_id,v_from_account,v_to_account]::uuid[]) as u(account_id)
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

    return jsonb_build_object('ok',true,'kind','ACCOUNT_ENTRY','id',p_record_id);
  end if;

  if p_kind='CARD_PURCHASE' then
    select * into v_purchase from public.card_purchases where id=p_record_id and user_id=v_user for update;
    if not found then raise exception 'Compra não encontrada'; end if;

    select array_agg(distinct invoice_id) into v_invoice_ids
      from public.card_installments where purchase_id=v_purchase.id and user_id=v_user and invoice_id is not null;
    delete from public.card_installments where purchase_id=v_purchase.id and user_id=v_user;
    delete from public.card_purchases where id=v_purchase.id and user_id=v_user;

    if v_invoice_ids is not null then
      update public.card_invoices i
         set total_amount=coalesce((select sum(ci.amount) from public.card_installments ci where ci.invoice_id=i.id),0),updated_at=now()
       where i.user_id=v_user and i.id=any(v_invoice_ids);
      delete from public.card_invoices i
       where i.user_id=v_user and i.id=any(v_invoice_ids) and i.total_amount=0 and i.paid_amount=0;
    end if;
    return jsonb_build_object('ok',true,'kind','CARD_PURCHASE','id',p_record_id);
  end if;

  raise exception 'Tipo de registro não suportado';
end;
$$;

revoke all on function public.equity_delete_financial_record(text,uuid) from public,anon;
grant execute on function public.equity_delete_financial_record(text,uuid) to authenticated;
