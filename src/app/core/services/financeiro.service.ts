import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';

import {
  Course,
  Enrollment,
  FinancialRecord,
  FinancialStatus,
  Payment,
  PaymentCondition,
  PaymentMethod,
} from '../models';
import { EnrollmentService } from './enrollment.service';
import { FinancialRecordService } from './financial-record.service';
import { PaymentService } from './payment.service';

/**
 * As opcoes de parcelamento que a escola oferece (requisito 6.2).
 *
 * 1 nao entra na lista: 1 parcela e a condicao "a vista", que e uma escolha
 * diferente na tela e nao uma quantidade de parcelas.
 */
export const PARCELAS_OFERECIDAS: readonly number[] = [2, 3, 5, 10];

/** Teto de parcelas de um curso que nao definiu `maxInstallments`. */
export const MAX_PARCELAS_PADRAO = 10;

/** Dias entre a matricula e o vencimento da primeira parcela. */
const DIAS_ATE_O_PRIMEIRO_VENCIMENTO = 7;

/** O que a tela de matricula informa sobre como o aluno vai pagar. */
export interface CondicaoEscolhida {
  condition: PaymentCondition;

  /** Quantidade de parcelas. Ignorado (vira 1) quando a condicao e 'avista'. */
  installments: number;

  method: PaymentMethod;
}

/** Uma parcela calculada, ANTES de ser gravada (nao tem id nem matricula). */
export interface ParcelaCalculada {
  number: number;
  dueDate: string;
  amount: number;
}

/** O resultado de criar um lancamento: o lancamento e as parcelas gravadas. */
export interface LancamentoCriado {
  lancamento: FinancialRecord;
  parcelas: Payment[];
}

/** Resumo de dinheiro de um lancamento, para as telas nao recalcularem cada uma. */
export interface ResumoFinanceiro {
  total: number;
  pago: number;
  saldo: number;
  parcelasPagas: number;
  parcelasTotais: number;
  status: FinancialStatus;
}

/**
 * FINANCEIRO SERVICE - as REGRAS do dinheiro, em um lugar so.
 *
 * O QUE ESTE SERVICE E, E O QUE ELE NAO E
 * ---------------------------------------
 * Os outros services da pasta sao acesso a dados: um por colecao, cada um com
 * o CRUD herdado de BaseApiService. Este nao tem colecao propria - ele
 * ORQUESTRA tres (/financialRecords, /payments e /enrollments) para cumprir as
 * regras do requisito 6:
 *
 *   calcularParcelas()     divide o valor sem perder centavo
 *   criarLancamento()      matricula -> lancamento -> parcelas, com desfazer
 *   confirmarPagamento()   parcela paga -> recalcula lancamento e matricula
 *   recalcular()           rele as parcelas e corrige a situacao do lancamento
 *   resumo()               total, pago, saldo (o que as telas mostram)
 *
 * Ele existe porque essas regras nao pertencem a nenhuma tela: a matricula
 * nasce no autocadastro E na tela de matriculas do administrador, e as duas
 * precisam gerar o financeiro exatamente igual. Regra escrita duas vezes e
 * regra que um dia vai divergir.
 *
 * POR QUE O DINHEIRO E CONTADO EM CENTAVOS AQUI DENTRO
 * ----------------------------------------------------
 * Porque `0.1 + 0.2` em JavaScript nao da `0.3`. Numero decimal no computador
 * e aproximado, e somar dez parcelas aproximadas erra o total. Entao a divisao
 * e feita em NUMEROS INTEIROS de centavos e so o resultado volta para reais.
 *
 * NAO HA TRANSACAO: O DESFAZER E NA MAO (requisito 11)
 * ----------------------------------------------------
 * O JSON Server grava um registro por requisicao e nao tem "tudo ou nada".
 * Criar um lancamento sao varias gravacoes, e a quarta pode falhar depois de a
 * terceira ter dado certo - deixando parcelas penduradas em um lancamento
 * incompleto. Por isso cada etapa aqui guarda o que criou e, em caso de falha,
 * APAGA o que criou antes de repassar o erro (padrao de compensacao). Nao e
 * uma transacao de banco de verdade, e e o mais perto que se chega com este
 * backend - a limitacao esta documentada no README.
 */
