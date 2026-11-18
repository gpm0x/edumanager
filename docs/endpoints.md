# Endpoints da API — EduManager

Base URL: `http://localhost:3000`

Backend: **JSON Server** lendo `api/db.json`. O JSON Server gera automaticamente uma API REST completa a partir das chaves de primeiro nível do arquivo JSON. Cada uma das 7 coleções (`users`, `students`, `courses`, `classes`, `enrollments`, `payments`, `attendances`) vira um recurso REST com os cinco verbos abaixo, sem escrevermos uma linha de backend.

## Padrão geral (vale para todas as coleções)

Trocando `<colecao>` pelo nome da coleção:

| Método | Rota             | O que faz                          | Resposta de sucesso                     |
| ------ | ---------------- | ---------------------------------- | --------------------------------------- |
| GET    | `/<colecao>`     | Lista todos os registros           | `200` + array de objetos                |
| GET    | `/<colecao>/:id` | Busca um registro pelo id          | `200` + objeto, ou `404` se não existir |
| POST   | `/<colecao>`     | Cria um registro (o `id` é gerado) | `201` + objeto criado com `id`          |
| PUT    | `/<colecao>/:id` | Substitui o registro inteiro       | `200` + objeto atualizado               |
| PATCH  | `/<colecao>/:id` | Atualiza apenas os campos enviados | `200` + objeto atualizado               |
| DELETE | `/<colecao>/:id` | Exclui o registro                  | `200` + `{}`                            |

Cabeçalho obrigatório no POST, PUT e PATCH: `Content-Type: application/json`. O `HttpClient` do Angular já envia esse cabeçalho quando o corpo é um objeto.

**Importante no PUT:** ele substitui o objeto completo. Se o formulário de edição não enviar todos os campos, os que faltarem desaparecem do registro. O padrão do projeto é enviar o objeto inteiro no PUT.

---

## 1. users

### Listar

```
GET http://localhost:3000/users
```

Resposta `200`:

```json
[
  {
    "id": 1,
    "name": "Administrador",
    "email": "admin@edumanager.com",
    "login": "admin",
    "password": "admin123",
    "role": "admin",
    "active": true
  },
  {
    "id": 5,
    "name": "Ana Clara Souza",
    "email": "ana.souza@aluno.edumanager.com.br",
    "login": "aluno",
    "password": "123456",
    "role": "aluno",
    "active": true,
    "studentId": 1
  }
]
```

`studentId` liga a CREDENCIAL ao CADASTRO da pessoa, e só existe no perfil `aluno`. É ele que permite ao sistema responder "quais matrículas são deste aluno?" — ver `docs/dicionario-de-dados.md`, seção 1.

### Criar

```
POST http://localhost:3000/users
Content-Type: application/json

{
  "name": "Joana Admin",
  "email": "maria@edumanager.com",
  "login": "maria",
  "password": "1234",
  "role": "admin",
  "active": true
}
```

Resposta `201`:

```json
{
  "id": 2,
  "name": "Joana Admin",
  "email": "maria@edumanager.com",
  "login": "maria",
  "password": "1234",
  "role": "admin",
  "active": true
}
```

### Autocadastro de aluno (tela `/criar-conta`)

Não é um endpoint: é uma **sequência** de requisições que a tela orquestra. Cinco, nesta ordem.

**1 a 3 — as três checagens de duplicidade, em paralelo:**

```
GET http://localhost:3000/users?email=ana.souza@aluno.com
GET http://localhost:3000/users?login=ana.souza
GET http://localhost:3000/students?cpf=52998224725
```

Qualquer uma que devolva `[...]` com registro **interrompe o cadastro**, e o erro é marcado no campo correspondente do formulário.

**4 — cria o cadastro do aluno:**

```
POST http://localhost:3000/students
Content-Type: application/json

{
  "name": "Ana Souza",
  "cpf": "52998224725",
  "birthDate": "2001-05-14",
  "email": "ana.souza@aluno.com",
  "phone": "11988887777",
  "address": "",
  "status": "ativo"
}
```

**5 — cria a credencial apontando para o aluno criado:**

