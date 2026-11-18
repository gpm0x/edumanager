import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import {
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  StatCardComponent,
  StatusChipComponent,
} from '../../shared';
import { Attendance, Class, Course, Payment, Student } from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { AuthService } from '../../core/services/auth.service';
import { ClassService } from '../../core/services/class.service';
import { CourseService } from '../../core/services/course.service';
import { EnrollmentComRelacoes, EnrollmentService } from '../../core/services/enrollment.service';
import { PaymentService } from '../../core/services/payment.service';
import { StudentService } from '../../core/services/student.service';
import { UserService } from '../../core/services/user.service';

/** Quantos itens as listas curtas do painel mostram. */
const LIMITE_DA_LISTA = 5;

/** Janela de dias que define uma matricula "nova" no card do administrador. */
const DIAS_DE_MATRICULA_NOVA = 30;

/**
 * DASHBOARD - um painel por perfil (requisito 9).
 *
 * TRES PAINEIS, UM COMPONENTE
 * ---------------------------
 * O requisito pede indicadores diferentes para administrador, professor e
 * aluno. Isso poderia ser tres componentes, e nao e - de proposito:
 *
 *   - o trabalho duro e IGUAL nos tres (carregar as colecoes, aplicar o escopo,
 *     contar, somar, formatar dinheiro e data). Em tres componentes, essa parte
 *     seria copiada tres vezes;
 *   - o que muda e QUAIS numeros aparecem, e isso e uma decisao de template.
 *
 * Entao o componente carrega o que o perfil alcanca, calcula tudo, e o template
 * escolhe o conjunto de cards. A regra de "o que cada um alcanca" nao esta
 * aqui: esta no AcessoService, como no resto do sistema.
 *
 * NENHUM NUMERO E INVENTADO (requisito 9)
 * ---------------------------------------
 * Todo card sai de uma consulta ao JSON Server. Onde nao ha dado, o card mostra
 * "-" ou nao aparece - nunca um zero decorativo, que mentiria dizendo "a escola
 * esta em dia" quando a verdade e "ninguem consultou o financeiro".
 *
 * O QUE CADA PERFIL PEDE DA API
 * -----------------------------
 * As consultas sao condicionais (`podeVer(...) ? consulta : of([])`), e isso
 * nao e so economia: e o que impede a resposta da API de levar ao navegador do
 * aluno a lista de alunos da escola. A tela mostraria o certo de qualquer
 * forma - mas o dado dos outros teria passado por ali, visivel no DevTools.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    MatIconModule,
    MatButtonModule,
    StatCardComponent,
    StatusChipComponent,
    EmptyStateComponent,
    EscopoAvisoComponent,
    LoadingComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly acesso = inject(AcessoService);
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentService = inject(StudentService);
  private readonly courseService = inject(CourseService);
  private readonly classService = inject(ClassService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly paymentService = inject(PaymentService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly userService = inject(UserService);

  readonly usuario = this.auth.usuarioLogado();

  // --- O que este perfil pode ver (decide cards, listas e consultas) --------
  readonly ehAluno = this.acesso.ehAluno();
  readonly ehProfessor = this.acesso.ehProfessor();
  readonly ehAdmin = this.acesso.veTudo();
  readonly podeVerAlunos = this.acesso.podeVer('students');
  readonly podeVerCursos = this.acesso.podeVer('courses');
  readonly podeVerTurmas = this.acesso.podeVer('classes');
  readonly podeVerFinanceiro = this.acesso.podeVer('financial');
  readonly podeVerUsuarios = this.acesso.podeVer('users');

  readonly carregando = signal(true);
  readonly erro = signal('');

  /**
   * BOAS-VINDAS DE CONTA RECEM-CRIADA.
   *
   * O autocadastro termina aqui, ja autenticado (requisito 3), e passa o
   * primeiro nome e o curso escolhido na query string. A faixa confirma as
   * duas coisas que a pessoa quer saber naquele instante: "minha conta existe"
   * e "minha matricula foi feita".
   *
   * Sao signals (e nao getters da rota) porque a faixa pode ser fechada: quem
   * ja leu nao precisa dela ocupando o topo do painel para sempre.
   */
  readonly boasVindas = signal(this.rota.snapshot.queryParamMap.get('boasVindas') ?? '');
  readonly cursoDaMatricula = signal(this.rota.snapshot.queryParamMap.get('curso') ?? '');

  // --- Totais dos cards ---
  readonly totalAlunos = signal(0);
  readonly totalAlunosAtivos = signal(0);
  readonly totalProfessores = signal(0);
  readonly totalCursos = signal(0);
  readonly totalTurmas = signal(0);
  readonly totalTurmasAtivas = signal(0);
  readonly totalMatriculas = signal(0);
  readonly totalMatriculasAtivas = signal(0);
  readonly totalMatriculasNovas = signal(0);
  readonly totalPagamentos = signal(0);
  readonly totalPagamentosAtrasados = signal(0);

  // --- Dinheiro (requisito 9: pagamentos recebidos e valores em atraso) ---
  readonly valorRecebido = signal(0);
  readonly valorEmAtraso = signal(0);
  readonly valorPendente = signal(0);

  // --- Totais do painel do aluno ---
  readonly totalEmAberto = signal(0);
  readonly valorEmAberto = signal(0);
  readonly totalPresencas = signal(0);
  readonly totalAulas = signal(0);
  readonly cursoAtual = signal('');

  // --- Listas curtas ---
  readonly ultimasMatriculas = signal<EnrollmentComRelacoes[]>([]);
  readonly pagamentosAtrasados = signal<Payment[]>([]);
  readonly proximasParcelas = signal<Payment[]>([]);
  readonly minhasTurmas = signal<Class[]>([]);
  readonly cursosPorId = signal<Record<number, Course>>({});

  // --- Proporcoes das barras dos cards ---------------------------------------
  // Sao numeros de 0 a 1. Quando o total e zero a divisao da NaN, e o proprio
  // app-stat-card entende isso como "sem barra" - que e o certo: lista vazia
  // nao tem proporcao para mostrar.
  readonly razaoAlunosAtivos = computed(() => this.totalAlunosAtivos() / this.totalAlunos());
  readonly razaoTurmasAtivas = computed(() => this.totalTurmasAtivas() / this.totalTurmas());
  readonly razaoMatriculasAtivas = computed(
    () => this.totalMatriculasAtivas() / this.totalMatriculas(),
  );
  readonly razaoAtrasados = computed(
    () => this.totalPagamentosAtrasados() / this.totalPagamentos(),
  );
  readonly razaoPresenca = computed(() => this.totalPresencas() / this.totalAulas());

  /**
   * Quanto do combinado ja entrou. Serve de barra no card "Recebido" e e a
   * leitura que o administrador faz de relance: a escola recebeu a maior parte
   * do que combinou, ou nao?
   */
  readonly razaoRecebido = computed(() => {
    const total = this.valorRecebido() + this.valorPendente() + this.valorEmAtraso();
    return total === 0 ? Number.NaN : this.valorRecebido() / total;
  });

  constructor() {
    this.carregarDados();
  }

  get primeiroNome(): string {
    return this.usuario?.name?.split(' ')[0] ?? '';
  }

  get apresentacao(): string {
    if (this.ehAluno) {
      return 'Este e o seu resumo: matriculas, mensalidades e frequencia.';
    }
    if (this.ehProfessor) {
      return 'Este e o resumo dos seus cursos: turmas, alunos matriculados e frequencia.';
    }
    return 'Este e o panorama da escola hoje: cadastro, turmas, matriculas e o que precisa de atencao.';
  }

  get avisoDeEscopo(): string {
    return this.ehProfessor
      ? 'Os numeros abaixo sao somente dos seus cursos e turmas.'
      : 'Os numeros abaixo sao somente os seus.';
  }

  get presencaEmPorcentagem(): string {
    if (this.totalAulas() === 0) {
      return '-';
    }
    return `${Math.round((this.totalPresencas() / this.totalAulas()) * 100)}%`;
  }

  get hoje(): string {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  /** Fecha a faixa de boas-vindas (quem ja leu nao precisa dela de novo). */
  fecharBoasVindas(): void {
    this.boasVindas.set('');
    this.cursoDaMatricula.set('');
  }

  /** Atalho da faixa de boas-vindas: o aluno conferir a matricula que acabou de fazer. */
  irParaMinhasMatriculas(): void {
    this.router.navigate(['/enrollments']);
  }

  /**
   * Atalho do painel do aluno: abre o lancamento da parcela, onde fica o botao
   * Pagar. Parcela lancada na mao (sem lancamento) cai na lista de mensalidades.
   */
  irParaPagamento(parcela: Payment): void {
    if (parcela.financialRecordId === undefined) {
      this.router.navigate(['/financial']);
      return;
    }
    this.router.navigate(['/financial', parcela.financialRecordId]);
  }

  private carregarDados(): void {
    this.carregando.set(true);
    this.erro.set('');

    const studentId = this.acesso.studentIdLogado();
    const ehAlunoComCadastro = this.ehAluno && studentId !== null;

    forkJoin({
      escopo: this.acesso.escopo(),
      alunos: this.podeVerAlunos ? this.studentService.list() : of([] as Student[]),
      cursos: this.podeVerCursos ? this.courseService.list() : of([] as Course[]),
      turmas: this.podeVerTurmas ? this.classService.list() : of([] as Class[]),

      // Professores so interessam ao painel do administrador (card "Professores"),
      // e so ele alcanca a colecao /users.
      professores: this.podeVerUsuarios ? this.userService.listarProfessores() : of([]),

      // O ALUNO pede somente as proprias matriculas na consulta; os outros
      // perfis pedem a colecao e o filtro de escopo recorta depois. Sem essa
      // separacao, a resposta da API trazia ao navegador do aluno as
      // matriculas e os nomes de todos os colegas - a tela mostrava o certo,
      // mas o dado dos outros estava la, no DevTools.
      matriculas: ehAlunoComCadastro
        ? this.enrollmentService.listarPorAlunoComTurma(studentId!)
        : this.enrollmentService.listarComAlunoETurma(),

      pagamentos: this.podeVerFinanceiro ? this.paymentService.list() : of([] as Payment[]),

      // A frequencia alimenta o card de presenca do aluno e o de aulas
      // lancadas do professor. Para o aluno, a consulta ja vem filtrada por
      // ele; para o professor, vem inteira e o escopo recorta pelas turmas
      // dele (o JSON Server nao sabe filtrar por "uma destas turmas").
      frequencias: ehAlunoComCadastro
        ? this.attendanceService.listarPorAluno(studentId!)
        : this.ehProfessor || this.ehAdmin
          ? this.attendanceService.list()
          : of([] as Attendance[]),
    }).subscribe({
      next: (dados) => {
        const escopo = dados.escopo;

        // Toda colecao passa pelo filtro do escopo ANTES de virar numero. E o
        // ponto critico desta tela: contar primeiro e filtrar depois daria o
        // total da escola com cara de total do aluno.
        const alunos = this.acesso.filtrarAlunos(escopo, dados.alunos);
        const cursos = this.acesso.filtrarCursos(escopo, dados.cursos);
        const turmas = this.acesso.filtrarTurmas(escopo, dados.turmas);
        const matriculas = this.acesso.filtrarMatriculas(escopo, dados.matriculas);
        const pagamentos = this.acesso.filtrarPagamentos(escopo, dados.pagamentos);
        const frequencias = this.acesso.filtrarFrequencias(escopo, dados.frequencias);

        this.preencherCadastro(alunos, cursos, turmas, dados.professores.length);
        this.preencherMatriculas(matriculas);
        this.preencherFinanceiro(pagamentos);
        this.preencherFrequencia(frequencias);

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(
          'Nao foi possivel carregar os dados. Rode npm run api e recarregue a pagina.',
        );
      },
    });
  }

  /** Cards de cadastro: alunos, professores, cursos e turmas. */
  private preencherCadastro(
    alunos: Student[],
    cursos: Course[],
    turmas: Class[],
    professores: number,
  ): void {
    this.totalAlunos.set(alunos.length);
    this.totalAlunosAtivos.set(alunos.filter((a) => a.status === 'ativo').length);
    this.totalProfessores.set(professores);
    this.totalCursos.set(cursos.length);
    this.totalTurmas.set(turmas.length);
    this.totalTurmasAtivas.set(turmas.filter((t) => t.status === 'ativa').length);

    // O professor ve a lista das turmas dele no painel; por isso ela fica em
    // um signal, e nao so o total.
    this.minhasTurmas.set(
      [...turmas].sort((a, b) => a.code.localeCompare(b.code)).slice(0, LIMITE_DA_LISTA),
    );

    const indice: Record<number, Course> = {};
    for (const curso of cursos) {
      indice[curso.id!] = curso;
    }
    this.cursosPorId.set(indice);
  }

  /** Cards e lista de matriculas, inclusive as "novas" dos ultimos 30 dias. */
  private preencherMatriculas(matriculas: EnrollmentComRelacoes[]): void {
    this.totalMatriculas.set(matriculas.length);
    this.totalMatriculasAtivas.set(matriculas.filter((m) => m.status === 'ativa').length);

    // "Novas matriculas" (requisito 9) = as dos ultimos 30 dias. A comparacao e
    // de texto porque as datas sao ISO 'aaaa-mm-dd', e nesse formato a ordem
    // alfabetica E a ordem cronologica - sem Date, sem fuso, sem surpresa.
    const limite = this.dataDeCorte(DIAS_DE_MATRICULA_NOVA);
    this.totalMatriculasNovas.set(matriculas.filter((m) => m.enrollmentDate >= limite).length);

    // As mais recentes primeiro, apenas as 5 primeiras.
    this.ultimasMatriculas.set(
      [...matriculas]
        .sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate))
        .slice(0, LIMITE_DA_LISTA),
    );

    // Para o aluno, o "curso atual" e o da matricula ativa (ou pendente) mais
    // recente. A turma vem embutida na consulta; o nome do curso sai do indice
    // de cursos - e fica vazio para quem nao alcanca o catalogo.
    const minha = [...matriculas]
      .filter((m) => m.status === 'ativa' || m.status === 'pendente')
      .sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate))
      .at(0);

    const courseId = minha?.['class']?.courseId;
    this.cursoAtual.set(courseId === undefined ? '' : (this.cursosPorId()[courseId]?.name ?? ''));
  }

  /** Cards de dinheiro e as duas listas financeiras (atrasadas e a vencer). */
  private preencherFinanceiro(pagamentos: Payment[]): void {
    const atrasados = pagamentos.filter((p) => p.status === 'vencido');
    const pendentes = pagamentos.filter((p) => p.status === 'pendente');
    const pagos = pagamentos.filter((p) => p.status === 'pago');

    this.totalPagamentos.set(pagamentos.length);
    this.totalPagamentosAtrasados.set(atrasados.length);

    this.valorRecebido.set(this.somar(pagos));
    this.valorEmAtraso.set(this.somar(atrasados));
    this.valorPendente.set(this.somar(pendentes));

    this.pagamentosAtrasados.set(
      [...atrasados].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, LIMITE_DA_LISTA),
    );

    // --- Numeros do painel do aluno ---
    const emAberto = [...atrasados, ...pendentes];
    this.totalEmAberto.set(emAberto.length);
    this.valorEmAberto.set(this.somar(emAberto));

    // "Proximas parcelas" (requisito 9, painel do aluno): o que vence primeiro
    // vem primeiro - o aluno quer saber o que pagar em seguida, nao o que
    // venceu ha mais tempo.
    this.proximasParcelas.set(
      [...emAberto].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, LIMITE_DA_LISTA),
    );
  }

  /** Cards de frequencia: presenca do aluno, aulas lancadas do professor. */
  private preencherFrequencia(frequencias: Attendance[]): void {
    this.totalAulas.set(frequencias.length);
    this.totalPresencas.set(frequencias.filter((f) => f.present).length);
  }

  // --- Textos e formatos usados pelo template ------------------------------

  turmaDaMatricula(matricula: EnrollmentComRelacoes): string {
    return matricula['class']?.code ?? '-';
  }

  alunoDaMatricula(matricula: EnrollmentComRelacoes): string {
    return matricula.student?.name ?? '-';
  }

  inicialDoAluno(matricula: EnrollmentComRelacoes): string {
    return matricula.student?.name?.charAt(0).toUpperCase() ?? '?';
  }

  /** Nome do curso de uma turma, para a lista de turmas do professor. */
  cursoDaTurma(turma: Class): string {
    return this.cursosPorId()[turma.courseId]?.name ?? '-';
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Soma valores de parcelas em centavos inteiros (sem erro de arredondamento). */
  private somar(parcelas: Payment[]): number {
    const centavos = parcelas.reduce((soma, parcela) => soma + Math.round(parcela.amount * 100), 0);
    return centavos / 100;
  }

  /** A data de N dias atras, em 'aaaa-mm-dd'. */
  private dataDeCorte(dias: number): string {
    const data = new Date();
    data.setDate(data.getDate() - dias);
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
  }
}
