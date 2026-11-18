import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';

import { Attendance, Class, Course } from '../../../core/models';
import { AcessoService } from '../../../core/services/acesso.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { ClassService } from '../../../core/services/class.service';
import { CourseService } from '../../../core/services/course.service';
import { EnrollmentService } from '../../../core/services/enrollment.service';
import {
  EmptyStateComponent,
  LoadingComponent,
  PageHeaderComponent,
  StatCardComponent,
} from '../../../shared';

/**
 * Uma linha da chamada: um aluno matriculado e a presenca dele no dia.
 *
 * `registroId` guarda o id do registro que JA existe na API para este aluno
 * nesta turma nesta data. E ele que decide, no momento de gravar, entre POST
 * (chamada nova) e PUT (correcao de uma chamada ja lancada) - e e o que impede
 * o registro duplicado que o requisito 8 proibe.
 */
interface LinhaDaChamada {
  studentId: number;
  nome: string;
  present: boolean;
  registroId?: number;
}

/**
 * TELA DE CHAMADA - o jeito do professor lancar frequencia (requisito 8).
 *
 * POR QUE ESTA TELA EXISTE, SE JA HAVIA UM FORMULARIO DE FREQUENCIA
 * -----------------------------------------------------------------
 * O formulario de frequencia lanca UM registro: escolhe aluno, turma, data e
 * marca presente ou ausente. Para corrigir um registro ele e perfeito; para
 * fazer a chamada de uma turma de 30 alunos, sao 30 idas e voltas de tela.
 *
 * O professor nao pensa "registro de frequencia": ele pensa "a aula de hoje, a
 * turma inteira na frente". Esta tela e esse jeito de pensar - escolhe turma e
 * data uma vez e marca todos de uma vez. Os dois convivem, e o requisito pede
 * os dois comportamentos ("marcar presenca", "marcar falta", "editar um
 * registro de frequencia").
 *
 * COMO A DUPLICIDADE E EVITADA
 * ----------------------------
 * Ao escolher turma e data, a tela JA carrega os registros daquele dia e
 * preenche as linhas com eles. Entao, se a chamada daquele dia ja foi feita, o
 * professor nao esta criando uma segunda - ele esta vendo e corrigindo a
 * primeira. Quem ja estava gravado recebe PUT; quem nao estava, POST.
 */