```
POST http://localhost:3000/users
Content-Type: application/json

{
  "name": "Ana Souza",
  "email": "ana.souza@aluno.com",
  "login": "ana.souza",
  "password": "senha123",
  "role": "aluno",
  "active": true,
  "studentId": 9
}
```

O `studentId` vem do `id` que o passo 4 devolveu — por isso os passos 4 e 5 são **sequenciais**, e não paralelos como as checagens.

**Se o passo 5 falhar, o passo 4 é desfeito:**

```
DELETE http://localhost:3000/students/9
```

O JSON Server não tem transação. Sem essa compensação, a pessoa ficaria cadastrada como aluno mas sem conta — e a nova tentativa bateria em "CPF já cadastrado", trancando-a fora do sistema de forma definitiva.

### Listar os professores (select de responsável em Curso e Turma)

```
GET http://localhost:3000/users?role=professor&active=true&_sort=name
```

O `role` aceita `admin`, `professor` e `aluno`. A conta de **professor não tem `studentId`**: o vínculo dele vem dos cursos e das turmas, que guardam o id dele em `teacherId`.

### Conta ligada a um cadastro

```
GET http://localhost:3000/users?studentId=1
GET http://localhost:3000/users?studentId=1
```

Usada em dois momentos: antes de **excluir** um aluno (se existe conta, a exclusão é bloqueada) e depois de **renomear** um (a conta é atualizada para acompanhar).

### Login (consulta, não é endpoint próprio)

O JSON Server não tem rota de autenticação. O login é feito com uma **consulta filtrada** — e a tela aceita **e-mail ou login** no mesmo campo, então são até duas consultas, nesta ordem:

```
GET http://localhost:3000/users?email=admin@edumanager.com.br&password=admin123   ← primeiro
GET http://localhost:3000/users?login=admin&password=admin123                     ← só se o e-mail não casar
```

Resposta `200` com array de 1 item = credencial válida. Resposta `200` com array vazio `[]` nas **duas** consultas = credencial inválida.

A consulta **não** filtra `active=true`: quem confere o campo é o `AuthService`, para poder separar três situações que exigem mensagens diferentes.

```
# conta desativada: a API DEVOLVE o registro (a senha estava certa)
GET http://localhost:3000/users?login=desativada&password=123456
→ 200 [ { "id": 9, "name": "Conta Desativada", "active": false, ... } ]
```

| Resposta da API              | Resultado    | Mensagem na tela                   |
| ---------------------------- | ------------ | ---------------------------------- |
| 1 item com `active: true`    | `ok`         | — (entra no sistema)               |
| 1 item com `active: false`   | `desativado` | "Esta conta está desativada…"      |
| `[]` nas duas consultas      | `invalido`   | "E-mail/login ou senha inválidos." |
| erro de rede / API desligada | erro do RxJS | "Não foi possível conectar a API…" |

---

## 2. students

### Listar

```
GET http://localhost:3000/students
```

```json
[
  {
    "id": 1,
    "name": "João da Silva",
    "cpf": "52998224725",
    "birthDate": "2001-03-15",
    "email": "joao@email.com",
    "phone": "11988887777",
    "address": "Rua das Flores, 100",
    "status": "ativo"
  }
]
```

### Criar

```
POST http://localhost:3000/students
Content-Type: application/json

{
  "name": "Ana Souza",
  "cpf": "11144477735",
  "birthDate": "1999-07-22",
  "email": "ana@email.com",
  "phone": "11977776666",
  "address": "Av. Central, 250",
  "status": "ativo"
}
```

Resposta `201` com o objeto acrescido de `"id": 2`.

### Editar

```
PUT http://localhost:3000/students/2
Content-Type: application/json

{
  "name": "Ana Souza Lima",
  "cpf": "11144477735",
  "birthDate": "1999-07-22",
  "email": "ana.lima@email.com",
  "phone": "11977776666",
  "address": "Av. Central, 250",
  "status": "ativo"
}
```

### Excluir

```
DELETE http://localhost:3000/students/2
```

Resposta `200` com corpo `{}`.

---

## 3. courses

### Listar

```
GET http://localhost:3000/courses
```

