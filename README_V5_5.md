# Finance Hybrid Pro V5.5 — Assinaturas

## Atualização obrigatória

Execute `supabase_schema_v5_5.sql` no SQL Editor do Supabase.

## Regras

- Usuários existentes recebem 30 dias na migração.
- Novos cadastros públicos ficam com assinatura `PENDING`.
- Usuários criados pelo Super Admin recebem a quantidade de dias definida.
- Super Admin possui acesso permanente.
- Assinatura vencida redireciona para `/assinatura`.
- Os dados financeiros permanecem salvos.
- O Super Admin pode:
  - conceder +30 dias;
  - conceder +90 dias;
  - definir uma data específica;
  - suspender assinatura;
  - reativar;
  - bloquear o login;
  - desbloquear o login.

## Automação futura

A tabela já possui campos para:

- `payment_provider`
- `provider_customer_id`
- `provider_subscription_id`
- `last_payment_at`
- `next_payment_at`

Eles serão usados quando a confirmação automática da InfinitePay estiver
integrada por API ou webhook.
