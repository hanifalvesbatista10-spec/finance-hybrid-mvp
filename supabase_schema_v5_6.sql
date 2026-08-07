begin;

do $$ begin
  create type public.subscription_order_status as enum (
    'PENDING',
    'CHECKOUT_CREATED',
    'PAID',
    'ACTIVATED',
    'FAILED',
    'CANCELED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.subscription_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_nsu text not null unique,
  plan public.subscription_plan not null,
  amount integer not null check (amount > 0),
  description text not null,
  status public.subscription_order_status not null default 'PENDING',
  checkout_url text,
  invoice_slug text,
  transaction_nsu text unique,
  receipt_url text,
  capture_method text,
  paid_amount integer,
  paid_at timestamptz,
  activated_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_orders_user_created_idx
  on public.subscription_orders(user_id, created_at desc);

alter table public.subscription_orders enable row level security;

drop policy if exists subscription_orders_read_own
on public.subscription_orders;

create policy subscription_orders_read_own
on public.subscription_orders
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.is_super_admin()
);

grant select on public.subscription_orders to authenticated;

create or replace function public.set_subscription_order_updated_at()
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

drop trigger if exists subscription_orders_set_updated_at
on public.subscription_orders;

create trigger subscription_orders_set_updated_at
before update on public.subscription_orders
for each row
execute function public.set_subscription_order_updated_at();

create or replace function public.activate_subscription_order(
  p_order_nsu text,
  p_transaction_nsu text,
  p_invoice_slug text,
  p_receipt_url text,
  p_paid_amount integer,
  p_capture_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.subscription_orders;
  v_subscription public.subscriptions;
  v_now timestamptz := now();
  v_base timestamptz;
  v_new_end timestamptz;
begin
  select *
  into v_order
  from public.subscription_orders
  where order_nsu = p_order_nsu
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status = 'ACTIVATED' then
    return jsonb_build_object(
      'success', true,
      'already_activated', true,
      'period_end', (
        select current_period_end
        from public.subscriptions
        where user_id = v_order.user_id
      )
    );
  end if;

  if p_paid_amount < v_order.amount then
    raise exception 'Valor pago inferior ao valor do pedido';
  end if;

  if exists (
    select 1
    from public.subscription_orders
    where transaction_nsu = p_transaction_nsu
      and order_nsu <> p_order_nsu
  ) then
    raise exception 'Transação já utilizada em outro pedido';
  end if;

  select *
  into v_subscription
  from public.subscriptions
  where user_id = v_order.user_id
  for update;

  if found
     and v_subscription.status = 'ACTIVE'
     and v_subscription.current_period_end is not null
     and v_subscription.current_period_end > v_now then
    v_base := v_subscription.current_period_end;
  else
    v_base := v_now;
  end if;

  v_new_end := v_base + interval '30 days';

  insert into public.subscriptions (
    user_id,
    plan,
    status,
    starts_at,
    current_period_start,
    current_period_end,
    access_mode,
    payment_provider,
    provider_subscription_id,
    last_payment_at,
    next_payment_at,
    notes
  )
  values (
    v_order.user_id,
    v_order.plan,
    'ACTIVE',
    v_now,
    v_now,
    v_new_end,
    'PROVIDER',
    'INFINITEPAY',
    p_transaction_nsu,
    v_now,
    v_new_end,
    'Ativação automática pelo Checkout Integrado InfinitePay'
  )
  on conflict (user_id) do update
  set
    plan = excluded.plan,
    status = 'ACTIVE',
    current_period_start = v_now,
    current_period_end = v_new_end,
    access_mode = 'PROVIDER',
    payment_provider = 'INFINITEPAY',
    provider_subscription_id = p_transaction_nsu,
    last_payment_at = v_now,
    next_payment_at = v_new_end,
    canceled_at = null,
    notes = 'Renovação automática pelo Checkout Integrado InfinitePay';

  update public.profiles
  set
    role = case
      when v_order.plan = 'BUSINESS'
        then 'INSTITUTIONAL'::public.profile_role
      else 'PERSONAL'::public.profile_role
    end,
    status = 'ACTIVE'
  where id = v_order.user_id;

  update public.subscription_orders
  set
    status = 'ACTIVATED',
    invoice_slug = p_invoice_slug,
    transaction_nsu = p_transaction_nsu,
    receipt_url = p_receipt_url,
    capture_method = p_capture_method,
    paid_amount = p_paid_amount,
    paid_at = coalesce(paid_at, v_now),
    activated_at = v_now,
    failure_reason = null
  where id = v_order.id;

  return jsonb_build_object(
    'success', true,
    'already_activated', false,
    'user_id', v_order.user_id,
    'plan', v_order.plan,
    'period_end', v_new_end
  );
end;
$$;

revoke all on function public.activate_subscription_order(
  text, text, text, text, integer, text
) from public, anon, authenticated;

grant execute on function public.activate_subscription_order(
  text, text, text, text, integer, text
) to service_role;

commit;
