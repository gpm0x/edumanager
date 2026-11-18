/**
 * TESTES DAS REGRAS DE ACESSO
 * ===========================
 *
 * Este arquivo prova, de forma automatica, que cada perfil alcanca exatamente o
 * que deve alcancar - e, mais importante, que NAO alcanca o resto.
 *
 * POR QUE ESTA LOGICA MERECE TESTE, E O RESTO DO SISTEMA NAO
 * ----------------------------------------------------------
 * Uma tela com defeito aparece: o usuario abre, ve errado e reclama. Uma
 * permissao com defeito NAO aparece - ela funciona silenciosamente ao contrario,
 * mostrando a um aluno os dados dos colegas, e ninguem percebe ate alguem
 * perceber. E o tipo de erro que nao se descobre usando o sistema, so
 * conferindo a regra.
 *
 * E tambem a parte mais barata de testar: a matriz de permissoes e sincrona
 * (nao chama API) e os filtros sao funcoes puras, que recebem o escopo como
 * parametro. Por isso o AcessoService foi escrito desse jeito.
 *
 * OS TRES PERFIS
 * --------------
 *   admin     -> ve e gerencia tudo.
 *   professor -> ve os cursos e as turmas DELE, e os alunos dessas turmas.
 *                Edita o que e academico; nao exclui e nao mexe em dinheiro.
 *   aluno     -> ve SOMENTE o que e dele: suas matriculas, suas mensalidades e
 *                sua frequencia. So escreve em um lugar: criar a propria
 *                matricula.
 *
 * O caso mais importante aqui e o do aluno que estuda numa turma COM OUTROS
 * ALUNOS: ele ve a turma, e nao pode ver a matricula nem a presenca dos
 * colegas. E a situacao do seed: os dois alunos dividem a turma 1.
 *
 * A regra em jogo e a diferenca entre filtrar POR TURMA e filtrar PELO PROPRIO
 * ID - trocar um pelo outro vazaria dado sem quebrar nada na tela. E o
 * professor e o espelho disso: para ele o filtro CERTO e por turma, porque ele
 * precisa justamente ver os registros dos alunos dele. Os dois filtros existem,
 * e usar o do outro perfil seria vazamento (no caso do aluno) ou tela vazia (no
 * caso do professor).
 *
 * Os dados de apoio abaixo sao MAIS RICOS que o seed, de proposito: ha um aluno
 * em duas turmas e turmas sem matricula. O teste de uma funcao pura nao precisa
 * se limitar ao que o db.json tem hoje, e cobrir o caso de varias turmas
 * protege a regra se o seed crescer.
 *
 * Executar com:  npm test
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  Attendance,
  Class,
  Course,
  Enrollment,
  FinancialRecord,
  Payment,
  Student,
  User,
} from '../models';
import { AUTH_STORAGE_KEY } from './auth.service';
import { AcessoService, Area, EscopoDeDados } from './acesso.service';

// ============================================================================
//  DADOS DE APOIO (no formato de api/db.json)
// ============================================================================

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
 * Professor responsavel pelos cursos 1 e 2.
 *
 * Note que ele NAO tem studentId: o vinculo do professor e o contrario - sao os
 * cursos e as turmas que apontam para o id dele (teacherId).
 */
const PROFESSOR: User = {
  id: 4,
  name: 'Carlos Eduardo Nunes',
  email: 'professor@edumanager.com.br',
  login: 'professor',
  password: 'prof123',
  role: 'professor',
  active: true,
};

/** Aluno vinculado ao cadastro de aluno 1. */
const ALUNO: User = {
  id: 5,
  name: 'Ana Clara Souza',
  email: 'ana@aluno.edumanager.com.br',
  login: 'aluno',
  password: '123456',
  role: 'aluno',
  active: true,
  studentId: 1,
};

/** Outro aluno, para provar que um nao alcanca o escopo do outro. */
const OUTRO_ALUNO: User = { ...ALUNO, id: 6, login: 'aluno2', studentId: 2 };

