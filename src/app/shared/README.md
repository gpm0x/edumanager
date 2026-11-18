# src/app/shared - Componentes e padroes visuais do EduManager

Dono desta pasta: **VITRAL** (Frontend).
Quem consome: **ENGRENAGEM** (os 9 modulos de CRUD) e as telas do proprio Vitral.

Regra de convivencia: a assinatura abaixo esta **fechada**. Se faltar algo, chame o
Vitral que ele **adiciona** um componente novo, sem alterar o que ja existe.

---

## 1. Como importar

Tudo sai do barrel `src/app/shared/index.ts`:

```ts
import {
  PageHeaderComponent,
  EmptyStateComponent,
  SearchFieldComponent,
  StatusChipComponent,
  FormActionsComponent,
  LoadingComponent,
  StatCardComponent,
  ConfirmService,
} from '../../shared';
```

Como o projeto e **standalone**, cada componente usado no template precisa estar
no `imports` do decorator da sua tela:

```ts
@Component({
  selector: 'app-students',
  imports: [PageHeaderComponent, SearchFieldComponent, StatusChipComponent /* ... */],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
```

`ConfirmService` **nao** entra no `imports`: service se usa com `inject()`.

---

## 2. Os 8 componentes

### 2.1 `<app-page-header>`

Cabecalho de toda tela interna: titulo a esquerda, botao de acao a direita.

| Entrada          | Tipo      | Padrao  | Observacao                           |
| ---------------- | --------- | ------- | ------------------------------------ |
| `title`          | `string`  | `''`    | Titulo da pagina                     |
| `subtitle`       | `string?` | -       | Linha de apoio                       |
| `actionLabel`    | `string?` | -       | **Se nao vier, o botao nao aparece** |
| `actionIcon`     | `string`  | `add`   | Nome do Material Icons               |
| `actionDisabled` | `boolean` | `false` | Desabilita sem esconder              |

| Saida    | Tipo   |
| -------- | ------ |
| `action` | `void` |

```html
<app-page-header
  title="Alunos"
  subtitle="Cadastro de alunos da instituicao"
  actionLabel="Novo aluno"
  (action)="abrirFormulario()"
>
</app-page-header>
```

### 2.2 `ConfirmService` (+ `<app-confirm-dialog>`)

Confirmacao antes de excluir. **Use o service**, nunca abra o dialog na mao.

```ts
private readonly confirmService = inject(ConfirmService);

excluir(aluno: Student): void {
  this.confirmService
    .confirm({
      title: 'Excluir aluno',
      message: `Confirma a exclusao de ${aluno.name}?`,
      confirmText: 'Excluir',
      danger: true,
    })
    .subscribe((confirmado) => {
      if (confirmado) {
        // chama o service e recarrega a lista
      }
    });
}
```

`ConfirmDialogData`: `title`, `message`, `confirmText?` (padrao Confirmar),
`cancelText?` (padrao Cancelar), `danger?` (padrao `false`; `true` deixa o botao vermelho).
Retorno: `Observable<boolean>` - `true` confirmou, `false` cancelou ou fechou fora.

> Para a **regra 6.8** (exclusao bloqueada por dependentes) nao use o confirm:
> a exclusao nem deve ser oferecida. Mostre a mensagem no `.em-alert-error`
> ou em um `MatSnackBar`, no padrao de texto que o contrato define.

### 2.3 `<app-empty-state>`

Mensagem de lista vazia.

| Entrada       | Tipo      | Padrao                       |
| ------------- | --------- | ---------------------------- |
| `icon`        | `string`  | `inbox`                      |
| `title`       | `string`  | `Nenhum registro encontrado` |
| `message`     | `string?` | -                            |
| `actionLabel` | `string?` | - (sem ele, nao ha botao)    |

| Saida    | Tipo   |
| -------- | ------ |
| `action` | `void` |

### 2.4 `<app-form-actions>`

Rodape de formulario: Cancelar e Salvar.

| Entrada        | Tipo      | Padrao                              |
| -------------- | --------- | ----------------------------------- |
| `saveLabel`    | `string`  | `Salvar`                            |
| `cancelLabel`  | `string`  | `Cancelar`                          |
| `saveDisabled` | `boolean` | `false` (passe `form.invalid`)      |
| `loading`      | `boolean` | `false` (troca o texto por spinner) |

