# Dicionário de Dados — EduManager

Fonte: nota `contratos-edumanager` (seção 1 — Contrato de Dados).
Atualizado em 14/11/2026 com o perfil **professor**, os lançamentos financeiros e a chamada.

As **8 coleções**: `users`, `students`, `courses`, `classes`, `enrollments`, `financialRecords`, `payments` (parcelas) e `attendances`.

Regras gerais que valem para todas as coleções:

- Os **nomes dos campos são em inglês** (padrão do contrato). Os **valores de status aparecem em português na tela**.
- O campo `id` é gerado automaticamente pelo JSON Server no POST. Nunca é digitado pelo usuário.
- Os limites de caracteres (mín./máx.) da coluna "Limite" são a **sugestão oficial de QA** para os validadores do Reactive Forms. Servem de referência única para o agente de CRUD e para a checklist de testes.
- Campos de data usam o formato ISO `YYYY-MM-DD` (string), para serem gravados no `db.json` sem perda.
- Campos de relacionamento terminam em `Id` e guardam o `id` do registro referenciado.

Legenda de obrigatoriedade: **Sim** = o formulário não envia sem o campo (`Validators.required`); **Não** = campo opcional, pode ir vazio ou nulo.

---

## 1. users — Usuários do sistema

Quem pode entrar no sistema. Há **dois caminhos** para uma conta existir:

1. **Autocadastro (`/criar-conta`)** — a própria pessoa cria a conta e sai dela com perfil `aluno`. A tela cria **três** registros: o cadastro em `/students`, a credencial em `/users` ligada a ele e a **matrícula** em `/enrollments`, na turma do curso escolhido.

   A pessoa escolhe o **curso**, mas a matrícula aponta para uma **turma** — é a turma que tem turno, período e capacidade. Por isso a tela pede os dois, curso primeiro; quando o curso tem uma única turma aberta, ela já vem selecionada. O catálogo oferece apenas cursos **ativos** com turma **ativa** e **com vaga** (capacidade menos matrículas ativas): oferecer um curso sem turma aberta seria uma escolha que não leva a nada.

   Se nenhum curso tiver turma com vaga, a escolha sai da tela e a conta é criada **sem** matrícula, com aviso para procurar a administração da escola — o autocadastro não para de funcionar por causa do estado do catálogo.

   A vaga é conferida **duas vezes**: ao montar o catálogo (para não oferecer turma lotada) e no envio (porque entre abrir a tela e clicar no botão outra pessoa pode ter ocupado a última vaga). É a mesma regra 6.2 do formulário do administrador.

2. **Cadastro pelo administrador (`/users`)** — qualquer perfil, inclusive `admin`. É o único caminho para a conta de administrador: o autocadastro cria sempre `aluno` e não oferece escolha de perfil.

| Campo       | Tipo    | Obrigatório                   | Limite (mín.–máx.) | Valores permitidos            | Descrição                                                                                                                                                                                                                                                                                |
| ----------- | ------- | ----------------------------- | ------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | number  | Sim (automático)              | —                  | —                             | Identificador único gerado pelo JSON Server.                                                                                                                                                                                                                                             |
| `name`      | string  | Sim                           | 3–80               | —                             | Nome completo do usuário.                                                                                                                                                                                                                                                                |
| `email`     | string  | Sim                           | 5–100              | formato de e-mail             | E-mail da conta. Validado com `Validators.email`. **Único** (ver regra abaixo).                                                                                                                                                                                                          |
| `login`     | string  | Sim                           | 4–20               | sem espaços                   | Identificador usado na tela de login. Deve ser único (`LIMITES.login`).                                                                                                                                                                                                                  |
| `password`  | string  | Sim                           | 6–20               | —                             | Senha de acesso. Projeto acadêmico: fica em texto puro no `db.json` (ver observação abaixo).                                                                                                                                                                                             |
| `role`      | string  | Sim                           | —                  | `admin`, `professor`, `aluno` | Perfil de acesso. Define o que o usuário pode ver e fazer.                                                                                                                                                                                                                               |
| `active`    | boolean | Sim                           | —                  | `true`, `false`               | Se `false`, o usuário existe mas não consegue entrar.                                                                                                                                                                                                                                    |
| `studentId` | number  | **Sim quando `role = aluno`** | —                  | um `students.id` existente    | Qual aluno este usuário **é**. É o que permite mostrar só as matrículas dele. **Não se aplica a `professor`**: o vínculo dele é o contrário — são `courses.teacherId` e `classes.teacherId` que apontam para o `id` deste usuário, porque um professor pode responder por vários cursos. |

**Validações do autocadastro (`/criar-conta`).** Quatro delas, em dois níveis:

