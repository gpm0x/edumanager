import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { Attendance, Student } from '../../core/models';
import { AcessoService, EscopoDeDados } from '../../core/services/acesso.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { ClassComRelacoes, ClassService } from '../../core/services/class.service';
import { StudentService } from '../../core/services/student.service';
import {
  ConfirmService,
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared';

/**
 * TELA DE FREQUENCIA (listagem).
 *
 * O FILTRO DESTA TELA VAI NA API (e a excecao da regra 6.9)
 * ---------------------------------------------------------
 * Nas outras telas o filtro e local, porque o volume e pequeno e o filtro e
 * texto livre. Aqui e diferente: frequencia e a colecao que cresce mais rapido
 * (um registro por aluno, por aula), e o filtro e por CHAVE (turma e data).
 * Entao ele vira consulta:
 *
 *   turma              -> GET /attendances?classId=X&_expand=student
 *   turma + data       -> GET /attendances?classId=X&date=Z
 *
 * E o cenario 8.4 do checklist de testes.
 *
 * COMO O NOME DO ALUNO APARECE
 * ----------------------------
 * Carregamos os alunos uma vez e guardamos num indice por id. Assim qualquer
 * um dos tres caminhos de consulta acima mostra nome, nunca studentId.
 */
@Component({
  selector: 'app-attendances',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PageHeaderComponent,
    StatusChipComponent,
    EmptyStateComponent,
    EscopoAvisoComponent,
    LoadingComponent,
  ],
  templateUrl: './attendances.component.html',
  styleUrl: './attendances.component.scss',
})
export class AttendancesComponent {
  private readonly attendanceService = inject(AttendanceService);
  private readonly classService = inject(ClassService);
  private readonly studentService = inject(StudentService);
  private readonly confirmService = inject(ConfirmService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  /**
   * As tres permissoes desta area:
   *
   *   criar   -> administrador e PROFESSOR. Lancar chamada e o trabalho dele.
   *   editar  -> administrador e PROFESSOR (corrigir o que lancou errado).
   *   excluir -> somente o administrador: apagar presenca apaga historico
   *              academico do aluno.
   *
   * O aluno nao grava nada - consulta a propria frequencia. Poder editar a
   * propria presenca seria o fim do controle.
   */
  readonly podeCriar = this.acesso.podeCriar('attendances');
  readonly podeEditar = this.acesso.podeEditar('attendances');
  readonly podeExcluir = this.acesso.podeExcluir('attendances');

  /** A coluna "Acoes" so existe quando ha pelo menos um botao para por nela. */
  readonly podeGerenciar = this.podeEditar || this.podeExcluir;

  /**
   * Guarda o escopo depois de carregado.
   *
   * Esta tela e a unica que precisa guardar: as outras filtram uma vez, no
   * carregar(), mas aqui cada mudanca de filtro (turma ou data) dispara uma
   * consulta nova a API, e o resultado dela tem de passar pelo mesmo recorte.
   * Sem guardar, so a primeira carga sairia filtrada.
   */
  private escopoCarregado: EscopoDeDados | null = null;

  readonly registros = signal<Attendance[]>([]);

  /** Opcoes do filtro de turma e indices para resolver os nomes. */
  readonly turmas = signal<ClassComRelacoes[]>([]);
  readonly alunosPorId = signal<Record<number, Student>>({});
  readonly turmasPorId = signal<Record<number, ClassComRelacoes>>({});

  readonly carregando = signal(true);
  readonly erro = signal('');

  /** Filtros. 'todas' = sem filtro de turma; data vazia = sem filtro de data. */
  readonly filtroTurma = signal<number | 'todas'>('todas');
  readonly filtroData = signal('');

  /** A coluna de acoes so existe para quem pode lancar presenca. */
  /** O aluno ve a propria frequencia: a coluna "Aluno" seria o nome dele em toda linha. */
  readonly ehAluno = this.acesso.ehAluno();
  readonly ehProfessor = this.acesso.ehProfessor();

  readonly colunas = this.ehAluno
    ? ['curso', 'turma', 'data', 'presenca']
    : this.podeGerenciar
      ? ['aluno', 'curso', 'turma', 'data', 'presenca', 'acoes']
      : ['aluno', 'curso', 'turma', 'data', 'presenca'];

  /**
   * RESUMO POR CURSO: presencas, faltas e porcentagem de cada turma que
   * aparece nos registros listados. Para o aluno, e "como estou em cada
   * curso"; para o professor, "como esta cada turma minha".
   */
  readonly resumoPorTurma = computed(() => {
    const grupos = new Map<number, { presencas: number; faltas: number }>();
    for (const registro of this.registros()) {
      const grupo = grupos.get(registro.classId) ?? { presencas: 0, faltas: 0 };
      if (registro.present) {
        grupo.presencas++;
      } else {
        grupo.faltas++;
      }
      grupos.set(registro.classId, grupo);
    }

    return [...grupos.entries()]
      .map(([classId, grupo]) => {
        const total = grupo.presencas + grupo.faltas;
        const turma = this.turmasPorId()[classId];
        return {
          classId,
          turma: turma?.code ?? '-',
          curso: turma?.course?.name ?? 'Curso nao encontrado',
          presencas: grupo.presencas,
          faltas: grupo.faltas,
          total,
          porcentagem: total === 0 ? 0 : Math.round((grupo.presencas / total) * 100),
        };
      })
      .sort((a, b) => a.curso.localeCompare(b.curso) || a.turma.localeCompare(b.turma));
  });

  /** Total de presencas e de faltas do que esta na tela. */
  readonly presentes = computed(
    () => this.registros().filter((registro) => registro.present).length,
  );
  readonly ausentes = computed(
    () => this.registros().filter((registro) => !registro.present).length,
  );

  constructor() {
    this.carregarBase();
  }

  /** A frase que explica o recorte desta tela, que muda com o perfil. */
  get avisoDeEscopo(): string {
    return this.acesso.ehAluno()
      ? 'Voce esta vendo apenas a sua frequencia.'
      : 'Voce esta vendo apenas a frequencia das turmas dos seus cursos.';
  }

  /** Carrega turmas e alunos (as opcoes e os indices) e depois os registros. */
  private carregarBase(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      // Com o curso embutido: a tabela e o resumo mostram o NOME do curso.
      turmas: this.classService.listarComCurso(),
      alunos: this.studentService.listarOrdenadoPorNome(),
    }).subscribe({
      next: ({ escopo, turmas, alunos }) => {
        this.escopoCarregado = escopo;

        // O SELECT DE TURMA tambem e filtrado, e isso importa tanto quanto
        // filtrar a tabela: oferecer no filtro uma turma que o usuario nao
        // alcanca seria entregar a ele uma consulta que volta vazia sem
        // explicacao - ou, pior, o nome de uma turma que nao e dele.
        const turmasPermitidas = this.acesso
          .filtrarTurmas(escopo, turmas)
          .sort((a, b) => a.code.localeCompare(b.code));
        this.turmas.set(turmasPermitidas);

        const indiceTurmas: Record<number, ClassComRelacoes> = {};
        for (const turma of turmasPermitidas) {
          indiceTurmas[turma.id!] = turma;
        }
        this.turmasPorId.set(indiceTurmas);

        const indiceAlunos: Record<number, Student> = {};
        for (const aluno of this.acesso.filtrarAlunos(escopo, alunos)) {
          indiceAlunos[aluno.id!] = aluno;
        }
        this.alunosPorId.set(indiceAlunos);

        this.carregar();
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar turmas e alunos. Rode npm run api.');
      },
    });
  }

  /**
   * Busca os registros conforme os filtros escolhidos.
   *
   * Tres caminhos, e o comentario de cada um diz qual URL a API recebe:
   */
  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    const turma = this.filtroTurma();
    const data = this.filtroData();

    let consulta: Observable<Attendance[]>;

    if (turma === 'todas') {
      // GET /attendances
      consulta = this.attendanceService.list();
    } else if (data) {
      // GET /attendances?classId=X&date=Z  (cenario 8.4 do checklist)
      consulta = this.attendanceService.listarPorTurmaEData(turma, data);
    } else {
      // GET /attendances?classId=X&_expand=student
      consulta = this.attendanceService.listarPorTurmaComAluno(turma);
    }

    consulta.subscribe({
      next: (registros) => {
        // Sem turma escolhida, a data (se houver) e aplicada em memoria: nao
        // vale uma requisicao so para filtrar por data no sistema todo.
        const filtrados =
          turma === 'todas' && data
            ? registros.filter((registro) => registro.date === data)
            : registros;

        // A RESTRICAO DE ACESSO entra depois dos filtros de tela, e nao antes:
        // turma e data sao escolha do usuario, permissao nao e. Ele pode
        // limpar os filtros dele; o recorte do perfil fica.
        const permitidos = this.escopoCarregado
          ? this.acesso.filtrarFrequencias(this.escopoCarregado, filtrados)
          : // Escopo ainda nao carregado: nao mostramos nada. Falhar fechado e
            // o certo - mostrar a base inteira "so nesse instante" seria o
            // mesmo que nao ter restricao.
            [];

        // Mais recentes primeiro, e por aluno dentro do mesmo dia.
        this.registros.set(
          [...permitidos].sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              this.nomeDoAluno(a).localeCompare(this.nomeDoAluno(b)),
          ),
        );

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar a frequencia. Tente de novo.');
      },
    });
  }

  /** Chamado pelos dois filtros: muda o valor e refaz a consulta. */
  aplicarTurma(valor: number | 'todas'): void {
    this.filtroTurma.set(valor);
    this.carregar();
  }

  aplicarData(valor: string): void {
    this.filtroData.set(valor);
    this.carregar();
  }

  limparFiltros(): void {
    this.filtroTurma.set('todas');
    this.filtroData.set('');
    this.carregar();
  }

  /** true quando algum filtro esta aplicado (muda o texto do estado vazio). */
  get temFiltro(): boolean {
    return this.filtroTurma() !== 'todas' || this.filtroData() !== '';
  }

  /**
   * A acao principal desta tela e a CHAMADA, e nao o registro avulso.
   *
   * O motivo e pratico: lancar presenca de uma turma pelo formulario de um
   * registro so sao trinta idas e voltas de tela. O formulario avulso continua
   * existindo (e o que os botoes de editar abrem), porque ele e a ferramenta
   * certa para CORRIGIR um registro - nao para criar trinta.
   */
  irParaChamada(): void {
    this.router.navigate(['/attendances/chamada']);
  }

  novo(): void {
    this.router.navigate(['/attendances/new']);
  }

  editar(registro: Attendance): void {
    this.router.navigate(['/attendances', registro.id, 'edit']);
  }

  nomeDoAluno(registro: Attendance): string {
    return this.alunosPorId()[registro.studentId]?.name ?? 'Aluno nao encontrado';
  }

  nomeDoCurso(registro: Attendance): string {
    return this.turmasPorId()[registro.classId]?.course?.name ?? '-';
  }

  get titulo(): string {
    return this.ehAluno ? 'Minha frequencia' : 'Frequencia';
  }

  get subtitulo(): string {
    if (this.ehAluno) {
      return 'Suas presencas e faltas em cada curso que voce esta fazendo';
    }
    if (this.ehProfessor) {
      return 'Presenca e falta dos alunos das turmas em que voce da aula';
    }
    return 'Presenca e falta por turma, aluno e data de aula';
  }

  codigoDaTurma(registro: Attendance): string {
    return this.turmasPorId()[registro.classId]?.code ?? '-';
  }

  /**
   * Frequencia nao tem dependente: a exclusao e direta, so com a confirmacao.
   */
  excluir(registro: Attendance): void {
    this.erro.set('');

    this.confirmService
      .confirm({
        title: 'Excluir registro de frequencia',
        message:
          `Confirma a exclusao do registro de ${this.nomeDoAluno(registro)} em ` +
          `${this.formatarData(registro.date)}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.attendanceService.delete(registro.id!).subscribe({
          next: () => this.carregar(),
          error: () => this.erro.set('Nao foi possivel excluir o registro. Tente de novo.'),
        });
      });
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
}
