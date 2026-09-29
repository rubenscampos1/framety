// framyo.js — o servidor do Framyo, morando dentro do Framety sem mexer nele.
//
// O Framyo (programa em janela para o DaVinci + painel no Premiere) conversa
// só com estas rotas, em /api/framyo/…:
//   · usuários do Framyo e o painel admin (criar, editar, atribuir projetos);
//   · a conta Frame.io da empresa, conectada uma vez pelo admin (OAuth Web App
//     da Adobe) — os tokens ficam aqui, nunca nos computadores;
//   · os comentários: o Frame.io avisa este servidor (webhook) e os programas
//     perguntam a cada 5 s o que chegou de novo;
//   · o envio de versões: o programa sobe o arquivo direto para o Frame.io
//     (URLs assinadas) e este servidor empilha como nova versão.
//
// Isolamento do site: tabela própria (framyo_store) no mesmo Postgres — a
// tabela `store` do Framety nunca é lida nem gravada daqui —, arquivo próprio
// em desenvolvimento (framyo-db.json) e um roteador montado antes do
// express.json do site, com seu próprio leitor de JSON. Um erro aqui responde
// 500 nesta rota e não passa adiante.
'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// As duas variáveis de endereço existem só para os testes (um Frame.io falso).
const FRAMEIO = process.env.FRAMYO_TESTE_FRAMEIO || 'https://api.frame.io/v4';
const IMS = process.env.FRAMYO_TESTE_IMS || 'https://ims-na1.adobelogin.com/ims';
const ESCOPOS = 'openid,email,profile,offline_access,additional_info.roles';
const CLIENT_ID = process.env.FRAMEIO_CLIENT_ID || '066f605842ce4858b5471f0b56513cde';
const URL_PUBLICA = (process.env.FRAMYO_URL_PUBLICA || 'https://www.framety.com.br').replace(/\/+$/, '');
const RETORNO = `${URL_PUBLICA}/api/framyo/frameio/callback`;
const EVENTOS_WEBHOOK = ['comment.created'];
const MAX_EVENTOS = 3000;             // o feed guarda os últimos N comentários
const SESSAO_DIAS = 90;

