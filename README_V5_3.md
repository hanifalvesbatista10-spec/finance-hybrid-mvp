# Finance Hybrid Pro V5.3

Correção do build no Next.js 15:

- `/adesao` deixou de usar `useSearchParams()` no cliente.
- `/login` foi dividido em Server Component + `LoginClient`.
- Os parâmetros `plano`, `mode` e `plan` são processados no servidor.
- Não há alteração de SQL nesta versão.
