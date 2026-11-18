import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';

import {
  Course,
  Enrollment,
  EnrollmentStatus,
  PaymentCondition,
  PaymentMethod,
  Student,
} from '../../../core/models';
import { AcessoService } from '../../../core/services/acesso.service';
import { ClassComRelacoes, ClassService } from '../../../core/services/class.service';
import { CourseService } from '../../../core/services/course.service';
import { EnrollmentService } from '../../../core/services/enrollment.service';
import { FinanceiroService } from '../../../core/services/financeiro.service';
import { StudentService } from '../../../core/services/student.service';
import { mensagemDeErro, selecaoValidators } from '../../../core/validators';
import { FormActionsComponent, LoadingComponent, PageHeaderComponent } from '../../../shared';

/**
 * FORMULARIO DE MATRICULA (cadastrar e editar).
 *
 * ESTA TELA TEM AS DUAS REGRAS DE NEGOCIO MAIS IMPORTANTES DO SISTEMA.
 * As duas sao verificadas na API ANTES de gravar, porque nenhuma delas pode
 * ser decidida apenas com o que esta na tela:
 *
 *   REGRA 6.1 - MATRICULA DUPLICADA
 *   O mesmo aluno nao pode ter duas matriculas na mesma turma.
 *   GET /enrollments?studentId=X&classId=Y  ->  se vier algo, bloqueia.
 *
 *   REGRA 6.2 - CAPACIDADE DA TURMA
 *   Quando as matriculas ATIVAS da turma atingem o capacity, a nova e recusada.
 *   GET /enrollments?classId=Y&status=ativa  ->  compara com turma.capacity.
 *   Matricula cancelada ou concluida NAO ocupa vaga.
 *
 * DOIS DETALHES QUE A EDICAO EXIGE (e que um teste descuidado nao pega)
 * --------------------------------------------------------------------
 *   - na duplicidade, a propria matricula em edicao aparece no resultado:
 *     ela nao e duplicata de si mesma, entao e descartada pelo id;
 *   - na capacidade, se a matricula JA estava ativa naquela turma, ela ja
 *     esta contada entre as ativas - contar de novo recusaria uma edicao
 *     legitima (trocar so a data, por exemplo). Tambem descartamos pelo id.
 *
 * E a capacidade so e cobrada quando o status escolhido e 'ativa': cancelar
 * uma matricula de turma lotada precisa continuar funcionando.
 */
