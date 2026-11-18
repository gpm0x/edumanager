import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Cores possiveis do card. Cada uma tem uma classe CSS correspondente.
 *
 * Os quatro primeiros nomes sao os da identidade "Campus Vivo":
 *   coral   -> o indicador principal da tela
 *   emerald -> indicador de estrutura (contagem neutra)
 *   green   -> algo que esta em ordem (ativo, pago, em dia)
 *   amber   -> algo que ainda vai acontecer (pendente, a vencer)
 *   red     -> algo que cobra acao (atraso)
 *   gray    -> contagem sem leitura de estado
 *
 * 'blue' e 'navy' sao os nomes da identidade ANTERIOR e continuam valendo:
 * apontam para coral e emerald. Assim nenhuma tela ja escrita precisou ser
 * mexida - e a regra de convivencia do shared/README.md.
 */
export type StatCardTone =
  'coral' | 'emerald' | 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'navy';

/**
 * STAT CARD - card de numero total, usado no Dashboard e nos Relatorios.
 *
 * Mostra um rotulo, o numero, um icone e - quando a tela informa uma proporcao
 * - uma barra fina embaixo. Nao busca dado nenhum: quem calcula o valor e a
 * proporcao e a tela.
 *
 * Exemplo de uso:
 *   <app-stat-card
 *     label="Alunos"
 *     [value]="totalAlunos()"
 *     icon="people"
 *     tone="coral"
 *     [ratio]="totalAtivos() / totalAlunos()"
 *     [hint]="totalAtivos() + ' ativos'">
 *   </app-stat-card>
 *
 * Coloque os cards dentro de um <div class="em-cards-grid"> para eles se
 * organizarem em grade responsiva.
 */
@Component({
  selector: 'app-stat-card',
  imports: [MatIconModule],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  /** Nome do indicador (ex: "Alunos ativos"). */
  @Input() label = '';

  /** Numero (ou texto ja formatado, como "R$ 1.250,00"). */
  @Input() value: string | number = 0;

  /** Icone do Material Icons. */
  @Input() icon = 'insights';

  /** Cor do icone e da barra de proporcao. */
  @Input() tone: StatCardTone = 'coral';

  /** Observacao pequena abaixo do numero. Opcional. */
  @Input() hint?: string;

  /**
   * Proporcao do total que este numero representa, de 0 a 1. Opcional:
   * SEM ela a barra nao e desenhada.
   *
   * So passe quando existir um todo de verdade (ativos sobre o total de
   * alunos, vagas ocupadas sobre a capacidade). Barra com numero inventado e
   * pior do que card sem barra: o usuario acredita nela.
   */
  @Input() ratio?: number;

  /** true quando a tela informou uma proporcao valida e a barra deve aparecer. */
  get temMedidor(): boolean {
    return this.ratio !== undefined && this.ratio !== null && !Number.isNaN(this.ratio);
  }

  /**
   * A proporcao convertida em porcentagem CSS ("62%").
   *
   * O clamp entre 0 e 1 protege a barra de estourar o card em dois casos
   * reais: divisao por zero (lista vazia) e turma com mais matriculas que a
   * capacidade.
   */
  get larguraDoMedidor(): string {
    const bruto = this.ratio ?? 0;
    const seguro = Number.isFinite(bruto) ? Math.min(Math.max(bruto, 0), 1) : 0;
    return `${Math.round(seguro * 100)}%`;
  }
}
