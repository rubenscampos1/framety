// framyo-chat.js — chat privado entre os usuários do Framyo, com arquivos.
//
// Conversa é sempre de dois: a chave é o par de ids em ordem. As mensagens
// ficam no mesmo documento do Framyo (as 500 mais recentes de cada conversa).
// Só os dois participantes leem — nem o admin lê a conversa dos outros pela API.
//
// Arquivos: vão para o Google Drive conectado no Framyo (pasta "chat" dentro da
// pasta raiz, uma subpasta por conversa). O arquivo NÃO passa por este servidor
// na ida: o servidor abre uma "sessão de envio" no Drive e devolve o endereço;
// o programa manda os bytes direto para o Google (vídeo de GB não derruba o
// Render). Na volta, o download passa por aqui com um endereço assinado e com
// validade, porque a pasta do Drive é privada.
'use strict';

const crypto = require('crypto');
const { Readable } = require('stream');

const DRIVE = process.env.FRAMYO_TESTE_GOOGLE_DRIVE || 'https://www.googleapis.com/drive/v3';
const ENVIO = process.env.FRAMYO_TESTE_GOOGLE_UPLOAD || 'https://www.googleapis.com/upload/drive/v3';
const MAX_MENSAGENS = 500;
const MAX_TEXTO = 4000;
const MAX_ARQUIVO = 5 * 1024 * 1024 * 1024;          // 5 GB

