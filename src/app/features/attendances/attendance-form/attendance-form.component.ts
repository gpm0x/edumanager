import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Attendance, Class, Student } from '../../../core/models';
import { AcessoService, EscopoDeDados } from '../../../core/services/acesso.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { ClassService } from '../../../core/services/class.service';
import { EnrollmentService } from '../../../core/services/enrollment.service';
import { mensagemDeErro, selecaoValidators } from '../../../core/validators';
import { FormActionsComponent, LoadingComponent, PageHeaderComponent } from '../../../shared';

/**
 * FORMULARIO DE FREQUENCIA (cadastrar e editar).
 *
 * REGRA 6.4 - O SELECT DE ALUNO DEPENDE DA TURMA
 * ----------------------------------------------
 * Esta e a unica tela do sistema com SELECT EM CASCATA: escolher a turma troca
 * a lista de alunos. E o select de aluno traz SOMENTE quem esta matriculado
 * naquela turma (GET /enrollments?classId=Y&_expand=student).
 *
 * Por que isso importa: listando todos os alunos da instituicao, daria para
 * registrar presenca de alguem que nem e da turma - um dado invalido que
 * nenhuma validacao de formulario pegaria depois.
 *
 * REGRA 6.5 - PRESENCA DUPLICADA
 * ------------------------------
 * A trinca turma + aluno + data e unica. Antes de gravar consultamos
 * GET /attendances?classId=X&studentId=Y&date=Z; se vier registro, bloqueamos
 * e avisamos para EDITAR o lancamento existente em vez de criar outro.
 */
