/**
 * TESTES DE AUTENTICACAO
 * ======================
 *
 * Provam o fluxo completo de entrada no sistema, sem subir a API: o
 * HttpTestingController intercepta a requisicao, confere PARA ONDE ela foi e
 * responde o que o teste quiser. Assim da para testar o caso que e dificil de
 * reproduzir a mao - a API fora do ar - e os dois casos de erro que a tela de
 * login trata de forma diferente.
 *
 * O QUE MERECE TESTE AQUI
 * -----------------------
 * O login tem TRES desfechos que a tela precisa separar, e dois deles sao
 * faceis de confundir em codigo:
 *
 *   senha errada    -> resposta de SUCESSO com lista vazia (a consulta e
 *                      valida, so nao casou ninguem).
 *   API fora do ar  -> erro de HTTP.
 *   conta desligada -> resposta de sucesso COM o registro, mas `active: false`.
 *
 * Se senha errada e API fora do ar caissem no mesmo lugar, a tela diria "nao
 * foi possivel conectar" para quem apenas errou a senha. E se a conta
 * desligada caisse no mesmo lugar da senha errada, a pessoa seria mandada
 * tentar a senha para sempre - o problema dela so o administrador resolve.
 *
 * O terceiro ponto e a aceitacao de E-MAIL ou LOGIN no mesmo campo: o e-mail e
 * tentado primeiro e o login so e consultado quando o e-mail nao casa. Os
 * testes conferem as duas consultas, e o `http.verify()` do afterEach garante
 * que nao sai requisicao a mais.
 *
 * Executar com:  npm test
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { User } from '../models';
import { API_URL } from './api.config';
import { AUTH_STORAGE_KEY, AuthService, ResultadoLogin } from './auth.service';

/** Usuario que a "API" devolve quando as credenciais conferem. */
const ADMIN: User = {
  id: 1,
  name: 'Carlos Eduardo Nunes',
  email: 'admin@edumanager.com.br',
  login: 'admin',
  password: 'admin123',
  role: 'admin',
  active: true,
};

/**
 * Conta com credencial certa e `active: false`.
 *
 * E um dado DE TESTE, nao um registro do seed: o HttpTestingController responde
 * o que o teste manda, entao a regra pode ser verificada sem depender de existir
 * uma conta desativada no db.json.
 */
const DESATIVADO: User = {
  id: 7,
  name: 'Felipe Augusto Barbosa',
  email: 'felipe.barbosa@email.com',
  login: 'inativo',
  password: '123456',
  role: 'aluno',
  active: false,
  studentId: 6,
};

let auth: AuthService;
let http: HttpTestingController;

beforeEach(() => {
  localStorage.clear();

  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });

  auth = TestBed.inject(AuthService);
  http = TestBed.inject(HttpTestingController);
});

afterEach(() => {
  // Garante que nenhuma requisicao ficou pendente sem ser conferida: uma
  // consulta a mais (ou a menos) e justamente o tipo de defeito que este
  // controlador existe para pegar.
  http.verify();
  localStorage.clear();
});

// ============================================================================
//  1) LOGIN
// ============================================================================

