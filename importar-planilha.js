#!/usr/bin/env node
/* importar-planilha.js — cadastra no site os vídeos da planilha PORTFÓLIO FRAMETY.

   COMO RODAR (a senha vem do ambiente; não fica escrita em lugar nenhum):

     FRAMETY_SENHA=suasenha node importar-planilha.js                 # ensaio
     FRAMETY_SENHA=suasenha node importar-planilha.js --valendo       # grava

   Sem --valendo ele só mostra o que faria.

   ONDE: por padrão, no site publicado. Para ensaiar na sua máquina:
     FRAMETY_SITE=http://localhost:3000 FRAMETY_SENHA=0000 node importar-planilha.js --valendo

   SEGURO DE REPETIR: vídeo cujo link do YouTube já esteja cadastrado é pulado.

   ── COMO A PLANILHA É LIDA ──────────────────────────────────────────────────
   Ela tem quatro blocos de 5 colunas lado a lado (A-E, G-K, M-Q, S-W), e dentro
   de cada bloco as tabelas ficam EMPILHADAS, uma embaixo da outra, cada uma com
   seu próprio cabeçalho.

   O nome de cada tabela é o que define a CATEGORIA do vídeo — e ele é metadado
   de "tabela" do Google Sheets, que NÃO sai na exportação em CSV. Por isso os
   nomes estão escritos aqui, na ordem em que as tabelas aparecem em cada bloco;
   foram lidos na planilha aberta. Se alguém acrescentar uma tabela nova, o
   script avisa que a contagem não bate em vez de cadastrar na categoria errada.

   A coluna chamada CATEGORIA na planilha (ALTO/MÉDIO PADRÃO, POPULAR) é o
   PADRÃO DO EMPREENDIMENTO — campo do vídeo, que no site aparece só no modo de
   apresentação. E PORTFÓLIO (CASE DE SUCESSO / COMERCIAL) vira etiqueta, para
   não se perder. */

const SITE = process.env.FRAMETY_SITE || "https://www.framety.com.br";
const SENHA = process.env.FRAMETY_SENHA || "";
const VALENDO = process.argv.includes("--valendo");
const PLANILHA = "1t_k9l-fwhbGfD0URH3gu-rUtRwoio7bGtNl8QhbB8AI";
const ABA = "605157561";

/* Tabelas por bloco, na ordem em que estão empilhadas. */
const TABELAS = {
  0:  ["LANÇAMENTOS"],
  6:  ["VEM AÍ TEASER CONCEITO", "FAKE OUT OF HOME", "DEPOIMENTO"],
  12: ["EMPREENDIMENTO PRONTO", "ACOMPANHAMENTO DE OBRA", "LOCALIZAÇÃO"],
  18: ["ACOMPANHAMENTO DE OBRA VIRAL", "TRAJETO", "TIMELAPSE"],
};

/* Nome da tabela → categoria do site. Nove já existem lá; TIMELAPSE é nova. */
const CATEGORIAS = {
  "LANÇAMENTOS":                  { id: "lancamento",                   name: "Lançamento" },
  "VEM AÍ TEASER CONCEITO":       { id: "vem-ai-teaser-conceito",       name: "Vem aí/teaser/conceito" },
  "FAKE OUT OF HOME":             { id: "fooh",                         name: "Fooh" },
  "DEPOIMENTO":                   { id: "depoimento",                   name: "Depoimento" },
  "EMPREENDIMENTO PRONTO":        { id: "empreendimento-pronto",        name: "Empreendimento pronto." },
  "ACOMPANHAMENTO DE OBRA":       { id: "acompanhamento-de-obra",       name: "Acompanhamento de obra" },
  "LOCALIZAÇÃO":                  { id: "localizacao",                  name: "Localização" },
  "ACOMPANHAMENTO DE OBRA VIRAL": { id: "acompanhamento-de-obra-viral", name: "Acompanhamento de obra viral" },
  "TRAJETO":                      { id: "trajeto",                      name: "Trajeto" },
  "TIMELAPSE":                    { id: "timelapse",                    name: "Timelapse" },
};

const PADROES = { "ALTO PADRÃO": "Alto", "MÉDIO PADRÃO": "Médio", "POPULAR": "Popular" };

/* A planilha escreve tudo em caixa alta; na etiqueta do card isso vira grito. */
const capitalizar = (t) => t.charAt(0) + t.slice(1).toLowerCase();
const IA = { "ALL IA": true, "IA PARCIAL": true, "SEM IA": false };