```json
[
  {
    "id": 1,
    "name": "Técnico em Informática",
    "description": "Curso técnico com foco em desenvolvimento e suporte.",
    "workload": 800,
    "price": 1200.0,
    "teacherId": 4,
    "maxInstallments": 10,
    "active": true
  }
]
```

### Criar

```
POST http://localhost:3000/courses
Content-Type: application/json

{
  "name": "Técnico em Administração",
  "description": "Curso técnico voltado à gestão e rotinas administrativas.",
  "workload": 600,
  "price": 980.00,
  "teacherId": 4,
  "maxInstallments": 3,
  "active": true
}
```

### Listar apenas cursos ativos (usado no select de turmas)

```
GET http://localhost:3000/courses?active=true
```

### Os cursos de um professor (base do escopo do perfil professor)

```
GET http://localhost:3000/courses?teacherId=4
```

É a primeira consulta da cadeia que define tudo o que o professor alcança:
`cursos dele` → `turmas desses cursos` → `matrículas dessas turmas` → `alunos`.

---

## 4. classes

A turma é a oferta de um curso: ela tem turno, período e capacidade. É nela que a matrícula existe.

### Listar

```
GET http://localhost:3000/classes
```

```json
[
  {
    "id": 1,
    "courseId": 1,
    "teacherId": 4,
    "code": "INFO-2026-1",
    "shift": "noite",
    "startDate": "2026-02-02",
    "endDate": "2026-12-18",
    "capacity": 30,
    "status": "ativo"
  }
]
```

### Criar

```
POST http://localhost:3000/classes
Content-Type: application/json

{
  "courseId": 2,
  "teacherId": 4,
  "code": "ADM-2026-1",
  "shift": "manha",
  "startDate": "2026-03-02",
  "endDate": "2026-11-27",
  "capacity": 25,
  "status": "ativo"
}
```

### Listar turmas já com o curso embutido

Esta é a chamada mais útil da tela de turmas: evita fazer três requisições e montar o cruzamento na mão.

```
GET http://localhost:3000/classes?_expand=course
```

```json
[
  {
    "id": 1,
    "courseId": 1,
    "teacherId": 4,
    "code": "INFO-2026-1",
    "shift": "noite",
    "startDate": "2026-02-02",
    "endDate": "2026-12-18",
    "capacity": 30,
    "status": "ativo",
    "course": {
      "id": 1,
      "name": "Técnico em Informática",
      "description": "Curso técnico com foco em desenvolvimento e suporte.",
      "workload": 800,
      "price": 1200.0,
      "active": true
    }
  }
]
```

---

## 5. enrollments

### Listar

```
GET http://localhost:3000/enrollments
```

```json
[
  {
    "id": 1,
    "studentId": 1,
    "classId": 1,
    "enrollmentDate": "2026-01-20",
    "status": "ativa"
  }
]
```

### Criar

```
POST http://localhost:3000/enrollments
Content-Type: application/json

{
  "studentId": 2,
  "classId": 1,
  "enrollmentDate": "2026-01-25",
  "status": "pendente"
}
```

A matrícula nasce **`pendente`**: ela só passa a `ativa` quando o administrador confirma a primeira parcela. Criar direto como `ativa` seria dizer que a escola recebeu algo que não recebeu.

Logo depois deste POST, o fluxo cria o **lançamento financeiro** da matrícula — ver a seção 6.

### Cancelar uma matrícula (atualização parcial)

```
PATCH http://localhost:3000/enrollments/1
Content-Type: application/json

{
  "status": "cancelada"
}
```

### Listar matrículas com aluno e turma embutidos

```
GET http://localhost:3000/enrollments?_expand=student&_expand=class
```

Cada item passa a ter as propriedades `student` e `class` com o objeto completo.

### As matrículas de uma turma, com o aluno (a lista da chamada)

```
GET http://localhost:3000/enrollments?classId=1&_expand=student
```

### As matrículas de um aluno (o que o painel do aluno pede)

```
GET http://localhost:3000/enrollments?studentId=1&_expand=student&_expand=class
```

O aluno pede **as dele** na própria consulta, em vez de pedir a coleção e filtrar na tela. A diferença não é de aparência: sem isso, a resposta da API levaria ao navegador dele as matrículas e os nomes de todos os colegas — a tela mostraria o certo, mas o dado dos outros estaria lá, visível no DevTools.