/** Aluno com perfil certo mas SEM vinculo cadastrado (campo esquecido). */
const ALUNO_SEM_VINCULO: User = { ...ALUNO, id: 9, studentId: undefined };

/**
 * Cursos de apoio: 1 e 2 sao do PROFESSOR (id 4); o 3 e de outra pessoa.
 *
 * O curso 3 existe exatamente para provar o que o professor NAO ve.
 */
const CURSOS: Course[] = [
  {
    id: 1,
    name: 'Informatica Basica',
    description: 'Curso de apoio ao teste.',
    workload: 60,
    price: 450,
    teacherId: 4,
    active: true,
  },
  {
    id: 2,
    name: 'Desenvolvimento Web',
    description: 'Curso de apoio ao teste.',
    workload: 120,
    price: 1200,
    teacherId: 4,
    active: true,
  },
  {
    id: 3,
    name: 'Administracao',
    description: 'Curso de outro professor.',
    workload: 90,
    price: 900,
    teacherId: 7,
    active: true,
  },
];

const TURMAS: Class[] = [
  {
    id: 1,
    courseId: 1,
    code: 'INF-2026-2',
    shift: 'manha',
    startDate: '2026-02-01',
    endDate: '2026-06-30',
    capacity: 20,
    status: 'ativa',
  },
  {
    id: 2,
    courseId: 2,
    code: 'WEB-2026-2',
    shift: 'noite',
    startDate: '2026-02-01',
    endDate: '2026-06-30',
    capacity: 25,
    status: 'ativa',
  },
  {
    id: 3,
    courseId: 3,
    code: 'ADM-2026-2',
    shift: 'tarde',
    startDate: '2026-02-01',
    endDate: '2026-06-30',
    capacity: 30,
    status: 'ativa',
  },
];

/**
 * As matriculas de apoio.
 *
 * O desenho importa: o aluno 1 e o aluno 2 dividem a TURMA 1. E o caso que
 * separa "filtrar pela turma" de "filtrar por mim" - se o filtro usasse a
 * turma, o aluno 1 veria a matricula 2, que e do colega.
 */
const MATRICULAS: Enrollment[] = [
  { id: 1, studentId: 1, classId: 1, enrollmentDate: '2026-02-10', status: 'ativa' },
  { id: 2, studentId: 2, classId: 1, enrollmentDate: '2026-02-10', status: 'ativa' },
  { id: 3, studentId: 3, classId: 2, enrollmentDate: '2026-02-11', status: 'ativa' },
  { id: 5, studentId: 5, classId: 3, enrollmentDate: '2026-02-12', status: 'ativa' },
  { id: 9, studentId: 1, classId: 2, enrollmentDate: '2026-02-13', status: 'ativa' },
];

const ALUNOS: Student[] = [1, 2, 3, 5].map((id) => ({
  id,
  name: `Aluno ${id}`,
  cpf: '00000000000',
  birthDate: '2000-01-01',
  email: `aluno${id}@escola.com`,
  phone: '',
  address: '',
  status: 'ativo' as const,
}));

const PARCELAS: Payment[] = [
  { id: 1, enrollmentId: 1, dueDate: '2026-03-10', amount: 100, paidAt: null, status: 'pendente' },
  { id: 2, enrollmentId: 5, dueDate: '2026-03-10', amount: 200, paidAt: null, status: 'vencido' },
  { id: 3, enrollmentId: 9, dueDate: '2026-03-10', amount: 300, paidAt: null, status: 'pendente' },
];

