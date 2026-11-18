# Roteiro de Apresentação — EduManager

Objetivo: demonstrar o sistema em cerca de 20 minutos e responder com segurança ao que o professor perguntar. Nenhuma frase deste roteiro deve ser decorada sem que você consiga mostrar, no código, de onde ela vem.

> **A ordem da Parte 2 está escrita e pronta para usar.** As respostas da Parte 3 (perguntas técnicas) seguem marcadas com `[A PREENCHER]` onde dependem de uma escolha sua de como explicar.

---

## Parte 1 — Preparação (antes de entrar na sala)

Checklist do que precisa estar pronto antes da apresentação começar.

| #   | Item                                                         | Por quê                                                                 |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1   | JSON Server rodando em `http://localhost:3000`               | Sem ele, nenhuma tela carrega. É a falha mais provável da apresentação. |
| 2   | Angular rodando em `http://localhost:4200`                   | —                                                                       |
| 3   | `api/db.json` com dados de exemplo coerentes                 | Tela vazia não demonstra nada.                                          |
| 4   | Base limpa dos testes de QA                                  | Registros com nome "Teste QA" durante a apresentação pegam mal.         |
| 5   | Navegador já aberto nas duas abas (sistema e API)            | Evita digitar URL na frente do professor.                               |
| 6   | Editor de código aberto, pastas do projeto expandidas        | O professor vai pedir para ver o código.                                |
| 7   | CPFs válidos anotados: `529.982.247-25` e `111.444.777-35`   | Para demonstrar a validação ao vivo sem travar.                         |
| 8   | CPFs inválidos anotados: `123.456.789-00` e `111.111.111-11` | Para demonstrar a rejeição.                                             |
| 9   | As 4 contas de demonstração anotadas (ver o README)          | A demonstração troca de perfil 3 vezes. Errar a senha ao vivo trava.    |
| 10  | Base limpa dos registros do autocadastro de ensaio           | Um "Teste Teste" na lista de alunos durante a apresentação pega mal.    |
| 11  | Console do navegador **fechado**                             | Abrir só se o professor pedir.                                          |

---

## Parte 2 — Ordem de demonstração

A sequência tem quatro atos, e eles não são arbitrários:

1. **A porta** (passos 1 a 4) — como alguém entra no sistema, e como uma matrícula nasce.
2. **O sistema funcionando** (passos 5 a 11) — os cadastros e os relacionamentos.
   - **2b** (10b a 10g) — o financeiro fechando o ciclo da matrícula do passo 4.
   - **2c** (11b a 11f) — o professor: o escopo por vínculo e a chamada.
3. **Quem vê o quê** (passos 12 a 15) — o controle de acesso em três camadas.

O ato 3 vem por último de propósito: ele só impressiona depois que o professor já viu o sistema completo e sabe o que está sendo escondido. E o ato 2b vem antes dele porque é o que prova a palavra "integrado": o dado que o passo 4 criou reaparece no financeiro sem ninguém o ter digitado de novo.

### Ato 1 — A porta

| Passo | Tela        | O que mostrar                                                                                                                | Frase-guia                                                                                                                                                                                    | Tempo   |
| ----- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1     | Login       | A tela de entrada e o **modal de perfis** que abre com ela. Escolher Administrador — os campos se preenchem, **sem entrar**. | "O sistema tem três perfis. Este modal é só um atalho de apresentação: ele preenche os campos, a entrada continua pelo botão. Vou começar pelo administrador, que vê tudo."                   | 40 s    |
| 1b    | Login       | Apagar o campo e digitar o **e-mail**: `admin@edumanager.com.br`. Entrar.                                                    | "O campo aceita o e-mail ou o login curto. O requisito pede entrada por e-mail; o service consulta o e-mail primeiro e, se não achar, tenta o login."                                         | 30 s    |
| 2     | Login       | Senha errada. Depois digitar `/students` na URL **sem estar logado**.                                                        | "Credencial errada não entra. E quem não está logado não acessa a área interna nem digitando a URL — quem barra é o authGuard."                                                               | 1 min   |
| 3     | Criar conta | Abrir `/criar-conta`. Preencher com **CPF inválido** (`12345678900`), e-mail sem `@`, senha `123456`, e senhas diferentes.   | "As validações são todas aqui: dígitos verificadores do CPF, formato de e-mail, senha com letra e número, e confirmação."                                                                     | 2 min   |
| 4     | Criar conta | Corrigir tudo, usando o CPF **já cadastrado** `31245287605`. Enviar. Depois corrigir para `52998224725` e concluir.          | "Além do formato, o sistema confere na API o que depende dos outros registros: CPF, e-mail e login já cadastrados. As três consultas vão juntas — a pessoa vê todos os conflitos de uma vez." | 1,5 min |

