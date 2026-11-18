/**
 * TESTES DAS REGRAS FINANCEIRAS
 * =============================
 *
 * O que esta provado aqui e a parte do sistema que NAO pode errar em silencio:
 * a divisao do valor em parcelas.
 *
 * POR QUE JUSTAMENTE ISTO MERECE TESTE
 * ------------------------------------
 * Um erro de centavo nao quebra tela nenhuma. O sistema continua funcionando,
 * as telas continuam bonitas, e a escola recebe R$ 999,99 de um curso de
 * R$ 1.000,00 - toda vez, em todas as matriculas, sem ninguem perceber. E o
 * tipo de defeito que so aparece no fechamento do mes, quando a conta nao bate
 * e nao se sabe desde quando.
 *
 * E e barato de testar: calcularParcelas, situacaoDoLancamento, resumo e
 * opcoesDeParcelas sao FUNCOES PURAS - entram numeros, saem numeros, sem API no
 * meio. Por isso o service foi escrito com elas separadas das gravacoes.
 *
 * O QUE NAO ESTA TESTADO AQUI, E POR QUE
 * --------------------------------------
 * As gravacoes (criarLancamento, confirmarPagamento, recalcular) nao estao: elas
 * dependem de tres colecoes da API e o valor do teste seria em grande parte
 * simular o JSON Server. Elas sao verificadas no roteiro de teste manual do
 * README, com a API rodando - que e onde o comportamento real aparece.
 *
 * Executar com:  npm test
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Course, Payment } from '../models';
import { FinanceiroService } from './financeiro.service';

// ============================================================================
//  APOIO
// ============================================================================

let financeiro: FinanceiroService;

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  financeiro = TestBed.inject(FinanceiroService);
});

/** Soma os valores das parcelas em CENTAVOS, que e a unica soma exata. */
function somaEmCentavos(valores: number[]): number {
  return valores.reduce((soma, valor) => soma + Math.round(valor * 100), 0);
}

/** Monta uma parcela de apoio, so com o que os calculos leem. */
function parcela(dados: Partial<Payment>): Payment {
  return {
    id: 1,
    enrollmentId: 1,
    dueDate: '2026-12-10',
    amount: 100,
    paidAt: null,
    status: 'pendente',
    ...dados,
  };
}

/** Curso de apoio, com teto de parcelamento configuravel. */
function curso(maxInstallments?: number): Course {
  return {
    id: 1,
    name: 'Curso de apoio',
    description: 'Curso usado pelos testes.',
    workload: 60,
    price: 1000,
    active: true,
    maxInstallments,
  };
}

// ============================================================================
//  1) DIVISAO DO VALOR EM PARCELAS
// ============================================================================

