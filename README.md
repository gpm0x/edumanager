# EduManager

**Sistema de gestão de uma escola de cursos: do cadastro do aluno à confirmação do pagamento.**

Projeto acadêmico — Análise e Desenvolvimento de Sistemas.
Angular 21 (standalone, zoneless) · Angular Material 3 · JSON Server.

---

## O problema

Uma escola de cursos registra tudo em planilhas separadas: uma de alunos, uma de turmas, uma de mensalidades, uma de presença. Ninguém sabe qual está atualizada, e **todo mundo vê tudo** — o aluno que pede o próprio boleto recebe a planilha com a inadimplência da escola inteira.

O EduManager resolve três coisas:

1. **unifica os cadastros** em um sistema com relacionamentos reais por id;
2. **integra os processos**: uma matrícula gera o financeiro dela sozinha, e confirmar um pagamento muda a situação da matrícula;
3. **cada pessoa vê apenas o que lhe diz respeito** — e isso é testado, não prometido.

## O fluxo que o sistema cobre

É um fluxo só, de ponta a ponta, e todas as telas são pontos dele:

```
 ALUNO                          SISTEMA                        ADMINISTRADOR
   │                               │                                  │
   │ cria a conta, escolhe o       │                                  │
   │ curso e como vai pagar  ──▶   │ cadastro + credencial            │
   │                               │ + matrícula (pendente)           │
   │                               │ + lançamento financeiro          │
   │                               │ + parcelas (todas pendentes)     │
   │   ◀── entra já logado         │                                  │
   │       no painel dele          │   a nova matrícula e o   ──▶     │
   │                               │   pagamento pendente             │
   │                               │   aparecem no painel             │
   │                               │                                  │
   │                               │   ◀── confirma o recebimento     │
   │                               │        de uma parcela            │
   │                               │ parcela paga                     │
   │                               │ + saldo recalculado              │
   │                               │ + lançamento: parcialmente pago  │
   │                               │ + matrícula: pendente → ativa    │
   │   ◀── vê a matrícula ativa    │                                  │
   │       e o saldo que falta     │                                  │
   │                               │                                  │
 PROFESSOR ──▶ escolhe a turma e a data, marca presença e falta
   │                               │
   │   ◀── o aluno consulta a própria frequência
```

Nada nesse caminho é digitado duas vezes, e nenhuma etapa é simulada: cada seta é uma gravação no JSON Server.

## Os módulos

| Módulo                   | O que registra                                                                |
| ------------------------ | ----------------------------------------------------------------------------- |
| Alunos                   | Cadastro das pessoas, com CPF validado por dígitos verificadores              |
| Cursos                   | Catálogo: carga, valor, **professor responsável** e **limite de parcelas**    |
| Turmas                   | As ofertas de cada curso: período, turno, capacidade e **professor da turma** |
| Matrículas               | A ligação aluno ↔ turma, com situação que acompanha o financeiro              |
| **Lançamentos**          | O **combinado** de cada matrícula: valor, condição, forma e saldo             |
| **Parcelas**             | Cada pedaço do combinado, com vencimento e confirmação de pagamento           |
| **Chamada** · Frequência | Presença da turma inteira em uma tela, e o histórico por aluno, turma e data  |
| Usuários · Relatórios    | Credenciais de acesso e consultas de leitura                                  |

**Lançamento e parcela são duas telas porque são duas perguntas.** "Quanto este aluno deve e quanto já pagou?" se responde no lançamento; "o que vence esta semana?" se responde nas parcelas. Em uma tela só, a soma dos valores enganaria — a mesma dívida apareceria uma vez por parcela.

## Os três perfis

| Perfil            | Alcança                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Administrador** | Tudo: catálogo, turmas, matrículas, financeiro, frequência e credenciais.                                                                  |
| **Professor**     | Somente os cursos de que é responsável: as turmas, as matrículas e a frequência deles. **Não** acessa o financeiro.                        |
| **Aluno**         | Somente o próprio cadastro: matrículas (e se matricular em outro curso), mensalidades (e **pagar** as pendentes) e frequência por curso.    |

Os três respondem a perguntas de escopo **diferentes**, e é isso que faz o controle de acesso valer a pena demonstrar:

