import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';

import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

/**
 * CONFIRM SERVICE - o jeito oficial de pedir confirmacao ao usuario.
 *
 * Existe para a tela de CRUD nao precisar conhecer MatDialog, MatDialogRef nem
 * MAT_DIALOG_DATA: ela chama um metodo e recebe true ou false.
 *
 * Uso tipico, antes de excluir:
 *
 *   private readonly confirmService = inject(ConfirmService);
 *
 *   excluir(aluno: Student): void {
 *     this.confirmService
 *       .confirm({
 *         title: 'Excluir aluno',
 *         message: `Confirma a exclusao de ${aluno.name}?`,
 *         confirmText: 'Excluir',
 *         danger: true,
 *       })
 *       .subscribe((confirmado) => {
 *         if (confirmado) {
 *           // chama o service e recarrega a lista
 *         }
 *       });
 *   }
 */
@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  /**
   * Abre o dialog e devolve um Observable<boolean>:
   * true  = usuario confirmou
   * false = cancelou, fechou no ESC ou clicou fora
   */
  confirm(data: ConfirmDialogData): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data,
        width: '420px',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .pipe(map((resultado) => resultado === true));
  }
}
