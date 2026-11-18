# Checklist de Testes — EduManager (Fase 6)

Responsável pela execução: **Lupa (QA e Documentação)**.

Esta checklist é a bateria de testes manuais da Fase 6 do backlog. Todos os cenários começam com status **pendente** e serão marcados conforme a execução, depois que o sistema estiver implementado.

## Legenda de status

| Status    | Significado                                                                        |
| --------- | ---------------------------------------------------------------------------------- |
| pendente  | Ainda não executado.                                                               |
| ok        | Executado e aprovado.                                                              |
| falhou    | Executado e reprovado. Bug registrado em `docs/relatorio-de-bugs.md`.              |
| bloqueado | Não foi possível executar (depende de outro cenário ou de funcionalidade ausente). |
| n/a       | Não se aplica (decisão de escopo do Agente-mãe).                                   |

## Agentes responsáveis (coluna "Agente")

| Sigla      | Papel         | Área                                                    |
| ---------- | ------------- | ------------------------------------------------------- |
| PRUMO      | Arquiteto     | models, guards, rotas, config base                      |
| AQUEDUTO   | Backend       | `api/db.json`, services, scripts da API                 |
| VITRAL     | Frontend base | estilos, tema Material, layout, shared, auth, dashboard |
| ENGRENAGEM | CRUD          | telas dos módulos, validadores                          |
| LUPA       | QA e Docs     | execução desta checklist, README, docs                  |

## Pré-condições gerais

Antes de executar qualquer bloco:

1. JSON Server rodando em `http://localhost:3000`.
2. Angular rodando em `http://localhost:4200`.
3. `api/db.json` com os dados de exemplo (seed) carregados.
4. Navegador com o console aberto (F12) para capturar erros de JavaScript e de rede.

CPFs usados nos testes (matematicamente válidos, para o validador de dígitos verificadores):

| CPF              | Situação                                 |
| ---------------- | ---------------------------------------- |
| `529.982.247-25` | válido                                   |
| `111.444.777-35` | válido                                   |
| `123.456.789-00` | inválido (dígitos verificadores errados) |
| `111.111.111-11` | inválido (sequência repetida)            |
| `000.000.000-00` | inválido (sequência repetida)            |

---

## 1. Login e proteção de rotas

| #    | Cenário                            | Passos                                                                                                                    | Resultado esperado                                                                               | Status   | Agente |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- | ------ |
| 1.1  | Login pelo **login** curto         | 1. Abrir `/login`. 2. Informar `admin` / `admin123`. 3. Clicar em Entrar.                                                 | Redireciona para `/dashboard`. O nome do usuário aparece no layout.                              | OK       | VITRAL |
| 1.1b | Login pelo **e-mail**              | 1. Abrir `/login`. 2. Informar `admin@edumanager.com.br` / `admin123`. 3. Entrar.                                         | Entra na **mesma** conta do 1.1. É o requisito "login com e-mail e senha".                       | OK       | VITRAL |
| 1.2  | Login com senha errada             | 1. Abrir `/login`. 2. Informar login válido e senha incorreta. 3. Entrar.                                                 | Permanece em `/login`: "E-mail/login ou senha invalidos." Não redireciona.                       | OK       | VITRAL |
| 1.3  | Login com usuário inexistente      | 1. Informar login `naoexiste` e qualquer senha. 2. Entrar.                                                                | Mesma mensagem do 1.2 — não revela qual dos dois campos errou. Nenhum erro no console.           | OK       | VITRAL |
| 1.5  | Campos obrigatórios do login       | 1. Abrir `/login`. 2. Clicar em Entrar com os dois campos vazios.                                                         | Mensagens de campo obrigatório nos dois campos. Nenhuma requisição à API.                        | OK       | VITRAL |
| 1.5b | Limites do campo de login          | 1. Digitar 3 caracteres no identificador e 5 na senha.                                                                    | "Minimo de 4 caracteres" e "Minimo de 6 caracteres" — os mesmos limites do cadastro de usuários. | OK       | VITRAL |
| 1.5c | API fora do ar                     | 1. Parar o `npm run api`. 2. Tentar entrar com credencial correta.                                                        | "Nao foi possivel conectar a API…" — e **não** a mensagem de credencial inválida.                | OK       | VITRAL |
| 1.6  | Rota protegida sem login           | 1. Sem estar logado, digitar `/alunos` na barra de endereços.                                                             | Redireciona para `/login`. Não exibe a tela de alunos nem por um instante.                       | pendente | PRUMO  |
| 1.7  | Rota protegida em todos os módulos | Repetir 1.6 para `/courses`, `/classes`, `/enrollments`, `/payments`, `/attendances`, `/users`, `/reports`, `/dashboard`. | Todas redirecionam para `/login`.                                                                | pendente | PRUMO  |
| 1.8  | Logout                             | 1. Logado, clicar em Sair.                                                                                                | Volta para `/login`. Sessão encerrada. Voltar no navegador não dá acesso à tela anterior.        | pendente | VITRAL |
| 1.9  | Sessão sobrevive ao refresh        | 1. Logado em `/dashboard`, pressionar F5.                                                                                 | Continua logado em `/dashboard`, sem voltar para o login.                                        | pendente | VITRAL |
| 1.10 | Rota inexistente                   | 1. Digitar `/paginaquenaoexiste`.                                                                                         | Redireciona para o dashboard ou exibe página de não encontrado. Não fica com a tela branca.      | pendente | PRUMO  |

---

## 2. CRUD — Alunos

| #   | Cenário                             | Passos                                                                                           | Resultado esperado                                                                                        | Status   | Agente     |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 2.1 | Listar alunos                       | 1. Menu > Alunos.                                                                                | Tabela carrega com os alunos do seed. Colunas legíveis. Sem erro no console.                              | pendente | ENGRENAGEM |
| 2.2 | Criar aluno                         | 1. Novo Aluno. 2. Preencher todos os campos com dados válidos (CPF `529.982.247-25`). 3. Salvar. | Mensagem de sucesso. Volta para a lista. O aluno aparece na tabela. O registro existe em `GET /students`. | pendente | ENGRENAGEM |
| 2.3 | Editar aluno                        | 1. Editar o aluno criado em 2.2. 2. Alterar o nome. 3. Salvar.                                   | O novo nome aparece na lista. Nenhum outro campo foi perdido (conferir no `GET /students/:id`).           | pendente | ENGRENAGEM |
| 2.4 | Formulário de edição vem preenchido | 1. Clicar em Editar em um aluno.                                                                 | Todos os campos já vêm com os valores atuais, inclusive data e status.                                    | pendente | ENGRENAGEM |
| 2.5 | Excluir aluno                       | 1. Excluir o aluno criado em 2.2. 2. Confirmar.                                                  | Pede confirmação antes. Após confirmar, sai da lista e do `db.json`.                                      | pendente | ENGRENAGEM |
| 2.6 | Cancelar a exclusão                 | 1. Excluir um aluno. 2. Cancelar na confirmação.                                                 | O aluno permanece na lista. Nenhuma requisição DELETE enviada.                                            | pendente | ENGRENAGEM |
| 2.7 | Lista vazia                         | 1. Com a coleção sem registros, abrir Alunos.                                                    | Mensagem de lista vazia. Não exibe tabela quebrada nem erro.                                              | pendente | ENGRENAGEM |

---

## 3. CRUD — Cursos

| #   | Cenário                                     | Passos                                                                             | Resultado esperado                                                   | Status   | Agente     |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- | ---------- |
| 3.1 | Listar cursos                               | 1. Menu > Cursos.                                                                  | Tabela com nome, carga horária, preço e situação.                    | pendente | ENGRENAGEM |
| 3.2 | Criar curso                                 | 1. Novo Curso. 2. Nome, descrição, carga horária 600, preço 980, ativo. 3. Salvar. | Sucesso. Aparece na lista e em `GET /courses`.                       | pendente | ENGRENAGEM |
| 3.3 | Editar curso                                | 1. Editar o curso de 4.2. 2. Alterar o preço. 3. Salvar.                           | Novo preço na lista, formatado como moeda.                           | pendente | ENGRENAGEM |
| 3.4 | Excluir curso                               | 1. Excluir o curso de 4.2 (sem turmas vinculadas). 2. Confirmar.                   | Removido com sucesso.                                                | pendente | ENGRENAGEM |
| 3.5 | Carga horária não aceita texto nem negativo | 1. Novo Curso. 2. Digitar `abc` e depois `-10` na carga horária.                   | Campo numérico rejeita texto. Valor negativo bloqueado com mensagem. | pendente | ENGRENAGEM |
| 3.6 | Preço não aceita negativo                   | 1. Novo Curso. 2. Preço `-50`. 3. Salvar.                                          | Bloqueia com mensagem de valor inválido.                             | pendente | ENGRENAGEM |
| 3.7 | Campo ativo funciona                        | 1. Editar um curso e marcar como inativo. 2. Salvar.                               | Lista mostra a situação alterada. `active: false` no `db.json`.      | pendente | ENGRENAGEM |