```
admin      → escopo irrestrito    (nenhum filtro se aplica)
professor  → escopo por VINCULO   (as turmas de que é responsável)
aluno      → escopo por IDENTIDADE (ele mesmo, e só)
```

### A regra que sustenta o controle de acesso

O aluno **não** é filtrado pela turma em que estuda, e sim pelo próprio id. O professor é o oposto exato: para ele o filtro certo **é** por turma.

```
Turma INF-2026-2
  ├─ matrícula da Ana    ← a Ana vê esta;      o professor vê as duas
  └─ matrícula do Bruno  ← e NÃO vê esta;      (os dois são alunos dele)
```

Trocar um filtro pelo outro não quebra tela nenhuma: vazaria o dado do colega (no caso do aluno) ou entregaria uma tela vazia (no caso do professor). Há teste automatizado para os dois lados.

### O que o professor não pode

Está na matriz, e tem teste: ele **não** abre o cadastro de usuários (nem para ver), **não** cria administradores, **não** altera as próprias permissões, **não** exclui registro nenhum, **não** altera valor ou parcela de ninguém, e **não** vê turma que não é dele — mesmo trocando o id na barra de endereço.

---

## Como rodar

Precisa de **Node.js 20.19+, 22.12+ ou 24+** (declarado em `engines`, no `package.json`) e npm 10+.

```bash
npm install

# Terminal 1 — a API (JSON Server na porta 3000)
npm run api

# Terminal 2 — a aplicação (porta 4200)
npm start
```

Abra `http://localhost:4200`.

> **Os dois terminais são obrigatórios.** Sem o `npm run api`, as telas abrem mas não carregam dado nenhum — é a falha mais comum na primeira execução.

> **O `npm run api` roda sem `--watch`, e isso é deliberado.** Com `--watch`, o JSON Server relê o `db.json` do disco depois de cada gravação; numa rajada de escritas (uma matrícula grava 4 a 6 registros seguidos) ele pode recarregar uma versão desatualizada do arquivo e **perder um registro recém-criado** — comprovado durante os testes: o lançamento financeiro desapareceu entre a criação e a leitura seguinte. Se você precisar editar o `db.json` à mão e ver o efeito sem reiniciar, use `npm run api:watch`, ciente desse risco.

### As duas bases do repositório

O `api/db.json` — a base que a API lê — vem **mínima**: um administrador, um professor, um aluno, um curso e a turma dele. **Nenhuma matrícula, nenhum lançamento, nenhuma parcela.** É o estado para começar do zero, porque cadastrar, matricular e confirmar o pagamento é justamente o que a demonstração faz.

O `api/db.seed.json` é a base **de demonstração**, com o histórico já formado: 3 cursos, 3 turmas, 2 alunos, 3 matrículas, 5 parcelas e a chamada de três aulas. Serve para ver as telas cheias — relatórios, saldo, frequência — sem digitar nada:

```bash
cp api/db.seed.json api/db.json    # troca para a base cheia
git checkout api/db.json           # volta para a base mínima
```

Reinicie o `npm run api` depois de trocar o arquivo: sem `--watch`, ele lê o `db.json` uma única vez, ao subir.

### Contas de demonstração

A tela de login aceita **e-mail ou login** no mesmo campo: `admin` e `admin@edumanager.com.br` entram na mesma conta.

Ao abrir `/login`, um modal oferece os três perfis e **preenche** os campos — a confirmação continua no botão Entrar.

| Login         | Senha           | Perfil        | O que demonstra                                               |
| ------------- | --------------- | ------------- | ------------------------------------------------------------- |
| `admin`       | `admin123`      | Administrador | O sistema completo, inclusive confirmar pagamento             |
| `professor`   | `prof123`       | Professor     | Só os cursos e turmas dele; a chamada; sem financeiro         |
| `aluno`       | `123456`        | Aluno         | Vê só o que é dela: matricula-se e paga as próprias parcelas  |

**O professor e o administrador são a mesma pessoa** (Carlos Eduardo Nunes), com duas credenciais: a escola tem um responsável que também dá as três aulas. É o que o enunciado descreve, e é o que permite demonstrar o perfil restrito sem inventar um segundo professor.

Para ver a restrição funcionando: entre como `aluno` e digite `/students` na barra de endereço; ou entre como `professor` e digite `/users`.

