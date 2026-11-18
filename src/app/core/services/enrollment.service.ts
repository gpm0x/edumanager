import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Class, Enrollment, Student } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * Formato da RESPOSTA da API quando pedimos a matricula com o aluno e/ou a
 * turma ja embutidos (?_expand=student&_expand=class).
 *
 * Nao e um model do sistema, e so o formato de um retorno da API, por isso
 * mora aqui no service e nao em core/models (que e do Arquiteto).
 *
 * ATENCAO (secao 9 do contrato): o _expand=class gera uma propriedade chamada
 * "class", que e palavra reservada do TypeScript. Como NOME DE PROPRIEDADE ela
 * e aceita, mas para nao depender disso o acesso recomendado na tela e por
 * colchetes:  matricula['class']?.code
 */
export interface EnrollmentComRelacoes extends Enrollment {
  student?: Student;
  class?: Class;
}

/**
 * SERVICE da colecao /enrollments (matriculas).
 * HERDA de BaseApiService: list, getById, create, update, delete.
 *
 * E o service com mais regras de negocio penduradas, porque a matricula e o
 * centro do sistema: ela liga aluno e turma, e dela saem pagamentos e frequencia.
 */
@Injectable({ providedIn: 'root' })
export class EnrollmentService extends BaseApiService<Enrollment> {
  constructor() {
    super('enrollments');
  }

  /**
   * Matriculas com o ALUNO e a TURMA ja preenchidos, para a tabela da tela.
   *
   * Uso na tela:  matricula.student?.name   e   matricula['class']?.code
   *
   * GET /enrollments?_expand=student&_expand=class
   */
  listarComAlunoETurma(): Observable<EnrollmentComRelacoes[]> {
    return this.http.get<EnrollmentComRelacoes[]>(`${this.url}?_expand=student&_expand=class`);
  }

  /**
   * REGRA 6.1 - MATRICULA DUPLICADA.
   *
   * Chame ANTES de salvar uma matricula nova: se a lista voltar com algum
   * registro, esse aluno JA esta matriculado nessa turma e o salvamento deve ser
   * bloqueado com mensagem na tela.
   *
   * GET /enrollments?studentId=X&classId=Y
   */
  buscarDuplicada(studentId: number, classId: number): Observable<Enrollment[]> {
    return this.buscar({ studentId, classId });
  }

  /**
   * REGRA 6.2 - CAPACIDADE DA TURMA.
   *
   * Devolve somente as matriculas ATIVAS da turma, que sao as que ocupam vaga
   * (uma matricula cancelada nao ocupa). A tela compara o tamanho da lista com
   * o campo capacity da turma:
   *
   *   if (ativas.length >= turma.capacity) { bloqueia com mensagem }
   *
   * Filtrar aqui pela API, e nao na tela, evita a tela errar a contagem
   * esquecendo de descartar as canceladas.
   *
   * GET /enrollments?classId=Y&status=ativa
   */
  listarAtivasPorTurma(classId: number): Observable<Enrollment[]> {
    return this.buscar({ classId, status: 'ativa' });
  }

  /**
   * Todas as matriculas ATIVAS, de todas as turmas.
   *
   * A versao de cima responde "esta turma tem vaga?"; esta responde "quais
   * turmas tem vaga?", que e a pergunta do catalogo do autocadastro: ele
   * precisa da ocupacao de TODAS as turmas de uma vez, para nao oferecer ao
   * candidato uma turma lotada.
   *
   * Pedir uma consulta por turma seria uma requisicao por turma aberta, e a
   * conta cresce com o catalogo. Aqui e uma consulta so, e a contagem por turma
   * e feita na tela.
   *
   * GET /enrollments?status=ativa
   */
  listarAtivas(): Observable<Enrollment[]> {
    return this.buscar({ status: 'ativa' });
  }

  /**
   * REGRA 6.4 - SELECT DE ALUNO DA TELA DE FREQUENCIA.
   *
   * Devolve as matriculas da turma COM o aluno embutido, para a tela montar o
   * select somente com quem esta matriculado naquela turma. Nunca listar todos
   * os alunos do sistema nessa tela.
   *
   * Uso na tela:  matriculas.map(m => m.student)
   *
   * Tambem atende a REGRA 6.8 no caso "turma com matricula": se vier algum
   * registro, a turma nao pode ser excluida.
   *
   * GET /enrollments?classId=Y&_expand=student
   */
  listarPorTurmaComAluno(classId: number): Observable<EnrollmentComRelacoes[]> {
    return this.http.get<EnrollmentComRelacoes[]>(`${this.url}?classId=${classId}&_expand=student`);
  }

  /**
   * Matriculas de uma turma, sem embutir nada.
   * Versao enxuta de listarPorTurmaComAluno, para quando a tela so precisa contar.
   *
   * GET /enrollments?classId=Y
   */
  listarPorTurma(classId: number): Observable<Enrollment[]> {
    return this.buscar({ classId });
  }

  /**
   * REGRA 6.8 - EXCLUSAO BLOQUEADA: "aluno com matricula".
   *
   * Chame ANTES de excluir um aluno. Se vier alguma matricula, bloqueia e
   * oferece INATIVAR o aluno (campo status) em vez de excluir.
   *
   * GET /enrollments?studentId=X
   */
  listarPorAluno(studentId: number): Observable<Enrollment[]> {
    return this.buscar({ studentId });
  }

  /**
   * As matriculas de UM aluno, ja com a turma e o cadastro dele.
   *
   * E a versao restrita de listarComAlunoETurma(), e existe por um motivo de
   * privacidade, nao de desempenho: o painel do aluno precisa do codigo da
   * turma (que vem do _expand=class), e antes pedia a colecao INTEIRA para
   * depois filtrar no navegador. O resultado na tela era o certo, mas a
   * RESPOSTA da API trazia as matriculas e os nomes de todos os colegas - um
   * aluno com o DevTools aberto via a lista completa.
   *
   * Filtrando na consulta, o que nao e dele nem chega ao navegador.
   *
   * GET /enrollments?studentId=X&_expand=student&_expand=class
   */
  listarPorAlunoComTurma(studentId: number): Observable<EnrollmentComRelacoes[]> {
    return this.http.get<EnrollmentComRelacoes[]>(
      `${this.url}?studentId=${studentId}&_expand=student&_expand=class`,
    );
  }
}
