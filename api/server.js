/**
 * API DE DEMONSTRACAO (Vercel Serverless Function).
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * Em desenvolvimento a API e o JSON Server (`npm run api`, porta 3000).
 * Mas o JSON Server e um processo que fica rodando na maquina, e a Vercel nao
 * hospeda processos desse tipo: ela hospeda funcoes que sobem, respondem uma
 * requisicao e desligam.
 *
 * Entao, so para o site publicado, esta funcao reimplementa as partes do JSON
 * Server que o sistema usa, lendo o MESMO `api/db.json`:
 *
 *   GET    /api/<colecao>                 lista
 *   GET    /api/<colecao>?campo=valor     filtra por igualdade
 *   GET    /api/<colecao>?_sort=x&_order=desc
 *   GET    /api/<colecao>?_expand=aluno   embute o objeto relacionado
 *   GET    /api/<colecao>/:id             busca um
 *   POST   /api/<colecao>                 cria
 *   PUT    /api/<colecao>/:id             substitui
 *   PATCH  /api/<colecao>/:id             altera campos
 *   DELETE /api/<colecao>/:id             exclui
 *
 * COMO A COLECAO CHEGA AQUI
 * -------------------------
 * Esta e UMA funcao so, mas precisa atender oito enderecos diferentes. Quem
 * faz essa distribuicao e o `vercel.json`: ele reescreve `/api/students/7`
 * para `/api/server?_colecao=students&_id=7`. Entao a funcao nao precisa
 * interpretar o caminho da URL, so ler dois parametros - o que e mais simples
 * e nao depende de como a plataforma nomeia segmentos de rota.
 *
 * LIMITE IMPORTANTE: o disco da Vercel e somente leitura, entao as escritas
 * acontecem em memoria e valem apenas enquanto aquela instancia da funcao
 * estiver viva. Ao reciclar, os dados voltam ao `db.json`. Para gravacao real
 * e permanente, rode o JSON Server local (`npm run api`), que grava no arquivo.
 */

const dbOriginal = require('./db.json');

/**
 * Copia de trabalho em memoria. A copia profunda e necessaria para que uma
 * escrita nao altere o objeto que o `require` manteve em cache.
 */
let db = JSON.parse(JSON.stringify(dbOriginal));

/**
 * Diz se um parametro da query e um COMANDO, e nao um filtro por campo.
 *
 * Comandos sao os do JSON Server (`_sort`, `_order`, `_expand`, ...) e os dois
 * que o `vercel.json` injeta para indicar a rota (`_colecao`, `_id`). Todos
 * comecam com underscore, e nenhum campo do db.json comeca com underscore,
 * entao essa unica regra separa os dois mundos sem lista para manter.
 */
function ehComando(parametro) {
  return parametro.startsWith('_');
}

/**
 * Plural da colecao a partir do singular usado no _expand.
 * O JSON Server resolve `_expand=student` olhando a colecao `students`.
 * Precisa tratar `class` -> `classes` (e nao `classs`).
 */
function pluralizar(singular) {
  if (/(s|x|z|ch|sh)$/i.test(singular)) return `${singular}es`;
  if (/[^aeiou]y$/i.test(singular)) return `${singular.slice(0, -1)}ies`;
  return `${singular}s`;
}

/** Compara como texto: resolve 3 vs "3" e true vs "true" sem surpresa. */
function mesmoValor(a, b) {
  return String(a) === String(b);
}

/** Ordena uma lista por um ou mais campos, respeitando _order. */
function ordenar(lista, sort, order) {
  const campos = String(sort).split(',');
  const direcoes = String(order || 'asc').split(',');

  return [...lista].sort((a, b) => {
    for (let i = 0; i < campos.length; i++) {
      const campo = campos[i];
      const desc = (direcoes[i] || direcoes[0] || 'asc').toLowerCase() === 'desc';
      const va = a[campo];
      const vb = b[campo];
      if (va === vb) continue;

      // Numeros comparam como numeros; o resto como texto.
      const comparacao =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR');

      if (comparacao !== 0) return desc ? -comparacao : comparacao;
    }
    return 0;
  });
}

