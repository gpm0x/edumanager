import { Component, Input } from '@angular/core';

/**
 * Cores possiveis do chip. Cada uma tem uma classe CSS correspondente.
 *
 * 'amber' entrou na identidade "Campus Vivo" para o status 'pendente': ambar e
 * a cor de ESPERA do sistema (o que ainda vai acontecer), e ela separa melhor
 * "pendente" de "pago" (verde) e de "vencido" (vermelho) do que o destaque
 * usado antes.
 *
 * 'coral' era a cor reservada "para um status futuro que precise da cor de
 * acao", e esse status chegou: 'parcialmente pago'. Ele nao e espera (parte do
 * dinheiro entrou) nem problema (o prazo pode nem ter vencido) - e cobranca a
 * fazer, que e exatamente o que o coral significa na identidade.
 */
export type StatusTone = 'green' | 'red' | 'amber' | 'coral' | 'gray';

/**
 * STATUS CHIP - etiqueta colorida do status de um registro.
 *
 * Recebe o status EXATAMENTE como esta gravado no db.json (em portugues,
 * conforme o contrato de dados) e decide a cor sozinho. A tela nao precisa
 * saber nada sobre cor:
 *
 *   <app-status-chip [status]="aluno.status"></app-status-chip>
 *
 * MAPA DE CORES (fechado com o Agente-mae):
 *   verde    ativo, ativa, pago, concluida, presente
 *   vermelho vencido, cancelada, ausente
 *   ambar    pendente
 *   coral    parcialmente pago
 *   cinza    inativo (e qualquer valor desconhecido)
 *
 * "presente" e "ausente" foram ADICIONADOS para a tela de Frequencia, que
 * guarda um boolean (present) e o converte em texto antes de passar aqui. Nada
 * do que ja existia mudou - e a regra de convivencia do shared/README.md.
 *
 * Observacao: usamos um objeto como "mapa" em vez de um switch gigante.
 * E a mesma ideia de uma tabela de-para: status na esquerda, cor na direita.
 */
@Component({
  selector: 'app-status-chip',
  imports: [],
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.scss',
})
export class StatusChipComponent {
  /** Status do registro, em portugues, como vem da API. */
  @Input() status = '';

  /** Tabela de-para entre o status e a cor do chip. */
  private readonly cores: Record<string, StatusTone> = {
    ativo: 'green',
    ativa: 'green',
    pago: 'green',
    concluida: 'green',
    presente: 'green',
    vencido: 'red',
    cancelada: 'red',
    ausente: 'red',
    pendente: 'amber',
    inativo: 'gray',

    // As duas grafias do mesmo status: o valor como esta no banco
    // ('parcialmente_pago', que viaja na URL das consultas) e o rotulo que a
    // tela mostra. Aceitar os dois evita que uma tela precise traduzir antes
    // de passar o status para o chip.
    parcialmente_pago: 'coral',
    'parcialmente pago': 'coral',
  };

  /** Cor usada no template. Valor desconhecido cai em cinza. */
  get tone(): StatusTone {
    return this.cores[this.status?.toLowerCase().trim()] ?? 'gray';
  }
}
