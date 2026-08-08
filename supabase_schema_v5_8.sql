begin;
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null references public.products(code) on delete cascade,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  unique(user_id,product_code)
);
insert into public.products(code,name,description) values
 ('PERSONAL','Equity One Pessoal','Gestão financeira pessoal'),
 ('BUSINESS','Equity One Negócios','Gestão financeira empresarial'),
 ('MEDICAL','Equity One Médicos','Gestão financeira, plantões, patrimônio e carreira médica')
on conflict(code) do update set name=excluded.name,description=excluded.description;

create table if not exists public.medical_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 specialty text,
 state text,
 has_private_practice boolean not null default false,
 does_shifts boolean not null default true,
 has_company boolean not null default false,
 track_personal_finance boolean not null default true,
 track_investments boolean not null default true,
 main_goal text,
 updated_at timestamptz not null default now()
);
create table if not exists public.professional_links (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,link_type text not null,nature text not null,status text not null default 'ACTIVE',
 average_value numeric(14,2),shift_value numeric(14,2),hourly_value numeric(14,2),weekly_hours numeric(8,2),
 payment_method text,payment_frequency text,expected_payment_day integer,document text,discounts numeric(14,2) default 0,taxes numeric(14,2) default 0,notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.medical_shifts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 professional_link_id uuid references public.professional_links(id) on delete set null,hospital text not null,shift_date date not null,
 start_time time not null,end_time time not null,hours numeric(8,2) not null default 0,base_value numeric(14,2) not null default 0,additional_value numeric(14,2) not null default 0,total_value numeric(14,2) not null default 0,
 payment_method text,expected_payment_date date,notes text,status text not null default 'SCHEDULED',created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.medical_receivables (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,source_type text not null default 'SHIFT',source_id uuid,service_date date not null,source_name text not null,description text,amount numeric(14,2) not null,expected_payment_date date,status text not null default 'PENDING',received_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.medical_private_services (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,service_date date not null,service_type text not null,gross_value numeric(14,2) not null,discount numeric(14,2) not null default 0,fee numeric(14,2) not null default 0,net_value numeric(14,2) not null,payment_method text,status text not null default 'RECEIVED',patient_reference text,notes text,created_at timestamptz not null default now()
);
create table if not exists public.medical_career_goals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,goal_type text not null,current_value numeric(14,2),target_value numeric(14,2),deadline date,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

alter table public.user_products enable row level security; alter table public.medical_profiles enable row level security; alter table public.professional_links enable row level security; alter table public.medical_shifts enable row level security; alter table public.medical_receivables enable row level security; alter table public.medical_private_services enable row level security; alter table public.medical_career_goals enable row level security;

do $$ declare t text; begin foreach t in array array['user_products','medical_profiles','professional_links','medical_shifts','medical_receivables','medical_private_services','medical_career_goals'] loop execute format('drop policy if exists %I_own_all on public.%I',t,t); execute format('create policy %I_own_all on public.%I for all to authenticated using ((select auth.uid()) = user_id or public.is_super_admin()) with check ((select auth.uid()) = user_id or public.is_super_admin())',t,t); end loop; end $$;
grant select,insert,update,delete on public.user_products,public.medical_profiles,public.professional_links,public.medical_shifts,public.medical_receivables,public.medical_private_services,public.medical_career_goals to authenticated;
grant select on public.products to authenticated,anon;
insert into public.user_products(user_id,product_code,status)
select id,'MEDICAL','ACTIVE' from public.profiles where system_role='SUPER_ADMIN'
on conflict(user_id,product_code) do nothing;
commit;