/**
 * Embute o objeto relacionado, como o _expand do JSON Server:
 * em /enrollments?_expand=student, usa `studentId` para achar o aluno em
 * `students` e devolve o registro com a propriedade `student` preenchida.
 */
function expandir(registros, singulares) {
  return registros.map((registro) => {
    const resultado = { ...registro };
    for (const singular of singulares) {
      const colecao = db[pluralizar(singular)];
      if (!Array.isArray(colecao)) continue;
      const idRelacionado = registro[`${singular}Id`];
      if (idRelacionado === undefined || idRelacionado === null) continue;
      resultado[singular] = colecao.find((item) => mesmoValor(item.id, idRelacionado));
    }
    return resultado;
  });
}

/** Proximo id numerico da colecao: maior existente + 1, como o JSON Server. */
function proximoId(colecao) {
  const ids = colecao
    .map((item) => Number(item.id))
    .filter((n) => Number.isFinite(n));
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

function json(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(corpo === undefined ? '' : JSON.stringify(corpo));
}

module.exports = (req, res) => {
  // A API e publica e somente de demonstracao, entao liberar CORS evita
  // surpresa para quem rodar o frontend local apontando para o site publicado.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const nomeColecao = url.searchParams.get('_colecao');
  const id = url.searchParams.get('_id');

  // Sem colecao na rota: indice das colecoes, igual a home do JSON Server.
  if (!nomeColecao) {
    const indice = {};
    for (const nome of Object.keys(db)) indice[nome] = `/api/${nome}`;
    return json(res, 200, indice);
  }

  const colecao = db[nomeColecao];

  if (!Array.isArray(colecao)) {
    return json(res, 404, {});
  }

  // ---- Rotas de um registro: /api/<colecao>/:id ----
  if (id !== null) {
    const indice = colecao.findIndex((item) => mesmoValor(item.id, id));

    if (req.method === 'GET') {
      return indice === -1 ? json(res, 404, {}) : json(res, 200, colecao[indice]);
    }

    if (indice === -1) return json(res, 404, {});

    if (req.method === 'PUT') {
      const atualizado = { ...(req.body || {}), id: colecao[indice].id };
      colecao[indice] = atualizado;
      return json(res, 200, atualizado);
    }

    if (req.method === 'PATCH') {
      const atualizado = { ...colecao[indice], ...(req.body || {}), id: colecao[indice].id };
      colecao[indice] = atualizado;
      return json(res, 200, atualizado);
    }

    if (req.method === 'DELETE') {
      colecao.splice(indice, 1);
      return json(res, 200, {});
    }

    res.setHeader('Allow', 'GET,PUT,PATCH,DELETE');
    return json(res, 405, { error: `Metodo ${req.method} nao suportado` });
  }

  // ---- Rotas da colecao: /api/<colecao> ----
  if (req.method === 'POST') {
    const novo = { ...(req.body || {}), id: proximoId(colecao) };
    colecao.push(novo);
    return json(res, 201, novo);
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,POST');
    return json(res, 405, { error: `Metodo ${req.method} nao suportado` });
  }

  let resultado = colecao;

  // Filtros por igualdade: tudo que nao for comando do JSON Server.
  for (const [campo, valor] of url.searchParams.entries()) {
    if (ehComando(campo)) continue;
    resultado = resultado.filter((item) => mesmoValor(item[campo], valor));
  }

  const sort = url.searchParams.get('_sort');
  if (sort) resultado = ordenar(resultado, sort, url.searchParams.get('_order'));

  const expands = url.searchParams.getAll('_expand');
  if (expands.length > 0) resultado = expandir(resultado, expands);

  return json(res, 200, resultado);
};
