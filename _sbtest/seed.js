/* Sobe a instância isolada com alguns storyboards e capas, e deixa no ar para
   conferência visual do hub e do editor. Banco e uploads próprios. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const DIR = __dirname, PORT = 3210, BASE = `http://127.0.0.1:${PORT}`;

const capa = (a, b, txt) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300">
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
     <rect width="480" height="300" fill="url(#g)"/>
     <text x="240" y="165" font-family="monospace" font-size="46" fill="#fff" text-anchor="middle">${txt}</text>
   </svg>`);

(async () => {
  for (const f of ['db.json','db.json.tmp']) { try { fs.unlinkSync(path.join(DIR, f)); } catch {} }
  try { fs.rmSync(path.join(DIR, 'uploads'), { recursive: true, force: true }); } catch {}

  const proc = spawn(process.execPath, [path.join(DIR,'..','server.js')], {
    env: { ...process.env, PORT: String(PORT), DATABASE_URL:'', CLOUDINARY_URL:'', DB_FILE: path.join(DIR,'db.json'), UPLOADS_DIR: path.join(DIR,'uploads') },
    cwd: path.join(DIR,'..'), stdio: 'inherit', detached: false,
  });
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/api/storage-status'); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }

  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: '0000' }),
  }).then(r => r.json());
  const T = login.token;
  const api = (m, u, b, form) => fetch(BASE + u, {
    method: m,
    headers: form ? { 'x-auth-token': T } : { 'x-auth-token': T, 'Content-Type': 'application/json' },
    body: form ? b : (b ? JSON.stringify(b) : undefined),
  }).then(async r => ({ status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) }));

  const decks = [
    { cliente: 'EBM', projeto: 'VIDEO IMERSIVO', produto: 'METROPOLITAN MARISTA', categoria: 'Imersivo', cor: ['#3a1c71', '#d76d77'], txt: 'EBM' },
    { cliente: 'AVIVA', projeto: 'INSTITUCIONAL', produto: 'FAZENDA CANOA', categoria: 'Institucional', cor: ['#0b486b', '#f56217'], txt: 'AVIVA' },
    { cliente: 'HSM', projeto: 'IMERSIVO INGLÊS', produto: 'QUINTA DAS MANGUEIRAS', categoria: 'Imersivo', cor: null },
  ];
  for (const d of decks) {
    const { data: sb } = await api('POST', '/api/storyboards', d);
    if (d.cor) {
      const fd = new FormData();
      fd.append('file', new Blob([capa(d.cor[0], d.cor[1], d.txt)], { type: 'image/svg+xml' }), 'capa.svg');
      await api('POST', `/api/storyboards/${sb.id}/cover`, fd, true);
    }
    // um pouco de conteúdo na primeira cena
    const pages = sb.pages.map(p => p.type === 'scene'
      ? { ...p, locucao: 'Locução de exemplo para a cena.', visual: 'Plano aberto do empreendimento.', sfx: 'Ambiente' } : p);
    await api('PUT', `/api/storyboards/${sb.id}`, { ...d, pages });
  }
  console.log(`\nInstância de teste no ar: ${BASE}  (token: ${T})\n`);
  process.stdin.resume();
})();