---

## 4. CRUD — Turmas

| #    | Cenário                         | Passos                                                                                       | Resultado esperado                                                                                                    | Status    | Agente     |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| 4.1  | Listar turmas                   | 1. Menu > Turmas.                                                                            | Tabela mostra o **nome do curso** e o **nome do professor**, não os ids.                                              | pendente  | ENGRENAGEM |
| 4.2  | Criar turma                     | 1. Nova Turma. 2. Escolher o curso no select, código, turno, datas, capacidade. 3. Salvar.   | Sucesso. Aparece na lista com o nome do curso correto.                                                                | pendente  | ENGRENAGEM |
| 4.3  | Select de cursos preenchido     | 1. Abrir o formulário de turma.                                                              | O select de curso lista os cursos vindos da API, por nome.                                                            | pendente  | ENGRENAGEM |
| 4.4  | Select de cursos preenchido     | 1. Abrir o formulário de turma.                                                              | O select de curso lista os cursos vindos da API, por nome.                                                            | pendente  | ENGRENAGEM |
| 4.5  | Turno com os três valores       | 1. Abrir o select de turno.                                                                  | Exibe exatamente Manhã, Tarde e Noite. Salva `manha`, `tarde` ou `noite`.                                             | pendente  | ENGRENAGEM |
| 4.6  | Editar turma                    | 1. Editar a turma de 4.2. 2. Trocar o curso. 3. Salvar.                                      | Lista mostra o novo curso. `courseId` atualizado.                                                                     | pendente  | ENGRENAGEM |
| 4.7  | Excluir turma                   | 1. Excluir a turma de 5.2 (sem matrículas). 2. Confirmar.                                    | Removida com sucesso.                                                                                                 | pendente  | ENGRENAGEM |
| 4.8  | Data final antes da inicial     | 1. Nova Turma. 2. Início `2026-10-01`, fim `2026-03-01`. 3. Salvar.                          | Bloqueia com mensagem de datas inconsistentes.                                                                        | pendente  | ENGRENAGEM |
| 4.9  | Capacidade mínima               | 1. Nova Turma. 2. Capacidade `0`. 3. Salvar.                                                 | Bloqueia: capacidade precisa ser pelo menos 1.                                                                        | pendente  | ENGRENAGEM |
| 4.10 | Código da turma obrigatório     | 1. Nova Turma sem código. 2. Salvar.                                                         | Bloqueia com mensagem de campo obrigatório.                                                                           | pendente  | ENGRENAGEM |
| 4.11 | Status da turma bate com o seed | 1. Abrir o select de status da turma. 2. Comparar com os valores presentes em `api/db.json`. | O select grava exatamente os mesmos valores do seed. **Bloqueado até o Agente-mãe ratificar a lista** (ver seção 20). | bloqueado | ENGRENAGEM |

---

## 5. CRUD — Matrículas

| #    | Cenário                     | Passos                                                                                     | Resultado esperado                                                                            | Status   | Agente     |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------- | ---------- |
| 5.1  | Listar matrículas           | 1. Menu > Matrículas.                                                                      | Tabela mostra **nome do aluno** e **turma/curso**, não os ids.                                | pendente | ENGRENAGEM |
| 5.2  | Criar matrícula             | 1. Nova Matrícula. 2. Escolher aluno e turma nos selects, data, status `ativa`. 3. Salvar. | Sucesso. Aparece na lista com os nomes resolvidos.                                            | pendente | ENGRENAGEM |
| 5.3  | Select de alunos preenchido | 1. Abrir o formulário.                                                                     | Lista os alunos da API por nome.                                                              | pendente | ENGRENAGEM |
| 5.4  | Select de turmas preenchido | 1. Abrir o formulário.                                                                     | Lista as turmas da API, de forma identificável (código ou código + curso).                    | pendente | ENGRENAGEM |
| 5.5  | Editar matrícula            | 1. Editar a matrícula de 6.2. 2. Mudar status para `concluida`. 3. Salvar.                 | Status atualizado na lista.                                                                   | pendente | ENGRENAGEM |
| 5.6  | Cancelar matrícula          | 1. Mudar o status de uma matrícula para `cancelada`.                                       | Status atualizado. Visualmente distinto das ativas.                                           | pendente | ENGRENAGEM |
| 5.7  | Excluir matrícula           | 1. Excluir a matrícula de 6.2. 2. Confirmar.                                               | Removida com sucesso.                                                                         | pendente | ENGRENAGEM |
| 5.8  | Matrícula duplicada         | 1. Matricular o mesmo aluno na mesma turma duas vezes.                                     | Esperado: bloqueio com aviso de aluno já matriculado. **Regra a confirmar com o Agente-mãe.** | pendente | ENGRENAGEM |
| 5.9  | Capacidade da turma         | 1. Matricular alunos além do `capacity` da turma.                                          | Esperado: aviso de turma lotada. **Regra a confirmar com o Agente-mãe.**                      | pendente | ENGRENAGEM |
| 5.10 | Os três status aparecem     | 1. Abrir o select de status.                                                               | Exibe Ativa, Cancelada e Concluída. Salva `ativa`, `cancelada`, `concluida`.                  | pendente | ENGRENAGEM |

---

## 6. CRUD — Financeiro

| #   | Cenário                                    | Passos                                                                                         | Resultado esperado                                                                       | Status   | Agente     |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- | ---------- |
| 6.1 | Listar pagamentos                          | 1. Menu > Financeiro.                                                                          | Tabela com a matrícula identificada pelo **nome do aluno**, vencimento, valor e status.  | pendente | ENGRENAGEM |
| 6.2 | Criar pagamento                            | 1. Novo Pagamento. 2. Escolher matrícula, vencimento, valor 200, status `pendente`. 3. Salvar. | Sucesso. Aparece na lista. `paidAt` gravado como `null`.                                 | pendente | ENGRENAGEM |
| 6.3 | Dar baixa no pagamento                     | 1. Marcar como pago o registro de 7.2, com a data de pagamento.                                | Status muda para Pago. `paidAt` preenchido no `db.json`.                                 | pendente | ENGRENAGEM |
| 6.4 | Editar pagamento                           | 1. Editar o valor de um pagamento. 2. Salvar.                                                  | Novo valor na lista, formatado em reais.                                                 | pendente | ENGRENAGEM |
| 6.5 | Excluir pagamento                          | 1. Excluir o registro de 7.2. 2. Confirmar.                                                    | Removido com sucesso.                                                                    | pendente | ENGRENAGEM |
| 6.6 | Valor não aceita zero nem negativo         | 1. Novo Pagamento com valor `0` e depois `-10`. 2. Salvar.                                     | Bloqueia nos dois casos com mensagem de valor inválido.                                  | pendente | ENGRENAGEM |
| 6.7 | Coerência entre status e data de pagamento | 1. Marcar status `pago` sem informar a data de pagamento.                                      | Esperado: exige a data quando o status é `pago`. **Regra a confirmar com o Agente-mãe.** | pendente | ENGRENAGEM |
| 6.8 | Cores dos status                           | 1. Olhar a lista com os três status presentes.                                                 | Pago em `#16A34A`, pendente em `#64748B`, atrasado em `#DC2626`.                         | pendente | VITRAL     |
| 6.9 | Select de matrículas preenchido            | 1. Abrir o formulário.                                                                         | Lista as matrículas de forma identificável (nome do aluno e turma), não o id cru.        | pendente | ENGRENAGEM |

---

## 7. CRUD — Frequência

