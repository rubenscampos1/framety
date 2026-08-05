/* app.jsx — root + routing + global search */
const FRAMETY_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#E63946",
  "accentMode": "neon-red",
  "showCursor": false,
  "glassIntensity": 18,
  "showAdminHint": false
}/*EDITMODE-END*/;

/* ── URL helpers ─────────────────────────────────────────── */
const parseUrl = () => {
  const p = window.location.pathname.toLowerCase();
  const h = window.location.hash;

  // Partner registration
  if (p.includes("/cadastroparceiro")) return { page: "partner", catId: null, tab: null };

  // Configurador de sala imersiva (ferramenta standalone, só por link)
  if (p === "/screendimension" || p.startsWith("/screendimension/")) return { page: "screendimension", catId: null, tab: null };

  // Storyboards — dois endereços, separados pelo prefixo. Nada de contar
  // segmentos: o que está sob /storyboards é SEMPRE nosso, atrás da senha, e o
  // que o cliente recebe é sempre um código opaco em /sb.
  //   /storyboards                               → índice protegido por senha
  //   /storyboards/<cliente>/<produto>/<projeto> → o documento, para editar (protegido)
  //   /sb/<código>                               → visão do cliente (link aberto)
  // O caminho legível deixou de ser público: só quem tem o código chega ao
  // documento, e ele não se adivinha a partir do nome do cliente.
  if (p === "/storyboards" || p.startsWith("/storyboards/")) return { page: "storyboard-index", catId: null, tab: null };
  if (p === "/sb" || p.startsWith("/sb/")) return { page: "storyboard-share", catId: null, tab: null };

  // Produções — read-only shareable link (scoped, external)
  if (p === "/producoes" || p.startsWith("/producoes/") || p.startsWith("/producoes?")) {
    return { page: "producoes-share", catId: null, tab: null };
  }

  // Category playlist — public watch-only shareable link
  const playMatch = p.match(/\/assistir\/([^/?]+)/i);
  if (playMatch) return { page: "playlist", catId: decodeURIComponent(playMatch[1]), tab: null, videoId: null };

  // Tutorial / suporte ao cliente — but NOT /console/tutorial (that's admin)
  if (p === "/tutorial" || p.startsWith("/tutorial/") || p.startsWith("/tutorial?")) {
    return { page: "tutorial", catId: null, tab: null };
  }

  // Presentation Mode
  if (p.includes("/presentation") || h === "#presentation") return { page: "presentation", catId: null, tab: null };

  // Category
  const catMatch = p.match(/\/framety\/categoria\/([^/?]+)/i);
  if (catMatch) return { page: "category", catId: decodeURIComponent(catMatch[1]), tab: null, videoId: null };

  // Video (Standalone link)
  const vidMatch = p.match(/\/framety\/video\/([^/?]+)/i);
  if (vidMatch) return { page: "home", catId: null, tab: null, videoId: decodeURIComponent(vidMatch[1]) };

  // Console / Admin
  if (p.includes("/console")) {
    const tabMatch = p.match(/\/console\/([^/?]+)/i);
    const tabSlug = tabMatch ? tabMatch[1] : "overview";
    
    // Map slugs to internal tab names
    const slugMap = {
      "visao-geral": "overview",
      "videos": "videos",
      "clientes": "clientes",
      "categorias": "categorias",
      "demoreel": "reel",
      "ia": "ia",
      "seguranca": "seguranca",
      "parceiros": "parceiros",
      "tutorial": "tutorial",
      "locucoes": "locucoes",
      "links": "links",
      "storyboards": "storyboards",
    };
    
    // Find internal tab name from slug or vice-versa (fallback to overview)
    const tab = slugMap[tabSlug] || "overview";
    
    // Check if logged in (this is handled by state usually, but URL tells us intent)
    const hasToken = !!window.API?.getToken?.();
    return { page: hasToken ? "admin" : "admin-login", catId: null, tab: tab };
  }

  return { page: "home", catId: null, tab: null };
};