| Campo      | Validado no formulário                                                              | Validado na API (antes de gravar)         |
| ---------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `cpf`      | 11 dígitos e **dígitos verificadores** corretos (`cpfValidator`)                    | `GET /students?cpf=` — CPF já cadastrado  |
| `email`    | formato de e-mail (`Validators.email`) e até 100 caracteres                         | `GET /users?email=` — e-mail já tem conta |
| `login`    | de 4 a 20 caracteres                                                                | `GET /users?login=` — login em uso        |
| `password` | de 6 a 20 caracteres, com **pelo menos uma letra e um número**, digitada duas vezes | —                                         |

As três consultas de duplicidade vão **em paralelo** (`forkJoin`) e o resultado é marcado **no campo correspondente**, não num alerta no topo — a mensagem aparece embaixo do dado errado, como qualquer outro erro de validação. Uma consulta por vez faria a pessoa corrigir o e-mail, enviar, e só então descobrir que o login também estava em uso.

A exigência de letra **e** número existe só no autocadastro: quando o administrador cadastra alguém, há um adulto responsável no meio do caminho; quando a pessoa escolhe sozinha, sem exigência nenhuma a senha seria `123456`.

**Sincronia entre a credencial e o cadastro.** `name` e `email` existem em dois lugares: no cadastro da pessoa (`/students`) e na credencial (`/users`). Ao salvar o cadastro, o formulário **atualiza a conta ligada** a ele, quando existe uma. Sem isso, renomear um aluno faria o sistema chamar a mesma pessoa por dois nomes diferentes em telas diferentes — o painel cumprimentaria com o nome antigo enquanto a lista mostraria o novo. Nada quebraria, e é justamente por isso que ninguém perceberia.

**Exclusão bloqueada pela conta de acesso.** O aluno **não pode ser excluído** enquanto tiver conta. Apagar o cadastro deixaria a credencial apontando para ninguém: a pessoa ainda faria login, mas com escopo vazio — todas as telas abririam sem nenhum dado, sem erro e sem explicação. A conta sai primeiro, em Usuários.

**Regra de negócio — `e-mail` duplicado é bloqueado.** Antes de salvar, as duas telas que criam conta (`/users` do administrador e o autocadastro `/criar-conta`) consultam `GET /users?email=valor`; se vier registro, exibem erro e não salvam. O `login` já é único, mas o **e-mail é a identidade que a pessoa reconhece**: duas contas com o mesmo e-mail e logins diferentes deixariam o usuário sem saber com qual entrar. As duas consultas (login e e-mail) saem juntas, para a tela apontar todos os conflitos na primeira tentativa.

**Regra de negócio (contrato, seção 6.6 — decidida):** **`login` duplicado é bloqueado.** Antes de salvar, a tela consulta `GET /users?login=valor`; se vier registro, exibe erro. Sem isso, dois usuários com o mesmo login tornariam a autenticação ambígua, já que o login é feito por consulta filtrada.

**Observação para a apresentação:** a senha em texto puro é uma limitação consciente do JSON Server, que não tem camada de autenticação nem criptografia. Em um sistema real usaríamos hash (ex.: bcrypt) no backend. Vale dizer isso ao professor antes de ele perguntar.

**Usuário é credencial; aluno é cadastro.** São coleções diferentes de propósito: o administrador pode cadastrar um aluno que ainda não tem login, e um aluno pode sair da escola sem que o histórico das matrículas dele seja apagado. `studentId` é a ponte entre as duas coisas — e **sem essa ponte não há como aplicar a restrição de acesso**: saber que alguém tem `role = aluno` não diz _quais_ matrículas são dele.

Quem cobra a obrigatoriedade condicional é o formulário de usuários (`user-form.component.ts`), com validação que liga e desliga conforme o perfil escolhido — o TypeScript não amarra um campo ao valor de outro em uma interface simples. O mesmo formulário **limpa** o campo que não se aplica: uma conta que fosse de aluno e virasse de administrador não pode ficar com o `studentId` antigo gravado.

**Perfis e alcance (implementado em `core/services/acesso.service.ts`):**