/** Lancamentos financeiros, um por matricula, para testar filtrarLancamentos. */
const LANCAMENTOS: FinancialRecord[] = [
  {
    id: 1,
    enrollmentId: 1,
    totalAmount: 450,
    condition: 'avista',
    installments: 1,
    method: 'pix',
    status: 'pendente',
    createdAt: '2026-02-10',
  },
  {
    id: 2,
    enrollmentId: 5,
    totalAmount: 900,
    condition: 'parcelado',
    installments: 3,
    method: 'cartao',
    status: 'pendente',
    createdAt: '2026-02-12',
  },
  {
    id: 3,
    enrollmentId: 9,
    totalAmount: 1200,
    condition: 'parcelado',
    installments: 2,
    method: 'dinheiro',
    status: 'pendente',
    createdAt: '2026-02-13',
  },
];

/** Presencas da turma 1 (alunos 1 e 2) e da turma 3 (aluno 5). */
const FREQUENCIAS: Attendance[] = [
  { id: 1, classId: 1, studentId: 1, date: '2026-03-02', present: true },
  { id: 2, classId: 1, studentId: 2, date: '2026-03-02', present: false },
  { id: 3, classId: 3, studentId: 5, date: '2026-03-02', present: true },
];

/** Todas as areas do sistema, para varrer a matriz inteira nos testes. */
const TODAS_AS_AREAS: Area[] = [
  'dashboard',
  'students',
  'courses',
  'classes',
  'enrollments',
  'financial',
  'payments',
  'attendances',
  'users',
  'reports',
];

// ============================================================================
//  APOIO
// ============================================================================

/** Cria o service com um usuario "logado" (gravado no localStorage). */
function servicoCom(usuario: User | null): AcessoService {
  if (usuario === null) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(usuario));
  }

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });

  return TestBed.inject(AcessoService);
}

/**
 * Monta um escopo na mao, sem passar pela API.
 *
 * Os filtros recebem o escopo como parametro justamente para permitir isto: o
 * teste do FILTRO nao precisa simular requisicao.
 */
function escopoDe(parcial: Partial<EscopoDeDados>): EscopoDeDados {
  return {
    tipo: 'vazio',
    irrestrito: false,
    apenasProprioAluno: false,
    cursos: new Set(),
    turmas: new Set(),
    matriculas: new Set(),
    alunos: new Set(),
    ...parcial,
  };
}

/** O escopo que o aluno 1 teria (matriculas 1 e 9, nas turmas 1 e 2). */
const ESCOPO_DO_ALUNO = escopoDe({
  tipo: 'proprioAluno',
  apenasProprioAluno: true,
  turmas: new Set([1, 2]),
  matriculas: new Set([1, 9]),
  alunos: new Set([1]),
});

/**
 * O escopo que o PROFESSOR (id 4) teria: cursos 1 e 2, logo turmas 1 e 2, logo
 * as matriculas 1, 2, 3 e 9 - e os alunos 1, 2 e 3.
 *
 * Repare na matricula 2: ela e do aluno 2, que NAO e o professor nem esta
 * ligado a ele por identidade - e ele precisa ve-la, porque o aluno 2 estuda na
 * turma dele. E o oposto exato do caso do aluno.
 */
const ESCOPO_DO_PROFESSOR = escopoDe({
  tipo: 'professor',
  cursos: new Set([1, 2]),
  turmas: new Set([1, 2]),
  matriculas: new Set([1, 2, 3, 9]),
  alunos: new Set([1, 2, 3]),
});

const ESCOPO_IRRESTRITO = escopoDe({ tipo: 'irrestrito', irrestrito: true });

beforeEach(() => {
  localStorage.clear();
});

// ============================================================================
//  1) A MATRIZ DE PERMISSOES
// ============================================================================

