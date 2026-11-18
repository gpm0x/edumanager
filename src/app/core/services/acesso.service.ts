import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, shareReplay } from 'rxjs';

import {
  Attendance,
  Class,
  Course,
  Enrollment,
  FinancialRecord,
  Payment,
  Student,
  UserRole,
} from '../models';
import { AuthService } from './auth.service';
import { ClassService } from './class.service';
import { CourseService } from './course.service';
import { EnrollmentService } from './enrollment.service';

/**
 * As AREAS do sistema. Uma area = um assunto que pode ser liberado ou negado.
 * Os nomes sao iguais aos caminhos das rotas (/students, /courses...) de
 * proposito: o app.routes.ts declara `data: { area: 'students' }` e fica obvio
 * que a rota e a permissao falam da mesma coisa.
 */
export type Area =
  | 'dashboard'
  | 'students'
  | 'courses'
  | 'classes'
  | 'enrollments'
  | 'financial'
  | 'payments'
  | 'attendances'
  | 'users'
  | 'reports';

/**
 * As acoes que uma permissao controla.
 *
 *   'ver'     -> abrir a tela e enxergar os registros.
 *   'criar'   -> cadastrar um registro novo.
 *   'editar'  -> alterar um registro existente.
 *   'excluir' -> apagar um registro.
 *
 * POR QUE QUATRO, E NAO DUAS
 * --------------------------
 * Ate a entrada do perfil professor existiam duas ('ver' e 'gerenciar'), e
 * bastavam: o aluno so via, o administrador fazia tudo. O professor nao cabe
 * nesse par. O requisito 2 pede que ele possa EDITAR informacoes academicas
 * dos alunos das turmas dele e NAO possa excluir contas - e isso e impossivel
 * de escrever com uma unica permissao de "gerenciar", porque criar, editar e
 * excluir deixariam de poder ser separados.
 *
 * O caso concreto que obrigou a separacao: o professor lanca frequencia (cria
 * e edita registros de presenca) mas nao pode apagar o historico de um aluno;
 * e edita o cadastro academico de quem estuda com ele, mas nao cadastra aluno
 * novo nem exclui ninguem.
 */
export type Acao = 'ver' | 'criar' | 'editar' | 'excluir';

// ============================================================================
//  A MATRIZ DE PERMISSOES
// ============================================================================
//  Esta tabela e a FONTE UNICA DE VERDADE do que cada perfil alcanca.
//  Rota (permissaoGuard), menu lateral e botao de acao leem daqui - nenhum
//  deles tem regra propria. Mudar o acesso de um perfil e editar uma linha.
//
//  Ler assim: "quais perfis podem <acao> nesta area?"
//  Lista vazia = ninguem pode (ex.: ninguem "cria" um painel).
// ----------------------------------------------------------------------------

/** Atalhos, so para a tabela abaixo caber na largura da tela e ser lida de relance. */
const TODOS: readonly UserRole[] = ['admin', 'professor', 'aluno'];
const EQUIPE: readonly UserRole[] = ['admin', 'professor'];
const SO_ADMIN: readonly UserRole[] = ['admin'];
const ALUNO_E_ADMIN: readonly UserRole[] = ['admin', 'aluno'];
const NINGUEM: readonly UserRole[] = [];