> **O passo 4 termina DENTRO do sistema, no painel do aluno, já logado** — e não na tela de login. É o requisito 3: quem acabou de criar a senha não precisa digitá-la de novo. A faixa verde no topo confirma a conta e a matrícula. Anote o curso e o valor que apareceram: eles voltam no passo 10b.

### Ato 2 — O sistema funcionando

Entre como `admin` / `admin123` (ou pelo e-mail `admin@edumanager.com.br`).

| Passo | Tela                                 | O que mostrar                                                                                      | Frase-guia                                                                                                                          | Tempo   |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 5     | Painel                               | Os cards e as duas listas.                                                                         | "O painel do administrador mostra a escola inteira. Guarde isso: no fim eu mostro o mesmo painel com outro perfil."                 | 1 min   |
| 6     | Cursos                               | Criar um curso: nome, descrição, carga horária e valor.                                            | "O curso é o catálogo: o que a escola ensina. Ele não tem data nem vaga — quem tem isso é a turma."                                 | 1,5 min |
| 7     | Alunos                               | Criar um aluno com a **validação de CPF ao vivo** — primeiro o inválido, depois o válido.          | "O CPF não é validado por tamanho: o validador calcula os dois dígitos verificadores. Tem 37 testes automatizados só para ele."     | 2 min   |
| 8     | Alunos                               | Listar, editar e excluir. O CRUD completo em um módulo.                                            | "Os oito módulos seguem exatamente esta estrutura — mesma lista, mesmo formulário, mesmas regras. É a herança de `BaseApiService`." | 2 min   |
| 9     | Turmas                               | Criar uma turma escolhendo o curso do passo 6. Mostrar turno, período e capacidade.                | "**Momento do relacionamento.** A turma guarda o id do curso, não o nome. Renomear o curso reflete aqui automaticamente."           | 1,5 min |
| 10    | Matrículas → Financeiro → Frequência | Matricular o aluno do passo 7 na turma do passo 9. Gerar uma parcela e dar baixa. Lançar presença. | "**Momento da tabela associativa.** A matrícula liga aluno e turma, e dela saem as parcelas e a frequência."                        | 3 min   |
| 11    | API (navegador)                      | Abrir `http://localhost:3000/students` e achar o aluno criado no passo 7.                          | "O dado que apareceu na tela está no JSON da API. O front conversa com o backend de verdade."                                       | 1 min   |

### Ato 2b — O fluxo que fecha o ciclo (financeiro e professor)

Este é o trecho que mostra o sistema **integrado**, e não oito cadastros lado a lado. Faça depois do passo 11, ainda como `admin`.

