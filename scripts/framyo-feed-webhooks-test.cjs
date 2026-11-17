'use strict';
// Feed "Últimos comentários" congelado (incidente de 03/11/2026): avisos do
// Frame.io com segredo desconhecido/desativados. Testa com um Frame.io falso:
// registro seguro, vigia (refaz/reativa), recuperação dos perdidos e o feed
// voltando a atualizar sozinho. Sem conta real, sem banco real.
//   node scripts/framyo-feed-webhooks-test.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const A = 'acc1';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'framyo-feed-'));
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const TOKEN = 'tok-admin-teste';

// ── Frame.io falso ───────────────────────────────────────────────────────────
const F = {
  workspaces: [{ id: 'ws1', name: 'SKYLINE' }, { id: 'ws2', name: 'OUTRA' }],
  // ws1 tem um aviso cujo segredo o servidor não conhece (o estado do incidente)
  webhooks: [{ id: 'wh_perdido', workspace_id: 'ws1', url: null, events: ['comment.created'], active: true }],
  falharCriacao: new Set(), patches: [], deletes: [], criados: 0,
  files: {
    f1: { id: 'f1', name: 'PROVA SOCIAL - INTEGRA - BOSQUE URBANO.mp4', parent_id: 'p1', project_id: 'proj1', updated_at: '2026-11-10T12:00:00Z' },
    f2: { id: 'f2', name: 'GALICIA.LANC.V5.mp4', parent_id: 'p1', project_id: 'proj1', updated_at: '2026-11-12T12:00:00Z' },
    f3: { id: 'f3', name: 'antigo.mp4', parent_id: 'p1', project_id: 'proj1', updated_at: '2026-09-01T12:00:00Z' },
    f9: { id: 'f9', name: 'NOVO.mp4', parent_id: 'p1', project_id: 'proj1', updated_at: '2026-11-17T12:00:00Z' },
  },
  comments: {
    f1: [{ id: 'c0', file_id: 'f1', text: 'pode retirar essa cena', created_at: '2026-11-03T18:29:00Z', owner: { name: 'Luisa Sahium' } },
         { id: 'c1', file_id: 'f1', text: 'trocar trilha', created_at: '2026-11-05T14:00:00Z', owner: { name: 'Luisa Sahium' } }],
    f2: [{ id: 'c2', file_id: 'f2', text: 'cor mais quente', created_at: '2026-11-10T16:00:00Z', owner: { name: 'Anatalia RTVC' } },
         { id: 'c3', file_id: 'f2', text: 'aprovado', created_at: '2026-11-14T10:00:00Z', owner: { name: 'Anatalia RTVC' } }],
    f3: [{ id: 'cx', file_id: 'f3', text: 'nunca deve aparecer', created_at: '2026-11-11T10:00:00Z', owner: { name: 'X' } }],
    f9: [],
  },
};
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const fake = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (d) => { corpo += d; });
  req.on('end', () => {
    const u = new URL(req.url, 'http://x'), p = u.pathname.replace(/^\/v4/, '');
    const b = corpo ? JSON.parse(corpo) : {};
    let m;
    if (p === '/token/v3') return json(res, 200, { access_token: 'at', refresh_token: 'rt', expires_in: 3600 });
    if (p === `/accounts/${A}/workspaces`) return json(res, 200, { data: F.workspaces });
    if ((m = p.match(/^\/accounts\/acc1\/workspaces\/(\w+)\/webhooks$/))) {
      if (req.method === 'GET') return json(res, 200, { data: F.webhooks.filter((w) => w.workspace_id === m[1]) });
      if (F.falharCriacao.has(m[1])) return json(res, 500, { errors: [{ detail: 'falha simulada' }] });
      const w = { id: `wh_${++F.criados}`, workspace_id: m[1], url: b.data.url, events: b.data.events, active: true, secret: `seg_${F.criados}` };
      F.webhooks.push(w);
      return json(res, 200, { data: w });
    }
    if ((m = p.match(/^\/accounts\/acc1\/webhooks\/(\w+)$/))) {
      const w = F.webhooks.find((x) => x.id === m[1]);
      if (req.method === 'DELETE') { F.deletes.push(m[1]); F.webhooks = F.webhooks.filter((x) => x.id !== m[1]); res.writeHead(204); return res.end(); }
      if (req.method === 'PATCH') { F.patches.push(m[1]); if (w) w.active = b.data.active; return json(res, 200, { data: w }); }
    }
    if ((m = p.match(/^\/accounts\/acc1\/folders\/(\w+)\/children$/))) {
      if (m[1] !== 'p1') return json(res, 404, {});
      const filhos = Object.values(F.files).map((f) => Object.assign({ type: 'file' }, f))
        .sort((a, b2) => Date.parse(b2.updated_at) - Date.parse(a.updated_at));
      return json(res, 200, { data: filhos });
    }
    if ((m = p.match(/^\/accounts\/acc1\/files\/(\w+)\/comments$/))) {
      const l = (F.comments[m[1]] || []).slice().sort((a, b2) => Date.parse(b2.created_at) - Date.parse(a.created_at));
      return json(res, 200, { data: l });
    }
    if ((m = p.match(/^\/accounts\/acc1\/comments\/(\w+)$/))) {
      const c = Object.values(F.comments).flat().find((x) => x.id === m[1]);
      return c ? json(res, 200, { data: c }) : json(res, 404, {});
    }
    if ((m = p.match(/^\/accounts\/acc1\/files\/(\w+)$/))) {
      const f = F.files[m[1]];
      return f ? json(res, 200, { data: Object.assign({ view_url: `https://f.io/${f.id}`, project: { name: 'SKYLINE' } }, f) }) : json(res, 404, {});
    }
    json(res, 404, { errors: [{ detail: `rota falsa inexistente: ${req.method} ${p}` }] });
  });
});

