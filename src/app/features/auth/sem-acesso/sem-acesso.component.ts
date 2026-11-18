import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';

import { UserRole } from '../../../core/models';
import { AcessoService, Area } from '../../../core/services/acesso.service';

/** Nome de cada area como o usuario le na tela. */
const NOMES_DAS_AREAS: Record<Area, string> = {
  dashboard: 'o painel',
  students: 'o cadastro de alunos',
  courses: 'os cursos',
  classes: 'as turmas',
  enrollments: 'as matriculas',
  financial: 'os lancamentos financeiros',
  payments: 'as parcelas do financeiro',
  attendances: 'a frequencia',
  users: 'o cadastro de usuarios',
  reports: 'os relatorios',
};

/** Nome de cada perfil como o usuario le na tela. */
const NOMES_DOS_PERFIS: Record<UserRole, string> = {
  admin: 'Administrador',
  professor: 'Professor',
  aluno: 'Aluno',
};

/**
 * TELA DE ACESSO NEGADO.
 *
 * E onde o permissaoGuard deixa quem tentou abrir uma area que o perfil nao
 * alcanca. Existe por uma razao de honestidade com o usuario: um guard que
 * apenas devolve false faz a URL mudar e a tela nao acontecer, o que parece
 * um sistema quebrado. Aqui ele le o que foi negado e por que.
 *
 * A tela NAO oferece caminho para contornar a restricao - so explica e devolve
 * ao painel. O nome da area chega pela query string, posta pelo guard.
 */
@Component({
  selector: 'app-sem-acesso',
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './sem-acesso.component.html',
  styleUrl: './sem-acesso.component.scss',
})
export class SemAcessoComponent {
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly acesso = inject(AcessoService);

  /** A area que o usuario tentou abrir, se o guard informou. */
  private readonly area = this.rota.snapshot.queryParamMap.get('area') as Area | null;

  /** 'criar', 'editar' ou 'excluir' quando a tentativa foi de escrever; 'ver' quando foi de abrir. */
  private readonly acao = this.rota.snapshot.queryParamMap.get('acao');

  /** Frase que nomeia o que foi negado ("o financeiro", "os relatorios"). */
  get oQueFoiNegado(): string {
    if (this.area && NOMES_DAS_AREAS[this.area]) {
      return NOMES_DAS_AREAS[this.area];
    }
    return 'esta parte do sistema';
  }

  /**
   * true quando o usuario PODE ver a area, mas tentou ESCREVER nela.
   *
   * Separar os dois casos muda a mensagem da tela, e a diferenca importa: "voce
   * nao alcanca esta area" e "voce consulta esta area, mas nao altera" sao
   * negativas diferentes, e a segunda e o caso comum do professor e do aluno.
   */
  get tentouGerenciar(): boolean {
    const escreveu = this.acao === 'criar' || this.acao === 'editar' || this.acao === 'excluir';
    return escreveu && this.area !== null && this.acesso.podeVer(this.area);
  }

  /** Nome do perfil logado, para a mensagem dizer com o que ele esta entrando. */
  get perfil(): string {
    const perfil = this.acesso.perfil();
    return perfil ? NOMES_DOS_PERFIS[perfil] : 'visitante';
  }

  /** Volta para a tela inicial, que todo perfil alcanca. */
  irParaOPainel(): void {
    this.router.navigate(['/dashboard']);
  }
}
