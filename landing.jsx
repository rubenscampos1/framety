/* landing.jsx — public homepage */
const { useEffect: useEff, useState: useS, useRef: useR } = React;

// Scroll-lock reference counter — prevents double-release when multiple overlays stack
// Exposed on window so category.jsx VideoModal can also use it
const _scrollLock = window._scrollLock = {
  count: 0,
  lock(paddingRight = 0) {
    this.count++;
    if (this.count === 1) {
      document.body.style.overflow = "hidden";
      if (paddingRight > 0) document.body.style.paddingRight = `${paddingRight}px`;
    }
  },
  unlock() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
  },
};

const Nav = ({ current, onNav, onLogoClick, ripples }) => {
  const content = window.FRAMETY_CONTENT.nav;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [catMode, setCatMode] = React.useState(false);
  const [peek, setPeek] = React.useState(false);
  const peekRef = React.useRef(false);

  // Watch for category page activation via body class
  React.useEffect(() => {
    const checkCat = () => setCatMode(document.body.classList.contains('in-cat-page'));
    checkCat();
    const obs = new MutationObserver(checkCat);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Mouse proximity to top OR within nav zone — reveal nav while in cat mode
  React.useEffect(() => {
    if (!catMode) { setPeek(false); peekRef.current = false; document.body.classList.remove('cat-peek'); return; }
    const NAV_ZONE = 120; // nav top(10) + min-height(94) + buffer — covers full nav height
    const onMove = (e) => {
      const atTop = e.clientY <= 4;
      const inCenter = e.clientX > window.innerWidth * 0.15 && e.clientX < window.innerWidth * 0.85;
      const inNavZone = e.clientY <= NAV_ZONE;
      const shouldPeek = (atTop && inCenter) || (peekRef.current && inNavZone);
      peekRef.current = shouldPeek;
      setPeek(shouldPeek);
      document.body.classList.toggle('cat-peek', shouldPeek);
    };
    window.addEventListener('mousemove', onMove);
    return () => { window.removeEventListener('mousemove', onMove); peekRef.current = false; document.body.classList.remove('cat-peek'); };
  }, [catMode]);

  const navHidden = catMode && !peek;

  const handleNav = (id) => { setMobileOpen(false); onNav(id); };

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    _scrollLock.lock();
    return () => { window.removeEventListener("keydown", onKey); _scrollLock.unlock(); };
  }, [mobileOpen]);

  // Close mobile menu on page navigation events
  React.useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("framety-nav", close);
    return () => window.removeEventListener("framety-nav", close);
  }, []);

  return (
    <>
      <nav className={`nav glass${navHidden ? " nav--hidden" : ""}`}>
        <div className="nav-logo" onClick={onLogoClick} data-cursor="hover" style={{ position: "relative", display: "flex", alignItems: "center", gap: "24px" }}>
          <img src="/vector_framety.svg?v=1" alt="Framety" style={{ height: "81px", width: "auto", transform: "translateY(16px)" }} />
          <img src="/vector_bar.svg?v=1" alt="|" style={{ height: "45px", width: "auto", opacity: 0.5 }} />
          <img src="/vector_skyline.svg?v=1" alt="Grupo Skyline" style={{ height: "45px", width: "auto" }} />
          {ripples.map(id => <span key={id} className="logo-ripple" />)}
        </div>
        <div className="nav-menu">
          {content.links.map(l => (
            <a key={l.id}
              className={current === l.id ? "active" : ""}
              onClick={(e) => { e.preventDefault(); handleNav(l.id); }}>
              {l.label}
            </a>
          ))}
        </div>
        <Magnetic strength={0.2}>
          <button className="btn btn-accent nav-cta" onClick={() => handleNav("contato")}>
            {content.cta} <Icon name="arrow-up-right" size={14} />
          </button>
        </Magnetic>
        <button
          className={`nav-hamburger${mobileOpen ? " open" : ""}`}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
        >
          <span/><span/><span/>
        </button>
      </nav>

      {/* Mini logo bar — bottom-right, only in cat mode when nav is hidden */}
      <div className={`cat-mini-bar glass${catMode && !peek ? " cat-mini-bar--visible" : ""}`}
           onClick={onLogoClick} data-cursor="hover">
        <img src="/vector_framety.svg?v=1" alt="Framety" className="cat-mini-bar-logo" />
        <img src="/vector_bar.svg?v=1" alt="|" className="cat-mini-bar-sep" />
        <img src="/vector_skyline.svg?v=1" alt="Skyline" className="cat-mini-bar-skyline" />
      </div>

      {mobileOpen && (
        <div className="mobile-menu">
          {content.links.map(l => (
            <a key={l.id}
              className={`mobile-menu-link${current === l.id ? " active" : ""}`}
              onClick={(e) => { e.preventDefault(); handleNav(l.id); }}>
              {l.label}
            </a>
          ))}
          <button className="btn btn-accent mobile-menu-cta" onClick={() => handleNav("contato")}>
            {content.cta} <Icon name="arrow-up-right" size={14} />
          </button>
        </div>
      )}
    </>
  );
};

