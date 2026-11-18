import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Student, User, UserRole } from '../../../core/models';
import { StudentService } from '../../../core/services/student.service';
import { UserService } from '../../../core/services/user.service';
import {
  LIMITES,
  emailValidators,
  mensagemDeErro,
  selecaoValidators,
  textoValidators,
} from '../../../core/validators';
import { FormActionsComponent, LoadingComponent, PageHeaderComponent } from '../../../shared';

/**
 * FORMULARIO DE USUARIO (cadastrar e editar).
 *
 * REGRA 6.6 - LOGIN DUPLICADO
 * ---------------------------
 * O login e a chave da autenticacao: o AuthService entra no sistema
 * consultando GET /users?login=...&password=...&active=true. Dois usuarios com
 * o mesmo login tornariam esse resultado ambiguo - por isso o login duplicado e
 * bloqueado antes de gravar, consultando GET /users?login=valor.
 *
 * HONESTIDADE TECNICA SOBRE A SENHA
 * ---------------------------------
 * A senha e gravada em TEXTO PURO no db.json, porque o "banco" e um arquivo
 * servido pelo JSON Server, que nao tem criptografia. Num sistema real o
 * servidor guardaria apenas o hash (bcrypt, por exemplo) e a tela nunca
 * receberia a senha de volta. A escolha aqui e deliberada e esta registrada
 * tambem no auth.service.ts.
 *
 * O campo da tela e type="password" (checklist 9.9), com um olhinho para
 * conferir o que foi digitado.
 */
