/* screendimension.jsx — Configurador de Sala Imersiva (/screendimension)
   Ferramenta pura (sem banco). Regra base: a ALTURA da projeção é sempre 1080px;
   a partir dela (escala = 1080 / altura_em_metros) calculamos a largura em pixels
   de cada projeção. O chão tem medidas próprias (base/topo/profundidade) e pode
   descolar das paredes, gerando formatos que não fecham uma caixa perfeita.       */

const SD_MAX_H      = 1080;   // altura de projeção fixa (px)
const SD_FLOOR_BASE = 1920;   // limite da base do chão (px)

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
  return `${(w / h).toFixed(2)}:1`;                     // decimal quando não reduz bonito
};

/* Carrega um script externo uma única vez (Three.js / libs de PDF sob demanda). */
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
const SDPreview3D = ({ res }) => {
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
        setReady(true);

        let dragging = false, px = 0, py = 0;
        const down = (e) => { dragging = true; px = e.clientX; py = e.clientY; renderer.domElement.style.cursor = "grabbing"; e.target.setPointerCapture?.(e.pointerId); };
        const move = (e) => { if (!dragging) return; const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY; ctl.theta -= dx * 0.008; ctl.phi = Math.max(0.15, Math.min(Math.PI - 0.15, ctl.phi - dy * 0.008)); };
        const up = () => { dragging = false; renderer.domElement.style.cursor = "grab"; };
        const wheel = (e) => { e.preventDefault(); ctl.dist = Math.max(2, Math.min(120, ctl.dist * (1 + Math.sign(e.deltaY) * 0.1))); };
        renderer.domElement.addEventListener("pointerdown", down);
        renderer.domElement.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
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

        three.current.cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          window.removeEventListener("pointerup", up);
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

  function buildRoom() {
    const t = three.current; if (!t.THREE) return;
    const THREE = t.THREE, grp = t.roomGroup;
    while (grp.children.length) { const c = grp.children.pop(); c.geometry?.dispose?.(); c.material?.map?.dispose?.(); c.material?.dispose?.(); }
    const r = propsRef.current.res || {};
    // O 3D é montado pela RESOLUÇÃO (px), não pelos metros — assim o visual mantém a
    // proporção exata de cada tela (1920×1080 parece 16:9; 1080×1080 parece quadrado).
    const W = 0.0016;   // escala pixel → unidade de mundo
    const Wc=(r.Wc||1920)*W, Ws=(r.Ws||1920)*W, H=(r.H||1080)*W;
    const fTop=(r.fTop||1920)*W, fBase=(r.fBase||1920)*W, fDep=(r.fDepth||1080)*W;
    const base = Math.max(Wc, Ws, H, fBase, fDep, fTop);
    const accent = 0xE63946, blue = 0x3a7bd5, teal = 0x2a9d8f;
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
    quad(lFar, lNear, add(lNear,UP), add(lFar,UP), blue, 0.32);           // lateral E
    quad(rFar, rNear, add(rNear,UP), add(rFar,UP), blue, 0.32);           // lateral D
    quad(flFar, frFar, frNear, flNear, teal, 0.32);                       // piso

    // zonas de projetor: cada projetor entrega no máx. 1920px. Aparece quando precisa de +1.
    const zones = (c00,c10,c11,c01, widthPx, heightPx) => {
      const nc = Math.max(1, Math.ceil((widthPx||0)/1920));   // colunas (1920px)
      const nr = Math.max(1, Math.ceil((heightPx||0)/1080));  // linhas (1080px)
      if (nc < 2 && nr < 2) return;
      let k = 0;
      for (let j=0;j<nr;j++) for (let i=0;i<nc;i++){
        const u0=i/nc,u1=(i+1)/nc,v0=j/nr,v1=(j+1)/nr;
        const a0=bil(c00,c10,c11,c01,u0,v0), a1=bil(c00,c10,c11,c01,u1,v0), t1=bil(c00,c10,c11,c01,u1,v1), t0=bil(c00,c10,c11,c01,u0,v1);
        const g=new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...a0,...a1,...t1, ...a0,...t1,...t0]),3));
        const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:(i+j)%2?0.12:0.035, side:THREE.DoubleSide, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
        m.renderOrder=2; grp.add(m);
        const c=bil(c00,c10,c11,c01,(u0+u1)/2,(v0+v1)/2);
        put(`P${++k}`, c[0],c[1],c[2], "rgba(255,255,255,0.4)", 0.55);
      }
      for (let i=1;i<nc;i++){ const f=i/nc; line(bil(c00,c10,c11,c01,f,0), bil(c00,c10,c11,c01,f,1), 0xffffff, 0.6); }
      for (let j=1;j<nr;j++){ const f=j/nr; line(bil(c00,c10,c11,c01,0,f), bil(c00,c10,c11,c01,1,f), 0xffffff, 0.6); }
    };
    zones(wlBot, wrBot, [Wc/2,H,zFar], [-Wc/2,H,zFar], r.Wc, r.H);        // frontal
    zones(lFar, lNear, add(lNear,UP), add(lFar,UP), r.Ws, r.H);          // lateral E
    zones(rFar, rNear, add(rNear,UP), add(rFar,UP), r.Ws, r.H);         // lateral D
    zones(flFar, frFar, frNear, flNear, r.fBase, r.fDepth);              // piso

    // etiquetas de aresta (discretas)
    if (r.Wc)     put(`larg ${sdFmt(r.Wc)}`, 0, H, zFar);
    if (r.H)      put(`alt ${sdFmt(r.H)}`, -Wc/2, H/2, zFar);
    if (r.Ws)     put(`larg ${sdFmt(r.Ws)}`, (lFar[0]+lNear[0])/2, H, (lFar[2]+lNear[2])/2);
    if (r.Ws)     put(`larg ${sdFmt(r.Ws)}`, (rFar[0]+rNear[0])/2, H, (rFar[2]+rNear[2])/2);
    if (r.fBase)  put(`base ${sdFmt(r.fBase)}`, 0, 0.01, zNear);
    if (r.fDepth) put(`prof ${sdFmt(r.fDepth)}`, fBase*0.30, 0.01, midZ);

    // contorno pontilhado do "vídeo cheio" quando o piso é trapézio (execução usa máscara)
    if (r.fBase !== r.fTop) {
      const w2 = Math.max(fBase, fTop)/2, dash=(p1,p2)=>{ const seg=16; for(let i=0;i<seg;i+=2){ line(add(mul(sub(p2,p1),i/seg),p1), add(mul(sub(p2,p1),(i+1)/seg),p1), 0xffffff, 0.55); } };
      const c1=[-w2,0.006,zFar], c2=[w2,0.006,zFar], c3=[w2,0.006,zNear], c4=[-w2,0.006,zNear];
      dash(c1,c2); dash(c2,c3); dash(c3,c4); dash(c4,c1);
    }

    t.ctl.target.set(0, H/2, midZ);
    t.ctl.dist = base*2.1 + 1.5;
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
const SDScreen = ({ lbl, wpx, hpx, dispW, dispH, accent, dimLabel, inputEl }) => (
  <div className="sd-cell">
    <div className={`sd-screen ${accent ? "sd-screen-c" : ""}`} style={{ width: dispW, height: dispH }}>
      <span className="sd-screen-lbl">{lbl}</span>
    </div>
    <div className="sd-cellin"><span className="sd-cellin-lbl">{dimLabel} <em>(m)</em></span>{inputEl}</div>
    <div className="sd-res"><b>{sdFmt(wpx)} × {sdFmt(hpx)} px</b><span className="sd-res-r">{sdRatio(wpx, hpx)}</span></div>
  </div>
);