---

## 6. financialRecords — lançamentos

O lançamento é o combinado da matrícula. Ele é criado **sempre junto com a matrícula**, nunca sozinho pela mão do usuário.

### Listar (mais recentes primeiro)

```
GET http://localhost:3000/financialRecords?_sort=createdAt&_order=desc
```

```json
[
  {
    "id": 1,
    "enrollmentId": 1,
    "totalAmount": 450,
    "condition": "parcelado",
    "installments": 2,
    "method": "pix",
    "status": "parcialmente_pago",
    "createdAt": "2026-07-20"
  }
]
```

### O lançamento de uma matrícula

```
GET http://localhost:3000/financialRecords?enrollmentId=1
```

Devolve **lista**, e não um objeto: a consulta filtrada do JSON Server sempre devolve array, mesmo quando existe no máximo um resultado.

### Filtrar por situação (usado no filtro da tela e no painel)

```
GET http://localhost:3000/financialRecords?status=vencido
GET http://localhost:3000/financialRecords?status=parcialmente_pago
```

### Criar (o que o fluxo de matrícula faz)

```
POST http://localhost:3000/financialRecords
Content-Type: application/json

{
  "enrollmentId": 7,
  "totalAmount": 1200,
  "condition": "parcelado",
  "installments": 3,
  "method": "cartao",
  "status": "pendente",
  "createdAt": "2026-11-14"
}
```

Nasce **sempre** `pendente`, qualquer que seja o `method`: escolher PIX não paga nada (requisito 6.5).

### Recalcular a situação (o que a confirmação de pagamento faz)

```
PUT http://localhost:3000/financialRecords/1
Content-Type: application/json

{
  "id": 1,
  "enrollmentId": 1,
  "totalAmount": 450,
  "condition": "parcelado",
  "installments": 2,
  "method": "pix",
  "status": "pago",
  "createdAt": "2026-07-20"
}
```

### A sequência completa de uma matrícula nova

É a ordem exata das gravações, e ela importa: cada passo precisa do `id` do anterior.

```
POST /students          → o cadastro da pessoa            (id 7)
POST /users             → a credencial, com studentId 7   (id 9)
POST /enrollments       → a matrícula, status "pendente"   (id 7)
POST /financialRecords  → o lançamento, status "pendente"  (id 4)
POST /payments          → parcela 1 de 3, pendente
POST /payments          → parcela 2 de 3, pendente
POST /payments          → parcela 3 de 3, pendente
```

Se qualquer passo falhar, os anteriores são **apagados** na ordem inversa (compensação manual, porque não existe transação). Ver a nota sobre `--watch` no README: numa rajada como esta, o modo `--watch` do JSON Server pode perder um registro.

### A sequência de uma confirmação de pagamento

```
PUT /payments/12                       → status "pago", paidAt de hoje
GET /financialRecords/4                → lê o lançamento
GET /payments?financialRecordId=4&_sort=number → lê todas as parcelas
PUT /financialRecords/4                → grava a situação recalculada
GET /enrollments/7                     → lê a matrícula
PUT /enrollments/7                     → "pendente" → "ativa"
```

---

## 7. payments — parcelas

### Listar

```
GET http://localhost:3000/payments
```

```json
[
  {
    "id": 1,
    "financialRecordId": 1,
    "enrollmentId": 1,
    "number": 1,
    "dueDate": "2026-08-10",
    "amount": 225,
    "paidAt": "2026-08-08",
    "status": "pago"
  }
]
```

### As parcelas de um lançamento, na ordem do número

É a consulta central do módulo financeiro: a tela de detalhe precisa delas na ordem 1, 2, 3 — e não na ordem em que o JSON Server devolveu.

```
GET http://localhost:3000/payments?financialRecordId=1&_sort=number
```

### Criar

```
POST http://localhost:3000/payments
Content-Type: application/json

{
  "financialRecordId": 4,
  "enrollmentId": 7,
  "number": 1,
  "dueDate": "2026-11-21",
  "amount": 400.00,
  "paidAt": null,
  "status": "pendente"
}
```