@Component({
  selector: 'app-user-form',
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
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly studentService = inject(StudentService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly id: number | null = this.lerIdDaRota();

  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal('');

  /** Controla o olhinho de mostrar/ocultar a senha. */
  readonly senhaVisivel = signal(false);

  /**
   * O perfil escolhido agora no select.
   *
   * E signal (e nao so o valor do form) porque o TEMPLATE depende dele para
   * decidir qual campo de vinculo mostrar. Num projeto zoneless, ler
   * form.controls.role.value direto no template nao redesenharia a tela quando
   * o usuario trocasse a opcao.
   */
  readonly perfilEscolhido = signal<UserRole>('aluno');

  /** Opcoes dos selects de vinculo. */
  readonly alunos = signal<Student[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', textoValidators(LIMITES.name)],
    email: ['', emailValidators()],
    login: ['', textoValidators(LIMITES.login)],
    password: ['', textoValidators(LIMITES.password)],
    role: ['aluno' as UserRole, selecaoValidators()],
    active: [true],

    // --- VINCULO COM A PESSOA -------------------------------------------
    // Um usuario e uma CREDENCIAL; aluno e um CADASTRO. Este
    // campos ligam as duas coisas, e e esse vinculo que faz a restricao de
    // acesso funcionar: sem studentId, o sistema sabe que alguem e aluno
    // mas nao sabe QUAIS cursos sao dele.
    //
    // Comecam SEM validador: a obrigatoriedade depende do perfil escolhido e e
    // ligada/desligada em aplicarRegraDoVinculo(). Declarar required aqui
    // travaria o formulario de um administrador, que nao tem vinculo nenhum.
    studentId: [null as number | null],
  });

  constructor() {
    this.carregarVinculos();

    // O perfil manda em qual campo de vinculo e obrigatorio. Reagimos a cada
    // troca no select, e nao so no momento de salvar, para o campo aparecer
    // junto com a escolha.
    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((perfil) => this.aplicarRegraDoVinculo(perfil));

    if (this.id !== null) {
      this.carregar(this.id);
    }
  }

  get titulo(): string {
    return this.id === null ? 'Novo usuario' : 'Editar usuario';
  }

  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  /** Busca os alunos para o select de vinculo. */
  private carregarVinculos(): void {
    this.studentService.listarOrdenadoPorNome().subscribe({
      next: (alunos) => this.alunos.set(alunos),
      error: () => this.erro.set('Nao foi possivel carregar a lista de alunos.'),
    });
  }

  /**
   * Liga e desliga a obrigatoriedade do vinculo conforme o perfil.
   *
   *   aluno     -> studentId obrigatorio (qual aluno de /students esta conta e)
   *   professor -> sem studentId. O vinculo dele e o contrario: sao os CURSOS
   *                e as TURMAS que apontam para o usuario (teacherId), e isso
   *                se define nas telas de Curso e de Turma - um professor pode
   *                responder por varios cursos, e um campo so aqui nao daria
   *                conta disso.
   *   admin     -> sem vinculo (nao representa alguem do quadro academico)
   *
   * LIMPAR O CAMPO QUE SOBROU E PARTE DA REGRA, nao arrumacao de tela: se
   * alguem escolher o perfil aluno, apontar o aluno e depois trocar para
   * administrador, o studentId antigo ficaria gravado no registro. A conta
   * seria de administrador e, para o AcessoService, ainda carregaria o vinculo
   * de um aluno - exatamente o tipo de brecha que esta regra fecha.
   */
  private aplicarRegraDoVinculo(perfil: UserRole): void {
    this.perfilEscolhido.set(perfil);

    const studentId = this.form.controls.studentId;

    if (perfil === 'aluno') {
      studentId.setValidators(Validators.required);
    } else {
      studentId.clearValidators();
      studentId.reset(null);
    }

    // updateValueAndValidity avisa o formulario de que as regras mudaram; sem
    // isso o form continuaria valido (ou invalido) pelo criterio anterior.
    studentId.updateValueAndValidity();
  }

  private carregar(id: number): void {
    this.carregando.set(true);

    this.userService.getById(id).subscribe({
      next: (usuario) => {
        // A regra do vinculo e aplicada ANTES de preencher: se o patchValue
        // viesse primeiro, o valueChanges do role reagiria depois e apagaria o
        // studentId que acabou de ser carregado.
        this.aplicarRegraDoVinculo(usuario.role);
        this.form.patchValue(usuario);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar o usuario. Volte para a lista e tente de novo.');
      },
    });
  }

  /**
   * REGRA 6.6 (login duplicado) + E-MAIL DUPLICADO, e depois a gravacao.
   *
   * As duas consultas saem JUNTAS, num forkJoin, e nao uma depois da outra: em
   * sequencia, quem errasse os dois campos corrigiria o login, salvaria de
   * novo e so entao descobriria o e-mail. Perguntando as duas de uma vez, a
   * tela aponta tudo o que esta em conflito na primeira tentativa.
   *
   * Por que o e-mail tambem precisa ser unico, se o login ja e: o e-mail e a
   * identidade que a PESSOA reconhece. Duas contas com o mesmo e-mail e logins
   * diferentes deixariam o usuario sem saber com qual entrar. O autocadastro
   * (/criar-conta) ja bloqueava isso; aqui ficava de fora, e o caminho do
   * administrador conseguia criar a duplicata que o caminho do aluno barrava.
   */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();

    // O login e gravado em minusculas: "Admin" e "admin" entrariam como dois
    // usuarios diferentes, e a consulta de login do AuthService e sensivel a
    // caixa. Normalizar aqui evita esse tipo de duplicata silenciosa.
    const login = valores.login.trim().toLowerCase();

    // O e-mail segue a mesma regra, e pelo mesmo motivo: a consulta de
    // duplicata e sensivel a caixa.
    const email = valores.email.trim().toLowerCase();

    this.erro.set('');
    this.salvando.set(true);

    forkJoin({
      porLogin: this.userService.buscarPorLogin(login),
      porEmail: this.userService.buscarPorEmail(email),
    }).subscribe({
      next: ({ porLogin, porEmail }) => {
        // Na EDICAO, o proprio registro aparece na consulta: ele e descartado,
        // senao ninguem conseguiria salvar um usuario sem trocar login e e-mail.
        const outros = porLogin.filter((usuario) => usuario.id !== this.id);
        const mesmoEmail = porEmail.filter((usuario) => usuario.id !== this.id);

        if (outros.length > 0) {
          this.salvando.set(false);
          this.erro.set(
            `O login "${login}" ja esta em uso por ${outros[0].name}. ` +
              `Escolha outro login: ele e a chave de entrada no sistema.`,
          );
          return;
        }

        if (mesmoEmail.length > 0) {
          this.salvando.set(false);
          this.erro.set(
            `O e-mail "${email}" ja esta cadastrado para ${mesmoEmail[0].name}. ` +
              `Cada conta precisa de um e-mail proprio.`,
          );
          return;
        }

        this.gravar({
          name: valores.name.trim(),
          email,
          login,
          password: valores.password,
          role: valores.role,
          active: valores.active,

          // Somente o vinculo que o perfil usa vai para a API. O spread
          // condicional ({ ...(cond && { campo }) }) evita gravar
          // "studentId: null" num administrador: campo que nao se aplica nao
          // deve existir no registro.
          ...(valores.role === 'aluno' && { studentId: Number(valores.studentId) }),
        });
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel verificar o login e o e-mail na API. Tente de novo.');
      },
    });
  }

  private gravar(usuario: User): void {
    const requisicao =
      this.id === null
        ? this.userService.create(usuario)
        : this.userService.update(this.id, { ...usuario, id: this.id });

    requisicao.subscribe({
      next: () => this.router.navigate(['/users']),
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel salvar o usuario. Verifique a API e tente de novo.');
      },
    });
  }

  fechar(): void {
    this.router.navigate(['/users']);
  }

  private lerIdDaRota(): number | null {
    const parametro = this.rota.snapshot.paramMap.get('id');
    return parametro === null ? null : Number(parametro);
  }
}
