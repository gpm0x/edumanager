import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { UserRole } from '../../core/models';
import { AcessoService, Area } from '../../core/services/acesso.service';
import { AuthService } from '../../core/services/auth.service';

/** Largura (px) a partir da qual o menu fica fixo na tela. Abaixo disso, vira gaveta. */
const LARGURA_DESKTOP = 960;

/**
 * Um item do menu lateral.
 *
 * `area` e o que decide se o item aparece: quem monta o menu pergunta ao
 * AcessoService se o perfil logado pode ver aquela area. Antes existia aqui um
 * campo `somenteAdmin`, que era uma regra de permissao escrita DENTRO do menu -
 * ou seja, um segundo lugar para manter sincronizado com a verdade. Agora o
 * menu nao sabe nada sobre perfis: ele so pergunta.
 */
interface MenuItem {
  label: string;
  icon: string;
  path: string;
  area: Area;
}

/** Um grupo de itens do menu (ACADEMICO, OPERACAO, GESTAO). */
interface MenuGroup {
  titulo: string;
  itens: MenuItem[];
}

/**
 * MAIN LAYOUT - a "casca" da aplicacao.
 *
 * E a rota PAI de todas as telas internas: o menu lateral e o cabecalho ficam
 * aqui e cada tela aparece no <router-outlet> do meio. Assim o menu e escrito
 * UMA vez e nao se repete em cada um dos modulos.
 *
 * A tela de login NAO usa este layout (ela fica fora da rota pai, em
 * app.routes.ts), porque quem ainda nao entrou nao deve ver o menu.
 *
 * O MENU E MONTADO A PARTIR DAS PERMISSOES
 * ----------------------------------------
 * Cada item declara a sua `area` e o menu pergunta ao AcessoService quem pode
 * ve-la. Duas consequencias praticas:
 *
 *   - o aluno nao ve "Alunos", "Cursos", "Turmas" nem "Usuarios";
 *   - uma area nova so precisa ser cadastrada na matriz do AcessoService.
 *
 * Esconder do menu e CONVENIENCIA, nao restricao: quem nega de verdade e o
 * permissaoGuard, na rota. O menu existe para o usuario nao tentar.
 *
 * O ALUNO TEM UM MENU PROPRIO
 * ---------------------------
 * Nao e o mesmo menu com itens escondidos: e outra lista, com outros rotulos
 * ("Minhas matriculas" em vez de "Matriculas"). O aluno nao administra a
 * escola, ele consulta a propria vida academica - e o rotulo precisa dizer isso
 * antes de ele clicar, senao parece que vai ver a matricula de todos.
 *
 * SOBRE OS TEXTOS
 * ---------------
 * Os caminhos (path) estao em INGLES, iguais a pasta e ao endpoint da API
 * (/students = features/students = GET /students). Os rotulos ficam em
 * PORTUGUES, porque e o que o usuario le. Decisao registrada no contrato.
 */