/* ── Global Search component ─────────────────────────────── */
const GlobalSearch = ({ onClose, onOpenCategory, onOpenVideo, onOpenClient, adminMode = false, storyboardsOnly = false }) => {
  const [query, setQuery]   = React.useState("");
  const [hoverVid, setHoverVid] = React.useState(null);
  const inputRef   = React.useRef(null);
  const hoverTimer = React.useRef(null);
  const data = window.FRAMETY_DATA || { categories: [], videos: [], clients: [] };

  // Storyboards não vivem no FRAMETY_DATA (são só de quem tem sessão). O que já
  // foi carregado antes serve de partida, e a lista é atualizada ao abrir.
  const [sbs, setSbs] = React.useState(() => window.FRAMETY_SB || []);
  React.useEffect(() => {
    if (!window.API?.getToken?.()) return;
    window.API.getStoryboards()
      .then((l) => { window.FRAMETY_SB = l; setSbs(l); })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.toLowerCase().trim();

  const matchSb = window.sbMatchesStoryboard || (() => false);
  const matchedSbs = !q ? [] : sbs.filter((s) => matchSb(s, q)).slice(0, 9);

  const matchedCats = storyboardsOnly || !q ? [] : data.categories.filter(c =>
    c.name.toLowerCase().includes(q) || c.desc?.toLowerCase().includes(q)
  );
  const matchedClients = storyboardsOnly || !q ? [] : (data.clients || []).filter(c =>
    c.name.toLowerCase().includes(q)
  );
  const allEmps = [...new Set(data.videos.map(v => v.empreendimento).filter(Boolean))];
  const matchedEmps = storyboardsOnly || !q ? [] : allEmps.filter(e => e.toLowerCase().includes(q));
  const matchedVids = storyboardsOnly || !q ? [] : data.videos.filter(v =>
    v.status !== "draft" && (
      v.title.toLowerCase().includes(q) ||
      v.catLabel?.toLowerCase().includes(q) ||
      v.client?.toLowerCase().includes(q) ||
      v.empreendimento?.toLowerCase().includes(q) ||
      v.tags?.some(t => t.toLowerCase().includes(q))
    )
  ).slice(0, 9);

  const hasResults = matchedCats.length || matchedClients.length || matchedEmps.length || matchedVids.length || matchedSbs.length;
  const SB_LABEL = { v1: "Aguardando revisão V1", v2: "Aguardando revisão V2", v3: "Aguardando revisão V3",
                     v4: "Aguardando revisão V4", aprovado: "Aprovado" };

  const CB = window.ClientBadge;
  const getThumb = window.getThumbUrl;
  const getYtId  = window.getYouTubeId;

  return (
    <div className="gsearch-overlay" onClick={onClose}>

      {/* Unified glass card */}
      <window.SpotlightCard className="gsearch-box" color="red" overlay={false}
        style={{ '--backdrop':'rgba(8,8,14,0.80)', '--radius':'22', '--border':'1', '--size':'320' }}
        onClick={e => e.stopPropagation()}>

        {/* Input row */}
        <div className="gsearch-input-row">
          <Icon name="search" size={16} style={{color:"var(--ink-mute)",flexShrink:0}}/>
          <input
            ref={inputRef}
            className="gsearch-input"
            placeholder={storyboardsOnly
              ? "Buscar storyboard por cliente, projeto ou produto…"
              : "Buscar vídeo, categoria, cliente, empreendimento…"}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query
            ? <button className="gsearch-clear" onClick={() => setQuery("")}><Icon name="x" size={11}/></button>
            : null
          }
          <span className="gsearch-kbd">ESC</span>
        </div>

        {/* Results panel — inside the glass card */}
        {q && (
        <div className="gsearch-results-panel">
          {!hasResults && <div className="gsearch-empty">Nenhum resultado para "{query}"</div>}

          {hasResults && (
            <div className="gsearch-results">

              {matchedSbs.length > 0 && (
                <div className="gsearch-group">
                  <div className="gsearch-group-label">Storyboards</div>
                  {matchedSbs.map(s => (
                    <button key={s.id} className="gsearch-item"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('framety-open-storyboard', { detail: { id: s.id } }));
                        onClose();
                      }}>
                      <span className="gsearch-item-icon"><Icon name="list" size={12}/></span>
                      <span className="gsearch-item-title">{s.cliente || "Sem cliente"}</span>
                      <span className="gsearch-item-sub">
                        {[s.produto, s.projeto].filter(Boolean).join(" · ") || "—"}
                        {" · "}{SB_LABEL[s.status] || s.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {matchedCats.length > 0 && (
                <div className="gsearch-group">
                  <div className="gsearch-group-label">Categorias</div>
                  {matchedCats.map(c => (
                    <button key={c.id} className="gsearch-item"
                      onClick={() => { onOpenCategory(c.id); onClose(); }}>
                      <span className="gsearch-item-icon"><Icon name="grid" size={12}/></span>
                      <span className="gsearch-item-title">{c.name}</span>
                      <span className="gsearch-item-sub">{c.count} projetos</span>
                    </button>
                  ))}
                </div>
              )}

              {matchedClients.length > 0 && (
                <div className="gsearch-group">
                  <div className="gsearch-group-label">Clientes</div>
                  {matchedClients.map(c => (
                    <button key={c.id} className="gsearch-item"
                      onClick={() => { onOpenClient?.(c.id); onClose(); }}>
                      <span className="gsearch-item-icon">
                        {CB ? <CB name={c.name} size={14}/> : <Icon name="users" size={12}/>}
                      </span>
                      <span className="gsearch-item-title">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {matchedEmps.length > 0 && (
                <div className="gsearch-group">
                  <div className="gsearch-group-label">Empreendimentos</div>
                  {matchedEmps.map(emp => {
                    const vid = data.videos.find(v => v.empreendimento === emp);
                    return (
                      <button key={emp} className="gsearch-item"
                        onClick={() => { if (vid) onOpenCategory(vid.category); onClose(); }}>
                        <span className="gsearch-item-icon"><Icon name="arrow-up-right" size={12}/></span>
                        <span className="gsearch-item-title">{emp}</span>
                        {vid && <span className="gsearch-item-sub">{vid.client}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {matchedVids.length > 0 && (
                <div className="gsearch-group">
                  <div className="gsearch-group-label">Vídeos</div>
                  {matchedVids.map(v => {
                    const thumb = getThumb ? getThumb(v) : null;
                    const ytId  = getYtId  ? getYtId(v.videoUrl) : null;
                    const isHov = hoverVid === v.id;
                    return (
                      <button key={v.id} className="gsearch-item gsearch-item-video"
                        onClick={() => { onOpenVideo(v.id); onClose(); }}
                        onMouseEnter={() => {
                          clearTimeout(hoverTimer.current);
                          hoverTimer.current = setTimeout(() => setHoverVid(v.id), 450);
                        }}
                        onMouseLeave={() => { clearTimeout(hoverTimer.current); setHoverVid(null); }}>
                        <div className="gsearch-video-thumb"
                          style={thumb && !isHov ? {backgroundImage:`url(${thumb})`} : {}}>
                          {isHov && ytId && (
                            <iframe
                              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&rel=0&start=10`}
                              style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none",pointerEvents:"none"}}
                              allow="autoplay" title="preview"
                            />
                          )}
                          {!thumb && !isHov && <Icon name="play" size={11} style={{color:"rgba(255,255,255,0.35)"}}/>}
                        </div>
                        <div className="gsearch-video-info">
                          <div className="gsearch-item-title">{v.title}</div>
                          <div className="gsearch-item-sub">
                            {v.catLabel}{v.client ? ` · ${v.client}` : ""}{v.empreendimento ? ` · ${v.empreendimento}` : ""}
                          </div>
                        </div>
                        {adminMode && (
                          <button className="gsearch-edit-btn" title="Editar vídeo"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('framety-admin-edit', { detail: { videoId: v.id } }));
                              onClose();
                            }}>
                            <Icon name="edit" size={13}/>
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      </window.SpotlightCard>
    </div>
  );
};

const Preloader = ({ fadeOut }) => (
  <div className={`preloader-overlay ${fadeOut ? "fade-out" : ""}`}>
    <dotlottie-player
      src="https://lottie.host/7b021c4f-c07b-4fa7-a871-4f97765a15b7/R1VsSDksQ4.lottie"
      background="transparent"
      speed="1.5"
      style={{ width: 600, height: 600 }}
      autoplay
      loop
      transparent
    />
  </div>
);

/* ── App root ─────────────────────────────────────────────── */
const App = () => {
  const init = parseUrl();
  const [page,    setPage]    = React.useState(init.page);
  const [catId,   setCatId]   = React.useState(init.catId);
  const [adminTab, setAdminTab] = React.useState(init.tab || "overview");
  const [videoId, setVideoId] = React.useState(init.videoId || null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [dataVersion, setDataVersion] = React.useState(0);

  // Live updates: when content changes on the server (edited by anyone), re-fetch
  // the public data and bump a version so the whole tree re-reads window.FRAMETY_DATA.
  React.useEffect(() => {
    if (!window.FRAMETY_LIVE) return;
    return window.FRAMETY_LIVE.on('content', () => {
      fetch('/api/data').then(r => r.json()).then(d => {
        window.FRAMETY_DATA = d;
        window.getStoredReelUrl = () => (d.reel && d.reel.url) || '';
        window.dispatchEvent(new CustomEvent('framety:reel-updated'));
        setDataVersion(v => v + 1);
      }).catch(() => {});
    });
  }, []);
   const [initialLoading, setInitialLoading] = React.useState(true);
   const [fadeOut, setFadeOut] = React.useState(false);
   const [contentVisible, setContentVisible] = React.useState(false);
   const [logoRipples, setLogoRipples] = React.useState([]);
   const clickTimes = React.useRef([]);
   const initialHashRef = React.useRef(window.location.hash.slice(1) || "");

   React.useEffect(() => {
     const t1 = setTimeout(() => setFadeOut(true), 1600);
     const t2 = setTimeout(() => setInitialLoading(false), 2200);
     const t3 = setTimeout(() => {
       setContentVisible(true);
       const bg = document.getElementById('wave-bg');
       if (bg) bg.style.opacity = "1";
     }, 1800);
     const hash = initialHashRef.current;
     const t4 = hash ? setTimeout(() => scrollToSection(hash), 2100) : null;
     return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); if (t4) clearTimeout(t4); };
   }, []);

  const _tw = window.useTweaks ? window.useTweaks(FRAMETY_TWEAK_DEFAULTS) : null;
  const tweaks  = _tw ? _tw[0] : FRAMETY_TWEAK_DEFAULTS;
  const setTweak = _tw ? _tw[1] : () => {};

  // Apply tweak vars
  React.useEffect(() => {
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.documentElement.style.setProperty("--accent-glow", tweaks.accent + "73");
    document.body.style.cursor = "auto";
  }, [tweaks.accent, tweaks.showCursor]);

  // Browser back/forward + pushState sync
  React.useEffect(() => {
    // Guard against double-patching (Strict Mode / hot reload)
    const _PATCH_KEY = '__framety_pushstate_patched__';
    if (!window.history[_PATCH_KEY]) {
      const originalPush = window.history.pushState.bind(window.history);
      window.history.pushState = function() {
        originalPush.apply(this, arguments);
        window.dispatchEvent(new Event("popstate"));
      };
      window.history[_PATCH_KEY] = originalPush;
    }

    const onPop = () => {
      const { page: p, catId: c, tab: t, videoId: v } = parseUrl();
      setPage(p);
      if (c) setCatId(c);
      if (t) setAdminTab(t);
      setVideoId(v || null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Restore original on unmount
      if (window.history[_PATCH_KEY]) {
        window.history.pushState = window.history[_PATCH_KEY];
        delete window.history[_PATCH_KEY];
      }
    };
  }, []);

  // Ctrl+Space → global search (except inside admin)
  React.useEffect(() => {
    const playSearchSound = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1080, t);
        osc.frequency.exponentialRampToValueAtTime(680, t + 0.08);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.09, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        osc.start(t); osc.stop(t + 0.1);
        setTimeout(() => ctx.close(), 300);
      } catch(_) {}
    };
    const onKey = (e) => {
      if (e.code === "Space" && (e.ctrlKey || e.metaKey)) {
        if (page === "admin-login") return;
        e.preventDefault();
        playSearchSound();
        setShowSearch(s => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setPage("admin-login");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page]);

  // Section navigation
  const navTo = (id) => {
    window.dispatchEvent(new Event("framety-nav"));
    if (page !== "home") {
      window.history.pushState(null, "", "/framety#" + id);
      setPage("home");
      setTimeout(() => scrollToSection(id), 50);
      return;
    }
    window.history.replaceState(null, "", id === "home" ? "/framety" : "/framety#" + id);
    scrollToSection(id);
  };
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 40, behavior: "smooth" });
  };

  // Triple-click on logo → admin login
  const onLogoClick = () => {
    const now = Date.now();
    clickTimes.current = [...clickTimes.current.filter(t => now - t < 800), now];
    const ripId = Math.random().toString(36).slice(2, 7);
    setLogoRipples(rs => [...rs, ripId]);
    setTimeout(() => setLogoRipples(rs => rs.filter(r => r !== ripId)), 600);
    if (clickTimes.current.length >= 3) {
      clickTimes.current = [];
      window.history.pushState(null, "", "/console");
      setPage("admin-login");
    }
  };

  const openCategory = (id) => {
    window.history.pushState(null, "", `/framety/categoria/${id}`);
    setCatId(id);
    setPage("category");
    window.scrollTo(0, 0);
  };

  const backFromCategory = () => {
    window.history.pushState(null, "", "/framety#categorias");
    setPage("home");
    setTimeout(() => scrollToSection("categorias"), 50);
  };

  const openVideo = (id) => {
    const currentPath = window.location.pathname + window.location.hash;
    window.history.replaceState({ prev: currentPath }, "", currentPath);
    setVideoId(id);
  };

  // Opens a client overlay from anywhere (e.g. global search).
  // When already on home: patched pushState fires popstate → ClientsMarquee opens overlay.
  // When on another page: navigate home first; ClientsMarquee restores overlay from URL on mount.
  const openClient = (clientId) => {
    const url = `/framety/cliente/${clientId}`;
    if (page === "home") {
      window.history.pushState({ clientId }, "", url);
      setTimeout(() => scrollToSection("clientes"), 80);
    } else {
      window.history.pushState(null, "", url);
      setPage("home");
      window.scrollTo(0, 0);
    }
  };
  const closeVideo = React.useCallback(() => {
    setVideoId(null);
  }, []);
  const exitAdmin = () => {
    window.history.pushState(null, "", "/framety");
    setPage("home");
    window.scrollTo(0, 0);
  };

  // Active nav section from scroll
  const [active, setActive] = React.useState("home");
  React.useEffect(() => {
    if (page !== "home") return;
    const onScroll = () => {
      const ids = ["home","categorias","trabalhos","sobre","contato"];
      let cur = "home";
      const y = window.scrollY + 200;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) cur = id;
      }
      setActive(cur);
      window.history.replaceState(null, "", cur === "home" ? "/framety" : "/framety#" + cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [page]);

   return (
     <div className="app">
       {initialLoading && <Preloader fadeOut={fadeOut} />}
       
       <div className="app-main-wrapper" style={{ 
         opacity: contentVisible ? 1 : 0, 
         transition: "opacity 1.2s ease",
         pointerEvents: contentVisible ? "auto" : "none" 
       }}>
         {tweaks.showCursor && <CustomCursor />}

      {(page === "home" || page === "category") && (
        <Nav
          current={page === "home" ? active : "categorias"}
          onNav={navTo}
          onLogoClick={onLogoClick}
          ripples={logoRipples}
        />
      )}

      {page === "home" && (
        <main className="page-enter">
          <Hero onNav={navTo} />
          <CategoriesSection onOpenCategory={openCategory} />
          <ClientsMarquee onOpenVideo={openVideo}/>
          <AISection />
          <FeaturedSection onOpenVideo={openVideo} />
          <AboutSection />
          <ProcessSection />
          <ContactSection onSecretClick={() => setPage("admin-login")} />
          <SiteFooter />
        </main>
      )}

      {page === "category" && (
        <>
          <CategoryPage catId={catId} onBack={backFromCategory} onOpenVideo={openVideo} />
          <SiteFooter />
        </>
      )}

      {page === "admin-login" && (
        <AdminLogin onClose={() => { window.history.pushState(null,"","/framety"); setPage("home"); }} 
          onSuccess={() => { window.history.pushState(null,"","/console/visao-geral"); setAdminTab("overview"); setPage("admin"); }} />
      )}
      
      {page === "admin" && (
        <AdminDashboard 
          initialTab={adminTab}
          onExit={exitAdmin} 
          onOpenPresentation={() => {
            window.history.pushState(null, "", "/presentation");
            setPage("presentation"); 
            window.scrollTo(0, 0);
          }}/>
      )}

      {page === "partner" && <PartnerForm />}

      {page === "screendimension" && <ScreenDimensionPage />}

      {page === "storyboard-share" && <StoryboardSharePage />}

      {page === "storyboard-index" && <StoryboardIndexPage />}

      {page === "producoes-share" && <window.ProducoesShareApp />}

      {page === "playlist" && <PlaylistPage catId={catId} />}

      {page === "tutorial" && <TutorialPage />}

      {page === "presentation" && (
        <PresentationMode onExit={() => { 
          window.history.pushState(null, "", "/console/visao-geral"); 
          setAdminTab("overview");
          setPage("admin"); 
          window.scrollTo(0, 0); 
        }} onOpenVideo={openVideo}/>
      )}

      {videoId && <VideoModal videoId={videoId} onClose={closeVideo}
        onOpenVideo={(id) => { closeVideo(); setTimeout(() => openVideo(id), 50); }}
        onContactNav={() => { navTo("contato"); }}
      />}

      {showSearch && (
        <GlobalSearch
          onClose={() => setShowSearch(false)}
          onOpenCategory={(id) => { openCategory(id); }}
          onOpenVideo={(id) => { openVideo(id); }}
          onOpenClient={(id) => { openClient(id); }}
          adminMode={page === "admin"}
          storyboardsOnly={page === "storyboard-index"}
        />
      )}

      {tweaks.showAdminHint && (
        <div className="dev-hint">3× CLIQUES NO LOGO · OU CMD+SHIFT+A</div>
      )}

      {_tw && window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Aparência" />
          <window.TweakRadio
            label="Acento"
            value={tweaks.accentMode}
            options={[
              { value: "neon-red", label: "Red" },
              { value: "lime",     label: "Lime" },
              { value: "amber",    label: "Amber" },
              { value: "ice",      label: "Ice" },
            ]}
            onChange={(v) => {
              const map = { "neon-red":"#FF2D2D", "lime":"#D4FF4F", "amber":"#FF8A3D", "ice":"#6BB8FF" };
              setTweak({ accentMode: v, accent: map[v] });
            }}
          />
          <window.TweakColor label="Cor exata" value={tweaks.accent} onChange={(v) => setTweak("accent", v)} />
          <window.TweakSection label="Interações" />
          <window.TweakToggle label="Custom cursor"  value={tweaks.showCursor}    onChange={(v) => setTweak("showCursor", v)} />
          <window.TweakToggle label="Dica do admin"  value={tweaks.showAdminHint} onChange={(v) => setTweak("showAdminHint", v)} />
          <window.TweakSection label="Atalhos" />
          <window.TweakButton label="Abrir login do admin"   onClick={() => setPage("admin-login")} />
          <window.TweakButton label="Pular para dashboard"   onClick={() => setPage("admin")} />
          <window.TweakButton label="Modo apresentação"      onClick={() => setPage("presentation")} />
           <window.TweakButton label="Voltar para home" secondary onClick={() => { setPage("home"); window.scrollTo(0,0); }} />
         </window.TweaksPanel>
       )}
       </div>
     </div>
   );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
