import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Acao, AcessoService, Area } from '../services/acesso.service';

/**
 * PERMISSAO GUARD - fecha a rota para quem o perfil nao permite.
 *
 * POR QUE ELE PRECISA EXISTIR
 * ---------------------------
 * Antes desta funcionalidade, o sistema escondia o item "Usuarios" do menu para
 * quem nao era administrador - e paravam ai. Esconder do menu NAO e restringir:
 * bastava digitar /users na barra de endereco para a tela abrir normalmente,
 * com o botao de excluir e tudo.
 *
 * O menu continua escondendo (e o que evita o usuario tentar), mas quem
 * realmente nega e este guard, porque ele roda em TODA entrada na rota: pelo
 * menu, pela URL digitada, pelo botao de voltar do navegador ou por um link
 * colado no WhatsApp.
 *
 * COMO SE USA (app.routes.ts)
 * ---------------------------
 *   // Tela de lista: precisa poder VER a area
 *   {
 *     path: 'payments',
 *     canActivate: [permissaoGuard],
 *     data: { area: 'payments' },
 *     loadComponent: ...
 *   }
 *
 *   // Formulario de cadastro: precisa poder CRIAR na area
 *   {
 *     path: 'new',
 *     canActivate: [permissaoGuard],
 *     data: { area: 'payments', acao: 'criar' },
 *     loadComponent: ...
 *   }
 *
 *   // Formulario de alteracao: precisa poder EDITAR na area
 *   {
 *     path: ':id/edit',
 *     canActivate: [permissaoGuard],
 *     data: { area: 'payments', acao: 'editar' },
 *     loadComponent: ...
 *   }
 *
 * Criar e editar sao acoes SEPARADAS no `data` porque sao separadas na matriz:
 * o professor edita a turma dele e nao abre turma nova. Com uma unica acao
 * "gerenciar", liberar a edicao para ele liberaria o cadastro tambem.
 *
 * A area e a acao vem do `data` da rota, e nao de um guard diferente por tela,
 * porque assim existe UM guard para as 10 areas. A lista de quem pode o que
 * mora numa unica tabela, no AcessoService.
 *
 * ORDEM DOS GUARDS
 * ----------------
 * O authGuard protege a rota PAI (esta logado?) e este protege as FILHAS (este
 * perfil alcanca esta area?). Nessa ordem: nao faz sentido perguntar o perfil
 * de quem ainda nao entrou.
 *
 * O QUE ACONTECE AO NEGAR
 * -----------------------
 * Em vez de devolver false em silencio (a URL muda e nada acontece, parecendo
 * um bug), o guard manda o usuario para /sem-acesso levando o nome da area na
 * query string. A tela de lá explica o que foi negado e com qual perfil ele
 * esta logado.
 */
export const permissaoGuard: CanActivateFn = (route) => {
  const acesso = inject(AcessoService);
  const router = inject(Router);

  const area = route.data['area'] as Area | undefined;

  // Rota sem area declarada e erro de configuracao, nao permissao. Liberar
  // seria pior: criaria uma porta aberta silenciosa a cada rota nova que
  // alguem esquecesse de marcar.
  if (!area) {
    router.navigate(['/sem-acesso']);
    return false;
  }

  const acao = (route.data['acao'] as Acao | undefined) ?? 'ver';

  if (acesso.pode(area, acao)) {
    return true;
  }

  router.navigate(['/sem-acesso'], { queryParams: { area, acao } });
  return false;
};