@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly acesso = inject(AcessoService);

  /** Usuario logado, lido do AuthService (que le do localStorage). */
  readonly usuario = this.auth.usuarioLogado();

  /** true quando a janela e estreita (celular/tablet). */
  readonly telaPequena = signal(window.innerWidth < LARGURA_DESKTOP);

  /** No celular o menu comeca fechado e abre pelo botao do cabecalho. */
  readonly menuAberto = signal(false);

  /**
   * Modo do menu lateral:
   *  'side' = fixo, empurrando o conteudo (desktop)
   *  'over' = gaveta por cima do conteudo, com fundo escuro (celular)
   */
  readonly modoMenu = computed<'side' | 'over'>(() => (this.telaPequena() ? 'over' : 'side'));

  /** No desktop o menu esta sempre aberto; no celular, depende do botao. */
  readonly menuVisivel = computed(() => (this.telaPequena() ? this.menuAberto() : true));

  /** Item fixo do topo do menu, fora dos grupos. */
  readonly dashboard: MenuItem = {
    label: this.acesso.ehAluno() || this.acesso.ehProfessor() ? 'Meu painel' : 'Painel',
    icon: 'dashboard',
    path: '/dashboard',
    area: 'dashboard',
  };

  /**
   * O menu do administrador: a escola inteira.
   * O filtro em gruposVisiveis, mais abaixo, ainda passa cada item pela matriz
   * de permissoes - e o que faz uma area nova aparecer sozinha aqui.
   */
  private readonly menuDaEscola: MenuGroup[] = [
    {
      titulo: 'Academico',
      itens: [
        { label: 'Alunos', icon: 'people', path: '/students', area: 'students' },
        { label: 'Cursos', icon: 'menu_book', path: '/courses', area: 'courses' },
        { label: 'Turmas', icon: 'groups', path: '/classes', area: 'classes' },
        { label: 'Matriculas', icon: 'how_to_reg', path: '/enrollments', area: 'enrollments' },
      ],
    },
    {
      titulo: 'Operacao',
      itens: [
        // Dois itens de financeiro porque sao duas entidades: o LANCAMENTO
        // (o combinado da matricula) e a PARCELA (cada pedaco dele).
        { label: 'Lancamentos', icon: 'request_quote', path: '/financial', area: 'financial' },
        { label: 'Parcelas', icon: 'payments', path: '/payments', area: 'payments' },
        {
          label: 'Chamada',
          icon: 'how_to_vote',
          path: '/attendances/chamada',
          area: 'attendances',
        },
        { label: 'Frequencia', icon: 'fact_check', path: '/attendances', area: 'attendances' },
      ],
    },
    {
      titulo: 'Gestao',
      itens: [
        { label: 'Usuarios', icon: 'manage_accounts', path: '/users', area: 'users' },
        { label: 'Relatorios', icon: 'assessment', path: '/reports', area: 'reports' },
      ],
    },
  ];

  /** O menu do aluno: as mesmas telas, com o rotulo na primeira pessoa. */
  /**
   * MENU DO PROFESSOR.
   *
   * Os rotulos sao na primeira pessoa (Meus cursos, Minhas turmas) porque o
   * professor NAO ve a escola: ele ve o recorte dele. Chamar a tela de
   * "Cursos" prometeria o catalogo inteiro e entregaria tres linhas, o que
   * pareceria dado faltando em vez de permissao funcionando.
   *
   * Os caminhos sao os MESMOS do menu da escola - nao existe tela duplicada
   * para o professor. Quem recorta o conteudo e o escopo de dados.
   */
  private readonly menuDoProfessor: MenuGroup[] = [
    {
      titulo: 'Minhas turmas',
      itens: [
        { label: 'Meus cursos', icon: 'menu_book', path: '/courses', area: 'courses' },
        { label: 'Minhas turmas', icon: 'groups', path: '/classes', area: 'classes' },
        { label: 'Meus alunos', icon: 'people', path: '/students', area: 'students' },
        { label: 'Matriculas', icon: 'how_to_reg', path: '/enrollments', area: 'enrollments' },
      ],
    },
    {
      titulo: 'Dia a dia',
      itens: [
        {
          label: 'Chamada',
          icon: 'how_to_vote',
          path: '/attendances/chamada',
          area: 'attendances',
        },
        { label: 'Frequencia', icon: 'fact_check', path: '/attendances', area: 'attendances' },
        // Sem Financeiro: o professor nao alcanca mensalidades (ver a matriz
        // no AcessoService). Mesmo que o item voltasse para ca por engano, o
        // filtro por podeVer() o esconderia e o permissaoGuard negaria a rota.
      ],
    },
  ];

  private readonly menuDoAluno: MenuGroup[] = [
    {
      titulo: 'Minha vida academica',
      itens: [
        {
          label: 'Cursos disponiveis',
          icon: 'menu_book',
          path: '/courses',
          area: 'courses',
        },
        {
          label: 'Minha matricula',
          icon: 'how_to_reg',
          path: '/enrollments',
          area: 'enrollments',
        },
        {
          label: 'Minhas mensalidades',
          icon: 'request_quote',
          path: '/financial',
          area: 'financial',
        },
        {
          label: 'Minha frequencia',
          icon: 'fact_check',
          path: '/attendances',
          area: 'attendances',
        },
      ],
    },
  ];

  /**
   * Os grupos que o perfil logado realmente ve.
   *
   * Dois passos: escolhe o menu do perfil e, dentro dele, mantem so os itens
   * cuja area o AcessoService libera. Grupo que ficou sem nenhum item sai da
   * tela - senao sobraria um titulo de secao sozinho, sem nada embaixo.
   */
  /**
   * O menu que vai para a tela, ja sem os itens que o perfil nao alcanca.
   *
   * Sao duas etapas, e as duas importam:
   *   1. escolher o CONJUNTO de itens do perfil (rotulos e agrupamento);
   *   2. filtrar cada item por podeVer(area) - que e a matriz falando.
   *
   * A etapa 2 nao e redundante: e a rede de seguranca para quando alguem
   * acrescentar um item no menu errado. E, mesmo assim, esconder item nao
   * protege nada - quem nega a tela e o permissaoGuard, na rota.
   */
  readonly gruposVisiveis: MenuGroup[] = this.menuDoPerfil()
    .map((grupo) => ({
      titulo: grupo.titulo,
      itens: grupo.itens.filter((item) => this.acesso.podeVer(item.area)),
    }))
    .filter((grupo) => grupo.itens.length > 0);

  /** Primeira letra do nome, usada no circulo do cabecalho. */
  /** Qual conjunto de itens este perfil recebe. */
  private menuDoPerfil(): MenuGroup[] {
    if (this.acesso.ehAluno()) {
      return this.menuDoAluno;
    }
    if (this.acesso.ehProfessor()) {
      return this.menuDoProfessor;
    }
    return this.menuDaEscola;
  }

  get inicial(): string {
    return this.usuario?.name?.charAt(0).toUpperCase() ?? '?';
  }

  /** Nome do perfil como o usuario le na tela. */
  get perfil(): string {
    const nomes: Record<UserRole, string> = {
      admin: 'Administrador',
      professor: 'Professor',
      aluno: 'Aluno',
    };
    return this.usuario ? nomes[this.usuario.role] : '';
  }

  /**
   * Frase curta no rodape do menu dizendo o ALCANCE do perfil.
   *
   * Existe porque "Professor" sozinho nao responde a pergunta que o usuario faz
   * quando falta coisa na tela: "por que eu nao vejo o curso X?". Dizer
   * "so os seus cursos" no rodape responde antes de ele perguntar.
   */
  /**
   * A frase do rodape do menu: ate onde o acesso deste perfil chega.
   *
   * Existe para o usuario entender POR QUE a lista mostra menos registros do
   * que a escola tem - sem isso, permissao funcionando parece dado faltando.
   */
  get alcance(): string {
    if (this.acesso.ehAluno()) {
      return 'Somente o seu cadastro';
    }
    if (this.acesso.ehProfessor()) {
      return 'Somente os seus cursos e turmas';
    }
    return 'Acesso completo';
  }

  /**
   * Redimensionou a janela? Atualiza a flag de tela pequena.
   * HostListener e a forma do Angular de escutar um evento do navegador.
   */
  @HostListener('window:resize')
  aoRedimensionar(): void {
    this.telaPequena.set(window.innerWidth < LARGURA_DESKTOP);
  }

  /** Abre/fecha o menu no celular. */
  alternarMenu(): void {
    this.menuAberto.update((aberto) => !aberto);
  }

  /** Fecha o menu depois de clicar num item (so faz diferenca no celular). */
  fecharMenu(): void {
    if (this.telaPequena()) {
      this.menuAberto.set(false);
    }
  }

  /**
   * Sai do sistema.
   * O proprio AuthService limpa o localStorage E navega para /login,
   * entao aqui nao precisamos navegar de novo.
   */
  sair(): void {
    this.auth.logout();
  }
}
