import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/**
 * Dados que a tela passa para o dialog de confirmacao.
 *
 * danger = true deixa o botao de confirmar VERMELHO. Use em exclusao.
 */
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/**
 * CONFIRM DIALOG - caixa de confirmacao padrao do sistema.
 *
 * ATENCAO: as telas de CRUD NAO abrem este componente diretamente.
 * Elas usam o ConfirmService (confirm.service.ts), que e bem mais simples:
 *
 *   this.confirmService
 *     .confirm({ title: 'Excluir aluno', message: 'Confirma a exclusao?', danger: true })
 *     .subscribe((confirmado) => { if (confirmado) { ... } });
 *
 * O dialog devolve true quando o usuario confirma e false/undefined quando
 * cancela ou fecha clicando fora.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  /** Referencia do proprio dialog: usada para fechar devolvendo true/false. */
  private readonly dialogRef = inject<MatDialogRef<ConfirmDialogComponent, boolean>>(MatDialogRef);

  /** Dados injetados pelo ConfirmService na abertura. */
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  /** Textos com valor padrao, para a tela nao precisar informar sempre. */
  get confirmText(): string {
    return this.data.confirmText ?? 'Confirmar';
  }

  get cancelText(): string {
    return this.data.cancelText ?? 'Cancelar';
  }

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