| Perfil      | Alcança                                                                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`     | Tudo: catálogo, turmas, matrículas, financeiro, frequência e o cadastro de usuários.                                                                                                                                                            |
| `professor` | Somente os cursos e as turmas de que é responsável: os alunos deles, a frequência (cria e corrige) e a situação financeira desses alunos **em consulta**. Não alcança o cadastro de usuários, não exclui nada e não altera registro financeiro. |
| `aluno`     | Somente o próprio cadastro: suas matrículas, suas mensalidades e sua frequência. Grava em um único lugar: criar a própria matrícula.                                                                                                            |

**Autenticação (contrato, seção 7).** O `AuthService` fica em `src/app/core/services/auth.service.ts` e grava o usuário logado no `localStorage`, na chave `edumanager_user` (constante `AUTH_STORAGE_KEY`, exportada pelo próprio service).

A tela de login tem **um campo para dois identificadores** — e-mail ou login — porque o requisito acadêmico pede entrada por e-mail e as credenciais curtas do seed (`admin`, `aluno`) são as usadas na documentação e na apresentação. O service tenta nesta ordem:

```
GET /users?email=<identificador>&password=<senha>     ← primeiro
GET /users?login=<identificador>&password=<senha>     ← só se o e-mail não casar
```

O resultado é um `ResultadoLogin` com **três** casos, e não dois:

| Resultado    | Quando                               | O que a tela faz                                 |
| ------------ | ------------------------------------ | ------------------------------------------------ |
| `ok`         | credencial correta e `active: true`  | sessão gravada, redireciona para `/dashboard`    |
| `desativado` | credencial correta e `active: false` | "Esta conta está desativada…" — não grava sessão |
| `invalido`   | nenhum registro casou                | "E-mail/login ou senha inválidos."               |

A consulta **não** filtra `active=true`. Filtrando no servidor, a conta desativada caía na mesma resposta vazia da senha errada, e a tela mandava tentar de novo quem só o administrador pode destravar. Quem confere o campo `active` é o service, antes de gravar a sessão. Falha de rede chega como **erro** do Observable, nunca como `invalido` — sem essa separação, a API desligada exibiria "senha inválida".

---

## 2. students — Alunos

| Campo       | Tipo          | Obrigatório      | Limite (mín.–máx.) | Valores permitidos                     | Descrição                                                                                                       |
| ----------- | ------------- | ---------------- | ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`        | number        | Sim (automático) | —                  | —                                      | Identificador único do aluno.                                                                                   |
| `name`      | string        | Sim              | 3–80               | —                                      | Nome completo do aluno.                                                                                         |
| `cpf`       | string        | Sim              | 11–11 (só dígitos) | CPF válido pelos dígitos verificadores | CPF do aluno. Validado por validador customizado, não basta ter 11 dígitos. Único entre os alunos (ver abaixo). |
| `birthDate` | string (data) | Sim              | `YYYY-MM-DD`       | data no passado                        | Data de nascimento.                                                                                             |
| `email`     | string        | Não              | 5–100              | formato de e-mail                      | E-mail de contato.                                                                                              |
| `phone`     | string        | Não              | 10–15 (só dígitos) | —                                      | Telefone com DDD.                                                                                               |
| `address`   | string        | Não              | 5–150              | —                                      | Endereço residencial.                                                                                           |
| `status`    | string        | Sim              | —                  | `ativo`, `inativo`                     | Situação do aluno na instituição.                                                                               |

**Regra de negócio (contrato, seção 6.7 — decidida):** **CPF duplicado é bloqueado dentro da própria coleção.** Antes de salvar um aluno, a tela consulta `GET /students?cpf=valor`. A verificação é dentro da própria coleção: duas pessoas não podem compartilhar CPF, e é a única coleção de pessoas do sistema.

---

## 3. courses — Cursos

| Campo             | Tipo    | Obrigatório      | Limite (mín.–máx.)    | Valores permitidos                               | Descrição                                                                                                                                                                                     |
| ----------------- | ------- | ---------------- | --------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | number  | Sim (automático) | —                     | —                                                | Identificador único do curso.                                                                                                                                                                 |
| `name`            | string  | Sim              | 3–80                  | —                                                | Nome do curso (ex.: "Técnico em Informática").                                                                                                                                                |
| `description`     | string  | Não              | 10–300                | —                                                | Descrição do conteúdo e objetivo do curso.                                                                                                                                                    |
| `workload`        | number  | Sim              | valor de 1 a 2000     | inteiro positivo                                 | Carga horária total em horas.                                                                                                                                                                 |
| `price`           | number  | Sim              | valor de 0 a 99999.99 | número maior ou igual a 0                        | Valor do curso em reais.                                                                                                                                                                      |
| `teacherId`       | number  | Não              | —                     | `id` existente em `users` com `role = professor` | **Professor responsável.** Responde "de quem é este curso?" e é por ele que o escopo do perfil professor é montado. Opcional: a escola pode cadastrar o curso antes de definir quem ministra. |
| `maxInstallments` | number  | Não              | valor de 1 a 10       | inteiro positivo                                 | **Teto de parcelamento deste curso.** A tela de matrícula oferece 2x, 3x, 5x e 10x filtradas por este número. Ausente = teto padrão de 10.                                                    |
| `active`          | boolean | Sim              | —                     | `true`, `false`                                  | Se o curso está sendo oferecido. Curso inativo não deve aparecer na criação de novas turmas.                                                                                                  |

