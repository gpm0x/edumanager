/**
 * MODEL - formato exato de um registro da colecao /attendances da API ("frequencia").
 *
 * Um registro = a presenca de UM aluno em UMA turma em UMA data:
 *  - classId   -> Class.id
 *  - courseId  -> Course.id   (de qual curso e a turma)
 *  - studentId -> Student.id
 *
 * `date`    = dia da aula (string ISO 'aaaa-mm-dd').
 * `present` = true (presente) ou false (falta).
 *
 * A CHAVE QUE NAO PODE REPETIR
 * ----------------------------
 * A trinca (classId, studentId, date) identifica a chamada: o mesmo aluno nao
 * pode ter dois registros na mesma turma no mesmo dia (regra 8). O JSON Server
 * nao sabe cobrar chave composta, entao quem cobra e o
 * AttendanceService.buscarDuplicada() antes de gravar.
 */
export interface Attendance {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR o registro o id ainda nao existe. */
  id?: number;
  classId: number;

  /**
   * Curso da turma, pedido pelo requisito 8 ("cada registro devera estar
   * relacionado a aluno, turma, CURSO, data e status").
   *
   * E informacao derivada - a turma ja sabe o curso dela -, e esta gravada
   * aqui porque o relatorio de frequencia por curso ficaria com duas consultas
   * em cadeia sem ela (frequencia -> turma -> curso). Como a turma nunca troca
   * de curso, a copia nao sai de sincronia.
   *
   * Opcional por compatibilidade com registros gravados antes do campo existir.
   */
  courseId?: number;

  studentId: number;
  date: string;
  present: boolean;
}
