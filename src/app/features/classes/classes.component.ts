import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Class, ClassShift } from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { ClassComRelacoes, ClassService } from '../../core/services/class.service';
import { EnrollmentService } from '../../core/services/enrollment.service';
import {
  ConfirmService,
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  PageHeaderComponent,
  SearchFieldComponent,
  StatusChipComponent,
} from '../../shared';

/** Rotulos dos turnos. O valor GRAVADO continua em minusculas, como no db.json. */
const TURNOS: Record<ClassShift, string> = {
  manha: 'Manha',
  tarde: 'Tarde',
  noite: 'Noite',
};

/**
 * TELA DE TURMAS (listagem).
 *
 * DUAS COISAS ESPECIFICAS DESTA TELA
 * ----------------------------------
 * 1) A TABELA MOSTRA NOME, NAO ID (checklist 16.1).
 *    A turma guarda courseId (um numero). Em vez de buscar o curso de cada
 *    linha, usamos listarComCurso(), que pede ?_expand=course a API. Uma
 *    requisicao, nomes resolvidos.
 *
 *    E por isso que a turma guarda o ID e nao o texto: renomear um curso
 *    reflete automaticamente aqui (checklist 16.7).
 *
 * 2) A COLUNA DE VAGAS E CALCULADA.
 *    O campo capacity diz quantas vagas a turma tem; quantas estao ocupadas
 *    depende das matriculas ATIVAS (cancelada e concluida nao ocupam vaga,
 *    regra 6.2). Carregamos as matriculas junto e contamos por turma.
 *    Assim a tela de turmas mostra a lotacao sem abrir cada turma.
 */
