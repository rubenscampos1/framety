'use strict';

// Tasky - painel interno de tarefas da Framety.
// Usa os usuarios e a conexao Google ja mantidos pelo FramePlus, mas guarda
// toda a regra do produto dentro de `tasky` para nao misturar com posts.
const crypto = require('crypto');
const { Readable } = require('stream');

const DRIVE = process.env.FRAMYO_TESTE_GOOGLE_DRIVE || 'https://www.googleapis.com/drive/v3';
const PASTA = 'application/vnd.google-apps.folder';
const RAIZ_PADRAO = process.env.TASKY_DRIVE_ROOT_ID || '11d7X2270jDmwOtxEHu-5fVLfAVljXsx8';
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const TIMES_PADRAO = ['Framety', 'Illúdio', 'Programação', 'Ultratour'];
const CORES_TIME = ['#7c6cff', '#ff4f87', '#34d6ff', '#4ee6a8'];
const TIPOS_PADRAO = [
  { id: 'animacao-imagens-ia', nome: 'Animação de imagens com IA', pede_quantidade: true },
  { id: 'criacao-imagem-ia', nome: 'Criação de imagem com IA', pede_quantidade: true },
  { id: 'loop-inicial', nome: 'Animação de tela de loop inicial', pede_quantidade: false },
  { id: 'material-sistema', nome: 'Animação de material para sistema', pede_quantidade: false },
  { id: 'video-imersivo-finalizado', nome: 'Vídeo imersivo de cliente finalizado', pede_quantidade: false },
  { id: 'correcao-video-imersivo', nome: 'Correção em vídeo imersivo', pede_quantidade: false },
  { id: 'nova-versao-video-imersivo', nome: 'Subir nova versão de vídeo imersivo', pede_quantidade: false },
];

const texto = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const agora = () => new Date().toISOString();
const slug = (v) => texto(v, 100).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dataValida = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')));

