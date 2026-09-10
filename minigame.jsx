/* minigame.jsx — o joguinho escondido em /play.

   Pong na vertical: a barrinha de baixo é o carro da Skyline e quem manda nela
   é o visitante; a de cima é o computador. Cada rebatida do jogador vale um
   ponto, e a cada ponto o adversário fica mais rápido — anda mais depressa
   atrás da bola e devolve mais forte. Só existe uma forma de perder: deixar a
   bola passar por baixo. Se o computador errar, a bola bate no teto e volta.

   O desenho todo é canvas, num tamanho lógico fixo (720×960) esticado por CSS.
   Assim a física não muda de comportamento conforme a tela: a bola atravessa
   sempre os mesmos 960 pixels, seja num celular ou num monitor grande. */

const JOGO_L = 720;      // largura lógica
const JOGO_A = 960;      // altura lógica

const CARRO_L = 168;     // largura da barrinha do jogador
const CARRO_A = 40;      // altura da faixa que rebate (o corpo do carro)
const CPU_L = 150;
const CPU_A = 16;
const RAIO = 17;         // raio da bola (o "play")

const VEL_INICIAL = 430; // px por segundo
const VEL_TETO = 1150;
const CPU_VEL_INICIAL = 300;
const CPU_VEL_TETO = 900;
const ANGULO_MAX = 1.05; // radianos de desvio máximo ao rebater na ponta
const BONUS_PASSOU = 20; // pontos por fazer o play passar pelo computador
const AVISO_MS = 950;    // quanto tempo o "+20" fica na tela

/* ── O carro sem o fundo branco ───────────────────────────────────────────────
   O arquivo enviado no console vem com fundo branco e uma margem larga em volta.
   Preparar isso é o que decide se o carro aparece nítido ou como um borrão com
   franja, e são quatro passos, cada um resolvendo um problema:

   1. **Balde a partir das bordas**, não corte por limiar. O carro é branco no
      capô e no teto: apagar "todo pixel claro" comeria o próprio carro. O que
      é fundo é o branco LIGADO à borda da imagem, então a varredura começa nas
      quatro margens e só anda por vizinhos claros — o branco de dentro do carro
      nunca é alcançado, porque está cercado de vidro, sombra e vinco.

   2. **Esfumar a franja.** O balde para onde a imagem começa a escurecer, e ali
      mora um anel de pixels meio brancos, resto do antisserrilhado do arquivo
      original. Deixá-lo opaco é exatamente o chuvisco branco em volta do carro.
      Cada pixel claro que faz fronteira com o vazio recebe uma opacidade
      proporcional a quanto ele ainda é branco.

   3. **Cortar na medida do carro.** A margem vazia do PNG ocupava espaço dentro
      da barrinha: o carro saía desenhado menor do que a área que rebate. Depois
      do balde dá para medir onde o carro realmente começa e acaba.

   4. **Reduzir de uma vez, pela metade a cada passo.** Ir de 640px para 168px
      num único desenho — e a cada quadro — é o que deixava a imagem chiada:
      o navegador amostra pouco e joga fora o resto. Reduzir pela metade
      sucessivamente, uma única vez no carregamento, entrega uma imagem limpa
      que o jogo só copia dali em diante.

   Se a leitura dos pixels falhar (imagem de outro domínio sem CORS, que suja o
   canvas), a imagem é usada como veio — com fundo. Melhor um carro num quadrado
   branco do que um jogo sem carro. */
const CARRO_LARGURA_FINAL = 420;   // 2,5× o tamanho na tela, para telas densas

