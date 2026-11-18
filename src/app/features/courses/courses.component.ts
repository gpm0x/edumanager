import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { Course, User } from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { ClassService } from '../../core/services/class.service';
import { CourseService } from '../../core/services/course.service';
import { UserService } from '../../core/services/user.service';
import {
  ConfirmService,
  EmptyStateComponent,
  LoadingComponent,
  PageHeaderComponent,
  SearchFieldComponent,
  StatusChipComponent,
} from '../../shared';

/**
 * TELA DE CURSOS (listagem).
 *
 * ESTA TELA E O MOLDE DAS OUTRAS OITO. Quem for ler o codigo dos outros modulos
 * encontra exatamente esta mesma estrutura, na mesma ordem:
 *
 *   1. signals de estado      -> registros, carregando, erro, termo de busca
 *   2. computed do filtro     -> a lista que a tabela realmente mostra
 *   3. carregar()             -> uma chamada ao service, no construtor
 *   4. novo() / editar()      -> navegacao para o formulario
 *   5. excluir()              -> REGRA 6.8 primeiro, confirmacao depois
 *
 * POR QUE TUDO E SIGNAL
 * ---------------------
 * O projeto e zoneless (nao tem zone.js). Sem zone, atribuir uma propriedade
 * comum dentro de um subscribe NAO redesenha a tela. Signal redesenha.
 *
 * A BUSCA NAO VAI NA API
 * ----------------------
 * Regra 6.9 do contrato: o <app-search-field> apenas avisa o termo digitado
 * (com 300ms de debounce) e quem filtra e esta tela, em memoria, ignorando
 * acento e caixa. Menos requisicao e busca instantanea.
 */