function montarTasky({ r, loja, lojaUsuarios, autenticar, soAdmin, envolve, falha, pessoa, google, confereSenha, novoId, abrirSessao, usuarioPublico }) {
  const D = () => loja.dados;
  const U = () => lojaUsuarios.dados;
  const T = () => {
    if (!D().tasky) D().tasky = {};
    const t = D().tasky;
    if (!Array.isArray(t.times) || !t.times.length) t.times = TIMES_PADRAO.map((nome, i) => ({ id: slug(nome), nome, cor: CORES_TIME[i], ordem: i }));
    t.times.forEach((time, i) => { if (!time.cor) time.cor = CORES_TIME[i % CORES_TIME.length]; });
    if (!Array.isArray(t.tipos) || !t.tipos.length) t.tipos = TIPOS_PADRAO.map((x) => ({ ...x, ativo: true }));
    if (!Array.isArray(t.tarefas)) t.tarefas = [];
    if (!Number.isFinite(t.sequencia)) t.sequencia = 0;
    if (!t.raiz_id) { t.raiz_id = RAIZ_PADRAO; t.raiz_nome = 'RAIZ TASKY'; }
    return t;
  };
  let legadoMigrado = false;
  async function preparar() {
    await Promise.all([loja.pronto(), lojaUsuarios.pronto()]);
    T();
    if (legadoMigrado) return;
    legadoMigrado = true;
    const mapa = new Map();
    for (const antigo of D().usuarios || []) {
      const atual = U().usuarios.find((u) => u.usuario === antigo.usuario)
        || U().usuarios.find((u) => u.nome.toLocaleLowerCase('pt-BR') === antigo.nome.toLocaleLowerCase('pt-BR'));
      if (!atual) continue;
      mapa.set(antigo.id, atual.id);
      if (!atual.equipe && antigo.equipe && timePorId(antigo.equipe)) atual.equipe = antigo.equipe;
    }
    if (mapa.size) {
      for (const t of T().tarefas) {
        t.criador_id = mapa.get(t.criador_id) || t.criador_id;
        t.responsavel_id = mapa.get(t.responsavel_id) || t.responsavel_id;
        for (const m of t.mensagens || []) m.autor_id = mapa.get(m.autor_id) || m.autor_id;
        for (const h of t.historico || []) h.por_id = mapa.get(h.por_id) || h.por_id;
      }
      await Promise.all([loja.salvar(), lojaUsuarios.salvar()]);
    }
  }
  r.use('/tasky', (req, res, next) => preparar().then(() => next(), next));

  let revisao = 0;
  const ouvintes = new Set();
  function publicar(tipo, tarefa) {
    revisao += 1;
    const dados = JSON.stringify({ revisao, tipo: tipo || 'mudou', tarefa_id: tarefa && tarefa.id });
    for (const o of [...ouvintes]) {
      if (tarefa && !podeVer(o.usuario, tarefa)) continue;
      try { o.res.write(`event: mudou\ndata: ${dados}\n\n`); } catch { ouvintes.delete(o); }
    }
  }

  const segredoMidia = crypto.randomBytes(32);
  const membro = (u) => ({ ...usuarioPublico(u), equipe: u.equipe || null });
  const usuarioPorId = (id) => U().usuarios.find((u) => u.id === id && u.ativo !== false);
  const tipoPorId = (id) => T().tipos.find((x) => x.id === id);
  const timePorId = (id) => T().times.find((x) => x.id === id);
  const tarefaPorId = (id) => T().tarefas.find((x) => x.id === id || x.slug === id);
  const podeVer = (u, t) => !!(u.admin || t.criador_id === u.id || t.responsavel_id === u.id || (u.equipe && t.time_id === u.equipe));
  const podeEditar = (u, t) => !!(u.admin || t.criador_id === u.id);
  const podeConversar = (u, t) => !!(u.admin || t.criador_id === u.id || t.responsavel_id === u.id);
  const historico = (t, por, acao, detalhe) => {
    (t.historico || (t.historico = [])).push({ id: novoId('h_'), por_id: por && por.id, acao, detalhe: detalhe || '', em: agora() });
  };

  function nomePasta(t) {
    const cliente = slug(t.cliente || 'sem-cliente').slice(0, 35);
    const tipo = slug((tipoPorId(t.tipo_id) || {}).nome || 'task').slice(0, 42);
    return `${t.codigo} - ${cliente} - ${tipo}`;
  }

  async function garantirPasta(t) {
    if (!google.conectado()) { t.drive_erro = 'A conta Google ainda nao foi conectada no FramePlus.'; return; }
    try {
      const d = new Date(t.criado_em);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')} ${MESES[d.getMonth()]}`;
      const pai = await google.pastaFilha(T().raiz_id, mes);
      if (!t.drive_id) {
        const f = await google.api('POST', '/files?supportsAllDrives=true&fields=id', { name: nomePasta(t), mimeType: PASTA, parents: [pai] });
        t.drive_id = f.id;
      }
      t.drive_pai = pai;
      delete t.drive_erro;
    } catch (e) { t.drive_erro = e.message; }
  }

  async function conferirArquivos(t, forcar) {
    if (!t.drive_id || !google.conectado()) return;
    if (!forcar && t.arquivos_em && Date.now() - Date.parse(t.arquivos_em) < 120000) return;
    try {
      const q = `'${t.drive_id}' in parents and trashed = false`;
      const qs = new URLSearchParams({ q, supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '100',
        fields: 'files(id,name,mimeType,size,webViewLink,thumbnailLink,createdTime)' });
      const j = await google.api('GET', `/files?${qs}`);
      t.arquivos = (j.files || []).filter((f) => f.mimeType !== PASTA).sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true }))
        .map((f) => ({ id: f.id, nome: f.name, tipo: f.mimeType, tamanho: Number(f.size) || 0, url: f.webViewLink, criado_em: f.createdTime }));
      t.arquivos_em = agora();
      delete t.drive_erro;
    } catch (e) { t.drive_erro = e.message; }
  }

  function assinar(tarefa, arquivo, modo, exp) {
    return crypto.createHmac('sha256', segredoMidia).update(`${tarefa}|${arquivo}|${modo}|${exp}`).digest('hex').slice(0, 32);
  }
  function linkMidia(tarefa, arquivo, modo) {
    const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
    return `/api/framyo/tasky/midia/${encodeURIComponent(tarefa)}/${encodeURIComponent(arquivo)}?modo=${modo}&exp=${exp}&sig=${assinar(tarefa, arquivo, modo, exp)}`;
  }

  function publico(t, u, completo) {
    const tipo = tipoPorId(t.tipo_id);
    const time = timePorId(t.time_id);
    const arquivos = (t.arquivos || []).map((a) => ({ ...a, capa: linkMidia(t.id, a.id, 'capa'), arquivo: linkMidia(t.id, a.id, 'arquivo') }));
    return {
      id: t.id, slug: t.slug, codigo: t.codigo, tipo: tipo || { id: t.tipo_id, nome: 'Tipo removido' }, time: time || { id: t.time_id, nome: 'Time removido' },
      urgencia: t.urgencia, prazo: t.prazo || null, quantidade: t.quantidade || null, cliente: t.cliente || '', comentario: t.comentario || '',
      assets_url: t.assets_url || '', final_url: t.final_url || '', status: t.status, criado_em: t.criado_em, atualizado_em: t.atualizado_em,
      resgatado_em: t.resgatado_em || null, concluido_em: t.concluido_em || null, criador: membro(usuarioPorId(t.criador_id) || { id: t.criador_id, nome: 'Usuario removido' }),
      responsavel: t.responsavel_id ? membro(usuarioPorId(t.responsavel_id) || { id: t.responsavel_id, nome: 'Usuario removido' }) : null,
      drive_url: t.drive_id ? `https://drive.google.com/drive/folders/${t.drive_id}` : null, drive_erro: t.drive_erro || null,
      arquivos, arquivos_em: t.arquivos_em || null, mensagens_n: (t.mensagens || []).length,
      permissoes: { editar: podeEditar(u, t), excluir: podeEditar(u, t), resgatar: !!u.equipe && u.equipe === t.time_id && !t.responsavel_id && t.status === 'aberta', conversar: podeConversar(u, t), admin: !!u.admin },
      ...(completo ? { mensagens: (t.mensagens || []).map((m) => ({ ...m, autor: membro(usuarioPorId(m.autor_id) || { id: m.autor_id, nome: 'Usuario removido' }) })),
        historico: (t.historico || []).map((h) => ({ ...h, por: h.por_id ? membro(usuarioPorId(h.por_id) || { id: h.por_id, nome: 'Usuario removido' }) : null })) } : {}),
    };
  }

  r.post('/tasky/frameplus/sessao', autenticar, (req, res) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    res.json({ token, usuario: membro(req.usuario) });
  });

  r.post('/tasky/cadastro', (req, res) => res.status(403).json({ erro: 'Crie e gerencie os usuarios pelo FramePlus.' }));

  r.post('/tasky/login', envolve(async (req, res) => {
    const nome = texto((req.body || {}).nome, 150).toLocaleLowerCase('pt-BR');
    const senha = String((req.body || {}).senha || '');
    const u = U().usuarios.find((x) => x.ativo !== false && (x.nome.toLocaleLowerCase('pt-BR') === nome || x.usuario === nome.replace(/^@/, '')));
    if (!u || !confereSenha(senha, u.senha)) throw falha(401, 'Nome ou senha incorretos.');
    const token = abrirSessao(u);
    await lojaUsuarios.salvar();
    res.json({ token, usuario: membro(u) });
  }));

  r.get('/tasky/inicio', autenticar, envolve(async (req, res) => {
    const lista = T().tarefas.filter((t) => podeVer(req.usuario, t));
    await Promise.all(lista.filter((t) => t.drive_id).slice(0, 12).map((t) => conferirArquivos(t, false)));
    res.json({ usuario: membro(req.usuario), times: T().times, tipos: T().tipos.filter((x) => x.ativo !== false),
      membros: U().usuarios.filter((u) => u.ativo !== false && u.equipe && u.equipe === req.usuario.equipe).map(membro),
      tarefas: lista.sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em)).map((t) => publico(t, req.usuario, false)),
      raiz_url: `https://drive.google.com/drive/folders/${T().raiz_id}` });
  }));

  r.get('/tasky/stream', autenticar, (req, res) => {
    res.status(200);
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders && res.flushHeaders();
    const ouvinte = { usuario: req.usuario, res };
    ouvintes.add(ouvinte);
    res.write(`event: pronto\ndata: ${JSON.stringify({ revisao })}\n\n`);
    const pulso = setInterval(() => { try { res.write(': pulso\n\n'); } catch { clearInterval(pulso); } }, 25000);
    req.on('close', () => { clearInterval(pulso); ouvintes.delete(ouvinte); });
  });

  r.get('/tasky/tarefas/:id', autenticar, envolve(async (req, res) => {
    const t = tarefaPorId(req.params.id);
    if (!t || !podeVer(req.usuario, t)) throw falha(404, 'Task nao encontrada.');
    await conferirArquivos(t, false);
    res.json({ tarefa: publico(t, req.usuario, true) });
  }));

  r.post('/tasky/tarefas', autenticar, envolve(async (req, res) => {
    const b = req.body || {};
    const tipo = tipoPorId(texto(b.tipo_id, 80));
    const time = timePorId(texto(b.time_id, 80));
    if (!tipo || tipo.ativo === false) throw falha(400, 'Escolha um tipo de task.');
    if (!time) throw falha(400, 'Escolha o time que vai receber a task.');
    if (!req.usuario.admin && req.usuario.equipe && time.id === req.usuario.equipe) throw falha(400, 'A task deve ser enviada para outro time.');
    if (!dataValida(b.prazo)) throw falha(400, 'Data maxima invalida.');
    const quantidade = tipo.pede_quantidade ? Math.max(1, Math.min(999, Number(b.quantidade) || 0)) : null;
    if (tipo.pede_quantidade && !Number(b.quantidade)) throw falha(400, 'Informe a quantidade de imagens.');
    T().sequencia += 1;
    const codigo = `TASK-${String(T().sequencia).padStart(4, '0')}`;
    const t = { id: novoId('tk_'), slug: crypto.randomBytes(9).toString('base64url'), codigo, seq: T().sequencia, tipo_id: tipo.id, time_id: time.id,
      urgencia: ['baixa', 'normal', 'alta', 'urgente'].includes(b.urgencia) ? b.urgencia : 'normal', prazo: texto(b.prazo, 10) || null,
      quantidade, cliente: texto(b.cliente, 120), comentario: texto(b.comentario, 4000), assets_url: texto(b.assets_url, 1000), final_url: texto(b.final_url, 1000),
      status: 'aberta', criador_id: req.usuario.id, responsavel_id: null, criado_em: agora(), atualizado_em: agora(), mensagens: [], historico: [] };
    historico(t, req.usuario, 'criada', `Enviada para ${time.nome}`);
    T().tarefas.push(t);
    await garantirPasta(t);
    await loja.salvar();
    publicar('criada', t);
    res.json({ tarefa: publico(t, req.usuario, true) });
  }));

  r.put('/tasky/tarefas/:id', autenticar, envolve(async (req, res) => {
    const t = tarefaPorId(req.params.id);
    if (!t || !podeVer(req.usuario, t)) throw falha(404, 'Task nao encontrada.');
    const b = req.body || {};
    if (podeEditar(req.usuario, t)) {
      if (b.tipo_id !== undefined) { const x = tipoPorId(texto(b.tipo_id, 80)); if (!x) throw falha(400, 'Tipo invalido.'); t.tipo_id = x.id; }
      if (b.time_id !== undefined && !t.responsavel_id) { const x = timePorId(texto(b.time_id, 80)); if (!x) throw falha(400, 'Time invalido.'); t.time_id = x.id; }
      if (b.urgencia !== undefined && ['baixa', 'normal', 'alta', 'urgente'].includes(b.urgencia)) t.urgencia = b.urgencia;
      if (b.prazo !== undefined) { if (!dataValida(b.prazo)) throw falha(400, 'Data invalida.'); t.prazo = texto(b.prazo, 10) || null; }
      for (const [k, n] of [['cliente', 120], ['comentario', 4000], ['assets_url', 1000]]) if (b[k] !== undefined) t[k] = texto(b[k], n);
      if (b.quantidade !== undefined) t.quantidade = Math.max(1, Math.min(999, Number(b.quantidade) || 1));
    }
    if (b.final_url !== undefined && (podeEditar(req.usuario, t) || t.responsavel_id === req.usuario.id)) t.final_url = texto(b.final_url, 1000);
    if (b.status !== undefined && (req.usuario.admin || t.responsavel_id === req.usuario.id || t.criador_id === req.usuario.id)) {
      if (!['aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada'].includes(b.status)) throw falha(400, 'Status invalido.');
      if (b.status === 'concluida' && !t.responsavel_id) throw falha(400, 'A task precisa ser resgatada antes de concluir.');
      t.status = b.status;
      t.concluido_em = b.status === 'concluida' ? (t.concluido_em || agora()) : null;
    }
    t.atualizado_em = agora();
    historico(t, req.usuario, 'editada', b.status ? `Status: ${b.status}` : 'Dados atualizados');
    await loja.salvar();
    publicar('editada', t);
    res.json({ tarefa: publico(t, req.usuario, true) });
  }));

  r.post('/tasky/tarefas/:id/resgatar', autenticar, envolve(async (req, res) => {
    const t = tarefaPorId(req.params.id);
    if (!t || !podeVer(req.usuario, t)) throw falha(404, 'Task nao encontrada.');
    if (!req.usuario.equipe || req.usuario.equipe !== t.time_id) throw falha(403, 'Somente um membro do time destinatario pode resgatar.');
    if (t.responsavel_id) throw falha(409, 'Outra pessoa ja resgatou esta task.');
    if (t.status !== 'aberta') throw falha(409, 'Esta task nao esta aberta para resgate.');
    t.responsavel_id = req.usuario.id; t.resgatado_em = agora(); t.status = 'em_andamento'; t.atualizado_em = agora();
    historico(t, req.usuario, 'resgatada', 'Responsavel definido');
    await loja.salvar();
    publicar('resgatada', t);
    res.json({ tarefa: publico(t, req.usuario, true) });
  }));

  r.post('/tasky/tarefas/:id/duplicar', autenticar, envolve(async (req, res) => {
    const origem = tarefaPorId(req.params.id);
    if (!origem || !podeVer(req.usuario, origem)) throw falha(404, 'Task nao encontrada.');
    T().sequencia += 1;
    const t = { ...origem, id: novoId('tk_'), slug: crypto.randomBytes(9).toString('base64url'), codigo: `TASK-${String(T().sequencia).padStart(4, '0')}`,
      status: 'aberta', criador_id: req.usuario.id, responsavel_id: null, criado_em: agora(), atualizado_em: agora(), resgatado_em: null, concluido_em: null,
      drive_id: null, drive_pai: null, drive_erro: null, arquivos: [], arquivos_em: null, mensagens: [], historico: [] };
    historico(t, req.usuario, 'duplicada', `Criada a partir de ${origem.codigo}`);
    T().tarefas.push(t); await garantirPasta(t); await loja.salvar(); publicar('criada', t);
    res.json({ tarefa: publico(t, req.usuario, true) });
  }));

  r.delete('/tasky/tarefas/:id', autenticar, envolve(async (req, res) => {
    const i = T().tarefas.findIndex((x) => x.id === req.params.id || x.slug === req.params.id);
    const t = T().tarefas[i];
    if (!t || !podeEditar(req.usuario, t)) throw falha(404, 'Task nao encontrada.');
    T().tarefas.splice(i, 1); // A pasta permanece no Drive: nunca apagamos arquivos finais por esta tela.
    await loja.salvar(); publicar('excluida'); res.json({ ok: true });
  }));

  r.post('/tasky/tarefas/:id/mensagens', autenticar, envolve(async (req, res) => {
    const t = tarefaPorId(req.params.id);
    if (!t || !podeVer(req.usuario, t)) throw falha(404, 'Task nao encontrada.');
    if (!podeConversar(req.usuario, t)) throw falha(403, 'O chat e do solicitante e de quem resgatou a task.');
    const mensagem = texto((req.body || {}).mensagem, 4000);
    if (!mensagem) throw falha(400, 'Escreva uma mensagem.');
    const m = { id: novoId('m_'), autor_id: req.usuario.id, mensagem, em: agora() };
    (t.mensagens || (t.mensagens = [])).push(m); t.atualizado_em = agora();
    await loja.salvar(); publicar('mensagem', t); res.json({ mensagem: { ...m, autor: membro(req.usuario) } });
  }));

  r.post('/tasky/tarefas/:id/arquivos', autenticar, envolve(async (req, res) => {
    const t = tarefaPorId(req.params.id);
    if (!t || !podeVer(req.usuario, t)) throw falha(404, 'Task nao encontrada.');
    if (!t.drive_id) await garantirPasta(t);
    await conferirArquivos(t, true); await loja.salvar(); publicar('arquivos', t);
    res.json({ tarefa: publico(t, req.usuario, true) });
  }));

  r.get('/tasky/midia/:id/:arquivo', envolve(async (req, res) => {
    const t = tarefaPorId(req.params.id); const a = t && (t.arquivos || []).find((x) => x.id === req.params.arquivo);
    const modo = req.query.modo === 'arquivo' ? 'arquivo' : 'capa'; const exp = Number(req.query.exp) || 0;
    const certa = assinar(req.params.id, req.params.arquivo, modo, exp); const recebida = String(req.query.sig || '');
    if (!a || exp < Date.now() / 1000 || recebida.length !== certa.length || !crypto.timingSafeEqual(Buffer.from(recebida), Buffer.from(certa))) throw falha(403, 'Link de previa vencido.');
    const auth = { Authorization: `Bearer ${await google.token()}` }; let r2;
    if (modo === 'capa') {
      const f = await google.api('GET', `/files/${encodeURIComponent(a.id)}?fields=thumbnailLink&supportsAllDrives=true`).catch(() => ({}));
      if (f.thumbnailLink) r2 = await fetch(f.thumbnailLink.replace(/=s\d+$/, '=s1200'), { headers: auth }).catch(() => null);
      if ((!r2 || !r2.ok) && /^image\//.test(a.tipo || '')) r2 = await fetch(`${DRIVE}/files/${encodeURIComponent(a.id)}?alt=media&supportsAllDrives=true`, { headers: auth });
      if (!r2 || !r2.ok) throw falha(404, 'O Drive ainda esta processando a previa.');
      res.set({ 'Content-Type': r2.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' });
    } else {
      const cab = { ...auth, ...(req.headers.range ? { Range: req.headers.range } : {}) };
      r2 = await fetch(`${DRIVE}/files/${encodeURIComponent(a.id)}?alt=media&supportsAllDrives=true`, { headers: cab });
      if (!r2.ok && r2.status !== 206) throw falha(502, 'O Google Drive nao entregou o arquivo.');
      res.status(r2.status);
      for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) { const v = r2.headers.get(k); if (v) res.set(k, v); }
    }
    Readable.fromWeb(r2.body).on('error', () => res.destroy()).pipe(res);
  }));

  // Painel administrativo: visao global, tipos, times e vinculo dos usuarios.
  r.get('/tasky/admin', autenticar, soAdmin, envolve(async (req, res) => {
    res.json({ times: T().times, tipos: T().tipos, usuarios: U().usuarios.filter((u) => u.ativo !== false).map(membro),
      tarefas: T().tarefas.map((t) => publico(t, req.usuario, false)), raiz_id: T().raiz_id,
      raiz_url: `https://drive.google.com/drive/folders/${T().raiz_id}` });
  }));
  r.put('/tasky/admin/usuarios/:id', autenticar, soAdmin, envolve(async (req, res) => {
    const u = usuarioPorId(req.params.id); if (!u) throw falha(404, 'Usuario nao encontrado.');
    const b = req.body || {};
    if (b.equipe !== undefined) { const equipe = texto(b.equipe, 80); if (equipe && !timePorId(equipe)) throw falha(400, 'Time invalido.'); u.equipe = equipe || null; }
    if (b.admin !== undefined) u.admin = !!b.admin;
    if (b.ativo !== undefined) { if (u.id === req.usuario.id && !b.ativo) throw falha(400, 'Voce nao pode remover seu proprio acesso.'); u.ativo = !!b.ativo; }
    await lojaUsuarios.salvar(); publicar('usuarios'); res.json({ usuario: membro(u) });
  }));
  r.post('/tasky/admin/tipos', autenticar, soAdmin, envolve(async (req, res) => {
    const nome = texto((req.body || {}).nome, 120); if (nome.length < 3) throw falha(400, 'Informe o nome do tipo.');
    let id = slug(nome), n = 2; while (tipoPorId(id)) id = `${slug(nome)}-${n++}`;
    const x = { id, nome, pede_quantidade: !!(req.body || {}).pede_quantidade, ativo: true }; T().tipos.push(x); await loja.salvar(); publicar('config'); res.json({ tipo: x });
  }));
  r.put('/tasky/admin/tipos/:id', autenticar, soAdmin, envolve(async (req, res) => {
    const x = tipoPorId(req.params.id); if (!x) throw falha(404, 'Tipo nao encontrado.');
    if ((req.body || {}).nome !== undefined) x.nome = texto(req.body.nome, 120) || x.nome;
    if ((req.body || {}).pede_quantidade !== undefined) x.pede_quantidade = !!req.body.pede_quantidade;
    if ((req.body || {}).ativo !== undefined) x.ativo = !!req.body.ativo;
    await loja.salvar(); publicar('config'); res.json({ tipo: x });
  }));
  r.post('/tasky/admin/times', autenticar, soAdmin, envolve(async (req, res) => {
    const nome = texto((req.body || {}).nome, 80); if (nome.length < 2) throw falha(400, 'Informe o nome do time.');
    let id = slug(nome), n = 2; while (timePorId(id)) id = `${slug(nome)}-${n++}`;
    const x = { id, nome, cor: texto((req.body || {}).cor, 20) || CORES_TIME[T().times.length % CORES_TIME.length], ordem: T().times.length }; T().times.push(x); await loja.salvar(); publicar('config'); res.json({ time: x });
  }));
  r.put('/tasky/admin/times/:id', autenticar, soAdmin, envolve(async (req, res) => {
    const x = timePorId(req.params.id); if (!x) throw falha(404, 'Time nao encontrado.');
    const b = req.body || {};
    if (b.nome !== undefined) x.nome = texto(b.nome, 80) || x.nome;
    if (b.cor !== undefined && /^#[0-9a-f]{6}$/i.test(b.cor)) x.cor = b.cor;
    await loja.salvar(); publicar('config'); res.json({ time: x });
  }));
  r.put('/tasky/admin/raiz', autenticar, soAdmin, envolve(async (req, res) => {
    const link = texto((req.body || {}).link, 1000); const m = link.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || link.match(/^([A-Za-z0-9_-]{10,})$/);
    if (!m) throw falha(400, 'Cole o link da pasta raiz do Google Drive.');
    const f = await google.api('GET', `/files/${m[1]}?supportsAllDrives=true&fields=id,name,mimeType,capabilities(canAddChildren)`);
    if (f.mimeType !== PASTA || (f.capabilities && f.capabilities.canAddChildren === false)) throw falha(400, 'A conta conectada precisa poder editar essa pasta.');
    T().raiz_id = f.id; T().raiz_nome = f.name; await loja.salvar(); publicar('config'); res.json({ raiz_id: f.id, raiz_url: `https://drive.google.com/drive/folders/${f.id}` });
  }));

  return {
    estado: T,
    avisosPara(fp, visto) {
      const u = U().usuarios.find((x) => x.id === fp.id && x.ativo !== false);
      const sequencia = T().sequencia || 0;
      if (!u) return { seq: sequencia, avisos: [] };
      const n = Number(visto) || 0;
      const avisos = T().tarefas.filter((t) => {
        const seq = Number(t.seq) || Number(String(t.codigo || '').replace(/\D/g, '')) || 0;
        return seq > n && t.criador_id !== u.id && (u.admin || (u.equipe && t.time_id === u.equipe));
      }).slice(-50).map((t) => ({ seq: Number(t.seq) || Number(String(t.codigo || '').replace(/\D/g, '')) || 0,
        id: t.id, slug: t.slug, codigo: t.codigo, cliente: t.cliente, tipo: (tipoPorId(t.tipo_id) || {}).nome || 'Task',
        urgencia: t.urgencia, time: (timePorId(t.time_id) || {}).nome || '', por: membro(usuarioPorId(t.criador_id) || { id: t.criador_id, nome: 'Usuario removido' }) }));
      return { seq: sequencia, avisos };
    },
  };
}

module.exports = { montarTasky };