// ── utilidades ────────────────────────────────────────────────────────────────
const agora = () => new Date().toISOString();
const novoId = (p) => p + crypto.randomBytes(6).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  return `scrypt:${sal}:${crypto.scryptSync(senha, sal, 64).toString('hex')}`;
}
function confereSenha(senha, guardada) {
  const [, sal, hash] = String(guardada || '').split(':');
  if (!sal || !hash) return false;
  const a = crypto.scryptSync(String(senha), sal, 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const limpaTexto = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
// "@geovanna": letras, números, ponto, hífen e sublinhado; sempre minúsculo.
const limpaApelido = (s) => limpaTexto(s, 40).replace(/^@+/, '').toLowerCase();
const apelidoValido = (s) => /^[a-z0-9._-]{2,40}$/.test(s);

function usuarioPublico(u) {
  return { id: u.id, nome: u.nome, usuario: u.usuario, admin: !!u.admin, ativo: u.ativo !== false,
           projetos: u.projetos || [], criado_em: u.criado_em };
}

// ── armazenamento ─────────────────────────────────────────────────────────────
const VAZIO = () => ({
  usuarios: [],
  sessoes: {},                 // hash do token -> { usuario_id, criado_em }
  config: { notificacoes: 'todos' },   // 'todos' | 'atribuidos'
  frameio: null,               // { access_token, refresh_token, expira_em, conta_id, conta_nome, webhooks: [] }
  oauth_estados: {},           // state -> { criado_em } (login em andamento)
  eventos: [],
  seq: 0,
});

function criarLoja({ pool, arquivo }) {
  let dados = null;
  let pronto = null;
  let gravando = Promise.resolve();

  async function carregar() {
    if (pool) {
      await pool.query(`CREATE TABLE IF NOT EXISTS framyo_store (
        id INTEGER PRIMARY KEY DEFAULT 1, data JSONB NOT NULL, CONSTRAINT framyo_uma_linha CHECK (id = 1))`);
      const r = await pool.query('SELECT data FROM framyo_store WHERE id = 1');
      dados = r.rows.length ? r.rows[0].data : VAZIO();
    } else {
      try { dados = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { dados = VAZIO(); }
    }
    dados = Object.assign(VAZIO(), dados);
  }

  // Gravações em fila: duas requisições ao mesmo tempo nunca se atropelam.
  function salvar() {
    const copia = JSON.stringify(dados);
    gravando = gravando.then(async () => {
      if (pool) {
        await pool.query(`INSERT INTO framyo_store (id, data) VALUES (1, $1)
                          ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [copia]);
      } else {
        fs.writeFileSync(arquivo + '.tmp', copia);
        fs.renameSync(arquivo + '.tmp', arquivo);
      }
    }).catch((e) => console.error('[framyo] erro ao gravar:', e.message));
    return gravando;
  }

  return {
    pronto: () => (pronto = pronto || carregar()),
    get dados() { return dados; },
    salvar,
  };
}

// ── Frame.io ──────────────────────────────────────────────────────────────────
function criarFrameio(loja) {
  // Client Secret da Adobe: a variável do Render vale primeiro; sem ela, o que
  // o admin cadastrou pelo Framyo (Admin > Frame.io). Nunca sai do servidor.
  const segredo = () => process.env.FRAMEIO_CLIENT_SECRET || loja.dados.client_secret || '';

  async function trocarToken(parametros) {
    const corpo = new URLSearchParams(Object.assign({ client_id: CLIENT_ID, client_secret: segredo() }, parametros));
    const r = await fetch(`${IMS}/token/v3`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || `Adobe respondeu ${r.status}`);
    return j;
  }

  function guardarTokens(j) {
    const f = loja.dados.frameio || (loja.dados.frameio = { webhooks: [] });
    f.access_token = j.access_token;
    if (j.refresh_token) f.refresh_token = j.refresh_token;
    f.expira_em = Date.now() + (Number(j.expires_in) || 3600) * (j.expires_in > 86400 ? 1 : 1000);
  }

  let renovando = null;
  async function token() {
    const f = loja.dados.frameio;
    if (!f || !f.refresh_token) throw Object.assign(new Error('A conta Frame.io ainda não foi conectada.'), { status: 409 });
    if (f.access_token && f.expira_em - Date.now() > 120000) return f.access_token;
    renovando = renovando || trocarToken({ grant_type: 'refresh_token', refresh_token: f.refresh_token })
      .then((j) => { guardarTokens(j); return loja.salvar(); })
      .finally(() => { renovando = null; });
    await renovando;
    return loja.dados.frameio.access_token;
  }

  async function api(metodo, caminho, corpo, tentativa = 0) {
    const r = await fetch(caminho.startsWith('http') ? caminho : FRAMEIO + caminho, {
      method: metodo,
      headers: Object.assign({ Authorization: `Bearer ${await token()}` },
                             corpo ? { 'Content-Type': 'application/json' } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.status === 429 && tentativa < 4) {           // limite da API: espera e tenta de novo
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** tentativa));
      return api(metodo, caminho, corpo, tentativa + 1);
    }
    if (r.status === 401 && tentativa === 0 && loja.dados.frameio) {   // token vencido antes da hora
      loja.dados.frameio.expira_em = 0;
      return api(metodo, caminho, corpo, 1);
    }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.errors && j.errors.map((e) => e.detail || e.title).join('; ')) || j.message || `Frame.io respondeu ${r.status}`;
      throw Object.assign(new Error(msg), { status: r.status >= 500 ? 502 : r.status });
    }
    return j;
  }

  // Todas as páginas de uma listagem.
  async function tudo(caminho) {
    const itens = [];
    let proximo = caminho + (caminho.includes('?') ? '&' : '?') + 'page_size=100';
    for (let i = 0; proximo && i < 50; i++) {
      const j = await api('GET', proximo);
      itens.push(...(j.data || []));
      proximo = j.links && j.links.next ? (j.links.next.startsWith('http') ? j.links.next : FRAMEIO.replace(/\/v4$/, '') + j.links.next) : null;
    }
    return itens;
  }

  const conta = () => {
    const id = loja.dados.frameio && loja.dados.frameio.conta_id;
    if (!id) throw Object.assign(new Error('A conta Frame.io ainda não foi conectada.'), { status: 409 });
    return id;
  };

  return { trocarToken, guardarTokens, api, tudo, conta };
}

// ── o roteador ────────────────────────────────────────────────────────────────
function roteador({ pool, dir, senhaDoConsoleConfere }) {
  const loja = criarLoja({ pool, arquivo: process.env.FRAMYO_DB_FILE || path.join(dir, 'framyo-db.json') });
  const fio = criarFrameio(loja);
  const r = express.Router();
  const D = () => loja.dados;

  loja.pronto().catch((e) => console.error('[framyo] erro ao carregar:', e.message));

  // O corpo cru é guardado para conferir a assinatura dos avisos do Frame.io.
  r.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.corpoCru = buf; } }));
  r.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    loja.pronto().then(() => next(), next);
  });

  const envolve = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
    if (!e.status) console.error('[framyo]', req.method, req.path, e);
    res.status(e.status || 500).json({ erro: e.status ? e.message : 'Erro interno no servidor do Framyo.' });
  });
  const falha = (status, msg) => Object.assign(new Error(msg), { status });

  // ── sessão ──────────────────────────────────────────────────────────────────
  function autenticar(req, res, next) {
    const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const s = t && D().sessoes[hashToken(t)];
    const u = s && D().usuarios.find((x) => x.id === s.usuario_id && x.ativo !== false);
    if (!u) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' });
    req.usuario = u;
    req.tokenHash = hashToken(t);
    next();
  }
  const soAdmin = (req, res, next) => (req.usuario.admin ? next() : res.status(403).json({ erro: 'Só administradores.' }));

  function abrirSessao(u) {
    const t = crypto.randomBytes(32).toString('hex');
    const limite = Date.now() - SESSAO_DIAS * 864e5;
    for (const [k, s] of Object.entries(D().sessoes)) if (Date.parse(s.criado_em) < limite) delete D().sessoes[k];
    D().sessoes[hashToken(t)] = { usuario_id: u.id, criado_em: agora() };
    return t;
  }

  const tentativas = new Map();
  function limiteDeLogin(ip) {
    const t = Date.now();
    const lista = (tentativas.get(ip) || []).filter((x) => t - x < 15 * 60000);
    lista.push(t);
    tentativas.set(ip, lista);
    return lista.length <= 10;
  }

  r.get('/estado', (req, res) => {
    res.json({ ok: true, precisa_configurar: D().usuarios.length === 0,
               frameio_conectado: !!(D().frameio && D().frameio.refresh_token) });
  });

  // Primeiro admin: só enquanto não há nenhum usuário, e só com a senha do
  // console do Framety — ninguém de fora "adota" o Framyo depois do deploy.
  r.post('/configurar', envolve(async (req, res) => {
    if (D().usuarios.length) throw falha(409, 'O Framyo já foi configurado.');
    if (!limiteDeLogin(req.ip)) throw falha(429, 'Muitas tentativas. Espere 15 minutos.');
    if (!senhaDoConsoleConfere(String((req.body || {}).senha_framety || ''))) throw falha(403, 'Senha do console do Framety incorreta.');
    const u = novoUsuario(req.body || {}, true);
    D().usuarios.push(u);
    const token = abrirSessao(u);
    await loja.salvar();
    res.json({ token, usuario: usuarioPublico(u) });
  }));

  r.post('/login', envolve(async (req, res) => {
    if (!limiteDeLogin(req.ip)) throw falha(429, 'Muitas tentativas. Espere 15 minutos.');
    const apelido = limpaApelido((req.body || {}).usuario);
    const u = D().usuarios.find((x) => x.usuario === apelido);
    if (!u || u.ativo === false || !confereSenha((req.body || {}).senha || '', u.senha)) throw falha(401, 'Usuário ou senha incorretos.');
    const token = abrirSessao(u);
    await loja.salvar();
    res.json({ token, usuario: usuarioPublico(u), config: D().config });
  }));

  r.post('/logout', autenticar, envolve(async (req, res) => {
    delete D().sessoes[req.tokenHash];
    await loja.salvar();
    res.json({ ok: true });
  }));

  r.get('/eu', autenticar, (req, res) => {
    res.json({ usuario: usuarioPublico(req.usuario), config: D().config, seq: D().seq,
               frameio_conectado: !!(D().frameio && D().frameio.refresh_token),
               segredo_cadastrado: !!(process.env.FRAMEIO_CLIENT_SECRET || D().client_secret),
               frameio_conta: D().frameio ? D().frameio.conta_nome || null : null });
  });

  r.post('/senha', autenticar, envolve(async (req, res) => {
    const { atual, nova } = req.body || {};
    if (!confereSenha(atual || '', req.usuario.senha)) throw falha(403, 'Senha atual incorreta.');
    if (String(nova || '').length < 6) throw falha(400, 'A senha nova precisa de pelo menos 6 caracteres.');
    req.usuario.senha = hashSenha(String(nova));
    await loja.salvar();
    res.json({ ok: true });
  }));

  // ── admin: usuários e configurações ─────────────────────────────────────────
  function novoUsuario(b, admin) {
    const usuario = limpaApelido(b.usuario);
    if (!apelidoValido(usuario)) throw falha(400, 'Usuário: 2 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.');
    if (D().usuarios.some((x) => x.usuario === usuario)) throw falha(409, `Já existe o usuário @${usuario}.`);
    if (String(b.senha || '').length < 6) throw falha(400, 'A senha precisa de pelo menos 6 caracteres.');
    return { id: novoId('u_'), nome: limpaTexto(b.nome, 80) || usuario, usuario, senha: hashSenha(String(b.senha)),
             admin: !!admin, ativo: true, projetos: [], criado_em: agora() };
  }
  const admins = () => D().usuarios.filter((x) => x.admin && x.ativo !== false);

  r.get('/usuarios', autenticar, soAdmin, (req, res) => res.json({ usuarios: D().usuarios.map(usuarioPublico) }));

  r.post('/usuarios', autenticar, soAdmin, envolve(async (req, res) => {
    const u = novoUsuario(req.body || {}, !!(req.body || {}).admin);
    if (Array.isArray(req.body.projetos)) u.projetos = req.body.projetos.map(String).slice(0, 500);
    D().usuarios.push(u);
    await loja.salvar();
    res.json({ usuario: usuarioPublico(u) });
  }));

  r.put('/usuarios/:id', autenticar, soAdmin, envolve(async (req, res) => {
    const u = D().usuarios.find((x) => x.id === req.params.id);
    if (!u) throw falha(404, 'Usuário não encontrado.');
    const b = req.body || {};
    if (b.nome !== undefined) u.nome = limpaTexto(b.nome, 80) || u.usuario;
    if (b.usuario !== undefined) {
      const novo = limpaApelido(b.usuario);
      if (!apelidoValido(novo)) throw falha(400, 'Usuário inválido.');
      if (novo !== u.usuario && D().usuarios.some((x) => x.usuario === novo)) throw falha(409, `Já existe o usuário @${novo}.`);
      u.usuario = novo;
    }
    if (b.senha) {
      if (String(b.senha).length < 6) throw falha(400, 'A senha precisa de pelo menos 6 caracteres.');
      u.senha = hashSenha(String(b.senha));
      for (const [k, s] of Object.entries(D().sessoes)) if (s.usuario_id === u.id) delete D().sessoes[k];
    }
    // Nunca deixa o Framyo sem nenhum admin ativo.
    const tiraAdmin = (b.admin === false && u.admin) || (b.ativo === false && u.admin);
    if (tiraAdmin && admins().length <= 1) throw falha(400, 'Precisa sobrar pelo menos um administrador ativo.');
    if (b.admin !== undefined) u.admin = !!b.admin;
    if (b.ativo !== undefined) {
      u.ativo = !!b.ativo;
      if (!u.ativo) for (const [k, s] of Object.entries(D().sessoes)) if (s.usuario_id === u.id) delete D().sessoes[k];
    }
    if (Array.isArray(b.projetos)) u.projetos = b.projetos.map(String).slice(0, 500);
    await loja.salvar();
    res.json({ usuario: usuarioPublico(u) });
  }));

  r.delete('/usuarios/:id', autenticar, soAdmin, envolve(async (req, res) => {
    const u = D().usuarios.find((x) => x.id === req.params.id);
    if (!u) throw falha(404, 'Usuário não encontrado.');
    if (u.admin && admins().length <= 1) throw falha(400, 'Precisa sobrar pelo menos um administrador ativo.');
    D().usuarios = D().usuarios.filter((x) => x.id !== u.id);
    for (const [k, s] of Object.entries(D().sessoes)) if (s.usuario_id === u.id) delete D().sessoes[k];
    await loja.salvar();
    res.json({ ok: true });
  }));

  r.put('/config', autenticar, soAdmin, envolve(async (req, res) => {
    const b = req.body || {};
    if (b.notificacoes !== undefined) {
      if (!['todos', 'atribuidos'].includes(b.notificacoes)) throw falha(400, 'Modo de notificação inválido.');
      D().config.notificacoes = b.notificacoes;
    }
    await loja.salvar();
    res.json({ config: D().config });
  }));

  // ── conectar a conta Frame.io (admin) ───────────────────────────────────────
  r.post('/frameio/iniciar', autenticar, soAdmin, envolve(async (req, res) => {
    if (!process.env.FRAMEIO_CLIENT_SECRET && !D().client_secret) {
      throw falha(409, 'Cadastre primeiro o Client Secret da Adobe (Admin > Frame.io).');
    }
    const estado = crypto.randomBytes(24).toString('hex');
    const limite = Date.now() - 15 * 60000;
    for (const [k, v] of Object.entries(D().oauth_estados)) if (Date.parse(v.criado_em) < limite) delete D().oauth_estados[k];
    D().oauth_estados[estado] = { criado_em: agora(), por: req.usuario.id };
    await loja.salvar();
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: RETORNO, scope: ESCOPOS,
                                    response_type: 'code', state: estado });
    res.json({ url: `${IMS}/authorize/v2?${q}` });
  }));

  r.put('/frameio/segredo', autenticar, soAdmin, envolve(async (req, res) => {
    const s = limpaTexto((req.body || {}).client_secret, 300);
    if (s.length < 10 || /s/.test(s)) throw falha(400, 'Esse Client Secret não parece válido. Copie de novo do Adobe Developer Console.');
    if (s.toLowerCase() === CLIENT_ID.toLowerCase()) {
      throw falha(400, 'Isso é o Client ID, não o Client Secret. No Adobe Developer Console, clique em “Retrieve client secret” e copie o que aparecer.');
    }
    // Confere com a Adobe antes de guardar: com um código de login falso, um
    // secret errado volta "invalid_client"; o certo passa dessa checagem.
    const r = await fetch(`${IMS}/token/v3`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: s, code: 'framyo-conferencia' }),
    }).then((x) => x.json()).catch(() => null);
    if (r && r.error === 'invalid_client') {
      throw falha(400, 'A Adobe recusou este Client Secret. Confira se ele é do projeto do Framyo (Client ID ' + CLIENT_ID.slice(0, 6) +
        '…) e se foi copiado inteiro' + (s.startsWith('p8e-') ? '.' : ' — os da Adobe costumam começar com “p8e-”.'));
    }
    D().client_secret = s;
    await loja.salvar();
    res.json({ ok: true, segredo_cadastrado: true });
  }));

  function pagina(titulo, texto) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Framyo</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0b;color:#ececee;font:15px/1.5 Segoe UI,system-ui,sans-serif">
<main style="max-width:440px;padding:24px;text-align:center"><h1 style="font-size:22px;margin:0 0 10px">${esc(titulo)}</h1>
<p style="color:#9a9aa1;margin:0">${esc(texto)}</p></main></body></html>`;
  }

  r.get('/frameio/callback', envolve(async (req, res) => {
    const { code, state, error, error_description: desc } = req.query;
    const pendente = state && D().oauth_estados[state];
    if (error) return res.status(400).send(pagina('Não foi possível conectar', desc || String(error)));
    if (!code || !pendente) return res.status(400).send(pagina('Link expirado', 'Volte ao Framyo e clique em “Conectar Frame.io” de novo.'));
    delete D().oauth_estados[state];
    try {
      const j = await fio.trocarToken({ grant_type: 'authorization_code', code: String(code) });
      D().frameio = { webhooks: (D().frameio && D().frameio.webhooks) || [] };
      fio.guardarTokens(j);
      const contas = await fio.tudo('/accounts');
      if (!contas.length) throw new Error('Esta conta Adobe não tem acesso a nenhuma conta Frame.io.');
      D().frameio.conta_id = contas[0].id;
      D().frameio.conta_nome = contas[0].display_name;
      D().frameio.conectado_em = agora();
      await loja.salvar();
      await registrarWebhooks();
      res.send(pagina('Frame.io conectado', `Conta “${contas[0].display_name}”. Pode fechar esta aba e voltar ao Framyo.`));
    } catch (e) {
      console.error('[framyo] callback:', e.message);
      await loja.salvar();
      const msg = /client_secret/i.test(e.message)
        ? 'A Adobe recusou o Client Secret cadastrado. No Framyo, abra Admin > Frame.io e troque pelo Client Secret certo.'
        : e.message;
      res.status(502).send(pagina('Não foi possível conectar', msg));
    }
  }));

  // Um aviso por área de trabalho, apontando para cá. O segredo de assinatura
  // só vem na criação, então os antigos do Framyo são apagados e refeitos.
  async function registrarWebhooks() {
    const conta = fio.conta();
    const destino = `${URL_PUBLICA}/api/framyo/webhook`;
    const novos = [];
    for (const ws of await fio.tudo(`/accounts/${conta}/workspaces`)) {
      for (const w of await fio.tudo(`/accounts/${conta}/workspaces/${ws.id}/webhooks`).catch(() => [])) {
        if (w.url === destino) await fio.api('DELETE', `/accounts/${conta}/webhooks/${w.id}`).catch(() => {});
      }
      const j = await fio.api('POST', `/accounts/${conta}/workspaces/${ws.id}/webhooks`,
                              { data: { name: 'Framyo', url: destino, events: EVENTOS_WEBHOOK } });
      novos.push({ id: j.data.id, workspace_id: ws.id, secret: j.data.secret });
    }
    D().frameio.webhooks = novos;
    await loja.salvar();
    return novos.length;
  }

  r.post('/frameio/webhooks', autenticar, soAdmin, envolve(async (req, res) => {
    res.json({ areas_de_trabalho: await registrarWebhooks() });
  }));

  r.post('/frameio/desconectar', autenticar, soAdmin, envolve(async (req, res) => {
    const f = D().frameio;
    if (f && f.webhooks) {
      for (const w of f.webhooks) await fio.api('DELETE', `/accounts/${f.conta_id}/webhooks/${w.id}`).catch(() => {});
    }
    D().frameio = null;
    await loja.salvar();
    res.json({ ok: true });
  }));

  // ── avisos do Frame.io (webhook) ────────────────────────────────────────────
  function assinaturaConfere(req) {
    const ts = String(req.headers['x-frameio-request-timestamp'] || '');
    const assinatura = String(req.headers['x-frameio-signature'] || '');
    if (!ts || !assinatura || !req.corpoCru) return false;
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;   // aviso velho: pode ser replay
    const base = Buffer.concat([Buffer.from(`v0:${ts}:`), req.corpoCru]);
    return (D().frameio && D().frameio.webhooks || []).some((w) => {
      const esperado = 'v0=' + crypto.createHmac('sha256', w.secret).update(base).digest('hex');
      return esperado.length === assinatura.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(assinatura));
    });
  }

  r.post('/webhook', (req, res) => {
    if (!assinaturaConfere(req)) return res.status(401).json({ erro: 'assinatura inválida' });
    res.json({ ok: true });                    // responde já; o Frame.io não espera
    const b = req.body || {};
    if (b.type === 'comment.created') {
      registrarComentario(b).catch((e) => console.error('[framyo] comentário:', e.message));
    }
  });

  const vistos = new Set();                    // o Frame.io pode repetir um aviso
  async function registrarComentario(b) {
    const conta = (b.account && b.account.id) || fio.conta();
    const id = b.resource && b.resource.id;
    if (!id || vistos.has(id) || D().eventos.some((e) => e.comentario_id === id)) return;
    vistos.add(id);
    if (vistos.size > 5000) vistos.clear();
    const c = (await fio.api('GET', `/accounts/${conta}/comments/${id}?include=owner`)).data;
    const arq = (await fio.api('GET', `/accounts/${conta}/files/${c.file_id}?include=project`)).data;
    D().seq += 1;
    D().eventos.push({
      seq: D().seq, tipo: 'comentario', comentario_id: id, criado_em: c.created_at || agora(),
      texto: c.text || '', autor: (c.owner && (c.owner.name || c.owner.email)) || 'Alguém',
      arquivo_id: arq.id, arquivo_nome: arq.name, view_url: arq.view_url,
      projeto_id: arq.project_id, projeto_nome: (arq.project && arq.project.name) || '',
      timestamp: c.timestamp == null ? null : c.timestamp,
    });
    if (D().eventos.length > MAX_EVENTOS) D().eventos.splice(0, D().eventos.length - MAX_EVENTOS);
    await loja.salvar();
  }

  // O programa pergunta a cada 5 s: "o que chegou depois do nº X?".
  // No modo "atribuidos", cada um só vê os comentários dos seus projetos.
  r.get('/eventos', autenticar, (req, res) => {
    const desde = Number(req.query.desde) || 0;
    const u = req.usuario;
    const filtra = D().config.notificacoes === 'atribuidos';
    const meus = new Set(u.projetos || []);
    const eventos = D().eventos.filter((e) => e.seq > desde && (!filtra || meus.has(e.projeto_id))).slice(-100);
    res.json({ seq: D().seq, modo: D().config.notificacoes, eventos });
  });

  // ── navegação (projetos, pastas, arquivos) ──────────────────────────────────
  async function projetosVisiveis(u) {
    const conta = fio.conta();
    const lista = [];
    for (const ws of await fio.tudo(`/accounts/${conta}/workspaces`)) {
      for (const p of await fio.tudo(`/accounts/${conta}/workspaces/${ws.id}/projects`)) {
        if (p.status !== 'inactive') lista.push({ id: p.id, nome: p.name, pasta_raiz: p.root_folder_id,
                                                  area: ws.name, area_id: ws.id, view_url: p.view_url });
      }
    }
    // Quem não é admin e tem projetos atribuídos vê só os seus.
    if (!u.admin && (u.projetos || []).length) return lista.filter((p) => u.projetos.includes(p.id));
    return lista;
  }

  r.get('/projetos', autenticar, envolve(async (req, res) => {
    res.json({ projetos: await projetosVisiveis(req.usuario) });
  }));

  // Miniatura (URL assinada, vence em algumas horas): do arquivo ou, numa
  // pilha de versões, da versão mais recente.
  const miniatura = (x) => {
    const t = x && x.media_links && x.media_links.thumbnail;
    return t ? t.url || t.download_url || t.inline_url || null : null;
  };
  const item = (x) => ({
    id: x.id, tipo: x.type, nome: x.name, pai: x.parent_id, projeto_id: x.project_id, view_url: x.view_url,
    atualizado_em: x.updated_at, tamanho: x.file_size, media_type: x.media_type, status: x.status,
    versao_atual: x.head_version ? { id: x.head_version.id, nome: x.head_version.name } : undefined,
    miniatura: miniatura(x) || miniatura(x.head_version),
  });

  r.get('/pastas/:id', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const itens = await fio.tudo(`/accounts/${conta}/folders/${encodeURIComponent(req.params.id)}/children?include=media_links.thumbnail`);
    res.json({ itens: itens.map(item) });
  }));

  // Detalhe de um vídeo: metadados (a resolução vem daí quando o Frame.io a
  // informa) e o link do original, para o programa medir se precisar.
  r.get('/arquivos/:id', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    let alvo = req.params.id;
    const tipo = String(req.query.tipo || 'file');
    let pilha = null;
    if (tipo === 'version_stack') {
      pilha = (await fio.api('GET', `/accounts/${conta}/version_stacks/${encodeURIComponent(alvo)}`)).data;
      alvo = pilha.head_version && pilha.head_version.id;
      if (!alvo) throw falha(404, 'A pilha de versões está vazia.');
    }
    const a = (await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(alvo)}?include=metadata,media_links.original`)).data;
    const versoes = pilha ? (await fio.tudo(`/accounts/${conta}/version_stacks/${pilha.id}/children`)).length : 1;
    const meta = {};
    for (const m of a.metadata || []) meta[m.field_definition_name] = m.value;
    res.json({
      arquivo: item(a), pilha_id: pilha ? pilha.id : null, versoes, metadados: meta,
      original: a.media_links && a.media_links.original ? a.media_links.original.download_url : null,
    });
  }));

  // ── envio de versões ────────────────────────────────────────────────────────
  // 1) o programa pede as URLs; 2) sobe as partes direto para o Frame.io;
  // 3) avisa que terminou, e aqui o arquivo vira nova versão (se for o caso).
  r.post('/envios', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const { pasta_id: pasta, nome, tamanho } = req.body || {};
    if (!pasta || !nome || !(Number(tamanho) > 0)) throw falha(400, 'Faltam pasta, nome ou tamanho do arquivo.');
    const j = await fio.api('POST', `/accounts/${conta}/folders/${encodeURIComponent(pasta)}/files/local_upload`,
                            { data: { name: limpaTexto(nome, 255), file_size: Number(tamanho) } });
    res.json({ arquivo_id: j.data.id, partes: (j.data.upload_urls || []).map((u) => ({ url: u.url, tamanho: u.size })) });
  }));

  r.post('/envios/:id/concluir', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const novo = req.params.id;
    const { versao_de: base, tipo_base: tipo } = req.body || {};
    // Espera o Frame.io dar o arquivo como recebido (até ~2 min).
    let status = null;
    for (let i = 0; i < 40; i++) {
      const s = await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(novo)}/status`).catch(() => null);
      status = s && s.data;
      if (status && status.upload_failed) throw falha(502, 'O Frame.io não conseguiu receber o arquivo. Tente enviar de novo.');
      if (status && status.upload_complete) break;
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    let resultado = { arquivo_id: novo };
    if (base) {
      if (tipo === 'version_stack') {
        // Já é uma pilha: o arquivo novo entra nela e vira a versão mais recente.
        await fio.api('PATCH', `/accounts/${conta}/files/${encodeURIComponent(novo)}/move`, { data: { parent_id: base } });
        resultado.pilha_id = base;
      } else {
        // Primeira revisão: o original e o novo viram uma pilha (v1, v2).
        const orig = (await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(base)}`)).data;
        const p = await fio.api('POST', `/accounts/${conta}/folders/${orig.parent_id}/version_stacks`,
                                { data: { file_ids: [base, novo] } });
        resultado.pilha_id = p.data && p.data.id;
      }
    }
    const a = (await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(novo)}`)).data;
    resultado.view_url = a.view_url;
    res.json(resultado);
  }));

  r.use((req, res) => res.status(404).json({ erro: 'Rota do Framyo não existe.' }));
  r.use((err, req, res, next) => {        // JSON quebrado e afins: fica aqui dentro
    res.status(err.status || 400).json({ erro: err.type === 'entity.parse.failed' ? 'JSON inválido.' : 'Pedido inválido.' });
  });

  r.loja = loja;                          // para testes
  return r;
}

module.exports = { roteador };
