import { Routes } from '@angular/router';

// Guard que protege a area interna: esta logado?
import { authGuard } from './core/guards/auth.guard';
// Guard que protege cada area: este PERFIL alcanca esta tela?
import { permissaoGuard } from './core/guards/permissao.guard';
// Guard das telas publicas: quem JA esta logado nao precisa delas.
import { visitanteGuard } from './core/guards/visitante.guard';

/**
 * MAPA DE ROTAS DO EDUMANAGER
 * ===========================
 *
 * ESTRUTURA
 * ---------
 *  /login  ................. fica FORA do layout e sem guard (quem nao esta logado
 *                            precisa conseguir abrir esta tela).
 *  rota ''  ................ rota PAI, com o MainLayout (menu lateral + topo) e
 *                            protegida pelo authGuard. Todas as telas internas sao
 *                            FILHAS dela, entao aparecem dentro do <router-outlet>
 *                            do layout e herdam automaticamente a protecao.
 *  '**'  ................... curinga: qualquer endereco desconhecido volta pro inicio.
 *
 * TRES ROTAS POR MODULO DE CRUD
 * -----------------------------
 * Cada modulo repete o mesmo trio, e os nove sao identicos nisso:
 *
 *   /students            -> a LISTAGEM   (StudentsComponent)
 *   /students/new        -> CADASTRAR    (StudentFormComponent, sem id)
 *   /students/:id/edit   -> EDITAR       (StudentFormComponent, com id)
 *
 * Cadastrar e editar abrem o MESMO componente de formulario: a unica diferenca
 * e o parametro :id. O componente le esse parametro e decide se faz POST ou PUT.
 * Duas telas quase iguais seriam dois lugares para corrigir o mesmo bug.
 *
 * A ORDEM IMPORTA: 'new' vem antes de ':id/edit'. O Router testa as rotas de
 * cima para baixo; se ':id/edit' viesse primeiro, nada mudaria aqui (porque
 * 'new' nao casa com ':id/edit'), mas manter o literal antes do parametro e a
 * convencao que evita surpresa quando alguem adicionar outra rota literal.
 *
 * LAZY LOADING
 * ------------
 * Cada tela usa `loadComponent: () => import(...)`. O Angular so baixa o arquivo
 * daquela tela quando o usuario entra na rota, em vez de carregar o sistema todo
 * no primeiro acesso. E a forma mais simples de lazy loading com componentes
 * standalone (nao precisa de NgModule).
 *
 * CONVENCAO DE NOMES (siga exatamente para nao quebrar os imports):
 *   pasta da feature   ->  src/app/features/<modulo>/
 *   arquivo da lista   ->  <modulo>.component.ts        -> <Modulo>Component
 *   arquivo do form    ->  <modulo-singular>-form/<modulo-singular>-form.component.ts
 *
 * SOBRE OS TEXTOS
 * ---------------
 * Os caminhos (path) estao em INGLES, iguais a pasta e ao endpoint da API
 * (/students = features/students = GET /students). Os rotulos que o usuario le
 * ficam em PORTUGUES, no menu lateral. Decisao registrada no contrato.
 */
