import { Component, Input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AcessoService } from '../../core/services/acesso.service';

/**
 * ESCOPO AVISO - a faixa que explica por que a lista esta menor.
 *
 * POR QUE ESTE COMPONENTE EXISTE
 * ------------------------------
 * Quando o sistema filtra registros por permissao, ele cria um problema novo:
 * o usuario ve uma lista incompleta e NAO TEM COMO SABER que ela foi filtrada.
 * Um professor que abre "Turmas" e encontra duas, numa escola com quatro, so
 * tem duas explicacoes possiveis na cabeca dele - ou a escola tem duas turmas,
 * ou o sistema esta com defeito. Nenhuma das duas e verdade.
 *
 * Esta faixa responde isso antes da pergunta. E a contrapartida honesta de
 * filtrar dado: se o sistema esconde, o sistema avisa que escondeu.
 *
 * Ela NAO aparece para o administrador, que ve a base inteira: para ele o
 * aviso seria ruido, porque nao ha nada escondido.
 *
 * COMO USAR
 * ---------
 *   <app-escopo-aviso
 *     texto="Voce esta vendo apenas as suas matriculas."
 *   ></app-escopo-aviso>
 *
 * Coloque logo depois do <app-page-header>, antes do card da tabela.
 */
@Component({
  selector: 'app-escopo-aviso',
  imports: [MatIconModule],
  templateUrl: './escopo-aviso.component.html',
  styleUrl: './escopo-aviso.component.scss',
})
export class EscopoAvisoComponent {
  private readonly acesso = inject(AcessoService);

  /**
   * A frase que explica o filtro desta tela.
   *
   * Cada tela escreve a sua: o motivo e sempre o mesmo, mas o SUJEITO muda
   * ("as turmas dos seus cursos", "as suas mensalidades"), e uma frase generica
   * do tipo "alguns registros foram ocultados" nao ajudaria ninguem.
   */
  @Input() texto = '';

  /** O aviso so aparece para quem tem a visao restrita (professor e aluno). */
  get visivel(): boolean {
    return !this.acesso.veTudo();
  }
}
