/**
 * ONDE OS DADOS DA API PUBLICADA FICAM GUARDADOS.
 *
 * A funcao serverless nao tem disco gravavel: o que ela escreve em memoria
 * morre quando a instancia recicla (minutos de ociosidade, novo deploy, ou
 * simplesmente outra instancia atendendo a proxima requisicao). Por isso ha
 * dois armazenamentos com a MESMA interface:
 *
 *   memoria  copia do api/db.json em memoria. Usado quando nenhum banco esta
 *            configurado (testes, `vercel dev` sem variaveis). Escritas sao
 *            temporarias - e a resposta avisa isso no cabecalho
 *            `X-EduManager-Storage: memoria`.
 *
 *   redis    banco Redis via API REST da Upstash (integracao do Marketplace da
 *            Vercel). Persistente: cadastros, matriculas, pagamentos e
 *            alteracoes sobrevivem a reinicializacoes e a novos deploys.
 *
 * Interface (todas as funcoes sao assincronas):
 *   colecoes()                       -> ['users', 'students', ...]
 *   listar(colecao)                  -> array, ou null se a colecao nao existe
 *   buscar(colecao, id)              -> registro ou null
 *   criar(colecao, dados)            -> registro criado (com id novo)
 *   gravar(colecao, id, registro)    -> registro, ou null se o id nao existe
 *   remover(colecao, id)             -> true se removeu, false se nao existia
 *
 * As colecoes sao as chaves de primeiro nivel do api/db.json: ele define o
 * "esquema" e tambem os dados iniciais.
 */

const dbInicial = require('../db.json');

/** Copia profunda, para nunca alterar o objeto que o require mantem em cache. */
function copiar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

/** Proximo id numerico: maior existente + 1, como o JSON Server. */
function proximoId(registros) {
  const ids = registros.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

/** Ordem estavel por id (numerico quando possivel), como o arquivo do JSON Server. */
function porId(a, b) {
  const na = Number(a.id);
  const nb = Number(b.id);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a.id).localeCompare(String(b.id));
}

// ---------------------------------------------------------------------------
// Memoria
// ---------------------------------------------------------------------------