describe('AuthService - login', () => {
  it('tenta o E-MAIL primeiro, com a senha, e sem filtrar active no servidor', () => {
    auth.login('admin@edumanager.com.br', 'admin123').subscribe();

    const requisicao = http.expectOne(
      (r) => r.url === `${API_URL}/users` && r.method === 'GET',
    );

    expect(requisicao.request.params.get('email')).toBe('admin@edumanager.com.br');
    expect(requisicao.request.params.get('password')).toBe('admin123');
    // O `active` e conferido no service, nao na consulta: e o que permite
    // distinguir "conta desativada" de "credencial invalida".
    expect(requisicao.request.params.has('active')).toBe(false);

    requisicao.flush([ADMIN]);
  });

  it('e-mail que casa: entra com UMA consulta so (nao tenta o login)', () => {
    let resultado: ResultadoLogin | undefined;
    auth.login('admin@edumanager.com.br', 'admin123').subscribe((r) => (resultado = r));

    http.expectOne((r) => r.params.get('email') !== null).flush([ADMIN]);
    // Se o service tentasse o login mesmo tendo achado pelo e-mail, o
    // http.verify() do afterEach acusaria a requisicao pendente.

    expect(resultado).toEqual({ tipo: 'ok', usuario: ADMIN });
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(JSON.stringify(ADMIN));
  });

  it('LOGIN curto tambem entra: nao achou por e-mail, consulta por login', () => {
    let resultado: ResultadoLogin | undefined;
    auth.login('admin', 'admin123').subscribe((r) => (resultado = r));

    // 1a consulta: por e-mail, nao casa (ninguem tem e-mail "admin").
    http.expectOne((r) => r.params.get('email') === 'admin').flush([]);
    // 2a consulta: por login, casa.
    http.expectOne((r) => r.params.get('login') === 'admin').flush([ADMIN]);

    expect(resultado).toEqual({ tipo: 'ok', usuario: ADMIN });
    expect(auth.estaLogado()).toBe(true);
  });

  it('normaliza o identificador: espacos e MAIUSCULAS entram igual', () => {
    auth.login('  ADMIN@Edumanager.COM.BR  ', 'admin123').subscribe();

    const requisicao = http.expectOne(() => true);
    expect(requisicao.request.params.get('email')).toBe('admin@edumanager.com.br');

    requisicao.flush([ADMIN]);
  });

  it('senha incorreta: devolve invalido e NAO grava sessao', () => {
    let resultado: ResultadoLogin | undefined;
    auth.login('admin', 'errada').subscribe((r) => (resultado = r));

    // Lista vazia nas duas consultas = nao casou ninguem. NAO e erro de HTTP.
    http.expectOne((r) => r.params.get('email') !== null).flush([]);
    http.expectOne((r) => r.params.get('login') !== null).flush([]);

    expect(resultado).toEqual({ tipo: 'invalido' });
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(auth.estaLogado()).toBe(false);
  });

  it('usuario inexistente: mesmo resultado da senha incorreta', () => {
    let resultado: ResultadoLogin | undefined;
    auth.login('naoexiste', 'qualquer').subscribe((r) => (resultado = r));

    http.expectOne((r) => r.params.get('email') !== null).flush([]);
    http.expectOne((r) => r.params.get('login') !== null).flush([]);

    expect(resultado).toEqual({ tipo: 'invalido' });
    expect(auth.estaLogado()).toBe(false);
  });

  it('conta DESATIVADA: credencial certa, mas nao entra e nao grava sessao', () => {
    let resultado: ResultadoLogin | undefined;
    auth.login('inativo', '123456').subscribe((r) => (resultado = r));

    http.expectOne((r) => r.params.get('email') !== null).flush([]);
    http.expectOne((r) => r.params.get('login') !== null).flush([DESATIVADO]);

    // A API DEVOLVEU o registro (a senha estava certa). Quem barra e o service.
    expect(resultado).toEqual({ tipo: 'desativado', usuario: DESATIVADO });
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(auth.estaLogado()).toBe(false);
  });

  it('conta desativada e um caso DIFERENTE de credencial invalida', () => {
    // E o teste que protege a mensagem da tela: se alguem voltar a filtrar
    // active=true na consulta, este caso passa a devolver 'invalido' e a
    // pessoa de conta desligada volta a ser mandada tentar a senha de novo.
    let resultado: ResultadoLogin | undefined;
    auth.login('inativo@email.com', '123456').subscribe((r) => (resultado = r));

    http.expectOne(() => true).flush([DESATIVADO]);

    expect(resultado?.tipo).not.toBe('invalido');
    expect(resultado?.tipo).toBe('desativado');
  });

  it('API fora do ar: propaga o erro em vez de devolver invalido', () => {
    let deuErro = false;
    let resultado: ResultadoLogin | undefined;

    auth.login('admin@edumanager.com.br', 'admin123').subscribe({
      next: (r) => (resultado = r),
      error: () => (deuErro = true),
    });

    http
      .expectOne(() => true)
      .error(new ProgressEvent('erro de rede'), { status: 0, statusText: 'Unknown Error' });

    // A distincao de que a tela de login depende: aqui NAO pode chegar
    // 'invalido', ou a mensagem exibida seria "login ou senha invalidos" com a
    // API desligada.
    expect(deuErro).toBe(true);
    expect(resultado).toBeUndefined();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('quando a API devolve mais de um registro, usa o primeiro', () => {
    let resultado: ResultadoLogin | undefined;
    auth.login('admin@edumanager.com.br', 'admin123').subscribe((r) => (resultado = r));

    http.expectOne(() => true).flush([ADMIN, { ...ADMIN, id: 99 }]);

    expect(resultado).toEqual({ tipo: 'ok', usuario: ADMIN });
  });
});

// ============================================================================
//  2) SESSAO
// ============================================================================

describe('AuthService - sessao', () => {
  it('usuarioLogado devolve null quando ninguem entrou', () => {
    expect(auth.usuarioLogado()).toBeNull();
    expect(auth.estaLogado()).toBe(false);
  });

  it('a sessao sobrevive ao recarregar a pagina (fica no localStorage)', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(ADMIN));

    // Um service NOVO, como aconteceria depois de um F5: o estado nao vem da
    // memoria do objeto anterior, vem do localStorage.
    const depoisDoF5 = TestBed.inject(AuthService);

    expect(depoisDoF5.estaLogado()).toBe(true);
    expect(depoisDoF5.usuarioLogado()?.login).toBe('admin');
  });

  it('sessao corrompida na mao e tratada como "nao logado", e a chave e limpa', () => {
    // Caso real: alguem edita a chave pelo console do navegador. Sem o
    // try/catch do service, o JSON.parse derrubaria a primeira tela a ler o
    // usuario - e o authGuard teria liberado a rota antes disso.
    localStorage.setItem(AUTH_STORAGE_KEY, '{isto nao e json}');

    expect(auth.usuarioLogado()).toBeNull();
    expect(auth.estaLogado()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('logout apaga a sessao e volta para a tela de login', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(ADMIN));
    const router = TestBed.inject(Router);
    const navegou = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    auth.logout();

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(auth.estaLogado()).toBe(false);
    expect(navegou).toHaveBeenCalledWith(['/login']);
  });
});
