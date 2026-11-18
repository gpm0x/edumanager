import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';

import {
  Class,
  ClassShift,
  Course,
  Enrollment,
  PaymentCondition,
  PaymentMethod,
  Student,
  User,
} from '../../../core/models';
import { AcessoService } from '../../../core/services/acesso.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClassService } from '../../../core/services/class.service';
import { CourseService } from '../../../core/services/course.service';
import { EnrollmentService } from '../../../core/services/enrollment.service';
import { FinanceiroService } from '../../../core/services/financeiro.service';
import { StudentService } from '../../../core/services/student.service';
import { UserService } from '../../../core/services/user.service';
import {
  LIMITES,
  confirmacaoValidator,
  cpfValidator,
  dataNaoFuturaValidator,
  emailValidators,
  limparCpf,
  mensagemDeErro,
  senhaForteValidator,
  textoOpcionalValidators,
  textoValidators,
} from '../../../core/validators';

/** Rotulo do turno, igual ao da tela de Turmas. */
const TURNOS: Record<ClassShift, string> = {
  manha: 'Manha',
  tarde: 'Tarde',
  noite: 'Noite',
};

/** Uma turma que ainda aceita matricula, com as vagas ja calculadas. */
export interface TurmaComVaga {
  turma: Class;
  vagas: number;
}

/**
 * Um curso oferecido no autocadastro, com as turmas dele que tem vaga.
 *
 * O catalogo so contem curso que PODE receber matricula. Oferecer um curso sem
 * turma aberta seria uma escolha que nao leva a nada: a pessoa seleciona,
 * envia, e o sistema teria de recusar depois - o que e pior do que nao ter
 * oferecido.
 */
export interface CursoComTurmas {
  curso: Course;
  turmas: TurmaComVaga[];
}

/**
 * TELA DE CRIAR CONTA (autocadastro do aluno).
 *
 * O QUE ESTA TELA CRIA
 * --------------------
 * TRES registros, e nao um:
 *
 *   1. um aluno    em /students    -> o cadastro academico da pessoa
 *   2. um usuario  em /users       -> a credencial de acesso, com role 'aluno' e
 *                                     studentId apontando para o aluno criado
 *   3. uma matricula em /enrollments -> na turma do curso que a pessoa escolheu
 *
 * A MATRICULA APONTA PARA TURMA, NAO PARA CURSO
 * ---------------------------------------------
 * A pessoa escolhe o CURSO (e o que ela quer fazer), mas uma matricula existe
 * numa TURMA: e a turma que tem turno, periodo e capacidade. Por isso a tela
 * pede os dois - curso primeiro, e as turmas abertas dele aparecem em seguida.
 * Quando o curso tem uma unica turma aberta (o caso de todos hoje), ela ja vem
 * selecionada: nao se pede escolha onde nao existe alternativa.
 *
 * Depois, em "Minhas matriculas", a tela mostra o curso percorrendo o caminho
 * de volta: matricula -> turma -> courseId -> nome do curso.
 *
 * Sao duas coisas diferentes no sistema (ver a explicacao em
 * core/models/user.model.ts): aluno e um CADASTRO, usuario e uma CREDENCIAL.
 * O autocadastro cria os dois de uma vez porque a pessoa que se inscreve e, ao
 * mesmo tempo, o aluno e o dono da conta.
 *
 * Quem se cadastra aqui entra com perfil 'aluno' e, por causa da restricao de
 * acesso (core/services/acesso.service.ts), ve somente as PROPRIAS matriculas,
 * mensalidades e frequencia. Conta de ADMINISTRADOR nao pode ser criada por
 * esta tela - ela e dada por quem ja e administrador, na tela de Usuarios.
 *
 * AS QUATRO VALIDACOES QUE O REQUISITO PEDE
 * -----------------------------------------
 *   CPF     -> digitos verificadores de verdade (cpfValidator) E unico em /students
 *   e-mail  -> formato valido (Validators.email) E unico em /users
 *   senha   -> de 6 a 20 caracteres, com pelo menos uma letra e um numero,
 *              e digitada duas vezes (confirmacao)
 *   login   -> de 4 a 20 caracteres e unico em /users
 *
 * As tres checagens de "ja existe" NAO cabem num validador do Angular: elas
 * dependem de consultar a API. Entao rodam no salvar(), em paralelo, e o
 * resultado e marcado NO CAMPO correspondente - a mensagem aparece embaixo do
 * campo errado, igual a qualquer outro erro de formulario.
 *
 * SEM TRANSACAO: O QUE ACONTECE SE UMA DAS GRAVACOES FALHAR
 * ---------------------------------------------------------
 * O JSON Server nao tem transacao. Se o aluno for criado e o usuario falhar, a
 * pessoa ficaria cadastrada como aluno mas sem conseguir entrar - e, pior,
 * tentar de novo bateria em "CPF ja cadastrado", prendendo a pessoa de fora do
 * sistema para sempre. Entao desfazemos, na ordem inversa da criacao:
 *
 *   usuario falhou   -> apaga o aluno
 *   matricula falhou -> apaga o usuario e o aluno
 *
 * O principio e o mesmo das duas gravacoes anteriores: ou a pessoa sai daqui
 * com tudo, ou sai sem nada. Meio cadastro e o unico resultado inaceitavel.
 *
 * QUANDO NAO HA CURSO COM VAGA
 * ----------------------------
 * Se o administrador nao tiver nenhum curso com turma aberta, a escolha
 * desaparece da tela e a conta e criada sem matricula, com um aviso para
 * procurar a administracao. O autocadastro nao pode parar de funcionar por causa
 * do estado do catalogo.
 */
