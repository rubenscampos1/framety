const express = require('express');
const compression = require('compression');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { scryptSync, timingSafeEqual } = crypto;
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DIR = __dirname;
// Uploads live on a persistent disk in production (Render disk mounted at
// UPLOADS_DIR, e.g. /var/data/uploads) so they survive deploys/restarts.
// Falls back to a local ./uploads folder for dev.
const UPLOADS = process.env.UPLOADS_DIR || path.join(DIR, 'uploads');

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

const USE_PG = !!process.env.DATABASE_URL;
// DB_FILE permite subir uma instância isolada (teste) sem tocar no banco real.
const DB_FILE = process.env.DB_FILE || path.join(DIR, 'framety-db.json');

const pool = USE_PG ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
}) : null;

// ── JSON "database" ───────────────────────────────────────────────────────────
const SEED = {
  settings: {
    admin_pass: '0000',
    producoes_pass: '1111',
    recovery_token: 'FRAMY@AUVISU0819R',
    reel_url: '', reel_name: '',
    aiSection: {
      eyebrow: '— 07 / Inteligência Artificial',
      title: 'Introducing the future',
      subtitle: 'Geração de cenas com inteligência artificial.',
      body: 'A IA permite criar imagens exclusivas e sob medida para cada produção, algo que bancos de vídeo simplesmente não oferecem. Em vez de adaptar sua história a clipes genéricos e repetidos por dezenas de outros projetos, você gera exatamente o que imaginou — com mais rapidez, menor custo e total originalidade. O resultado é uma identidade visual única, sem depender de material limitado ou licenças caras. É mais liberdade criativa na mão de quem produz. Prompts únicos e precisos para alcançar o máximo de encanto.',
      features: [
        'Exclusividade — cada imagem é única, sem risco de aparecer em outras produções',
        'Personalização total — cenários, épocas, cores e atmosferas criados sob demanda',
        'Custo reduzido — sem gastos com licenciamento de clipes ou assinaturas de bancos',
        'Agilidade — geração em minutos, sem horas de busca e filtragem',
        'Liberdade criativa — a imagem serve à história, não o contrário',
        'Acessibilidade — produções de qualquer orçamento podem ter visual sofisticado',
        'Identidade visual forte — diferencia o projeto no mercado desde o primeiro frame',
      ],
      items: [
        { id: 'ai-1', title: 'Voice Assistant', imageUrl: '' },
        { id: 'ai-2', title: 'AI Image Generation', imageUrl: '' },
        { id: 'ai-3', title: 'AI Chatbot + Local RAG', imageUrl: '' },
        { id: 'ai-4', title: 'AI Agent', imageUrl: '' },
        { id: 'ai-5', title: 'Visual Understanding', imageUrl: '' },
      ],
    },
    tutorial_video_url: 'https://www.youtube.com/watch?v=myIpuwCCIOA',
    tutorial_title: 'Recebeu a primeira versão do seu vídeo e não sabe como solicitar alterações?',
    tutorial_subtitle: 'Siga este guia rápido para esclarecer suas dúvidas!',
    tutorial_text: '<p>Este tutorial mostra passo a passo como solicitar revisões e alterações nos seus vídeos usando o <strong>Frame.io</strong> — nossa plataforma de aprovação e feedback.</p>\n\n<h3>O que você vai aprender:</h3>\n<ul>\n<li>Como acessar a plataforma e visualizar seu projeto</li>\n<li>Como adicionar comentários precisos no timing exato do vídeo</li>\n<li>Como marcar áreas específicas da imagem com anotações</li>\n<li>Como aprovar versões finais</li>\n</ul>\n\n<p>Em caso de dúvidas, fale conosco pelo <strong>WhatsApp (62) 3705-1697</strong> ou e-mail <strong>comercial@skylineip.com.br</strong>.</p>',
  },
  categories: [
    { id: 'comerciais', name: 'Comerciais', desc: 'Filmes publicitários para marcas que pensam grande.', bgClass: 'bg-comm', size: 'size-lg', coverUrl: null, sortOrder: 0 },
    { id: 'videoclipes', name: 'Videoclipes', desc: 'Estética musical, narrativa visual, atitude.', bgClass: 'bg-music', size: 'size-md', coverUrl: null, sortOrder: 1 },
    { id: 'documentarios', name: 'Documentários', desc: 'Histórias reais, captadas com cuidado e tempo.', bgClass: 'bg-doc', size: 'size-sm', coverUrl: null, sortOrder: 2 },
    { id: 'branded', name: 'Inteligência artificial', desc: 'Conteúdo com narrativa para construir marca.', bgClass: 'bg-brand', size: 'size-sm', coverUrl: null, sortOrder: 3 },
    { id: 'aftermovies', name: 'Aftermovies', desc: 'Eventos, festivais e ativações em alta voltagem.', bgClass: 'bg-after', size: 'size-sm', coverUrl: null, sortOrder: 4 },
  ],
  clients: [
    { id: 'atlas', name: 'Atlas Motors', logoUrl: null, sortOrder: 0 },
    { id: 'saturn', name: 'Saturn Festival', logoUrl: null, sortOrder: 1 },
    { id: 'nova', name: 'Nova / Sony Music', logoUrl: null, sortOrder: 2 },
    { id: 'wwf', name: 'WWF Brasil', logoUrl: null, sortOrder: 3 },
    { id: 'pulse', name: 'Pulse Wear', logoUrl: null, sortOrder: 4 },
    { id: 'orla', name: 'Orla Bank', logoUrl: null, sortOrder: 5 },
    { id: 'mira', name: 'Mira / Indep.', logoUrl: null, sortOrder: 6 },
    { id: 'bienal', name: 'Bienal SP', logoUrl: null, sortOrder: 7 },
  ],
  partners: [],
  videos: [
    { id: 'v01', title: 'Atlas Motors — Onde a estrada termina', category: 'comerciais', catLabel: 'Comercial', client: 'Atlas Motors', year: '2026', duration: '02:14', director: 'L. Borges', tags: ['Auto', 'Branded'], featured: true, status: 'live', views: '1.2M', videoUrl: null, sortOrder: 0 },
    { id: 'v02', title: 'Saturn Live — Aftermovie', category: 'aftermovies', catLabel: 'Aftermovie', client: 'Saturn Festival', year: '2025', duration: '03:42', director: 'M. Chen', tags: ['Festival', 'Música'], featured: true, status: 'live', views: '847K', videoUrl: null, sortOrder: 1 },
    { id: 'v03', title: 'Nova — Single Visualizer', category: 'videoclipes', catLabel: 'Videoclipe', client: 'Nova / Sony Music', year: '2025', duration: '04:08', director: 'L. Borges', tags: ['Música', 'Performance'], featured: true, status: 'live', views: '2.4M', videoUrl: null, sortOrder: 2 },
    { id: 'v04', title: 'Mata Atlântica — Documentário', category: 'documentarios', catLabel: 'Documentário', client: 'WWF Brasil', year: '2025', duration: '26:00', director: 'A. Rivera', tags: ['Doc', 'Natureza'], featured: true, status: 'live', views: '312K', videoUrl: null, sortOrder: 3 },
    { id: 'v05', title: 'Pulse — Manifesto da marca', category: 'branded', catLabel: 'Branded', client: 'Pulse Wear', year: '2025', duration: '01:48', director: 'M. Chen', tags: ['Branded', 'Moda'], featured: false, status: 'live', views: '503K', videoUrl: null, sortOrder: 4 },
    { id: 'v06', title: 'Orla — Filme de lançamento', category: 'comerciais', catLabel: 'Comercial', client: 'Orla Bank', year: '2025', duration: '01:20', director: 'L. Borges', tags: ['Branded', 'Finanças'], featured: false, status: 'live', views: '688K', videoUrl: null, sortOrder: 5 },
    { id: 'v07', title: 'Mira — Rooftop Sessions', category: 'videoclipes', catLabel: 'Videoclipe', client: 'Mira / Indep.', year: '2024', duration: '03:32', director: 'A. Rivera', tags: ['Música', 'Live'], featured: false, status: 'draft', views: '—', videoUrl: null, sortOrder: 6 },
    { id: 'v08', title: 'Pavilhão — Bienal SP', category: 'documentarios', catLabel: 'Doc', client: 'Bienal SP', year: '2024', duration: '12:30', director: 'M. Chen', tags: ['Doc', 'Arte'], featured: false, status: 'live', views: '94K', videoUrl: null, sortOrder: 7 },
  ],
  // ── Locuções (OS) + Links — merged in from the standalone sistema-os-skyline tool ──
  locucoesPages: [
    { id: 'pg_default', title: 'Locuções', rows: [
      { uid: 'r1', sel: true, os: null, id: '#SKY167', data: '08/06/2026', cliente: 'HCON', produto: '360 MALL', projeto: 'IMERSIVO', empreendimento: '360 MALL', categoria: '', minutagem: '2 MIN', veiculacao: '6 MESES', locutor: 'FABIANO', status: 'RECEBIDO', valor: 'R$ 1.400,00', liberado: 'SIM' },
      { uid: 'r2', sel: false, os: null, id: '#SKY169', data: '03/07/2026', cliente: 'FAZENDA CANOA', produto: 'FAZENDA CANOA', projeto: 'EMPREENDIMENTO PRONTO', empreendimento: 'FAZENDA CANOA', categoria: '', minutagem: '2 MIN', veiculacao: '6 MESES', locutor: 'FABIANO', status: 'RECEBIDO', valor: 'R$ 1.400,00', liberado: 'SIM' },
      { uid: 'r3', sel: true, os: null, id: '#SKY170', data: '25/05/2026', cliente: 'EMPREENDIMENTO', produto: 'L ESSENCE', projeto: 'IMERSIVO', empreendimento: 'L ESSENCE', categoria: '', minutagem: '2 MIN', veiculacao: '6 MESES', locutor: 'DESERT STUDIOS', status: 'RECEBIDO', valor: 'R$ 120,00', liberado: 'SIM' },
      { uid: 'r0', sel: false, os: null, id: '#SKY166', data: '17/04/2026', cliente: 'HCON', produto: 'INSTITUCIONAL', projeto: 'INSTITUCIONAL', empreendimento: 'INSTITUCIONAL', categoria: '', minutagem: '2 MIN', veiculacao: '6 MESES', locutor: 'FABIANO', status: 'RECEBIDO', valor: 'R$ 35,00', liberado: 'SIM' },
      { uid: 'r4', sel: true, id: '#SKY171', data: '16/06/2026', cliente: 'HSM', produto: 'QUINTA DAS MANGUEIRAS', projeto: 'IMERSIVO ESPANHOL', empreendimento: 'QUINTA DAS MANGUEIRAS', categoria: '', minutagem: '3 MIN', veiculacao: '', locutor: 'BATUKI/PAULINHO', status: 'RECEBIDO', valor: 'R$ 5.000,00', liberado: 'SIM',
        os: { date: '06/07/2026', servicoId: '#SKY171', emissao: '16/06/2026', responsavel: 'Rubens Campos', empresa: 'Skyline Inovação', projeto: 'HSM - QUINTA DAS MANGUEIRAS', tipoServico: 'pack locuções extrangeiras em off', fornecedor: 'BATUKI', responsavel2: 'PAULINHO', banner: 'ATENÇÃO AOS DADOS NO CAMPO "DADOS PARA FATURAMENTO" PARA EMISSÃO DA NOTA FISCAL', fatNome: 'SKYLINE INOVACAO E PRODUCOES LTDA', fatCnpj: '23.240.029/0001-46', fatEndereco: 'Rua 5, S/N Quadra 16 Lote 21 CIDADE JARDIM\nANÁPOLIS - GO 75080-730', descNota: '" Referente ao job #SKY171 "', descricao: '1x Loc em off de 3 min em espanhol nativo\n1x Loc em off de 3 min em inglês nativo', infoAdicionais: 'nenhuma', nota1: '• NFS recebidas entre os dias 01 e 15 do mês, pagamento dia 05 do mês seguinte;', nota2: '• NFS recebidas entre os dias 16 e 30 do mês, pagamento dia 25 do mês seguinte;', anexoLabel: 'Anexar esse documento junto a nota fiscal, no link :', pipefyLink: 'https://app.pipefy.com/public/form/J1LvfGLJ', pixNote: 'Adicionar a chave pix junto aos dados bancários.', valorTotal: 'R$ 5.000,00', formaPagamento: 'Pix', logoSkyline: null, logoFramety: null, customSobre: [], customFat: [] },
      },
      { uid: 'r5', sel: false, os: null, id: '#SKY171', data: '', cliente: 'HSM', produto: 'QUINTA DAS MANGUEIRAS', projeto: 'IMERSIVO INGLÊS', empreendimento: 'QUINTA DAS MANGUEIRAS', categoria: '', minutagem: '3 MIN', veiculacao: '', locutor: 'BATUKI/PAULINHO', status: 'RECEBIDO', valor: '', liberado: 'SIM' },
      { uid: 'r6', sel: false, os: null, id: '#SKY171-B', data: '16/06/2026', cliente: 'HSM', produto: 'QUINTA DAS MANGUEIRAS', projeto: 'IMERSIVO PORTUGUÊS', empreendimento: 'QUINTA DAS MANGUEIRAS', categoria: '', minutagem: '3 MIN', veiculacao: '', locutor: 'FABIANO', status: 'RECEBIDO', valor: '', liberado: 'SIM' },
      { uid: 'r7', sel: true, os: null, id: '#SKY173', data: '25/05/2026', cliente: 'AVIVA', produto: 'INSTITUCIONAL', projeto: 'IMERSIVO', empreendimento: 'INSTITUCIONAL', categoria: '', minutagem: '2 MIN', veiculacao: '6 MESES', locutor: 'DESERT STUDIOS', status: 'RECEBIDO', valor: 'R$ 110,00', liberado: 'SIM' },
      { uid: 'r8', sel: true, os: null, id: '#SKY182', data: '08/06/2026', cliente: 'HCON', produto: 'INSTITUCIONAL', projeto: 'REEDIÇÃO INSTITUCIONAL', empreendimento: 'INSTITUCIONAL', categoria: '', minutagem: '2 MIN', veiculacao: '6 MESES', locutor: 'FABIANO', status: 'RECEBIDO', valor: 'R$ 1.200,00', liberado: 'SIM' },
      { uid: 'r9', sel: true, os: null, id: '#SKY185', data: '08/06/2026', cliente: 'BRASIL TERRENOS', produto: 'BURITI GARDEN', projeto: 'IMERSIVO', empreendimento: 'BURITI GARDEN', categoria: '', minutagem: '2 MIN', veiculacao: 'ND', locutor: 'GUSTAVO ZOUAIN', status: 'RECEBIDO', valor: 'R$ 1.300,00', liberado: 'SIM' },
      { uid: 'r10', sel: true, os: null, id: '#SKY189', data: '08/06/2026', cliente: 'EBM', produto: 'METROPOLITAN MARISTA', projeto: 'VEM AÍ VERTICAL', empreendimento: 'METROPOLITAN MARISTA', categoria: '', minutagem: '60"', veiculacao: '6 MESES', locutor: 'FABIANO', status: 'RECEBIDO', valor: 'R$ 2.900,00', liberado: 'SIM' },
    ] },
    { id: 'pg_1783368354785', title: 'Campanhas', rows: [] },
  ],
  locucoesActivePageId: 'pg_default',
  locucoesCad: {
    clientes: ['AVIVA', 'BRASIL TERRENOS', 'EBM', 'EMPREENDIMENTO', 'FAZENDA CANOA', 'HCON', 'HSM'],
    projetos: ['EMPREENDIMENTO PRONTO', 'IMERSIVO', 'IMERSIVO ESPANHOL', 'IMERSIVO INGLÊS', 'IMERSIVO PORTUGUÊS', 'INSTITUCIONAL', 'REEDIÇÃO INSTITUCIONAL', 'VEM AÍ VERTICAL'],
    empreendimentos: ['360 MALL', 'BURITI GARDEN', 'FAZENDA CANOA', 'INSTITUCIONAL', 'L ESSENCE', 'METROPOLITAN MARISTA', 'QUINTA DAS MANGUEIRAS'],
    categorias: ['Institucional', 'Imersivo', 'Externa'],
  },
  linkRedirects: [
    { slug: 'rodolfo', target: 'https://www.google.com.br', category: 'Clientes', clicks: 3, createdAt: '2026-07-06T22:01:58.018Z', lastAccessedAt: '2026-07-06T22:03:46.309Z' },
  ],
  storyboards: [],
};

