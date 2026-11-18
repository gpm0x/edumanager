import { UserRole } from '../models';

/**
 * ACESSOS DE DEMONSTRACAO - as credenciais do seed, em um unico lugar.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * Na apresentacao do trabalho e preciso trocar de perfil varias vezes para
 * mostrar que cada um ve uma coisa diferente. Digitar login e senha a cada
 * troca gasta tempo da banca e abre espaco para erro de digitacao na hora
 * errada. A tela de login le esta lista e oferece os perfis em um dialog.
 *
 * ISTO NAO E UM SEGUNDO SISTEMA DE LOGIN
 * --------------------------------------
 * Nada aqui autentica ninguem. A lista so guarda TEXTO que vai ser escrito
 * nos campos do formulario; quem confere as credenciais continua sendo o
 * AuthService, consultando /users na API. Se a senha mudar no db.json e nao
 * mudar aqui, o acesso rapido preenche um valor errado e o login falha
 * normalmente - exatamente como se a pessoa tivesse digitado errado.
 *
 * As credenciais sao as mesmas do seed em `api/db.json` e estao publicadas no
 * README do projeto: nao sao segredo, sao dados de teste de um trabalho
 * academico. Em um sistema real este arquivo NAO existiria.
 *
 * MANUTENCAO: se as credenciais do seed mudarem, mude aqui tambem. Sao os dois
 * unicos lugares (db.json e este arquivo) - e a razao de a lista ser
 * centralizada em vez de ficar escrita dentro do componente do dialog.
 */

/** Um perfil oferecido no acesso rapido da tela de login. */
export interface AcessoDemo {
  /** Perfil do usuario na API. Serve de identificador da opcao. */
  role: UserRole;

  /** Nome do perfil como o usuario le no card. */
  rotulo: string;

  /** Uma linha dizendo o que este perfil alcanca no sistema. */
  descricao: string;

  /** Icone do Material Symbols mostrado no card. */
  icone: string;

  /** Valor escrito no campo Login do formulario. */
  login: string;

  /** Valor escrito no campo Senha do formulario. */
  password: string;
}

/**
 * Os tres perfis do sistema, na ordem em que aparecem no dialog: do que ve
 * tudo, passando pelo que ve o recorte dele, ate o que ve so o que e seu. A
 * ordem conta a historia das permissoes sem precisar de legenda.
 *
 * Para acrescentar um perfil novo basta mais um item nesta lista - o dialog e a
 * tela de login nao mudam.
 */
export const ACESSOS_DEMO: readonly AcessoDemo[] = [
  {
    role: 'admin',
    rotulo: 'Administrador',
    descricao: 'Acesso total, inclusive as credenciais de acesso.',
    icone: 'admin_panel_settings',
    login: 'admin',
    password: 'Admin@2025',
  },
  {
    role: 'professor',
    rotulo: 'Professor',
    descricao: 'Somente os cursos e as turmas de que e responsavel.',
    icone: 'school',
    login: 'professor',
    password: 'Prof@2025',
  },
  {
    role: 'aluno',
    rotulo: 'Aluno',
    descricao: 'Somente o proprio cadastro, matriculas e frequencia.',
    icone: 'people',
    login: 'aluno',
    password: 'Aluno@2025',
  },
];
