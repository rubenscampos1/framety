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
const { montarPosts } = require('./framyo-posts');
const { montarChat } = require('./framyo-chat');
let chatApi = null;            // montado junto com as rotas; o /eventos consulta o resumo do chat

// As duas variáveis de endereço existem só para os testes (um Frame.io falso).
const FRAMEIO = process.env.FRAMYO_TESTE_FRAMEIO || 'https://api.frame.io/v4';
const IMS = process.env.FRAMYO_TESTE_IMS || 'https://ims-na1.adobelogin.com/ims';
const ESCOPOS = 'openid,email,profile,offline_access,additional_info.roles';
const CLIENT_ID = process.env.FRAMEIO_CLIENT_ID || '066f605842ce4858b5471f0b56513cde';
const URL_PUBLICA = (process.env.FRAMYO_URL_PUBLICA || 'https://www.framety.com.br').replace(/\/+$/, '');
const RETORNO = `${URL_PUBLICA}/api/framyo/frameio/callback`;
const EVENTOS_WEBHOOK = ['comment.created'];
const MAX_EVENTOS = 3000;             // o feed guarda os últimos N comentários
const ESPERA_NOME_MS = Number(process.env.FRAMYO_TESTE_ESPERA_NOME_MS) || 4000;   // nova tentativa do nome do revisor
const SESSAO_DIAS = 90;
// Impressão (SHA-256) da chave de publicação do construir.py — ver publicador().
const IMPRESSAO_CHAVE_PUBLICAR = '4cb8af34d51936d746114ad8d7416a921abac432a3d97bdfc030eae3296a8eb3';

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
           marketing: !u.admin && !!u.marketing, papel: u.admin ? 'admin' : u.marketing ? 'marketing' : 'editor',
           projetos: u.projetos || [], criado_em: u.criado_em,
           versao: u.versao || null, visto_em: u.visto_em || null, forcar_atualizacao: u.forcar_atualizacao || null };
}

