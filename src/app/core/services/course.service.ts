import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Course } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * SERVICE da colecao /courses (cursos).
 * HERDA de BaseApiService: list, getById, create, update, delete.
 */
@Injectable({ providedIn: 'root' })
export class CourseService extends BaseApiService<Course> {
  constructor() {
    super('courses');
  }

  /** Lista em ordem alfabetica, para a tabela da tela. GET /courses?_sort=name */
  listarOrdenadoPorNome(): Observable<Course[]> {
    return this.buscar({ _sort: 'name' });
  }

  /**
   * Somente os cursos ativos. Serve para o select da tela de Turmas,
   * que nao deve oferecer curso desativado.
   * GET /courses?active=true
   */
  listarAtivos(): Observable<Course[]> {
    return this.buscar({ active: true });
  }

  /**
   * Os cursos de que um professor e responsavel. GET /courses?teacherId=X
   *
   * E a consulta que sustenta o escopo do perfil professor: tudo o que ele
   * alcanca (turmas, alunos, frequencia, financeiro) comeca por "quais cursos
   * sao dele".
   */
  listarPorProfessor(teacherId: number): Observable<Course[]> {
    return this.buscar({ teacherId });
  }
}
