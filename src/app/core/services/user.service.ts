import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { User, UserRole } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * SERVICE da colecao /users (usuarios do sistema).
 *
 * HERDA de BaseApiService os 5 metodos do CRUD:
 * list, getById, create, update, delete.
 *
 * `@Injectable({ providedIn: 'root' })` registra o service no Angular uma vez
 * para toda a aplicacao, para os componentes pedirem com inject(UserService).
 */
@Injectable({ providedIn: 'root' })
export class UserService extends BaseApiService<User> {
  constructor() {
    // Informa a classe base com qual colecao da API este service conversa.
    super('users');
  }

  /** Lista em ordem alfabetica, para a tabela da tela. GET /users?_sort=name */
  listarOrdenadoPorNome(): Observable<User[]> {
    return this.buscar({ _sort: 'name' });
  }

  /**
   * REGRA 6.6 - LOGIN DUPLICADO.
   * A tela chama isto ANTES de salvar: se vier algum registro, o login ja existe
   * e o cadastro deve ser bloqueado com mensagem.
   * GET /users?login=valor
   */
  buscarPorLogin(login: string): Observable<User[]> {
    return this.buscar({ login });
  }

  /**
   * E-MAIL DUPLICADO.
   *
   * Usado pela tela de criar conta: se vier algum registro, o e-mail ja tem
   * conta e o autocadastro e bloqueado com mensagem no proprio campo.
   *
   * Por que o e-mail tambem precisa ser unico, se o login ja e: porque o
   * e-mail e a identidade que a PESSOA reconhece. Duas contas com o mesmo
   * e-mail e logins diferentes deixariam o usuario sem saber com qual entrar -
   * e, numa recuperacao de senha por e-mail (um proximo passo natural do
   * sistema), seria impossivel saber qual conta recuperar.
   *
   * GET /users?email=valor
   */
  buscarPorEmail(email: string): Observable<User[]> {
    return this.buscar({ email });
  }

  /**
   * A CONTA ligada a um cadastro de aluno.
   *
   * Serve para duas coisas, e as duas sao consequencia do vinculo criado pela
   * restricao de acesso:
   *
   *   1. EXCLUSAO BLOQUEADA: antes de excluir um aluno, confira se ele tem
   *      conta. Apagar o cadastro deixaria a credencial apontando para
   *      ninguem - a pessoa ainda conseguiria entrar, mas nao veria nada.
   *   2. SINCRONIA DE NOME: ao renomear o aluno, a conta dele precisa
   *      acompanhar, senao o sistema passa a chamar a mesma pessoa por dois
   *      nomes diferentes em telas diferentes.
   *
   * GET /users?studentId=X
   */
  buscarPorAluno(studentId: number): Observable<User[]> {
    return this.buscar({ studentId });
  }

  /**
   * Os usuarios de um perfil. GET /users?role=professor
   *
   * Serve para dois lugares: o seletor de "professor responsavel" nos
   * formularios de Curso e de Turma, e o card "Professores" do painel do
   * administrador.
   */
  listarPorPerfil(role: UserRole): Observable<User[]> {
    return this.buscar({ role });
  }

  /** Atalho de leitura: os professores ativos, em ordem de nome. */
  listarProfessores(): Observable<User[]> {
    return this.buscar({ role: 'professor', active: true, _sort: 'name' });
  }
}
