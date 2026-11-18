/**
 * Perfis de acesso do sistema (contrato de dados).
 *
 * Cada perfil responde a uma pergunta diferente: "o que esta pessoa pode VER?".
 * A resposta completa esta no AcessoService (core/services/acesso.service.ts),
 * que e a fonte unica de verdade das permissoes.
 *
 *   admin     -> tudo: o catalogo, as turmas, as matriculas, o financeiro, a
 *                frequencia e as credenciais de acesso.
 *   professor -> SOMENTE os cursos e as turmas de que e responsavel: os alunos
 *                matriculados neles, a frequencia desses alunos e a situacao
 *                financeira deles (em leitura).
 *   aluno     -> SOMENTE o proprio cadastro: suas matriculas, suas
 *                mensalidades e sua frequencia.
 *
 * SAO TRES PERFIS, E CADA UM EXISTE POR UM MOTIVO
 * -----------------------------------------------
 * Os tres respondem a perguntas diferentes de ESCOPO, e e isso que faz o
 * controle de acesso valer a pena demonstrar:
 *
 *   admin     -> escopo irrestrito  (nenhum filtro se aplica)
 *   professor -> escopo por VINCULO (as turmas de que ele e responsavel)
 *   aluno     -> escopo por IDENTIDADE (ele mesmo, e so)
 *
 * O professor e o caso mais interessante dos tres: ele ve registros de OUTRAS
 * pessoas (os alunos dele), mas nao de todas - e por isso o filtro dele nao
 * pode ser nem "tudo" nem "so eu".
 */
export type UserRole = 'admin' | 'professor' | 'aluno';

/**
 * MODEL - formato exato de um registro da colecao /users da API.
 *
 * Usado no login e na tela de Usuarios.
 *
 * O VINCULO COM A PESSOA (studentId)
 * ----------------------------------
 * Um usuario e uma CREDENCIAL de acesso; aluno e um CADASTRO (/students). Sao
 * coisas diferentes, e e por isso que existem dois registros: o administrador pode
 * cadastrar um aluno que ainda nao tem login, e um aluno pode sair da escola
 * sem que o historico das matriculas dele seja apagado.
 *
 * `studentId` e a ponte entre as duas coisas, e sem ela NAO HA COMO aplicar a
 * restricao de acesso: saber que alguem tem role 'aluno' nao diz QUAIS
 * matriculas sao dele - so o studentId diz.
 *
 * E opcional no tipo porque depende do perfil:
 *   role 'aluno'     -> studentId obrigatorio (quem ele e na colecao /students)
 *   role 'professor' -> nenhum studentId. O vinculo dele e o CONTRARIO: nao e
 *                       o usuario que aponta para os cursos, sao os cursos e as
 *                       turmas que apontam para ele (Course.teacherId e
 *                       Class.teacherId guardam o id DESTE usuario). Um
 *                       professor pode responder por varios cursos, e um campo
 *                       so no usuario nao daria conta disso.
 *   role 'admin'     -> nenhum vinculo: nao representa uma pessoa do quadro
 *                       academico, e ve tudo.
 *
 * Quem cobra essa obrigatoriedade e o formulario de usuarios (validacao
 * condicional), porque o TypeScript nao sabe amarrar um campo ao valor de
 * outro em uma interface simples.
 *
 * Observacao academica: a senha fica em texto puro porque o "banco" e um
 * arquivo db.json servido pelo JSON Server, que nao tem criptografia.
 * Em um sistema real a senha seria gravada com hash no servidor.
 */
export interface User {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR um usuario o id ainda nao existe. */
  id?: number;
  name: string;
  email: string;
  login: string;
  password: string;
  role: UserRole;
  active: boolean;

  /** Qual aluno (/students) este usuario e. Obrigatorio quando role = 'aluno'. */
  studentId?: number;
}