| #   | Cenário                         | Passos                                                                         | Resultado esperado                                                                                                  | Status   | Agente     |
| --- | ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 7.1 | Listar frequência               | 1. Menu > Frequência.                                                          | Lista com turma, aluno, data e presença legíveis.                                                                   | pendente | ENGRENAGEM |
| 7.2 | Registrar presença              | 1. Novo registro. 2. Escolher turma, aluno, data e marcar presente. 3. Salvar. | Sucesso. `present: true` no `db.json`.                                                                              | pendente | ENGRENAGEM |
| 7.3 | Registrar ausência              | 1. Novo registro com presença desmarcada. 2. Salvar.                           | `present: false`. Na tela aparece como Ausente.                                                                     | pendente | ENGRENAGEM |
| 7.4 | Filtrar por turma e data        | 1. Escolher uma turma e uma data no filtro.                                    | Exibe apenas os registros daquela turma naquela data (`?classId=&date=`).                                           | pendente | ENGRENAGEM |
| 7.5 | Editar registro de presença     | 1. Alterar uma presença para ausência. 2. Salvar.                              | Alteração refletida na lista.                                                                                       | pendente | ENGRENAGEM |
| 7.6 | Excluir registro de presença    | 1. Excluir o registro de 8.2. 2. Confirmar.                                    | Removido com sucesso.                                                                                               | pendente | ENGRENAGEM |
| 7.7 | Alunos listados são os da turma | 1. Escolher uma turma no formulário.                                           | O select de aluno traz apenas os alunos matriculados naquela turma. **Comportamento a confirmar com o Agente-mãe.** | pendente | ENGRENAGEM |
| 7.8 | Presença duplicada              | 1. Registrar o mesmo aluno, na mesma turma, na mesma data, duas vezes.         | Esperado: bloqueio com aviso de registro já existente. **Regra a confirmar com o Agente-mãe.**                      | pendente | ENGRENAGEM |

---

## 8. CRUD — Usuários

| #    | Cenário                    | Passos                                                                        | Resultado esperado                                                                               | Status   | Agente     |
| ---- | -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- | ---------- |
| 8.1  | Listar usuários            | 1. Menu > Usuários.                                                           | Tabela com nome, login, perfil e situação. **A senha não deve aparecer na listagem.**            | pendente | ENGRENAGEM |
| 8.2  | Criar usuário              | 1. Novo Usuário. 2. Dados válidos, perfil `admin`, ativo. 3. Salvar.          | Sucesso. Aparece na lista.                                                                       | pendente | ENGRENAGEM |
| 8.3  | Login com o usuário criado | 1. Sair. 2. Entrar com a credencial criada em 9.2.                            | Login funciona. Confirma que o cadastro prévio pelo administrador atende ao requisito acadêmico. | pendente | ENGRENAGEM |
| 8.4  | Editar usuário             | 1. Editar o usuário de 8.2. 2. Trocar o perfil para `aluno`. 3. Salvar.       | Perfil atualizado na lista, e o campo de vínculo passa a ser obrigatório.                        | pendente | ENGRENAGEM |
| 8.5  | Desativar usuário          | 1. Criar um usuário e marcá-lo como inativo. 2. Sair e tentar entrar com ele. | Não entra. Mensagem **específica**: "Esta conta esta desativada e nao pode entrar no sistema."   | pendente | ENGRENAGEM |
| 8.6  | Excluir usuário            | 1. Excluir o usuário de 9.2. 2. Confirmar.                                    | Removido com sucesso.                                                                            | pendente | ENGRENAGEM |
| 8.7  | Os dois perfis aparecem    | 1. Abrir o select de perfil.                                                  | Exibe Administrador e Aluno. Salva `admin` e `aluno`.                                            | pendente | ENGRENAGEM |
| 8.8  | Login duplicado            | 1. Criar um usuário com um `login` que já existe (ex.: `admin`).              | Bloqueio: "O login "admin" ja esta em uso por Carlos Eduardo Nunes." Nada é gravado.             | OK       | ENGRENAGEM |
| 8.9  | E-mail duplicado           | 1. Criar um usuário com o e-mail `admin@edumanager.com.br`.                   | Bloqueio: "O e-mail … ja esta cadastrado para Carlos Eduardo Nunes." Nada é gravado.             | OK       | ENGRENAGEM |
| 8.10 | Editar sem trocar nada     | 1. Abrir um usuário existente. 2. Salvar sem alterar login nem e-mail.        | **Salva normalmente**: o próprio registro é descartado da verificação de duplicidade.            | OK       | ENGRENAGEM |
| 8.9  | Campo de senha mascarado   | 1. Abrir o formulário de usuário.                                             | O campo senha é do tipo password, exibindo pontos no lugar dos caracteres.                       | pendente | ENGRENAGEM |

---

## 9. Relatórios simples

| #   | Cenário                  | Passos                                                                         | Resultado esperado                                                              | Status   | Agente     |
| --- | ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------- | ---------- |
| 9.1 | Abrir relatórios         | 1. Menu > Relatórios.                                                          | A tela abre com os relatórios disponíveis, sem erro no console.                 | pendente | ENGRENAGEM |
| 9.2 | Alunos por turma         | 1. Escolher uma turma.                                                         | Lista os alunos matriculados nela. Os totais conferem com o `db.json`.          | pendente | ENGRENAGEM |
| 9.3 | Pagamentos pendentes     | 1. Abrir o relatório financeiro.                                               | Lista as parcelas com status `pendente` e `atrasado`. Soma dos valores correta. | pendente | ENGRENAGEM |
| 9.4 | Totais do dashboard      | 1. Abrir o dashboard. 2. Comparar cada total com a contagem real no `db.json`. | Todos os números conferem.                                                      | pendente | VITRAL     |
| 9.5 | Relatório com base vazia | 1. Abrir um relatório sem dados correspondentes.                               | Mensagem de ausência de dados. Não exibe tabela quebrada nem `NaN`.             | pendente | ENGRENAGEM |

---

## 10. Validação de CPF por dígitos verificadores

Este é o bloco que o professor tem mais chance de testar ao vivo. Aplicar na tela de **Alunos** e no **autocadastro** (`/criar-conta`), que usam o mesmo validador.

| #     | Cenário                                     | Passos                                                                                        | Resultado esperado                                                                                     | Status   | Agente     |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- | ---------- |
| 10.1  | CPF válido aceito (aluno)                   | 1. Novo Aluno. 2. CPF `529.982.247-25`. 3. Salvar.                                            | Aceito sem erro. Registro salvo.                                                                       | pendente | ENGRENAGEM |
| 10.2  | Segundo CPF válido aceito (aluno)           | 1. Novo Aluno. 2. CPF `111.444.777-35`. 3. Salvar.                                            | Aceito. Confirma que 11.1 não passou por coincidência.                                                 | pendente | ENGRENAGEM |
| 10.3  | CPF com dígito verificador errado rejeitado | 1. Novo Aluno. 2. CPF `123.456.789-00`.                                                       | Rejeitado com mensagem de CPF inválido. Não envia à API.                                               | pendente | ENGRENAGEM |
| 10.4  | CPF válido alterado em um dígito            | 1. Usar `529.982.247-26` (último dígito trocado).                                             | Rejeitado. Prova que a validação é por cálculo, não por formato.                                       | pendente | ENGRENAGEM |
| 10.5  | Sequência repetida `111.111.111-11`         | 1. Informar esse CPF.                                                                         | Rejeitado, mesmo que passe na conta dos dígitos verificadores.                                         | pendente | ENGRENAGEM |
| 10.6  | Sequência repetida `000.000.000-00`         | 1. Informar esse CPF.                                                                         | Rejeitado.                                                                                             | pendente | ENGRENAGEM |
| 10.7  | Demais sequências repetidas                 | 1. Testar `222.222.222-22` até `999.999.999-99`.                                              | Todas rejeitadas.                                                                                      | pendente | ENGRENAGEM |
| 10.8  | CPF curto                                   | 1. Informar `1234567`.                                                                        | Rejeitado com mensagem de CPF incompleto.                                                              | pendente | ENGRENAGEM |
| 10.9  | CPF longo                                   | 1. Informar 12 ou mais dígitos.                                                               | Campo impede a digitação além de 11 dígitos, ou rejeita no envio.                                      | pendente | ENGRENAGEM |
| 10.10 | CPF com letras                              | 1. Informar `abc.def.ghi-jk`.                                                                 | Rejeitado. Preferencialmente o campo nem aceita letras.                                                | pendente | ENGRENAGEM |
| 10.11 | CPF vazio                                   | 1. Deixar o CPF em branco. 2. Salvar.                                                         | Rejeitado como campo obrigatório.                                                                      | pendente | ENGRENAGEM |
| 10.12 | CPF com e sem máscara                       | 1. Informar `52998224725` sem pontuação.                                                      | Aceito. A máscara é de apresentação; o validador limpa a formatação antes de calcular.                 | pendente | ENGRENAGEM |
| 10.13 | Formato gravado no banco                    | 1. Salvar um aluno com CPF. 2. Conferir em `GET /students/:id`.                               | Gravado só com dígitos (`52998224725`), conforme o dicionário de dados.                                | pendente | ENGRENAGEM |
| 10.14 | Mesma validação no autocadastro             | 1. Repetir 10.1, 10.3 e 10.5 em `/criar-conta`.                                               | Comportamento idêntico ao de Alunos (validador reaproveitado, não duplicado).                          | pendente | ENGRENAGEM |
| 10.15 | CPF duplicado                               | 1. Cadastrar dois alunos com o mesmo CPF.                                                     | Esperado: bloqueio com aviso de CPF já cadastrado. **Regra a confirmar com o Agente-mãe.**             | pendente | ENGRENAGEM |
| 10.16 | O estudante explica o algoritmo             | 1. Pedir ao estudante que explique o cálculo dos dois dígitos verificadores olhando o código. | Explica os pesos, o resto da divisão por 11 e o caso do resto menor que 2. Código legível e comentado. | pendente | LUPA       |

