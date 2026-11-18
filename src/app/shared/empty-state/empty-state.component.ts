import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * EMPTY STATE - mensagem exibida quando uma lista nao tem nenhum registro.
 *
 * Evita a tela "quebrada" de uma tabela vazia e ainda oferece o atalho para
 * cadastrar o primeiro registro.
 *
 * Use SEMPRE junto com a tabela, escolhendo um dos dois com @if:
 *
 *   @if (alunosFiltrados().length === 0) {
 *     <app-empty-state
 *       title="Nenhum aluno cadastrado"
 *       message="Cadastre o primeiro aluno para comecar."
 *       actionLabel="Novo aluno"
 *       (action)="abrirFormulario()">
 *     </app-empty-state>
 *   } @else {
 *     <table mat-table ...>
 *   }
 */
@Component({
  selector: 'app-empty-state',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  /** Icone do Material Icons exibido no circulo. */
  @Input() icon = 'inbox';

  /** Titulo da mensagem. */
  @Input() title = 'Nenhum registro encontrado';

  /** Texto explicativo opcional abaixo do titulo. */
  @Input() message?: string;

  /** Texto do botao. Se nao vier, o botao NAO e renderizado. */
  @Input() actionLabel?: string;

  /** Disparado no clique do botao. */
  @Output() action = new EventEmitter<void>();
}
