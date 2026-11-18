import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * PAGE HEADER - cabecalho padrao de toda tela interna.
 *
 * Mostra o titulo da pagina (e um subtitulo opcional) na esquerda e, na direita,
 * UM botao de acao principal - normalmente "Novo aluno", "Nova turma" etc.
 *
 * O botao so aparece quando o pai informa [actionLabel]. Assim a mesma tag serve
 * para telas com acao e para telas que sao somente leitura (ex: Relatorios).
 *
 * Exemplo de uso:
 *   <app-page-header
 *     title="Alunos"
 *     subtitle="Cadastro de alunos da instituicao"
 *     actionLabel="Novo aluno"
 *     (action)="abrirFormulario()">
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  /** Titulo da pagina. Obrigatorio. */
  @Input() title = '';

  /** Linha de apoio abaixo do titulo. Opcional. */
  @Input() subtitle?: string;

  /** Texto do botao de acao. Se nao vier, o botao NAO e renderizado. */
  @Input() actionLabel?: string;

  /** Icone do botao (nome do Material Icons). */
  @Input() actionIcon = 'add';

  /** Desabilita o botao sem escondê-lo. */
  @Input() actionDisabled = false;

  /** Disparado no clique do botao de acao. */
  @Output() action = new EventEmitter<void>();
}
