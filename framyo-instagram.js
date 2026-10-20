'use strict';
const crypto = require('node:crypto');
const AUTH = process.env.FRAMYO_TESTE_INSTAGRAM_AUTH || 'https://www.instagram.com/oauth/authorize';
const TOKEN = process.env.FRAMYO_TESTE_INSTAGRAM_TOKEN || 'https://api.instagram.com/oauth/access_token';
const GRAPH = process.env.FRAMYO_TESTE_INSTAGRAM_GRAPH || 'https://graph.instagram.com';
const SCOPE = 'instagram_business_basic,instagram_business_content_publish';
const erro = (status, message) => Object.assign(new Error(message), { status });

function montarInstagram({ r, loja, autenticar, soAdmin, envolve, pagina, urlPublica }) {
  const I = () => loja.dados.instagram || (loja.dados.instagram = {});
  const credenciais = () => ({ client_id: process.env.INSTAGRAM_CLIENT_ID || '', client_secret: process.env.INSTAGRAM_CLIENT_SECRET || '' });
  const retorno = urlPublica + '/api/framyo/instagram/callback';
  function chave() {
    const k = process.env.FRAMYO_INSTAGRAM_CHAVE || '';
    if (!/^[0-9a-f]{64}$/i.test(k)) throw erro(409, 'Configure FRAMYO_INSTAGRAM_CHAVE no servidor antes de conectar a conta.');
    return Buffer.from(k, 'hex');
  }
  function selar(valor) {
    const iv = crypto.randomBytes(12), cifra = crypto.createCipheriv('aes-256-gcm', chave(), iv);
    const dados = Buffer.concat([cifra.update(JSON.stringify(valor), 'utf8'), cifra.final()]);
    return { v: 1, iv: iv.toString('base64'), tag: cifra.getAuthTag().toString('base64'), dados: dados.toString('base64') };
  }
  function abrir(pacote) {
    if (!pacote) return null;
    const dec = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(pacote.iv, 'base64'));
    dec.setAuthTag(Buffer.from(pacote.tag, 'base64'));
    return JSON.parse(Buffer.concat([dec.update(Buffer.from(pacote.dados, 'base64')), dec.final()]).toString('utf8'));
  }
  function estado() {
    const c = credenciais(), i = I(); let conectado = false;
    try { conectado = !!abrir(i.auth)?.access_token; } catch { conectado = false; }
    return { configurado: !!(c.client_id && c.client_secret && process.env.FRAMYO_INSTAGRAM_CHAVE), conectado,
      conta: conectado && i.conta ? { id: i.conta.id, usuario: i.conta.usuario } : null, retorno };
  }
  r.get('/instagram', autenticar, (req, res) => res.json(estado()));
  r.post('/instagram/iniciar', autenticar, soAdmin, envolve(async (req, res) => {
    const c = credenciais(); chave();
    if (!c.client_id || !c.client_secret) throw erro(409, 'Configure INSTAGRAM_CLIENT_ID e INSTAGRAM_CLIENT_SECRET no servidor.');
    const state = 'ig' + crypto.randomBytes(24).toString('hex');
    loja.dados.oauth_estados[state] = { instagram: true, criado_em: new Date().toISOString(), por: req.usuario.id };
    await loja.salvar();
    res.json({ url: AUTH + '?' + new URLSearchParams({ client_id: c.client_id, redirect_uri: retorno,
      response_type: 'code', scope: SCOPE, state, enable_fb_login: '0', force_authentication: '1' }) });
  }));
  r.get('/instagram/callback', envolve(async (req, res) => {
    const { state, code, error } = req.query, pend = loja.dados.oauth_estados[state];
    if (!pend?.instagram || Date.parse(pend.criado_em) < Date.now() - 600000 || !loja.dados.usuarios.some(u => u.id === pend.por && u.admin && u.ativo !== false))
      return res.status(400).send(pagina('Link expirado', 'Volte ao FramePlus e conecte o Instagram novamente.'));
    delete loja.dados.oauth_estados[state]; await loja.salvar();
    if (error || !code) return res.status(400).send(pagina('Instagram não conectado', 'A autorização foi cancelada.'));
    const c = credenciais();
    const tr = await fetch(TOKEN, { method: 'POST', signal: AbortSignal.timeout(20000), body: new URLSearchParams({ client_id: c.client_id,
      client_secret: c.client_secret, grant_type: 'authorization_code', redirect_uri: retorno, code: String(code) }) });
    const curto = await tr.json().catch(() => ({}));
    if (!tr.ok || !curto.access_token) throw erro(502, 'A Meta recusou a autorização do Instagram.');
    const lr = await fetch(GRAPH + '/access_token?' + new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: c.client_secret,
      access_token: curto.access_token }), { signal: AbortSignal.timeout(20000) });
    const longo = await lr.json().catch(() => ({})), token = longo.access_token || curto.access_token;
    const pr = await fetch(GRAPH + '/me?' + new URLSearchParams({ fields: 'id,username', access_token: token }), { signal: AbortSignal.timeout(20000) });
    const perfil = await pr.json().catch(() => ({}));
    if (!pr.ok || !perfil.id) throw erro(502, 'Não foi possível confirmar a conta profissional do Instagram.');
    I().auth = selar({ access_token: token, expira_em: Date.now() + Number(longo.expires_in || 3600) * 1000 });
    I().conta = { id: String(perfil.id), usuario: String(perfil.username || '') };
    I().conectado_por = pend.por; I().conectado_em = new Date().toISOString(); await loja.salvar();
    res.send(pagina('Instagram conectado', `A conta @${I().conta.usuario || 'Instagram'} já está disponível para a equipe no FramePlus.`));
  }));
  r.post('/instagram/desconectar', autenticar, soAdmin, envolve(async (req, res) => {
    delete I().auth; delete I().conta; I().desconectado_em = new Date().toISOString(); await loja.salvar(); res.json({ ok: true });
  }));
  return { estado };
}
module.exports = { montarInstagram };