const SDIn = ({ value, onChange, placeholder }) => (
  <span className="sd-input-wrap">
    <input type="number" min="0" step="0.01" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    <b>m</b>
  </span>
);

/* ─────────────────────────── Página principal ───────────────────────────────── */
const ScreenDimensionPage = () => {
  const [A, setA] = React.useState("3");        // altura / pé-direito (m) — escala (já vem preenchida)
  const [L, setL] = React.useState("");        // largura frontal (m)
  const [P, setP] = React.useState("");        // profundidade das laterais (m)
  const [fBaseM, setFBaseM] = React.useState(""); // chão: base (m)
  const [fDepM,  setFDepM]  = React.useState(""); // chão: profundidade própria (m)
  // topo do chão = largura da tela central (sempre travados) → usa L
  const [exporting, setExporting] = React.useState(false);
  const sheetRef = React.useRef(null);
  const preview3dRef = React.useRef(null);

  const a = sdNum(A) || 3;                      // altura sempre tem valor (padrão 3) — nunca congela
  const ready = !!sdNum(A);                     // só pra saber se o usuário já digitou

  // valores resolvidos em metros (faltando → assume 16:9 / iguais às paredes)
  const def16 = a * 16 / 9;
  const lRes  = sdNum(L) || def16;
  const pRes  = sdNum(P) || def16;
  const baseRes = sdNum(fBaseM) || lRes;
  const topRes  = lRes;                      // topo do chão SEMPRE = largura central
  const depRes  = sdNum(fDepM)  || pRes;

  const R = React.useMemo(() => {
    const scale = SD_MAX_H / a;
    const Wc = Math.round(lRes * scale);
    const Ws = Math.round(pRes * scale);
    const fTop  = Math.round(topRes * scale);
    const fBase = Math.min(Math.round(baseRes * scale), SD_FLOOR_BASE);
    const fDepth = Math.round(depRes * scale);
    const frontTotalW = Ws * 2 + Wc;
    const timelineW = Math.max(frontTotalW, fBase, fTop);
    const timelineH = SD_MAX_H + fDepth;
    return { Wc, Ws, H: SD_MAX_H, fTop, fBase, fDepth, frontTotalW, timelineW, timelineH, scale, isDefault: false };
  }, [a, lRes, pRes, baseRes, depRes]);

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

  const exportPDF = async () => {
    setExporting(true);
    try {
      if (!window.html2canvas) await sdLoadScript("https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js");
      if (!window.jspdf)       await sdLoadScript("https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js");
      const canvas = await window.html2canvas(sheetRef.current, { backgroundColor: "#08080a", scale: 2, useCORS: true });
      const { jsPDF } = window.jspdf;
      const iw = canvas.width, ih = canvas.height;
      const pdf = new jsPDF({ orientation: iw >= ih ? "l" : "p", unit: "px", format: [iw, ih], compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, iw, ih);
      const cv3d = preview3dRef.current?.querySelector("canvas");
      if (cv3d) { try { pdf.addPage([cv3d.width, cv3d.height], cv3d.width >= cv3d.height ? "l" : "p"); pdf.addImage(cv3d.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, cv3d.width, cv3d.height); } catch (_) {} }
      pdf.save(`sala-imersiva${ready ? `-alt${Math.round(a)}m` : ""}.pdf`);
    } catch (e) {
      alert("Não foi possível gerar o PDF. Verifique a conexão e tente novamente.");
    } finally { setExporting(false); }
  };

  return (
    <div className="sd-page">
      <style>{SD_CSS}</style>

      <header className="sd-head">
        <h1 className="sd-title">screen<span className="sd-title-ac">dimension</span></h1>
        <button className="sd-export" onClick={exportPDF} disabled={exporting}>{exporting ? "Gerando…" : "Exportar PDF"}</button>
      </header>

      <div ref={sheetRef} className="sd-sheet">
        <div className="sd-main">
          {/* Telas abertas + inputs ao lado de cada tela */}
          <section className="sd-stage" ref={diagRef}>
            <div className="sd-altrow">
              <span className="sd-altrow-lbl">Altura de todas as telas <em>→ vira {SD_MAX_H}px</em></span>
              <span className="sd-input-wrap sd-input-lg"><input type="number" min="0" step="0.01" inputMode="decimal" value={A} placeholder="ex. 3" onChange={(e) => setA(e.target.value)} /><b>m</b></span>
              {!ready && <span className="sd-badge">comece pela altura</span>}
            </div>
            <div className="sd-wallrow">
              <SDScreen lbl="Lateral E" wpx={R.Ws} hpx={R.H} dispW={R.Ws * disp} dispH={R.H * disp}
                        dimLabel="Profundidade" inputEl={<SDIn value={P} onChange={setP} placeholder="prof." />} />
              <SDScreen lbl="Central" wpx={R.Wc} hpx={R.H} dispW={R.Wc * disp} dispH={R.H * disp} accent
                        dimLabel="Largura" inputEl={<SDIn value={L} onChange={setL} placeholder="larg." />} />
              <SDScreen lbl="Lateral D" wpx={R.Ws} hpx={R.H} dispW={R.Ws * disp} dispH={R.H * disp}
                        dimLabel="Profundidade" inputEl={<SDIn value={P} onChange={setP} placeholder="prof." />} />
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
                <span className="sd-cellin-lbl">Base <em>(m)</em></span><SDIn value={fBaseM} onChange={setFBaseM} placeholder={ready ? String(Math.round(lRes * 100) / 100) : "base"} />
                <span className="sd-cellin-lbl">Topo <em>🔒 = largura</em></span><SDIn value={L} onChange={setL} placeholder={ready ? String(Math.round(lRes * 100) / 100) : "topo"} />
                <span className="sd-cellin-lbl">Prof. <em>(m)</em></span><SDIn value={fDepM} onChange={setFDepM} placeholder={ready ? String(Math.round(pRes * 100) / 100) : "prof."} />
              </div>
              <div className="sd-res"><b>{sdFmt(R.fBase)} × {sdFmt(R.fDepth)} px</b><span className="sd-res-r">{sdRatio(R.fBase, R.fDepth)}</span>
                <span className="sd-res2">base {sdFmt(R.fBase)} · topo {sdFmt(R.fTop)}</span></div>
            </div>
            {ready && (R.Wc > 1920 || R.Ws > 1920) && <div className="sd-note warn">Alguma parede passou de 1920px — precisará de mais de um projetor por parede.</div>}
          </section>

          {/* Preview 3D com resoluções acompanhando a rotação */}
          <section className="sd-3dsection" ref={preview3dRef} data-html2canvas-ignore="true">
            <div className="sd-3dtitle">Preview 3D — resoluções acompanham a rotação</div>
            <SDPreview3D res={{ Wc: R.Wc, Ws: R.Ws, H: R.H, fBase: R.fBase, fTop: R.fTop, fDepth: R.fDepth }} />
          </section>
        </div>

        {/* Indicadores (seguem o cálculo ao vivo) */}
        <section className="sd-indicators">
          <div className="sd-ind"><div className="sd-ind-lbl">Tela do meio</div><div className="sd-ind-val">{sdFmt(R.Wc)}×{sdFmt(R.H)}</div><div className="sd-ind-sub">central · {sdRatio(R.Wc, R.H)}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Telas laterais</div><div className="sd-ind-val">{sdFmt(R.Ws)}×{sdFmt(R.H)}</div><div className="sd-ind-sub">cada uma (as duas iguais) · {sdRatio(R.Ws, R.H)}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Projeção frontal completa</div><div className="sd-ind-val">{sdFmt(R.frontTotalW)}×{sdFmt(R.H)}</div><div className="sd-ind-sub">{sdFmt(R.Ws)} + {sdFmt(R.Wc)} + {sdFmt(R.Ws)}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Chão</div><div className="sd-ind-val">{sdFmt(R.fBase)}×{sdFmt(R.fDepth)}</div><div className="sd-ind-sub">base {sdFmt(R.fBase)} · topo {sdFmt(R.fTop)} · {sdRatio(R.fBase, R.fDepth)}</div></div>
          <div className="sd-ind"><div className="sd-ind-lbl">Total (Timeline)</div><div className="sd-ind-val">{sdFmt(R.timelineW)}×{sdFmt(R.timelineH)}</div><div className="sd-ind-sub">{ready ? `escala ${R.scale.toFixed(1)} px/m` : "padrão"}</div></div>
        </section>
      </div>
    </div>
  );
};

const SD_CSS = `
.sd-page{ min-height:100vh; background:#08080a; color:#f2f2f4; font-family:var(--font-sans, 'Inter', system-ui, sans-serif);
  padding:14px clamp(14px,3vw,34px) 16px; display:flex; flex-direction:column; gap:9px; }
.sd-head{ display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; max-width:1320px; width:100%; margin:0 auto; padding-bottom:9px; border-bottom:1px solid #1e1e24; }
.sd-kicker{ font-family:var(--font-mono, monospace); font-size:10px; letter-spacing:0.26em; color:var(--accent,#E63946); margin-bottom:4px; }
.sd-title{ font-family:var(--font-mono,monospace); font-size:clamp(21px,2.6vw,30px); font-weight:800; letter-spacing:-0.01em; margin:0; color:#f4f4f6; }
.sd-title-ac{ color:var(--accent,#E63946); }
.sd-head-r{ display:flex; align-items:flex-end; gap:16px; }
.sd-altfield{ display:flex; flex-direction:column; gap:5px; }
.sd-altfield-lbl{ font-size:11.5px; color:#d6d6db; display:flex; gap:7px; align-items:baseline; }
.sd-altfield-lbl em{ font-style:normal; font-size:10px; color:#77777f; }
.sd-export{ flex-shrink:0; background:var(--accent,#E63946); color:#fff; border:none; border-radius:999px; padding:11px 20px; font-size:12.5px; font-weight:600; cursor:pointer; transition:filter .15s, opacity .15s; }
.sd-export:hover{ filter:brightness(1.08); }
.sd-export:disabled{ opacity:.55; cursor:default; }

.sd-hint{ max-width:1320px; width:100%; margin:0 auto; font-size:11.5px; line-height:1.5; color:#8a8a92; }
.sd-hint b{ color:#d6d6db; }
.sd-badge{ display:inline-block; margin-left:8px; font-family:var(--font-mono,monospace); font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:#ffcf9e; border:1px solid #4a3a22; background:#1c150c; border-radius:999px; padding:2px 8px; }

.sd-input-wrap{ display:inline-flex; align-items:center; background:#08080a; border:1px solid #2b2b33; border-radius:9px; overflow:hidden; transition:border-color .15s; }
.sd-input-wrap:focus-within{ border-color:var(--accent,#E63946); }
.sd-input-wrap input{ width:56px; background:transparent; border:none; outline:none; color:#fff; font-size:12px; padding:5px 5px 5px 8px; font-variant-numeric:tabular-nums; text-align:right; }
.sd-input-wrap b{ padding:0 7px 0 2px; color:#77777f; font-weight:500; font-size:10.5px; }
.sd-input-lg input{ width:100px; font-size:16px; padding:9px 8px 9px 12px; }

.sd-sheet{ max-width:1320px; width:100%; margin:0 auto; display:flex; flex-direction:column; gap:12px; }
.sd-main{ display:grid; grid-template-columns:1.55fr 1fr; gap:12px; align-items:stretch; }
@media (max-width:900px){ .sd-main{ grid-template-columns:1fr; } }

.sd-stage, .sd-3dsection{ background:#101014; border:1px solid #232329; border-radius:14px; }
.sd-stage{ padding:12px 14px 12px; display:flex; flex-direction:column; align-items:center; gap:10px; overflow:auto; }
.sd-altrow{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:center; width:100%; padding:8px 12px; background:#08080a; border:1px solid #2b2b33; border-radius:10px; }
.sd-altrow-lbl{ font-size:12.5px; color:#d6d6db; }
.sd-altrow-lbl em{ font-style:normal; color:var(--accent,#E63946); font-size:11px; }
.sd-wallrow{ display:flex; align-items:flex-start; justify-content:center; gap:10px; }
.sd-cell{ display:flex; flex-direction:column; align-items:center; gap:5px; }
.sd-screen{ position:relative; background:linear-gradient(160deg,#4576b8,#2f5990); border-radius:4px; box-shadow:0 5px 18px rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; min-width:20px; min-height:20px; }
.sd-screen-c{ background:linear-gradient(160deg,#e5474f,#bf2f3a); outline:2px solid #fff; outline-offset:2px; }
.sd-screen-lbl{ color:#fff; font-size:11px; font-weight:700; letter-spacing:.03em; text-shadow:0 1px 3px rgba(0,0,0,.45); }
.sd-cellin{ display:flex; flex-direction:column; align-items:center; gap:2px; }
.sd-cellin-lbl{ font-size:9.5px; color:#a7a7ad; }
.sd-cellin-lbl em{ font-style:normal; color:#66666e; font-size:9px; }
.sd-res{ font-family:var(--font-mono,monospace); font-size:9.5px; color:#8a8a92; text-align:center; line-height:1.45; }
.sd-res b{ color:#e8e8ea; font-weight:700; }
.sd-res-r{ color:var(--accent,#E63946); font-weight:700; }
.sd-res-r::before{ content:"·"; margin:0 5px; color:#55555c; }
.sd-res2{ display:block; font-size:8.5px; color:#6c6c74; margin-top:1px; }
.sd-cell-floor{ margin-top:2px; }
.sd-floorbox{ position:relative; min-width:20px; min-height:16px; margin-top:14px; }
.sd-floorbox.trap{ outline:1.5px dashed rgba(255,255,255,0.45); }
.sd-floor{ position:absolute; inset:0; width:100%; height:100%; background:linear-gradient(160deg,#33a08e,#237567); display:flex; align-items:center; justify-content:center; }
.sd-masknote{ position:absolute; top:-15px; left:50%; transform:translateX(-50%); white-space:nowrap; font-family:var(--font-mono,monospace); font-size:9px; letter-spacing:.04em; color:rgba(255,255,255,0.5); }
.sd-cellin-floor{ flex-direction:row; flex-wrap:wrap; justify-content:center; gap:5px 8px; align-items:center; max-width:560px; }
.sd-note{ font-size:11px; line-height:1.45; color:#ffcf9e; border:1px solid #4a3a22; background:#1c150c; border-radius:8px; padding:8px 10px; }

.sd-3dsection{ padding:14px 14px 10px; display:flex; flex-direction:column; }
.sd-3dtitle{ font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:#c9c9cf; margin-bottom:10px; }
.sd-3dwrap{ position:relative; border-radius:10px; overflow:hidden; background:#0a0a0c; border:1px solid #202027; flex:1; min-height:250px; }
.sd-3dcanvas{ width:100%; height:100%; min-height:250px; }
.sd-3dmsg{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#8a8a92; font-size:12.5px; }
.sd-3dhint{ position:absolute; bottom:8px; right:10px; font-family:var(--font-mono,monospace); font-size:10px; letter-spacing:.06em; color:rgba(255,255,255,.5); pointer-events:none; }

.sd-indicators{ display:grid; grid-template-columns:repeat(5,1fr); gap:9px; }
@media (max-width:820px){ .sd-indicators{ grid-template-columns:repeat(3,1fr); } }
@media (max-width:520px){ .sd-indicators{ grid-template-columns:repeat(2,1fr); } }
.sd-ind{ background:#101014; border:1px solid #232329; border-radius:12px; padding:9px 12px; }
.sd-ind-lbl{ font-size:9.5px; text-transform:uppercase; letter-spacing:0.08em; color:#8a8a92; margin-bottom:5px; min-height:22px; }
.sd-ind-val{ font-size:clamp(17px,2vw,23px); font-weight:700; font-variant-numeric:tabular-nums; color:#fff; letter-spacing:-0.01em; }
.sd-ind-sub{ margin-top:4px; font-size:10.5px; color:#77777f; font-variant-numeric:tabular-nums; }
`;
