/* screendimension.jsx — Aspecty, configurador de sala imersiva (/screendimension)
   Ferramenta pura (sem banco). Regra base: a ALTURA da projeção é sempre 1080px;
   a partir dela (escala = 1080 / altura_em_metros) calculamos a largura em pixels
   de cada projeção. O chão tem medidas próprias (base/topo/profundidade) e pode
   descolar das paredes, gerando formatos que não fecham uma caixa perfeita.       */

const SD_MAX_H      = 1080;   // altura de projeção fixa (px)
/* Margem de proteção: 10% de cada borda de cada tela (esquerda, direita, topo e
   base) — sobra uma área segura de 80% × 80%. Só marca a área onde
   concentrar textos e conteúdo importante — não entra em nenhuma conta. */
const SD_SAFE     = 0.10;
const SD_SAFE_HEX = "#FFB547", SD_SAFE_3D = 0xFFB547;
/* Link compartilhável: as medidas digitadas vivem na própria URL
   (/screendimension/semicircular?altura=3.67&curva=9.18…). Cada número novo
   reescreve o endereço (sem recarregar), e quem abre o link recebe a sala com os
   mesmos valores. Nomes legíveis no link; os internos ficam no código. */
const SD_URL_KEYS = { A: "altura", L: "largura", P: "profundidade", fBaseM: "chao_base", fDepM: "chao_prof", C: "curva", Ang: "angulo", Bl: "overlap" };
const sdCleanVal = (v) => String(v ?? "").replace(/[^0-9.,:]/g, "").slice(0, 14);   // ":" entra nas proporções (16:9)
const sdCleanSigned = (v) => String(v ?? "").replace(/[^0-9.,-]/g, "").slice(0, 8);
const sdUrlFor = (mode, raw) => {
  const q = new URLSearchParams();
  Object.entries(SD_URL_KEYS).forEach(([k, name]) => { const v = sdCleanVal(raw[k]); if (v) q.set(name, v); });
  const vw = sdCleanVal(raw.Vw), vh = sdCleanVal(raw.Vh);
  if (vw && vh) q.set("video", `${vw}x${vh}`);
  const sg = sdCleanVal(raw.Sg); if (sg) q.set("sangria", sg);
  if (raw.Un === "px" || raw.Un === "prop") q.set("unidade", raw.Un);     // medidas em pixels ou em proporção
  if (raw.Ss) q.set("simples", "1");                                      // sala simples (sem as laterais)
  const st = sdCleanSigned(raw.St); if (st && parseFloat(st.replace(",", "."))) q.set("esticar", st);
  const path = mode === "curve" ? "/screendimension/semicircular" : "/screendimension";
  const qs = q.toString();
  return path + (qs ? "?" + qs : "");
};
const sdSyncUrl = (mode, raw) => {
  try { const u = sdUrlFor(mode, raw); if (u !== location.pathname + location.search) history.replaceState(history.state, "", u); } catch (_) {}
};
const sdReadUrl = () => {
  try {
    const q = new URLSearchParams(location.search), out = {};
    Object.entries(SD_URL_KEYS).forEach(([k, name]) => { const v = sdCleanVal(q.get(name)); if (v) out[k] = v; });
    const m = /^([0-9.,]+)x([0-9.,]+)$/i.exec(q.get("video") || "");
    if (m) { out.Vw = sdCleanVal(m[1]); out.Vh = sdCleanVal(m[2]); }
    const sg = sdCleanVal(q.get("sangria")); if (sg) out.Sg = sg;
    if (!out.Bl) { const b = sdCleanVal(q.get("blend")); if (b) out.Bl = b; }      // links antigos (antes de virar "overlap")
    const un = q.get("unidade"); if (un === "px" || un === "prop") out.Un = un;
    if (q.get("simples") === "1") out.Ss = "1";
    const st = sdCleanSigned(q.get("esticar")); if (st) out.St = st;
    return Object.keys(out).length ? out : null;
  } catch (_) { return null; }
};

/* Testar um vídeo: um arquivo W×H é encaixado na área total pela ALTURA (a
   projeção tem altura fixa); o que muda é a largura. Mais largo que a área →
   corta nas laterais; mais estreito → estica (ou sobra faixa). Até 10% é
   aceitável; além disso o vídeo não é compatível.
   `st` é o esticamento feito à mão (em %, arrastando o vídeo no preview): a
   largura na tela passa a ser sw × (1 + st) e a conta mostra o que isso causa. */
const SD_PURPLE = "#A855F7", SD_PURPLE_3D = 0xA855F7, SD_FIT_TOL = 0.10;
const sdPct = (f) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const sdFit = (aw, ah, vwRaw, vhRaw, stRaw) => {
  const vw = sdNum(vwRaw), vh = sdNum(vhRaw);
  if (!vw || !vh || !aw || !ah) return null;
  const rA = aw / ah, rV = vw / vh;
  const sw = vw * ah / vh;                      // largura do vídeo já na altura da área, sem deformar
  const wider = rV >= rA;
  const diff = wider ? 1 - rA / rV : rA / rV - 1;
  const each = Math.abs(sw - aw) / 2;           // px da área, em cada lado
  const exact = diff < 0.001;
  const stN = parseFloat(String(stRaw ?? "").replace(",", ".")) / 100;
  const st = Math.max(-0.6, Math.min(4, isFinite(stN) ? stN : 0));     // esticamento à mão
  const dw = sw * (1 + st);                     // largura do vídeo na tela, já esticado
  const over = (dw - aw) / 2;                   // > 0: px cortados de cada lado; < 0: faixa vazia de cada lado
  const fills = Math.abs(dw - aw) < 0.75;
  const need = aw / sw - 1;                     // quanto esticar para preencher a tela exatamente
  const esc = Math.abs(ah / vh - 1) > 0.001 ? ` O vídeo sobe de ${sdFmt(vh)} para ${sdFmt(ah)} px de altura (${sdPct(ah / vh)}).` : "";
  let ok, msg;
  if (Math.abs(st) < 0.0005) {
    ok = diff <= SD_FIT_TOL + 1e-9;
    if (exact) msg = `Encaixa perfeitamente: mesma proporção da área (${sdRatio(aw, ah)}).${esc}`;
    else if (ok && wider) msg = `Encaixa cortando ${sdPct(diff)} da largura do vídeo — ${sdFmt(each)} px de cada lado ficam fora da tela.${esc}`;
    else if (ok) msg = `Encaixa esticando ${sdPct(diff)} na largura — ou deixando uma faixa de ${sdFmt(each)} px em cada lado.${esc}`;
    else if (wider) msg = `Vídeo não compatível: seria preciso cortar ${sdPct(diff)} da largura (${sdFmt(each)} px de cada lado), acima do limite de 10%. O corte seria abrupto.`;
    else msg = `Vídeo não compatível: seria preciso esticar ${sdPct(diff)} na largura (faltam ${sdFmt(each)} px de cada lado), acima do limite de 10%. O esticamento seria abrupto.`;
  } else {
    const cutF = over > 0 ? (dw - aw) / dw : 0;
    ok = Math.abs(st) <= SD_FIT_TOL + 1e-9 && cutF <= SD_FIT_TOL + 1e-9;
    msg = `${st > 0 ? "Esticado" : "Comprimido"} ${sdPct(Math.abs(st))} na largura (de ${sdFmt(sw)} para ${sdFmt(dw)} px). `
      + (fills ? "Preenche a tela de ponta a ponta." : over > 0 ? `Passa da tela: ${sdFmt(over)} px de cada lado ficam de fora.` : `Ainda sobra uma faixa vazia de ${sdFmt(-over)} px em cada lado.`)
      + (Math.abs(st) > SD_FIT_TOL + 1e-9 ? " Acima de 10% a deformação já aparece — veja no preview." : "") + esc;
  }
  return { vw, vh, sw, dw, st, need, over, fills, aw, ah, wider, diff, each, ok, exact, msg,
           a: (aw - dw) / 2 / aw, b: (aw + dw) / 2 / aw };   // posição do vídeo na área (0–1; pode passar das bordas)
};

/* Imagem de teste do "Testar um vídeo": uma paisagem genérica desenhada na
   proporção exata do vídeo (o sol e os balões são círculos perfeitos — é neles
   que o esticamento fica evidente). Desenhada uma vez por proporção. */
const sdNature = (() => {
  const cache = {};
  return (vw, vh) => {
    const r = Math.max(0.2, Math.min(8, vw / vh)), key = r.toFixed(3);
    if (cache[key]) return cache[key];
    const H = 720, W = Math.max(8, Math.round(H * r));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const hz = H * 0.6;                                         // linha do horizonte
    let grad = g.createLinearGradient(0, 0, 0, hz);
    grad.addColorStop(0, "#17335f"); grad.addColorStop(0.55, "#5b7fb5"); grad.addColorStop(0.86, "#f3a66b"); grad.addColorStop(1, "#ffd9a0");
    g.fillStyle = grad; g.fillRect(0, 0, W, hz);
    // sol (círculo perfeito) com halo
    const sx = W * 0.5 + H * 0.34, sy = H * 0.4, sr = H * 0.085;
    grad = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.4);
    grad.addColorStop(0, "rgba(255,236,190,.75)"); grad.addColorStop(1, "rgba(255,236,190,0)");
    g.fillStyle = grad; g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    g.fillStyle = "#fff3d0"; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    // montanhas: a forma depende de x/H, então a paisagem continua igual em qualquer proporção
    const serra = (y0, amp, f, fase, cor) => {
      g.fillStyle = cor; g.beginPath(); g.moveTo(0, hz + 2);
      for (let x = 0; x <= W; x += 3) { const t = x / H * f + fase;
        g.lineTo(x, y0 - amp * (0.55 * Math.sin(t) + 0.3 * Math.sin(t * 2.3 + 1.7) + 0.15 * Math.sin(t * 5.1 + 0.4) + 0.2 * Math.abs(Math.sin(t * 0.7 + 2)))); }
      g.lineTo(W, hz + 2); g.closePath(); g.fill();
    };
    serra(hz - H * 0.10, H * 0.13, 2.2, 0.6, "#6f86a8");
    serra(hz - H * 0.05, H * 0.10, 3.4, 2.1, "#48648a");
    serra(hz - H * 0.01, H * 0.06, 5.2, 4.0, "#2c4a55");
    // lago com o reflexo do sol
    grad = g.createLinearGradient(0, hz, 0, H);
    grad.addColorStop(0, "#f0b98a"); grad.addColorStop(0.18, "#5f86ad"); grad.addColorStop(1, "#12283f");
    g.fillStyle = grad; g.fillRect(0, hz, W, H - hz);
    for (let i = 0; i < 26; i++) { const y = hz + 6 + i * (H - hz) / 30, w = sr * (0.5 + i * 0.13);
      g.fillStyle = `rgba(255,236,190,${0.42 - i * 0.014})`; g.fillRect(sx - w, y, w * 2, 3); }
    // margem com pinheiros (triângulos de proporção fixa)
    g.fillStyle = "#0e2a26";
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, H * 0.9 - H * 0.03 * Math.sin(x / H * 3.1 + 1));
    g.lineTo(W, H); g.closePath(); g.fill();
    for (let x = H * 0.06, i = 0; x < W; x += H * (0.085 + 0.05 * Math.abs(Math.sin(i * 1.9))), i++) {
      const base = H * 0.9 - H * 0.03 * Math.sin(x / H * 3.1 + 1) + 4, alt = H * (0.13 + 0.07 * Math.abs(Math.sin(i * 2.7 + 1))), larg = alt * 0.3;
      for (let k = 0; k < 3; k++) { const y = base - alt * (0.25 + k * 0.25), w = larg * (1 - k * 0.24);
        g.beginPath(); g.moveTo(x, y - alt * 0.36); g.lineTo(x - w, y); g.lineTo(x + w, y); g.closePath(); g.fill(); }
      g.fillRect(x - 1.5, base - alt * 0.26, 3, alt * 0.26);
    }
    // balões: mais círculos perfeitos, espalhados pela largura
    const balao = (x, y, rr, c1, c2) => {
      g.fillStyle = c1; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = c2; g.beginPath(); g.arc(x, y, rr, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42); g.lineTo(x, y + rr); g.closePath(); g.fill();
      g.strokeStyle = "rgba(20,20,30,.55)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - rr * 0.5, y + rr * 0.86); g.lineTo(x - rr * 0.16, y + rr * 1.5); g.moveTo(x + rr * 0.5, y + rr * 0.86); g.lineTo(x + rr * 0.16, y + rr * 1.5); g.stroke();
      g.fillStyle = "#3a2a1c"; g.fillRect(x - rr * 0.18, y + rr * 1.5, rr * 0.36, rr * 0.26);
    };
    const nb = Math.max(2, Math.round(r * 1.6));
    for (let i = 0; i < nb; i++) {
      const x = W * (i + 0.5) / nb - H * 0.1 * Math.sin(i * 2.4), y = H * (0.2 + 0.1 * Math.abs(Math.sin(i * 1.7 + 0.5)));
      if (Math.abs(x - sx) < sr * 2.4) continue;                // não cobre o sol
      balao(x, y, H * (0.05 + 0.014 * (i % 3)), ["#e5484d", "#f2b233", "#3aa6a0", "#a855f7"][i % 4], "rgba(255,255,255,.85)");
    }
    return (cache[key] = { cv, url: cv.toDataURL("image/jpeg", 0.9) });
  };
})();

/* Margem extra de sangria: a área X% maior (X digitado, 10 por padrão), na mesma proporção, para gerar o
   conteúdo com borda sobrando (5% de cada lado) e encaixar sem sustos na
   montagem. Não muda nenhuma outra conta. */
const SD_ORANGE = "#FF7A1A", SD_ORANGE_3D = 0xFF7A1A;
const sdBleedPct = (v) => Math.min(100, Math.max(0.1, sdNum(v) || 10));   // % digitado (padrão 10)
const sdBleed = (w, h, pct = 10) => {
  const f = pct / 100;
  const bw = Math.round(w * (1 + f)), bh = Math.round(h * (1 + f));
  return { w, h, pct, f, bw, bh, ex: (bw - w) / 2, ey: (bh - h) / 2 };
};
const SDBleed = ({ on, setOn, pct, setPct, bleed, areaLbl, children }) => (
  <div className={`sd-bleed ${on ? "on" : ""}`}>
    <label className="sd-bleed-h">
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <b><i />Margem extra de sangria</b><span>+{sdPct(bleed.f)} na {areaLbl}, mesma proporção</span>
    </label>
    {on && <>
      <div className="sd-bleed-in">
        <span>Margem</span>
        <span className="sd-input-wrap sd-input-b"><input type="number" min="0.1" max="100" step="1" inputMode="decimal" value={pct} placeholder="10" onChange={(e) => setPct(e.target.value)} /><b>%</b></span>
        <em>a mais na {areaLbl}</em>
      </div>
      {children}
      <div className="sd-bleed-r">
        Produza o conteúdo em <b>{sdFmt(bleed.bw)} × {sdFmt(bleed.bh)} px</b> ({sdRatio(bleed.bw, bleed.bh)}) — na montagem,
        sobram {sdFmt(bleed.ex)} px em cada lateral e {sdFmt(bleed.ey)} px em cima e embaixo, que ficam fora da tela.
        {bleed.bw % 2 ? ` Largura ímpar: se o codec reclamar, use ${sdFmt(bleed.bw + 1)}.` : ""}
      </div>
    </>}
  </div>
);

const SDVideoTest = ({ vw, vh, setVw, setVh, st, setSt, fit, areaLbl, children }) => (
  <div className="sd-vtest">
    <div className="sd-vtest-h"><b><i />Testar um vídeo</b><span>compara com a {areaLbl}</span></div>
    <div className="sd-vtest-in">
      <span className="sd-input-wrap sd-input-v"><input type="number" min="1" step="1" inputMode="numeric" value={vw} placeholder="largura" onChange={(e) => setVw(e.target.value)} /><b>px</b></span>
      <span className="sd-vtest-x">×</span>
      <span className="sd-input-wrap sd-input-v"><input type="number" min="1" step="1" inputMode="numeric" value={vh} placeholder="altura" onChange={(e) => setVh(e.target.value)} /><b>px</b></span>
      {fit && <span className="sd-vtest-r">{sdRatio(fit.vw, fit.vh)}</span>}
      {(vw || vh) && <button type="button" className="sd-btn ghost sm" onClick={() => { setVw(""); setVh(""); setSt(""); }}>limpar</button>}
    </div>
    {fit && <SDStretch fit={fit} st={st} setSt={setSt} />}
    {children}
    {fit && <div className={`sd-vfit ${fit.ok ? "ok" : "bad"}`}>{fit.ok ? "✓ " : "⚠ "}{fit.msg}</div>}
  </div>
);

/* Preview do vídeo na tela, com uma imagem de verdade: arrastando uma das
   bordas roxas o vídeo estica (ou encolhe) na largura, sempre centrado, e a
   imagem deforma junto — a porcentagem aparece em cima. As linhas brancas
   tracejadas marcam a largura original, sem deformar. O que passa da tela é
   cortado; o que falta fica escuro. */
const SDStretch = ({ fit, st, setSt }) => {
  const wrap = React.useRef(null), box = React.useRef(null);
  const [maxW, setMaxW] = React.useState(600);
  React.useEffect(() => {
    const medir = () => wrap.current && setMaxW(Math.max(220, wrap.current.clientWidth));
    medir(); window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  const k = Math.min(Math.min(maxW, 640) / fit.aw, 240 / fit.ah);
  const bw = fit.aw * k, bh = fit.ah * k;
  const img = sdNature(fit.vw, fit.vh);
  const lim = (x) => Math.max(0, Math.min(1, x));
  const o0 = (fit.aw - fit.sw) / 2 / fit.aw, o1 = (fit.aw + fit.sw) / 2 / fit.aw;      // largura original (sem deformar)
  const arrastar = (ev) => {
    ev.preventDefault();
    const alvo = ev.currentTarget;
    try { alvo.setPointerCapture(ev.pointerId); } catch (_) {}
    const mover = (e) => {
      const r = box.current.getBoundingClientRect();
      let dw = Math.max(8, Math.abs(e.clientX - (r.left + r.width / 2)) * 2) / r.width * fit.aw;
      if (Math.abs(dw - fit.aw) < fit.aw * 0.012) dw = fit.aw;                          // gruda na borda da tela
      let pct = (dw / fit.sw - 1) * 100;
      if (Math.abs(pct) < 0.8) pct = 0;                                                 // gruda no original
      setSt(pct ? String(Math.round(pct * 10) / 10) : "");
    };
    const soltar = () => { alvo.removeEventListener("pointermove", mover); alvo.removeEventListener("pointerup", soltar); alvo.removeEventListener("pointercancel", soltar); };
    alvo.addEventListener("pointermove", mover); alvo.addEventListener("pointerup", soltar); alvo.addEventListener("pointercancel", soltar);
  };
  const forte = Math.abs(fit.st) > SD_FIT_TOL + 1e-9;
  return (
    <div className="sd-stretch" ref={wrap}>
      <div className="sd-stretch-box" ref={box} style={{ width: bw, height: bh }}>
        <img src={img.url} alt="" draggable="false" style={{ left: `${fit.a * 100}%`, width: `${(fit.b - fit.a) * 100}%` }} />
        {Math.abs(fit.st) > 0.0005 && [o0, o1].filter((x) => x > 0.002 && x < 0.998).map((x, i) => <i key={i} className="sd-stretch-orig" style={{ left: `${x * 100}%` }} />)}
        <span className={`sd-stretch-pct ${forte ? "bad" : ""}`}>{Math.abs(fit.st) < 0.0005 ? "sem esticar" : `${fit.st > 0 ? "esticado +" : "comprimido −"}${sdPct(Math.abs(fit.st))}`}</span>
        {[fit.a, fit.b].map((x, i) => (
          <div key={i} className={`sd-stretch-h ${forte ? "bad" : ""}`} style={{ left: `${lim(x) * 100}%` }} onPointerDown={arrastar}
               onDoubleClick={() => setSt("")} title="Arraste para esticar o vídeo na largura (clique duplo volta ao original)"><b /></div>
        ))}
      </div>
      <div className="sd-stretch-bar">
        <span>Esticar</span>
        <span className="sd-input-wrap sd-input-v"><input type="number" step="0.5" inputMode="decimal" value={st} placeholder="0" onChange={(e) => setSt(e.target.value)} /><b>%</b></span>
        <button type="button" className="sd-btn ghost sm" onClick={() => setSt("")} disabled={Math.abs(fit.st) < 0.0005}>Original</button>
        {!fit.exact && <button type="button" className="sd-btn ghost sm" onClick={() => setSt(String(Math.round(fit.need * 1000) / 10))} disabled={fit.fills}
                title="Estica (ou encolhe) o vídeo até ele ocupar a tela de ponta a ponta">Preencher a tela ({fit.need >= 0 ? "+" : "−"}{sdPct(Math.abs(fit.need))})</button>}
        <em>vídeo na tela: {sdFmt(fit.dw)} × {sdFmt(fit.ah)} px · arraste as bordas do vídeo</em>
      </div>
    </div>
  );
};

/* Medidas em metros, em pixels ou em proporção. Tudo vira metros por dentro:
   px = largura na altura de 1080; proporção = largura : altura da tela ("16:9"
   ou "1,78"). `a` é a altura em metros (que continua valendo 1080 px). */
const SD_UNITS = [["m", "Metros"], ["px", "Pixels"], ["prop", "Proporção"]];
const sdRatioNum = (v) => {
  const t = String(v ?? "").trim().replace(/,/g, ".");
  const m = /^([0-9.]+)\s*[:x×\/]\s*([0-9.]+)$/i.exec(t);
  if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]); return x > 0 && y > 0 ? x / y : null; }
  const n = parseFloat(t); return isFinite(n) && n > 0 ? n : null;
};
const sdLen = (v, un, a) => {
  if (un === "px") { const n = sdNum(v); return n ? n * a / SD_MAX_H : null; }
  if (un === "prop") { const r = sdRatioNum(v); return r ? r * a : null; }
  return sdNum(v);
};
// metros → o texto do campo na unidade nova (ao trocar de unidade, o que já estava digitado é convertido)
const sdToUnit = (m, un, a) => {
  if (!m) return "";
  if (un === "px") return String(Math.round(m * SD_MAX_H / a));
  if (un === "prop") {
    const w = Math.round(m * SD_MAX_H / a), g = (x, y) => (y ? g(y, x % y) : x), d = g(w, SD_MAX_H) || 1;
    return w / d <= 64 && SD_MAX_H / d <= 64 ? `${w / d}:${SD_MAX_H / d}` : String(Math.round(m / a * 1000) / 1000);
  }
  return String(Math.round(m * 100) / 100);
};
const sdUnitLbl = (un) => (un === "px" ? "px" : un === "prop" ? "larg:alt" : "m");
const SDUnits = ({ un, setUn }) => (
  <div className="sd-units" title="Como você quer informar as telas">
    {SD_UNITS.map(([id, lbl]) => <button key={id} type="button" className={un === id ? "on" : ""} onClick={() => un !== id && setUn(id)}>{lbl}</button>)}
  </div>
);
/* Proporção sempre à vista: a forma reduzida (32×9), a decimal e os pixels. */
const SDProp = ({ items }) => (
  <div className="sd-prop">
    {items.map(([lbl, w, h]) => (
      <div key={lbl}><em>{lbl}</em><b>{sdRatio(w, h)}</b><span>{/×/.test(sdRatio(w, h)) ? `${(w / h).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}:1 · ` : ""}{sdFmt(w)} × {sdFmt(h)} px</span></div>
    ))}
  </div>
);