| Saida    | Tipo   |
| -------- | ------ |
| `save`   | `void` |
| `cancel` | `void` |

### 2.5 `<app-search-field>`

Caixa de busca com **debounce de 300ms**.

| Entrada       | Tipo     | Padrao      |
| ------------- | -------- | ----------- |
| `placeholder` | `string` | `Buscar...` |
| `value`       | `string` | `''`        |

| Saida    | Tipo     | Observacao                                                    |
| -------- | -------- | ------------------------------------------------------------- |
| `search` | `string` | Termo digitado, 300ms depois da ultima tecla, ja com `trim()` |

**Regra 6.9 do contrato:** este componente nao chama a API. Quem filtra e a tela,
em memoria, com normalizacao de acento. Receita pronta:

```ts
termo = signal('');
alunos = signal<Student[]>([]);

// computed = recalcula sozinho quando termo() ou alunos() mudam
alunosFiltrados = computed(() => {
  const busca = this.semAcento(this.termo());
  if (!busca) {
    return this.alunos();
  }
  return this.alunos().filter((a) => this.semAcento(a.name).includes(busca));
});

/** Deixa o texto minusculo e sem acento, para "Informatica" achar "informatica". */
private semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
```

### 2.6 `<app-status-chip>`

Etiqueta colorida do status. Passe o status **como vem da API** (em portugues).

| Entrada  | Tipo     |
| -------- | -------- |
| `status` | `string` |

Mapa de cores: **verde** = `ativo`, `ativa`, `pago`, `concluida`, `presente` / **vermelho** =
`vencido`, `cancelada`, `ausente` / **ambar** = `pendente` / **coral** = `parcialmente pago`
(aceita tambem `parcialmente_pago`, como esta gravado) / **cinza** = `inativo` e qualquer
valor desconhecido.

> `pendente` era **azul** na identidade anterior e virou **ambar** na "Campus Vivo":
> ambar e a cor de ESPERA do sistema. Nenhuma tela precisou mudar - quem decide a
> cor e o proprio chip.

> O **coral** estava reservado "para um status futuro que precise da cor de acao", e
> esse status chegou com o modulo financeiro: `parcialmente pago` nao e espera (parte
> do dinheiro entrou) nem problema (o prazo pode nem ter vencido) - e cobranca a
> fazer. O status `atrasado` passou a se chamar `vencido` em 14/11/2026, junto com a
> migracao do `db.json`.

`presente` e `ausente` entraram para a tela de Frequencia, que guarda um boolean
(`present`) e converte antes de passar para o chip:

```html
<app-status-chip [status]="registro.present ? 'presente' : 'ausente'"></app-status-chip>
```

```html
<app-status-chip [status]="aluno.status"></app-status-chip>
```

Para `courses` e `users`, que tem `active: boolean` em vez de `status`:

```html
<app-status-chip [status]="curso.active ? 'ativo' : 'inativo'"></app-status-chip>
```

### 2.7 `<app-stat-card>`

Card de total (Dashboard e Relatorios). Coloque dentro de `.em-cards-grid`.

| Entrada | Tipo                                                     | Padrao     |
| ------- | -------------------------------------------------------- | ---------- |
| `label` | `string`                                                 | `''`       |
| `value` | `string` ou `number`                                     | `0`        |
| `icon`  | `string`                                                 | `insights` |
| `tone`  | `coral` / `emerald` / `green` / `amber` / `red` / `gray` | `coral`    |
| `hint`  | `string?`                                                | -          |
| `ratio` | `number?` (0 a 1)                                        | -          |

`blue` e `navy` continuam aceitos e apontam para `coral` e `emerald`.

**Sobre `ratio`:** desenha uma barra fina na base do card. **So passe quando
existir um todo de verdade** (ativos sobre o total, vagas ocupadas sobre a
capacidade). Sem `ratio` a barra nao aparece - e barra com numero inventado e
pior que card sem barra, porque o usuario acredita nela.

```html
<app-stat-card
  label="Alunos"
  [value]="totalAlunos()"
  icon="people"
  tone="coral"
  [ratio]="totalAtivos() / totalAlunos()"
  [hint]="totalAtivos() + ' ativos'"
>
</app-stat-card>
```

