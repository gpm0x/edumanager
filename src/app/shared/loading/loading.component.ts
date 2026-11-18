import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * LOADING - indicador de "carregando" das telas.
 *
 * So aparece quando [loading] e true, entao a tela nao precisa de @if em volta:
 *
 *   <app-loading [loading]="carregando()" message="Carregando alunos..."></app-loading>
 *
 * Lembrete do projeto (zoneless): o valor de [loading] deve vir de um signal,
 * porque atribuir propriedade comum dentro de um subscribe nao atualiza a tela.
 */
@Component({
  selector: 'app-loading',
  imports: [MatProgressSpinnerModule],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent {
  /** Controla a exibicao. */
  @Input() loading = false;

  /** Texto exibido ao lado do spinner. */
  @Input() message = 'Carregando...';
}