| Passo | Tela                  | O que mostrar                                                                                          | Frase-guia                                                                                                                                                                                                                        | Tempo   |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 10b   | Lançamentos           | Achar o lançamento da conta criada no passo 4. Abrir.                                                  | "Eu não criei este lançamento. Ele nasceu da matrícula que saiu do autocadastro: uma gravação puxou a outra. Aqui está o combinado — valor, condição, forma informada — e o saldo."                                               | 1,5 min |
| 10c   | Lançamentos → detalhe | Apontar a parcela **pendente** e o aviso de que nada foi cobrado.                                      | "O aluno escolheu PIX. O sistema **não** marcou nada como pago por causa disso: não existe gateway aqui, e marcar sozinho seria mentir sobre dinheiro. Quem confirma é o administrador."                                          | 1 min   |
| 10d   | Lançamentos → detalhe | Clicar em **Confirmar**, mostrar o diálogo, confirmar.                                                 | "Operação de dinheiro passa por confirmação. E repare no que mudou de uma vez: a parcela, o saldo, a situação do lançamento — e, em Matrículas, a situação da matrícula, que era Pendente e virou Ativa."                         | 1,5 min |
| 10e   | Matrículas            | Mostrar a matrícula agora **Ativa**, sem ninguém ter editado.                                          | "Ninguém editou esta matrícula. Quem a ativou foi a confirmação do pagamento — a regra está no `FinanceiroService`, num lugar só, porque ela vale para a matrícula feita no autocadastro e para a feita aqui pelo administrador." | 1 min   |
| 10f   | Matrículas → Nova     | Criar uma matrícula escolhendo **Parcelado em 3×**. Mostrar a **prévia das parcelas** antes de salvar. | "Antes de gravar, o sistema mostra exatamente o que vai gravar: três parcelas, vencimentos de mês em mês. E a soma fecha com o total — a sobra de centavo vai na última parcela, e tem 27 testes só dessa conta."                 | 2 min   |
| 10g   | Painel (admin)        | Os cards de dinheiro: recebido, pendente e em atraso.                                                  | "Os números do painel não são fixos: saem das parcelas. Confirmei um pagamento há um minuto e o card de recebidos subiu."                                                                                                         | 1 min   |

### Ato 2c — O professor

| Passo | Tela                        | O que mostrar                                        | Frase-guia                                                                                                                                                                                                            | Tempo |
| ----- | --------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 11b   | (entrar como `professor`)   | O menu e o rodapé "Somente os seus cursos e turmas". | "Mesmo sistema, terceiro perfil. Ele não é 'vê tudo' nem 'vê só o que é meu': ele vê os registros **dos alunos dele**. É o escopo mais interessante dos três, porque é o único que mostra dados de outras pessoas."   | 1 min |
| 11c   | Chamada                     | Escolher a turma, marcar uma falta, salvar.          | "A chamada é a tela de trabalho dele: turma, data, todos presentes por padrão, e ele só toca em quem faltou. Trinta alunos em uma tela, em vez de trinta formulários."                                                | 2 min |
| 11d   | Chamada                     | Escolher a **mesma** turma e data de novo.           | "As marcações voltam preenchidas. Ele não está criando uma segunda chamada: está corrigindo a primeira. É assim que a regra de 'um registro por aluno, turma e data' é cumprida sem mostrar erro para ele."           | 1 min |
| 11e   | Financeiro (como professor) | A lista de lançamentos **sem** o botão de confirmar. | "Ele consulta a situação financeira dos alunos dele, e não altera. Não é a tela que esconde o botão por gentileza: a matriz nega a ele criar, editar e excluir no financeiro, e há teste para isso."                  | 1 min |
| 11f   | URL                         | Digitar `/users`.                                    | "E aqui está a resposta das três proibições do enunciado de uma vez: ele não cria administradores, não altera as próprias permissões e não exclui contas — porque não alcança a área de credenciais, nem para olhar." | 1 min |

> **Se o tempo apertar, corte o Ato 2 (passos 6 a 8), não este.** CRUD o professor já viu em outros trabalhos; processo integrado e controle de acesso por vínculo, não.

### Ato 3 — Quem vê o quê

| Passo | Tela                             | O que mostrar                                                   | Frase-guia                                                                                                                                                                                                           | Tempo   |
| ----- | -------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 12    | Usuários                         | A coluna **Vínculo**. Sair.                                     | "Uma conta de aluno aponta para um aluno do cadastro. É esse vínculo que diz quais matrículas ela alcança — sem ele, o sistema sabe que é aluno, mas não qual."                                                      | 1 min   |
| 13    | (como `aluno`)                   | Painel, Minhas matrículas, Minhas mensalidades.                 | "Mesmo sistema, outro perfil. O menu perdeu Alunos, Cursos, Turmas e Usuários. E o painel não tem mais o card de inadimplência da escola — só o que ele deve."                                                       | 2 min   |
| 13b   | (como `aluno`)                   | Digitar `/students` na URL.                                     | "Esconder do menu não restringe nada — bastaria digitar a URL. Quem nega é o guard de rota, em todas as rotas internas."                                                                                             | 1 min   |
| 13c   | (como `aluno`)                   | Minhas matrículas: apontar que a turma tem outros alunos.       | "Ele estuda numa turma com colegas e vê **só a matrícula dele**. O filtro é pelo próprio id, não pela turma — se fosse pela turma, ele leria as mensalidades e as faltas dos outros."                                | 1,5 min |
| 14    | (como a conta criada no passo 4) | Entrar com a conta nova e abrir Minhas matrículas.              | "Esta é a conta que criei no começo, com o curso que escolhi no cadastro. A matrícula saiu pronta de lá."                                                                                                            | 1,5 min |
| 15    | Código                           | `acesso.service.ts`, a matriz de permissões. Depois `npm test`. | "As três camadas — menu, rota e filtro de dados — leem a **mesma** tabela. E o projeto tem 138 testes, 40 só de permissão, porque permissão com defeito não aparece na tela: funciona silenciosamente ao contrário." | 2 min   |