### Confirmar o recebimento de uma parcela

```
PUT http://localhost:3000/payments/1
Content-Type: application/json

{
  "id": 1,
  "financialRecordId": 1,
  "enrollmentId": 1,
  "number": 1,
  "dueDate": "2026-08-10",
  "amount": 225,
  "paidAt": "2026-11-14",
  "status": "pago"
}
```

O sistema usa `PUT` (e não `PATCH`) porque o `BaseApiService.update` envia o registro inteiro — um método só para as 8 coleções.

### Estornar (desfazer uma confirmação feita por engano)

```
PUT http://localhost:3000/payments/1
```

com `paidAt: null` e `status` voltando para `vencido` (se o vencimento já passou) ou `pendente` (se não passou). O status não volta sempre para `pendente`: uma parcela com vencimento em agosto não está "a vencer" em novembro.

### Listar só as parcelas pendentes, da mais antiga para a mais nova

```
GET http://localhost:3000/payments?status=pendente&_sort=dueDate&_order=asc
GET http://localhost:3000/payments?status=vencido
```

---

## 8. attendances

### Listar

```
GET http://localhost:3000/attendances
```

```json
[
  {
    "id": 1,
    "classId": 1,
    "courseId": 1,
    "studentId": 1,
    "date": "2026-10-05",
    "present": true
  }
]
```

### Criar

```
POST http://localhost:3000/attendances
Content-Type: application/json

{
  "classId": 1,
  "courseId": 1,
  "studentId": 2,
  "date": "2026-10-05",
  "present": false
}
```

O `courseId` não é digitado: a tela o lê da **turma** escolhida, porque é a turma que sabe de que curso ela é.

### Frequência de uma turma em uma data (é o que a CHAMADA carrega)

```
GET http://localhost:3000/attendances?classId=1&date=2026-10-05
```

### Conferir duplicidade antes de gravar (regra 8)

```
GET http://localhost:3000/attendances?classId=1&studentId=2&date=2026-10-05
```

Lista vazia = pode criar. Lista com um item = já existe chamada desse aluno nesse dia, e o caminho é **atualizar** aquele registro em vez de criar outro.

### As duas consultas da tela de chamada

```
GET http://localhost:3000/enrollments?classId=1&_expand=student   → quem aparece na lista
GET http://localhost:3000/attendances?classId=1&date=2026-10-05   → o que já foi marcado
```

A segunda é o que faz a chamada **corrigir** em vez de duplicar: as linhas já vêm preenchidas com o que está gravado.

---

## 9. Filtros nativos do JSON Server usados no projeto

São os filtros autorizados pela nota `contratos-edumanager` (seção 2). Todos vão na query string, sem código de backend.

### 9.1 Filtro por igualdade de campo

Qualquer campo do objeto pode virar filtro.

```
GET /enrollments?classId=3
GET /enrollments?studentId=1&status=ativa
GET /students?status=ativo
GET /attendances?classId=1&date=2026-02-03
GET /users?email=admin@edumanager.com.br&password=admin123
GET /users?login=admin&password=admin123
GET /classes?code=INF-2026-2
```

Dois filtros na mesma URL funcionam como **E** (todas as condições). Repetir o mesmo campo funciona como **OU**: `?status=pendente&status=atrasado` traz os dois.

**Onde o projeto usa:** login, matrículas de uma turma, presenças de uma aula, filtro de status nas listagens.

### 9.2 `_expand` — traz o registro "pai" junto

Usado no **lado que tem o campo `xxxId`**. O nome vem no singular, sem o sufixo `Id`.

```
GET /classes?_expand=course
GET /enrollments?_expand=student&_expand=class
GET /payments?_expand=enrollment
GET /attendances?_expand=class&_expand=student
```

O resultado ganha uma propriedade com o objeto inteiro (`course`, `student`, `class`...). Resolve em uma requisição o que seriam várias.

**Observação de QA:** `classes` é plural irregular em inglês, e o JSON Server deriva a propriedade de `classId` como `class`. Como `class` é palavra reservada do TypeScript, no código ela precisa ser acessada como `item['class']` ou tipada em uma interface. Ponto de atenção para o agente de Backend e para o de CRUD.

