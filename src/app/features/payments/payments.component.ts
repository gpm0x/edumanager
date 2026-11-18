import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { Payment, PaymentStatus } from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { EnrollmentService } from '../../core/services/enrollment.service';
import { FinanceiroService } from '../../core/services/financeiro.service';
import { PaymentService } from '../../core/services/payment.service';
import {
  ConfirmService,
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  PageHeaderComponent,
  SearchFieldComponent,
  StatusChipComponent,
} from '../../shared';

/** Como identificamos a matricula de uma parcela na tela. */
interface IdentificacaoDaMatricula {
  aluno: string;
  turma: string;
}

/**
 * TELA DE FINANCEIRO (listagem de parcelas).
 *
 * O CAMINHO ATE O NOME DO ALUNO (checklist 16.3)
 * ----------------------------------------------
 * A parcela NAO aponta para o aluno: ela aponta para a matricula.
 *
 *   payments.enrollmentId -> enrollments.studentId -> students.name
 *
 * Esse e o ponto de modelagem que o professor costuma perguntar. Em vez de
 * fazer esse caminho linha por linha (o que daria N requisicoes), carregamos
 * as matriculas COM o aluno e a turma embutidos (?_expand=student&_expand=class)
 * e montamos um indice por id da matricula. Duas requisicoes, no total.
 *
 * O FILTRO DE SITUACAO
 * --------------------
 * Alem da busca por nome, esta tela tem um filtro por situacao (pendente, pago,
 * atrasado). Como as parcelas ja estao todas em memoria, o filtro e local -
 * mesma decisao da regra 6.9 para a busca.
 */
@Component({
  selector: 'app-payments',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    SearchFieldComponent,
    StatusChipComponent,
    EmptyStateComponent,
    EscopoAvisoComponent,
    LoadingComponent,
  ],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
})
export class PaymentsComponent {
  private readonly paymentService = inject(PaymentService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly financeiro = inject(FinanceiroService);
  private readonly confirmService = inject(ConfirmService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  /**
   * As tres permissoes desta area: todas do administrador, e so dele.
   *
   * O professor e o aluno abrem esta tela em LEITURA - o professor para
   * consultar a situacao dos alunos dele (requisito 2: "sem alterar registros
   * financeiros por padrao") e o aluno para ver as proprias mensalidades.
   *
   * Dar baixa no proprio pagamento seria, obviamente, o fim do controle
   * financeiro: e por isso que 'editar' aqui e exclusivo do administrador, e
   * ha teste automatizado para essa linha da matriz.
   */
  readonly podeCriar = this.acesso.podeCriar('payments');
  readonly podeEditar = this.acesso.podeEditar('payments');
  readonly podeExcluir = this.acesso.podeExcluir('payments');

  /** A coluna "Acoes" so existe quando ha pelo menos um botao para por nela. */
  readonly podeGerenciar = this.podeEditar || this.podeExcluir;

  readonly parcelas = signal<Payment[]>([]);

  /** Indice { [enrollmentId]: { aluno, turma } }, montado a partir do _expand. */
  readonly matriculasPorId = signal<Record<number, IdentificacaoDaMatricula>>({});

  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly termo = signal('');

  /** Filtro de situacao. 'todos' = sem filtro. */
  readonly filtroStatus = signal<PaymentStatus | 'todos'>('todos');

  /** A coluna de acoes so existe para quem pode gerenciar o financeiro. */
  readonly colunas = this.podeGerenciar
    ? ['aluno', 'turma', 'vencimento', 'valor', 'pagamento', 'status', 'acoes']
    : ['aluno', 'turma', 'vencimento', 'valor', 'pagamento', 'status'];

  readonly parcelasFiltradas = computed(() => {
    const busca = this.semAcento(this.termo());
    const status = this.filtroStatus();

    return this.parcelas().filter((parcela) => {
      const combinaStatus = status === 'todos' || parcela.status === status;
      if (!combinaStatus) {
        return false;
      }
      if (!busca) {
        return true;
      }
      return (
        this.semAcento(this.nomeDoAluno(parcela)).includes(busca) ||
        this.semAcento(this.codigoDaTurma(parcela)).includes(busca)
      );
    });
  });

  /**
   * Soma dos valores das parcelas que estao na tela.
   * Reage ao filtro: filtrando por "vencido", mostra o total em atraso.
   */
  readonly totalFiltrado = computed(() =>
    this.parcelasFiltradas().reduce((soma, parcela) => soma + parcela.amount, 0),
  );

  constructor() {
    this.carregar();
  }

  /** A frase que explica o recorte desta tela (ver EscopoAvisoComponent). */
  get avisoDeEscopo(): string {
    return this.acesso.ehProfessor()
      ? 'Voce esta vendo apenas as parcelas dos alunos das suas turmas, em consulta.'
      : 'Voce esta vendo apenas as mensalidades das suas matriculas.';
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      parcelas: this.paymentService.listarOrdenadoPorVencimento(),
      matriculas: this.enrollmentService.listarComAlunoETurma(),
    }).subscribe({
      next: ({ escopo, parcelas, matriculas }) => {
        // Parcela pertence a uma MATRICULA, e e por isso que o filtro do
        // financeiro usa o conjunto de matriculas do escopo: o aluno ve as
        // parcelas das matriculas dele e de mais ninguem.
        this.parcelas.set(this.acesso.filtrarPagamentos(escopo, parcelas));

        // O INDICE tambem e filtrado, e aqui isso tem peso: ele guarda NOME
        // DE ALUNO. As linhas exibidas ja sao so as do aluno logado, mas um
        // indice com o nome dos outros ficaria na memoria da pagina sem
        // nenhuma necessidade - e nome de pessoa e dado pessoal.
        const indice: Record<number, IdentificacaoDaMatricula> = {};
        for (const matricula of this.acesso.filtrarMatriculas(escopo, matriculas)) {
          indice[matricula.id!] = {
            aluno: matricula.student?.name ?? 'Aluno nao encontrado',
            turma: matricula['class']?.code ?? '-',
          };
        }
        this.matriculasPorId.set(indice);

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar o financeiro. Rode npm run api e tente de novo.');
      },
    });
  }

