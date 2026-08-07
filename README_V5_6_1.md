# Finance Hybrid Pro V5.6.1

Correção do erro ao clicar em comprar/renovar.

## Alterações

- tratamento de respostas não JSON;
- `try/catch` no botão de checkout;
- mensagens de erro exibidas dentro da página;
- remoção do objeto `customer` do payload enviado à InfinitePay;
- payload limitado aos campos confirmados:
  - handle
  - items
  - order_nsu
  - redirect_url
  - webhook_url
- registro do motivo da falha em `subscription_orders.failure_reason`;
- proteção adicional na página de retorno.

## Banco

Não há SQL novo nesta versão.

O `supabase_schema_v5_6.sql` precisa ter sido executado anteriormente.