describe('FinanceiroService - calcularParcelas', () => {
  it('a vista: uma parcela com o valor integral', () => {
    const parcelas = financeiro.calcularParcelas(450, 1, '2026-11-14');

    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].amount).toBe(450);
    expect(parcelas[0].number).toBe(1);
  });

  it('divisao exata: todas as parcelas iguais', () => {
    const parcelas = financeiro.calcularParcelas(450, 2, '2026-11-14');

    expect(parcelas.map((p) => p.amount)).toEqual([225, 225]);
  });

  it('divisao INEXATA: a sobra vai na ULTIMA parcela (regra 6.2)', () => {
    // 1000 / 3 = 333,333... Em centavos: 33333 + 33333 + 33334.
    const parcelas = financeiro.calcularParcelas(1000, 3, '2026-11-14');

    expect(parcelas.map((p) => p.amount)).toEqual([333.33, 333.33, 333.34]);
  });

  it('a soma das parcelas e EXATAMENTE o total, em qualquer divisao', () => {
    // E o teste que importa de verdade: o requisito exige que a soma
    // corresponda ao valor total. Varre varios valores e quantidades, porque o
    // erro de centavo aparece em combinacoes especificas - nao em todas.
    const valores = [450, 1000, 1200, 2000, 999.99, 0.03, 1234.56];
    const quantidades = [1, 2, 3, 5, 10];

    for (const total of valores) {
      for (const quantidade of quantidades) {
        const parcelas = financeiro.calcularParcelas(total, quantidade, '2026-11-14');

        expect(somaEmCentavos(parcelas.map((p) => p.amount)), `${total} em ${quantidade}x`).toBe(
          Math.round(total * 100),
        );
      }
    }
  });

  it('valor que nao divide nem em centavo: as primeiras ficam em zero, e a soma fecha', () => {
    // 3 centavos em 10 vezes. Nao existe parcela de 0,3 centavo: nove parcelas
    // ficam em zero e a ultima leva os 3 centavos. E estranho, e e o
    // comportamento CERTO - a alternativa seria arredondar para cima e cobrar
    // mais do que o curso custa.
    const parcelas = financeiro.calcularParcelas(0.03, 10, '2026-11-14');

    expect(somaEmCentavos(parcelas.map((p) => p.amount))).toBe(3);
    expect(parcelas.at(-1)!.amount).toBe(0.03);
  });

  it('numera as parcelas de 1 ate a quantidade', () => {
    const parcelas = financeiro.calcularParcelas(1200, 5, '2026-11-14');

    expect(parcelas.map((p) => p.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('a primeira parcela vence 7 dias depois da matricula', () => {
    const parcelas = financeiro.calcularParcelas(450, 2, '2026-11-14');

    expect(parcelas[0].dueDate).toBe('2026-11-21');
  });

  it('as parcelas seguintes vencem de mes em mes, no mesmo dia', () => {
    const parcelas = financeiro.calcularParcelas(450, 3, '2026-01-03');

    // 03/01 + 7 dias = 10/01; depois 10/02 e 10/03.
    expect(parcelas.map((p) => p.dueDate)).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
  });

  it('vencimento em dia 31 NAO escorrega para o mes seguinte', () => {
    // 24/01 + 7 dias = 31/01. Fevereiro nao tem dia 31: o vencimento vai para
    // 28/02, e nao para 03/03 (que e o que o JavaScript faria sozinho).
    const parcelas = financeiro.calcularParcelas(300, 3, '2026-01-24');

    expect(parcelas.map((p) => p.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('atravessa a virada do ano sem errar o mes', () => {
    const parcelas = financeiro.calcularParcelas(300, 3, '2026-11-03');

    expect(parcelas.map((p) => p.dueDate)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10']);
  });

  it('quantidade invalida (0 ou negativa) vira uma parcela, e nao uma lista vazia', () => {
    // Falhar fechado: lancamento sem parcela nenhuma seria uma divida que o
    // sistema nunca cobraria. Uma parcela com o valor integral e o
    // comportamento conservador.
    expect(financeiro.calcularParcelas(450, 0, '2026-11-14')).toHaveLength(1);
    expect(financeiro.calcularParcelas(450, -3, '2026-11-14')[0].amount).toBe(450);
  });
});

// ============================================================================
//  2) OPCOES DE PARCELAMENTO POR CURSO
// ============================================================================

describe('FinanceiroService - opcoesDeParcelas', () => {
  it('curso sem teto configurado: oferece todas as opcoes', () => {
    expect(financeiro.opcoesDeParcelas(curso(undefined))).toEqual([2, 3, 5, 10]);
  });

  it('curso com teto 3: NAO oferece 5x nem 10x (regra 6.2)', () => {
    expect(financeiro.opcoesDeParcelas(curso(3))).toEqual([2, 3]);
  });

  it('curso com teto 1: nao oferece parcelamento nenhum', () => {
    // So a vista. A lista vazia e o que faz a tela esconder o select.
    expect(financeiro.opcoesDeParcelas(curso(1))).toEqual([]);
  });

  it('sem curso escolhido: oferece o padrao, em vez de quebrar', () => {
    expect(financeiro.opcoesDeParcelas(null)).toEqual([2, 3, 5, 10]);
  });
});

// ============================================================================
//  3) SITUACAO DO LANCAMENTO
// ============================================================================

describe('FinanceiroService - situacaoDoLancamento', () => {
  it('nenhuma parcela paga e nada vencido: pendente', () => {
    const situacao = financeiro.situacaoDoLancamento([
      parcela({ id: 1, status: 'pendente' }),
      parcela({ id: 2, status: 'pendente' }),
    ]);

    expect(situacao).toBe('pendente');
  });

  it('todas as parcelas pagas: pago', () => {
    const situacao = financeiro.situacaoDoLancamento([
      parcela({ id: 1, status: 'pago' }),
      parcela({ id: 2, status: 'pago' }),
    ]);

    expect(situacao).toBe('pago');
  });

  it('uma paga e uma em aberto: PARCIALMENTE pago', () => {
    const situacao = financeiro.situacaoDoLancamento([
      parcela({ id: 1, status: 'pago' }),
      parcela({ id: 2, status: 'pendente' }),
    ]);

    expect(situacao).toBe('parcialmente_pago');
  });

  it('uma paga e uma VENCIDA: parcialmente pago, e nao vencido', () => {
    // A ordem dos testes dentro do metodo e a regra: ter recebido algo pesa
    // mais do que ter uma parcela atrasada. Invertida, a situacao esconderia
    // que o aluno ja pagou parte.
    const situacao = financeiro.situacaoDoLancamento([
      parcela({ id: 1, status: 'pago' }),
      parcela({ id: 2, status: 'vencido' }),
    ]);

    expect(situacao).toBe('parcialmente_pago');
  });

  it('nada pago e ha parcela vencida: vencido', () => {
    const situacao = financeiro.situacaoDoLancamento([
      parcela({ id: 1, status: 'vencido' }),
      parcela({ id: 2, status: 'pendente' }),
    ]);

    expect(situacao).toBe('vencido');
  });

  it('lancamento sem parcela: pendente (falha conservadora)', () => {
    // Lancamento sem parcela e inconsistencia de dados. Tratar como 'pago'
    // sumiria com a divida do relatorio; 'pendente' a mantem visivel.
    expect(financeiro.situacaoDoLancamento([])).toBe('pendente');
  });
});

// ============================================================================
//  4) RESUMO (total, pago, saldo)
// ============================================================================

describe('FinanceiroService - resumo', () => {
  const lancamento = {
    id: 1,
    enrollmentId: 1,
    totalAmount: 1000,
    condition: 'parcelado' as const,
    installments: 3,
    method: 'pix' as const,
    status: 'pendente' as const,
    createdAt: '2026-11-14',
  };

  it('soma apenas as parcelas PAGAS no valor recebido', () => {
    const resumo = financeiro.resumo(lancamento, [
      parcela({ id: 1, amount: 333.33, status: 'pago' }),
      parcela({ id: 2, amount: 333.33, status: 'pendente' }),
      parcela({ id: 3, amount: 333.34, status: 'vencido' }),
    ]);

    expect(resumo.pago).toBe(333.33);
    expect(resumo.saldo).toBe(666.67);
    expect(resumo.parcelasPagas).toBe(1);
    expect(resumo.parcelasTotais).toBe(3);
    expect(resumo.status).toBe('parcialmente_pago');
  });

  it('quitado: saldo zero, sem sobra de centavo', () => {
    // O caso que o erro de ponto flutuante estragaria: 333,33 + 333,33 + 333,34
    // somados como decimais podem dar 999,9999999999999.
    const resumo = financeiro.resumo(lancamento, [
      parcela({ id: 1, amount: 333.33, status: 'pago' }),
      parcela({ id: 2, amount: 333.33, status: 'pago' }),
      parcela({ id: 3, amount: 333.34, status: 'pago' }),
    ]);

    expect(resumo.pago).toBe(1000);
    expect(resumo.saldo).toBe(0);
    expect(resumo.status).toBe('pago');
  });

  it('o total vem do LANCAMENTO, e nao da soma das parcelas', () => {
    // Se alguem editar uma parcela na mao, o combinado continua sendo o
    // combinado - e a diferenca aparece no saldo em vez de desaparecer.
    const resumo = financeiro.resumo(lancamento, [parcela({ id: 1, amount: 100, status: 'pago' })]);

    expect(resumo.total).toBe(1000);
    expect(resumo.saldo).toBe(900);
  });

  it('pagamento acima do combinado nao gera saldo NEGATIVO', () => {
    const resumo = financeiro.resumo(lancamento, [
      parcela({ id: 1, amount: 1500, status: 'pago' }),
    ]);

    expect(resumo.saldo).toBe(0);
  });
});

// ============================================================================
//  5) VENCIMENTO
// ============================================================================

describe('FinanceiroService - venceu', () => {
  it('data de ontem venceu; data de amanha nao', () => {
    const hoje = financeiro.hoje();

    expect(financeiro.venceu('2020-01-01')).toBe(true);
    expect(financeiro.venceu('2999-12-31')).toBe(false);
    // Vencer e "passou do dia": a parcela que vence HOJE ainda nao venceu.
    expect(financeiro.venceu(hoje)).toBe(false);
  });

  it('hoje() devolve a data no formato do contrato de dados', () => {
    expect(financeiro.hoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================================
//  pagarParcela - o aluno paga a propria mensalidade
// ============================================================================
describe('FinanceiroService - pagarParcela', () => {
  it('grava a parcela como PAGA, com a data de hoje e o metodo escolhido', () => {
    const http = TestBed.inject(HttpTestingController);
    let resultado: Payment | undefined;

    // Parcela sem lancamento: a cadeia para no PUT, sem recalculo.
    financeiro.pagarParcela(parcela({ id: 7 }), 'pix').subscribe((p) => (resultado = p));

    const requisicao = http.expectOne((req) => req.method === 'PUT' && req.url.endsWith('/payments/7'));
    expect(requisicao.request.body).toMatchObject({
      status: 'pago',
      paidAt: financeiro.hoje(),
      paymentMethod: 'pix',
    });

    requisicao.flush({ ...requisicao.request.body });
    expect(resultado?.status).toBe('pago');
    http.verify();
  });

  it('parcela JA paga nao e paga de novo: erro, e nenhuma gravacao', () => {
    const http = TestBed.inject(HttpTestingController);
    let erro: unknown;

    financeiro
      .pagarParcela(parcela({ status: 'pago', paidAt: '2026-11-01' }), 'cartao')
      .subscribe({ error: (e) => (erro = e) });

    expect(erro).toBeInstanceOf(Error);
    http.expectNone(() => true);
    http.verify();
  });
});