---

## 4. classes — Turmas

A turma é a **oferta** de um curso: define quando ele acontece, em qual turno e com quantas vagas. É nela que a matrícula existe.

| Campo       | Tipo          | Obrigatório      | Limite (mín.–máx.) | Valores permitidos                               | Descrição                                                                                                                                                                                                                        |
| ----------- | ------------- | ---------------- | ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | number        | Sim (automático) | —                  | —                                                | Identificador único da turma.                                                                                                                                                                                                    |
| `courseId`  | number        | Sim              | —                  | `id` existente em `courses`                      | Curso que a turma ministra. Escolhido em um select.                                                                                                                                                                              |
| `teacherId` | number        | Não              | —                  | `id` existente em `users` com `role = professor` | **Professor da turma.** Duas turmas do mesmo curso podem ter professores diferentes, e é a turma que manda na frequência. Ausente = a turma é tratada como do responsável do **curso** dela, para não ficar invisível a ninguém. |
| `code`      | string        | Sim              | 3–20               | —                                                | Código da turma (ex.: "INFO-2026-1"). Deve ser único.                                                                                                                                                                            |
| `shift`     | string        | Sim              | —                  | `manha`, `tarde`, `noite`                        | Turno das aulas.                                                                                                                                                                                                                 |
| `startDate` | string (data) | Sim              | `YYYY-MM-DD`       | —                                                | Data de início das aulas.                                                                                                                                                                                                        |
| `endDate`   | string (data) | Sim              | `YYYY-MM-DD`       | deve ser maior ou igual a `startDate`            | Data prevista de encerramento.                                                                                                                                                                                                   |
| `capacity`  | number        | Sim              | valor de 1 a 100   | inteiro positivo                                 | Número máximo de alunos matriculados.                                                                                                                                                                                            |
| `status`    | string        | Sim              | —                  | `ativa`, `cancelada`, `concluida`                | Situação da turma. Ratificado pelo Agente-mãe em 04/11/2026.                                                                                                                                                                     |

**Por que `classes` e `enrollments` usam feminino e `students` usa masculino.** A divergência é **deliberada**, não um descuido: o valor concorda em gênero com o substantivo que ele qualifica — turma **ativa** e matrícula **ativa**, aluno **ativo**. Vale saber explicar isso, porque é o tipo de inconsistência aparente que um professor atento percebe na tela.

Implementado em `src/app/core/models/class.model.ts` como `export type ClassStatus = 'ativa' | 'cancelada' | 'concluida'`, idêntico ao `EnrollmentStatus`.

---

## 5. enrollments — Matrículas

Liga um **aluno** a uma **turma**. É a tabela associativa do sistema.

| Campo            | Tipo          | Obrigatório      | Limite (mín.–máx.) | Valores permitidos                            | Descrição                                                                                                                                                                                                                              |
| ---------------- | ------------- | ---------------- | ------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | number        | Sim (automático) | —                  | —                                             | Identificador único da matrícula.                                                                                                                                                                                                      |
| `studentId`      | number        | Sim              | —                  | `id` existente em `students`                  | Aluno matriculado.                                                                                                                                                                                                                     |
| `classId`        | number        | Sim              | —                  | `id` existente em `classes`                   | Turma na qual o aluno foi matriculado.                                                                                                                                                                                                 |
| `enrollmentDate` | string (data) | Sim              | `YYYY-MM-DD`       | —                                             | Data em que a matrícula foi realizada.                                                                                                                                                                                                 |
| `status`         | string        | Sim              | —                  | `pendente`, `ativa`, `cancelada`, `concluida` | Situação da matrícula. Note o gênero feminino: matrícula ativa. **Toda matrícula nasce `pendente`** e passa a `ativa` quando o administrador confirma a primeira parcela — quem faz essa passagem é o `FinanceiroService`, não a tela. |

**Regras de negócio (contrato, seção 6.1 e 6.2 — decididas):**

- **Matrícula duplicada: bloquear.** O mesmo aluno não pode ter duas matrículas na mesma turma. Antes de salvar, a tela consulta `GET /enrollments?studentId=X&classId=Y`; se vier qualquer registro, exibe erro e não salva.
- **Capacidade da turma: bloquear.** Quando as matrículas de status `ativa` da turma atingem o `capacity`, a nova matrícula é recusada. Antes de salvar, a tela consulta `GET /enrollments?classId=Y`, conta apenas as de status `ativa` e compara com `class.capacity`. Matrícula `cancelada` ou `concluida` **não** ocupa vaga.