const PERMISSOES: Record<Area, Record<Acao, readonly UserRole[]>> = {
  // Os tres perfis tem um painel; o CONTEUDO dele e que muda.
  dashboard: { ver: TODOS, criar: NINGUEM, editar: NINGUEM, excluir: NINGUEM },

  // ALUNOS: o professor ve e EDITA os alunos das turmas dele (requisito 2),
  // mas quem admite e quem desliga aluno da escola e o administrador.
  students: { ver: EQUIPE, criar: SO_ADMIN, editar: EQUIPE, excluir: SO_ADMIN },

  // CURSOS: o aluno ve o catalogo (requisito 4: "o aluno podera visualizar os
  // cursos disponiveis"); o professor edita os cursos de que e responsavel -
  // o filtro de ESCOPO e que limita quais sao, e nao esta matriz.
  courses: { ver: TODOS, criar: SO_ADMIN, editar: EQUIPE, excluir: SO_ADMIN },

  // TURMAS: mesma logica dos cursos, sem o aluno - ele ve a turma dele dentro
  // da propria matricula, e nao numa lista de turmas da escola.
  classes: { ver: EQUIPE, criar: SO_ADMIN, editar: EQUIPE, excluir: SO_ADMIN },

  // MATRICULAS: o aluno ve as PROPRIAS (filtro de escopo) e pode CRIAR uma
  // nova, que e como ele se matricula em outro curso sem depender da
  // secretaria. Editar e cancelar matricula e decisao administrativa.
  //
  // O professor NAO cria matricula - e a unica area em que ele edita sem poder
  // criar. O motivo: matricular alguem tem efeito financeiro (gera lancamento
  // e parcelas) e ocupa vaga na turma, e isso e ato administrativo. Ele edita a
  // matricula existente (corrigir turma, concluir) porque isso e registro
  // academico do aluno dele.
  enrollments: {
    ver: TODOS,
    criar: ['admin', 'aluno'],
    editar: EQUIPE,
    excluir: SO_ADMIN,
  },

  // LANCAMENTOS FINANCEIROS: o aluno ve os proprios (filtro de escopo); o
  // administrador ve e mexe em todos. O PROFESSOR NAO ALCANCA o financeiro:
  // cobranca nao e trabalho dele, e a escola decidiu que mensalidade de aluno
  // nao e informacao que o professor precise ver. Ele fica fora ate do 'ver'.
  //
  // O aluno tambem nao tem criar/editar aqui. O que ele faz e PAGAR a propria
  // parcela, e isso nao passa por esta matriz: e o podePagarMensalidade(),
  // mais abaixo. Dar 'editar' ao aluno abriria a tela de edicao de parcela,
  // onde ele poderia mudar valor e vencimento - pagar e uma acao, nao edicao.
  financial: {
    ver: ALUNO_E_ADMIN,
    criar: SO_ADMIN,
    editar: SO_ADMIN,
    excluir: SO_ADMIN,
  },

  // PARCELAS: mesma regra do lancamento a que pertencem.
  payments: {
    ver: ALUNO_E_ADMIN,
    criar: SO_ADMIN,
    editar: SO_ADMIN,
    excluir: SO_ADMIN,
  },

  // FREQUENCIA: e o trabalho do professor. Ele cria a chamada e corrige o que
  // lancou errado; apagar historico de presenca fica com o administrador.
  attendances: { ver: TODOS, criar: EQUIPE, editar: EQUIPE, excluir: SO_ADMIN },

  // CREDENCIAIS DE ACESSO: so o administrador, em todas as acoes. E o que
  // impede o professor de criar um administrador ou de mexer nas proprias
  // permissoes (requisito 2).
  users: { ver: SO_ADMIN, criar: SO_ADMIN, editar: SO_ADMIN, excluir: SO_ADMIN },

  // RELATORIOS: leitura da escola inteira, entao so administrador.
  reports: { ver: SO_ADMIN, criar: NINGUEM, editar: NINGUEM, excluir: NINGUEM },
};

/**
 * De que TIPO e o escopo de quem esta logado. O tipo decide COMO cada filtro
 * recorta a lista - e deixa a decisao explicita, em vez de deduzida de uma
 * combinacao de booleanos.
 *
 *   'irrestrito'   -> administrador: nenhum filtro se aplica.
 *   'professor'    -> filtro por VINCULO: os cursos e as turmas dele.
 *   'proprioAluno' -> filtro por IDENTIDADE: ele mesmo, e so.
 *   'vazio'        -> perfil sem vinculo cadastrado: nao alcanca nada.
 */
export type TipoDeEscopo = 'irrestrito' | 'professor' | 'proprioAluno' | 'vazio';

/**
 * O ESCOPO DE DADOS do usuario logado: quais REGISTROS ele alcanca.
 *
 * Nao confunda com a matriz acima. Sao duas perguntas diferentes, e as duas
 * precisam ser respondidas:
 *
 *   matriz  -> "posso abrir a tela de Matriculas?"      (depende do PERFIL)
 *   escopo  -> "quais matriculas aparecem nessa tela?"  (depende do VINCULO)
 *
 * Sem a matriz, um aluno abriria o cadastro de Usuarios. Sem o escopo, ele
 * abriria a tela de Matriculas e veria as matriculas de todos os colegas - e o
 * professor veria os alunos de turmas que nao sao dele.
 *
 * Os conjuntos (Set) guardam ids. Set e nao array porque a pergunta que a tela
 * faz e sempre "este id esta na lista?", e isso em Set e imediato.
 */
export interface EscopoDeDados {
  /** Qual dos quatro recortes se aplica. */
  tipo: TipoDeEscopo;

