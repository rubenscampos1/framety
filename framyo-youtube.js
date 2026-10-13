// Espelho de aprovação: metadados no servidor, bytes entre desktop e provedores.
// Estado durável na loja exclusiva do Framyo. Nunca procurar/deletar por título.
'use strict';
const crypto = require('node:crypto');
const API = process.env.FRAMYO_TESTE_YOUTUBE_API || 'https://www.googleapis.com/youtube/v3';
const UPLOAD = process.env.FRAMYO_TESTE_YOUTUBE_UPLOAD || 'https://www.googleapis.com/upload/youtube/v3/videos';
const OAUTH = process.env.FRAMYO_TESTE_GOOGLE_OAUTH || 'https://oauth2.googleapis.com';
const AUTH = process.env.FRAMYO_TESTE_GOOGLE_AUTORIZAR || 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const EVENTS = ['file.ready', 'file.upload.completed', 'file.versioned', 'file.updated'];
const titulo = (nome, versao) => Array.from(`(em aprovação - V${versao}) ${String(nome || 'Vídeo').replace(/[<>]/g, '').trim()}`).slice(0, 100).join('');
const erro = (status, message) => Object.assign(new Error(message), { status });
const enc = encodeURIComponent;

function criarYoutube({ loja, fio }) {
  const D = () => loja.dados;
  const Y = () => D().youtube || (D().youtube = { registros: {}, aliases: {}, entrada: {}, ativo: false });
  let fila = Promise.resolve();
  const exclusivo = (fn) => { const p = fila.then(fn); fila = p.catch(() => {}); return p; };
  const credenciais = () => ({ client_id: process.env.YOUTUBE_CLIENT_ID || Y().client_id || process.env.GOOGLE_CLIENT_ID || D().google?.client_id,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET || Y().client_secret || process.env.GOOGLE_CLIENT_SECRET || D().google?.client_secret });
  const auth = () => Y().auth || {};
  async function trocar(params) {
    const r = await fetch(OAUTH + '/token', { method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...credenciais(), ...params }) });
    const j = await r.json();
    if (!r.ok || !j.access_token) throw erro(502, 'O Google recusou a autorização do YouTube. Reconecte o canal.');
    return j;
  }
  async function token() {
    if (!auth().refresh_token) throw erro(409, 'Conecte o canal em Admin › YouTube.');
    if (auth().access_token && auth().expira_em > Date.now() + 120000) return auth().access_token;
    const j = await trocar({ grant_type: 'refresh_token', refresh_token: auth().refresh_token });
    Object.assign(Y().auth, { access_token: j.access_token, expira_em: Date.now() + (j.expires_in || 3600) * 1000 });
    await loja.salvar();
    return j.access_token;
  }
  async function api(method, path, body) {
    const r = await fetch(API + path, { method, signal: AbortSignal.timeout(25000),
      headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) { if (r.status === 401) Y().auth.expira_em = 0; throw erro(r.status === 404 ? 404 : 502,
      'YouTube: ' + (j.error?.message || `resposta ${r.status}`)); }
    return j;
  }
  const chave = (id) => `${fio.conta()}:${id}`;
  const permitido = (u, p) => !!u && (u.admin || (!u.marketing && (!(u.projetos || []).length || u.projetos.includes(p))));
  function estado() {
    const y = Y(), c = credenciais();
    return { conectado: !!auth().refresh_token, credencial: !!(c.client_id && c.client_secret), ativo: !!y.ativo,
      canal: y.canal ? { id: y.canal.id, nome: y.canal.nome } : null, ultimo_trabalhador: y.ultimo_trabalhador || null,
      erros_entrada: Object.values(y.entrada).filter(e => e.erro).map(e => ({ arquivo: e.arquivo, erro: e.erro })),
      pendentes: Object.keys(y.entrada).length + Object.values(y.registros).filter(r => r.pendente || r.upload || r.anteriores.length).length,
      registros: Object.values(y.registros).map(r => ({ id: r.id, nome: r.desejado?.nome, versao: r.desejado?.versao,
        url: r.atual ? `https://youtu.be/${r.atual.id}` : null, sincronizado: !!r.atual?.processado && r.atual.arquivo === r.desejado?.arquivo && r.atual.titulo === titulo(r.desejado.nome, r.desejado.versao),
        erro: r.erro || null, limpeza_pendente: r.anteriores.length, enviando: !!r.upload, projeto: r.projeto })) };
  }
  async function enfileirar(id) {
    return exclusivo(async () => {
      if (!Y().ativo || !id) return;
      Y().entrada[chave(id)] = { arquivo: String(id), conta: fio.conta(), em: Date.now(), tentar_em: Date.now() + 3000 };
      await loja.salvar();
    });
  }
  async function descrever(id) {
    const prefix = `/accounts/${enc(fio.conta())}`;
    let f = (await fio.api('GET', `${prefix}/files/${enc(id)}?include=media_links.original`)).data;
    if (!f || !(/^video\//.test(f.media_type || '') || /\.(mp4|mov|mxf|m4v|avi|mkv|webm)$/i.test(f.name || ''))) return null;
    let stack = null, filhos = [f];
    if (f.parent_id) {
      try { stack = (await fio.api('GET', `${prefix}/version_stacks/${enc(f.parent_id)}`)).data; }
      catch (e) { if (e.status !== 404) throw e; }
    }
    if (stack) {
      filhos = (await fio.tudo(`${prefix}/version_stacks/${enc(stack.id)}/children`)).filter(x => x.type === 'file')
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      const head = stack.head_version?.id;
      if (!head || !filhos.some(x => x.id === head)) throw erro(409, 'Aguardando a pilha do Frame.io estabilizar.');
      if (f.id !== head) f = (await fio.api('GET', `${prefix}/files/${enc(head)}?include=media_links.original`)).data;
    }
    const numero = filhos.findIndex(x => x.id === f.id) + 1;
    if (!numero) throw erro(409, 'Versão ainda ausente da pilha.');
    return { arquivo: f.id, entidade: stack?.id || f.id, conta: fio.conta(), projeto: f.project_id,
      nome: f.name, pilha: stack?.id || null, versao: numero, tamanho: Number(f.file_size), tipo: f.media_type || 'application/octet-stream',
      fonte: f.media_links?.original?.download_url || f.media_links?.original?.url || f.media_links?.original?.inline_url,
      aliases: [stack?.id, ...filhos.map(x => x.id)].filter(Boolean) };
  }
  async function registrar(id) {
    const d = await descrever(id);
    if (!d) return null;
    const y = Y(), ids = [...new Set(d.aliases.map(a => y.aliases[chave(a)]).filter(Boolean))]
      .filter(id => !y.registros[id].desejado?.pilha || y.registros[id].desejado.pilha === d.pilha);
    // A entidade do stack tem precedência; arquivos avulsos migrados viram aliases.
    let r = ids.includes(y.aliases[chave(d.entidade)]) ? y.registros[y.aliases[chave(d.entidade)]] : y.registros[ids[0]];
    if (!r) { r = { id: crypto.randomUUID(), conta: d.conta, anteriores: [] }; y.registros[r.id] = r; }
    if (ids.filter(x => x !== r.id).some(id => y.registros[id].upload || r.upload))
      throw erro(409, 'Aguardando o envio anterior antes de reunir as versões.');
    for (const rid of ids.filter(x => x !== r.id)) {
      const outro = y.registros[rid];
      // Não fundir uma sessão em trânsito: retomá-la antes evita órfãos/duplicatas.
      if (outro.upload || r.upload) throw erro(409, 'Aguardando o envio anterior antes de reunir as versões.');
      if (outro.atual) r.anteriores.push(outro.atual);
      r.anteriores.push(...outro.anteriores);
      for (const [a, v] of Object.entries(y.aliases)) if (v === rid) y.aliases[a] = r.id;
      delete y.registros[rid];
    }
    for (const a of d.aliases) y.aliases[chave(a)] = r.id;
    const { fonte, aliases, ...persistente } = d; // links de origem temporários nunca persistidos
    r.pendente = r.pendente || !r.desejado || JSON.stringify(r.desejado) !== JSON.stringify(persistente);
    r.desejado = persistente; r.projeto = d.projeto;
    await loja.salvar();
    return { r, d };
  }
  const marca = (r) => `framyo:${r.id}`;
  async function video(id) { return (await api('GET', `/videos?part=snippet,status,processingDetails&id=${enc(id)}`)).items?.[0]; }
  function conferir(v, ref) {
    if (!v || v.id !== ref.id || v.snippet?.channelId !== ref.canal || !v.snippet?.tags?.includes(ref.marca)
        || !v.snippet.tags.includes(ref.trabalho)) throw erro(409, 'Vínculo do vídeo não confere. Exclusão bloqueada para revisão.');
  }
  function pronto(v) { return v.status?.privacyStatus === 'unlisted' && (v.processingDetails?.processingStatus === 'succeeded' || v.status?.uploadStatus === 'processed'); }
  async function limpar(r) {
    if (!r.atual || r.atual.arquivo !== r.desejado.arquivo) return;
    const v = await video(r.atual.id); conferir(v, r.atual);
    if (!pronto(v)) {
      if (['failed','rejected','deleted'].includes(v.status?.uploadStatus) || ['failed','terminated'].includes(v.processingDetails?.processingStatus))
        throw erro(409, 'A nova cópia falhou no processamento do YouTube. A anterior foi preservada.');
      return;
    }
    r.atual.processado = true;
    await loja.salvar();
    for (const anterior of [...r.anteriores]) {
      if (anterior.id === r.atual.id) throw erro(409, 'O vídeo atual não pode ser apagado.');
      if (anterior.canal !== Y().canal.id) throw erro(409, 'O vídeo anterior pertence a outro canal.');
      const old = await video(anterior.id);
      if (old) { conferir(old, anterior); await api('DELETE', `/videos?id=${enc(anterior.id)}`); }
      r.anteriores = r.anteriores.filter(x => x.id !== anterior.id);
      await loja.salvar();
    }
  }
  async function renomear(r) {
    if (!r.atual || r.atual.arquivo !== r.desejado.arquivo) return;
    const nome = titulo(r.desejado.nome, r.desejado.versao);
    if (r.atual.titulo === nome) return;
    const v = await video(r.atual.id); conferir(v, r.atual);
    const snippet = Object.fromEntries(['title','description','tags','categoryId','defaultLanguage']
      .filter(k => v.snippet[k] !== undefined).map(k => [k, v.snippet[k]]));
    snippet.title = nome;
    await api('PUT', '/videos?part=snippet', { id: v.id, snippet });
    r.atual.titulo = nome;
    await loja.salvar();
  }
  function sessaoValida(url) {
    const u = new URL(url);
    const teste = process.env.FRAMYO_TESTE_YOUTUBE_UPLOAD;
    return teste ? u.origin === new URL(teste).origin : u.protocol === 'https:' && (u.hostname === 'www.googleapis.com' || u.hostname.endsWith('.googleapis.com'));
  }
  async function situacao(up) {
    if (!sessaoValida(up.sessao)) throw erro(409, 'Endereço da sessão inválido.');
    const r = await fetch(up.sessao, { method: 'PUT', redirect: 'manual', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Length': '0', 'Content-Range': `bytes */${up.tamanho}` } });
    if (r.status === 308) return { offset: Number(/-(\d+)$/.exec(r.headers.get('range') || '')?.[1] ?? -1) + 1 };
    if (r.ok) { const j = await r.json(); if (j.id) return { id: j.id }; }
    // Não criar outra sessão às cegas: a última parte pode ter sido recebida.
    throw erro(409, 'Não foi possível confirmar a sessão do YouTube. Use “Recuperar envio” antes de reenviar.');
  }
  async function concluir(r, up, id) {
    const ref = { id, arquivo: up.arquivo, canal: up.canal, marca: marca(r), trabalho: `framyo-job:${up.id}`, titulo: up.titulo };
    const v = await video(id); conferir(v, ref);
    if (v.status?.privacyStatus !== 'unlisted') throw erro(409, 'O YouTube não confirmou a visibilidade não listada. A cópia anterior foi preservada.');
    // Nunca aceitar id arbitrário do desktop. Ele vem da sessão/playlist autenticada.
    if (r.atual && r.atual.id !== id) r.anteriores.push(r.atual);
    r.atual = ref; delete r.upload; delete r.erro;
    await loja.salvar(); // commit da nova referência ANTES de qualquer DELETE
    await renomear(r); await limpar(r);
  }
  async function recuperar(r) {
    const up = r.upload;
    if (!up) {
      if (r.atual) {
        const v = await video(r.atual.id);
        if (v) conferir(v, r.atual);
        if (!v || ['failed','rejected','deleted'].includes(v.status?.uploadStatus) || ['failed','terminated'].includes(v.processingDetails?.processingStatus)) {
          r.anteriores.push(r.atual); r.atual = null; r.pendente = true;
          await loja.salvar();
        }
      }
      return;
    }
    if (up.sessao) {
      try {
        const st = await situacao(up);
        if (st.id) return concluir(r, up, st.id);
        delete up.lease; r.tentar_em = 0; await loja.salvar(); return;
      } catch { /* sessão perdida: procurar SOMENTE pelos marcadores persistidos */ }
    }
    let page = '', achado = null;
    for (let n = 0; n < 20; n++) {
      const list = await api('GET', `/playlistItems?part=contentDetails&maxResults=50&playlistId=${enc(Y().canal.uploads)}&pageToken=${enc(page)}`);
      const ids = (list.items || []).map(x => x.contentDetails?.videoId).filter(Boolean);
      const videos = ids.length ? (await api('GET', `/videos?part=snippet,status,processingDetails&id=${enc(ids.join(','))}`)).items || [] : [];
      const matches = videos.filter(v => v.snippet?.tags?.includes(`framyo-job:${up.id}`));
      if (matches.length > 1 || achado && matches.length) throw erro(409, 'Mais de uma cópia foi encontrada. Revisão manual necessária.');
      if (matches.length) achado = matches[0];
      page = list.nextPageToken;
      if (!page) { if (achado) return concluir(r, up, achado.id); throw erro(409, 'Nenhuma cópia confirmada no canal. Envio suspenso para evitar duplicação; revise a sessão antes de reenviar.'); }
    }
    throw erro(409, 'Recuperação parcial do canal. Nenhum novo envio foi iniciado; revise o canal.');
  }
  async function trabalhar(u) {
    return exclusivo(async () => {
      const y = Y();
      if (!y.ativo || !auth().refresh_token || !permitido(u, null) && !(u.projetos || []).length) return {};
      if (u.marketing && !u.admin) throw erro(403, 'Marketing não pode sincronizar vídeos.');
      y.ultimo_trabalhador = new Date().toISOString();
      for (const [key, e] of Object.entries(y.entrada).filter(([, e]) => e.conta === fio.conta() && e.tentar_em <= Date.now()).slice(0, 3)) {
        if (e.conta !== fio.conta() || e.tentar_em > Date.now()) continue;
        try { await registrar(e.arquivo); delete y.entrada[key]; }
        catch (ex) { e.erro = ex.message; e.tentar_em = Date.now() + 60000; }
        await loja.salvar();
      }
      let verificados = 0;
      for (const r of Object.values(y.registros)) {
        if (r.conta !== fio.conta() || !permitido(u, r.projeto) || r.tentar_em > Date.now() || (!r.pendente && !r.upload && !r.anteriores.length)) continue;
        if (++verificados > 4) break;
        try {
          if (r.upload?.lease && r.upload.lease.ate > Date.now()) continue;
          // Atualiza a origem antes de retomar, inclusive renomeações feitas no site.
          const item = await registrar(r.desejado.arquivo);
          if (!item) continue;
          const d = item.d;
          if (r.atual?.arquivo === d.arquivo && !r.upload) {
            await renomear(r); await limpar(r); delete r.erro; r.pendente = !!r.anteriores.length; await loja.salvar(); r.tentar_em = Date.now() + 60000; continue;
          }
          if (r.upload?.sessao) {
            const st = await situacao(r.upload);
            if (st.id) { await concluir(r, r.upload, st.id); continue; }
          }
          if (!r.upload) {
            if (!d.fonte || !(d.tamanho > 0)) throw erro(409, 'Aguardando original disponível no Frame.io.');
            r.upload = { id: crypto.randomUUID(), arquivo: d.arquivo, tamanho: d.tamanho, tipo: d.tipo,
              titulo: titulo(d.nome, d.versao), canal: y.canal.id };
            await loja.salvar();
          }
          const up = r.upload;
          if (!up.sessao) {
            const resp = await fetch(UPLOAD + '?uploadType=resumable&part=snippet,status&notifySubscribers=false', {
              method: 'POST', signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${await token()}`,
                'Content-Type': 'application/json', 'X-Upload-Content-Length': String(up.tamanho), 'X-Upload-Content-Type': up.tipo },
              body: JSON.stringify({ snippet: { title: up.titulo, categoryId: '22', tags: [marca(r), `framyo-job:${up.id}`] },
                status: { privacyStatus: 'unlisted' } }) });
            if (!resp.ok || !resp.headers.get('location')) throw erro(502, 'YouTube não iniciou o envio. Confira o canal e a quota.');
            up.sessao = resp.headers.get('location');
            if (!sessaoValida(up.sessao)) throw erro(502, 'YouTube devolveu uma sessão inválida.');
            await loja.salvar();
          }
          const st = await situacao(up);
          if (st.id) { await concluir(r, up, st.id); continue; }
          // A versão em trânsito pode já ser antiga: sua fonte deve ser a original.
          const source = up.arquivo === d.arquivo ? d : await descreverArquivo(up.arquivo);
          if (!source.fonte) throw erro(409, 'Original ainda indisponível para retomada.');
          up.lease = { id: crypto.randomUUID(), usuario: u.id, ate: Date.now() + 600000 };
          delete r.erro;
          await loja.salvar();
          return { tarefa: { registro: r.id, trabalho: up.id, lease: up.lease.id, sessao: up.sessao, fonte: source.fonte,
            tamanho: up.tamanho, tipo: up.tipo, offset: st.offset } };
        } catch (ex) { r.erro = ex.message; r.tentar_em = Date.now() + 60000; await loja.salvar(); }
      }
      return {};
    });
  }
  async function descreverArquivo(id) {
    const f = (await fio.api('GET', `/accounts/${enc(fio.conta())}/files/${enc(id)}?include=media_links.original`)).data;
    const ml = f?.media_links?.original;
    return { fonte: ml?.download_url || ml?.url || ml?.inline_url };
  }
  function exigirLease(u, rid, body) {
    if (!Y().ativo || !auth().refresh_token) throw erro(409, 'A sincronização foi pausada.');
    const r = Y().registros[rid], up = r?.upload;
    if (!r || !permitido(u, r.projeto) || !up || up.id !== body.trabalho || up.lease?.id !== body.lease || up.lease.usuario !== u.id || up.lease.ate < Date.now())
      throw erro(409, 'Este envio foi retomado por outro Framyo.');
    return { r, up };
  }
  async function atualizarLease(u, rid, body) {
    return exclusivo(async () => {
      const { r, up } = exigirLease(u, rid, body);
      up.lease.ate = Date.now() + 600000;
      if (body.concluir) {
        const st = await situacao(up);
        if (!st.id) throw erro(409, 'O YouTube ainda não confirmou todos os bytes.');
        await concluir(r, up, st.id);
      } else if (body.erro) { r.erro = 'Transferência interrompida. O Framyo tentará retomar.'; delete up.lease; r.tentar_em = Date.now() + 30000; }
      await loja.salvar();
      return { ok: true };
    });
  }
  return { Y, auth, estado, exclusivo, credenciais, trocar, api, enfileirar, trabalhar, atualizarLease, recuperar, registrar,
    async mudou(id) {
      await enfileirar(id);
      if (!Y().ativo || !auth().refresh_token) return;
      // O rename no Framyo tenta refletir o nome já nesta requisição.
      // Uma falha externa permanece na fila e nunca desfaz o nome no Frame.io.
      await exclusivo(async () => {
        let item;
        try { item = await registrar(id); if (item) await renomear(item.r); }
        catch (ex) { if (item) item.r.erro = ex.message; await loja.salvar(); }
      });
    },
    async evento(b) { if (EVENTS.includes(b.type) && b.resource?.id && (!b.account?.id || b.account.id === fio.conta())) await enfileirar(b.resource.id); } };
}

function montarYoutube({ r, loja, fio, autenticar, soAdmin, envolve, pagina, urlPublica, registrarWebhooks }) {
  const yt = criarYoutube({ loja, fio }), retorno = urlPublica + '/api/framyo/youtube/callback';
  r.get('/youtube', autenticar, soAdmin, (req, res) => res.json({ ...yt.estado(), retorno }));
  r.put('/youtube/cliente', autenticar, soAdmin, envolve(async (req, res) => yt.exclusivo(async () => {
    const id = String(req.body.client_id || '').trim(), secret = String(req.body.client_secret || '').trim();
    if (!id.endsWith('.apps.googleusercontent.com') || !secret) throw erro(400, 'Preencha o Client ID e o Client Secret do Google.');
    Object.assign(yt.Y(), { client_id: id, client_secret: secret });
    await loja.salvar(); res.json({ ok: true });
  })));
  r.post('/youtube/iniciar', autenticar, soAdmin, envolve(async (req, res) => yt.exclusivo(async () => {
    if (!yt.estado().credencial) throw erro(409, 'Cadastre as credenciais Google primeiro.');
    const state = 'yt' + crypto.randomBytes(24).toString('hex');
    loja.dados.oauth_estados[state] = { youtube: true, criado_em: new Date().toISOString(), por: req.usuario.id };
    await loja.salvar();
    res.json({ url: AUTH + '?' + new URLSearchParams({ client_id: yt.credenciais().client_id, redirect_uri: retorno,
      response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state }) });
  })));
  r.get('/youtube/callback', envolve(async (req, res) => yt.exclusivo(async () => {
    const { state, code, error } = req.query, pending = loja.dados.oauth_estados[state];
    if (!pending?.youtube || Date.parse(pending.criado_em) < Date.now() - 600000 || !loja.dados.usuarios.some(u => u.id === pending.por && u.admin && u.ativo !== false))
      return res.status(400).send(pagina('Link expirado', 'Volte ao Framyo e conecte o YouTube novamente.'));
    delete loja.dados.oauth_estados[state]; await loja.salvar();
    if (error || !code) return res.status(400).send(pagina('YouTube não conectado', 'A autorização foi cancelada.'));
    const j = await yt.trocar({ grant_type: 'authorization_code', code: String(code), redirect_uri: retorno });
    if (!j.refresh_token || !String(j.scope || '').split(' ').includes(SCOPE)) throw erro(409, 'Autorize o acesso de gerenciamento de vídeos do YouTube.');
    const previous = yt.Y().auth;
    yt.Y().auth = { access_token: j.access_token, refresh_token: j.refresh_token, expira_em: Date.now() + (j.expires_in || 3600) * 1000 };
    try {
      const c = (await yt.api('GET', '/channels?part=snippet,contentDetails&mine=true')).items;
      if (c?.length !== 1) throw erro(409, 'Selecione exatamente um canal ao autorizar.');
      if (yt.Y().canal && yt.Y().canal.id !== c[0].id && Object.keys(yt.Y().registros).length)
        throw erro(409, 'Há vídeos vinculados ao canal anterior. Conecte o mesmo canal para preservar os vínculos.');
      yt.Y().canal = { id: c[0].id, nome: c[0].snippet.title, uploads: c[0].contentDetails.relatedPlaylists.uploads };
    } catch (ex) { yt.Y().auth = previous; throw ex; }
    yt.Y().ativo = true; await loja.salvar();
    try { await registrarWebhooks(); }
    catch { return res.send(pagina('YouTube conectado', 'Canal autorizado. Em Admin › Frame.io, reative os avisos para receber os envios feitos no site.')); }
    res.send(pagina('YouTube conectado', 'Os novos vídeos serão enviados como não listados. Pode voltar ao Framyo.'));
  })));
  r.post('/youtube/desconectar', autenticar, soAdmin, envolve(async (req, res) => yt.exclusivo(async () => {
    yt.Y().ativo = false; delete yt.Y().auth; await loja.salvar(); res.json({ ok: true });
  })));
  r.post('/youtube/trabalho', autenticar, envolve(async (req, res) => res.json(await yt.trabalhar(req.usuario))));
  r.post('/youtube/registros/:id/lease', autenticar, envolve(async (req, res) => res.json(await yt.atualizarLease(req.usuario, req.params.id, req.body || {}))));
  r.post('/youtube/registros/:id/recuperar', autenticar, soAdmin, envolve(async (req, res) => yt.exclusivo(async () => {
    const registro = yt.Y().registros[req.params.id];
    if (!registro) throw erro(404, 'Vídeo não encontrado.');
    if (registro.upload?.lease?.ate > Date.now()) throw erro(409, 'Há um envio em andamento. Aguarde.');
    await yt.recuperar(registro); registro.tentar_em = 0; await loja.salvar(); res.json({ ok: true });
  })));
  return yt;
}
module.exports = { montarYoutube, criarYoutube, titulo, EVENTS };