---

## 11. Campos obrigatórios

| #     | Cenário                             | Passos                                                     | Resultado esperado                                                                                                                                  | Status   | Agente     |
| ----- | ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 11.1  | Formulário de aluno vazio           | 1. Novo Aluno. 2. Salvar sem preencher nada.               | Não envia. Mensagens nos obrigatórios: nome, CPF, data de nascimento, status.                                                                       | pendente | ENGRENAGEM |
| 11.2  | Formulário de curso vazio           | 1. Novo Curso. 2. Salvar vazio.                            | Mensagens em nome, descrição, carga horária e valor.                                                                                                | pendente | ENGRENAGEM |
| 11.3  | Formulário de curso vazio           | 1. Novo Curso. 2. Salvar vazio.                            | Mensagens em nome, carga horária, preço.                                                                                                            | pendente | ENGRENAGEM |
| 11.4  | Formulário de turma vazio           | 1. Nova Turma. 2. Salvar vazio.                            | Mensagens em curso, código, turno, datas e capacidade.                                                                                              | pendente | ENGRENAGEM |
| 11.5  | Formulário de matrícula vazio       | 1. Nova Matrícula. 2. Salvar vazio.                        | Mensagens em aluno, turma, data, status.                                                                                                            | pendente | ENGRENAGEM |
| 11.6  | Formulário de pagamento vazio       | 1. Novo Pagamento. 2. Salvar vazio.                        | Mensagens em matrícula, vencimento, valor, status.                                                                                                  | pendente | ENGRENAGEM |
| 11.7  | Formulário de frequência vazio      | 1. Novo registro. 2. Salvar vazio.                         | Mensagens em turma, aluno, data.                                                                                                                    | pendente | ENGRENAGEM |
| 11.8  | Formulário de usuário vazio         | 1. Novo Usuário. 2. Salvar vazio.                          | Mensagens em nome, e-mail, login, senha, perfil.                                                                                                    | pendente | ENGRENAGEM |
| 11.9  | Campos opcionais aceitam vazio      | 1. Criar aluno sem e-mail, telefone e endereço. 2. Salvar. | Salva normalmente. Confirma que só o que o dicionário marca como obrigatório é exigido.                                                             | pendente | ENGRENAGEM |
| 11.10 | Só espaços não vale como preenchido | 1. Preencher o nome com `   `. 2. Salvar.                  | Rejeitado como campo obrigatório.                                                                                                                   | pendente | ENGRENAGEM |
| 11.11 | Mensagens de erro visíveis          | 1. Provocar erro em qualquer formulário.                   | Mensagem abaixo do campo, em vermelho `#DC2626`, texto em português explicando o que fazer.                                                         | pendente | VITRAL     |
| 11.12 | Botão salvar desabilitado           | 1. Abrir um formulário vazio.                              | O botão Salvar fica desabilitado enquanto o formulário é inválido (ou valida ao clicar e mostra os erros). Comportamento igual em todos os módulos. | pendente | ENGRENAGEM |

---

## 12. Limites de caracteres

Referência: coluna "Limite" do `docs/dicionario-de-dados.md`.

| #     | Cenário                            | Passos                                                                      | Resultado esperado                                                       | Status   | Agente     |
| ----- | ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- | ---------- |
| 12.1  | Nome abaixo do mínimo              | 1. Nome do aluno com 2 letras (`Jo`). 2. Salvar.                            | Rejeitado: mínimo de 3 caracteres.                                       | pendente | ENGRENAGEM |
| 12.2  | Nome no mínimo exato               | 1. Nome com 3 letras (`Ana`). 2. Salvar.                                    | Aceito. Testa a borda.                                                   | pendente | ENGRENAGEM |
| 12.3  | Nome acima do máximo               | 1. Nome com 100 caracteres. 2. Salvar.                                      | Campo corta em 80, ou rejeita com mensagem de máximo.                    | pendente | ENGRENAGEM |
| 12.4  | Nome no máximo exato               | 1. Nome com 80 caracteres. 2. Salvar.                                       | Aceito. Testa a borda.                                                   | pendente | ENGRENAGEM |
| 12.5  | E-mail em formato inválido         | 1. Informar `teste@`, `teste`, `@dominio.com`.                              | Todos rejeitados com mensagem de e-mail inválido.                        | pendente | ENGRENAGEM |
| 12.6  | E-mail válido aceito               | 1. Informar `aluno@email.com`.                                              | Aceito.                                                                  | pendente | ENGRENAGEM |
| 12.7  | Telefone curto                     | 1. Telefone com 8 dígitos.                                                  | Rejeitado: mínimo de 10 dígitos com DDD.                                 | pendente | ENGRENAGEM |
| 12.8  | Senha curta                        | 1. Senha com 3 caracteres. 2. Salvar.                                       | Rejeitado: mínimo de 4.                                                  | pendente | ENGRENAGEM |
| 12.9  | Login curto                        | 1. Login com 2 caracteres. 2. Salvar.                                       | Rejeitado: mínimo de 3.                                                  | pendente | ENGRENAGEM |
| 12.10 | Descrição do curso acima do máximo | 1. Descrição com 400 caracteres. 2. Salvar.                                 | Corta em 300 ou rejeita com mensagem.                                    | pendente | ENGRENAGEM |
| 12.11 | Código da turma curto              | 1. Código com 2 caracteres. 2. Salvar.                                      | Rejeitado: mínimo de 3.                                                  | pendente | ENGRENAGEM |
| 12.12 | Limites coerentes entre módulos    | Comparar os limites aplicados em cada formulário com o dicionário de dados. | Os limites são os mesmos em todos os módulos e batem com a documentação. | pendente | LUPA       |

---

## 13. Comunicação com a API

| #     | Cenário                           | Passos                                                         | Resultado esperado                                                                                    | Status   | Agente   |
| ----- | --------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- | -------- |
| 13.1  | API respondendo                   | 1. Abrir `http://localhost:3000/students` no navegador.        | Retorna o JSON dos alunos.                                                                            | pendente | AQUEDUTO |
| 13.2  | Todas as 8 coleções respondem     | 1. Abrir no navegador cada uma das 8 rotas da API.             | Todas retornam array (vazio ou com dados), nenhuma dá 404.                                            | pendente | AQUEDUTO |
| 13.3  | Requisição certa em cada ação     | 1. Com a aba Rede aberta, criar, editar e excluir um registro. | POST na criação, PUT ou PATCH na edição, DELETE na exclusão. Nenhuma requisição duplicada.            | pendente | AQUEDUTO |
| 13.4  | API desligada                     | 1. Parar o JSON Server. 2. Abrir uma listagem.                 | Mensagem clara de falha de conexão. Sem tela branca e sem erro só no console.                         | pendente | AQUEDUTO |
| 13.5  | API cai no meio do uso            | 1. Logado, parar o JSON Server. 2. Tentar salvar um registro.  | Mensagem de erro amigável. O formulário não é limpo, para o usuário poder tentar novamente.           | pendente | AQUEDUTO |
| 13.6  | Registro inexistente (404)        | 1. Acessar a edição de um id que não existe.                   | Mensagem de registro não encontrado. Volta para a listagem.                                           | pendente | AQUEDUTO |
| 13.7  | Console limpo                     | 1. Navegar por todos os módulos.                               | Nenhum erro vermelho no console durante a navegação normal.                                           | pendente | LUPA     |
| 13.8  | URL da API centralizada           | 1. Procurar por `localhost:3000` no código-fonte.              | A URL aparece em um único lugar (constante ou environment), não espalhada pelos services.             | pendente | AQUEDUTO |
| 13.9  | Nenhum HttpClient fora de service | 1. Procurar por `HttpClient` em `src/app/features`.            | Nenhuma ocorrência. Os componentes conversam com a API só através dos services (regra 4 do contrato). | pendente | LUPA     |
| 13.10 | Dados persistem após refresh      | 1. Criar um registro. 2. Pressionar F5.                        | O registro continua lá. Confirma que foi gravado no `db.json`, não só na memória.                     | pendente | AQUEDUTO |

---

## 14. Navegação, menu e rotas

