import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';

import {
  CONDICOES_PAGAMENTO,
  Class,
  Course,
  FinancialRecord,
  METODOS_PAGAMENTO,
  Payment,
  SITUACOES_FINANCEIRAS,
  Student,
} from '../../../core/models';
import { AcessoService } from '../../../core/services/acesso.service';
import { ClassService } from '../../../core/services/class.service';
import { CourseService } from '../../../core/services/course.service';
import { EnrollmentService } from '../../../core/services/enrollment.service';
import { FinanceiroService } from '../../../core/services/financeiro.service';
import { FinancialRecordService } from '../../../core/services/financial-record.service';
import { PaymentService } from '../../../core/services/payment.service';
import { StudentService } from '../../../core/services/student.service';
import {
  ConfirmService,
  LoadingComponent,
  PageHeaderComponent,
  StatCardComponent,
  StatusChipComponent,
} from '../../../shared';
import {
  PagamentoDialogComponent,
  PagamentoDialogData,
} from '../pagamento-dialog/pagamento-dialog.component';

/**
 * TELA DE DETALHE DO LANCAMENTO - onde o pagamento e confirmado (requisito 6.4).
 *
 * E A TELA MAIS IMPORTANTE DO MODULO FINANCEIRO
 * ---------------------------------------------
 * Tudo o que o requisito 6 pede de movimento acontece aqui: o administrador ve
 * as parcelas de um combinado, confirma o recebimento de uma delas e o sistema
 * atualiza em cadeia a parcela, o saldo, a situacao do lancamento e a situacao
 * da matricula. Quem conduz essa cadeia e o FinanceiroService - esta tela
 * apenas pergunta "confirma?" e manda recarregar.
 *
 * POR QUE A CONFIRMACAO PASSA POR UM DIALOG
 * -----------------------------------------
 * Porque e operacao de dinheiro e e dificil de desfazer com honestidade: uma
 * parcela marcada como paga por engano vira um aluno que "pagou" sem ter
 * pagado, e a matricula dele muda de situacao por causa disso. O dialog e o
 * requisito 12 ("mensagens de confirmacao para operacoes importantes,
 * especialmente exclusoes e confirmacoes financeiras").
 *
 * O ESTORNO EXISTE PELO MESMO MOTIVO
 * ----------------------------------
 * Se da para errar, tem que dar para corrigir - e corrigir dentro do sistema,
 * com a mesma cadeia de recalculo, em vez de alguem editar o db.json na mao.
 */