Divisao por zero (base vazia) da `NaN`, e o card entende `NaN` como "sem
barra". Nao precisa conferir o divisor na tela.

### 2.8 `<app-loading>`

Indicador de carregando. Ja tem o `@if` dentro, nao precisa envolver.

| Entrada   | Tipo      | Padrao          |
| --------- | --------- | --------------- |
| `loading` | `boolean` | `false`         |
| `message` | `string`  | `Carregando...` |

### 2.9 `<app-escopo-aviso>`

Faixa que explica por que a lista esta filtrada por permissao. **Nao aparece**
para admin e secretaria (o proprio componente decide, perguntando ao
`AcessoService`), porque para eles nao ha nada escondido.

| Entrada | Tipo     | Padrao |
| ------- | -------- | ------ |
| `texto` | `string` | `''`   |

```html
<app-page-header title="Turmas" ...></app-page-header>

<app-escopo-aviso [texto]="avisoDeEscopo"></app-escopo-aviso>
```

Coloque logo depois do `<app-page-header>`. Cada tela escreve a propria frase
(um getter `avisoDeEscopo` no componente): o motivo e sempre o mesmo, mas o
SUJEITO muda, e em telas que o professor e o aluno dividem a frase precisa
mudar com o perfil.

**Por que este componente existe:** filtrar registro por permissao cria um
problema novo - o usuario ve uma lista incompleta e nao tem como saber que ela
foi filtrada. Um professor que abre "Turmas" e encontra duas, numa escola com
quatro, conclui que a escola tem duas turmas ou que o sistema esta com defeito.
Se o sistema esconde, o sistema avisa que escondeu.

---

## 3. Classes CSS (definidas em `src/styles.scss`)

Sao **classes**, nao componentes, de proposito: tabela e formulario mudam de tela
para tela, e um componente generico viraria abstracao desnecessaria (nota de
regras, item 1). O visual fica igual em todos os modulos porque o CSS e o mesmo.

| Classe                                                  | Onde usar                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `.em-page`                                              | `div` que envolve o conteudo da tela (respiro + largura maxima) |
| `.em-card`                                              | Card branco generico                                            |
| `.em-table-card`                                        | Card branco que embrulha a tabela                               |
| `.em-table-scroll`                                      | Dentro do `.em-table-card`, segura a rolagem lateral no celular |
| `.em-table`                                             | Na propria `table mat-table`                                    |
| `.em-col-actions`                                       | Coluna dos botoes editar/excluir (ultima, alinhada a direita)   |
| `.em-table-toolbar`                                     | Barra acima da tabela (busca e filtros)                         |
| `.em-form-card`                                         | Card branco do formulario                                       |
| `.em-form-grid`                                         | Grade de 2 colunas que vira 1 no celular                        |
| `.em-form-full`                                         | Campo que ocupa as 2 colunas (endereco, descricao)              |
| `.em-form-section`                                      | Subtitulo de secao dentro de um formulario longo                |
| `.em-cards-grid`                                        | Grade responsiva dos `app-stat-card`                            |
| `.em-alert-error`                                       | Mensagem de erro de regra de negocio no topo do formulario      |
| `.em-text-muted`, `.em-text-success`, `.em-text-danger` | Cor de texto                                                    |
| `.em-spacer`                                            | `flex: 1` para empurrar conteudo numa barra                     |
| `.em-col-num`                                           | Coluna de numero, valor ou data: monoespacada e a direita       |
| `.em-display`                                           | Titulo na fonte de titulo do projeto (Bricolage Grotesque)      |
| `.em-meter`                                             | Barra fina de proporcao (ver abaixo)                            |
| `.em-eyebrow`                                           | Rotulo miudo em caixa alta (`ACADEMICO`, `SITUACAO`)            |
| `.em-num`                                               | Numero, codigo ou valor dentro de uma frase                     |

Nenhuma classe mudou de nome entre as identidades visuais: o que ja estava
escrito nos modulos continua funcionando e ganhou o visual novo de graca.

**`.em-meter`** (nova na "Campus Vivo") desenha uma barra de proporcao. A
largura do preenchimento entra por variavel CSS, nunca por classe:

