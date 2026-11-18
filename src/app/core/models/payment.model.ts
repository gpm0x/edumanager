import { PaymentMethod } from './financial-record.model';

/**
 * Situacoes aceitas para uma PARCELA (contrato de dados).
 *
 *   'pendente' -> ainda nao foi paga e o vencimento nao chegou.
 *   'pago'     -> o administrador confirmou o recebimento (tem `paidAt`).
 *   'vencido'  -> passou do vencimento sem pagamento.
 *
 * NAO existe 'parcialmente pago' aqui, de proposito: meia parcela nao faz
 * sentido - ou a escola recebeu aquela parcela ou nao recebeu. "Parcialmente
 * pago" e situacao do LANCAMENTO (ver FinancialStatus), que e o que tem varias
 * parcelas e pode ter algumas quitadas e outras nao.
 *
 * Observacao de contrato: este status se chamava 'atrasado' ate 14/11/2026.
 * Passou a 'vencido' para usar a mesma palavra do requisito 6.4, e os dados do
 * db.json foram migrados junto.
 */
export type PaymentStatus = 'pendente' | 'pago' | 'vencido';

/**
 * MODEL - formato exato de um registro da colecao /payments da API.
 *
 * ESTA E A ENTIDADE "PARCELA" (Installment) DO REQUISITO 10
 * ---------------------------------------------------------
 * A colecao continua se chamando `payments` porque e o nome que o db.json e os
 * services ja usavam; o que ela guarda, conceitualmente, e uma PARCELA.
 *
 * Cada parcela pertence a UM lancamento financeiro:
 *  - financialRecordId -> FinancialRecord.id
 *
 * E guarda tambem o `enrollmentId` da matricula. Isso e informacao repetida
 * (o lancamento ja sabe de qual matricula ele e), e a repeticao e deliberada:
 * o JSON Server nao faz JOIN de dois niveis, entao, sem este campo, a tela de
 * parcelas precisaria de duas consultas em cadeia (parcela -> lancamento ->
 * matricula) para escrever o nome do aluno em uma linha da tabela. O campo e
 * gravado uma vez, na criacao, e nunca muda - que e a condicao para uma
 * desnormalizacao ser segura.
 *
 * `number`  = o numero da parcela dentro do lancamento (1 de 3, 2 de 3...).
 * `dueDate` = vencimento (string ISO 'aaaa-mm-dd').
 * `amount`  = valor da parcela em reais.
 * `paidAt`  = data do pagamento; fica `null` enquanto a parcela nao foi paga.
 */
export interface Payment {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR uma parcela o id ainda nao existe. */
  id?: number;

  /**
   * Lancamento a que esta parcela pertence.
   *
   * Opcional por compatibilidade com parcelas lancadas na mao pelo
   * administrador (tela de Parcelas), que podem existir sem lancamento. Toda
   * parcela criada pelo fluxo de matricula TEM este campo.
   */
  financialRecordId?: number;

  enrollmentId: number;

  /** 1, 2, 3... dentro do lancamento. Opcional nas parcelas lancadas na mao. */
  number?: number;

  dueDate: string;
  amount: number;
  paidAt: string | null;
  status: PaymentStatus;

  /**
   * Como a parcela foi paga, quando o PROPRIO ALUNO efetuou o pagamento pela
   * tela de mensalidades ('pix' ou 'cartao'). Fica vazio nas parcelas
   * confirmadas pelo administrador e nas ainda em aberto. Opcional para nao
   * invalidar os registros que ja existem no db.json.
   */
  paymentMethod?: PaymentMethod | null;
}
