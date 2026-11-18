import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Class, ClassShift, Course, Student } from '../../../core/models';
import { AcessoService } from '../../../core/services/acesso.service';
import { ClassService } from '../../../core/services/class.service';
import { CourseService } from '../../../core/services/course.service';
import { EnrollmentComRelacoes, EnrollmentService } from '../../../core/services/enrollment.service';
import { StudentService } from '../../../core/services/student.service';
import {
  EmptyStateComponent,
  LoadingComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../../shared';

/** Um curso do catalogo, ja com as turmas abertas e se o aluno ja esta nele. */
interface CursoDisponivel {
  curso: Course;
  turmasAbertas: Class[];
  jaMatriculado: boolean;
}

const TURNOS: Record<ClassShift, string> = {
  manha: 'Manha',
  tarde: 'Tarde',
  noite: 'Noite',
};

/**
 * MINHA MATRICULA - a tela de matriculas vista pelo ALUNO.
 *
 * Responde as tres perguntas do aluno, de cima para baixo:
 *
 *   1. "Meus dados estao certos?"        -> dados cadastrais (leitura)
 *   2. "Em que cursos eu estou?"         -> as matriculas dele
 *   3. "Que outro curso eu posso fazer?" -> o catalogo, com o botao de se
 *                                           matricular em uma turma aberta
 *
 * O botao "Matricular-se" leva para o formulario de matricula ja com a turma
 * escolhida (?classId=), e e la que ficam as regras (duplicidade, vaga) e a
 * escolha da condicao de pagamento. Esta tela nao grava nada.
 *
 * PRIVACIDADE
 * -----------
 * Todas as consultas sao as do PROPRIO aluno (studentId na URL): o navegador
 * dele nao recebe matricula nem cadastro de colega. Turmas e cursos sao
 * catalogo, informacao publica da escola.
 */
@Component({
  selector: 'app-minha-matricula',
  imports: [
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    StatusChipComponent,
    EmptyStateComponent,
    LoadingComponent,
  ],
  templateUrl: './minha-matricula.component.html',
  styleUrl: './minha-matricula.component.scss',
})
export class MinhaMatriculaComponent {
  private readonly acesso = inject(AcessoService);
  private readonly studentService = inject(StudentService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly courseService = inject(CourseService);
  private readonly classService = inject(ClassService);
  private readonly router = inject(Router);

  readonly aluno = signal<Student | null>(null);
  readonly matriculas = signal<EnrollmentComRelacoes[]>([]);
  readonly cursosPorId = signal<Record<number, Course>>({});
  private readonly cursos = signal<Course[]>([]);
  private readonly turmas = signal<Class[]>([]);

  readonly carregando = signal(true);
  readonly erro = signal('');

  /**
   * Cursos em que o aluno tem matricula VIGENTE (pendente ou ativa). Matricula
   * cancelada ou concluida nao impede de fazer o curso de novo.
   */
  private readonly cursosVigentes = computed(() => {
    const ids = new Set<number>();
    for (const matricula of this.matriculas()) {
      const courseId = matricula['class']?.courseId;
      if (courseId !== undefined && (matricula.status === 'ativa' || matricula.status === 'pendente')) {
        ids.add(courseId);
      }
    }
    return ids;
  });

  /**
   * O catalogo para o aluno: cursos ativos, cada um com as turmas ativas que
   * ainda nao terminaram. Cursos em que ele ja esta vao para o fim da lista.
   */
  readonly cursosDisponiveis = computed<CursoDisponivel[]>(() => {
    const hoje = this.hoje();
    const vigentes = this.cursosVigentes();

    return this.cursos()
      .filter((curso) => curso.active)
      .map((curso) => ({
        curso,
        turmasAbertas: this.turmas()
          .filter(
            (turma) =>
              turma.courseId === curso.id && turma.status === 'ativa' && turma.endDate >= hoje,
          )
          .sort((a, b) => a.startDate.localeCompare(b.startDate)),
        jaMatriculado: vigentes.has(curso.id!),
      }))
      .sort(
        (a, b) =>
          Number(a.jaMatriculado) - Number(b.jaMatriculado) ||
          a.curso.name.localeCompare(b.curso.name),
      );
  });

  constructor() {
    this.carregar();
  }

  carregar(): void {
    const studentId = this.acesso.studentIdLogado();
    if (studentId === null) {
      this.carregando.set(false);
      this.erro.set(
        'Seu usuario nao esta vinculado a um cadastro de aluno. Procure a secretaria.',
      );
      return;
    }

    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      aluno: this.studentService.getById(studentId),
      matriculas: this.enrollmentService.listarPorAlunoComTurma(studentId),
      cursos: this.courseService.listarOrdenadoPorNome(),
      turmas: this.classService.listarOrdenadoPorCodigo(),
    }).subscribe({
      next: ({ aluno, matriculas, cursos, turmas }) => {
        this.aluno.set(aluno);
        this.matriculas.set(
          [...matriculas].sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate)),
        );
        this.cursos.set(cursos);
        this.turmas.set(turmas);

        const indice: Record<number, Course> = {};
        for (const curso of cursos) {
          indice[curso.id!] = curso;
        }
        this.cursosPorId.set(indice);

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar a sua matricula. Rode npm run api e tente de novo.');
      },
    });
  }

  /** Leva para o formulario de matricula com a turma ja escolhida. */
  matricular(turma: Class): void {
    this.router.navigate(['/enrollments/new'], { queryParams: { classId: turma.id } });
  }

  irParaMensalidades(): void {
    this.router.navigate(['/financial']);
  }

  // --- Textos da tela ------------------------------------------------------

  nomeDoCurso(matricula: EnrollmentComRelacoes): string {
    const courseId = matricula['class']?.courseId;
    return courseId === undefined ? '-' : (this.cursosPorId()[courseId]?.name ?? '-');
  }

  turno(turma: Class | undefined): string {
    return turma ? TURNOS[turma.shift] : '-';
  }

  cpfFormatado(cpf: string): string {
    const digitos = cpf.replace(/\D/g, '');
    return digitos.length === 11
      ? digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : cpf;
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(data: string | undefined): string {
    if (!data) {
      return '-';
    }
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private hoje(): string {
    const data = new Date();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
  }
}
