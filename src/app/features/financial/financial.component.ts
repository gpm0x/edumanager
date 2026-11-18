import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  CONDICOES_PAGAMENTO,
  FinancialRecord,
  FinancialStatus,
  METODOS_PAGAMENTO,
  Payment,
  SITUACOES_FINANCEIRAS,
} from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { EnrollmentService } from '../../core/services/enrollment.service';
import { FinancialRecordService } from '../../core/services/financial-record.service';
import { PaymentService } from '../../core/services/payment.service';
import {
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  PageHeaderComponent,
  SearchFieldComponent,
  StatCardComponent,
  StatusChipComponent,
} from '../../shared';

/** Como cada linha da tabela identifica a matricula do lancamento. */
interface IdentificacaoDaMatricula {
  aluno: string;
  turma: string;
}

/** Um lancamento com o que a tabela precisa mostrar, ja calculado. */
interface LinhaDoLancamento {
  lancamento: FinancialRecord;
  aluno: string;
  turma: string;
  pago: number;
  saldo: number;
  parcelasPagas: number;
  parcelasTotais: number;
}

/**
 * TELA DE LANCAMENTOS FINANCEIROS (listagem) - requisito 6.
 *
 * O QUE ESTA TELA MOSTRA, E POR QUE ELA NAO E A TELA DE PARCELAS
 * --------------------------------------------------------------
 * Um LANCAMENTO e o combinado de uma matricula: "este aluno deve R$ 1.200, em
 * 3 vezes, por PIX". Uma PARCELA e um pedaco desse combinado. As duas telas
 * existem porque as perguntas sao diferentes:
 *
 *   Lancamentos (aqui) -> "quanto cada aluno deve e quanto ja pagou?"
 *   Parcelas           -> "o que vence esta semana?"
 *
 * Quem cobra inadimplencia precisa da primeira; quem confere o caixa do dia
 * precisa da segunda. Em uma tela so, a soma dos valores enganaria: a mesma
 * divida apareceria uma vez por parcela.
 *
 * O MESMO COMPONENTE SERVE OS TRES PERFIS
 * ---------------------------------------
 * Nao existe tela separada por perfil. O que muda e o ESCOPO (o administrador
 * ve a escola, o professor ve os alunos das turmas dele, o aluno ve os
 * proprios lancamentos) e o fato de o aluno e o professor nao receberem a
 * coluna de acoes - porque a matriz nega a eles editar financeiro.
 */