```html
<span class="em-meter" [style.--em-meter-fill]="ocupacaoDaTurma()"></span>
```

O valor e uma porcentagem CSS (`'72%'`). Quem calcula e a tela - e vale a mesma
regra do `ratio` do stat-card: barra so com proporcao real.

**Regra pratica:** todo dado que e numero (valor em reais, data, CPF, codigo de
turma, matricula) sai com `.em-num` no meio de um texto ou com `.em-col-num`
quando e coluna de tabela. Isso alinha as colunas e e o detalhe que faz a tela
parecer um registro, nao uma planilha.

### 3.1 Padrao de TELA DE LISTA (copie e troque os nomes)

```html
<div class="em-page">
  <app-page-header title="Alunos" actionLabel="Novo aluno" (action)="novo()"> </app-page-header>

  <div class="em-table-card">
    <div class="em-table-toolbar">
      <app-search-field placeholder="Buscar aluno..." (search)="termo.set($event)">
      </app-search-field>
    </div>

    <app-loading [loading]="carregando()" message="Carregando alunos..."></app-loading>

    @if (!carregando()) { @if (alunosFiltrados().length === 0) {
    <app-empty-state
      title="Nenhum aluno encontrado"
      message="Cadastre o primeiro aluno para comecar."
      actionLabel="Novo aluno"
      (action)="novo()"
    >
    </app-empty-state>
    } @else {
    <div class="em-table-scroll">
      <table mat-table [dataSource]="alunosFiltrados()" class="em-table">
        <!-- colunas de dados aqui -->

        <ng-container matColumnDef="acoes">
          <th mat-header-cell *matHeaderCellDef class="em-col-actions">Acoes</th>
          <td mat-cell *matCellDef="let aluno" class="em-col-actions">
            <button matIconButton type="button" (click)="editar(aluno)">
              <mat-icon>edit</mat-icon>
            </button>
            <button matIconButton type="button" (click)="excluir(aluno)">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="colunas"></tr>
        <tr mat-row *matRowDef="let linha; columns: colunas"></tr>
      </table>
    </div>

    <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
    } }
  </div>
</div>
```

### 3.2 Padrao de FORMULARIO

```html
<form class="em-form-card" [formGroup]="form" (ngSubmit)="salvar()">
  @if (erro()) {
  <div class="em-alert-error">
    <mat-icon>error</mat-icon>
    {{ erro() }}
  </div>
  }

  <div class="em-form-grid">
    <mat-form-field appearance="outline">
      <mat-label>Nome</mat-label>
      <input matInput formControlName="name" />
      @if (form.controls.name.hasError('required')) {
      <mat-error>Informe o nome</mat-error>
      } @if (form.controls.name.hasError('minlength')) {
      <mat-error>Minimo de 3 caracteres</mat-error>
      }
    </mat-form-field>

    <mat-form-field appearance="outline">
      <mat-label>CPF</mat-label>
      <input matInput formControlName="cpf" maxlength="11" />
      @if (form.controls.cpf.hasError('cpfInvalido')) {
      <mat-error>CPF invalido</mat-error>
      }
    </mat-form-field>

    <mat-form-field appearance="outline" class="em-form-full">
      <mat-label>Endereco</mat-label>
      <input matInput formControlName="address" />
    </mat-form-field>
  </div>

  <app-form-actions
    [saveDisabled]="form.invalid"
    [loading]="salvando()"
    (save)="salvar()"
    (cancel)="fechar()"
  >
  </app-form-actions>
</form>
```

Convencoes do formulario: **sempre** `appearance="outline"`, mensagem de erro em
`mat-error`, e o salvar desabilitado com `form.invalid`.

---

## 4. Dois avisos tecnicos do projeto

### 4.1 O projeto e ZONELESS

Nao existe `zone.js` nas dependencias. Consequencia pratica:

```ts
// ERRADO - a tela nao atualiza
this.studentService.listar().subscribe((lista) => (this.alunos = lista));

// CERTO - o signal avisa o Angular que a tela precisa ser redesenhada
alunos = signal<Student[]>([]);
this.studentService.listar().subscribe((lista) => this.alunos.set(lista));
```

Vale para **todo** estado que muda depois de uma chamada HTTP: lista, carregando,
salvando, mensagem de erro.

