// framyo-posts.js — calendário de posts das redes sociais (parte do Framyo).
//
// Cada post: data (ou nenhuma = banco de posts), formato (reels, feed,
// carrossel), responsável e descrição; quem cria fica com o @ no post. Com o
// Google conectado (admin, uma vez) e a pasta raiz do Drive vinculada, o
// servidor cria a pasta de cada post:
//     raiz / posts / 2026-10 Outubro / postab12cd      (banco: posts / Banco de posts)
// e confere se já há arquivo lá dentro — é isso que decide os lembretes:
// 7, 3 e 1 dia antes para o responsável que ainda não enviou; quem já enviou
// recebe só "será postado amanhã"; quem criou o post é avisado na véspera se
// o responsável ainda não enviou.
const crypto = require('crypto');

const OAUTH = process.env.FRAMYO_TESTE_GOOGLE_OAUTH || 'https://oauth2.googleapis.com';
const AUTORIZAR = process.env.FRAMYO_TESTE_GOOGLE_AUTORIZAR || 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE = process.env.FRAMYO_TESTE_GOOGLE_DRIVE || 'https://www.googleapis.com/drive/v3';
const ESCOPO = 'https://www.googleapis.com/auth/drive openid email';
const PASTA = 'application/vnd.google-apps.folder';
const FORMATOS = { reels: 'Reels', feed: 'Feed', carrossel: 'Carrossel' };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const FUSO = 'America/Sao_Paulo';

// Hoje e diferença de dias no horário de Brasília.
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
const diasAte = (data) => Math.round((Date.parse(data + 'T00:00:00Z') - Date.parse(hojeBR() + 'T00:00:00Z')) / 864e5);
const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z'));
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Link de pasta do Drive → id ("…/folders/<id>", "…?id=<id>" ou o id puro).
function idDaPasta(link) {
  const s = String(link || '').trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || s.match(/^([A-Za-z0-9_-]{10,})$/);
  return m ? m[1] : null;
}

