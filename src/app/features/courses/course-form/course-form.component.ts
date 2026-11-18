import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';

import { Course, User } from '../../../core/models';
import { AcessoService } from '../../../core/services/acesso.service';
import { CourseService } from '../../../core/services/course.service';
import { UserService } from '../../../core/services/user.service';
import {
  LIMITES,
  mensagemDeErro,
  numeroValidators,
  textoValidators,
} from '../../../core/validators';
import { FormActionsComponent, LoadingComponent, PageHeaderComponent } from '../../../shared';

/**
 * FORMULARIO DE CURSO (cadastrar e editar na mesma tela).
 *
 * ESTE ARQUIVO E O MOLDE DOS OUTROS OITO FORMULARIOS. A estrutura e sempre:
 *
 *   1. form          -> FormGroup com os validadores vindos de core/validators
 *   2. id            -> lido da rota; null = cadastro novo, numero = edicao
 *   3. carregar()    -> so na edicao: busca o registro e preenche o form
 *   4. salvar()      -> valida, aplica a regra de negocio, grava, volta
 *
 * UMA TELA PARA DUAS ACOES
 * ------------------------
 * /courses/new  e  /courses/:id/edit  abrem o MESMO componente. A unica
 * diferenca e o parametro :id na rota. Duas telas quase iguais seriam dois
 * lugares para corrigir o mesmo bug.
 *
 * DE ONDE VEM CADA VALIDACAO
 * --------------------------
 * Nenhum numero de limite esta escrito aqui: todos vem da tabela LIMITES
 * (core/validators/texto.validator.ts). Se o limite do nome mudar, muda la e
 * as nove telas acompanham, inclusive a frase do erro.
 */