@Component({
  selector: 'app-courses',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    SearchFieldComponent,
    StatusChipComponent,
    EmptyStateComponent,
    LoadingComponent,
  ],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent {
  private readonly courseService = inject(CourseService);
  private readonly classService = inject(ClassService);
  private readonly confirmService = inject(ConfirmService);
  private readonly acesso = inject(AcessoService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  /**
   * As tres permissoes desta area:
   *
   *   criar   -> somente o administrador (abrir curso no catalogo)
   *   editar  -> administrador e PROFESSOR, este ultimo apenas nos cursos de
   *              que e responsavel - o ESCOPO e que limita quais sao, e o
   *              formulario confere o dono antes de abrir
   *   excluir -> somente o administrador
   *
   * O aluno abre esta tela em leitura (requisito 4: ele precisa ver os cursos
   * disponiveis), e por isso nao recebe a coluna de acoes nem o botao "Novo
   * curso". A rota do formulario tambem esta fechada pelo permissaoGuard:
   * esconder o botao nao bastaria, bastaria digitar /courses/new.
   */
  readonly podeCriar = this.acesso.podeCriar('courses');
  readonly podeEditar = this.acesso.podeEditar('courses');
  readonly podeExcluir = this.acesso.podeExcluir('courses');

  /** A coluna "Acoes" so existe quando ha pelo menos um botao para por nela. */
  readonly podeGerenciar = this.podeEditar || this.podeExcluir;

  /** Os cursos como vieram da API, ja recortados pelo escopo do perfil. */
  readonly cursos = signal<Course[]>([]);

  /** Indice de professores por id, para traduzir Course.teacherId em nome. */
  readonly professoresPorId = signal<Record<number, User>>({});

  /** A coluna de responsavel so aparece para quem alcanca o cadastro de usuarios. */
  readonly podeVerProfessores = this.acesso.podeVer('users');

  /** true enquanto a consulta nao volta. */
  readonly carregando = signal(true);

  /** Mensagem de erro no topo da tela. Vazia = sem erro. */
  readonly erro = signal('');

  /** O que foi digitado na busca. */
  readonly termo = signal('');

  /**
   * Colunas da tabela, na ordem em que aparecem.
   *
   * A coluna 'acoes' (editar/excluir) so entra para quem pode gerenciar. Nao
   * basta desabilitar os botoes: uma coluna vazia ocupando 112px em toda linha
   * sugere que falta alguma coisa na tela.
   */
  readonly colunas = [
    'name',
    ...(this.podeVerProfessores ? ['professor'] : []),
    'workload',
    'price',
    'situacao',
    ...(this.podeGerenciar ? ['acoes'] : []),
  ];

  /**
   * A lista que a tabela mostra: os cursos filtrados pela busca.
   * computed recalcula sozinho quando cursos() ou termo() mudam.
   */
  readonly cursosFiltrados = computed(() => {
    const busca = this.semAcento(this.termo());
    if (!busca) {
      return this.cursos();
    }
    return this.cursos().filter(
      (curso) =>
        this.semAcento(curso.name).includes(busca) ||
        this.semAcento(curso.description).includes(busca),
    );
  });

  constructor() {
    this.carregar();
  }

  /**
   * Busca os cursos na API, em ordem alfabetica, e o nome de cada responsavel.
   *
   * AGORA EXISTE FILTRO DE ESCOPO AQUI, e nao existia antes
   * -------------------------------------------------------
   * Enquanto o catalogo era area exclusiva do administrador, filtrar nao fazia
   * sentido: quem ve tudo nao tem o que recortar. Com a entrada do perfil
   * professor isso mudou - ele abre esta mesma tela e deve ver SOMENTE os
   * cursos de que e responsavel. O aluno tambem abre (requisito 4: "o aluno
   * podera visualizar os cursos disponiveis"), e para ele o catalogo e
   * inteiro, porque preco e carga horaria de curso nao sao dado de ninguem.
   *
   * Quem decide os tres casos e o filtrarCursos() do AcessoService, nao esta
   * tela.
   */
  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      cursos: this.courseService.listarOrdenadoPorNome(),
      // A lista de professores e so para traduzir teacherId em nome. Quem nao
      // alcanca /users (professor e aluno) nem pede: a coluna some para eles.
      professores: this.podeVerProfessores ? this.userService.listarProfessores() : of([]),
    }).subscribe({
      next: ({ escopo, cursos, professores }) => {
        this.cursos.set(this.acesso.filtrarCursos(escopo, cursos));

        const indice: Record<number, User> = {};
        for (const professor of professores) {
          indice[professor.id!] = professor;
        }
        this.professoresPorId.set(indice);

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar os cursos. Rode npm run api e tente de novo.');
      },
    });
  }

  /** Nome do professor responsavel, para a coluna da tabela. */
  nomeDoProfessor(curso: Course): string {
    if (curso.teacherId === undefined) {
      return 'Sem responsavel';
    }
    return this.professoresPorId()[curso.teacherId]?.name ?? 'Professor nao encontrado';
  }

  /** Abre o formulario vazio. */
  novo(): void {
    this.router.navigate(['/courses/new']);
  }

  /** Abre o formulario com o curso carregado. */
  editar(curso: Course): void {
    this.router.navigate(['/courses', curso.id, 'edit']);
  }

  /**
   * REGRA 6.8 - EXCLUSAO BLOQUEADA POR DEPENDENTE.
   *
   * Antes de perguntar qualquer coisa ao usuario, consultamos se o curso tem
   * turma vinculada (GET /classes?courseId=X). Se tiver, a exclusao nem e
   * oferecida: mostramos a mensagem padrao do contrato e sugerimos INATIVAR.
   *
   * Por que bloquear e nao apagar em cascata: cascata destroi dado em silencio.
   * Bloquear e o que um banco relacional faria com ON DELETE RESTRICT.
   */
  excluir(curso: Course): void {
    this.erro.set('');

    this.classService.listarPorCurso(curso.id!).subscribe({
      next: (turmas) => {
        if (turmas.length > 0) {
          this.erro.set(
            `Nao e possivel excluir o curso ${curso.name} porque existem ${turmas.length} ` +
              `turma(s) vinculada(s). Exclua ou altere as turmas primeiro. ` +
              `Para tirar o curso de circulacao sem apagar o historico, edite e marque como inativo.`,
          );
          return;
        }

        this.confirmarExclusao(curso);
      },
      error: () => {
        this.erro.set('Nao foi possivel verificar as turmas do curso. Tente de novo.');
      },
    });
  }

  /** Pergunta e, se confirmado, exclui de verdade. */
  private confirmarExclusao(curso: Course): void {
    this.confirmService
      .confirm({
        title: 'Excluir curso',
        message: `Confirma a exclusao do curso ${curso.name}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.courseService.delete(curso.id!).subscribe({
          next: () => this.carregar(),
          error: () => this.erro.set('Nao foi possivel excluir o curso. Tente de novo.'),
        });
      });
  }

  /** Formata o valor em reais (R$ 1.200,00). */
  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /**
   * Deixa o texto minusculo e sem acento, para "Informatica" achar "informática".
   * Receita do shared/README.md, secao 2.5.
   */
  private semAcento(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
