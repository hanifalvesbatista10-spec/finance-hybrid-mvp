# Finance Hybrid Pro V5.6.2

Correção da exceção:

`cannot add postgres_changes call after realtime subscription has already been subscribe()`

## Causa

O layout renderizava dois componentes `AlertCenter`, um para mobile e outro para desktop.
Ambos utilizavam o mesmo nome de canal Supabase Realtime.

## Correções

- cada instância usa um canal Realtime exclusivo;
- o listener é configurado antes de `subscribe()`;
- o canal é removido ao desmontar;
- falhas nas tabelas `obligations` e `reminder_preferences` não derrubam o dashboard;
- nenhuma alteração de SQL foi adicionada nesta correção.

## Importante

Para usar Contas e Alertas, execute também `supabase_schema_v5_4.sql`.
Sem essa migração, os alertas ficam vazios, mas o restante do sistema continua funcionando.