@Component({
  selector: 'app-enrollment-form',
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
  templateUrl: './enrollment-form.component.html',
  styleUrl: './enrollment-form.component.scss',
})
export class EnrollmentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly studentService = inject(StudentService);
  private readonly classService = inject(ClassService);
  private readonly courseService = inject(CourseService);
  private readonly financeiro = inject(FinanceiroService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly id: number | null = this.lerIdDaRota();

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');

  /** Opcoes dos selects. */
  readonly alunos = signal<Student[]>([]);
  readonly turmas = signal<ClassComRelacoes[]>([]);
  readonly cursosPorId = signal<Record<number, Course>>({});

  /**
   * Um aluno usando esta tela esta se matriculando EM SI MESMO.
   *
   * A matriz libera 'criar' em matriculas para o aluno (e como ele entra em um
   * curso novo sem precisar da secretaria), mas nao faria sentido deixa-lo
   * escolher O ALUNO: ele matricularia um colega. Por isso o campo de aluno
   * sai da tela e o id e preenchido pelo sistema.
   */
  readonly ehAluno = this.acesso.ehAluno();

  /** Quem nao pode EDITAR matricula tambem nao escolhe a situacao dela. */
  readonly podeEscolherStatus = this.acesso.podeEditar('enrollments');

  readonly form = this.fb.nonNullable.group({
    studentId: [null as number | null, selecaoValidators()],
    classId: [null as number | null, selecaoValidators()],
    enrollmentDate: [this.hoje(), [Validators.required]],

    // Matricula nova nasce PENDENTE (requisito 5): ela vira 'ativa' quando o
    // administrador confirmar a primeira parcela. Na EDICAO, o valor real do
    // registro sobrescreve este padrao.
    status: ['pendente' as EnrollmentStatus, selecaoValidators()],

    // --- condicao de pagamento (requisito 6) ---
    // So sao usados na CRIACAO: editar uma matricula nao refaz o combinado
    // financeiro dela (regra 11 - nao mexer em contrato ja fechado). Para
    // alterar o financeiro existe a tela de Lancamentos.
    condition: ['avista' as PaymentCondition, [Validators.required]],
    installments: [2, [Validators.required]],
    method: ['pix' as PaymentMethod, [Validators.required]],
  });

  /**
   * O valor do select de turma, como SIGNAL.
   *
   * Por que toSignal e nao um getter: o projeto e zoneless. Um computed() que
   * le this.form.controls.classId.value direto nao teria dependencia nenhuma -
   * ele calcularia uma vez e congelaria. toSignal transforma o valueChanges do
   * campo em signal, e dai o computed abaixo volta a reagir de verdade.
   */
  private readonly classIdSelecionado = toSignal(this.form.controls.classId.valueChanges, {
    initialValue: this.form.controls.classId.value,
  });

  /**
   * A turma escolhida no select, por inteiro.
   * Serve para a tela mostrar a capacidade antes de o usuario salvar.
   */
  readonly turmaEscolhida = computed(() => {
    const classId = this.classIdSelecionado();
    return this.turmas().find((turma) => turma.id === classId) ?? null;
  });

  /** O curso da turma escolhida: e dele que sai o valor e o teto de parcelas. */
  readonly cursoDaTurmaEscolhida = computed(() => {
    const turma = this.turmaEscolhida();
    return turma === null ? null : (this.cursosPorId()[turma.courseId] ?? null);
  });

  /** Valor a cobrar: o preco do curso no momento desta matricula. */
  readonly valorTotal = computed(() => this.cursoDaTurmaEscolhida()?.price ?? 0);

  /** As quantidades de parcela que este curso aceita. */
  readonly opcoesDeParcelas = computed(() =>
    this.financeiro.opcoesDeParcelas(this.cursoDaTurmaEscolhida()),
  );

  private readonly condicaoSelecionada = toSignal(this.form.controls.condition.valueChanges, {
    initialValue: this.form.controls.condition.value,
  });
  private readonly parcelasSelecionadas = toSignal(this.form.controls.installments.valueChanges, {
    initialValue: this.form.controls.installments.value,
  });

  readonly ehParcelado = computed(() => this.condicaoSelecionada() === 'parcelado');

  /**
   * A previa das parcelas, calculada pelo MESMO metodo que vai gravar - assim
   * o que aparece na tela e exatamente o que entra no banco.
   *
   * Vazia na edicao: o financeiro de uma matricula existente nao e refeito
   * aqui, e mostrar uma previa sugeriria que seria.
   */
  readonly previaDasParcelas = computed(() => {
    if (this.id !== null || this.valorTotal() <= 0) {
      return [];
    }
    const quantidade = this.ehParcelado() ? this.parcelasSelecionadas() : 1;
    return this.financeiro.calcularParcelas(this.valorTotal(), quantidade, this.hoje());
  });

  constructor() {
    this.carregarOpcoes();

    // O aluno nao escolhe de quem e a matricula: e dele.
    if (this.ehAluno) {
      const studentId = this.acesso.studentIdLogado();
      this.form.controls.studentId.setValue(studentId);
      this.form.controls.studentId.disable();
    }
  }

  get titulo(): string {
    return this.id === null ? 'Nova matricula' : 'Editar matricula';
  }

  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  get alunoEscolhido(): number | null {
    return this.form.controls.studentId.value;
  }

  get turmaEscolhidaId(): number | null {
    return this.classIdSelecionado();
  }

  /** Nome do curso de uma turma, para o select ficar identificavel. */
  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  nomeDoCurso(turma: ClassComRelacoes): string {
    return this.cursosPorId()[turma.courseId]?.name ?? 'Curso nao encontrado';
  }

  /**
   * Carrega alunos, turmas e cursos; depois, na edicao, a propria matricula.
   *
   * Carregamos as listas COMPLETAS (e nao so ativos) pelo mesmo motivo da tela
   * de turmas: uma matricula antiga pode apontar para um aluno que hoje esta
   * inativo, e a tela precisa continuar mostrando o nome dele. As opcoes
   * invalidas aparecem desabilitadas no select.
   */
  private carregarOpcoes(): void {
    this.carregando.set(true);

    forkJoin({
      alunos: this.studentService.listarOrdenadoPorNome(),
      turmas: this.classService.listarOrdenadoPorCodigo(),
      cursos: this.courseService.list(),
    }).subscribe({
      next: ({ alunos, turmas, cursos }) => {
        this.alunos.set(alunos);
        this.turmas.set(turmas);

        const indice: Record<number, Course> = {};
        for (const curso of cursos) {
          indice[curso.id!] = curso;
        }
        this.cursosPorId.set(indice);

        if (this.id === null) {
          this.preSelecionarTurma(turmas);
          this.carregando.set(false);
          return;
        }

        this.enrollmentService.getById(this.id).subscribe({
          next: (matricula) => {
            this.form.patchValue(matricula);
            this.carregando.set(false);
          },
          error: () => {
            this.carregando.set(false);
            this.erro.set(
              'Nao foi possivel carregar a matricula. Volte para a lista e tente de novo.',
            );
          },
        });
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar alunos e turmas. Verifique a API.');
      },
    });
  }

  /**
   * Vindo da tela "Minha matricula", o aluno ja escolheu a turma no catalogo
   * (?classId=7). Aqui ela chega preenchida - mas so se existir e estiver
   * ativa: um id digitado na URL nao pode escolher turma encerrada.
   */
  private preSelecionarTurma(turmas: ClassComRelacoes[]): void {
    const classId = Number(this.rota.snapshot.queryParamMap.get('classId'));
    if (!classId) {
      return;
    }
    const turma = turmas.find((item) => item.id === classId && item.status === 'ativa');
    if (turma) {
      this.form.controls.classId.setValue(turma.id!);
    }
  }

  /**
   * Grava a matricula, aplicando as regras 6.1 e 6.2.
   *
   * As duas consultas vao em PARALELO (forkJoin) porque sao independentes:
   * uma pergunta "esse aluno ja esta nessa turma?" e a outra "essa turma ainda
   * tem vaga?". Em sequencia, a tela esperaria duas vezes sem necessidade.
   */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const studentId = Number(valores.studentId);
    const classId = Number(valores.classId);

    const turma = this.turmas().find((item) => item.id === classId);
    if (!turma) {
      this.erro.set('Turma nao encontrada. Recarregue a tela e tente de novo.');
      return;
    }

    this.erro.set('');
    this.salvando.set(true);

    forkJoin({
      duplicadas: this.enrollmentService.buscarDuplicada(studentId, classId),
      ativas: this.enrollmentService.listarAtivasPorTurma(classId),
    }).subscribe({
      next: ({ duplicadas, ativas }) => {
        const aluno = this.alunos().find((item) => item.id === studentId);

        // --- REGRA 6.1: matricula duplicada ---------------------------------
        const outras = duplicadas.filter((matricula) => matricula.id !== this.id);
        if (outras.length > 0) {
          this.salvando.set(false);
          this.erro.set(
            `${aluno?.name ?? 'Este aluno'} ja esta matriculado na turma ${turma.code}. ` +
              `O mesmo aluno nao pode ter duas matriculas na mesma turma.`,
          );
          return;
        }

        // --- REGRA 6.2: capacidade da turma ---------------------------------
        // Conta as ativas descartando a propria matricula em edicao, e so
        // cobra o limite quando a matricula vai ficar ATIVA.
        const ocupadas = ativas.filter((matricula) => matricula.id !== this.id).length;

        if (valores.status === 'ativa' && ocupadas >= turma.capacity) {
          this.salvando.set(false);
          this.erro.set(
            `A turma ${turma.code} esta lotada: ${ocupadas} de ${turma.capacity} vagas ` +
              `ocupadas. Aumente a capacidade da turma, cancele uma matricula ou escolha ` +
              `outra turma.`,
          );
          return;
        }

        this.gravar({
          studentId,
          classId,
          enrollmentDate: valores.enrollmentDate,
          status: valores.status,
        });
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel verificar as regras da matricula na API. Tente de novo.');
      },
    });
  }

  /**
   * Grava a matricula e, quando ela e NOVA, o financeiro dela.
   *
   * POR QUE O FINANCEIRO SO ENTRA NA CRIACAO
   * ----------------------------------------
   * Porque o lancamento e o COMBINADO daquela matricula, e combinado nao se
   * refaz por edicao de cadastro (regra 11: "a alteracao de valores de cursos
   * nao deve modificar indevidamente contratos ou matriculas ja existentes").
   * Corrigir valor, parcela ou vencimento e assunto da tela de Lancamentos,
   * que faz isso de forma explicita e rastreavel.
   *
   * Editar uma matricula, portanto, grava UMA coisa; criar grava duas, em
   * cadeia - e, se a segunda falhar, a primeira e desfeita.
   */
  private gravar(matricula: Enrollment): void {
    if (this.id !== null) {
      this.enrollmentService.update(this.id, { ...matricula, id: this.id }).subscribe({
        next: () => this.router.navigate(['/enrollments']),
        error: () => {
          this.salvando.set(false);
          this.erro.set('Nao foi possivel salvar a matricula. Verifique a API e tente de novo.');
        },
      });
      return;
    }

    this.enrollmentService
      .create(matricula)
      .pipe(switchMap((criada) => this.criarFinanceiroPara(criada)))
      .subscribe({
        next: () => {
          // O escopo do aluno e montado a partir das matriculas dele; a que
          // acabou de nascer nao esta no cache, e sem invalidar a tela de
          // mensalidades filtraria para fora as parcelas recem-criadas.
          this.acesso.invalidarEscopo();
          this.router.navigate(['/enrollments']);
        },
        error: () => {
          this.salvando.set(false);
          this.erro.set(
            'Nao foi possivel criar a matricula com o financeiro dela. Nada foi gravado. ' +
              'Verifique a API e tente de novo.',
          );
        },
      });
  }

  /**
   * Cria o lancamento financeiro da matricula recem-criada (requisito 6.5).
   *
   * Se o lancamento falhar, a MATRICULA e apagada: matricula sem financeiro e
   * um aluno que a escola nunca vai cobrar, e esse e um erro silencioso - ele
   * so apareceria no fechamento do mes. Melhor nao ter a matricula e a pessoa
   * tentar de novo.
   */
  private criarFinanceiroPara(matricula: Enrollment): Observable<unknown> {
    const valores = this.form.getRawValue();
    const condicao = valores.condition;

    return this.financeiro
      .criarLancamento(
        matricula.id!,
        // O valor sai do CURSO da turma escolhida, e nao de um campo digitado.
        this.valorTotal(),
        {
          condition: condicao,
          installments: condicao === 'parcelado' ? valores.installments : 1,
          method: valores.method,
        },
        matricula.enrollmentDate,
      )
      .pipe(
        catchError((falhaOriginal: unknown) =>
          this.enrollmentService.delete(matricula.id!).pipe(
            catchError(() => of(null)),
            switchMap(() => throwError(() => falhaOriginal)),
          ),
        ),
        map(() => matricula),
      );
  }

  fechar(): void {
    this.router.navigate(['/enrollments']);
  }

  /** Data de hoje em 'aaaa-mm-dd', que e o valor inicial da matricula. */
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