  /** true para o admin: ve a base inteira e nenhum filtro se aplica. */
  irrestrito: boolean;

  /**
   * true para o perfil 'aluno': o filtro e "sou eu?".
   *
   * Um aluno da turma INF-2026-2 nao pode ver a frequencia dos COLEGAS da
   * mesma turma - e por isso que o filtro e pelo PROPRIO id, e nao pela turma
   * em que ele estuda.
   */
  apenasProprioAluno: boolean;

  /** Ids dos cursos de que o professor logado e responsavel. */
  cursos: ReadonlySet<number>;

  /** Ids das turmas: do professor, as que ele da aula; do aluno, as que estuda. */
  turmas: ReadonlySet<number>;

  /** Ids das matriculas alcancadas. */
  matriculas: ReadonlySet<number>;

  /** Ids dos alunos alcancados (para o aluno, um conjunto de um elemento so). */
  alunos: ReadonlySet<number>;
}

/** Escopo de quem ve tudo. Os conjuntos ficam vazios porque nunca sao lidos. */
const ESCOPO_IRRESTRITO: EscopoDeDados = {
  tipo: 'irrestrito',
  irrestrito: true,
  apenasProprioAluno: false,
  cursos: new Set(),
  turmas: new Set(),
  matriculas: new Set(),
  alunos: new Set(),
};

/** Escopo de quem nao alcanca nada (perfil sem vinculo cadastrado). */
const ESCOPO_VAZIO: EscopoDeDados = {
  tipo: 'vazio',
  irrestrito: false,
  apenasProprioAluno: false,
  cursos: new Set(),
  turmas: new Set(),
  matriculas: new Set(),
  alunos: new Set(),
};

/**
 * ACESSO SERVICE - quem ve o que, no sistema todo.
 *
 * Tem duas metades, e elas resolvem problemas diferentes:
 *
 *   1. PERMISSAO POR PERFIL (sincrona, nao consulta a API)
 *      podeVer('payments') / podeEditar('enrollments')
 *      Usada pelo permissaoGuard (rota), pelo menu lateral e pelos botoes.
 *
 *   2. ESCOPO DE DADOS (assincrono, consulta a API uma vez)
 *      escopo() devolve os ids que o usuario alcanca, e os metodos
 *      filtrar*() aplicam esses ids sobre a lista que a tela carregou.
 *
 * COMO AS TELAS USAM
 * ------------------
 *   forkJoin({
 *     escopo: this.acesso.escopo(),
 *     matriculas: this.enrollmentService.listarComAlunoETurma(),
 *   }).subscribe(({ escopo, matriculas }) => {
 *     this.matriculas.set(this.acesso.filtrarMatriculas(escopo, matriculas));
 *   });
 *
 * Os metodos filtrar*() recebem o escopo COMO PARAMETRO, em vez de lerem um
 * estado guardado aqui dentro. Isso e de proposito: evita o bug silencioso de
 * uma tela filtrar antes de o escopo ter carregado (o filtro devolveria lista
 * vazia e pareceria "nao tem registro"), e deixa cada funcao testavel sozinha.
 *
 * HONESTIDADE TECNICA (resposta se o professor perguntar)
 * -------------------------------------------------------
 * Esta e uma restricao de INTERFACE, nao de servidor. O JSON Server entrega
 * qualquer rota a quem pedir: um aluno que abrir o DevTools e chamar
 * GET /students na mao recebe os dados. Num sistema real a mesma matriz
 * precisaria existir NO BACKEND, e o front seria apenas a conveniencia de nao
 * mostrar o que vai ser negado. O escopo academico aqui e a camada de
 * apresentacao, e essa limitacao e consciente.
 */
@Injectable({ providedIn: 'root' })
export class AcessoService {
  private readonly auth = inject(AuthService);
  private readonly courseService = inject(CourseService);
  private readonly classService = inject(ClassService);
  private readonly enrollmentService = inject(EnrollmentService);

  /**
   * O escopo fica em cache: shareReplay(1) guarda a primeira resposta e
   * entrega a mesma para quem pedir depois, sem repetir as consultas. Sem
   * isso, cada tela que o usuario abrisse recarregaria as matriculas dele.
   */
  private escopoEmCache?: Observable<EscopoDeDados>;