function criarArmazenamentoMemoria(dados = dbInicial) {
  const db = copiar(dados);
  const achar = (colecao, id) => db[colecao].findIndex((r) => String(r.id) === String(id));

  return {
    tipo: 'memoria',
    async colecoes() {
      return Object.keys(db);
    },
    async listar(colecao) {
      return Array.isArray(db[colecao]) ? copiar(db[colecao]) : null;
    },
    async buscar(colecao, id) {
      const i = achar(colecao, id);
      return i === -1 ? null : copiar(db[colecao][i]);
    },
    async criar(colecao, dados) {
      const novo = { ...dados, id: proximoId(db[colecao]) };
      db[colecao].push(novo);
      return copiar(novo);
    },
    async gravar(colecao, id, registro) {
      const i = achar(colecao, id);
      if (i === -1) return null;
      db[colecao][i] = registro;
      return copiar(registro);
    },
    async remover(colecao, id) {
      const i = achar(colecao, id);
      if (i === -1) return false;
      db[colecao].splice(i, 1);
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Redis (Upstash REST)
// ---------------------------------------------------------------------------

/**
 * Cliente minimo da API REST da Upstash: um comando Redis e um array JSON
 * enviado por POST. Sem dependencia nova no projeto.
 *   POST <url>           ["HGET","chave","campo"]       -> {"result": ...}
 *   POST <url>/pipeline  [["HSET",...],["SET",...]]      -> [{"result": ...}, ...]
 */
function criarClienteUpstash(url, token, fetchImpl = globalThis.fetch) {
  const base = url.replace(/\/+$/, '');

  async function post(caminho, corpo) {
    const resposta = await fetchImpl(base + caminho, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const json = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(`Banco respondeu ${resposta.status}: ${json && json.error ? json.error : 'erro'}`);
    }
    return json;
  }

  return {
    async cmd(...args) {
      const json = await post('', args.map(String));
      if (json.error) throw new Error(`Banco: ${json.error}`);
      return json.result;
    },
    async pipeline(comandos) {
      if (comandos.length === 0) return [];
      const json = await post('/pipeline', comandos.map((c) => c.map(String)));
      const erro = json.find((r) => r.error);
      if (erro) throw new Error(`Banco: ${erro.error}`);
      return json.map((r) => r.result);
    },
  };
}

/**
 * Modelo no Redis (prefixo padrao `edumanager`):
 *   edumanager:col:<colecao>   HASH  id -> registro em JSON
 *   edumanager:seq:<colecao>   STRING contador do ultimo id (INCR e atomico,
 *                              entao dois cadastros simultaneos nunca recebem
 *                              o mesmo id)
 *   edumanager:semeado         STRING marca que a carga inicial ja foi feita
 *
 * CARGA INICIAL: na primeira requisicao contra um banco vazio, os registros do
 * api/db.json sao copiados com HSETNX (que nunca sobrescreve) e o contador
 * comeca no maior id existente. Depois disso a marca `semeado` impede qualquer
 * nova carga: um registro excluido pelo administrador nao "ressuscita" num
 * deploy seguinte, e editar o db.json nao apaga o que esta no banco.
 */
function criarArmazenamentoRedis(cliente, { prefixo = 'edumanager', dados = dbInicial } = {}) {
  const nomes = Object.keys(dados);
  const kCol = (c) => `${prefixo}:col:${c}`;
  const kSeq = (c) => `${prefixo}:seq:${c}`;
  const kSemeado = `${prefixo}:semeado`;
  let semeando = null;

  async function semear() {
    if (await cliente.cmd('GET', kSemeado)) return;
    const comandos = [];
    for (const c of nomes) {
      for (const r of dados[c]) comandos.push(['HSETNX', kCol(c), String(r.id), JSON.stringify(r)]);
      comandos.push(['SET', kSeq(c), String(proximoId(dados[c]) - 1), 'NX']);
    }
    comandos.push(['SET', kSemeado, new Date().toISOString()]);
    await cliente.pipeline(comandos);
  }

  /** Garante a carga inicial uma vez por instancia; se falhar, tenta de novo na proxima. */
  function pronto() {
    if (!semeando) semeando = semear().catch((e) => ((semeando = null), Promise.reject(e)));
    return semeando;
  }

  /** HGETALL da Upstash vem como lista plana [campo, valor, campo, valor, ...]. */
  function registrosDoHash(resultado) {
    const lista = [];
    if (Array.isArray(resultado)) {
      for (let i = 1; i < resultado.length; i += 2) lista.push(JSON.parse(resultado[i]));
    } else if (resultado && typeof resultado === 'object') {
      for (const v of Object.values(resultado)) lista.push(JSON.parse(v));
    }
    return lista.sort(porId);
  }

  return {
    tipo: 'redis',
    async colecoes() {
      return [...nomes];
    },
    async listar(colecao) {
      if (!nomes.includes(colecao)) return null;
      await pronto();
      return registrosDoHash(await cliente.cmd('HGETALL', kCol(colecao)));
    },
    async buscar(colecao, id) {
      await pronto();
      const bruto = await cliente.cmd('HGET', kCol(colecao), String(id));
      return bruto ? JSON.parse(bruto) : null;
    },
    async criar(colecao, dados) {
      await pronto();
      const id = Number(await cliente.cmd('INCR', kSeq(colecao)));
      const novo = { ...dados, id };
      await cliente.cmd('HSET', kCol(colecao), String(id), JSON.stringify(novo));
      return novo;
    },
    async gravar(colecao, id, registro) {
      await pronto();
      // HEXISTS antes de gravar: PUT/PATCH em id inexistente e 404, nao criacao.
      if (!Number(await cliente.cmd('HEXISTS', kCol(colecao), String(id)))) return null;
      await cliente.cmd('HSET', kCol(colecao), String(id), JSON.stringify(registro));
      return registro;
    },
    async remover(colecao, id) {
      await pronto();
      return Number(await cliente.cmd('HDEL', kCol(colecao), String(id))) > 0;
    },
  };
}

/**
 * Escolhe o armazenamento a partir das variaveis de ambiente que a integracao
 * Upstash da Vercel cria (qualquer um dos dois pares). As credenciais ficam so
 * no servidor: o frontend nunca as ve.
 */
function criarArmazenamento(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return criarArmazenamentoRedis(criarClienteUpstash(url, token), {
      prefixo: env.EDUMANAGER_DB_PREFIX || 'edumanager',
    });
  }
  return criarArmazenamentoMemoria();
}

module.exports = {
  criarArmazenamento,
  criarArmazenamentoMemoria,
  criarArmazenamentoRedis,
  criarClienteUpstash,
};