function prepararCarro(img) {
  const l = img.naturalWidth, a = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = l; c.height = a;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);

  let dados;
  try { dados = ctx.getImageData(0, 0, l, a); }
  catch (e) { return c; }          // canvas sujo: devolve como veio
  const p = dados.data;

  /* 1) balde a partir das bordas, duas vezes */
  const inundar = (aceita) => {
    const visto = new Uint8Array(l * a);
    const pilha = [];
    for (let x = 0; x < l; x++) { pilha.push(x, (a - 1) * l + x); }
    for (let y = 0; y < a; y++) { pilha.push(y * l, y * l + l - 1); }
    while (pilha.length) {
      const pos = pilha.pop();
      if (visto[pos]) continue;
      const i = pos * 4;
      if (!aceita(i, (pos - (pos % l)) / l)) continue;
      visto[pos] = 1;
      p[i + 3] = 0;
      const x = pos % l, y = (pos - x) / l;
      if (x > 0)     pilha.push(pos - 1);
      if (x < l - 1) pilha.push(pos + 1);
      if (y > 0)     pilha.push(pos - l);
      if (y < a - 1) pilha.push(pos + l);
    }
  };

  // primeira: o branco do fundo, com limite alto para não entrar pelo teto do
  // carro, que também é branco
  inundar((i) => p[i] > 228 && p[i + 1] > 228 && p[i + 2] > 228);


  // segunda: a sombra sob as rodas. Só o cinza sem cor, e só na BASE do carro
  // — a faixa de tom sozinha não basta, porque reflexo de capô e vidro caem
  // nela também: numa primeira tentativa a passada entrou pelo para-brisa e
  // abriu buracos na lataria. Onde a sombra mora é embaixo, então a altura é
  // que segura a passada. Ela anda livremente pelo que a primeira já abriu.
  let baseSombra = a;
  {
    let topo = a, base = -1;
    for (let y = 0; y < a; y++) {
      for (let x = 0; x < l; x++) {
        if (p[(y * l + x) * 4 + 3] > 24) { if (y < topo) topo = y; if (y > base) base = y; break; }
      }
    }
    if (base > topo) baseSombra = topo + (base - topo) * 0.82;
  }
  inundar((i, y) => {
    if (p[i + 3] === 0) return true;                       // caminho já aberto
    if (y < baseSombra) return false;
    const maior = Math.max(p[i], p[i + 1], p[i + 2]);
    const menor = Math.min(p[i], p[i + 1], p[i + 2]);
    return menor > 188 && maior < 242 && maior - menor < 16;
  });

  /* 2) esfumar a franja que sobrou na fronteira */
  for (let y = 0; y < a; y++) {
    for (let x = 0; x < l; x++) {
      const pos = y * l + x, i = pos * 4;
      if (p[i + 3] === 0) continue;
      const vizinhoVazio =
        (x > 0     && p[(pos - 1) * 4 + 3] === 0) ||
        (x < l - 1 && p[(pos + 1) * 4 + 3] === 0) ||
        (y > 0     && p[(pos - l) * 4 + 3] === 0) ||
        (y < a - 1 && p[(pos + l) * 4 + 3] === 0);
      if (!vizinhoVazio) continue;
      const menor = Math.min(p[i], p[i + 1], p[i + 2]);
      if (menor <= 200) continue;                    // já é carro de verdade
      p[i + 3] = Math.round(255 * (255 - menor) / 55);
    }
  }
  ctx.putImageData(dados, 0, 0);

  /* 3) medir onde o carro está */
  let x0 = l, y0 = a, x1 = -1, y1 = -1;
  for (let y = 0; y < a; y++) {
    for (let x = 0; x < l; x++) {
      if (p[(y * l + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return c;                              // nada sobrou: devolve como veio
  const cl = x1 - x0 + 1, ca = y1 - y0 + 1;

  const cortado = document.createElement("canvas");
  cortado.width = cl; cortado.height = ca;
  cortado.getContext("2d").drawImage(c, x0, y0, cl, ca, 0, 0, cl, ca);

  /* 4) reduzir pela metade até o tamanho final */
  let atual = cortado;
  while (atual.width > CARRO_LARGURA_FINAL * 2) {
    const meio = document.createElement("canvas");
    meio.width = Math.round(atual.width / 2);
    meio.height = Math.round(atual.height / 2);
    const mctx = meio.getContext("2d");
    mctx.imageSmoothingEnabled = true;
    mctx.imageSmoothingQuality = "high";
    mctx.drawImage(atual, 0, 0, meio.width, meio.height);
    atual = meio;
  }
  if (atual.width > CARRO_LARGURA_FINAL) {
    const fim = document.createElement("canvas");
    fim.width = CARRO_LARGURA_FINAL;
    fim.height = Math.round(atual.height * (CARRO_LARGURA_FINAL / atual.width));
    const fctx = fim.getContext("2d");
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = "high";
    fctx.drawImage(atual, 0, 0, fim.width, fim.height);
    atual = fim;
  }
  return atual;
}

const useCarroRecortado = (url) => {
  const [pronto, setPronto] = React.useState(null);

  React.useEffect(() => {
    if (!url) { setPronto(null); return; }
    let vivo = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { if (vivo) setPronto(prepararCarro(img)); };
    img.onerror = () => { if (vivo) setPronto(null); };
    img.src = url;
    return () => { vivo = false; };
  }, [url]);

  return pronto;
};

/* ── Desenho ─────────────────────────────────────────────────────────────── */

/* A bola é um "play": triângulo de cantos arredondados, apontando para onde ela
   está indo — vira um ponteiro do próprio movimento. */
function desenharPlay(ctx, x, y, r, angulo, cor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angulo);
  ctx.beginPath();
  const p = [[r, 0], [-r * 0.62, r * 0.86], [-r * 0.62, -r * 0.86]];
  const arred = r * 0.34;
  for (let i = 0; i < 3; i++) {
    const atual = p[i], prox = p[(i + 1) % 3], ant = p[(i + 2) % 3];
    const dirA = Math.hypot(atual[0] - ant[0], atual[1] - ant[1]);
    const dirP = Math.hypot(prox[0] - atual[0], prox[1] - atual[1]);
    const de = [atual[0] + (ant[0] - atual[0]) * (arred / dirA), atual[1] + (ant[1] - atual[1]) * (arred / dirA)];
    const para = [atual[0] + (prox[0] - atual[0]) * (arred / dirP), atual[1] + (prox[1] - atual[1]) * (arred / dirP)];
    if (i === 0) ctx.moveTo(de[0], de[1]); else ctx.lineTo(de[0], de[1]);
    ctx.quadraticCurveTo(atual[0], atual[1], para[0], para[1]);
  }
  ctx.closePath();
  ctx.shadowColor = cor;
  ctx.shadowBlur = 26;
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.restore();
}

function barraArredondada(ctx, x, y, l, a, r, cor, brilho) {
  ctx.save();
  ctx.beginPath();
  // roundRect é recente; num navegador sem ele a barra sai quadrada, o que é
  // melhor do que o laço inteiro morrer numa exceção por quadro.
  if (ctx.roundRect) ctx.roundRect(x, y, l, a, r); else ctx.rect(x, y, l, a);
  if (brilho) { ctx.shadowColor = brilho; ctx.shadowBlur = 20; }
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.restore();
}

/* ── O jogo ──────────────────────────────────────────────────────────────── */
const MiniGame = ({ onSair }) => {
  const canvasRef = React.useRef(null);
  const estadoRef = React.useRef(null);
  const [fase, setFase] = React.useState("pronto");   // pronto | jogando | fim
  const [pontos, setPontos] = React.useState(0);
  const [placar, setPlacar] = React.useState([]);
  const [carroUrl, setCarroUrl] = React.useState("");
  const [nome, setNome] = React.useState(() => {
    try { return localStorage.getItem("framety.play.nome") || ""; } catch { return ""; }
  });
  const [registrado, setRegistrado] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const carro = useCarroRecortado(carroUrl);

  const carregarPlacar = React.useCallback(() => {
    window.API.getPlacar()
      .then((d) => { setPlacar(d.placar || []); setCarroUrl(d.carroUrl || ""); })
      .catch(() => {});
  }, []);

  React.useEffect(() => { carregarPlacar(); }, [carregarPlacar]);

  /* Estado da partida fora do React: sessenta quadros por segundo mexendo em
     useState re-renderizaria a árvore inteira sessenta vezes. Só o que a tela
     mostra em texto (pontos, fase) é estado de verdade. */
  const novaPartida = React.useCallback(() => {
    estadoRef.current = {
      bola: { x: JOGO_L / 2, y: JOGO_A * 0.55, vx: (Math.random() < 0.5 ? -1 : 1) * VEL_INICIAL * 0.55, vy: VEL_INICIAL * 0.84 },
      jogadorX: JOGO_L / 2,
      alvoX: JOGO_L / 2,
      cpuX: JOGO_L / 2,
      pontos: 0,
      /* A dificuldade acompanha as REBATIDAS, não os pontos. Com o bônus de 20
         valendo na conta da velocidade, um único ponto em cima do computador
         jogaria o jogo direto para o teto de velocidade — o prêmio viraria
         castigo. Assim o aperto continua sendo gradual, e o bônus é só placar. */
      rebatidas: 0,
      avisos: [],      // "+20" subindo na tela
      ultimo: 0,
    };
    setPontos(0);
    setRegistrado(false);
  }, []);

  const comecar = React.useCallback(() => { novaPartida(); setFase("jogando"); }, [novaPartida]);

  /* ── laço ── */
  React.useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const cor = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2E86C1";
    let raf = null;

    const quadro = (agora) => {
      raf = requestAnimationFrame(quadro);
      const e = estadoRef.current;
      if (!e) return;

      // Passo de tempo em segundos, travado em 1/30: se a aba ficou em segundo
      // plano, o primeiro quadro de volta traria um salto enorme e a bola
      // atravessaria a barrinha sem tocar nela.
      const dt = e.ultimo ? Math.min((agora - e.ultimo) / 1000, 1 / 30) : 1 / 60;
      e.ultimo = agora;

      if (fase === "jogando") {
        const velCpu = Math.min(CPU_VEL_INICIAL + e.rebatidas * 17, CPU_VEL_TETO);

        // o jogador persegue o ponteiro em vez de colar nele: dá peso ao carro
        e.jogadorX += (e.alvoX - e.jogadorX) * Math.min(1, dt * 16);
        e.jogadorX = Math.max(CARRO_L / 2, Math.min(JOGO_L - CARRO_L / 2, e.jogadorX));

        // o computador persegue a bola, limitado pela própria velocidade
        const dCpu = e.bola.x - e.cpuX;
        e.cpuX += Math.max(-velCpu * dt, Math.min(velCpu * dt, dCpu));
        e.cpuX = Math.max(CPU_L / 2, Math.min(JOGO_L - CPU_L / 2, e.cpuX));

        e.bola.x += e.bola.vx * dt;
        e.bola.y += e.bola.vy * dt;

        // paredes
        if (e.bola.x - RAIO < 0) { e.bola.x = RAIO; e.bola.vx = Math.abs(e.bola.vx); }
        if (e.bola.x + RAIO > JOGO_L) { e.bola.x = JOGO_L - RAIO; e.bola.vx = -Math.abs(e.bola.vx); }
        // O teto só é alcançado quando o computador erra a rebatida: isso é o
        // ponto em cima dele, e vale vinte de uma vez.
        if (e.bola.y - RAIO < 0) {
          e.bola.y = RAIO;
          e.bola.vy = Math.abs(e.bola.vy);
          e.pontos += BONUS_PASSOU;
          setPontos(e.pontos);
          e.avisos.push({ x: e.bola.x, y: 130, nascido: agora, texto: "+" + BONUS_PASSOU });
        }

        const rebater = (centroX, meiaL, paraCima) => {
          const desvio = Math.max(-1, Math.min(1, (e.bola.x - centroX) / meiaL));
          const ang = desvio * ANGULO_MAX;
          const vel = Math.hypot(e.bola.vx, e.bola.vy);
          e.bola.vx = Math.sin(ang) * vel;
          e.bola.vy = (paraCima ? -1 : 1) * Math.cos(ang) * vel;
        };

        // barrinha do jogador
        const topoCarro = JOGO_A - 96;
        if (e.bola.vy > 0 && e.bola.y + RAIO >= topoCarro && e.bola.y - RAIO <= topoCarro + CARRO_A) {
          if (Math.abs(e.bola.x - e.jogadorX) <= CARRO_L / 2 + RAIO * 0.6) {
            e.bola.y = topoCarro - RAIO;
            rebater(e.jogadorX, CARRO_L / 2, true);
            e.rebatidas += 1;
            e.pontos += 1;
            setPontos(e.pontos);
          }
        }

        // barrinha do computador — a devolução dele é o que acelera o jogo
        const baseCpu = 72 + CPU_A;
        if (e.bola.vy < 0 && e.bola.y - RAIO <= baseCpu && e.bola.y + RAIO >= baseCpu - CPU_A) {
          if (Math.abs(e.bola.x - e.cpuX) <= CPU_L / 2 + RAIO * 0.6) {
            e.bola.y = baseCpu + RAIO;
            rebater(e.cpuX, CPU_L / 2, false);
            const nova = Math.min(VEL_INICIAL + e.rebatidas * 26, VEL_TETO);
            const atual = Math.hypot(e.bola.vx, e.bola.vy) || 1;
            e.bola.vx *= nova / atual;
            e.bola.vy *= nova / atual;
          }
        }

        // fim: passou por baixo
        if (e.bola.y - RAIO > JOGO_A) {
          setFase("fim");
        }
      }

      /* ── pintura ── */
      ctx.clearRect(0, 0, JOGO_L, JOGO_A);

      // linha do meio
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.moveTo(0, JOGO_A / 2);
      ctx.lineTo(JOGO_L, JOGO_A / 2);
      ctx.stroke();
      ctx.restore();

      // placar de fundo
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = "#fff";
      ctx.font = "700 190px 'Albert Sans', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(e.pontos), JOGO_L / 2, JOGO_A / 2 - 8);
      ctx.restore();

      // adversário
      barraArredondada(ctx, e.cpuX - CPU_L / 2, 72, CPU_L, CPU_A, CPU_A / 2, "rgba(232,236,244,0.9)", "rgba(255,255,255,0.25)");

      // carro do jogador
      const topoCarro = JOGO_A - 96;
      if (carro) {
        // a imagem agora é o carro e nada mais, então ela senta centrada na
        // faixa que rebate — sem margem vazia empurrando o desenho para baixo
        const alturaImg = CARRO_L * (carro.height / carro.width);
        ctx.drawImage(carro, e.jogadorX - CARRO_L / 2, topoCarro + CARRO_A / 2 - alturaImg / 2, CARRO_L, alturaImg);
      } else {
        barraArredondada(ctx, e.jogadorX - CARRO_L / 2, topoCarro, CARRO_L, CARRO_A, 10, cor, cor);
      }

      desenharPlay(ctx, e.bola.x, e.bola.y, RAIO, Math.atan2(e.bola.vy, e.bola.vx), cor);

      /* "+20" subindo e sumindo, mais um clarão na linha que o play atravessou.
         Os avisos vivem na lista até envelhecer — a lista se limpa sozinha aqui,
         no mesmo passo em que é desenhada. */
      if (e.avisos.length) {
        e.avisos = e.avisos.filter((a) => agora - a.nascido < AVISO_MS);
        for (const a of e.avisos) {
          const t = (agora - a.nascido) / AVISO_MS;          // 0 → 1
          const subida = 74 * (1 - Math.pow(1 - t, 3));      // desacelera no fim
          const opacidade = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
          ctx.save();
          ctx.globalAlpha = Math.max(0, opacidade);
          // clarão no teto, só no comecinho
          if (t < 0.4) {
            ctx.globalAlpha = Math.max(0, 0.5 * (1 - t / 0.4));
            ctx.fillStyle = cor;
            ctx.fillRect(0, 0, JOGO_L, 5);
            ctx.globalAlpha = Math.max(0, opacidade);
          }
          ctx.font = "700 54px 'Albert Sans', system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = cor;
          ctx.shadowBlur = 24;
          ctx.fillStyle = cor;
          ctx.fillText(a.texto, Math.max(70, Math.min(JOGO_L - 70, a.x)), a.y - subida + 74);
          ctx.restore();
        }
      }
    };

    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [fase, carro]);

  /* ── controles ── */
  React.useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const paraLogico = (clienteX) => {
      const r = cv.getBoundingClientRect();
      return ((clienteX - r.left) / r.width) * JOGO_L;
    };
    const mover = (x) => { if (estadoRef.current) estadoRef.current.alvoX = x; };

    const onMouse = (ev) => mover(paraLogico(ev.clientX));
    const onToque = (ev) => { if (ev.touches[0]) { ev.preventDefault(); mover(paraLogico(ev.touches[0].clientX)); } };
    const onTecla = (ev) => {
      const e = estadoRef.current;
      if (!e) return;
      if (ev.key === "ArrowLeft")  { e.alvoX = Math.max(CARRO_L / 2, e.alvoX - 60); ev.preventDefault(); }
      if (ev.key === "ArrowRight") { e.alvoX = Math.min(JOGO_L - CARRO_L / 2, e.alvoX + 60); ev.preventDefault(); }
    };

    cv.addEventListener("mousemove", onMouse);
    cv.addEventListener("touchmove", onToque, { passive: false });
    window.addEventListener("keydown", onTecla);
    return () => {
      cv.removeEventListener("mousemove", onMouse);
      cv.removeEventListener("touchmove", onToque);
      window.removeEventListener("keydown", onTecla);
    };
  }, []);

  /* Espaço começa; Esc sai. */
  React.useEffect(() => {
    const onTecla = (ev) => {
      const alvo = ev.target;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA");
      if (ev.key === "Escape") { onSair(); return; }
      if (ev.key === " " && !digitando && fase !== "jogando") { ev.preventDefault(); comecar(); }
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [fase, comecar, onSair]);

  const registrar = async () => {
    setEnviando(true);
    try {
      const limpo = nome.trim().slice(0, 24);
      try { localStorage.setItem("framety.play.nome", limpo); } catch {}
      const r = await window.API.salvarPontos({ nome: limpo, pontos });
      setPlacar(r.placar || []);
      setRegistrado(true);
    } catch (ex) {
      window.__adminToast ? window.__adminToast("Não deu para registrar: " + (ex?.error || ex))
                          : alert("Não deu para registrar: " + (ex?.error || ex));
    } finally {
      setEnviando(false);
    }
  };

  // "líderes dos últimos 20 jogos": a lista guardada são os 20 últimos, e a
  // ordem de exibição é a da pontuação.
  const lideres = [...placar].sort((a, b) => b.pontos - a.pontos);

  return (
    <div className="play-tela" data-screen-label="10 Play">
      <button className="play-sair" onClick={onSair} data-cursor="hover">
        <Icon name="x" size={14} /> Sair
      </button>

      <div className="play-palco">
        <div className="play-canvas-wrap">
          <canvas ref={canvasRef} width={JOGO_L} height={JOGO_A} className="play-canvas" />

          {fase !== "jogando" && (
            <div className="play-overlay">
              {fase === "pronto" ? (
                <>
                  <span className="play-tag">Modo secreto</span>
                  <h1>Não deixe o play cair.</h1>
                  <p>
                    Mexa o carro com o mouse, o dedo ou as setas. Cada rebatida vale um ponto —
                    e a cada ponto o adversário fica mais rápido.
                  </p>
                  <button className="btn btn-accent" onClick={comecar} data-cursor="hover">
                    Começar <Icon name="arrow-right" size={14} />
                  </button>
                  <span className="play-dica">ou aperte espaço</span>
                </>
              ) : (
                <>
                  <span className="play-tag">Game over</span>
                  <h1>{pontos} {pontos === 1 ? "ponto" : "pontos"}</h1>
                  {registrado ? (
                    <p>Pontuação registrada. Boa.</p>
                  ) : (
                    <div className="play-registro">
                      <input type="text" value={nome} maxLength={24} placeholder="Seu nome"
                        onChange={(e) => setNome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && nome.trim()) registrar(); }} />
                      <button className="btn btn-accent" onClick={registrar} disabled={enviando || !nome.trim()} data-cursor="hover">
                        {enviando ? "Registrando…" : "Registrar"}
                      </button>
                    </div>
                  )}
                  <button className="btn btn-ghost" onClick={comecar} data-cursor="hover">
                    Jogar de novo <Icon name="arrow-right" size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="play-placar">
          <h2>Placar</h2>
          <p className="play-placar-sub">Os 20 últimos jogos</p>
          {lideres.length === 0 && <div className="play-placar-vazio">Ninguém jogou ainda.</div>}
          <ol>
            {lideres.map((l, i) => (
              <li key={l.quando + "-" + i} className={i === 0 ? "lider" : ""}>
                <span className="pos">{String(i + 1).padStart(2, "0")}</span>
                <span className="nome">{l.nome}</span>
                <span className="pts">{l.pontos}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
};

Object.assign(window, { MiniGame });
