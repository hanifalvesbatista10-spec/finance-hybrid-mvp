-- Equity One V5.18 — Central de Segurança Financeira
create table if not exists public.financial_reset_snapshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 scope text not null,
 period_start date,
 period_end date,
 payload jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.financial_reset_snapshots enable row level security;
revoke all on public.financial_reset_snapshots from anon, authenticated;
grant select on public.financial_reset_snapshots to service_role;

create table if not exists public.financial_reset_audit (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 scope text not null,
 period_start date,
 period_end date,
 snapshot_id uuid references public.financial_reset_snapshots(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.financial_reset_audit enable row level security;
revoke all on public.financial_reset_audit from anon, authenticated;
grant select on public.financial_reset_audit to service_role;

create or replace function public.equity_reset_financial_data(
 p_user_id uuid,
 p_scope text,
 p_start date,
 p_end date
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 v_snapshot uuid;
 v_payload jsonb;
 v_start date := p_start;
 v_end date := p_end;
 v_deleted_transactions int := 0;
 v_deleted_entries int := 0;
begin
 if p_scope not in ('DAY','MONTH','HALF_YEAR','YEAR','RANGE','ALL') then
   raise exception 'Escopo de reset inválido';
 end if;
 if p_scope <> 'ALL' and (v_start is null or v_end is null or v_start > v_end) then
   raise exception 'Período inválido';
 end if;

 select jsonb_build_object(
  'transactions',coalesce((select jsonb_agg(to_jsonb(t)) from public.transactions t where t.user_id=p_user_id and (p_scope='ALL' or t.occurred_on between v_start and v_end)),'[]'::jsonb),
  'account_entries',coalesce((select jsonb_agg(to_jsonb(e)) from public.financial_account_entries e where e.user_id=p_user_id and (p_scope='ALL' or e.occurred_on between v_start and v_end)),'[]'::jsonb),
  'transfers',coalesce((select jsonb_agg(to_jsonb(x)) from public.account_transfers x where x.user_id=p_user_id and (p_scope='ALL' or x.occurred_on between v_start and v_end)),'[]'::jsonb),
  'purchases',coalesce((select jsonb_agg(to_jsonb(p)) from public.card_purchases p where p.user_id=p_user_id and (p_scope='ALL' or p.purchase_date between v_start and v_end)),'[]'::jsonb),
  'installments',coalesce((select jsonb_agg(to_jsonb(i)) from public.card_installments i where i.user_id=p_user_id and (p_scope='ALL' or i.due_month between date_trunc('month',v_start)::date and date_trunc('month',v_end)::date)),'[]'::jsonb),
  'invoices',coalesce((select jsonb_agg(to_jsonb(i)) from public.card_invoices i where i.user_id=p_user_id and (p_scope='ALL' or i.reference_month between date_trunc('month',v_start)::date and date_trunc('month',v_end)::date)),'[]'::jsonb)
 ) into v_payload;

 insert into public.financial_reset_snapshots(user_id,scope,period_start,period_end,payload)
 values(p_user_id,p_scope,v_start,v_end,v_payload) returning id into v_snapshot;

 delete from public.card_installments where user_id=p_user_id and (p_scope='ALL' or due_month between date_trunc('month',v_start)::date and date_trunc('month',v_end)::date);
 delete from public.card_purchases where user_id=p_user_id and (p_scope='ALL' or purchase_date between v_start and v_end);
 delete from public.card_invoices where user_id=p_user_id and (p_scope='ALL' or reference_month between date_trunc('month',v_start)::date and date_trunc('month',v_end)::date);
 delete from public.account_transfers where user_id=p_user_id and (p_scope='ALL' or occurred_on between v_start and v_end);
 delete from public.financial_account_entries where user_id=p_user_id and (p_scope='ALL' or occurred_on between v_start and v_end);
 get diagnostics v_deleted_entries = row_count;
 delete from public.transactions where user_id=p_user_id and (p_scope='ALL' or occurred_on between v_start and v_end);
 get diagnostics v_deleted_transactions = row_count;

 update public.financial_accounts a set current_balance=a.opening_balance + coalesce((select sum(e.amount) from public.financial_account_entries e where e.account_id=a.id),0),updated_at=now() where a.user_id=p_user_id;

 update public.card_invoices i set total_amount=coalesce((select sum(ci.amount) from public.card_installments ci where ci.invoice_id=i.id),0),updated_at=now() where i.user_id=p_user_id;
 delete from public.card_invoices where user_id=p_user_id and total_amount=0 and paid_amount=0;

 insert into public.financial_reset_audit(user_id,scope,period_start,period_end,snapshot_id) values(p_user_id,p_scope,v_start,v_end,v_snapshot);
 return jsonb_build_object('ok',true,'snapshot_id',v_snapshot,'transactions',v_deleted_transactions,'entries',v_deleted_entries);
end;
$$;
revoke all on function public.equity_reset_financial_data(uuid,text,date,date) from public, anon, authenticated;
grant execute on function public.equity_reset_financial_data(uuid,text,date,date) to service_role;
