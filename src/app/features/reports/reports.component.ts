import { Component, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { forkJoin, of } from 'rxjs';

import { Class, Course, Payment, Student } from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { ClassService } from '../../core/services/class.service';
import { CourseService } from '../../core/services/course.service';
import { EnrollmentComRelacoes, EnrollmentService } from '../../core/services/enrollment.service';
import { PaymentService } from '../../core/services/payment.service';
import { StudentService } from '../../core/services/student.service';
import {
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  PageHeaderComponent,
  StatCardComponent,
  StatusChipComponent,
} from '../../shared';

/**
 * TELA DE RELATORIOS (somente leitura).
 *
 * Nao tem cadastro, edicao nem exclusao: por isso e a unica tela do sistema
 * sem o trio de rotas (lista / new / :id/edit).
 *
 * SAO DOIS RELATORIOS, OS DOIS PEDIDOS NO CHECKLIST (secao 10):
 *
 *   10.2  ALUNOS POR TURMA
 *         escolhe-se a turma e a tela lista quem esta matriculado nela.
 *
 *   10.3  PAGAMENTOS EM ABERTO
 *         todas as parcelas com status pendente ou atrasado, com a soma.
 *
 * POR QUE TUDO E CALCULADO AQUI, E NAO NA API
 * -------------------------------------------
 * O JSON Server nao faz agregacao: nao existe COUNT, SUM nem GROUP BY. Entao o
 * relatorio carrega os dados uma vez (cinco consultas em paralelo) e as contas
 * ficam em computed(). Em um backend real, essas somas viriam prontas do
 * servidor - e essa e a resposta honesta se o professor perguntar.
 *
 * SOBRE O CENARIO 10.5 (base vazia)
 * ---------------------------------
 * Cada bloco tem o seu proprio estado vazio. Nenhuma soma mostra NaN porque o
 * reduce comeca em 0 e nenhuma divisao e feita sem conferir o divisor.
 */
@Component({
  selector: 'app-reports',
  imports: [
    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusChipComponent,
    EmptyStateComponent,
    EscopoAvisoComponent,
    LoadingComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly studentService = inject(StudentService);
  private readonly classService = inject(ClassService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly paymentService = inject(PaymentService);
  private readonly acesso = inject(AcessoService);

  /**
   * true quando o perfil alcanca o financeiro.
   *
   * O relatorio tem DOIS blocos: o academico e o financeiro. O administrador ve
   * "Alunos por turma" (das turmas dele) mas NAO ve "Pagamentos em aberto":
   * seria incoerente negar a tela de Financeiro no menu e entregar os mesmos
   * numeros aqui, com outro titulo. Relatorio nao e porta de servico.
   */
  readonly podeVerFinanceiro = this.acesso.podeVer('payments');

  readonly carregando = signal(true);
  readonly erro = signal('');

  // --- Dados crus, carregados uma unica vez ---------------------------------
  readonly alunos = signal<Student[]>([]);
  readonly turmas = signal<Class[]>([]);
  readonly matriculas = signal<EnrollmentComRelacoes[]>([]);
  readonly parcelas = signal<Payment[]>([]);
  readonly cursosPorId = signal<Record<number, Course>>({});

  /** Turma escolhida no relatorio de alunos por turma. null = nenhuma ainda. */
  readonly turmaEscolhida = signal<number | null>(null);

  readonly colunasAlunos = ['aluno', 'cpf', 'data', 'status'];
  readonly colunasParcelas = ['aluno', 'turma', 'vencimento', 'valor', 'status'];

  // --- Numeros do topo ------------------------------------------------------
  readonly alunosAtivos = computed(
    () => this.alunos().filter((aluno) => aluno.status === 'ativo').length,
  );

  readonly turmasAtivas = computed(
    () => this.turmas().filter((turma) => turma.status === 'ativa').length,
  );

  readonly matriculasAtivas = computed(
    () => this.matriculas().filter((matricula) => matricula.status === 'ativa').length,
  );

  /** Soma de tudo que esta pendente ou atrasado: o total a receber. */
  readonly totalAReceber = computed(() =>
    this.parcelasEmAberto().reduce((soma, parcela) => soma + parcela.amount, 0),
  );

  // --- Proporcoes das barras dos cards do topo ------------------------------
  // Numeros de 0 a 1. Quando o divisor e zero a divisao da NaN, e o proprio
  // app-stat-card entende isso como "sem barra": base vazia nao tem proporcao.
  readonly razaoAlunosAtivos = computed(() => this.alunosAtivos() / this.alunos().length);
  readonly razaoTurmasAtivas = computed(() => this.turmasAtivas() / this.turmas().length);
  readonly razaoMatriculasAtivas = computed(
    () => this.matriculasAtivas() / this.matriculas().length,
  );

  /**
   * Quanto do total a receber esta ATRASADO (e nao apenas pendente).
   * E a leitura que o card de dinheiro precisa: R$ 10.000 a receber com 10%
   * atrasado e uma situacao; com 80% atrasado e outra.
   */
  readonly razaoAtrasado = computed(() => this.totalAtrasado() / this.totalAReceber());

  // --- Relatorio 10.2: alunos da turma escolhida ----------------------------
  readonly matriculasDaTurma = computed(() => {
    const classId = this.turmaEscolhida();
    if (classId === null) {
      return [];
    }
    return this.matriculas()
      .filter((matricula) => matricula.classId === classId)
      .sort((a, b) => (a.student?.name ?? '').localeCompare(b.student?.name ?? ''));
  });

  /** Quantas dessas matriculas estao ativas (as que ocupam vaga). */
  readonly ativasDaTurma = computed(
    () => this.matriculasDaTurma().filter((matricula) => matricula.status === 'ativa').length,
  );

  /** A turma escolhida, por inteiro, para mostrar codigo, curso e capacidade. */
  readonly turmaDoRelatorio = computed(() => {
    const classId = this.turmaEscolhida();
    return this.turmas().find((turma) => turma.id === classId) ?? null;
  });

  /**
   * Ocupacao da turma escolhida como porcentagem CSS ("72%"), para a barra
   * .em-meter do relatorio 10.2.
   *
   * O limite em 100% existe para um caso real: uma turma pode ter mais
   * matriculas ativas que a capacidade (a regra 6.5 bloqueia matricula nova,
   * mas uma base importada ja pode vir estourada). Sem o limite, a barra
   * vazaria do card.
   */
  readonly ocupacaoDaTurma = computed(() => {
    const capacidade = this.turmaDoRelatorio()?.capacity ?? 0;
    if (capacidade <= 0) {
      return '0%';
    }
    const fracao = Math.min(this.ativasDaTurma() / capacidade, 1);
    return `${Math.round(fracao * 100)}%`;
  });

  /** true quando a ocupacao da turma passou de 85% das vagas. */
  readonly turmaQuaseCheia = computed(() => {
    const capacidade = this.turmaDoRelatorio()?.capacity ?? 0;
    return capacidade > 0 && this.ativasDaTurma() / capacidade >= 0.85;
  });

  // --- Relatorio 10.3: parcelas em aberto -----------------------------------
  readonly parcelasEmAberto = computed(() =>
    this.parcelas()
      .filter((parcela) => parcela.status === 'pendente' || parcela.status === 'vencido')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  );

  readonly totalAtrasado = computed(() =>
    this.parcelas()
      .filter((parcela) => parcela.status === 'vencido')
      .reduce((soma, parcela) => soma + parcela.amount, 0),
  );

  /** A frase que explica o recorte desta tela (ver EscopoAvisoComponent). */
  get avisoDeEscopo(): string {
    return 'Os relatorios abaixo cobrem apenas as turmas dos cursos de que voce e dono.';
  }

  constructor() {
    this.carregar();
  }

  /** Carrega tudo o que os dois relatorios precisam, em paralelo. */
  private carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      alunos: this.studentService.listarOrdenadoPorNome(),
      turmas: this.classService.listarOrdenadoPorCodigo(),
      cursos: this.courseService.list(),
      matriculas: this.enrollmentService.listarComAlunoETurma(),
      // As parcelas nem sao pedidas para quem nao alcanca o financeiro.
      parcelas: this.podeVerFinanceiro ? this.paymentService.list() : of([] as Payment[]),
    }).subscribe({
      next: ({ escopo, alunos, turmas, cursos, matriculas, parcelas }) => {
        // Cada colecao e recortada pelo escopo ANTES de virar numero ou linha
        // de relatorio. Relatorio e justamente onde um vazamento passaria
        // despercebido: ele soma, e uma soma nao mostra de onde veio.
        this.alunos.set(this.acesso.filtrarAlunos(escopo, alunos));
        this.turmas.set(this.acesso.filtrarTurmas(escopo, turmas));
        this.matriculas.set(this.acesso.filtrarMatriculas(escopo, matriculas));
        this.parcelas.set(this.acesso.filtrarPagamentos(escopo, parcelas));

        const indice: Record<number, Course> = {};
        for (const curso of cursos) {
          indice[curso.id!] = curso;
        }
        this.cursosPorId.set(indice);

        // Comeca com a primeira turma VISIVEL, para o relatorio nao abrir
        // vazio. Usar a lista crua aqui escolheria uma turma que o usuario
        // nao alcanca, e o relatorio abriria sem nenhum aluno - parecendo
        // defeito, quando seria permissao.
        const turmasVisiveis = this.turmas();
        if (turmasVisiveis.length > 0) {
          this.turmaEscolhida.set(turmasVisiveis[0].id!);
        }

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(
          'Nao foi possivel carregar os dados dos relatorios. Rode npm run api e recarregue.',
        );
      },
    });
  }

  /** Rotulo da turma no select: "CODIGO - Curso". */
  rotuloDaTurma(turma: Class): string {
    const curso = this.cursosPorId()[turma.courseId]?.name ?? 'Curso nao encontrado';
    return `${turma.code} - ${curso}`;
  }

  /** Nome do curso da turma escolhida. */
  cursoDaTurmaEscolhida(): string {
    const turma = this.turmaDoRelatorio();
    if (!turma) {
      return '-';
    }
    return this.cursosPorId()[turma.courseId]?.name ?? '-';
  }

  /** CPF com mascara, para o relatorio de alunos da turma. */
  cpfFormatado(matricula: EnrollmentComRelacoes): string {
    const cpf = matricula.student?.cpf ?? '';
    const digitos = cpf.replace(/\D/g, '');
    if (digitos.length !== 11) {
      return cpf || '-';
    }
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /** Nome do aluno de uma parcela, percorrendo parcela > matricula > aluno. */
  alunoDaParcela(parcela: Payment): string {
    const matricula = this.matriculas().find((item) => item.id === parcela.enrollmentId);
    return matricula?.student?.name ?? 'Matricula nao encontrada';
  }

  /** Codigo da turma de uma parcela. */
  turmaDaParcela(parcela: Payment): string {
    const matricula = this.matriculas().find((item) => item.id === parcela.enrollmentId);
    return matricula?.['class']?.code ?? '-';
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
}
