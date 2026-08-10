// Framety — leitura da planilha de jobs (Google Sheets).
//
// A planilha está compartilhada como "qualquer pessoa com o link pode ver", e é
// para ficar assim: a decisão foi poder puxar os dados a qualquer momento, sem
// depender de credencial. Então lemos o CSV de exportação, que o Google serve
// sem autenticação nenhuma para uma planilha aberta.
//
// Isso significa que não há chave privada, conta de serviço nem token neste
// arquivo — e também que quem tiver a URL da planilha lê os mesmos dados.
//
// Configuração: os-sheet.config.json na raiz do projeto (fora do git), ou as
// variáveis de ambiente equivalentes. Ver README-os-sheet.md.

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const CONFIG_FILE = path.join(DIR, 'os-sheet.config.json');
// A planilha muda pouco durante um expediente; 60s evita baixá-la de novo a
// cada #SKY digitado sem deixar o dado velho o suficiente para atrapalhar.
const CACHE_MS = 60 * 1000;

/* ── Configuração ─────────────────────────────────────────────────────────────
   Três origens, nesta ordem de precedência:

   1. o BANCO — o endereço colado no console, em Produções. É o único que o
      operador troca sozinho, sem deploy e sem mexer no Render, e por isso ganha
      dos outros dois;
   2. os-sheet.config.json, para quem roda o projeto na própria máquina;
   3. variáveis de ambiente, para uma instalação que prefira configurar por ali.

   O endereço da planilha NÃO mora no código: o repositório é público, e a
   planilha está aberta para leitura — publicar o link ali entregaria cachê e
   fornecedor de todos os jobs a quem passasse pelo GitHub. */
let doBanco = null;

// Chamado pelo servidor no boot e a cada vez que o console salva.
function usarConfig(cfg) {
  doBanco = cfg && cfg.spreadsheetId ? { ...cfg } : null;
  clearCache();   // a planilha pode ter mudado; não servir a anterior
}

function readConfig() {
  let file = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { file = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch (e) { throw new Error('os-sheet.config.json inválido: ' + e.message); }
  }
  return {
    spreadsheetId: (doBanco && doBanco.spreadsheetId) || file.spreadsheetId || process.env.GSHEET_ID || '',
    // A exportação em CSV identifica a aba pelo gid, não pelo nome — ele está
    // na própria URL da planilha, depois de "#gid=".
    gid: String((doBanco && doBanco.gid) || (file.gid == null ? (process.env.GSHEET_GID || '') : file.gid) || '').trim(),
    columns: (doBanco && doBanco.columns) || file.columns || null,
  };
}

// Aceita tanto o ID puro quanto a URL inteira colada da barra do navegador.
function normalizeSpreadsheetId(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : s;
}

