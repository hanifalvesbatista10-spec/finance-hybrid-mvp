# Finance Hybrid MVP

MVP em Next.js App Router + TypeScript + Tailwind + Supabase.

## 1. Instalação

```bash
npm install
```

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Use somente a chave pública/anon no navegador. Nunca exponha a `service_role`.

## 3. Banco de dados

No Supabase:

1. Abra **SQL Editor**.
2. Cole e execute `supabase_schema.sql`.
3. Em **Authentication > URL Configuration**, configure a URL local e a URL da Vercel.
4. Em **Authentication > Providers > Email**, defina se a confirmação por e-mail será obrigatória.

O trigger cria automaticamente `public.profiles` ao cadastrar um usuário.

## 4. Executar

```bash
npm run dev
```

Abra `http://localhost:3000/login`.

## 5. Testar os perfis

Na tela de cadastro, selecione:

- Pessoal → `PERSONAL`
- Empresa → `INSTITUTIONAL`

A sidebar e o dashboard mudarão de acordo com `profiles.role`.

## Estrutura principal

```text
app/
  dashboard/
    layout.tsx
    page.tsx
  login/
    page.tsx
  globals.css
  layout.tsx
  providers.tsx
components/
  ui/
  InstitutionalDashboard.tsx
  PersonalDashboard.tsx
context/
  AuthContext.tsx
lib/
  utils.ts
supabase_schema.sql
```

## Observação arquitetural

Este MVP usa `@supabase/supabase-js` no cliente conforme solicitado. Para uma
evolução com autenticação SSR protegendo rotas antes da renderização, adote
`@supabase/ssr`, cookies e Proxy/Middleware. A RLS continua sendo a barreira
obrigatória de segurança no banco.