Para ver o **isolamento entre dois alunos** da mesma turma, use a base de demonstração (`api/db.seed.json`): ela tem um segundo aluno — `gabrielmota` / `Gabrielmota12` — matriculado na mesma `INF-2026-2`.

---

## Arquitetura

```
src/app/
├── core/                         a base, sem tela
│   ├── models/                   as 8 entidades + a classe base Pessoa (herança)
│   ├── services/                 um service por coleção, herdando de BaseApiService
│   │   ├── acesso.service.ts     ← a matriz de permissões e os filtros de dados
│   │   └── financeiro.service.ts ← as regras do dinheiro (parcelas, confirmação)
│   ├── guards/                   authGuard, permissaoGuard, visitanteGuard
│   └── validators/               CPF, limites de texto, datas, senha, mensagens
├── features/                     uma pasta por módulo (lista + formulário)
│   ├── financial/                lançamentos: lista e detalhe com as parcelas
│   └── attendances/chamada/      a tela de trabalho do professor
├── layout/                       a casca: menu lateral e cabeçalho
└── shared/                       9 componentes reaproveitados pelos módulos
```

### Decisões técnicas que valem explicar

**Herança nos dois níveis.** Na camada Model, `Pessoa` é classe abstrata e `StudentModel` herda dela os quatro campos de pessoa e os métodos que os usam (`getCpfFormatado`, `getPrimeiroNome`). Na camada de serviço, `BaseApiService<T>` é uma classe base **genérica** de onde os **8 services de coleção** herdam os cinco métodos do CRUD — escritos uma única vez, tipados por coleção.

**As regras de negócio não moram nas telas.** `FinanceiroService` não tem coleção própria: ele orquestra `/financialRecords`, `/payments` e `/enrollments` para cumprir o requisito financeiro. Existe porque a matrícula nasce em **dois** lugares (o autocadastro e a tela do administrador) e os dois precisam gerar o financeiro exatamente igual — regra escrita duas vezes é regra que um dia divergiu.

**Dinheiro é contado em centavos inteiros.** `0.1 + 0.2` em JavaScript não dá `0.3`. Dividir R$ 1.000 em 3 vezes com decimais faz a soma das parcelas não fechar com o total — um erro que não quebra tela nenhuma e aparece só no fechamento do mês. A divisão é feita em inteiros e a sobra vai na **última** parcela, então a soma é exata. Há 27 testes só disso.

**Permissão em três camadas, e quatro ações.** Esconder item do menu não restringe nada: bastava digitar a URL. Então o menu esconde (conveniência), o `permissaoGuard` nega a rota, e os filtros de dados recortam os registros. As três camadas leem a **mesma** tabela, em `acesso.service.ts`. As ações são `ver`, `criar`, `editar` e `excluir` — e não um "gerenciar" único: sem essa separação, liberar a edição de turma ao professor liberaria também criar e excluir.

**Controle de acesso por registro, e não só por tela.** A rota garante que o _perfil_ alcança a área; ela não garante que ele alcança _aquele_ registro. O detalhe do lançamento, o formulário de curso e o de turma conferem o dono antes de abrir — sem isso, trocar o id na URL leria o financeiro de um colega ou editaria o curso de outro professor.

**O escopo falha fechado.** Aluno sem vínculo cadastrado (`studentId`) não vê nada. Falhar aberto mostraria a base inteira por causa de um campo esquecido.

**Projeto zoneless.** Não existe `zone.js` nas dependências. Todo estado que muda depois de uma chamada HTTP é `signal` — atribuir propriedade comum dentro de um `subscribe` não redesenharia a tela.

**Validação em dois níveis.** O formulário valida o que dá para validar sozinho (formato, limites, dígitos de CPF); a API valida o que depende dos outros registros (CPF duplicado, e-mail em uso, capacidade da turma, chamada duplicada, exclusão com dependentes).