---

## 6. financialRecords — Lançamentos financeiros

O **compromisso** de uma matrícula: "este aluno deve R$ 1.200, combinados em 3 vezes, por PIX". Um lançamento por matrícula.

| Campo          | Tipo          | Obrigatório      | Limite (mín.–máx.) | Valores permitidos                                 | Descrição                                                                                                                                                                                 |
| -------------- | ------------- | ---------------- | ------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | number        | Sim (automático) | —                  | —                                                  | Identificador único do lançamento.                                                                                                                                                        |
| `enrollmentId` | number        | Sim              | —                  | `id` existente em `enrollments`                    | Matrícula a que o lançamento pertence.                                                                                                                                                    |
| `totalAmount`  | number        | Sim              | maior ou igual a 0 | número                                             | Valor **combinado** na matrícula. É uma **cópia** do preço do curso no momento da matrícula, de propósito: mudar o preço do curso depois não pode mexer em matrícula já feita (regra 11). |
| `condition`    | string        | Sim              | —                  | `avista`, `parcelado`                              | Condição escolhida pelo aluno.                                                                                                                                                            |
| `installments` | number        | Sim              | valor de 1 a 10    | inteiro positivo                                   | Quantidade de parcelas. Sempre `1` quando `condition = avista`.                                                                                                                           |
| `method`       | string        | Sim              | —                  | `pix`, `dinheiro`, `cartao`                        | Forma de pagamento **informada** pelo aluno. É declaração de intenção, não cobrança: o sistema não tem gateway e **não** marca nada como pago por causa dela.                             |
| `status`       | string        | Sim              | —                  | `pendente`, `parcialmente_pago`, `pago`, `vencido` | Situação do lançamento. É **derivada** das parcelas e **gravada**, porque é ela que o painel conta — contar campo gravado é uma consulta só. Recalculada sempre que uma parcela muda.     |
| `createdAt`    | string (data) | Sim              | `YYYY-MM-DD`       | —                                                  | Data do lançamento (a mesma da matrícula).                                                                                                                                                |

**Por que lançamento e parcela são duas coleções.** O lançamento é o combinado; a parcela é cada pedaço dele. Separar é o que permite responder "quanto este aluno deve no total?", "qual era a combinação feita?" e "quanto falta?" — perguntas que uma lista de parcelas solta não responde. E é o que garante a regra 11: o valor combinado fica gravado aqui, fora do alcance de uma edição de preço no catálogo.

**Como o `status` é decidido** (a ordem dos testes é a regra):

| Situação das parcelas             | `status`            |
| --------------------------------- | ------------------- |
| todas pagas                       | `pago`              |
| alguma paga (não todas)           | `parcialmente_pago` |
| nenhuma paga e há parcela vencida | `vencido`           |
| nenhuma paga, nada vencido        | `pendente`          |

Ter recebido algo pesa mais do que ter parcela atrasada: um lançamento com uma parcela paga e uma vencida é `parcialmente_pago`, e não `vencido` — o contrário esconderia que o aluno já pagou parte.

O valor `parcialmente_pago` usa underscore porque viaja na URL das consultas (`?status=parcialmente_pago`); na tela aparece "Parcialmente pago", traduzido por `SITUACOES_FINANCEIRAS`.

---

## 7. payments — Parcelas

Cada parcela pertence a **um lançamento** (e guarda também a matrícula). A coleção continua com o nome `payments`, que é o do contrato original; o que ela guarda, conceitualmente, é a entidade **Installment** do requisito 10.