### 4.2 Material 21 usa Material Design 3

O input `color` dos botoes (`color="primary"`, `color="warn"`) **compila mas nao faz
nada** no MD3. As cores vem do tema em `src/styles.scss` (variaveis `--mat-sys-*`).
Para pintar algo fora do padrao, use as variaveis da identidade visual:
`var(--em-coral-deep)`, `var(--em-emerald)`, `var(--em-green)`, `var(--em-amber-deep)`,
`var(--em-red)`, `var(--em-gray)`, `var(--em-bg)`, `var(--em-surface)`.

### 4.3 Identidade visual "Campus Vivo" (nomes atuais das cores)

Uma escola nao e um arquivo de papel: e um lugar onde gente circula. O visual
abandonou a ficha impressa (a identidade "O Registro", de papel creme e ocre) e
assumiu o campus: **bloco de cor cheia, luz, canto generoso e profundidade**.

Os nomes abaixo sao os atuais. **Todos os nomes antigos continuam valendo** como
atalho e apontam para os novos, entao nenhuma tela precisou ser reescrita:

| Variavel                                 | Uso                                                  | Nomes antigos                       |
| ---------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| `--em-emerald`                           | Estrutura: menu lateral, titulo, cabecalho de tabela | `--em-navy`, `--em-ink`             |
| `--em-emerald-deep` / `-mid`             | Esmeralda de gradiente (fundo / hover no escuro)     | `--em-ink-soft`                     |
| `--em-emerald-soft` / `-tint`            | Fundo suave e suavissimo (hover de linha, barra)     | -                                   |
| `--em-coral-deep`                        | **Acao**: botao cheio, link, foco                    | `--em-blue`, `--em-ochre`           |
| `--em-coral`                             | Coral vivo: marcador, barra de item ativo            | -                                   |
| `--em-coral-soft`                        | Fundo suave da acao (chip, claro de luz do card)     | `--em-blue-soft`, `--em-ochre-soft` |
| `--em-amber-deep` / `--em-amber-soft`    | **Espera**: pendente, aviso                          | -                                   |
| `--em-bg` / `--em-bg-deep`               | Marfim da area de trabalho                           | `--em-paper`                        |
| `--em-surface`                           | Superficie elevada: card, tabela, formulario, dialog | (igual)                             |
| `--em-green` / `--em-red`                | Sucesso / erro e atraso                              | (iguais)                            |
| `--em-line` / `--em-line-soft`           | Linha de divisao (so dentro de tabela e lista)       | `--em-border`, `--em-border-strong` |
| `--em-shadow-sm` / `-` / `-lg`           | Profundidade em tres niveis                          | `--em-shadow`, `--em-shadow-lift`   |
| `--em-radius-xs` ... `-pill`             | Cantos: 8, 10, 14, 20, 28px e pilula                 | `--em-radius*`                      |
| `--em-arcs` / `--em-dots` / `--em-grain` | Motivo dos arcos, malha de pontos, grao do marfim    | `--em-ruled`                        |
| `--em-font-display` / `-text` / `-mono`  | Bricolage Grotesque / Instrument Sans / DM Mono      | (iguais)                            |

Tres regras de convivencia com essa identidade:

1. **Acao e CORAL; estrutura e ESMERALDA.** O botao cheio (criar, salvar,
   confirmar) e coral. O menu, os titulos e o cabecalho da tabela sao
   esmeralda. Isso INVERTEU em relacao a identidade anterior, onde o botao
   principal era a tinta escura - mas a logica e a mesma de antes: uma cor
   sozinha marca "o que fazer agora", e por isso ela aparece pouco.
2. **Separe por PROFUNDIDADE, nao por linha.** `box-shadow: var(--em-shadow)`
   com `border-radius: var(--em-radius-lg)` em vez de `border: 1px solid`. A
   linha de 1px sobrevive em dois lugares, e nos dois ela tem funcao e nao
   decoracao: dividir linhas de tabela e fechar o rodape do formulario.
3. **Uma proporcao na tela precisa ser real.** `.em-meter` e o `ratio` do
   stat-card existem para mostrar conta de dado carregado. Nao preencha barra
   com valor aproximado "para ficar bonito".
