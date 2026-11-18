import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';

import { User } from '../models';
import { API_URL } from './api.config';

/**
 * O resultado de uma tentativa de login.
 *
 * Sao TRES casos, e nao dois, porque a tela precisa dizer coisas diferentes:
 *
 *   'ok'         -> credenciais certas e conta ativa. A sessao JA esta gravada.
 *   'desativado' -> credenciais certas, conta desligada pelo administrador.
 *                   Digitar de novo nao resolve: so o administrador reativa.
 *   'invalido'   -> nao existe ninguem com esse identificador e essa senha.
 *
 * Um booleano ou um `User | null` nao conseguiria separar os dois ultimos, e a
 * mensagem "login ou senha invalidos" mandaria a pessoa de conta desativada
 * tentar a senha para sempre.
 */
export type ResultadoLogin =
  { tipo: 'ok'; usuario: User } | { tipo: 'desativado'; usuario: User } | { tipo: 'invalido' };

/**
 * Chave usada no localStorage para guardar o usuario logado.
 *
 * Mora aqui, no AuthService, porque este e o unico lugar do sistema que grava e
 * le a sessao. Os guards NAO usam esta constante: eles perguntam
 * `auth.estaLogado()`, e e o service que sabe onde e como a sessao esta.
 *
 * Ela continua exportada por um motivo: os testes precisam simular um usuario
 * logado, e fazem isso gravando nesta chave (ver acesso.service.spec.ts).
 */
export const AUTH_STORAGE_KEY = 'edumanager_user';