| Campo               | Tipo                  | Obrigatório      | Limite (mín.–máx.)       | Valores permitidos                   | Descrição                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------- | ---------------- | ------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | number                | Sim (automático) | —                        | —                                    | Identificador único da parcela.                                                                                                                                                                                                                                                              |
| `financialRecordId` | number                | Não              | —                        | `id` existente em `financialRecords` | Lançamento a que a parcela pertence. Opcional apenas por compatibilidade com parcelas lançadas à mão pelo administrador; **toda parcela criada pelo fluxo de matrícula tem este campo**.                                                                                                     |
| `enrollmentId`      | number                | Sim              | —                        | `id` existente em `enrollments`      | Matrícula à qual a parcela se refere. É informação **repetida** (o lançamento já sabe disso) e a repetição é deliberada: o JSON Server não faz JOIN de dois níveis, e sem este campo a tabela de parcelas precisaria de duas consultas em cadeia para escrever o nome do aluno em uma linha. |
| `number`            | number                | Não              | valor de 1 a 10          | inteiro positivo                     | Número da parcela dentro do lançamento (1 de 3, 2 de 3…).                                                                                                                                                                                                                                    |
| `dueDate`           | string (data)         | Sim              | `YYYY-MM-DD`             | —                                    | Data de vencimento da parcela.                                                                                                                                                                                                                                                               |
| `amount`            | number                | Sim              | valor de 0.01 a 99999.99 | número maior que 0                   | Valor da parcela em reais.                                                                                                                                                                                                                                                                   |
| `paidAt`            | string (data) ou null | Condicional      | `YYYY-MM-DD`             | —                                    | Data do pagamento. **Obrigatório quando `status = pago`; obrigatoriamente `null` nos outros status.**                                                                                                                                                                                        |
| `status`            | string                | Sim              | —                        | `pendente`, `pago`, `vencido`        | Situação da parcela. Chamava-se `atrasado` até 14/11/2026; passou a `vencido` para usar a palavra do requisito 6.4, e os dados do `db.json` foram migrados junto.                                                                                                                            |

Não existe `parcialmente_pago` na parcela, de propósito: meia parcela não faz sentido — ou a escola recebeu aquela parcela, ou não recebeu.

**Como as parcelas são geradas (requisito 6.2).** `FinanceiroService.calcularParcelas()` divide o valor em **centavos inteiros**, porque somar decimais em JavaScript acumula erro (`0.1 + 0.2` não dá `0.3`). A sobra da divisão vai na **última** parcela, então a soma fecha exatamente com o total:

```
R$ 1.000,00 em 3x  →  100000 centavos / 3 = 33333, sobra 1
                   →  333,33 + 333,33 + 333,34 = 1.000,00
```

A sobra vai na última e não na primeira porque a primeira é a que o aluno confere na hora da matrícula — ver o valor "redondo" ali é o que ele espera do comércio.

**Vencimentos.** A primeira parcela vence **7 dias** depois da matrícula; as seguintes, de mês em mês no mesmo dia. Quando o dia não existe no mês de destino (31/01 + 1 mês), o vencimento é fixado no **último dia** do mês, em vez de escorregar para o mês seguinte — que é o que o `Date` do JavaScript faria sozinho.

**Regra de negócio (contrato, seção 6.3 — decidida).** `paidAt` e `status` são acoplados, e a tela impede a combinação inválida em vez de só avisar:

- Ao escolher `pago`, o campo de data **habilita** e já vem preenchido com a data de hoje, ainda editável.
- Ao escolher `pendente` ou `vencido`, o campo **limpa e desabilita**, gravando `null`.

**A confirmação de pagamento é uma cadeia, e a ordem é a regra** (`FinanceiroService.confirmarPagamento`):

1. a **parcela** vira `pago` e recebe a data do recebimento;
2. o **lançamento** é recalculado (`pendente` → `parcialmente_pago` → `pago`);
3. a **matrícula** `pendente` vira `ativa`, porque a escola recebeu algo.

Se a etapa 2 ou 3 falhar, a parcela **continua paga** — e isso é proposital: "o dinheiro entrou" é o dado importante, e o status derivado pode ser corrigido a qualquer momento por `recalcular()`. Existe também **estorno**, pelo mesmo motivo: se dá para errar, tem que dar para corrigir dentro do sistema.

Quem pode confirmar: **somente o administrador**. O aluno vê as próprias parcelas e o professor vê as dos alunos dele, os dois em leitura.

---

## 8. attendances — Frequência

Registro de presença de um aluno em uma turma, em uma data.

| Campo       | Tipo          | Obrigatório      | Limite (mín.–máx.) | Valores permitidos           | Descrição                                                                                                                                                                                                                               |
| ----------- | ------------- | ---------------- | ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | number        | Sim (automático) | —                  | —                            | Identificador único do registro de presença.                                                                                                                                                                                            |
| `classId`   | number        | Sim              | —                  | `id` existente em `classes`  | Turma da aula.                                                                                                                                                                                                                          |
| `courseId`  | number        | Nao              | —                  | `id` existente em `courses`  | Curso da turma, pedido pelo requisito 8. E derivado (a turma ja sabe o curso dela) e esta gravado para o relatorio por curso nao precisar de duas consultas em cadeia. Como a turma nunca troca de curso, a copia nao sai de sincronia. |
| `studentId` | number        | Sim              | —                  | `id` existente em `students` | Aluno cuja presença está sendo registrada.                                                                                                                                                                                              |
| `date`      | string (data) | Sim              | `YYYY-MM-DD`       | —                            | Data da aula.                                                                                                                                                                                                                           |
| `present`   | boolean       | Sim              | —                  | `true`, `false`              | `true` = presente, `false` = ausente. Na tela aparece como "Presente" ou "Ausente".                                                                                                                                                     |

