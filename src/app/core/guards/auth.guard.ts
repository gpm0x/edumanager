import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * AUTH GUARD - protege as rotas internas do sistema.
 *
 * E um "guard funcional" (CanActivateFn): uma funcao que o Angular Router executa
 * ANTES de ativar a rota. Se ela devolve true, a rota abre; se devolve false,
 * a rota e bloqueada.
 *
 * Regra: existe usuario logado? Entao a rota abre. Se nao existe, o usuario e
 * mandado de volta para a tela de /login.
 *
 * QUEM RESPONDE "ESTA LOGADO?" E O AUTHSERVICE
 * --------------------------------------------
 * O guard NAO le o localStorage. Ele pergunta ao AuthService, que e o unico
 * lugar do sistema que sabe onde a sessao fica guardada e como ela esta
 * gravada.
 *
 * A diferenca nao e estetica. O AuthService.usuarioLogado() tem um try/catch
 * para um caso real: se alguem editar a chave na mao pelo console do navegador,
 * o JSON.parse quebraria. Lendo o localStorage direto, o guard enxergaria
 * "existe algo gravado" e liberaria a rota com uma sessao corrompida, e a
 * primeira tela a tentar ler o usuario quebraria. Perguntando ao service, uma
 * sessao invalida e tratada como "nao logado", que e o certo.
 *
 * OS TRES GUARDS DO SISTEMA, E O QUE CADA UM RESPONDE
 * ---------------------------------------------------
 *   authGuard       -> "esta logado?"                (rota pai da area interna)
 *   permissaoGuard  -> "este PERFIL alcanca a area?" (cada rota filha)
 *   visitanteGuard  -> "ja esta logado?"             (as telas publicas)
 *
 * Como usar na rota (app.routes.ts):
 *   { path: '', loadComponent: ..., canActivate: [authGuard], children: [...] }
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.estaLogado()) {
    return true;
  }

  // Nao esta logado: bloqueia a rota e redireciona para o login.
  router.navigate(['/login']);
  return false;
};
