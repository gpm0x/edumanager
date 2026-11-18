import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Course, Enrollment } from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { CourseService } from '../../core/services/course.service';
import { EnrollmentComRelacoes, EnrollmentService } from '../../core/services/enrollment.service';
import { FinancialRecordService } from '../../core/services/financial-record.service';
import { PaymentService } from '../../core/services/payment.service';
import {
  ConfirmService,
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  PageHeaderComponent,
  SearchFieldComponent,
  StatusChipComponent,
} from '../../shared';
import { MinhaMatriculaComponent } from './minha-matricula/minha-matricula.component';

/**
 * TELA DE MATRICULAS (listagem).
 *
 * A matricula e a TABELA ASSOCIATIVA do sistema: ela resolve o relacionamento
 * muitos-para-muitos entre alunos e turmas. Um aluno pode estar em varias
 * turmas; uma turma tem varios alunos; a matricula e cada um desses encontros.
 *
 * COMO A TELA MOSTRA NOME NO LUGAR DE ID (checklist 6.1 e 16.2)
 * ------------------------------------------------------------
 * listarComAlunoETurma() pede ?_expand=student&_expand=class, e a resposta ja
 * traz o aluno e a turma dentro da matricula. Como a turma guarda courseId (e
 * nao o nome do curso), carregamos os cursos tambem e resolvemos o nome aqui.
 * Sao duas requisicoes em paralelo, nao uma por linha da tabela.
 *
 * ATENCAO AO ACESSO POR COLCHETES
 * -------------------------------
 * matricula['class'] em vez de matricula.class: "class" e palavra reservada do
 * TypeScript. Como nome de propriedade ela e aceita, mas o contrato (secao 9)
 * padronizou o acesso por colchetes para nao depender disso.
 */
