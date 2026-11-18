import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';

import { Student, User } from '../../../core/models';
import { StudentService } from '../../../core/services/student.service';
import { UserService } from '../../../core/services/user.service';
import {
  LIMITES,
  cpfValidator,
  dataNaoFuturaValidator,
  emailValidators,
  limparCpf,
  mensagemDeErro,
  selecaoValidators,
  textoValidators,
} from '../../../core/validators';
import { FormActionsComponent, LoadingComponent, PageHeaderComponent } from '../../../shared';

/**
 * FORMULARIO DE ALUNO (cadastrar e editar).
 *
 * Mesma estrutura do formulario de Curso (o molde). O que e especifico daqui:
 *
 * 1) VALIDACAO DE CPF POR DIGITOS VERIFICADORES (requisito academico).
 *    O cpfValidator calcula os dois digitos verificadores na hora da digitacao.
 *    Isso e matematica local, nao precisa de API.
 *
 * 2) REGRA 6.7 - CPF DUPLICADO.
 *    Essa NAO da para resolver no navegador: e preciso perguntar a API se outro
 *    aluno ja tem aquele CPF. Por isso ela roda no salvar(), depois do
 *    formulario estar valido e ANTES de gravar.
 *
 *    Ao editar, o proprio aluno aparece no resultado da consulta - entao
 *    descartamos o registro cujo id e o que esta em edicao.
 *
 * 3) A DATA E STRING, NAO Date.
 *    O contrato grava data como 'aaaa-mm-dd'. Usamos <input type="date">, que
 *    entrega exatamente esse formato, em vez do datepicker do Material (que
 *    entrega um objeto Date e exigiria conversao nos dois sentidos).
 */
@Component({
  selector: 'app-student-form',
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
  templateUrl: './student-form.component.html',
  styleUrl: './student-form.component.scss',
})
export class StudentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly studentService = inject(StudentService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly id: number | null = this.lerIdDaRota();

  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', textoValidators(LIMITES.name)],
    cpf: ['', [Validators.required, cpfValidator]],
    birthDate: ['', [Validators.required, dataNaoFuturaValidator]],
    email: ['', emailValidators()],
    phone: ['', textoValidators(LIMITES.phone)],
    address: ['', textoValidators(LIMITES.address)],
    status: ['ativo' as Student['status'], selecaoValidators()],
  });

  constructor() {
    if (this.id !== null) {
      this.carregar(this.id);
    }
  }

  get titulo(): string {
    return this.id === null ? 'Novo aluno' : 'Editar aluno';
  }

  mensagem(campo: string, rotulo: string): string | null {
    return mensagemDeErro(this.form.get(campo), rotulo);
  }

  private carregar(id: number): void {
    this.carregando.set(true);

    this.studentService.getById(id).subscribe({
      next: (aluno) => {
        this.form.patchValue(aluno);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar o aluno. Volte para a lista e tente de novo.');
      },
    });
  }

  /**
   * Grava o aluno, em dois passos:
   *   1. consulta a API para aplicar a REGRA 6.7 (CPF duplicado);
   *   2. so entao envia o POST ou o PUT.
   */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();

    // O CPF e GRAVADO com 11 digitos puros (contrato de dados), entao limpamos
    // qualquer mascara que o usuario tenha digitado antes de comparar e gravar.
    const cpf = limparCpf(valores.cpf);

    this.erro.set('');
    this.salvando.set(true);

    this.studentService.buscarPorCpf(cpf).subscribe({
      next: (encontrados) => {
        // Na edicao, o proprio aluno vem na lista: ele nao e duplicata de si mesmo.
        const outros = encontrados.filter((aluno) => aluno.id !== this.id);

        if (outros.length > 0) {
          this.salvando.set(false);
          this.erro.set(
            `O CPF informado ja esta cadastrado para o aluno ${outros[0].name}. ` +
              `Cada CPF pode existir uma unica vez no cadastro de alunos.`,
          );
          return;
        }

        this.gravar({
          name: valores.name.trim(),
          cpf,
          birthDate: valores.birthDate,
          email: valores.email.trim(),
          phone: valores.phone.trim(),
          address: valores.address.trim(),
          status: valores.status,
        });
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel verificar o CPF na API. Tente de novo.');
      },
    });
  }

  /** Envia para a API: POST quando e novo, PUT quando e edicao. */
  private gravar(aluno: Student): void {
    const requisicao =
      this.id === null
        ? this.studentService.create(aluno)
        : this.studentService.update(this.id, { ...aluno, id: this.id });

    requisicao.pipe(switchMap((salvo) => this.sincronizarConta(salvo))).subscribe({
      next: () => this.router.navigate(['/students']),
      error: () => {
        this.salvando.set(false);
        this.erro.set('Nao foi possivel salvar o aluno. Verifique a API e tente de novo.');
      },
    });
  }

  /**
   * Faz a CONTA DE ACESSO acompanhar o cadastro, quando existe uma.
   *
   * O PROBLEMA QUE ISTO RESOLVE
   * ---------------------------
   * Nome e e-mail existem em dois lugares: no cadastro do aluno (/students) e
   * na credencial dele (/users). Sao registros separados de proposito - uma
   * pessoa pode ter cadastro sem ter login. Mas isso cria um risco: renomear o
   * aluno aqui e NAO mexer na conta faz o sistema passar a chamar a mesma
   * pessoa por dois nomes diferentes, em telas diferentes.
   *
   * Na pratica apareceria assim: o administrador corrige o sobrenome do aluno; na
   * proxima vez que ele entrar, o painel o cumprimenta com o nome ANTIGO,
   * enquanto a lista de alunos mostra o novo. Nada quebra, e justamente por
   * isso ninguem percebe - ate alguem perceber na frente da turma.
   *
   * Entao o salvamento continua: achou conta ligada a este aluno, atualiza o
   * nome e o e-mail dela. Login, senha, perfil e vinculo NAO sao tocados - sao
   * dados da credencial, nao do cadastro.
   *
   * Quando nao existe conta (o caso mais comum), devolve o proprio aluno e nao
   * faz requisicao nenhuma.
   */
  private sincronizarConta(aluno: Student): Observable<Student | User> {
    // Cadastro novo nao tem conta ligada ainda: nada a sincronizar.
    if (this.id === null) {
      return of(aluno);
    }

    return this.userService.buscarPorAluno(this.id).pipe(
      switchMap((contas) => {
        if (contas.length === 0) {
          return of(aluno);
        }

        const conta = contas[0];
        return this.userService.update(conta.id!, {
          ...conta,
          name: aluno.name,
          email: aluno.email,
        });
      }),
    );
  }

  fechar(): void {
    this.router.navigate(['/students']);
  }

  private lerIdDaRota(): number | null {
    const parametro = this.rota.snapshot.paramMap.get('id');
    return parametro === null ? null : Number(parametro);
  }
}
