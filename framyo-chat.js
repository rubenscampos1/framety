// framyo-chat.js — chat privado entre os usuários do Framyo, com arquivos.
//
// Conversa de dois: a chave é o par de ids em ordem. Grupo: a chave é o id do
// grupo (chat.grupos guarda nome e membros). As mensagens ficam no mesmo
// documento do Framyo (as 500 mais recentes de cada conversa). Só quem
// participa lê — nem o admin lê a conversa dos outros pela API.
// Nas rotas, ":uid" é o id da pessoa ou o id do grupo.
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
  const grupos = () => chat().grupos || (chat().grupos = {});
  const chave = (a, b) => [a, b].sort().join('|');
  const conv = (k, criar) => {
    if (!chat().conversas[k] && criar) chat().conversas[k] = { msgs: [], lido: {} };
    return chat().conversas[k] || null;
  };
  const conversa = (a, b, criar) => conv(chave(a, b), criar);
  const participa = (k, eu) => (grupos()[k] ? grupos()[k].membros.includes(eu) : k.split('|').includes(eu));
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
  // Com quem é a conversa da rota: um grupo de que a pessoa participa, ou outra pessoa.
  const alvo = (req) => {
    const g = grupos()[req.params.uid];
    if (g) {
      if (!g.membros.includes(req.usuario.id)) throw falha(404, 'Grupo não encontrado.');
      return { id: g.id, k: g.id, grupo: g };
    }
    const o = outro(req);
    return { id: o.id, k: chave(req.usuario.id, o.id), pessoa: o };
  };
  const nomeDe = (uid) => (D().usuarios.find((x) => x.id === uid) || {}).nome || 'Alguém';
  const grupoPublico = (g) => ({ id: g.id, nome: g.nome, usuario: '', grupo: true, criado_por: g.criado_por,
                                 membros: g.membros.map(pessoa).filter(Boolean) });
  const quem = (a) => (a.grupo ? grupoPublico(a.grupo) : pessoa(a.id));

  // ── arquivos: endereços assinados para baixar/ver ───────────────────────────
  const SEGREDO = crypto.randomBytes(32);
  const assinatura = (msg, tipo, exp) => crypto.createHmac('sha256', SEGREDO).update(`${msg}|${tipo}|${exp}`).digest('hex').slice(0, 32);
  const link = (msg, tipo) => {
    const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
    return `/api/framyo/chat/arquivo/${encodeURIComponent(msg)}?tipo=${tipo}&exp=${exp}&sig=${assinatura(msg, tipo, exp)}`;
  };
  const publica = (m) => {
    const s = { id: m.id, seq: m.seq, de: m.de, para: m.para, texto: m.texto || '', em: m.em };
    if (m.grupo) { s.grupo = true; s.de_nome = nomeDe(m.de); }
    if (m.sistema) s.sistema = true;
    if (m.arquivo) {
      const visual = /^(image|video)\//.test(m.arquivo.tipo || '');
      s.arquivo = { nome: m.arquivo.nome, tamanho: m.arquivo.tamanho, tipo: m.arquivo.tipo,
                    url: link(m.id, 'arquivo'), capa: visual ? link(m.id, 'capa') : null };
    }
    if (m.comentario) s.comentario = m.comentario;
    if (m.resposta) s.resposta = m.resposta;
    return s;
  };
  const naoLidas = (c, eu) => c.msgs.filter((m) => m.de !== eu && !m.sistema && m.seq > (c.lido[eu] || 0)).length;

  // Comentário do Frame.io compartilhado no chat: vai como um cartão (quem
  // comentou, o vídeo e o texto) e, na tela, clicar abre o vídeo naquele ponto.
  function lerComentario(c) {
    if (!c || typeof c !== 'object' || !c.arquivo_id) return null;
    const ts = Number(c.timestamp);
    return { comentario_id: limpaTexto(String(c.comentario_id || ''), 80), arquivo_id: limpaTexto(String(c.arquivo_id), 80),
             arquivo_nome: limpaTexto(c.arquivo_nome, 255), projeto_id: limpaTexto(String(c.projeto_id || ''), 80),
             projeto_nome: limpaTexto(c.projeto_nome, 120), autor: limpaTexto(c.autor, 120), texto: limpaTexto(c.texto, 2000),
             timestamp: Number.isFinite(ts) && c.timestamp != null ? ts : null };
  }

  // Resposta a uma mensagem da conversa (como no WhatsApp): a nova leva um
  // retrato curto da original, que continua aparecendo mesmo depois que a
  // original sair das 500 guardadas.
  function retrato(c, id) {
    const o = id ? c.msgs.find((x) => x.id === id) : null;
    if (!o) return null;
    const r = { id: o.id, de: o.de, texto: (o.texto || '').slice(0, 200) };
    if (o.arquivo) r.arquivo = o.arquivo.nome;
    if (o.comentario) r.comentario = { autor: o.comentario.autor, texto: (o.comentario.texto || '').slice(0, 200), arquivo_nome: o.comentario.arquivo_nome };
    return r;
  }

  // a: o alvo da rota (ver alvo()); extra: { sistema: true } nos avisos do grupo ("fulano entrou")
  function gravar(de, a, texto, arquivo, comentario, respostaA, extra) {
    const c = conv(a.k, true);
    chat().seq += 1;
    const m = Object.assign({ id: 'm_' + crypto.randomBytes(8).toString('hex'), seq: chat().seq, de, para: a.id, texto, em: agora() }, extra || {});
    if (a.grupo) m.grupo = true;
    if (arquivo) m.arquivo = arquivo;
    if (comentario) m.comentario = comentario;
    const resposta = retrato(c, typeof respostaA === 'string' ? respostaA : '');
    if (resposta) m.resposta = resposta;
    c.msgs.push(m);
    if (c.msgs.length > MAX_MENSAGENS) c.msgs.splice(0, c.msgs.length - MAX_MENSAGENS);
    c.lido[de] = m.seq;                     // quem escreveu já leu até aqui
    return m;
  }

  // ── conversas ───────────────────────────────────────────────────────────────
  r.get('/chat', autenticar, (req, res) => {
    const eu = req.usuario.id;
    const linha = (com, c, extra) => {
      const ultima = c && c.msgs.length ? c.msgs[c.msgs.length - 1] : null;
      return Object.assign({ com, ultima: ultima ? publica(ultima) : null, nao_lidas: c ? naoLidas(c, eu) : 0 }, extra);
    };
    const lista = contatos(req.usuario).map((o) => linha(pessoa(o.id), conversa(eu, o.id), { online: online(o), visto_em: o.visto_em || null }))
      .concat(Object.values(grupos()).filter((g) => g.membros.includes(eu)).map((g) => {
        const n = g.membros.filter((id) => id !== eu && online(D().usuarios.find((x) => x.id === id) || {})).length;
        return linha(grupoPublico(g), conv(g.id), { online: n > 0, online_n: n, visto_em: null });
      }))
    // conversas mais recentes primeiro; entre quem ainda não tem conversa, quem está online vem antes
    .sort((a, b) => ((b.ultima && b.ultima.seq) || 0) - ((a.ultima && a.ultima.seq) || 0) || (b.online - a.online) || a.com.nome.localeCompare(b.com.nome, 'pt'));
    res.json({ conversas: lista, arquivos: google.pronto() });
  });

  r.get('/chat/:uid/mensagens', autenticar, envolve(async (req, res) => {
    const a = alvo(req);
    const eu = req.usuario.id;
    const c = conv(a.k);
    const antes = Number(req.query.antes) || Infinity;
    const todas = c ? c.msgs.filter((m) => m.seq < antes) : [];
    const pagina = todas.slice(-80);
    if (c && c.msgs.length && (c.lido[eu] || 0) < c.msgs[c.msgs.length - 1].seq && antes === Infinity) {
      c.lido[eu] = c.msgs[c.msgs.length - 1].seq;            // abriu a conversa: leu
      await loja.salvar().catch(() => {});
    }
    // "lido": numa conversa de dois, até onde o outro leu; num grupo, até onde TODOS os outros leram.
    const outros = a.grupo ? a.grupo.membros.filter((id) => id !== eu) : [a.id];
    res.json({ com: quem(a), online: a.pessoa ? online(a.pessoa) : false, visto_em: (a.pessoa && a.pessoa.visto_em) || null,
               mensagens: pagina.map(publica), tem_mais: todas.length > pagina.length,
               lido_por_ele: c && outros.length ? Math.min(...outros.map((id) => c.lido[id] || 0)) : 0 });
  }));

  r.post('/chat/:uid/mensagens', autenticar, envolve(async (req, res) => {
    const a = alvo(req);
    const texto = limpaTexto((req.body || {}).texto, MAX_TEXTO);
    const comentario = lerComentario((req.body || {}).comentario);
    if (!texto && !comentario) throw falha(400, 'Escreva a mensagem.');
    const m = gravar(req.usuario.id, a, texto, null, comentario, (req.body || {}).resposta_a);
    try { await loja.salvar(); } catch (e) { conv(a.k).msgs.pop(); throw e; }
    res.json({ mensagem: publica(m) });
  }));

  // ── arquivos ────────────────────────────────────────────────────────────────
  async function pastaDaConversa(eu, a) {
    const nomes = a.grupo ? `grupo ${a.grupo.nome.replace(/[\\/:*?"<>|]/g, '_')} (${a.grupo.id.slice(-6)})`
      : [eu, a.id].map((id) => (D().usuarios.find((x) => x.id === id) || {}).usuario || id).sort().join(' + ');
    const raiz = await google.pastaFilha(google.G().raiz_id, 'chat');
    return google.pastaFilha(raiz, nomes);
  }

  // 1) abre a sessão de envio no Drive e devolve o endereço para o programa mandar os bytes
  r.post('/chat/:uid/arquivos', autenticar, envolve(async (req, res) => {
    const a = alvo(req);
    if (!google.pronto()) throw falha(409, 'Para enviar arquivos, um administrador precisa conectar o Google Drive (Admin › Google Drive).');
    const b = req.body || {};
    const nome = limpaTexto(b.nome, 200).replace(/[\\/:*?"<>|]/g, '_');
    const tamanho = Number(b.tamanho);
    if (!nome || !(tamanho > 0)) throw falha(400, 'Faltam o nome ou o tamanho do arquivo.');
    if (tamanho > MAX_ARQUIVO) throw falha(413, 'Arquivo grande demais para o chat (máx. 5 GB).');
    const tipo = /^[a-z]+\/[a-z0-9.+-]+$/i.test(String(b.tipo || '')) ? String(b.tipo) : 'application/octet-stream';
    const pasta = await pastaDaConversa(req.usuario.id, a);
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
    const a = alvo(req);
    const b = req.body || {};
    const id = String(b.drive_id || '');
    if (!/^[\w-]{5,200}$/.test(id)) throw falha(400, 'Arquivo inválido.');
    const pasta = await pastaDaConversa(req.usuario.id, a);
    const f = await google.api('GET', `/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,parents&supportsAllDrives=true`)
      .catch(() => { throw falha(404, 'O arquivo não chegou ao Google Drive. Envie de novo.'); });
    if (!(f.parents || []).includes(pasta)) throw falha(403, 'Esse arquivo não é desta conversa.');
    const m = gravar(req.usuario.id, a, limpaTexto(b.texto, MAX_TEXTO),
                     { drive_id: f.id, nome: f.name, tamanho: Number(f.size) || 0, tipo: f.mimeType || 'application/octet-stream' },
                     null, b.resposta_a);
    try { await loja.salvar(); } catch (e) { conv(a.k).msgs.pop(); throw e; }
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

  // ── grupos ──────────────────────────────────────────────────────────────────
  // Qualquer pessoa do chat cria um grupo com os @ que escolher. Quem está no
  // grupo muda o nome, põe mais gente e sai; tirar outra pessoa é de quem criou
  // (ou de um admin que esteja no grupo). Cada mudança deixa um aviso na conversa.
  const MAX_GRUPO = 50;
  const idsValidos = (eu, lista) => {
    const pode = new Set(contatos(eu).map((x) => x.id));
    return [...new Set((Array.isArray(lista) ? lista : []).map(String))].filter((id) => pode.has(id));
  };
  const aviso = (g, de, texto) => gravar(de, { id: g.id, k: g.id, grupo: g }, texto, null, null, null, { sistema: true });
  const nomes = (ids) => ids.map(nomeDe).join(', ');

  r.post('/chat/grupos', autenticar, envolve(async (req, res) => {
    const nome = limpaTexto((req.body || {}).nome, 60);
    const membros = idsValidos(req.usuario, (req.body || {}).membros);
    if (!nome) throw falha(400, 'Dê um nome ao grupo.');
    if (!membros.length) throw falha(400, 'Escolha pelo menos uma pessoa para o grupo.');
    if (membros.length + 1 > MAX_GRUPO) throw falha(400, `Um grupo tem no máximo ${MAX_GRUPO} pessoas.`);
    const g = { id: 'grp_' + crypto.randomBytes(8).toString('hex'), nome, membros: [req.usuario.id].concat(membros),
                criado_por: req.usuario.id, criado_em: agora() };
    grupos()[g.id] = g;
    aviso(g, req.usuario.id, `${nomeDe(req.usuario.id)} criou o grupo com ${nomes(membros)}`);
    try { await loja.salvar(); } catch (e) { delete grupos()[g.id]; delete chat().conversas[g.id]; throw e; }
    res.json({ grupo: grupoPublico(g) });
  }));

  r.put('/chat/grupos/:uid', autenticar, envolve(async (req, res) => {
    const g = alvo(req).grupo;
    if (!g) throw falha(404, 'Grupo não encontrado.');
    const b = req.body || {}, eu = req.usuario;
    if (b.nome !== undefined) {
      const nome = limpaTexto(b.nome, 60);
      if (!nome) throw falha(400, 'Dê um nome ao grupo.');
      if (nome !== g.nome) { g.nome = nome; aviso(g, eu.id, `${nomeDe(eu.id)} mudou o nome do grupo para ${nome}`); }
    }
    const novos = idsValidos(eu, b.adicionar).filter((id) => !g.membros.includes(id));
    if (novos.length) {
      if (g.membros.length + novos.length > MAX_GRUPO) throw falha(400, `Um grupo tem no máximo ${MAX_GRUPO} pessoas.`);
      g.membros.push(...novos);
      aviso(g, eu.id, `${nomeDe(eu.id)} adicionou ${nomes(novos)}`);
    }
    const fora = [...new Set((Array.isArray(b.remover) ? b.remover : []).map(String))].filter((id) => id !== eu.id && g.membros.includes(id));
    if (fora.length) {
      if (g.criado_por !== eu.id && !eu.admin) throw falha(403, 'Só quem criou o grupo tira outras pessoas.');
      g.membros = g.membros.filter((id) => !fora.includes(id));
      aviso(g, eu.id, `${nomeDe(eu.id)} tirou ${nomes(fora)} do grupo`);
    }
    await loja.salvar();
    res.json({ grupo: grupoPublico(g) });
  }));

  r.post('/chat/grupos/:uid/sair', autenticar, envolve(async (req, res) => {
    const g = alvo(req).grupo;
    if (!g) throw falha(404, 'Grupo não encontrado.');
    aviso(g, req.usuario.id, `${nomeDe(req.usuario.id)} saiu do grupo`);
    g.membros = g.membros.filter((id) => id !== req.usuario.id);
    if (g.membros.length < 2) { delete grupos()[g.id]; delete chat().conversas[g.id]; }      // ficou sozinho: o grupo acaba
    await loja.salvar();
    res.json({ ok: true });
  }));

  // ── para o /eventos (bandeja e janela perguntam a cada 3 s) ─────────────────
  // nao_lidas: total; novas: o que chegou para a pessoa depois do nº que ela já viu.
  function resumo(u, desde) {
    if (ehMarketing(u)) return null;
    const eu = u.id;
    let total = 0;
    const novas = [];
    for (const [k, c] of Object.entries(chat().conversas)) {
      if (!c.msgs.length || !participa(k, eu)) continue;
      total += naoLidas(c, eu);
      if (desde != null) for (const m of c.msgs) if (m.de !== eu && !m.sistema && m.seq > desde) novas.push(m);
    }
    novas.sort((a, b) => a.seq - b.seq);
    return { seq: chat().seq, nao_lidas: total,
             novas: novas.slice(-20).map((m) => ({ id: m.id, seq: m.seq, de: pessoa(m.de), texto: m.texto || '', arquivo: m.arquivo ? m.arquivo.nome : null,
                                                      grupo: m.grupo && grupos()[m.para] ? { id: m.para, nome: grupos()[m.para].nome } : null,
                                                      comentario: m.comentario ? { autor: m.comentario.autor, arquivo_nome: m.comentario.arquivo_nome } : null })) };
  }

  return { resumo };
}

module.exports = { montarChat };
