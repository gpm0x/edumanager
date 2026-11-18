/**
 * Testes da API publicada (api/server.js + vercel.json).
 *
 * Rode com:  npm run test:api
 *
 * Os dados esperados sao lidos do proprio api/db.json - nada de usuarios
 * fixos no teste: se o arquivo mudar, o teste acompanha.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { convertRewrites } = require('@vercel/routing-utils');

const db = require('../../api/db.json');
const { criarHandler } = require('../../api/_lib/handler');
const {
  criarArmazenamentoMemoria,
  criarArmazenamentoRedis,
  criarClienteUpstash,
  criarArmazenamento,
} = require('../../api/_lib/armazenamento');
const { servidorVercel, servidorUpstashFalso } = require('./apoio');

const usuario = (login) => db.users.find((u) => u.login === login);

async function get(base, caminho) {
  const r = await fetch(base + caminho);
  return { status: r.status, storage: r.headers.get('x-edumanager-storage'), corpo: await r.json() };
}

async function enviar(base, metodo, caminho, corpo) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  return { status: r.status, corpo: await r.json() };
}

/** Os cinco GETs pedidos, validados contra o conteudo real do db.json. */
function testesDeLeitura(contexto) {
  it('GET /api/users devolve todos os usuarios do db.json', async () => {
    const { status, corpo } = await get(contexto.base, '/api/users');
    assert.equal(status, 200);
    assert.deepEqual(corpo, db.users);
  });

  it('GET /api/users?login=professor&password=prof123 autentica o professor', async () => {
    const esperado = usuario('professor');
    assert.ok(esperado && esperado.password === 'prof123', 'db.json deve conter professor/prof123');
    const { status, corpo } = await get(contexto.base, '/api/users?login=professor&password=prof123');
    assert.equal(status, 200);
    assert.deepEqual(corpo, [esperado]);
  });

  it('GET /api/users?login=admin&password=admin123 autentica o administrador', async () => {
    const esperado = usuario('admin');
    assert.ok(esperado && esperado.password === 'admin123', 'db.json deve conter admin/admin123');
    const { status, corpo } = await get(contexto.base, '/api/users?login=admin&password=admin123');
    assert.equal(status, 200);
    assert.deepEqual(corpo, [esperado]);
  });

  it('GET /api/users com senha errada devolve lista vazia (login invalido)', async () => {
    const { status, corpo } = await get(contexto.base, '/api/users?login=admin&password=errada');
    assert.equal(status, 200);
    assert.deepEqual(corpo, []);
  });

  it('GET /api/users?email=...&password=... (primeira consulta do AuthService)', async () => {
    const admin = usuario('admin');
    const q = `email=${encodeURIComponent(admin.email)}&password=${admin.password}`;
    const { corpo } = await get(contexto.base, `/api/users?${q}`);
    assert.deepEqual(corpo, [admin]);
  });

  it('GET /api/students devolve os alunos do db.json', async () => {
    const { status, corpo } = await get(contexto.base, '/api/students');
    assert.equal(status, 200);
    assert.deepEqual(corpo, db.students);
  });

  it('GET /api/courses devolve os cursos do db.json', async () => {
    const { status, corpo } = await get(contexto.base, '/api/courses');
    assert.equal(status, 200);
    assert.deepEqual(corpo, db.courses);
  });

  it('GET /api/users/:id e 404 para id inexistente', async () => {
    const admin = usuario('admin');
    assert.deepEqual((await get(contexto.base, `/api/users/${admin.id}`)).corpo, admin);
    assert.equal((await get(contexto.base, '/api/users/999999')).status, 404);
  });

  it('GET /api/colecao-inexistente e 404', async () => {
    assert.equal((await get(contexto.base, '/api/naoexiste')).status, 404);
  });
}

/** Ciclo de escrita, igual ao que as telas de cadastro fazem. */
function testesDeEscrita(contexto) {
  it('POST, PATCH, PUT e DELETE em /api/courses', async () => {
    const criado = await enviar(contexto.base, 'POST', '/api/courses', { name: 'Curso de teste', active: true });
    assert.equal(criado.status, 201);
    const id = criado.corpo.id;
    assert.ok(id > Math.max(...db.courses.map((c) => c.id)), 'id novo maior que os existentes');

    const patch = await enviar(contexto.base, 'PATCH', `/api/courses/${id}`, { active: false });
    assert.deepEqual(patch.corpo, { name: 'Curso de teste', active: false, id });

    const put = await enviar(contexto.base, 'PUT', `/api/courses/${id}`, { name: 'Trocado' });
    assert.deepEqual(put.corpo, { name: 'Trocado', id });

    assert.equal((await enviar(contexto.base, 'DELETE', `/api/courses/${id}`)).status, 200);
    assert.equal((await get(contexto.base, `/api/courses/${id}`)).status, 404);
    assert.equal((await enviar(contexto.base, 'PATCH', '/api/courses/999999', { a: 1 })).status, 404);
  });
}

