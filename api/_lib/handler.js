/**
 * Logica HTTP da API publicada, separada da funcao (api/server.js) para poder
 * ser testada sem a Vercel. Reimplementa o subconjunto do JSON Server que o
 * frontend usa:
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
 * A colecao e o id chegam como `_colecao` e `_id` na query: quem os coloca la
 * e o rewrite do vercel.json. Os NOMES dos parametros da rota no vercel.json
 * tambem comecam com underscore (`/api/:_colecao`) - ver o comentario do
 * `ehComando` sobre o porque.
 */

/**
 * Diz se um parametro da query e um COMANDO, e nao um filtro por campo.
 *
 * Comandos sao os do JSON Server (`_sort`, `_order`, `_expand`, ...) e os que o
 * vercel.json injeta (`_colecao`, `_id`). Nenhum campo do db.json comeca com
 * underscore, entao essa regra separa os dois mundos.
 *
 * ATENCAO (causa do bug de `/api/users` devolvendo []): a Vercel, alem de
 * montar o destino do rewrite, ACRESCENTA a query cada parametro nomeado da
 * rota que nao aparece no caminho do destino. Com a rota `/api/:colecao`, a
 * funcao recebia `?_colecao=users&colecao=users`, e `colecao=users` virava um
 * filtro que nenhum usuario satisfaz. Por isso os parametros da rota tambem se
 * chamam `_colecao` e `_id`: o que a Vercel acrescentar cai nesta regra.
 */
function ehComando(parametro) {
  return parametro.startsWith('_');
}

/** Plural usado pelo _expand: `class` -> `classes`, `student` -> `students`. */
function pluralizar(singular) {
  if (/(s|x|z|ch|sh)$/i.test(singular)) return `${singular}es`;
  if (/[^aeiou]y$/i.test(singular)) return `${singular.slice(0, -1)}ies`;
  return `${singular}s`;
}

/** Compara como texto: resolve 3 vs "3" e true vs "true" sem surpresa. */
function mesmoValor(a, b) {
  return String(a) === String(b);
}

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
      const comparacao =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR');
      if (comparacao !== 0) return desc ? -comparacao : comparacao;
    }
    return 0;
  });
}

async function expandir(armazenamento, registros, singulares) {
  const relacionadas = {};
  for (const singular of singulares) {
    relacionadas[singular] = await armazenamento.listar(pluralizar(singular));
  }
  return registros.map((registro) => {
    const resultado = { ...registro };
    for (const singular of singulares) {
      const colecao = relacionadas[singular];
      if (!Array.isArray(colecao)) continue;
      const idRelacionado = registro[`${singular}Id`];
      if (idRelacionado === undefined || idRelacionado === null) continue;
      resultado[singular] = colecao.find((item) => mesmoValor(item.id, idRelacionado));
    }
    return resultado;
  });
}

function json(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(corpo === undefined ? '' : JSON.stringify(corpo));
}

/** Corpo da requisicao: a Vercel ja entrega em req.body; fora dela, le o stream. */
async function lerCorpo(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
    return req.body || {};
  }
  const partes = [];
  for await (const parte of req) partes.push(parte);
  const texto = Buffer.concat(partes).toString('utf8');
  return texto ? JSON.parse(texto) : {};
}

function criarHandler(armazenamento, { exigirBanco = false } = {}) {
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Diagnostico visivel no DevTools: "memoria" quer dizer que as escritas
    // NAO sao permanentes (nenhum banco configurado na Vercel).
    res.setHeader('X-EduManager-Storage', armazenamento.tipo);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    if (exigirBanco && armazenamento.tipo === 'memoria') {
      return json(res, 503, {
        error: 'Banco de dados nao configurado: defina KV_REST_API_URL e KV_REST_API_TOKEN.',
      });
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const nomeColecao = url.searchParams.get('_colecao');
      const id = url.searchParams.get('_id');

      if (!nomeColecao) {
        const indice = {};
        for (const nome of await armazenamento.colecoes()) indice[nome] = `/api/${nome}`;
        return json(res, 200, indice);
      }

      if (!(await armazenamento.colecoes()).includes(nomeColecao)) return json(res, 404, {});

      // ---- /api/<colecao>/:id ----
      if (id !== null && id !== '') {
        if (req.method === 'GET') {
          const registro = await armazenamento.buscar(nomeColecao, id);
          return registro ? json(res, 200, registro) : json(res, 404, {});
        }

        if (req.method === 'PUT' || req.method === 'PATCH') {
          const atual = await armazenamento.buscar(nomeColecao, id);
          if (!atual) return json(res, 404, {});
          const corpo = await lerCorpo(req);
          const base = req.method === 'PATCH' ? atual : {};
          const atualizado = { ...base, ...corpo, id: atual.id };
          const gravado = await armazenamento.gravar(nomeColecao, id, atualizado);
          return gravado ? json(res, 200, gravado) : json(res, 404, {});
        }

        if (req.method === 'DELETE') {
          return (await armazenamento.remover(nomeColecao, id)) ? json(res, 200, {}) : json(res, 404, {});
        }

        res.setHeader('Allow', 'GET,PUT,PATCH,DELETE');
        return json(res, 405, { error: `Metodo ${req.method} nao suportado` });
      }

      // ---- /api/<colecao> ----
      if (req.method === 'POST') {
        const novo = await armazenamento.criar(nomeColecao, await lerCorpo(req));
        return json(res, 201, novo);
      }

      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET,POST');
        return json(res, 405, { error: `Metodo ${req.method} nao suportado` });
      }

      let resultado = await armazenamento.listar(nomeColecao);

      for (const [campo, valor] of url.searchParams.entries()) {
        if (ehComando(campo)) continue;
        resultado = resultado.filter((item) => mesmoValor(item[campo], valor));
      }

      const sort = url.searchParams.get('_sort');
      if (sort) resultado = ordenar(resultado, sort, url.searchParams.get('_order'));

      const expands = url.searchParams.getAll('_expand');
      if (expands.length > 0) resultado = await expandir(armazenamento, resultado, expands);

      return json(res, 200, resultado);
    } catch (erro) {
      if (erro instanceof SyntaxError) return json(res, 400, { error: 'JSON invalido no corpo' });
      console.error('[api] falha:', erro);
      // 500 explicito: um banco fora do ar NUNCA pode parecer "lista vazia",
      // senao o login diria "senha invalida" em vez de "servidor com problema".
      return json(res, 500, { error: 'Falha ao acessar os dados' });
    }
  };
}

module.exports = { criarHandler, ehComando, pluralizar };
