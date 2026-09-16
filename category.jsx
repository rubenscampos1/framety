/* category.jsx */

/* Id do vídeo no YouTube, em qualquer endereço que ele use hoje: youtu.be/ID,
   watch?v=ID (mesmo com outros parâmetros antes), shorts/ID, live/ID, embed/ID
   e /v/ID.

   É a ÚNICA definição no site. O tutorial tinha a sua, carregada depois, e por
   isso ela vencia esta em todas as páginas — e não conhecia /shorts/. Sem id, o
   player não era montado, o botão de play não fazia nada e a capa automática
   não aparecia. */
const getYouTubeId = (url) => {
  if (!url) return null;
  const s = String(url);
  const m = s.match(/(?:youtube(?:-nocookie)?\.com\/(?:shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    || s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};
const getVimeoId = (url) => {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
};

/* Vídeo em pé (9:16). O console grava `vertical` no cadastro; quem veio de um
   Short e nunca passou pelo console é vertical por padrão, que é o que o
   formato do link diz. Onde a miniatura ou o player aparecem, esta resposta
   troca a proporção — ver a classe .v916 no styles.css. */
const ehVertical = (v) => !!v && (v.vertical === true ||
  (v.vertical == null && /\/shorts\//i.test(v.videoUrl || "")));
/* A capa gravada no vídeo pode ser uma imagem do próprio YouTube: os cadastros
   importados vieram assim, e o seletor de frame do console grava 1.jpg, 2.jpg
   ou 3.jpg — o quadro a um quarto, na metade e a três quartos do vídeo. Esses
   arquivos têm 120x90.

   O MESMO quadro existe maior, só trocando o prefixo: hq1 (480x360), sd1
   (640x480) e maxres1 (1280x720). Por isso a leitura abaixo separa o número do
   quadro do prefixo de tamanho — o quadro é a escolha de quem cadastrou e não
   pode mudar; o tamanho é com o site. */
const capaYoutube = (url) => {
  const s = String(url || "");
  const i = s.indexOf("img.youtube.com/vi/");
  if (i < 0) return null;
  const partes = s.slice(i + "img.youtube.com/vi/".length).split("/");
  const id = partes[0] || "";
  if (id.length !== 11) return null;
  const arquivo = (partes[1] || "").split("?")[0];
  const ponto = arquivo.lastIndexOf(".");
  const base = ponto > 0 ? arquivo.slice(0, ponto) : arquivo;   // maxres1 | hq1 | 1 | hqdefault
  const numero = base.slice(-1);
  const prefixo = base.slice(0, -1);
  const eQuadro = base.length > 0
    && ["1", "2", "3"].indexOf(numero) >= 0
    && ["", "hq", "mq", "sd", "maxres", "oar"].indexOf(prefixo) >= 0;
  return { id, arquivo, quadro: eQuadro ? numero : null };
};
const enderecoYt = (id, arquivo) => "https://img.youtube.com/vi/" + id + "/" + arquivo;
/* Do maior para o menor, sempre no mesmo quadro. */
const escadaYt = (id, quadro) => (quadro
  ? ["maxres" + quadro, "sd" + quadro, "hq" + quadro]
  : ["maxresdefault", "sddefault", "hqdefault"]).map(f => enderecoYt(id, f + ".jpg"));

/* Short guarda a capa também no formato original, em oardefault/oar1..3
   (1080×1920). As hqdefault/hq1..3 de um Short vêm 4:3 com as tarjas pretas
   queimadas na imagem — é de lá que vinham as barras nos cards. */
const ehShortYt = (v) => /\/shorts\//i.test(String((v && v.videoUrl) || ""));
/* Nem todo vídeo em pé veio de um link /shorts/. Quem confirma é o servidor,
   que mede a capa original no YouTube e grava `capaEmPe` (ver medeFormatoYoutube
   no server.js); o link de Short serve de resposta imediata para cadastro
   recém-feito, antes de a medição terminar. */
const temCapaEmPe = (v) => !!v && (v.capaEmPe === true || (v.capaEmPe == null && ehShortYt(v)));
const capaEmPe = (id, quadro) => enderecoYt(id, (quadro ? "oar" + quadro : "oardefault") + ".jpg");

const getThumbUrl = (v, largura = 800) => {
  const capa = capaYoutube(v.thumbUrl);
  if (capa && temCapaEmPe(v)) return capaEmPe(capa.id, capa.quadro);
  if (capa) {
    /* hq1/hq2/hq3 existem sempre, e aqui isso importa: em vários lugares a capa
       entra como fundo de CSS, onde não há como tratar erro de carregamento —
       pedir maxres sem rede de segurança deixaria o card cinza. */
    if (capa.quadro) return enderecoYt(capa.id, "hq" + capa.quadro + ".jpg");
    if (!capa.arquivo || capa.arquivo === "default.jpg") return enderecoYt(capa.id, "hqdefault.jpg");
    return v.thumbUrl;   // já é uma capa de tamanho decente, gravada assim
  }
  if (v.thumbUrl) return IMG_CDN(v.thumbUrl, largura);
  const ytId = getYouTubeId(v.videoUrl);
  if (ytId && temCapaEmPe(v)) return capaEmPe(ytId, null);
  // hqdefault always exists (maxresdefault 404s for non-HD videos → broken thumb).
  if (ytId) return enderecoYt(ytId, "hqdefault.jpg");
  return null;
};

/* A mesma capa, na maior resolução que existir — e no mesmo quadro. Como a
   versão grande pode não existir, vem com uma lista de reserva: quem usa põe a
   lista em data-reserva e o onError/onLoad em thumbReserva. */
const getThumbHD = (v, largura = 1600) => {
  const capa = capaYoutube(v.thumbUrl);
  // Short: a capa em pé já é 1080×1920; a 4:3 com tarjas fica só de reserva.
  if (capa && temCapaEmPe(v)) {
    return { src: capaEmPe(capa.id, capa.quadro), reserva: escadaYt(capa.id, capa.quadro).join(",") };
  }
  if (capa) {
    const urls = escadaYt(capa.id, capa.quadro);
    return { src: urls[0], reserva: urls.slice(1).join(",") };
  }
  if (v.thumbUrl) return { src: IMG_CDN(v.thumbUrl, largura), reserva: "" };
  const ytId = getYouTubeId(v.videoUrl);
  if (ytId && temCapaEmPe(v)) return { src: capaEmPe(ytId, null), reserva: escadaYt(ytId, null).join(",") };
  if (ytId) {
    const urls = escadaYt(ytId, null);
    return { src: urls[0], reserva: urls.slice(1).join(",") };
  }
  return { src: null, reserva: "" };
};
const thumbReserva = (e) => {
  const img = e.currentTarget;
  const lista = (img.dataset.reserva || "").split(",").filter(Boolean);
  if (!lista.length) return;   // acabaram as reservas: não entra em laço
  /* Quando a versão grande não existe, o YouTube responde 404 mas manda no
     corpo uma imagem cinza de 120x90 — e o navegador chama isso de
     carregamento bem sucedido. Esperar pelo onError deixava o card com a tal
     imagem cinza; por isso a conferência é o tamanho do que chegou. */
  if (e.type === "load" && img.naturalWidth > 120) return;
  img.dataset.reserva = lista.slice(1).join(",");
  img.src = lista[0];
};

const ClientBadge = ({ name, size = 24 }) => {
  const client = (window.FRAMETY_DATA.clients || []).find(c => c.name === name);
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  if (client?.logoUrl) {
    return <img src={IMG_CDN(client.logoUrl, 240)} alt={name} loading="lazy" decoding="async"
      style={{width:size,height:size,objectFit:"contain",borderRadius:3,display:"block"}} />;
  }
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      width:size,height:size,minWidth:size,
      fontFamily:"var(--font-mono)",fontSize:Math.max(8,size*0.38),fontWeight:700,
      background:"rgba(255,255,255,0.12)",borderRadius:3,color:"var(--ink)",
      letterSpacing:"0.04em",flexShrink:0,
    }}>{initials}</span>
  );
};

/* ─────────────────────────── Custom YouTube Player ──────────────────────── */
const CustomYouTubePlayer = ({ videoId, autoStart = true, controlRef, spherical = false }) => {
  const wrapRef      = React.useRef(null);
  const containerRef = React.useRef(null);
  const playerRef    = React.useRef(null);
  const dragRef      = React.useRef(null);
  const tickRef      = React.useRef(null);
  const hideRef      = React.useRef(null);
  const [is360, setIs360]   = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted]   = React.useState(false);
  const [cur, setCur]       = React.useState(0);
  const [dur, setDur]       = React.useState(0);
  const [fs, setFs]         = React.useState(false);
  const [ui, setUi]         = React.useState(true);   // custom control bar visible

  React.useEffect(() => {
    let destroyed = false;

    // A 360° (spherical) video reports get/setSphericalProperties — but only once
    // playback has actually started. Poll a few times after PLAYING to detect it.
    const detect360 = (p, tries = 0) => {
      if (destroyed || is360) return;
      let sp; try { sp = p.getSphericalProperties?.(); } catch (_) {}
      if (sp && Object.keys(sp).length) { setIs360(true); return; }
      if (tries < 8) setTimeout(() => detect360(p, tries + 1), 400);
    };
    const startTick = () => {
      clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        const p = playerRef.current; if (!p?.getCurrentTime) return;
        setCur(p.getCurrentTime() || 0);
        const d = p.getDuration?.() || 0; if (d) setDur(d);
      }, 250);
    };

    const initPlayer = () => {
      if (destroyed || !containerRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoStart ? 1 : 0,
          // 360 → hide native controls and drive playback + drag ourselves (native
          // 360 drag doesn't work in embeds). Flat videos keep native controls
          // (incl. the resolution menu).
          controls: spherical ? 0 : 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(80);
            setDur(e.target.getDuration?.() || 0);
            // Expose imperative play so the parent can start playback from WITHIN a
            // tap gesture (one-tap play with sound on mobile).
            if (controlRef) controlRef.current = {
              play:  () => e.target.playVideo(),
              pause: () => e.target.pauseVideo(),
            };
          },
          onStateChange: (e) => {
            if (e.data === 1) { setPlaying(true); startTick(); if (spherical) detect360(e.target); }
            else { setPlaying(false); if (e.data !== 3) clearInterval(tickRef.current); } // 3 = buffering
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('yt-iframe-api')) {
        const s = document.createElement('script');
        s.id  = 'yt-iframe-api';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer(); };
    }

    return () => {
      destroyed = true;
      clearInterval(tickRef.current);
      clearTimeout(hideRef.current);
      playerRef.current?.destroy?.();
    };
  }, [videoId]);

  // Track fullscreen state (our own fullscreen wraps the whole player, so the drag
  // overlay keeps working in fullscreen too).
  React.useEffect(() => {
    const onFsChange = () => setFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  /* ── Drag-to-look for 360° videos ──────────────────────────────────────────
     YouTube's native 360 drag/compass does NOT engage inside a third-party iframe
     embed, but the IFrame API's get/setSphericalProperties() DO work. So we lay a
     transparent surface over the whole video and pan the sphere ourselves; a tap
     (no drag) toggles play/pause. Our own control bar sits below it. */
  const onDown = (e) => {
    const p = playerRef.current; if (!p?.getSphericalProperties) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const sp = p.getSphericalProperties() || {};
    dragRef.current = {
      x: e.clientX, y: e.clientY,
      yaw: sp.yaw || 0, pitch: sp.pitch || 0, fov: sp.fov || 100,
      rect: e.currentTarget.getBoundingClientRect(), moved: 0,
    };
  };
  const onMove = (e) => {
    const d = dragRef.current, p = playerRef.current; if (!d || !p) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
    const yaw   = d.yaw + (dx / d.rect.width)  * d.fov;  // drag right → look right
    const pitch = Math.max(-90, Math.min(90, d.pitch + (dy / d.rect.height) * d.fov));
    try { p.setSphericalProperties({ yaw, pitch, roll: 0, fov: d.fov }); } catch (_) {}
  };
  const onUp = () => {
    const d = dragRef.current; dragRef.current = null;
    if (d && d.moved < 6) togglePlay();                 // a tap, not a drag → play/pause
  };

  // ── Custom controls ──
  const togglePlay = () => {
    const p = playerRef.current; if (!p) return;
    (p.getPlayerState?.() === 1 ? p.pauseVideo : p.playVideo).call(p);
    poke();
  };
  const toggleMute = () => {
    const p = playerRef.current; if (!p) return;
    if (p.isMuted?.()) { p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); }
  };
  const seek = (e) => {
    const p = playerRef.current; if (!p || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    p.seekTo(pct * dur, true); setCur(pct * dur);
  };
  const toggleFs = () => {
    const el = wrapRef.current; if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  };
  const poke = () => {
    setUi(true);
    clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      if (playerRef.current?.getPlayerState?.() === 1) setUi(false);
    }, 2800);
  };
  const fmt = (s) => {
    s = Math.floor(s || 0); if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div ref={wrapRef}
         className={`cplayer ${spherical ? "cplayer-360" : ""} ${ui ? "ui-on" : "ui-off"} ${fs ? "is-fs" : ""}`}
         onMouseMove={spherical ? poke : undefined}
         onPointerMove={spherical ? poke : undefined}>
      <div ref={containerRef} className="cplayer-video"/>
      {spherical && is360 && (
        <div className="cplayer-look"
             onPointerDown={onDown} onPointerMove={onMove}
             onPointerUp={onUp} onPointerCancel={onUp}/>
      )}
      {spherical && (
        <>
          {is360 && (
            <div className="cplayer-360hint" aria-hidden="true"><span className="cplayer-360dot"/>360° · arraste para olhar</div>
          )}
          <div className="cbar" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="cbar-btn" onClick={togglePlay}
                    aria-label={playing ? "Pausar" : "Reproduzir"}>
              <Icon name={playing ? "pause" : "play"} size={18}/>
            </button>
            <span className="cbar-time">{fmt(cur)}</span>
            <div className="cbar-prog" onClick={seek}>
              <div className="cbar-prog-fill" style={{ width: `${dur ? (cur / dur) * 100 : 0}%` }}/>
            </div>
            <span className="cbar-time cbar-dim">{fmt(dur)}</span>
            <button type="button" className={`cbar-btn ${muted ? "muted" : ""}`} onClick={toggleMute}
                    aria-label={muted ? "Ativar som" : "Mudo"}>
              <Icon name="volume" size={18}/>
            </button>
            <button type="button" className="cbar-btn" onClick={toggleFs}
                    aria-label="Tela cheia">
              <Icon name="fullscreen" size={18}/>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ─────────────────────────── Category Page ──────────────────────────────── */
const CategoryPage = ({ catId, onBack, onOpenVideo }) => {
  const IABadge = window.IABadge;
  const cat     = window.FRAMETY_DATA.categories.find(c => c.id === catId);
  const allVids = window.FRAMETY_DATA.videos.filter(v => v.category === catId && v.status !== "draft");
  const clients = window.FRAMETY_DATA.clients || [];

  // Read filters from URL query params (helper used on mount and on popstate)
  const readFiltersFromUrl = () => {
    const sp = new URLSearchParams(window.location.search);
    return { c: sp.get("c") || "all", e: sp.get("e") || "all" };
  };
  const [clientFilter, setClientFilter] = React.useState(() => readFiltersFromUrl().c);


  // Sync filters when user navigates back/forward
  React.useEffect(() => {
    const onPop = () => {
      const { c } = readFiltersFromUrl();
      setClientFilter(c);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [view, setView] = React.useState("grid");
  const [previewId, setPreviewId] = React.useState(null);
  const [dropOpen, setDropOpen] = React.useState(false);
  /* Formato do imersivo — só existe nesta categoria, então o filtro também. */
  const [formatoFiltro, setFormatoFiltro] = React.useState("todos");
  const [formatoAberto, setFormatoAberto] = React.useState(false);
  const [shareCopied, setShareCopied] = React.useState(false);
  const hoverTimer = React.useRef(null);

  // Signal category page active (controls nav auto-hide)
  React.useEffect(() => {
    document.body.classList.add('in-cat-page');
    return () => document.body.classList.remove('in-cat-page');
  }, []);

  // Sync filters to URL params
  React.useEffect(() => {
    // Só enquanto o endereço é o da categoria: com um vídeo aberto por cima, a
    // URL é a dele e não pode ser apagada.
    const R = window.FRAMETY_ROTAS;
    const atual = R.resolver(window.location.pathname, window.FRAMETY_DATA);
    if (!atual || atual.tipo !== "categoria") return;
    const sp = new URLSearchParams();
    if (clientFilter !== "all") sp.set("c", clientFilter);

    const qs = sp.toString() ? "?" + sp.toString() : "";
    window.history.replaceState(window.history.state, "", `${R.urlCategoria(catId)}${qs}`);
  }, [clientFilter, catId]);

  const formatosImersivos = window.FRAMETY_DATA.formatosImersivos || [];
  const catClientNames = [...new Set(allVids.map(v => v.client))];
  const catClients     = catClientNames.map(n => clients.find(c => c.name === n) || { id: n, name: n });

  // Empreendimentos filtered by current client selection
  const vidsByClient  = clientFilter === "all" ? allVids : allVids.filter(v => v.client === clientFilter);


  /* Sem a barra de empreendimentos, o que chega aqui já é o resultado final.
     Ela listava um botão por empreendimento; com quase cem vídeos cadastrados
     virou uma parede de botões, e o nome do empreendimento já é o título. */
  const filtered = formatoFiltro === "todos"
    ? vidsByClient
    : vidsByClient.filter(v => (v.formatoImersivo || "") === formatoFiltro);

  const handleCardEnter = (v) => {
    if (IS_TOUCH) return; // no hover-preview on touch — cards stay static ("cru")
    const ytId = getYouTubeId(v.videoUrl);
    if (!ytId) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPreviewId(v.id), 700);
  };
  const handleCardLeave = () => {
    clearTimeout(hoverTimer.current);
    setPreviewId(null);
  };

  return (
    <div className="cat-page page-enter" data-screen-label="06 Categoria">
      <div className="container">
        <a className="cat-page-back" onClick={onBack} data-cursor="hover">
          <Icon name="arrow-right" size={12} style={{transform:"rotate(180deg)"}}/> Voltar
        </a>

        <div className="cat-page-head">
          <div>
            <h1 className="cat-page-title">{cat?.name||"Categoria"}<span style={{color:"var(--accent)"}}>.</span></h1>
            {/* Some quando não há descrição: sem isto sobra um parágrafo vazio
                empurrando os vídeos para baixo à toa. */}
            {cat?.desc && <p style={{color:"var(--ink-dim)",maxWidth:600,marginTop:6,fontSize:13,lineHeight:1.5}}>{cat.desc}</p>}
          </div>
          <div className="cat-page-meta">
            <div className="row">
              <span>{allVids.length.toString().padStart(2,"0")} projetos</span>
              <span>·</span>
              <span>{(() => {
                if (!cat?.lastUpdated) return null;
                const d = new Date(cat.lastUpdated);
                const mes = d.toLocaleDateString('pt-BR', { month: 'long' });
                return `Atualizado em ${mes}/${d.getFullYear()}`;
              })()}</span>
            </div>
            <button className="cat-share-btn" data-cursor="hover" onClick={() => {
              const url = `${window.location.origin}/assistir/${catId}`;
              const done = () => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); };
              if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(() => window.prompt('Copie o link da categoria:', url));
              else window.prompt('Copie o link da categoria:', url);
            }}>
              <Icon name={shareCopied ? "check" : "share"} size={13}/> {shareCopied ? "Link copiado!" : "Compartilhar categoria"}
            </button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────── */}
        <div className="cat-controls">
          <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0,flexWrap:"wrap"}}>

            {/* Client filter — dropdown */}
            <div className="cat-client-dropdown" onClick={e => e.stopPropagation()}>
              <button
                className={`cat-client-dropdown-btn${clientFilter !== "all" ? " has-filter" : ""}`}
                onClick={() => setDropOpen(o => !o)}>
                {clientFilter !== "all"
                  ? <><ClientBadge name={clientFilter} size={16}/><span>{clientFilter}</span></>
                  : <span>Todos os clientes</span>}
                <span style={{color:"var(--ink-mute)",marginLeft:2}}>
                  <Icon name="chevron-down" size={11}/>
                </span>
              </button>
              {dropOpen && (
                <div className="cat-client-dropdown-menu">
                  <button
                    className={clientFilter === "all" ? "active" : ""}
                    onClick={() => { setClientFilter("all"); setDropOpen(false); }}>
                    <span>Todos os clientes</span>
                    <span className="dd-count">{allVids.length}</span>
                  </button>
                  {catClients.map(c => (
                    <button key={c.id||c.name}
                      className={clientFilter === c.name ? "active" : ""}
                      onClick={() => { setClientFilter(c.name); setDropOpen(false); }}>
                      <ClientBadge name={c.name} size={16}/>
                      <span>{c.name}</span>
                      <span className="dd-count">{allVids.filter(v => v.client === c.name).length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Formato do imersivo. Aparece só onde o campo existe — numa
                categoria de comercial seria um filtro que não filtra nada. */}
            {catId === "imersivo" && formatosImersivos.length > 0 && (
              <div className="cat-client-dropdown" onClick={e => e.stopPropagation()}>
                <button
                  className={`cat-client-dropdown-btn${formatoFiltro !== "todos" ? " has-filter" : ""}`}
                  onClick={() => setFormatoAberto(o => !o)}>
                  <span>{formatoFiltro !== "todos" ? formatoFiltro : "Todos os formatos"}</span>
                  <span style={{color:"var(--ink-mute)",marginLeft:2}}>
                    <Icon name="chevron-down" size={11}/>
                  </span>
                </button>
                {formatoAberto && (
                  <div className="cat-client-dropdown-menu">
                    <button className={formatoFiltro === "todos" ? "active" : ""}
                      onClick={() => { setFormatoFiltro("todos"); setFormatoAberto(false); }}>
                      <span>Todos os formatos</span>
                      <span className="dd-count">{vidsByClient.length}</span>
                    </button>
                    {formatosImersivos.map(f => (
                      <button key={f} className={formatoFiltro === f ? "active" : ""}
                        onClick={() => { setFormatoFiltro(f); setFormatoAberto(false); }}>
                        <span>{f}</span>
                        <span className="dd-count">{vidsByClient.filter(v => (v.formatoImersivo || "") === f).length}</span>
                      </button>
                    ))}
                    {/* quem ainda não foi classificado precisa ser achável */}
                    <button className={formatoFiltro === "" ? "active" : ""}
                      onClick={() => { setFormatoFiltro(""); setFormatoAberto(false); }}>
                      <span style={{color:"var(--ink-mute)"}}>Sem formato</span>
                      <span className="dd-count">{vidsByClient.filter(v => !v.formatoImersivo).length}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          <div className="cat-view-toggle">
            <button className={view==="grid"?"active":""} onClick={() => setView("grid")} title="Grid">
              <Icon name="grid" size={13}/>
            </button>
            <button className={view==="list"?"active":""} onClick={() => setView("list")} title="Lista">
              <Icon name="list" size={13}/>
            </button>
          </div>
        </div>

        {/* ── Grid view ────────────────────────────── */}
        {view === "grid" && (
          <div className="cat-grid">
            {filtered.map(v => {
              const thumb = getThumbUrl(v);
              const ytId  = getYouTubeId(v.videoUrl);
              const isPreview = previewId === v.id;
              return (
                /* O contorno azul e o fundo escuro do SpotlightCard vêm escritos
                   no próprio elemento, e por isso vencem a folha de estilo: é
                   aqui que eles precisam ser desligados. O que sobra é a thumb,
                   e o brilho no hover fica por conta do box-shadow, que o
                   componente não escreve. */
                <SpotlightCard key={v.id} color="red" className="cat-card" onClick={() => onOpenVideo(v.id)}
                  onMouseEnter={() => handleCardEnter(v)}
                  onMouseLeave={handleCardLeave}
                  style={{ '--radius': 12, '--backdrop': 'transparent', '--backup-border': 'transparent' }}>
                  <div className={`cat-card-thumb${ehVertical(v) ? " v916" : ""}${thumb || isPreview ? "" : ` ${cat?.bgClass||"bg-comm"}`}`}
                    style={!isPreview && thumb ? {backgroundImage:`url(${thumb})`,backgroundSize:"var(--zoom-thumb, cover)",backgroundPosition:"center"} : {}}>

                    {/* YouTube preview iframe on hover */}
                    {isPreview && ytId && (
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${ytId}&start=10`}
                        style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none",pointerEvents:"none"}}
                        allow="autoplay"
                        title={`Preview — ${v.title}`}
                      />
                    )}

                    <div className="cat-card-overlay"/>
                    <div className="cat-card-duration">{v.duration}</div>
                    <div className="cat-card-play"><Icon name="play" size={20}/></div>
                    {v.status === "draft" && <div className="cat-card-draft-badge">Rascunho</div>}
                    {/* O título desceu para dentro da imagem, sobre o degradê que
                        já existia ali. Sem isto o grid vira um mosaico de fotos
                        sem nome. */}
                    <div className="cat-card-legenda">{v.title}</div>
                  </div>
                  {(v.aiGenerated || v.has360) && (
                    <div className="badge-stack">
                      {v.aiGenerated && IABadge && <IABadge variant="pill" />}
                      {v.has360 && typeof Badge360 !== 'undefined' && <Badge360 variant="pill" />}
                    </div>
                  )}
                </SpotlightCard>
              );
            })}
            {filtered.length === 0 && <div className="cat-empty">Nenhum projeto para este filtro.</div>}
          </div>
        )}

        {/* ── List view ────────────────────────────── */}
        {view === "list" && (
          <div className="cat-list">
            {filtered.map((v, i) => (
              <div key={v.id} className="cat-list-item" onClick={() => onOpenVideo(v.id)} data-cursor="hover">
                <span className="num">— {String(i+1).padStart(3,"0")}</span>
                <div className="title">
                  {v.title}
                  {v.empreendimento && <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--ink-mute)",marginLeft:10,letterSpacing:"0.1em"}}>{v.empreendimento}</span>}
                </div>
                <div className="meta-client">
                  <ClientBadge name={v.client} size={20}/>
                  <span>{v.client}</span>
                </div>
                <div className="meta-tags">{v.tags.map(t => <span key={t}>{t}</span>)}</div>
                <div className="arrow"><Icon name="arrow-up-right" size={14}/></div>
                <div className={`cat-list-preview${ehVertical(v) ? " v916" : ""} ${cat?.bgClass||"bg-comm"}`}
                  style={window.getThumbUrl?.(v) ? { backgroundImage: `url(${window.getThumbUrl(v)})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
                  {!window.getThumbUrl?.(v) && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:"0.2em",color:"rgba(255,255,255,0.4)"}}>[ PREVIEW ]</div>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="cat-empty">Nenhum projeto para este filtro.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   VideoModal
═══════════════════════════════════════════════════════ */
const VideoModal = ({ videoId, onClose, onOpenVideo, onContactNav }) => {
  const IABadge = window.IABadge;
  const data = window.FRAMETY_DATA;
  const v   = data.videos.find(x => x.id === videoId);
  const cat = data.categories.find(c => c.id === v?.category);
  const [playing, setPlaying] = React.useState(false);
  const [sugPage, setSugPage] = React.useState(0);
  const [isLandscape, setIsLandscape] = React.useState(false);
  const ytCtl = React.useRef(null); // imperative play() of the pre-mounted YT player
  const PER_PAGE = 4;

  // Start playback FROM the tap gesture so mobile plays with sound in one tap.
  const startPlay = () => {
    if (ytCtl.current) ytCtl.current.play();
    setPlaying(true);
  };

  React.useEffect(() => {
    // Use reference counter to avoid releasing scroll lock when another overlay is still open
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    if (window._scrollLock) {
      window._scrollLock.lock(scrollbarW);
    } else {
      document.body.style.overflow = "hidden";
      if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;
    }
    const stable = onClose;
    const onKey = (e) => { if (e.key === "Escape") stable(); };
    const checkOrientation = () => {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      const landscape = window.matchMedia('(orientation: landscape)').matches;
      setIsLandscape(isMobile && landscape);
    };
    checkOrientation();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      if (window._scrollLock) {
        window._scrollLock.unlock();
      } else {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      }
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [onClose]);

  if (!v) return null;

  const thumb    = getThumbUrl(v);
  const ytId     = getYouTubeId(v.videoUrl);
  const vimeoId  = getVimeoId(v.videoUrl);
  const hasVideo = !!(ytId || vimeoId);

  const suggested = data.videos.filter(x => x.id !== v.id && x.status !== "draft");

  const clientObj = (data.clients || []).find(c => c.name === v.client);

  return (
    <div className={"modal-backdrop" + (isLandscape ? " modal-landscape" : "") + (playing ? " modal-playing" : "")} onClick={onClose}>
      <div className="modal-frame modal-frame-glass" onClick={(e)=>e.stopPropagation()}>

        {/* ── Sticky header ── */}
        <div className="modal-top">
          <img src="/vector_framety.svg?v=1" alt="Framety" className="modal-logo"/>
          <div className="modal-divider"/>
          <div className="modal-client-logo">
            <ClientBadge name={v.client} size={68}/>
          </div>
          <div className="modal-top-meta">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="modal-title">{v.title}</div>
              {(v.aiGenerated || v.has360) && (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexShrink: 0 }}>
                  {v.aiGenerated && IABadge && <IABadge variant="header" />}
                  {v.has360 && typeof Badge360 !== 'undefined' && <Badge360 variant="header" />}
                </div>
              )}
            </div>
            <div className="modal-meta">
              <span>{v.catLabel}</span><span>·</span><span>{v.client}</span>
              <span>·</span><span>{v.year}</span>
              {v.empreendimento && <><span>·</span><span>{v.empreendimento}</span></>}
            </div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <button className="modal-share-btn" onClick={(e) => {
              e.stopPropagation();
              const url = `${window.location.origin}${window.FRAMETY_ROTAS.urlVideo(v)}`;
              navigator.clipboard.writeText(url);
              const btn = e.currentTarget;
              const original = btn.innerHTML;
              btn.innerHTML = '<span style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--accent)">Copiado!</span>';
              btn.classList.add("copied");
              setTimeout(() => { btn.innerHTML = original; btn.classList.remove("copied"); }, 2000);
            }} data-cursor="hover" title="Copiar link do vídeo">
              <Icon name="share" size={14}/>
              <span className="share-label">Compartilhar</span>
            </button>
            <button className="modal-close" onClick={onClose} data-cursor="hover">
              <Icon name="x" size={15}/>
            </button>
          </div>
        </div>

        {/* ── Mobile-only: title block ABOVE player ── */}
        <div className="modal-mobile-title">
          <h2>{v.title}</h2>
          <div className="modal-mobile-meta">
            <ClientBadge name={v.client} size={20}/>
            <span>{v.client}</span>
            <span>·</span>
            <span>{v.catLabel}</span>
            <span>·</span>
            <span>{v.year}</span>
          </div>
        </div>

        {/* ── Player ── */}
        <div className={"modal-player" + (ehVertical(v) ? " v916" : "")}>
          {/* YouTube is pre-mounted (cued) and revealed on play, so the tap that
              starts it happens on a ready player → one-tap play with sound on mobile.
              Fullscreen is handled by the native YouTube controls now. */}
          {ytId && (
            <div style={{position:"absolute",inset:0,opacity:playing?1:0,pointerEvents:playing?"auto":"none",transition:"opacity 0.25s ease"}}>
              <CustomYouTubePlayer videoId={ytId} autoStart={false} controlRef={ytCtl} spherical={!!v.has360}/>
            </div>
          )}
          {playing && vimeoId && !ytId && (
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&byline=0&portrait=0&title=0`}
              style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
              allow="autoplay; fullscreen" allowFullScreen title={v.title}
            />
          )}
          {!playing && (
            <>
              {thumb
                ? <div style={{position:"absolute",inset:0,backgroundImage:`url(${thumb})`,backgroundSize:"cover",backgroundPosition:"center"}}/>
                : <div className={`modal-player-bg ${cat?.bgClass||"bg-comm"}`}/>}
              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.28)"}}/>
              <button className="modal-bigplay"
                onClick={() => hasVideo && startPlay()}
                style={{opacity: hasVideo ? 1 : 0.3, cursor: hasVideo ? "pointer" : "default"}}
                data-cursor="hover">
                <Icon name="play" size={28}/>
              </button>
              {!hasVideo && (
                <div style={{position:"absolute",top:20,left:20,fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:"0.2em",color:"rgba(255,255,255,0.4)",border:"1px dashed rgba(255,255,255,0.15)",padding:"5px 10px"}}>
                  SEM LINK DE VÍDEO
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Body ── */}
        <div className="modal-body">

          {/* CTA — primeiro */}
          <div className="modal-cta-bar">
            <Magnetic>
              <button className="btn btn-accent"
                onClick={() => { if (onContactNav) onContactNav(); else onClose(); }}>
                {window.FRAMETY_CONTENT.video.ctaButton} <Icon name="arrow-up-right" size={14}/>
              </button>
            </Magnetic>
          </div>

          {/* Description — always visible */}
          {v.description && (
            <div className="modal-desc-content" dangerouslySetInnerHTML={{__html: v.description}}/>
          )}

          {/* Before/after images */}
          {v.baImages && v.baImages.length > 0 && (
            <div className="modal-ba-grid">
              {v.baImages.map((url, i) => (
                <div key={i} className="modal-ba-img" style={{backgroundImage:`url(${url})`}}/>
              ))}
            </div>
          )}

          {/* Suggested — single row with prev/next */}
          {suggested.length > 0 && (
            <div className="modal-suggested">
              <div className="modal-suggested-label">Outros projetos</div>
              <div className="modal-sug-nav-row">
                <button className="modal-sug-arrow" disabled={sugPage === 0}
                  onClick={() => setSugPage(p => p - 1)}>
                  <Icon name="chevron-left" size={14}/>
                </button>
                <div className="modal-sug-scroll">
                  <div className="modal-sug-track"
                    style={{transform:`translateX(calc(-${sugPage * 100}% - ${sugPage * 10}px))`}}>
                    {suggested.map(s => {
                      const sThumb = getThumbUrl(s);
                      return (
                        <button key={s.id} className="modal-sug-card"
                          onClick={() => onOpenVideo && onOpenVideo(s.id)}>
                          <div className={"modal-sug-thumb" + (ehVertical(s) ? " v916" : "")} style={sThumb ? {backgroundImage:`url(${sThumb})`} : {}}>
                            {!sThumb && <Icon name="play" size={12} style={{color:"rgba(255,255,255,0.3)"}}/>}
                          </div>
                          <div className="modal-sug-info">
                            <div className="modal-sug-title">{s.title}</div>
                            <div className="modal-sug-meta">{s.catLabel}{s.client ? ` · ${s.client}` : ""}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button className="modal-sug-arrow"
                  disabled={sugPage >= Math.ceil(suggested.length / PER_PAGE) - 1}
                  onClick={() => setSugPage(p => p + 1)}>
                  <Icon name="chevron-right" size={14}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── Category Playlist (public, watch-only) ─────────── */
const PlaylistPage = ({ catId }) => {
  const data = window.FRAMETY_DATA || { categories: [], videos: [], clients: [] };
  const cat  = data.categories.find(c => c.id === catId && !c.hidden);
  const vids = data.videos.filter(v => v.category === catId && v.status !== "draft");
  const [activeId, setActiveId] = React.useState(vids[0]?.id || null);
  const active = vids.find(v => v.id === activeId) || vids[0];
  const [isLandscape, setIsLandscape] = React.useState(false);

  React.useEffect(() => { window.scrollTo(0, 0); document.title = (cat ? cat.name + " — " : "") + "Framety"; }, []);

  React.useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      const landscape = window.matchMedia('(orientation: landscape)').matches;
      setIsLandscape(isMobile && landscape);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!cat || !vids.length) {
    return (
      <div className="playlist-shell">
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:14,color:"var(--ink-dim)"}}>
          <img src="/vector_framety.svg?v=1" alt="Framety" style={{height:40,opacity:0.7}}/>
          <p style={{fontFamily:"var(--font-mono)",fontSize:12,letterSpacing:"0.16em"}}>{!cat ? "CATEGORIA NÃO ENCONTRADA" : "NENHUM VÍDEO NESTA CATEGORIA"}</p>
        </div>
      </div>
    );
  }

  const ytId    = getYouTubeId(active.videoUrl);
  const vimeoId = getVimeoId(active.videoUrl);
  const activeThumb = getThumbUrl(active);

  return (
    <div className={"playlist-shell page-enter" + (isLandscape ? " playlist-landscape" : "")}>
      <div className="playlist-topbar">
        <img src="/vector_framety.svg?v=1" alt="Framety" style={{height:26}}/>
        <div className="playlist-cat">{cat.name}<span style={{color:"var(--accent)"}}>.</span></div>
        <div className="playlist-count">{vids.length} vídeo{vids.length===1?"":"s"}</div>
        <a className="playlist-cta" href="/categorias" data-cursor="hover"><Icon name="grid" size={13}/> Conhecer outros vídeos</a>
      </div>

      <div className="playlist-body">
        <div className="playlist-main">
          <div className={"playlist-player" + (ehVertical(active) ? " v916" : "")}>
            {ytId
              ? <CustomYouTubePlayer key={active.id} videoId={ytId} spherical={!!active.has360}/>
              : vimeoId
                ? <iframe src={`https://player.vimeo.com/video/${vimeoId}`} allow="autoplay; fullscreen" allowFullScreen style={{width:"100%",height:"100%",border:"none",borderRadius:14}} title={active.title}/>
                : <div className="playlist-noembed" style={activeThumb?{backgroundImage:`url(${activeThumb})`}:{}}><Icon name="play" size={26}/></div>}
          </div>
          <div className="playlist-main-info">
            <h1>{active.title}</h1>
            <div className="playlist-main-meta">
              {[active.catLabel, active.client, active.year, active.duration].filter(Boolean).join("  ·  ")}
            </div>
          </div>
        </div>

        <div className="playlist-sidebar">
          {vids.map((v, i) => {
            const thumb = getThumbUrl(v);
            const isActive = v.id === active.id;
            return (
              <button key={v.id} className={"playlist-item" + (isActive ? " active" : "")} onClick={() => setActiveId(v.id)} data-cursor="hover">
                <div className={"playlist-item-thumb" + (ehVertical(v) ? " v916" : "")} style={thumb ? { backgroundImage:`url(${thumb})` } : {}}>
                  {!thumb && <Icon name="play" size={13}/>}
                  {isActive && <span className="playlist-item-playing"><Icon name="play" size={10}/></span>}
                  {v.duration && <span className="playlist-item-dur">{v.duration}</span>}
                </div>
                <div className="playlist-item-info">
                  <div className="playlist-item-title">{v.title}</div>
                  <div className="playlist-item-sub">{[v.client, v.year].filter(Boolean).join(" · ")}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { CategoryPage, VideoModal, ClientBadge, PlaylistPage, getYouTubeId, getVimeoId, getThumbUrl, getThumbHD, thumbReserva, ehVertical });