/**
 * SERVICE DE AUTENTICACAO - login simples do sistema.
 *
 * COMO O LOGIN FUNCIONA AQUI
 * --------------------------
 * Nao existe servidor de autenticacao: o backend e o JSON Server, que so sabe
 * devolver registros. Entao o login e uma CONSULTA a colecao /users filtrando
 * o identificador (e-mail ou login) e a senha. Se a consulta devolve alguem, as
 * credenciais estao certas; se devolve lista vazia, estao erradas. O campo
 * `active` e conferido aqui, no service, e nao na consulta - ver o comentario
 * do metodo login().
 *
 * O usuario logado fica no localStorage do navegador, que e onde o authGuard
 * (do Prumo) procura para decidir se libera as rotas internas.
 *
 * HONESTIDADE TECNICA (resposta se o professor perguntar)
 * -------------------------------------------------------
 * Isto NAO e seguro para um sistema real: a senha vai na URL da consulta e fica
 * gravada em texto puro no db.json, e qualquer um pode escrever a chave no
 * localStorage pelo console do navegador. Num sistema de producao o certo seria
 * o servidor conferir a senha (com hash, ex. bcrypt) e devolver um token.
 * A escolha aqui e deliberada: o requisito academico e "login e senha com
 * cadastro previo pelo administrador", e esta e a forma mais simples e
 * explicavel de atender isso com JSON Server.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly url = `${API_URL}/users`;

  /**
   * Faz o login. Aceita E-MAIL ou LOGIN no mesmo campo.
   *
   *   GET /users?email=<identificador>&password=<senha>
   *   e, se nao achar ninguem:
   *   GET /users?login=<identificador>&password=<senha>
   *
   * POR QUE OS DOIS
   * ---------------
   * O requisito academico pede entrada por "e-mail e senha", e todo usuario
   * tem e-mail unico. Mas o login curto (`admin`, `aluno`) e o que
   * esta no seed, na documentacao e no roteiro de apresentacao. Aceitar os dois
   * atende o requisito sem invalidar nada do que ja existe - e e o que o
   * usuario espera: ninguem lembra se cadastrou o e-mail ou o apelido.
   *
   * O e-mail e tentado PRIMEIRO porque e o identificador do requisito; o login
   * so e consultado quando o e-mail nao casa, entao o caso comum custa uma
   * consulta so.
   *
   * POR QUE A CONSULTA NAO FILTRA MAIS `active=true`
   * ------------------------------------------------
   * Filtrando no servidor, uma conta desativada caia na mesma resposta vazia
   * de uma senha errada - e a tela dizia "credencial invalida" a quem tinha a
   * senha certa e a conta desligada. Sao problemas diferentes e exigem
   * respostas diferentes: um se resolve digitando de novo, o outro so com o
   * administrador. Agora a consulta traz o registro e QUEM decide e o
   * `classificar()` abaixo, que so grava a sessao de conta ativa.
   *
   * @returns um ResultadoLogin: 'ok' (sessao gravada), 'desativado' (credencial
   *          certa, conta desligada) ou 'invalido' (nao casou ninguem).
   *          Falha de rede vem como erro do Observable, nao como 'invalido' -
   *          a tela precisa saber a diferenca entre "senha errada" e "API fora
   *          do ar".
   */
  login(identificador: string, password: string): Observable<ResultadoLogin> {
    // Normaliza do mesmo jeito que os formularios gravam: e-mail e login sao
    // gravados em minusculas, e a consulta do JSON Server e sensivel a caixa.
    const chave = identificador.trim().toLowerCase();

    return this.porEmail(chave, password).pipe(
      switchMap((porEmail) =>
        porEmail.length > 0 ? of(porEmail) : this.porLogin(chave, password),
      ),
      map((encontrados) => this.classificar(encontrados)),
    );
  }

  /** GET /users?email=...&password=... */
  private porEmail(email: string, password: string): Observable<User[]> {
    const params = new HttpParams().set('email', email).set('password', password);
    return this.http.get<User[]>(this.url, { params });
  }

  /** GET /users?login=...&password=... */
  private porLogin(login: string, password: string): Observable<User[]> {
    const params = new HttpParams().set('login', login).set('password', password);
    return this.http.get<User[]>(this.url, { params });
  }

  /**
   * Transforma a lista devolvida pela API no resultado do login, e grava a
   * sessao APENAS quando a conta esta ativa.
   *
   * A ordem importa: conferir `active` antes de gravar e o que impede uma conta
   * desativada de entrar agora que a consulta nao filtra mais isso no servidor.
   */
  private classificar(encontrados: User[]): ResultadoLogin {
    if (encontrados.length === 0) {
      return { tipo: 'invalido' };
    }

    const usuario = encontrados[0];

    if (!usuario.active) {
      return { tipo: 'desativado', usuario };
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(usuario));
    return { tipo: 'ok', usuario };
  }

  /**
   * Abre a sessao de um usuario que o SISTEMA acabou de criar, sem pedir a
   * senha de novo (requisito 3).
   *
   * POR QUE ISTO EXISTE
   * -------------------
   * No autocadastro, a pessoa digitou nome, CPF, e-mail e senha, escolheu o
   * curso e a forma de pagamento. Manda-la para a tela de login em seguida
   * seria pedir, na mesma visita, a senha que ela acabou de criar - e e
   * justamente nesse pedido que as pessoas abandonam o cadastro. O requisito e
   * explicito: "nao exigir que o aluno faca login novamente apos concluir o
   * cadastro".
   *
   * POR QUE NAO E UM FURO DE AUTENTICACAO
   * -------------------------------------
   * Este metodo nao confere credencial nenhuma - e nem precisa: quem o chama e
   * o proprio fluxo de cadastro, que ACABOU de gravar aquele usuario na API e
   * recebeu o registro de volta com o id. A pessoa provou quem e ao definir a
   * credencial; o que falta e so nao fazer ela provar duas vezes.
   *
   * O metodo e chamado em UM lugar so (o autocadastro). Se um dia for chamado
   * de outro lugar, a pergunta a fazer e: "quem garante que este usuario e
   * quem diz ser?". Sem resposta, o certo e usar login().
   *
   * @param usuario o registro JA criado na API, com id.
   */
  iniciarSessao(usuario: User): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(usuario));
  }

  /** Sai do sistema: apaga o usuario guardado e volta para a tela de login. */
  logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  /**
   * Devolve o usuario logado, ou null se nao houver ninguem logado.
   * Serve para a tela mostrar o nome e para esconder o que o perfil nao pode ver.
   *
   * O try/catch protege de um caso real: se alguem editar a chave na mao pelo
   * console do navegador, o JSON.parse quebraria. Em vez de derrubar a tela,
   * tratamos como "nao logado" e limpamos a chave invalida.
   */
  usuarioLogado(): User | null {
    const json = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!json) {
      return null;
    }
    try {
      return JSON.parse(json) as User;
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }

  /** true quando existe usuario logado. E o que o authGuard usa para liberar a rota. */
  estaLogado(): boolean {
    return this.usuarioLogado() !== null;
  }
}
