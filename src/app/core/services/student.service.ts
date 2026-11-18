import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Student } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * SERVICE da colecao /students (alunos).
 *
 * HERDA de BaseApiService os 5 metodos do CRUD:
 * list, getById, create, update, delete.
 *
 * Abaixo, as consultas especificas que as REGRAS DE NEGOCIO da secao 6 do
 * contrato precisam. O JSON Server nao tem chave estrangeira nem constraint,
 * entao a integridade e garantida pela aplicacao: a tela consulta antes de salvar.
 */
@Injectable({ providedIn: 'root' })
export class StudentService extends BaseApiService<Student> {
  constructor() {
    super('students');
  }

  /** Lista em ordem alfabetica, para a tabela da tela. GET /students?_sort=name */
  listarOrdenadoPorNome(): Observable<Student[]> {
    return this.buscar({ _sort: 'name' });
  }

  /**
   * REGRA 6.7 - CPF DUPLICADO.
   *
   * Chame ANTES de salvar: se a lista voltar com algum registro, o CPF ja existe
   * e o cadastro deve ser bloqueado com mensagem na tela.
   *
   * Atencao ao EDITAR: o proprio aluno vai aparecer no resultado. Ignore o
   * registro cujo id e o do aluno em edicao, por exemplo:
   *   duplicados.filter(a => a.id !== idEmEdicao).length > 0
   *
   * O cpf deve ser enviado com 11 DIGITOS PUROS, sem mascara, que e como ele
   * esta gravado no db.json (contrato).
   *
   * GET /students?cpf=valor
   */
  buscarPorCpf(cpf: string): Observable<Student[]> {
    return this.buscar({ cpf });
  }

  /**
   * Somente os alunos ativos. Serve para o select da tela de Matriculas,
   * que nao deve oferecer aluno inativo.
   * GET /students?status=ativo
   */
  listarAtivos(): Observable<Student[]> {
    return this.buscar({ status: 'ativo' });
  }
}
