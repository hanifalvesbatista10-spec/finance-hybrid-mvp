# Finance Hybrid Pro V4

## Novidades

- Receitas mensais fixas / receita base.
- Despesas fixas mensais.
- Ativação e pausa de recorrências.
- Geração de lançamentos mensais sem duplicidade.
- Central de relatórios.
- Comparação com o mês anterior.
- Parecer automático.
- Exportação CSV.
- Botão para gerar relatório pronto para PDF/impressão.
- Pacote sem `.env.local` e sem chaves.

## Atualização do Supabase

Execute `supabase_schema_v4.sql` no SQL Editor.

## Novas rotas

- `/dashboard/recorrencias`
- `/dashboard/relatorios`

## Uso dos valores fixos

1. Cadastre os valores em **Fixos mensais**.
2. Escolha o mês.
3. Clique em **Gerar mês**.
4. Os lançamentos passam a aparecer no calendário, dashboard e relatório.
5. O banco impede duplicidade para a mesma recorrência e competência.

## Relatórios

Em **Relatórios**, selecione um mês e use:

- `Gerar relatório`: abre um documento A4 e a janela de impressão. Escolha
  **Salvar como PDF** no navegador.
- `Exportar CSV`: baixa os lançamentos para Excel ou outra planilha.
