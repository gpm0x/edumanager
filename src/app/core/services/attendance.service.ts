import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Attendance, Student } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * Formato da RESPOSTA da API quando pedimos a frequencia com o aluno embutido
 * (?_expand=student). Nao e um model do sistema, e so o formato do retorno.
 */
export interface AttendanceComAluno extends Attendance {
  student?: Student;
}

/**
 * SERVICE da colecao /attendances (frequencia basica).
 * HERDA de BaseApiService: list, getById, create, update, delete.
 *
 * O campo `present` e boolean: true = presente, false = falta.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceService extends BaseApiService<Attendance> {
  constructor() {
    super('attendances');
  }

  /**
   * REGRA 6.5 - PRESENCA DUPLICADA.
   *
   * Bloqueia a trinca turma + aluno + data: o mesmo aluno nao pode ter dois
   * lancamentos de presenca na mesma turma no mesmo dia.
   *
   * Chame ANTES de salvar: se a lista voltar com algum registro, a tela bloqueia
   * e oferece ALTERAR o lancamento existente em vez de criar outro.
   *
   * A data vai no formato ISO 'aaaa-mm-dd', igual ao db.json.
   *
   * GET /attendances?classId=X&studentId=Y&date=Z
   */
  buscarDuplicada(classId: number, studentId: number, date: string): Observable<Attendance[]> {
    return this.buscar({ classId, studentId, date });
  }

  /**
   * Frequencia de uma turma, com o nome do aluno ja preenchido.
   * E o metodo da tabela da tela de Frequencia.
   *
   * Uso na tela:  registro.student?.name
   *
   * GET /attendances?classId=X&_expand=student
   */
  listarPorTurmaComAluno(classId: number): Observable<AttendanceComAluno[]> {
    return this.http.get<AttendanceComAluno[]>(`${this.url}?classId=${classId}&_expand=student`);
  }

  /**
   * Frequencia de uma turma numa data especifica, para a tela montar a chamada
   * do dia e ja mostrar quem foi lancado.
   *
   * GET /attendances?classId=X&date=Z
   */
  listarPorTurmaEData(classId: number, date: string): Observable<Attendance[]> {
    return this.buscar({ classId, date });
  }

  /**
   * REGRA 6.8 - EXCLUSAO BLOQUEADA: "matricula com frequencia".
   *
   * A frequencia nao guarda enrollmentId: ela aponta para classId + studentId.
   * Entao, para saber se uma MATRICULA tem frequencia lancada, consulte pela
   * turma e pelo aluno daquela matricula. Se vier algum registro, bloqueia a
   * exclusao com a mensagem do padrao da regra 6.8.
   *
   * GET /attendances?classId=X&studentId=Y
   */
  listarPorTurmaEAluno(classId: number, studentId: number): Observable<Attendance[]> {
    return this.buscar({ classId, studentId });
  }

  /**
   * Toda a frequencia de um aluno, para o relatorio simples de frequencia.
   * GET /attendances?studentId=Y
   */
  listarPorAluno(studentId: number): Observable<Attendance[]> {
    return this.buscar({ studentId });
  }
}
