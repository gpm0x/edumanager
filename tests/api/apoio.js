/**
 * Apoio dos testes da API publicada.
 *
 * `servidorVercel` sobe um servidor HTTP local que reproduz o caminho que uma
 * requisicao faz na Vercel: os rewrites do vercel.json sao compilados pelo
 * MESMO pacote que a Vercel usa (`@vercel/routing-utils`), a URL de destino e
 * montada a partir disso (incluindo os parametros que a plataforma acrescenta
 * por conta propria) e so entao a funcao `api/server` e chamada.
 *
 * `servidorUpstashFalso` imita a API REST da Upstash em memoria, para testar a
 * persistencia sem rede e sem credenciais.
 */
const http = require('node:http');
const { convertRewrites } = require('@vercel/routing-utils');

function escutar(servidor) {
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address();
      resolve({ url: `http://127.0.0.1:${port}`, fechar: () => new Promise((r) => servidor.close(r)) });
    });
  });
}

/** Aplica os rewrites como a Vercel: primeira rota que casa, $1..$n, query original anexada. */
function reescrever(rotas, caminhoComQuery) {
  const original = new URL(caminhoComQuery, 'http://local');
  for (const rota of rotas) {
    const m = new RegExp(rota.src).exec(original.pathname);
    if (!m) continue;
    const destino = rota.dest.replace(/\$(\d+)/g, (_, n) => encodeURIComponent(m[Number(n)] ?? ''));
    const final = new URL(destino, 'http://local');
    for (const [k, v] of original.searchParams) final.searchParams.append(k, v);
    return final.pathname + final.search;
  }
  return original.pathname + original.search;
}

/**
 * @param rewrites  os rewrites a usar (padrao: os do vercel.json do projeto)
 * @param handler   a funcao a chamar quando o destino e /api/server
 */
async function servidorVercel(handler, rewrites = require('../../vercel.json').rewrites) {
  const rotas = convertRewrites(rewrites);
  const servidor = http.createServer((req, res) => {
    const destino = reescrever(rotas, req.url);
    if (!destino.startsWith('/api/server')) {
      res.statusCode = 404;
      return res.end('nao e a API');
    }
    req.url = destino;
    handler(req, res);
  });
  return escutar(servidor);
}

async function servidorUpstashFalso(token = 'token-de-teste') {
  const hashes = new Map();
  const strings = new Map();
  const hash = (k) => hashes.get(k) || hashes.set(k, new Map()).get(k);

  function executar([cmd, ...a]) {
    switch (cmd.toUpperCase()) {
      case 'GET':
        return strings.has(a[0]) ? strings.get(a[0]) : null;
      case 'SET':
        if (a[2] === 'NX' && strings.has(a[0])) return null;
        strings.set(a[0], a[1]);
        return 'OK';
      case 'INCR': {
        const v = Number(strings.get(a[0]) || 0) + 1;
        strings.set(a[0], String(v));
        return v;
      }
      case 'HSETNX':
        if (hash(a[0]).has(a[1])) return 0;
        hash(a[0]).set(a[1], a[2]);
        return 1;
      case 'HSET': {
        const novo = hash(a[0]).has(a[1]) ? 0 : 1;
        hash(a[0]).set(a[1], a[2]);
        return novo;
      }
      case 'HGET':
        return hash(a[0]).get(a[1]) ?? null;
      case 'HEXISTS':
        return hash(a[0]).has(a[1]) ? 1 : 0;
      case 'HDEL':
        return hash(a[0]).delete(a[1]) ? 1 : 0;
      case 'HGETALL':
        return [...hash(a[0])].flat();
      default:
        throw new Error(`comando nao suportado no falso: ${cmd}`);
    }
  }

  const servidor = http.createServer(async (req, res) => {
    const partes = [];
    for await (const p of req) partes.push(p);
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    const corpo = JSON.parse(Buffer.concat(partes).toString());
    try {
      const saida =
        req.url === '/pipeline' ? corpo.map((c) => ({ result: executar(c) })) : { result: executar(corpo) };
      res.end(JSON.stringify(saida));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: e.message }));
    }
  });
  const s = await escutar(servidor);
  return { ...s, token, hashes, strings };
}

module.exports = { servidorVercel, servidorUpstashFalso, reescrever };