@Component({
  selector: 'app-financial-detail',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    StatusChipComponent,
    StatCardComponent,
    LoadingComponent,
  ],
  templateUrl: './financial-detail.component.html',
  styleUrl: './financial-detail.component.scss',
})
export class FinancialDetailComponent {
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recordService = inject(FinancialRecordService);
  private readonly paymentService = inject(PaymentService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly classService = inject(ClassService);
  private readonly courseService = inject(CourseService);
  private readonly studentService = inject(StudentService);
  private readonly financeiro = inject(FinanceiroService);
  private readonly confirmService = inject(ConfirmService);
  private readonly acesso = inject(AcessoService);
  private readonly dialog = inject(MatDialog);

  /** Quem pode confirmar e estornar pagamento: so quem pode EDITAR parcelas. */
  readonly podeConfirmar = this.acesso.podeEditar('payments');

  /** O aluno PAGA as proprias parcelas (nao confirma nem estorna). */
  readonly podePagar = this.acesso.podePagarMensalidade();

  /** Mensagem verde depois de um pagamento feito pelo aluno. */
  readonly sucesso = signal('');

  private readonly id = Number(this.rota.snapshot.paramMap.get('id'));

  readonly lancamento = signal<FinancialRecord | null>(null);
  readonly parcelas = signal<Payment[]>([]);
  readonly aluno = signal<Student | null>(null);
  readonly turma = signal<Class | null>(null);
  readonly curso = signal<Course | null>(null);

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');

  readonly colunas =
    this.podeConfirmar || this.podePagar
    ? ['numero', 'vencimento', 'valor', 'pagamento', 'status', 'acoes']
    : ['numero', 'vencimento', 'valor', 'pagamento', 'status'];

  /**
   * O resumo (total, pago, saldo) e calculado pelo FinanceiroService, e nao
   * aqui: e a mesma conta que o painel e os relatorios fazem, e conta de
   * dinheiro escrita em tres lugares e conta que um dia vai divergir.
   */
  readonly resumo = computed(() => {
    const atual = this.lancamento();
    return atual === null ? null : this.financeiro.resumo(atual, this.parcelas());
  });

  /** A proxima parcela a vencer, destacada no topo para o aluno saber o que vem. */
  readonly proximaParcela = computed(() =>
    this.parcelas()
      .filter((parcela) => parcela.status !== 'pago')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .at(0),
  );

  constructor() {
    this.carregar();
  }

  /**
   * Carrega o lancamento e tudo o que a tela mostra em volta dele.
   *
   * A cadeia e necessaria porque cada passo depende do anterior:
   *
   *   lancamento -> enrollmentId -> matricula -> classId -> turma -> courseId
   *
   * O JSON Server expande UM nivel so (_expand), e aqui sao tres saltos - por
   * isso o switchMap em vez de uma consulta unica.
   */
  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      lancamento: this.recordService.getById(this.id),
      parcelas: this.paymentService.listarPorLancamento(this.id),
    })
      .pipe(
        switchMap(({ escopo, lancamento, parcelas }) => {
          // CONTROLE DE ACESSO POR REGISTRO: a rota ja garantiu que o perfil
          // alcanca a area, mas nao que ele alcanca ESTE lancamento. Sem esta
          // checagem, um aluno trocaria o id na URL e leria o financeiro de um
          // colega - o caso classico de "referencia direta insegura a objeto".
          const permitido = this.acesso.filtrarLancamentos(escopo, [lancamento]).length > 0;
          if (!permitido) {
            return of({ negado: true as const });
          }

          return this.enrollmentService.getById(lancamento.enrollmentId).pipe(
            switchMap((matricula) =>
              // Aluno e turma nao dependem um do outro: vao juntos.
              forkJoin({
                aluno: this.studentService.getById(matricula.studentId),
                turma: this.classService.getById(matricula.classId),
              }).pipe(
                switchMap(({ aluno, turma }) =>
                  // O curso depende da turma, entao fica no passo seguinte.
                  this.courseService.getById(turma.courseId).pipe(
                    map((curso) => ({
                      negado: false as const,
                      lancamento,
                      parcelas,
                      aluno,
                      turma,
                      curso,
                    })),
                  ),
                ),
              ),
            ),
          );
        }),
      )
      .subscribe({
        next: (dados) => {
          if (dados.negado) {
            this.router.navigate(['/sem-acesso'], { queryParams: { area: 'financial' } });
            return;
          }

          this.lancamento.set(dados.lancamento);
          this.parcelas.set(dados.parcelas);
          this.aluno.set(dados.aluno);
          this.turma.set(dados.turma);
          this.curso.set(dados.curso);
          this.carregando.set(false);
        },
        error: () => {
          this.carregando.set(false);
          this.erro.set(
            'Nao foi possivel carregar o lancamento. Rode npm run api e tente de novo.',
          );
        },
      });
  }

  /**
   * CONFIRMACAO DE PAGAMENTO: pergunta, grava e recarrega.
   *
   * Recarregar a tela inteira depois de gravar (em vez de so trocar a linha na
   * memoria) e deliberado: a confirmacao muda a parcela, o lancamento E a
   * matricula, e o resultado dessas tres mudancas esta no servidor. Atualizar
   * so a linha mostraria a parcela paga com o saldo antigo do lado.
   */
  confirmar(parcela: Payment): void {
    this.erro.set('');

    this.confirmService
      .confirm({
        title: 'Confirmar pagamento',
        message:
          `Confirma o recebimento da parcela ${parcela.number ?? ''} de ` +
          `${this.formatarValor(parcela.amount)} de ${this.nomeDoAluno}? ` +
          `A data de hoje sera gravada como data do pagamento e a situacao da ` +
          `matricula sera atualizada.`,
        confirmText: 'Confirmar recebimento',
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.salvando.set(true);
        this.financeiro.confirmarPagamento(parcela).subscribe({
          next: () => {
            this.salvando.set(false);
            this.carregar();
          },
          error: () => {
            this.salvando.set(false);
            this.erro.set(
              'Nao foi possivel confirmar o pagamento. Nada foi gravado. Tente de novo.',
            );
          },
        });
      });
  }

  /**
   * PAGAMENTO PELO ALUNO: abre o dialog de pagamento (PIX ou cartao).
   *
   * O dialog grava sozinho e fecha com `true` quando deu certo; aqui so
   * avisamos e recarregamos, pelo mesmo motivo da confirmacao do administrador:
   * o pagamento muda parcela, lancamento e matricula de uma vez.
   */
  pagar(parcela: Payment): void {
    this.erro.set('');
    this.sucesso.set('');

    this.dialog
      .open<PagamentoDialogComponent, PagamentoDialogData, boolean>(PagamentoDialogComponent, {
        data: {
          parcela,
          curso: this.nomeDoCurso,
          totalDeParcelas: this.lancamento()?.installments ?? this.parcelas().length,
        },
        width: '480px',
        maxWidth: '94vw',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((pago) => {
        if (!pago) {
          return;
        }
        this.sucesso.set(
          `Pagamento da parcela ${parcela.number ?? ''} de ${this.formatarValor(parcela.amount)} ` +
            `registrado com sucesso.`,
        );
        this.carregar();
      });
  }

  /** Desfaz uma confirmacao feita por engano. */
  estornar(parcela: Payment): void {
    this.erro.set('');

    this.confirmService
      .confirm({
        title: 'Estornar pagamento',
        message:
          `Confirma o estorno da parcela ${parcela.number ?? ''} de ` +
          `${this.formatarValor(parcela.amount)}? A parcela voltara a ficar em ` +
          `aberto e o saldo do lancamento sera recalculado.`,
        confirmText: 'Estornar',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.salvando.set(true);
        this.financeiro.estornarPagamento(parcela).subscribe({
          next: () => {
            this.salvando.set(false);
            this.carregar();
          },
          error: () => {
            this.salvando.set(false);
            this.erro.set('Nao foi possivel estornar a parcela. Tente de novo.');
          },
        });
      });
  }

  voltar(): void {
    this.router.navigate(['/financial']);
  }

  // --- Textos da tela ------------------------------------------------------

  get nomeDoAluno(): string {
    return this.aluno()?.name ?? 'Aluno nao encontrado';
  }

  get nomeDoCurso(): string {
    return this.curso()?.name ?? '-';
  }

  get codigoDaTurma(): string {
    return this.turma()?.code ?? '-';
  }

  get situacao(): string {
    const atual = this.lancamento();
    return atual === null ? '' : SITUACOES_FINANCEIRAS[atual.status];
  }

  get condicao(): string {
    const atual = this.lancamento();
    if (atual === null) {
      return '';
    }
    const rotulo = CONDICOES_PAGAMENTO[atual.condition];
    return atual.condition === 'avista' ? rotulo : `${rotulo} em ${atual.installments}x`;
  }

  get metodo(): string {
    const atual = this.lancamento();
    return atual === null ? '' : METODOS_PAGAMENTO[atual.method];
  }

  /** Situacao da parcela em texto, para o chip colorir. */
  statusDaParcela(parcela: Payment): string {
    return parcela.status;
  }

  /** Rotulo do metodo usado quando o proprio aluno pagou ('PIX', 'Cartao'). */
  metodoDaParcela(parcela: Payment): string {
    return parcela.paymentMethod ? METODOS_PAGAMENTO[parcela.paymentMethod] : '';
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
}
