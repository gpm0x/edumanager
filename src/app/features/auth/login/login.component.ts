import { Component, afterNextRender, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { LIMITES } from '../../../core/validators';
import { AcessoDemo } from '../../../core/services/acessos-demo.config';
import { AcessoDemoDialogComponent } from './acesso-demo-dialog/acesso-demo-dialog.component';

/**
 * TELA DE LOGIN.
 *
 * E a unica tela fora do layout (sem menu lateral) e a unica sem o authGuard:
 * quem ainda nao entrou precisa conseguir abri-la.
 *
 * COMO FUNCIONA
 * -------------
 * 1. O formulario e um Reactive Form com dois campos obrigatorios.
 * 2. Ao enviar, chamamos AuthService.login(), que consulta
 *    GET /users?login=...&password=...&active=true no JSON Server.
 * 3. Se vier um usuario, o AuthService JA gravou ele no localStorage; aqui so
 *    navegamos para /dashboard. Se vier null, as credenciais estao erradas.
 *
 * DOIS CASOS DIFERENTES DE ERRO (ponto importante)
 * ------------------------------------------------
 *  - senha errada  -> cai no `next` com usuario = null  (NAO e erro de HTTP)
 *  - API fora do ar -> cai no `error`
 * Tratar os dois juntos faria a tela dizer "nao foi possivel conectar" quando o
 * usuario apenas digitou a senha errada.
 *
 * SOBRE OS SIGNALS
 * ----------------
 * O projeto e zoneless (nao tem zone.js). Atribuir uma propriedade comum dentro
 * do subscribe nao redesenharia a tela, por isso `erro` e `entrando` sao signals.
 *
 * ACESSO RAPIDO DA APRESENTACAO (nao e um segundo login)
 * -----------------------------------------------------
 * Quando a tela abre, um dialog pergunta "Como deseja acessar o sistema?" e
 * oferece os perfis de demonstracao. Escolher um perfil APENAS PREENCHE os dois
 * campos deste formulario - nada e autenticado ali. O caminho continua um so:
 * a pessoa confere os dados na tela e clica em Entrar, que chama o mesmo
 * `entrar()` abaixo e o mesmo AuthService de sempre.
 *
 * As credenciais ficam em core/services/acessos-demo.config.ts, e a escolha
 * pode ser reaberta pelo link no fim do formulario.
 */
@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  /*
   * NAO EXISTE MAIS A SAUDACAO DE "CONTA CRIADA" NESTA TELA
   * ------------------------------------------------------
   * Ate 14/11/2026 o autocadastro terminava aqui: a tela recebia
   * ?criado=<login>&nome=<primeiroNome>&curso=<nome>, dava as boas-vindas e
   * pedia a senha que a pessoa tinha acabado de criar.
   *
   * O requisito 3 mudou isso ("nao exigir que o aluno faca login novamente
   * apos concluir o cadastro"): o cadastro agora abre a sessao e manda a pessoa
   * direto para o painel dela. A confirmacao de conta criada e de matricula
   * passou para o /dashboard, que e onde ela cai.
   *
   * O codigo da saudacao foi retirado em vez de ficar aqui sem quem o acione:
   * codigo que ninguem mais alcanca engana quem le depois.
   */

  /** Mensagem de erro exibida acima do botao. Vazia = sem erro. */
  readonly erro = signal('');

  /** true enquanto a consulta esta em andamento (botao com spinner). */
  readonly entrando = signal(false);

  /** Controla o olhinho de mostrar/ocultar a senha. */
  readonly senhaVisivel = signal(false);

  /**
   * Formulario de login.
   * O minLength existe porque o requisito academico pede validacao de minimo
   * de caracteres; nao e regra de seguranca.
   */
  readonly form = this.fb.nonNullable.group({
    // O campo aceita E-MAIL ou LOGIN, por isso NAO leva Validators.email: ele
    // recusaria "admin". O minimo e o do login (o identificador mais curto dos
    // dois) e o maximo e o do e-mail (o mais longo) - qualquer um dos dois
    // formatos cabe nessa faixa, e quem decide se existe e a API.
    //
    login: [
      '',
      [
        Validators.required,
        Validators.minLength(LIMITES.login.min),
        Validators.maxLength(LIMITES.email.max),
      ],
    ],
    // Os mesmos limites que o cadastro de usuarios cobra. Antes eram 4 sem
    // maximo: a tela de entrada aceitava uma senha que nenhuma tela do sistema
    // conseguiria cadastrar.
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(LIMITES.password.min),
        Validators.maxLength(LIMITES.password.max),
      ],
    ],
  });

  /**
   * Perfil de demonstracao que preencheu os campos, ou null quando a pessoa
   * digitou a mao. Serve so para a tela dizer qual perfil esta no formulario -
   * nao participa do login.
   */
  readonly acessoDemo = signal<AcessoDemo | null>(null);

  constructor() {
    // O dialog abre DEPOIS da primeira renderizacao, nao no construtor: abrir
    // um overlay no meio da criacao do componente concorre com o ciclo de
    // deteccao de mudanca do Angular. afterNextRender espera a tela existir.
    afterNextRender(() => this.escolherAcesso());
  }

  /**
   * Abre o dialog de acesso rapido e, se a pessoa escolher um perfil, escreve
   * login e senha nos campos. E SO ISSO: nao navega e nao chama o AuthService.
   * A confirmacao fica com o botao Entrar, como em qualquer login digitado.
   *
   * Fechar sem escolher (ESC, clique fora, "Prefiro digitar") devolve
   * undefined e o formulario fica como estava.
   */
  escolherAcesso(): void {
    this.dialog
      .open<AcessoDemoDialogComponent, void, AcessoDemo | undefined>(AcessoDemoDialogComponent, {
        width: '620px',
        maxWidth: '94vw',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe((acesso) => {
        if (!acesso) {
          return;
        }

        this.form.patchValue({ login: acesso.login, password: acesso.password });

        // A senha fica VISIVEL: o pedido e justamente poder conferir os dados
        // antes de entrar, e seis pontinhos nao se conferem. O olhinho do
        // campo continua funcionando para esconder de novo.
        this.senhaVisivel.set(true);

        // Erro de uma tentativa anterior sai de cena: o formulario tem
        // conteudo novo, e a mensagem antiga nao fala mais dele.
        this.erro.set('');

        this.acessoDemo.set(acesso);
      });
  }

  /** Mostra ou esconde a senha digitada. */
  alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  /** Enviar o formulario: valida e tenta entrar. */
  entrar(): void {
    // Formulario invalido: marca os campos para os erros aparecerem e para aqui.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { login, password } = this.form.getRawValue();

    this.erro.set('');
    // A etiqueta do perfil escolhido sai: daqui para frente o assunto e o
    // resultado da tentativa, nao de onde vieram os valores dos campos.
    this.acessoDemo.set(null);
    this.entrando.set(true);

    this.auth.login(login, password).subscribe({
      next: (resultado) => {
        this.entrando.set(false);

        switch (resultado.tipo) {
          case 'ok':
            // Credenciais corretas e conta ativa. O usuario ja esta no
            // localStorage, gravado pelo AuthService.
            this.router.navigate(['/dashboard']);
            break;

          case 'desativado':
            // A senha estava CERTA: a conta e que foi desligada. Mandar
            // "credencial invalida" aqui faria a pessoa tentar a senha a noite
            // inteira sem nunca entrar.
            this.erro.set(
              'Esta conta esta desativada e nao pode entrar no sistema. ' +
                'Procure o administrador para reativa-la.',
            );
            break;

          case 'invalido':
            // Consulta funcionou e nao achou ninguem: identificador ou senha
            // errados. Nao dizemos QUAL dos dois: isso confirmaria a quem
            // tentasse adivinhar que o outro campo esta certo.
            this.erro.set('E-mail/login ou senha invalidos.');
            break;
        }
      },
      error: () => {
        // Aqui e falha de rede: a API nao respondeu.
        this.entrando.set(false);
        this.erro.set('Nao foi possivel conectar a API. Rode npm run api e tente de novo.');
      },
    });
  }
}
