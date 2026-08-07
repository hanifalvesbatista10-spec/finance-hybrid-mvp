# Finance Hybrid Pro V5.4

## Contas e alertas

Execute `supabase_schema_v5_4.sql`.

Nova rota:

- `/dashboard/contas`

Recursos:

- contas a pagar;
- contas a receber;
- vencimento;
- alertas no dia, 1, 3, 7, 15 ou 30 dias antes;
- combinação de vários prazos;
- preferência padrão por usuário;
- alerta persistente de contas vencidas;
- sino com badge no dashboard;
- banner de atenção na visão geral;
- baixa da conta;
- lançamento automático da receita ou despesa ao concluir.

Os alertas desta versão são exibidos dentro da plataforma quando o usuário
entra ou navega no dashboard. Notificações por e-mail, WhatsApp ou push exigem
um serviço externo e agendamento no servidor.
