/**
 * Turnos aceitos para turmas (contrato de dados).
 * Os valores sao gravados em portugues, exatamente como no db.json.
 */
export type ClassShift = 'manha' | 'tarde' | 'noite';

/**
 * Status aceitos para turmas (contrato de dados, oficializado em 04/11/2026).
 * Usa o mesmo vocabulario de EnrollmentStatus, de proposito.
 *
 * Observacao: o api/db.json de exemplo so tem turmas 'ativa' e 'concluida',
 * mas 'cancelada' faz parte do contrato e precisa existir aqui para a tela de
 * Turmas poder oferecer e gravar essa opcao.
 */
export type ClassStatus = 'ativa' | 'cancelada' | 'concluida';

/**
 * MODEL - formato exato de um registro da colecao /classes da API ("turma").
 *
 * RELACIONAMENTO (feito por id, como manda a arquitetura):
 *  - courseId -> Course.id   (de qual curso esta turma e)
 *
 * Datas sao strings ISO 'aaaa-mm-dd', porque o JSON nao tem tipo Date.
 * `capacity` = numero maximo de alunos matriculados, e e o que limita a
 * matricula (regra 6.2).
 */
export interface Class {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR uma turma o id ainda nao existe. */
  id?: number;
  courseId: number;

  /**
   * PROFESSOR RESPONSAVEL pela turma: aponta para User.id de um usuario com
   * role 'professor'.
   *
   * POR QUE A TURMA TEM RESPONSAVEL SE O CURSO JA TEM
   * -------------------------------------------------
   * Porque sao coisas diferentes na vida real: o curso tem um coordenador
   * (quem responde pelo conteudo) e cada TURMA tem quem da aula nela. Duas
   * turmas do mesmo curso podem ter professores diferentes, e e a turma que
   * manda na frequencia - entao a frequencia precisa saber de quem e a turma.
   *
   * Opcional: turma sem professor definido herda, na pratica, o responsavel do
   * curso (ver ClassService.listarPorProfessor).
   */
  teacherId?: number;

  code: string;
  shift: ClassShift;
  startDate: string;
  endDate: string;
  capacity: number;
  status: ClassStatus;
}
