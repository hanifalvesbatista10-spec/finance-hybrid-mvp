export type CategoryGroup = {
  group: string;
  items: string[];
};

export const PERSONAL_EXPENSE_CATEGORIES: CategoryGroup[] = [
  { group: "Moradia", items: ["Aluguel", "Financiamento imobiliário", "Condomínio", "IPTU", "Energia elétrica", "Água", "Gás", "Internet", "Telefone / celular", "Manutenção da casa", "Móveis e eletrodomésticos", "Limpeza / diarista", "Segurança residencial"] },
  { group: "Alimentação", items: ["Supermercado", "Feira / hortifruti", "Padaria", "Açougue", "Restaurante", "Delivery", "Lanches / café", "Água / bebidas"] },
  { group: "Transporte", items: ["Combustível", "Transporte público", "Aplicativo / táxi", "Estacionamento", "Pedágio", "Financiamento de veículo", "Seguro do veículo", "IPVA / licenciamento", "Manutenção / revisão", "Pneus / peças", "Lavagem do veículo"] },
  { group: "Saúde", items: ["Plano de saúde", "Consulta médica", "Exames", "Medicamentos / farmácia", "Odontologia", "Terapia / psicologia", "Fisioterapia", "Academia / atividade física", "Óculos / lentes"] },
  { group: "Educação", items: ["Escola / faculdade", "Creche", "Cursos", "Livros", "Material escolar", "Idiomas", "Certificações / provas", "Aulas particulares"] },
  { group: "Família", items: ["Filhos", "Pensão", "Babá / cuidador", "Mesada", "Cuidados com idosos", "Atividades infantis"] },
  { group: "Pets", items: ["Ração", "Veterinário", "Medicamentos pet", "Banho / tosa", "Acessórios pet", "Hospedagem / creche pet"] },
  { group: "Pessoal", items: ["Roupas", "Calçados", "Higiene pessoal", "Cabeleireiro / barbearia", "Cosméticos / beleza", "Acessórios"] },
  { group: "Lazer e estilo de vida", items: ["Streaming", "Cinema", "Shows / eventos", "Bares", "Jogos", "Hobbies", "Viagem", "Passagens", "Hospedagem", "Passeios", "Festas / comemorações"] },
  { group: "Financeiro", items: ["Fatura do cartão", "Empréstimo", "Financiamento", "Juros", "Tarifas bancárias", "Impostos / taxas", "Seguros", "Consórcio"] },
  { group: "Assinaturas e serviços", items: ["Aplicativos", "Software", "Clube / associação", "Jornal / revista", "Armazenamento em nuvem", "Outras assinaturas"] },
  { group: "Compras", items: ["Eletrônicos", "Casa / utilidades", "Presentes", "Compras online", "Outras compras"] },
  { group: "Doações e apoio", items: ["Doações", "Igreja / contribuição", "Ajuda familiar"] },
  { group: "Poupança e patrimônio", items: ["Reserva de emergência", "Aporte em investimento", "Compra de ativo", "Previdência"] },
  { group: "Outros", items: ["Despesa inesperada", "Reembolso a terceiros", "Outros"] },
];

export const PERSONAL_INCOME_CATEGORIES: CategoryGroup[] = [
  { group: "Trabalho", items: ["Salário", "Pró-labore", "Freelance / bico", "Comissão", "Bônus", "Hora extra", "13º salário", "Férias"] },
  { group: "Rendas", items: ["Aluguel recebido", "Pensão recebida", "Benefício", "Aposentadoria", "Dividendos", "Juros / rendimento", "Cashback"] },
  { group: "Entradas eventuais", items: ["Reembolso", "Restituição", "Venda de bem", "Presente recebido", "Indenização", "Outros"] },
];

export const BUSINESS_EXPENSE_CATEGORIES: CategoryGroup[] = [
  { group: "Pessoas", items: ["Salários", "Pró-labore", "Encargos trabalhistas", "Benefícios", "Comissões", "Freelancers / terceiros", "Treinamentos"] },
  { group: "Operação", items: ["Fornecedores", "Estoque / mercadoria", "Matéria-prima", "Embalagens", "Frete / logística", "Combustível", "Manutenção de veículos", "Equipamentos", "Manutenção de equipamentos"] },
  { group: "Estrutura", items: ["Aluguel comercial", "Condomínio", "Energia elétrica", "Água", "Internet", "Telefone", "Limpeza", "Segurança", "Material de escritório"] },
  { group: "Administrativo", items: ["Contabilidade", "Jurídico", "Consultoria", "Software / SaaS", "Licenças / alvarás", "Associações", "Correios / cartório"] },
  { group: "Vendas e marketing", items: ["Tráfego pago", "Publicidade", "Design / conteúdo", "Eventos", "Brindes", "Comissão de vendas", "CRM / ferramentas de vendas"] },
  { group: "Financeiro e fiscal", items: ["Impostos", "Taxas", "Tarifas bancárias", "Taxa de maquininha", "Juros", "Empréstimos", "Seguros", "Antecipação de recebíveis"] },
  { group: "Viagens", items: ["Passagens", "Hospedagem", "Alimentação em viagem", "Transporte em viagem", "Diárias"] },
  { group: "Outros", items: ["Reembolso", "Perdas / avarias", "Despesa extraordinária", "Outros"] },
];

export const BUSINESS_INCOME_CATEGORIES: CategoryGroup[] = [
  { group: "Receitas operacionais", items: ["Venda de produtos", "Prestação de serviços", "Mensalidades", "Assinaturas", "Comissões recebidas", "Royalties"] },
  { group: "Outras entradas", items: ["Receita financeira", "Aporte de sócios", "Empréstimo recebido", "Reembolso", "Venda de ativo", "Outros"] },
];

export function categoryGroups(institutional: boolean, type: "INCOME" | "EXPENSE") {
  if (institutional) return type === "INCOME" ? BUSINESS_INCOME_CATEGORIES : BUSINESS_EXPENSE_CATEGORIES;
  return type === "INCOME" ? PERSONAL_INCOME_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES;
}
