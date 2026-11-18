import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Student, StudentModel } from '../../core/models';
import { AcessoService } from '../../core/services/acesso.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { EnrollmentService } from '../../core/services/enrollment.service';
import { StudentService } from '../../core/services/student.service';
import { UserService } from '../../core/services/user.service';
import {
  ConfirmService,
  EmptyStateComponent,
  EscopoAvisoComponent,
  LoadingComponent,
  PageHeaderComponent,
  SearchFieldComponent,
  StatusChipComponent,
} from '../../shared';

/**
 * TELA DE ALUNOS (listagem).
 *
 * Mesma estrutura da tela de Cursos (o molde). Duas coisas sao especificas
 * daqui e valem a leitura:
 *
 * 1) AQUI A HERANCA APARECE NA TELA.
 *    A API devolve JSON puro (a interface Student). Convertemos cada registro
 *    em StudentModel, que ESTENDE Pessoa, e a tabela chama os metodos herdados:
 *
 *      aluno.getCpfFormatado()  -> veio de Pessoa (a classe base)
 *      aluno.getIdade()         -> e proprio de StudentModel
 *
 *    E a resposta pratica para "onde a heranca e usada de verdade no projeto?".
 *    Sem isso, a tela teria de formatar CPF na mao e calcular idade na mao.
 *
 * 2) A EXCLUSAO CONSULTA DUAS COLECOES (regra 6.8).
 *    Aluno pode ter matricula E frequencia. As duas consultas vao juntas, com
 *    forkJoin, em vez de um subscribe dentro do outro.
 */
@Component({
  selector: 'app-students',
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
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent {
  private readonly studentService = inject(StudentService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly confirmService = inject(ConfirmService);
  private readonly userService = inject(UserService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  /**
   * As tres permissoes desta area, separadas porque os perfis separam:
   *
   *   criar   -> somente o administrador (admitir aluno na escola)
   *   editar  -> administrador e PROFESSOR (o cadastro academico dos alunos
   *              dele - requisito 2: "gerenciar informacoes dos alunos
   *              vinculados, conforme autorizacao")
   *   excluir -> somente o administrador (apagar aluno apaga historico)
   *
   * Um unico "podeGerenciar" mostraria os tres botoes ao professor, e dois
   * deles terminariam em acesso negado - o que parece bug, e nao permissao.
   */
  readonly podeCriar = this.acesso.podeCriar('students');
  readonly podeEditar = this.acesso.podeEditar('students');
  readonly podeExcluir = this.acesso.podeExcluir('students');

  /** A coluna "Acoes" so existe quando ha pelo menos um botao para por nela. */
  readonly podeGerenciar = this.podeEditar || this.podeExcluir;

  /** Os alunos, ja convertidos em StudentModel (classe com comportamento). */
  readonly alunos = signal<StudentModel[]>([]);

  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly termo = signal('');

  /** A coluna de acoes so existe para quem pode gerenciar aluno. */
  readonly colunas = this.podeGerenciar
    ? ['name', 'cpf', 'idade', 'phone', 'situacao', 'acoes']
    : ['name', 'cpf', 'idade', 'phone', 'situacao'];

  /** Busca por nome, CPF ou e-mail, sem acento e sem caixa. */
  readonly alunosFiltrados = computed(() => {
    const busca = this.semAcento(this.termo());
    if (!busca) {
      return this.alunos();
    }
    return this.alunos().filter(
      (aluno) =>
        this.semAcento(aluno.name).includes(busca) ||
        this.semAcento(aluno.email).includes(busca) ||
        aluno.cpf.includes(busca.replace(/\D/g, '')),
    );
  });

  constructor() {
    this.carregar();
  }

  /** A frase que explica o recorte desta tela (ver EscopoAvisoComponent). */
  get avisoDeEscopo(): string {
    return 'Voce esta vendo apenas os alunos matriculados nas turmas dos seus cursos.';
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    forkJoin({
      escopo: this.acesso.escopo(),
      alunos: this.studentService.listarOrdenadoPorNome(),
    }).subscribe({
      next: ({ escopo, alunos }) => {
        // Para o professor, "os alunos" sao os que estao matriculados nas
        // turmas dos cursos dele. O filtro vem antes da conversao para classe:
        // nao faz sentido instanciar StudentModel de quem nao vai aparecer.
        const permitidos = this.acesso.filtrarAlunos(escopo, alunos);

        // JSON puro -> classe. A partir daqui a tela tem os metodos de Pessoa.
        this.alunos.set(permitidos.map((aluno) => new StudentModel(aluno)));
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar os alunos. Rode npm run api e tente de novo.');
      },
    });
  }

  novo(): void {
    this.router.navigate(['/students/new']);
  }

  editar(aluno: Student): void {
    this.router.navigate(['/students', aluno.id, 'edit']);
  }

  /**
   * REGRA 6.8 - EXCLUSAO BLOQUEADA POR DEPENDENTE.
   *
   * Aluno tem dois tipos de dependente: matricula e frequencia. Consultamos as
   * duas colecoes em PARALELO com forkJoin, que avisa uma unica vez, quando as
   * duas respostas chegarem.
   */
  excluir(aluno: StudentModel): void {
    this.erro.set('');

    forkJoin({
      matriculas: this.enrollmentService.listarPorAluno(aluno.id!),
      frequencias: this.attendanceService.listarPorAluno(aluno.id!),
      // A CONTA DE ACESSO tambem e um dependente, e um dos piores de deixar
      // solto: apagar o cadastro deixaria a credencial apontando para
      // ninguem. A pessoa ainda entraria no sistema, mas com escopo vazio -
      // todas as telas abririam sem nenhum dado, sem erro e sem explicacao.
      // E um vinculo novo, criado junto com a restricao de acesso.
      contas: this.userService.buscarPorAluno(aluno.id!),
    }).subscribe({
      next: ({ matriculas, frequencias, contas }) => {
        const total = matriculas.length + frequencias.length + contas.length;

        if (total > 0) {
          // A mensagem diz exatamente O QUE impede, com numero, para o usuario
          // saber onde ir resolver.
          const partes: string[] = [];
          if (matriculas.length > 0) {
            partes.push(`${matriculas.length} matricula(s)`);
          }
          if (frequencias.length > 0) {
            partes.push(`${frequencias.length} registro(s) de frequencia`);
          }
          if (contas.length > 0) {
            partes.push(`uma conta de acesso (login "${contas[0].login}")`);
          }

          this.erro.set(
            `Nao e possivel excluir o aluno ${aluno.name} porque existem ` +
              `${partes.join(' e ')} vinculados. Exclua esses registros primeiro ` +
              `(a conta de acesso sai em Usuarios). Para tirar o aluno de circulacao sem ` +
              `apagar o historico, edite e marque como inativo.`,
          );
          return;
        }

        this.confirmarExclusao(aluno);
      },
      error: () => {
        this.erro.set('Nao foi possivel verificar os vinculos do aluno. Tente de novo.');
      },
    });
  }

  private confirmarExclusao(aluno: StudentModel): void {
    this.confirmService
      .confirm({
        title: 'Excluir aluno',
        message: `Confirma a exclusao de ${aluno.name}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.studentService.delete(aluno.id!).subscribe({
          next: () => this.carregar(),
          error: () => this.erro.set('Nao foi possivel excluir o aluno. Tente de novo.'),
        });
      });
  }

  private semAcento(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
