# Finance Hybrid Pro V5.2

## Gestão de checkout pelo Super Admin

Execute `supabase_schema_v5_2.sql`.

Depois, no painel `/admin`, use a seção **Checkouts comerciais** para:

- editar o link Personal;
- editar o link Business;
- testar cada link;
- pausar ou reativar cada venda;
- salvar sem alterar GitHub e sem redeploy.

A landing page consulta essas configurações no banco ao abrir.

Links iniciais configurados:

- Personal: InfinitePay `ZuBAmrcZfy`
- Business: InfinitePay `JhBKukTIXw`

O histórico é registrado em `audit_logs`.
