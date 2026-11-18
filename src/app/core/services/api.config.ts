import { isDevMode } from '@angular/core';

/**
 * ENDERECO BASE DA API.
 *
 * Fica em UM unico lugar de proposito: se a API mudar de porta ou de maquina,
 * so esta linha muda, e todos os services acompanham.
 *
 * DESENVOLVIMENTO (`ng serve`): a API e o JSON Server, que sobe com o comando
 * `npm run api` (script no package.json) e executa
 * `json-server --watch api/db.json --port 3000`. Ele grava no arquivo, entao
 * criar, alterar e excluir funcionam de verdade.
 *
 * PRODUCAO (site publicado na Vercel): nao da para deixar o JSON Server
 * rodando, porque a Vercel hospeda funcoes e nao processos. Entao a API passa a
 * ser a funcao em `api/server.js`, servida no proprio dominio sob `/api`, com
 * o mesmo contrato do JSON Server. Os dados ficam no banco Redis configurado
 * na Vercel (ver docs/deploy-vercel.md); sem banco, ela usa uma copia do
 * `db.json` em memoria e as escritas se perdem quando a funcao recicla.
 * As credenciais do banco ficam so no servidor: o frontend so conhece `/api`.
 *
 * `isDevMode()` e do proprio Angular: devolve true no build de desenvolvimento
 * e false no de producao, entao a troca e automatica e ninguem precisa lembrar
 * de editar este arquivo antes de publicar.
 */
export const API_URL = isDevMode() ? 'http://localhost:3000' : '/api';
