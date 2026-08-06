begin;

alter table public.platform_settings
  add column if not exists personal_checkout_url text,
  add column if not exists business_checkout_url text,
  add column if not exists personal_checkout_enabled boolean not null default true,
  add column if not exists business_checkout_enabled boolean not null default true;

update public.platform_settings
set
  personal_checkout_url = coalesce(
    personal_checkout_url,
    'https://invoice.infinitepay.io/plans/aphhardcore/ZuBAmrcZfy'
  ),
  business_checkout_url = coalesce(
    business_checkout_url,
    'https://invoice.infinitepay.io/plans/aphhardcore/JhBKukTIXw'
  )
where id = 1;

commit;
