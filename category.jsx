/* category.jsx */

const getYouTubeId = (url) => {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};
const getVimeoId = (url) => {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
};
const getThumbUrl = (v) => {
  if (v.thumbUrl) return v.thumbUrl;
  const ytId = getYouTubeId(v.videoUrl);
  // hqdefault always exists (maxresdefault 404s for non-HD videos → broken thumb).
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  return null;
};

const ClientBadge = ({ name, size = 24 }) => {
  const client = (window.FRAMETY_DATA.clients || []).find(c => c.name === name);
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  if (client?.logoUrl) {
    return <img src={client.logoUrl} alt={name} loading="lazy" decoding="async"
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
const CustomYouTubePlayer = ({ videoId, autoStart = true, controlRef }) => {
  const containerRef = React.useRef(null);
  const playerRef    = React.useRef(null);
  const dragRef      = React.useRef(null);
  const [is360, setIs360]       = React.useState(false);
  const [lookMode, setLookMode] = React.useState(true);
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

    const initPlayer = () => {
      if (destroyed || !containerRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoStart ? 1 : 0,
          controls: 1,          // native controls → quality (resolution) menu, fullscreen
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(80);
            // Expose imperative play so the parent can start playback from WITHIN a
            // tap gesture (one-tap play with sound on mobile).
            if (controlRef) controlRef.current = {
              play:  () => e.target.playVideo(),
              pause: () => e.target.pauseVideo(),
            };
          },
          onStateChange: (e) => { if (e.data === 1) detect360(e.target); }, // 1 = playing
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
      playerRef.current?.destroy?.();
    };
  }, [videoId]);

  /* ── Drag-to-look for 360° videos ──────────────────────────────────────────
     YouTube's native 360 drag/compass does NOT engage inside a third-party iframe
     embed, but the IFrame API's get/setSphericalProperties() DO work. So we lay a
     transparent surface over the video (minus the bottom native control bar) and
     pan the sphere ourselves. The "360°" toggle disables it so the native
     resolution menu / controls stay reachable. Regular (flat) videos never get
     the overlay, so their native controls are untouched. */
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
    const d = dragRef.current, p = playerRef.current; dragRef.current = null;
    if (d && d.moved < 6 && p) {                        // a tap, not a drag → play/pause
      (p.getPlayerState?.() === 1 ? p.pauseVideo : p.playVideo).call(p);
    }
  };

  return (
    <div className="cplayer">
      <div ref={containerRef} className="cplayer-video"/>
      {is360 && lookMode && (
        <div className="cplayer-look"
             onPointerDown={onDown} onPointerMove={onMove}
             onPointerUp={onUp} onPointerCancel={onUp}/>
      )}
      {is360 && (
        <button type="button"
                className={`cplayer-360btn ${lookMode ? "on" : ""}`}
                onClick={() => setLookMode(v => !v)}
                title={lookMode
                  ? "360° ativo — arraste para olhar em volta. Clique para liberar os controles do YouTube."
                  : "Ativar giro 360° (arraste para olhar em volta)"}>
          <span className="cplayer-360dot"/>360°
        </button>
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
  const [empFilter,    setEmpFilter]    = React.useState(() => readFiltersFromUrl().e);

  // Sync filters when user navigates back/forward
  React.useEffect(() => {
    const onPop = () => {
      const { c, e } = readFiltersFromUrl();
      setClientFilter(c);
      setEmpFilter(e);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [view, setView] = React.useState("grid");
  const [previewId, setPreviewId] = React.useState(null);
  const [dropOpen, setDropOpen] = React.useState(false);
  const [shareCopied, setShareCopied] = React.useState(false);
  const hoverTimer = React.useRef(null);

  // Signal category page active (controls nav auto-hide)
  React.useEffect(() => {
    document.body.classList.add('in-cat-page');
    return () => document.body.classList.remove('in-cat-page');
  }, []);

  // Sync filters to URL params
  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (clientFilter !== "all") sp.set("c", clientFilter);
    if (empFilter    !== "all") sp.set("e", empFilter);
    const qs = sp.toString() ? "?" + sp.toString() : "";
    window.history.replaceState(null, "", `/framety/categoria/${catId}${qs}`);
  }, [clientFilter, empFilter, catId]);

  // Reset empreendimento filter when client changes
  React.useEffect(() => { setEmpFilter("all"); }, [clientFilter]);

  const catClientNames = [...new Set(allVids.map(v => v.client))];
  const catClients     = catClientNames.map(n => clients.find(c => c.name === n) || { id: n, name: n });

  // Empreendimentos filtered by current client selection
  const vidsByClient  = clientFilter === "all" ? allVids : allVids.filter(v => v.client === clientFilter);
  const empreendimentos = [...new Set(vidsByClient.map(v => v.empreendimento).filter(Boolean))];

  const filtered = vidsByClient.filter(v => empFilter === "all" || v.empreendimento === empFilter);

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
            <p style={{color:"var(--ink-dim)",maxWidth:600,marginTop:8,fontSize:14,lineHeight:1.6}}>{cat?.desc}</p>
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

            {/* Empreendimento filter — pills (compact, secondary) */}
            {empreendimentos.length > 0 && (
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.18em",color:"var(--ink-mute)",flexShrink:0}}>EMPREEND.</span>
                <button className={`cat-cf-btn cat-cf-sm${empFilter==="all"?" active":""}`} onClick={() => setEmpFilter("all")}>Todos</button>
                {empreendimentos.map(emp => (
                  <button key={emp} className={`cat-cf-btn cat-cf-sm${empFilter===emp?" active":""}`}
                    onClick={() => setEmpFilter(emp)}>{emp}</button>
                ))}
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
                <SpotlightCard key={v.id} color="red" className="cat-card" onClick={() => onOpenVideo(v.id)}
                  onMouseEnter={() => handleCardEnter(v)}
                  onMouseLeave={handleCardLeave}
                  style={{ '--radius': 12 }}>
                  <div className={`cat-card-thumb${thumb || isPreview ? "" : ` ${cat?.bgClass||"bg-comm"}`}`}
                    style={!isPreview && thumb ? {backgroundImage:`url(${thumb})`,backgroundSize:"cover",backgroundPosition:"center"} : {}}>

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
                  </div>
                  {(v.aiGenerated || v.has360) && (
                    <div className="badge-stack">
                      {v.aiGenerated && IABadge && <IABadge variant="pill" />}
                      {v.has360 && typeof Badge360 !== 'undefined' && <Badge360 variant="pill" />}
                    </div>
                  )}
                  <div className="cat-card-info">
                    <div className="cat-card-meta-row">
                      <span className="cat-card-year">{v.year}</span>
                      <div className="cat-card-tags">
                        {v.tags.slice(0,2).map(t => <span key={t}>{t}</span>)}
                      </div>
                    </div>
                    <div className="cat-card-title">{v.title}</div>
                    <div className="cat-card-client-row">
                      {v.empreendimento
                        ? <span style={{color:"var(--ink-mute)",fontSize:11}}>{v.empreendimento}</span>
                        : <span/>}
                      <div><ClientBadge name={v.client} size={26}/></div>
                    </div>
                  </div>
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
                <div className={`cat-list-preview ${cat?.bgClass||"bg-comm"}`}
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
              const url = `${window.location.origin}/framety/video/${v.id}`;
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
        <div className="modal-player">
          {/* YouTube is pre-mounted (cued) and revealed on play, so the tap that
              starts it happens on a ready player → one-tap play with sound on mobile.
              Fullscreen is handled by the native YouTube controls now. */}
          {ytId && (
            <div style={{position:"absolute",inset:0,opacity:playing?1:0,pointerEvents:playing?"auto":"none",transition:"opacity 0.25s ease"}}>
              <CustomYouTubePlayer videoId={ytId} autoStart={false} controlRef={ytCtl}/>
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
                onClick={() => { onClose(); onContactNav && onContactNav(); }}>
                Quero um vídeo assim <Icon name="arrow-up-right" size={14}/>
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
                          <div className="modal-sug-thumb" style={sThumb ? {backgroundImage:`url(${sThumb})`} : {}}>
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
  const cat  = data.categories.find(c => c.id === catId);
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
        <a className="playlist-cta" href="/framety" data-cursor="hover"><Icon name="grid" size={13}/> Conhecer outros vídeos</a>
      </div>

      <div className="playlist-body">
        <div className="playlist-main">
          <div className="playlist-player">
            {ytId
              ? <CustomYouTubePlayer key={active.id} videoId={ytId}/>
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
                <div className="playlist-item-thumb" style={thumb ? { backgroundImage:`url(${thumb})` } : {}}>
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

Object.assign(window, { CategoryPage, VideoModal, ClientBadge, PlaylistPage, getYouTubeId, getVimeoId, getThumbUrl });
