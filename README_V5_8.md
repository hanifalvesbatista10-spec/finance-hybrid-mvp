# Equity One Pro V5.8 — Rebranding + Equity One Médicos

## Atualização visual
- marca geral alterada de Finance Hybrid para Equity One;
- nova paleta premium preto/grafite/dourado;
- dashboard Pessoal/Negócios redesenhado;
- landing page transformada em ecossistema de produtos.

## Novo produto: Equity One Médicos
Rotas:
- `/medicos`
- `/medicos/dashboard`
- `/medicos/plantoes`
- `/medicos/vinculos`
- `/medicos/particular`
- `/medicos/receber`
- `/medicos/financeiro`
- `/medicos/investimentos`
- `/medicos/carreira`
- `/medicos/relatorios`

## Funcional na V5.8
- dashboard médico executivo;
- modo demonstração quando ainda não há dados;
- CRUD real de vínculos profissionais;
- CRUD real de plantões;
- arquitetura e rotas dos demais núcleos;
- controle de acesso ao produto pelo Super Admin;
- tabelas independentes e RLS por usuário.

## SQL obrigatório
Execute `supabase_schema_v5_8.sql` depois das migrações anteriores.

## Regra
Equity One é a marca guarda-chuva. Pessoal, Negócios e Médicos são experiências independentes no mesmo ecossistema.