| #    | Cenário                                | Passos                                                        | Resultado esperado                                                                               | Status   | Agente     |
| ---- | -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- | ---------- |
| 14.1 | Menu com todos os módulos              | 1. Olhar o menu lateral logado como `admin`.                  | Lista Painel, Alunos, Cursos, Turmas, Matrículas, Financeiro, Frequência, Usuários e Relatórios. | pendente | VITRAL     |
| 14.2 | Cada item leva à tela certa            | 1. Clicar em cada item do menu.                               | Abre a tela correspondente e a URL muda de acordo.                                               | pendente | VITRAL     |
| 14.3 | Item ativo destacado                   | 1. Navegar entre os módulos.                                  | O item do módulo atual aparece destacado no menu.                                                | pendente | VITRAL     |
| 14.4 | URL direta funciona                    | 1. Logado, digitar `/turmas` na barra de endereços.           | Abre a tela de turmas diretamente.                                                               | pendente | PRUMO      |
| 14.5 | Botão voltar do navegador              | 1. Navegar por três módulos. 2. Usar o botão voltar.          | Volta na ordem correta, sem perder o estado da aplicação.                                        | pendente | PRUMO      |
| 14.6 | Navegação para o formulário e de volta | 1. Abrir um formulário. 2. Cancelar.                          | Volta para a listagem do mesmo módulo.                                                           | pendente | ENGRENAGEM |
| 14.7 | Raiz redireciona                       | 1. Abrir `http://localhost:4200/`.                            | Logado vai para o dashboard; sem login vai para o login.                                         | pendente | PRUMO      |
| 14.8 | Nenhum link morto                      | 1. Clicar em todos os links e botões de navegação do sistema. | Nenhum leva a tela branca ou a rota inexistente.                                                 | pendente | LUPA       |

---

## 15. Relacionamentos

| #     | Cenário                                | Passos                                                                 | Resultado esperado                                                                        | Status   | Agente     |
| ----- | -------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- | ---------- |
| 15.1  | Turma mostra curso e professor         | 1. Listar turmas.                                                      | Nome do curso e nome do professor na tabela, não `courseId` e `teacherId`.                | pendente | ENGRENAGEM |
| 15.2  | Matrícula mostra aluno e turma         | 1. Listar matrículas.                                                  | Nome do aluno e identificação da turma, não os ids.                                       | pendente | ENGRENAGEM |
| 15.3  | Pagamento mostra o aluno               | 1. Listar pagamentos.                                                  | Identifica o aluno percorrendo `payments > enrollments > students`.                       | pendente | ENGRENAGEM |
| 15.4  | Frequência mostra turma e aluno        | 1. Listar frequência.                                                  | Nomes resolvidos, não ids.                                                                | pendente | ENGRENAGEM |
| 15.5  | Alunos de uma turma                    | 1. Abrir uma turma com matrículas.                                     | Mostra ou permite consultar os alunos matriculados nela.                                  | pendente | ENGRENAGEM |
| 15.6  | Troca de curso reflete na turma        | 1. Editar uma turma trocando o curso. 2. Voltar à lista.               | A lista mostra o novo curso.                                                              | pendente | ENGRENAGEM |
| 15.7  | Renomear reflete nas telas dependentes | 1. Renomear um curso. 2. Abrir Turmas.                                 | O novo nome aparece. Confirma que a turma guarda o id e busca o nome, sem copiar o texto. | pendente | ENGRENAGEM |
| 15.8  | Excluir curso com turma vinculada      | 1. Tentar excluir um curso usado por uma turma.                        | Esperado: bloqueio ou aviso. **Regra a confirmar com o Agente-mãe.**                      | pendente | ENGRENAGEM |
| 15.10 | Excluir aluno com matrícula            | 1. Tentar excluir um aluno matriculado.                                | Idem 16.8.                                                                                | pendente | ENGRENAGEM |
| 15.11 | Código de turma duplicado              | 1. Criar uma turma com o código `INF-2026-2` (já existe).              | Bloqueio: "Ja existe uma turma com o codigo "INF-2026-2"." Nada é gravado.                | OK       | ENGRENAGEM |
| 15.12 | Código de turma em minúsculas          | 1. Criar uma turma com o código `inf-2026-2`.                          | Mesmo bloqueio do 16.11: o código é normalizado em maiúsculas antes de verificar.         | OK       | ENGRENAGEM |
| 15.11 | Excluir turma com matrículas           | 1. Tentar excluir uma turma com alunos.                                | Idem 16.8.                                                                                | pendente | ENGRENAGEM |
| 15.12 | Excluir matrícula com pagamentos       | 1. Tentar excluir uma matrícula com parcelas.                          | Idem 16.8.                                                                                | pendente | ENGRENAGEM |
| 15.13 | Nenhum id órfão na base                | 1. Após toda a bateria, conferir todos os campos `xxxId` do `db.json`. | Todo id referenciado existe na coleção de destino.                                        | pendente | LUPA       |

---

## 16. Consistência visual (paleta oficial)

| #    | Cenário                    | Passos                                                       | Resultado esperado                                                                                   | Status   | Agente     |
| ---- | -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 16.1 | Cores da paleta            | 1. Inspecionar o layout, os botões e o menu.                 | Usa apenas `#14233F`, `#3478F6`, `#F5F7FB`, `#FFFFFF`, `#64748B`, `#16A34A`, `#DC2626`.              | pendente | VITRAL     |
| 16.2 | Fundo das telas            | 1. Abrir cada módulo.                                        | Fundo `#F5F7FB` em todas as telas, sem variação.                                                     | pendente | VITRAL     |
| 16.3 | Botão primário             | 1. Comparar o botão principal em todos os módulos.           | Mesma cor (`#3478F6`), mesmo tamanho e mesma posição.                                                | pendente | VITRAL     |
| 16.4 | Sucesso e erro             | 1. Provocar uma mensagem de sucesso e uma de erro.           | Sucesso em `#16A34A`, erro em `#DC2626`.                                                             | pendente | VITRAL     |
| 16.5 | Cabeçalho das tabelas      | 1. Comparar as tabelas dos 9 módulos.                        | Mesmo estilo de cabeçalho em todas.                                                                  | pendente | VITRAL     |
| 16.6 | Padrão dos formulários     | 1. Comparar os formulários dos 9 módulos.                    | Mesmo espaçamento, mesmo estilo de campo Material, botões na mesma ordem.                            | pendente | ENGRENAGEM |
| 16.7 | Nenhuma cor fora da paleta | 1. Procurar por códigos hexadecimais nos arquivos de estilo. | Nenhuma cor além da paleta e dos tons neutros do tema Material.                                      | pendente | VITRAL     |
| 16.8 | Tela em resolução menor    | 1. Reduzir a janela para cerca de 1280 de largura.           | Layout continua legível, sem rolagem horizontal. Importante: a apresentação pode ser em um projetor. | pendente | VITRAL     |

---

## 17. Clareza didática (revisão de QA, sem correção de código)

Bloco de inspeção, não de execução. Achados vão para o relatório de bugs com severidade "didática" e seguem para o agente responsável.

| #    | Cenário                             | Passos                                                                      | Resultado esperado                                                                                                           | Status   | Agente |
| ---- | ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 17.1 | Nomes claros                        | 1. Ler os nomes de arquivos, classes, métodos e variáveis.                  | Nomes descritivos. Nada de `x`, `temp`, `data1`, `funcao2`.                                                                  | pendente | LUPA   |
| 17.2 | Comentários nos trechos importantes | 1. Ler o validador de CPF, o guard de rota e os services.                   | Os trechos não óbvios têm comentário curto explicando o porquê.                                                              | pendente | LUPA   |
| 17.3 | Onde está a orientação a objetos    | 1. Localizar as interfaces, as classes e os services.                       | Identificável e explicável: interfaces como model, classes e services com responsabilidade própria.                          | pendente | LUPA   |
| 17.4 | Onde está o MVC                     | 1. Mapear model, view, controller e service na estrutura de pastas.         | A separação é visível na própria organização dos diretórios.                                                                 | pendente | LUPA   |
| 17.5 | Sem código morto                    | 1. Procurar por trechos comentados, imports não usados e arquivos órfãos.   | Nenhum. O estudante não precisa explicar código que não roda.                                                                | pendente | LUPA   |
| 17.6 | Sem duplicação relevante            | 1. Comparar as telas de CRUD entre si.                                      | Lógica repetida foi extraída para shared ou service, sem abstração exagerada.                                                | pendente | LUPA   |
| 17.7 | Nada fora da stack                  | 1. Ler o `package.json`.                                                    | Nenhuma biblioteca além de Angular, Angular Material e JSON Server. Sem Tailwind, Bootstrap, PrimeNG, Express ou banco real. | pendente | LUPA   |
| 17.8 | Sem recurso de IA                   | 1. Procurar por chamadas a serviços de IA no código.                        | Nenhuma. É regra inviolável do contrato.                                                                                     | pendente | LUPA   |
| 17.9 | O estudante explica cada tela       | 1. Percorrer o sistema com o estudante, pedindo a explicação de cada parte. | Explica sem travar. Onde travar, o ponto vira item do roteiro de apresentação.                                               | pendente | LUPA   |