@Component({
  selector: 'app-attendance-form',
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
  templateUrl: './attendance-form.component.html',
  styleUrl: './attendance-form.component.scss',
})
export class AttendanceFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly attendanceService = inject(AttendanceService);
  private readonly classService = inject(ClassService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  /**
   * O escopo de acesso, guardado para a conferencia da edicao.
   *
   * Esta tela e a UNICA do sistema em que um perfil restrito grava dado, e por
   * isso e a unica que precisa conferir a propriedade do REGISTRO, e nao
   * apenas da area. Ver conferirPropriedade(), abaixo.
   */
  private escopo: EscopoDeDados | null = null;

  readonly id: number | null = this.lerIdDaRota();

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');

  /** Opcoes dos selects. Os alunos mudam conforme a turma escolhida. */
  readonly turmas = signal<Class[]>([]);
  readonly alunosDaTurma = signal<Student[]>([]);
  readonly carregandoAlunos = signal(false);

  readonly form = this.fb.nonNullable.group({
    classId: [null as number | null, selecaoValidators()],
    // Comeca DESABILITADO: sem turma escolhida nao existe aluno para listar.
    // Quem habilita e carregarAlunosDaTurma(), nunca o template - usar
    // [disabled] no HTML junto de formControlName e erro em Reactive Forms.
    studentId: this.fb.nonNullable.control(
      { value: null as number | null, disabled: true },
      selecaoValidators(),
    ),
    date: [this.hoje(), [Validators.required]],
    present: [true, [Validators.required]],
  });

  constructor() {
    // Select em cascata: a turma manda na lista de alunos (regra 6.4).
    this.form.controls.classId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((classId) => this.carregarAlunosDaTurma(classId));

    this.carregarTurmas();
  }

  get titulo(): string {
    return this.id === null ? 'Novo registro de frequencia' : 'Editar registro de frequencia';
  }

  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  /**
   * A turma escolhida, como SIGNAL. O projeto e zoneless, entao o que o
   * template le precisa ser signal para a dica do campo de aluno acompanhar a
   * troca de turma.
   */
  readonly turmaEscolhida = toSignal(this.form.controls.classId.valueChanges, {
    initialValue: this.form.controls.classId.value,
  });

  private carregarTurmas(): void {
    this.carregando.set(true);

    forkJoin({
      escopo: this.acesso.escopo(),
      turmas: this.classService.listarOrdenadoPorCodigo(),
    }).subscribe({
      next: ({ escopo, turmas }) => {
        this.escopo = escopo;

        // O SELECT DE TURMA sai filtrado pelo escopo: hoje so o administrador
        // lanca chamada, e o escopo dele e irrestrito - o filtro continua aqui
        // porque e a matriz de permissoes que decide isso, nao esta tela
        // nas turmas dos cursos dele. Se a turma nem aparece como opcao, nao
        // ha como ele criar um registro fora do alcance pelo caminho normal.
        this.turmas.set(this.acesso.filtrarTurmas(escopo, turmas));

        if (this.id === null) {
          this.carregando.set(false);
          return;
        }

        this.attendanceService.getById(this.id).subscribe({
          next: (registro) => {
            // ...e o caminho ANORMAL (URL digitada a mao) e fechado aqui.
            if (!this.conferirPropriedade(registro)) {
              return;
            }

            // Preenche a turma primeiro: o valueChanges ja dispara a busca dos
            // alunos daquela turma antes de o studentId ser aplicado.
            this.form.controls.classId.setValue(registro.classId);
            this.form.patchValue({
              studentId: registro.studentId,
              date: registro.date,
              present: registro.present,
            });
            this.carregando.set(false);
          },
          error: () => {
            this.carregando.set(false);
            this.erro.set(
              'Nao foi possivel carregar o registro. Volte para a lista e tente de novo.',
            );
          },
        });
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar as turmas. Verifique a API.');
      },
    });
  }

  /**
   * Confere se o REGISTRO aberto para edicao pertence ao alcance do usuario.
   *
   * POR QUE O GUARD DE ROTA NAO BASTA AQUI
   * --------------------------------------
   * O permissaoGuard responde "este perfil pode editar frequencia?" - e para o
   * professor a resposta e sim. O que ele NAO sabe responder e "esta frequencia
   * especifica e de uma turma dele?", porque isso depende de buscar o registro
   * na API, e guard de rota deve ser rapido e sincrono.
   *
   * Sem esta conferencia, um professor que digitasse /attendances/18/edit
   * abriria e alteraria a chamada de uma turma de outro professor. E o unico
   * ponto do sistema onde isso seria possivel, justamente porque e o unico
   * lugar em que um perfil restrito grava.
   *
   * @returns true quando pode seguir; false quando ja redirecionou.
   */
  private conferirPropriedade(registro: Attendance): boolean {
    if (
      this.escopo === null ||
      this.escopo.irrestrito ||
      this.escopo.turmas.has(registro.classId)
    ) {
      return true;
    }

    this.carregando.set(false);
    this.router.navigate(['/sem-acesso'], {
      queryParams: { area: 'attendances', acao: 'editar' },
    });
    return false;
  }

  /**
   * REGRA 6.4 - busca os alunos MATRICULADOS na turma escolhida.
   *
   * A matricula e o caminho: pedimos as matriculas da turma com o aluno
   * embutido e extraimos os alunos. Matricula cancelada e descartada - quem
   * saiu da turma nao deve receber chamada.
   */
  private carregarAlunosDaTurma(classId: number | null): void {
    const campoAluno = this.form.controls.studentId;

    if (classId === null) {
      this.alunosDaTurma.set([]);
      campoAluno.disable();
      return;
    }

    campoAluno.enable();

    this.carregandoAlunos.set(true);

    this.enrollmentService.listarPorTurmaComAluno(classId).subscribe({
      next: (matriculas) => {
        const alunos = matriculas
          .filter((matricula) => matricula.status !== 'cancelada')
          .map((matricula) => matricula.student)
          .filter((aluno): aluno is Student => aluno !== undefined)
          .sort((a, b) => a.name.localeCompare(b.name));

        this.alunosDaTurma.set(alunos);
        this.carregandoAlunos.set(false);

        // Trocou de turma e o aluno escolhido nao esta na nova? Limpa o campo.
        const escolhido = campoAluno.value;
        if (escolhido !== null && !alunos.some((aluno) => aluno.id === escolhido)) {
          campoAluno.setValue(null);
        }
      },
      error: () => {
        this.carregandoAlunos.set(false);
        this.erro.set('Nao foi possivel carregar os alunos da turma. Tente de novo.');
      },
    });
  }

  /** REGRA 6.5 (presenca duplicada) e depois a gravacao. */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const classId = Number(valores.classId);
    const studentId = Number(valores.studentId);

    this.erro.set('');
    this.salvando.set(true);

    this.attendanceService.buscarDuplicada(classId, studentId, valores.date).subscribe({
      next: (encontrados) => {
        // Na edicao, o proprio registro aparece: ele nao e duplicata de si mesmo.
        const outros = encontrados.filter((registro) => registro.id !== this.id);

        if (outros.length > 0) {
          const aluno = this.alunosDaTurma().find((item) => item.id === studentId);
          this.salvando.set(false);
          this.erro.set(
            `Ja existe lancamento de ${aluno?.name ?? 'este aluno'} nesta turma em ` +
              `${this.formatarData(valores.date)}. Edite o lancamento existente em vez de ` +
              `criar outro.`,
          );
          return;
        }

        this.gravar({
          classId,
          // O curso e pedido pelo requisito 8 e nao e digitado: ele e lido da
          // TURMA escolhida, porque e a turma que sabe de que curso ela e.
          // Turma nao encontrada na lista (caso de dado inconsistente) grava o
          // registro sem o curso, em vez de recusar a chamada por causa de um
          // campo derivado.
          courseId: this.turmas().find((turma) => turma.id === classId)?.courseId,
          studentId,
          date: valores.date,
          present: valores.present,
        });
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel verificar lancamento duplicado. Tente de novo.');
      },
    });
  }

  private gravar(registro: Attendance): void {
    const requisicao =
      this.id === null
        ? this.attendanceService.create(registro)
        : this.attendanceService.update(this.id, { ...registro, id: this.id });

    requisicao.subscribe({
      next: () => this.router.navigate(['/attendances']),
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel salvar o registro. Verifique a API e tente de novo.');
      },
    });
  }

  fechar(): void {
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

  private lerIdDaRota(): number | null {
    const parametro = this.rota.snapshot.paramMap.get('id');
    return parametro === null ? null : Number(parametro);
  }
}
