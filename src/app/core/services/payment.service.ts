import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Enrollment, Payment, PaymentStatus } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * Formato da RESPOSTA da API quando pedimos a parcela com a matricula embutida
 * (?_expand=enrollment). Nao e um model do sistema, e so o formato do retorno.
 */
export interface PaymentComMatricula extends Payment {
  enrollment?: Enrollment;
}

/**
 * SERVICE da colecao /payments (financeiro basico).
 * HERDA de BaseApiService: list, getById, create, update, delete.
 *
 * LEMBRETE DA REGRA 6.3 (quem implementa e a TELA, nao este service):
 * paidAt e OBRIGATORIO quando status = 'pago', e deve ser null nos outros
 * status. Na tela: ao escolher 'pago', o campo de data habilita e preenche com
 * hoje (editavel); nos outros status, limpa e desabilita.
 * O service apenas transporta o dado como ele vem do formulario.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService extends BaseApiService<Payment> {
  constructor() {
    super('payments');
  }

  /** Lista ordenada por vencimento, que e a ordem util na tela. GET /payments?_sort=dueDate */
  listarOrdenadoPorVencimento(): Observable<Payment[]> {
    return this.buscar({ _sort: 'dueDate' });
  }

  /**
   * REGRA 6.8 - EXCLUSAO BLOQUEADA: "matricula com pagamento".
   *
   * Chame ANTES de excluir uma matricula. Se vier alguma parcela, bloqueia com
   * a mensagem do padrao da regra 6.8.
   *
   * Tambem serve para a tela mostrar as parcelas de uma matricula especifica.
   *
   * GET /payments?enrollmentId=X
   */
  listarPorMatricula(enrollmentId: number): Observable<Payment[]> {
    return this.buscar({ enrollmentId });
  }

  /**
   * Filtra por situacao: 'pendente', 'pago' ou 'vencido'.
   * Serve para o filtro da tela de Parcelas e para o card de inadimplencia
   * do dashboard (listarPorStatus('vencido')).
   *
   * GET /payments?status=vencido
   */
  listarPorStatus(status: PaymentStatus): Observable<Payment[]> {
    return this.buscar({ status });
  }

  /**
   * As parcelas de UM lancamento financeiro, na ordem do numero.
   *
   * E a consulta central do modulo financeiro: a tela de detalhe do lancamento
   * precisa das parcelas na ordem 1, 2, 3 (e nao na ordem em que o JSON Server
   * devolveu), e o FinanceiroService precisa delas para recalcular a situacao.
   *
   * GET /payments?financialRecordId=X&_sort=number
   */
  listarPorLancamento(financialRecordId: number): Observable<Payment[]> {
    return this.buscar({ financialRecordId, _sort: 'number' });
  }

  /**
   * Parcelas com a matricula embutida, para a tabela da tela de Financeiro
   * conseguir chegar ao aluno sem uma segunda consulta por linha.
   *
   * GET /payments?_expand=enrollment
   */
  listarComMatricula(): Observable<PaymentComMatricula[]> {
    return this.http.get<PaymentComMatricula[]>(`${this.url}?_expand=enrollment`);
  }
}
