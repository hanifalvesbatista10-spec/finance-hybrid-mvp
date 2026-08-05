# Finance Hybrid Pro V2

## Mudanças principais

- Dashboard começa zerado.
- Valores vêm exclusivamente da tabela `transactions`.
- Cadastro e exclusão de receitas/despesas.
- Metas com progresso real.
- Cartões com limite e fatura.
- Centros de custo.
- Membros e permissões.
- Todas as rotas da sidebar existem.
- RLS em todas as tabelas.

## Atualização obrigatória no Supabase

Execute `supabase_schema_v2.sql` no SQL Editor.

## GitHub

Substitua os arquivos antigos pelos arquivos desta versão. Depois aguarde o novo deploy da Vercel.

## Rotas

- `/dashboard`
- `/dashboard/lancamentos`
- `/dashboard/metas`
- `/dashboard/cartoes`
- `/dashboard/centros-de-custo`
- `/dashboard/permissoes`
