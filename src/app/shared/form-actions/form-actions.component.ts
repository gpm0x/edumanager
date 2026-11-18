import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * FORM ACTIONS - barra de botoes do rodape de TODO formulario do sistema.
 *
 * Padroniza posicao (direita), ordem (Cancelar e depois Salvar) e o
 * comportamento de carregando, para os 9 modulos ficarem iguais.
 *
 * Exemplo de uso:
 *   <app-form-actions
 *     [saveDisabled]="form.invalid"
 *     [loading]="salvando()"
 *     (save)="salvar()"
 *     (cancel)="fechar()">
 *   </app-form-actions>
 *
 * Observacao: os botoes tem type="button" de proposito. Quem decide o que
 * acontece e a tela, no (save) - assim o mesmo componente serve para
 * formulario em dialog e para formulario em pagina.
 */
@Component({
  selector: 'app-form-actions',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './form-actions.component.html',
  styleUrl: './form-actions.component.scss',
})
export class FormActionsComponent {
  /** Texto do botao de salvar. */
  @Input() saveLabel = 'Salvar';

  /** Texto do botao de cancelar. */
  @Input() cancelLabel = 'Cancelar';

  /** Desabilita o salvar. Passe form.invalid. */
  @Input() saveDisabled = false;

  /** Enquanto true, troca o texto do salvar por um spinner e bloqueia os dois botoes. */
  @Input() loading = false;

  /** Clique em salvar. */
  @Output() save = new EventEmitter<void>();

  /** Clique em cancelar. */
  @Output() cancel = new EventEmitter<void>();
}