@Component({
  selector: 'app-classes',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    SearchFieldComponent,
    StatusChipComponent,
    EmptyStateComponent,
    EscopoAvisoComponent,
    LoadingComponent,
  ],
  templateUrl: './classes.component.html',
  styleUrl: './classes.component.scss',
})
export class ClassesComponent {
  private readonly classService = inject(ClassService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly confirmService = inject(ConfirmService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  /**
   * As tres permissoes desta area:
   *
   *   criar   -> somente o administrador (abrir turma envolve capacidade,
   *              periodo e vaga, que e decisao administrativa)
   *   editar  -> administrador e PROFESSOR, este ultimo so nas turmas dele
   *   excluir -> somente o administrador
   */
  readonly podeCriar = this.acesso.podeCriar('classes');
  readonly podeEditar = this.acesso.podeEditar('classes');
  readonly podeExcluir = this.acesso.podeExcluir('classes');

  /** A coluna "Acoes" so existe quando ha pelo menos um botao para por nela. */
  readonly podeGerenciar = this.podeEditar || this.podeExcluir;

  readonly turmas = signal<ClassComRelacoes[]>([]);

  /**
   * Quantas matriculas ATIVAS cada turma tem, no formato { [classId]: total }.
   * Map seria mais elegante, mas o template le objeto direto com mais clareza.
   */
  readonly ocupacao = signal<Record<number, number>>({});

  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly termo = signal('');

  /** A coluna de acoes so existe para quem pode gerenciar turma. */
  readonly colunas = this.podeGerenciar
    ? ['code', 'course', 'shift', 'periodo', 'vagas', 'status', 'acoes']
    : ['code', 'course', 'shift', 'periodo', 'vagas', 'status'];

  readonly turmasFiltradas = computed(() => {
    const busca = this.semAcento(this.termo());
    if (!busca) {
      return this.turmas();
    }
    return this.turmas().filter(
      (turma) =>
        this.semAcento(turma.code).includes(busca) ||
        this.semAcento(turma.course?.name ?? '').includes(busca),
    );
  });

  constructor() {
    this.carregar();
  }

  /** A frase que explica o recorte desta tela (ver EscopoAvisoComponent). */
  get avisoDeEscopo(): string {
    return 'Voce esta vendo apenas as turmas de que e responsavel.';
  }

  /**
   * Busca as turmas (com o curso), as matriculas e o escopo de
   * acesso, em paralelo, e entrega para a tela SOMENTE as turmas que o perfil
   * alcanca.
   *
   * Para o aluno, "as turmas dele" sao as turmas em que ele esta matriculado -
   * DONO - e nao as turmas em que ele e o regente. As duas coisas podem ser
   * diferentes, e e a propriedade do curso que manda (ver Course.ownerId).
   */
  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      turmas: this.classService.listarComCurso(),
      matriculas: this.enrollmentService.list(),
    }).subscribe({
      next: ({ escopo, turmas, matriculas }) => {
        this.turmas.set(this.acesso.filtrarTurmas(escopo, turmas));

        // Conta as matriculas ativas por turma. As matriculas tambem passam
        // pelo filtro: a contagem sairia igual de qualquer forma (so lemos as
        // chaves das turmas visiveis), mas deixar dado de outra turma circular
        // na tela e o tipo de descuido que vira vazamento na proxima mudanca.
        const contagem: Record<number, number> = {};
        for (const matricula of this.acesso.filtrarMatriculas(escopo, matriculas)) {
          if (matricula.status === 'ativa') {
            contagem[matricula.classId] = (contagem[matricula.classId] ?? 0) + 1;
          }
        }
        this.ocupacao.set(contagem);

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar as turmas. Rode npm run api e tente de novo.');
      },
    });
  }

  novo(): void {
    this.router.navigate(['/classes/new']);
  }

  editar(turma: Class): void {
    this.router.navigate(['/classes', turma.id, 'edit']);
  }

  /** Rotulo do turno para a tela ('manha' -> 'Manha'). */
  turno(turma: Class): string {
    return TURNOS[turma.shift];
  }

  /** Matriculas ativas desta turma. Zero quando ninguem foi matriculado. */
  matriculados(turma: Class): number {
    return this.ocupacao()[turma.id!] ?? 0;
  }

  /** true quando a turma nao tem mais vaga (regra 6.2). */
  lotada(turma: Class): boolean {
    return this.matriculados(turma) >= turma.capacity;
  }

  /**
   * REGRA 6.8 - turma com matricula OU frequencia nao pode ser excluida.
   * As duas consultas vao juntas.
   */
  excluir(turma: ClassComRelacoes): void {
    this.erro.set('');

    forkJoin({
      matriculas: this.enrollmentService.listarPorTurma(turma.id!),
      frequencias: this.attendanceService.listarPorTurmaComAluno(turma.id!),
    }).subscribe({
      next: ({ matriculas, frequencias }) => {
        if (matriculas.length + frequencias.length > 0) {
          const partes: string[] = [];
          if (matriculas.length > 0) {
            partes.push(`${matriculas.length} matricula(s)`);
          }
          if (frequencias.length > 0) {
            partes.push(`${frequencias.length} registro(s) de frequencia`);
          }

          this.erro.set(
            `Nao e possivel excluir a turma ${turma.code} porque existem ` +
              `${partes.join(' e ')} vinculados. Exclua ou altere esses registros primeiro. ` +
              `Para encerrar a turma sem apagar o historico, edite e mude a situacao para ` +
              `concluida ou cancelada.`,
          );
          return;
        }

        this.confirmarExclusao(turma);
      },
      error: () => {
        this.erro.set('Nao foi possivel verificar os vinculos da turma. Tente de novo.');
      },
    });
  }

  private confirmarExclusao(turma: ClassComRelacoes): void {
    this.confirmService
      .confirm({
        title: 'Excluir turma',
        message: `Confirma a exclusao da turma ${turma.code}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.classService.delete(turma.id!).subscribe({
          next: () => this.carregar(),
          error: () => this.erro.set('Nao foi possivel excluir a turma. Tente de novo.'),
        });
      });
  }

  /** Converte 'aaaa-mm-dd' em 'dd/mm/aaaa'. */
  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private semAcento(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