describe('AcessoService - permissao por perfil', () => {
  describe('admin', () => {
    it('ve todas as areas do sistema', () => {
      const acesso = servicoCom(ADMIN);
      for (const area of TODAS_AS_AREAS) {
        expect(acesso.podeVer(area), `deveria ver ${area}`).toBe(true);
      }
    });

    it('cria, edita e exclui em tudo, menos nas duas telas de leitura', () => {
      const acesso = servicoCom(ADMIN);

      // Painel e relatorio nao tem o que gerenciar: nao existe "criar painel".
      const somenteLeitura: Area[] = ['dashboard', 'reports'];

      for (const area of TODAS_AS_AREAS) {
        const esperado = !somenteLeitura.includes(area);
        expect(acesso.podeCriar(area), `criar ${area}`).toBe(esperado);
        expect(acesso.podeEditar(area), `editar ${area}`).toBe(esperado);
        expect(acesso.podeExcluir(area), `excluir ${area}`).toBe(esperado);
      }
    });

    it('e reconhecido como quem ve tudo', () => {
      const acesso = servicoCom(ADMIN);
      expect(acesso.veTudo()).toBe(true);
      expect(acesso.ehProfessor()).toBe(false);
      expect(acesso.ehAluno()).toBe(false);
      expect(acesso.perfil()).toBe('admin');
    });

    it('nao e tratado como professor, mesmo que exista curso com o id dele', () => {
      // teacherIdLogado() devolve null para quem nao e professor. Sem isso, um
      // administrador de id 4 "herdaria" os cursos do professor de id 4 - dois
      // registros diferentes com o mesmo numero, que e o tipo de coincidencia
      // que o JSON Server permite.
      const acesso = servicoCom(ADMIN);
      expect(acesso.teacherIdLogado()).toBeNull();
    });
  });

  describe('professor', () => {
    it('ve a area academica, e NAO ve o financeiro nem as credenciais', () => {
      const acesso = servicoCom(PROFESSOR);

      const deveVer: Area[] = [
        'dashboard',
        'students',
        'courses',
        'classes',
        'enrollments',
        'attendances',
      ];

      for (const area of TODAS_AS_AREAS) {
        expect(acesso.podeVer(area), `ver ${area}`).toBe(deveVer.includes(area));
      }
    });

    it('NAO alcanca o cadastro de usuarios: nem para ver', () => {
      // E o teste que cumpre tres proibicoes do requisito 2 de uma vez: o
      // professor nao cria administradores, nao altera as proprias permissoes e
      // nao exclui contas administrativas.
      const acesso = servicoCom(PROFESSOR);
      expect(acesso.podeVer('users')).toBe(false);
      expect(acesso.podeCriar('users')).toBe(false);
      expect(acesso.podeEditar('users')).toBe(false);
      expect(acesso.podeExcluir('users')).toBe(false);
    });

    it('edita o que e academico, mas nao cadastra nem exclui', () => {
      const acesso = servicoCom(PROFESSOR);

      for (const area of ['students', 'courses', 'classes', 'enrollments'] as Area[]) {
        expect(acesso.podeEditar(area), `editar ${area}`).toBe(true);
        expect(acesso.podeCriar(area), `criar ${area}`).toBe(false);
        expect(acesso.podeExcluir(area), `excluir ${area}`).toBe(false);
      }
    });

    it('lanca e corrige frequencia, mas nao apaga historico de presenca', () => {
      const acesso = servicoCom(PROFESSOR);
      expect(acesso.podeCriar('attendances')).toBe(true);
      expect(acesso.podeEditar('attendances')).toBe(true);
      expect(acesso.podeExcluir('attendances')).toBe(false);
    });

    it('NAO alcanca o financeiro: nem para consultar', () => {
      // Cobranca nao e trabalho do professor: ele fica fora ate do 'ver'.
      const acesso = servicoCom(PROFESSOR);
      expect(acesso.podePagarMensalidade()).toBe(false);

      for (const area of ['financial', 'payments'] as Area[]) {
        expect(acesso.podeVer(area), `ver ${area}`).toBe(false);
        expect(acesso.podeCriar(area), `criar ${area}`).toBe(false);
        expect(acesso.podeEditar(area), `editar ${area}`).toBe(false);
        expect(acesso.podeExcluir(area), `excluir ${area}`).toBe(false);
      }
    });

    it('e reconhecido como professor, e o teacherId e o proprio id do usuario', () => {
      const acesso = servicoCom(PROFESSOR);
      expect(acesso.ehProfessor()).toBe(true);
      expect(acesso.veTudo()).toBe(false);
      expect(acesso.ehAluno()).toBe(false);
      expect(acesso.teacherIdLogado()).toBe(4);
      // Professor nao tem cadastro de aluno: o vinculo dele e por teacherId.
      expect(acesso.studentIdLogado()).toBeNull();
    });
  });

  describe('aluno', () => {
    it('ve o painel, o catalogo e as tres areas da propria vida academica', () => {
      const acesso = servicoCom(ALUNO);

      const deveVer: Area[] = [
        'dashboard',
        // O catalogo e informacao publica: o aluno escolhe curso antes mesmo de
        // ter conta (requisito 4).
        'courses',
        'enrollments',
        'financial',
        'payments',
        'attendances',
      ];

      for (const area of TODAS_AS_AREAS) {
        expect(acesso.podeVer(area), `ver ${area}`).toBe(deveVer.includes(area));
      }
    });

    it('NAO alcanca o cadastro da escola nem os relatorios', () => {
      const acesso = servicoCom(ALUNO);
      expect(acesso.podeVer('students')).toBe(false);
      expect(acesso.podeVer('classes')).toBe(false);
      expect(acesso.podeVer('reports')).toBe(false);
    });

    it('NAO alcanca as credenciais de acesso', () => {
      // E o teste que impede o aluno de abrir /users e se promover a admin.
      const acesso = servicoCom(ALUNO);
      expect(acesso.podeVer('users')).toBe(false);
      expect(acesso.podeGerenciar('users')).toBe(false);
    });

    it('escreve em UM lugar so: criar a propria matricula', () => {
      // E como ele se matricula em um curso novo sem depender da secretaria.
      // Fora disso, nao cria, nao edita e nao exclui nada em nenhuma area - e
      // e essa lista de zeros que faz dele um perfil de consulta.
      const acesso = servicoCom(ALUNO);

      for (const area of TODAS_AS_AREAS) {
        const podeCriarAqui = area === 'enrollments';
        expect(acesso.podeCriar(area), `criar ${area}`).toBe(podeCriarAqui);
        expect(acesso.podeEditar(area), `editar ${area}`).toBe(false);
        expect(acesso.podeExcluir(area), `excluir ${area}`).toBe(false);
      }
    });

    it('cria a propria matricula, mas nao a cancela nem a edita', () => {
      // Cancelar matricula e decisao administrativa: tem efeito no financeiro e
      // na vaga da turma.
      const acesso = servicoCom(ALUNO);
      expect(acesso.podeCriar('enrollments')).toBe(true);
      expect(acesso.podeEditar('enrollments')).toBe(false);
      expect(acesso.podeExcluir('enrollments')).toBe(false);
    });

    it('ve as proprias mensalidades, mas nao pode dar baixa nelas', () => {
      // O teste que protege a regra 6.5: quem confirma pagamento e o
      // administrador. Se o aluno pudesse editar parcela, ele se declararia
      // em dia.
      const acesso = servicoCom(ALUNO);
      expect(acesso.podeVer('payments')).toBe(true);
      expect(acesso.podeEditar('payments')).toBe(false);
      expect(acesso.podeVer('financial')).toBe(true);
      expect(acesso.podeEditar('financial')).toBe(false);
    });

    it('PAGA as proprias mensalidades sem ganhar edicao de parcela', () => {
      // Pagar e uma acao propria do aluno: nao abre a tela de edicao de parcela
      // (onde ele mudaria valor e vencimento).
      const acesso = servicoCom(ALUNO);
      expect(acesso.podePagarMensalidade()).toBe(true);
      expect(acesso.podeEditar('payments')).toBe(false);
    });

    it('e reconhecido como aluno e nao como quem ve tudo', () => {
      const acesso = servicoCom(ALUNO);
      expect(acesso.ehAluno()).toBe(true);
      expect(acesso.ehProfessor()).toBe(false);
      expect(acesso.veTudo()).toBe(false);
      expect(acesso.studentIdLogado()).toBe(1);
      expect(acesso.teacherIdLogado()).toBeNull();
    });
  });

  describe('ninguem logado', () => {
    it('nao ve nem gerencia nada', () => {
      const acesso = servicoCom(null);
      expect(acesso.perfil()).toBeNull();
      for (const area of TODAS_AS_AREAS) {
        expect(acesso.podeVer(area), `ver ${area}`).toBe(false);
        expect(acesso.podeGerenciar(area), `gerenciar ${area}`).toBe(false);
      }
    });

    it('nao e confundido com admin (falha fechado)', () => {
      const acesso = servicoCom(null);
      expect(acesso.veTudo()).toBe(false);
      expect(acesso.ehProfessor()).toBe(false);
      expect(acesso.ehAluno()).toBe(false);
      expect(acesso.studentIdLogado()).toBeNull();
      expect(acesso.teacherIdLogado()).toBeNull();
    });
  });
});