@Component({
  selector: 'app-financial',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    SearchFieldComponent,
    StatusChipComponent,
    StatCardComponent,
    EmptyStateComponent,
    EscopoAvisoComponent,
    LoadingComponent,
  ],
  templateUrl: './financial.component.html',
  styleUrl: './financial.component.scss',
})
export class FinancialComponent {
  private readonly recordService = inject(FinancialRecordService);
  private readonly paymentService = inject(PaymentService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  readonly ehAluno = this.acesso.ehAluno();

  readonly linhas = signal<LinhaDoLancamento[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly termo = signal('');
  readonly filtroStatus = signal<FinancialStatus | 'todos'>('todos');

  /** As colunas sao as mesmas para todos: a tela e de leitura, e o detalhe abre no clique. */
  readonly colunas = ['aluno', 'curso', 'combinado', 'pago', 'saldo', 'status', 'acoes'];

  readonly linhasFiltradas = computed(() => {
    const busca = this.semAcento(this.termo());
    const status = this.filtroStatus();

    return this.linhas().filter((linha) => {
      if (status !== 'todos' && linha.lancamento.status !== status) {
        return false;
      }
      if (!busca) {
        return true;
      }
      return (
        this.semAcento(linha.aluno).includes(busca) || this.semAcento(linha.turma).includes(busca)
      );
    });
  });

  // --- Totais do topo: acompanham o filtro, e e de proposito ----------------
  // Quem filtra por "vencido" quer saber QUANTO esta vencido. Um total fixo da
  // escola nao responderia a pergunta que a pessoa acabou de fazer.
  readonly totalCombinado = computed(() =>
    this.somar(this.linhasFiltradas().map((linha) => linha.lancamento.totalAmount)),
  );
  readonly totalRecebido = computed(() =>
    this.somar(this.linhasFiltradas().map((linha) => linha.pago)),
  );
  readonly totalAReceber = computed(() =>
    this.somar(this.linhasFiltradas().map((linha) => linha.saldo)),
  );

  constructor() {
    this.carregar();
  }

  get titulo(): string {
    return this.ehAluno ? 'Minhas mensalidades' : 'Lancamentos financeiros';
  }

  get subtitulo(): string {
    return this.ehAluno
      ? 'O combinado de cada matricula sua: total, pago e saldo'
      : 'O combinado de cada matricula: total, pago e saldo';
  }

  get avisoDeEscopo(): string {
    return 'Voce esta vendo apenas os seus lancamentos. Clique em Efetuar pagamento para pagar uma parcela em aberto.';
  }

  /**
   * Carrega lancamentos, parcelas e matriculas de uma vez.
   *
   * As tres consultas vao em paralelo (forkJoin) porque nenhuma depende da
   * outra, e as tres sao necessarias para montar UMA linha da tabela:
   *
   *   lancamento -> o combinado e a situacao
   *   parcelas   -> quanto foi pago (o lancamento nao guarda valor pago)
   *   matricula  -> o nome do aluno e o codigo da turma
   *
   * Em cadeia, a tela levaria o triplo do tempo para a mesma informacao.
   */
  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      lancamentos: this.recordService.listarRecentesPrimeiro(),
      parcelas: this.paymentService.list(),
      matriculas: this.enrollmentService.listarComAlunoETurma(),
    }).subscribe({
      next: ({ escopo, lancamentos, parcelas, matriculas }) => {
        // Todo filtro de escopo acontece ANTES de qualquer soma: contar
        // primeiro e recortar depois mostraria o total da escola com cara de
        // total do aluno.
        const permitidos = this.acesso.filtrarLancamentos(escopo, lancamentos);
        const parcelasPermitidas = this.acesso.filtrarPagamentos(escopo, parcelas);

        const identificacao: Record<number, IdentificacaoDaMatricula> = {};
        for (const matricula of this.acesso.filtrarMatriculas(escopo, matriculas)) {
          identificacao[matricula.id!] = {
            aluno: matricula.student?.name ?? 'Aluno nao encontrado',
            turma: matricula['class']?.code ?? '-',
          };
        }

        this.linhas.set(this.montarLinhas(permitidos, parcelasPermitidas, identificacao));
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar o financeiro. Rode npm run api e tente de novo.');
      },
    });
  }

  /**
   * Junta lancamento + parcelas + matricula em uma linha pronta para a tabela.
   *
   * As parcelas sao agrupadas por lancamento em um Map antes do laco. Procurar
   * as parcelas de cada lancamento dentro da lista inteira (um filter por
   * linha) faria o trabalho crescer ao quadrado; com o Map, cada parcela e
   * visitada uma vez.
   */
  private montarLinhas(
    lancamentos: FinancialRecord[],
    parcelas: Payment[],
    identificacao: Record<number, IdentificacaoDaMatricula>,
  ): LinhaDoLancamento[] {
    const porLancamento = new Map<number, Payment[]>();
    for (const parcela of parcelas) {
      if (parcela.financialRecordId === undefined) {
        continue;
      }
      const lista = porLancamento.get(parcela.financialRecordId) ?? [];
      lista.push(parcela);
      porLancamento.set(parcela.financialRecordId, lista);
    }

    return lancamentos.map((lancamento) => {
      const doLancamento = porLancamento.get(lancamento.id!) ?? [];
      const pagas = doLancamento.filter((parcela) => parcela.status === 'pago');
      const pago = this.somar(pagas.map((parcela) => parcela.amount));

      return {
        lancamento,
        aluno: identificacao[lancamento.enrollmentId]?.aluno ?? 'Matricula nao encontrada',
        turma: identificacao[lancamento.enrollmentId]?.turma ?? '-',
        pago,
        saldo: Math.max(0, this.somar([lancamento.totalAmount, -pago])),
        parcelasPagas: pagas.length,
        parcelasTotais: doLancamento.length,
      };
    });
  }

  /** Abre o detalhe do lancamento (parcelas e confirmacao de pagamento). */
  abrir(linha: LinhaDoLancamento): void {
    this.router.navigate(['/financial', linha.lancamento.id]);
  }

  // --- Tradutores para a tela (o banco guarda codigo, o usuario le texto) ---

  situacao(status: FinancialStatus): string {
    return SITUACOES_FINANCEIRAS[status];
  }

  condicao(lancamento: FinancialRecord): string {
    const rotulo = CONDICOES_PAGAMENTO[lancamento.condition];
    return lancamento.condition === 'avista' ? rotulo : `${rotulo} em ${lancamento.installments}x`;
  }

  metodo(lancamento: FinancialRecord): string {
    return METODOS_PAGAMENTO[lancamento.method];
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Soma valores em reais sem erro de arredondamento.
   *
   * Mesma razao do FinanceiroService: somar decimais em JavaScript acumula
   * centavo fantasma (0.1 + 0.2 nao da 0.3). Em centavos inteiros, nao.
   */
  private somar(valores: number[]): number {
    const centavos = valores.reduce((soma, valor) => soma + Math.round(valor * 100), 0);
    return centavos / 100;
  }

  private semAcento(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