function criarGoogle(loja, retorno) {
  const G = () => loja.dados.google || (loja.dados.google = {});
  const clientId = () => process.env.GOOGLE_CLIENT_ID || G().client_id || '';
  const segredo = () => process.env.GOOGLE_CLIENT_SECRET || G().client_secret || '';

  async function trocar(parametros) {
    const r = await fetch(`${OAUTH}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.assign({ client_id: clientId(), client_secret: segredo() }, parametros)),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
      throw Object.assign(new Error(j.error_description || j.error || `Google respondeu ${r.status}`), { codigo: j.error });
    }
    return j;
  }
  function guardar(j) {
    G().access_token = j.access_token;
    if (j.refresh_token) G().refresh_token = j.refresh_token;
    G().expira_em = Date.now() + (Number(j.expires_in) || 3600) * 1000;
  }
  let renovando = null;
  async function token() {
    if (!G().refresh_token) throw Object.assign(new Error('A conta Google ainda não foi conectada.'), { status: 409 });
    if (G().access_token && G().expira_em - Date.now() > 120000) return G().access_token;
    renovando = renovando || trocar({ grant_type: 'refresh_token', refresh_token: G().refresh_token })
      .then((j) => { guardar(j); return loja.salvar().catch(() => {}); }).finally(() => { renovando = null; });
    await renovando;
    return G().access_token;
  }
  async function api(metodo, caminho, corpo, tentativa = 0) {
    const r = await fetch(DRIVE + caminho, {
      method: metodo,
      headers: Object.assign({ Authorization: `Bearer ${await token()}` }, corpo ? { 'Content-Type': 'application/json' } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if ((r.status === 429 || r.status === 503) && tentativa < 3) {
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** tentativa));
      return api(metodo, caminho, corpo, tentativa + 1);
    }
    if (r.status === 401 && tentativa === 0) { G().expira_em = 0; return api(metodo, caminho, corpo, 1); }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && j.error.message) || `Google Drive respondeu ${r.status}`;
      throw Object.assign(new Error(msg), { status: r.status === 404 ? 404 : r.status >= 500 ? 502 : 400 });
    }
    return j;
  }
  const qs = (o) => new URLSearchParams(Object.assign({ supportsAllDrives: 'true' }, o)).toString();
  const conectado = () => !!G().refresh_token;
  const pronto = () => conectado() && !!G().raiz_id;

  // Pasta com esse nome dentro de "pai" (cria se não existir). Guarda o id.
  async function pastaFilha(pai, nome) {
    const chave = `${pai}/${nome}`;
    G().cache_pastas = G().cache_pastas || {};
    if (G().cache_pastas[chave]) return G().cache_pastas[chave];
    const q = `'${pai}' in parents and name = '${nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType = '${PASTA}' and trashed = false`;
    const achou = await api('GET', `/files?${qs({ q, fields: 'files(id)', includeItemsFromAllDrives: 'true', pageSize: '5' })}`);
    const id = achou.files && achou.files[0] ? achou.files[0].id
      : (await api('POST', `/files?${qs({ fields: 'id' })}`, { name: nome, mimeType: PASTA, parents: [pai] })).id;
    G().cache_pastas[chave] = id;
    return id;
  }

  async function destinoDo(p) {
    const posts = await pastaFilha(G().raiz_id, 'posts');
    if (!p.data) return pastaFilha(posts, 'Banco de posts');
    return pastaFilha(posts, `${p.data.slice(0, 7)} ${MESES[Number(p.data.slice(5, 7)) - 1]}`);
  }

  // Cria a pasta do post, ou muda de lugar quando a data muda de mês / sai do banco.
  async function garantirPasta(p) {
    if (!pronto()) return;
    const destino = await destinoDo(p);
    if (!p.drive_id) {
      const f = await api('POST', `/files?${qs({ fields: 'id' })}`, { name: `post${p.codigo}`, mimeType: PASTA, parents: [destino] });
      p.drive_id = f.id;
    } else if (p.drive_pai && p.drive_pai !== destino) {
      await api('PATCH', `/files/${p.drive_id}?${qs({ addParents: destino, removeParents: p.drive_pai, fields: 'id' })}`, {});
    }
    p.drive_pai = destino;
    p.drive_raiz = G().raiz_id;
    delete p.drive_erro;
  }

  // O que já foi enviado para a pasta do post.
  async function arquivos(p) {
    const q = `'${p.drive_id}' in parents and trashed = false`;
    const j = await api('GET', `/files?${qs({ q, includeItemsFromAllDrives: 'true', pageSize: '50',
      fields: 'files(id,name,mimeType,size,thumbnailLink,webViewLink,createdTime)' })}`);
    return (j.files || []).filter((f) => f.mimeType !== PASTA);
  }

  async function conferirPasta(link) {
    const id = idDaPasta(link);
    if (!id) throw Object.assign(new Error('Cole o link de uma pasta do Google Drive (…/drive/folders/…).'), { status: 400 });
    const f = await api('GET', `/files/${id}?${qs({ fields: 'id,name,mimeType,capabilities(canAddChildren)' })}`).catch((e) => {
      throw Object.assign(new Error(e.status === 404
        ? 'O Google não achou essa pasta com a conta conectada. Compartilhe a pasta com essa conta (como Editor) e tente de novo.'
        : e.message), { status: 400 });
    });
    if (f.mimeType !== PASTA) throw Object.assign(new Error('Esse link é de um arquivo, não de uma pasta.'), { status: 400 });
    if (f.capabilities && f.capabilities.canAddChildren === false) {
      throw Object.assign(new Error('A conta Google conectada só pode ver essa pasta. Ela precisa ser Editor.'), { status: 400 });
    }
    return f;
  }

  const urlLogin = (estado) => `${AUTORIZAR}?${new URLSearchParams({ client_id: clientId(), redirect_uri: retorno, response_type: 'code',
    scope: ESCOPO, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: estado })}`;

  return { G, clientId, segredo, trocar, guardar, api, token, conectado, pronto, pastaFilha, garantirPasta, arquivos, conferirPasta, urlLogin };
}

function montarPosts({ r, loja, autenticar, soAdmin, envolve, falha, pessoa, pagina, agora, limpaTexto, urlPublica }) {
  const D = () => loja.dados;
  const retorno = `${urlPublica}/api/framyo/google/callback`;
  const g = criarGoogle(loja, retorno);
  const posts = () => D().posts || (D().posts = []);
  const ehMarketing = (u) => !!(u && u.marketing && !u.admin);

  // ── prévia do conteúdo (fotos, carrossel, vídeo) ───────────────────────────
  // A pasta do Drive é privada: o programa não consegue carregar a miniatura
  // nem o vídeo direto. Ele recebe um endereço DESTE servidor, assinado e
  // válido por 6 h, que busca no Drive com a conta conectada e repassa (o
  // vídeo com Range, para dar play e avançar). Endereço relativo: o programa
  // completa com o servidor que ele usa.
  const SEGREDO_MIDIA = crypto.randomBytes(32);
  const assinatura = (post, arq, tipo, exp) => crypto.createHmac('sha256', SEGREDO_MIDIA).update(`${post}|${arq}|${tipo}|${exp}`).digest('hex').slice(0, 32);
  function linkMidia(post, arq, tipo) {
    const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
    return `/api/framyo/posts/${encodeURIComponent(post)}/midia/${encodeURIComponent(arq)}?tipo=${tipo}&exp=${exp}&sig=${assinatura(post, arq, tipo, exp)}`;
  }
  r.get('/posts/:id/midia/:arq', envolve(async (req, res) => {
    const { id, arq } = req.params;
    const tipo = req.query.tipo === 'arquivo' ? 'arquivo' : 'capa';
    const exp = Number(req.query.exp) || 0;
    const sig = String(req.query.sig || '');
    const certa = assinatura(id, arq, tipo, exp);
    if (exp < Date.now() / 1000 || sig.length !== certa.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(certa))) {
      throw falha(403, 'Link de prévia vencido. Atualize o calendário.');
    }
    const p = posts().find((x) => x.id === id);
    const a = p && (p.arquivos || []).find((x) => x.id === arq);
    if (!a) throw falha(404, 'Arquivo não encontrado neste post.');
    const auth = { Authorization: `Bearer ${await g.token()}` };
    let r2 = null;
    if (tipo === 'capa') {
      // Miniatura do Drive (foto e vídeo) em tamanho bom; se não houver, a própria imagem.
      const f = await g.api('GET', `/files/${encodeURIComponent(arq)}?fields=thumbnailLink&supportsAllDrives=true`).catch(() => ({}));
      if (f.thumbnailLink) {
        r2 = await fetch(f.thumbnailLink.replace(/=s\d+$/, '=s1000'), { headers: auth }).catch(() => null);
        if (r2 && !r2.ok) r2 = null;
      }
      if (!r2 && /^image\//.test(a.tipo || '')) r2 = await fetch(`${DRIVE}/files/${encodeURIComponent(arq)}?alt=media&supportsAllDrives=true`, { headers: auth });
      if (!r2 || !r2.ok) throw falha(404, 'Ainda sem prévia (o Drive pode estar processando o arquivo).');
      res.set({ 'Content-Type': r2.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' });
    } else {
      const cab = Object.assign({}, auth, req.headers.range ? { Range: req.headers.range } : {});
      r2 = await fetch(`${DRIVE}/files/${encodeURIComponent(arq)}?alt=media&supportsAllDrives=true`, { headers: cab });
      if (!r2.ok && r2.status !== 206) throw falha(502, 'O Google Drive não entregou o arquivo.');
      res.status(r2.status);
      for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) { const v = r2.headers.get(k); if (v) res.set(k, v); }
      if (!r2.headers.get('content-type') && a.tipo) res.set('Content-Type', a.tipo);
      res.set('Cache-Control', 'private, max-age=600');
    }
    const { Readable } = require('stream');
    Readable.fromWeb(r2.body).on('error', () => res.destroy()).pipe(res);
  }));

  function publico(p) {
    const enviado = p.arquivos_n > 0 || !!p.enviado_manual;
    return {
      id: p.id, codigo: p.codigo, titulo: p.titulo || '', descricao: p.descricao || '', legenda: p.legenda || '', postado: !!p.postado, postado_em: p.postado_em || null, postado_por: p.postado ? pessoa(p.postado_por) : null, formato: p.formato, data: p.data || null,
      responsavel: pessoa(p.responsavel_id), criador: pessoa(p.criador_id), criado_em: p.criado_em, atualizado_em: p.atualizado_em,
      drive_url: p.drive_id ? `https://drive.google.com/drive/folders/${p.drive_id}` : null, drive_erro: p.drive_erro || null,
      arquivos: (p.arquivos || []).map((a) => Object.assign({}, a, a.id ? { capa: linkMidia(p.id, a.id, 'capa'), arquivo: linkMidia(p.id, a.id, 'arquivo') } : {})),
      arquivos_n: p.arquivos_n || 0, enviado, enviado_manual: !!p.enviado_manual,
      verificado_em: p.verificado_em || null,
    };
  }

  // Pasta no Drive: tenta, e guarda o erro no post (o post nunca se perde por causa do Drive).
  async function pasta(p) {
    try {
      if (p.drive_raiz && p.drive_raiz !== g.G().raiz_id) { delete p.drive_id; delete p.drive_pai; }   // raiz trocada
      await g.garantirPasta(p);
    } catch (e) { p.drive_erro = e.message; }
  }
  const verificando = new Map();
  async function conferir(p, idadeMax) {
    if (!p.drive_id || !g.pronto()) return;
    if (p.verificado_em && Date.now() - Date.parse(p.verificado_em) < idadeMax) return;
    if (!verificando.has(p.id)) {
      verificando.set(p.id, g.arquivos(p).then((lista) => {
        p.arquivos_n = lista.length;
        p.arquivos = lista.sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true })).slice(0, 20)
          .map((f) => ({ id: f.id, nome: f.name, tipo: f.mimeType, url: f.webViewLink, miniatura: f.thumbnailLink || null }));
        p.verificado_em = agora();
      }).catch((e) => { p.drive_erro = e.message; }).finally(() => verificando.delete(p.id)));
    }
    await verificando.get(p.id);
  }
  async function emLotes(lista, n, fn) {
    for (let i = 0; i < lista.length; i += n) await Promise.all(lista.slice(i, i + n).map(fn));
  }

  function estadoDrive() {
    const G = g.G();
    return { conectado: g.conectado(), email: G.email || null, cliente: !!g.clientId() && !!g.segredo(),
             client_id: g.clientId() || null, raiz_nome: G.raiz_nome || null,
             raiz_url: G.raiz_id ? `https://drive.google.com/drive/folders/${G.raiz_id}` : null, retorno };
  }

  // ── posts ───────────────────────────────────────────────────────────────────
  r.get('/posts', autenticar, envolve(async (req, res) => {
    const lista = posts();
    if (g.pronto()) {
      // pastas que faltam (Drive ligado depois dos posts) e o que já foi enviado
      await emLotes(lista.filter((p) => !p.drive_id).slice(0, 8), 4, pasta);
      const hoje = hojeBR();
      const recentes = lista.filter((p) => p.drive_id && (!p.data || p.data >= hoje || diasAte(p.data) > -7));
      await emLotes(recentes, 6, (p) => conferir(p, 5 * 60000));
      await loja.salvar();
    }
    res.json({ posts: lista.map(publico), drive: estadoDrive(), hoje: hojeBR() });
  }));

  function lerPost(b, base) {
    const p = Object.assign({}, base);
    if (b.titulo !== undefined) p.titulo = limpaTexto(b.titulo, 120);
    if (b.descricao !== undefined) p.descricao = limpaTexto(b.descricao, 4000);
    // Legenda que vai no post (o marketing escreve aqui). 2.200 = limite do Instagram.
    if (b.legenda !== undefined) p.legenda = limpaTexto(b.legenda, 2200);
    // "Já foi postado": o check verde por cima do cartão no calendário.
    if (b.postado !== undefined) p.postado = !!b.postado;
    if (b.formato !== undefined) {
      if (!FORMATOS[b.formato]) throw falha(400, 'Escolha o formato: Reels, Feed ou Carrossel.');
      p.formato = b.formato;
    }
    if (b.data !== undefined) {
      if (b.data && !dataValida(b.data)) throw falha(400, 'Data inválida.');
      p.data = b.data || null;
    }
    if (b.responsavel_id !== undefined) {
      if (b.responsavel_id && !pessoa(b.responsavel_id)) throw falha(404, 'Essa pessoa não existe (ou está desativada).');
      p.responsavel_id = b.responsavel_id || null;
    }
    if (b.enviado_manual !== undefined) p.enviado_manual = !!b.enviado_manual;
    if (!p.titulo && !p.descricao) throw falha(400, 'Escreva um título ou a descrição do post.');
    return p;
  }

  r.post('/posts', autenticar, envolve(async (req, res) => {
    if (ehMarketing(req.usuario)) throw falha(403, 'O acesso de marketing não cria posts — só escreve a legenda.');
    const b = req.body || {};
    const p = lerPost(Object.assign({ formato: 'feed' }, b), {
      id: 'post_' + crypto.randomBytes(6).toString('hex'), codigo: crypto.randomBytes(3).toString('hex'),
      criador_id: req.usuario.id, criado_em: agora(), avisos: {},
    });
    p.atualizado_em = agora();
    posts().push(p);
    await pasta(p);
    await salvarOuDesfazer(() => { const i = posts().indexOf(p); if (i >= 0) posts().splice(i, 1); });
    res.json({ post: publico(p) });
  }));

  // Se o banco recusar a gravação, a mudança é desfeita na memória também: o
  // que o Framyo mostra é sempre o que está no banco (sem post "fantasma" que
  // aparece depois, nem duplicado quando a pessoa tenta de novo).
  async function salvarOuDesfazer(desfazer) {
    try { await loja.salvar(); } catch (e) { desfazer(); throw e; }
  }

  const podeMexer = (u, p) => u.admin || p.criador_id === u.id || p.responsavel_id === u.id;

  r.put('/posts/:id', autenticar, envolve(async (req, res) => {
    const p = posts().find((x) => x.id === req.params.id);
    if (!p) throw falha(404, 'Esse post não existe mais.');
    const b = req.body || {};
    // A legenda qualquer pessoa da equipe escreve (é o trabalho do marketing);
    // o resto do post continua só com quem criou, o responsável ou um admin.
    // Legenda e "já foi postado" qualquer pessoa da equipe marca (inclusive marketing).
    const soLegenda = Object.keys(b).every((k) => k === 'legenda' || k === 'postado');
    if (!soLegenda && ehMarketing(req.usuario)) throw falha(403, 'O acesso de marketing escreve só a legenda e marca o post como postado.');
    if (!soLegenda && !podeMexer(req.usuario, p)) throw falha(403, 'Só quem criou, o responsável ou um admin mexem neste post.');
    const novo = lerPost(b, p);
    if (b.postado !== undefined && !!b.postado !== !!p.postado) {
      novo.postado_em = b.postado ? agora() : null;
      novo.postado_por = b.postado ? req.usuario.id : null;
    }
    if (novo.data !== p.data || novo.responsavel_id !== p.responsavel_id) novo.avisos = {};   // lembretes recomeçam
    novo.atualizado_em = agora();
    const antes = JSON.parse(JSON.stringify(p));
    Object.assign(p, novo);
    await pasta(p);
    await salvarOuDesfazer(() => { for (const k of Object.keys(p)) delete p[k]; Object.assign(p, antes); });
    res.json({ post: publico(p) });
  }));

  r.delete('/posts/:id', autenticar, envolve(async (req, res) => {
    const i = posts().findIndex((x) => x.id === req.params.id);
    if (i < 0) throw falha(404, 'Esse post não existe mais.');
    const p = posts()[i];
    if (!req.usuario.admin && p.criador_id !== req.usuario.id) throw falha(403, 'Só quem criou ou um admin apagam o post.');
    posts().splice(i, 1);            // a pasta no Drive fica (os arquivos de ninguém somem)
    await salvarOuDesfazer(() => posts().splice(Math.min(i, posts().length), 0, p));
    res.json({ ok: true });
  }));

  // Conferir agora a pasta de um post (botão "Atualizar" no Framyo).
  r.post('/posts/:id/conferir', autenticar, envolve(async (req, res) => {
    const p = posts().find((x) => x.id === req.params.id);
    if (!p) throw falha(404, 'Esse post não existe mais.');
    if (!p.drive_id) await pasta(p);
    await conferir(p, 0);
    await loja.salvar();
    res.json({ post: publico(p) });
  }));

  // ── lembretes (a bandeja pergunta de tempos em tempos) ──────────────────────
  r.get('/lembretes', autenticar, envolve(async (req, res) => {
    const u = req.usuario;
    if (ehMarketing(u)) return res.json({ lembretes: [] });     // marketing: nada de aviso na área de trabalho
    const saida = [];
    const meus = posts().filter((p) => !p.postado && p.data && diasAte(p.data) >= 0 && diasAte(p.data) <= 7 &&   // já postado: sem lembrete
      ((p.responsavel_id || p.criador_id) === u.id || p.criador_id === u.id));
    await emLotes(meus, 4, (p) => conferir(p, 10 * 60000));
    for (const p of meus) {
      const dias = diasAte(p.data);
      const resp = p.responsavel_id || p.criador_id;
      const enviado = p.arquivos_n > 0 || !!p.enviado_manual;
      const nome = p.titulo || (p.descricao || '').slice(0, 80);
      const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
      const av = p.avisos || (p.avisos = {});
      const base = { post: publico(p), formato: FORMATOS[p.formato], data: p.data };
      if (resp === u.id) {
        if (!enviado) {
          const etapa = dias <= 1 ? '1' : dias <= 3 ? '3' : '7';
          if (!av[etapa]) {
            av[etapa] = agora();
            saida.push(Object.assign(base, { tipo: 'pendente', etapa, titulo: dias <= 1
              ? `Seu post é ${quando} e o arquivo ainda não foi enviado`
              : `Faltam ${dias} dias para o seu post`, texto: `${FORMATOS[p.formato]} de ${ddmm(p.data)} · ${nome}`,
              rodape: 'Finalize e envie o arquivo na pasta do post no Drive' }));
          }
        } else if (dias === 1 && !av.ok) {
          av.ok = agora();
          saida.push(Object.assign(base, { tipo: 'ok', titulo: 'Seu post será postado amanhã, e validado.',
            texto: `${FORMATOS[p.formato]} de ${ddmm(p.data)} · ${nome}`, rodape: 'Nenhuma ação necessária.' }));
        }
      }
      if (p.criador_id === u.id && resp !== u.id && !enviado && dias <= 1 && !av.criador) {
        av.criador = agora();
        const r2 = pessoa(resp);
        saida.push(Object.assign(base, { tipo: 'atrasado', titulo: `O post de ${quando} de @${r2 ? r2.usuario : '?'} ainda não foi enviado`,
          texto: `${FORMATOS[p.formato]} de ${ddmm(p.data)} · ${nome}`, rodape: 'Você criou este post' }));
      }
    }
    if (saida.length) await loja.salvar();
    res.json({ lembretes: saida, hoje: hojeBR() });
  }));

  // ── Google (admin) ──────────────────────────────────────────────────────────
  r.get('/google', autenticar, (req, res) => res.json(estadoDrive()));

  r.put('/google/cliente', autenticar, soAdmin, envolve(async (req, res) => {
    const id = limpaTexto((req.body || {}).client_id, 300);
    const s = limpaTexto((req.body || {}).client_secret, 300);
    if (!/\.apps\.googleusercontent\.com$/.test(id)) throw falha(400, 'O Client ID do Google termina em “.apps.googleusercontent.com”.');
    if (s.length < 10 || /\s/.test(s)) throw falha(400, 'Esse Client Secret não parece válido. Copie de novo do Google Cloud.');
    // Confere com o Google: com um código falso, credencial errada volta "invalid_client".
    const t = await fetch(`${OAUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: id, client_secret: s, code: 'framyo-conferencia', redirect_uri: retorno }) })
      .then((x) => x.json()).catch(() => null);
    if (t && (t.error === 'invalid_client' || t.error === 'unauthorized_client')) {
      throw falha(400, 'O Google recusou esse Client ID / Client Secret. Confira se são da mesma credencial “Aplicativo da Web”.');
    }
    Object.assign(g.G(), { client_id: id, client_secret: s });
    await loja.salvar();
    res.json(estadoDrive());
  }));

  r.post('/google/iniciar', autenticar, soAdmin, envolve(async (req, res) => {
    if (!g.clientId() || !g.segredo()) throw falha(409, 'Cadastre primeiro o Client ID e o Client Secret do Google.');
    const estado = 'g' + crypto.randomBytes(24).toString('hex');
    D().oauth_estados[estado] = { criado_em: agora(), por: req.usuario.id, google: true };
    await loja.salvar();
    res.json({ url: g.urlLogin(estado) });
  }));

  r.get('/google/callback', envolve(async (req, res) => {
    const { code, state, error } = req.query;
    const pendente = state && D().oauth_estados[state];
    if (error) return res.status(400).send(pagina('Não foi possível conectar o Google', String(error) === 'access_denied' ? 'O acesso foi negado.' : String(error)));
    if (!code || !pendente || !pendente.google) return res.status(400).send(pagina('Link expirado', 'Volte ao Framyo e clique em “Conectar Google” de novo.'));
    delete D().oauth_estados[state];
    try {
      const j = await g.trocar({ grant_type: 'authorization_code', code: String(code), redirect_uri: retorno });
      if (!j.refresh_token) throw new Error('O Google não entregou o acesso permanente. Tente de novo.');
      g.guardar(j);
      const eu = await g.api('GET', '/about?fields=user(emailAddress,displayName)').catch(() => ({}));
      g.G().email = (eu.user && eu.user.emailAddress) || null;
      g.G().cache_pastas = {};
      await loja.salvar();
      res.send(pagina('Google conectado', `Conta ${g.G().email || ''}. Pode fechar esta aba e voltar ao Framyo.`));
    } catch (e) {
      await loja.salvar();
      res.status(502).send(pagina('Não foi possível conectar o Google', e.message));
    }
  }));

  r.put('/google/pasta', autenticar, soAdmin, envolve(async (req, res) => {
    if (!g.conectado()) throw falha(409, 'Conecte primeiro a conta Google.');
    const f = await g.conferirPasta((req.body || {}).link);
    Object.assign(g.G(), { raiz_id: f.id, raiz_nome: f.name, cache_pastas: {} });
    await emLotes(posts().slice(0, 30), 4, pasta);         // os posts que já existem ganham pasta
    await loja.salvar();
    res.json(estadoDrive());
  }));

  r.post('/google/desconectar', autenticar, soAdmin, envolve(async (req, res) => {
    const G = g.G();
    for (const k of ['access_token', 'refresh_token', 'expira_em', 'email']) delete G[k];
    await loja.salvar();
    res.json(estadoDrive());
  }));

  return { estadoDrive, google: g };
}

module.exports = { montarPosts, idDaPasta, hojeBR, diasAte };