function montarChat({ r, loja, autenticar, envolve, falha, pessoa, agora, limpaTexto, google }) {
  const D = () => loja.dados;
  const chat = () => D().chat || (D().chat = { seq: 0, conversas: {} });
  const chave = (a, b) => [a, b].sort().join('|');
  const conversa = (a, b, criar) => {
    const k = chave(a, b);
    if (!chat().conversas[k] && criar) chat().conversas[k] = { msgs: [], lido: {} };
    return chat().conversas[k] || null;
  };
  const ehMarketing = (u) => !!(u && u.marketing && !u.admin);
  // Com quem dá para conversar: usuários ativos, menos os de marketing (só calendário) e a própria pessoa.
  const contatos = (eu) => D().usuarios.filter((x) => x.ativo !== false && x.id !== eu.id && !ehMarketing(x));
  // Online = o Framyo da pessoa (janela ou bandeja) falou com o servidor nos últimos 20 s
  // (os dois perguntam por novidades a cada 3 s; ver o User-Agent em autenticar()).
  const online = (u) => !!u.visto_em && Date.now() - Date.parse(u.visto_em) < 20000;
  const outro = (req) => {
    const o = D().usuarios.find((x) => x.id === req.params.uid && x.ativo !== false);
    if (!o || o.id === req.usuario.id || ehMarketing(o)) throw falha(404, 'Pessoa não encontrada.');
    return o;
  };

  // ── arquivos: endereços assinados para baixar/ver ───────────────────────────
  const SEGREDO = crypto.randomBytes(32);
  const assinatura = (msg, tipo, exp) => crypto.createHmac('sha256', SEGREDO).update(`${msg}|${tipo}|${exp}`).digest('hex').slice(0, 32);
  const link = (msg, tipo) => {
    const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
    return `/api/framyo/chat/arquivo/${encodeURIComponent(msg)}?tipo=${tipo}&exp=${exp}&sig=${assinatura(msg, tipo, exp)}`;
  };
  const publica = (m) => {
    const s = { id: m.id, seq: m.seq, de: m.de, para: m.para, texto: m.texto || '', em: m.em };
    if (m.arquivo) {
      const visual = /^(image|video)\//.test(m.arquivo.tipo || '');
      s.arquivo = { nome: m.arquivo.nome, tamanho: m.arquivo.tamanho, tipo: m.arquivo.tipo,
                    url: link(m.id, 'arquivo'), capa: visual ? link(m.id, 'capa') : null };
    }
    return s;
  };
  const naoLidas = (c, eu) => c.msgs.filter((m) => m.para === eu && m.seq > (c.lido[eu] || 0)).length;

  function gravar(de, para, texto, arquivo) {
    const c = conversa(de, para, true);
    chat().seq += 1;
    const m = { id: 'm_' + crypto.randomBytes(8).toString('hex'), seq: chat().seq, de, para, texto, em: agora() };
    if (arquivo) m.arquivo = arquivo;
    c.msgs.push(m);
    if (c.msgs.length > MAX_MENSAGENS) c.msgs.splice(0, c.msgs.length - MAX_MENSAGENS);
    c.lido[de] = m.seq;                     // quem escreveu já leu até aqui
    return m;
  }

  // ── conversas ───────────────────────────────────────────────────────────────
  r.get('/chat', autenticar, (req, res) => {
    const eu = req.usuario.id;
    const lista = contatos(req.usuario).map((o) => {
      const c = conversa(eu, o.id);
      const ultima = c && c.msgs.length ? c.msgs[c.msgs.length - 1] : null;
      return { com: pessoa(o.id), ultima: ultima ? publica(ultima) : null, nao_lidas: c ? naoLidas(c, eu) : 0,
               online: online(o), visto_em: o.visto_em || null };
    // conversas mais recentes primeiro; entre quem ainda não tem conversa, quem está online vem antes
    }).sort((a, b) => ((b.ultima && b.ultima.seq) || 0) - ((a.ultima && a.ultima.seq) || 0) || (b.online - a.online) || a.com.nome.localeCompare(b.com.nome, 'pt'));
    res.json({ conversas: lista, arquivos: google.pronto() });
  });

  r.get('/chat/:uid/mensagens', autenticar, envolve(async (req, res) => {
    const o = outro(req);
    const eu = req.usuario.id;
    const c = conversa(eu, o.id);
    const antes = Number(req.query.antes) || Infinity;
    const todas = c ? c.msgs.filter((m) => m.seq < antes) : [];
    const pagina = todas.slice(-80);
    if (c && c.msgs.length && (c.lido[eu] || 0) < c.msgs[c.msgs.length - 1].seq && antes === Infinity) {
      c.lido[eu] = c.msgs[c.msgs.length - 1].seq;            // abriu a conversa: leu
      await loja.salvar().catch(() => {});
    }
    res.json({ com: pessoa(o.id), online: online(o), visto_em: o.visto_em || null,
               mensagens: pagina.map(publica), tem_mais: todas.length > pagina.length,
               lido_por_ele: c ? (c.lido[o.id] || 0) : 0 });
  }));

  r.post('/chat/:uid/mensagens', autenticar, envolve(async (req, res) => {
    const o = outro(req);
    const texto = limpaTexto((req.body || {}).texto, MAX_TEXTO);
    if (!texto) throw falha(400, 'Escreva a mensagem.');
    const m = gravar(req.usuario.id, o.id, texto);
    try { await loja.salvar(); } catch (e) { conversa(m.de, m.para).msgs.pop(); throw e; }
    res.json({ mensagem: publica(m) });
  }));

  // ── arquivos ────────────────────────────────────────────────────────────────
  async function pastaDaConversa(a, b) {
    const nomes = [a, b].map((id) => (D().usuarios.find((x) => x.id === id) || {}).usuario || id).sort().join(' + ');
    const raiz = await google.pastaFilha(google.G().raiz_id, 'chat');
    return google.pastaFilha(raiz, nomes);
  }

  // 1) abre a sessão de envio no Drive e devolve o endereço para o programa mandar os bytes
  r.post('/chat/:uid/arquivos', autenticar, envolve(async (req, res) => {
    const o = outro(req);
    if (!google.pronto()) throw falha(409, 'Para enviar arquivos, um administrador precisa conectar o Google Drive (Admin › Google Drive).');
    const b = req.body || {};
    const nome = limpaTexto(b.nome, 200).replace(/[\\/:*?"<>|]/g, '_');
    const tamanho = Number(b.tamanho);
    if (!nome || !(tamanho > 0)) throw falha(400, 'Faltam o nome ou o tamanho do arquivo.');
    if (tamanho > MAX_ARQUIVO) throw falha(413, 'Arquivo grande demais para o chat (máx. 5 GB).');
    const tipo = /^[a-z]+\/[a-z0-9.+-]+$/i.test(String(b.tipo || '')) ? String(b.tipo) : 'application/octet-stream';
    const pasta = await pastaDaConversa(req.usuario.id, o.id);
    const r2 = await fetch(`${ENVIO}/files?uploadType=resumable&supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await google.token()}`, 'Content-Type': 'application/json; charset=UTF-8',
                 'X-Upload-Content-Type': tipo, 'X-Upload-Content-Length': String(tamanho) },
      body: JSON.stringify({ name: nome, parents: [pasta] }),
    });
    const destino = r2.headers.get('location');
    if (!r2.ok || !destino) throw falha(502, 'O Google Drive não aceitou iniciar o envio. Tente de novo.');
    await loja.salvar().catch(() => {});                       // (o cache de pastas pode ter mudado)
    res.json({ envio_url: destino, tipo, pasta });
  }));

  // 2) terminou de mandar: confere o arquivo no Drive e grava a mensagem
  r.post('/chat/:uid/arquivos/concluir', autenticar, envolve(async (req, res) => {
    const o = outro(req);
    const b = req.body || {};
    const id = String(b.drive_id || '');
    if (!/^[\w-]{5,200}$/.test(id)) throw falha(400, 'Arquivo inválido.');
    const pasta = await pastaDaConversa(req.usuario.id, o.id);
    const f = await google.api('GET', `/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,parents&supportsAllDrives=true`)
      .catch(() => { throw falha(404, 'O arquivo não chegou ao Google Drive. Envie de novo.'); });
    if (!(f.parents || []).includes(pasta)) throw falha(403, 'Esse arquivo não é desta conversa.');
    const m = gravar(req.usuario.id, o.id, limpaTexto(b.texto, MAX_TEXTO),
                     { drive_id: f.id, nome: f.name, tamanho: Number(f.size) || 0, tipo: f.mimeType || 'application/octet-stream' });
    try { await loja.salvar(); } catch (e) { conversa(m.de, m.para).msgs.pop(); throw e; }
    res.json({ mensagem: publica(m) });
  }));

  // baixar/ver: endereço assinado (o programa abre direto, sem cabeçalho de login)
  r.get('/chat/arquivo/:msg', envolve(async (req, res) => {
    const tipo = req.query.tipo === 'capa' ? 'capa' : 'arquivo';
    const exp = Number(req.query.exp) || 0;
    const sig = String(req.query.sig || '');
    const certa = assinatura(req.params.msg, tipo, exp);
    if (exp < Date.now() / 1000 || sig.length !== certa.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(certa))) {
      throw falha(403, 'Link vencido. Abra a conversa de novo.');
    }
    let m = null;
    for (const c of Object.values(chat().conversas)) { m = c.msgs.find((x) => x.id === req.params.msg); if (m) break; }
    if (!m || !m.arquivo) throw falha(404, 'Arquivo não encontrado.');
    const auth = { Authorization: `Bearer ${await google.token()}` };
    const idArq = encodeURIComponent(m.arquivo.drive_id);
    let r2 = null;
    if (tipo === 'capa') {
      const f = await google.api('GET', `/files/${idArq}?fields=thumbnailLink&supportsAllDrives=true`).catch(() => ({}));
      if (f.thumbnailLink) { r2 = await fetch(f.thumbnailLink.replace(/=s\d+$/, '=s600'), { headers: auth }).catch(() => null); if (r2 && !r2.ok) r2 = null; }
      if (!r2 && /^image\//.test(m.arquivo.tipo || '')) r2 = await fetch(`${DRIVE}/files/${idArq}?alt=media&supportsAllDrives=true`, { headers: auth });
      if (!r2 || !r2.ok) throw falha(404, 'Sem prévia.');
      res.set({ 'Content-Type': r2.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' });
    } else {
      r2 = await fetch(`${DRIVE}/files/${idArq}?alt=media&supportsAllDrives=true`,
                       { headers: Object.assign({}, auth, req.headers.range ? { Range: req.headers.range } : {}) });
      if (!r2.ok && r2.status !== 206) throw falha(502, 'O Google Drive não entregou o arquivo.');
      res.status(r2.status);
      for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) { const v = r2.headers.get(k); if (v) res.set(k, v); }
      res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(m.arquivo.nome)}`);
    }
    Readable.fromWeb(r2.body).on('error', () => res.destroy()).pipe(res);
  }));

  // ── para o /eventos (bandeja e janela perguntam a cada 3 s) ─────────────────
  // nao_lidas: total; novas: o que chegou para a pessoa depois do nº que ela já viu.
  function resumo(u, desde) {
    if (ehMarketing(u)) return null;
    const eu = u.id;
    let total = 0;
    const novas = [];
    for (const c of Object.values(chat().conversas)) {
      if (!c.msgs.length || (c.msgs[0].de !== eu && c.msgs[0].para !== eu)) continue;
      total += naoLidas(c, eu);
      if (desde != null) for (const m of c.msgs) if (m.para === eu && m.seq > desde) novas.push(m);
    }
    novas.sort((a, b) => a.seq - b.seq);
    return { seq: chat().seq, nao_lidas: total,
             novas: novas.slice(-20).map((m) => ({ id: m.id, seq: m.seq, de: pessoa(m.de), texto: m.texto || '', arquivo: m.arquivo ? m.arquivo.nome : null })) };
  }

  return { resumo };
}

module.exports = { montarChat };