@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  private readonly recordService = inject(FinancialRecordService);
  private readonly paymentService = inject(PaymentService);
  private readonly enrollmentService = inject(EnrollmentService);

  // ==========================================================================
  //  1) O QUE A ESCOLA OFERECE PARA ESTE CURSO
  // ==========================================================================

  /**
   * As quantidades de parcela que podem ser oferecidas NESTE curso.
   *
   * Filtra PARCELAS_OFERECIDAS pelo teto do curso: um curso com
   * `maxInstallments: 3` oferece 2x e 3x, e nao 5x nem 10x.
   */
  opcoesDeParcelas(curso: Course | null | undefined): number[] {
    const teto = curso?.maxInstallments ?? MAX_PARCELAS_PADRAO;
    return PARCELAS_OFERECIDAS.filter((quantidade) => quantidade <= teto);
  }

  // ==========================================================================
  //  2) CALCULO DAS PARCELAS
  // ==========================================================================

  /**
   * Divide o valor em parcelas, sem perder nem inventar centavo.
   *
   * COMO A SOBRA E TRATADA (regra 6.2)
   * ----------------------------------
   * R$ 1.000,00 em 3 vezes da 333,333... Em centavos: 100000 / 3 = 33333 com
   * sobra de 1 centavo. As duas primeiras parcelas ficam com 333,33 e a ULTIMA
   * recebe a sobra: 333,34. Somando, 1.000,00 exatos - que e o que o requisito
   * exige ("distribuir a diferenca na ultima parcela").
   *
   * A sobra vai na ultima, e nao na primeira, porque a primeira e a que o
   * aluno confere na hora da matricula: ver o valor "redondo" ali e o
   * comportamento que ele espera do comercio.
   *
   * @param total       valor integral em reais.
   * @param quantidade  numero de parcelas (1 = a vista).
   * @param dataBase    data da matricula ('aaaa-mm-dd'). O primeiro vencimento
   *                    cai 7 dias depois; os seguintes, de mes em mes.
   */
  calcularParcelas(total: number, quantidade: number, dataBase: string): ParcelaCalculada[] {
    const parcelas = Math.max(1, Math.trunc(quantidade));

    // Tudo em centavos inteiros: e o que impede o erro de arredondamento.
    const totalEmCentavos = Math.round(total * 100);
    const valorBase = Math.floor(totalEmCentavos / parcelas);
    const sobra = totalEmCentavos - valorBase * parcelas;

    const primeiroVencimento = this.somarDias(dataBase, DIAS_ATE_O_PRIMEIRO_VENCIMENTO);

    return Array.from({ length: parcelas }, (_, indice) => {
      const ehUltima = indice === parcelas - 1;
      const centavos = ehUltima ? valorBase + sobra : valorBase;

      return {
        number: indice + 1,
        dueDate: this.somarMeses(primeiroVencimento, indice),
        amount: centavos / 100,
      };
    });
  }

  // ==========================================================================
  //  3) CRIACAO DO LANCAMENTO (chamado no fim de toda matricula)
  // ==========================================================================

  /**
   * Cria o lancamento financeiro de uma matricula e as parcelas dele.
   *
   * A ORDEM DE GRAVACAO IMPORTA (requisito 11)
   * ------------------------------------------
   * O lancamento vem PRIMEIRO porque a parcela precisa do `financialRecordId`
   * dele - nao da para criar o filho antes do pai. Se alguma parcela falhar, o
   * metodo apaga as parcelas que ja criou e tambem o lancamento, para nao
   * deixar um lancamento de 3 parcelas com so 2 gravadas (que apareceria no
   * relatorio com o valor errado).
   *
   * TUDO NASCE PENDENTE (requisito 6.5)
   * -----------------------------------
   * O lancamento nasce 'pendente' e as parcelas tambem, qualquer que seja o
   * metodo informado. Escolher PIX nao paga nada: so a confirmacao do
   * administrador muda isso.
   *
   * @param enrollmentId matricula a que o lancamento pertence.
   * @param valorTotal   valor do curso NO MOMENTO da matricula. E copiado para
   *                     dentro do lancamento de proposito: mudar o preco do
   *                     curso depois nao pode mexer em matricula ja feita.
   */
  criarLancamento(
    enrollmentId: number,
    valorTotal: number,
    condicao: CondicaoEscolhida,
    dataBase: string = this.hoje(),
  ): Observable<LancamentoCriado> {
    // A vista e sempre 1 parcela, nao importa o que a tela tenha mandado.
    const quantidade = condicao.condition === 'avista' ? 1 : Math.max(2, condicao.installments);

    const lancamento: FinancialRecord = {
      enrollmentId,
      totalAmount: valorTotal,
      condition: condicao.condition,
      installments: quantidade,
      method: condicao.method,
      status: 'pendente',
      createdAt: dataBase,
    };

    const calculadas = this.calcularParcelas(valorTotal, quantidade, dataBase);

    return this.recordService
      .create(lancamento)
      .pipe(
        switchMap((criado) =>
          this.gravarParcelas(criado, enrollmentId, calculadas).pipe(
            map((parcelas) => ({ lancamento: criado, parcelas })),
          ),
        ),
      );
  }

  /**
   * Grava as parcelas de um lancamento recem-criado.
   *
   * As gravacoes vao em forkJoin (em paralelo) porque sao independentes entre
   * si - uma parcela nao precisa do id da outra. Se QUALQUER uma falhar, o
   * forkJoin avisa na hora, e o catchError desfaz: apaga o lancamento e as
   * parcelas que por acaso tenham entrado.
   *
   * O desfazer e "best effort": se o proprio delete falhar (API fora do ar),
   * engolimos o erro do delete e repassamos o erro ORIGINAL, que e o que a
   * tela precisa mostrar. Ficar preso tentando limpar nao ajuda ninguem.
   */
  private gravarParcelas(
    lancamento: FinancialRecord,
    enrollmentId: number,
    calculadas: ParcelaCalculada[],
  ): Observable<Payment[]> {
    const gravacoes = calculadas.map((parcela) =>
      this.paymentService.create({
        financialRecordId: lancamento.id!,
        enrollmentId,
        number: parcela.number,
        dueDate: parcela.dueDate,
        amount: parcela.amount,
        paidAt: null,
        status: 'pendente',
      }),
    );

    return forkJoin(gravacoes).pipe(
      catchError((falhaOriginal: unknown) =>
        this.desfazerLancamento(lancamento.id!).pipe(
          switchMap(() => throwError(() => falhaOriginal)),
        ),
      ),
    );
  }

  /** Apaga as parcelas e o lancamento. Usado quando a criacao falha no meio. */
  private desfazerLancamento(recordId: number): Observable<unknown> {
    return this.paymentService.listarPorLancamento(recordId).pipe(
      catchError(() => of([] as Payment[])),
      switchMap((parcelas) => {
        const exclusoes = parcelas.map((parcela) =>
          this.paymentService.delete(parcela.id!).pipe(catchError(() => of(null))),
        );
        return exclusoes.length === 0 ? of([]) : forkJoin(exclusoes);
      }),
      switchMap(() => this.recordService.delete(recordId).pipe(catchError(() => of(null)))),
    );
  }

  // ==========================================================================
  //  4) CONFIRMACAO DE PAGAMENTO
  // ==========================================================================

  /**
   * Confirma o recebimento de UMA parcela e propaga o efeito disso.
   *
   * Sao tres gravacoes em cadeia, e a ordem e a propria regra de negocio:
   *
   *   1. a PARCELA vira 'pago' e recebe a data do recebimento;
   *   2. o LANCAMENTO e recalculado (pendente -> parcialmente pago -> pago);
   *   3. a MATRICULA 'pendente' vira 'ativa', porque a escola recebeu algo.
   *
   * Se a etapa 2 ou 3 falhar, a parcela JA esta paga - e isso e proposital. O
   * dado mais importante aqui e "o dinheiro entrou"; a situacao do lancamento
   * e derivada e pode ser corrigida a qualquer momento por `recalcular()`.
   * Desfazer o pagamento por causa de um status derivado seria perder a
   * informacao certa para proteger a errada.
   *
   * @param parcela parcela a confirmar.
   * @param dataPagamento data do recebimento ('aaaa-mm-dd'). Hoje, por padrao.
   */
  confirmarPagamento(parcela: Payment, dataPagamento: string = this.hoje()): Observable<Payment> {
    const paga: Payment = { ...parcela, paidAt: dataPagamento, status: 'pago' };

    return this.paymentService.update(parcela.id!, paga).pipe(
      switchMap((atualizada) => {
        if (parcela.financialRecordId === undefined) {
          // Parcela lancada na mao, sem lancamento: nao ha o que recalcular.
          return of(atualizada);
        }
        return this.recalcular(parcela.financialRecordId).pipe(map(() => atualizada));
      }),
    );
  }

  /**
   * PAGAMENTO FEITO PELO PROPRIO ALUNO, na tela de mensalidades.
   *
   * E a mesma cadeia da confirmacao do administrador (parcela paga ->
   * lancamento recalculado -> matricula ativada), com uma diferenca: grava
   * tambem o METODO escolhido pelo aluno no momento de pagar.
   *
   * O pagamento e SIMULADO: o sistema nao tem integracao com banco nem com
   * operadora de cartao (requisito 15). Num sistema real, a parcela so viraria
   * 'pago' depois do retorno do gateway; aqui ela vira na hora.
   */
  pagarParcela(parcela: Payment, metodo: PaymentMethod): Observable<Payment> {
    if (parcela.status === 'pago') {
      return throwError(() => new Error('Esta parcela ja esta paga.'));
    }
    return this.confirmarPagamento({ ...parcela, paymentMethod: metodo });
  }

  /**
   * Volta uma parcela para "nao paga" (estorno de confirmacao feita por
   * engano) e recalcula o lancamento.
   *
   * O status volta para 'vencido' se o vencimento ja passou, e para 'pendente'
   * se nao passou - e nao simplesmente para 'pendente': uma parcela com
   * vencimento em agosto nao esta "a vencer" em novembro.
   */
  estornarPagamento(parcela: Payment): Observable<Payment> {
    const estornada: Payment = {
      ...parcela,
      paidAt: null,
      paymentMethod: null,
      status: this.venceu(parcela.dueDate) ? 'vencido' : 'pendente',
    };

    return this.paymentService
      .update(parcela.id!, estornada)
      .pipe(
        switchMap((atualizada) =>
          parcela.financialRecordId === undefined
            ? of(atualizada)
            : this.recalcular(parcela.financialRecordId).pipe(map(() => atualizada)),
        ),
      );
  }

  /**
   * Rele as parcelas de um lancamento e grava a situacao que elas indicam.
   *
   * Faz duas coisas, nesta ordem:
   *   1. marca como 'vencido' as parcelas nao pagas cujo vencimento passou -
   *      o JSON Server nao tem rotina agendada, entao "virar vencido" so pode
   *      acontecer quando alguem abre o sistema;
   *   2. grava no lancamento a situacao resultante e ativa a matricula se a
   *      escola ja recebeu alguma coisa.
   */
  recalcular(recordId: number): Observable<FinancialRecord | null> {
    return forkJoin({
      lancamento: this.recordService.getById(recordId),
      parcelas: this.paymentService.listarPorLancamento(recordId),
    }).pipe(
      switchMap(({ lancamento, parcelas }) =>
        this.sincronizarVencidas(parcelas).pipe(
          switchMap((atualizadas) => {
            const situacao = this.situacaoDoLancamento(atualizadas);

            const gravarLancamento =
              situacao === lancamento.status
                ? of(lancamento)
                : this.recordService.update(recordId, { ...lancamento, status: situacao });

            return gravarLancamento.pipe(
              switchMap((gravado) =>
                this.ativarMatriculaSePagou(gravado, atualizadas).pipe(map(() => gravado)),
              ),
            );
          }),
        ),
      ),
      // A situacao do lancamento e informacao derivada: se o recalculo falhar,
      // a tela nao deve quebrar por causa dele.
      catchError(() => of(null)),
    );
  }

  /**
   * Matricula 'pendente' vira 'ativa' quando a escola recebe a primeira
   * parcela (regra 5 + 6.5).
   *
   * O caminho e so de ida: matricula 'cancelada' ou 'concluida' NAO volta a
   * ser 'ativa' por causa de um pagamento. Quem cancelou tinha um motivo, e
   * confirmar uma parcela atrasada de um cancelamento nao desfaz a decisao
   * administrativa.
   */
  private ativarMatriculaSePagou(
    lancamento: FinancialRecord,
    parcelas: Payment[],
  ): Observable<Enrollment | null> {
    const recebeuAlgo = parcelas.some((parcela) => parcela.status === 'pago');
    if (!recebeuAlgo) {
      return of(null);
    }

    return this.enrollmentService.getById(lancamento.enrollmentId).pipe(
      switchMap((matricula) =>
        matricula.status === 'pendente'
          ? this.enrollmentService.update(matricula.id!, { ...matricula, status: 'ativa' })
          : of(matricula),
      ),
      catchError(() => of(null)),
    );
  }

  /**
   * Grava 'vencido' nas parcelas que passaram do vencimento sem pagamento.
   *
   * Devolve a lista JA com os valores novos, para quem chamou nao precisar
   * consultar a API de novo so para saber o que mudou.
   */
  private sincronizarVencidas(parcelas: Payment[]): Observable<Payment[]> {
    const paraAtualizar = parcelas.filter(
      (parcela) => parcela.status === 'pendente' && this.venceu(parcela.dueDate),
    );

    if (paraAtualizar.length === 0) {
      return of(parcelas);
    }

    const gravacoes = paraAtualizar.map((parcela) =>
      this.paymentService
        .update(parcela.id!, { ...parcela, status: 'vencido' as const })
        .pipe(catchError(() => of(parcela))),
    );

    return forkJoin(gravacoes).pipe(
      map(() =>
        parcelas.map((parcela) =>
          paraAtualizar.some((alvo) => alvo.id === parcela.id)
            ? { ...parcela, status: 'vencido' as const }
            : parcela,
        ),
      ),
    );
  }

  // ==========================================================================
  //  5) CALCULOS DE LEITURA (usados pelas telas e pelo painel)
  // ==========================================================================

  /**
   * A situacao que as parcelas indicam para o lancamento (requisito 6.4).
   *
   * A ordem dos testes e a regra:
   *   nenhuma parcela -> pendente (lancamento sem parcela e erro de dados;
   *                      tratar como pendente e o conservador)
   *   todas pagas     -> pago
   *   alguma paga     -> parcialmente pago
   *   alguma vencida  -> vencido
   *   resto           -> pendente
   */
  situacaoDoLancamento(parcelas: Payment[]): FinancialStatus {
    if (parcelas.length === 0) {
      return 'pendente';
    }

    const pagas = parcelas.filter((parcela) => parcela.status === 'pago').length;

    if (pagas === parcelas.length) {
      return 'pago';
    }
    if (pagas > 0) {
      return 'parcialmente_pago';
    }
    if (parcelas.some((parcela) => parcela.status === 'vencido')) {
      return 'vencido';
    }
    return 'pendente';
  }

  /**
   * Total, pago, saldo e situacao de um lancamento.
   *
   * O `total` sai do LANCAMENTO (o valor combinado), e nao da soma das
   * parcelas: se alguem editar uma parcela na mao, o combinado continua sendo
   * o combinado - e a diferenca aparece no saldo, em vez de desaparecer.
   */
  resumo(lancamento: FinancialRecord, parcelas: Payment[]): ResumoFinanceiro {
    const pagas = parcelas.filter((parcela) => parcela.status === 'pago');

    const pagoEmCentavos = pagas.reduce(
      (soma, parcela) => soma + Math.round(parcela.amount * 100),
      0,
    );
    const totalEmCentavos = Math.round(lancamento.totalAmount * 100);

    return {
      total: totalEmCentavos / 100,
      pago: pagoEmCentavos / 100,
      // Math.max evita saldo negativo quando alguem paga mais do que devia.
      saldo: Math.max(0, totalEmCentavos - pagoEmCentavos) / 100,
      parcelasPagas: pagas.length,
      parcelasTotais: parcelas.length,
      status: this.situacaoDoLancamento(parcelas),
    };
  }

  // ==========================================================================
  //  6) DATAS (o JSON nao tem tipo Date: tudo e string 'aaaa-mm-dd')
  // ==========================================================================

  /** true quando a data ja passou (comparacao de texto ISO basta e nao tem fuso). */
  venceu(dueDate: string): boolean {
    return dueDate < this.hoje();
  }

  /** Hoje em 'aaaa-mm-dd', no fuso do navegador. */
  hoje(): string {
    return this.formatar(new Date());
  }

  private somarDias(data: string, dias: number): string {
    const base = this.paraDate(data);
    base.setDate(base.getDate() + dias);
    return this.formatar(base);
  }

  /**
   * Soma meses mantendo o dia do mes, com um cuidado: 31/01 + 1 mes nao existe
   * em fevereiro. Em vez de "escorregar" para 03/03 (que e o que o JavaScript
   * faz sozinho), o vencimento e fixado no ULTIMO dia do mes de destino.
   */
  private somarMeses(data: string, meses: number): string {
    if (meses === 0) {
      return data;
    }

    const [ano, mes, dia] = data.split('-').map(Number);
    const mesDestino = mes - 1 + meses;
    const anoDestino = ano + Math.floor(mesDestino / 12);
    const mesNormalizado = ((mesDestino % 12) + 12) % 12;

    // Dia 0 do mes seguinte = ultimo dia do mes de destino.
    const ultimoDia = new Date(anoDestino, mesNormalizado + 1, 0).getDate();

    return this.formatar(new Date(anoDestino, mesNormalizado, Math.min(dia, ultimoDia)));
  }

  private paraDate(data: string): Date {
    const [ano, mes, dia] = data.split('-').map(Number);
    // Construtor com numeros (e nao new Date('2026-08-10')) para o navegador
    // nao interpretar a string como UTC e devolver o dia anterior.
    return new Date(ano, mes - 1, dia);
  }

  private formatar(data: Date): string {
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
  }
}