@Component({
  selector: 'app-enrollments',
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
    MinhaMatriculaComponent,
  ],
  templateUrl: './enrollments.component.html',
  styleUrl: './enrollments.component.scss',
})
export class EnrollmentsComponent {
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly courseService = inject(CourseService);
  private readonly paymentService = inject(PaymentService);
  private readonly recordService = inject(FinancialRecordService);
  private readonly confirmService = inject(ConfirmService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  /**
   * TRES permissoes, e nao uma - e em nenhuma area a diferenca aparece tanto
   * quanto nesta:
   *
   *   criar   -> administrador e ALUNO. E assim que o aluno se matricula em um
   *              curso novo sem depender da secretaria.
   *   editar  -> administrador e PROFESSOR (corrigir turma, concluir).
   *   excluir -> somente o administrador: apagar matricula apaga historico.
   *
   * O professor e o unico perfil que edita sem poder criar, e o motivo e de
   * negocio: matricular alguem gera lancamento financeiro e ocupa vaga na
   * turma, e isso e ato administrativo.
   *
   * Um unico "podeGerenciar" mostraria os tres botoes para quem pode apenas um
   * deles - e o clique terminaria em acesso negado, o que parece bug.
   */
  readonly podeCriar = this.acesso.podeCriar('enrollments');
  readonly podeEditar = this.acesso.podeEditar('enrollments');
  readonly podeExcluir = this.acesso.podeExcluir('enrollments');

  /** A coluna "Acoes" so existe quando ha pelo menos um botao para por nela. */
  readonly podeGerenciar = this.podeEditar || this.podeExcluir;

  readonly matriculas = signal<EnrollmentComRelacoes[]>([]);

  /** Cursos indexados por id, para resolver o nome a partir do courseId da turma. */
  readonly cursosPorId = signal<Record<number, Course>>({});

  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly termo = signal('');

  /** A coluna de acoes so existe para quem pode gerenciar matricula. */
  readonly colunas = this.podeGerenciar
    ? ['student', 'turma', 'curso', 'data', 'status', 'acoes']
    : ['student', 'turma', 'curso', 'data', 'status'];

  readonly matriculasFiltradas = computed(() => {
    const busca = this.semAcento(this.termo());
    if (!busca) {
      return this.matriculas();
    }
    return this.matriculas().filter(
      (matricula) =>
        this.semAcento(matricula.student?.name ?? '').includes(busca) ||
        this.semAcento(matricula['class']?.code ?? '').includes(busca) ||
        this.semAcento(this.nomeDoCurso(matricula)).includes(busca),
    );
  });

  /**
   * O aluno nao ve esta lista: ve a tela "Minha matricula" (dados, matriculas
   * e catalogo), desenhada para ele. A rota e a mesma - /enrollments - e e
   * aqui que a tela certa e escolhida.
   */
  readonly ehAluno = this.acesso.ehAluno();
  readonly ehProfessor = this.acesso.ehProfessor();

  constructor() {
    if (!this.ehAluno) {
      this.carregar();
    }
  }

  /**
   * A frase que explica o recorte desta tela.
   *
   * Aqui ela MUDA com o perfil, e nao por capricho de texto: o aluno
   * veem recortes diferentes da mesma lista (as matriculas das turmas dele
   * contra as matriculas dele), e uma frase so estaria errada para um dos dois.
   */
  get avisoDeEscopo(): string {
    return this.acesso.ehAluno()
      ? 'Voce esta vendo apenas as suas matriculas.'
      : 'Voce esta vendo apenas as matriculas das turmas dos seus cursos.';
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      matriculas: this.enrollmentService.listarComAlunoETurma(),
      cursos: this.courseService.list(),
    }).subscribe({
      next: ({ escopo, matriculas, cursos }) => {
        // O filtro desta tela e o que mais muda de significado entre os
        // perfis, e e por isso que a regra mora no AcessoService e nao aqui:
        //
        //   professor -> as matriculas das turmas dos cursos dele (de TODOS os
        //                alunos dessas turmas, porque ele precisa da lista);
        //   aluno     -> somente as matriculas DELE, e nao as dos colegas de
        //                turma - que seria o resultado se o filtro fosse por
        //                turma, como no caso do professor.
        const permitidas = this.acesso.filtrarMatriculas(escopo, matriculas);

        // Mais recentes primeiro: e a ordem util para quem acompanha matriculas.
        this.matriculas.set(
          [...permitidas].sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate)),
        );

        const indice: Record<number, Course> = {};
        for (const curso of cursos) {
          indice[curso.id!] = curso;
        }
        this.cursosPorId.set(indice);

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar as matriculas. Rode npm run api e tente de novo.');
      },
    });
  }

  novo(): void {
    this.router.navigate(['/enrollments/new']);
  }

  editar(matricula: Enrollment): void {
    this.router.navigate(['/enrollments', matricula.id, 'edit']);
  }

  /** Nome do aluno da matricula (vem do ?_expand=student). */
  nomeDoAluno(matricula: EnrollmentComRelacoes): string {
    return matricula.student?.name ?? '-';
  }

  /** Codigo da turma (vem do ?_expand=class, acessado por colchetes). */
  codigoDaTurma(matricula: EnrollmentComRelacoes): string {
    return matricula['class']?.code ?? '-';
  }

  /**
   * Nome do curso da turma.
   * Caminho completo: matricula -> turma -> courseId -> curso.name
   */
  nomeDoCurso(matricula: EnrollmentComRelacoes): string {
    const courseId = matricula['class']?.courseId;
    if (courseId === undefined) {
      return '-';
    }
    return this.cursosPorId()[courseId]?.name ?? '-';
  }

  /** REGRA 6.8 - matricula com parcela lancada nao pode ser excluida. */
  excluir(matricula: EnrollmentComRelacoes): void {
    this.erro.set('');

    // Confere as DUAS dependencias financeiras, e nao so as parcelas: um
    // lancamento sem parcela (dado inconsistente) ficaria orfao se a matricula
    // fosse apagada, e um lancamento orfao e dinheiro que ninguem mais
    // consegue rastrear ate um aluno.
    forkJoin({
      parcelas: this.paymentService.listarPorMatricula(matricula.id!),
      lancamentos: this.recordService.listarPorMatricula(matricula.id!),
    }).subscribe({
      next: ({ parcelas, lancamentos }) => {
        const dependentes = parcelas.length + lancamentos.length;

        if (dependentes > 0) {
          this.erro.set(
            `Nao e possivel excluir a matricula de ${this.nomeDoAluno(matricula)} porque ` +
              `existem ${lancamentos.length} lancamento(s) e ${parcelas.length} parcela(s) ` +
              `vinculados. O historico financeiro nao e apagado junto (requisito 11). Para ` +
              `encerrar a matricula sem destruir o historico, edite e mude a situacao para ` +
              `cancelada ou concluida.`,
          );
          return;
        }

        this.confirmarExclusao(matricula);
      },
      error: () => {
        this.erro.set('Nao foi possivel verificar o financeiro da matricula. Tente de novo.');
      },
    });
  }

  private confirmarExclusao(matricula: EnrollmentComRelacoes): void {
    this.confirmService
      .confirm({
        title: 'Excluir matricula',
        message:
          `Confirma a exclusao da matricula de ${this.nomeDoAluno(matricula)} na turma ` +
          `${this.codigoDaTurma(matricula)}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.enrollmentService.delete(matricula.id!).subscribe({
          next: () => this.carregar(),
          error: () => this.erro.set('Nao foi possivel excluir a matricula. Tente de novo.'),
        });
      });
  }

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