  /**
   * De QUEM e o escopo que esta no cache.
   *
   * Guardar o dono do cache resolve a falha mais grave que esta funcionalidade
   * poderia ter: sair com um usuario, entrar com outro e o segundo herdar o
   * escopo do primeiro - um aluno vendo as matriculas de outro, ou um
   * professor vendo as turmas de um colega.
   *
   * A alternativa seria o AuthService avisar este service no logout, mas isso
   * criaria import circular (AuthService -> AcessoService -> AuthService).
   * Comparar o id na hora de usar nao tem esse problema e ainda cobre um caso
   * que o aviso no logout nao cobriria: alguem trocar a chave do localStorage
   * na mao, pelo console, sem passar pelo logout.
   */
  private donoDoCache?: number | null;

  // ==========================================================================
  //  1) PERMISSAO POR PERFIL
  // ==========================================================================

  /** O perfil de quem esta logado, ou null se nao ha ninguem logado. */
  perfil(): UserRole | null {
    return this.auth.usuarioLogado()?.role ?? null;
  }

  /** true quando o perfil logado pode ABRIR a tela desta area. */
  podeVer(area: Area): boolean {
    return this.pode(area, 'ver');
  }

  /** true quando o perfil logado pode CADASTRAR nesta area. */
  podeCriar(area: Area): boolean {
    return this.pode(area, 'criar');
  }

  /** true quando o perfil logado pode ALTERAR um registro desta area. */
  podeEditar(area: Area): boolean {
    return this.pode(area, 'editar');
  }

  /** true quando o perfil logado pode EXCLUIR um registro desta area. */
  podeExcluir(area: Area): boolean {
    return this.pode(area, 'excluir');
  }

  /**
   * true quando o perfil ESCREVE de alguma forma nesta area (cria ou edita).
   *
   * E o atalho que as telas usam para decidir se a coluna "Acoes" existe:
   * quem nao cria nem edita nada nao precisa da coluna. Para decidir cada
   * BOTAO dentro da coluna, use podeCriar/podeEditar/podeExcluir, que sao
   * precisos.
   */
  podeGerenciar(area: Area): boolean {
    return this.podeCriar(area) || this.podeEditar(area) || this.podeExcluir(area);
  }

  /** Atalho generico, usado pelo permissaoGuard a partir do data da rota. */
  pode(area: Area, acao: Acao): boolean {
    const perfil = this.perfil();
    return perfil !== null && PERMISSOES[area][acao].includes(perfil);
  }

  /**
   * true quando o usuario logado pode EFETUAR o pagamento das proprias
   * mensalidades (somente o aluno).
   *
   * Fica fora da matriz de proposito: pagar nao e "editar parcela". O
   * administrador CONFIRMA recebimento de qualquer parcela (podeEditar); o
   * aluno PAGA as parcelas dele - e quem garante o "dele" e o escopo de dados,
   * conferido na tela antes de gravar.
   */
  podePagarMensalidade(): boolean {
    return this.ehAluno();
  }

  /** true quando o perfil ve a base inteira (apenas o admin). */
  veTudo(): boolean {
    return this.perfil() === 'admin';
  }

  /** true quando o usuario logado e professor (acesso limitado as turmas dele). */
  ehProfessor(): boolean {
    return this.perfil() === 'professor';
  }

  /** true quando o usuario logado e um aluno (acesso somente ao proprio cadastro). */
  ehAluno(): boolean {
    return this.perfil() === 'aluno';
  }

  /** O id do aluno vinculado ao usuario logado, ou null. */
  studentIdLogado(): number | null {
    return this.auth.usuarioLogado()?.studentId ?? null;
  }

  /**
   * O id que os cursos e as turmas guardam em `teacherId` quando sao deste
   * professor - ou seja, o proprio User.id.
   *
   * Devolve null para quem nao e professor, para nunca acontecer de um
   * administrador de id 4 "virar dono" dos cursos do professor de id 4.
   */
  teacherIdLogado(): number | null {
    if (!this.ehProfessor()) {
      return null;
    }
    return this.auth.usuarioLogado()?.id ?? null;
  }

  // ==========================================================================
  //  2) ESCOPO DE DADOS
  // ==========================================================================

