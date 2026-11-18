import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

/**
 * CONFIGURACAO BASE DA APLICACAO.
 *
 * Aqui ficam os "provedores" globais, ou seja, os recursos que o Angular
 * disponibiliza por injecao de dependencia para todo o sistema:
 *
 *  - provideRouter(routes) ..... liga o mapa de rotas de app.routes.ts.
 *  - provideHttpClient() ....... habilita o HttpClient, que os services de
 *                                src/app/core/services usam para conversar
 *                                com a API do JSON Server (http://localhost:3000).
 *  - provideBrowserGlobalErrorListeners() ... log de erros nao tratados no console.
 */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), provideHttpClient()],
};
