#!/usr/bin/env node
/* importar-imersivos.js — traz os vídeos imersivos do site antigo (Wix).

   COMO RODAR:
     node importar-imersivos.js                 # ensaio, não grava nada
     node importar-imersivos.js --valendo       # grava (pergunta a senha)

   ONDE: por padrão no site publicado. Para a sua máquina:
     FRAMETY_SITE=http://localhost:3000 FRAMETY_SENHA=0000 node importar-imersivos.js --valendo

   ── DE ONDE VÊM OS DADOS ────────────────────────────────────────────────────
   A página do Wix publica cada vídeo como dado estruturado (VideoObject), com
   nome, duração e o embed do YouTube. É melhor do que raspar o texto visível:
   é informação que a própria página declara sobre si.

   Eles aparecem de duas formas — dentro de uma lista, com "position", e soltos,
   cada um no seu bloco. A varredura pega uma janela depois de cada ocorrência,
   o que atende às duas.

   Seguro de repetir: vídeo cujo link já esteja cadastrado é pulado. */

const SITE = process.env.FRAMETY_SITE || "https://www.framety.com.br";
const SENHA = process.env.FRAMETY_SENHA || "";
const VALENDO = process.argv.includes("--valendo");
const PAGINA = "https://rubens693.wixsite.com/framety/videoimersivo";
const CATEGORIA = { id: "imersivo", name: "Imersivo" };

const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const ENTER = [String.fromCharCode(13), String.fromCharCode(10)];
const CTRL_C = String.fromCharCode(3);
const APAGA = [String.fromCharCode(127), String.fromCharCode(8)];

function perguntarSenha() {
  return new Promise((ok) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      console.error("\n  Este terminal não deixa perguntar a senha com segurança.");
      console.error("  Rode assim, no PowerShell:");
      console.error('     $env:FRAMETY_SENHA="suasenha"; node importar-imersivos.js --valendo\n');
      return ok("");
    }
    process.stdout.write("  Senha do console: ");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let buf = "";
    const terminar = (escutar) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", escutar);
      process.stdout.write(String.fromCharCode(10));
      ok(buf);
    };
    process.stdin.on("data", function escutar(pedaco) {
      for (const c of String(pedaco)) {
        if (ENTER.includes(c)) return terminar(escutar);
        if (c === CTRL_C) { process.stdout.write(String.fromCharCode(10)); process.exit(1); }
        if (APAGA.includes(c)) { if (buf) { buf = buf.slice(0, -1); process.stdout.write("\b \b"); } continue; }
        if (c < " ") continue;
        buf += c;
        process.stdout.write("*");
      }
    });
  });
}

const segundos = (iso) => {
  const x = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!x) return 0;
  return (+x[1] || 0) * 3600 + (+x[2] || 0) * 60 + (+x[3] || 0);
};
const mmss = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), g = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(g).padStart(2, "0");
};
const idYoutube = (u) => {
  const m = String(u || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

async function lerPagina() {
  const r = await fetch(PAGINA, { headers: { "User-Agent": NAVEGADOR } });
  if (!r.ok) throw new Error("a página do Wix respondeu HTTP " + r.status);
  const html = await r.text();

  const achados = [];
  const re = /"@type":"VideoObject"/g;
  let m, ordem = 0;
  while ((m = re.exec(html))) {
    const bloco = html.slice(m.index, m.index + 900);
    ordem++;
    const pega = (campo) => {
      const x = bloco.match(new RegExp('"' + campo + '":"((?:[^"\\\\]|\\\\.)*)"'));
      return x
        ? x[1].replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(parseInt(c, 16))).replace(/\\(.)/g, "$1")
        : "";
    };
    const id = (pega("embedUrl").match(/embed\/([A-Za-z0-9_-]{11})/) || [])[1]
            || (pega("thumbnailUrl").match(/\/vi\/([A-Za-z0-9_-]{11})\//) || [])[1];
    if (!id) continue;
    // "injected" é sujeira do editor do Wix, não faz parte do nome
    const nome = (pega("name") || pega("description")).replace(/\s*injected\s*$/i, "").trim();
    achados.push({ ordem, id, nome, duracao: mmss(segundos(pega("duration"))) });
  }

  const vistos = new Set();
  return achados.filter(v => { if (vistos.has(v.id)) return false; vistos.add(v.id); return true; });
}

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

(async () => {
  console.log(`\n  Site: ${SITE}`);
  console.log(`  Modo: ${VALENDO ? "VALENDO (grava)" : "ensaio (não grava nada)"}\n`);

  const daPagina = await lerPagina();
  console.log(`  Página do Wix: ${daPagina.length} vídeos imersivos.`);

  const dados = await fetch(SITE + "/api/data").then(r => r.json());
  const jaTem = new Set((dados.videos || []).map(v => idYoutube(v.videoUrl)).filter(Boolean));
  const temCategoria = (dados.categories || []).some(c => c.id === CATEGORIA.id);

  const novos = daPagina.filter(v => !jaTem.has(v.id));
  console.log(`  Já cadastrados (pulados): ${daPagina.length - novos.length}`);
  console.log(`  A cadastrar: ${novos.length}`);
  console.log(`  Categoria "${CATEGORIA.name}": ${temCategoria ? "já existe" : "será criada"}`);
  const sem = novos.filter(v => v.duracao === "0:00").length;
  if (sem) console.log(`  Sem duração no Wix: ${sem} — o servidor busca no YouTube ao cadastrar.`);

  if (!VALENDO) {
    console.log("\n  Ensaio. Lista:");
    novos.forEach((v, i) => console.log(`   ${String(i + 1).padStart(2)}. ${v.nome.slice(0, 46).padEnd(48)}${v.duracao.padStart(6)}`));
    console.log();
    return;
  }

  const senha = SENHA || await perguntarSenha();
  if (!senha) throw new Error("sem senha, não dá para gravar.");
  const login = await fetch(SITE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: senha }),
  });
  if (!login.ok) throw new Error("login recusado (HTTP " + login.status + ")");
  token = (await login.json()).token;
  console.log("\n  Autenticado.");

  if (!temCategoria) {
    await api("POST", "/api/categories", { id: CATEGORIA.id, name: CATEGORIA.name, desc: "", coverUrl: "" });
    console.log(`  + categoria: ${CATEGORIA.name}`);
  }

  let n = 0;
  for (const v of novos) {
    await api("POST", "/api/videos", {
      title: v.nome,
      empreendimento: v.nome,
      category: CATEGORIA.id,
      catLabel: CATEGORIA.name,
      videoUrl: "https://youtu.be/" + v.id,
      // sem duração no Wix, o servidor busca no YouTube depois de cadastrar
      duration: v.duracao === "0:00" ? "" : v.duracao,
      // o próprio nome diz quando é 360; o resto é sala imersiva
      has360: /\b360\b/.test(v.nome),
      padrao: "",
      formato: "",
      tags: ["Imersivo"],
      aiGenerated: false,
      status: "live",
      featured: false,
      client: "",
      description: "",
      thumbUrl: "",
    });
    n++;
    if (n % 10 === 0) console.log(`  ... ${n}/${novos.length}`);
  }
  console.log(`\n  Pronto: ${n} vídeos imersivos cadastrados.\n`);
})().catch(e => { console.error("\n  ERRO:", e.message, "\n"); process.exit(1); });