@Component({
  selector: 'app-criar-conta',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './criar-conta.component.html',
  styleUrl: './criar-conta.component.scss',
})
export class CriarContaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly studentService = inject(StudentService);
  private readonly courseService = inject(CourseService);
  private readonly classService = inject(ClassService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly financeiro = inject(FinanceiroService);
  private readonly auth = inject(AuthService);
  private readonly acesso = inject(AcessoService);
  private readonly router = inject(Router);

  /** Erro geral (API fora do ar). Erro de campo aparece no proprio campo. */
  readonly erro = signal('');

  /** true enquanto as consultas e as gravacoes estao em andamento. */
  readonly salvando = signal(false);

  /** Olhinho de mostrar/ocultar a senha. */
  readonly senhaVisivel = signal(false);

  /**
   * O formulario.
   *
   * O validador de grupo confirmacaoValidator compara os dois campos de senha -
   * comparacao entre campos nao cabe num validador de campo, que so conhece o
   * proprio valor.
   */
  readonly form = this.fb.nonNullable.group(
    {
      // --- quem a pessoa e ---
      name: ['', textoValidators(LIMITES.name)],
      cpf: ['', [Validators.required, cpfValidator]],
      birthDate: ['', [Validators.required, dataNaoFuturaValidator]],
      phone: ['', textoOpcionalValidators(LIMITES.phone)],

      // --- o que ela vai fazer ---
      // Os dois sao obrigatorios, e deixam de ser quando nao existe curso com
      // vaga (ver aplicarRegraDoCatalogo).
      courseId: [null as number | null, [Validators.required]],
      classId: [null as number | null, [Validators.required]],

      // --- como ela vai pagar (requisito 6) ---
      // Os tres nascem preenchidos, e nao vazios: a vista no PIX e a escolha
      // mais comum, e um formulario de cadastro nao deve pedir decisao onde
      // existe um padrao razoavel. Quem quiser parcelar troca em dois cliques.
      condition: ['avista' as PaymentCondition, [Validators.required]],
      installments: [2, [Validators.required]],
      method: ['pix' as PaymentMethod, [Validators.required]],

      // --- como ela entra ---
      email: ['', emailValidators()],
      login: ['', textoValidators(LIMITES.login)],
      password: ['', [...textoValidators(LIMITES.password), senhaForteValidator]],
      confirmarSenha: ['', [Validators.required]],
    },
    { validators: [confirmacaoValidator('password', 'confirmarSenha')] },
  );

  /** Os cursos que podem receber matricula agora. Vazio = nenhum. */
  readonly catalogo = signal<CursoComTurmas[]>([]);

  /** true enquanto o catalogo esta sendo carregado da API. */
  readonly carregandoCursos = signal(true);

  /** O curso escolhido no select, acompanhado como signal. */
  private readonly courseIdEscolhido = signal<number | null>(null);

  /** A turma escolhida no select, acompanhada como signal. */
  private readonly classIdEscolhido = signal<number | null>(null);

  /** O curso escolhido por inteiro, ou null. */
  readonly cursoEscolhido = computed(() => {
    const id = this.courseIdEscolhido();
    return this.catalogo().find((item) => item.curso.id === id) ?? null;
  });

  /** As turmas com vaga do curso escolhido. Vazio enquanto nao escolheu. */
  readonly turmasDoCurso = computed(() => this.cursoEscolhido()?.turmas ?? []);

  /** A turma escolhida por inteiro, para a tela mostrar periodo e vagas. */
  readonly turmaEscolhida = computed(() => {
    const classId = this.classIdEscolhido();
    return this.turmasDoCurso().find((item) => item.turma.id === classId) ?? null;
  });

  /**
   * true quando o administrador nao deixou nenhum curso com turma aberta.
   * Nesse caso a escolha sai da tela e a conta e criada sem matricula.
   */
  // --- Sinais e calculos da condicao de pagamento --------------------------
  // Eles acompanham o formulario para a PREVIA das parcelas aparecer enquanto
  // a pessoa escolhe - ver o valor da parcela antes de decidir e a diferenca
  // entre escolher e adivinhar.
  private readonly condicaoEscolhida = signal<PaymentCondition>('avista');
  private readonly parcelasEscolhidas = signal(2);

  /** As quantidades de parcela que ESTE curso aceita (Course.maxInstallments). */
  readonly opcoesDeParcelas = computed(() =>
    this.financeiro.opcoesDeParcelas(this.cursoEscolhido()?.curso),
  );

  readonly ehParcelado = computed(() => this.condicaoEscolhida() === 'parcelado');

  /** Valor total do curso escolhido (0 quando nenhum curso foi escolhido ainda). */
  readonly valorTotal = computed(() => this.cursoEscolhido()?.curso.price ?? 0);

  /**
   * A previa das parcelas, calculada pelo MESMO metodo que vai gravar.
   *
   * Isso e proposital: se a tela calculasse a previa com uma conta propria,
   * poderia mostrar 3x de R$ 333,33 e gravar outra coisa. Chamando o
   * FinanceiroService, o que a pessoa ve na tela e exatamente o que entra no
   * banco - incluindo a sobra de centavo na ultima parcela.
   */
  readonly previaDasParcelas = computed(() => {
    const total = this.valorTotal();
    if (total <= 0) {
      return [];
    }
    const quantidade = this.ehParcelado() ? this.parcelasEscolhidas() : 1;
    return this.financeiro.calcularParcelas(total, quantidade, this.financeiro.hoje());
  });

  readonly semCursoDisponivel = computed(
    () => !this.carregandoCursos() && this.catalogo().length === 0,
  );

  constructor() {
    this.carregarCatalogo();

    // Trocar de curso zera a turma: a turma anterior pertence a outro curso, e
    // deixa-la selecionada criaria a matricula no lugar errado sem a pessoa
    // perceber. Quando o curso novo tem uma unica turma, ela ja entra escolhida
    // - nao se pede escolha onde nao existe alternativa.
    this.form.controls.courseId.valueChanges.pipe(takeUntilDestroyed()).subscribe((courseId) => {
      this.courseIdEscolhido.set(courseId);

      const turmas = this.turmasDoCurso();
      this.form.controls.classId.setValue(turmas.length === 1 ? turmas[0].turma.id! : null);
    });

    this.form.controls.classId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((classId) => this.classIdEscolhido.set(classId));

    // Os tres sinais abaixo so espelham o formulario nos signals, para os
    // computed de previa reagirem. A fonte da verdade continua sendo o form.
    this.form.controls.condition.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((condicao) => this.condicaoEscolhida.set(condicao));

    this.form.controls.installments.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((parcelas) => this.parcelasEscolhidas.set(parcelas));

    // Trocar de curso pode invalidar a quantidade de parcelas: quem escolheu
    // 10x em um curso de teto 10 e depois trocou para um curso de teto 3
    // ficaria com uma opcao que a escola nao aceita naquele curso. Ao trocar,
    // a quantidade volta para a primeira opcao valida do curso novo.
    this.form.controls.courseId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const opcoes = this.opcoesDeParcelas();
      const atual = this.form.controls.installments.value;
      if (!opcoes.includes(atual)) {
        this.form.controls.installments.setValue(opcoes[0] ?? 2);
      }
    });
  }

  /** Mostra ou esconde a senha digitada. */
  alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  /** Rotulo do turno de uma turma ('manha' -> 'Manha'). */
  turno(turma: Class): string {
    return TURNOS[turma.shift];
  }

  /** Preco do curso em reais, como nas telas de Cursos e Financeiro. */
  formatarPreco(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Data 'aaaa-mm-dd' no formato que o usuario le. */
  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Monta o catalogo de cursos que podem receber matricula.
   *
   * Sao tres consultas, e as tres sao necessarias: o curso diz o que existe, a
   * turma diz quando e com qual capacidade, e as matriculas ativas dizem quanto
   * dessa capacidade ja foi usada. Sem a terceira, a tela ofereceria turma
   * lotada - e a recusa viria depois de a pessoa preencher o cadastro inteiro.
   *
   * Pedimos apenas as matriculas ATIVAS: cancelada e concluida nao ocupam vaga,
   * e e assim que o formulario do administrador conta (regra 6.2).
   */
  private carregarCatalogo(): void {
    this.carregandoCursos.set(true);

    forkJoin({
      cursos: this.courseService.listarAtivos(),
      turmas: this.classService.listarAtivas(),
      matriculas: this.enrollmentService.listarAtivas(),
    }).subscribe({
      next: ({ cursos, turmas, matriculas }) => {
        this.catalogo.set(this.montarCatalogo(cursos, turmas, matriculas));
        this.carregandoCursos.set(false);
        this.aplicarRegraDoCatalogo();
      },
      error: () => {
        // Sem catalogo, a tela NAO trava: ela vira o cadastro sem matricula.
        // Travar aqui impediria a pessoa de criar conta por causa de uma
        // consulta que nem e sobre os dados dela.
        this.carregandoCursos.set(false);
        this.catalogo.set([]);
        this.aplicarRegraDoCatalogo();
      },
    });
  }

  /**
   * Cruza cursos, turmas e matriculas ativas em "curso -> turmas com vaga".
   *
   * E funcao pura de proposito (recebe tudo, nao le estado nem chama API): e a
   * parte com regra de verdade - contar vaga e descartar curso vazio - e assim
   * ela pode ser lida e conferida sozinha.
   */
  private montarCatalogo(
    cursos: Course[],
    turmas: Class[],
    matriculas: Enrollment[],
  ): CursoComTurmas[] {
    // Quantas matriculas ativas cada turma ja tem.
    const ocupadas = new Map<number, number>();
    for (const matricula of matriculas) {
      ocupadas.set(matricula.classId, (ocupadas.get(matricula.classId) ?? 0) + 1);
    }

    return (
      cursos
        .map((curso) => ({
          curso,
          turmas: turmas
            .filter((turma) => turma.courseId === curso.id)
            .map((turma) => ({ turma, vagas: turma.capacity - (ocupadas.get(turma.id!) ?? 0) }))
            .filter((item) => item.vagas > 0),
        }))
        // Curso sem turma com vaga sai do catalogo: escolher nao levaria a nada.
        .filter((item) => item.turmas.length > 0)
        .sort((a, b) => a.curso.name.localeCompare(b.curso.name))
    );
  }

  /**
   * Liga ou desliga a obrigatoriedade da escolha de curso.
   *
   * Sem curso disponivel os dois campos saem da tela E perdem o
   * Validators.required - se ficassem obrigatorios e invisiveis, o formulario
   * nunca ficaria valido e o botao "Criar minha conta" pararia de funcionar sem
   * nenhuma mensagem explicando por que.
   */
  private aplicarRegraDoCatalogo(): void {
    const courseId = this.form.controls.courseId;
    const classId = this.form.controls.classId;

    if (this.semCursoDisponivel()) {
      courseId.clearValidators();
      classId.clearValidators();
      courseId.reset(null);
      classId.reset(null);
    } else {
      courseId.setValidators(Validators.required);
      classId.setValidators(Validators.required);
    }

    courseId.updateValueAndValidity();
    classId.updateValueAndValidity();
  }

  /** Traduz o erro do campo para a frase que o usuario le. */
  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  /**
   * Cria a conta.
   *
   * Sao cinco etapas, nesta ordem:
   *   1. o formulario esta valido? (regras que nao precisam da API)
   *   2. CPF, e-mail e login ja existem? A turma escolhida ainda tem vaga?
   *      (quatro consultas em paralelo)
   *   3. grava o ALUNO
   *   4. grava o USUARIO apontando para o aluno  (desfaz o 3 se falhar)
   *   5. grava a MATRICULA na turma escolhida     (desfaz o 4 e o 3 se falhar)
   *
   * A VAGA E CONFERIDA DUAS VEZES, E ISSO NAO E REDUNDANCIA
   * -------------------------------------------------------
   * A primeira vez e ao montar o catalogo, para nao oferecer turma lotada. A
   * segunda e aqui, no envio, porque entre abrir a tela e clicar no botao
   * outra pessoa pode ter ocupado a ultima vaga. E a mesma regra 6.2 que o
   * formulario do administrador aplica.
   */
  criarConta(): void {
    if (this.form.invalid) {
      // markAllAsTouched faz os erros aparecerem de uma vez. Sem isso, um campo
      // que a pessoa nunca tocou fica invalido e em silencio, e o botao parece
      // nao funcionar.
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const cpf = limparCpf(valores.cpf);
    const email = valores.email.trim().toLowerCase();
    const login = valores.login.trim().toLowerCase();

    // null quando nao ha curso com vaga: a conta e criada sem matricula.
    const classId = valores.classId;

    this.erro.set('');
    this.salvando.set(true);

    // As consultas de duplicidade vao JUNTAS. Uma de cada vez faria a pessoa
    // corrigir o e-mail, enviar, e so entao descobrir que o login tambem
    // estava em uso.
    forkJoin({
      emailEmUso: this.userService.buscarPorEmail(email),
      loginEmUso: this.userService.buscarPorLogin(login),
      cpfEmUso: this.studentService.buscarPorCpf(cpf),
      // Sem turma escolhida a consulta nem sai: of([]) evita um GET inutil.
      ocupadas: classId === null ? of([]) : this.enrollmentService.listarAtivasPorTurma(classId),
    }).subscribe({
      next: (conflitos) => {
        if (this.marcarConflitos(conflitos)) {
          this.salvando.set(false);
          return;
        }

        if (this.turmaLotou(conflitos.ocupadas.length)) {
          this.salvando.set(false);
          return;
        }

        this.gravar(
          {
            name: valores.name.trim(),
            cpf,
            birthDate: valores.birthDate,
            email,
            phone: valores.phone.trim(),
            // Endereco nao e pedido no autocadastro: a pessoa completa depois,
            // e exigir endereco para criar conta aumenta o abandono sem
            // necessidade - o administrador pode preencher depois.
            address: '',
            status: 'ativo',
          },
          { email, login, password: valores.password },
          classId,
        );
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set(
          'Nao foi possivel verificar seus dados. Confira se a API esta rodando (npm run api) e tente de novo.',
        );
      },
    });
  }

  /**
   * A turma escolhida lotou entre abrir a tela e enviar o formulario?
   *
   * Quando lotou, a tela recarrega o catalogo: insistir numa turma sem vaga nao
   * leva a nada, e recarregar e o que faz a opcao esgotada desaparecer da lista
   * em vez de continuar ali, convidando a mesma tentativa.
   *
   * @param ocupadasAgora quantas matriculas ativas a turma tem neste instante.
   */
  private turmaLotou(ocupadasAgora: number): boolean {
    const escolhida = this.turmaEscolhida();
    if (escolhida === null) {
      return false;
    }

    if (ocupadasAgora < escolhida.turma.capacity) {
      return false;
    }

    this.erro.set(
      `A turma ${escolhida.turma.code} acabou de lotar (${ocupadasAgora} de ` +
        `${escolhida.turma.capacity} vagas). Escolha outra turma ou outro curso: ` +
        `a lista foi atualizada. Nenhum dado seu foi gravado.`,
    );
    this.carregarCatalogo();
    this.form.controls.courseId.reset(null);
    return true;
  }

  /**
   * Marca no CAMPO cada dado que ja esta cadastrado.
   *
   * Devolve true quando encontrou algum conflito - e ai o cadastro para.
   *
   * Marcar o erro no campo (e nao mostrar um alerta no topo) e o que faz a
   * mensagem aparecer embaixo do dado errado, junto das outras mensagens de
   * validacao. Para quem usa a tela, "este e-mail ja esta cadastrado" e um erro
   * do campo e-mail como qualquer outro.
   */
  private marcarConflitos(conflitos: {
    emailEmUso: User[];
    loginEmUso: User[];
    cpfEmUso: Student[];
  }): boolean {
    let houve = false;

    if (conflitos.emailEmUso.length > 0) {
      this.form.controls.email.setErrors({ emailEmUso: true });
      houve = true;
    }

    if (conflitos.loginEmUso.length > 0) {
      this.form.controls.login.setErrors({ loginEmUso: true });
      houve = true;
    }

    if (conflitos.cpfEmUso.length > 0) {
      this.form.controls.cpf.setErrors({ cpfEmUso: true });
      houve = true;
    }

    if (houve) {
      this.form.markAllAsTouched();
    }

    return houve;
  }

  /**
   * Grava o aluno e, em seguida, o usuario que aponta para ele.
   *
   * switchMap encadeia as duas gravacoes: a segunda precisa do id que a
   * primeira devolve, entao nao da para rodar em paralelo como as consultas.
   */
  private gravar(
    aluno: Student,
    credencial: { email: string; login: string; password: string },
    classId: number | null,
  ): void {
    // O nome do curso e lido ANTES de gravar: depois de navegar para o login o
    // catalogo nao existe mais, e e ele que sabe traduzir classId em nome.
    const nomeDoCurso = this.cursoEscolhido()?.curso.name ?? '';

    this.studentService
      .create(aluno)
      .pipe(
        switchMap((alunoCriado) =>
          this.criarUsuarioPara(alunoCriado, credencial).pipe(
            switchMap((usuario) =>
              // A matricula (com o financeiro dela) e a ULTIMA etapa, e devolve
              // o usuario adiante: quem a tela precisa autenticar e a conta,
              // nao a matricula.
              this.criarMatriculaPara(alunoCriado, usuario, classId).pipe(map(() => usuario)),
            ),
          ),
        ),
      )
      .subscribe({
        next: (usuario) => {
          this.salvando.set(false);

          // JA AUTENTICADO (requisito 3): a pessoa acabou de definir a propria
          // credencial, entao nao faz sentido pedir a senha de novo na mesma
          // visita. A sessao e aberta aqui e ela cai direto no painel dela.
          this.auth.iniciarSessao(usuario);

          // O escopo de dados do aluno e montado a partir das matriculas dele.
          // Como esta matricula acabou de nascer, qualquer escopo que estivesse
          // em cache nao a conhece - e o painel filtraria para fora justamente
          // o que acabou de ser criado.
          this.acesso.invalidarEscopo();

          this.router.navigate(['/dashboard'], {
            queryParams: {
              boasVindas: usuario.name.trim().split(' ')[0],
              // O nome do curso vai na query string para o painel confirmar a
              // matricula por extenso. Sem isso, a pessoa escolhe um curso,
              // escolhe como pagar, e a tela seguinte nao menciona nada - e ela
              // fica sem saber se a matricula foi feita.
              ...(nomeDoCurso !== '' && classId !== null && { curso: nomeDoCurso }),
            },
          });
        },
        error: () => {
          this.salvando.set(false);
          this.erro.set(
            'Nao foi possivel concluir o cadastro. Nenhum dado foi gravado. Tente de novo em alguns instantes.',
          );
        },
      });
  }

  /**
   * Terceira e quarta gravacoes: a MATRICULA e o FINANCEIRO dela.
   *
   * A ORDEM DAS QUATRO GRAVACOES DO AUTOCADASTRO
   * --------------------------------------------
   *   1. aluno      (/students)         - a pessoa
   *   2. credencial (/users)            - como ela entra
   *   3. matricula  (/enrollments)      - o que ela vai estudar
   *   4. financeiro (/financialRecords + /payments) - quanto ela vai pagar
   *
   * Cada etapa precisa do id da anterior, e por isso elas sao em cadeia e nao
   * em paralelo. O JSON Server nao tem transacao: se a 4 falhar, as tres
   * primeiras JA estao gravadas. Por isso cada etapa desfaz as anteriores antes
   * de repassar o erro - e o que garante a promessa da mensagem de falha
   * ("nenhum dado foi gravado").
   *
   * Sem turma escolhida (nenhum curso com vaga), devolve of(null) e a cadeia
   * segue: a conta existe, so nao tem matricula nem financeiro.
   */
  private criarMatriculaPara(
    aluno: Student,
    usuario: User,
    classId: number | null,
  ): Observable<Enrollment | null> {
    if (classId === null) {
      return of(null);
    }

    const matricula: Enrollment = {
      studentId: aluno.id!,
      classId,
      enrollmentDate: this.hoje(),
      // A matricula nasce PENDENTE, e nao ativa: a escola ainda nao recebeu
      // nada. Ela vira 'ativa' quando o administrador confirmar a primeira
      // parcela - e e o FinanceiroService que faz essa passagem (requisito 5).
      status: 'pendente',
    };

    const valores = this.form.getRawValue();
    const condicao = valores.condition;

    return this.enrollmentService.create(matricula).pipe(
      switchMap((matriculaCriada) =>
        // QUARTA GRAVACAO: o lancamento financeiro e as parcelas (requisito
        // 6.5 - "quando um aluno concluir o cadastro e a matricula, criar
        // automaticamente o lancamento financeiro"). Quem conhece a regra de
        // divisao de centavos e de vencimentos e o FinanceiroService.
        this.financeiro
          .criarLancamento(
            matriculaCriada.id!,
            // O valor sai do CURSO escolhido, e nao de um campo da tela: preco
            // nao e coisa que o aluno informe.
            this.valorTotal(),
            {
              condition: condicao,
              installments: condicao === 'parcelado' ? valores.installments : 1,
              method: valores.method,
            },
            matricula.enrollmentDate,
          )
          .pipe(
            map(() => matriculaCriada),
            catchError((falhaOriginal: unknown) =>
              // O financeiro falhou: a matricula sem lancamento seria um aluno
              // matriculado que o sistema nunca vai cobrar. Desfaz as tres
              // gravacoes anteriores (o proprio criarLancamento ja limpou o que
              // tinha criado do lado dele).
              this.enrollmentService.delete(matriculaCriada.id!).pipe(
                catchError(() => of(null)),
                switchMap(() => this.desfazerContaCriada(aluno, usuario)),
                switchMap(() => throwError(() => falhaOriginal)),
              ),
            ),
          ),
      ),
      catchError((falhaOriginal: unknown) =>
        this.desfazerContaCriada(aluno, usuario).pipe(
          switchMap(() => throwError(() => falhaOriginal)),
        ),
      ),
    );
  }

  /**
   * Apaga a credencial e o cadastro de aluno recem-criados, nesta ordem.
   *
   * A ORDEM IMPORTA: apagar o aluno primeiro deixaria, por um instante, uma
   * credencial apontando para um cadastro que nao existe mais - e, se o segundo
   * DELETE falhasse, ela ficaria assim para sempre, permitindo login em uma
   * conta sem dono.
   *
   * O catchError de cada DELETE devolve of(null) porque uma limpeza que falha
   * nao deve esconder a falha ORIGINAL, que e a que a pessoa precisa ver.
   */
  private desfazerContaCriada(aluno: Student, usuario: User): Observable<unknown> {
    return this.userService.delete(usuario.id!).pipe(
      catchError(() => of(null)),
      switchMap(() => this.studentService.delete(aluno.id!).pipe(catchError(() => of(null)))),
    );
  }

  /** Data de hoje em 'aaaa-mm-dd', que e a data da matricula criada. */
  private hoje(): string {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${agora.getFullYear()}-${mes}-${dia}`;
  }

  /**
   * Cria o usuario ligado ao aluno e, se falhar, DESFAZ a criacao do aluno.
   *
   * E a compensacao que substitui a transacao que o JSON Server nao tem. Sem
   * ela, uma falha aqui deixaria a pessoa cadastrada como aluno mas sem conta -
   * e a nova tentativa bateria em "CPF ja cadastrado", trancando a pessoa fora
   * do sistema de forma definitiva.
   *
   * O delete tambem pode falhar (API fora do ar). Nesse caso nao ha o que
   * fazer no front, e a mensagem para o usuario e a mesma: nada foi concluido.
   * O importante e TENTAR desfazer, em vez de deixar o lixo sem olhar.
   */
  private criarUsuarioPara(
    aluno: Student,
    credencial: { email: string; login: string; password: string },
  ) {
    const usuario: User = {
      name: aluno.name,
      email: credencial.email,
      login: credencial.login,
      password: credencial.password,
      role: 'aluno',
      active: true,
      studentId: aluno.id!,
    };

    return this.userService.create(usuario).pipe(
      catchError((falhaOriginal: unknown) =>
        // Deu errado ao criar a credencial: apaga o aluno que acabou de ser
        // criado e SO DEPOIS repassa o erro, para o subscribe de gravar()
        // mostrar a mensagem com a base ja limpa.
        this.studentService.delete(aluno.id!).pipe(
          // Se o proprio delete falhar, nao ha mais nada a tentar daqui: seguimos
          // para repassar o erro original, que e o que interessa ao usuario.
          catchError(() => of(null)),
          switchMap(() => throwError(() => falhaOriginal)),
        ),
      ),
    );
  }
}