**Total estimado:** cerca de 35 minutos com as perguntas. Se a banca der 20, veja a nota de corte no fim do Ato 2c.

### Regras de condução

- **Crie o dado no passo 7 e use nos passos 9, 10 e 11.** O professor acompanha o mesmo aluno atravessando o sistema inteiro, e os relacionamentos ficam evidentes sem explicação teórica.
- **Nunca pule o erro.** Mostre a validação falhando antes de mostrá-la passando. É o que prova que ela existe.
- **O passo 11 é o mais importante tecnicamente.** O registro criado na tela aparecendo no JSON da API prova que front e backend conversam.
- **O passo 13c é o mais importante conceitualmente.** É a regra que diferencia este trabalho de um CRUD com login.
- **Diga a limitação antes de ser perguntado.** No passo 15: "esta restrição é de interface; num sistema real a mesma matriz teria que existir no backend". Antecipar isso vale mais que ser pego por ela.
- Se algo quebrar: diga o que deveria acontecer, siga para o próximo passo e volte ao problema no final. **Não depure ao vivo.**

---

## Parte 3 — Perguntas técnicas prováveis

Cada pergunta tem: a resposta curta (o que falar), o arquivo a abrir se o professor pedir prova, e a armadilha a evitar. As respostas serão preenchidas na Onda em que o código estiver pronto.

### 3.1 Arquitetura e organização

#### P1. Onde está o MVC neste projeto? O Angular não é MVC.

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — mapear Model = core/models, View = templates HTML, Controller = classes dos componentes, Service = core/services]`
- **Armadilha:** dizer que o Angular "é MVC" sem ressalva. O Angular é baseado em componentes; o projeto **organiza** as camadas seguindo a ideia do MVC. A nota de arquitetura chama isso de "MVC adaptado ao Angular" — é esse o termo a usar.

#### P2. O que é um service e por que não chamar a API direto do componente?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — um service de core/services e o componente que o injeta]`
- **Armadilha:** não saber explicar a injeção de dependência (`@Injectable`, o service recebido no construtor do componente). O professor costuma puxar por aí.

#### P3. Onde está a programação orientada a objetos?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — interfaces dos models, classes dos componentes, classes dos services, encapsulamento, reaproveitamento do validador]`
- **Armadilha:** responder só "usei classes". Precisa nomear os conceitos presentes de fato (classe, interface, encapsulamento, injeção de dependência, reúso) e apontar onde cada um está. Também é preciso saber dizer que **interface do TypeScript não existe em tempo de execução** — ela é contrato de tipo, não objeto.

#### P4. Por que essa estrutura de pastas? O que é `core`, `shared` e `features`?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — a árvore de src/app]`
- **Armadilha:** —

### 3.2 Formulários e validação

#### P5. O que é Reactive Forms e qual a diferença do template-driven?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — um FormGroup montado na classe do componente e o [formGroup] no template]`
- **Armadilha:** confundir com `ngModel`. Se o projeto usa Reactive Forms, não deve haver `ngModel` nos formulários; é bom conferir antes para não ser contradito pelo próprio código.

#### P6. Como funciona a validação de CPF por dígitos verificadores? Explique o algoritmo.