export const routes: Routes = [
  // ------------------------------------------------------------------
  // 1) LOGIN - fora do layout e sem guard (quem nao esta logado precisa abrir)
  // ------------------------------------------------------------------
  {
    path: 'login',
    canActivate: [visitanteGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // ------------------------------------------------------------------
  // 1.1) CRIAR CONTA - tambem publica, pelo mesmo motivo do login: quem vai se
  //      cadastrar, por definicao, ainda nao tem conta para autenticar.
  //
  //      A tela cria um ALUNO (/students), a CREDENCIAL dele (/users) com role
  //      'aluno' e a MATRICULA na turma do curso escolhido. Conta de
  //      administrador nao pode ser criada por aqui: sai da tela de Usuarios,
  //      que e exclusiva de quem ja e administrador.
  // ------------------------------------------------------------------
  {
    path: 'criar-conta',
    canActivate: [visitanteGuard],
    loadComponent: () =>
      import('./features/auth/criar-conta/criar-conta.component').then(
        (m) => m.CriarContaComponent,
      ),
  },

  // ------------------------------------------------------------------
  // 2) AREA INTERNA - rota pai com o layout (menu lateral + topo) e protegida.
  //    Todas as telas internas sao FILHAS, entao aparecem dentro do
  //    <router-outlet> do layout e herdam a protecao do guard.
  // ------------------------------------------------------------------
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      // --- Dashboard ---
      {
        path: 'dashboard',
        canActivate: [permissaoGuard],
        data: { area: 'dashboard' },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },

      // =============== ACADEMICO ===============

      // --- Alunos ---
      {
        path: 'students',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'students' },
            loadComponent: () =>
              import('./features/students/students.component').then((m) => m.StudentsComponent),
          },
          {
            path: 'new',
            canActivate: [permissaoGuard],
            data: { area: 'students', acao: 'criar' },
            loadComponent: () =>
              import('./features/students/student-form/student-form.component').then(
                (m) => m.StudentFormComponent,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [permissaoGuard],
            data: { area: 'students', acao: 'editar' },
            loadComponent: () =>
              import('./features/students/student-form/student-form.component').then(
                (m) => m.StudentFormComponent,
              ),
          },
        ],
      },

      // --- Cursos ---
      {
        path: 'courses',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'courses' },
            loadComponent: () =>
              import('./features/courses/courses.component').then((m) => m.CoursesComponent),
          },
          {
            path: 'new',
            canActivate: [permissaoGuard],
            data: { area: 'courses', acao: 'criar' },
            loadComponent: () =>
              import('./features/courses/course-form/course-form.component').then(
                (m) => m.CourseFormComponent,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [permissaoGuard],
            data: { area: 'courses', acao: 'editar' },
            loadComponent: () =>
              import('./features/courses/course-form/course-form.component').then(
                (m) => m.CourseFormComponent,
              ),
          },
        ],
      },

      // --- Turmas ---
      {
        path: 'classes',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'classes' },
            loadComponent: () =>
              import('./features/classes/classes.component').then((m) => m.ClassesComponent),
          },
          {
            path: 'new',
            canActivate: [permissaoGuard],
            data: { area: 'classes', acao: 'criar' },
            loadComponent: () =>
              import('./features/classes/class-form/class-form.component').then(
                (m) => m.ClassFormComponent,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [permissaoGuard],
            data: { area: 'classes', acao: 'editar' },
            loadComponent: () =>
              import('./features/classes/class-form/class-form.component').then(
                (m) => m.ClassFormComponent,
              ),
          },
        ],
      },

      // --- Matriculas ---
      {
        path: 'enrollments',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'enrollments' },
            loadComponent: () =>
              import('./features/enrollments/enrollments.component').then(
                (m) => m.EnrollmentsComponent,
              ),
          },
          {
            path: 'new',
            canActivate: [permissaoGuard],
            data: { area: 'enrollments', acao: 'criar' },
            loadComponent: () =>
              import('./features/enrollments/enrollment-form/enrollment-form.component').then(
                (m) => m.EnrollmentFormComponent,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [permissaoGuard],
            data: { area: 'enrollments', acao: 'editar' },
            loadComponent: () =>
              import('./features/enrollments/enrollment-form/enrollment-form.component').then(
                (m) => m.EnrollmentFormComponent,
              ),
          },
        ],
      },

      // =============== OPERACAO ===============

      // --- Financeiro: LANCAMENTOS ---
      // Duas telas, e nao uma, porque sao duas entidades (requisito 10):
      //   /financial      -> os LANCAMENTOS (o combinado de cada matricula)
      //   /financial/:id  -> o lancamento aberto, com as PARCELAS dele e o
      //                      botao de confirmar pagamento
      // O detalhe nao tem acao 'editar' na rota de proposito: a tela e de
      // leitura para todos os perfis, e a confirmacao de pagamento que ela
      // oferece e checada dentro do componente (podeEditar('payments')).
      {
        path: 'financial',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'financial' },
            loadComponent: () =>
              import('./features/financial/financial.component').then((m) => m.FinancialComponent),
          },
          {
            path: ':id',
            canActivate: [permissaoGuard],
            data: { area: 'financial' },
            loadComponent: () =>
              import('./features/financial/financial-detail/financial-detail.component').then(
                (m) => m.FinancialDetailComponent,
              ),
          },
        ],
      },

      // --- Financeiro: PARCELAS ---
      {
        path: 'payments',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'payments' },
            loadComponent: () =>
              import('./features/payments/payments.component').then((m) => m.PaymentsComponent),
          },
          {
            path: 'new',
            canActivate: [permissaoGuard],
            data: { area: 'payments', acao: 'criar' },
            loadComponent: () =>
              import('./features/payments/payment-form/payment-form.component').then(
                (m) => m.PaymentFormComponent,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [permissaoGuard],
            data: { area: 'payments', acao: 'editar' },
            loadComponent: () =>
              import('./features/payments/payment-form/payment-form.component').then(
                (m) => m.PaymentFormComponent,
              ),
          },
        ],
      },

      // --- Frequencia ---
      {
        path: 'attendances',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'attendances' },
            loadComponent: () =>
              import('./features/attendances/attendances.component').then(
                (m) => m.AttendancesComponent,
              ),
          },
          // CHAMADA: a tela de trabalho do professor. Escolhe turma e data,
          // ve os alunos matriculados e marca presenca de todos de uma vez.
          // Fica ANTES de ':id/edit' porque 'chamada' e um caminho literal:
          // se o parametro viesse primeiro, o Router entenderia "chamada"
          // como um id.
          {
            path: 'chamada',
            canActivate: [permissaoGuard],
            data: { area: 'attendances', acao: 'criar' },
            loadComponent: () =>
              import('./features/attendances/chamada/chamada.component').then(
                (m) => m.ChamadaComponent,
              ),
          },
          {
            path: 'new',
            canActivate: [permissaoGuard],
            data: { area: 'attendances', acao: 'criar' },
            loadComponent: () =>
              import('./features/attendances/attendance-form/attendance-form.component').then(
                (m) => m.AttendanceFormComponent,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [permissaoGuard],
            data: { area: 'attendances', acao: 'editar' },
            loadComponent: () =>
              import('./features/attendances/attendance-form/attendance-form.component').then(
                (m) => m.AttendanceFormComponent,
              ),
          },
        ],
      },

      // =============== GESTAO ===============

      // --- Usuarios ---
      // Area exclusiva do administrador. O menu esconde o item dos outros
      // perfis E o permissaoGuard nega a rota: esconder sozinho nao restringia
      // nada, porque bastava digitar /users na barra de endereco.
      {
        path: 'users',
        children: [
          {
            path: '',
            canActivate: [permissaoGuard],
            data: { area: 'users' },
            loadComponent: () =>
              import('./features/users/users.component').then((m) => m.UsersComponent),
          },
          {
            path: 'new',
            canActivate: [permissaoGuard],
            data: { area: 'users', acao: 'criar' },
            loadComponent: () =>
              import('./features/users/user-form/user-form.component').then(
                (m) => m.UserFormComponent,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [permissaoGuard],
            data: { area: 'users', acao: 'editar' },
            loadComponent: () =>
              import('./features/users/user-form/user-form.component').then(
                (m) => m.UserFormComponent,
              ),
          },
        ],
      },

      // --- Relatorios ---
      // Tela de LEITURA: nao tem cadastro nem edicao, entao nao tem o trio de
      // rotas. E uma rota so.
      {
        path: 'reports',
        canActivate: [permissaoGuard],
        data: { area: 'reports' },
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },

      // --- Acesso negado ---
      // Fica DENTRO do layout de proposito: o usuario continua logado e com o
      // menu do lado, entao ele ve na hora para onde pode ir. E nao tem
      // permissaoGuard - negar a tela que explica a negacao seria um laco
      // infinito de redirecionamento.
      {
        path: 'sem-acesso',
        loadComponent: () =>
          import('./features/auth/sem-acesso/sem-acesso.component').then(
            (m) => m.SemAcessoComponent,
          ),
      },

      // Entrou em http://localhost:4200/ e esta logado -> cai no dashboard.
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // ------------------------------------------------------------------
  // 3) CURINGA - endereco que nao existe volta para o inicio
  // ------------------------------------------------------------------
  { path: '**', redirectTo: '' },
];
