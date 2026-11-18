import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';

import { Class, ClassShift, ClassStatus, Course, User } from '../../../core/models';
import { AcessoService } from '../../../core/services/acesso.service';
import { ClassService } from '../../../core/services/class.service';
import { CourseService } from '../../../core/services/course.service';
import { UserService } from '../../../core/services/user.service';
import {
  LIMITES,
  mensagemDeErro,
  numeroValidators,
  periodoValidator,
  selecaoValidators,
  textoValidators,
} from '../../../core/validators';
import { FormActionsComponent, LoadingComponent, PageHeaderComponent } from '../../../shared';

/**
 * FORMULARIO DE TURMA (cadastrar e editar).
 *
 * TRES PONTOS ESPECIFICOS DESTA TELA
 * ----------------------------------
 * 1) O SELECT E A INTEGRIDADE REFERENCIAL DO SISTEMA.
 *    O JSON Server nao tem chave estrangeira. Quem garante que o courseId
 *    existe e o select: ele so oferece ids que vieram da API, entao o usuario
 *    nao consegue gravar uma turma apontando para um curso inexistente.
 *
 * 2) VALIDADOR DE GRUPO (periodoValidator).
 *    "fim >= inicio" nao e regra de um campo, e de DOIS. Por isso o validador
 *    vai no segundo argumento do group() e o erro fica no FORMULARIO
 *    (form.hasError('periodoInvalido')), nao no campo.
 *
 * 3) CURSO INATIVO (detalhe importante na edicao).
 *    O contrato diz que curso inativo NAO pode receber turma nova. Mas uma
 *    turma ANTIGA pode ter sido aberta quando o curso ainda estava ativo - e
 *    essa turma precisa continuar exibindo o nome certo.
 *    Solucao: carregamos a lista COMPLETA de cursos e desabilitamos no select
 *    apenas as opcoes inativas que NAO sao a opcao ja escolhida.
 */