  novo(): void {
    this.router.navigate(['/payments/new']);
  }

  editar(parcela: Payment): void {
    this.router.navigate(['/payments', parcela.id, 'edit']);
  }

  /** Nome do aluno da parcela, resolvido pelo indice de matriculas. */
  nomeDoAluno(parcela: Payment): string {
    return this.matriculasPorId()[parcela.enrollmentId]?.aluno ?? 'Matricula nao encontrada';
  }

  /** Codigo da turma da parcela. */
  codigoDaTurma(parcela: Payment): string {
    return this.matriculasPorId()[parcela.enrollmentId]?.turma ?? '-';
  }

  /**
   * Parcela nao tem dependente nenhum, entao a exclusao e direta (so a
   * confirmacao). E a ponta da cadeia: curso > turma > matricula > parcela.
   */
  excluir(parcela: Payment): void {
    this.erro.set('');

    this.confirmService
      .confirm({
        title: 'Excluir parcela',
        message:
          `Confirma a exclusao da parcela de ${this.formatarValor(parcela.amount)} de ` +
          `${this.nomeDoAluno(parcela)}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        // Excluir parcela muda o saldo do lancamento: recalcula em seguida,
        // senao a tela de Lancamentos continuaria mostrando a situacao antiga
        // (um lancamento "parcialmente pago" cujas parcelas em aberto nao
        // existem mais).
        this.paymentService
          .delete(parcela.id!)
          .pipe(
            switchMap(() =>
              parcela.financialRecordId === undefined
                ? of(null)
                : this.financeiro.recalcular(parcela.financialRecordId),
            ),
          )
          .subscribe({
            next: () => this.carregar(),
            error: () => this.erro.set('Nao foi possivel excluir a parcela. Tente de novo.'),
          });
      });
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(data: string | null): string {
    if (!data) {
      return '-';
    }
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private semAcento(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