**Compensação no lugar de transação.** O JSON Server não tem transação. O autocadastro grava **quatro** coisas em cadeia (aluno → credencial → matrícula → lançamento com as parcelas); se uma falhar, as anteriores são apagadas na ordem inversa. Sem isso, a pessoa ficaria cadastrada sem conseguir entrar — e a nova tentativa bateria em "CPF já cadastrado", trancando-a fora do sistema. A exceção deliberada é a confirmação de pagamento: se o recálculo falhar depois de a parcela ser paga, o pagamento **fica**, porque "o dinheiro entrou" é o dado importante e o status derivado se corrige depois.

**Nada é marcado como pago sozinho.** Escolher PIX, dinheiro ou cartão na matrícula registra uma intenção, não uma cobrança. Lançamento e parcelas nascem `pendente`; só a confirmação do administrador — com diálogo de confirmação, porque é operação de dinheiro — muda isso. E existe estorno, porque se dá para errar tem que dar para corrigir dentro do sistema.

---

## As entidades e como elas se ligam

```
users ──────── teacherId ──────▶ courses ◀── courseId ── classes
  │ studentId                                               │
  ▼                                                         │ classId
students ◀── studentId ── enrollments ───────────────────────┘
                              │ id
                              ▼
                      financialRecords ◀── financialRecordId ── payments
                              (o combinado)                     (as parcelas)

attendances ── classId + courseId + studentId + date   (chave que não repete)
```

**Situações e como elas conversam:**

| Entidade   | Situações                                             | Quem muda                           |
| ---------- | ----------------------------------------------------- | ----------------------------------- |
| Matrícula  | `pendente` → `ativa` · `cancelada` · `concluida`      | a confirmação da 1ª parcela ativa   |
| Lançamento | `pendente` · `parcialmente_pago` · `pago` · `vencido` | recalculado a cada parcela que muda |
| Parcela    | `pendente` · `pago` · `vencido`                       | o administrador confirma ou estorna |

O `vencido` entra quando alguém abre o sistema e o vencimento já passou — o JSON Server não tem rotina agendada, então não existe "virar vencido" de madrugada.

---

## Qualidade

```bash
npm test      # 138 testes (Vitest)
npm run build
```

Os testes cobrem o que **não se descobre usando o sistema**:

- **CPF** (37 testes) — os dígitos verificadores, incluindo todos os CPFs do `db.json`.
- **Controle de acesso** (40 testes) — a matriz dos 3 perfis × 4 ações e os 7 filtros de dados. Uma permissão com defeito não aparece na tela: ela funciona silenciosamente ao contrário.
- **Regras financeiras** (27 testes) — a divisão em parcelas (a soma fecha com o total em 35 combinações de valor e quantidade), os vencimentos mensais, o dia 31 que não existe em fevereiro, a situação do lançamento e o saldo.
- **Senha do autocadastro** (20 testes) — força mínima e confirmação, incluindo a armadilha do validador de grupo que apaga os erros dos outros campos.
- **Autenticação** (14 testes) — e-mail e login no mesmo campo, sessão que sobrevive ao F5, sessão corrompida na mão, logout, e os três desfechos que a tela precisa separar: senha errada, conta desativada e API fora do ar.

O que **não** está em teste automatizado: as gravações em cadeia (`criarLancamento`, `confirmarPagamento`, `recalcular`). Elas dependem de três coleções da API, e o valor do teste seria em boa parte simular o JSON Server. Estão verificadas com a API rodando, no roteiro abaixo.

### Roteiro verificado com a API rodando

O fluxo do enunciado foi executado de ponta a ponta contra o JSON Server, nas mesmas chamadas e na mesma ordem que as telas fazem — sobre a base de demonstração (`api/db.seed.json`), que é a que tem os 3 cursos e os alunos já matriculados. **28 verificações, todas passando**, e a base voltou ao estado inicial no fim:

| Etapa                        | O que foi conferido                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Catálogo                     | os 3 cursos preservados, os 3 com professor responsável                                              |
| Cadastro + matrícula à vista | matrícula nasce `pendente`; 1 parcela com o valor integral; tudo `pendente`                          |
| Confirmação (admin)          | lançamento → `pago`; matrícula `pendente` → `ativa`; data gravada                                    |
| Consulta do aluno            | alcança exatamente 1 matrícula e 1 parcela: as dele                                                  |
| Professor                    | 3 cursos; a turma com os 3 matriculados visíveis                                                     |
| Chamada                      | gravada para os 3; presença **e** falta; sem duplicidade aluno/turma/data                            |
| Matrícula parcelada em 3×    | 3 parcelas, soma **R$ 1.200,00 = total**, vencimentos mensais em ordem                               |
| Confirmações sucessivas      | 1 de 3 → `parcialmente_pago`; 2 de 3 → `parcialmente_pago`; 3 de 3 → `pago`                          |
| Integridade                  | e-mail e CPF duplicados detectáveis; nenhuma parcela sem lançamento; nenhum lançamento sem matrícula |

