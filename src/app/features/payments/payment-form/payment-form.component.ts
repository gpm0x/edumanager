import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { FinancialRecord, Payment, PaymentStatus } from '../../../core/models';
import {
  EnrollmentComRelacoes,
  EnrollmentService,
} from '../../../core/services/enrollment.service';
import { FinanceiroService } from '../../../core/services/financeiro.service';
import { FinancialRecordService } from '../../../core/services/financial-record.service';
import { PaymentService } from '../../../core/services/payment.service';
import {
  LIMITES,
  mensagemDeErro,
  numeroValidators,
  selecaoValidators,
} from '../../../core/validators';
import { FormActionsComponent, LoadingComponent, PageHeaderComponent } from '../../../shared';

/**
 * FORMULARIO DE PARCELA (cadastrar e editar).
 *
 * REGRA 6.3 - STATUS E DATA DE PAGAMENTO SAO ACOPLADOS
 * ----------------------------------------------------
 * O contrato nao aceita a combinacao invalida; a tela IMPEDE, em vez de avisar
 * depois:
 *
 *   status = 'pago'                -> o campo "pago em" HABILITA e ja vem com a
 *                                     data de hoje (o usuario pode trocar);
 *   status = 'pendente'/'vencido' -> o campo LIMPA e DESABILITA, e a parcela e
 *                                     gravada com paidAt = null.
 *
 * COMO ISSO FUNCIONA NA PRATICA
 * -----------------------------
 * Ouvimos as mudancas do campo status (valueChanges) e habilitamos/limpamos o
 * campo de data. Um campo DESABILITADO do Angular nao entra na validacao -
 * entao Validators.required em paidAt so e cobrado quando o status e 'pago'.
 * E exatamente o comportamento que a regra pede, sem nenhum "if" espalhado.
 *
 * takeUntilDestroyed() desliga essa escuta quando o componente sai da tela.
 */
