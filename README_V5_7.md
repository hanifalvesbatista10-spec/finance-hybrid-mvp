# Finance Hybrid Pro V5.7 — Compra antes do cadastro

## Novo fluxo

Landing → checkout InfinitePay → confirmação → cadastro pago → 30 dias liberados.

## Valores
- Personal: R$ 19,90
- Business: R$ 59,90

## Atualização obrigatória
Execute `supabase_schema_v5_7.sql` antes do deploy.

## Renovação
Clientes existentes continuam renovando em `/assinatura`; cada pagamento válido acrescenta 30 dias.

## Segurança
- plano e preço definidos no servidor;
- `order_nsu` único;
- confirmação por `payment_check`;
- cadastro liberado por token assinado com validade de 1 hora;
- compra só pode ser usada uma vez.
