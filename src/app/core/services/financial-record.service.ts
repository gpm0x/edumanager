import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Enrollment, FinancialRecord, FinancialStatus } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * Um lancamento com a matricula dele ja embutida, para a tabela escrever o
 * nome do aluno sem uma segunda consulta por linha.
 *
 * `_expand=enrollment` e recurso do JSON Server: ele le o campo
 * `enrollmentId`, busca o registro correspondente em /enrollments e devolve
 * tudo junto. Observacao importante: ele expande UM nivel so - por isso a
 * matricula vem sem o aluno dentro, e quem precisa do nome do aluno carrega
 * /enrollments?_expand=student em paralelo (ver a tela de Lancamentos).
 */
export interface FinancialRecordComMatricula extends FinancialRecord {
  enrollment?: Enrollment;
}

/**
 * SERVICE da colecao /financialRecords - os LANCAMENTOS financeiros.
 *
 * HERANCA: `extends BaseApiService<FinancialRecord>` traz list, getById,
 * create, update e delete prontos. Aqui ficam somente as consultas proprias do
 * financeiro.
 *
 * Este service e so ACESSO A DADOS: ele busca e grava lancamentos, e nao sabe
 * nada sobre a regra de "quando um lancamento esta parcialmente pago". Essa
 * regra mora no FinanceiroService, que usa este service. A separacao e de
 * proposito: quem for ler o codigo encontra o CRUD em um arquivo e as regras
 * de negocio no outro.
 */
@Injectable({ providedIn: 'root' })
export class FinancialRecordService extends BaseApiService<FinancialRecord> {
  constructor() {
    super('financialRecords');
  }

  /** Lancamentos do mais recente para o mais antigo. GET /financialRecords?_sort=createdAt&_order=desc */
  listarRecentesPrimeiro(): Observable<FinancialRecord[]> {
    return this.buscar({ _sort: 'createdAt', _order: 'desc' });
  }

  /**
   * O lancamento de uma matricula. GET /financialRecords?enrollmentId=:id
   *
   * Devolve LISTA, e nao um registro, porque a consulta filtrada do JSON
   * Server sempre devolve array - mesmo quando existe no maximo um resultado.
   */
  listarPorMatricula(enrollmentId: number): Observable<FinancialRecord[]> {
    return this.buscar({ enrollmentId });
  }

  /** Lancamentos em uma situacao. GET /financialRecords?status=pendente */
  listarPorStatus(status: FinancialStatus): Observable<FinancialRecord[]> {
    return this.buscar({ status });
  }

  /** Lancamentos com a matricula embutida. GET /financialRecords?_expand=enrollment */
  listarComMatricula(): Observable<FinancialRecordComMatricula[]> {
    return this.http.get<FinancialRecordComMatricula[]>(`${this.url}?_expand=enrollment`);
  }
}
