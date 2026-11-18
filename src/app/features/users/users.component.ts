import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Student, User, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { StudentService } from '../../core/services/student.service';
import { UserService } from '../../core/services/user.service';
import {
  ConfirmService,
  EmptyStateComponent,
  LoadingComponent,
  PageHeaderComponent,
  SearchFieldComponent,
  StatusChipComponent,
} from '../../shared';

/** Como cada perfil aparece na tela. O valor GRAVADO continua em minusculas. */
const PERFIS: Record<UserRole, string> = {
  admin: 'Administrador',
  professor: 'Professor',
  aluno: 'Aluno',
};

/**
 * TELA DE USUARIOS (listagem).
 *
 * A SENHA NAO APARECE AQUI (checklist 9.1)
 * ----------------------------------------
 * A colecao /users tem o campo password, e a API devolve ele junto. A tela
 * simplesmente NAO monta coluna de senha: nem mascarada, nem abreviada.
 *
 * DUAS PROTECOES DESTA TELA
 * -------------------------
 * 1. Somente o administrador ve o item "Usuarios" no menu (o filtro esta em
 *    main-layout.component.ts, pelo role do usuario logado).
 * 2. O usuario logado nao pode excluir a propria conta. Nao e exigencia do
 *    contrato: e para nao acontecer o acidente de alguem apagar o unico
 *    administrador e ficar sem acesso ao sistema no meio de uma demonstracao.
 */
@Component({
  selector: 'app-users',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    SearchFieldComponent,
    StatusChipComponent,
    EmptyStateComponent,
    LoadingComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private readonly userService = inject(UserService);
  private readonly studentService = inject(StudentService);
  private readonly auth = inject(AuthService);
  private readonly confirmService = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Quem esta usando o sistema agora (para proteger a propria conta). */
  private readonly usuarioLogado = this.auth.usuarioLogado();

  readonly usuarios = signal<User[]>([]);

  /**
   * Indice de alunos por id, para resolver o VINCULO da conta.
   *
   * O usuario guarda studentId (um numero). Sem este indice, a
   * coluna de vinculo mostraria "Aluno 3" em vez do nome da pessoa - e o
   * administrador nao tem como saber quem e o aluno 3.
   */
  readonly alunosPorId = signal<Record<number, Student>>({});

  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly termo = signal('');

  readonly colunas = ['name', 'login', 'role', 'vinculo', 'situacao', 'acoes'];

  readonly usuariosFiltrados = computed(() => {
    const busca = this.semAcento(this.termo());
    if (!busca) {
      return this.usuarios();
    }
    return this.usuarios().filter(
      (usuario) =>
        this.semAcento(usuario.name).includes(busca) ||
        this.semAcento(usuario.login).includes(busca) ||
        this.semAcento(usuario.email).includes(busca),
    );
  });

  constructor() {
    this.carregar();
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');

    // As tres colecoes vao em paralelo: a lista de contas e os dois cadastros
    // que ela referencia. Sem os alunos carregados, a coluna de
    // vinculo nao teria nome para mostrar.
    forkJoin({
      usuarios: this.userService.listarOrdenadoPorNome(),
      alunos: this.studentService.list(),
    }).subscribe({
      next: ({ usuarios, alunos }) => {
        this.usuarios.set(usuarios);

        const indiceAlunos: Record<number, Student> = {};
        for (const aluno of alunos) {
          indiceAlunos[aluno.id!] = aluno;
        }
        this.alunosPorId.set(indiceAlunos);

        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Nao foi possivel carregar os usuarios. Rode npm run api e tente de novo.');
      },
    });
  }

  novo(): void {
    this.router.navigate(['/users/new']);
  }

  editar(usuario: User): void {
    this.router.navigate(['/users', usuario.id, 'edit']);
  }

  /** Rotulo do perfil para a tela ('admin' -> 'Administrador'). */
  perfil(usuario: User): string {
    return PERFIS[usuario.role];
  }

  /**
   * A PESSOA ligada a esta conta, escrita para a tela.
   *
   * Responde a pergunta que o administrador faz ao olhar a lista: "esta conta e
   * de quem?". Um usuario com perfil 'aluno' nao diz nada sobre QUAIS
   * matriculas ele alcanca - quem diz e o aluno vinculado a ele.
   *
   * O administrador nao tem vinculo (nao representa alguem do
   * quadro academico), e a coluna mostra um traco.
   *
   * O aviso de "cadastro nao encontrado" cobre um caso que NAO deveria
   * acontecer - a exclusao de aluno agora bloqueia quando existe
   * conta ligada. Se aparecer na tela, e sinal de dado editado por fora do
   * sistema, e e melhor mostrar isso do que uma celula vazia.
   */
  vinculo(usuario: User): string {
    if (usuario.studentId !== undefined) {
      return this.alunosPorId()[usuario.studentId]?.name ?? 'Cadastro nao encontrado';
    }

    return '-';
  }

  /** true quando a linha e o proprio usuario logado. */
  ehVoce(usuario: User): boolean {
    return this.usuarioLogado?.id === usuario.id;
  }

  /**
   * Exclui o usuario.
   *
   * Nenhuma outra colecao aponta PARA o usuario, entao nao ha dependente a
   * conferir (regra 6.8) - apenas a protecao da propria conta e a confirmacao.
   *
   * Repare que o sentido da referencia importa: a conta aponta para o aluno ou
   * para o aluno (users.studentId), e nao o contrario.
   * Por isso excluir a CONTA e seguro - o cadastro continua inteiro -, mas
   * excluir o CADASTRO nao e, e e justamente por isso que as telas de Alunos e
   * de Alunos bloqueia a exclusao quando existe conta ligada.
   */
  excluir(usuario: User): void {
    this.erro.set('');

    if (this.ehVoce(usuario)) {
      this.erro.set(
        'Voce nao pode excluir a sua propria conta: o sistema ficaria sem acesso. ' +
          'Peca a outro administrador, ou desative a conta em vez de excluir.',
      );
      return;
    }

    this.confirmService
      .confirm({
        title: 'Excluir usuario',
        message:
          `Confirma a exclusao do usuario ${usuario.name} (login ${usuario.login})? ` +
          `Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.userService.delete(usuario.id!).subscribe({
          next: () => this.carregar(),
          error: () => this.erro.set('Nao foi possivel excluir o usuario. Tente de novo.'),
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
