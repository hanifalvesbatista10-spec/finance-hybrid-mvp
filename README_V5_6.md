# Finance Hybrid Pro V5.6 — InfinitePay automática

## Antes do deploy

1. Execute `supabase_schema_v5_6.sql` no SQL Editor do Supabase.
2. Envie os arquivos para o GitHub.
3. Aguarde o deploy da Vercel.

Não é necessário adicionar token ou senha da InfinitePay.

## Valores configurados

- Personal: R$ 19,90 (`1990`)
- Business: R$ 59,90 (`5990`)
- InfiniteTag: `aphhardcore`
- Período liberado por pagamento: 30 dias

## Fluxo

1. Cliente cria ou acessa sua conta.
2. O dashboard bloqueado direciona para `/assinatura`.
3. O botão chama `/api/payments/infinitepay/checkout`.
4. O servidor cria um `order_nsu` único e salva o pedido.
5. A InfinitePay devolve um checkout individual.
6. Após o pagamento:
   - o webhook chama `/api/webhooks/infinitepay`;
   - a página de retorno chama `/api/payments/infinitepay/confirm`;
   - o servidor consulta `payment_check`;
   - somente `paid: true` libera o acesso.
7. A assinatura recebe mais 30 dias.
8. O mesmo pagamento não pode ser usado duas vezes.

## Segurança

- O preço e o plano são definidos no servidor.
- O usuário não envia o valor.
- O webhook não é aceito como prova isolada.
- Toda liberação é validada no endpoint `payment_check`.
- A ativação é idempotente e atômica no banco.