async function loadDB() {
  if (!USE_PG) {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return JSON.parse(JSON.stringify(SEED)); }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      CONSTRAINT single_row CHECK (id = 1)
    )
  `);
  const res = await pool.query('SELECT data FROM store WHERE id = 1');
  return res.rows.length ? res.rows[0].data : JSON.parse(JSON.stringify(SEED));
}

async function saveDB(data) {
  if (!USE_PG) {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
    return;
  }
  await pool.query(
    `INSERT INTO store (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [data]
  );
}

// ── Password helpers (scrypt, backward-compatible with plain text) ────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith('scrypt:')) return password === stored; // legacy plain text
  const [, salt, hash] = stored.split(':');
  try {
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(Buffer.from(hash, 'hex'), derived);
  } catch { return false; }
}

// ── Minimal HTML sanitizer (allowlist tags, strips scripts/handlers/style) ────
const ALLOWED_TAGS = new Set(['p','br','strong','b','em','i','u','h2','h3','h4','ul','ol','li','a','blockquote','code','pre','span','div']);
const ALLOWED_ATTRS = { a: new Set(['href','target','rel']) };
function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  str = str.replace(/<\s*(script|style|iframe|object|embed|svg|math|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  str = str.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi, '');
  str = str.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  str = str.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  str = str.replace(/j[\s ]*a[\s ]*v[\s ]*a[\s ]*s[\s ]*c[\s ]*r[\s ]*i[\s ]*p[\s ]*t[\s ]*:/gi, '');
  return str.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (full.startsWith('</')) return `</${t}>`;
    const allowedSet = ALLOWED_ATTRS[t];
    if (!allowedSet) return `<${t}>`;
    const safeAttrs = [];
    attrs.replace(/([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, name, _q, v1, v2) => {
      const n = name.toLowerCase();
      const v = v1 ?? v2;
      if (allowedSet.has(n) && /^https?:\/\//i.test(v)) safeAttrs.push(`${n}="${v.replace(/"/g, '&quot;')}"`);
    });
    return `<${t}${safeAttrs.length ? ' ' + safeAttrs.join(' ') : ''}>`;
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Transforma um caminho do site em URL absoluta para as meta tags sociais.
// Quem já é absoluto (Cloudinary) passa direto. `PUBLIC_ORIGIN` permite fixar o
// domínio final quando o Host que chega não é o público.
function absoluteUrl(req, urlOrPath) {
  const v = String(urlOrPath || '');
  if (/^https?:\/\//i.test(v)) return v;
  const fixed = String(process.env.PUBLIC_ORIGIN || '').replace(/\/+$/, '');
  if (fixed) return fixed + (v.startsWith('/') ? v : '/' + v);
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return v;
  return `${proto}://${host}${v.startsWith('/') ? v : '/' + v}`;
}

function unlinkUpload(urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/uploads/')) return;
  // O caminho tem de ser montado a partir de UPLOADS, não de DIR: com um disco
  // persistente (UPLOADS_DIR=/var/data/uploads) a pasta fica FORA do projeto, e
  // montar por DIR gerava um caminho que nunca casava com a checagem abaixo —
  // toda remoção virava silenciosamente um nada, e os arquivos se acumulavam
  // no disco para sempre.
  const filePath = path.join(UPLOADS, urlPath.slice('/uploads/'.length));
  // continua barrando ../: o join normaliza e o prefixo tem de bater.
  if (!filePath.startsWith(UPLOADS + path.sep)) return;
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}

// Derives the Cloudinary public_id from a secure_url when it wasn't stored
// alongside the asset (e.g. rows written before public_id was tracked).
// …/upload/v1234567890/framety/abc123.jpg  →  framety/abc123
function cloudinaryPublicId(url) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com')) return null;
  const m = url.match(/\/upload\/(?:[^/]+\/)*?v\d+\/(.+?)(?:\.[a-z0-9]+)?$/i);
  return m ? m[1] : null;
}

// Removes one uploaded asset from whichever backend holds it. Local files go
// through unlinkUpload; Cloudinary assets are destroyed by public_id (stored on
// the record, or recovered from the URL). Best-effort: never throws.
async function destroyAsset(url, publicId, resourceType) {
  if (!url && !publicId) return;
  if (typeof url === 'string' && url.startsWith('/uploads/')) return unlinkUpload(url);
  const id = publicId || cloudinaryPublicId(url);
  if (!id || !USE_CLOUDINARY) return;
  try {
    await cloudinary.uploader.destroy(id, { resource_type: resourceType || 'image', invalidate: true });
  } catch (e) { console.error('[cloudinary destroy]', id, e.message); }
}

let db;
const save = () => saveDB(db).catch(e => console.error('[db save]', e));

// ── Auth ──────────────────────────────────────────────────────────────────────
// Sets (not single tokens) so multiple people can be logged in at the same time
// without kicking each other out. Capped to bound memory.
const MAX_TOKENS = 200;
const sessionTokens = new Set();          // full admin sessions
const producoesRoTokens = new Set();      // scoped, read-only "Produções" share sessions
function issueToken(set) {
  const token = crypto.randomBytes(32).toString('hex');
  set.add(token);
  if (set.size > MAX_TOKENS) set.delete(set.values().next().value); // evict oldest
  return token;
}
const requireAuth = (req, res, next) => {
  if (sessionTokens.has(req.headers['x-auth-token'])) return next();
  res.status(401).json({ error: 'Unauthorized' });
};
// Accepts the full admin token OR the read-only Produções token. Guards only the
// Produções READ / status-change endpoints — every other admin route keeps
// requireAuth (full only).
const requireLocucoesRead = (req, res, next) => {
  const t = req.headers['x-auth-token'];
  if (sessionTokens.has(t) || producoesRoTokens.has(t)) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// ── Live updates (SSE) ────────────────────────────────────────────────────────
const sseClients = new Set();
function broadcast(domain) {
  const payload = `event: change\ndata: ${JSON.stringify({ domain })}\n\n`;
  for (const res of sseClients) { try { res.write(payload); } catch (e) { /* ignore */ } }
}

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (_, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname)}`),
});
const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime|x-msvideo|mpeg))/;
const upload = multer({
  storage,
  limits: { fileSize: 600 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) return cb(new Error('Tipo de arquivo não permitido.'), false);
    cb(null, true);
  },
});

// ── Storage backend: Cloudinary (durable, survives deploys) when CLOUDINARY_URL
//    is set; otherwise the local disk (dev). Runs after multer; exposes the final
//    URL to store in the DB as `req.uploadedUrl`. Uploads to Cloudinary stream
//    from the temp file on disk (no large RAM buffers), then remove the temp. ──
const USE_CLOUDINARY = !!process.env.CLOUDINARY_URL;
if (USE_CLOUDINARY) { try { cloudinary.config({ secure: true }); } catch (e) { console.error('[cloudinary config]', e.message); } }
async function storeUpload(req, res, next) {
  if (!req.file) return next();
  if (!USE_CLOUDINARY) { req.uploadedUrl = `/uploads/${req.file.filename}`; return next(); }
  try {
    const isVideo = /^video\//.test(req.file.mimetype);
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'framety',
      resource_type: isVideo ? 'video' : 'image',
    });
    fs.unlink(req.file.path, () => {}); // drop the temp file
    req.uploadedUrl = result.secure_url;
    req.uploadedPublicId = result.public_id; // needed to destroy the asset later
    next();
  } catch (e) {
    fs.unlink(req.file.path, () => {});
    next(e);
  }
}

// ── gzip text responses (HTML/CSS/JS/JSON). Skips SSE (event-stream) so the
//    real-time /api/events stream is never buffered. Media (mp4/png/jpg) is
//    already compressed and is skipped by compression's default filter. ──
app.use(compression({
  filter: (req, res) => {
    const ct = String(res.getHeader('Content-Type') || '');
    if (ct.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));

// O console grava o deck inteiro num PUT só (páginas, textos e o histórico de
// versões de cada cena). Um storyboard longo passa folgado dos 100kb que o
// express assume por padrão, e o pedido morreria com 413 no meio do trabalho.
app.use(express.json({ limit: '4mb' }));

// ── Live-update broadcast hook ────────────────────────────────────────────────
// After any successful (2xx) write to /api/*, tell all connected browsers which
// data domain changed so they re-fetch. Centralized here to avoid editing every
// write endpoint. The SSE stream itself is defined as GET /api/events below.
// (App-level middleware + full-path match: `req.path` here is the full
// "/api/…" — a mounted app.use('/api',…) would see req.url restored by finish-time.)
app.use((req, res, next) => {
  if (req.method === 'GET' || !req.path.startsWith('/api/')) return next();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const p = req.path;
    let domain = null;
    // storyboards vem PRIMEIRO: /api/upload/storyboard/:id também casa com a
    // regra de `content` abaixo, e caindo lá as imagens do deck não chegavam
    // em tempo real para as outras sessões.
    if (/^\/api\/(storyboards|sb)\b/.test(p) || /^\/api\/upload\/storyboard\b/.test(p)) domain = 'storyboards';
    else if (/^\/api\/(videos|categories|clients|upload|ai-section|tutorial|reel|partners)/.test(p)) domain = 'content';
    else if (/^\/api\/(locucoes|producoes\/status)/.test(p)) domain = 'locucoes';
    else if (/^\/api\/redirects/.test(p)) domain = 'redirects';
    if (domain) broadcast(domain);
  });
  next();
});

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://www.youtube.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com https://i3.ytimg.com https://res.cloudinary.com",
    "frame-src https://www.youtube.com https://player.vimeo.com",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://lottie.host https://unpkg.com",
    "media-src 'self' blob: https://res.cloudinary.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '));
  next();
});

// ── Block sensitive files from static serving ─────────────────────────────────
app.use((req, res, next) => {
  const p = req.path;
  if (/(^|\/)\./.test(p)) return res.status(403).end();
  if (/^\/server\.js$/i.test(p)) return res.status(403).end();
  if (/framety-db\.json/i.test(p)) return res.status(403).end();
  if (/\.json$/i.test(p) && !/^\/uploads\//i.test(p)) return res.status(403).end();
  next();
});

// ── SPA Routing (Friendly URLs) ───────────────────────────────────────────────
const SPA_ROUTES = ['/', '/Framety', '/framety', '/framety/*', '/console', '/console/*', '/presentation', '/presentation/*', '/cadastroparceiro', '/tutorial', '/producoes', '/assistir', '/assistir/*', '/screendimension', '/screendimension/*', '/sb', '/sb/*', '/storyboards', '/storyboards/*'];

app.get(SPA_ROUTES, (req, res) => {
  const entryPath = path.join(DIR, 'Framety.html');
  if (!fs.existsSync(entryPath)) return res.status(404).send('Entry file not found');

  let html = fs.readFileSync(entryPath, 'utf8');

  let title = "Framety";
  let desc = "Cinema© para marcas que pensam em movimento. Uma empresa do Grupo Skyline.";
  let image = "/framety_social_preview.png";

  const p = req.path.toLowerCase();

  const catMatch = p.match(/\/framety\/categoria\/([^/]+)/);
  if (catMatch) {
    const catId = decodeURIComponent(catMatch[1]);
    const cat = db.categories.find(c => c.id === catId);
    if (cat) {
      title = `${cat.name} | Framety`;
      desc = `${cat.desc || ""} Produtora audiovisual especializada no mercado imobiliário.`.trim();
      if (cat.coverUrl) image = cat.coverUrl;
    }
  }

  const vidMatch = p.match(/\/framety\/video\/([^/]+)/);
  if (vidMatch) {
    const vidId = decodeURIComponent(vidMatch[1]);
    const vid = db.videos.find(v => v.id === vidId);
    if (vid) {
      title = `${vid.title} | Framety`;
      desc = `${vid.description ? vid.description.replace(/<[^>]*>?/gm, '').substring(0, 160) : ""} Produtora audiovisual especializada no mercado imobiliário.`.trim();
      if (vid.thumbUrl) {
        image = vid.thumbUrl;
      } else {
        const ytMatch = vid.videoUrl?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (ytMatch) image = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
      }
    }
  }

  if (p === '/screendimension' || p.startsWith('/screendimension/')) {
    title = "Configurador de Sala Imersiva | Framety";
    desc = "Ferramenta de dimensionamento de projeções para salas imersivas.";
  }

  if (p === '/sb' || p.startsWith('/sb/') || p === '/storyboards' || p.startsWith('/storyboards/')) {
    const sb = p.startsWith('/storyboards/')
      ? (db.storyboards || []).find(s => s.pathSlug === p.slice('/storyboards/'.length))
      : (db.storyboards || []).find(s => s.shareSlug === p.split('/')[2]);
    title = sb ? `Storyboard — ${sb.cliente || 'Framety'} | ${sb.projeto || ''}`.trim() : "Storyboard | Framety";
    desc = "Storyboard para aprovação — visualize as cenas e envie seus comentários.";
    // A capa enviada no console é o que aparece ao colar o link no WhatsApp.
    if (sb && sb.coverUrl) image = sb.coverUrl;
  }

  const eTitle = escapeHtml(title);
  const eDesc = escapeHtml(desc);
  // og:image PRECISA ser absoluta: WhatsApp, Telegram e Facebook buscam a imagem
  // fora do contexto da página e não resolvem caminho relativo — com "/foo.png"
  // o link simplesmente aparece sem miniatura. Atrás do proxy do Render o
  // protocolo real vem no x-forwarded-proto (a conexão interna é http).
  const eImage = escapeHtml(absoluteUrl(req, image));
  const metaHtml = `
    <title>${eTitle}</title>
    <meta name="description" content="${eDesc}">
    <meta property="og:title" content="${eTitle}">
    <meta property="og:description" content="${eDesc}">
    <meta property="og:image" content="${eImage}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${eTitle}">
    <meta name="twitter:description" content="${eDesc}">
    <meta name="twitter:image" content="${eImage}">
  `;

  html = html.replace(/<title>.*?<\/title>/, metaHtml);
  res.send(html);
});

// Uploaded media: filenames are unique per upload (timestamp+hash) and never
// change content, so they can be cached immutably for a year. This is the big
// win — repeat visitors don't re-download the videos/images.
// (Registered BEFORE the repo-root handler because the uploads folder lives
// inside DIR — otherwise the generic handler would serve it with the short TTL.)
app.use('/uploads', express.static(UPLOADS, { maxAge: '365d', immutable: true, etag: true }));
// Repo assets (css/js/jsx/html): revalidate every load via ETag ('no-cache' =
// "you may cache, but always check with me first"). The browser gets a tiny 304
// when nothing changed and the fresh file the instant it does — so a deploy (or a
// local edit) shows up immediately, with no stale-code mismatch and no hard-refresh.
app.use(express.static(DIR, { etag: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

// ── Login rate limiter (max 10 attempts per 15 min per IP) ───────────────────
const loginAttempts = new Map();
function loginRateCheck(ip) {
  const now = Date.now();
  const WINDOW = 15 * 60 * 1000;
  const MAX = 10;
  const rec = loginAttempts.get(ip) || { count: 0, resetAt: now + WINDOW };
  if (now >= rec.resetAt) { rec.count = 0; rec.resetAt = now + WINDOW; }
  if (rec.count >= MAX) { loginAttempts.set(ip, rec); return false; }
  rec.count++;
  loginAttempts.set(ip, rec);
  return true;
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!loginRateCheck(ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  // Scoped, read-only "Produções" share session — verified against the SEPARATE
  // Produções password, issues a token that only unlocks GET /api/locucoes.
  if (req.body.scope === 'producoes-ro') {
    if (!verifyPassword(req.body.password, db.settings.producoes_pass)) return res.status(401).json({ error: 'Senha incorreta.' });
    return res.json({ token: issueToken(producoesRoTokens), scope: 'producoes-ro' });
  }
  if (!verifyPassword(req.body.password, db.settings.admin_pass)) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  res.json({ token: issueToken(sessionTokens) });
});

app.post('/api/auth/password', requireAuth, (req, res) => {
  const { current, next } = req.body;
  if (!verifyPassword(current, db.settings.admin_pass)) return res.status(401).json({ error: 'Senha atual incorreta.' });
  if (!next || next.length < 4) return res.status(400).json({ error: 'Nova senha deve ter no mínimo 4 caracteres.' });
  db.settings.admin_pass = hashPassword(next);
  save();
  res.json({ ok: true });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  sessionTokens.delete(req.headers['x-auth-token']);
  res.json({ ok: true });
});

// ── Password recovery (admin token) ───────────────────────────────────────────
// "Esqueci a senha" → digitar o admin token para redefinir a senha do console.
app.post('/api/auth/recover-with-token', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!loginRateCheck(ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  const { token, next } = req.body || {};
  if (!token || token !== db.settings.recovery_token) return res.status(401).json({ error: 'Admin token inválido.' });
  if (!next || next.length < 4) return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
  db.settings.admin_pass = hashPassword(next);
  sessionTokens.clear(); // recovery → invalidate all sessions, force re-login
  save();
  res.json({ ok: true });
});

// ── Produções section password ────────────────────────────────────────────────
// A second, section-only password (default 1111). Gates the Produções tab even
// for a logged-in admin, and is the same password used for the external share.
app.post('/api/producoes/unlock', requireAuth, (req, res) => {
  if (!verifyPassword(req.body.password, db.settings.producoes_pass)) return res.status(401).json({ error: 'Senha da seção incorreta.' });
  res.json({ ok: true });
});
app.post('/api/producoes/password', requireAuth, (req, res) => {
  const { next } = req.body || {};
  if (!next || next.length < 4) return res.status(400).json({ error: 'A senha deve ter no mínimo 4 caracteres.' });
  db.settings.producoes_pass = hashPassword(next);
  save();
  res.json({ ok: true });
});

// Scoped status update — allowed for the read-only share token (external users
// can change ONLY a row's status; "PAGO" auto-marks the row as concluded).
const PRODUCOES_STATUSES = new Set(['RECEBIDO', 'A RECEBER', 'PAGO', 'PENDENTE', 'CANCELADO']);
app.post('/api/producoes/status', requireLocucoesRead, (req, res) => {
  const { pageId, uid, status } = req.body || {};
  if (!PRODUCOES_STATUSES.has(status)) return res.status(400).json({ error: 'Status inválido.' });
  const page = (db.locucoesPages || []).find(p => p.id === pageId);
  if (!page) return res.status(404).json({ error: 'Página não encontrada.' });
  const row = (page.rows || []).find(r => r.uid === uid);
  if (!row) return res.status(404).json({ error: 'Linha não encontrada.' });
  row.status = status;
  if (status === 'PAGO') row.sel = true;
  save();
  res.json({ ok: true, sel: row.sel });
});

// ── Live updates stream (SSE) ─────────────────────────────────────────────────
// Public: only ever emits tiny domain tags (never data), so anyone can subscribe.
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx/Render)
  });
  res.write('retry: 3000\n\n');
  sseClients.add(res);
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});

// ── Data (public + admin) ─────────────────────────────────────────────────────
app.get('/api/data', (req, res) => {
  const sorted = (arr) => [...arr].sort((a, b) => a.sortOrder - b.sortOrder);
  const isAuthed = sessionTokens.has(req.headers['x-auth-token']);
  const publicVideos = isAuthed ? db.videos : db.videos.filter(v => v.status !== 'draft');
  const cats = sorted(db.categories).map(c => ({
    ...c,
    count: db.videos.filter(v => v.category === c.id && v.status !== 'draft').length,
    lastUpdated: db.videos
      .filter(v => v.category === c.id && v.status !== 'draft' && v.updatedAt)
      .map(v => v.updatedAt)
      .sort()
      .at(-1) || null,
  }));
  res.json({
    brand: { name: 'Framety', tagline: 'Produtora audiovisual', location: 'São Paulo, BR', year: '2026' },
    bgChoices: ['bg-comm', 'bg-music', 'bg-doc', 'bg-brand', 'bg-after', 'bg-corp'],
    categories: cats,
    videos: sorted(publicVideos),
    clients: sorted(db.clients),
    reel: { url: db.settings.reel_url || '', name: db.settings.reel_name || '' },
    aiSection: db.settings.aiSection || JSON.parse(JSON.stringify(SEED.settings.aiSection)),
  });
});

// ── Videos ────────────────────────────────────────────────────────────────────
app.put('/api/videos/reorder', requireAuth, (req, res) => {
  if (!Array.isArray(req.body.order)) return res.status(400).json({ error: 'order must be array' });
  req.body.order.forEach((id, i) => {
    const v = db.videos.find(x => x.id === id);
    if (v) v.sortOrder = i;
  });
  save();
  res.json({ ok: true });
});

app.post('/api/videos', requireAuth, (req, res) => {
  if (!req.body || !req.body.title) return res.status(400).json({ error: 'Título obrigatório.' });
  const id = 'v' + crypto.randomBytes(4).toString('hex');
  const maxOrder = db.videos.reduce((m, v) => Math.max(m, v.sortOrder ?? 0), 0);
  const body = { ...req.body };
  if (typeof body.description === 'string') body.description = sanitizeHtml(body.description);
  db.videos.push({ ...body, id, sortOrder: maxOrder + 1, updatedAt: new Date().toISOString() });
  save();
  res.json({ id });
});

app.put('/api/videos/:id', requireAuth, (req, res) => {
  const idx = db.videos.findIndex(v => v.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const body = { ...req.body };
  if (typeof body.description === 'string') body.description = sanitizeHtml(body.description);
  db.videos[idx] = { ...db.videos[idx], ...body, id: req.params.id, updatedAt: new Date().toISOString() };
  save();
  res.json({ ok: true });
});

app.delete('/api/videos/:id', requireAuth, (req, res) => {
  const v = db.videos.find(v => v.id === req.params.id);
  if (v) {
    unlinkUpload(v.thumbUrl);
    unlinkUpload(v.videoUrl);
  }
  db.videos = db.videos.filter(v => v.id !== req.params.id);
  save();
  res.status(204).end();
});

// ── Categories ────────────────────────────────────────────────────────────────
app.put('/api/categories/reorder', requireAuth, (req, res) => {
  if (!Array.isArray(req.body.order)) return res.status(400).json({ error: 'order must be array' });
  req.body.order.forEach((id, i) => {
    const c = db.categories.find(x => x.id === id);
    if (c) c.sortOrder = i;
  });
  save();
  res.json({ ok: true });
});

app.get('/api/categories', (req, res) => {
  res.json([...db.categories].sort((a, b) => a.sortOrder - b.sortOrder).map(c => ({
    ...c, count: db.videos.filter(v => v.category === c.id && v.status !== 'draft').length,
  })));
});

app.post('/api/categories', requireAuth, (req, res) => {
  const maxOrder = db.categories.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0);
  db.categories.push({ ...req.body, sortOrder: maxOrder + 1 });
  save();
  res.json({ id: req.body.id });
});

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const idx = db.categories.findIndex(c => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const newId = (typeof req.body.id === 'string' && req.body.id.trim()) ? req.body.id.trim() : req.params.id;
  if (newId !== req.params.id) {
    if (db.categories.find(c => c.id === newId)) return res.status(409).json({ error: 'Slug já em uso.' });
    db.videos.forEach(v => { if (v.category === req.params.id) v.category = newId; });
  }
  db.categories[idx] = { ...db.categories[idx], ...req.body, id: newId };
  save();
  res.json({ ok: true, newId });
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  const cat = db.categories.find(c => c.id === req.params.id);
  if (cat) unlinkUpload(cat.coverUrl);
  db.categories = db.categories.filter(c => c.id !== req.params.id);
  save();
  res.status(204).end();
});

// ── Clients ───────────────────────────────────────────────────────────────────
app.get('/api/clients', (req, res) => {
  res.json([...db.clients].sort((a, b) => a.sortOrder - b.sortOrder));
});

app.post('/api/clients', requireAuth, (req, res) => {
  const maxOrder = db.clients.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0);
  db.clients.push({ ...req.body, sortOrder: maxOrder + 1 });
  save();
  res.json({ id: req.body.id });
});

app.put('/api/clients/:id', requireAuth, (req, res) => {
  const idx = db.clients.findIndex(c => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  db.clients[idx] = { ...db.clients[idx], ...req.body, id: req.params.id };
  save();
  res.json({ ok: true });
});

app.delete('/api/clients/:id', requireAuth, (req, res) => {
  const client = db.clients.find(c => c.id === req.params.id);
  if (client) unlinkUpload(client.logoUrl);
  db.clients = db.clients.filter(c => c.id !== req.params.id);
  save();
  res.status(204).end();
});

// ── AI Section ────────────────────────────────────────────────────────────────
app.put('/api/ai-section', requireAuth, (req, res) => {
  const { eyebrow, title, subtitle, body, features, items } = req.body;
  const current = db.settings.aiSection || {};
  if (typeof eyebrow === 'string') current.eyebrow = eyebrow.slice(0, 120);
  if (typeof title === 'string') current.title = title.slice(0, 120);
  if (typeof subtitle === 'string') current.subtitle = subtitle.slice(0, 240);
  if (typeof body === 'string') current.body = body.slice(0, 2000);
  if (Array.isArray(features)) current.features = features.map(f => String(f).slice(0, 240));
  if (Array.isArray(items)) {
    current.items = items.map(item => ({
      id: String(item.id || '').slice(0, 40),
      title: String(item.title || '').slice(0, 120),
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl.slice(0, 500) : '',
    }));
  }
  db.settings.aiSection = current;
  save();
  res.json({ ok: true });
});

app.post('/api/upload/ai-image/:itemId', requireAuth, upload.single('file'), storeUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const ai = db.settings.aiSection;
  if (!ai || !Array.isArray(ai.items)) {
    unlinkUpload(req.uploadedUrl);
    return res.status(404).json({ error: 'AI section not found' });
  }
  const item = ai.items.find(i => i.id === req.params.itemId);
  if (!item) {
    unlinkUpload(req.uploadedUrl);
    return res.status(404).json({ error: 'Item not found' });
  }
  unlinkUpload(item.imageUrl);
  item.imageUrl = req.uploadedUrl;
  save();
  res.json({ url: item.imageUrl });
});

// ── Uploads ───────────────────────────────────────────────────────────────────
app.post('/api/upload/reel', requireAuth, upload.single('file'), storeUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  unlinkUpload(db.settings.reel_url);
  const url = req.uploadedUrl;
  db.settings.reel_url = url;
  db.settings.reel_name = req.file.originalname;
  save();
  res.json({ url, name: req.file.originalname });
});

app.delete('/api/upload/reel', requireAuth, (req, res) => {
  unlinkUpload(db.settings.reel_url);
  db.settings.reel_url = '';
  db.settings.reel_name = '';
  save();
  res.status(204).end();
});

app.post('/api/upload/cover/:catId', requireAuth, upload.single('file'), storeUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const cat = db.categories.find(c => c.id === req.params.catId);
  if (!cat) {
    unlinkUpload(req.uploadedUrl);
    return res.status(404).json({ error: 'Category not found' });
  }
  unlinkUpload(cat.coverUrl);
  const url = req.uploadedUrl;
  cat.coverUrl = url;
  save();
  res.json({ url });
});

app.post('/api/upload/logo/:clientId', requireAuth, upload.single('file'), storeUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const client = db.clients.find(c => c.id === req.params.clientId);
  if (!client) {
    unlinkUpload(req.uploadedUrl);
    return res.status(404).json({ error: 'Client not found' });
  }
  unlinkUpload(client.logoUrl);
  const url = req.uploadedUrl;
  client.logoUrl = url;
  save();
  res.json({ url });
});

app.post('/api/upload/thumb', requireAuth, upload.single('file'), storeUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: req.uploadedUrl });
});

// ── Partners ──────────────────────────────────────────────────────────────────
const partnerRateLimit = new Map();
function rlAllow(ip) {
  const now = Date.now();
  const arr = (partnerRateLimit.get(ip) || []).filter(t => now - t < 3600000);
  if (arr.length >= 5) { partnerRateLimit.set(ip, arr); return false; }
  arr.push(now);
  partnerRateLimit.set(ip, arr);
  return true;
}
const trim = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');

app.post('/api/partners', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!rlAllow(ip)) return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 hora.' });

  const nome = trim(req.body.nome, 120);
  const cidade = trim(req.body.cidade, 120);
  const email = trim(req.body.email, 200);
  const contato = trim(req.body.contato, 60);
  const tipoServico = trim(req.body.tipoServico, 80);
  const equipamento = trim(req.body.equipamento, 1000);
  const portfolio = trim(req.body.portfolio, 500);
  const mediaValor = trim(req.body.mediaValor, 60);

  if (!nome || !cidade || !email || !tipoServico || !equipamento) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (portfolio && !/^https?:\/\//i.test(portfolio)) {
    return res.status(400).json({ error: 'URL de portfólio deve começar com http:// ou https://.' });
  }
  const id = 'p' + crypto.randomBytes(4).toString('hex');
  const entry = { id, nome, cidade, email, contato, tipoServico, equipamento, portfolio, mediaValor, createdAt: new Date().toISOString() };
  db.partners.unshift(entry);
  save();
  res.json({ ok: true, id });
});

app.get('/api/partners', requireAuth, (req, res) => {
  res.json(db.partners);
});

app.delete('/api/partners/:id', requireAuth, (req, res) => {
  db.partners = db.partners.filter(p => p.id !== req.params.id);
  save();
  res.status(204).end();
});

// ── Tutorial ──────────────────────────────────────────────────────────────────
app.get('/api/tutorial', (req, res) => {
  res.json({
    videoUrl: db.settings.tutorial_video_url || '',
    title: db.settings.tutorial_title || '',
    subtitle: db.settings.tutorial_subtitle || '',
    text: db.settings.tutorial_text || '',
  });
});

app.post('/api/tutorial', requireAuth, (req, res) => {
  const { videoUrl, title, subtitle, text } = req.body;
  if (typeof videoUrl === 'string') {
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) return res.status(400).json({ error: 'URL inválida.' });
    db.settings.tutorial_video_url = videoUrl.slice(0, 500);
  }
  if (typeof title === 'string') db.settings.tutorial_title = title.slice(0, 240);
  if (typeof subtitle === 'string') db.settings.tutorial_subtitle = subtitle.slice(0, 240);
  if (typeof text === 'string') db.settings.tutorial_text = sanitizeHtml(text);
  save();
  res.json({ ok: true });
});

// ── Locuções (OS) — whole-blob read/replace ──────────────────────────────────
// READ allows the full admin token OR the read-only share token; WRITE stays
// admin-only, so shared (read-only) users can never persist changes.
app.get('/api/locucoes', requireLocucoesRead, (req, res) => {
  res.json({ pages: db.locucoesPages, activePageId: db.locucoesActivePageId, cad: db.locucoesCad });
});
app.post('/api/locucoes', requireAuth, (req, res) => {
  const { pages, activePageId, cad } = req.body || {};
  if (!Array.isArray(pages)) return res.status(400).json({ error: 'pages deve ser uma lista.' });
  db.locucoesPages = pages;
  db.locucoesActivePageId = activePageId != null ? activePageId : db.locucoesActivePageId;
  if (cad && typeof cad === 'object') db.locucoesCad = cad;
  save();
  res.json({ ok: true });
});

// ── Storyboards ───────────────────────────────────────────────────────────────
// Admin builds the deck; the client reviews it through a public share slug.
// Client-facing routes are unauthenticated by design (the slug IS the secret),
// so every write they can reach is narrow: append a comment, submit a round,
// or approve. They can never edit pages.
// V1 e mais SB_ROUNDS rodadas de alteração — o documento para na V4. Cada cena
// tem a sua própria contagem, com o mesmo teto (ver storyboard.jsx).
const SB_MAX_VERSION = 4;
const SB_ROUNDS = SB_MAX_VERSION - 1;
const SB_STATUSES = ['v1', 'v2', 'v3', 'v4', 'aprovado'];
const SB_DISCLAIMER = 'Todo o conteúdo apresentado neste material consiste em representações e projeções baseadas no roteiro, não refletindo necessariamente o resultado final. Alguns elementos poderão sofrer alterações ao longo do desenvolvimento. Este material pode incluir conteúdos gerados por computação gráfica e/ou inteligência artificial.';

const sbId = (p) => p + crypto.randomBytes(5).toString('hex');
const sbNow = () => new Date().toISOString();

function sbNewSlug() {
  let slug;
  do { slug = crypto.randomBytes(6).toString('hex'); }
  while (db.storyboards.some(s => s.shareSlug === slug));
  return slug;
}

// ── URL amigável: /storyboards/<cliente>/<produto>/<projeto> ─────────────────
// O caminho é derivado dos dados do card, então muda junto com eles. Como dois
// storyboards podem ter o mesmo trio, o último segmento ganha um sufixo -2, -3…
// para manter o caminho único.
function sbSlugify(str, fallback) {
  const s = String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

function sbBuildPath(sb) {
  const base = [
    sbSlugify(sb.cliente, 'cliente'),
    sbSlugify(sb.produto, 'produto'),
    sbSlugify(sb.projeto, 'projeto'),
  ];
  const taken = (p) => db.storyboards.some(s => s.id !== sb.id && s.pathSlug === p);
  let path = base.join('/');
  for (let n = 2; taken(path); n++) path = [base[0], base[1], `${base[2]}-${n}`].join('/');
  return path;
}

// The starting deck every new storyboard opens with (matches the printed model):
// cover → disclaimer → assets → first scene → closing cover.
function sbDefaultPages() {
  return [
    { id: sbId('pg_'), type: 'cover' },
    { id: sbId('pg_'), type: 'disclaimer', text: SB_DISCLAIMER },
    { id: sbId('pg_'), type: 'assets', title: 'ASSETS', items: [] },
    { id: sbId('pg_'), type: 'scene', imageUrl: '', imagePublicId: '', imageVersion: 1, imageSince: null, imageHistory: [], placeholder: '', locucao: '', visual: '', sfx: '' },
    { id: sbId('pg_'), type: 'end' },
  ];
}

// Every asset referenced by a deck, so deleting a storyboard can clean up storage.
// Inclui o histórico de versões: a imagem que o cliente viu na V1 continua
// guardada na página e também precisa sair do armazenamento junto com o deck.
function sbAssets(sb) {
  const out = [];
  const push = (url, publicId) => { if (url) out.push({ url, publicId }); };
  push(sb.coverUrl, sb.coverPublicId);   // a capa também sai do armazenamento
  for (const pg of sb.pages || []) {
    if (pg.type === 'scene') {
      push(pg.imageUrl, pg.imagePublicId);
      for (const h of pg.imageHistory || []) push(h.url, h.publicId);
    }
    if (pg.type === 'assets') for (const it of pg.items || []) {
      push(it.url, it.publicId);
      for (const h of it.history || []) push(h.url, h.publicId);
    }
  }
  return out;
}

// Porteiro do deck que chega numa gravação. Devolve a razão da recusa, ou null
// quando o desenho está de pé. Não reescreve nada: campos novos de página
// continuam passando sozinhos — o que se checa aqui é só o que, se vier errado,
// destruiria o documento sem chance de desfazer.
const SB_PAGE_TYPES = new Set(['cover', 'disclaimer', 'assets', 'scene', 'end']);
const SB_MAX_PAGES = 300;
function sbPagesProblem(pages) {
  if (!Array.isArray(pages)) return 'Formato de páginas inválido.';
  if (!pages.length) return 'Um storyboard não pode ficar sem páginas.';
  if (pages.length > SB_MAX_PAGES) return `Limite de ${SB_MAX_PAGES} páginas por storyboard.`;
  const ids = new Set();
  for (const pg of pages) {
    if (!pg || typeof pg !== 'object' || Array.isArray(pg)) return 'Página inválida no documento.';
    if (typeof pg.id !== 'string' || !pg.id) return 'Página sem identificador.';
    if (!SB_PAGE_TYPES.has(pg.type)) return `Tipo de página desconhecido: ${String(pg.type).slice(0, 40)}`;
    // ids repetidos quebram o React e, pior, fazem comentário de uma página
    // aparecer em outra (o vínculo é por pageId).
    if (ids.has(pg.id)) return 'Há páginas com o mesmo identificador.';
    ids.add(pg.id);
  }
  return null;
}

// Shape sent to the client-facing view: no internal bookkeeping, no seen state.
function sbPublic(sb) {
  return {
    id: sb.id, cliente: sb.cliente, projeto: sb.projeto, categoria: sb.categoria,
    produto: sb.produto, status: sb.status, version: sb.version,
    pages: sb.pages, comments: sb.comments, pathSlug: sb.pathSlug,
    lastCommentAt: sb.lastCommentAt, updatedAt: sb.updatedAt,
    // Token de ação: o caminho amigável tem barras e não cabe num parâmetro de
    // rota atrás de proxy, então as escritas do cliente usam este id opaco.
    token: sb.shareSlug,
  };
}

const sbFind = (id) => db.storyboards.find(s => s.id === id);

app.get('/api/storyboards', requireAuth, (req, res) => {
  res.json(db.storyboards);
});

// Onde as imagens enviadas realmente ficam. Sem CLOUDINARY_URL elas vão para o
// disco da instância — que no Render é efêmero: some no próximo deploy, e o
// storyboard reabre com as cenas quebradas. O console mostra isso como aviso em
// vez de deixar o usuário descobrir depois de perder as imagens.
app.get('/api/storage-status', requireAuth, (req, res) => {
  res.json({
    durable: USE_CLOUDINARY,
    backend: USE_CLOUDINARY ? 'cloudinary' : 'disk',
    db: USE_PG ? 'postgres' : 'arquivo local',
  });
});

app.post('/api/storyboards', requireAuth, async (req, res) => {
  const b = req.body || {};
  const sb = {
    id: sbId('sb_'),
    cliente: trim(b.cliente, 120), projeto: trim(b.projeto, 120),
    categoria: trim(b.categoria, 120), produto: trim(b.produto, 120),
    status: 'v1', version: 1,
    shareSlug: sbNewSlug(),
    pages: sbDefaultPages(),
    comments: [],
    lastCommentAt: null,
    unread: 0,
    createdAt: sbNow(), updatedAt: sbNow(),
  };
  db.storyboards.unshift(sb);
  sb.pathSlug = sbBuildPath(sb);
  try { await saveDB(db); }
  catch (e) {
    db.storyboards = db.storyboards.filter(s => s.id !== sb.id);
    console.error('[sb create]', e);
    return res.status(500).json({ error: 'Não foi possível criar o storyboard.' });
  }
  res.json(sb);
});

app.put('/api/storyboards/:id', requireAuth, async (req, res) => {
  const sb = sbFind(req.params.id);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const b = req.body || {};

  // O deck chega inteiro a cada gravação, então um `pages` malformado (vazio por
  // um estado transitório do editor, ou truncado por uma resposta pela metade)
  // apagaria o documento inteiro — com o histórico de versões junto. Na dúvida,
  // recusa e mantém o que já está gravado.
  if (b.pages !== undefined) {
    const erro = sbPagesProblem(b.pages);
    if (erro) return res.status(400).json({ error: erro });
  }

  const antes = JSON.stringify({
    cliente: sb.cliente, projeto: sb.projeto, categoria: sb.categoria, produto: sb.produto,
    pages: sb.pages, status: sb.status, pathSlug: sb.pathSlug, updatedAt: sb.updatedAt,
  });
  const before = [sb.cliente, sb.produto, sb.projeto].join('|');
  ['cliente', 'projeto', 'categoria', 'produto'].forEach(k => {
    if (typeof b[k] === 'string') sb[k] = trim(b[k], 120);
  });
  if (Array.isArray(b.pages)) sb.pages = b.pages;
  if (typeof b.status === 'string' && SB_STATUSES.includes(b.status)) sb.status = b.status;
  // O link do cliente acompanha os dados do card — recalcula quando eles mudam.
  if ([sb.cliente, sb.produto, sb.projeto].join('|') !== before || !sb.pathSlug) sb.pathSlug = sbBuildPath(sb);
  sb.updatedAt = sbNow();

  // Responder só depois de gravar. Antes o console dizia "Storyboard salvo" e
  // seguia em frente mesmo com o banco fora do ar — a perda só aparecia no
  // próximo carregamento da página.
  try { await saveDB(db); }
  catch (e) {
    Object.assign(sb, JSON.parse(antes));   // memória volta ao que está no banco
    console.error('[sb save]', e);
    return res.status(500).json({ error: 'Não foi possível gravar. Nada foi alterado — tente de novo.' });
  }
  res.json(sb);
});

// Clears the notification badge — the admin has now seen this round of comments.
app.post('/api/storyboards/:id/seen', requireAuth, (req, res) => {
  const sb = sbFind(req.params.id);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  sb.unread = 0;
  save();
  res.json({ ok: true });
});

app.delete('/api/storyboards/:id', requireAuth, async (req, res) => {
  const sb = sbFind(req.params.id);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const assets = sbAssets(sb);
  db.storyboards = db.storyboards.filter(s => s.id !== req.params.id);
  save();
  res.status(204).end();
  // Storage cleanup runs after the response — a slow/failed purge must not
  // block the delete the admin already confirmed.
  for (const a of assets) await destroyAsset(a.url, a.publicId);
});

// Image upload for one page of a deck. Returns url + publicId so the client can
// store both on the page and we can destroy the asset when it's replaced/removed.
app.post('/api/upload/storyboard/:id', requireAuth, upload.single('file'), storeUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  if (!/^image\//.test(req.file.mimetype)) {
    await destroyAsset(req.uploadedUrl, req.uploadedPublicId);
    return res.status(400).json({ error: 'Envie um arquivo de imagem.' });
  }
  const sb = sbFind(req.params.id);
  if (!sb) {
    await destroyAsset(req.uploadedUrl, req.uploadedPublicId);
    return res.status(404).json({ error: 'Storyboard não encontrado.' });
  }
  res.json({ url: req.uploadedUrl, publicId: req.uploadedPublicId || '' });
});

// ── Capa do storyboard ───────────────────────────────────────────────────────
// É a miniatura do hub e a imagem que o WhatsApp mostra ao colar o link do
// cliente. Fica no próprio registro (coverUrl/coverPublicId) e não entra pelo
// PUT: só por aqui, para a capa anterior ser destruída no armazenamento em vez
// de virar arquivo órfão.
app.post('/api/storyboards/:id/cover', requireAuth, upload.single('file'), storeUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  if (!/^image\//.test(req.file.mimetype)) {
    await destroyAsset(req.uploadedUrl, req.uploadedPublicId);
    return res.status(400).json({ error: 'Envie um arquivo de imagem.' });
  }
  const sb = sbFind(req.params.id);
  if (!sb) {
    await destroyAsset(req.uploadedUrl, req.uploadedPublicId);
    return res.status(404).json({ error: 'Storyboard não encontrado.' });
  }
  const anterior = { url: sb.coverUrl, publicId: sb.coverPublicId };
  sb.coverUrl = req.uploadedUrl;
  sb.coverPublicId = req.uploadedPublicId || '';
  sb.updatedAt = sbNow();
  // Só responde depois de gravar: o console não pode dizer "capa salva" e o
  // registro não ter ido para o banco.
  try { await saveDB(db); }
  catch (e) {
    sb.coverUrl = anterior.url; sb.coverPublicId = anterior.publicId;
    await destroyAsset(req.uploadedUrl, req.uploadedPublicId);
    console.error('[sb cover save]', e);
    return res.status(500).json({ error: 'Não foi possível gravar a capa.' });
  }
  res.json({ coverUrl: sb.coverUrl, coverPublicId: sb.coverPublicId });
  if (anterior.url && anterior.url !== sb.coverUrl) await destroyAsset(anterior.url, anterior.publicId);
});

app.delete('/api/storyboards/:id/cover', requireAuth, async (req, res) => {
  const sb = sbFind(req.params.id);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const anterior = { url: sb.coverUrl, publicId: sb.coverPublicId };
  sb.coverUrl = ''; sb.coverPublicId = '';
  sb.updatedAt = sbNow();
  try { await saveDB(db); }
  catch (e) {
    sb.coverUrl = anterior.url; sb.coverPublicId = anterior.publicId;
    console.error('[sb cover remove]', e);
    return res.status(500).json({ error: 'Não foi possível remover a capa.' });
  }
  res.status(204).end();
  if (anterior.url) await destroyAsset(anterior.url, anterior.publicId);
});

// Apagar comentário pelo console. Depois que o cliente envia a rodada ele perde
// o direito de remover (ver a rota pública abaixo) — daqui, com sessão de admin,
// qualquer comentário pode ser removido, enviado ou não.
app.delete('/api/storyboards/:id/comments/:cid', requireAuth, (req, res) => {
  const sb = sbFind(req.params.id);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const before = (sb.comments || []).length;
  sb.comments = (sb.comments || []).filter(c => c.id !== req.params.cid);
  if (sb.comments.length === before) return res.status(404).json({ error: 'Comentário não encontrado.' });
  sb.lastCommentAt = sb.comments.length ? sb.comments[sb.comments.length - 1].createdAt : null;
  sb.updatedAt = sbNow();   // avisa as outras sessões abertas neste storyboard
  save();
  res.status(204).end();
});

// Drops an image the admin removed/replaced inside the editor.
app.post('/api/storyboards/:id/asset/remove', requireAuth, async (req, res) => {
  const sb = sbFind(req.params.id);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const { url, publicId } = req.body || {};
  res.json({ ok: true });
  await destroyAsset(url, publicId);
});

// ── Storyboards — public client view ─────────────────────────────────────────
// Leitura pelo caminho amigável (rota curinga); escritas pelo token opaco, que
// cabe num único segmento de rota. Links antigos (/sb/<hex>) seguem valendo.
const sbBySlug = (slug) => db.storyboards.find(s => s.shareSlug === slug);

// Declarada antes de /api/sb/:slug para não ser capturada por ela.
app.get('/api/sb/path/*', (req, res) => {
  const sb = db.storyboards.find(s => s.pathSlug === req.params[0]);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  res.json(sbPublic(sb));
});

app.get('/api/sb/:slug', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  res.json(sbPublic(sb));
});

app.post('/api/sb/:slug/comments', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  if (sb.status === 'aprovado') return res.status(409).json({ error: 'Storyboard já aprovado.' });
  const { pageId, author, company, text } = req.body || {};
  if (!trim(text, 4000)) return res.status(400).json({ error: 'Comentário vazio.' });
  if (!(sb.pages || []).some(p => p.id === pageId)) return res.status(400).json({ error: 'Página inválida.' });
  const c = {
    id: sbId('c_'), pageId,
    author: trim(author, 80) || 'Cliente', company: trim(company, 80),
    text: trim(text, 4000),
    version: sb.version, createdAt: sbNow(), submitted: false,
  };
  sb.comments.push(c);
  sb.lastCommentAt = c.createdAt;
  save();
  res.json(c);
});

app.delete('/api/sb/:slug/comments/:cid', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const c = (sb.comments || []).find(x => x.id === req.params.cid);
  if (!c) return res.status(404).json({ error: 'Comentário não encontrado.' });
  // Only a comment from the round still in progress can be taken back.
  if (c.submitted) return res.status(409).json({ error: 'Comentário já enviado.' });
  sb.comments = sb.comments.filter(x => x.id !== req.params.cid);
  save();
  res.status(204).end();
});

// Client closes a round: freezes their comments, bumps the version, and raises
// the badge in the console.
app.post('/api/sb/:slug/submit', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  if (sb.status === 'aprovado') return res.status(409).json({ error: 'Storyboard já aprovado.' });
  if ((sb.version || 1) >= SB_MAX_VERSION) {
    return res.status(409).json({ error: `As ${SB_ROUNDS} rodadas de alteração deste storyboard já foram usadas.` });
  }
  const pending = (sb.comments || []).filter(c => !c.submitted);
  if (!pending.length) return res.status(400).json({ error: 'Nenhum comentário para enviar.' });
  pending.forEach(c => { c.submitted = true; });
  sb.version = Math.min(sb.version + 1, SB_MAX_VERSION);
  sb.status = 'v' + sb.version;
  sb.lastCommentAt = sbNow();
  sb.unread = (sb.unread || 0) + pending.length;
  sb.updatedAt = sbNow();
  save();
  res.json({ ok: true, status: sb.status, version: sb.version });
});

app.post('/api/sb/:slug/approve', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const { author, company } = req.body || {};
  (sb.comments || []).forEach(c => { c.submitted = true; });
  sb.status = 'aprovado';
  sb.approvedAt = sbNow();
  sb.approvedBy = trim(author, 80) || 'Cliente';
  sb.approvedCompany = trim(company, 80);
  sb.unread = (sb.unread || 0) + 1;
  sb.updatedAt = sbNow();
  save();
  res.json({ ok: true, status: sb.status });
});

// ── Links (short-link redirects) ──────────────────────────────────────────────
const RESERVED_SLUGS = new Set(['console', 'framety', 'presentation', 'cadastroparceiro', 'tutorial', 'uploads', 'api', 'producoes', 'assistir', 'sb', 'screendimension', 'storyboards']);

app.get('/api/redirects', requireAuth, (req, res) => {
  res.json(db.linkRedirects);
});
app.post('/api/redirects', requireAuth, (req, res) => {
  const { slug: rawSlug, target: rawTarget, category } = req.body || {};
  const slug = (rawSlug || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  let target = (rawTarget || '').trim();
  if (!slug) return res.status(400).json({ error: 'Informe um nome para o link.' });
  if (RESERVED_SLUGS.has(slug)) return res.status(400).json({ error: 'Esse nome é reservado pelo site. Escolha outro.' });
  if (!target) return res.status(400).json({ error: 'Informe a URL de destino.' });
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
  if (db.linkRedirects.some(r => r.slug === slug)) return res.status(409).json({ error: 'Já existe um link com esse nome.' });
  const redirect = { slug, target, category: (category || '').trim() || 'Sem categoria', clicks: 0, createdAt: new Date().toISOString() };
  db.linkRedirects.push(redirect);
  save();
  res.json(redirect);
});
app.put('/api/redirects/:slug', requireAuth, (req, res) => {
  const idx = db.linkRedirects.findIndex(r => r.slug === req.params.slug);
  if (idx < 0) return res.status(404).json({ error: 'Link não encontrado.' });
  let target = typeof req.body.target === 'string' ? req.body.target.trim() : db.linkRedirects[idx].target;
  if (target && !/^https?:\/\//i.test(target)) target = 'https://' + target;
  const category = typeof req.body.category === 'string' ? (req.body.category.trim() || 'Sem categoria') : db.linkRedirects[idx].category;
  db.linkRedirects[idx] = { ...db.linkRedirects[idx], target, category };
  save();
  res.json(db.linkRedirects[idx]);
});
app.delete('/api/redirects/:slug', requireAuth, (req, res) => {
  db.linkRedirects = db.linkRedirects.filter(r => r.slug !== req.params.slug);
  save();
  res.json({ ok: true });
});

// Short-link redirects (bit.ly-style) — last resort fallback: only fires for
// single-segment GET paths that didn't match a static file, SPA route, or API
// route above, so a slug can never shadow real site content.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const p = req.path;
  if (p === '/' || p.slice(1).includes('/')) return next();
  const slug = decodeURIComponent(p.slice(1));
  const redirect = (db.linkRedirects || []).find(r => r.slug === slug);
  if (!redirect) return next();
  redirect.clicks = (redirect.clicks || 0) + 1;
  redirect.lastAccessedAt = new Date().toISOString();
  save();
  res.redirect(302, redirect.target);
});

// ── Error handlers ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande (máx 600MB).' : err.message });
  }
  if (err) {
    console.error('[error]', err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
  next();
});

// ── Cleanup stale rate-limit entries every 2 hours ────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of partnerRateLimit.entries()) {
    if (arr.every(t => now - t >= 3600000)) partnerRateLimit.delete(ip);
  }
  for (const [ip, rec] of loginAttempts.entries()) {
    if (now >= rec.resetAt && rec.count === 0) loginAttempts.delete(ip);
  }
}, 2 * 60 * 60 * 1000).unref();

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  db = await loadDB();

  // Per-key migrations (tolerant of partial state)
  if (!db.settings) db.settings = JSON.parse(JSON.stringify(SEED.settings));
  if (!db.partners) db.partners = [];
  if (!db.categories) db.categories = JSON.parse(JSON.stringify(SEED.categories));
  if (!db.clients) db.clients = JSON.parse(JSON.stringify(SEED.clients));
  if (!db.videos) db.videos = JSON.parse(JSON.stringify(SEED.videos));
  let _migrated = false;
  if (!db.locucoesPages) { db.locucoesPages = JSON.parse(JSON.stringify(SEED.locucoesPages)); _migrated = true; }
  if (db.locucoesActivePageId == null) { db.locucoesActivePageId = SEED.locucoesActivePageId; _migrated = true; }
  if (!db.locucoesCad) { db.locucoesCad = JSON.parse(JSON.stringify(SEED.locucoesCad)); _migrated = true; }
  if (!db.linkRedirects) { db.linkRedirects = JSON.parse(JSON.stringify(SEED.linkRedirects)); _migrated = true; }
  if (!db.storyboards) { db.storyboards = []; _migrated = true; }
  // Storyboards criados antes da URL amigável ganham seu caminho agora.
  db.storyboards.forEach(s => { if (!s.pathSlug) { s.pathSlug = sbBuildPath(s); _migrated = true; } });
  if (!db.settings.aiSection) db.settings.aiSection = JSON.parse(JSON.stringify(SEED.settings.aiSection));
  if (!db.settings.aiSection.items) db.settings.aiSection.items = JSON.parse(JSON.stringify(SEED.settings.aiSection.items));
  if (db.settings.producoes_pass == null) db.settings.producoes_pass = SEED.settings.producoes_pass;
  if (db.settings.recovery_token == null) db.settings.recovery_token = SEED.settings.recovery_token;
  if (db.settings.tutorial_video_url == null) db.settings.tutorial_video_url = SEED.settings.tutorial_video_url;
  if (db.settings.tutorial_title == null) db.settings.tutorial_title = SEED.settings.tutorial_title;
  if (db.settings.tutorial_subtitle == null) db.settings.tutorial_subtitle = SEED.settings.tutorial_subtitle;
  if (db.settings.tutorial_text == null) db.settings.tutorial_text = SEED.settings.tutorial_text;

  const _now = new Date().toISOString();
  let _backfilled = _migrated;
  db.videos.forEach(v => {
    if (!v.updatedAt) { v.updatedAt = _now; _backfilled = true; }
    if (v.aiGenerated === undefined) { v.aiGenerated = false; _backfilled = true; }
  });
  if (_backfilled) await saveDB(db);

  app.listen(PORT, () => {
    console.log(`\n  Framety  →  http://localhost:${PORT}/Framety.html\n`);
  });
})();