@Component({
  selector: 'app-payment-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    FormActionsComponent,
    LoadingComponent,
  ],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss',
})
export class PaymentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly paymentService = inject(PaymentService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly recordService = inject(FinancialRecordService);
  private readonly financeiro = inject(FinanceiroService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly id: number | null = this.lerIdDaRota();

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');

  /** Matriculas com aluno e turma, para o select ficar identificavel (7.9). */
  readonly matriculas = signal<EnrollmentComRelacoes[]>([]);

  readonly form = this.fb.nonNullable.group({
    enrollmentId: [null as number | null, selecaoValidators()],
    dueDate: ['', [Validators.required]],
    amount: [null as number | null, numeroValidators(LIMITES.amount)],
    status: ['pendente' as PaymentStatus, selecaoValidators()],
    // Comeca desabilitado porque o status inicial e 'pendente'.
    paidAt: this.fb.nonNullable.control({ value: '', disabled: true }, [Validators.required]),
  });

  constructor() {
    // REGRA 6.3: a data de pagamento acompanha o status.
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.ajustarDataDePagamento(status));

    this.carregarOpcoes();
  }

  get titulo(): string {
    return this.id === null ? 'Nova parcela' : 'Editar parcela';
  }

  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  get matriculaEscolhida(): number | null {
    return this.form.controls.enrollmentId.value;
  }

  /**
   * O status escolhido, como SIGNAL (o projeto e zoneless: ver o comentario
   * equivalente no formulario de matricula).
   */
  private readonly statusSelecionado = toSignal(this.form.controls.status.valueChanges, {
    initialValue: this.form.controls.status.value,
  });

  /** true quando o campo de data de pagamento esta valendo (status = pago). */
  readonly pagoEscolhido = computed(() => this.statusSelecionado() === 'pago');

  /** Rotulo da matricula no select: "Aluno - TURMA". */
  rotuloDaMatricula(matricula: EnrollmentComRelacoes): string {
    const aluno = matricula.student?.name ?? 'Aluno nao encontrado';
    const turma = matricula['class']?.code ?? '-';
    return `${aluno} - ${turma}`;
  }

  /**
   * Aplica a regra 6.3 quando o status muda.
   *
   * O { emitEvent: false } evita que habilitar/desabilitar o campo dispare
   * outra rodada de valueChanges (laco infinito de eventos).
   */
  private ajustarDataDePagamento(status: PaymentStatus): void {
    const paidAt = this.form.controls.paidAt;

    if (status === 'pago') {
      paidAt.enable({ emitEvent: false });
      if (!paidAt.value) {
        paidAt.setValue(this.hoje(), { emitEvent: false });
      }
      return;
    }

    paidAt.setValue('', { emitEvent: false });
    paidAt.disable({ emitEvent: false });
  }

  /**
   * O vinculo da parcela com o LANCAMENTO dela, guardado fora do formulario.
   *
   * POR QUE ISSO NAO E UM CAMPO DA TELA
   * -----------------------------------
   * `financialRecordId` e `number` nao sao informacao que alguem digite: eles
   * dizem de qual combinado a parcela faz parte e que posicao ocupa nele. Mas
   * precisam estar aqui, porque o `update` do BaseApiService manda o registro
   * INTEIRO (PUT, e nao PATCH) - e um objeto montado so com os campos da tela
   * apagaria esses dois do banco, soltando a parcela do lancamento dela. O
   * saldo do lancamento passaria a ignorar uma parcela que existe.
   */
  private vinculo: { financialRecordId?: number; number?: number } = {};

  private carregarOpcoes(): void {
    this.carregando.set(true);

    this.enrollmentService.listarComAlunoETurma().subscribe({
      next: (matriculas) => {
        this.matriculas.set(matriculas);

        if (this.id === null) {
          this.carregando.set(false);
          return;
        }

        this.paymentService.getById(this.id).subscribe({
          next: (parcela) => {
            // Preenche o status primeiro: o valueChanges ja deixa o campo de
            // data habilitado antes de receber o valor gravado.
            this.form.controls.status.setValue(parcela.status);
            this.form.patchValue({
              enrollmentId: parcela.enrollmentId,
              dueDate: parcela.dueDate,
              amount: parcela.amount,
              paidAt: parcela.paidAt ?? '',
            });
            // Guarda o vinculo para a gravacao nao apaga-lo (ver `vinculo`).
            this.vinculo = {
              financialRecordId: parcela.financialRecordId,
              number: parcela.number,
            };
            this.carregando.set(false);
          },
          error: () => {
            this.carregando.set(false);
            this.erro.set(
              'Nao foi possivel carregar a parcela. Volte para a lista e tente de novo.',
            );
          },
        });
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar as matriculas. Verifique a API.');
      },
    });
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // getRawValue traz tambem o valor de campo desabilitado - aqui isso e util:
    // quando o status nao e 'pago', paidAt vem como '' e vira null na gravacao.
    const valores = this.form.getRawValue();

    const parcela: Payment = {
      enrollmentId: Number(valores.enrollmentId),
      dueDate: valores.dueDate,
      amount: Number(valores.amount),
      // O contrato exige null (e nao string vazia) quando nao houve pagamento.
      paidAt: valores.status === 'pago' ? valores.paidAt : null,
      status: valores.status,
      // Na edicao, mantem a parcela ligada ao lancamento dela.
      ...this.vinculo,
    };

    this.erro.set('');
    this.salvando.set(true);

    const requisicao =
      this.id === null
        ? this.criarLigadaAoLancamento(parcela)
        : this.paymentService
            .update(this.id, { ...parcela, id: this.id })
            // Editar valor ou situacao muda o saldo do lancamento: recalcula.
            .pipe(switchMap((gravada) => this.recalcularSeTiverLancamento(gravada)));

    requisicao.subscribe({
      next: () => this.router.navigate(['/payments']),
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel salvar a parcela. Verifique a API e tente de novo.');
      },
    });
  }

  /**
   * Cria a parcela JA ligada ao lancamento da matricula escolhida, quando ela
   * tem um.
   *
   * POR QUE PROCURAR O LANCAMENTO EM VEZ DE CRIAR A PARCELA SOLTA
   * -------------------------------------------------------------
   * Uma parcela avulsa de uma matricula que tem lancamento seria dinheiro que
   * a tela de Lancamentos nao conta: o saldo mostraria uma divida menor do que
   * a real. Ligando, a parcela entra no saldo e na situacao, como qualquer
   * outra.
   *
   * Matricula sem lancamento (dado antigo) continua aceitando parcela solta -
   * e por isso que `financialRecordId` e opcional no model.
   */
  private criarLigadaAoLancamento(parcela: Payment): Observable<Payment> {
    return this.recordService.listarPorMatricula(parcela.enrollmentId).pipe(
      // Falha ao consultar o lancamento nao impede o lancamento da parcela: a
      // parcela e o dado que o usuario quer gravar.
      catchError(() => of([] as FinancialRecord[])),
      switchMap((lancamentos) => {
        const lancamento = lancamentos.at(0);
        const comVinculo: Payment =
          lancamento === undefined ? parcela : { ...parcela, financialRecordId: lancamento.id };

        return this.paymentService
          .create(comVinculo)
          .pipe(switchMap((gravada) => this.recalcularSeTiverLancamento(gravada)));
      }),
    );
  }

  /** Recalcula a situacao e o saldo do lancamento, se a parcela pertencer a um. */
  private recalcularSeTiverLancamento(parcela: Payment): Observable<Payment> {
    if (parcela.financialRecordId === undefined) {
      return of(parcela);
    }
    return this.financeiro.recalcular(parcela.financialRecordId).pipe(map(() => parcela));
  }

  fechar(): void {
    this.router.navigate(['/payments']);
  }

  private hoje(): string {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${agora.getFullYear()}-${mes}-${dia}`;
  }

  private lerIdDaRota(): number | null {
    const parametro = this.rota.snapshot.paramMap.get('id');
    return parametro === null ? null : Number(parametro);
  }
}
