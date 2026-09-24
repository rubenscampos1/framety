const express = require('express');
const compression = require('compression');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { scryptSync, timingSafeEqual } = crypto;
const { Pool } = require('pg');
const sheets = require('./sheets');

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
const ROTAS = require('./rotas.js');

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
    /* Formatos de vídeo imersivo. É lista aberta: o console acrescenta e
       remove, porque a sala imersiva ganha formato novo com o tempo. */
    formatosImersivos: ["Semicircular", "Tradicional", "Trapézio"],
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
  /* O celular que sobe no fim da home chamando para seguir o perfil. As fotos
     são enviadas no console: não há API do Instagram aqui, e depender de uma
     traria token, renovação e um feed que quebra sozinho quando ele expira. */
  instagram: {
    ativo: true,
    perfil: "",
    usuario: "",
    chamada: "Acompanhe os bastidores",
    print: "",     // print da tela do perfil; quando existe, é ele na tela
    fotos: [],     // grade montada à mão, usada quando não há print
  },

  /* Minigame escondido em /play. O placar guarda os 20 últimos jogos; o carro
     é a imagem enviada no console, que vira a barrinha do jogador. */
  minigame: { carroUrl: "" },
  placar: [],

  /* Marca: o ícone da aba e a prévia que aparece ao colar o link no WhatsApp,
     no Telegram, no Facebook. As páginas de categoria e de vídeo continuam
     trazendo a própria capa — o que está aqui é o padrão e as páginas fixas. */
  branding: {
    favicon: "",
    ogTitulo: "",
    ogDescricao: "",
    ogImagem: "",
    paginas: {},
  },

  /* Novidades: o cartão que aparece na home e a página /novidades, um mini
     blog montado por blocos. Tudo editado no console. */
  novidades: {
    ativo: true,
    card: {
      etiqueta: "Novidades",
      titulo: "O que está saindo do forno",
      texto: "Bastidores, lançamentos e o que a Framety anda produzindo.",
      botao: "Saiba mais",
      imagem: "",
    },
    pagina: {
      titulo: "Novidades",
      resumo: "Bastidores, lançamentos e destaques da Framety.",
      blocos: [],
    },
  },
  linkRedirects: [
    { slug: 'rodolfo', target: 'https://www.google.com.br', category: 'Clientes', clicks: 3, createdAt: '2026-07-06T22:01:58.018Z', lastAccessedAt: '2026-07-06T22:03:46.309Z' },
  ],
  storyboards: [],
  screendims: [],
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
    const safeAttrs = [];
    attrs.replace(/([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, name, _q, v1, v2) => {
      const n = name.toLowerCase();
      const v = v1 ?? v2;
      // class passa em qualquer tag da allowlist (só nomes de classe) — os
      // textos da home usam coisas como <span class="strike">.
      if (n === 'class') { if (/^[A-Za-z0-9 _-]{0,80}$/.test(v)) safeAttrs.push(`class="${v}"`); return; }
      if (allowedSet && allowedSet.has(n) && /^https?:\/\//i.test(v)) safeAttrs.push(`${n}="${v.replace(/"/g, '&quot;')}"`);
    });
    return `<${t}${safeAttrs.length ? ' ' + safeAttrs.join(' ') : ''}>`;
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Imagem de preview social (WhatsApp, Telegram, Facebook) ──────────────────
// As redes não aceitam qualquer arquivo. O WhatsApp descarta em SILÊNCIO imagens
// grandes — e as nossas vêm da câmera com vários MB (uma capa de categoria real
// tem 6,5MB) — e também não renderiza SVG. O resultado é um link sem miniatura
// sem nenhum erro para investigar.
// Quando a imagem está no Cloudinary, pedimos a ele a versão que as redes
// esperam: 1200×630 JPEG, recortada pelo assunto. Na prática, 6503KB → 81KB.
// Fora do Cloudinary (disco, em desenvolvimento) a URL passa como está.
const OG_IMG_W = 1200, OG_IMG_H = 630;
function socialImage(url) {
  const v = String(url || '');
  const m = v.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i);
  if (!m) return v;
  return `${m[1]}c_fill,g_auto,w_${OG_IMG_W},h_${OG_IMG_H},f_jpg,q_auto/${m[2]}`;
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
    else if (/^\/api\/(videos|categories|clients|upload|ai-section|tutorial|reel|partners|site-content|theme|novidades)/.test(p)) domain = 'content';
    else if (/^\/api\/(locucoes|producoes\/status)/.test(p)) domain = 'locucoes';
    else if (/^\/api\/redirects/.test(p)) domain = 'redirects';
    else if (/^\/api\/screendims/.test(p)) domain = 'screendims';
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
// Rotas de sistema. Home, seções, categorias, vídeos e clientes são resolvidos
// por rotas.js no fim da cadeia (ver "Endereços públicos"), junto dos links
// antigos em /framety, que viram redirecionamento.
const SPA_ROUTES = ['/', '/console', '/console/*', '/presentation', '/presentation/*', '/cadastroparceiro', '/tutorial', '/novidades', '/play', '/producoes', '/assistir', '/assistir/*', '/screendimension', '/screendimension/*', '/sb', '/sb/*', '/storyboards', '/storyboards/*'];

app.get(SPA_ROUTES, (req, res) => enviarSpa(req, res, null));

// Link de Short é vertical por natureza: quem cadastra não precisa marcar.
const ehVerticalPorUrl = (url) => /\/shorts\//i.test(String(url || ''));

/* Formato do vídeo, medido no próprio YouTube ───────────────────────────────
   Nem todo vídeo em pé vem de um link /shorts/ — um 9:16 publicado como vídeo
   comum tem link igual ao de qualquer outro. Mas o YouTube guarda a capa no
   formato ORIGINAL em oardefault.jpg, e só a gera quando o vídeo não é 16:9:
   para um vídeo deitado esse endereço responde 404 (com uma imagem cinza de
   120x90 no corpo). Então medir essa capa responde as duas perguntas de uma
   vez: se o vídeo é vertical e se existe capa em pé para usar no lugar da
   hqdefault, que vem 4:3 com as tarjas queimadas.

   A leitura pede só os primeiros 3 KB: o tamanho está no cabeçalho do JPEG, e
   baixar os 180 KB da imagem inteira para ler dois números seria desperdício. */
function tamanhoJpeg(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marca = buf[i + 1];
    // SOFn carrega as medidas; DHT/DAC/RSTn não são quadros.
    if (marca >= 0xC0 && marca <= 0xCF && marca !== 0xC4 && marca !== 0xC8 && marca !== 0xCC) {
      return { largura: buf.readUInt16BE(i + 7), altura: buf.readUInt16BE(i + 5) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function medeFormatoYoutube(videoUrl) {
  const m = String(videoUrl || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    || String(videoUrl || '').match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (!m) return { vertical: ehVerticalPorUrl(videoUrl), capaEmPe: false };
  try {
    const r = await fetch(`https://img.youtube.com/vi/${m[1]}/oardefault.jpg`, {
      headers: { Range: 'bytes=0-3000' },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status !== 200 && r.status !== 206) return { vertical: ehVerticalPorUrl(videoUrl), capaEmPe: false };
    const t = tamanhoJpeg(Buffer.from(await r.arrayBuffer()));
    if (!t || !t.largura) return { vertical: ehVerticalPorUrl(videoUrl), capaEmPe: false };
    const emPe = t.altura > t.largura;
    return { vertical: emPe, capaEmPe: emPe };
  } catch (_) {
    return { vertical: ehVerticalPorUrl(videoUrl), capaEmPe: false };
  }
}

// O console usa isto ao colar o link, para já marcar o formato certo.
app.get('/api/video-formato', requireAuth, async (req, res) => {
  res.json(await medeFormatoYoutube(req.query.url || ''));
});

function capaDoVideo(vid) {
  if (vid.thumbUrl) return vid.thumbUrl;
  const ytMatch = vid.videoUrl?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg` : '';
}

function enviarSpa(req, res, rotaResolvida) {
  const entryPath = path.join(DIR, 'Framety.html');
  if (!fs.existsSync(entryPath)) return res.status(404).send('Entry file not found');

  let html = fs.readFileSync(entryPath, 'utf8');

  const marca = db.branding || {};
  let title = marca.ogTitulo || "Framety";
  let desc = marca.ogDescricao || "Cinema© para marcas que pensam em movimento. Uma empresa do Grupo Skyline.";
  let image = marca.ogImagem || "/framety_social_preview.png";

  const p = req.path.toLowerCase();
  const rota = rotaResolvida || ROTAS.resolver(p, db);

  // Prévia escolhida no console para esta página. Vence o padrão e perde para
  // categoria/vídeo logo abaixo, que trazem a capa do próprio conteúdo. Seções
  // e clientes são pedaços da home, então usam a prévia dela ('/framety').
  // Subpáginas herdam a prévia da página-mãe: /screendimension/semicircular (e
  // o link compartilhável, que leva as medidas na query) usa a de /screendimension.
  // Sem isso o WhatsApp recebia a imagem padrão do site nesses endereços.
  const chavePrevia = (rota && (rota.tipo === 'home' || rota.tipo === 'cliente')) ? '/framety'
    : (ROTAS_COM_PREVIA.find(r => p === r || p.startsWith(r + '/')) || p);
  const daPagina = (marca.paginas || {})[chavePrevia];
  if (daPagina) {
    if (daPagina.titulo)    title = daPagina.titulo;
    if (daPagina.descricao) desc  = daPagina.descricao;
    if (daPagina.imagem)    image = daPagina.imagem;
  }

  if (rota && rota.tipo === 'categoria') {
    const cat = rota.categoria;
    title = `${cat.name} | Framety`;
    desc = `${cat.desc || ""} Produtora audiovisual especializada no mercado imobiliário.`.trim();
    if (cat.coverUrl) image = cat.coverUrl;
    else {
      // Link não roda sorteio: a prévia usa o vídeo escolhido ou o primeiro da categoria.
      const doCat = db.videos.filter(v => v.category === cat.id && v.status !== 'draft');
      const v = doCat.find(x => x.id === cat.coverVideoId) || doCat[0];
      if (v) image = capaDoVideo(v) || image;
    }
  }

  if (rota && rota.tipo === 'cliente') {
    title = `${rota.cliente.name} | Framety`;
  }

  if (rota && rota.tipo === 'video') {
    const vid = rota.video;
    title = `${vid.title} | Framety`;
    desc = `${vid.description ? vid.description.replace(/<[^>]*>?/gm, '').substring(0, 160) : ""} Produtora audiovisual especializada no mercado imobiliário.`.trim();
    image = capaDoVideo(vid) || image;
  }

  // Texto padrão do screendimension — só quando o console não definiu o da página.
  if (p === '/screendimension' || p.startsWith('/screendimension/')) {
    if (!daPagina || !daPagina.titulo)    title = "Configurador de Sala Imersiva | Framety";
    if (!daPagina || !daPagina.descricao) desc = "Ferramenta de dimensionamento de projeções para salas imersivas.";
  }

  // Link do cliente: é o único que descreve o documento nas meta tags, porque é
  // o único feito para ser compartilhado. A capa enviada no console é o que
  // aparece ao colar esse link no WhatsApp.
  if (p === '/sb' || p.startsWith('/sb/')) {
    const sb = (db.storyboards || []).find(s => s.shareSlug === p.split('/')[2]);
    title = sb ? `Storyboard — ${sb.cliente || 'Framety'} | ${sb.projeto || ''}`.trim() : "Storyboard | Framety";
    desc = "Storyboard para aprovação — visualize as cenas e envie seus comentários.";
    if (sb && sb.coverUrl) image = sb.coverUrl;
  }

  // Área interna: nada sobre o documento sai daqui. O caminho traz o nome do
  // cliente, e um link colado num grupo não deve revelar de quem é o projeto
  // (nem a capa) antes de a senha ser pedida.
  if (p === '/storyboards' || p.startsWith('/storyboards/')) {
    title = "Storyboards | Framety";
    desc = "Área restrita.";
  }

  const eTitle = escapeHtml(title);
  const eDesc = escapeHtml(desc);
  // og:image PRECISA ser absoluta: WhatsApp, Telegram e Facebook buscam a imagem
  // fora do contexto da página e não resolvem caminho relativo — com "/foo.png"
  // o link simplesmente aparece sem miniatura. Atrás do proxy do Render o
  // protocolo real vem no x-forwarded-proto (a conexão interna é http).
  const original = absoluteUrl(req, image);
  const eImage = escapeHtml(absoluteUrl(req, socialImage(image)));
  // Só declara medidas quando fomos nós que pedimos o recorte — dizer 1200×630
  // de uma imagem que não passou pela transformação seria mentir para o
  // rastreador, e algumas redes desistem do preview quando a medida não bate.
  const medida = eImage !== escapeHtml(original);
  const metaHtml = `
    <title>${eTitle}</title>
    <meta name="description" content="${eDesc}">
    <meta property="og:title" content="${eTitle}">
    <meta property="og:description" content="${eDesc}">
    <meta property="og:image" content="${eImage}">
    <meta property="og:image:secure_url" content="${eImage}">${medida ? `
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="${OG_IMG_W}">
    <meta property="og:image:height" content="${OG_IMG_H}">` : ''}
    <meta property="og:image:alt" content="${eTitle}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${eTitle}">
    <meta name="twitter:description" content="${eDesc}">
    <meta name="twitter:image" content="${eImage}">
  `;

  html = html.replace(/<title>.*?<\/title>/, metaHtml);

  // Ícone da aba enviado pelo console. O type="image/png" do HTML sai junto: o
  // arquivo pode ser png, webp ou svg, e declarar o tipo errado é pior do que
  // não declarar nenhum.
  if (marca.favicon) {
    const ico = escapeHtml(absoluteUrl(req, marca.favicon));
    html = html.replace(
      /<link rel="icon"[^>]*>\s*<link rel="apple-touch-icon"[^>]*>/,
      `<link rel="icon" href="${ico}" sizes="any">\n    <link rel="apple-touch-icon" href="${ico}">`
    );
  }

  res.send(html);
}

/* ── Endereços públicos: slugs ──────────────────────────────────────────────
   Vídeo: único dentro da categoria (o endereço é /<categoria>/<vídeo>, e o
   mesmo empreendimento costuma aparecer em Lançamento e em Obra). Cliente:
   único no site. Quem troca de slug guarda o anterior em `slugsAntigos`, e o
   resolver ainda o encontra — link já compartilhado não quebra. */
function slugDoVideo(v, exceto) {
  const usados = new Set(db.videos.filter(x => x !== exceto && x.category === v.category && x.slug).map(x => x.slug));
  return ROTAS.slugUnico(ROTAS.slugify(v.title) || v.id, usados);
}
function slugDoCliente(c, exceto) {
  const usados = new Set(db.clients.filter(x => x !== exceto && x.slug).map(x => x.slug));
  return ROTAS.slugUnico(ROTAS.slugify(c.name) || ROTAS.slugify(c.id) || 'cliente', usados);
}
const comAntigo = (lista, antigo, atual) =>
  [...new Set([...(lista || []), antigo])].filter(a => a && a !== atual);

// Categoria vive na raiz do site: não pode ter o nome de uma rota nem de um link curto.
function problemaNoIdDaCategoria(id, ignorar) {
  if (!id) return 'Informe um nome para a categoria.';
  if (ROTAS.RESERVADOS.has(id) || RESERVED_SLUGS.has(id)) return `"${id}" é um endereço reservado do site. Escolha outro nome.`;
  if (db.categories.some(c => c.id === id && c.id !== ignorar)) return 'Já existe uma categoria com esse endereço.';
  if ((db.linkRedirects || []).some(r => r.slug === id)) return `Já existe um link curto em /${id}. Escolha outro nome.`;
  return '';
}

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
    formatosImersivos: db.settings.formatosImersivos || JSON.parse(JSON.stringify(SEED.settings.formatosImersivos)),
    // Textos da home editados no console. `null` = usar o padrao do content.js.
    content: db.settings.siteContent || null,
    // Cor de destaque do site (aba Home do console). Vazio = a cor padrão.
    theme: { accent: db.settings.accent || '' },
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

/* Lista de formatos imersivos. Trocar um nome não mexe nos vídeos que já o
   usam: quem guarda o valor é o vídeo, e o console mostra o que estiver lá
   mesmo que tenha saído da lista. */
app.post('/api/formatos-imersivos', requireAuth, (req, res) => {
  const bruta = Array.isArray(req.body && req.body.formatos) ? req.body.formatos : [];
  const limpos = [];
  for (const f of bruta) {
    const t = String(f || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (t && !limpos.some(x => x.toLowerCase() === t.toLowerCase())) limpos.push(t);
    if (limpos.length >= 20) break;
  }
  db.settings.formatosImersivos = limpos;
  save();
  res.json({ ok: true, formatos: limpos });
});

/* ── Duração real, vinda do YouTube ──────────────────────────────────────────
   A duração era um campo digitado à mão, e por isso quase todo vídeo mostrava
   o mesmo "03:00" de exemplo. O número verdadeiro está na página do vídeo, em
   lengthSeconds — não é preciso chave de API para lê-lo.

   É buscado quando o vídeo é cadastrado ou editado sem duração, e há uma
   varredura para preencher o catálogo inteiro de uma vez. O resultado fica
   guardado no banco: a página não consulta o YouTube para desenhar um card. */
async function duracaoDoYoutube(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!m) return '';
  try {
    const parar = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
    const r = await fetch('https://www.youtube.com/watch?v=' + m[1], {
      signal: parar,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
    });
    if (!r.ok) return '';
    const html = await r.text();
    const seg = +(html.match(/"lengthSeconds":"(\d+)"/) || [])[1];
    if (!seg) return '';                       // ao vivo, privado ou removido
    const h = Math.floor(seg / 3600), min = Math.floor((seg % 3600) / 60), s2 = seg % 60;
    return (h ? h + ':' + String(min).padStart(2, '0') : String(min)) + ':' + String(s2).padStart(2, '0');
  } catch (e) {
    return '';                                  // sem rede, sem duração: fica como estava
  }
}

/* Preenche o catálogo. Sem 'todos', só quem está sem duração. */
app.post('/api/videos/duracoes', requireAuth, async (req, res) => {
  const todos = !!(req.body && req.body.todos);
  const alvo = db.videos.filter(v => {
    if (!/(?:youtube\.com|youtu\.be)/.test(v.videoUrl || '')) return false;
    return todos || !v.duration || /^0?0:00$/.test(v.duration);
  });
  let preenchidos = 0;
  for (const v of alvo) {
    const d = await duracaoDoYoutube(v.videoUrl);
    if (d && d !== v.duration) { v.duration = d; v.updatedAt = new Date().toISOString(); preenchidos++; }
    await new Promise(r => setTimeout(r, 120));   // sem martelar o YouTube
  }
  if (preenchidos) save();
  res.json({ ok: true, olhados: alvo.length, preenchidos });
});

app.post('/api/videos', requireAuth, (req, res) => {
  if (!req.body || !req.body.title) return res.status(400).json({ error: 'Título obrigatório.' });
  const id = 'v' + crypto.randomBytes(4).toString('hex');
  const maxOrder = db.videos.reduce((m, v) => Math.max(m, v.sortOrder ?? 0), 0);
  const body = { ...req.body };
  delete body.slug; delete body.slugsAntigos;
  if (typeof body.description === 'string') body.description = sanitizeHtml(body.description);
  const novo = { ...body, id, sortOrder: maxOrder + 1, updatedAt: new Date().toISOString() };
  if (typeof novo.vertical !== 'boolean') novo.vertical = ehVerticalPorUrl(novo.videoUrl);
  novo.slug = slugDoVideo(novo, null);
  db.videos.push(novo);
  save();
  res.json({ id });
  // Mede o formato no YouTube depois de responder, como a duração.
  medeFormatoYoutube(novo.videoUrl).then((f) => {
    const v = db.videos.find(x => x.id === id);
    if (!v) return;
    if (typeof body.vertical !== 'boolean') v.vertical = f.vertical;
    v.capaEmPe = f.capaEmPe;
    save();
  }).catch(() => {});
  // Sem duração digitada, busca no YouTube depois de responder: quem cadastrou
  // não espera a ida à rede, e o card já nasce com o número certo.
  if (!body.duration) {
    duracaoDoYoutube(body.videoUrl).then(d => {
      if (!d) return;
      const v = db.videos.find(x => x.id === id);
      if (v && !v.duration) { v.duration = d; save(); }
    });
  }
});

app.put('/api/videos/:id', requireAuth, (req, res) => {
  const idx = db.videos.findIndex(v => v.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const body = { ...req.body };
  // O console reenvia o vídeo inteiro, com o slug que tinha quando carregou:
  // slug é decidido só aqui.
  delete body.slug; delete body.slugsAntigos;
  if (typeof body.description === 'string') body.description = sanitizeHtml(body.description);
  const antes = db.videos[idx];
  const depois = { ...antes, ...body, id: req.params.id, updatedAt: new Date().toISOString() };
  if (typeof depois.vertical !== 'boolean') depois.vertical = ehVerticalPorUrl(depois.videoUrl);
  const urlMudou = depois.videoUrl !== antes.videoUrl;
  if (!antes.slug || depois.title !== antes.title || depois.category !== antes.category) {
    depois.slug = slugDoVideo(depois, antes);
    if (antes.slug) depois.slugsAntigos = comAntigo(antes.slugsAntigos, `${antes.category}/${antes.slug}`, `${depois.category}/${depois.slug}`);
  }
  db.videos[idx] = depois;
  save();
  res.json({ ok: true });
  // Link novo (ou vídeo que nunca foi medido): confere o formato no YouTube.
  if (urlMudou || typeof depois.capaEmPe !== 'boolean') {
    medeFormatoYoutube(depois.videoUrl).then((f) => {
      const v = db.videos.find(x => x.id === req.params.id);
      if (!v) return;
      if (typeof body.vertical !== 'boolean') v.vertical = f.vertical;
      v.capaEmPe = f.capaEmPe;
      save();
    }).catch(() => {});
  }
  if (!db.videos[idx].duration) {
    duracaoDoYoutube(db.videos[idx].videoUrl).then(d => {
      if (!d) return;
      const v = db.videos.find(x => x.id === req.params.id);
      if (v && !v.duration) { v.duration = d; save(); }
    });
  }
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
  const id = ROTAS.slugify((req.body && (req.body.id || req.body.name)) || '');
  const problema = problemaNoIdDaCategoria(id, null);
  if (problema) return res.status(400).json({ error: problema });
  const maxOrder = db.categories.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0);
  const body = { ...req.body };
  delete body.idsAntigos;
  db.categories.push({ ...body, id, sortOrder: maxOrder + 1 });
  save();
  res.json({ id });
});

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const idx = db.categories.findIndex(c => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const body = { ...req.body };
  delete body.idsAntigos;
  const newId = (typeof body.id === 'string' && body.id.trim()) ? ROTAS.slugify(body.id) : req.params.id;
  if (newId !== req.params.id) {
    const problema = problemaNoIdDaCategoria(newId, req.params.id);
    if (problema) return res.status(409).json({ error: problema });
    db.videos.forEach(v => { if (v.category === req.params.id) v.category = newId; });
    // /<id antigo> e /<id antigo>/<vídeo> seguem levando à categoria renomeada.
    body.idsAntigos = comAntigo(db.categories[idx].idsAntigos, req.params.id, newId);
  }
  // Capa trocada por thumb de vídeo ou por "aleatória": a imagem enviada sai do
  // armazenamento. Só com limpeza explícita — um console com dados velhos que
  // reenvie outra URL não pode apagar a capa que está no ar.
  if (db.categories[idx].coverUrl && body.coverUrl === '') unlinkUpload(db.categories[idx].coverUrl);
  db.categories[idx] = { ...db.categories[idx], ...body, id: newId };
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
  const novo = { ...req.body, sortOrder: maxOrder + 1 };
  delete novo.slugsAntigos;
  novo.slug = slugDoCliente(novo, null);
  db.clients.push(novo);
  save();
  res.json({ id: req.body.id });
});

app.put('/api/clients/:id', requireAuth, (req, res) => {
  const idx = db.clients.findIndex(c => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const body = { ...req.body };
  delete body.slug; delete body.slugsAntigos;
  const antes = db.clients[idx];
  const depois = { ...antes, ...body, id: req.params.id };
  if (!antes.slug || depois.name !== antes.name) {
    depois.slug = slugDoCliente(depois, antes);
    if (antes.slug) depois.slugsAntigos = comAntigo(antes.slugsAntigos, antes.slug, depois.slug);
  }
  db.clients[idx] = depois;
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
  cat.coverVideoId = '';   // imagem enviada vence a thumb escolhida
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

// ── Textos da home (content.js) editados pelo console ────────────────────────
// O site sempre parte do padrão em content.js; o que é salvo aqui vai por cima
// (ver FRAMETY_APPLY_CONTENT). Guardamos o blob inteiro, mas passado por uma
// limpeza: só string/number/boolean/objeto/lista, com limites de tamanho, e os
// campos *Html — que a landing injeta com dangerouslySetInnerHTML — pelo
// sanitizador de HTML já usado no tutorial.
const CONTENT_MAX_DEPTH = 6;
const CONTENT_MAX_STR = 4000;
const CONTENT_MAX_ITEMS = 60;
const CONTENT_MAX_KEYS = 80;
function cleanContent(value, key = '', depth = 0) {
  if (depth > CONTENT_MAX_DEPTH) return null;
  if (value === null) return null;
  if (typeof value === 'string') {
    const v = value.slice(0, CONTENT_MAX_STR);
    return /Html$/.test(key) ? sanitizeHtml(v) : v.replace(/<[^>]*>/g, '');
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, CONTENT_MAX_ITEMS).map(v => cleanContent(v, key, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).slice(0, CONTENT_MAX_KEYS)) {
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
      out[k] = cleanContent(value[k], k, depth + 1);
    }
    return out;
  }
  return null;
}

app.post('/api/site-content', requireAuth, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Conteúdo inválido.' });
  }
  const clean = cleanContent(body);
  if (JSON.stringify(clean).length > 200000) {
    return res.status(413).json({ error: 'Conteúdo muito grande.' });
  }
  db.settings.siteContent = clean;
  save();
  res.json({ ok: true, content: clean });
});

// Cor de destaque. Só o hex de 6 dígitos entra — o valor vira variável CSS no
// <html> de quem abre o site, então nada além de cor pode passar por aqui.
/* ── Instagram (o celular do rodapé) ────────────────────────────────────────
   Leitura pública, escrita só pelo console. O endereço do perfil é guardado
   como texto e validado de novo na página antes de virar link. */
const INSTA_MAX_FOTOS = 9;

function limparInstagram(entrada) {
  const d = entrada && typeof entrada === 'object' ? entrada : {};
  const txt = (v, n) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim().slice(0, n) : '');
  const fotos = Array.isArray(d.fotos) ? d.fotos : [];
  return {
    ativo: d.ativo !== false,
    perfil: txt(d.perfil, 300),
    usuario: txt(d.usuario, 40),
    chamada: txt(d.chamada, 80),
    print: txt(d.print, 500),
    fotos: fotos.filter(f => typeof f === 'string').map(f => txt(f, 500)).filter(Boolean).slice(0, INSTA_MAX_FOTOS),
  };
}

app.get('/api/instagram', (req, res) => {
  res.json(db.instagram || JSON.parse(JSON.stringify(SEED.instagram)));
});

app.post('/api/instagram', requireAuth, (req, res) => {
  db.instagram = limparInstagram(req.body);
  save();
  res.json({ ok: true, instagram: db.instagram });
});

/* ── Minigame ────────────────────────────────────────────────────────────────
   Gravar pontuação é público: quem joga não tem login. Por isso a entrada é
   validada com rigor — nome curto e sem marcação, pontos inteiros com teto — e
   limitada por IP. Sem o limite, uma linha de curl enche a lista em segundos.
   A lista guarda os 20 ÚLTIMOS jogos; a ordem de líder é feita na tela. */
const PLACAR_TAM = 20;
const placarHist = new Map();
function placarAllow(ip) {
  const agora = Date.now();
  const arr = (placarHist.get(ip) || []).filter(t => agora - t < 3600000);
  if (arr.length >= 20) { placarHist.set(ip, arr); return false; }
  arr.push(agora);
  placarHist.set(ip, arr);
  return true;
}

app.get('/api/placar', (req, res) => {
  res.json({
    placar: db.placar || [],
    carroUrl: (db.minigame && db.minigame.carroUrl) || "",
  });
});

app.post('/api/placar', (req, res) => {
  if (!placarAllow(req.ip)) return res.status(429).json({ error: 'Muitos registros seguidos. Tente daqui a pouco.' });
  const nome = String(req.body && req.body.nome || '').replace(/<[^>]*>/g, '').trim().slice(0, 24) || 'Anônimo';
  const bruto = Number(req.body && req.body.pontos);
  if (!Number.isFinite(bruto) || bruto < 0) return res.status(400).json({ error: 'Pontuação inválida.' });
  const pontos = Math.min(99999, Math.floor(bruto));
  db.placar = [...(db.placar || []), { nome, pontos, quando: Date.now() }].slice(-PLACAR_TAM);
  save();
  res.json({ ok: true, placar: db.placar });
});

/* Ajustes do jogo ficam com o console: trocar o carro e zerar o placar. */
app.post('/api/minigame', requireAuth, (req, res) => {
  const carro = String(req.body && req.body.carroUrl || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
  db.minigame = { carroUrl: carro };
  if (req.body && req.body.limparPlacar) db.placar = [];
  save();
  res.json({ ok: true, minigame: db.minigame, placar: db.placar || [] });
});

/* ── Marca e prévia de link ──────────────────────────────────────────────────
   Só as rotas fixas entram em "paginas": categoria e vídeo já montam a prévia
   com a capa do próprio conteúdo, e aceitar caminho livre aqui deixaria alguém
   pendurar meta tags em qualquer endereço do site. */
const ROTAS_COM_PREVIA = ['/framety', '/novidades', '/tutorial', '/cadastroparceiro', '/screendimension'];

function limparBranding(entrada) {
  /* Sem cleanContent aqui: ele descarta qualquer chave fora de [A-Za-z0-9_], e
     as chaves de "paginas" SÃO caminhos ("/novidades"). A limpeza é feita campo
     a campo — corta o tamanho e tira tags, porque estes valores vão para dentro
     de atributos de <meta> (onde ainda passam por escapeHtml). */
  const d = entrada && typeof entrada === 'object' ? entrada : {};
  const txt = (v, n) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim().slice(0, n) : '');
  const paginas = {};
  const vindas = d.paginas && typeof d.paginas === 'object' ? d.paginas : {};
  for (const rota of ROTAS_COM_PREVIA) {
    const v = vindas[rota];
    if (!v || typeof v !== 'object') continue;
    const item = { titulo: txt(v.titulo, 120), descricao: txt(v.descricao, 300), imagem: txt(v.imagem, 500) };
    if (item.titulo || item.descricao || item.imagem) paginas[rota] = item;
  }
  return {
    favicon: txt(d.favicon, 500),
    ogTitulo: txt(d.ogTitulo, 120),
    ogDescricao: txt(d.ogDescricao, 300),
    ogImagem: txt(d.ogImagem, 500),
    paginas,
  };
}

app.get('/api/branding', (req, res) => {
  res.json(db.branding || JSON.parse(JSON.stringify(SEED.branding)));
});

app.post('/api/branding', requireAuth, (req, res) => {
  db.branding = limparBranding(req.body);
  save();
  res.json({ ok: true, branding: db.branding });
});

/* ── Novidades (cartão da home + página /novidades) ──────────────────────────
   Leitura pública, escrita só pelo console. O conteúdo passa pela mesma limpeza
   dos textos da home (cleanContent): campos *Html são sanitizados, o resto perde
   qualquer tag. O id do YouTube é extraído aqui e guardado sozinho — assim a
   página nunca monta um embed com uma URL arbitrária. */
function idDoYoutube(v) {
  const m = String(v || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(String(v || "").trim()) ? String(v).trim() : "";
}

function limparNovidades(entrada) {
  const base = JSON.parse(JSON.stringify(SEED.novidades));
  const dado = cleanContent(entrada && typeof entrada === "object" ? entrada : {});
  const card = dado.card || {};
  const pagina = dado.pagina || {};
  const blocos = Array.isArray(pagina.blocos) ? pagina.blocos.slice(0, 60) : [];
  return {
    ativo: dado.ativo !== false,
    card: {
      etiqueta: card.etiqueta ?? base.card.etiqueta,
      titulo:   card.titulo   ?? base.card.titulo,
      texto:    card.texto    ?? base.card.texto,
      botao:    card.botao    ?? base.card.botao,
      imagem:   typeof card.imagem === "string" ? card.imagem : "",
    },
    pagina: {
      titulo: pagina.titulo ?? base.pagina.titulo,
      resumo: pagina.resumo ?? base.pagina.resumo,
      blocos: blocos.map((b, i) => {
        const tipo = ["texto", "imagem", "video"].includes(b.tipo) ? b.tipo : "texto";
        return {
          id: typeof b.id === "string" && b.id ? b.id.slice(0, 40) : "b" + Date.now() + i,
          tipo,
          titulo: b.titulo || "",
          textoHtml: tipo === "texto" ? sanitizeHtml(String(b.textoHtml || "")) : "",
          imagem: tipo === "imagem" ? String(b.imagem || "") : "",
          youtube: tipo === "video" ? idDoYoutube(b.youtube) : "",
          legenda: b.legenda || "",
        };
      }),
    },
  };
}

app.get('/api/novidades', (req, res) => {
  res.json(db.novidades || JSON.parse(JSON.stringify(SEED.novidades)));
});

app.post('/api/novidades', requireAuth, (req, res) => {
  db.novidades = limparNovidades(req.body);
  save();
  res.json({ ok: true, novidades: db.novidades });
});

app.post('/api/theme', requireAuth, (req, res) => {
  const accent = String((req.body && req.body.accent) || '').trim();
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    return res.status(400).json({ error: 'Cor inválida. Use o formato #RRGGBB.' });
  }
  if (accent) db.settings.accent = accent.toUpperCase();
  else delete db.settings.accent;   // vazio = volta para a cor padrão
  save();
  res.json({ ok: true, accent: db.settings.accent || '' });
});

// Volta a home para os textos padrão do content.js.
app.delete('/api/site-content', requireAuth, (req, res) => {
  delete db.settings.siteContent;
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

// ── OS por #SKY — busca o job na planilha do Google ──────────────────────────
// A aba Produções não guarda mais uma lista: o operador digita o #SKY e o
// servidor busca aquela linha na planilha. Enquanto a planilha não estiver
// configurada, caímos nas linhas já salvas no banco, para a tela seguir usável.
function osRowFromLocalDb(sky) {
  const key = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
  const wanted = key(sky);
  if (!wanted) return null;
  for (const page of (db.locucoesPages || [])) {
    for (const r of (page.rows || [])) {
      if (key(r.id) === wanted) return r;
    }
  }
  return null;
}

app.get('/api/os/lookup', requireLocucoesRead, async (req, res) => {
  const sky = String(req.query.sky || '').trim();
  if (!sky) return res.status(400).json({ error: 'Informe o #SKY do job.' });

  if (!sheets.isConfigured()) {
    const local = osRowFromLocalDb(sky);
    if (!local) return res.status(404).json({ error: `Nenhum job com o código "${sky}".`, source: 'local' });
    return res.json({ row: local, source: 'local' });
  }

  try {
    const row = await sheets.lookup(sky);
    if (!row) return res.status(404).json({ error: `Nenhum job com o código "${sky}" na planilha.`, source: 'sheet' });
    res.json({ row, source: 'sheet' });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Diagnóstico da integração (o console mostra isso quando a busca falha).
app.get('/api/os/sheet-status', requireAuth, async (req, res) => {
  try { res.json(await sheets.status()); }
  catch (e) { res.status(500).json({ configured: false, error: e.message }); }
});

/* Endereço da planilha, guardado no BANCO e editado no console. Fica aqui, e
   não no código, porque o repositório é público: publicar o link entregaria
   cachê e fornecedor de todos os jobs a quem passasse pelo GitHub. E fica no
   banco, e não numa variável do Render, para poder ser trocado sem deploy. */
app.get('/api/os/sheet-config', requireAuth, (req, res) => {
  const cfg = db.settings.osSheet || {};
  res.json({ spreadsheetId: cfg.spreadsheetId || '', gid: cfg.gid || '' });
});

app.post('/api/os/sheet-config', requireAuth, async (req, res) => {
  const bruto = trim((req.body || {}).spreadsheetId, 400);
  const gid = trim((req.body || {}).gid, 40);
  // Aceita o ID puro ou a URL inteira colada da barra do navegador.
  const id = bruto ? sheets.normalizeSpreadsheetId(bruto) : '';
  if (bruto && !/^[a-zA-Z0-9-_]{20,}$/.test(id)) {
    return res.status(400).json({ error: 'Endereço de planilha inválido. Cole a URL inteira ou só o ID.' });
  }
  db.settings.osSheet = id ? { spreadsheetId: id, gid } : null;
  sheets.usarConfig(db.settings.osSheet);
  try { await saveDB(db); }
  catch (e) { return res.status(500).json({ error: 'Não foi possível salvar.' }); }
  // Devolve o diagnóstico já com a planilha nova: quem salvou vê na hora se
  // colou o endereço certo, em vez de descobrir na primeira busca que falha.
  try { res.json({ ok: true, status: await sheets.status() }); }
  catch (e) { res.json({ ok: true, status: { configured: false, error: e.message } }); }
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

// ── Duas trilhas de revisão: o storyboard e o roteiro ────────────────────────
// Mecânica idêntica (V1 + SB_ROUNDS rodadas, depois aprovação), campos
// distintos: na produção o roteiro é fechado ANTES de o storyboard ser
// desenhado, então aprovar um não pode travar o outro.
//
// O comentário, porém, é UM SÓ: ele é da cena, e aparece nas duas telas. O que
// o campo `origem` diz é em qual das duas ele foi escrito — e, portanto, qual
// rodada o consome quando o cliente envia. Sem isso, comentar no roteiro
// esvaziaria a rodada do storyboard sem ninguém pedir.
const SB_TRILHAS = {
  deck: {
    chave: 'deck', nome: 'storyboard',
    ver: 'version', st: 'status',
    aprovEm: 'approvedAt', aprovPor: 'approvedBy', aprovEmp: 'approvedCompany',
  },
  roteiro: {
    chave: 'roteiro', nome: 'roteiro',
    ver: 'roteiroVersion', st: 'roteiroStatus',
    aprovEm: 'roteiroApprovedAt', aprovPor: 'roteiroApprovedBy', aprovEmp: 'roteiroApprovedCompany',
  },
};
const sbTrilha = (escopo) => SB_TRILHAS[escopo === 'roteiro' ? 'roteiro' : 'deck'];
// Storyboards criados antes da trilha do roteiro não têm os campos: valem V1.
const sbVer = (sb, t) => sb[t.ver] || 1;
const sbSt  = (sb, t) => sb[t.st] || ('v' + sbVer(sb, t));
const sbOrigem = (c) => (c.origem === 'roteiro' ? 'roteiro' : 'deck');

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
    // Trilha do roteiro, com o padrão de quem foi criado antes dela existir.
    roteiroStatus: sbSt(sb, SB_TRILHAS.roteiro), roteiroVersion: sbVer(sb, SB_TRILHAS.roteiro),
    roteiroApprovedAt: sb.roteiroApprovedAt || null, roteiroApprovedBy: sb.roteiroApprovedBy || '',
    pages: sb.pages, comments: sb.comments, pathSlug: sb.pathSlug,
    lastCommentAt: sb.lastCommentAt, updatedAt: sb.updatedAt,
    // Token de ação: o caminho amigável tem barras e não cabe num parâmetro de
    // rota atrás de proxy, então as escritas do cliente usam este id opaco.
    token: sb.shareSlug,
  };
}

const sbFind = (id) => db.storyboards.find(s => s.id === id);

// ── Screendimension: fichas técnicas salvas ──────────────────────────────────
// O PDF não é guardado: guarda-se o que o gera (medidas digitadas + ângulo do 3D),
// e o site remonta a ficha para baixar de novo ou editar. Só para quem está logado
// no console — as fichas levam nome de cliente.
const SD_MODES = ['rect', 'curve'];
const SD_INPUT_KEYS = ['A', 'L', 'P', 'fBaseM', 'fDepM', 'C', 'Ang', 'Bl', 'Vw', 'Vh', 'Sg'];
function sdClean(b, prev = {}) {
  const inputs = {};
  const src = b.inputs && typeof b.inputs === 'object' ? b.inputs : (prev.inputs || {});
  SD_INPUT_KEYS.forEach(k => { if (src[k] != null) inputs[k] = trim(String(src[k]), 20); });
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : undefined);
  const view = b.view && typeof b.view === 'object'
    ? { theta: num(b.view.theta), phi: num(b.view.phi), dist: num(b.view.dist) }
    : prev.view || null;
  return {
    cliente: typeof b.cliente === 'string' ? trim(b.cliente, 120) : (prev.cliente || ''),
    projeto: typeof b.projeto === 'string' ? trim(b.projeto, 120) : (prev.projeto || ''),
    mode: SD_MODES.includes(b.mode) ? b.mode : (prev.mode || 'rect'),
    inputs, view,
    resumo: typeof b.resumo === 'string' ? trim(b.resumo, 200) : (prev.resumo || ''),
  };
}
app.get('/api/screendims', requireAuth, (req, res) => res.json(db.screendims));
app.post('/api/screendims', requireAuth, async (req, res) => {
  const d = { id: sbId('sd_'), ...sdClean(req.body || {}), createdAt: sbNow(), updatedAt: sbNow() };
  db.screendims.unshift(d);
  try { await saveDB(db); }
  catch (e) {
    db.screendims = db.screendims.filter(x => x.id !== d.id);
    console.error('[sd create]', e);
    return res.status(500).json({ error: 'Não foi possível salvar a ficha.' });
  }
  res.json(d);
});
app.put('/api/screendims/:id', requireAuth, async (req, res) => {
  const d = db.screendims.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Ficha não encontrada.' });
  const antes = JSON.stringify(d);
  Object.assign(d, sdClean(req.body || {}, d), { updatedAt: sbNow() });
  try { await saveDB(db); }
  catch (e) {
    Object.assign(d, JSON.parse(antes));
    console.error('[sd save]', e);
    return res.status(500).json({ error: 'Não foi possível gravar. Nada foi alterado — tente de novo.' });
  }
  res.json(d);
});
app.delete('/api/screendims/:id', requireAuth, async (req, res) => {
  const antes = db.screendims;
  db.screendims = db.screendims.filter(x => x.id !== req.params.id);
  if (db.screendims.length === antes.length) return res.status(404).json({ error: 'Ficha não encontrada.' });
  try { await saveDB(db); }
  catch (e) {
    db.screendims = antes;
    console.error('[sd delete]', e);
    return res.status(500).json({ error: 'Não foi possível apagar.' });
  }
  res.status(204).end();
});

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
    roteiroStatus: 'v1', roteiroVersion: 1,
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
// O cliente chega SÓ pelo código opaco (shareSlug), que também é o token das
// escritas dele. A busca pelo caminho legível (cliente/produto/projeto) foi
// REMOVIDA: ela era pública e devolvia o documento inteiro junto com o token de
// escrita, então quem adivinhasse os nomes — que aparecem no próprio caminho —
// lia o storyboard, comentava e podia até aprová-lo. Esse caminho agora é
// endereço de edição, atrás da senha.
const sbBySlug = (slug) => db.storyboards.find(s => s.shareSlug === slug);

app.get('/api/sb/:slug', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  res.json(sbPublic(sb));
});

app.post('/api/sb/:slug/comments', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const { pageId, author, company, text } = req.body || {};
  // Quem trava o comentário é a trilha em que ele está sendo escrito: com o
  // roteiro aprovado ainda se comenta o storyboard, e vice-versa.
  const t = sbTrilha((req.body || {}).origem);
  if (sbSt(sb, t) === 'aprovado') return res.status(409).json({ error: `O ${t.nome} já foi aprovado.` });
  if (!trim(text, 4000)) return res.status(400).json({ error: 'Comentário vazio.' });
  if (!(sb.pages || []).some(p => p.id === pageId)) return res.status(400).json({ error: 'Página inválida.' });
  const c = {
    id: sbId('c_'), pageId, origem: t.chave,
    author: trim(author, 80) || 'Cliente', company: trim(company, 80),
    text: trim(text, 4000),
    version: sbVer(sb, t), createdAt: sbNow(), submitted: false,
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
  const t = sbTrilha((req.body || {}).escopo);
  if (sbSt(sb, t) === 'aprovado') return res.status(409).json({ error: `O ${t.nome} já foi aprovado.` });
  if (sbVer(sb, t) >= SB_MAX_VERSION) {
    return res.status(409).json({ error: `As ${SB_ROUNDS} rodadas de alteração deste ${t.nome} já foram usadas.` });
  }
  // Só os comentários escritos NESTA trilha entram na rodada dela. Os da outra
  // continuam visíveis nas duas telas, esperando a rodada a que pertencem.
  const pending = (sb.comments || []).filter(c => !c.submitted && sbOrigem(c) === t.chave);
  if (!pending.length) return res.status(400).json({ error: 'Nenhum comentário para enviar.' });
  pending.forEach(c => { c.submitted = true; });
  sb[t.ver] = Math.min(sbVer(sb, t) + 1, SB_MAX_VERSION);
  sb[t.st] = 'v' + sb[t.ver];
  sb.lastCommentAt = sbNow();
  sb.unread = (sb.unread || 0) + pending.length;
  sb.updatedAt = sbNow();
  save();
  res.json({ ok: true, escopo: t.chave, status: sb[t.st], version: sb[t.ver] });
});

app.post('/api/sb/:slug/approve', (req, res) => {
  const sb = sbBySlug(req.params.slug);
  if (!sb) return res.status(404).json({ error: 'Storyboard não encontrado.' });
  const { author, company } = req.body || {};
  const t = sbTrilha((req.body || {}).escopo);
  // Fecha só os comentários desta trilha: os da outra ainda têm rodada aberta.
  (sb.comments || []).forEach(c => { if (sbOrigem(c) === t.chave) c.submitted = true; });
  sb[t.st] = 'aprovado';
  sb[t.aprovEm] = sbNow();
  sb[t.aprovPor] = trim(author, 80) || 'Cliente';
  sb[t.aprovEmp] = trim(company, 80);
  sb.unread = (sb.unread || 0) + 1;
  sb.updatedAt = sbNow();
  save();
  res.json({ ok: true, escopo: t.chave, status: sb[t.st] });
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
  if (RESERVED_SLUGS.has(slug) || ROTAS.RESERVADOS.has(slug)) return res.status(400).json({ error: 'Esse nome é reservado pelo site. Escolha outro.' });
  if (db.categories.some(c => c.id === slug) || ROTAS.resolver('/' + slug, db)) return res.status(400).json({ error: `/${slug} já é uma página do site (categoria ou seção). Escolha outro nome.` });
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

// ── Endereços públicos (home, seções, categorias, vídeos, clientes) ──────────
// Depois de arquivos e API, antes dos links curtos: uma página do site sempre
// vence um link curto de mesmo nome. Endereço antigo, com acento ou maiúscula
// leva 301 para a forma canônica.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const rota = ROTAS.resolver(req.path, db);
  if (!rota) return next();
  let atual = req.path;
  try { atual = decodeURIComponent(req.path); } catch (_) {}
  atual = atual.replace(/\/+$/, '') || '/';
  if (atual !== rota.canonico) {
    const i = req.originalUrl.indexOf('?');
    return res.redirect(301, encodeURI(rota.canonico) + (i >= 0 ? req.originalUrl.slice(i) : ''));
  }
  enviarSpa(req, res, rota);
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
  if (!db.screendims)  { db.screendims  = []; _migrated = true; }
  // Chaves novas: o banco gravado não as tem, e loadDB devolve o que está
  // gravado — sem estas linhas elas só nasceriam na primeira gravação pelo
  // console. Cada uma só preenche quando falta, então nada existente é tocado.
  if (!db.novidades)  { db.novidades  = JSON.parse(JSON.stringify(SEED.novidades));  _migrated = true; }
  if (!db.branding)   { db.branding   = JSON.parse(JSON.stringify(SEED.branding));   _migrated = true; }
  if (!db.minigame)   { db.minigame   = JSON.parse(JSON.stringify(SEED.minigame));   _migrated = true; }
  if (!db.placar)     { db.placar     = [];                                          _migrated = true; }
  if (!db.instagram)  { db.instagram  = JSON.parse(JSON.stringify(SEED.instagram));  _migrated = true; }
  // Storyboards criados antes da URL amigável ganham seu caminho agora.
  db.storyboards.forEach(s => { if (!s.pathSlug) { s.pathSlug = sbBuildPath(s); _migrated = true; } });
  if (!db.settings.aiSection) db.settings.aiSection = JSON.parse(JSON.stringify(SEED.settings.aiSection));
  if (!db.settings.aiSection.items) db.settings.aiSection.items = JSON.parse(JSON.stringify(SEED.settings.aiSection.items));
  if (db.settings.producoes_pass == null) db.settings.producoes_pass = SEED.settings.producoes_pass;
  if (db.settings.recovery_token == null) db.settings.recovery_token = SEED.settings.recovery_token;
  if (!db.settings.formatosImersivos) { db.settings.formatosImersivos = JSON.parse(JSON.stringify(SEED.settings.formatosImersivos)); _migrated = true; }
  if (db.settings.tutorial_video_url == null) db.settings.tutorial_video_url = SEED.settings.tutorial_video_url;
  if (db.settings.tutorial_title == null) db.settings.tutorial_title = SEED.settings.tutorial_title;
  if (db.settings.tutorial_subtitle == null) db.settings.tutorial_subtitle = SEED.settings.tutorial_subtitle;
  if (db.settings.tutorial_text == null) db.settings.tutorial_text = SEED.settings.tutorial_text;

  // Endereços amigáveis (rotas.js): quem ainda não tem slug ganha um. Em ordem
  // de exibição, para o primeiro de dois títulos iguais ficar com o nome limpo.
  const _porOrdem = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  [...db.videos].sort(_porOrdem).forEach(v => { if (!v.slug) { v.slug = slugDoVideo(v, v); _migrated = true; } });
  [...db.clients].sort(_porOrdem).forEach(c => { if (!c.slug) { c.slug = slugDoCliente(c, c); _migrated = true; } });

  const _now = new Date().toISOString();
  let _backfilled = _migrated;
  db.videos.forEach(v => {
    if (!v.updatedAt) { v.updatedAt = _now; _backfilled = true; }
    if (v.aiGenerated === undefined) { v.aiGenerated = false; _backfilled = true; }
  });
  if (_backfilled) await saveDB(db);

  // Planilha de jobs: o endereço salvo pelo console tem precedência sobre o
  // arquivo local e as variáveis de ambiente. Ver sheets.js.
  sheets.usarConfig(db.settings.osSheet);

  app.listen(PORT, () => {
    console.log(`\n  Framety  →  http://localhost:${PORT}/Framety.html\n`);
  });

  /* Formato dos vídeos já cadastrados: quem nunca foi medido é medido agora,
     um de cada vez e depois que o site já está no ar — é ida à rede, e não
     pode segurar o arranque. Só grava se algo mudou. */
  (async () => {
    const semMedida = db.videos.filter(v => typeof v.capaEmPe !== 'boolean');
    if (!semMedida.length) return;
    let emPe = 0;
    for (const v of semMedida) {
      const f = await medeFormatoYoutube(v.videoUrl);
      v.capaEmPe = f.capaEmPe;
      if (typeof v.vertical !== 'boolean' || (f.vertical && !v.vertical)) v.vertical = f.vertical;
      if (f.vertical) emPe++;
      await new Promise(r => setTimeout(r, 120));
    }
    await saveDB(db);
    console.log(`  formato medido em ${semMedida.length} vídeos — ${emPe} em pé (9:16)`);
  })().catch(e => console.error('[formato]', e.message || e));
})();