---

## 17.1 Restrição de acesso por perfil

Credenciais da base de demonstração (`api/db.seed.json`, a que tem os dois alunos), todas com senha `123456`, exceto `admin` (`admin123`):

| Login         | Perfil | Vínculo        | Alcance esperado                                          |
| ------------- | ------ | -------------- | --------------------------------------------------------- |
| `admin`       | admin  | —              | Tudo.                                                     |
| `aluno`       | aluno  | `studentId: 1` | Matrícula **1**, as parcelas dela e a própria frequência. |
| `gabrielmota` | aluno  | `studentId: 2` | Matrícula **2** e o que desce dela.                       |

**O caso central da regra:** os **dois** alunos do seed dividem a **mesma turma** (`INF-2026-2`). O filtro do aluno é pelo **próprio id**, e não pela turma — se fosse pela turma, cada um leria a matrícula, as mensalidades e as faltas do outro, e a tela não daria nenhum sinal de erro.

| #       | Cenário                         | Passos                                                                                            | Resultado esperado                                                                                                                     | Status   | Agente |
| ------- | ------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 17.1.1  | Menu do administrador           | 1. Entrar como `admin`.                                                                           | O menu mostra os oito módulos, inclusive Usuários. O rodapé do menu diz "Acesso completo".                                             | pendente | QA     |
| 17.1.2  | Menu do aluno                   | 1. Entrar como `aluno`.                                                                           | O menu mostra só "Meu painel", "Minhas matrículas", "Minhas mensalidades" e "Minha frequência". O rodapé diz "Somente o seu cadastro". | pendente | QA     |
| 17.1.3  | Rota negada pela URL            | 1. Entrar como `aluno`. 2. Digitar `/students` na barra de endereço.                              | Redireciona para `/sem-acesso`, que explica o bloqueio e o perfil. **Não** abre a tela.                                                | pendente | QA     |
| 17.1.4  | Rota de formulário negada       | 1. Entrar como `aluno`. 2. Digitar `/enrollments/new`.                                            | Redireciona para `/sem-acesso` com a mensagem de "pode consultar, mas não alterar".                                                    | pendente | QA     |
| 17.1.5  | Usuários só do admin            | 1. Entrar como `aluno`. 2. Digitar `/users`.                                                      | Redireciona para `/sem-acesso`. É o teste que impede o aluno de se promover a administrador.                                           | pendente | QA     |
| 17.1.6  | Catálogo negado ao aluno        | 1. Como `aluno`, digitar `/courses` e depois `/classes`.                                          | As duas redirecionam para `/sem-acesso`.                                                                                               | pendente | QA     |
| 17.1.7  | Matrículas do aluno             | 1. Como `aluno`, abrir Minhas matrículas.                                                         | Mostra **1** matrícula. **Não** mostra a do outro aluno, que está na mesma turma.                                                      | pendente | QA     |
| 17.1.8  | Mensalidades do aluno           | 1. Como `aluno`, abrir Minhas mensalidades.                                                       | Só as parcelas das matrículas dele. Sem botão de nova parcela e sem coluna de ações.                                                   | pendente | QA     |
| 17.1.9  | Frequência do aluno             | 1. Como `aluno`, abrir Minha frequência.                                                          | Só os registros dele, **não** os dos colegas da mesma turma.                                                                           | pendente | QA     |
| 17.1.10 | Painel do aluno                 | 1. Como `aluno`, abrir o painel.                                                                  | Não há card de "Pagamentos em atraso" da escola nem a lista financeira. Aparece a faixa "Os números abaixo são somente os seus".       | pendente | QA     |
| 17.1.11 | Isolamento entre alunos         | 1. Entrar como `gabrielmota`. 2. Abrir Minhas matrículas, Mensalidades e Frequência.              | Mostra **somente** os registros dele. Nada do `aluno`, apesar de dividirem a mesma turma.                                              | pendente | QA     |
| 17.1.12 | Troca de usuário                | 1. Entrar como `aluno`. 2. Sair. 3. Entrar como `gabrielmota`. 4. Abrir as matrículas.            | Mostra a matrícula do **gabrielmota**. O escopo do usuário anterior não vaza (cache por usuário).                                      | pendente | QA     |
| 17.1.13 | Aluno sem vínculo               | 1. Como `admin`, criar usuário com perfil aluno. 2. Conferir o campo "Este usuário é qual aluno?" | É obrigatório: não é possível salvar sem escolher o aluno.                                                                             | pendente | QA     |
| 17.1.14 | Troca de perfil limpa o vínculo | 1. Editar um usuário aluno. 2. Trocar o perfil para administrador. 3. Salvar.                     | O registro **não** mantém o `studentId` antigo gravado.                                                                                | pendente | QA     |
| 17.1.15 | Testes automatizados            | 1. Rodar `npm test`.                                                                              | Os testes de `acesso.service.spec.ts` passam (matriz dos 2 perfis, escopo e os cinco filtros).                                         | pendente | QA     |

**Limitação conhecida e consciente:** esta é uma restrição de **interface**, não de servidor. O JSON Server entrega qualquer rota a quem pedir — um aluno que abrir o DevTools e chamar `GET /students` recebe os dados. Num sistema real a mesma matriz precisaria existir no backend. Ver a nota em `docs/endpoints.md`.

---

## 17.2 Login e criar conta

CPFs válidos para o teste: `52998224725` e `11144477735`. Inválidos: `12345678900` e `11111111111`.
CPF **já cadastrado** no seed: `31245287605` (aluno 1).

