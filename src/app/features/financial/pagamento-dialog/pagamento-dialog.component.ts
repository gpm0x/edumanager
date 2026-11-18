import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Payment, PaymentMethod } from '../../../core/models';
import { FinanceiroService } from '../../../core/services/financeiro.service';

/** O que a tela que abre o dialog precisa informar. */
export interface PagamentoDialogData {
  parcela: Payment;
  /** Nome do curso, para o aluno saber O QUE esta pagando. */
  curso: string;
  /** Quantas parcelas o lancamento tem (para mostrar "2 de 5"). */
  totalDeParcelas: number;
}

/** Os metodos que o aluno pode usar pela tela. Dinheiro so na secretaria. */
type MetodoOnline = Extract<PaymentMethod, 'pix' | 'cartao'>;

/**
 * DIALOG DE PAGAMENTO - o aluno paga a propria mensalidade.
 *
 * O aluno escolhe PIX ou cartao, confirma, e a parcela e baixada pela mesma
 * cadeia que o administrador usa (FinanceiroService.pagarParcela): parcela
 * paga -> lancamento recalculado -> matricula 'pendente' vira 'ativa'.
 *
 * PAGAMENTO SIMULADO
 * ------------------
 * Nao ha integracao com banco nem com operadora (requisito 15). O codigo PIX e
 * ficticio e os dados do cartao so sao VALIDADOS no formulario - nunca sao
 * enviados para a API nem gravados. Na parcela fica registrado apenas o metodo.
 *
 * O dialog faz a gravacao ele mesmo (em vez de devolver o metodo para a tela)
 * para poder mostrar "processando" e o erro no proprio lugar em que o aluno
 * clicou. Fecha com `true` quando o pagamento foi gravado.
 */
@Component({
  selector: 'app-pagamento-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './pagamento-dialog.component.html',
  styleUrl: './pagamento-dialog.component.scss',
})
export class PagamentoDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<PagamentoDialogComponent, boolean>>(MatDialogRef);
  private readonly financeiro = inject(FinanceiroService);
  private readonly fb = inject(FormBuilder);

  readonly data = inject<PagamentoDialogData>(MAT_DIALOG_DATA);

  readonly metodo = signal<MetodoOnline>('pix');
  readonly processando = signal(false);
  readonly erro = signal('');
  readonly codigoCopiado = signal(false);

  /** Codigo "copia e cola" ficticio, montado a partir da parcela. */
  readonly codigoPix =
    `00020126EDUMANAGER-PARCELA-${this.data.parcela.id}` +
    `-${Math.round(this.data.parcela.amount * 100)}5204000053039865802BR6304DEMO`;

  /**
   * Dados do cartao: so validacao de formato. Os valores NUNCA saem daqui -
   * nao vao para a API, nao vao para o localStorage.
   */
  readonly cartao = this.fb.nonNullable.group({
    numero: ['', [Validators.required, Validators.pattern(/^(\d{4} ?){3}\d{4}$/)]],
    nome: ['', [Validators.required, Validators.minLength(3)]],
    validade: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
  });

  get valor(): string {
    return this.data.parcela.amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  get vencimento(): string {
    const [ano, mes, dia] = this.data.parcela.dueDate.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  get vencida(): boolean {
    return this.data.parcela.status === 'vencido';
  }

  escolher(metodo: MetodoOnline): void {
    this.metodo.set(metodo);
    this.erro.set('');
  }

  copiarCodigo(): void {
    // A Clipboard API pode nao existir (http sem TLS, navegador antigo):
    // nesse caso o aluno ainda consegue selecionar o texto na caixa.
    navigator.clipboard?.writeText(this.codigoPix).then(
      () => this.codigoCopiado.set(true),
      () => this.codigoCopiado.set(false),
    );
  }

  pagar(): void {
    if (this.metodo() === 'cartao' && this.cartao.invalid) {
      this.cartao.markAllAsTouched();
      return;
    }

    this.erro.set('');
    this.processando.set(true);
    this.dialogRef.disableClose = true;

    this.financeiro.pagarParcela(this.data.parcela, this.metodo()).subscribe({
      next: () => {
        this.processando.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.processando.set(false);
        this.dialogRef.disableClose = false;
        this.erro.set('Nao foi possivel registrar o pagamento. Nada foi cobrado. Tente de novo.');
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