  /**
   * Monta (uma vez) o escopo de dados do usuario logado.
   *
   * Cada perfil precisa de consultas diferentes, e por isso os tres caminhos:
   *
   *   admin     -> NENHUMA consulta. Devolve o escopo irrestrito na hora, com
   *                of(). Nao faz sentido descobrir "quais matriculas sao
   *                suas" para quem ve todas.
   *
   *   professor -> parte dos CURSOS dele e desce: curso -> turma -> matricula
   *                -> aluno.
   *
   *   aluno     -> parte das PROPRIAS matriculas e sobe: matricula -> turma.
   */
  escopo(): Observable<EscopoDeDados> {
    const usuarioAtual = this.auth.usuarioLogado()?.id ?? null;

    // Cache valido somente para o MESMO usuario que o montou.
    if (!this.escopoEmCache || this.donoDoCache !== usuarioAtual) {
      this.donoDoCache = usuarioAtual;
      this.escopoEmCache = this.montarEscopo().pipe(shareReplay(1));
    }

    return this.escopoEmCache;
  }

  /**
   * Joga o escopo em cache fora, para a proxima tela remonta-lo.
   *
   * Precisa existir por causa de uma situacao real: o aluno se matricula em um
   * curso novo e o escopo dele em cache ainda nao conhece essa matricula -
   * entao a tela de mensalidades filtraria a parcela recem-criada para fora e
   * pareceria que a matricula nao gerou financeiro nenhum.
   */
  invalidarEscopo(): void {
    this.escopoEmCache = undefined;
    this.donoDoCache = undefined;
  }

  private montarEscopo(): Observable<EscopoDeDados> {
    if (this.veTudo()) {
      return of(ESCOPO_IRRESTRITO);
    }

    if (this.ehProfessor()) {
      const teacherId = this.teacherIdLogado();
      return teacherId === null ? of(ESCOPO_VAZIO) : this.escopoDoProfessor(teacherId);
    }

    if (this.ehAluno()) {
      const studentId = this.studentIdLogado();
      // Aluno sem studentId e cadastro incompleto: nao alcanca nada. Falhar
      // fechado (sem acesso) e o comportamento certo aqui - falhar aberto
      // mostraria a base inteira por causa de um campo esquecido.
      return studentId === null ? of(ESCOPO_VAZIO) : this.escopoDoAluno(studentId);
    }

    return of(ESCOPO_VAZIO);
  }

  /**
   * Cadeia do professor: cursos dele -> turmas desses cursos (mais as turmas
   * em que ele e o professor direto) -> matriculas dessas turmas -> alunos
   * dessas matriculas.
   *
   * POR QUE AS TURMAS E AS MATRICULAS VEM INTEIRAS DA API
   * -----------------------------------------------------
   * O JSON Server nao sabe responder "turmas cujo courseId esteja NESTA lista"
   * nem fazer OU entre dois filtros. As alternativas seriam uma consulta por
   * curso e outra por turma (N+1 requisicoes) ou trazer as duas colecoes e
   * recortar aqui. Para o tamanho deste sistema - uma escola com tres cursos -
   * a segunda e mais simples e mais rapida, e e a escolhida.
   *
   * O custo e honesto e esta registrado: a resposta da API chega ao navegador
   * do professor com as turmas e as matriculas da escola inteira, e so depois
   * e recortada. A tela mostra o certo; o dado dos outros passou por ali. Num
   * backend de verdade o recorte seria feito no servidor.
   */
  private escopoDoProfessor(teacherId: number): Observable<EscopoDeDados> {
    return forkJoin({
      cursos: this.courseService.listarPorProfessor(teacherId),
      turmas: this.classService.list(),
      matriculas: this.enrollmentService.list(),
    }).pipe(
      map(({ cursos, turmas, matriculas }) => {
        const idsDosCursos = new Set(cursos.map((curso) => curso.id!));

        // Uma turma e do professor quando ele e o responsavel DELA ou quando
        // ela pertence a um curso dele (turma que ficou sem responsavel).
        const turmasDele = turmas.filter(
          (turma) => turma.teacherId === teacherId || idsDosCursos.has(turma.courseId),
        );
        const idsDasTurmas = new Set(turmasDele.map((turma) => turma.id!));

        const matriculasDele = matriculas.filter((matricula) =>
          idsDasTurmas.has(matricula.classId),
        );

        return {
          tipo: 'professor' as const,
          irrestrito: false,
          apenasProprioAluno: false,
          cursos: idsDosCursos,
          turmas: idsDasTurmas,
          matriculas: new Set(matriculasDele.map((matricula) => matricula.id!)),
          alunos: new Set(matriculasDele.map((matricula) => matricula.studentId)),
        };
      }),
    );
  }

