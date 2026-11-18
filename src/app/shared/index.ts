/**
 * BARREL (arquivo de indice) dos componentes compartilhados.
 *
 * Serve para a tela importar tudo de um unico lugar, em vez de escrever um
 * caminho longo por componente:
 *
 *   import {
 *     PageHeaderComponent,
 *     EmptyStateComponent,
 *     ConfirmService,
 *   } from '../../shared';
 *
 * Dono desta pasta: VITRAL. Se precisar de um componente novo, fale com o
 * Vitral - ele adiciona sem alterar a assinatura dos que ja existem.
 */

// Cabecalho de pagina (titulo + acao principal)
export * from './page-header/page-header.component';

// Confirmacao de exclusao: use o ConfirmService, nao o componente
export * from './confirm-dialog/confirm-dialog.component';
export * from './confirm-dialog/confirm.service';

// Lista vazia
export * from './empty-state/empty-state.component';

// Rodape de formulario (Cancelar / Salvar)
export * from './form-actions/form-actions.component';

// Caixa de busca com debounce de 300ms
export * from './search-field/search-field.component';

// Etiqueta de status colorida
export * from './status-chip/status-chip.component';

// Card de total (dashboard e relatorios)
export * from './stat-card/stat-card.component';

// Indicador de carregando
export * from './loading/loading.component';

// Faixa que explica por que a lista esta filtrada por permissao
export * from './escopo-aviso/escopo-aviso.component';