Além disso: `npm run build` sem erro de TypeScript, e `npx prettier --check` limpo.

---

## Limitações conscientes

**A restrição de acesso é de interface, não de servidor.** O JSON Server entrega qualquer rota a quem pedir: um aluno que abrir o DevTools e chamar `GET /students` recebe os dados. Num sistema real a mesma matriz precisaria existir **no backend**, e o front seria apenas a conveniência de não mostrar o que vai ser negado.

**O escopo do professor recorta no navegador.** O JSON Server não sabe responder "as turmas cujo `courseId` esteja nesta lista" nem fazer OU entre dois filtros. Então a tela pede as coleções e recorta aqui — a resposta da API chega ao navegador do professor com as turmas e matrículas da escola inteira antes do recorte. A tela mostra o certo; o dado dos outros passou por ali.

**Não há transação.** Cada gravação é uma requisição. Onde isso importa, há compensação manual (apagar o que foi criado) — e, na chamada, falha parcial é **tolerada** em vez de desfeita: apagar as presenças que deram certo por causa de uma que falhou perderia trabalho correto do professor. A tela avisa e recarrega, e salvar de novo atualiza em vez de duplicar.

**O `--watch` do JSON Server perde registro sob rajada de escritas** — ver o aviso em "Como rodar". Por isso o script padrão não o usa. Sem `--watch`, 30 gravações seguidas foram verificadas sem nenhuma perda.

**O JSON Server CASCATEIA exclusão, em silêncio.** Isto foi comprovado durante os testes e é o oposto do que o requisito 11 pede:

```
POST /students      → aluno 3
POST /attendances   → frequência 7 (studentId 3)
POST /enrollments   → matrícula 4 (studentId 3)
DELETE /students/3  → 200
GET /attendances/7  → não existe mais
GET /enrollments/4  → não existe mais
```

Um `DELETE` que chegue ao servidor **apaga os dependentes junto**, sem aviso e sem log. Nenhuma tela do sistema permite isso: todas conferem os dependentes antes e **bloqueiam** a exclusão (requisito 11). Mas vale saber que, aqui, essa verificação não é conveniência de interface — ela é a **única** coisa entre um clique e a destruição do histórico acadêmico e financeiro de um aluno. Num banco relacional, `ON DELETE RESTRICT` faria esse trabalho no servidor.

**A senha fica em texto puro no `db.json`.** O JSON Server não tem camada de autenticação nem criptografia. Em produção seria hash (bcrypt) no servidor, com token de sessão.

**O `paymentMethod` não cobra nada.** Não há gateway, integração bancária, nota fiscal nem certificado — estão fora do escopo do trabalho, por decisão do enunciado.

Todas essas escolhas estão documentadas no código, onde importam.

---

## Documentação

| Documento                                                            | Conteúdo                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| [`docs/dicionario-de-dados.md`](docs/dicionario-de-dados.md)         | As 8 coleções, campo a campo, com limites e regras   |
| [`docs/endpoints.md`](docs/endpoints.md)                             | Todas as requisições à API, com exemplos de resposta |
| [`docs/checklist-de-testes.md`](docs/checklist-de-testes.md)         | Cenários de teste manual, incluindo os de permissão  |
| [`docs/roteiro-de-apresentacao.md`](docs/roteiro-de-apresentacao.md) | Ordem de demonstração e perguntas prováveis          |
| [`src/app/shared/README.md`](src/app/shared/README.md)               | Os componentes compartilhados e as classes CSS       |

O visual é documentado no topo de [`src/styles.scss`](src/styles.scss): identidade **"Campus Vivo"** — esmeralda é estrutura, coral é ação, âmbar é espera, e o coral ganhou um segundo uso no status "parcialmente pago", que é cobrança a fazer.