@Component({
  selector: 'app-course-form',
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
  templateUrl: './course-form.component.html',
  styleUrl: './course-form.component.scss',
})
export class CourseFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly courseService = inject(CourseService);
  private readonly userService = inject(UserService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  /** id do curso em edicao. null quando e cadastro novo. */
  readonly id: number | null = this.lerIdDaRota();

  /** true enquanto busca o registro da edicao. */
  readonly carregando = signal(false);

  /** true enquanto o POST/PUT esta em andamento. */
  readonly salvando = signal(false);

  /** Erro de API ou de regra de negocio, mostrado no topo do formulario. */
  readonly erro = signal('');

  /**
   * O formulario.
   *
   * price usa numeroValidators(LIMITES.price), que exige >= 0: curso gratuito
   * e permitido, negativo nao. workload exige de 1 a 2000 horas.
   */
  /** Professores disponiveis para ser o responsavel do curso. */
  readonly professores = signal<User[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', textoValidators(LIMITES.courseName)],
    description: ['', textoValidators(LIMITES.description)],
    workload: [null as number | null, numeroValidators(LIMITES.workload)],
    price: [null as number | null, numeroValidators(LIMITES.price)],

    /**
     * PROFESSOR RESPONSAVEL. Opcional: a escola pode cadastrar o curso antes de
     * definir quem vai ministra-lo. Curso sem responsavel simplesmente nao
     * aparece no painel de nenhum professor.
     */
    teacherId: [null as number | null],

    /**
     * Teto de parcelas deste curso (requisito 6.2). Nasce em 10 (o maximo que
     * a escola oferece) para um curso novo nao ficar, sem ninguem perceber,
     * mais restrito do que a escola pretende.
     */
    maxInstallments: [10 as number, numeroValidators(LIMITES.installments)],

    active: [true],
  });

  constructor() {
    this.carregarProfessores();

    if (this.id !== null) {
      this.carregar(this.id);
    }
  }

  /**
   * Carrega a lista de professores para o select de responsavel.
   *
   * Falha de rede aqui NAO trava o formulario: o select fica vazio e o curso
   * pode ser salvo sem responsavel, que e um estado valido. Travar o cadastro
   * inteiro por causa de um campo opcional seria desproporcional.
   */
  private carregarProfessores(): void {
    this.userService.listarProfessores().subscribe({
      next: (professores) => this.professores.set(professores),
      error: () => this.professores.set([]),
    });
  }

  /** Titulo da tela: muda entre cadastro e edicao. */
  get titulo(): string {
    return this.id === null ? 'Novo curso' : 'Editar curso';
  }

  /** Traduz o erro do campo para a frase que o usuario le. */
  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  /** Busca o curso e preenche o formulario (somente na edicao). */
  private carregar(id: number): void {
    this.carregando.set(true);

    this.courseService.getById(id).subscribe({
      next: (curso) => {
        // CONTROLE DE ACESSO POR REGISTRO: a rota garantiu que o PERFIL pode
        // editar curso, nao que ele pode editar ESTE curso. O professor edita
        // somente os cursos de que e responsavel - sem esta checagem, bastaria
        // trocar o id na URL para editar o curso de um colega.
        if (this.ehCursoDeOutroProfessor(curso)) {
          this.router.navigate(['/sem-acesso'], {
            queryParams: { area: 'courses', acao: 'editar' },
          });
          return;
        }

        // patchValue preenche os campos que existem no formulario e ignora o id.
        this.form.patchValue(curso);

        // O professor nao troca o responsavel do proprio curso: isso seria
        // passar o curso para outra pessoa (ou tirar de si) - decisao da
        // administracao, nao de quem da a aula.
        if (this.acesso.ehProfessor()) {
          this.form.controls.teacherId.disable();
        }

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar o curso. Volte para a lista e tente de novo.');
      },
    });
  }

  /**
   * Grava o curso.
   *
   * Cursos nao tem regra de duplicidade no contrato (dois cursos podem ter o
   * mesmo nome, ex. duas edicoes), entao aqui so ha validacao de formulario.
   * Os modulos que tem regra (aluno, usuario, turma, matricula, frequencia)
   * fazem a consulta de verificacao entre este ponto e a gravacao.
   */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();

    // O formulario trabalha com number | null (campo vazio = null); o model
    // exige number. Como o form esta valido, os dois ja estao preenchidos.
    const curso: Course = {
      name: valores.name.trim(),
      description: valores.description.trim(),
      workload: Number(valores.workload),
      price: Number(valores.price),
      maxInstallments: Number(valores.maxInstallments),
      active: valores.active,
      // Campo opcional: null no formulario vira ausencia no model, e nao 0 -
      // um teacherId 0 apontaria para um usuario que nao existe.
      ...(valores.teacherId !== null && { teacherId: Number(valores.teacherId) }),
    };

    this.erro.set('');
    this.salvando.set(true);

    // Cadastro novo usa POST (create); edicao usa PUT (update) com o id.
    const requisicao =
      this.id === null
        ? this.courseService.create(curso)
        : this.courseService.update(this.id, { ...curso, id: this.id });

    requisicao.subscribe({
      next: () => this.router.navigate(['/courses']),
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel salvar o curso. Verifique a API e tente de novo.');
      },
    });
  }

  /** Cancela e volta para a listagem. */
  /** true quando quem esta logado e professor e o curso NAO e dele. */
  private ehCursoDeOutroProfessor(curso: Course): boolean {
    const teacherId = this.acesso.teacherIdLogado();
    return teacherId !== null && curso.teacherId !== teacherId;
  }

  /** O select de responsavel so e oferecido a quem pode atribuir curso. */
  get podeEscolherProfessor(): boolean {
    return !this.acesso.ehProfessor();
  }

  fechar(): void {
    this.router.navigate(['/courses']);
  }

  /**
   * Le o :id da rota.
   *
   * snapshot serve porque o componente e recriado quando a rota muda; nao
   * precisamos observar mudanca de parametro na mesma instancia.
   */
  private lerIdDaRota(): number | null {
    const parametro = this.rota.snapshot.paramMap.get('id');
    return parametro === null ? null : Number(parametro);
  }
}