**Regras de negócio (contrato, seções 6.4 e 6.5 — decididas):**

- **Presença duplicada: bloquear** a trinca `classId` + `studentId` + `date`. Antes de salvar, a tela consulta `GET /attendances?classId=X&studentId=Y&date=Z`.
- **O select de aluno lista somente os alunos matriculados naquela turma.** A tela carrega `GET /enrollments?classId=Y` e usa os `studentId` retornados. Nunca lista todos os alunos da instituição — seria possível registrar presença de alguém que não é da turma.

**A tela de CHAMADA (`/attendances/chamada`)** é o caminho normal de lançamento: escolhe turma e data, lista os matriculados e marca todos de uma vez. Ela evita a duplicidade de um jeito diferente do formulário avulso — ao escolher turma e data, **carrega os registros daquele dia** e preenche as linhas com eles. Então, se a chamada já foi feita, o professor não está criando uma segunda: está corrigindo a primeira (quem já estava gravado recebe `PUT`; quem não estava, `POST`).

Matrícula `cancelada` **não** entra na chamada (quem saiu da turma não tem presença a marcar); matrícula `pendente` **entra**, porque o aluno começa a assistir antes de a primeira parcela ser confirmada.

A gravação é uma requisição por aluno, e **falha parcial é tolerada em vez de desfeita**: apagar as presenças que deram certo por causa de uma que falhou perderia trabalho correto do professor. A tela avisa que a gravação foi incompleta e recarrega a lista, que mostra exatamente quem entrou — e salvar de novo atualiza em vez de duplicar.

**Quem lança:** professor e administrador criam e corrigem registros de frequência; **excluir** registro de presença é só do administrador, porque é histórico acadêmico do aluno. O aluno consulta a própria frequência e não grava nada.

---

## 9. Relacionamentos — quem referencia quem

O JSON Server não tem chave estrangeira. A integridade é responsabilidade da aplicação Angular: antes de salvar, a tela carrega as opções válidas em um select, e por isso o usuário não consegue digitar um `id` inexistente.

### Diagrama textual

```
users (N) ──> students (1)                      via users.studentId
users (1) ──< courses (N)                       via courses.teacherId
users (1) ──< classes (N)                       via classes.teacherId

courses (1) ──< classes (N) >──┐
                               ├──< enrollments (N) ──1:1── financialRecords (1) ──< payments (N)
            students (1) ──────┘
                  │
                  └──< attendances (N) >──── classes (1)
```

A coleção `users` **não é independente**: ela aponta para `students`. É essa referência que sustenta a restrição de acesso do aluno — sem ela, o sistema saberia que alguém é aluno, mas não **qual** aluno.

### Tabela de referências

| Coleção            | Campo               | Aponta para           | Cardinalidade                 | Significado                                                                                                                                  |
| ------------------ | ------------------- | --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `classes`          | `courseId`          | `courses.id`          | 1 curso para N turmas         | Um curso pode ter várias turmas; cada turma é de um único curso.                                                                             |
| `enrollments`      | `studentId`         | `students.id`         | 1 aluno para N matrículas     | Um aluno pode se matricular em várias turmas.                                                                                                |
| `enrollments`      | `classId`           | `classes.id`          | 1 turma para N matrículas     | Uma turma recebe vários alunos.                                                                                                              |
| `financialRecords` | `enrollmentId`      | `enrollments.id`      | 1 matrícula para 1 lançamento | O combinado financeiro daquela matrícula.                                                                                                    |
| `payments`         | `financialRecordId` | `financialRecords.id` | 1 lançamento para N parcelas  | O lançamento é dividido em parcelas.                                                                                                         |
| `payments`         | `enrollmentId`      | `enrollments.id`      | 1 matrícula para N parcelas   | Cópia deliberada: evita a consulta em cadeia parcela → lançamento → matrícula.                                                               |
| `attendances`      | `classId`           | `classes.id`          | 1 turma para N presenças      | Cada aula de cada turma gera registros de presença.                                                                                          |
| `attendances`      | `studentId`         | `students.id`         | 1 aluno para N presenças      | Um aluno tem um registro por aula.                                                                                                           |
| `attendances`      | `courseId`          | `courses.id`          | 1 curso para N presenças      | Curso da turma da aula (cópia derivada da turma).                                                                                            |
| `users`            | `studentId`         | `students.id`         | 1 aluno para 1 usuário        | Qual aluno o usuário é. Obrigatório quando `role = aluno`.                                                                                   |
| `courses`          | `teacherId`         | `users.id`            | 1 professor para N cursos     | Professor responsável pelo curso. A referência é do curso para o usuário, e não o contrário, porque um professor responde por vários cursos. |
| `classes`          | `teacherId`         | `users.id`            | 1 professor para N turmas     | Professor que dá aula na turma. É ele que lança a chamada.                                                                                   |

