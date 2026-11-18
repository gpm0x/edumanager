import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * VISITANTE GUARD - protege as telas publicas de quem JA esta logado.
 *
 * E o espelho do authGuard. Enquanto o authGuard impede que alguem sem conta
 * entre na area interna, este impede o contrario: que alguem JA logado abra
 * /login ou /criar-conta.
 *
 * POR QUE ISSO IMPORTA
 * --------------------
 * Sem ele, um usuario logado que apertasse "voltar" no navegador depois de
 * entrar cairia na tela de login outra vez - parecendo que a sessao caiu. Pior,
 * em /criar-conta ele poderia criar uma segunda conta sem perceber que ja
 * estava dentro do sistema com outra.
 *
 * Nos dois casos o destino e o painel: quem esta logado tem para onde ir, e a
 * tela publica nao tem nada a oferecer a ele.
 */
export const visitanteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaLogado()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