// Se a URL veio inteira e traz "#gid=…", aproveita — evita ter que explicar o
// gid para quem só colou o endereço.
function gidFromUrl(raw) {
  const m = String(raw || '').match(/[#&]gid=(\d+)/);
  return m ? m[1] : '';
}

function isConfigured() {
  try { return !!normalizeSpreadsheetId(readConfig().spreadsheetId); }
  catch (e) { return false; }
}

/* ── Leitura da planilha ──────────────────────────────────────────────────── */
let rowsCache = { at: 0, key: '', values: null };

function csvUrl(id, gid) {
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv`;
  return gid ? `${base}&gid=${encodeURIComponent(gid)}` : base;
}

// CSV do Google: campos entre aspas podem conter vírgula, aspas escapadas ("")
// e quebras de linha — a coluna PRODUTO tem várias ("CAMPO GRANDE\nMEDICAL
// CENTER"). Um split por vírgula quebraria a planilha inteira a partir daí.
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); cur = ''; rows.push(row); row = []; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function fetchValues(cfg) {
  const id = normalizeSpreadsheetId(cfg.spreadsheetId);
  const gid = cfg.gid || gidFromUrl(cfg.spreadsheetId);
  const key = id + '|' + gid;
  if (rowsCache.values && rowsCache.key === key && Date.now() - rowsCache.at < CACHE_MS) return rowsCache.values;

  let r;
  try { r = await fetch(csvUrl(id, gid), { redirect: 'follow' }); }
  catch (e) { throw new Error('Não consegui alcançar a planilha: ' + e.message); }

  if (r.status === 404) throw new Error('Planilha não encontrada. Confira o endereço em os-sheet.config.json.');
  if (!r.ok) throw new Error('O Google respondeu ' + r.status + ' ao baixar a planilha.');

  const body = await r.text();
  /* Planilha fechada não dá erro: o Google devolve 200 com a página de login em
     HTML. Sem esta checagem, o HTML seria "parseado" como CSV e a busca diria
     apenas "nenhum job com esse código" — mandando procurar o erro no lugar
     errado. */
  const tipo = r.headers.get('content-type') || '';
  if (!/text\/csv/i.test(tipo) || /^\s*</.test(body)) {
    throw new Error('A planilha não está mais aberta para leitura. Em Compartilhar, deixe como "qualquer pessoa com o link — leitor".');
  }

  const values = parseCsv(body);
  rowsCache = { at: Date.now(), key, values };
  return values;
}

function clearCache() { rowsCache = { at: 0, key: '', values: null }; }

/* ── Cabeçalho → campos da OS ─────────────────────────────────────────────── */
const norm = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim().toUpperCase();

// Cada campo da OS e os cabeçalhos que costumam representá-lo na planilha.
const FIELD_ALIASES = {
  id:             ['ID', 'SKY', 'JOB', 'CODIGO', 'COD', 'OS', 'N OS', 'NUMERO'],
  data:           ['DATA', 'DATA DE ENTRADA', 'DATA ENTRADA', 'EMISSAO', 'DT'],
  cliente:        ['CLIENTE'],
  produto:        ['PRODUTO'],
  projeto:        ['PROJETO'],
  empreendimento: ['EMPREENDIMENTO', 'EMPREEND'],
  categoria:      ['CATEGORIA'],
  minutagem:      ['MINUTAGEM', 'MIN', 'DURACAO', 'TEMPO'],
  veiculacao:     ['VEICULACAO', 'VEIC'],
  locutor:        ['PRODUTORA LOCUTOR', 'LOCUTOR', 'PRODUTORA', 'FORNECEDOR'],
  status:         ['STATUS'],
  valor:          ['VALOR', 'VALOR TOTAL', 'PRECO', 'CACHE'],
  liberado:       ['LIBERADO', 'LIB'],
};

// A planilha tem um título ("Locuções 2026") antes do cabeçalho — pega a linha
// das primeiras 15 que casa com mais nomes de coluna conhecidos.
function findHeaderRow(values) {
  let best = { index: -1, score: 0 };
  const limit = Math.min(values.length, 15);
  for (let i = 0; i < limit; i++) {
    const cells = (values[i] || []).map(norm).filter(Boolean);
    if (!cells.length) continue;
    let score = 0;
    for (const aliases of Object.values(FIELD_ALIASES)) {
      if (cells.some(c => aliases.includes(c))) score++;
    }
    if (score > best.score) best = { index: i, score };
  }
  // Menos de 3 colunas reconhecidas provavelmente não é o cabeçalho.
  return best.score >= 3 ? best.index : -1;
}

function buildColumnMap(headerCells, overrides) {
  const map = {};
  const normalized = headerCells.map(norm);
  if (overrides) {
    for (const [field, header] of Object.entries(overrides)) {
      const i = normalized.indexOf(norm(header));
      if (i >= 0) map[field] = i;
    }
  }
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (map[field] != null) continue;
    // Casamento exato primeiro; só depois aceita "começa com" — é assim que
    // "LIB. P/ PAGAMENTO" casa com LIB e "VALOR (R$)" casaria com VALOR.
    let i = normalized.findIndex(c => aliases.includes(c));
    if (i < 0) i = normalized.findIndex(c => c && aliases.some(a => c.startsWith(a + ' ')));
    if (i >= 0) map[field] = i;
  }
  return map;
}

// "#SKY171-B", "sky 171 b", "SKY171B" → "SKY171B". Assim o operador pode digitar
// do jeito que vier à cabeça e ainda encontrar a linha.
const skyKey = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();

// Na planilha, célula sem conteúdo é preenchida com um traço comprido
// ("-------------") em vez de ficar vazia — é marcação visual, não dado. Sem
// isto o "-------------" da coluna VALOR viraria o valor total da OS.
// Além disso, células longas são quebradas em duas linhas na planilha para
// caber na coluna ("QUINTA DAS\n MANGUEIRAS"). A quebra é diagramação da
// planilha, não parte do nome: sem colapsar, ela reapareceria no meio do campo
// "Projeto" da OS. Todos estes campos são rótulos de uma linha só.
const limpa = (s) => (/^[-–—\s]*$/.test(s) ? '' : s.replace(/\s+/g, ' ').trim());

/* ── API do módulo ────────────────────────────────────────────────────────── */
// Devolve a linha do job no mesmo formato que a OS já consome, ou null.
async function lookup(sky) {
  const wanted = skyKey(sky);
  if (!wanted) throw new Error('Informe o #SKY do job.');

  const cfg = readConfig();
  if (!normalizeSpreadsheetId(cfg.spreadsheetId)) {
    throw new Error('NOT_CONFIGURED: nenhuma planilha conectada.');
  }

  const values = await fetchValues(cfg);
  const headerIndex = findHeaderRow(values);
  if (headerIndex < 0) throw new Error('Não encontrei a linha de cabeçalho na planilha (procuro por ID, CLIENTE, PRODUTO, VALOR…).');

  const cols = buildColumnMap(values[headerIndex] || [], cfg.columns);
  if (cols.id == null) throw new Error('Não encontrei a coluna do #SKY na planilha. Renomeie o cabeçalho para "ID" ou mapeie em "columns".');

  const at = (row, field) => (cols[field] == null ? '' : limpa(String(row[cols[field]] == null ? '' : row[cols[field]]).trim()));

  /* Um mesmo #SKY pode ocupar mais de uma linha: são entregas diferentes do
     mesmo job (LANÇAMENTO e TRAJETO, IMERSIVO ESPANHOL e INGLÊS). Nesses pares
     a planilha repete cliente, produto e locutor, e escreve o valor só na
     primeira — as outras levam traço. A OS é uma só, do job inteiro, então
     entre as linhas que casam ficamos com a que tem valor. Hoje ela é sempre a
     primeira; preferir "a que tem valor" a "a primeira" custa nada e não
     depende dessa ordem continuar valendo. */
  const casadas = [];
  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i] || [];
    if (skyKey(at(row, 'id')) === wanted) casadas.push({ row, i });
  }
  if (!casadas.length) return null;
  const { row, i } = casadas.find(c => at(c.row, 'valor')) || casadas[0];

  return {
    id:             at(row, 'id'),
    data:           at(row, 'data'),
    cliente:        at(row, 'cliente'),
    produto:        at(row, 'produto'),
    projeto:        at(row, 'projeto'),
    empreendimento: at(row, 'empreendimento'),
    categoria:      at(row, 'categoria'),
    minutagem:      at(row, 'minutagem'),
    veiculacao:     at(row, 'veiculacao'),
    locutor:        at(row, 'locutor'),
    status:         at(row, 'status'),
    valor:          at(row, 'valor'),
    liberado:       at(row, 'liberado'),
    _sourceRow:     i + 1,
    _matchedRows:   casadas.length,   // >1 = o #SKY ocupa mais de uma linha
  };
}

// Diagnóstico para quando a busca falha: o que o servidor enxerga da planilha.
async function status() {
  const cfg = readConfig();
  const id = normalizeSpreadsheetId(cfg.spreadsheetId);

  const out = {
    configured: !!id,
    spreadsheetId: id ? id.slice(0, 6) + '…' : '',
    gid: cfg.gid || gidFromUrl(cfg.spreadsheetId) || '(primeira aba)',
    acesso: 'link público (sem credencial)',
    error: '',
  };
  if (!id) {
    out.error = 'Nenhuma planilha conectada. Cole o endereço dela no campo abaixo.';
    return out;
  }
  try {
    const values = await fetchValues(cfg);
    const headerIndex = findHeaderRow(values);
    out.rows = Math.max(0, values.length - (headerIndex + 1));
    out.headerRow = headerIndex + 1;
    out.mappedColumns = headerIndex < 0 ? {} : buildColumnMap(values[headerIndex] || [], cfg.columns);
    out.headers = headerIndex < 0 ? [] : (values[headerIndex] || []);
  } catch (e) {
    out.configured = false;
    out.error = e.message;
  }
  return out;
}

module.exports = { lookup, status, isConfigured, clearCache, normalizeSpreadsheetId, usarConfig };