// "1.10.0" > "1.9.2"
function compararVersoes(a, b) {
  const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// ── armazenamento ─────────────────────────────────────────────────────────────
const VAZIO = () => ({
  usuarios: [],
  sessoes: {},                 // hash do token -> { usuario_id, criado_em }
  config: { notificacoes: 'todos' },   // 'todos' | 'atribuidos'
  frameio: null,               // { access_token, refresh_token, expira_em, conta_id, conta_nome, webhooks: [] }
  oauth_estados: {},           // state -> { criado_em } (login em andamento)
  responsaveis: {},            // id do vídeo ou da pilha de versões -> id do usuário
  eventos: [],
  envios: [],                  // o que a equipe subiu pelo Framyo (feed do Início), mais novo primeiro
  seq: 0,
});

const DIAS_DE_COPIA = 30;             // cópias diárias guardadas (framyo_backup)

function criarLoja({ pool, arquivo }) {
  let dados = null;
  let pronto = null;
  let gravando = Promise.resolve();
  let copiaDoDia = null;               // dia (AAAA-MM-DD) da última cópia de segurança

  async function carregar() {
    if (pool) {
      await pool.query(`CREATE TABLE IF NOT EXISTS framyo_store (
        id INTEGER PRIMARY KEY DEFAULT 1, data JSONB NOT NULL, CONSTRAINT framyo_uma_linha CHECK (id = 1))`);
      await pool.query(`CREATE TABLE IF NOT EXISTS framyo_backup (
        dia DATE PRIMARY KEY, data JSONB NOT NULL, gravado_em TIMESTAMPTZ NOT NULL DEFAULT now())`);
      const r = await pool.query('SELECT data FROM framyo_store WHERE id = 1');
      dados = r.rows.length ? r.rows[0].data : VAZIO();
    } else if (fs.existsSync(arquivo)) {
      // Arquivo ilegível: para aqui (sem trocar por um banco vazio na próxima gravação).
      dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    } else {
      dados = VAZIO();
    }
    dados = Object.assign(VAZIO(), dados);
  }

  async function gravar(copia) {
    if (pool) {
      await pool.query(`INSERT INTO framyo_store (id, data) VALUES (1, $1)
                        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [copia]);
      // Uma cópia por dia (a do fim do dia fica), guardando os últimos 30 dias.
      const dia = new Date().toISOString().slice(0, 10);
      await pool.query(`INSERT INTO framyo_backup (dia, data) VALUES ($1, $2)
                        ON CONFLICT (dia) DO UPDATE SET data = EXCLUDED.data, gravado_em = now()`, [dia, copia]);
      if (copiaDoDia !== dia) {
        copiaDoDia = dia;
        await pool.query(`DELETE FROM framyo_backup WHERE dia < CURRENT_DATE - $1::int`, [DIAS_DE_COPIA]);
      }
    } else {
      fs.writeFileSync(arquivo + '.tmp', copia);
      fs.renameSync(arquivo + '.tmp', arquivo);
    }
  }

  // Gravações em fila: duas requisições ao mesmo tempo nunca se atropelam.
  // Se o banco recusar (3 tentativas), quem pediu recebe o erro — a tela
  // avisa em vez de mostrar "salvo" com o dado perdido. A fila segue.
  function salvar() {
    const copia = JSON.stringify(dados);
    const esta = gravando.then(async () => {
      for (let i = 0; ; i++) {
        try { return await gravar(copia); } catch (e) {
          console.error('[framyo] erro ao gravar (tentativa ' + (i + 1) + '):', e.message);
          if (i >= 2) throw Object.assign(new Error('Não foi possível salvar no banco agora. Tente de novo em instantes.'), { status: 503 });
          await new Promise((ok) => setTimeout(ok, 500 * 2 ** i));
        }
      }
    });
    gravando = esta.catch(() => {});
    return esta;
  }

  return {
    // Se o banco falhar ao ligar, a próxima requisição tenta de novo.
    pronto: () => (pronto = pronto || carregar().catch((e) => {
      pronto = null;
      console.error('[framyo] erro ao carregar:', e.message);
      throw Object.assign(new Error('O banco do Framyo não respondeu. Tente de novo em instantes.'), { status: 503 });
    })),
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
      .then((j) => { guardarTokens(j); return loja.salvar().catch(() => {}); })
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

  // Responsável por um vídeo: um dos usuários ativos do Framyo.
  const pessoa = (uid) => {
    const u = uid && D().usuarios.find((x) => x.id === uid && x.ativo !== false);
    return u ? { id: u.id, nome: u.nome, usuario: u.usuario } : null;
  };
  const responsavelDe = (...ids) => {
    for (const id of ids) { const p = id && pessoa(D().responsaveis[id]); if (p) return p; }
    return null;
  };

  // ── sessão ──────────────────────────────────────────────────────────────────
  function autenticar(req, res, next) {
    const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let s = t && D().sessoes[hashToken(t)];
    if (s && Date.parse(s.criado_em) < Date.now() - SESSAO_DIAS * 864e5) { delete D().sessoes[hashToken(t)]; s = null; }   // vencida
    const u = s && D().usuarios.find((x) => x.id === s.usuario_id && x.ativo !== false);
    if (!u) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' });
    req.usuario = u;
    req.tokenHash = hashToken(t);
    // Marketing: só o calendário. Nada de Frame.io (projetos, vídeos, comentários, links, envios, Início).
    if (u.marketing && !u.admin && /^\/(projetos|pastas|arquivos|busca|midia|versoes|comentarios|mover|empilhar|pilhas|links|envios|feed|responsaveis|chat)(\/|$)/.test(req.path)) {
      return res.status(403).json({ erro: 'O acesso de marketing é só o calendário de posts.' });
    }
    // O programa se identifica no User-Agent ("Framyo/1.4.0"): o admin vê a
    // versão de cada pessoa. Fica na memória e vai junto no próximo salvamento.
    const v = /Framyo\/(\d+(?:\.\d+){1,3})/.exec(String(req.headers['user-agent'] || ''));
    if (v) {
      u.versao = v[1];
      u.visto_em = agora();
      if (u.forcar_atualizacao && compararVersoes(v[1], u.forcar_atualizacao) >= 0) delete u.forcar_atualizacao;
    }
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
  // Até 10 tentativas erradas por IP a cada 15 min (as certas não contam).
  function limiteDeLogin(ip) {
    const t = Date.now();
    const lista = (tentativas.get(ip) || []).filter((x) => t - x < 15 * 60000);
    tentativas.set(ip, lista);
    if (tentativas.size > 10000) tentativas.clear();
    return lista.length < 10;
  }
  const errou = (ip) => (tentativas.get(ip) || tentativas.set(ip, []).get(ip)).push(Date.now());

  r.get('/estado', (req, res) => {
    res.json({ ok: true, precisa_configurar: D().usuarios.length === 0,
               frameio_conectado: !!(D().frameio && D().frameio.refresh_token) });
  });

  // Primeiro admin: só enquanto não há nenhum usuário, e só com a senha do
  // console do Framety — ninguém de fora "adota" o Framyo depois do deploy.
  r.post('/configurar', envolve(async (req, res) => {
    if (D().usuarios.length) throw falha(409, 'O Framyo já foi configurado.');
    if (!limiteDeLogin(req.ip)) throw falha(429, 'Muitas tentativas. Espere 15 minutos.');
    if (!senhaDoConsoleConfere(String((req.body || {}).senha_framety || ''))) { errou(req.ip); throw falha(403, 'Senha do console do Framety incorreta.'); }
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
    if (!u || u.ativo === false || !confereSenha((req.body || {}).senha || '', u.senha)) { errou(req.ip); throw falha(401, 'Usuário ou senha incorretos.'); }
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
             admin: !!admin, marketing: !admin && b.papel === 'marketing', ativo: true, projetos: [], criado_em: agora() };
  }
  const admins = () => D().usuarios.filter((x) => x.admin && x.ativo !== false);

  // Todos os usuários ativos (sem senha nem papel) — para escolher o responsável.
  r.get('/pessoas', autenticar, (req, res) => {
    res.json({ pessoas: D().usuarios.filter((x) => x.ativo !== false).map((x) => pessoa(x.id)) });
  });

  r.put('/responsaveis/:id', autenticar, envolve(async (req, res) => {
    const alvo = limpaTexto(req.params.id, 80);
    const uid = (req.body || {}).usuario_id;
    if (!alvo) throw falha(400, 'Vídeo inválido.');
    if (uid) {
      if (!pessoa(uid)) throw falha(404, 'Esse usuário não existe ou está desativado.');
      D().responsaveis[alvo] = uid;
    } else {
      delete D().responsaveis[alvo];
    }
    await loja.salvar();
    res.json({ responsavel: pessoa(uid) });
  }));

  r.get('/usuarios', autenticar, soAdmin, (req, res) => res.json({ usuarios: D().usuarios.map(usuarioPublico) }));

  r.post('/usuarios', autenticar, soAdmin, envolve(async (req, res) => {
    const b0 = req.body || {};
    const u = novoUsuario(b0, b0.papel ? b0.papel === 'admin' : !!b0.admin);
    if (Array.isArray(req.body.projetos)) u.projetos = req.body.projetos.map(String).slice(0, 500);
    D().usuarios.push(u);
    await loja.salvar();
    res.json({ usuario: usuarioPublico(u) });
  }));

  // Admin força a atualização no computador da pessoa: a bandeja dela vê no
  // próximo /eventos (5 s), baixa e instala sozinha, com uma barrinha no canto.
  // Todos de uma vez: quem está ativo e atrás da versão publicada.
  r.post('/usuarios/atualizar-todos', autenticar, soAdmin, envolve(async (req, res) => {
    const pub = D().atualizacao;
    if (!pub || !pub.versao) throw falha(409, 'Nenhuma versão publicada ainda.');
    const alvo = D().usuarios.filter((u) => u.ativo !== false && (!u.versao || compararVersoes(u.versao, pub.versao) < 0));
    for (const u of alvo) u.forcar_atualizacao = pub.versao;
    await loja.salvar();
    res.json({ ok: true, versao: pub.versao, usuarios: alvo.map((u) => u.usuario) });
  }));

  r.post('/usuarios/:id/atualizar', autenticar, soAdmin, envolve(async (req, res) => {
    const u = D().usuarios.find((x) => x.id === req.params.id);
    if (!u) throw falha(404, 'Usuário não encontrado.');
    const pub = D().atualizacao;
    if (!pub || !pub.versao) throw falha(409, 'Nenhuma versão publicada. Publique em Admin › Atualizações.');
    if (u.versao && compararVersoes(u.versao, pub.versao) >= 0) throw falha(409, `@${u.usuario} já está na versão ${u.versao}.`);
    u.forcar_atualizacao = pub.versao;
    await loja.salvar();
    res.json({ ok: true, usuario: usuarioPublico(u) });
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
    // Papel: admin, editor ou marketing (marketing: só o calendário e a legenda dos posts).
    if (b.papel !== undefined) {
      if (!['admin', 'editor', 'marketing'].includes(b.papel)) throw falha(400, 'Papel inválido.');
      b.admin = b.papel === 'admin';
    }
    const tiraAdmin = (b.admin === false && u.admin) || (b.ativo === false && u.admin);
    if (tiraAdmin && admins().length <= 1) throw falha(400, 'Precisa sobrar pelo menos um administrador ativo.');
    if (b.admin !== undefined) u.admin = !!b.admin;
    if (b.papel !== undefined) u.marketing = b.papel === 'marketing';
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
    for (const [k, v] of Object.entries(D().responsaveis || {})) if (v === u.id) delete D().responsaveis[k];
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
    if (s.length < 10 || /\s/.test(s)) throw falha(400, 'Esse Client Secret não parece válido. Copie de novo do Adobe Developer Console.');
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

  // Quem comenta por link de revisão (cliente sem conta) vem sem dono.
  const autorDe = (c) => (c.owner && (c.owner.name || c.owner.email)) || c._nome || (c.owner ? 'Usuário do Frame.io' : 'Revisor externo');

  const vistos = new Set();                    // o Frame.io pode repetir um aviso
  async function registrarComentario(b) {
    const conta = (b.account && b.account.id) || fio.conta();
    const id = b.resource && b.resource.id;
    if (!id || vistos.has(id) || D().eventos.some((e) => e.comentario_id === id)) return;
    vistos.add(id);
    if (vistos.size > 5000) vistos.clear();
    const c = (await fio.api('GET', `/accounts/${conta}/comments/${id}?include=owner`)).data;
    const arq = (await fio.api('GET', `/accounts/${conta}/files/${c.file_id}?include=project`)).data;
    // O responsável pode estar no arquivo ou na pilha de versões em que ele está.
    const resp = responsavelDe(arq.id, arq.parent_id);
    // Cliente pelo link de revisão: o nome vem da atividade do link, que o
    // Frame.io registra alguns segundos (às vezes dezenas) depois do aviso. O
    // aviso na área de trabalho não muda depois de mostrado, então espera o
    // nome por até ~40 s (sai na hora em que o nome aparece).
    const esperas = [0, 1, 2, 3, 4].map((n) => n * ESPERA_NOME_MS);          // 0, 4, 8, 12, 16 s
    for (let i = 0; i < esperas.length && !c.owner && !c._nome; i++) {
      if (esperas[i]) await new Promise((ok) => setTimeout(ok, esperas[i]));
      await nomearRevisores(conta, arq.id, [c], true).catch(() => {});
    }
    D().seq += 1;
    D().eventos.push({
      seq: D().seq, tipo: 'comentario', comentario_id: id, criado_em: c.created_at || agora(),
      texto: c.text || '', autor: autorDe(c),
      arquivo_id: arq.id, pai_id: arq.parent_id || null, arquivo_nome: arq.name, view_url: arq.view_url,
      projeto_id: arq.project_id, projeto_nome: (arq.project && arq.project.name) || '',
      timestamp: c.timestamp == null ? null : c.timestamp,
      responsavel_id: resp ? resp.id : null, responsavel: resp ? resp.usuario : null,
    });
    if (D().eventos.length > MAX_EVENTOS) D().eventos.splice(0, D().eventos.length - MAX_EVENTOS);
    await loja.salvar();
  }

  // O programa pergunta a cada 5 s: "o que chegou depois do nº X?".
  // No modo "atribuidos", cada um recebe os comentários dos vídeos de que é
  // responsável; nos vídeos sem responsável, os dos projetos atribuídos a ele.
  r.get('/eventos', autenticar, envolve(async (req, res) => {
    const desde = Number(req.query.desde) || 0;
    const u = req.usuario;
    const filtra = D().config.notificacoes === 'atribuidos';
    const meus = new Set(u.projetos || []);
    const meu = (e) => (e.responsavel_id ? e.responsavel_id === u.id : meus.has(e.projeto_id));
    const eventos = u.marketing && !u.admin ? []         // marketing não recebe avisos de comentário
      : D().eventos.filter((e) => e.seq > desde && (!filtra || meu(e))).slice(-100);
    await nomearEventosAntigos(eventos);
    const pub = D().atualizacao;
    const forcar = u.forcar_atualizacao && pub && pub.versao && compararVersoes(pub.versao, u.versao) > 0 ? pub.versao : null;
    // versao: a última publicada — o programa pergunta a cada 3 s e avisa na hora.
    // chat: total de não lidas e o que chegou depois do nº que este programa já viu (?chat=N)
    const chatVisto = req.query.chat === undefined ? null : Number(req.query.chat) || 0;
    res.json({ seq: D().seq, modo: D().config.notificacoes, eventos, atualizar: forcar,
               chat: chatApi ? chatApi.resumo(u, chatVisto) : null,
               versao: pub && pub.versao ? { versao: pub.versao, notas: pub.notas || '', tamanho: pub.tamanho } : null });
  }));

  // Avisos guardados antes de o nome do revisor por link funcionar: tenta uma
  // vez para cada um (poucos por consulta, para não atrasar a resposta).
  async function nomearEventosAntigos(eventos) {
    // até 3 tentativas por aviso, com 30 s entre elas, lendo a atividade na hora
    const tentar = (e) => e.autor === 'Revisor externo' && (e.nome_tentativas || (e.nome_tentado ? 1 : 0)) < 3
      && (!e.nome_tentado_em || Date.now() - e.nome_tentado_em > 30000);
    const sem = eventos.filter(tentar).slice(-5);
    if (!sem.length) return;
    for (const e of sem) {
      e.nome_tentativas = (e.nome_tentativas || (e.nome_tentado ? 1 : 0)) + 1;
      e.nome_tentado_em = Date.now();
      const c = { created_at: e.criado_em, owner: null };
      await nomearRevisores(fio.conta(), e.arquivo_id, [c], true).catch(() => {});
      if (c._nome) e.autor = c._nome;
    }
    await loja.salvar().catch(() => {});
  }

  // ── navegação (projetos, pastas, arquivos) ──────────────────────────────────
  let cacheProjetos = { em: 0, lista: null };
  async function projetosVisiveis(u) {
    const conta = fio.conta();
    if (!cacheProjetos.lista || Date.now() - cacheProjetos.em > 60000) {
      cacheProjetos = { em: Date.now(), lista: await todosOsProjetos(conta) };
    }
    const lista = cacheProjetos.lista;
    // Quem não é admin e tem projetos atribuídos vê só os seus.
    if (!u.admin && (u.projetos || []).length) return lista.filter((p) => u.projetos.includes(p.id));
    return lista;
  }
  async function todosOsProjetos(conta) {
    const lista = [];
    for (const ws of await fio.tudo(`/accounts/${conta}/workspaces`)) {
      for (const p of await fio.tudo(`/accounts/${conta}/workspaces/${ws.id}/projects`)) {
        if (p.status !== 'inactive') lista.push({ id: p.id, nome: p.name, pasta_raiz: p.root_folder_id,
                                                  area: ws.name, area_id: ws.id, view_url: p.view_url });
      }
    }
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
    // Numa pilha de versões o nome que vale é o da versão atual: o nome da pilha
    // no Frame.io fica parado no de quando ela foi criada/aumentada e não volta
    // quando uma versão é apagada (aparecia "V6" com a pilha indo só até a V4).
    id: x.id, tipo: x.type, nome: (x.type === 'version_stack' && x.head_version && x.head_version.name) || x.name,
    nome_pilha: x.type === 'version_stack' ? x.name : undefined,
    pai: x.parent_id, projeto_id: x.project_id, view_url: x.view_url,
    atualizado_em: x.updated_at, tamanho: x.file_size, media_type: x.media_type, status: x.status,
    // data em que o vídeo foi gerado/enviado (numa pilha, a da versão atual)
    criado_em: (x.head_version && x.head_version.created_at) || x.created_at || null,
    versao_atual: x.head_version ? { id: x.head_version.id, nome: x.head_version.name } : undefined,
    miniatura: miniatura(x) || miniatura(x.head_version),
    responsavel: responsavelDe(x.id),
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
      responsavel: responsavelDe(pilha ? pilha.id : a.id),
      original: a.media_links && a.media_links.original ? a.media_links.original.download_url : null,
    });
  }));

  // ── busca, player, versões e comentários ────────────────────────────────────
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Busca no projeto inteiro (subpastas, vídeos e pilhas). A busca do Frame.io
  // é da conta toda; o filtro pelo projeto é feito aqui.
  r.get('/busca', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const q = limpaTexto(req.query.q, 200);
    const projeto = String(req.query.projeto_id || '');
    if (q.length < 2) return res.json({ itens: [] });
    // Sem projeto: a conta toda, só nos projetos que este usuário enxerga.
    const visiveis = await projetosVisiveis(req.usuario);
    const nomes = new Map(visiveis.map((x) => [x.id, x]));
    const buscar = async (termo, paginas, filtro) => {
      const achados = [];
      let proximo = `/accounts/${conta}/search?page_size=100`;
      for (let i = 0; proximo && i < paginas && achados.length < 200; i++) {
        const j = await fio.api('POST', proximo, { query: termo, engine: 'lexical',
          filters: { projects: !projeto, folders: true, files_and_version_stacks: true } });
        for (const x of j.data || []) {
          const a = x.result;
          if (!a || (filtro && !filtro(a.name))) continue;
          if (x.type === 'project_result') {
            if (!projeto && nomes.has(a.id)) achados.push(Object.assign({}, nomes.get(a.id), { tipo: 'projeto' }));
            continue;
          }
          if (projeto ? a.project_id !== projeto : !nomes.has(a.project_id)) continue;
          achados.push(Object.assign(item(a), { projeto_nome: (nomes.get(a.project_id) || {}).nome || '' }));
        }
        proximo = j.links && j.links.next ? j.links.next.replace(/^\/v4/, '') : null;
      }
      return achados;
    };
    let achados = await buscar(q, 5);
    // A busca do Frame.io diferencia acento ("galicia" não acha "GALÍCIA"), mas
    // aceita começo de palavra ("gal" acha). Sem nada achado e sem acento no
    // termo: encurta a palavra maior até achar, e filtra aqui ignorando acento.
    if (!achados.length && !/[^\x00-\x7f]/.test(q)) {
      const partes = semAcento(q).split(/\s+/).filter(Boolean);
      const maior = partes.reduce((a, b) => (b.length > a.length ? b : a), '');
      const casa = (nome) => { const n = semAcento(nome); return partes.every((p) => n.includes(p)); };
      for (let n = maior.length - 1; n >= 3 && !achados.length; n--) {
        achados = await buscar(partes.map((p) => (p === maior ? p.slice(0, n) : p)).join(' '), 2, casa);
      }
    }
    res.json({ itens: achados });
  }));

  // Link para tocar (a versão leve do Frame.io, sem baixar o original) e o
  // que se sabe do quadro por segundo (para levar o vídeo até um comentário).
  r.get('/midia/:id', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const a = (await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(req.params.id)}` +
      '?include=metadata,media_links.efficient,media_links.high_quality,media_links.video_h264_180,media_links.original')).data;
    const ml = a.media_links || {};
    const link = (m) => m && (m.url || m.inline_url || m.download_url);
    const meta = {};
    for (const m of a.metadata || []) meta[m.field_definition_name] = m.value;
    res.json({
      arquivo: item(a), metadados: meta,
      video: link(ml.efficient) || link(ml.high_quality) || link(ml.video_h264_180) || null,
      original: link(ml.original) || null,
    });
  }));

  // Versões de uma pilha, da mais antiga (v1) para a mais nova.
  r.get('/versoes/:id', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const lista = await fio.tudo(`/accounts/${conta}/version_stacks/${encodeURIComponent(req.params.id)}/children?include=media_links.thumbnail,creator`);
    const versoes = lista.filter((x) => x.type === 'file')
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((x, i) => Object.assign(item(x), { numero: i + 1, criado_em: x.created_at,
                                              criador: x.creator ? x.creator.name || x.creator.email : null }));
    res.json({ versoes });
  }));

  // Quem comenta por link de revisão (cliente sem conta) vem sem "owner" no
  // comentário. O nome está na atividade do link ("comment_created", com nome
  // e e-mail), sem dizer qual comentário: cruza pelo vídeo e pelo horário.
  // Um projeto pode ter dezenas de links: lê primeiro os vistos por último e
  // pula os que ninguém abriu desde antes do comentário.
  const cacheLinks = new Map();                  // projeto -> { em, lista }
  const cacheAtividade = new Map();              // link -> { em, lista }
  async function atividadeDeComentarios(conta, projeto, desde, fresco) {
    let s = cacheLinks.get(projeto);
    if (!s || fresco || Date.now() - s.em > 3 * 60000) {
      s = { em: Date.now(), lista: await fio.tudo(`/accounts/${conta}/projects/${projeto}/shares`).catch(() => []) };
      cacheLinks.set(projeto, s);
    }
    const visto = (sh) => Date.parse(sh.last_viewed_at || '') || 0;
    // "Última visualização" do link nem sempre é atualizada na hora do
    // comentário: aceita links vistos até 3 dias antes. Na busca na hora (aviso,
    // que tenta várias vezes), só os 15 mais recentes — o Frame.io limita pedidos.
    const links = s.lista.filter((sh) => !visto(sh) || visto(sh) >= desde - 3 * 864e5)
      .sort((a, b) => visto(b) - visto(a)).slice(0, fresco ? 15 : 40);
    const lista = [];
    for (const sh of links) {
      let c = cacheAtividade.get(sh.id);
      if (!c || fresco || Date.now() - c.em > 3 * 60000) {
        const at = await fio.tudo(`/accounts/${conta}/shares/${sh.id}/activities?include=user`).catch(() => []);
        c = { em: Date.now(), lista: at.filter((a) => a.type === 'comment_created' && a.user && (a.user.name || a.user.email))
          .map((a) => ({ asset: a.asset_id, em: Date.parse(a.inserted_at), nome: a.user.name || a.user.email })) };
        cacheAtividade.set(sh.id, c);
      }
      lista.push(...c.lista);
    }
    return lista;
  }
  async function nomearRevisores(conta, arquivo, comentarios, fresco) {
    const sem = comentarios.filter((c) => !c.owner);
    if (!sem.length) return;
    let a;
    try { a = (await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(arquivo)}`)).data; } catch { return; }
    const alvos = new Set([a.id, a.parent_id]);
    const desde = Math.min(...sem.map((c) => Date.parse(c.created_at) || Date.now()));
    const atividade = (await atividadeDeComentarios(conta, a.project_id, desde, fresco)).filter((x) => alvos.has(x.asset));
    const usados = new Set();
    for (const c of sem) {
      const t = Date.parse(c.created_at);
      let melhor = null;
      for (const [i, x] of atividade.entries()) {
        const d = Math.abs(x.em - t);
        if (!usados.has(i) && d < 120000 && (!melhor || d < melhor.d)) melhor = { i, d, nome: x.nome };
      }
      if (melhor) { usados.add(melhor.i); c._nome = melhor.nome; }
    }
    // O Frame.io não registra cada comentário seguido da mesma pessoa: sem
    // atividade no horário, vale quem comentou por último neste vídeo pelo
    // link, nos 30 minutos antes.
    for (const c of sem) {
      if (c._nome) continue;
      const t = Date.parse(c.created_at);
      const antes = atividade.filter((x) => x.em <= t && t - x.em < 30 * 60000).sort((a, b) => b.em - a.em)[0];
      if (antes) c._nome = antes.nome;
    }
  }

  // Todos os comentários de um vídeo (os antigos também), na ordem do vídeo,
  // com as respostas de cada um.
  r.get('/comentarios/:id', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const lista = await fio.tudo(`/accounts/${conta}/files/${encodeURIComponent(req.params.id)}/comments?include=owner,replies&timestamp_as_timecode=false`);
    const todos = lista.concat(...lista.map((c) => c.replies || []));
    await nomearRevisores(conta, req.params.id, todos).catch((e) => console.error('[framyo] nomes:', e.message));
    const comentarios = lista.map((c) => ({
      id: c.id, texto: c.text || '', criado_em: c.created_at,
      autor: autorDe(c),
      avatar: c.owner && c.owner.avatar_url || null,
      quadro: typeof c.timestamp === 'number' ? c.timestamp : null,
      duracao: c.duration || null, concluido: !!c.completed_at,
      anotacao: !!c.annotation,
      respostas: (c.replies || []).map((x) => ({ id: x.id, texto: x.text || '', autor: autorDe(x), criado_em: x.created_at })),
    })).sort((a, b) => (a.quadro ?? 1e12) - (b.quadro ?? 1e12) || String(a.criado_em).localeCompare(String(b.criado_em)));
    res.json({ comentarios });
  }));

  // Nome e pai de uma pasta (para abrir um resultado de busca no lugar certo).
  // Marcar / desmarcar um comentário como concluído (vale no Frame.io também).
  r.put('/comentarios/:id/concluido', autenticar, envolve(async (req, res) => {
    const concluido = !!(req.body || {}).concluido;
    const c = (await fio.api('PATCH', `/accounts/${fio.conta()}/comments/${encodeURIComponent(req.params.id)}`,
                             { data: { completed: concluido } })).data || {};
    res.json({ id: req.params.id, concluido: c.completed_at !== undefined ? !!c.completed_at : concluido });
  }));

  // O "pai" de um vídeo pode ser uma pilha de versões: aí vem tipo "version_stack".
  r.get('/pastas/:id/info', autenticar, envolve(async (req, res) => {
    const id = encodeURIComponent(req.params.id);
    let f, tipo = 'folder';
    try { f = (await fio.api('GET', `/accounts/${fio.conta()}/folders/${id}`)).data; } catch (e) {
      if (e.status !== 404 && e.status !== 422 && e.status !== 400) throw e;
      f = (await fio.api('GET', `/accounts/${fio.conta()}/version_stacks/${id}`)).data;
      tipo = 'version_stack';
    }
    res.json({ id: f.id, nome: f.name, pai: f.parent_id, projeto_id: f.project_id, tipo });
  }));

  r.post('/pastas/:id/subpastas', autenticar, envolve(async (req, res) => {
    const nome = limpaTexto((req.body || {}).nome, 255);
    if (!nome) throw falha(400, 'Dê um nome para a pasta.');
    const f = (await fio.api('POST', `/accounts/${fio.conta()}/folders/${encodeURIComponent(req.params.id)}/folders`,
                             { data: { name: nome } })).data;
    res.json({ pasta: item(Object.assign({ type: 'folder' }, f)) });
  }));

  // Arrastar um item para dentro de uma pasta.
  r.post('/mover', autenticar, envolve(async (req, res) => {
    const { id, tipo, destino } = req.body || {};
    const rota = { file: 'files', folder: 'folders', version_stack: 'version_stacks' }[tipo];
    if (!id || !rota || !destino) throw falha(400, 'Faltam o item, o tipo ou a pasta de destino.');
    if (id === destino) throw falha(400, 'Uma pasta não entra nela mesma.');
    await fio.api('PATCH', `/accounts/${fio.conta()}/${rota}/${encodeURIComponent(id)}/move`, { data: { parent_id: destino } });
    res.json({ ok: true });
  }));

  // Arrastar um vídeo para cima de outro: vira versão nova dele.
  r.post('/empilhar', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const { arquivo_id: novo, sobre_id: base, tipo_sobre: tipo } = req.body || {};
    if (!novo || !base || novo === base) throw falha(400, 'Escolha dois vídeos diferentes.');
    let pilha;
    if (tipo === 'version_stack') {
      await fio.api('PATCH', `/accounts/${conta}/files/${encodeURIComponent(novo)}/move`, { data: { parent_id: base } });
      pilha = base;
    } else {
      const orig = (await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(base)}`)).data;
      const p = await fio.api('POST', `/accounts/${conta}/folders/${orig.parent_id}/version_stacks`,
                              { data: { file_ids: [base, novo] } });
      pilha = p.data && p.data.id;
      if (pilha && D().responsaveis[base]) {
        D().responsaveis[pilha] = D().responsaveis[base];
        delete D().responsaveis[base];
        await loja.salvar();
      }
    }
    res.json({ pilha_id: pilha });
  }));

  // ── pilhas de versões: tirar e apagar versões ───────────────────────────────
  // Tirar da pilha = mover o vídeo para a pasta onde a pilha está.
  r.post('/pilhas/:id/tirar', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const arquivo = String((req.body || {}).arquivo_id || '');
    if (!arquivo) throw falha(400, 'Qual vídeo sai da pilha?');
    const pilha = (await fio.api('GET', `/accounts/${conta}/version_stacks/${encodeURIComponent(req.params.id)}`)).data;
    await fio.api('PATCH', `/accounts/${conta}/files/${encodeURIComponent(arquivo)}/move`, { data: { parent_id: pilha.parent_id } });
    res.json({ ok: true, pasta_id: pilha.parent_id });
  }));

  // Apagar um vídeo (ou versão) no Frame.io. Só admin — não tem volta pelo Framyo.
  r.delete('/arquivos/:id', autenticar, soAdmin, envolve(async (req, res) => {
    await fio.api('DELETE', `/accounts/${fio.conta()}/files/${encodeURIComponent(req.params.id)}`);
    res.json({ ok: true });
  }));

  // ── links de revisão (shares) ───────────────────────────────────────────────
  const link = (s) => ({
    id: s.id, nome: s.name || '', url: s.short_url || null, ativo: s.enabled !== false, acesso: s.access || 'public',
    senha: !!s.passphrase, expira_em: s.expiration || null, comentarios: s.commenting_enabled !== false,
    downloads: !!s.downloading_enabled, criado_em: s.created_at || null, visto_em: s.last_viewed_at || null,
    descricao: s.description || '',
  });
  // O que a tela manda → os campos do Frame.io (só os que vieram).
  function camposDoLink(b, criando) {
    const d = {};
    if (b.nome !== undefined) { const n = limpaTexto(b.nome, 175); if (!n) throw falha(400, 'Dê um nome para o link.'); d.name = n; }
    if (b.acesso !== undefined) { if (!['public', 'secure'].includes(b.acesso)) throw falha(400, 'Acesso inválido.'); d.access = b.acesso; }
    if (b.ativo !== undefined) d.enabled = !!b.ativo;
    if (b.comentarios !== undefined) d.commenting_enabled = !!b.comentarios;
    if (b.downloads !== undefined) d.downloading_enabled = !!b.downloads;
    if (b.senha !== undefined) d.passphrase = limpaTexto(b.senha, 255) || null;
    if (b.expira_em !== undefined) {
      if (b.expira_em && isNaN(Date.parse(b.expira_em))) throw falha(400, 'Data de expiração inválida.');
      d.expiration = b.expira_em ? new Date(b.expira_em).toISOString() : null;
    }
    if (b.descricao !== undefined) d.description = limpaTexto(b.descricao, 1000);
    if (criando) {
      if (!d.name) throw falha(400, 'Dê um nome para o link.');
      d.type = 'asset';
      d.access = d.access || 'public';
      const ids = Array.isArray(b.itens) ? b.itens.map(String).filter(Boolean).slice(0, 100) : [];
      if (ids.length) d.asset_ids = ids;
    }
    return d;
  }

  r.get('/projetos/:id/links', autenticar, envolve(async (req, res) => {
    const lista = await fio.tudo(`/accounts/${fio.conta()}/projects/${encodeURIComponent(req.params.id)}/shares`);
    res.json({ links: lista.map(link).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))) });
  }));

  r.get('/links/:id', autenticar, envolve(async (req, res) => {
    const conta = fio.conta(), id = encodeURIComponent(req.params.id);
    const [s, itens, revisores] = await Promise.all([
      fio.api('GET', `/accounts/${conta}/shares/${id}`).then((j) => j.data),
      fio.tudo(`/accounts/${conta}/shares/${id}/assets?include=media_links.thumbnail`).catch(() => []),
      fio.tudo(`/accounts/${conta}/shares/${id}/reviewers`).catch(() => []),
    ]);
    res.json({ link: link(s), itens: itens.map(item),
               revisores: revisores.map((u) => ({ id: u.id || null, nome: u.name || '', email: u.email })) });
  }));

  r.post('/projetos/:id/links', autenticar, envolve(async (req, res) => {
    const s = (await fio.api('POST', `/accounts/${fio.conta()}/projects/${encodeURIComponent(req.params.id)}/shares`,
                             { data: camposDoLink(req.body || {}, true) })).data;
    res.json({ link: link(s) });
  }));

  r.put('/links/:id', autenticar, envolve(async (req, res) => {
    const d = camposDoLink(req.body || {}, false);
    if (!Object.keys(d).length) throw falha(400, 'Nada para mudar.');
    const s = (await fio.api('PATCH', `/accounts/${fio.conta()}/shares/${encodeURIComponent(req.params.id)}`, { data: d })).data;
    res.json({ link: link(s) });
  }));

  r.delete('/links/:id', autenticar, envolve(async (req, res) => {
    await fio.api('DELETE', `/accounts/${fio.conta()}/shares/${encodeURIComponent(req.params.id)}`);
    res.json({ ok: true });
  }));

  r.post('/links/:id/itens', autenticar, envolve(async (req, res) => {
    const ids = [].concat((req.body || {}).itens || []).map(String).filter(Boolean).slice(0, 50);
    if (!ids.length) throw falha(400, 'Escolha o que entra no link.');
    for (const a of ids) {
      await fio.api('POST', `/accounts/${fio.conta()}/shares/${encodeURIComponent(req.params.id)}/assets`, { data: { asset_id: a } });
    }
    res.json({ ok: true, adicionados: ids.length });
  }));

  r.delete('/links/:id/itens/:item', autenticar, envolve(async (req, res) => {
    await fio.api('DELETE', `/accounts/${fio.conta()}/shares/${encodeURIComponent(req.params.id)}/assets/${encodeURIComponent(req.params.item)}`);
    res.json({ ok: true });
  }));

  const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  r.post('/links/:id/revisores', autenticar, envolve(async (req, res) => {
    const b = req.body || {};
    const emails = [].concat(b.emails || []).map((e) => limpaTexto(e, 200).toLowerCase()).filter(Boolean);
    if (!emails.length || emails.some((e) => !emailValido(e))) throw falha(400, 'Informe e-mails válidos.');
    await fio.api('POST', `/accounts/${fio.conta()}/shares/${encodeURIComponent(req.params.id)}/reviewers`, { data: {
      reviewers: { emails: emails.slice(0, 10) }, message: limpaTexto(b.mensagem, 1000) || 'Você foi convidado para revisar no Frame.io.',
      notify_by_email: b.avisar !== false } });
    res.json({ ok: true });
  }));

  r.delete('/links/:id/revisores', autenticar, envolve(async (req, res) => {
    const email = limpaTexto((req.body || {}).email, 200).toLowerCase();
    if (!emailValido(email)) throw falha(400, 'E-mail inválido.');
    await fio.api('DELETE', `/accounts/${fio.conta()}/shares/${encodeURIComponent(req.params.id)}/reviewers`,
                  { data: { reviewers: { emails: [email] } } });
    res.json({ ok: true });
  }));

  // ── envio de versões ────────────────────────────────────────────────────────
  // 1) o programa pede as URLs; 2) sobe as partes direto para o Frame.io;
  // 3) avisa que terminou, e aqui o arquivo vira nova versão (se for o caso).
  r.post('/envios', autenticar, envolve(async (req, res) => {
    const conta = fio.conta();
    const { pasta_id: pasta, nome, tamanho, tipo } = req.body || {};
    if (!pasta || !nome || !(Number(tamanho) > 0)) throw falha(400, 'Faltam pasta, nome ou tamanho do arquivo.');
    // O Frame.io não aceita media_type na criação ("Unexpected field"): deduz
    // pela extensão e devolve na resposta — e é ESSE o Content-Type que o PUT de
    // cada parte tem de mandar. O tipo que o programa calculou fica de reserva.
    const mediaType = /^[a-z]+\/[a-z0-9.+-]+$/i.test(String(tipo || '')) ? String(tipo) : undefined;
    const j = await fio.api('POST', `/accounts/${conta}/folders/${encodeURIComponent(pasta)}/files/local_upload`,
                            { data: { name: limpaTexto(nome, 255), file_size: Number(tamanho) } });
    res.json({ arquivo_id: j.data.id, media_type: j.data.media_type || mediaType || null,
               partes: (j.data.upload_urls || []).map((u) => ({ url: u.url, tamanho: u.size })) });
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
        // O vídeo virou pilha de versões: o responsável vai junto.
        if (resultado.pilha_id && D().responsaveis[base]) {
          D().responsaveis[resultado.pilha_id] = D().responsaveis[base];
          delete D().responsaveis[base];
          await loja.salvar();
        }
      }
    }
    const a = (await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(novo)}?include=project`)).data;
    resultado.view_url = a.view_url;
    // Feed do Início: quem subiu o quê, onde.
    D().envios.unshift({ id: crypto.randomBytes(6).toString('hex'), em: agora(), usuario_id: req.usuario.id, usuario: req.usuario.usuario,
      nome: req.usuario.nome, arquivo_id: novo, arquivo_nome: a.name || limpaTexto((req.body || {}).nome, 255), pilha_id: resultado.pilha_id || null, versao: !!base,
      projeto_id: a.project_id, projeto_nome: (a.project && a.project.name) || '', view_url: a.view_url });
    if (D().envios.length > 300) D().envios.length = 300;
    await loja.salvar().catch((e) => console.error('[framyo] feed:', e.message));
    res.json(resultado);
  }));

  // ── Início: últimos envios da equipe e últimos comentários ──────────────────
  // "Para quem" é o comentário, decidido na hora (o responsável pode ter sido
  // definido depois do comentário): o responsável do vídeo ou da pilha em que
  // ele está; sem responsável, quem tem o projeto atribuído.
  function paraQuem(e) {
    const r = responsavelDe(e.arquivo_id, e.pai_id);
    if (r) return [r.usuario];
    return D().usuarios.filter((x) => x.ativo !== false && (x.projetos || []).includes(e.projeto_id)).map((x) => x.usuario);
  }

  r.get('/feed', autenticar, envolve(async (req, res) => {
    const u = req.usuario;
    const restrito = !u.admin && (u.projetos || []).length;
    const ve = (x) => !restrito || u.projetos.includes(x.projeto_id);
    const n = Math.min(Number(req.query.n) || 40, 100);
    const comentarios = D().eventos.filter((e) => e.tipo === 'comentario' && ve(e)).slice(-n).reverse();
    // Avisos antigos não guardavam a pasta/pilha do vídeo: busca uma vez e guarda.
    const sem = comentarios.filter((e) => e.pai_id === undefined && e.arquivo_id);
    if (sem.length && D().frameio && D().frameio.refresh_token) {
      const conta = fio.conta();
      await Promise.all(sem.map(async (e) => {
        const a = await fio.api('GET', `/accounts/${conta}/files/${encodeURIComponent(e.arquivo_id)}`).catch(() => null);
        e.pai_id = (a && a.data && a.data.parent_id) || null;
      }));
      await loja.salvar().catch(() => {});
    }
    res.json({
      envios: D().envios.filter(ve).slice(0, n),
      comentarios: comentarios.map((e) => Object.assign({}, e, { para: paraQuem(e) })),
    });
  }));

  // ── atualização do programa ─────────────────────────────────────────────────
  // O admin publica o instalador novo pelo Framyo (Admin › Atualizações): ele
  // vai em partes de até 8 MB (o Cloudinary limita arquivos "raw" a 10 MB no
  // plano grátis) para o Cloudinary, e o servidor guarda o manifesto: versão,
  // tamanho, SHA-256 e as URLs das partes. Os programas perguntam aqui se há
  // versão nova, baixam as partes, juntam, conferem o SHA-256 e instalam por
  // cima. Só a última versão fica na nuvem: ao publicar, a anterior é apagada.
  const PARTE_MAX = 9 * 1024 * 1024;
  const versaoValida = (v) => /^\d{1,3}(\.\d{1,3}){1,3}$/.test(String(v || ''));
  const partesLocais = new Map();                // só testes (sem Cloudinary): versão -> [Buffer]
  const nuvem = () => (process.env.FRAMYO_TESTE_NUVEM ? nuvemDeTeste : process.env.CLOUDINARY_URL ? require('cloudinary').v2 : null);
  const pastaNuvem = (v) => `framyo/atualizacoes/${v}`;
  // O Cloudinary olha o conteúdo e recusa executáveis ("extension bin are not
  // allowed"), qualquer que seja o nome. As partes vão embaralhadas (XOR com uma
  // chave fixa) e este servidor desembaralha no download (/atualizacao/baixar).
  const CHAVE_PARTE = crypto.createHash('sha256').update('framyo-atualizacao').digest();
  const embaralhar = (buf, inicio = 0) => {
    const saida = Buffer.allocUnsafe(buf.length);
    for (let i = 0; i < buf.length; i++) saida[i] = buf[i] ^ CHAVE_PARTE[(inicio + i) % CHAVE_PARTE.length];
    return saida;
  };
  // Só nos testes: um "Cloudinary" na memória que recusa executáveis como o real.
  const guardadosTeste = new Map();
  const nuvemDeTeste = {
    uploader: { upload_stream: (op, cb) => ({ end: (buf) => {
      if (buf[0] === 0x4d && buf[1] === 0x5a) return cb(new Error('resources with extension bin are not allowed'));
      guardadosTeste.set(op.public_id, buf);
      cb(null, { secure_url: `${process.env.FRAMYO_TESTE_NUVEM}/${encodeURIComponent(op.public_id)}` });
    } }) },
    api: { delete_resources_by_prefix: async (prefixo) => { for (const k of [...guardadosTeste.keys()]) if (k.startsWith(prefixo)) guardadosTeste.delete(k); } },
  };
  if (process.env.FRAMYO_TESTE_NUVEM) {
    r.get('/atualizacao/teste-nuvem/:id', (req, res) => {
      const b = guardadosTeste.get(req.params.id);
      return b ? res.type('application/octet-stream').send(b) : res.status(404).json({ erro: 'não existe' });
    });
  }

  // O construir.py publica sozinho com a chave de publicação (variável
  // FRAMYO_CHAVE_PUBLICAR no Render = arquivo publicar.chave na pasta do Framyo).
  // Sem a chave, só um admin logado publica.
  function publicador(req, res, next) {
    const chave = String(req.headers['x-framyo-chave-publicar'] || '');
    // Só a impressão (SHA-256) da chave fica aqui: ela não publica nada e não
    // revela a chave, que mora só em publicar.chave no computador do build.
    // FRAMYO_CHAVE_PUBLICAR no Render, se existir, troca a chave sem mexer no código.
    const certa = process.env.FRAMYO_CHAVE_PUBLICAR
      ? crypto.createHash('sha256').update(process.env.FRAMYO_CHAVE_PUBLICAR).digest('hex') : IMPRESSAO_CHAVE_PUBLICAR;
    if (chave) {
      const a = crypto.createHash('sha256').update(chave).digest(), b = Buffer.from(certa, 'hex');
      if (chave.length >= 32 && b.length === 32 && crypto.timingSafeEqual(a, b)) {
        req.usuario = { id: 'construir', usuario: 'construir', admin: true };
        return next();
      }
      return res.status(401).json({ erro: 'Chave de publicação inválida (confira FRAMYO_CHAVE_PUBLICAR no Render).' });
    }
    autenticar(req, res, () => soAdmin(req, res, next));
  }
  const leitorDaVersao = (req, res, next) => (req.headers['x-framyo-chave-publicar'] ? publicador(req, res, next) : autenticar(req, res, next));

  r.get('/atualizacao', leitorDaVersao, (req, res) => {
    const a = D().atualizacao;
    res.json(a ? { versao: a.versao, nome: a.nome, tamanho: a.tamanho, sha256: a.sha256, notas: a.notas || '',
                   publicado_em: a.publicado_em, partes: a.partes.map((p, i) => ({ url: p.embaralhada ? `${URL_PUBLICA}/api/framyo/atualizacao/baixar/${a.versao}/${i}` : p.url,
                                                   tamanho: p.tamanho })) } : { versao: null });
  });

  // Download de uma parte da nuvem, já desembaralhada. Sem login: o instalador
  // não tem segredo, e quem baixa (bandeja) confere o SHA-256 no fim.
  r.get('/atualizacao/baixar/:versao/:n', async (req, res) => {
    const a = D().atualizacao;
    const p = a && a.versao === req.params.versao && a.partes[Number(req.params.n)];
    if (!p || !p.embaralhada) return res.status(404).json({ erro: 'Parte não existe.' });
    try {
      const r2 = await fetch(p.url);
      if (!r2.ok) return res.status(502).json({ erro: 'A nuvem não entregou a parte.' });
      res.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(p.tamanho), 'Cache-Control': 'no-store' });
      let pos = 0;
      for await (const pedaco of r2.body) {
        const b = Buffer.from(pedaco);
        res.write(embaralhar(b, pos));
        pos += b.length;
      }
      res.end();
    } catch (e) {
      console.error('[framyo] baixar parte:', e.message);
      if (!res.headersSent) res.status(502).json({ erro: 'Falha ao baixar a parte.' }); else res.destroy();
    }
  });

  r.post('/atualizacao/partes/:versao/:n', publicador, express.raw({ type: 'application/octet-stream', limit: PARTE_MAX + 1024 }),
    envolve(async (req, res) => {
      const { versao } = req.params, n = Number(req.params.n);
      if (!versaoValida(versao) || !Number.isInteger(n) || n < 0 || n > 60) throw falha(400, 'Versão ou parte inválida.');
      const dados = req.body;
      if (!Buffer.isBuffer(dados) || !dados.length) throw falha(400, 'Parte vazia.');
      if (dados.length > PARTE_MAX) throw falha(413, 'Parte grande demais (máx. 9 MB).');
      const c = nuvem();
      let url;
      if (c) {
        // O Cloudinary recusa extensões de executável (.bin, .exe…): a parte vai
        // sem extensão e, se a conta também recusar, como .txt. O conteúdo é
        // conferido pelo SHA-256 no download, a extensão não importa.
        const embaralhada = embaralhar(dados);
        const subir = (ext) => new Promise((ok, erro) => {
          c.uploader.upload_stream({ resource_type: 'raw', public_id: `${pastaNuvem(versao)}/parte-${String(n).padStart(2, '0')}${ext}`,
                                     overwrite: true, invalidate: true }, (e, x) => (e ? erro(e) : ok(x))).end(embaralhada);
        });
        let r2, ultimoErro;
        for (const ext of ['', '.txt']) {
          try { r2 = await subir(ext); break; } catch (e) { ultimoErro = e; }
        }
        if (!r2) throw falha(502, 'O Cloudinary recusou a parte: ' + (ultimoErro && ultimoErro.message));
        url = r2.secure_url;
      } else {
        const lista = partesLocais.get(versao) || [];
        lista[n] = dados;
        partesLocais.set(versao, lista);
        url = `${URL_PUBLICA}/api/framyo/atualizacao/local/${versao}/${n}`;
      }
      const pend = D().atualizacao_envio && D().atualizacao_envio.versao === versao ? D().atualizacao_envio : { versao, partes: [] };
      pend.partes[n] = { url, tamanho: dados.length, sha256: crypto.createHash('sha256').update(dados).digest('hex'), embaralhada: !!c };
      D().atualizacao_envio = pend;
      await loja.salvar();
      res.json({ ok: true, n, url });
    }));

  // só nos testes (sem Cloudinary): serve a parte guardada na memória
  r.get('/atualizacao/local/:versao/:n', (req, res) => {
    if (process.env.CLOUDINARY_URL) return res.status(404).json({ erro: 'Rota do Framyo não existe.' });
    const p = (partesLocais.get(req.params.versao) || [])[Number(req.params.n)];
    if (!p) return res.status(404).json({ erro: 'Parte não existe.' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(p);
  });

  r.post('/atualizacao/publicar', publicador, envolve(async (req, res) => {
    const b = req.body || {};
    const versao = String(b.versao || '');
    if (!versaoValida(versao)) throw falha(400, 'Versão inválida (ex.: 1.5.0).');
    const pend = D().atualizacao_envio;
    if (!pend || pend.versao !== versao) throw falha(409, 'Envie as partes do instalador antes de publicar.');
    const qtd = Number(b.partes);
    const partes = pend.partes.slice(0, qtd);
    if (!qtd || partes.length !== qtd || partes.some((p) => !p)) throw falha(409, 'Faltam partes do instalador. Envie de novo.');
    const tamanho = partes.reduce((s, p) => s + p.tamanho, 0);
    if (Number(b.tamanho) !== tamanho) throw falha(409, `O tamanho não bate (${tamanho} x ${b.tamanho}). Envie de novo.`);
    if (!/^[0-9a-f]{64}$/.test(String(b.sha256 || ''))) throw falha(400, 'SHA-256 inválido.');
    const anterior = D().atualizacao;
    D().atualizacao = { versao, nome: limpaTexto(b.nome, 120) || `Framyo Setup ${versao}.exe`, tamanho, sha256: b.sha256,
                        notas: limpaTexto(b.notas, 2000), partes, publicado_em: agora(), por: req.usuario.id };
    delete D().atualizacao_envio;
    await loja.salvar();
    // só a última versão fica na nuvem
    const c = nuvem();
    if (c && anterior && anterior.versao !== versao) {
      await c.api.delete_resources_by_prefix(pastaNuvem(anterior.versao) + '/', { resource_type: 'raw' })
        .catch((e) => console.error('[framyo] apagar versão antiga:', e.message));
    }
    res.json({ ok: true, versao, tamanho, partes: qtd });
  }));

  // ── calendário de posts (Google Drive) ──────────────────────────────────────
  const { google } = montarPosts({ r, loja, autenticar, soAdmin, envolve, falha, pessoa, pagina, agora, limpaTexto, urlPublica: URL_PUBLICA });

  // ── chat privado entre os usuários (arquivos no mesmo Google Drive) ─────────
  chatApi = montarChat({ r, loja, autenticar, envolve, falha, pessoa, agora, limpaTexto, google });

  r.use((req, res) => res.status(404).json({ erro: 'Rota do Framyo não existe.' }));
  r.use((err, req, res, next) => {        // JSON quebrado e afins: fica aqui dentro
    res.status(err.status || 400).json({ erro: err.type === 'entity.parse.failed' ? 'JSON inválido.' : err.status === 503 ? err.message : 'Pedido inválido.' });
  });

  r.loja = loja;                          // para testes
  return r;
}

module.exports = { roteador };