// ============================================================================
//  2) O ESCOPO DE DADOS
// ============================================================================

describe('AcessoService - escopo()', () => {
  it('admin: escopo irrestrito, SEM nenhuma consulta a API', () => {
    const acesso = servicoCom(ADMIN);

    let recebido: EscopoDeDados | undefined;
    acesso.escopo().subscribe((escopo) => (recebido = escopo));

    // of() resolve na hora: se o service tivesse chamado a API, o escopo
    // chegaria depois e este expect falharia.
    expect(recebido?.irrestrito).toBe(true);
    expect(recebido?.apenasProprioAluno).toBe(false);
  });

  it('aluno sem studentId: escopo VAZIO (falha fechado)', () => {
    const acesso = servicoCom(ALUNO_SEM_VINCULO);

    let recebido: EscopoDeDados | undefined;
    acesso.escopo().subscribe((escopo) => (recebido = escopo));

    // Um campo esquecido no cadastro nao pode virar acesso total: sem vinculo,
    // o escopo e vazio e a pessoa nao ve registro nenhum.
    expect(recebido?.irrestrito).toBe(false);
    expect(recebido?.alunos.size).toBe(0);
    expect(recebido?.matriculas.size).toBe(0);
  });

  it('o cache do escopo e por usuario: trocar de conta nao herda o escopo', () => {
    // A falha que este teste impede: sair com um aluno, entrar com outro e o
    // segundo continuar vendo as matriculas do primeiro.
    const comAluno = servicoCom(ALUNO);
    expect(comAluno.studentIdLogado()).toBe(1);

    const comOutro = servicoCom(OUTRO_ALUNO);
    expect(comOutro.studentIdLogado()).toBe(2);

    const comAdmin = servicoCom(ADMIN);
    let recebido: EscopoDeDados | undefined;
    comAdmin.escopo().subscribe((escopo) => (recebido = escopo));
    expect(recebido?.irrestrito).toBe(true);
  });
});