  /** Cadeia do aluno: as proprias matriculas -> as turmas em que estuda. */
  private escopoDoAluno(studentId: number): Observable<EscopoDeDados> {
    return this.enrollmentService.listarPorAluno(studentId).pipe(
      map((matriculas) => ({
        tipo: 'proprioAluno' as const,
        irrestrito: false,
        apenasProprioAluno: true,
        // O catalogo de cursos e informacao publica (o aluno escolhe curso
        // antes de ter conta), entao nao ha o que recortar aqui.
        cursos: new Set<number>(),
        turmas: new Set(matriculas.map((m) => m.classId)),
        matriculas: new Set(matriculas.map((m) => m.id!)),
        alunos: new Set([studentId]),
      })),
    );
  }

  // ==========================================================================
  //  3) OS FILTROS
  // ==========================================================================
  //  Um por colecao que algum perfil restrito alcanca. Todos seguem a mesma
  //  forma: escopo irrestrito devolve a lista inteira; o resto recorta pelo
  //  conjunto de ids que corresponde ao tipo de escopo.
  // --------------------------------------------------------------------------

  /**
   * Cursos.
   *
   *   admin     -> o catalogo inteiro
   *   professor -> somente os cursos de que e responsavel
   *   aluno     -> o catalogo inteiro (requisito 4: ele precisa VER os cursos
   *                disponiveis para escolher um; preco e carga horaria de
   *                curso nao sao dado de ninguem)
   */
  filtrarCursos<T extends Course>(escopo: EscopoDeDados, cursos: T[]): T[] {
    if (escopo.irrestrito || escopo.tipo === 'proprioAluno') {
      return cursos;
    }
    return cursos.filter((curso) => escopo.cursos.has(curso.id!));
  }

  /** Turmas: do professor, as que ele da aula; do aluno, as que estuda. */
  filtrarTurmas<T extends Class>(escopo: EscopoDeDados, turmas: T[]): T[] {
    if (escopo.irrestrito) {
      return turmas;
    }
    return turmas.filter((turma) => escopo.turmas.has(turma.id!));
  }

  /**
   * Matriculas.
   *
   * Para o aluno o filtro e pelo PROPRIO id, e nao pela turma: ele estuda numa
   * turma com outros alunos e nao pode ver a matricula dos colegas. Para o
   * professor o filtro e pela MATRICULA, porque ele precisa justamente das
   * matriculas dos alunos dele.
   */
  filtrarMatriculas<T extends Enrollment>(escopo: EscopoDeDados, matriculas: T[]): T[] {
    if (escopo.irrestrito) {
      return matriculas;
    }
    if (escopo.apenasProprioAluno) {
      return matriculas.filter((m) => escopo.alunos.has(m.studentId));
    }
    return matriculas.filter((m) => escopo.matriculas.has(m.id!));
  }

  /** Alunos: para o aluno logado, so ele mesmo; para o professor, os das turmas dele. */
  filtrarAlunos<T extends Student>(escopo: EscopoDeDados, alunos: T[]): T[] {
    if (escopo.irrestrito) {
      return alunos;
    }
    return alunos.filter((aluno) => escopo.alunos.has(aluno.id!));
  }

  /** Lancamentos financeiros: os das matriculas que o usuario alcanca. */
  filtrarLancamentos<T extends FinancialRecord>(escopo: EscopoDeDados, lancamentos: T[]): T[] {
    if (escopo.irrestrito) {
      return lancamentos;
    }
    return lancamentos.filter((lancamento) => escopo.matriculas.has(lancamento.enrollmentId));
  }

  /** Parcelas do financeiro: as das matriculas que o usuario alcanca. */
  filtrarPagamentos<T extends Payment>(escopo: EscopoDeDados, parcelas: T[]): T[] {
    if (escopo.irrestrito) {
      return parcelas;
    }
    return parcelas.filter((parcela) => escopo.matriculas.has(parcela.enrollmentId));
  }

  /**
   * Registros de frequencia.
   *
   * Aqui os dois perfis restritos divergem, e a diferenca e importante:
   *
   *   aluno     -> somente a propria presenca (filtro por aluno)
   *   professor -> a presenca de todos os alunos das turmas DELE (filtro por
   *                turma) - porque e ele que faz a chamada
   */
  filtrarFrequencias<T extends Attendance>(escopo: EscopoDeDados, registros: T[]): T[] {
    if (escopo.irrestrito) {
      return registros;
    }
    if (escopo.apenasProprioAluno) {
      return registros.filter((registro) => escopo.alunos.has(registro.studentId));
    }
    return registros.filter((registro) => escopo.turmas.has(registro.classId));
  }
}