/* Faixas de projetor na profundidade do chão: 1080 inteiros a partir da entrada,
   e a última com o resto. */
const sdFloorRows = (depth) => {
  const out = []; let left = Math.round(depth || 0);
  while (left > 0) { out.push(Math.min(SD_MAX_H, left)); left -= SD_MAX_H; }
  return out.length ? out : [0];
};
const sdSafe = (w, h = SD_MAX_H) => ({ w: Math.round(w * (1 - 2 * SD_SAFE)), h: Math.round(h * (1 - 2 * SD_SAFE)) });
const sdSafeTxt = (w, h = SD_MAX_H) => { const s = sdSafe(w, h); return `${sdFmt(s.w)} × ${sdFmt(s.h)}`; };

const SD_DEFAULT = {
  Wc: 1920, Ws: 1920, H: SD_MAX_H,
  fTop: 1920, fBase: 1920, fDepth: 1080,
  frontTotalW: 5760, timelineW: 5760, timelineH: 2160, scale: 0,
  isDefault: true,
};

const sdNum = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) && n > 0 ? n : null;
};
const sdFmt = (n) => Math.round(n).toLocaleString("pt-BR");
const sdRatio = (w, h) => {
  w = Math.round(w); h = Math.round(h);
  if (!w || !h) return "—";
  const g = (x, y) => (y ? g(y, x % y) : x);
  const d = g(w, h) || 1;
  const rw = w / d, rh = h / d;
  if (rw <= 40 && rh <= 40) return `${rw}×${rh}`;      // proporção limpa (16×9, 2×1…)
  return `${(w / h).toFixed(2).replace(".", ",")}:1`;   // decimal quando não reduz bonito
};

/* Carrega um script externo uma única vez (Three.js / libs de PDF sob demanda). */
/* Fundo da página: ondas de partículas (three.js), só nesta aba. Fica fixo
   atrás de tudo, sem receber cliques. Pontos redondos e discretos para não
   competir com os números; pausa com a aba escondida e respeita "reduzir
   movimento" do sistema (aí fica parado). */
const SDParticleWave = () => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let vivo = true, raf = 0, limpar = () => {};
    (async () => {
      await sdLoadScript("https://unpkg.com/three@0.160.0/build/three.min.js").catch(() => {});
      for (let i = 0; i < 60 && vivo && !window.THREE; i++) await new Promise((r) => setTimeout(r, 100));
      const THREE = window.THREE, canvas = ref.current;
      if (!vivo || !THREE || !canvas) return;
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" }); }
      catch (_) { return; }                         // sem WebGL: fica só o fundo escuro
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x050507, 1);
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x050507, 14, 38);
      const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);
      camera.position.set(0, 6, 5);
      const N = 170, gap = 0.3, pos = new Float32Array(N * N * 3), esc = new Float32Array(N * N);
      for (let x = 0, i = 0; x < N; x++) for (let y = 0; y < N; y++, i++) {
        pos[i * 3] = x * gap - (N * gap) / 2; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = y * gap - (N * gap) / 2; esc[i] = 1;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("scale", new THREE.BufferAttribute(esc, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Vector3(0.78, 0.84, 0.95) } },
        vertexShader: `
          attribute float scale; uniform float uTime; varying float vFade;
          void main() {
            vec3 p = position; float s = scale;
            p.y += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
            p.x += (sin(p.y + uTime) * 0.5);
            s += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = max(s, 0.0) * 15.0 * (1.0 / -mv.z);
            vFade = clamp(1.0 - (-mv.z - 6.0) / 40.0, 0.15, 1.0);   // some na distância
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor; varying float vFade;
          void main() {
            vec2 c = gl_PointCoord - 0.5; float d = length(c);
            if (d > 0.5) discard;                                   // ponto redondo
            gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.38, 0.5, d)) * 0.8 * vFade);
          }`,
      });
      const pontos = new THREE.Points(geo, mat);
      scene.add(pontos);
      const medir = () => {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
      };
      medir();
      const parado = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const quadro = () => {
        if (!vivo) return;
        if (!document.hidden) {
          mat.uniforms.uTime.value += 0.02;
          camera.lookAt(scene.position);
          renderer.render(scene, camera);
        }
        if (!parado) raf = requestAnimationFrame(quadro);
      };
      quadro();
      window.addEventListener("resize", medir);
      limpar = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", medir);
        scene.remove(pontos); geo.dispose(); mat.dispose(); renderer.dispose();
      };
    })();
    return () => { vivo = false; limpar(); };
  }, []);
  return <canvas ref={ref} className="sd-bgwave" aria-hidden="true" />;
};

const sdLoadScript = (src) => new Promise((resolve, reject) => {
  if ([...document.scripts].some((s) => s.src === src)) return resolve();
  const el = document.createElement("script");
  el.src = src; el.async = true;
  el.onload = () => resolve();
  el.onerror = () => reject(new Error("falha ao carregar " + src));
  document.head.appendChild(el);
});

/* ─────────────────────────── Preview 3D (Three.js) ──────────────────────────── */
/* Recebe as medidas em metros das paredes e do chão + os rótulos em px. Desenha a
   sala e coloca uma etiqueta de resolução (sprite) no centro de cada superfície —
   ela acompanha a rotação e fica sempre legível. */
