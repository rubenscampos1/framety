/* Teste de integridade da aba de Storyboards.
   Sobe uma instância isolada (banco e uploads próprios, senha semente 0000),
   exercita o ciclo inteiro e reinicia o servidor no meio para provar que o que
   foi gravado sobrevive a um deploy. Não toca no banco nem nas imagens reais. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const PORT = 3210;
const BASE = `http://127.0.0.1:${PORT}`;
let proc = null;
const falhas = [];
const ok = (nome) => console.log('  ✓ ' + nome);
const bad = (nome, detalhe) => { falhas.push(nome + (detalhe ? ' — ' + detalhe : '')); console.log('  ✗ ' + nome + (detalhe ? ' — ' + detalhe : '')); };
const check = (nome, cond, detalhe) => cond ? ok(nome) : bad(nome, detalhe);

function start() {
  return new Promise((resolve, reject) => {
    proc = spawn(process.execPath, [path.join(DIR,'..','server.js')], {
      env: { ...process.env, PORT: String(PORT), DATABASE_URL:'', CLOUDINARY_URL:'', DB_FILE: path.join(DIR,'db.json'), UPLOADS_DIR: path.join(DIR,'uploads') },
      cwd: path.join(DIR,'..'), stdio: ['ignore', 'pipe', 'pipe'],
    });
    let saida = '';
    proc.stdout.on('data', d => { saida += d; if (/listening|rodando|:\s*\d+/i.test(saida)) resolve(); });
    proc.stderr.on('data', d => { saida += d; });
    proc.on('error', reject);
    setTimeout(resolve, 1500);   // sobe rápido; o ping abaixo confirma
  });
}
const stop = () => new Promise(r => { if (!proc) return r(); proc.once('exit', () => r()); proc.kill(); });

async function esperaNoAr() {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/api/storage-status'); return true; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  throw new Error('servidor não subiu');
}

let TOKEN = '';
async function api(method, url, body, isForm) {
  const opts = { method, headers: { 'x-auth-token': TOKEN } };
  if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  else if (body) opts.body = body;
  const r = await fetch(BASE + url, opts);
  const txt = await r.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  return { status: r.status, data };
}
function form(file, nome) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(path.join(DIR, file))], { type: 'image/png' }), nome);
  return fd;
}

(async () => {
  // banco limpo a cada rodada
  for (const f of ['db.json','db.json.tmp']) { try { fs.unlinkSync(path.join(DIR, f)); } catch {} }
  try { fs.rmSync(path.join(DIR, 'uploads'), { recursive: true, force: true }); } catch {}

  await start(); await esperaNoAr();
  console.log('\n── 1. Sessão e armazenamento ─────────────────────────────');

  const login = await api('POST', '/api/auth/login', { password: '0000' });
  TOKEN = login.data && login.data.token || '';
  check('login com a senha semente', !!TOKEN, 'status ' + login.status);

  const st = await api('GET', '/api/storage-status');
  check('storage-status responde', st.status === 200, 'status ' + st.status);
  check('detecta disco efêmero (sem CLOUDINARY_URL)', st.data && st.data.durable === false, JSON.stringify(st.data));

  console.log('\n── 2. Criar, gravar e subir imagens ──────────────────────');
  const criado = await api('POST', '/api/storyboards', { cliente: 'ACME', projeto: 'FILME', categoria: 'Imersivo', produto: 'TORRE A' });
  const ID = criado.data && criado.data.id;
  check('cria storyboard', criado.status === 200 && !!ID, 'status ' + criado.status);
  const SLUG = criado.data && criado.data.shareSlug;

  const upCena = await api('POST', `/api/upload/storyboard/${ID}`, form('cena.png', 'cena.png'), true);
  check('sobe imagem de cena', upCena.status === 200 && !!upCena.data.url, JSON.stringify(upCena.data));

  const upCapa = await api('POST', `/api/storyboards/${ID}/cover`, form('capa.png', 'capa.png'), true);
  check('sobe a capa', upCapa.status === 200 && !!upCapa.data.coverUrl, JSON.stringify(upCapa.data));

  // grava um deck com a imagem na cena
  const base = criado.data.pages.map(p => p.type === 'scene'
    ? { ...p, imageUrl: upCena.data.url, imagePublicId: upCena.data.publicId || '', imageVersion: 1, imageSince: new Date().toISOString(), locucao: 'Locução da cena 1', visual: 'Plano aberto', sfx: 'Vento' }
    : p);
  const put = await api('PUT', `/api/storyboards/${ID}`, { cliente: 'ACME', projeto: 'FILME', categoria: 'Imersivo', produto: 'TORRE A', pages: base });
  check('grava o deck', put.status === 200, 'status ' + put.status);

  console.log('\n── 3. O porteiro do deck (o que protege o documento) ─────');
  const casos = [
    ['recusa pages vazio',            { pages: [] }],
    ['recusa pages não-array',        { pages: { 0: 'x' } }],
    ['recusa página sem id',          { pages: [{ type: 'cover' }] }],
    ['recusa tipo desconhecido',      { pages: [{ id: 'a', type: 'foo' }] }],
    ['recusa ids repetidos',          { pages: [{ id: 'a', type: 'cover' }, { id: 'a', type: 'end' }] }],
    ['recusa página nula',            { pages: [null] }],
  ];
  for (const [nome, corpo] of casos) {
    const r = await api('PUT', `/api/storyboards/${ID}`, corpo);
    check(nome, r.status === 400, 'status ' + r.status);
  }
  const depois = await api('GET', '/api/storyboards');
  const vivo = depois.data.find(s => s.id === ID);
  check('deck intacto depois das recusas', vivo && vivo.pages.length === base.length, 'páginas: ' + (vivo && vivo.pages.length));

  // A remoção de asset aceita uma url do cliente: ela não pode virar chave para
  // apagar arquivo fora da pasta de uploads.
  const alvo = path.join(DIR, 'nao-apagar.txt');
  fs.writeFileSync(alvo, 'sentinela');
  await api('POST', `/api/storyboards/${ID}/asset/remove`, { url: '/uploads/../nao-apagar.txt' });
  await api('POST', `/api/storyboards/${ID}/asset/remove`, { url: '/uploads/../../framety-db.json' });
  check('não apaga fora da pasta de uploads (../)', fs.existsSync(alvo));
  check('não apaga o banco real', fs.existsSync(path.join(DIR, '..', 'framety-db.json')));
  fs.unlinkSync(alvo);

  console.log('\n── 4. Preview do link do cliente (WhatsApp) ──────────────');
  const pag = await fetch(`${BASE}/sb/${SLUG}`);
  const html = await pag.text();
  const og = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
  check('og:image é absoluta', /^https?:\/\//.test(og), og);
  check('og:image é a capa enviada', og.endsWith(upCapa.data.coverUrl), og);
  const ogT = (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || '';
  check('og:title traz o cliente', ogT.includes('ACME'), ogT);
  const capaResp = await fetch(og);
  check('a imagem de preview abre de verdade', capaResp.status === 200, 'status ' + capaResp.status);
  check('tem og:image:secure_url', /og:image:secure_url/.test(html));
  check('tem og:image:alt', /og:image:alt/.test(html));
  // Capa no disco (dev): não pode anunciar medida que não conferimos.
  check('capa fora do Cloudinary nao inventa medida', !/og:image:width/.test(html));

  // O caminho legivel cliente/produto/projeto e endereco de EDICAO, atras da
  // senha. Ele nao pode descrever o documento: o proprio caminho traz o nome do
  // cliente, e um link colado num grupo nao deve revelar de quem e o projeto.
  const caminho = (vivo && vivo.pathSlug) || '';
  const viaPath = await fetch(`${BASE}/storyboards/${caminho}`).then(r => r.text()).catch(() => '');
  const ogPathImg = (viaPath.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
  const ogPathT = (viaPath.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || '';
  check('area interna nao expoe a capa', !ogPathImg.endsWith(upCapa.data.coverUrl), ogPathImg);
  check('area interna nao expoe o cliente', !/ACME/i.test(ogPathT), ogPathT);

  // E a busca publica pelo caminho legivel tem de estar fechada: ela devolvia o
  // documento inteiro E o token de escrita a quem adivinhasse os nomes.
  const espiar = await fetch(`${BASE}/api/sb/path/${caminho}`);
  check('busca publica pelo caminho legivel esta fechada', espiar.status === 404, 'status ' + espiar.status);

  console.log('\n── 5. Reinício do servidor (o "atualizar o site") ────────');
  // Segundo documento, só para o recorte social: a capa dele vai apontar para o
  // Cloudinary, e assim o primeiro continua com a capa de disco intacta para as
  // conferências de sobrevivência e de limpeza do armazenamento.
  const criado2 = await api('POST', '/api/storyboards', { cliente: 'CLOUD', projeto: 'PREVIEW', categoria: 'Teste', produto: 'CAPA' });
  const ID2 = criado2.data && criado2.data.id;
  const SLUG2 = criado2.data && criado2.data.shareSlug;

  await stop();

  // Com o servidor parado, aponta a capa do segundo para uma URL do Cloudinary
  // e exercita o recorte social. O WhatsApp descarta em silencio imagem de
  // vários MB (as nossas vêm da câmera), então o preview tem de sair pedindo ao
  // Cloudinary a versão 1200x630 em JPEG.
  const dbPath = path.join(DIR, 'db.json');
  {
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const alvo = raw.storyboards.find(s => s.id === ID2);
    alvo.coverUrl = 'https://res.cloudinary.com/hqualqrf/image/upload/v1783625920/framety/exemplo.png';
    alvo.coverPublicId = 'framety/exemplo';
    fs.writeFileSync(dbPath, JSON.stringify(raw, null, 2));
  }

  await start(); await esperaNoAr();
  const relogin = await api('POST', '/api/auth/login', { password: '0000' });
  TOKEN = relogin.data.token;
  const pos = await api('GET', '/api/storyboards');
  const sb2 = pos.data.find(s => s.id === ID);
  check('storyboard sobrevive ao reinício', !!sb2);
  check('capa sobrevive', sb2 && sb2.coverUrl === upCapa.data.coverUrl, sb2 && sb2.coverUrl);
  check('texto da cena sobrevive', sb2 && sb2.pages.some(p => p.locucao === 'Locução da cena 1'));
  check('imagem da cena sobrevive', sb2 && sb2.pages.some(p => p.imageUrl === upCena.data.url));
  const arq = await fetch(BASE + upCena.data.url);
  check('o arquivo da cena ainda é servido', arq.status === 200, 'status ' + arq.status);

  console.log('\n── 5b. Recorte social da capa (o que salva o preview) ────');
  const htmlC = await fetch(`${BASE}/sb/${SLUG2}`).then(r => r.text());
  const ogC = (htmlC.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
  check('pede o recorte ao Cloudinary', /\/image\/upload\/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto\//.test(ogC), ogC);
  check('mantem a mesma imagem (mesmo public_id)', ogC.endsWith('/v1783625920/framety/exemplo.png'), ogC);
  check('nao empilha transformacao sobre transformacao', (ogC.match(/c_fill/g) || []).length === 1, ogC);
  check('anuncia 1200x630', /og:image:width" content="1200"/.test(htmlC) && /og:image:height" content="630"/.test(htmlC));
  check('anuncia jpeg', /og:image:type" content="image\/jpeg"/.test(htmlC));
  check('og:image absoluta e https', /^https:\/\//.test(ogC), ogC);

  console.log('\n── 6. Visão pública e comentários ────────────────────────');
  const pub = await api('GET', `/api/sb/${SLUG}`);
  check('cliente lê pelo slug', pub.status === 200 && pub.data.id === ID, 'status ' + pub.status);
  check('visão pública não vaza o unread', pub.data && pub.data.unread === undefined);
  const pagina = pub.data.pages.find(p => p.type === 'scene');
  const com = await api('POST', `/api/sb/${SLUG}/comments`, { pageId: pagina.id, author: 'Cliente', company: 'ACME', text: 'Trocar o plano.' });
  check('cliente comenta', com.status === 200 || com.status === 201, 'status ' + com.status);
  const pub2 = await api('GET', `/api/sb/${SLUG}`);
  check('comentário persistiu', (pub2.data.comments || []).some(c => c.text === 'Trocar o plano.'));

  console.log('\n── 7. Apagar limpa o armazenamento ───────────────────────');
  const capaFisica = path.join(DIR, upCapa.data.coverUrl.replace(/^\//, ''));
  const cenaFisica = path.join(DIR, upCena.data.url.replace(/^\//, ''));
  check('arquivos existem antes de apagar', fs.existsSync(capaFisica) && fs.existsSync(cenaFisica));
  const del = await api('DELETE', `/api/storyboards/${ID}`);
  check('apaga o storyboard', del.status === 204, 'status ' + del.status);
  await new Promise(r => setTimeout(r, 600));
  check('capa saiu do armazenamento', !fs.existsSync(capaFisica));
  check('imagem da cena saiu do armazenamento', !fs.existsSync(cenaFisica));

  await stop();
  console.log('\n══════════════════════════════════════════════════════════');
  if (falhas.length) { console.log(`${falhas.length} FALHA(S):`); falhas.forEach(f => console.log('  • ' + f)); process.exit(1); }
  console.log('Tudo passou.');
})().catch(async (e) => { console.error('\nERRO NO TESTE:', e); await stop(); process.exit(1); });