- **Resposta curta:** `[A PREENCHER]`
- **Algoritmo a explicar passo a passo:** `[A PREENCHER — remover a formatação; rejeitar sequências repetidas; primeiro dígito: pesos 10 a 2 sobre os 9 primeiros dígitos, somar, multiplicar por 10, resto da divisão por 11, resto 10 ou 11 vira 0; segundo dígito: pesos 11 a 2 sobre os 10 primeiros, mesmo cálculo; comparar com os dois últimos dígitos informados]`
- **Mostrar no código:** `[A PREENCHER — o validador em core/validators]`
- **Demonstrar ao vivo:** digitar `123.456.789-00` (rejeita), depois `529.982.247-25` (aceita).
- **Armadilha:** esta é a pergunta mais provável de todas, e a mais fácil de errar. O estudante tem de saber **por que `111.111.111-11` precisa ser rejeitado à parte**: ele passa na conta dos dígitos verificadores, então sem o teste de sequência repetida o validador o aceitaria.

#### P7. O que é um validador customizado e como o Angular o usa?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — a assinatura ValidatorFn, o retorno null para válido e objeto de erro para inválido, e o registro do validador no FormControl]`
- **Armadilha:** não saber explicar por que válido retorna `null`. É contraintuitivo e o professor pode explorar.

#### P8. Como são feitas as validações de mínimo e máximo de caracteres?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — Validators.minLength e Validators.maxLength, e a exibição da mensagem no template]`
- **Referência:** os limites de cada campo estão em `docs/dicionario-de-dados.md`.

### 3.3 Comunicação com a API

#### P9. Como o Angular conversa com o JSON Server?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — HttpClient injetado no service, os métodos get/post/put/delete, a URL base]`
- **Demonstrar ao vivo:** criar um registro na tela e abrir a rota da API no navegador para mostrar o JSON (é o passo 13 da demonstração).
- **Armadilha:** não saber dizer que a requisição é **assíncrona** e que o retorno é um `Observable`, não o dado pronto.

#### P10. O que é um Observable e por que não é uma Promise?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — o subscribe no componente]`
- **Armadilha:** entrar em RxJS avançado. Para o escopo acadêmico basta: o `HttpClient` devolve um Observable, o componente se inscreve com `subscribe`, e o código dentro do `subscribe` roda quando a resposta chega.

#### P11. Por que JSON Server e não um banco de dados real?

- **Resposta curta:** `[A PREENCHER]`
- **Pontos a cobrir:** `[A PREENCHER — o foco da disciplina é o frontend e o consumo de API REST; o JSON Server entrega uma API REST completa sem escrever backend; o contrato HTTP é o mesmo de uma API real, então trocar o backend não exigiria mudar os componentes, só os services; é uma decisão de escopo acadêmico, não uma limitação técnica desconhecida]`
- **Armadilha:** soar como desculpa. A resposta certa é **assumir a decisão e apontar suas limitações** antes de o professor apontar: não tem autenticação, não tem transação, não tem integridade referencial, e a senha fica em texto puro. Quem nomeia as próprias limitações demonstra que entendeu a ferramenta.

#### P12. Como os relacionamentos funcionam sem chave estrangeira?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — os campos xxxId, os selects que carregam as opções válidas da API, e o uso de _expand]`
- **Referência:** a seção 9 de `docs/dicionario-de-dados.md` e a seção 9 de `docs/endpoints.md`.
- **Armadilha:** não saber dizer **quem garante a integridade**. A resposta é: a aplicação Angular, porque o usuário escolhe em um select carregado da API e nunca digita um id. O JSON Server não garante nada.

### 3.4 Rotas e autenticação

#### P13. Como funciona o login? Onde a sessão fica guardada?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — o service de autenticação e a consulta filtrada em /users]`
- **Armadilha:** chamar isso de autenticação segura. Não é: a consulta de login manda a senha na query string e a comparação acontece no frontend. Em um sistema real o backend receberia as credenciais, compararia com um hash e devolveria um token.

#### P14. Como as rotas são protegidas?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — o guard e sua aplicação em app.routes.ts]`
- **Demonstrar ao vivo:** deslogar e digitar `/alunos` na barra de endereços.
- **Armadilha:** apresentar o guard como barreira de segurança. Ele é proteção de **navegação**: a API continua acessível direto pelo navegador, como o passo 13 da demonstração mostra.