const SDPreview3D = ({ res, initView }) => {
  const mountRef = React.useRef(null);
  const three    = React.useRef({});
  const [ready, setReady] = React.useState(false);
  const [err, setErr]     = React.useState(false);
  const propsRef = React.useRef({});
  propsRef.current = { res };

  React.useEffect(() => {
    let alive = true;
    sdLoadScript("https://unpkg.com/three@0.160.0/build/three.min.js")
      .then(() => {
        if (!alive || !window.THREE || !mountRef.current) return;
        const THREE = window.THREE;
        const mount = mountRef.current;
        const w = mount.clientWidth, h = mount.clientHeight || 300;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0c);
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        mount.appendChild(renderer.domElement);
        renderer.domElement.style.touchAction = "none";
        renderer.domElement.style.cursor = "grab";

        const roomGroup = new THREE.Group();
        scene.add(roomGroup);
        const ctl = { theta: -0.6, phi: 1.12, dist: 10, target: new THREE.Vector3(0, 0, 0) };
        three.current = { THREE, scene, camera, renderer, roomGroup, ctl, mount };
        buildRoom();
        // ficha salva reaberta: volta ao ângulo em que o 3D estava
        if (initView) ["theta", "phi", "dist"].forEach((k) => { if (typeof initView[k] === "number") ctl[k] = initView[k]; });
        setReady(true);

        // Um dedo (ou o mouse) gira; dois dedos fazem pinça = zoom. Cada ponteiro é
        // rastreado pelo id — antes os dois dedos disputavam a mesma posição e a
        // rotação pulava de um para o outro.
        const pts = new Map();
        let pinch0 = 0, dist0 = 0;
        const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
        const down = (e) => {
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          try { e.target.setPointerCapture?.(e.pointerId); } catch (_) {}
          if (pts.size === 2) { pinch0 = gap(); dist0 = ctl.dist; }
          renderer.domElement.style.cursor = "grabbing";
        };
        const move = (e) => {
          const p = pts.get(e.pointerId);
          if (!p) return;
          const dx = e.clientX - p.x, dy = e.clientY - p.y;
          p.x = e.clientX; p.y = e.clientY;
          if (pts.size === 1) {
            ctl.theta -= dx * 0.008;
            ctl.phi = Math.max(0.15, Math.min(Math.PI - 0.15, ctl.phi - dy * 0.008));
          } else if (pts.size === 2 && pinch0 > 0) {
            const g = gap();
            if (g > 0) ctl.dist = Math.max(2, Math.min(120, dist0 * pinch0 / g));   // afastar os dedos = aproximar
          }
        };
        const up = (e) => {
          pts.delete(e.pointerId);
          // saiu da pinça para um dedo: o que ficou continua de onde está, sem salto
          if (pts.size < 2) pinch0 = 0;
          if (!pts.size) renderer.domElement.style.cursor = "grab";
        };
        const wheel = (e) => { e.preventDefault(); ctl.dist = Math.max(2, Math.min(120, ctl.dist * (1 + Math.sign(e.deltaY) * 0.1))); };
        renderer.domElement.addEventListener("pointerdown", down);
        renderer.domElement.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        renderer.domElement.addEventListener("wheel", wheel, { passive: false });
        const onResize = () => { if (!mount) return; const nw = mount.clientWidth, nh = mount.clientHeight || 300; camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); };
        window.addEventListener("resize", onResize);

        let raf;
        const loop = () => {
          const s = Math.sin(ctl.phi);
          camera.position.set(
            ctl.target.x + ctl.dist * s * Math.sin(ctl.theta),
            ctl.target.y + ctl.dist * Math.cos(ctl.phi),
            ctl.target.z + ctl.dist * s * Math.cos(ctl.theta));
          camera.lookAt(ctl.target);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        loop();

        // Foto para o PDF: renderiza num tamanho fixo, um pouco mais perto, e
        // devolve o quadro — depois volta o canvas ao tamanho da tela.
        renderer.domElement.__sdView = () => ({ theta: ctl.theta, phi: ctl.phi, dist: ctl.dist });
        renderer.domElement.__sdSnap = (sw, sh) => {
          const ow = mount.clientWidth, oh = mount.clientHeight || 300, od = ctl.dist;
          renderer.setPixelRatio(1); renderer.setSize(sw, sh, false);
          camera.aspect = sw / sh; camera.updateProjectionMatrix();
          ctl.dist = od * 0.64;
          const s = Math.sin(ctl.phi);
          camera.position.set(ctl.target.x + ctl.dist * s * Math.sin(ctl.theta), ctl.target.y + ctl.dist * Math.cos(ctl.phi), ctl.target.z + ctl.dist * s * Math.cos(ctl.theta));
          camera.lookAt(ctl.target);
          renderer.render(scene, camera);
          const src = renderer.domElement.toDataURL("image/png");
          ctl.dist = od;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(ow, oh);
          camera.aspect = ow / oh; camera.updateProjectionMatrix();
          return { src, w: sw, h: sh };
        };

        three.current.cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          renderer.domElement.removeEventListener("pointerdown", down);
          renderer.domElement.removeEventListener("pointermove", move);
          renderer.domElement.removeEventListener("wheel", wheel);
          renderer.dispose();
          if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        };
      })
      .catch(() => alive && setErr(true));
    return () => { alive = false; three.current.cleanup?.(); three.current = {}; };
  }, []);

  React.useEffect(() => { if (three.current.THREE) buildRoom(); }, [JSON.stringify(res)]);

  function makeLabel(THREE, text, base, tone) {
    const cv = document.createElement("canvas");
    const fs = 40, pad = 18;
    let ctx = cv.getContext("2d");
    ctx.font = `600 ${fs}px 'Inter', sans-serif`;
    const tw = ctx.measureText(text).width;
    cv.width = Math.ceil(tw + pad * 2); cv.height = fs + pad;
    ctx = cv.getContext("2d");
    ctx.font = `600 ${fs}px 'Inter', sans-serif`;
    ctx.fillStyle = "rgba(8,8,10,0.72)";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = tone || "rgba(255,255,255,0.28)"; ctx.lineWidth = 2.5;
    ctx.strokeRect(1.25, 1.25, cv.width - 2.5, cv.height - 2.5);
    ctx.fillStyle = "#ededed"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, cv.width / 2, cv.height / 2 + 1);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 8;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    const hUnit = base * 0.052;
    sp.scale.set(hUnit * (cv.width / cv.height), hUnit, 1);
    sp.renderOrder = 10;
    return sp;
  }

  /* A imagem de teste na área (aw × ah px), já esticada como no preview: o que
     passa das bordas é cortado, o que falta fica escuro. */
  function fitTexture(THREE, fit, aw, ah) {
    const TW = 2048, TH = Math.max(32, Math.round(TW * ah / aw));
    const cv = document.createElement("canvas"); cv.width = TW; cv.height = TH;
    const g = cv.getContext("2d");
    g.fillStyle = "#050507"; g.fillRect(0, 0, TW, TH);
    g.drawImage(sdNature(fit.vw, fit.vh).cv, fit.a * TW, 0, (fit.b - fit.a) * TW, TH);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 8;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  // a câmera só volta ao enquadramento padrão quando a forma da sala muda (e não a cada arrasto do vídeo)
  function frame(key, x, y, z, dist) {
    const t = three.current;
    t.ctl.target.set(x, y, z);
    // quadro estreito (coluna alta): afasta para a sala caber na largura
    const asp = t.mount ? t.mount.clientWidth / (t.mount.clientHeight || 300) : 1.6;
    if (t.shapeKey !== key) { t.shapeKey = key; t.ctl.dist = dist * Math.max(1, 1.05 / Math.max(0.4, asp)); }
  }

  function buildRoom() {
    const t = three.current; if (!t.THREE) return;
    const THREE = t.THREE, grp = t.roomGroup;
    while (grp.children.length) { const c = grp.children.pop(); c.geometry?.dispose?.(); c.material?.map?.dispose?.(); c.material?.dispose?.(); }
    const r = propsRef.current.res || {};
    if (r.curve) return buildCurve(THREE, grp, r);
    // O 3D é montado pela RESOLUÇÃO (px), não pelos metros — assim o visual mantém a
    // proporção exata de cada tela (1920×1080 parece 16:9; 1080×1080 parece quadrado).
    const W = 0.0016;   // escala pixel → unidade de mundo
    const simple = !!r.simple;                                   // sala simples: sem as laterais
    const Wc=(r.Wc||1920)*W, Ws=simple ? 0 : (r.Ws||1920)*W, H=(r.H||1080)*W;
    const fTop=(r.fTop||1920)*W, fBase=(r.fBase||1920)*W, fDep=(r.fDepth||1080)*W;
    const base = Math.max(Wc, Ws, H, fBase, fDep, fTop);
    // Três cores para separar as peças do desenho. O acento saiu do vermelho
    // junto com o resto do site, mas num azul mais claro que o `blue` daqui —
    // no azul do site as duas peças ficariam indistinguíveis.
    const accent = 0x5EC8F2, blue = 0x3a7bd5, teal = 0x2a9d8f;
    const zFar = -fDep, zNear = 0, midZ = (zFar + zNear) / 2;

    // helpers vetoriais
    const sub = (u, w) => [u[0]-w[0], u[1]-w[1], u[2]-w[2]];
    const add = (u, w) => [u[0]+w[0], u[1]+w[1], u[2]+w[2]];
    const mul = (u, s) => [u[0]*s, u[1]*s, u[2]*s];
    const nrm = (u) => { const L = Math.hypot(u[0],u[1],u[2]) || 1; return [u[0]/L, u[1]/L, u[2]/L]; };
    const bil = (c00,c10,c11,c01,u,v) => add(add(mul(c00,(1-u)*(1-v)), mul(c10,u*(1-v))), add(mul(c11,u*v), mul(c01,(1-u)*v)));
    const UP = [0, H, 0];

    // cantos do piso (trapézio próprio) — px→mundo
    const flFar=[-fTop/2,0,zFar], frFar=[fTop/2,0,zFar], flNear=[-fBase/2,0,zNear], frNear=[fBase/2,0,zNear];
    // parede frontal (largura Wc) — cantos de baixo
    const wlBot=[-Wc/2,0,zFar], wrBot=[Wc/2,0,zFar];
    // laterais: seguem a DIREÇÃO da aresta do piso, com COMPRIMENTO = Ws (a resolução da lateral).
    const dirL = nrm(sub(flNear, flFar)), dirR = nrm(sub(frNear, frFar));
    const lFar = wlBot, lNear = add(lFar, mul(dirL, Ws));
    const rFar = wrBot, rNear = add(rFar, mul(dirR, Ws));

    const quad = (p1,p2,p3,p4, color, op) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...p1,...p2,...p3, ...p1,...p3,...p4]), 3));
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent:true, opacity:op, side:THREE.DoubleSide }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 1), new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.7 })));
      grp.add(mesh);
    };
    const line = (p1,p2, color, op) => { const g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...p1,...p2]),3)); grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color, transparent:true, opacity:op}))); };
    const put = (txt,x,y,z,tone,sc) => { const s=makeLabel(THREE,txt,base,tone); if(sc)s.scale.multiplyScalar(sc); s.position.set(x,y,z); grp.add(s); };

    // superfícies
    quad(wlBot, wrBot, [Wc/2,H,zFar], [-Wc/2,H,zFar], accent, 0.32);      // frontal
    if (!simple) quad(lFar, lNear, add(lNear,UP), add(lFar,UP), blue, 0.32);           // lateral E
    if (!simple) quad(rFar, rNear, add(rNear,UP), add(rFar,UP), blue, 0.32);           // lateral D
    quad(flFar, frFar, frNear, flNear, teal, 0.32);                       // piso

    // zonas de projetor: cada projetor entrega no máx. 1920px. Aparece quando precisa de +1.
    // `rows` (opcional): faixas [v0, v1] na ordem de numeração; sem ele, divide por igual.
    const zones = (c00,c10,c11,c01, widthPx, heightPx, rows) => {
      const nc = Math.max(1, Math.ceil((widthPx||0)/1920));   // colunas (1920px)
      const nr = rows ? rows.length : Math.max(1, Math.ceil((heightPx||0)/1080));  // linhas (1080px)
      if (nc < 2 && nr < 2) return;
      const R_ = rows || Array.from({ length: nr }, (_, j) => [j / nr, (j + 1) / nr]);
      let k = 0;
      for (let j=0;j<nr;j++) for (let i=0;i<nc;i++){
        const u0=i/nc,u1=(i+1)/nc,v0=R_[j][0],v1=R_[j][1];
        const a0=bil(c00,c10,c11,c01,u0,v0), a1=bil(c00,c10,c11,c01,u1,v0), t1=bil(c00,c10,c11,c01,u1,v1), t0=bil(c00,c10,c11,c01,u0,v1);
        const g=new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...a0,...a1,...t1, ...a0,...t1,...t0]),3));
        const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:(i+j)%2?0.12:0.035, side:THREE.DoubleSide, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
        m.renderOrder=2; grp.add(m);
        const c=bil(c00,c10,c11,c01,(u0+u1)/2,(v0+v1)/2);
        put(`P${++k}`, c[0],c[1],c[2], "rgba(255,255,255,0.4)", 0.55);
      }
      for (let i=1;i<nc;i++){ const f=i/nc; line(bil(c00,c10,c11,c01,f,0), bil(c00,c10,c11,c01,f,1), 0xffffff, 0.6); }
      R_.forEach(([v0]) => { if (v0 > 0.0001) line(bil(c00,c10,c11,c01,0,v0), bil(c00,c10,c11,c01,1,v0), 0xffffff, 0.6); });
      R_.forEach(([, v1]) => { if (v1 < 0.9999) line(bil(c00,c10,c11,c01,0,v1), bil(c00,c10,c11,c01,1,v1), 0xffffff, 0.6); });
    };
    zones(wlBot, wrBot, [Wc/2,H,zFar], [-Wc/2,H,zFar], r.Wc, r.H);        // frontal
    if (!simple) zones(lFar, lNear, add(lNear,UP), add(lFar,UP), r.Ws, r.H);          // lateral E
    if (!simple) zones(rFar, rNear, add(rNear,UP), add(rFar,UP), r.Ws, r.H);         // lateral D
    // Piso: o primeiro projetor (junto à entrada, v=1) sempre usa 1080px inteiros;
    // os de trás, rumo à parede frontal, ficam com o que sobra (1920 → 1080 + 840).
    const fRowsPx = sdFloorRows(r.fDepth);
    let acc = 0;
    const fRows = fRowsPx.map((h) => { const v1 = 1 - acc / r.fDepth; acc += h; return [Math.max(0, 1 - acc / r.fDepth), v1]; });
    zones(flFar, frFar, frNear, flNear, r.fBase, r.fDepth, fRows);       // piso
    if (fRows.length > 1) fRows.forEach(([v0, v1], j) => {
      const c = bil(flFar, frFar, frNear, flNear, 0.1, (v0 + v1) / 2);
      put(`alt ${sdFmt(fRowsPx[j])}`, c[0], c[1] + 0.01, c[2], "rgba(42,157,143,0.9)", 0.75);
    });

    // margem de proteção: retângulo tracejado a 10% de cada borda das paredes,
    // com a resolução da área segura pinada logo abaixo da linha de cima
    const S0 = SD_SAFE, S1 = 1 - SD_SAFE;
    const safeV = (c00,c10,c11,c01, wpx) => {
      const P = (u, v) => bil(c00,c10,c11,c01,u,v);
      const dashed = (a, b, seg) => { for (let i = 0; i < seg; i += 2) line(P(a[0]+(b[0]-a[0])*i/seg, a[1]+(b[1]-a[1])*i/seg), P(a[0]+(b[0]-a[0])*(i+1)/seg, a[1]+(b[1]-a[1])*(i+1)/seg), SD_SAFE_3D, 0.95); };
      dashed([S0,S0],[S0,S1],16); dashed([S1,S0],[S1,S1],16);
      dashed([S0,S0],[S1,S0],22); dashed([S0,S1],[S1,S1],22);
      if (wpx) { const c = P(0.5, S1 - 0.07); put(`seg ${sdSafeTxt(wpx)}`, c[0],c[1],c[2], "rgba(255,181,71,0.85)", 0.6); }
    };
    safeV(wlBot, wrBot, [Wc/2,H,zFar], [-Wc/2,H,zFar], r.Wc);
    if (!simple) safeV(lFar, lNear, add(lNear,UP), add(lFar,UP), r.Ws);
    if (!simple) safeV(rFar, rNear, add(rNear,UP), add(rFar,UP), r.Ws);

    // vídeo testado: a imagem de teste nas telas frontais, esticada como no preview.
    // A faixa frontal desdobrada vai da entrada da lateral E até a entrada da lateral D.
    if (r.fit) {
      const F = (simple ? 0 : 2 * (r.Ws || 0)) + (r.Wc || 1920);
      const tex = fitTexture(THREE, r.fit, F, r.H || 1080);
      const wall = (bl, br, u0, u1) => {
        const tl = add(bl, UP), tr = add(br, UP);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...bl, ...br, ...tr, ...bl, ...tr, ...tl]), 3));
        g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([u0,0, u1,0, u1,1, u0,0, u1,1, u0,1]), 2));
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        m.renderOrder = 3; grp.add(m);
      };
      const uE = simple ? 0 : (r.Ws || 0) / F, uC = uE + (r.Wc || 1920) / F;
      if (!simple) wall(lNear, lFar, 0, uE);
      wall(wlBot, wrBot, uE, uC);
      if (!simple) wall(rFar, rNear, uC, 1);
      put(`vídeo ${sdFmt(r.fit.vw)} × ${sdFmt(r.fit.vh)}${Math.abs(r.fit.st) > 0.0005 ? ` · ${r.fit.st > 0 ? "esticado +" : "comprimido −"}${sdPct(Math.abs(r.fit.st))}` : ""}`, 0, H * 0.12, zFar + 0.02,
          r.fit.ok ? "rgba(168,85,247,0.9)" : "rgba(255,77,77,0.9)", 0.62);
    }

    // etiquetas de aresta (discretas)
    if (r.Wc)     put(`larg ${sdFmt(r.Wc)}`, 0, H, zFar);
    if (r.H)      put(`alt ${sdFmt(r.H)}`, -Wc/2, H/2, zFar);
    if (r.Ws && !simple) put(`larg ${sdFmt(r.Ws)}`, (lFar[0]+lNear[0])/2, H, (lFar[2]+lNear[2])/2);
    if (r.Ws && !simple) put(`larg ${sdFmt(r.Ws)}`, (rFar[0]+rNear[0])/2, H, (rFar[2]+rNear[2])/2);
    // a projeção frontal inteira e a proporção dela, sempre à vista
    { const F = (simple ? 0 : 2 * (r.Ws || 0)) + (r.Wc || 1920);
      put(`${simple ? "tela" : "frontal"} ${sdFmt(F)} × ${sdFmt(r.H || 1080)} · ${sdRatio(F, r.H || 1080)}`, 0, H * 1.2, zFar, "rgba(94,200,242,0.7)"); }
    if (r.fBase)  put(`base ${sdFmt(r.fBase)}`, 0, 0.01, zNear);
    if (r.fDepth) put(`prof ${sdFmt(r.fDepth)}`, fBase*0.30, 0.01, midZ);

    // contorno pontilhado do "vídeo cheio" quando o piso é trapézio (execução usa máscara)
    if (r.fBase !== r.fTop) {
      const w2 = Math.max(fBase, fTop)/2, dash=(p1,p2)=>{ const seg=16; for(let i=0;i<seg;i+=2){ line(add(mul(sub(p2,p1),i/seg),p1), add(mul(sub(p2,p1),(i+1)/seg),p1), 0xffffff, 0.55); } };
      const c1=[-w2,0.006,zFar], c2=[w2,0.006,zFar], c3=[w2,0.006,zNear], c4=[-w2,0.006,zNear];
      dash(c1,c2); dash(c2,c3); dash(c3,c4); dash(c4,c1);
    }

    frame(["r", r.Wc, simple ? 0 : r.Ws, r.fBase, r.fTop, r.fDepth].join(), 0, H/2, midZ, base*2.1 + 1.5);
  }

  /* Sala semicircular: uma tela só, curvada num arco de `theta` rad. A largura do
     vídeo (px) é o comprimento do arco; o raio sai de arco / ângulo. Cada projetor
     vira uma faixa sobre a curva; onde duas faixas se cruzam fica o blend. */
  function buildCurve(THREE, grp, r) {
    const t = three.current;
    const W = 0.0016;
    const H = SD_MAX_H * W, Lw = (r.Wpx || 1920) * W;
    const th = Math.max(0.05, Math.min(2 * Math.PI, r.theta || Math.PI));
    const R = Lw / th;
    const base = Math.max(Lw * 0.75, H * 2.4);
    const accent = 0x5EC8F2;
    const pt = (u, y, k = 1) => { const f = -th / 2 + u * th; return [R * k * Math.sin(f), y, -R * k * Math.cos(f)]; };
    const segs = (u0, u1) => Math.max(2, Math.ceil(Math.max(24, th * 40) * (u1 - u0)));

    const strip = (u0, u1, y0, y1, mat, order, k = 1) => {
      const n = segs(u0, u1), arr = [];
      for (let i = 0; i < n; i++) {
        const a = u0 + (u1 - u0) * i / n, b = u0 + (u1 - u0) * (i + 1) / n;
        const p00 = pt(a, y0, k), p10 = pt(b, y0, k), p11 = pt(b, y1, k), p01 = pt(a, y1, k);
        arr.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(arr), 3));
      const m = new THREE.Mesh(g, mat);
      if (order) m.renderOrder = order;
      grp.add(m);
    };
    const poly = (pts, color, op) => {
      const arr = [];
      for (let i = 0; i < pts.length - 1; i++) arr.push(...pts[i], ...pts[i + 1]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(arr), 3));
      grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })));
    };
    const arcPts = (u0, u1, y, k = 1) => { const n = segs(u0, u1), out = []; for (let i = 0; i <= n; i++) out.push(pt(u0 + (u1 - u0) * i / n, y, k)); return out; };
    const put = (txt, p, tone, sc) => { const s = makeLabel(THREE, txt, base, tone); if (sc) s.scale.multiplyScalar(sc); s.position.set(p[0], p[1], p[2]); grp.add(s); };

    // a tela
    strip(0, 1, 0, H, new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    poly(arcPts(0, 1, 0), 0xffffff, 0.7);
    poly(arcPts(0, 1, H), 0xffffff, 0.7);
    poly([pt(0, 0), pt(0, H)], 0xffffff, 0.7);
    poly([pt(1, 0), pt(1, H)], 0xffffff, 0.7);
    // corda no chão (abertura da sala), pontilhada
    const c0 = pt(0, 0.004), c1 = pt(1, 0.004);
    for (let i = 0; i < 24; i += 2) {
      const f0 = i / 24, f1 = (i + 1) / 24;
      poly([[c0[0] + (c1[0] - c0[0]) * f0, 0.004, c0[2] + (c1[2] - c0[2]) * f0], [c0[0] + (c1[0] - c0[0]) * f1, 0.004, c0[2] + (c1[2] - c0[2]) * f1]], 0xffffff, 0.35);
    }

    // margem de proteção: tracejado a 10% de cada borda (pontas, topo e base)
    const S0 = SD_SAFE, S1 = 1 - SD_SAFE;
    [S0, S1].forEach((u) => {
      for (let i = Math.round(S0 * 20); i < Math.round(S1 * 20); i += 2) poly([pt(u, H * i / 20, 0.998), pt(u, H * (i + 1) / 20, 0.998)], SD_SAFE_3D, 0.95);
    });
    [S0, S1].forEach((v) => {
      const seg = Math.max(20, Math.round(th * 16)) * 2;
      for (let i = 0; i < seg; i += 2) poly([pt(S0 + (S1 - S0) * i / seg, H * v, 0.998), pt(S0 + (S1 - S0) * (i + 1) / seg, H * v, 0.998)], SD_SAFE_3D, 0.95);
    });
    put(`área segura ${sdSafeTxt(r.Wpx)}`, pt(0.5, H * (S1 - 0.08), 0.97), "rgba(255,181,71,0.85)", 0.75);

    // projetores: o corte dos 1920px aparece em vermelho só onde ele sobra de
    // fato — nas duas pontas da curva, um pouco atrás da tela (raio maior). Entre
    // projetores não há nada: as faixas encostam. Na frente, a faixa que cada
    // projetor usa, com a resolução dela.
    const projs = r.projs || [];
    const pw = r.pw || 1920, cut = r.cut || 0;
    if (cut > 0.5) {
      const K = 1.018, cu = cut / r.Wpx;
      [[-cu, 0], [1, 1 + cu]].forEach(([a, b]) => {
        strip(a, b, 0, H, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }), 1, K);
        poly(arcPts(a, b, 0, K), 0xff4d4d, 0.75);
        poly(arcPts(a, b, H, K), 0xff4d4d, 0.75);
      });
      poly([pt(-cu, 0, K), pt(-cu, H, K)], 0xff4d4d, 0.75);
      poly([pt(1 + cu, 0, K), pt(1 + cu, H, K)], 0xff4d4d, 0.75);
      // quanto falta de cada projetor: a borda cortada e a conta 1920 − usado
      [-cu / 2, 1 + cu / 2].forEach((u) => {
        put(`−${sdFmt(cut)} px`, pt(u, H * 0.56, K * 1.01), "rgba(255,77,77,0.9)", 0.62);
        put(`1920 − ${sdFmt(pw)} = ${sdFmt(1920 - pw)} px`, pt(u, H * 0.42, K * 1.01), "rgba(255,77,77,0.6)", 0.45);
      });
    }
    projs.forEach((x, i) => {
      const u0 = Math.max(0, x / r.Wpx), u1 = Math.min(1, (x + pw) / r.Wpx);
      if (projs.length > 1) {
        strip(u0, u1, 0, H, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: i % 2 ? 0.1 : 0.05, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 2);
        if (u0 > 0) poly([pt(u0, 0, 0.999), pt(u0, H, 0.999)], 0xffffff, 0.6);
        if (u1 < 1) poly([pt(u1, 0, 0.999), pt(u1, H, 0.999)], 0xffffff, 0.6);
      }
      put(`P${i + 1} · ${sdFmt(Math.min(pw, r.Wpx))} × ${sdFmt(SD_MAX_H)}`, pt((u0 + u1) / 2, H / 2, 0.97), "rgba(255,255,255,0.45)", 0.8);
    });
    // overlap: a faixa onde duas fatias vizinhas se misturam (blend), em âmbar
    if (projs.length > 1 && (r.ov || 0) > 0.5) projs.slice(1).forEach((x) => {
      const u0 = x / r.Wpx, u1 = Math.min(1, (x + r.ov) / r.Wpx);
      strip(u0, u1, 0, H, new THREE.MeshBasicMaterial({ color: 0xffcf9e, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 4, 0.997);
      put(`overlap ${sdFmt(r.ov)} px`, pt((u0 + u1) / 2, H * 0.86, 0.96), "rgba(255,207,158,0.9)", 0.55);
    });
    // vídeo testado: onde ele cai na curva, em roxo, um pouco à frente da tela
    if (r.bleed) {
      const e = r.bleed / 2, K = 1.03, y0 = -H * e, y1 = H * (1 + e), dash = (A, n) => { for (let i = 0; i < n; i += 2) poly([A(i / n), A((i + 1) / n)], SD_ORANGE_3D, 0.95); };
      dash((f) => pt(-e + (1 + 2 * e) * f, y0, K), 48);
      dash((f) => pt(-e + (1 + 2 * e) * f, y1, K), 48);
      dash((f) => pt(-e, y0 + (y1 - y0) * f, K), 12);
      dash((f) => pt(1 + e, y0 + (y1 - y0) * f, K), 12);
      put(`sangria ${sdFmt(Math.round(r.Wpx * (1 + r.bleed)))} × ${sdFmt(Math.round(SD_MAX_H * (1 + r.bleed)))}`, pt(0.5, y0 - H * 0.08, K), "rgba(255,122,26,0.9)", 0.6);
    }
    if (r.fit) {
      const K = 0.985, col = r.fit.ok ? SD_PURPLE_3D : 0xff4d4d;
      const a = Math.max(0, r.fit.a), b = Math.min(1, r.fit.b);        // o que cai dentro da tela
      // a imagem de teste sobre a curva, esticada como no preview
      { const tex = fitTexture(THREE, r.fit, r.Wpx, SD_MAX_H), n = segs(0, 1), pos = [], uv = [];
        for (let i = 0; i < n; i++) {
          const u0 = i / n, u1 = (i + 1) / n, p00 = pt(u0, 0, K), p10 = pt(u1, 0, K), p11 = pt(u1, H, K), p01 = pt(u0, H, K);
          pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
          uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
        g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false }));
        m.renderOrder = 3; grp.add(m); }
      [0, H].forEach((y) => { const seg = 40; for (let i = 0; i < seg; i += 2) poly([pt(a + (b - a) * i / seg, y, K), pt(a + (b - a) * (i + 1) / seg, y, K)], col, 0.95); });
      [a, b].forEach((u) => { for (let i = 0; i < 12; i += 2) poly([pt(u, H * i / 12, K), pt(u, H * (i + 1) / 12, K)], col, 0.95); });
      put(`vídeo ${sdFmt(r.fit.vw)} × ${sdFmt(r.fit.vh)}${Math.abs(r.fit.st) > 0.0005 ? ` · ${r.fit.st > 0 ? "esticado +" : "comprimido −"}${sdPct(Math.abs(r.fit.st))}` : ""}${r.fit.ok ? "" : " · não compatível"}`, pt((a + b) / 2, H * 0.1, K), r.fit.ok ? "rgba(168,85,247,0.9)" : "rgba(255,77,77,0.9)", 0.6);
    }
    put(`${sdFmt(r.Wpx)} × ${sdFmt(SD_MAX_H)} · ${sdRatio(r.Wpx, SD_MAX_H)}`, pt(0.5, H * 1.08, 1), "rgba(94,200,242,0.7)");
    put(`R ${String(Math.round((r.radiusM || 0) * 100) / 100).replace(".", ",")} m`, [0, 0.01, 0], "rgba(255,255,255,0.3)", 0.7);

    // centro do enquadramento: meio entre a curva e a corda
    const midZ = -R * (th >= Math.PI ? 0.5 : (1 + Math.cos(th / 2)) / 2);
    frame(["c", r.Wpx, th].join(), 0, H / 2, midZ, Math.max(R * 2.6, Lw * 0.55, H * 3) + 1);
  }

  return (
    <div className="sd-3dwrap">
      <div ref={mountRef} className="sd-3dcanvas" />
      {!ready && !err && <div className="sd-3dmsg">carregando 3D…</div>}
      {err && <div className="sd-3dmsg">não foi possível carregar o 3D (sem conexão?)</div>}
      <div className="sd-3dhint">arraste para girar · scroll = zoom</div>
    </div>
  );
};

/* Uma tela aberta: largura (topo) + altura & proporção (lateral) + input abaixo. */
const SDScreen = ({ lbl, wpx, hpx, dispW, dispH, accent, dimLabel, un = "m", inputEl }) => (
  <div className="sd-cell">
    <div className={`sd-screen ${accent ? "sd-screen-c" : ""}`} style={{ width: dispW, height: dispH }}>
      <span className="sd-screen-lbl">{lbl}</span>
      <div className="sd-safe" />
    </div>
    <div className="sd-cellin"><span className="sd-cellin-lbl">{dimLabel} <em>({sdUnitLbl(un)})</em></span>{inputEl}</div>
    <div className="sd-res"><b>{sdFmt(wpx)} × {sdFmt(hpx)} px</b><span className="sd-res-r">{sdRatio(wpx, hpx)}</span></div>
  </div>
);