| #       | Cenário                         | Passos                                                                   | Resultado esperado                                                                                             | Status   | Agente |
| ------- | ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 17.2.1  | Link de cadastro no login       | 1. Abrir `/login`.                                                       | Existe o link "Criar minha conta", **depois** do botão Entrar.                                                 | pendente | QA     |
| 17.2.2  | CPF inválido                    | 1. Em `/criar-conta`, digitar `12345678900`. 2. Sair do campo.           | Mensagem "CPF invalido: os digitos verificadores nao conferem." Não envia.                                     | pendente | QA     |
| 17.2.3  | CPF com dígitos repetidos       | 1. Digitar `11111111111`.                                                | Rejeitado. (É o caso que passa numa validação de "tem 11 dígitos".)                                            | pendente | QA     |
| 17.2.4  | CPF já cadastrado               | 1. Preencher tudo com CPF `31245287605`. 2. Enviar.                      | Mensagem **no campo CPF**: "Este CPF ja esta cadastrado no sistema." Nada é gravado.                           | pendente | QA     |
| 17.2.11 | Curso é obrigatório             | 1. Preencher tudo, sem escolher curso. 2. Enviar.                        | Mensagem no campo de curso. Nada é gravado.                                                                    | pendente | QA     |
| 17.2.12 | Catálogo oferecido              | 1. Abrir o select de curso.                                              | Só cursos com turma **ativa e com vaga**. "Design Grafico" (turma concluída) e curso sem turma não aparecem.   | pendente | QA     |
| 17.2.13 | Turma única é automática        | 1. Escolher qualquer curso do seed.                                      | Não aparece select de turma (todos têm uma só); aparece o resumo com código, turno, período e vagas.           | pendente | QA     |
| 17.2.14 | Trocar de curso zera a turma    | 1. Escolher um curso. 2. Trocar para outro.                              | O resumo passa a ser o da turma do curso novo — nunca o do anterior.                                           | pendente | QA     |
| 17.2.15 | Matrícula criada no cadastro    | 1. Concluir o cadastro escolhendo um curso.                              | Na tela de login: "Voce esta matriculado em <curso>". Entrar → **Minhas matrículas** mostra a turma e o curso. | pendente | QA     |
| 17.2.16 | Vaga reconferida no envio       | 1. Abrir o cadastro. 2. Lotar a turma por outro caminho. 3. Enviar.      | Bloqueio avisando que a turma lotou, catálogo recarregado, **nada gravado** (nem aluno, nem conta).            | pendente | QA     |
| 17.2.5  | E-mail com formato inválido     | 1. Digitar `ana@` ou `ana.com`.                                          | Mensagem de e-mail inválido. Não envia.                                                                        | pendente | QA     |
| 17.2.6  | E-mail já cadastrado            | 1. Usar `ana.souza@aluno.edumanager.com.br`. 2. Enviar.                  | Mensagem **no campo e-mail**: "Este e-mail ja esta cadastrado...". Nada é gravado.                             | pendente | QA     |
| 17.2.7  | Login já em uso                 | 1. Usar login `aluno`. 2. Enviar.                                        | Mensagem **no campo login**: "Este login ja esta em uso. Escolha outro."                                       | pendente | QA     |
| 17.2.8  | Dois conflitos de uma vez       | 1. Usar e-mail **e** login já existentes. 2. Enviar.                     | **Os dois** campos mostram erro na mesma tentativa (não um por vez).                                           | pendente | QA     |
| 17.2.9  | Senha curta                     | 1. Digitar `abc12`.                                                      | "A senha deve ter no minimo 6 caracteres."                                                                     | pendente | QA     |
| 17.2.10 | Senha só com números            | 1. Digitar `123456`.                                                     | "A senha precisa ter pelo menos uma letra e um numero."                                                        | pendente | QA     |
| 17.2.11 | Senha só com letras             | 1. Digitar `senhasenha`.                                                 | Mesma mensagem do 18.2.10.                                                                                     | pendente | QA     |
| 17.2.12 | Senhas diferentes               | 1. Senha `senha123`, confirmação `senha124`.                             | "As duas senhas nao sao iguais.", **no campo de confirmação**.                                                 | pendente | QA     |
| 17.2.13 | Corrigir a confirmação          | 1. Após o 18.2.12, igualar as senhas.                                    | O erro desaparece e o botão libera.                                                                            | pendente | QA     |
| 17.2.14 | Data de nascimento futura       | 1. Escolher uma data no futuro.                                          | "A data de nascimento nao pode ser uma data futura."                                                           | pendente | QA     |
| 17.2.15 | Campos obrigatórios             | 1. Clicar em "Criar minha conta" com o formulário vazio.                 | Todos os obrigatórios mostram erro de uma vez. Nenhuma requisição sai.                                         | pendente | QA     |
| 17.2.16 | Cadastro bem-sucedido           | 1. Preencher tudo com dados válidos e inéditos. 2. Enviar.               | Vai para `/login` com faixa **verde** "Conta criada, \<Nome\>!" e o **campo de login já preenchido**.          | pendente | QA     |
| 17.2.17 | Primeiro acesso                 | 1. Após o 18.2.16, digitar a senha e entrar.                             | Entra como **aluno**: menu com "Meu painel", "Minhas matrículas", "Minhas mensalidades", "Minha frequência".   | pendente | QA     |
| 17.2.18 | Conta nova sem matrícula        | 1. Ainda logado da conta nova, abrir cada tela do menu.                  | Estados vazios amigáveis. Nenhum `NaN`, nenhuma tabela quebrada, nenhum erro no console.                       | pendente | QA     |
| 17.2.19 | Os dois registros foram criados | 1. Como `admin`, abrir Alunos e Usuários.                                | A pessoa aparece **nas duas** listas; em Usuários a coluna **Vínculo** mostra o nome do aluno.                 | pendente | QA     |
| 17.2.20 | Logado não vê o login           | 1. Logado, digitar `/login` na URL. 2. Depois `/criar-conta`.            | Redireciona para `/dashboard` nas duas (`visitanteGuard`).                                                     | pendente | QA     |
| 17.2.21 | Nome sincroniza                 | 1. Como `admin`, renomear um aluno **que tem conta**. 2. Abrir Usuários. | O nome da conta acompanhou o cadastro.                                                                         | pendente | QA     |
| 17.2.22 | Excluir cadastro com conta      | 1. Como `admin`, tentar excluir um aluno que tem conta.                  | Bloqueia citando o login da conta e manda excluir a conta primeiro, em Usuários.                               | pendente | QA     |
| 17.2.23 | Senha não aparece               | 1. Abrir Usuários e inspecionar a tabela.                                | Nenhuma coluna de senha, nem mascarada.                                                                        | pendente | QA     |
| 17.2.24 | Testes automatizados            | 1. Rodar `npm test`.                                                     | 80 testes passam (CPF, acesso e senha).                                                                        | pendente | QA     |

---

## 20. Fluxo integrado — do cadastro à confirmação do pagamento

Esta seção é o roteiro do requisito 14, na ordem exata. Ela foi **executada contra a API** em 14/11/2026, nas mesmas chamadas que as telas fazem, com 28 verificações passando. Repetir pela interface é o que fecha o teste.

**Pré-condição:** `npm run api` e `npm start` rodando, base no estado do seed (`cp api/db.seed.json api/db.json` e reiniciar a API).

| #     | Passo                                                              | Esperado                                                                                   | Status |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------ |
| 20.1  | Entrar como `admin` e abrir Cursos                                 | Os **3 cursos** do seed, cada um com o professor responsável na coluna                     | ⬜     |
| 20.2  | Sair e abrir `/criar-conta`                                        | O formulário carrega os cursos com turma e vaga                                            | ⬜     |
| 20.3  | Preencher os dados e escolher **Informática Básica**               | Aparece carga, valor e a seção "Como vou pagar"                                            | ⬜     |
| 20.4  | Escolher **À vista** e **PIX**                                     | A prévia mostra **1 parcela** com o valor integral e o aviso "nada é cobrado agora"        | ⬜     |
| 20.5  | Concluir o cadastro                                                | Cai **direto no painel do aluno, já logado**, com a faixa verde de conta criada            | ⬜     |
| 20.6  | Conferir o painel do aluno                                         | "Meu curso" com o nome do curso; "Minhas próximas parcelas" com 1 parcela pendente         | ⬜     |
| 20.7  | Abrir Minhas matrículas                                            | A matrícula aparece com situação **Pendente**                                              | ⬜     |
| 20.8  | Abrir Minhas mensalidades → o lançamento                           | Combinado = valor do curso; Pago = R$ 0,00; Saldo = valor do curso; sem botão de confirmar | ⬜     |
| 20.9  | Sair, entrar como `admin`, ver o painel                            | "Novas matrículas" contou a nova; "Pagamentos pendentes" soma o valor dela                 | ⬜     |
| 20.10 | Abrir Lançamentos                                                  | O lançamento novo em **Pendente**, com aluno, turma e combinação                           | ⬜     |
| 20.11 | Abrir o lançamento e clicar em **Confirmar**                       | Aparece **diálogo** de confirmação dizendo o que vai acontecer                             | ⬜     |
| 20.12 | Confirmar                                                          | Parcela **Paga** com a data de hoje; Saldo R$ 0,00; lançamento **Pago**                    | ⬜     |
| 20.13 | Voltar a Matrículas (admin)                                        | A matrícula virou **Ativa** sozinha                                                        | ⬜     |
| 20.14 | Entrar com a conta do aluno criado                                 | Matrícula Ativa, parcela Paga, "Nada em aberto" nas próximas parcelas                      | ⬜     |
| 20.15 | Repetir 20.2–20.8 com **Desenvolvimento Web**, **Parcelado em 3×** | 3 parcelas na prévia, com vencimentos mensais e **soma igual ao total**                    | ⬜     |
| 20.16 | Como admin, confirmar **1** das 3 parcelas                         | Lançamento → **Parcialmente pago**; matrícula → **Ativa**; saldo = 2 parcelas              | ⬜     |
| 20.17 | Confirmar a segunda                                                | Continua **Parcialmente pago**; saldo = 1 parcela                                          | ⬜     |
| 20.18 | Confirmar a terceira                                               | **Pago**; saldo R$ 0,00; a coluna Saldo mostra "Quitado"                                   | ⬜     |
| 20.19 | Em uma parcela paga, clicar em **Estornar** e confirmar            | Volta a ficar em aberto; lançamento volta a **Parcialmente pago**; saldo recalculado       | ⬜     |

### 20.20 Conferência do centavo (o teste que ninguém vê na tela)

| #      | Passo                                                                 | Esperado                                                | Status |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| 20.20a | Cadastrar um curso de **R$ 1.000,00** com teto de 10 parcelas         | Salva                                                   | ⬜     |
| 20.20b | Abrir turma nele e matricular alguém em **3×**                        | Prévia: **333,33 + 333,33 + 333,34**                    | ⬜     |
| 20.20c | Somar as três parcelas na tela do lançamento                          | **R$ 1.000,00 exatos** — a sobra está na última parcela | ⬜     |
| 20.20d | Cadastrar um curso com `maxInstallments = 3` e matricular alguém nele | O select oferece **só 2× e 3×**                         | ⬜     |

---

## 21. Perfil professor