describe('vercel.json', () => {
  it('nenhum parametro sem underscore e acrescentado a query do destino', () => {
    // A causa raiz do bug: a Vercel acrescentava `colecao=users` a query, e a
    // funcao tratava isso como filtro de campo.
    for (const rota of convertRewrites(require('../../vercel.json').rewrites)) {
      const query = rota.dest.split('?')[1] || '';
      for (const par of query.split('&').filter(Boolean)) {
        assert.ok(par.startsWith('_'), `parametro "${par}" em ${rota.dest} viraria filtro de campo`);
      }
    }
  });

  it('reproduz o bug com a configuracao antiga (regressao)', async () => {
    const antigo = [
      { source: '/api/:colecao/:id', destination: '/api/server?_colecao=:colecao&_id=:id' },
      { source: '/api/:colecao', destination: '/api/server?_colecao=:colecao' },
    ];
    const s = await servidorVercel(criarHandler(criarArmazenamentoMemoria()), antigo);
    try {
      assert.deepEqual((await get(s.url, '/api/users')).corpo, []);
    } finally {
      await s.fechar();
    }
  });
});

describe('API com armazenamento em memoria (sem banco configurado)', () => {
  const contexto = {};
  before(async () => {
    const s = await servidorVercel(criarHandler(criarArmazenamentoMemoria()));
    Object.assign(contexto, { base: s.url, fechar: s.fechar });
  });
  after(() => contexto.fechar());

  testesDeLeitura(contexto);
  testesDeEscrita(contexto);

  it('avisa no cabecalho que o armazenamento e temporario', async () => {
    assert.equal((await get(contexto.base, '/api/users')).storage, 'memoria');
  });

  it('com EDUMANAGER_REQUIRE_DB recusa em vez de usar memoria', async () => {
    const s = await servidorVercel(criarHandler(criarArmazenamentoMemoria(), { exigirBanco: true }));
    try {
      assert.equal((await get(s.url, '/api/users')).status, 503);
    } finally {
      await s.fechar();
    }
  });
});

describe('API com banco persistente (Redis / Upstash REST)', () => {
  const contexto = {};
  let upstash;
  const novoArmazenamento = () =>
    criarArmazenamento({ KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token });

  before(async () => {
    upstash = await servidorUpstashFalso();
    const s = await servidorVercel(criarHandler(novoArmazenamento()));
    Object.assign(contexto, { base: s.url, fechar: s.fechar });
  });
  after(async () => {
    await contexto.fechar();
    await upstash.fechar();
  });

  it('escolhe o Redis quando as variaveis da integracao existem', async () => {
    assert.equal(novoArmazenamento().tipo, 'redis');
    assert.equal((await get(contexto.base, '/api/users')).storage, 'redis');
  });

  testesDeLeitura(contexto);
  testesDeEscrita(contexto);

  it('dados gravados sobrevivem a uma nova instancia da funcao (cold start)', async () => {
    const criado = await enviar(contexto.base, 'POST', '/api/payments', { amount: 150, status: 'pago' });
    const removido = usuario('aluno');
    await enviar(contexto.base, 'DELETE', `/api/users/${removido.id}`);

    // Nova instancia: nova memoria, mesmo banco.
    const s2 = await servidorVercel(criarHandler(novoArmazenamento()));
    try {
      assert.deepEqual((await get(s2.url, '/api/payments')).corpo, [criado.corpo]);
      // A carga inicial nao roda de novo: o usuario excluido continua excluido.
      assert.equal((await get(s2.url, `/api/users/${removido.id}`)).status, 404);
      // E o proximo id continua a sequencia, sem colidir.
      const outro = await enviar(s2.url, 'POST', '/api/payments', { amount: 1 });
      assert.equal(outro.corpo.id, criado.corpo.id + 1);
    } finally {
      await s2.fechar();
    }
  });

  it('banco fora do ar responde 500, nunca uma lista vazia', async () => {
    const quebrado = criarArmazenamentoRedis(criarClienteUpstash(upstash.url, 'token-errado'));
    const s = await servidorVercel(criarHandler(quebrado));
    try {
      const { status } = await get(s.url, '/api/users?login=admin&password=admin123');
      assert.equal(status, 500);
    } finally {
      await s.fechar();
    }
  });
});
