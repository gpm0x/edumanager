/**
 * Situacoes aceitas para uma matricula (contrato de dados).
 *
 * A SITUACAO DA MATRICULA CONVERSA COM O FINANCEIRO (regra 5)
 * -----------------------------------------------------------
 *   'pendente'  -> matricula registrada e o lancamento financeiro criado, mas
 *                  nenhuma parcela confirmada ainda. E o estado em que toda
 *                  matricula nova nasce: a pessoa escolheu o curso e informou
 *                  como vai pagar, e a escola ainda nao recebeu nada.
 *   'ativa'     -> o administrador confirmou ao menos uma parcela. O aluno
 *                  esta estudando.
 *   'cancelada' -> desistencia ou cancelamento administrativo. O historico
 *                  financeiro NAO e apagado (regra 11).
 *   'concluida' -> curso terminado.
 *
 * Quem faz 'pendente' virar 'ativa' e a confirmacao de pagamento, no
 * FinanceiroService - e nao a tela. Ver `confirmarPagamento()`.
 */
export type EnrollmentStatus = 'pendente' | 'ativa' | 'cancelada' | 'concluida';

/**
 * MODEL - formato exato de um registro da colecao /enrollments da API ("matricula").
 *
 * A matricula e a tabela que LIGA aluno e turma (relacionamento N para N):
 *  - studentId -> Student.id
 *  - classId   -> Class.id
 *
 * `enrollmentDate` e string ISO 'aaaa-mm-dd'.
 */
export interface Enrollment {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR uma matricula o id ainda nao existe. */
  id?: number;
  studentId: number;
  classId: number;
  enrollmentDate: string;
  status: EnrollmentStatus;
}