@Component({
  selector: 'app-class-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    FormActionsComponent,
    LoadingComponent,
  ],
  templateUrl: './class-form.component.html',
  styleUrl: './class-form.component.scss',
})
export class ClassFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly classService = inject(ClassService);
  private readonly courseService = inject(CourseService);
  private readonly userService = inject(UserService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly id: number | null = this.lerIdDaRota();

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');

  /** Opcoes dos selects. */
  readonly cursos = signal<Course[]>([]);

  /** Professores disponiveis para ser o responsavel da turma. */
  readonly professores = signal<User[]>([]);

  readonly form = this.fb.nonNullable.group(
    {
      courseId: [null as number | null, selecaoValidators()],

      /**
       * PROFESSOR DA TURMA (requisito 7). Opcional: turma sem professor
       * definido e tratada, no escopo de acesso, como pertencente ao
       * responsavel do CURSO dela - entao ela nao fica invisivel.
       */
      teacherId: [null as number | null],

      code: ['', textoValidators(LIMITES.classCode)],
      shift: ['manha' as ClassShift, selecaoValidators()],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      capacity: [null as number | null, numeroValidators(LIMITES.capacity)],
      status: ['ativa' as ClassStatus, selecaoValidators()],
    },
    // Validador de GRUPO: compara os dois campos de data entre si.
    { validators: periodoValidator('startDate', 'endDate') },
  );

  constructor() {
    this.carregarOpcoes();
  }

  get titulo(): string {
    return this.id === null ? 'Nova turma' : 'Editar turma';
  }

  /** O select de responsavel so e oferecido a quem pode atribuir turma. */
  get podeEscolherProfessor(): boolean {
    return !this.acesso.ehProfessor();
  }

  /**
   * true quando quem esta logado e professor e a turma nao e dele.
   *
   * "Ser dele" tem duas formas, e as duas valem: ser o professor DA TURMA ou
   * ser o responsavel do CURSO da turma. A segunda cobre a turma que ficou sem
   * `teacherId` preenchido - do contrario, o professor do curso veria a turma
   * na lista (o escopo a inclui) e levaria um acesso negado ao abri-la.
   */
  private ehTurmaDeOutroProfessor(turma: Class): boolean {
    const teacherId = this.acesso.teacherIdLogado();
    if (teacherId === null) {
      return false;
    }
    if (turma.teacherId === teacherId) {
      return false;
    }
    const curso = this.cursos().find((item) => item.id === turma.courseId);
    return curso?.teacherId !== teacherId;
  }

  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  /**
   * O curso escolhido, como SIGNAL (projeto zoneless): e o que mantem o
   * [disabled] dos options correto depois de uma troca de valor.
   */
  readonly cursoEscolhido = toSignal(this.form.controls.courseId.valueChanges, {
    initialValue: this.form.controls.courseId.value,
  });

  /**
   * Carrega os cursos (e a turma, quando e edicao).
   *
   * O select precisa estar preenchido ANTES de o patchValue rodar: se o valor
   * chegasse primeiro, o mat-select nao encontraria a opcao e mostraria o
   * campo vazio.
   */
  private carregarOpcoes(): void {
    this.carregando.set(true);

    // Lista de professores para o select de responsavel. Falha aqui nao trava
    // o formulario: o campo e opcional.
    this.userService.listarProfessores().subscribe({
      next: (professores) => this.professores.set(professores),
      error: () => this.professores.set([]),
    });

    this.courseService.listarOrdenadoPorNome().subscribe({
      next: (cursos) => {
        this.cursos.set(cursos);

        if (this.id === null) {
          this.carregando.set(false);
          return;
        }

        this.classService.getById(this.id).subscribe({
          next: (turma) => {
            // CONTROLE DE ACESSO POR REGISTRO: o professor edita somente as
            // turmas dele. A rota liberou o PERFIL, nao este registro.
            if (this.ehTurmaDeOutroProfessor(turma)) {
              this.router.navigate(['/sem-acesso'], {
                queryParams: { area: 'classes', acao: 'editar' },
              });
              return;
            }

            this.form.patchValue(turma);

            // O professor nao passa a propria turma para outra pessoa.
            if (this.acesso.ehProfessor()) {
              this.form.controls.teacherId.disable();
            }

            this.carregando.set(false);
          },
          error: () => {
            this.carregando.set(false);
            this.erro.set('Nao foi possivel carregar a turma. Volte para a lista e tente de novo.');
          },
        });
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar a lista de cursos. Verifique a API.');
      },
    });
  }

  /**
   * Grava a turma, depois de conferir o CODIGO DUPLICADO.
   *
   * O codigo e unico (dicionario de dados, colecao `classes`), e a verificacao
   * segue o mesmo padrao do CPF do aluno e do login do usuario: consulta a API
   * antes de salvar, descartando o proprio registro quando esta em edicao.
   *
   * Nao e so rigor de cadastro. O codigo e como a turma aparece em todo o
   * resto do sistema - matriculas, chamada, relatorio. Dois "INF-2026-2" na
   * mesma lista nao dao erro nenhum, e por isso ninguem percebe que matriculou
   * o aluno na turma errada.
   *
   * O periodo (fim >= inicio) nao entra aqui: ja e validado pelo validador de
   * grupo, antes de o formulario ficar valido.
   */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();

    // Maiusculas: "inf-2026-2" e "INF-2026-2" sao a MESMA turma para quem le, e
    // a consulta de duplicata e sensivel a caixa. Normalizar aqui impede a
    // duplicata que passaria pela verificacao so por causa da digitacao.
    const code = valores.code.trim().toUpperCase();

    const turma: Class = {
      courseId: Number(valores.courseId),
      code,
      // Opcional: null no formulario vira ausencia no model, e nao 0.
      ...(valores.teacherId !== null && { teacherId: Number(valores.teacherId) }),
      shift: valores.shift,
      startDate: valores.startDate,
      endDate: valores.endDate,
      capacity: Number(valores.capacity),
      status: valores.status,
    };

    this.erro.set('');
    this.salvando.set(true);

    this.classService.buscarPorCodigo(code).subscribe({
      next: (encontradas) => {
        const outras = encontradas.filter((item) => item.id !== this.id);

        if (outras.length > 0) {
          this.salvando.set(false);
          this.erro.set(
            `Ja existe uma turma com o codigo "${code}". ` +
              `O codigo identifica a turma nas matriculas e na chamada, entao precisa ser unico.`,
          );
          return;
        }

        this.gravar(turma);
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel verificar o codigo da turma na API. Tente de novo.');
      },
    });
  }

  private gravar(turma: Class): void {
    const requisicao =
      this.id === null
        ? this.classService.create(turma)
        : this.classService.update(this.id, { ...turma, id: this.id });

    requisicao.subscribe({
      next: () => this.router.navigate(['/classes']),
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel salvar a turma. Verifique a API e tente de novo.');
      },
    });
  }

  fechar(): void {
    this.router.navigate(['/classes']);
  }

  private lerIdDaRota(): number | null {
    const parametro = this.rota.snapshot.paramMap.get('id');
    return parametro === null ? null : Number(parametro);
  }
}