(async () => {
  await new Promise((ok) => fake.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${fake.address().port}`;
  const db = path.join(dir, 'framyo-db.json');
  fs.writeFileSync(db, JSON.stringify({
    config: { notificacoes: 'todos' },
    usuarios: [{ id: 'u_adm', nome: 'Rubens', usuario: 'rubens', admin: true, ativo: true, projetos: [] }],
    sessoes: { [hash(TOKEN)]: { usuario_id: 'u_adm', criado_em: new Date().toISOString() } },
    frameio: { conta_id: A, refresh_token: 'rt', access_token: 'at', expira_em: Date.now() + 3600e3,
               webhooks: [{ id: 'wh_velho', workspace_id: 'ws1', secret: 'seg_velho' }] },
    responsaveis: {}, envios: [],
    eventos: [{ seq: 1, tipo: 'comentario', comentario_id: 'c0', criado_em: '2026-11-03T18:29:00Z', texto: 'pode retirar essa cena',
                autor: 'Luisa Sahium', arquivo_id: 'f1', pai_id: 'p1', arquivo_nome: 'PROVA SOCIAL - INTEGRA - BOSQUE URBANO.mp4',
                projeto_id: 'proj1', projeto_nome: 'SKYLINE' }],
    seq: 1,
  }));
  Object.assign(process.env, {
    FRAMYO_DB_FILE: db, FRAMYO_TESTE_FRAMEIO: `${base}/v4`, FRAMYO_TESTE_IMS: base, FRAMYO_URL_PUBLICA: 'https://teste.local',
    FRAMYO_VIGIA: '1', FRAMYO_VIGIA_INICIO_MS: '3600000', FRAMYO_VIGIA_MS: '3600000', FRAMYO_TESTE_ESPERA_NOME_MS: '1', FRAMYO_RECUPERAR_RITMO_MS: '0',
  });
  for (const w of F.webhooks) w.url = 'https://teste.local/api/framyo/webhook';
  const express = require('express');
  const app = express();
  app.use('/api/framyo', require('../framyo').roteador({ pool: null, dir, senhaDoConsoleConfere: () => false }));
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((ok) => srv.once('listening', ok));
  const api = `http://127.0.0.1:${srv.address().port}/api/framyo`;
  const pedir = async (metodo, rota, corpo) => {
    const r = await fetch(api + rota, { method: metodo, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                                        body: corpo ? JSON.stringify(corpo) : undefined });
    return { status: r.status, j: await r.json().catch(() => ({})) };
  };
  const aviso = async (segredo, comentario) => {
    const corpo = JSON.stringify({ type: 'comment.created', account: { id: A }, resource: { id: comentario, type: 'comment' } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = 'v0=' + crypto.createHmac('sha256', segredo).update(`v0:${ts}:${corpo}`).digest('hex');
    const r = await fetch(api + '/webhook', { method: 'POST', body: corpo,
      headers: { 'Content-Type': 'application/json', 'X-Frameio-Request-Timestamp': ts, 'X-Frameio-Signature': sig } });
    return r.status;
  };
  const espera = async (cond, ms = 3000) => { const fim = Date.now() + ms; while (!(await cond())) { if (Date.now() > fim) return false; await new Promise((ok) => setTimeout(ok, 30)); } return true; };
  const loja = () => JSON.parse(fs.readFileSync(db, 'utf8'));
  let ok = 0;
  const caso = async (nome, fn) => { await fn(); ok++; console.log(`ok - ${nome}`); };

  await caso('estado do incidente: feed parado em 03/11 e aviso com segredo desconhecido é recusado', async () => {
    const f = await pedir('GET', '/feed');
    assert.equal(f.j.comentarios.length, 1);
    assert.equal(f.j.comentarios[0].criado_em, '2026-11-03T18:29:00Z');
    assert.equal(await aviso('segredo_que_ninguem_guardou', 'c1'), 401);
  });

  await caso('registro com falha no meio guarda o segredo novo e não apaga nada', async () => {
    F.falharCriacao.add('ws2');
    const r = await pedir('POST', '/frameio/webhooks');
    assert.ok(r.status >= 500, `esperava erro, veio ${r.status}`);
    const ids = loja().frameio.webhooks.map((w) => w.id);
    assert.ok(ids.includes('wh_1'), 'segredo do aviso criado antes da falha precisa ficar gravado');
    assert.equal(F.deletes.length, 0, 'nada pode ser apagado quando o registro falha');
    F.falharCriacao.clear();
  });

  await caso('vigia refaz os avisos e recupera os comentários perdidos (sem notificar em massa)', async () => {
    const antes = (await pedir('GET', '/eventos?desde=1')).j.eventos.length;
    const r = await pedir('POST', '/frameio/vigiar');
    assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.match(r.j.resultado, /^refeito/);
    assert.equal(r.j.recuperados, 3);
    const nossos = F.webhooks.filter((w) => w.url === 'https://teste.local/api/framyo/webhook');
    assert.equal(nossos.length, 2, 'um aviso por área de trabalho, sem duplicados');
    assert.ok(nossos.every((w) => loja().frameio.webhooks.some((x) => x.id === w.id)), 'todo aviso ativo tem segredo conhecido');
    const f = (await pedir('GET', '/feed')).j.comentarios.map((c) => c.comentario_id);
    assert.deepEqual(f, ['c3', 'c2', 'c1', 'c0'], 'feed por data, mais novo primeiro');
    assert.ok(!f.includes('cx'), 'arquivo parado antes do corte não entra');
    assert.equal((await pedir('GET', '/eventos?desde=1')).j.eventos.length, antes, 'recuperados não viram avisos na tela');
  });

  await caso('feed volta a atualizar sozinho com aviso novo assinado', async () => {
    F.comments.f9.push({ id: 'c9', file_id: 'f9', text: 'comentário novo de hoje', created_at: new Date().toISOString(), owner: { name: 'Luisa Sahium' } });
    const segredo = loja().frameio.webhooks.find((w) => w.workspace_id === 'ws1').secret;
    assert.equal(await aviso(segredo, 'c9'), 200);
    assert.ok(await espera(async () => (await pedir('GET', '/feed')).j.comentarios[0]?.comentario_id === 'c9'), 'c9 no topo do feed');
    const ev = (await pedir('GET', '/eventos?desde=1')).j.eventos;
    assert.ok(ev.some((e) => e.comentario_id === 'c9'), 'comentário ao vivo gera aviso');
  });

  await caso('aviso desativado no Frame.io é reativado pelo vigia', async () => {
    const w = F.webhooks.find((x) => x.workspace_id === 'ws2' && x.url);
    w.active = false;
    const r = await pedir('POST', '/frameio/vigiar');
    assert.match(r.j.resultado, /^reativado/);
    assert.ok(F.patches.includes(w.id));
    assert.equal(w.active, true);
  });

  await caso('três avisos com assinatura desconhecida disparam o conserto sozinho', async () => {
    const criadosAntes = F.criados;
    for (let i = 0; i < 3; i++) assert.equal(await aviso('outro_segredo', 'c9'), 401);
    assert.ok(await espera(() => F.criados > criadosAntes), 'vigia deveria refazer os avisos');
    const s = (await pedir('GET', '/frameio/saude')).j;
    assert.equal(s.vigia_ligada, true);
    assert.ok(s.avisos.length === 2);
  });

  console.log(`\n${ok}/6 passaram`);
  srv.close(); fake.close();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