/* ── Leitura ─────────────────────────────────────────────────────────────── */
function lerCsv(texto) {
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const limpar = (v) => String(v || "").replace(/\s+/g, " ").trim();
const idYoutube = (u) => {
  const m = String(u || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

function extrair(linhas) {
  const videos = [], fora = [];
  for (const [colStr, nomes] of Object.entries(TABELAS)) {
    const col = +colStr;
    let iTabela = -1;
    linhas.forEach((l, i) => {
      const primeira = limpar(l[col]);
      if (primeira.toUpperCase() === "EMPREENDIMENTO") { iTabela++; return; }
      if (!primeira) return;
      if (iTabela < 0) return;                               // antes do primeiro cabeçalho
      const tabela = nomes[iTabela];
      if (!tabela) { fora.push({ linha: i + 1, nome: primeira, motivo: `tabela nº ${iTabela + 1} do bloco ${col} não tem nome cadastrado no script` }); return; }
      const link = limpar(l[col + 1]);
      const yt = idYoutube(link);
      if (!yt) { fora.push({ linha: i + 1, nome: primeira, motivo: "sem link válido do YouTube" }); return; }
      videos.push({
        linha: i + 1,
        tabela,
        nome: primeira,
        link,
        yt,
        padrao: PADROES[limpar(l[col + 2])] || "",
        portfolio: limpar(l[col + 3]),
        ia: IA[limpar(l[col + 4])],
      });
    });
    const cabecalhos = linhas.filter(l => limpar(l[col]).toUpperCase() === "EMPREENDIMENTO").length;
    if (cabecalhos !== nomes.length) {
      throw new Error(`bloco da coluna ${col}: a planilha tem ${cabecalhos} tabelas, o script conhece ${nomes.length} (${nomes.join(", ")}). Confira os nomes antes de cadastrar.`);
    }
  }
  return { videos, fora };
}

/* ── API ─────────────────────────────────────────────────────────────────── */
let token = "";
async function api(metodo, rota, corpo) {
  const r = await fetch(SITE + rota, {
    method: metodo,
    headers: { "Content-Type": "application/json", "x-auth-token": token },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const txt = await r.text();
  let dado = null;
  try { dado = JSON.parse(txt); } catch (e) {}
  if (!r.ok) throw new Error(`${metodo} ${rota} → ${r.status} ${dado && dado.error ? dado.error : txt.slice(0, 120)}`);
  return dado;
}

/* ── Execução ────────────────────────────────────────────────────────────── */
(async () => {
  console.log(`\n  Site: ${SITE}`);
  console.log(`  Modo: ${VALENDO ? "VALENDO (grava)" : "ensaio (não grava nada)"}\n`);

  const csv = await fetch(`https://docs.google.com/spreadsheets/d/${PLANILHA}/export?format=csv&gid=${ABA}`)
    .then(r => { if (!r.ok) throw new Error("não baixei a planilha: HTTP " + r.status); return r.text(); });
  const { videos, fora } = extrair(lerCsv(csv));

  console.log(`  Planilha: ${videos.length} vídeos, ${fora.length} de fora.`);
  fora.forEach(f => console.log(`     ⨯ linha ${f.linha}: ${f.nome} — ${f.motivo}`));

  const dados = await fetch(SITE + "/api/data").then(r => r.json());
  const jaTem = new Set((dados.videos || []).map(v => idYoutube(v.videoUrl)).filter(Boolean));
  const catsExistentes = new Set((dados.categories || []).map(c => c.id));

  const vistos = new Set();
  const paraCriar = [];
  let repetidosNoSite = 0, repetidosNaPlanilha = 0;
  for (const v of videos) {
    if (jaTem.has(v.yt)) { repetidosNoSite++; continue; }
    if (vistos.has(v.yt)) { repetidosNaPlanilha++; continue; }
    vistos.add(v.yt);
    paraCriar.push(v);
  }

  const porTabela = {};
  paraCriar.forEach(v => { porTabela[v.tabela] = (porTabela[v.tabela] || 0) + 1; });
  console.log("\n  Por tabela (= categoria):");
  Object.entries(porTabela).forEach(([t, n]) => {
    const c = CATEGORIAS[t];
    console.log(`    ${String(n).padStart(3)}  ${t}  →  ${c.name}${catsExistentes.has(c.id) ? "" : "   (categoria NOVA)"}`);
  });

  const catsFaltando = [...new Set(paraCriar.map(v => CATEGORIAS[v.tabela].id))].filter(id => !catsExistentes.has(id));
  const porPadrao = {};
  paraCriar.forEach(v => { const p = v.padrao || "(sem padrão)"; porPadrao[p] = (porPadrao[p] || 0) + 1; });

  console.log(`\n  Já no site (pulados): ${repetidosNoSite} | repetidos na planilha: ${repetidosNaPlanilha}`);
  console.log(`  A cadastrar: ${paraCriar.length}`);
  console.log(`  Categorias a criar: ${catsFaltando.length ? catsFaltando.join(", ") : "(nenhuma)"}`);
  console.log(`  Por padrão: ${JSON.stringify(porPadrao)}`);

  if (!VALENDO) {
    console.log("\n  Ensaio — nada gravado. Exemplo do que seria criado:");
    paraCriar.slice(0, 2).forEach(v => console.log("   ", JSON.stringify({
      title: v.nome, category: CATEGORIAS[v.tabela].id, padrao: v.padrao,
      tags: v.portfolio ? [capitalizar(v.portfolio)] : [], aiGenerated: v.ia === true, videoUrl: v.link,
    })));
    console.log();
    return;
  }

  if (!SENHA) throw new Error("falta a senha: rode com FRAMETY_SENHA=suasenha");
  const login = await fetch(SITE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: SENHA }),
  });
  if (!login.ok) throw new Error("login recusado (HTTP " + login.status + ")");
  token = (await login.json()).token;
  console.log("\n  Autenticado.");

  for (const id of catsFaltando) {
    const nome = Object.values(CATEGORIAS).find(c => c.id === id).name;
    await api("POST", "/api/categories", { id, name: nome, desc: "", coverUrl: "" });
    console.log(`  + categoria: ${nome}`);
  }

  let n = 0;
  for (const v of paraCriar) {
    const cat = CATEGORIAS[v.tabela];
    await api("POST", "/api/videos", {
      title: v.nome,
      empreendimento: v.nome,
      category: cat.id,
      catLabel: cat.name,
      videoUrl: v.link,
      padrao: v.padrao,
      formato: "",
      tags: v.portfolio ? [v.portfolio] : [],
      aiGenerated: v.ia === true,
      status: "live",
      featured: false,
      client: "",
      description: "",
      thumbUrl: "",              // sem thumb, o site usa a do YouTube
    });
    n++;
    if (n % 20 === 0) console.log(`  ... ${n}/${paraCriar.length}`);
  }
  console.log(`\n  Pronto: ${n} vídeos cadastrados.\n`);
})().catch(e => { console.error("\n  ERRO:", e.message, "\n"); process.exit(1); });
