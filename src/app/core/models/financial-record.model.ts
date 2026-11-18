/**
 * Condicao de pagamento escolhida na matricula (requisito 6).
 *
 *   'avista'    -> uma unica parcela com o valor integral do curso.
 *   'parcelado' -> duas ou mais parcelas; a quantidade respeita o teto do
 *                  curso (Course.maxInstallments).
 */
export type PaymentCondition = 'avista' | 'parcelado';

/**
 * Metodo de pagamento INFORMADO pelo aluno (requisito 6.3).
 *
 * E uma declaracao de intencao, nao uma cobranca: o sistema nao tem gateway,
 * nao conversa com banco e NAO marca nada como pago por causa desta escolha.
 * Quem confirma recebimento e o administrador, na mao - e e exatamente o que o
 * requisito 6.5 pede ("Nao marcar pagamentos como pagos automaticamente apenas
 * porque o aluno selecionou PIX, dinheiro ou cartao").
 */
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao';

/**
 * Situacao do LANCAMENTO financeiro (requisito 6.4).
 *
 *   'pendente'          -> nenhuma parcela paga.
 *   'parcialmente_pago' -> algumas parcelas pagas, outras nao.
 *   'pago'              -> todas as parcelas quitadas (saldo zero).
 *   'vencido'           -> nada pago e ha parcela vencida.
 *
 * O valor e GRAVADO (e nao calculado na tela) porque e ele que o painel do
 * administrador conta, e contar um campo gravado e uma consulta so. Quem
 * recalcula e o FinanceiroService, sempre que uma parcela muda - a regra fica
 * em um lugar, e nao em cada tela que mostra o status.
 *
 * O underscore em 'parcialmente_pago' existe porque o valor viaja na URL das
 * consultas do JSON Server (?status=parcialmente_pago).
 */
export type FinancialStatus = 'pendente' | 'parcialmente_pago' | 'pago' | 'vencido';

/**
 * MODEL - formato exato de um registro da colecao /financialRecords da API.
 *
 * O QUE E UM LANCAMENTO, E POR QUE ELE NAO E A PARCELA
 * ----------------------------------------------------
 * O lancamento e o COMPROMISSO: "esta matricula custa R$ 1.200, combinados em
 * 3 vezes, por PIX". A parcela e cada PEDACO desse compromisso, com seu
 * vencimento e seu valor.
 *
 * Separar os dois e o que permite responder perguntas que uma lista de parcelas
 * solta nao responde: quanto este aluno deve no total, qual era a combinacao
 * feita na matricula, quanto ja foi pago e quanto falta. E e tambem o que
 * garante a regra 11: mudar o preco do curso depois NAO mexe no lancamento ja
 * criado, porque o valor combinado ficou gravado aqui.
 *
 * RELACIONAMENTO:
 *  - enrollmentId -> Enrollment.id (uma matricula tem um lancamento)
 *
 * `totalAmount` = valor combinado na matricula, em reais. E uma COPIA do preco
 *                 do curso no momento da matricula, de proposito (regra 11).
 * `createdAt`   = data do lancamento (string ISO 'aaaa-mm-dd').
 */
export interface FinancialRecord {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR o lancamento o id ainda nao existe. */
  id?: number;
  enrollmentId: number;
  totalAmount: number;
  condition: PaymentCondition;

  /** Quantidade de parcelas. Sempre 1 quando a condicao e 'avista'. */
  installments: number;

  method: PaymentMethod;
  status: FinancialStatus;
  createdAt: string;
}

/**
 * Rotulos em portugues dos metodos de pagamento, para as telas nao repetirem
 * um switch cada uma. Mesma ideia da tabela de cores do app-status-chip.
 */
export const METODOS_PAGAMENTO: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartao',
};

/** Rotulos em portugues das condicoes de pagamento. */
export const CONDICOES_PAGAMENTO: Record<PaymentCondition, string> = {
  avista: 'A vista',
  parcelado: 'Parcelado',
};

/**
 * Rotulos em portugues das situacoes do lancamento.
 *
 * Existe por causa do 'parcialmente_pago': mostrar o underscore na tela seria
 * vazar o formato do banco para o usuario.
 */
export const SITUACOES_FINANCEIRAS: Record<FinancialStatus, string> = {
  pendente: 'Pendente',
  parcialmente_pago: 'Parcialmente pago',
  pago: 'Pago',
  vencido: 'Vencido',
};