#### P15. O que é o Angular Router e como a navegação funciona sem recarregar a página?

- **Resposta curta:** `[A PREENCHER]`
- **Mostrar no código:** `[A PREENCHER — app.routes.ts, router-outlet, routerLink]`

### 3.5 Perguntas sobre decisões e escopo

#### P16. Por que os nomes dos campos estão em inglês e os status em português?

- **Resposta curta:** `[A PREENCHER — convenção de código em inglês, interface no idioma do usuário]`

#### P17. O que você faria diferente se fosse um sistema de produção?

- **Resposta curta:** `[A PREENCHER — backend real com autenticação e hash de senha, banco relacional com integridade referencial e transação, validação também no servidor, testes automatizados, controle de acesso por perfil de verdade]`
- **Observação:** é uma pergunta de maturidade, não uma crítica. Responder com uma lista curta e consciente vale mais do que defender o projeto.

#### P18. Qual foi a parte mais difícil?

- **Resposta curta:** `[A PREENCHER — pelo estudante, com uma dificuldade técnica real e como foi resolvida]`
- **Armadilha:** responder "nenhuma". Soa como código que o estudante não escreveu.

#### P19. O sistema usa inteligência artificial?

- **Resposta curta:** Não. É uma decisão de escopo do projeto: o sistema é um CRUD com validação, e todo o comportamento é determinístico e explicável linha por linha.

---

## Parte 4 — Perguntas de reserva (menos prováveis, mas possíveis)

Lista para o estudante dar uma olhada na véspera. Respostas a preencher junto com as demais.

| #   | Pergunta                                                    | Resposta                                                                        |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| R1  | O que é TypeScript e o que ele acrescenta ao JavaScript?    | `[A PREENCHER]`                                                                 |
| R2  | Qual a diferença entre `interface` e `class` no TypeScript? | `[A PREENCHER]`                                                                 |
| R3  | O que é o Angular Material e por que usá-lo?                | `[A PREENCHER]`                                                                 |
| R4  | O que é um componente Angular? Quais são suas partes?       | `[A PREENCHER]`                                                                 |
| R5  | O que é injeção de dependência?                             | `[A PREENCHER]`                                                                 |
| R6  | Para que serve o `ngOnInit`?                                | `[A PREENCHER]`                                                                 |
| R7  | Qual a diferença entre PUT e PATCH?                         | `[A PREENCHER]`                                                                 |
| R8  | O que significa REST?                                       | `[A PREENCHER]`                                                                 |
| R9  | Como você testou o sistema?                                 | `[A PREENCHER — apontar a docs/checklist-de-testes.md]`                         |
| R10 | O que acontece se o JSON Server estiver desligado?          | `[A PREENCHER — mostrar a mensagem de erro tratada, cenário 14.4 da checklist]` |
| R11 | Como o sistema evita CPF duplicado?                         | `[A PREENCHER — depende da decisão do Agente-mãe no cenário 11.15]`             |
| R12 | O que é um pipe no Angular? Onde você usou?                 | `[A PREENCHER — provavelmente date e currency nas listagens]`                   |

---

## Parte 5 — Como esta estrutura será completada

| Etapa                               | Depende de                    | Entrega                                                                          |
| ----------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| Preencher as frases-guia da Parte 2 | Telas implementadas           | Texto do que falar em cada passo da demonstração.                                |
| Preencher as respostas da Parte 3   | Código implementado           | Resposta curta e o caminho `arquivo:linha` para abrir diante do professor.       |
| Preencher as respostas da Parte 4   | Código implementado           | Respostas de reserva.                                                            |
| Validar o roteiro                   | Checklist de testes executada | Ensaio cronometrado com o estudante, ajustando o que ele não conseguir explicar. |

Toda resposta preenchida precisa atender a dois critérios: **o estudante consegue repeti-la com as próprias palavras** e **existe um arquivo do projeto que a comprova**. Resposta que não passa nos dois critérios sai do roteiro, e o ponto correspondente é reportado ao Agente-mãe como problema de clareza didática (bloco 18 da checklist de testes).