const Hero = ({ onNav }) => {
  const [t, setT] = useS(0);
  const [reelUrl, setReelUrl] = useS(window.getStoredReelUrl ? window.getStoredReelUrl() : "");
  const content = window.FRAMETY_CONTENT.hero;

  useEff(() => {
    const id = setInterval(() => setT(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEff(() => {
    const onChange = () => setReelUrl(window.getStoredReelUrl ? window.getStoredReelUrl() : "");
    window.addEventListener("framety:reel-updated", onChange);
    return () => window.removeEventListener("framety:reel-updated", onChange);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `00:${m}:${ss}`;
  };
  return (
    <section className="hero" id="home" data-screen-label="01 Home">
      <div className="hero-bg">
        {reelUrl ? (
          <>
            <video className="hero-video" src={reelUrl} autoPlay loop muted playsInline />
            <div className="hero-video-overlay" />
          </>
        ) : (
          <div className="hero-placeholder-reel">
            <div className="hero-placeholder-frame" />
            <div className="hero-placeholder-frame" />
            <div className="hero-placeholder-frame" />
            <div className="hero-placeholder-frame" />
            <div className="reel-scanline" />
            <div className="hero-video-overlay" />
          </div>
        )}
      </div>

      <div className="container hero-content">
        <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: content.titleHtml }} />
        <div className="hero-meta">
          <div className="hero-meta-row">
            <span className="label">{content.meta1Label}</span>
            <span className="value">{content.meta1Value}</span>
          </div>
          <div className="hero-meta-row">
            <span className="label">{content.meta2Label}</span>
            <span className="value">{content.meta2Value}</span>
          </div>
          <Magnetic>
            <button className="btn btn-ghost" onClick={() => onNav("trabalhos")}>
              <Icon name="play" size={12} /> {content.ctaButton}
            </button>
          </Magnetic>
        </div>
      </div>
      <div className="container hero-bar">
        <div className="reel-time">
          <span className="rec-dot" /> REC · {formatTime(t)}
        </div>
        <div className="hero-scroll">
          <span>Scroll</span>
          <span className="hero-scroll-line" />
        </div>
        <div>{content.badge} {new Date().getFullYear()}</div>
      </div>
    </section>
  );
};

const CategoriesSection = ({ onOpenCategory }) => {
  const content = window.FRAMETY_CONTENT.categories;
  const cats = window.FRAMETY_DATA.categories;   // read live so real-time edits reflect
  const allVids = window.FRAMETY_DATA.videos;
  const [visible, setVisible] = React.useState(20);
  const [hovered, setHovered] = React.useState(null);
  const [previewIdx, setPreviewIdx] = React.useState(0);
  const gridLeaveTimer = React.useRef(null);
  const cycleTimer = React.useRef(null);
  const cooldown = React.useRef(false);
  const shown = cats.slice(0, visible);

  React.useEffect(() => {
    if (window.initLetterSwap) {
      setTimeout(() => window.initLetterSwap('.nav-menu a', 'pingpong'), 300);
    }
  }, []);

  // Cycle through category videos every 3s on hover
  React.useEffect(() => {
    clearInterval(cycleTimer.current);
    setPreviewIdx(0);
    if (!hovered) return;
    const catVids = allVids.filter(v => v.category === hovered && v.status !== "draft" && window.getYouTubeId?.(v.videoUrl));
    if (catVids.length <= 1) return;
    cycleTimer.current = setInterval(() => setPreviewIdx(i => i + 1), 3000);
    return () => clearInterval(cycleTimer.current);
  }, [hovered]);

  const isTouch = React.useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);

  const handleEnter = (id) => {
    if (isTouch) return;
    if (gridLeaveTimer.current) { clearTimeout(gridLeaveTimer.current); gridLeaveTimer.current = null; }
    if (cooldown.current) return;
    cooldown.current = true;
    setHovered(id);
    setTimeout(() => { cooldown.current = false; }, 320);
  };

  const handleGridLeave = () => {
    gridLeaveTimer.current = setTimeout(() => {
      setHovered(null);
      cooldown.current = false;
      gridLeaveTimer.current = null;
    }, 180);
  };

  return (
    <section className="section" id="categorias" data-screen-label="02 Categorias" style={{ background: "transparent" }}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">— 02 / Categorias</div>
            <h2>Vídeos além do frame,<br /><span style={{ color: "var(--ink-mute)" }}>conheça as categorias:</span></h2>
          </div>
          <p className="chip-hint-desktop">Passe o cursor para expandir. Clique para entrar.</p>
          <p className="chip-hint-mobile">Toque para expandir · Toque de novo para entrar.</p>
        </div>

        <div className="chip-grid" onMouseLeave={handleGridLeave}>
          {shown.map((c) => {
            const isActive = hovered === c.id;
            const catVids = allVids.filter(v => v.category === c.id && v.status !== "draft" && window.getYouTubeId?.(v.videoUrl));
            const previewYtId = isActive && catVids.length > 0
              ? window.getYouTubeId(catVids[previewIdx % catVids.length].videoUrl)
              : null;

            return (
              <SpotlightCard
                key={c.id}
                color="red"
                data-id={c.id}
                className={[
                  "chip-card",
                  isActive ? "chip-active" : "",
                  hovered && !isActive ? "chip-dim" : "",
                  c.count === 0 ? "chip-empty" : "",
                ].filter(Boolean).join(" ")}
                onMouseEnter={() => handleEnter(c.id)}
                onClick={() => {
                  if (!isActive) {
                    // First tap (or click when not hovered): expand the chip
                    if (gridLeaveTimer.current) { clearTimeout(gridLeaveTimer.current); gridLeaveTimer.current = null; }
                    setHovered(c.id);
                  } else {
                    // Already expanded: enter the category
                    onOpenCategory(c.id);
                  }
                }}
                style={{ '--radius': 18 }}
              >
                <div className="chip-label">
                  <span className="chip-name">{c.name}</span>
                  <span className="chip-count">{c.count}</span>
                </div>
                <div className="chip-expand">
                  {previewYtId ? (
                    <iframe
                      key={previewYtId}
                      src={`https://www.youtube.com/embed/${previewYtId}?autoplay=1&mute=1&controls=0&rel=0&start=10&loop=1`}
                      className="chip-cover"
                      style={{ border: "none", pointerEvents: "none" }}
                      allow="autoplay"
                      title={`Preview — ${c.name}`}
                    />
                  ) : c.coverUrl ? (
                    <img src={c.coverUrl} className="chip-cover" loading="lazy" alt={c.name} />
                  ) : (
                    <div className={`chip-cover ${c.bgClass}`} />
                  )}
                  <div className="chip-overlay" />
                  <div className="chip-expand-body">
                    <div className="chip-expand-name">{c.name}</div>
                    <p className="chip-expand-desc">{c.desc}</p>
                    <span className="chip-expand-btn">{content.cardBtn} <Icon name="arrow-right" size={12} /></span>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {visible < cats.length && (
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button className="btn btn-ghost" onClick={() => setVisible(v => v + 20)}>
              {content.loadMore} <Icon name="plus" size={14} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

// Module-level helper — safe to call from any component in this file
const clientInitials = (s) => s.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

const ClientPageOverlay = ({ client, onClose, savedScrollRef, onOpenVideo }) => {
  const vids = (window.FRAMETY_DATA.videos || []).filter(v => v.client === client.name && v.status !== "draft");
  const content = window.FRAMETY_CONTENT.clients;
  const [previewId, setPreviewId] = React.useState(null);
  const hoverTimer = React.useRef(null);

  React.useEffect(() => {
    const scrollY = savedScrollRef.current;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    _scrollLock.lock(scrollbarW);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      _scrollLock.unlock();
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleEnter = (v) => {
    if (IS_TOUCH) return; // no hover-preview on touch — static cards
    const ytId = window.getYouTubeId?.(v.videoUrl);
    if (!ytId) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPreviewId(v.id), 600);
  };
  const handleLeave = () => { clearTimeout(hoverTimer.current); setPreviewId(null); };

  return (
    <div className="client-page-overlay" onClick={onClose}>
      <div className="client-page-inner" onClick={e => e.stopPropagation()}>
        <div className="client-page-accent-bar"/>
        <div className="client-page-header">
          <div className="client-page-logo">
            <div className="client-page-logo-mark">
              {client.logoUrl
                ? <img src={client.logoUrl} alt={client.name} loading="lazy" decoding="async" />
                : <span className="client-page-logo-initials">{clientInitials(client.name)}</span>}
            </div>
          </div>
          <button className="client-page-close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {vids.length > 0 ? (
          <div className="client-page-grid">
            {vids.map(v => {
              const thumb = window.getThumbUrl?.(v);
              const ytId = window.getYouTubeId?.(v.videoUrl);
              const isPrev = previewId === v.id;
              const cat = (window.FRAMETY_DATA.categories || []).find(c => c.id === v.category);
              return (
                <SpotlightCard key={v.id} color="red" className="cat-card"
                  onClick={() => onOpenVideo?.(v.id)}
                  onMouseEnter={() => handleEnter(v)}
                  onMouseLeave={handleLeave}
                  style={{ '--radius': 12 }}>

                  <div className={`cat-card-thumb${thumb || isPrev ? "" : ` ${cat?.bgClass || "bg-comm"}`}`}
                    style={!isPrev && thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>

                    {isPrev && ytId && (
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&rel=0&start=10&loop=1&playlist=${ytId}`}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
                        allow="autoplay" title={`Preview — ${v.title}`} />
                    )}

                    <div className="cat-card-overlay" />
                    <div className="cat-card-duration">{v.duration}</div>
                    <div className="cat-card-play"><Icon name="play" size={20} /></div>
                  </div>
                  {(v.aiGenerated || v.has360) && (
                    <div className="badge-stack">
                      {v.aiGenerated && <IABadge variant="pill" />}
                      {v.has360 && <Badge360 variant="pill" />}
                    </div>
                  )}
                  <div className="cat-card-info">
                    <div className="cat-card-meta-row">
                      <span className="cat-card-year">{v.year}</span>
                      <div className="cat-card-tags">
                        {(v.tags || []).slice(0, 2).map(t => <span key={t}>{t}</span>)}
                      </div>
                    </div>
                    <div className="cat-card-title">{v.title}</div>
                    <div className="cat-card-client-row">
                      {v.empreendimento
                        ? <span style={{ color: "var(--ink-mute)", fontSize: 11 }}>{v.empreendimento}</span>
                        : <span />}
                    </div>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "80px 48px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.15em", color: "var(--ink-mute)" }}>
            {content.noProjects}
          </div>
        )}
      </div>
    </div>
  );
};

const ClientsMarquee = ({ onOpenVideo }) => {
  const clients = window.FRAMETY_DATA.clients || [];
  const content = window.FRAMETY_CONTENT.clients;
  const [clientPage, setClientPage] = React.useState(null);
  const savedScrollRef = React.useRef(0);

  const active = clients;
  if (active.length === 0) return null;

  const openClientPage = (c) => {
    savedScrollRef.current = window.scrollY; // capture before any render/URL change
    window.history.pushState({ clientId: c.id }, '', `/framety/cliente/${c.id}`);
    setClientPage(c);
  };
  const closeClient = () => {
    if (window.location.pathname.toLowerCase().includes('/cliente/')) {
      window.history.replaceState(null, '', '/framety');
    }
    setClientPage(null);
  };

  React.useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname.toLowerCase();
      const m = p.match(/\/framety\/cliente\/([^/?]+)/i);
      if (!m) { setClientPage(null); }
      else {
        const cId = decodeURIComponent(m[1]);
        const found = clients.find(c => c.id === cId);
        if (found) { setClientPage(found); }
      }
    };
    const onNav = () => { setClientPage(null); };
    // Restore client overlay if page loaded directly on a client URL
    const initPath = window.location.pathname.toLowerCase();
    const initMatch = initPath.match(/\/framety\/cliente\/([^/?]+)/i);
    if (initMatch) {
      const cId = decodeURIComponent(initMatch[1]);
      const found = clients.find(c => c.id === cId);
      if (found) { setClientPage(found); }
    }
    window.addEventListener("popstate", onPop);
    window.addEventListener("framety-nav", onNav);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("framety-nav", onNav);
    };
  }, []);

  const mqReps = Math.max(8, Math.ceil(40 / active.length));
  const mqTrack = Array.from({ length: mqReps }, () => active).flat();

  return (
    <>
      <section className="section clients-section" id="clientes" data-screen-label="06 Clientes" style={{ padding: "100px 0 30px 0", background: "transparent" }}>
        <div className="container" style={{ marginBottom: 60 }}>
          <div className="num" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 24, height: 1, background: "var(--accent)" }} />{content.eyebrow}
          </div>
        </div>
        <div className="mq-stage">
          <div className="mq-row">
            <div className="mq-track" style={{ animationDuration: "45s" }}>
              {mqTrack.map((c, i) => (
                <div key={c.id + "-" + i} className="mq-item" onClick={() => openClientPage(c)} title={c.name}>
                  {c.logoUrl
                    ? <img src={c.logoUrl} alt={c.name} className="mq-logo" loading="lazy" />
                    : <span className="mq-initials">{clientInitials(c.name)}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {clientPage && <ClientPageOverlay client={clientPage} onClose={closeClient} savedScrollRef={savedScrollRef} onOpenVideo={onOpenVideo} />}
    </>
  );
};

const FeaturedSection = ({ onOpenVideo }) => {
  const vids = window.FRAMETY_DATA.videos.filter(v => v.featured && v.status !== "draft");
  const [hoveredIdx, setHoveredIdx] = React.useState(null);
  // Single flag: false = pre-mount (no transition), true = animate
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    // Two rAF frames to ensure browser painted the initial (hidden) state before animating
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setActive(true))
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = vids.length;
  const mid   = Math.floor(total / 2);

  // Dynamic layout: card size + overlap scale with number of featured videos
  const computeLayout = (n) => {
    if (n <= 0) return null;
    // Card width: shrinks as N grows, always 16:9
    const cardW = Math.round(Math.max(160, Math.min(380, 720 / Math.sqrt(n))));
    const cardH = Math.round(cardW * 9 / 16);
    // Single card: centered, no overlap, full elevation
    if (n === 1) return { cardW, cardH, marginLeft: 0, step: 0, maxH: 120 };
    // CSS step (visible strip per card): capped so the whole row fits in ~1260px
    const maxStepPx   = Math.floor((1260 - cardW) / (n - 1));
    const idealStepPx = Math.round(cardW * 0.45);         // ~45% of card exposed
    const minStepPx   = Math.round(cardW * 0.15);         // never less than 15%
    const stepPx      = Math.min(idealStepPx, Math.max(minStepPx, maxStepPx));
    const marginLeft  = stepPx - cardW;                   // negative = overlap
    // Animation stagger: distribute 100px arc across half the cards
    const half     = Math.max(1, Math.floor(n / 2));
    const animStep = Math.min(20, Math.max(5, Math.floor(100 / half)));
    return { cardW, cardH, marginLeft, step: animStep, maxH: 120 };
  };
  const layout = computeLayout(total);
  if (!layout) return null;

  return (
    <section className="section featured" id="trabalhos" data-screen-label="03 Projetos" style={{ paddingTop: 60, paddingBottom: 0 }}>

      {/* ── Section header ── */}
      <div className="container" style={{ marginBottom: 36 }}>
        <div className="section-head">
          <div>
            <div className="num">— 03 / Projetos</div>
            <h2>Vídeos em destaque<span style={{ color: "var(--accent)" }}>:</span></h2>
          </div>
        </div>
      </div>

      {/* ── Desktop: 3D stacked gallery ── */}
      {/* feat-gal-wrap = outer overflow:hidden that clips stage to ~200px visible */}
      <div className="feat-gal-wrap">
      <div className="feat-gal-stage">
        <div className="feat-gal-row">
          {vids.map((v, i) => {
            const dist          = Math.abs(i - mid);
            const staggerOffset = layout.maxH - dist * layout.step;
            const isHov         = hoveredIdx === i;
            const anyHov        = hoveredIdx !== null;

            const peekOffset = -Math.round(layout.maxH * 0.35);
            const yOffset = !active ? 200
              : isHov    ? -layout.maxH
              : anyHov   ? peekOffset
              : -staggerOffset;

            // Reference transition exactly:
            // duration 0.2s · ease [0.25,0.1,0.25,1] · delay index*0.05s
            // "none" on pre-mount so initial frame never flashes
            const delay      = `${i * 0.05}s`;
            const transition = active
              ? `transform 0.2s cubic-bezier(0.25,0.1,0.25,1) ${delay}, opacity 0.2s ease ${delay}`
              : 'none';

            const thumb   = window.getThumbUrl ? window.getThumbUrl(v) : null;
            const cat     = window.FRAMETY_DATA.categories.find(c => c.id === v.category);

            return (
              <div
                key={v.id}
                className={`feat-gal-item${isHov ? ' feat-gal-item--hov' : ''}`}
                style={{
                  zIndex:     total - i,
                  opacity:    active ? 1 : 0,
                  transform:  `perspective(5000px) rotateY(-45deg) translateY(${yOffset}px)`,
                  transition,
                  marginLeft: i === 0 ? 0 : layout.marginLeft,
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onOpenVideo(v.id)}
              >
                {/* Title + badges — fades in above the card on hover */}
                <div className="feat-gal-hover-label-wrap">
                  <span className="feat-gal-hover-label">{v.title}</span>
                  {(v.aiGenerated || v.has360) && (
                    <div style={{ display: "flex", gap: 4, alignItems: "flex-start", flexShrink: 0 }}>
                      {v.aiGenerated && <IABadge variant="header" />}
                      {v.has360 && <Badge360 variant="header" />}
                    </div>
                  )}
                </div>

                <div className="feat-gal-card" style={{ width: layout.cardW, height: layout.cardH }}>
                  {thumb
                    ? <img src={thumb} alt={v.title} className="feat-gal-thumb" loading="lazy" decoding="async" />
                    : <div className={`feat-gal-thumb feat-gal-thumb--ph ${cat?.bgClass || 'bg-comm'}`} />
                  }
                  <div className="feat-gal-overlay" />
                  <div className="feat-gal-info">
                    <span className="feat-gal-cat">{cat?.name || v.catLabel}</span>
                    <div className="feat-gal-title">{v.title}</div>
                  </div>
                  <div className="feat-gal-play"><Icon name="play" size={18} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>{/* /feat-gal-wrap */}

      {/* ── Mobile: horizontal scroll strip ── */}
      <div className="feat-gal-mobile">
        {vids.map((v) => {
          const thumb = window.getThumbUrl ? window.getThumbUrl(v) : null;
          const cat   = window.FRAMETY_DATA.categories.find(c => c.id === v.category);
          return (
            <div key={v.id} className="feat-gal-mobile-item" onClick={() => onOpenVideo(v.id)}>
              <div className="feat-gal-card" style={{ width: 240, height: 135 }}>
                {thumb
                  ? <img src={thumb} alt={v.title} className="feat-gal-thumb" loading="lazy" decoding="async" />
                  : <div className={`feat-gal-thumb feat-gal-thumb--ph ${cat?.bgClass || 'bg-comm'}`} />
                }
                <div className="feat-gal-overlay" />
                {(v.aiGenerated || v.has360) && (
                  <div className="badge-stack">
                    {v.aiGenerated && <IABadge variant="pill" />}
                    {v.has360 && <Badge360 variant="pill" />}
                  </div>
                )}
                <div className="feat-gal-info">
                  <span className="feat-gal-cat">{cat?.name || v.catLabel}</span>
                  <div className="feat-gal-title">{v.title}</div>
                </div>
                <div className="feat-gal-play"><Icon name="play" size={16} /></div>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
};

const AboutSection = () => {
  const content = window.FRAMETY_CONTENT.about;
  return (
    <section className="section about-section" id="sobre" data-screen-label="04 Sobre">
      <div className="container">
        <div className="num" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 24, height: 1, background: "var(--accent)" }} />{content.eyebrow}
        </div>
        <h2 className="about-quote" dangerouslySetInnerHTML={{ __html: content.quoteHtml }} />
        <div className="about-stats">
          {content.stats.map((s, idx) => (
            <div key={idx} className="stat">
              <div className="num">{s.num}</div>
              <div className="label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="marquee">
        <div className="marquee-track">
          {content.marquee.map((m, idx) => (
            <React.Fragment key={idx}>
              <span>{m}</span><span className="star">✦</span>
            </React.Fragment>
          ))}
          {/* Repeat for seamless loop */}
          {content.marquee.map((m, idx) => (
            <React.Fragment key={idx + 'rep'}>
              <span>{m}</span><span className="star">✦</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

const ProcessSection = () => {
  const content = window.FRAMETY_CONTENT.process;
  return (
    <section className="section process-section" id="processo">
      <div className="container">
        <div className="process-section-label">
          <span style={{ width: 24, height: 1, background: "var(--accent)", display: "inline-block", flexShrink: 0 }} />
          {content.eyebrow}
        </div>
        <h2 className="process-title">
          {content.title}<br />
          <span style={{ color: "var(--ink-mute)" }}>{content.subtitle}</span>
        </h2>
        <div className="process-steps">
          {content.steps.map((step, i) => (
            <div key={i} className="process-step-wrap">
              <div className={`process-step${i === 1 ? " process-step-indent" : ""}`}>
                <div className="process-step-left">
                  <span className="process-step-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="process-step-name">{step.name}</span>
                </div>
                <div className="process-step-right">
                  {step.desc && <p className="process-step-desc">{step.desc}</p>}
                  {step.tags && (
                    <div className="process-step-tags">
                      {step.tags.map(t => <span key={t}>{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
              {step.arrow && (
                <div className={`process-arrow-row process-arrow-${step.arrow}`}>
                  {step.arrow === "right" ? (
                    <svg className="process-arrow-svg" viewBox="0 0 160 56" fill="none">
                      <path d="M8 12 Q100 12 138 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M122 39 L138 44 L128 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg className="process-arrow-svg" viewBox="0 0 160 56" fill="none">
                      <path d="M152 12 Q60 12 22 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M38 39 L22 44 L32 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ContactSection = ({ onSecretClick }) => {
  const content = window.FRAMETY_CONTENT.contact;
  return (
    <section className="contact-section" id="contato" data-screen-label="05 Contato">
      <div className="container">
        <div className="num" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 40, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 24, height: 1, background: "var(--accent)" }} />{content.eyebrow}
        </div>
        <div className="contact-grid">
          <div>
            <h2 className="contact-headline" dangerouslySetInnerHTML={{ __html: content.titleHtml }} />
          </div>
          <div className="contact-card glass">
            {content.rows.map((r, idx) => (
              <div key={idx} className="contact-row">
                <span className="lab">{r.label}</span>
                <span className="val" onClick={r.label === "Estúdio" ? onSecretClick : undefined}
                  style={r.label === "Estúdio" ? { cursor: "default" } : {}}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const SiteFooter = () => {
  const content = window.FRAMETY_CONTENT.footer;
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-info">
          {content.phones.map((p, idx) => <span key={idx}>{p}</span>)}
          <div className="site-footer-spacer" />
          <a href={`mailto:${content.email}`}>{content.email}</a>
          <div className="site-footer-spacer" />
          {content.cities.map((c, idx) => <span key={idx}>{c}</span>)}
        </div>
        <div className="site-footer-bottom">
          <p className="site-footer-copy" dangerouslySetInnerHTML={{ __html: content.copyrightHtml }} />
          <div className="site-footer-socials">
            <a className="site-footer-social" href="https://www.youtube.com/@gruposkyline" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.8 15.5V8.5l6.2 3.5-6.2 3.5z" />
              </svg>
            </a>
            <a className="site-footer-social" href="https://www.instagram.com/frametyfilmes" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ──────────────────────────────────────────────────────────────
   Badge360 — expandable pill showing the 360° 3D simulation tag
   ────────────────────────────────────────────────────────────── */
const Badge360 = ({ variant = 'pill' }) => (
  <div className={'badge-360-pill' + (variant === 'header' ? ' badge-360-pill--header' : '')}
       onClick={e => e.stopPropagation()}>
    <div className="badge-360-icon">
      <span className="b360-main">360°</span>
      <span className="b360-sub">3D</span>
    </div>
    <span className="badge-360-text">Simulação em 3D do resultado da sala de imersão.</span>
  </div>
);

/* ──────────────────────────────────────────────────────────────
   IABadge — reusable IA badge (decor + expandable pill)
   ────────────────────────────────────────────────────────────── */
const IABadge = ({ variant = 'pill' }) => {
  const goToAI = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById('ia');
    if (el) { window.scrollTo({ top: el.offsetTop - 40, behavior: 'smooth' }); }
    else { window.location.href = '/framety#ia'; }
  };
  if (variant === 'decor') {
    return (
      <div className="ia-badge-decor">
        <span className="ia-main">IA</span>
        <span className="ia-sub">GENERATED</span>
      </div>
    );
  }
  return (
    <a className={'ia-pill' + (variant === 'header' ? ' ia-pill--header' : '')} href="/framety#ia" onClick={goToAI}>
      <div className="ia-pill-icon">
        <span className="ia-main">IA</span>
        <span className="ia-sub">GEN</span>
      </div>
      <span className="ia-pill-text">Cenas nesse filme foram geradas por IA, clique e conheça mais.</span>
    </a>
  );
};

/* ──────────────────────────────────────────────────────────────
   AISection — image accordion with shimmer title
   ────────────────────────────────────────────────────────────── */
const AISection = () => {
  const raw = window.FRAMETY_DATA?.aiSection || {};
  const c = {
    eyebrow:  raw.eyebrow  || '— 07 / Inteligência Artificial',
    title:    raw.title    || 'Introducing the future',
    subtitle: raw.subtitle || 'Geração de cenas com inteligência artificial.',
    body:     raw.body     || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    items:    Array.isArray(raw.items) && raw.items.length === 5 ? raw.items : [
      { id: 'ai-1', title: 'Voice Assistant',       imageUrl: '' },
      { id: 'ai-2', title: 'AI Image Generation',   imageUrl: '' },
      { id: 'ai-3', title: 'AI Chatbot + Local RAG', imageUrl: '' },
      { id: 'ai-4', title: 'AI Agent',               imageUrl: '' },
      { id: 'ai-5', title: 'Visual Understanding',   imageUrl: '' },
    ],
  };

  const [activeIdx, setActiveIdx] = React.useState(4);
  const activeRef   = React.useRef(4);
  const lockedRef   = React.useRef(false);
  const lockTimer   = React.useRef(null);
  const accordionRef = React.useRef(null);
  const [containerW, setContainerW] = React.useState(0);
  // Defer loading the (often heavy) accordion images/videos until the section is
  // near the viewport — avoids downloading tens of MB of media on initial load.
  const [inView, setInView] = React.useState(false);

  /* Measure accordion container width for explicit pixel widths */
  React.useEffect(() => {
    const el = accordionRef.current;
    if (!el) return;
    const update = () => setContainerW(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Load media only once the accordion approaches the viewport */
  React.useEffect(() => {
    const el = accordionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setInView(true); io.disconnect(); }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const INACTIVE_W = 58;
  const GAP        = 8;
  const N          = 5;
  const activeW    = containerW
    ? Math.max(80, containerW - (N - 1) * INACTIVE_W - (N - 1) * GAP)
    : null;

  const handleEnter = (idx) => {
    if (lockedRef.current || idx === activeRef.current) return;
    activeRef.current = idx;
    lockedRef.current = true;
    setActiveIdx(idx);
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => { lockedRef.current = false; }, 560);
  };

  return (
    <section className="section ai-section" id="ia" data-screen-label="07 IA" style={{ padding: '100px 0', background: 'transparent' }}>
      <div className="container">
        {/* Eyebrow */}
        <div className="num" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 24, height: 1, background: 'var(--accent)', display: 'inline-block' }} />
          {c.eyebrow}
        </div>

        <div className="ai-grid">
          {/* ── Left: text ── */}
          <div className="ai-text-col">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 20 }}>
              <h2 className="ai-shimmer-title" style={{ marginBottom: 0, flex: '1 1 auto' }}>{c.title}</h2>
              <IABadge variant="decor" />
            </div>
            {c.subtitle && <p className="ai-subtitle">{c.subtitle}</p>}
            {c.body && <p className="ai-body">{c.body}</p>}
            {c.features.length > 0 && (
              <ul className="ai-features">
                {c.features.map((f, i) => (
                  <li key={i} className="ai-feature-item">
                    <span className="ai-feature-dot" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Right: accordion ── */}
          <div className="ai-accordion-col">
            <div className="ai-accordion" ref={accordionRef}>
              {c.items.map((item, idx) => (
                <SpotlightCard
                  key={item.id}
                  color="red"
                  overlay={false}
                  className={'ai-acc-item' + (idx === activeIdx ? ' active' : '')}
                  style={{ ...(activeW ? { width: idx === activeIdx ? activeW : INACTIVE_W } : {}), '--backdrop': 'transparent', '--radius': '16', '--border': '1', '--size': '300' }}
                  onMouseEnter={() => handleEnter(idx)}
                  onClick={() => handleEnter(idx)}
                >
                  <div className="ai-acc-clip">
                    {inView && item.imageUrl
                      ? /\.mp4$/i.test(item.imageUrl)
                        ? <video src={item.imageUrl} className="ai-acc-img" autoPlay muted loop playsInline preload="metadata" />
                        : <img src={item.imageUrl} alt={item.title} className="ai-acc-img" loading="lazy" decoding="async" />
                      : <div className="ai-acc-placeholder" />}
                    <div className="ai-acc-overlay" />
                    <span className="ai-acc-label">{item.title}</span>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

Object.assign(window, { Nav, Hero, CategoriesSection, ClientsMarquee, AISection, IABadge, FeaturedSection, AboutSection, ProcessSection, SiteFooter, ContactSection });