### Leitura em palavras (serve de resposta ao professor)

- **students e classes formam um relacionamento muitos-para-muitos**, e `enrollments` é a tabela associativa que resolve esse relacionamento. Esse é o ponto de modelagem mais importante do sistema.
- **courses e students não se conhecem diretamente.** Eles só se encontram descendo a cadeia `courses` → `classes` → `enrollments` → `students`.
- **payments depende de financialRecords, e o lançamento depende de enrollments.** Para saber de quem é uma parcela, o caminho completo é `payments.financialRecordId` → `financialRecords.enrollmentId` → `enrollments.studentId` → `students.id`. São três saltos, e o JSON Server expande só um (`_expand`) — por isso a parcela guarda também o `enrollmentId`, que encurta o caminho para um salto só nas telas de lista.
- **O professor não é uma coleção.** Professor é um `users` com `role: professor`; o vínculo com o trabalho dele vem dos cursos e das turmas, que apontam para o id dele. Foi essa a escolha em vez de criar uma coleção `teachers`: um professor pode responder por vários cursos, e uma lista de cursos dentro do usuário seria pior de manter do que uma referência dentro de cada curso.
- **attendances aponta para a turma e para o aluno ao mesmo tempo**, em vez de apontar para a matrícula. Foi uma decisão do contrato e simplifica o lançamento de presença por turma.
- **users aponta para students.** A credencial e o cadastro acadêmico são registros diferentes, ligados por `users.studentId` — e é por isso que apagar um aluno que tem conta fica bloqueado.

### Exclusão de registro com dependentes — regra única

**Contrato, seção 6.8 (decidida em 04/11/2026): BLOQUEAR a exclusão, com mensagem explicativa, e oferecer INATIVAR como alternativa.** Uma regra só, igual para os quatro casos. Sem cascata e sem registro órfão.

| Excluir   | Consultar antes                                                         | Se houver dependente |
| --------- | ----------------------------------------------------------------------- | -------------------- |
| curso     | `GET /classes?courseId=X`                                               | Bloqueia.            |
| aluno     | `GET /enrollments?studentId=X` e `GET /attendances?studentId=X`         | Bloqueia.            |
| turma     | `GET /enrollments?classId=X` e `GET /attendances?classId=X`             | Bloqueia.            |
| matrícula | `GET /payments?enrollmentId=X` e `GET /financialRecords?enrollmentId=X` | Bloqueia.            |

Padrão da mensagem, igual em todos os módulos:

> Não é possível excluir &lt;registro&gt; porque existem N &lt;dependentes&gt; vinculados. Exclua ou altere os &lt;dependentes&gt; primeiro.

A alternativa oferecida ao usuário é **inativar** (campo `status` ou `active`), não excluir. É por isso que praticamente toda coleção tem um campo de situação: ele é o caminho previsto para "tirar de circulação" sem destruir histórico.

**Por que bloquear e não cascatear** (vale como resposta ao professor): a cascata apaga dado silenciosamente e é difícil de desfazer no meio de uma apresentação. Bloquear é o comportamento que se espera de integridade referencial — é o que um banco relacional faria com `ON DELETE RESTRICT`.

**E não é escolha teórica: o JSON Server JÁ cascateia, em silêncio.** Comprovado em 14/11/2026:

```
POST /students      → aluno 3
POST /attendances   → frequência 7 (studentId 3)
POST /enrollments   → matrícula 4 (studentId 3)
DELETE /students/3  → 200
GET /attendances/7  → não existe mais
GET /enrollments/4  → não existe mais
```

Um `DELETE` que chegue ao servidor apaga os dependentes junto, sem aviso. Por isso a verificação de dependentes antes de cada exclusão **não é conveniência de interface**: ela é a única coisa entre um clique e a destruição do histórico acadêmico e financeiro de um aluno — exatamente o que o requisito 11 proíbe ("a exclusão de um usuário não destrua o histórico financeiro").

**O princípio que amarra tudo.** O JSON Server não tem chave estrangeira nem constraint. Portanto **a integridade é garantida pela aplicação**: pelos selects, que só oferecem ids existentes, pelas consultas de verificação antes de cada gravação, e por este bloqueio antes de cada exclusão. Essa é a resposta oficial do projeto para a pergunta de integridade referencial.