const SDIn = ({ value, onChange, placeholder, un = "m" }) => (
  <span className={`sd-input-wrap ${un === "prop" ? "sd-input-p" : ""}`}>
    {un === "prop"
      ? <input type="text" inputMode="text" value={value} placeholder={placeholder || "16:9"} onChange={(e) => onChange(e.target.value)} />
      : <input type="number" min="0" step={un === "px" ? "1" : "0.01"} inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    <b>{un === "prop" ? "∶" : un}</b>
  </span>
);

/* Timeline da sala retangular em miniatura: as três paredes em cima, o chão
   centrado embaixo da central, e o vídeo testado por cima em roxo — só na
   faixa das paredes (o chão fica de fora do teste). */
const SDTimelineFit = ({ R, fit }) => {
  const TW = R.timelineW, TH = R.timelineH;
  const box = Math.max(TW, fit.dw);
  const k = Math.min(340 / box, 150 / TH);
  const ox = (box - TW) / 2 * k;                 // timeline centrada quando o vídeo é mais largo
  const fx = (TW - R.frontTotalW) / 2;
  const fW = Math.max(R.fBase, R.fTop);
  const parts = [
    ["E", fx, 0, R.Ws, R.H], ["Central", fx + R.Ws, 0, R.Wc, R.H], ["D", fx + R.Ws + R.Wc, 0, R.Ws, R.H],
    ["Chão", fx + R.Ws + (R.Wc - fW) / 2, R.H, fW, R.fDepth],
  ].filter((p) => p[3] > 0);
  return (
    <div className="sd-tlfit" style={{ width: box * k, height: TH * k }}>
      <div className="sd-tl" style={{ left: ox, width: TW * k, height: TH * k }}>
        {parts.map(([n, x, y, w, h]) => (
          <div key={n} className={`sd-tl-p ${n === "Chão" ? "f" : n === "Central" ? "c" : ""}`} style={{ left: x * k, top: y * k, width: w * k, height: h * k }}><span>{n}</span></div>
        ))}
      </div>
      <div className={`sd-vbox ${fit.ok ? "" : "bad"}`} style={{ left: (box - fit.dw) / 2 * k, width: fit.dw * k, top: 0, bottom: "auto", height: R.H * k }}><span>vídeo {sdFmt(fit.vw)} × {sdFmt(fit.vh)}</span></div>
    </div>
  );
};

const SDTimelineBleed = ({ R, f }) => {
  const TW = R.timelineW, TH = R.timelineH, k = Math.min(310 / (TW * (1 + f)), 136 / (TH * (1 + f)));
  const fx = (TW - R.frontTotalW) / 2, fW = Math.max(R.fBase, R.fTop);
  const parts = [
    ["E", fx, 0, R.Ws, R.H], ["Central", fx + R.Ws, 0, R.Wc, R.H], ["D", fx + R.Ws + R.Wc, 0, R.Ws, R.H],
    ["Chão", fx + R.Ws + (R.Wc - fW) / 2, R.H, fW, R.fDepth],
  ].filter((p) => p[3] > 0);
  return (
    <div className="sd-tlfit" style={{ width: TW * k * (1 + f), height: TH * k * (1 + f) }}>
      <div className="sd-tl" style={{ left: TW * k * f / 2, top: TH * k * f / 2, width: TW * k, height: TH * k }}>
        {parts.map(([n, x, y, w, h]) => (
          <div key={n} className={`sd-tl-p ${n === "Chão" ? "f" : n === "Central" ? "c" : ""}`} style={{ left: x * k, top: y * k, width: w * k, height: h * k }}><span>{n}</span></div>
        ))}
      </div>
      <div className="sd-bbox" style={{ left: 0, top: 0, right: 0, bottom: 0 }} />
    </div>
  );
};

/* ─────────────────────── Sala retangular (3 paredes + chão) ──────────────────── */
const SDRectMode = ({ sheetRef, preview3dRef, docRef, initial = {}, view }) => {
  const [A, setA] = React.useState(initial.A ?? "3");        // altura / pé-direito (m) — escala (já vem preenchida)
  const [L, setL] = React.useState(initial.L ?? "");        // largura frontal
  const [P, setP] = React.useState(initial.P ?? "");        // profundidade das laterais
  const [fBaseM, setFBaseM] = React.useState(initial.fBaseM ?? ""); // chão: base
  const [fDepM,  setFDepM]  = React.useState(initial.fDepM ?? "");  // chão: profundidade própria
  const [Un, setUnS] = React.useState(initial.Un === "px" || initial.Un === "prop" ? initial.Un : "m");   // unidade das medidas acima
  const [Ss, setSs] = React.useState(!!initial.Ss);            // sala simples: sem as telas laterais
  const [Vw, setVw] = React.useState(initial.Vw ?? "");     // vídeo a testar (px)
  const [Vh, setVh] = React.useState(initial.Vh ?? "");
  const [St, setSt] = React.useState(initial.St ?? "");     // esticamento do vídeo testado (%)
  const [Sg, setSg] = React.useState(!!initial.Sg);            // margem extra de sangria (liga/desliga)
  const [SgP, setSgP] = React.useState(initial.Sg || "10");    // quantos % a mais
  const sgRaw = Sg ? String(sdBleedPct(SgP)) : "";
  const raw = { A, L, P, fBaseM, fDepM, Vw, Vh, St, Sg: sgRaw, Un: Un === "m" ? "" : Un, Ss: Ss ? "1" : "" };
  React.useEffect(() => sdSyncUrl("rect", raw), [A, L, P, fBaseM, fDepM, Vw, Vh, St, sgRaw, Un, Ss]);
  // topo do chão = largura da tela central (sempre travados) → usa L
  const a = sdNum(A) || 3;                      // altura sempre tem valor (padrão 3) — nunca congela
  const ready = !!sdNum(A);                     // só pra saber se o usuário já digitou
  const len = (v) => sdLen(v, Un, a);           // o digitado (m, px ou proporção) → metros
  // trocar de unidade converte o que já estava digitado
  const setUn = (u) => { const cv = (v) => sdToUnit(len(v), u, a); setL(cv(L)); setP(cv(P)); setFBaseM(cv(fBaseM)); setFDepM(cv(fDepM)); setUnS(u); };

  // valores resolvidos em metros (faltando → assume 16:9 / iguais às paredes)
  const def16 = a * 16 / 9;
  const lRes  = len(L) || def16;
  const pRes  = Ss ? def16 : (len(P) || def16);    // sala simples: sem laterais, o chão cai no 16:9
  const baseRes = len(fBaseM) || lRes;
  const topRes  = lRes;                      // topo do chão SEMPRE = largura central
  const depRes  = len(fDepM)  || pRes;

  const R = React.useMemo(() => {
    const scale = SD_MAX_H / a;
    const Wc = Math.round(lRes * scale);
    const Ws = Ss ? 0 : Math.round(pRes * scale);          // sala simples: sem telas laterais
    const fTop  = Math.round(topRes * scale);
    // Base na mesma escala das demais medidas: cortar em 1920 px deixava uma
    // base de 5 m quase igual a um topo de 3 m (o chão virava retângulo). Base
    // maior que 1920 px só pede mais um projetor na largura, como nas paredes.
    const fBase = Math.round(baseRes * scale);
    const fDepth = Math.round(depRes * scale);
    const frontTotalW = Ws * 2 + Wc;
    const timelineW = Math.max(frontTotalW, fBase, fTop);
    const timelineH = SD_MAX_H + fDepth;
    return { Wc, Ws, H: SD_MAX_H, fTop, fBase, fDepth, frontTotalW, timelineW, timelineH, scale, simple: Ss, isDefault: false };
  }, [a, lRes, pRes, baseRes, depRes, Ss]);

  // o que vai para a ficha em PDF
  const projCount = (w, h) => Math.max(1, Math.ceil(w / 1920)) * Math.max(1, Math.ceil(h / 1080));
  const nProj = projCount(R.Wc, R.H) + (Ss ? 0 : projCount(R.Ws, R.H) * 2) + projCount(Math.max(R.fBase, R.fTop), R.fDepth);
  const digitado = (v) => (Un === "px" ? `${sdFmt(sdNum(v))} px` : `${String(v).trim()}`);
  const typed = (v, res, hint) => (len(v) ? (Un === "m" ? `${sdM(res)} m` : `${digitado(v)}  ·  ${sdM(res)} m`) : `${sdM(res)} m  ·  ${hint}`);
  // o vídeo testado vai só nas telas frontais (o chão tem conteúdo próprio)
  const fit = sdFit(R.frontTotalW, R.H, Vw, Vh, St);
  const bleed = sdBleed(R.timelineW, R.timelineH, sdBleedPct(SgP));
  const frenteTxt = Ss ? "só a tela central" : `${sdFmt(R.Ws)} + ${sdFmt(R.Wc)} + ${sdFmt(R.Ws)}`;
  docRef.current = {
    mode: "rect", raw,   // o que a ficha salva guarda
    resumo: `timeline ${sdFmt(R.timelineW)} × ${sdFmt(R.timelineH)}  ·  ${nProj} projetores${Ss ? "  ·  sala simples" : ""}`,
    name: `sala-${Ss ? "simples" : "imersiva"}${ready ? `-alt${Math.round(a)}m` : ""}`,
    title: Ss ? "Sala simples" : "Sala retangular",
    subtitle: `${Ss ? "Tela central + chão" : "Três paredes + chão"}  ·  altura ${sdM(a)} m`,
    hero: [
      { lbl: "Timeline total", val: `${sdFmt(R.timelineW)} × ${sdFmt(R.timelineH)}`, unit: "px", sub: `proporção ${sdRatio(R.timelineW, R.timelineH)}` },
      { lbl: "Projeção frontal", val: `${sdFmt(R.frontTotalW)} × ${sdFmt(R.H)}`, unit: "px", sub: `proporção ${sdRatio(R.frontTotalW, R.H)}  ·  ${frenteTxt}` },
      { lbl: "Projetores", val: String(nProj), unit: "× 1920×1080", sub: Ss ? "central + chão, sem blend" : "paredes + chão, sem blend" },
    ],
    inputs: [
      ["Altura das paredes", `${sdM(a)} m`],
      ["Largura central", typed(L, lRes, "padrão 16:9")],
      ...(Ss ? [["Telas laterais", "desativadas  ·  sala simples"]] : [["Profundidade das laterais", typed(P, pRes, "padrão 16:9")]]),
      ["Chão · base", typed(fBaseM, baseRes, "= largura")],
      ["Chão · topo", `${sdM(lRes)} m  ·  = largura`],
      ["Chão · profundidade", typed(fDepM, depRes, Ss ? "padrão 16:9" : "= laterais")],
    ],
    details: [
      ["Tela central", `${sdFmt(R.Wc)} × ${sdFmt(R.H)} px`, sdRatio(R.Wc, R.H)],
      ...(Ss ? [] : [["Telas laterais (cada)", `${sdFmt(R.Ws)} × ${sdFmt(R.H)} px`, sdRatio(R.Ws, R.H)]]),
      ["Chão", `${sdFmt(Math.max(R.fBase, R.fTop))} × ${sdFmt(R.fDepth)} px`, sdFloorRows(R.fDepth).length > 1 ? `faixas ${sdFloorRows(R.fDepth).map(sdFmt).join(" + ")}` : (R.fBase !== R.fTop ? "com máscara" : sdRatio(R.fBase, R.fDepth))],
      ["Área segura · central", `${sdSafeTxt(R.Wc, R.H)} px`, "margem de 10%"],
      ...(Ss ? [] : [["Área segura · laterais", `${sdSafeTxt(R.Ws, R.H)} px`, "margem de 10%"]]),
      ["Escala", `${R.scale.toFixed(1)} px/m`, "altura → 1080 px"],
      ...(fit ? [["Vídeo testado", `${sdFmt(fit.vw)} × ${sdFmt(fit.vh)} px`, `${Math.abs(fit.st) > 0.0005 ? `${fit.st > 0 ? "esticado +" : "comprimido −"}${sdPct(Math.abs(fit.st))}  ·  ` : ""}${fit.ok ? "compatível" : "não compatível"}`]] : []),
      ...(Sg ? [[`Sangria (+${sdPct(bleed.f)})`, `${sdFmt(bleed.bw)} × ${sdFmt(bleed.bh)} px`, "timeline com borda extra"]] : []),
    ],
    diagram: <SDPdfRectDiagram R={R} />,
    diagramTitle: "Mapa das telas planificadas",
  };

  // escala do diagrama pra caber na coluna
  const [diagW, setDiagW] = React.useState(680);
  const diagRef = React.useRef(null);
  React.useEffect(() => {
    const onR = () => diagRef.current && setDiagW(diagRef.current.clientWidth);
    onR(); window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const maxRowPx = Math.max(R.frontTotalW, R.fBase, R.fTop, 1);
  const disp = Math.min(112 / SD_MAX_H, (Math.max(diagW, 280) - 26) / maxRowPx);
  const floorMax = Math.max(R.fBase, R.fTop) || 1;
  const floorClip = (() => {
    const mx = floorMax;
    const tL = ((mx - R.fTop) / 2 / mx) * 100, tR = 100 - tL;
    const bL = ((mx - R.fBase) / 2 / mx) * 100, bR = 100 - bL;
    return `polygon(${tL}% 0, ${tR}% 0, ${bR}% 100%, ${bL}% 100%)`;
  })();
  const ph = (m) => (ready ? sdToUnit(m, Un, a) : "");

  return (
      <div ref={sheetRef} className="sd-sheet">
        <div className="sd-main">
          {/* Telas abertas + inputs ao lado de cada tela */}
          <section className="sd-stage" ref={diagRef}>
            <div className="sd-altrow">
              <span className="sd-altrow-lbl">Altura de todas as telas <em>→ vira {SD_MAX_H}px</em></span>
              <span className="sd-input-wrap sd-input-lg"><input type="number" min="0" step="0.01" inputMode="decimal" value={A} placeholder="ex. 3" onChange={(e) => setA(e.target.value)} /><b>m</b></span>
              {!ready && <span className="sd-badge">comece pela altura</span>}
              <div className="sd-altrow-2">
                <span className="sd-altrow-k">Informar as telas em</span><SDUnits un={Un} setUn={setUn} />
                <label className="sd-check" title="Desativa as duas telas laterais: fica só a central e o chão">
                  <input type="checkbox" checked={Ss} onChange={(e) => setSs(e.target.checked)} /><b>Sala simples</b><span>sem as telas laterais</span>
                </label>
              </div>
              {Un !== "m" && <div className="sd-altrow-n">{Un === "px" ? "Pixels: a largura de cada tela, com a altura valendo 1080 px." : "Proporção: largura : altura de cada tela (ex. 16:9 ou 1,78)."} A altura em metros acima só serve para as medidas em metros da ficha.</div>}
            </div>
            <SDProp items={[[Ss ? "Proporção da tela" : "Proporção da projeção frontal", R.frontTotalW, R.H], ["Proporção da timeline", R.timelineW, R.timelineH]]} />
            <div className="sd-wallrow">
              {!Ss && <SDScreen lbl="Lateral E" wpx={R.Ws} hpx={R.H} dispW={R.Ws * disp} dispH={R.H * disp} un={Un}
                        dimLabel="Profundidade" inputEl={<SDIn un={Un} value={P} onChange={setP} placeholder="prof." />} />}
              <SDScreen lbl="Central" wpx={R.Wc} hpx={R.H} dispW={R.Wc * disp} dispH={R.H * disp} accent un={Un}
                        dimLabel="Largura" inputEl={<SDIn un={Un} value={L} onChange={setL} placeholder="larg." />} />
              {!Ss && <SDScreen lbl="Lateral D" wpx={R.Ws} hpx={R.H} dispW={R.Ws * disp} dispH={R.H * disp} un={Un}
                        dimLabel="Profundidade" inputEl={<SDIn un={Un} value={P} onChange={setP} placeholder="prof." />} />}
            </div>

            {/* Chão — trapézio com medidas próprias */}
            <div className="sd-cell sd-cell-floor">
              <div className={`sd-floorbox ${R.fBase !== R.fTop ? "trap" : ""}`} style={{ width: floorMax * disp, height: R.fDepth * disp }}>
                <div className="sd-floor" style={{ clipPath: floorClip, WebkitClipPath: floorClip }}>
                  <span className="sd-screen-lbl">Chão</span>
                </div>
                {R.fBase !== R.fTop && <span className="sd-masknote">vídeo {sdFmt(floorMax)}×{sdFmt(R.fDepth)} · máscara</span>}
              </div>
              <div className="sd-cellin sd-cellin-floor">
                <span className="sd-cellin-lbl">Base <em>({sdUnitLbl(Un)})</em></span><SDIn un={Un} value={fBaseM} onChange={setFBaseM} placeholder={ph(lRes) || "base"} />
                <span className="sd-cellin-lbl">Topo <em>🔒 = largura</em></span><SDIn un={Un} value={L} onChange={setL} placeholder={ph(lRes) || "topo"} />
                <span className="sd-cellin-lbl">Prof. <em>({sdUnitLbl(Un)})</em></span><SDIn un={Un} value={fDepM} onChange={setFDepM} placeholder={ph(pRes) || "prof."} />
              </div>
              <div className="sd-res"><b>{sdFmt(R.fBase)} × {sdFmt(R.fDepth)} px</b><span className="sd-res-r">{sdRatio(R.fBase, R.fDepth)}</span>
                <span className="sd-res2">base {sdFmt(R.fBase)} · topo {sdFmt(R.fTop)}</span></div>
            </div>
            <div className="sd-safekey"><i />margem de proteção · 10% de cada borda — concentre textos e conteúdo dentro do tracejado</div>
            <SDVideoTest vw={Vw} vh={Vh} setVw={setVw} setVh={setVh} st={St} setSt={setSt} fit={fit} areaLbl={`${Ss ? "tela central" : "projeção frontal"} de ${sdFmt(R.frontTotalW)} × ${sdFmt(R.H)} px (${sdRatio(R.frontTotalW, R.H)}, sem o chão)`}>
              {fit && <SDTimelineFit R={R} fit={fit} />}
            </SDVideoTest>
            <SDBleed on={Sg} setOn={setSg} pct={SgP} setPct={setSgP} bleed={bleed} areaLbl="timeline">
              <SDTimelineBleed R={R} f={bleed.f} />
            </SDBleed>
            {ready && (R.Wc > 1920 || R.Ws > 1920) && <div className="sd-note warn">Alguma parede passou de 1920px — precisará de mais de um projetor por parede.</div>}
          </section>

          {/* Preview 3D com resoluções acompanhando a rotação */}
          <section className="sd-3dsection" ref={preview3dRef} data-html2canvas-ignore="true">
            <div className="sd-3dtitle">Preview 3D — resoluções acompanham a rotação</div>
            <SDPreview3D initView={view} res={{ Wc: R.Wc, Ws: R.Ws, H: R.H, fBase: R.fBase, fTop: R.fTop, fDepth: R.fDepth, simple: Ss, front: R.frontTotalW,
                                              fit: fit ? { a: fit.a, b: fit.b, vw: fit.vw, vh: fit.vh, ok: fit.ok, st: fit.st } : null }} />
          </section>
        </div>

        {/* Indicadores (seguem o cálculo ao vivo) */}
        <section className="sd-indicators">
          <div className="sd-ind"><div className="sd-ind-lbl">Tela do meio</div><div className="sd-ind-val">{sdFmt(R.Wc)}×{sdFmt(R.H)}</div><div className="sd-ind-sub">central · proporção {sdRatio(R.Wc, R.H)}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Telas laterais</div><div className="sd-ind-val">{Ss ? "—" : `${sdFmt(R.Ws)}×${sdFmt(R.H)}`}</div><div className="sd-ind-sub">{Ss ? "desativadas · sala simples" : `cada uma (as duas iguais) · proporção ${sdRatio(R.Ws, R.H)}`}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Projeção frontal completa</div><div className="sd-ind-val">{sdFmt(R.frontTotalW)}×{sdFmt(R.H)}</div><div className="sd-ind-sub">proporção {sdRatio(R.frontTotalW, R.H)} · {frenteTxt}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Chão</div><div className="sd-ind-val">{sdFmt(R.fBase)}×{sdFmt(R.fDepth)}</div><div className="sd-ind-sub">base {sdFmt(R.fBase)} · topo {sdFmt(R.fTop)} · {sdRatio(R.fBase, R.fDepth)}</div>{sdFloorRows(R.fDepth).length > 1 && <div className="sd-ind-sub">projetores na prof.: {sdFloorRows(R.fDepth).map(sdFmt).join(" + ")}</div>}</div>
          <div className="sd-ind sd-ind-safe"><div className="sd-ind-lbl">Área segura (margem 10%)</div><div className="sd-ind-val">{sdSafeTxt(R.Wc, R.H).replace(/ /g, "")}</div><div className="sd-ind-sub">central{Ss ? "" : ` · laterais ${sdSafeTxt(R.Ws, R.H)}`}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Total (Timeline)</div><div className="sd-ind-val">{sdFmt(R.timelineW)}×{sdFmt(R.timelineH)}</div><div className="sd-ind-sub">proporção {sdRatio(R.timelineW, R.timelineH)} · {ready ? `escala ${R.scale.toFixed(1)} px/m` : "padrão"}</div></div>
        </section>
      </div>
  );
};

/* ─────────────────────── Sala semicircular (uma tela curva) ──────────────────── */
/* A tela é uma faixa só, curvada. Altura → 1080px (escala = 1080 / altura); o
   comprimento medido AO LONGO da curva vira a largura do vídeo. Cada projetor
   entrega 1920×1080 com a altura travada, então cobre 1920px de largura; o
   número de projetores sai do quanto precisa enfileirar para cobrir o arco.
   Overlap (%): as fatias vizinhas se cruzam e se misturam (blend) — a largura do
   vídeo diminui exatamente essa porcentagem (10% numa tela de 3.840 = 384 px a
   menos → 3.456), repartida por igual entre as junções. O número de projetores
   continua o da tela sem overlap. O ângulo só entra na geometria (raio,
   abertura, 3D) — não muda o vídeo. */
const sdM = (n) => (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SDCurveMode = ({ sheetRef, preview3dRef, docRef, initial = {}, view }) => {
  const [A, setA]     = React.useState(initial.A ?? "3");      // altura da tela (m)
  const [C, setC]     = React.useState(initial.C ?? "");       // comprimento ao longo da curva (m)
  const [Ang, setAng] = React.useState(initial.Ang ?? "180");  // ângulo do arco (°)
  const [Bl, setBl]   = React.useState(initial.Bl ?? "0");     // overlap: blend entre as fatias do vídeo (% da largura)
  const [Un, setUnS]  = React.useState(initial.Un === "px" || initial.Un === "prop" ? initial.Un : "m");   // unidade do comprimento
  const [Vw, setVw]   = React.useState(initial.Vw ?? "");      // vídeo a testar (px)
  const [Vh, setVh]   = React.useState(initial.Vh ?? "");
  const [St, setSt]   = React.useState(initial.St ?? "");      // esticamento do vídeo testado (%)
  const [Sg, setSg]   = React.useState(!!initial.Sg);           // margem extra de sangria (liga/desliga)
  const [SgP, setSgP] = React.useState(initial.Sg || "10");     // quantos % a mais
  const sgRaw = Sg ? String(sdBleedPct(SgP)) : "";
  const raw = { A, C, Ang, Bl, Vw, Vh, St, Sg: sgRaw, Un: Un === "m" ? "" : Un };
  React.useEffect(() => sdSyncUrl("curve", raw), [A, C, Ang, Bl, Vw, Vh, St, sgRaw, Un]);

  const a = sdNum(A) || 3;
  const cM = sdLen(C, Un, a);                    // comprimento da curva em metros (digitado em m, px ou proporção)
  const setUn = (u) => { setC(sdToUnit(cM, u, a)); setUnS(u); };
  const ready = !!sdNum(A) && !!cM;
  const arc = cM || a * 32 / 9;                  // sem comprimento: duas telas 16:9
  const angDeg = Math.min(360, sdNum(Ang) || 180);
  const blendAsk = Math.max(0, parseFloat(String(Bl).replace(",", ".")) || 0);   // o % digitado (aberto)

  const R = React.useMemo(() => {
    const scale = SD_MAX_H / a;
    const Wn = Math.round(arc * scale);          // largura "natural": a tela sem overlap nenhum
    const N = Math.max(1, Math.ceil(Wn / 1920 - 0.004)); // projetores lado a lado (uns pixels de arredondamento não pedem mais um)
    // Cada projetor pega a mesma fatia da tela (pw). O que sobra dos 1920px dele
    // é cortado por igual nas duas bordas — altura sempre 1080.
    const pw = Math.min(1920, Wn / N);
    const cut = Math.max(0, (1920 - pw) / 2);
    // Overlap: as fatias se cruzam; o vídeo encolhe `blend`% da largura natural.
    // Limite da geometria: uma fatia não pode cruzar mais que a metade da vizinha.
    const maxBlend = N > 1 ? (N - 1) / N * 50 : 0;
    const blend = Math.min(blendAsk, maxBlend);
    const less = N > 1 ? Math.round(Wn * blend / 100) : 0;     // px a menos na largura
    const Wpx = Wn - less;                       // o vídeo a produzir
    const ov = N > 1 ? less / (N - 1) : 0;       // largura da faixa de blend em cada junção
    const projs = Array.from({ length: N }, (_, i) => i * (pw - ov));
    const theta = angDeg * Math.PI / 180;
    const radiusM = arc / theta;
    const chordM = angDeg >= 360 ? 0 : 2 * radiusM * Math.sin(theta / 2);
    const depthM = radiusM * (1 - Math.cos(theta / 2));   // da abertura até o fundo da curva
    return { scale, Wn, Wpx, N, ov, less, blend, maxBlend, pw, cut, projs, theta, radiusM, chordM, depthM, projM: pw / scale };
  }, [a, arc, angDeg, blendAsk]);
  const blend = R.blend;
  const fit = sdFit(R.Wpx, SD_MAX_H, Vw, Vh, St);   // vídeo testado contra a tela inteira
  const bleed = sdBleed(R.Wpx, SD_MAX_H, sdBleedPct(SgP));

  const [diagW, setDiagW] = React.useState(680);
  const diagRef = React.useRef(null);
  React.useEffect(() => {
    const onR = () => diagRef.current && setDiagW(diagRef.current.clientWidth);
    onR(); window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  // cabe a tela + o quadro vermelho que passa das pontas (o corte das bordas)
  const disp = Math.min(150 / SD_MAX_H, (Math.max(diagW, 280) - 40) / Math.max(R.Wpx + 2 * R.cut, 1920));
  docRef.current = {
    mode: "curve", raw,   // o que a ficha salva guarda
    resumo: `vídeo ${sdFmt(R.Wpx)} × ${sdFmt(SD_MAX_H)}  ·  ${R.N} projetor${R.N > 1 ? "es" : ""}`,
    name: `sala-semicircular${ready ? `-${sdM(arc).replace(",", "_")}x${sdM(a).replace(",", "_")}m` : ""}`,
    title: "Sala semicircular",
    subtitle: `Tela única curva  ·  ${sdM(arc)} m de curva × ${sdM(a)} m de altura`,
    hero: [
      { lbl: "Vídeo a produzir", val: `${sdFmt(R.Wpx)} × ${sdFmt(SD_MAX_H)}`, unit: "px", sub: R.less ? `com overlap de ${sdPct(blend / 100)}  ·  sem ele seria ${sdFmt(R.Wn)}` : `escala ${R.scale.toFixed(1)} px/m` },
      { lbl: "Proporção", val: sdRatio(R.Wpx, SD_MAX_H), unit: "", sub: "largura : altura" },
      { lbl: "Projetores", val: String(R.N), unit: "× 1920×1080", sub: R.N > 1 ? `lado a lado, cada um ${sdFmt(R.pw)} × 1.080` : "um só cobre a tela" },
    ],
    inputs: [
      ["Altura da tela", `${sdM(a)} m`],
      ["Comprimento da curva", cM ? (Un === "m" ? `${sdM(arc)} m` : `${Un === "px" ? `${sdFmt(sdNum(C))} px` : String(C).trim()}  ·  ${sdM(arc)} m`) : `${sdM(arc)} m  ·  padrão`],
      ["Ângulo do arco", `${Math.round(angDeg)}°`],
      ["Overlap", `${sdPct(blend / 100)}`],
    ],
    details: [
      ["Cada projetor usa", `${sdFmt(R.pw)} × 1.080 px`, `${sdM(R.projM)} × ${sdM(a)} m`],
      ["Corte por projetor", `${sdFmt(R.cut)} px em cada borda`, "de 1920 px"],
      ["Overlap (blend) por junção", R.ov > 0 ? `${sdFmt(R.ov)} px` : "nenhum", R.ov > 0 ? `${sdFmt(R.less)} px a menos na largura` : "fatias encostadas"],
      ["Proporção", sdRatio(R.Wpx, SD_MAX_H), `${(R.Wpx / SD_MAX_H).toFixed(2).replace(".", ",")}:1`],
      ["Raio da curva", `${sdM(R.radiusM)} m`, R.chordM > 0 ? `abertura ${sdM(R.chordM)} m` : "círculo fechado"],
      ["Área segura", `${sdSafeTxt(R.Wpx)} px`, `${sdM(arc * 0.8)} × ${sdM(a * 0.8)} m`],
      ["Fundo da sala", `${sdM(R.depthM)} m`, "da abertura ao fundo"],
      ...(fit ? [["Vídeo testado", `${sdFmt(fit.vw)} × ${sdFmt(fit.vh)} px`, `${Math.abs(fit.st) > 0.0005 ? `${fit.st > 0 ? "esticado +" : "comprimido −"}${sdPct(Math.abs(fit.st))}  ·  ` : ""}${fit.ok ? "compatível" : "não compatível"}`]] : []),
      ...(Sg ? [[`Sangria (+${sdPct(bleed.f)})`, `${sdFmt(bleed.bw)} × ${sdFmt(bleed.bh)} px`, "conteúdo com borda extra"]] : []),
    ],
    diagram: <SDPdfCurveDiagram R={R} fit={fit} />,
    diagramTitle: "Mapa de projeção",
  };

  const junctions = R.projs.slice(1).map((x, i) => ({ x0: x, x1: R.projs[i] + R.pw })).filter((j) => j.x1 > j.x0);

  // vista de cima: arco em torno do centro, abertura para baixo
  const top = (() => {
    const th = R.theta, n = 64, pts = [];
    for (let i = 0; i <= n; i++) { const f = -th / 2 + th * i / n; pts.push([Math.sin(f), -Math.cos(f)]); }
    const xs = pts.map((p) => p[0]).concat(0), ys = pts.map((p) => p[1]).concat(0);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 0.14, vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
    const path = (u0, u1) => { const m = Math.max(2, Math.ceil(n * (u1 - u0))); let d = ""; for (let i = 0; i <= m; i++) { const f = -th / 2 + th * (u0 + (u1 - u0) * i / m); d += `${i ? "L" : "M"}${Math.sin(f).toFixed(4)},${(-Math.cos(f)).toFixed(4)}`; } return d; };
    return { vb: `${minX - pad} ${minY - pad} ${vw} ${vh}`, path, ratio: vw / vh };
  })();

  return (
    <div ref={sheetRef} className="sd-sheet">
      <div className="sd-main">
        <section className="sd-stage" ref={diagRef}>
          <div className="sd-curvein">
            <div className="sd-curvein-u"><span className="sd-altrow-k">Informar a tela em</span><SDUnits un={Un} setUn={setUn} />
              {Un !== "m" && <span className="sd-altrow-n">{Un === "px" ? "Pixels: a largura da tela, com a altura valendo 1080 px." : "Proporção: largura : altura da tela (ex. 32:9 ou 3,56)."}</span>}</div>
            <label><span className="sd-cellin-lbl">Altura da tela <em>→ vira {SD_MAX_H}px</em></span>
              <span className="sd-input-wrap sd-input-lg"><input type="number" min="0" step="0.01" inputMode="decimal" value={A} placeholder="ex. 4,20" onChange={(e) => setA(e.target.value)} /><b>m</b></span></label>
            <label><span className="sd-cellin-lbl">{Un === "m" ? "Comprimento da curva" : Un === "px" ? "Largura da tela" : "Proporção da tela"} <em>{Un === "m" ? "medido ao longo da tela" : Un === "px" ? "em pixels, sem overlap" : "largura : altura"}</em></span>
              <span className="sd-input-wrap sd-input-lg">{Un === "prop"
                ? <input type="text" inputMode="text" value={C} placeholder="ex. 32:9" onChange={(e) => setC(e.target.value)} />
                : <input type="number" min="0" step={Un === "px" ? "1" : "0.01"} inputMode="decimal" value={C} placeholder={Un === "px" ? "ex. 3840" : "ex. 12,50"} onChange={(e) => setC(e.target.value)} />}<b>{Un === "prop" ? "∶" : Un}</b></span></label>
            <label><span className="sd-cellin-lbl">Ângulo do arco <em>180° = meio círculo</em></span>
              <span className="sd-input-wrap"><input type="number" min="1" max="360" step="1" inputMode="decimal" value={Ang} onChange={(e) => setAng(e.target.value)} /><b>°</b></span></label>
            <label><span className="sd-cellin-lbl">Overlap <em>blend entre as metades do vídeo</em></span>
              <span className="sd-input-wrap"><input type="number" min="0" step="0.5" inputMode="decimal" value={Bl} onChange={(e) => setBl(e.target.value)} /><b>%</b></span></label>
            <div className={`sd-ovinfo ${R.less ? "on" : ""}`}>
              {R.N < 2 ? <>Overlap só existe com dois ou mais projetores — esta tela cabe em um.</>
                : R.less ? <><b>−{sdFmt(R.less)} px</b> na largura: <b>{sdFmt(R.Wn)}</b> → <b>{sdFmt(R.Wpx)} × {sdFmt(SD_MAX_H)}</b> ({sdRatio(R.Wpx, SD_MAX_H)}) · faixa de blend de <b>{sdFmt(R.ov)} px</b> {R.N > 2 ? `em cada uma das ${R.N - 1} junções` : "no meio, entre as duas metades"}{blendAsk > R.maxBlend + 1e-9 ? ` · limitado a ${sdPct(R.maxBlend / 100)} (uma fatia não cruza mais que a metade da vizinha)` : ""}</>
                : <>Sem overlap: as {R.N} fatias encostam uma na outra. Com 10%, a largura cairia para {sdFmt(Math.round(R.Wn * 0.9))} px.</>}
            </div>
          </div>
          {!cM && <span className="sd-badge">{Un === "m" ? "digite o comprimento da curva" : Un === "px" ? "digite a largura da tela" : "digite a proporção da tela"}</span>}
          <SDProp items={[["Proporção da tela", R.Wpx, SD_MAX_H]]} />

          {/* A tela planificada = o vídeo a produzir, com a faixa de cada projetor */}
          <div className="sd-cell">
            <div className="sd-flatwrap" style={{ width: R.Wpx * disp, height: SD_MAX_H * disp }}>
              {/* corte dos projetores: só sobra nas pontas da tela */}
              {R.cut > 0.5 && [`${-R.cut / R.Wpx * 100}%`, "100%"].map((left, i) => (
                <div key={"c" + i} className={`sd-frame ${i ? "r" : "l"}`} style={{ left, width: `${R.cut / R.Wpx * 100}%` }}>
                  <span><b>−{sdFmt(R.cut)} px</b>1920 − {sdFmt(R.pw)} = {sdFmt(1920 - R.pw)}</span>
                </div>
              ))}
              <div className="sd-flat" style={{ width: R.Wpx * disp, height: SD_MAX_H * disp }}>
              <span className="sd-screen-lbl">Tela curva planificada</span>
              <div className="sd-safe"><span>área segura {sdSafeTxt(R.Wpx)}</span></div>
              {R.projs.map((x, i) => (
                <div key={i} className={`sd-proj ${i % 2 ? "odd" : ""}`} style={{ left: `${x / R.Wpx * 100}%`, width: `${R.pw / R.Wpx * 100}%` }}><span>P{i + 1} · {sdFmt(R.pw)} × 1.080</span></div>
              ))}
              {junctions.map((j, i) => (
                <div key={"j" + i} className="sd-blend" style={{ left: `${j.x0 / R.Wpx * 100}%`, width: `${(j.x1 - j.x0) / R.Wpx * 100}%` }}><span>overlap {sdFmt(j.x1 - j.x0)} px</span></div>
              ))}
            </div>
              {Sg && <div className="sd-bbox" style={{ left: `${-bleed.f * 50}%`, right: `${-bleed.f * 50}%`, top: `${-bleed.f * 50}%`, bottom: `${-bleed.f * 50}%` }}><span>sangria {sdFmt(bleed.bw)} × {sdFmt(bleed.bh)}</span></div>}
              {fit && <div className={`sd-vbox ${fit.ok ? "" : "bad"}`} style={{ left: `${Math.max(-0.02, fit.a) * 100}%`, width: `${(Math.min(1.02, fit.b) - Math.max(-0.02, fit.a)) * 100}%` }}><span>vídeo {sdFmt(fit.vw)} × {sdFmt(fit.vh)}{Math.abs(fit.st) > 0.0005 ? ` · ${fit.st > 0 ? "+" : "−"}${sdPct(Math.abs(fit.st))}` : ""}</span></div>}
            </div>
            <div className="sd-res"><b>{sdFmt(R.Wpx)} × {sdFmt(SD_MAX_H)} px</b><span className="sd-res-r">{sdRatio(R.Wpx, SD_MAX_H)}</span>
              <span className="sd-res2">{sdM(arc)} m × {sdM(a)} m · {R.N} projetor{R.N > 1 ? "es" : ""} lado a lado · cada um usa {sdFmt(R.pw)} × 1.080</span></div>
          </div>

          <SDVideoTest vw={Vw} vh={Vh} setVw={setVw} setVh={setVh} st={St} setSt={setSt} fit={fit} areaLbl={`tela de ${sdFmt(R.Wpx)} × ${sdFmt(SD_MAX_H)} px (${sdRatio(R.Wpx, SD_MAX_H)})`} />
          <SDBleed on={Sg} setOn={setSg} pct={SgP} setPct={setSgP} bleed={bleed} areaLbl="tela" />

          <div className="sd-topview">
            <svg viewBox={top.vb} style={{ width: Math.min(260, 140 * top.ratio), aspectRatio: top.ratio }}>
              <path d={top.path(0, 1)} fill="none" stroke="#5EC8F2" strokeWidth="0.05" strokeLinecap="round" />
              {R.N > 1 && R.projs.map((x, i) => (
                <path key={i} d={top.path(Math.max(0, x / R.Wpx), Math.min(1, (x + R.pw) / R.Wpx))} fill="none"
                      stroke={i % 2 ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.3)"} strokeWidth="0.03" transform={`scale(${i % 2 ? 0.9 : 0.94})`} />
              ))}
              <circle cx="0" cy="0" r="0.035" fill="#fff" opacity=".6" />
            </svg>
            <div className="sd-res">vista de cima · raio <b>{sdM(R.radiusM)} m</b>{R.chordM > 0 && <> · abertura <b>{sdM(R.chordM)} m</b></>} · fundo <b>{sdM(R.depthM)} m</b></div>
          </div>
          <div className="sd-safekey"><i />margem de proteção · 10% de cada borda — concentre textos e conteúdo dentro do tracejado</div>
          {ready && R.Wpx < 1920 && <div className="sd-note">A tela cabe em um projetor só — ele entrega 1920px e a tela usa {sdFmt(R.Wpx)}px; o resto do quadro fica preto.</div>}
        </section>

        <section className="sd-3dsection" ref={preview3dRef} data-html2canvas-ignore="true">
          <div className="sd-3dtitle">Preview 3D — faixa de cada projetor</div>
          <SDPreview3D initView={view} res={{ curve: true, Wpx: R.Wpx, theta: R.theta, projs: R.projs, pw: R.pw, cut: R.cut, radiusM: R.radiusM, ov: R.ov, bleed: Sg ? bleed.f : 0, fit: fit ? { a: fit.a, b: fit.b, vw: fit.vw, vh: fit.vh, ok: fit.ok, st: fit.st } : null }} />
        </section>
      </div>

      <section className="sd-indicators">
        <div className="sd-ind"><div className="sd-ind-lbl">Vídeo a produzir</div><div className="sd-ind-val">{sdFmt(R.Wpx)}×{sdFmt(SD_MAX_H)}</div><div className="sd-ind-sub">proporção {sdRatio(R.Wpx, SD_MAX_H)}</div></div>
        <div className="sd-ind"><div className="sd-ind-lbl">Projetores 1920×1080</div><div className="sd-ind-val">{R.N}</div><div className="sd-ind-sub">cada um usa {sdFmt(R.pw)} × 1.080 · {sdM(R.projM)} × {sdM(a)} m</div></div>
        <div className="sd-ind"><div className="sd-ind-lbl">Proporção da timeline</div><div className="sd-ind-val">{sdRatio(R.Wpx, SD_MAX_H)}</div><div className="sd-ind-sub">timeline {sdFmt(R.Wpx)} × {sdFmt(SD_MAX_H)} px{R.Wpx % 2 ? ` · largura ímpar, use ${sdFmt(R.Wpx + 1)}` : ""}</div></div>
        <div className="sd-ind"><div className="sd-ind-lbl">Overlap</div><div className="sd-ind-val">{R.less ? `−${sdFmt(R.less)} px` : "nenhum"}</div><div className="sd-ind-sub">{R.less ? `${sdPct(blend / 100)} da largura · blend de ${sdFmt(R.ov)} px por junção · sem overlap ${sdFmt(R.Wn)}` : "fatias encostadas, sem blend"}</div></div>
        <div className="sd-ind sd-ind-safe"><div className="sd-ind-lbl">Área segura (margem 10%)</div><div className="sd-ind-val">{sdSafeTxt(R.Wpx).replace(/ /g, "")}</div><div className="sd-ind-sub">{sdM(arc * 0.8)} × {sdM(a * 0.8)} m · textos aqui dentro</div></div>
        <div className="sd-ind"><div className="sd-ind-lbl">Escala</div><div className="sd-ind-val">{R.scale.toFixed(1)}</div><div className="sd-ind-sub">px/m · raio {sdM(R.radiusM)} m</div></div>
      </section>
    </div>
  );
};

/* ─────────────────────────── Ficha técnica em PDF ───────────────────────────── */
/* O PDF não é mais um print da tela: cada aba descreve a sala num objeto (`doc`)
   e ele é montado numa folha clara, própria para imprimir, num palco 1:1 fora da
   árvore da página (html2canvas + transform de ancestral apaga o texto). Os
   desenhos são divs + SVG só de forma — texto dentro de SVG vira imagem e perde a
   fonte. O 3D entra como foto do canvas, no ângulo em que foi deixado. */
const SD_PDF_W = 1280, SD_PDF_H = 905;   // proporção de A4 deitado

const sdAccent = () => {
  try { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2E86C1"; }
  catch (_) { return "#2E86C1"; }
};

/* Sala semicircular: a tela planificada com a faixa de cada projetor + vista de cima. */
const SDPdfCurveDiagram = ({ R, fit }) => {
  const ac = sdAccent();
  // cabe a tela + o quadro vermelho de 1920 que passa das pontas (o corte)
  let sw = 520 * R.Wpx / (R.Wpx + 2 * R.cut), sh = sw * SD_MAX_H / R.Wpx;
  if (sh > 78) { sh = 78; sw = sh * R.Wpx / SD_MAX_H; }
  const cutW = R.cut * sw / R.Wpx;
  const pct = (x) => `${x / R.Wpx * 100}%`;
  const junctions = R.projs.slice(1).map((x, i) => ({ x0: x, x1: R.projs[i] + R.pw })).filter((j) => j.x1 > j.x0);
  const th = R.theta, n = 72, pts = [];
  for (let i = 0; i <= n; i++) { const f = -th / 2 + th * i / n; pts.push([Math.sin(f), -Math.cos(f)]); }
  const xs = pts.map((p) => p[0]).concat(0), ys = pts.map((p) => p[1]).concat(0);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 0.16, vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
  const tvH = 80, tvW = Math.min(200, tvH * vw / vh);
  const arcD = (u0, u1, k = 1) => { const m = Math.max(2, Math.ceil(n * (u1 - u0))); let d = ""; for (let i = 0; i <= m; i++) { const f = -th / 2 + th * (u0 + (u1 - u0) * i / m); d += `${i ? "L" : "M"}${(k * Math.sin(f)).toFixed(4)},${(-k * Math.cos(f)).toFixed(4)}`; } return d; };
  const chord = R.chordM > 0 ? pts[0].concat(pts[n]) : null;
  return (
    <div className="pd-dg">
      <div className="pd-dimw" style={{ width: sw, marginLeft: cutW, marginRight: 62 + cutW }}><span>{sdFmt(R.Wpx)} px  ·  curva planificada</span></div>
      <div className="pd-striprow">
        <div className="pd-stripwrap" style={{ width: sw, height: sh, margin: `0 ${cutW}px` }}>
        {R.cut > 0.5 && [pct(-R.cut), "100%"].map((left, i) => (
          <div key={"c" + i} className={`pd-frame ${i ? "r" : "l"}`} style={{ left, width: pct(R.cut) }}>
            <span><b>−{sdFmt(R.cut)} px</b>1920 − {sdFmt(R.pw)} = {sdFmt(1920 - R.pw)}</span>
          </div>
        ))}
        <div className="pd-strip" style={{ width: sw, height: sh, background: ac }}>
          {R.projs.map((x, i) => (
            <div key={i} className={`pd-band ${i % 2 ? "odd" : ""}`} style={{ left: pct(x), width: pct(R.pw) }}><b>P{i + 1}<em>{sdFmt(R.pw)} × 1.080</em></b></div>
          ))}
          {junctions.map((j, i) => (
            <svg key={"j" + i} className="pd-blend" style={{ left: pct(j.x0), width: pct(j.x1 - j.x0) }} preserveAspectRatio="none">
              <defs><pattern id={`pdh${i}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="7" fill="rgba(255,255,255,0.45)" /></pattern></defs>
              <rect width="100%" height="100%" fill={`url(#pdh${i})`} />
            </svg>
          ))}
          <div className="pd-safe"><span>área segura {sdSafeTxt(R.Wpx)} px</span></div>
        </div>
        {fit && <div className={`pd-vbox ${fit.ok ? "" : "bad"}`} style={{ left: `${Math.max(-0.02, fit.a) * 100}%`, width: `${(Math.min(1.02, fit.b) - Math.max(-0.02, fit.a)) * 100}%` }} />}
        </div>
        <div className="pd-dimh" style={{ height: sh }}><span>{sdFmt(SD_MAX_H)} px</span></div>
      </div>
      <div className="pd-dgfoot">
        <svg width={tvW} height={tvH} viewBox={`${minX - pad} ${minY - pad} ${vw} ${vh}`}>
          {chord && <line x1={chord[0]} y1={chord[1]} x2={chord[2]} y2={chord[3]} stroke="#b9b6ae" strokeWidth="0.018" strokeDasharray="0.05 0.04" />}
          <line x1="0" y1="0" x2="0" y2="-1" stroke="#d3d0c8" strokeWidth="0.012" />
          <path d={arcD(0, 1)} fill="none" stroke={ac} strokeWidth="0.07" strokeLinecap="round" />
          {R.N > 1 && R.projs.map((x, i) => (
            <path key={i} d={arcD(Math.max(0, x / R.Wpx), Math.min(1, (x + R.pw) / R.Wpx), i % 2 ? 0.8 : 0.87)} fill="none" stroke={i % 2 ? "#111114" : "#8d8a83"} strokeWidth="0.035" strokeLinecap="round" />
          ))}
          <circle cx="0" cy="0" r="0.04" fill="#111114" />
        </svg>
        <div className="pd-legend">
          <div className="pd-legend-t">Vista de cima</div>
          <div><i style={{ background: ac }} />tela curva  ·  {Math.round(R.theta * 180 / Math.PI)}°</div>
          {R.N > 1 && <div><i style={{ background: "#111114" }} />faixa de cada projetor</div>}
          {fit && <div><i className={`vid ${fit.ok ? "" : "bad"}`} />vídeo testado  ·  {sdFmt(fit.vw)} × {sdFmt(fit.vh)}{fit.ok ? "" : "  ·  não compatível"}</div>}
          {R.cut > 0.5 && <div><i className="cut" />corte dos projetores  ·  {sdFmt(R.cut)} px em cada borda</div>}
          <div><i className="safe" />área segura  ·  {sdSafeTxt(R.Wpx)} px</div>
          {junctions.length > 0 && <div><i className="hatch" />overlap (blend)  ·  {sdFmt(R.ov)} px por junção</div>}
          <div><i className="dot" />centro  ·  raio {sdM(R.radiusM)} m</div>
        </div>
      </div>
    </div>
  );
};

/* Sala retangular: as três paredes lado a lado e o chão debaixo da central. */
const SDPdfRectDiagram = ({ R }) => {
  const ac = sdAccent();
  const gap = 90;                                          // folga entre paredes (px de vídeo)
  const fW = Math.max(R.fBase, R.fTop);
  const lat = R.Ws > 0;                                    // sala simples: sem as laterais
  const totW = lat ? R.Ws * 2 + R.Wc + gap * 2 : Math.max(R.Wc, fW), totH = R.H + R.fDepth + gap;
  const k = Math.min(580 / totW, 200 / totH);
  const xc = lat ? (R.Ws + gap) * k : (totW - R.Wc) / 2 * k, xr = (R.Ws + R.Wc + gap * 2) * k;
  const fy = (R.H + gap) * k, fx = xc + (R.Wc * k - fW * k) / 2;
  const box = (lbl, w, h, x, y, bg) => (
    <div className="pd-wall" style={{ left: x, top: y, width: w * k, height: h * k, background: bg }}>
      <div className="pd-safe" />
      <span>{lbl}</span><b>{sdFmt(w)} × {sdFmt(h)}</b>
    </div>
  );
  const tl = (fW - R.fTop) / 2 * k, bl = (fW - R.fBase) / 2 * k, fw = fW * k, fh = R.fDepth * k;
  return (
    <div className="pd-dg">
      <div className="pd-rect" style={{ width: totW * k, height: totH * k }}>
        {lat && box("Lateral E", R.Ws, R.H, 0, 0, "#55657a")}
        {box("Central", R.Wc, R.H, xc, 0, ac)}
        {lat && box("Lateral D", R.Ws, R.H, xr, 0, "#55657a")}
        <div className="pd-wall" style={{ left: fx, top: fy, width: fw, height: fh }}>
          <svg className="pd-floorsvg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {R.fBase !== R.fTop && <rect x="0" y="0" width="100" height="100" fill="none" stroke="#b9b6ae" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />}
            <polygon points={`${tl / fw * 100},0 ${100 - tl / fw * 100},0 ${100 - bl / fw * 100},100 ${bl / fw * 100},100`} fill="#2a9d8f" />
          </svg>
          <span>Chão</span><b>{sdFmt(fW)} × {sdFmt(R.fDepth)}</b>
        </div>
      </div>
      <div className="pd-legend row"><div><i className="safe" />margem de proteção  ·  10% de cada borda das paredes (área segura 80% × 80%)</div></div>
    </div>
  );
};

const sdClip = (t, n) => { t = String(t || "").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

const SDReport = ({ doc, shot }) => {
  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const bw = 468, bh = 234;
  let iw = bw, ih = bh;
  if (shot) { const r = shot.w / shot.h; if (r > bw / bh) ih = bw / r; else iw = bh * r; }
  return (
    <div className="pd-page">
      <style>{SD_PDF_CSS}</style>
      <header className="pd-head">
        <img className="pd-logo" src="/dual_logo_dark.svg" alt="" />
        <div className="pd-who">
          <div><span className="pd-lbl">Cliente</span><b>{sdClip(doc.cliente, 28) || "—"}</b></div>
          <div><span className="pd-lbl">Projeto</span><b>{sdClip(doc.projeto, 34) || "—"}</b></div>
        </div>
        <div className="pd-head-r"><img className="pd-aspecty" src="/aspecty_logo_dark.svg" alt="Aspecty" /><span>Ficha técnica  ·  {date}</span></div>
      </header>

      <div className="pd-titles">
        <h1>{doc.title}</h1>
        <p>{doc.subtitle}</p>
      </div>

      <section className="pd-hero">
        {doc.hero.map((h, i) => (
          <div key={i} className={`pd-stat ${i === 0 ? "main" : ""}`}>
            <div className="pd-lbl">{h.lbl}</div>
            <div className="pd-val">{h.val}{h.unit && <em>{h.unit}</em>}</div>
            <div className="pd-sub">{h.sub}</div>
          </div>
        ))}
      </section>

      <section className="pd-body">
        <div className="pd-card">
          <div className="pd-lbl">{doc.diagramTitle}</div>
          {doc.diagram}
        </div>
        <div className="pd-card dark">
          <div className="pd-lbl">Vista 3D</div>
          <div className="pd-shot" style={{ width: bw, height: bh }}>
            {shot ? <img src={shot.src} style={{ width: iw, height: ih }} alt="" /> : <span>3D indisponível</span>}
          </div>
        </div>
      </section>

      <section className="pd-tables">
        <div className="pd-card">
          <div className="pd-lbl">Medidas informadas</div>
          {doc.inputs.map(([k, v], i) => <div key={i} className="pd-row"><span>{k}</span><b>{v}</b></div>)}
        </div>
        <div className="pd-card">
          <div className="pd-lbl">Resultado</div>
          {doc.details.map(([k, v, x], i) => <div key={i} className="pd-row"><span>{k}</span><b>{v}</b><em>{x}</em></div>)}
        </div>
      </section>

      <footer className="pd-foot">
        <span>A altura da projeção é sempre 1080 px  ·  escala = 1080 ÷ altura em metros  ·  projetores 1920×1080</span>
        <span>Framety · Grupo Skyline</span>
      </footer>
    </div>
  );
};

const sdWaitImages = (root) => Promise.all([...root.querySelectorAll("img")].map((img) =>
  img.complete && img.naturalWidth ? Promise.resolve()
    : new Promise((r) => { img.onload = img.onerror = () => r(); setTimeout(r, 4000); })));

/* Monta a ficha no palco e devolve o canvas rasterizado (2x). */
async function sdRenderReport(doc, cv3d) {
  if (!window.html2canvas) await sdLoadScript("https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js");
  let shot = null;
  if (cv3d) {
    try { shot = cv3d.__sdSnap ? cv3d.__sdSnap(936, 540) : { src: cv3d.toDataURL("image/png"), w: cv3d.width, h: cv3d.height }; } catch (_) {}
  }

  const stage = document.createElement("div");
  stage.className = "sd-pdfstage";
  document.body.appendChild(stage);
  const root = ReactDOM.createRoot(stage);
  try {
    ReactDOM.flushSync(() => root.render(<SDReport doc={doc} shot={shot} />));
    try { await document.fonts?.ready; } catch (_) {}
    await sdWaitImages(stage);
    return await window.html2canvas(stage.querySelector(".pd-page"), {
      backgroundColor: "#f4f3ef", scale: 2, useCORS: true,
      width: SD_PDF_W, height: SD_PDF_H, windowWidth: SD_PDF_W, windowHeight: SD_PDF_H, scrollX: 0, scrollY: 0,
    });
  } finally {
    root.unmount();
    stage.remove();
  }
}

const sdSlug = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

async function sdExportPDF(doc, cv3d) {
  if (!window.jspdf) await sdLoadScript("https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js");
  const canvas = await sdRenderReport(doc, cv3d);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "l", unit: "px", format: [SD_PDF_W, SD_PDF_H], compress: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, SD_PDF_W, SD_PDF_H);
  pdf.setProperties({ title: `${doc.title} — Aspecty`, author: "Framety · Grupo Skyline" });
  const quem = [doc.cliente, doc.projeto].map(sdSlug).filter(Boolean).join("-");
  pdf.save(`${quem ? quem + "-" : ""}${doc.name}.pdf`);
}

const SD_PDF_CSS = `
.pd-page{ position:relative; width:${SD_PDF_W}px; height:${SD_PDF_H}px; box-sizing:border-box; padding:32px 56px 0; background:#f4f3ef; color:#111114;
  font-family:'Albert Sans', 'Inter', system-ui, sans-serif; display:flex; flex-direction:column; }
.pd-page *{ box-sizing:border-box; }
.pd-page > *{ flex-shrink:0; }
.pd-head{ display:flex; align-items:center; justify-content:space-between; padding-bottom:16px; border-bottom:1px solid #dcd9d1; }
.pd-logo{ height:30px; width:auto; }
.pd-who{ flex:1; display:flex; gap:34px; margin:0 34px; padding-left:34px; border-left:1px solid #dcd9d1; }
.pd-who > div{ display:flex; flex-direction:column; gap:4px; min-width:0; }
/* sem overflow:hidden: no html2canvas ele recorta a parte de baixo das letras */
.pd-who b{ font-size:17px; line-height:1.35; padding-bottom:2px; font-weight:700; letter-spacing:-0.01em; white-space:nowrap; }
.pd-head-r{ display:flex; flex-direction:column; align-items:flex-end; gap:3px; font-family:'JetBrains Mono', monospace; }
.pd-head-r b{ font-size:13px; font-weight:500; letter-spacing:.02em; }
.pd-aspecty{ height:15px; width:auto; display:block; margin-bottom:2px; }
.pd-head-r span{ font-size:10.5px; color:#7c7a74; letter-spacing:.04em; }
.pd-titles{ margin-top:14px; }
.pd-titles h1{ margin:0; font-size:38px; line-height:1.05; font-weight:700; letter-spacing:-0.02em; }
.pd-titles p{ margin:7px 0 0; font-size:15px; color:#62605b; white-space:pre; }
.pd-lbl{ font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#8d8a83; }
.pd-hero{ display:grid; grid-template-columns:1.25fr 1fr 1fr; gap:14px; margin-top:12px; }
.pd-stat{ background:#fff; border:1px solid #e3e0d8; border-radius:14px; padding:15px 20px 14px; }
.pd-stat.main{ background:#111114; border-color:#111114; color:#fff; }
.pd-stat.main .pd-lbl{ color:#9a9aa3; }
.pd-val{ margin-top:6px; font-size:34px; line-height:1.1; font-weight:700; letter-spacing:-0.015em; white-space:nowrap; }
.pd-val em{ font-style:normal; font-size:14px; font-weight:500; color:#8d8a83; margin-left:8px; letter-spacing:0; }
.pd-sub{ margin-top:5px; font-size:12px; color:#8d8a83; }
.pd-stat.main .pd-sub{ color:#9a9aa3; }
.pd-body{ display:grid; grid-template-columns:1fr 508px; gap:14px; margin-top:14px; height:290px; }
.pd-card{ background:#fff; border:1px solid #e3e0d8; border-radius:14px; padding:14px 20px; display:flex; flex-direction:column; }
.pd-card.dark{ background:#0a0a0c; border-color:#0a0a0c; }
.pd-card.dark .pd-lbl{ color:#77777f; }
.pd-shot{ margin:10px auto 0; display:flex; align-items:center; justify-content:center; border-radius:8px; overflow:hidden; color:#77777f; font-size:12px; }
.pd-dg{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.pd-dimw{ position:relative; height:22px; margin-right:62px; border-left:1px solid #111114; border-right:1px solid #111114; }
.pd-dimw::before{ content:""; position:absolute; left:0; right:0; top:10px; border-top:1px solid #111114; }
.pd-dimw span{ position:absolute; left:50%; top:3px; transform:translateX(-50%); background:#fff; padding:0 8px; font-family:'JetBrains Mono', monospace; font-size:10.5px; white-space:pre; }
.pd-striprow{ display:flex; align-items:stretch; gap:10px; margin-top:4px; }
.pd-stripwrap{ position:relative; }
.pd-strip{ position:relative; overflow:hidden; border-radius:3px; }
.pd-frame{ position:absolute; top:0; bottom:0; background:rgba(229,57,53,.16); border:1.5px dashed rgba(229,57,53,.9); }
.pd-frame span{ position:absolute; top:calc(100% + 3px); white-space:nowrap; font-family:'JetBrains Mono', monospace; font-size:8.5px; line-height:1.3; color:#c62828; display:flex; flex-direction:column; }
.pd-frame span b{ font-size:9.5px; font-weight:600; }
.pd-frame.l span{ left:0; align-items:flex-start; }
.pd-frame.r span{ right:0; align-items:flex-end; }
.pd-vbox{ position:absolute; top:-3px; bottom:-3px; border:2px dashed #9333ea; background:rgba(147,51,234,.14); border-radius:3px; }
.pd-vbox.bad{ border-color:#e53935; background:rgba(229,57,53,.12); }
.pd-legend i.vid{ height:10px; background:rgba(147,51,234,.18); border:1.5px dashed #9333ea; }
.pd-legend i.vid.bad{ background:rgba(229,57,53,.18); border-color:#e53935; }
.pd-legend i.cut{ height:10px; background:rgba(229,57,53,.25); border:1px dashed #e53935; }
.pd-band{ position:absolute; top:0; bottom:0; background:rgba(255,255,255,.1); border-left:1px solid rgba(255,255,255,.85); border-right:1px solid rgba(255,255,255,.85); display:flex; align-items:flex-end; justify-content:center; }
.pd-band.odd{ top:8%; bottom:8%; background:rgba(0,0,0,.12); }
.pd-band b em{ display:block; font-style:normal; font-size:8.5px; font-weight:400; opacity:.9; }
.pd-band b{ position:absolute; left:0; right:0; bottom:13%; text-align:center; line-height:1.2; font-family:'JetBrains Mono', monospace; font-size:10px; color:#fff; white-space:nowrap; }
.pd-blend{ position:absolute; top:0; height:100%; }
.pd-dimh{ position:relative; width:52px; border-top:1px solid #111114; border-bottom:1px solid #111114; }
.pd-dimh::before{ content:""; position:absolute; top:0; bottom:0; left:6px; border-left:1px solid #111114; }
.pd-dimh span{ position:absolute; left:12px; top:50%; transform:translateY(-50%); font-family:'JetBrains Mono', monospace; font-size:10.5px; white-space:nowrap; }
.pd-dgfoot{ display:flex; align-items:center; gap:22px; margin-top:22px; }
.pd-legend{ display:flex; flex-direction:column; gap:1px; font-size:11px; color:#3c3b38; white-space:pre; }
.pd-legend-t{ font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#8d8a83; margin-bottom:2px; }
.pd-legend i{ display:inline-block; width:18px; height:4px; border-radius:2px; margin-right:9px; vertical-align:middle; }
.pd-legend i.hatch{ height:10px; background:#cfd9e3; }
.pd-legend i.dot{ width:7px; height:7px; border-radius:50%; background:#111114; margin:0 15px 0 5px; }
.pd-safe{ position:absolute; top:10%; bottom:10%; left:10%; right:10%; border:1.5px dashed #FFB547; pointer-events:none; }
.pd-safe span{ position:absolute; top:3px; left:50%; transform:translateX(-50%); white-space:nowrap; font-family:'JetBrains Mono', monospace; font-size:9.5px; font-weight:500; color:#FFD08A; }
.pd-legend i.safe{ height:0; border-radius:0; border-top:2px dashed #FFB547; background:transparent; }
.pd-legend.row{ margin-top:14px; }
.pd-rect{ position:relative; }
.pd-wall{ position:absolute; border-radius:3px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; color:#fff; text-align:center; overflow:hidden; }
.pd-wall span{ font-family:'JetBrains Mono', monospace; font-size:9px; letter-spacing:.12em; text-transform:uppercase; opacity:.85; }
.pd-wall b{ font-size:13px; font-weight:700; white-space:nowrap; }
.pd-floorsvg{ position:absolute; left:0; top:0; width:100%; height:100%; }
.pd-wall span, .pd-wall b{ position:relative; }
.pd-tables{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px; }
.pd-tables .pd-card{ padding:10px 20px 6px; }
.pd-tables .pd-lbl{ margin-bottom:2px; }
.pd-row{ display:flex; align-items:baseline; gap:10px; padding:3px 0; border-top:1px solid #eeebe4; font-size:12px; }
.pd-row:first-of-type{ border-top:none; }
.pd-row span{ flex:1; color:#62605b; }
.pd-row b{ font-weight:600; font-variant-numeric:tabular-nums; white-space:pre; }
.pd-row em{ font-style:normal; width:140px; white-space:nowrap; text-align:right; color:#8d8a83; font-size:11.5px; }
.pd-foot{ position:absolute; left:56px; right:56px; bottom:22px; display:flex; justify-content:space-between; padding-top:10px; border-top:1px solid #dcd9d1;
  font-family:'JetBrains Mono', monospace; font-size:9.5px; color:#8d8a83; letter-spacing:.03em; white-space:pre; }
`;

/* ─────────────────────────── Página principal ───────────────────────────────── */
const SD_MODES = [
  { id: "rect",  label: "Sala retangular",   path: "/screendimension" },
  { id: "curve", label: "Sala semicircular", path: "/screendimension/semicircular" },
];

const sdLogged = () => { try { return !!window.API?.getToken(); } catch (_) { return false; } };
const sdWhen = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };

/* Login do console, embutido: as fichas salvas levam nome de cliente, então
   ler e gravar exige a mesma senha do console (o token vale para a aba). */
const SDLogin = ({ onDone, compact }) => {
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // não é <form>: fica dentro da caixa de exportação, que já é um form
  const go = async () => {
    if (!pw) return;
    setBusy(true); setErr("");
    try { const r = await window.API.login(pw); window.API.setToken(r.token); onDone?.(); }
    catch (x) { setErr(x?.error || "Não foi possível entrar."); }
    finally { setBusy(false); }
  };
  return (
    <div className={`sd-login ${compact ? "compact" : ""}`}>
      <span className="sd-field-lbl">Senha do console</span>
      <div className="sd-login-row">
        <input className="sd-text" type="password" value={pw} autoComplete="current-password" placeholder="para salvar e consultar fichas" onChange={(e) => setPw(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); go(); } }} />
        <button type="button" className="sd-btn" disabled={busy || !pw} onClick={go}>{busy ? "Entrando…" : "Entrar"}</button>
      </div>
      {err && <div className="sd-err">{err}</div>}
    </div>
  );
};

/* Caixa do "Exportar PDF": cliente + projeto vão para o topo da ficha, e a ficha
   fica salva no site (se houver login). Com uma ficha aberta, atualiza a mesma. */
const SDExportModal = ({ current, onClose, onGo }) => {
  const [cliente, setCliente] = React.useState(current?.cliente || "");
  const [projeto, setProjeto] = React.useState(current?.projeto || "");
  const [logged, setLogged] = React.useState(sdLogged());
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const ok = cliente.trim() && projeto.trim();
  const go = async (download) => {
    if (!ok) return;
    setBusy(true); setErr("");
    try { await onGo({ cliente: cliente.trim(), projeto: projeto.trim() }, download); }
    catch (x) { setErr(x?.error || x?.message || "Algo deu errado."); setBusy(false); }
  };
  return (
    <div className="sd-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="sd-modal" onSubmit={(e) => { e.preventDefault(); go(true); }}>
        <div className="sd-modal-h">
          <b>{current ? "Atualizar ficha técnica" : "Exportar ficha técnica"}</b>
          <button type="button" className="sd-x" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </div>
        <label className="sd-field"><span className="sd-field-lbl">Cliente</span>
          <input className="sd-text" autoFocus value={cliente} maxLength={120} placeholder="ex. AMS" onChange={(e) => setCliente(e.target.value)} /></label>
        <label className="sd-field"><span className="sd-field-lbl">Projeto</span>
          <input className="sd-text" value={projeto} maxLength={120} placeholder="ex. Sala imersiva — stand" onChange={(e) => setProjeto(e.target.value)} /></label>
        {logged
          ? <div className="sd-modal-note">{current ? "Vai atualizar a ficha salva no site." : "A ficha fica salva no site, em “Fichas salvas”."}</div>
          : <div className="sd-modal-login"><div className="sd-modal-note">Sem login o PDF é baixado, mas não fica salvo no site.</div><SDLogin compact onDone={() => setLogged(true)} /></div>}
        {err && <div className="sd-err">{err}</div>}
        <div className="sd-modal-f">
          {logged && <button type="button" className="sd-btn ghost" disabled={!ok || busy} onClick={() => go(false)}>Só salvar</button>}
          <button type="submit" className="sd-btn" disabled={!ok || busy}>{busy ? "Gerando…" : logged ? "Salvar e baixar PDF" : "Baixar PDF"}</button>
        </div>
      </form>
    </div>
  );
};

/* Gaveta com as fichas salvas: abrir (editar), baixar de novo, apagar. */
const SDSavedPanel = ({ onClose, onOpen, onDownload, currentId, onDeleted }) => {
  const [logged, setLogged] = React.useState(sdLogged());
  const [list, setList] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [q, setQ] = React.useState("");
  const [confirmId, setConfirmId] = React.useState(null);
  const load = React.useCallback(async () => {
    setErr("");
    try { setList(await window.API.getScreendims()); }
    catch (x) { setErr(x?.error || "Não foi possível carregar."); if (!sdLogged()) setLogged(false); }
  }, []);
  React.useEffect(() => { if (logged) load(); }, [logged, load]);
  // outra aba/sessão salvou ou apagou: recarrega
  React.useEffect(() => {
    if (!logged || !window.FRAMETY_LIVE) return;
    return window.FRAMETY_LIVE.on("screendims", () => load());
  }, [logged, load]);
  const del = async (id) => {
    try { await window.API.deleteScreendim(id); setList((l) => l.filter((x) => x.id !== id)); onDeleted?.(id); }
    catch (x) { setErr(x?.error || "Não foi possível apagar."); }
    setConfirmId(null);
  };
  const t = q.trim().toLowerCase();
  const shown = (list || []).filter((d) => !t || `${d.cliente} ${d.projeto}`.toLowerCase().includes(t));
  return (
    <div className="sd-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sd-drawer">
        <div className="sd-modal-h"><b>Fichas salvas</b><button className="sd-x" onClick={onClose} aria-label="Fechar">×</button></div>
        {!logged ? (
          <div className="sd-drawer-empty"><p>As fichas salvas ficam protegidas pela senha do console.</p><SDLogin onDone={() => setLogged(true)} /></div>
        ) : (
          <>
            <input className="sd-text" placeholder="Buscar por cliente ou projeto" value={q} onChange={(e) => setQ(e.target.value)} />
            {err && <div className="sd-err">{err}</div>}
            {list === null && !err && <div className="sd-drawer-empty">Carregando…</div>}
            {list && !shown.length && <div className="sd-drawer-empty">{list.length ? "Nada encontrado." : "Nenhuma ficha salva ainda. Use “Exportar PDF” para criar a primeira."}</div>}
            <div className="sd-list">
              {shown.map((d) => (
                <div key={d.id} className={`sd-item ${d.id === currentId ? "on" : ""}`}>
                  <div className="sd-item-t">
                    <b>{d.cliente || "Sem cliente"}</b><span>{d.projeto || "Sem projeto"}</span>
                  </div>
                  <div className="sd-item-m">
                    <span className="sd-chip">{d.mode === "curve" ? "Semicircular" : "Retangular"}</span>
                    <span>{d.resumo}</span>
                  </div>
                  <div className="sd-item-d">atualizada {sdWhen(d.updatedAt)}</div>
                  {confirmId === d.id ? (
                    <div className="sd-item-a"><span className="sd-err">Apagar esta ficha?</span>
                      <button className="sd-btn danger sm" onClick={() => del(d.id)}>Apagar</button>
                      <button className="sd-btn ghost sm" onClick={() => setConfirmId(null)}>Cancelar</button></div>
                  ) : (
                    <div className="sd-item-a">
                      <button className="sd-btn sm" onClick={() => onOpen(d)}>Abrir e editar</button>
                      <button className="sd-btn ghost sm" onClick={() => onDownload(d)}>Baixar PDF</button>
                      <button className="sd-btn ghost sm danger-t" onClick={() => setConfirmId(d.id)}>Apagar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};

const ScreenDimensionPage = () => {
  const [mode, setModeS] = React.useState(() => (/^\/screendimension\/semicircular\/?$/.test(location.pathname) ? "curve" : "rect"));
  // link aberto com medidas: vale só para a sala do link, na primeira montagem
  const urlInit = React.useRef({ mode: /^\/screendimension\/semicircular\/?$/.test(location.pathname) ? "curve" : "rect", inputs: sdReadUrl() }).current;
  React.useEffect(() => { urlInit.inputs = null; }, []);   // usado uma vez só: trocar de aba ou fechar ficha não o traz de volta
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) { await navigator.share({ title: "Aspecty", url }); return; }
    } catch (e) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); setToast("Link copiado — quem abrir vê a sala com estes mesmos números."); }
    catch (_) { window.prompt("Copie o link da sala:", url); }
  };
  const setMode = (m) => {
    setModeS(m);
    try { history.replaceState(history.state, "", SD_MODES.find((x) => x.id === m).path); } catch (_) {}
  };
  // ficha aberta: { id, cliente, projeto, mode, inputs, view } — os modos remontam com ela
  const [current, setCurrent] = React.useState(null);
  const [loadKey, setLoadKey] = React.useState(0);
  const [modal, setModal] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [busyMsg, setBusyMsg] = React.useState("");
  const [toast, setToast] = React.useState("");
  const pendingDownload = React.useRef(null);
  const sheetRef = React.useRef(null);
  const preview3dRef = React.useRef(null);
  const docRef = React.useRef({ name: "sala-imersiva" });

  React.useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 4200); return () => clearTimeout(t); }, [toast]);

  const canvas3d = () => preview3dRef.current?.querySelector("canvas");
  const download = async (who) => {
    await sdExportPDF({ ...docRef.current, ...who }, canvas3d());
  };

  // Caixa confirmada: salva/atualiza no site (se logado) e baixa o PDF.
  const onExport = async (who, wantPdf) => {
    const d = docRef.current;
    const payload = { ...who, mode: d.mode, inputs: d.raw, resumo: d.resumo, view: canvas3d()?.__sdView?.() };
    let saved = null, saveErr = "";
    if (sdLogged()) {
      try {
        saved = current?.id ? await window.API.updateScreendim(current.id, payload) : await window.API.addScreendim(payload);
        setCurrent(saved);
      } catch (x) { saveErr = x?.error || "não foi possível salvar"; }
    }
    if (!wantPdf && saveErr) throw { error: saveErr };
    if (wantPdf) await download(who);
    setModal(false);
    setToast(saveErr ? `PDF baixado, mas a ficha não foi salva: ${saveErr}` : saved ? (wantPdf ? "Ficha salva e PDF baixado." : "Ficha salva.") : "PDF baixado.");
  };

  const openRecord = (d, thenDownload) => {
    pendingDownload.current = thenDownload ? d : null;
    setCurrent(d);
    setMode(d.mode === "curve" ? "curve" : "rect");
    setLoadKey((k) => k + 1);
    setDrawer(false);
    if (thenDownload) setBusyMsg("Gerando PDF…");
  };
  const closeRecord = () => { setCurrent(null); setLoadKey((k) => k + 1); };

  // "Baixar PDF" de uma ficha salva: remonta a sala com ela, espera o 3D e exporta.
  React.useEffect(() => {
    const d = pendingDownload.current;
    if (!d) return;
    pendingDownload.current = null;
    let alive = true;
    (async () => {
      const t0 = Date.now();
      while (alive && !canvas3d()?.__sdSnap && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 120));
      await new Promise((r) => setTimeout(r, 250));
      if (!alive) return;
      try { await download({ cliente: d.cliente, projeto: d.projeto }); setToast("PDF baixado."); }
      catch (_) { setToast("Não foi possível gerar o PDF."); }
      finally { setBusyMsg(""); }
    })();
    return () => { alive = false; };
  }, [loadKey]);

  const Mode = mode === "curve" ? SDCurveMode : SDRectMode;
  const init = current && (current.mode === "curve" ? "curve" : "rect") === mode ? current : null;
  return (
    <div className="sd-page">
      <style>{SD_CSS}</style>
      <SDParticleWave />

      <header className="sd-head">
        <h1 className="sd-title"><img className="sd-logo" src="/aspecty_logo.svg" alt="Aspecty" /></h1>
        <nav className="sd-tabs">
          {SD_MODES.map((m) => (
            <button key={m.id} className={`sd-tab ${mode === m.id ? "on" : ""}`} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </nav>
        <button className="sd-btn ghost" onClick={share} title="Copia o link desta sala com as medidas digitadas">Compartilhar</button>
        <button className="sd-btn ghost" onClick={() => setDrawer(true)}>Fichas salvas</button>
        <button className="sd-export" onClick={() => setModal(true)} disabled={!!busyMsg}>{busyMsg || "Exportar PDF"}</button>
      </header>

      {current && (
        <div className="sd-editing">
          <span>Editando a ficha <b>{current.cliente}</b> · <b>{current.projeto}</b> — ao exportar, ela é atualizada.</span>
          <button className="sd-btn ghost sm" onClick={closeRecord}>Fechar ficha</button>
        </div>
      )}

      <Mode key={`${mode}-${loadKey}`} sheetRef={sheetRef} preview3dRef={preview3dRef} docRef={docRef}
            initial={init?.inputs || (urlInit.inputs && urlInit.mode === mode ? urlInit.inputs : undefined)} view={init?.view || undefined} />

      {modal && <SDExportModal current={current} onClose={() => setModal(false)} onGo={onExport} />}
      {drawer && <SDSavedPanel currentId={current?.id} onClose={() => setDrawer(false)}
                               onOpen={(d) => openRecord(d, false)} onDownload={(d) => openRecord(d, true)}
                               onDeleted={(id) => { if (current?.id === id) closeRecord(); }} />}
      {toast && <div className="sd-toast">{toast}</div>}
    </div>
  );
};

const SD_CSS = `
.sd-page{ --sd-w:1320px; box-sizing:border-box; min-height:100vh; background:#08080a; color:#f2f2f4; font-family:var(--font-sans, 'Inter', system-ui, sans-serif);
  padding:14px clamp(14px,3vw,34px) 16px; display:flex; flex-direction:column; justify-content:center; gap:9px; }
.sd-head{ display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; max-width:var(--sd-w); width:100%; margin:0 auto; padding-bottom:9px; border-bottom:1px solid #1e1e24; }
.sd-kicker{ font-family:var(--font-mono, monospace); font-size:10px; letter-spacing:0.26em; color:var(--accent,#2E86C1); margin-bottom:4px; }
.sd-title{ font-family:var(--font-mono,monospace); font-size:clamp(21px,2.6vw,30px); font-weight:800; letter-spacing:-0.01em; margin:0; color:#f4f4f6; }
.sd-title-ac{ color:var(--accent,#2E86C1); }
.sd-logo{ display:block; height:clamp(20px,2.4vw,28px); width:auto; }
.sd-head-r{ display:flex; align-items:flex-end; gap:16px; }
.sd-altfield{ display:flex; flex-direction:column; gap:5px; }
.sd-altfield-lbl{ font-size:11.5px; color:#d6d6db; display:flex; gap:7px; align-items:baseline; }
.sd-altfield-lbl em{ font-style:normal; font-size:10px; color:#77777f; }
.sd-export{ flex-shrink:0; background:var(--accent,#2E86C1); color:#fff; border:none; border-radius:999px; padding:11px 20px; font-size:12.5px; font-weight:600; cursor:pointer; transition:filter .15s, opacity .15s; }
.sd-export:hover{ filter:brightness(1.08); }
.sd-export:disabled{ opacity:.55; cursor:default; }

.sd-hint{ max-width:1320px; width:100%; margin:0 auto; font-size:11.5px; line-height:1.5; color:#8a8a92; }
.sd-hint b{ color:#d6d6db; }
.sd-badge{ display:inline-block; margin-left:8px; font-family:var(--font-mono,monospace); font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:#ffcf9e; border:1px solid #4a3a22; background:#1c150c; border-radius:999px; padding:2px 8px; }

/* Campos de medida: é onde o usuário trabalha, então saltam da página — fundo
   mais claro, borda na cor de destaque e um halo leve; no foco, o halo cresce. */
.sd-input-wrap{ display:inline-flex; align-items:center; background:#1a1a21; border:1.5px solid rgba(var(--accent-rgb,46,134,193),.6); border-radius:9px; overflow:hidden;
  box-shadow:0 0 0 3px rgba(var(--accent-rgb,46,134,193),.1), inset 0 1px 0 rgba(255,255,255,.05); transition:border-color .15s, box-shadow .15s, background .15s; }
.sd-input-wrap:hover{ border-color:rgba(var(--accent-rgb,46,134,193),.9); background:#1e1e26; }
.sd-input-wrap:focus-within{ border-color:var(--accent,#2E86C1); background:#20202a; box-shadow:0 0 0 4px rgba(var(--accent-rgb,46,134,193),.28); }
.sd-input-wrap input{ width:60px; background:transparent; border:none; outline:none; color:#fff; font-size:13px; font-weight:600; padding:6px 5px 6px 9px; font-variant-numeric:tabular-nums; text-align:right; }
.sd-input-wrap input::placeholder{ color:#6d7784; font-weight:500; }
.sd-input-wrap b{ padding:0 8px 0 2px; color:var(--accent,#2E86C1); font-weight:600; font-size:11px; }
.sd-input-lg input{ width:100px; font-size:17px; padding:9px 8px 9px 12px; }

.sd-sheet{ max-width:var(--sd-w); width:100%; margin:0 auto; display:flex; flex-direction:column; gap:12px; }
.sd-main{ display:grid; grid-template-columns:1.55fr 1fr; gap:12px; align-items:stretch; }
@media (max-width:900px){ .sd-main{ grid-template-columns:1fr; } }

.sd-stage, .sd-3dsection{ background:#101014; border:1px solid #232329; border-radius:14px; }
.sd-stage{ padding:12px 14px 12px; display:flex; flex-direction:column; align-items:center; gap:10px; overflow:auto; }
.sd-altrow{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:center; width:100%; padding:14px 12px 10px; background:rgba(var(--accent-rgb,46,134,193),.07); border:1px solid rgba(var(--accent-rgb,46,134,193),.38); border-radius:12px; position:relative; margin-top:8px; }
.sd-altrow::before, .sd-curvein::before{ content:"✎  preencha as medidas"; position:absolute; top:-9px; left:14px; padding:2px 9px; border-radius:999px; background:var(--accent,#2E86C1); color:#fff;
  font-family:var(--font-mono,monospace); font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; }
.sd-altrow-lbl{ font-size:13px; color:#f0f0f3; font-weight:500; }
.sd-altrow-lbl em{ font-style:normal; color:var(--accent,#2E86C1); font-size:11px; }
.sd-wallrow{ display:flex; align-items:flex-start; justify-content:center; gap:10px; }
.sd-cell{ display:flex; flex-direction:column; align-items:center; gap:5px; }
.sd-screen{ position:relative; background:linear-gradient(160deg,#4576b8,#2f5990); border-radius:4px; box-shadow:0 5px 18px rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; min-width:20px; min-height:20px; }
.sd-screen-c{ background:linear-gradient(160deg,#e5474f,#bf2f3a); outline:2px solid #fff; outline-offset:2px; }
.sd-screen-lbl{ color:#fff; font-size:11px; font-weight:700; letter-spacing:.03em; text-shadow:0 1px 3px rgba(0,0,0,.45); }
.sd-cellin{ display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px 9px 8px; border-radius:10px; background:rgba(var(--accent-rgb,46,134,193),.07); border:1px dashed rgba(var(--accent-rgb,46,134,193),.4); }
.sd-cellin-lbl{ font-size:10.5px; color:#d6d6db; font-weight:500; }
.sd-cellin-lbl em{ font-style:normal; color:#66666e; font-size:9px; }
.sd-res{ font-family:var(--font-mono,monospace); font-size:9.5px; color:#8a8a92; text-align:center; line-height:1.45; }
.sd-res b{ color:#e8e8ea; font-weight:700; }
.sd-res-r{ color:var(--accent,#2E86C1); font-weight:700; }
.sd-res-r::before{ content:"·"; margin:0 5px; color:#55555c; }
.sd-res2{ display:block; font-size:8.5px; color:#6c6c74; margin-top:1px; }
.sd-cell-floor{ margin-top:2px; }
.sd-floorbox{ position:relative; min-width:20px; min-height:16px; margin-top:14px; }
.sd-floorbox.trap{ outline:1.5px dashed rgba(255,255,255,0.45); }
.sd-floor{ position:absolute; inset:0; width:100%; height:100%; background:linear-gradient(160deg,#33a08e,#237567); display:flex; align-items:center; justify-content:center; }
.sd-masknote{ position:absolute; top:-15px; left:50%; transform:translateX(-50%); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9px; letter-spacing:.04em; color:rgba(255,255,255,0.5); }
.sd-cellin-floor{ flex-direction:row; flex-wrap:wrap; justify-content:center; gap:5px 8px; align-items:center; max-width:560px; }
.sd-safe{ position:absolute; top:10%; bottom:10%; left:10%; right:10%; border:1.5px dashed #FFB547; pointer-events:none; }
.sd-safe span{ position:absolute; top:3px; left:50%; transform:translateX(-50%); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9px; color:#FFB547; text-shadow:0 1px 2px rgba(0,0,0,.6); }
.sd-safekey{ display:flex; align-items:center; gap:7px; font-size:10.5px; color:#a7a7ad; }
.sd-safekey i{ width:18px; border-top:1.5px dashed #FFB547; }
.sd-note{ font-size:11px; line-height:1.45; color:#ffcf9e; border:1px solid #4a3a22; background:#1c150c; border-radius:8px; padding:8px 10px; }

.sd-tabs{ display:flex; gap:4px; padding:3px; background:#101014; border:1px solid #232329; border-radius:999px; margin-right:auto; }
.sd-head > .sd-btn.ghost{ padding:10px 16px; }
.sd-tab{ background:transparent; border:none; color:#a7a7ad; font-size:12px; font-weight:600; padding:7px 14px; border-radius:999px; cursor:pointer; transition:background .15s, color .15s; }
.sd-tab:hover{ color:#fff; }
.sd-tab.on{ background:#232329; color:#fff; box-shadow:inset 0 0 0 1px var(--accent,#2E86C1); }
.sd-curvein{ display:flex; flex-wrap:wrap; justify-content:center; gap:10px 16px; width:100%; padding:16px 12px 12px; background:rgba(var(--accent-rgb,46,134,193),.07); border:1px solid rgba(var(--accent-rgb,46,134,193),.38); border-radius:12px; position:relative; margin-top:8px; }
.sd-curvein{ display:grid !important; grid-template-columns:repeat(4, minmax(0, 1fr)); align-items:end; gap:12px 16px !important; }
.sd-curvein label .sd-input-wrap input[type=text]{ text-align:right; }
@media (max-width:760px){ .sd-curvein{ grid-template-columns:repeat(2, minmax(0, 1fr)); } }
.sd-curvein label{ display:flex; flex-direction:column; align-items:stretch; gap:6px; min-width:0; }
.sd-curvein .sd-cellin-lbl{ display:flex; flex-direction:column; gap:1px; text-align:left; font-size:12px; }
.sd-curvein .sd-cellin-lbl em{ font-size:10px; color:#8a8a94; }
.sd-curvein .sd-input-wrap{ width:100%; }
.sd-curvein .sd-input-wrap input{ flex:1; width:auto; min-width:0; font-size:17px; padding:9px 8px 9px 12px; }
.sd-flat{ position:relative; overflow:hidden; background:linear-gradient(160deg,#4576b8,#2f5990); border-radius:4px; box-shadow:0 5px 18px rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; min-width:40px; min-height:20px; margin-top:6px; }
.sd-vbox{ position:absolute; top:-4px; bottom:-4px; border:2px dashed #A855F7; background:rgba(168,85,247,.16); border-radius:3px; pointer-events:none; box-sizing:border-box; z-index:3; }
.sd-vbox.bad{ border-color:#ff5a5a; background:rgba(255,90,90,.14); }
.sd-vbox span{ position:absolute; top:3px; left:50%; transform:translateX(-50%); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9.5px; font-weight:700; color:#fff; background:#A855F7; padding:1px 6px; border-radius:4px; }
.sd-vbox.bad span{ background:#e5484d; }
.sd-bbox{ position:absolute; border:2px dashed #FF7A1A; background:rgba(255,122,26,.07); border-radius:4px; pointer-events:none; box-sizing:border-box; z-index:2; }
.sd-bbox span{ position:absolute; bottom:-17px; left:50%; transform:translateX(-50%); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9.5px; font-weight:700; color:#fff; background:#FF7A1A; padding:1px 6px; border-radius:4px; }
.sd-bleed{ width:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:10px; padding:12px; border-radius:12px;
  background:rgba(255,122,26,.05); border:1px solid rgba(255,122,26,.35); }
.sd-bleed.on{ background:rgba(255,122,26,.08); border-color:rgba(255,122,26,.6); }
.sd-bleed-h{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:center; cursor:pointer; }
.sd-bleed-h input{ width:17px; height:17px; accent-color:#FF7A1A; cursor:pointer; margin:0; }
.sd-bleed-h b{ font-size:13px; color:#f0f0f3; display:flex; align-items:center; gap:7px; }
.sd-bleed-h b i{ width:12px; height:12px; border-radius:3px; border:2px dashed #FF7A1A; }
.sd-bleed-h span{ font-size:11px; color:#9a9aa3; }
.sd-bleed-in{ display:flex; align-items:center; gap:8px; font-size:12px; color:#d6d6db; }
.sd-bleed-in em{ font-style:normal; color:#9a9aa3; font-size:11px; }
.sd-input-b{ border-color:rgba(255,122,26,.6) !important; box-shadow:0 0 0 3px rgba(255,122,26,.1) !important; }
.sd-input-b:focus-within{ border-color:#FF7A1A !important; box-shadow:0 0 0 4px rgba(255,122,26,.28) !important; }
.sd-input-b input{ width:56px; }
.sd-input-b b{ color:#ffa25e !important; }
.sd-bleed-r{ max-width:560px; font-size:12px; line-height:1.5; text-align:center; color:#ffd9bd; background:rgba(255,122,26,.12); border:1px solid rgba(255,122,26,.45); border-radius:8px; padding:8px 12px; }
.sd-bleed-r b{ color:#fff; }
.sd-vtest{ width:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:10px; padding:14px 12px 12px; border-radius:12px; position:relative; margin-top:8px;
  background:rgba(168,85,247,.07); border:1px solid rgba(168,85,247,.4); }
.sd-vtest-h{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; justify-content:center; }
.sd-vtest-h b{ font-size:13px; color:#f0f0f3; display:flex; align-items:center; gap:7px; }
.sd-vtest-h b i{ width:12px; height:12px; border-radius:3px; border:2px dashed #A855F7; }
.sd-vtest-h span{ font-size:11px; color:#9a9aa3; }
.sd-vtest-in{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; }
.sd-vtest-x{ color:#9a9aa3; font-size:14px; }
.sd-input-v{ border-color:rgba(168,85,247,.6) !important; box-shadow:0 0 0 3px rgba(168,85,247,.1) !important; }
.sd-input-v:focus-within{ border-color:#A855F7 !important; box-shadow:0 0 0 4px rgba(168,85,247,.28) !important; }
.sd-input-v input{ width:84px; }
.sd-input-v b{ color:#c18cfa !important; }
.sd-vfit{ max-width:560px; font-size:12px; line-height:1.5; border-radius:8px; padding:8px 12px; text-align:center; }
.sd-vfit.ok{ color:#e3cffd; background:rgba(168,85,247,.14); border:1px solid rgba(168,85,247,.45); }
.sd-vfit.bad{ color:#ffd0d0; background:rgba(229,72,77,.14); border:1px solid rgba(229,72,77,.55); font-weight:600; }
.sd-tlfit{ position:relative; margin:6px 0 2px; }
.sd-tl{ position:absolute; top:0; }
.sd-tl-p{ position:absolute; box-sizing:border-box; background:#3a4f6b; border:1px solid rgba(255,255,255,.35); display:flex; align-items:center; justify-content:center; }
.sd-tl-p.c{ background:#2f6fa8; }
.sd-tl-p.f{ background:#237567; }
.sd-tl-p span{ font-size:9px; color:rgba(255,255,255,.8); font-family:var(--font-mono,monospace); }
.sd-tlfit .sd-vbox{ top:0; bottom:0; }
.sd-flatwrap{ position:relative; margin:8px 0 30px; }
.sd-flatwrap .sd-flat{ overflow:visible; }
.sd-flatwrap .sd-flat{ margin-top:0; width:100% !important; height:100% !important; }
.sd-frame{ position:absolute; top:0; bottom:0; background:rgba(255,59,59,.18); border:1.5px dashed rgba(255,77,77,.85); box-sizing:border-box; }
.sd-frame span{ position:absolute; top:calc(100% + 4px); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9px; line-height:1.35; color:#ff8a8a; display:flex; flex-direction:column; }
.sd-frame span b{ font-size:10.5px; color:#ff6b6b; }
.sd-frame.l span{ left:0; align-items:flex-start; }
.sd-frame.r span{ right:0; align-items:flex-end; }
.sd-proj{ position:absolute; top:0; bottom:0; background:rgba(255,255,255,.05); border-left:1px solid rgba(255,255,255,.55); border-right:1px solid rgba(255,255,255,.55); display:flex; align-items:flex-end; justify-content:center; }
.sd-proj.odd{ background:rgba(255,255,255,.1); top:6%; bottom:6%; }
.sd-proj span{ position:absolute; left:0; right:0; bottom:13%; text-align:center; white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9.5px; font-weight:700; color:rgba(255,255,255,.8); }
.sd-blend{ position:absolute; top:0; bottom:0; background:repeating-linear-gradient(45deg, rgba(255,207,158,.28) 0 4px, transparent 4px 8px); pointer-events:none; }
.sd-topview{ display:flex; flex-direction:column; align-items:center; gap:4px; }
.sd-topview svg{ height:auto; max-height:150px; overflow:visible; }
/* palco da ficha em PDF: atrás da página (z-index -1), em tamanho natural 1:1 */
.sd-pdfstage{ position:fixed; left:0; top:0; width:1280px; height:905px; z-index:-1; pointer-events:none; overflow:hidden; }
.sd-btn{ background:var(--accent,#2E86C1); color:#fff; border:1px solid transparent; border-radius:999px; padding:10px 18px; font-size:12.5px; font-weight:600; cursor:pointer; transition:filter .15s, background .15s, opacity .15s; white-space:nowrap; font-family:inherit; }
.sd-btn:hover{ filter:brightness(1.08); }
.sd-btn:disabled{ opacity:.5; cursor:default; }
.sd-btn.ghost{ background:transparent; color:#e6e6ea; border-color:#34343d; }
.sd-btn.ghost:hover{ background:#1a1a20; filter:none; }
.sd-btn.sm{ padding:6px 12px; font-size:11.5px; }
.sd-btn.danger{ background:#c0392b; }
.sd-btn.danger-t{ color:#ff8a80; }
.sd-text{ width:100%; box-sizing:border-box; background:#1a1a21; border:1.5px solid rgba(var(--accent-rgb,46,134,193),.55); border-radius:9px; color:#fff; font-size:14px; padding:10px 12px; outline:none; font-family:inherit; transition:border-color .15s, box-shadow .15s; }
.sd-text:focus{ border-color:var(--accent,#2E86C1); box-shadow:0 0 0 4px rgba(var(--accent-rgb,46,134,193),.25); }
.sd-text::placeholder{ color:#6d7784; }
.sd-field{ display:flex; flex-direction:column; gap:6px; }
.sd-field-lbl{ font-family:var(--font-mono,monospace); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#a7a7ad; }
.sd-err{ color:#ff8a80; font-size:12px; }
.sd-modal-bg{ position:fixed; inset:0; z-index:50; background:rgba(4,4,6,.72); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; }
.sd-modal{ width:min(440px,100%); box-sizing:border-box; background:#111116; border:1px solid #2a2a33; border-radius:16px; padding:18px 20px 20px; display:flex; flex-direction:column; gap:14px; box-shadow:0 24px 60px rgba(0,0,0,.6); }
.sd-modal-h{ display:flex; align-items:center; justify-content:space-between; }
.sd-modal-h b{ font-size:16px; }
.sd-x{ background:none; border:none; color:#9a9aa3; font-size:22px; line-height:1; cursor:pointer; padding:2px 6px; }
.sd-x:hover{ color:#fff; }
.sd-modal-note{ font-size:12px; color:#9a9aa3; line-height:1.45; }
.sd-modal-login{ display:flex; flex-direction:column; gap:10px; padding:12px; border-radius:12px; background:#0b0b0e; border:1px solid #24242b; }
.sd-modal-f{ display:flex; justify-content:flex-end; gap:8px; margin-top:4px; flex-wrap:wrap; }
.sd-login{ display:flex; flex-direction:column; gap:6px; }
.sd-login-row{ display:flex; gap:8px; }
.sd-login-row .sd-text{ flex:1; }
.sd-drawer{ position:fixed; top:0; right:0; bottom:0; width:min(460px,100%); box-sizing:border-box; background:#0f0f13; border-left:1px solid #26262e; padding:18px 18px 20px; display:flex; flex-direction:column; gap:12px; overflow:auto; box-shadow:-20px 0 50px rgba(0,0,0,.5); }
.sd-drawer-empty{ color:#9a9aa3; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:12px; padding:6px 0; }
.sd-drawer-empty p{ margin:0; }
.sd-list{ display:flex; flex-direction:column; gap:10px; }
.sd-item{ background:#15151b; border:1px solid #26262e; border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:6px; }
.sd-item.on{ border-color:var(--accent,#2E86C1); }
.sd-item-t{ display:flex; flex-direction:column; gap:1px; }
.sd-item-t b{ font-size:14.5px; }
.sd-item-t span{ font-size:13px; color:#c9c9cf; }
.sd-item-m{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11.5px; color:#9a9aa3; font-family:var(--font-mono,monospace); }
.sd-chip{ padding:2px 8px; border-radius:999px; background:rgba(var(--accent-rgb,46,134,193),.15); color:var(--accent,#2E86C1); font-size:10px; letter-spacing:.06em; text-transform:uppercase; }
.sd-item-d{ font-size:11px; color:#6f6f78; }
.sd-item-a{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px; }
.sd-editing{ max-width:var(--sd-w); width:100%; box-sizing:border-box; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:8px 14px; border-radius:10px;
  background:rgba(var(--accent-rgb,46,134,193),.1); border:1px solid rgba(var(--accent-rgb,46,134,193),.4); font-size:12.5px; color:#dcdce2; }
.sd-toast{ position:fixed; left:50%; bottom:22px; transform:translateX(-50%); z-index:60; background:#1b1b22; border:1px solid #33333d; color:#f0f0f3; padding:10px 16px; border-radius:10px; font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.5); max-width:calc(100% - 32px); }
.sd-3dsection{ padding:14px 14px 10px; display:flex; flex-direction:column; }
.sd-3dtitle{ font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:#c9c9cf; margin-bottom:10px; }
.sd-3dwrap{ position:relative; border-radius:10px; overflow:hidden; background:#0a0a0c; border:1px solid #202027; flex:1; min-height:250px; }
.sd-3dcanvas{ width:100%; height:100%; min-height:250px; }
.sd-3dmsg{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#8a8a92; font-size:12.5px; }
.sd-3dhint{ position:absolute; bottom:8px; right:10px; font-family:var(--font-mono,monospace); font-size:10px; letter-spacing:.06em; color:rgba(255,255,255,.5); pointer-events:none; }

.sd-indicators{ display:grid; grid-template-columns:repeat(6,1fr); gap:9px; }
.sd-ind-safe{ border-color:rgba(255,181,71,.45); }
.sd-ind-safe .sd-ind-lbl{ color:#FFB547; }
@media (max-width:820px){ .sd-indicators{ grid-template-columns:repeat(3,1fr); } }
@media (max-width:520px){ .sd-indicators{ grid-template-columns:repeat(2,1fr); } }
.sd-ind{ background:#101014; border:1px solid #232329; border-radius:12px; padding:9px 12px; }
.sd-ind-lbl{ font-size:9.5px; text-transform:uppercase; letter-spacing:0.08em; color:#8a8a92; margin-bottom:5px; min-height:22px; }
.sd-ind-val{ font-size:clamp(17px,2vw,23px); font-weight:700; font-variant-numeric:tabular-nums; color:#fff; letter-spacing:-0.01em; }
.sd-ind-sub{ margin-top:4px; font-size:10.5px; color:#77777f; font-variant-numeric:tabular-nums; }

/* ── Acabamento (visual minimalista) ─────────────────────────────────────────
   Só cor, borda, vidro e tipografia — posições e tamanhos continuam os de
   cima. Fundo: ondas de partículas (SDParticleWave), fixo atrás de tudo. */
.sd-page{ --sd-line:rgba(255,255,255,.08); --sd-line-2:rgba(255,255,255,.14); --sd-glass:rgba(12,13,17,.5); --sd-mute:#8b8f99;
  --sd-text:#eef0f4; --sd-ac:var(--accent,#2E86C1); background:transparent; position:relative; isolation:isolate;
  font-feature-settings:"cv11","ss01"; -webkit-font-smoothing:antialiased; }
/* blur leve no fundo; o scale cobre a borda que o blur deixa mais clara */
.sd-bgwave{ position:fixed; inset:0; width:100vw; height:100vh; z-index:-2; pointer-events:none; display:block; background:#050507; filter:blur(1.6px); transform:scale(1.02); }
.sd-page::before{ content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
  background:radial-gradient(130% 100% at 50% 10%, rgba(5,5,7,0) 0%, rgba(5,5,7,.15) 60%, rgba(5,5,7,.55) 100%); }

/* cabeçalho */
.sd-head{ border-bottom:1px solid var(--sd-line); padding-bottom:12px; }
.sd-tabs{ background:rgba(255,255,255,.04); border-color:var(--sd-line); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
.sd-tab{ color:var(--sd-mute); font-weight:500; letter-spacing:.01em; }
.sd-tab.on{ background:rgba(255,255,255,.1); color:#fff; box-shadow:none; }
.sd-btn.ghost{ border-color:var(--sd-line-2); color:#dfe2e8; background:rgba(255,255,255,.02); font-weight:500; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
.sd-btn.ghost:hover{ background:rgba(255,255,255,.08); }
.sd-export{ background:#f4f5f7; color:#0b0c0f; font-weight:600; box-shadow:0 6px 24px rgba(255,255,255,.08); }
.sd-export:hover{ filter:none; background:#fff; }

/* painéis de vidro */
.sd-stage, .sd-3dsection, .sd-ind{ background:var(--sd-glass); border:1px solid var(--sd-line); border-radius:16px;
  backdrop-filter:blur(18px) saturate(130%); -webkit-backdrop-filter:blur(18px) saturate(130%); box-shadow:0 1px 0 rgba(255,255,255,.04) inset, 0 20px 50px rgba(0,0,0,.35); }
.sd-3dtitle{ font-size:10.5px; letter-spacing:.16em; color:var(--sd-mute); font-weight:500; }
.sd-3dwrap{ background:#08090c; border-color:var(--sd-line); border-radius:12px; }

/* blocos internos: neutros, sem caixas coloridas */
.sd-altrow, .sd-curvein{ background:rgba(255,255,255,.025); border:1px solid var(--sd-line); border-radius:14px; }
.sd-altrow::before, .sd-curvein::before{ content:"Medidas"; background:none; color:var(--sd-mute); font-family:inherit; font-size:10px; letter-spacing:.16em;
  font-weight:600; padding:0 6px; top:-7px; background:transparent; text-shadow:0 0 8px #07080a, 0 0 4px #07080a; }
.sd-altrow-lbl{ font-weight:500; color:var(--sd-text); }
.sd-altrow-lbl em{ color:var(--sd-mute); }
.sd-cellin{ background:transparent; border:1px solid transparent; }
.sd-cellin-lbl{ color:#c9ccd3; font-weight:500; }
.sd-cellin-lbl em{ color:#6b6f79; }
.sd-res{ color:#7d818b; }
.sd-res b{ color:#e6e8ec; font-weight:600; }
.sd-res-r{ color:#9fb4cc; font-weight:600; }

/* campos: discretos até o foco */
.sd-input-wrap{ background:rgba(255,255,255,.04); border:1px solid var(--sd-line-2); border-radius:10px; box-shadow:none; }
.sd-input-wrap:hover{ background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.22); }
.sd-input-wrap:focus-within{ background:rgba(255,255,255,.07); border-color:rgba(var(--accent-rgb,46,134,193),.9); box-shadow:0 0 0 3px rgba(var(--accent-rgb,46,134,193),.18); }
.sd-input-wrap input{ font-weight:600; letter-spacing:-.01em; }
.sd-input-wrap input::placeholder{ color:#5f636d; }
.sd-input-wrap b{ color:#7d818b; font-weight:500; }

/* as telas: planos sóbrios, com a central em destaque pela borda */
.sd-screen, .sd-flat{ background:linear-gradient(180deg, rgba(120,146,190,.30), rgba(80,104,145,.22)); border:1px solid rgba(160,185,225,.28); border-radius:6px; box-shadow:none; }
.sd-screen-c{ background:linear-gradient(180deg, rgba(var(--accent-rgb,46,134,193),.45), rgba(var(--accent-rgb,46,134,193),.28)); border-color:rgba(var(--accent-rgb,46,134,193),.95); outline:none; }
.sd-screen-lbl{ font-weight:600; font-size:11px; letter-spacing:.04em; text-shadow:none; color:rgba(255,255,255,.92); }
.sd-floor{ background:linear-gradient(180deg, rgba(56,178,156,.32), rgba(36,130,114,.22)); border:1px solid rgba(90,210,185,.35); box-sizing:border-box; }
.sd-floorbox.trap{ outline:1px dashed rgba(255,255,255,.25); }
.sd-masknote{ color:rgba(255,255,255,.42); }
.sd-safe{ border:1px dashed rgba(255,181,71,.7); }
.sd-safekey{ color:#8b8f99; }
.sd-safekey i{ border-top:1px dashed rgba(255,181,71,.8); }

/* testar vídeo e sangria: neutros, a cor fica só no marcador */
.sd-vtest, .sd-bleed, .sd-bleed.on{ background:rgba(255,255,255,.025); border:1px solid var(--sd-line); border-radius:14px; }
.sd-vtest-h b, .sd-bleed-h b{ font-weight:600; color:var(--sd-text); }
.sd-vtest-h span, .sd-bleed-h span, .sd-bleed-in em{ color:var(--sd-mute); }
.sd-vtest-h b i, .sd-bleed-h b i{ width:9px; height:9px; border-width:1.5px; }
.sd-input-v, .sd-input-b{ border-color:var(--sd-line-2) !important; box-shadow:none !important; }
.sd-input-v:focus-within{ border-color:rgba(168,85,247,.85) !important; box-shadow:0 0 0 3px rgba(168,85,247,.18) !important; }
.sd-input-b:focus-within{ border-color:rgba(255,122,26,.85) !important; box-shadow:0 0 0 3px rgba(255,122,26,.18) !important; }
.sd-input-v b, .sd-input-b b{ color:#7d818b !important; }
.sd-vfit, .sd-bleed-r{ border-radius:10px; }
.sd-tl-p{ background:rgba(120,146,190,.25); border-color:rgba(255,255,255,.18); }
.sd-tl-p.c{ background:rgba(var(--accent-rgb,46,134,193),.4); }
.sd-tl-p.f{ background:rgba(56,178,156,.28); }

/* unidade das medidas, sala simples e proporção */
.sd-altrow-2{ flex-basis:100%; display:flex; align-items:center; justify-content:center; gap:10px 14px; flex-wrap:wrap; margin-top:2px; }
.sd-altrow-k{ font-size:11px; color:var(--sd-mute); }
.sd-altrow-n{ flex-basis:100%; text-align:center; font-size:10.5px; line-height:1.45; color:var(--sd-mute); }
.sd-units{ display:inline-flex; padding:2px; gap:2px; border-radius:999px; background:rgba(255,255,255,.04); border:1px solid var(--sd-line-2); }
.sd-units button{ background:transparent; border:none; color:var(--sd-mute); font:inherit; font-size:11.5px; font-weight:500; padding:5px 11px; border-radius:999px; cursor:pointer; transition:background .15s, color .15s; }
.sd-units button:hover{ color:#fff; }
.sd-units button.on{ background:rgba(255,255,255,.12); color:#fff; }
.sd-check{ display:inline-flex; align-items:center; gap:7px; cursor:pointer; padding:5px 12px; border-radius:999px; border:1px solid var(--sd-line-2); background:rgba(255,255,255,.02); }
.sd-check input{ width:15px; height:15px; margin:0; cursor:pointer; accent-color:var(--sd-ac); }
.sd-check b{ font-size:12px; font-weight:600; color:var(--sd-text); }
.sd-check span{ font-size:10.5px; color:var(--sd-mute); }
.sd-input-p input{ text-align:center; }
.sd-curvein-u{ grid-column:1 / -1; display:flex; align-items:center; gap:8px 12px; flex-wrap:wrap; }
.sd-curvein-u .sd-altrow-n{ flex-basis:auto; text-align:left; }
.sd-ovinfo{ grid-column:1 / -1; font-size:11.5px; line-height:1.5; color:var(--sd-mute); text-align:center; padding:7px 10px; border-radius:10px; border:1px dashed var(--sd-line-2); }
.sd-ovinfo.on{ color:#f0d7b8; border-color:rgba(255,207,158,.45); background:rgba(255,207,158,.06); }
.sd-ovinfo b{ color:#fff; font-weight:600; }
.sd-prop{ display:flex; align-items:stretch; justify-content:center; gap:10px; flex-wrap:wrap; width:100%; }
.sd-prop > div{ display:flex; align-items:baseline; gap:9px; padding:7px 14px; border-radius:12px; background:rgba(255,255,255,.03); border:1px solid var(--sd-line); }
.sd-prop em{ font-style:normal; font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--sd-mute); }
.sd-prop b{ font-size:19px; font-weight:600; letter-spacing:-.02em; color:#fff; font-variant-numeric:tabular-nums; }
.sd-prop span{ font-family:var(--font-mono,monospace); font-size:10px; color:#7d818b; }
.sd-blend{ background:linear-gradient(90deg, rgba(255,207,158,.08), rgba(255,207,158,.5) 50%, rgba(255,207,158,.08)); border-left:1px dashed rgba(255,207,158,.8); border-right:1px dashed rgba(255,207,158,.8); z-index:2; }
.sd-blend span{ position:absolute; top:calc(100% + 3px); left:50%; transform:translateX(-50%); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9px; color:#ffcf9e; }
.sd-vtest-r{ font-family:var(--font-mono,monospace); font-size:11px; color:#c18cfa; }

/* preview do vídeo com a imagem de teste: arrastar as bordas estica */
/* o 3D acompanha a rolagem: dá para arrastar o vídeo no preview e ver a sala ao mesmo tempo */
@media (min-width:901px){ .sd-3dsection{ align-self:start; position:sticky; top:10px; } .sd-3dwrap{ flex:none; height:min(62vh, 560px); } }
.sd-stretch{ width:100%; display:flex; flex-direction:column; align-items:center; gap:8px; }
.sd-stretch-box{ position:relative; overflow:hidden; border-radius:8px; background:repeating-linear-gradient(45deg, #0b0c10 0 8px, #111219 8px 16px); border:1px solid var(--sd-line-2); touch-action:none; user-select:none; }
.sd-stretch-box img{ position:absolute; top:0; height:100%; max-width:none; display:block; pointer-events:none; -webkit-user-drag:none; }
.sd-stretch-orig{ position:absolute; top:0; bottom:0; width:0; border-left:1px dashed rgba(255,255,255,.75); pointer-events:none; }
.sd-stretch-pct{ position:absolute; top:6px; left:50%; transform:translateX(-50%); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; color:#fff; background:rgba(168,85,247,.92); padding:2px 9px; border-radius:6px; pointer-events:none; }
.sd-stretch-pct.bad{ background:rgba(229,72,77,.95); }
.sd-stretch-h{ position:absolute; top:0; bottom:0; width:22px; margin-left:-11px; cursor:ew-resize; display:flex; align-items:center; justify-content:center; z-index:2; }
.sd-stretch-h::before{ content:""; position:absolute; top:0; bottom:0; left:50%; width:3px; margin-left:-1.5px; background:#A855F7; box-shadow:0 0 0 1px rgba(0,0,0,.45); }
.sd-stretch-h b{ position:relative; width:12px; height:34px; border-radius:6px; background:#A855F7; box-shadow:0 0 0 1px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.5); }
.sd-stretch-h.bad::before, .sd-stretch-h.bad b{ background:#e5484d; }
.sd-stretch-h:hover b{ filter:brightness(1.2); }
.sd-stretch-bar{ display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; font-size:12px; color:#d6d6db; }
.sd-stretch-bar em{ flex-basis:100%; text-align:center; font-style:normal; font-size:10.5px; color:var(--sd-mute); }
.sd-stretch-bar .sd-input-v input{ width:58px; }

/* indicadores */
.sd-ind{ padding:12px 14px; }
.sd-ind-lbl{ font-size:9.5px; letter-spacing:.14em; color:var(--sd-mute); font-weight:500; }
.sd-ind-val{ font-weight:600; letter-spacing:-.02em; color:#fff; }
.sd-ind-sub{ color:#6f737d; }
.sd-ind-safe{ border-color:rgba(255,181,71,.25); }
.sd-ind-safe .sd-ind-lbl{ color:#e0a54a; }

/* modais, gaveta e avisos no mesmo vidro */
.sd-modal, .sd-drawer{ background:rgba(14,15,19,.86); border-color:var(--sd-line); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
.sd-item{ background:rgba(255,255,255,.03); border-color:var(--sd-line); }
.sd-toast{ background:rgba(20,21,26,.9); border-color:var(--sd-line-2); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
.sd-editing{ background:rgba(255,255,255,.04); border-color:var(--sd-line-2); }
`;
