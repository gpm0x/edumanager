import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Class, Course } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * Formato da RESPOSTA da API quando pedimos a turma com o curso ja embutido
 * (?_expand=course).
 *
 * Nao e um model do sistema: e so o formato de um retorno especifico da API,
 * por isso mora aqui no service e nao em core/models (que e do Arquiteto).
 *
 * A propriedade e OPCIONAL porque so existe quando o _expand e usado.
 */
export interface ClassComRelacoes extends Class {
  course?: Course;
}

/**
 * SERVICE da colecao /classes (turmas).
 * HERDA de BaseApiService: list, getById, create, update, delete.
 */
@Injectable({ providedIn: 'root' })
export class ClassService extends BaseApiService<Class> {
  constructor() {
    super('classes');
  }

  /** Lista ordenada pelo codigo da turma. GET /classes?_sort=code */
  listarOrdenadoPorCodigo(): Observable<Class[]> {
    return this.buscar({ _sort: 'code' });
  }

  /**
   * Turmas com o NOME DO CURSO ja preenchido.
   *
   * E o metodo que a tabela da tela de Turmas usa: sem ele a tela so teria o
   * courseId (um numero) e precisaria buscar o curso de cada turma, uma
   * consulta por linha. O _expand e um recurso nativo do JSON Server que faz
   * esse "join".
   *
   * Uso na tela:  turma.course?.name
   *
   * GET /classes?_expand=course
   */
  listarComCurso(): Observable<ClassComRelacoes[]> {
    return this.http.get<ClassComRelacoes[]>(`${this.url}?_expand=course`);
  }

  /**
   * REGRA 6.8 - EXCLUSAO BLOQUEADA: "curso com turma".
   *
   * Chame ANTES de excluir um curso. Se vier alguma turma, a exclusao e
   * bloqueada e a tela mostra a mensagem do padrao da regra 6.8, oferecendo
   * INATIVAR o curso (campo active) em vez de excluir.
   *
   * GET /classes?courseId=X
   */
  listarPorCurso(courseId: number): Observable<Class[]> {
    return this.buscar({ courseId });
  }

  /**
   * CODIGO DE TURMA DUPLICADO.
   *
   * A tela chama isto ANTES de salvar: se vier algum registro (que nao seja a
   * propria turma em edicao), o codigo ja existe e o cadastro e bloqueado.
   *
   * O codigo e como a turma e CHAMADA em todo o resto do sistema - na lista de
   * matriculas, na chamada de frequencia, no relatorio. Dois "INF-2026-2" na
   * mesma tela nao quebram nada tecnicamente, e e justamente o problema:
   * ninguem percebe que matriculou o aluno na turma errada.
   *
   * GET /classes?code=valor
   */
  buscarPorCodigo(code: string): Observable<Class[]> {
    return this.buscar({ code });
  }

  /**
   * Somente as turmas ativas. Serve para o select da tela de Matriculas,
   * que nao deve oferecer turma concluida ou cancelada.
   * GET /classes?status=ativa
   */
  listarAtivas(): Observable<Class[]> {
    return this.buscar({ status: 'ativa' });
  }

  /**
   * As turmas de que um professor e responsavel DIRETO.
   * GET /classes?teacherId=X
   *
   * Cuidado: esta consulta NAO cobre a turma que ficou sem `teacherId` e
   * pertence a um curso do professor. Quem resolve isso e o AcessoService, que
   * junta as turmas desta consulta com as turmas dos cursos dele - duas
   * perguntas diferentes, e o escopo precisa das duas respostas.
   */
  listarPorProfessor(teacherId: number): Observable<Class[]> {
    return this.buscar({ teacherId });
  }
}