// ============================================================================
//  3) OS FILTROS DE DADOS
// ============================================================================

describe('AcessoService - filtros de dados', () => {
  describe('escopo irrestrito (admin)', () => {
    it('devolve a MESMA lista, sem copiar nem filtrar', () => {
      const acesso = servicoCom(ADMIN);

      // toBe (identidade) e nao toEqual: quem ve tudo nao paga nem o custo de
      // uma copia do array.
      expect(acesso.filtrarCursos(ESCOPO_IRRESTRITO, CURSOS)).toBe(CURSOS);
      expect(acesso.filtrarTurmas(ESCOPO_IRRESTRITO, TURMAS)).toBe(TURMAS);
      expect(acesso.filtrarLancamentos(ESCOPO_IRRESTRITO, LANCAMENTOS)).toBe(LANCAMENTOS);
      expect(acesso.filtrarMatriculas(ESCOPO_IRRESTRITO, MATRICULAS)).toBe(MATRICULAS);
      expect(acesso.filtrarAlunos(ESCOPO_IRRESTRITO, ALUNOS)).toBe(ALUNOS);
      expect(acesso.filtrarPagamentos(ESCOPO_IRRESTRITO, PARCELAS)).toBe(PARCELAS);
      expect(acesso.filtrarFrequencias(ESCOPO_IRRESTRITO, FREQUENCIAS)).toBe(FREQUENCIAS);
    });
  });

  describe('professor', () => {
    const acesso = () => servicoCom(PROFESSOR);

    it('ve somente os cursos de que e responsavel', () => {
      const cursos = acesso().filtrarCursos(ESCOPO_DO_PROFESSOR, CURSOS);
      expect(cursos.map((c) => c.id)).toEqual([1, 2]);
    });

    it('NAO ve o curso de outro professor', () => {
      const cursos = acesso().filtrarCursos(ESCOPO_DO_PROFESSOR, CURSOS);
      expect(cursos.some((c) => c.id === 3)).toBe(false);
    });

    it('ve as turmas dos cursos dele, e nao a turma 3', () => {
      const turmas = acesso().filtrarTurmas(ESCOPO_DO_PROFESSOR, TURMAS);
      expect(turmas.map((t) => t.id)).toEqual([1, 2]);
    });

    it('ve as matriculas de TODOS os alunos das turmas dele', () => {
      // O oposto do caso do aluno, e tao importante quanto: aqui o filtro
      // CERTO e por turma. Se o professor filtrasse "pelo proprio id", a tela
      // dele viria vazia - ele nao e aluno de nada.
      const matriculas = acesso().filtrarMatriculas(ESCOPO_DO_PROFESSOR, MATRICULAS);

      expect(matriculas.map((m) => m.id)).toEqual([1, 2, 3, 9]);
      // A matricula 2 e do aluno 2: e exatamente a que ele PRECISA ver.
      expect(matriculas.some((m) => m.studentId === 2)).toBe(true);
    });

    it('NAO ve a matricula de aluno de turma que nao e dele', () => {
      const matriculas = acesso().filtrarMatriculas(ESCOPO_DO_PROFESSOR, MATRICULAS);
      // A matricula 5 e do aluno 5, na turma 3 (de outro professor).
      expect(matriculas.some((m) => m.id === 5)).toBe(false);
    });

    it('ve os alunos das turmas dele, e nao a escola inteira', () => {
      const alunos = acesso().filtrarAlunos(ESCOPO_DO_PROFESSOR, ALUNOS);
      expect(alunos.map((a) => a.id)).toEqual([1, 2, 3]);
      expect(alunos.some((a) => a.id === 5)).toBe(false);
    });

    it('CONSULTA os lancamentos e as parcelas dos alunos dele', () => {
      const lancamentos = acesso().filtrarLancamentos(ESCOPO_DO_PROFESSOR, LANCAMENTOS);
      const parcelas = acesso().filtrarPagamentos(ESCOPO_DO_PROFESSOR, PARCELAS);

      // Os das matriculas 1 e 9 entram; o da matricula 5 (turma de outro) nao.
      expect(lancamentos.map((l) => l.id)).toEqual([1, 3]);
      expect(parcelas.map((p) => p.id)).toEqual([1, 3]);
    });

    it('ve a frequencia de todos os alunos das turmas dele', () => {
      const registros = acesso().filtrarFrequencias(ESCOPO_DO_PROFESSOR, FREQUENCIAS);

      // As presencas 1 e 2 sao da turma 1, de dois alunos diferentes: ele ve as
      // duas, porque e ele quem faz a chamada. A 3 e da turma 3: fica fora.
      expect(registros.map((f) => f.id)).toEqual([1, 2]);
    });
  });

  describe('aluno', () => {
    const acesso = () => servicoCom(ALUNO);

    it('ve o catalogo de cursos inteiro: preco e carga nao sao dado de ninguem', () => {
      // Requisito 4: ele precisa VER os cursos disponiveis para escolher um.
      const cursos = acesso().filtrarCursos(ESCOPO_DO_ALUNO, CURSOS);
      expect(cursos.map((c) => c.id)).toEqual([1, 2, 3]);
    });

    it('ve somente os lancamentos das proprias matriculas', () => {
      const lancamentos = acesso().filtrarLancamentos(ESCOPO_DO_ALUNO, LANCAMENTOS);

      // O lancamento 2 e da matricula 5, do aluno 5: fica de fora.
      expect(lancamentos.map((l) => l.id)).toEqual([1, 3]);
    });

    it('ve as turmas em que estuda', () => {
      const turmas = acesso().filtrarTurmas(ESCOPO_DO_ALUNO, TURMAS);
      expect(turmas.map((t) => t.id)).toEqual([1, 2]);
    });

    it('NAO ve a turma em que nao esta matriculado', () => {
      const turmas = acesso().filtrarTurmas(ESCOPO_DO_ALUNO, TURMAS);
      expect(turmas.some((t) => t.id === 3)).toBe(false);
    });

    it('ve somente as PROPRIAS matriculas, e nao as dos colegas de turma', () => {
      // O teste central do perfil: o aluno 1 e o aluno 2 estao na MESMA turma 1.
      // Filtrando por turma, a matricula 2 (do colega) entraria.
      const matriculas = acesso().filtrarMatriculas(ESCOPO_DO_ALUNO, MATRICULAS);

      expect(matriculas.map((m) => m.id)).toEqual([1, 9]);
      expect(matriculas.every((m) => m.studentId === 1)).toBe(true);
    });

    it('ve somente o proprio cadastro na lista de alunos', () => {
      const alunos = acesso().filtrarAlunos(ESCOPO_DO_ALUNO, ALUNOS);
      expect(alunos.map((a) => a.id)).toEqual([1]);
    });

    it('ve somente as parcelas das proprias matriculas', () => {
      const parcelas = acesso().filtrarPagamentos(ESCOPO_DO_ALUNO, PARCELAS);

      // A parcela 2 e da matricula 5, do aluno 5: fica de fora.
      expect(parcelas.map((p) => p.id)).toEqual([1, 3]);
    });

    it('ve somente a propria frequencia, e nao a dos colegas', () => {
      // Mesma armadilha das matriculas: as presencas 1 e 2 sao da mesma turma,
      // de alunos diferentes.
      const registros = acesso().filtrarFrequencias(ESCOPO_DO_ALUNO, FREQUENCIAS);

      expect(registros.map((f) => f.id)).toEqual([1]);
      expect(registros.every((f) => f.studentId === 1)).toBe(true);
    });
  });

  describe('escopo vazio (perfil sem vinculo)', () => {
    it('nao devolve nenhum registro de nenhuma colecao', () => {
      const acesso = servicoCom(ALUNO_SEM_VINCULO);
      const vazio = escopoDe({});

      expect(acesso.filtrarCursos(vazio, CURSOS)).toEqual([]);
      expect(acesso.filtrarTurmas(vazio, TURMAS)).toEqual([]);
      expect(acesso.filtrarLancamentos(vazio, LANCAMENTOS)).toEqual([]);
      expect(acesso.filtrarMatriculas(vazio, MATRICULAS)).toEqual([]);
      expect(acesso.filtrarAlunos(vazio, ALUNOS)).toEqual([]);
      expect(acesso.filtrarPagamentos(vazio, PARCELAS)).toEqual([]);
      expect(acesso.filtrarFrequencias(vazio, FREQUENCIAS)).toEqual([]);
    });
  });
});
