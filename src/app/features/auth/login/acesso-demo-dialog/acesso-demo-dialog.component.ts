import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ACESSOS_DEMO, AcessoDemo } from '../../../../core/services/acessos-demo.config';

/**
 * DIALOG DE ACESSO RAPIDO - "Como deseja acessar o sistema?"
 *
 * Abre sozinho quando a tela de login carrega e oferece os perfis do sistema
 * em cards. Serve a um proposito so: poupar digitacao na banca.
 *
 * O QUE ELE FAZ E O QUE ELE NAO FAZ
 * ---------------------------------
 * Ele NAO faz login. Ao escolher um perfil, o dialog apenas FECHA devolvendo o
 * objeto AcessoDemo escolhido; quem recebe esse objeto e a tela de login, que
 * escreve os dois valores no formulario e para ali. A pessoa confere os dados
 * na tela e confirma no botao Entrar, que continua passando pelo AuthService
 * como qualquer login digitado a mao.
 *
 * Essa separacao e deliberada: se o dialog autenticasse, existiriam dois
 * caminhos de login para manter. Aqui existe um, e este dialog e so um
 * preenchedor de campo.
 *
 * O QUE ELE DEVOLVE
 * -----------------
 *   AcessoDemo -> a pessoa escolheu um perfil.
 *   undefined  -> fechou no ESC, clicou fora ou escolheu "Prefiro digitar".
 *                 A tela de login nao mexe no formulario nesse caso.
 */
@Component({
  selector: 'app-acesso-demo-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './acesso-demo-dialog.component.html',
  styleUrl: './acesso-demo-dialog.component.scss',
})
export class AcessoDemoDialogComponent {
  /** Referencia do proprio dialog: usada para fechar devolvendo a escolha. */
  private readonly dialogRef =
    inject<MatDialogRef<AcessoDemoDialogComponent, AcessoDemo | undefined>>(MatDialogRef);

  /**
   * Os perfis vem da lista central (core/services/acessos-demo.config.ts), nao
   * de uma copia escrita aqui: credencial em dois lugares e credencial que
   * desencontra.
   */
  readonly acessos = ACESSOS_DEMO;

  /** Perfil escolhido: fecha devolvendo o objeto para a tela preencher. */
  escolher(acesso: AcessoDemo): void {
    this.dialogRef.close(acesso);
  }

  /** "Prefiro digitar": fecha sem escolha nenhuma. */
  dispensar(): void {
    this.dialogRef.close(undefined);
  }
}