### 9.3 `_embed` — traz os registros "filhos" junto

Usado no **lado do pai**, com o nome da coleção filha no plural.

```
GET /classes/1?_embed=enrollments
GET /courses?_embed=classes
GET /students/1?_embed=enrollments
GET /enrollments/1?_embed=payments
```

Exemplo de resposta de `GET /classes/1?_embed=enrollments`:

```json
{
  "id": 1,
  "courseId": 1,
  "code": "INFO-2026-1",
  "shift": "noite",
  "startDate": "2026-02-02",
  "endDate": "2026-12-18",
  "capacity": 30,
  "status": "ativo",
  "enrollments": [
    { "id": 1, "studentId": 1, "classId": 1, "enrollmentDate": "2026-01-20", "status": "ativa" },
    { "id": 2, "studentId": 2, "classId": 1, "enrollmentDate": "2026-01-25", "status": "ativa" }
  ]
}
```

**Onde o projeto usa:** contar quantos alunos a turma já tem (para comparar com `capacity`) e montar os relatórios simples.

`_expand` e `_embed` podem ser combinados: `GET /classes/1?_expand=course&_embed=enrollments`.

### 9.4 `_sort` e `_order` — ordenação

```
GET /students?_sort=name
GET /students?_sort=name&_order=desc
GET /payments?_sort=dueDate&_order=asc
GET /classes?_sort=shift,code
```

`_order` aceita `asc` (padrão) e `desc`. Vários campos em `_sort` separados por vírgula.

### 9.5 `q` — busca textual completa

Procura o texto em todos os campos do registro.

```
GET /students?q=silva
GET /courses?q=informatica
GET /courses?q=administracao
```

**Observação de QA:** a busca do JSON Server é simples e **sensível a acento**: `?q=informatica` não encontra "Informática". Para a caixa de busca da tela, ou o dado é cadastrado sem acento, ou o filtro é feito no próprio Angular sobre a lista já carregada. Decisão a combinar entre Backend e CRUD; registrada como pendência.

### 9.6 Paginação (disponível, provavelmente não necessária)

```
GET /students?_page=1&_limit=10
```

A resposta traz o cabeçalho `X-Total-Count` com o total de registros. Dado o volume de um projeto acadêmico, a paginação pode ficar por conta do `MatPaginator` no front, sem envolver a API.

---

## 10. Códigos de resposta a tratar

| Código                      | Quando acontece                               | O que a tela deve fazer                                                                         |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `200 OK`                    | GET, PUT, PATCH e DELETE com sucesso          | Seguir o fluxo normal.                                                                          |
| `201 Created`               | POST com sucesso                              | Mostrar mensagem de sucesso e voltar para a listagem.                                           |
| `404 Not Found`             | `id` inexistente em GET, PUT, PATCH ou DELETE | Avisar que o registro não foi encontrado.                                                       |
| `500 Internal Server Error` | Erro interno do JSON Server                   | Mensagem genérica de erro.                                                                      |
| Falha de rede / status `0`  | JSON Server não está rodando                  | Mensagem clara: "Não foi possível conectar à API. Verifique se o JSON Server está em execução." |

O último caso é o mais provável na apresentação: esquecer de subir o JSON Server antes do `ng serve`. A tela precisa falhar com mensagem legível, não com tela branca. Está coberto na checklist de testes.

---

## 11. Como testar os endpoints sem o Angular

Com o JSON Server rodando, pelo terminal:

```bash
curl http://localhost:3000/students

curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste QA","cpf":"52998224725","birthDate":"2000-01-01","email":"teste@email.com","phone":"11999998888","address":"Rua Teste, 1","status":"ativo"}'

curl -X DELETE http://localhost:3000/students/3
```

No PowerShell do Windows, `curl` é um alias de `Invoke-WebRequest` e as aspas se comportam de outra forma. A alternativa é usar `curl.exe` explicitamente, ou abrir a URL direto no navegador para os GETs.

Lembrete: todo POST, PUT, PATCH e DELETE feito via curl **altera o `api/db.json` de verdade**. Depois dos testes, convém limpar os registros criados para a apresentação começar com a base limpa.
