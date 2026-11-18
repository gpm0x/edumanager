# Publicação na Vercel — API e banco de dados

## Como a API funciona publicada

| Ambiente | API | Dados |
| --- | --- | --- |
| Desenvolvimento (`npm start` + `npm run api`) | JSON Server em `http://localhost:3000` | `api/db.json` (grava no arquivo) |
| Vercel | Função `api/server.js` em `/api` | Redis (Upstash) se configurado; senão, cópia do `db.json` em memória |

O frontend não muda: `API_URL` é `http://localhost:3000` em desenvolvimento e `/api` em produção (`src/app/core/services/api.config.ts`).

O `vercel.json` reescreve `/api/<colecao>/<id>` para `/api/server?_colecao=<colecao>&_id=<id>`.

> **Os nomes dos parâmetros da rota precisam começar com `_`.** A Vercel acrescenta à query cada parâmetro nomeado da rota (`:colecao` → `colecao=users`). A função trata tudo que não começa com `_` como filtro de campo, e `colecao=users` fazia `/api/users` devolver `[]`. O teste `npm run test:api` falha se isso voltar a acontecer.

## Por que um banco

A função serverless não tem disco gravável. Sem banco, cadastros, matrículas, pagamentos e alterações ficam na memória de **uma** instância e somem quando ela recicla (ociosidade, novo deploy, ou outra instância atendendo). O cabeçalho de resposta `X-EduManager-Storage` mostra qual armazenamento está ativo: `memoria` ou `redis`.

## Passo a passo: ativar o banco persistente

1. Painel da Vercel → projeto **edumanager** → **Storage** → **Create Database** → **Upstash for Redis** (plano gratuito basta) → conecte ao projeto, marcando os ambientes *Production* e *Preview*.
2. A integração cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`; as duas formas funcionam). Elas ficam só no servidor — o frontend nunca as recebe.
3. *(Recomendado)* Em **Settings → Environment Variables**, adicione `EDUMANAGER_REQUIRE_DB=1` em *Production*. Com isso, se o banco for desconectado por engano, a API responde `503` em vez de voltar silenciosamente para memória.
4. **Redeploy** do último deploy de produção (variáveis novas só valem em deploys novos).

### Carga inicial dos dados

Na primeira requisição contra o banco vazio, a função copia todos os registros do `api/db.json` para o Redis e marca o banco como carregado. Depois disso:

- o `db.json` **não** sobrescreve o banco (editar o arquivo e publicar não apaga cadastros);
- registros excluídos pelo administrador não reaparecem em deploys seguintes;
- os ids continuam a sequência do `db.json`, com contador atômico (dois cadastros simultâneos nunca recebem o mesmo id).

Modelo no Redis (prefixo `edumanager`, configurável por `EDUMANAGER_DB_PREFIX`): um hash `edumanager:col:<colecao>` com `id → registro JSON` por coleção, e `edumanager:seq:<colecao>` com o último id.

Para usar o mesmo banco em *Preview* sem misturar dados com produção, defina `EDUMANAGER_DB_PREFIX=edumanager-preview` só no ambiente *Preview*.

## Verificação depois de publicar

```
GET /api/users                                   → 3 usuários (os do db.json)
GET /api/users?login=professor&password=prof123  → [professor]
GET /api/users?login=admin&password=admin123     → [admin]
GET /api/students                                → alunos
GET /api/courses                                 → cursos
```

E confira o cabeçalho `X-EduManager-Storage: redis` em qualquer resposta.

## Testes

```
npm run test:api   # API publicada: rotas do vercel.json + memória + Redis
npm test           # frontend Angular
```

`test:api` compila o `vercel.json` com `@vercel/routing-utils` (o mesmo pacote que a Vercel usa), então valida o caminho real da requisição, e não só a função isolada. O Redis é simulado por um servidor local que imita a API REST da Upstash.