@Component({
  selector: 'app-chamada',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PageHeaderComponent,
    StatCardComponent,
    EmptyStateComponent,
    LoadingComponent,
  ],
  templateUrl: './chamada.component.html',
  styleUrl: './chamada.component.scss',
})
export class ChamadaComponent {
  private readonly classService = inject(ClassService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  readonly turmas = signal<Class[]>([]);
  readonly cursosPorId = signal<Record<number, Course>>({});
  readonly linhas = signal<LinhaDaChamada[]>([]);

  readonly turmaEscolhida = signal<number | null>(null);
  readonly dataEscolhida = signal(this.hoje());

  readonly carregando = signal(true);
  readonly carregandoLista = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal('');
  readonly aviso = signal('');

  /** true quando a chamada deste dia JA existia (a tela esta corrigindo, nao criando). */
  readonly chamadaJaLancada = computed(() =>
    this.linhas().some((linha) => linha.registroId !== undefined),
  );

  readonly presentes = computed(() => this.linhas().filter((linha) => linha.present).length);
  readonly ausentes = computed(() => this.linhas().filter((linha) => !linha.present).length);

  /** A data nao pode ser no futuro: nao se faz chamada de aula que nao aconteceu. */
  readonly dataMaxima = this.hoje();

  constructor() {
    this.carregarTurmas();
  }

  get turmaAtual(): Class | null {
    const id = this.turmaEscolhida();
    return this.turmas().find((turma) => turma.id === id) ?? null;
  }

  get nomeDoCurso(): string {
    const turma = this.turmaAtual;
    return turma ? (this.cursosPorId()[turma.courseId]?.name ?? '-') : '-';
  }

  get podeGravar(): boolean {
    return (
      this.turmaEscolhida() !== null &&
      this.dataEscolhida() !== '' &&
      this.linhas().length > 0 &&
      !this.salvando()
    );
  }

  /**
   * Carrega as turmas que este usuario alcanca.
   *
   * O professor ve somente as turmas dele - e e o filtro de escopo que garante
   * isso, nao a consulta. Pedir "turmas do professor" ao JSON Server nao
   * cobriria a turma sem responsavel que pertence a um curso dele.
   */
  private carregarTurmas(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      turmas: this.classService.listarOrdenadoPorCodigo(),
      cursos: this.courseService.list(),
    }).subscribe({
      next: ({ escopo, turmas, cursos }) => {
        const permitidas = this.acesso
          .filtrarTurmas(escopo, turmas)
          // Chamada e de turma em andamento: turma cancelada ou concluida nao
          // recebe presenca nova.
          .filter((turma) => turma.status === 'ativa');

        this.turmas.set(permitidas);

        const indice: Record<number, Course> = {};
        for (const curso of cursos) {
          indice[curso.id!] = curso;
        }
        this.cursosPorId.set(indice);

        // Com uma turma so, nao ha escolha a fazer: ja entra selecionada.
        if (permitidas.length === 1) {
          this.turmaEscolhida.set(permitidas[0].id!);
          this.carregarLista();
        }

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar as turmas. Rode npm run api e tente de novo.');
      },
    });
  }

  aplicarTurma(classId: number): void {
    this.turmaEscolhida.set(classId);
    this.carregarLista();
  }

  aplicarData(data: string): void {
    this.dataEscolhida.set(data);
    this.carregarLista();
  }

  /**
   * Monta a lista de alunos da turma JA cruzada com a chamada do dia.
   *
   * As duas consultas vao juntas porque a lista final precisa das duas: os
   * matriculados dizem QUEM aparece, e os registros do dia dizem o que ja foi
   * marcado para cada um.
   */
  carregarLista(): void {
    const classId = this.turmaEscolhida();
    const data = this.dataEscolhida();

    if (classId === null || data === '') {
      this.linhas.set([]);
      return;
    }

    this.carregandoLista.set(true);
    this.erro.set('');
    this.aviso.set('');

    forkJoin({
      matriculas: this.enrollmentService.listarPorTurmaComAluno(classId),
      registros: this.attendanceService.listarPorTurmaEData(classId, data),
    }).subscribe({
      next: ({ matriculas, registros }) => {
        const lancados = new Map(registros.map((registro) => [registro.studentId, registro]));

        const linhas = matriculas
          // Matricula cancelada nao entra na chamada: quem saiu da turma nao
          // tem presenca para marcar. 'pendente' ENTRA - o aluno comeca a
          // assistir antes de a primeira parcela ser confirmada.
          .filter((matricula) => matricula.status !== 'cancelada')
          .map<LinhaDaChamada>((matricula) => {
            const jaLancado = lancados.get(matricula.studentId);
            return {
              studentId: matricula.studentId,
              nome: matricula.student?.name ?? `Aluno ${matricula.studentId}`,
              // Presente e o padrao de quem ainda nao foi marcado: numa turma
              // normal a maioria comparece, e o professor so toca nas excecoes.
              present: jaLancado?.present ?? true,
              registroId: jaLancado?.id,
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome));

        this.linhas.set(linhas);
        this.carregandoLista.set(false);
      },
      error: () => {
        this.carregandoLista.set(false);
        this.linhas.set([]);
        this.erro.set('Nao foi possivel carregar os alunos da turma. Tente de novo.');
      },
    });
  }

  /** Alterna presenca/falta de um aluno (so na tela; grava no botao Salvar). */
  alternar(studentId: number): void {
    this.linhas.update((linhas) =>
      linhas.map((linha) =>
        linha.studentId === studentId ? { ...linha, present: !linha.present } : linha,
      ),
    );
  }

  /** Marca a turma inteira como presente - o caso comum de um dia sem faltas. */
  marcarTodosPresentes(): void {
    this.linhas.update((linhas) => linhas.map((linha) => ({ ...linha, present: true })));
  }

  /**
   * Grava a chamada inteira.
   *
   * Uma gravacao por aluno, todas em paralelo, cada uma decidindo entre criar e
   * atualizar pelo `registroId`. Nao existe "salvar a chamada" como uma unica
   * operacao no JSON Server - e, como nao ha transacao, a falha parcial e
   * possivel: alguns alunos gravam e outros nao.
   *
   * Aqui a falha parcial e TOLERADA de proposito, e nao desfeita. Apagar as
   * presencas que deram certo por causa de uma que falhou seria perder
   * trabalho correto do professor; o caminho honesto e avisar que a gravacao
   * foi incompleta e recarregar a lista, que mostra exatamente quem entrou e
   * quem ficou faltando - e aí ele salva de novo, e os que ja entraram viram
   * atualizacao em vez de duplicata.
   */
  salvar(): void {
    const turma = this.turmaAtual;
    const data = this.dataEscolhida();

    if (turma === null || data === '' || this.linhas().length === 0) {
      return;
    }

    this.salvando.set(true);
    this.erro.set('');
    this.aviso.set('');

    const gravacoes: Observable<Attendance | null>[] = this.linhas().map((linha) => {
      const registro: Attendance = {
        classId: turma.id!,
        courseId: turma.courseId,
        studentId: linha.studentId,
        date: data,
        present: linha.present,
      };

      return linha.registroId === undefined
        ? this.attendanceService.create(registro)
        : this.attendanceService.update(linha.registroId, { ...registro, id: linha.registroId });
    });

    forkJoin(gravacoes.length === 0 ? [of(null)] : gravacoes).subscribe({
      next: () => {
        this.salvando.set(false);
        this.aviso.set(
          `Chamada de ${this.formatarData(data)} gravada: ${this.presentes()} presenca(s) e ` +
            `${this.ausentes()} falta(s).`,
        );
        this.carregarLista();
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set(
          'A gravacao da chamada falhou no meio: parte dos alunos pode ter sido gravada. ' +
            'A lista foi recarregada - confira e salve de novo.',
        );
        this.carregarLista();
      },
    });
  }

  /** Vai para o historico de frequencia, onde o registro pode ser consultado e corrigido. */
  verHistorico(): void {
    this.router.navigate(['/attendances']);
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private hoje(): string {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${agora.getFullYear()}-${mes}-${dia}`;
  }
}