| #     | Passo                                                                                                       | Esperado                                                                                                                             | Status |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 21.1  | Entrar como `professor`                                                                                     | Menu com "Meus cursos", "Minhas turmas", "Meus alunos", "Chamada", "Frequência", "Financeiro". **Sem "Usuários" e sem "Relatórios"** | ⬜     |
| 21.2  | Conferir o rodapé do menu                                                                                   | "Acesso: Professor — Somente os seus cursos e turmas"                                                                                | ⬜     |
| 21.3  | Ver o painel                                                                                                | Meus cursos, Minhas turmas, Meus alunos, Presenças lançadas + a lista "Minhas turmas"                                                | ⬜     |
| 21.4  | Abrir Meus cursos                                                                                           | Só os cursos dele; a faixa de escopo explica o recorte                                                                               | ⬜     |
| 21.5  | Abrir Meus alunos                                                                                           | Só os alunos das turmas dele — **não** a escola inteira                                                                              | ⬜     |
| 21.6  | Na lista de alunos, olhar a coluna Ações                                                                    | Tem **Editar**, **não** tem Excluir                                                                                                  | ⬜     |
| 21.7  | Abrir Financeiro                                                                                            | Os lançamentos dos alunos dele, **sem** botão de confirmar pagamento                                                                 | ⬜     |
| 21.8  | Digitar `/users` na barra de endereço                                                                       | **Acesso negado**, explicando o que foi negado e com qual perfil                                                                     | ⬜     |
| 21.9  | Digitar `/reports` na barra de endereço                                                                     | **Acesso negado**                                                                                                                    | ⬜     |
| 21.10 | Digitar `/courses/new` na barra de endereço                                                                 | **Acesso negado** — ele edita curso, não cria                                                                                        | ⬜     |
| 21.11 | Pelo admin, criar um curso de **outro** `teacherId`; como professor, abrir `/courses/<id>/edit` desse curso | **Acesso negado** — o controle é por registro, não só por tela                                                                       | ⬜     |
| 21.12 | Abrir um curso **dele** para editar                                                                         | Abre, e o campo "Professor responsável" **não aparece** (ele não passa o curso adiante)                                              | ⬜     |

---

## 22. Chamada (frequência da turma inteira)

| #    | Passo                                                        | Esperado                                                                                | Status |
| ---- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------ |
| 22.1 | Como `professor`, abrir Chamada                              | Select de turma só com as turmas **ativas dele**; data de hoje preenchida               | ⬜     |
| 22.2 | Escolher a turma                                             | Lista os alunos matriculados, **todos marcados como Presente**                          | ⬜     |
| 22.3 | Clicar em um aluno                                           | A linha fica **vermelha** com "Falta"; o card de Faltas sobe para 1                     | ⬜     |
| 22.4 | Salvar a chamada                                             | Faixa verde: "Chamada de dd/mm/aaaa gravada: N presenças e 1 falta"                     | ⬜     |
| 22.5 | **Sem recarregar**, escolher a mesma turma e a mesma data    | As marcações voltam preenchidas e o rótulo diz "Esta chamada já foi lançada"            | ⬜     |
| 22.6 | Trocar uma marcação e salvar de novo                         | O botão diz "Salvar correções"; **não** cria registro duplicado (confira em Frequência) | ⬜     |
| 22.7 | Tentar escolher uma data **futura**                          | O campo não aceita (limite `max` = hoje)                                                | ⬜     |
| 22.8 | Abrir Frequência (histórico) e filtrar pela turma e data     | Os registros da chamada, com os nomes certos                                            | ⬜     |
| 22.9 | Entrar como o aluno que levou falta e abrir Minha frequência | Vê **só a própria** presença, inclusive a falta — e não a dos colegas                   | ⬜     |

---

## 23. Falhas e erros (o que precisa falhar bem)

| #    | Passo                                                                        | Esperado                                                                         | Status |
| ---- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| 23.1 | Derrubar a API (Ctrl+C no terminal 1) e abrir Lançamentos                    | Mensagem pedindo para rodar `npm run api` — a tela não fica em branco nem quebra | ⬜     |
| 23.2 | Com a API fora, tentar criar conta em `/criar-conta`                         | "Não foi possível verificar seus dados…" e **nada** é gravado                    | ⬜     |
| 23.3 | Tentar criar conta com um e-mail que já existe                               | O erro aparece **no campo de e-mail**, não numa faixa genérica                   | ⬜     |
| 23.4 | Tentar criar conta com um CPF que já existe                                  | Erro no campo de CPF                                                             | ⬜     |
| 23.5 | Tentar criar conta com CPF de dígito verificador errado (ex.: `11111111111`) | "CPF inválido" antes de qualquer chamada à API                                   | ⬜     |
| 23.6 | Preencher senha e confirmação diferentes                                     | Erro na confirmação; o botão não grava                                           | ⬜     |
| 23.7 | Como admin, tentar matricular o mesmo aluno na mesma turma duas vezes        | Recusa explicando que já existe matrícula dele naquela turma                     | ⬜     |
| 23.8 | Como aluno, abrir `/financial/<id>` de um lançamento **de outro aluno**      | **Acesso negado** — e não o financeiro do colega                                 | ⬜     |
| 23.9 | Como aluno, digitar `/students`                                              | **Acesso negado**                                                                | ⬜     |

---

## 18. Resumo da execução

Preencher ao final da bateria.

| Bloco               | Total   | ok    | falhou | bloqueado | pendente |
| ------------------- | ------- | ----- | ------ | --------- | -------- |
| 1. Login e rotas    | 10      | 0     | 0      | 0         | 10       |
| 2. Alunos           | 7       | 0     | 0      | 0         | 7        |
| 4. Cursos           | 7       | 0     | 0      | 0         | 7        |
| 5. Turmas           | 11      | 0     | 0      | 1         | 10       |
| 6. Matrículas       | 10      | 0     | 0      | 0         | 10       |
| 7. Financeiro       | 9       | 0     | 0      | 0         | 9        |
| 8. Frequência       | 8       | 0     | 0      | 0         | 8        |
| 9. Usuários         | 9       | 0     | 0      | 0         | 9        |
| 10. Relatórios      | 5       | 0     | 0      | 0         | 5        |
| 11. CPF             | 16      | 0     | 0      | 0         | 16       |
| 12. Obrigatórios    | 12      | 0     | 0      | 0         | 12       |
| 13. Limites         | 12      | 0     | 0      | 0         | 12       |
| 14. API             | 10      | 0     | 0      | 0         | 10       |
| 15. Navegação       | 8       | 0     | 0      | 0         | 8        |
| 16. Relacionamentos | 13      | 0     | 0      | 0         | 13       |
| 17. Visual          | 8       | 0     | 0      | 0         | 8        |
| 18. Didática        | 9       | 0     | 0      | 0         | 9        |
| 20. Fluxo integrado | 23      | 0     | 0      | 0         | 23       |
| 21. Professor       | 12      | 0     | 0      | 0         | 12       |
| 22. Chamada         | 9       | 0     | 0      | 0         | 9        |
| 23. Falhas e erros  | 9       | 0     | 0      | 0         | 9        |
| **Total**           | **222** | **0** | **0**  | **1**     | **221**  |

> **Blocos 20 a 23 já foram verificados contra a API** (14/11/2026), em script que faz as mesmas chamadas das telas, na mesma ordem: 28 verificações, todas passando, com a base voltando ao estado do seed. O que falta é a repetição **pela interface**, que é o que esta checklist cobre.

---

## 19. Regras que precisam de decisão do Agente-mãe

Estes cenários estão escritos, mas o resultado esperado ainda é uma suposição de QA. Sem a decisão, eles não podem ser aprovados nem reprovados com segurança.

| Cenários     | Pergunta em aberto                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.x          | Quais valores de `status` a coleção `classes` usa? O contrato não define. O seed em `api/db.json` já usa `ativa` / `concluida`, divergindo do `ativo` / `inativo` de `students`. Precisa de ratificação antes de o CRUD montar o select. |
| 5.8          | Bloquear matrícula duplicada do mesmo aluno na mesma turma?                                                                                                                                                                              |
| 5.9          | Bloquear matrícula acima do `capacity` da turma?                                                                                                                                                                                         |
| 6.7          | Exigir `paidAt` quando o status é `pago`?                                                                                                                                                                                                |
| 7.7          | O select de aluno na frequência lista todos ou só os matriculados na turma?                                                                                                                                                              |
| 7.8          | Bloquear presença duplicada na mesma trinca turma + aluno + data?                                                                                                                                                                        |
| 8.8          | Bloquear `login` duplicado?                                                                                                                                                                                                              |
| 10.15        | Bloquear CPF duplicado?                                                                                                                                                                                                                  |
| 15.8 a 16.12 | Exclusão de registro com dependentes: bloquear, avisar, ou permitir?                                                                                                                                                                     |
