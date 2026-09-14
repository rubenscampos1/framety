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
      // Overlay de tela cheia cobre o fundo animado: parar de desenhá-lo devolve
      // a GPU para o que está na frente (era metade do engasgo na página do cliente).
      window.__waveBgPause?.(true);
    }
  },
  unlock() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      window.__waveBgPause?.(false);
    }
  },
};

/* Entrada em cascata, palavra a palavra (o "whisper text").

   O componente de referência usa GSAP + ScrollTrigger + Tailwind; aqui não há
   nenhum dos três, e o texto fica no topo da página — o gatilho de rolagem
   dispararia no primeiro quadro de qualquer jeito. O efeito é o mesmo: cada
   palavra aparece 80ms depois da anterior, em 0.4s, com a curva do power2.out.
   Feito em CSS, ele não custa uma biblioteca nem roda na thread principal.

   A cascata só começa quando a página termina de aparecer (body.home-pronta):
   antes disso o site inteiro está em opacity 0 e a animação passaria sem ser
   vista.

   O texto é HTML (vem do console), então em vez de fatiar a string por espaços
   — que partiria <strong>duas palavras</strong> no meio — o conteúdo é lido
   como DOM e reconstruído: as tags permanecem, e cada palavra DENTRO delas vira
   um span animado. Reconstruir também joga fora qualquer atributo, o que torna
   isto mais restrito do que um dangerouslySetInnerHTML. */
const WHISPER_TAGS = { strong: 1, b: 1, em: 1, i: 1, span: 1, u: 1, br: 1 };

const WhisperText = ({ html, className = "", delay = 80, base = 0, duration = 0.4 }) => {
  const ref = React.useRef(null);
  const [noAr, setNoAr] = React.useState(false);

  /* Leitura de posição a cada 140ms em vez de IntersectionObserver: a página
     rola dentro de um contêiner e o evento nem sempre chega ao window. O timer
     morre no instante em que o texto entra. */
  React.useEffect(() => {
    if (noAr) return;
    let id = null;
    const olhar = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.88 && r.bottom > 0) { clearInterval(id); setNoAr(true); }
    };
    olhar();
    id = setInterval(olhar, 140);
    return () => clearInterval(id);
  }, [noAr]);

  const arvore = React.useMemo(() => {
    const doc = new DOMParser().parseFromString("<div id=raiz>" + String(html || "") + "</div>", "text/html");
    const raiz = doc.getElementById("raiz");
    let n = 0;

    const converter = (no, chave) => {
      if (no.nodeType === 3) {
        return no.textContent.split(/(\s+)/).map((parte, i) => {
          if (!parte.trim()) return parte;   // o espaço entre palavras é texto de verdade
          const idx = n++;
          return (
            <span
              key={chave + "t" + i}
              className="whisper-w"
              style={{ animationDelay: `${base + idx * delay}ms`, animationDuration: `${duration}s` }}
            >{parte}</span>
          );
        });
      }
      if (no.nodeType === 1) {
        const tag = no.tagName.toLowerCase();
        if (!WHISPER_TAGS[tag]) return no.textContent;   // tag fora da lista: só o texto
        if (tag === "br") return <br key={chave} />;
        return React.createElement(
          tag,
          { key: chave },
          [...no.childNodes].map((f, i) => converter(f, chave + "f" + i))
        );
      }
      return null;
    };

    return raiz ? [...raiz.childNodes].map((f, i) => converter(f, "n" + i)) : null;
  }, [html, delay, base, duration]);

  return <span ref={ref} className={"whisper " + (noAr ? "no-ar " : "") + className}>{arvore}</span>;
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
          {/* A marca do grupo é um link para fora; o stopPropagation evita que o
              clique acione também o comportamento do logo da Framety. */}
          <a
            href="https://www.skylineip.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Site do Grupo Skyline (abre em nova aba)"
            title="Ir para o site do Grupo Skyline"
            data-cursor="hover"
            style={{ display: "flex", alignItems: "center" }}
          >
            <img src="/vector_skyline.svg?v=1" alt="Grupo Skyline" style={{ height: "45px", width: "auto" }} />
          </a>
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
        {/* Mesma regra do topo: a marca do grupo leva ao site do grupo. */}
        <a href="https://www.skylineip.com.br/" target="_blank" rel="noopener noreferrer"
           onClick={(e) => e.stopPropagation()} aria-label="Site do Grupo Skyline (abre em nova aba)"
           title="Ir para o site do Grupo Skyline" data-cursor="hover" style={{ display: "flex", alignItems: "center" }}>
          <img src="/vector_skyline.svg?v=1" alt="Skyline" className="cat-mini-bar-skyline" />
        </a>
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

/* ── Tarjas pretas do reel ────────────────────────────────────────────────────
   O reel é exportado em cinemascope: o arquivo é 16:9, mas com barras pretas
   coladas em cima e embaixo. Como a capa é colada na borda superior da tela, a
   barra de cima aparecia como uma faixa preta atravessando o topo do site.

   A medida não é chutada nem fixa: a capa busca dois quadros do próprio vídeo
   (o Cloudinary entrega qualquer segundo como JPEG) e procura, em miniatura,
   onde a imagem começa e termina. Fica o MENOR corte entre os dois quadros —
   uma cena escura sozinha faria a conta enxergar tarja onde não há.

   Com as tarjas medidas, o vídeo é ampliado o bastante para elas saírem da
   moldura. Custo de nitidez: quase nenhum, porque o vídeo já era reduzido para
   caber na tela — o trecho útil sai de 1080px de fonte para 900px de tela, uma
   ampliação de 8%.

   Sem Cloudinary (upload local, em desenvolvimento) a medição não roda e o
   vídeo fica como está. */
const REEL_QUADROS = [5, 12];        // segundos amostrados
const REEL_TARJA_MIN = 0.015;        // abaixo disto não é tarja, é cena escura
const REEL_ESCALA_MAX = 1.7;         // trava de segurança

const quadroDoReel = (url, segundo) => {
  const m = String(url || "").match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(?:[^/]*\/)*(v\d+\/.+)\.\w+$/i);
  if (!m) return null;
  return `${m[1]}so_${segundo},w_320,c_limit/${m[2]}.jpg`;
};

const medirTarjas = (img) => {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  let d;
  try { d = ctx.getImageData(0, 0, c.width, c.height).data; }
  catch (e) { return null; }                       // canvas sujo: desiste
  const brilho = (y) => {
    let s = 0, n = 0;
    for (let x = 0; x < c.width; x += 4) { const i = (y * c.width + x) * 4; s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
    return s / n;
  };
  let topo = 0, base = 0;
  while (topo < c.height && brilho(topo) < 12) topo++;
  while (base < c.height && brilho(c.height - 1 - base) < 12) base++;
  if (topo + base >= c.height) return null;        // quadro inteiro preto
  return { topo: topo / c.height, base: base / c.height };
};

const useReelSemTarja = (url) => {
  const [ajuste, setAjuste] = React.useState(null);

  React.useEffect(() => {
    setAjuste(null);
    const urls = REEL_QUADROS.map((s) => quadroDoReel(url, s)).filter(Boolean);
    if (!urls.length) return;
    let vivo = true;

    Promise.all(urls.map((u) => new Promise((ok) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => ok(medirTarjas(img));
      img.onerror = () => ok(null);
      img.src = u;
      setTimeout(() => ok(null), 9000);
    }))).then((medidas) => {
      if (!vivo) return;
      const boas = medidas.filter(Boolean);
      if (!boas.length) return;
      const topo = Math.min(...boas.map((m) => m.topo));
      const base = Math.min(...boas.map((m) => m.base));
      if (topo + base < REEL_TARJA_MIN) return;    // vídeo já é cheio
      const util = 1 - topo - base;
      const escala = Math.min(1 / util, REEL_ESCALA_MAX);
      // as tarjas costumam ser desiguais: recentraliza o trecho útil
      const centro = topo + util / 2;
      setAjuste({ escala, desloc: (0.5 - centro) * escala * 100 });
    });

    return () => { vivo = false; };
  }, [url]);

  return ajuste;
};

const Hero = ({ onNav }) => {
  const [t, setT] = useS(0);
  const [reelUrl, setReelUrl] = useS(window.getStoredReelUrl ? window.getStoredReelUrl() : "");
  const corteReel = useReelSemTarja(reelUrl);
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
            <video className="hero-video" src={VIDEO_CDN(reelUrl)} autoPlay loop muted playsInline
                   style={corteReel ? { transform: `translateY(${corteReel.desloc}%) scale(${corteReel.escala})` } : null} />
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
        {/* O h1 era escondido (só para buscador) e a capa não tinha texto nenhum.
            Agora ele é o texto da capa de verdade, com o subtexto embaixo. */}
        <div className="hero-intro">
          <h1 className="hero-title">
            <WhisperText html={content.titleHtml} />
          </h1>
          {content.subtitleHtml && (
            <p className="hero-sub">
              {/* Cascata mais rápida e começando depois do título: a 80ms por
                  palavra, um parágrafo destes levaria quase dois segundos
                  pingando na tela. */}
              <WhisperText html={content.subtitleHtml} delay={18} base={520} />
            </p>
          )}
        </div>
        <div className="hero-meta">
          <Magnetic>
            <button className="btn btn-ghost" onClick={() => onNav("trabalhos")}>
              <Icon name="play" size={12} /> {content.ctaButton}
            </button>
          </Magnetic>
          <Magnetic>
            <button className="btn btn-accent" onClick={() => onNav("contato")}>
              {content.ctaContato} <Icon name="arrow-right" size={13} />
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

/* Categorias em pastas. Cada card é uma pasta: a capa da categoria fica dentro,
   fraca em repouso; no hover a frente desce alguns pixels — como quem abre a
   pasta — e a capa acende. Um clique entra na categoria (o padrão anterior, de
   expandir no hover e só entrar no segundo clique, saiu junto com os chips). */
const CategoriesSection = ({ onOpenCategory }) => {
  const content = window.FRAMETY_CONTENT.categories;
  const cats = window.FRAMETY_DATA.categories;   // read live so real-time edits reflect
  const [visible, setVisible] = React.useState(20);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(copyTimer.current), []);
  const shown = cats.slice(0, visible);

  // Compartilhar a categoria: mesmo endereço que a própria página de categoria
  // oferece no botão dela (/assistir/<id>), para o link ser sempre o mesmo.
  const copyCategoryLink = (e, c) => {
    e.stopPropagation();   // o clique não pode abrir a categoria junto
    const url = `${window.location.origin}/assistir/${c.id}`;
    const done = () => {
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    };
    // A API moderna não existe fora de contexto seguro (o site aberto pelo IP da
    // rede, no celular, é um caso real) e falha quando a janela está sem foco.
    // O textarea + execCommand cobre esses dois casos; o prompt é o último recurso.
    const copiaAntiga = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch { return false; }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(done)
        .catch(() => { if (copiaAntiga()) done(); else window.prompt("Copie o link da categoria:", url); });
    } else if (copiaAntiga()) {
      done();
    } else {
      window.prompt("Copie o link da categoria:", url);
    }
  };

  React.useEffect(() => {
    if (window.initLetterSwap) {
      setTimeout(() => window.initLetterSwap('.nav-menu a', 'pingpong'), 300);
    }
  }, []);

  // Canto inferior direito da pasta: quando a categoria foi mexida pela última
  // vez. Sem vídeo publicado não há data — e aí o próprio vazio é a informação.
  const folderMeta = (c) => {
    if (!c.count) return content.emptyLabel;
    if (!c.lastUpdated) return "";
    const d = new Date(c.lastUpdated);
    if (isNaN(d)) return "";
    return `${content.updatedPrefix} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <section className="section" id="categorias" data-screen-label="02 Categorias" style={{ background: "transparent" }}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">{content.eyebrow}</div>
            <h2>{content.title}<br /><span style={{ color: "var(--ink-mute)" }}>{content.subtitle}</span></h2>
          </div>
          <p className="chip-hint-desktop">{content.hint}</p>
          <p className="chip-hint-mobile">{content.hintMobile}</p>
        </div>

        <div className="folder-grid">
          {shown.map((c) => (
            <article
              key={c.id}
              className={"folder-card" + (c.count === 0 ? " folder-empty" : "")}
              onClick={() => onOpenCategory(c.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;   // veio do botão de compartilhar
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenCategory(c.id); }
              }}
              role="button" tabIndex={0}
              aria-label={`${c.name} — ${c.count} ${c.count === 1 ? "vídeo" : "vídeos"}`}
              data-cursor="hover"
            >
              <button
                type="button"
                className="folder-share"
                onClick={(ev) => copyCategoryLink(ev, c)}
                title={`Copiar link de ${c.name}`}
                aria-label={`Copiar link da categoria ${c.name}`}
                data-cursor="hover"
              >
                <Icon name="share" size={13}/>
              </button>
              <div className="folder-cover-wrap">
                {c.coverUrl
                  ? <img className="folder-cover" src={IMG_CDN(c.coverUrl, 600)} alt="" loading="lazy" />
                  : <div className={`folder-cover is-gradient ${c.bgClass || "bg-comm"}`} />}
              </div>
              <div className="folder-face">
                {/* A aba fica DENTRO do painel: como a altura do painel agora sai do
                    conteúdo, ela precisa se pendurar na borda de cima dele. */}
                <div className="folder-panel">
                  <span className="folder-tab" />
                  <h3 className="folder-title">{c.name}</h3>
                  {/* O span existe para o recorte de 2 linhas funcionar: o <p> é item
                      de flex do painel, e item de flex blockifica o display:-webkit-box
                      de que o line-clamp depende. */}
                  <p className="folder-sub"><span>{c.desc}</span></p>
                  <div className="folder-foot">
                    <span className="folder-count">
                      {c.count}
                      <span className="folder-count-label">{c.count === 1 ? content.countLabelOne : content.countLabel}</span>
                    </span>
                    <span className="folder-meta">{folderMeta(c)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {copied && (
          <div className="site-toast" role="status" aria-live="polite">
            <span className="dot"/> Link copiado.
          </div>
        )}

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
                ? <img src={IMG_CDN(client.logoUrl, 240)} alt={client.name} loading="lazy" decoding="async" />
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
                /* Desliga o fundo e o contorno que o SpotlightCard escreve no
                   elemento — o mesmo que é feito no grid de categoria. */
                <SpotlightCard key={v.id} color="red" className="cat-card"
                  onClick={() => onOpenVideo?.(v.id)}
                  onMouseEnter={() => handleEnter(v)}
                  onMouseLeave={handleLeave}
                  style={{ '--radius': 12, '--backdrop': 'transparent', '--backup-border': 'transparent' }}>

                  <div className={`cat-card-thumb${thumb || isPrev ? "" : ` ${cat?.bgClass || "bg-comm"}`}`}
                    style={!isPrev && thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: "var(--zoom-thumb, cover)", backgroundPosition: "center" } : {}}>

                    {isPrev && ytId && (
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&rel=0&start=10&loop=1&playlist=${ytId}`}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
                        allow="autoplay" title={`Preview — ${v.title}`} />
                    )}

                    <div className="cat-card-overlay" />
                    <div className="cat-card-duration">{v.duration}</div>
                    <div className="cat-card-play"><Icon name="play" size={20} /></div>
                    <div className="cat-card-legenda">{v.title}</div>
                  </div>
                  {(v.aiGenerated || v.has360) && (
                    <div className="badge-stack">
                      {v.aiGenerated && <IABadge variant="pill" />}
                      {v.has360 && <Badge360 variant="pill" />}
                    </div>
                  )}
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
          <div className="num" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 24, height: 1, background: "var(--accent)" }} />{content.eyebrow}
          </div>
        </div>
        <div className="mq-stage">
          <div className="mq-row">
            <div className="mq-track" style={{ animationDuration: "45s" }}>
              {mqTrack.map((c, i) => (
                <div key={c.id + "-" + i} className="mq-item" onClick={() => openClientPage(c)} title={c.name}>
                  {c.logoUrl
                    ? <img src={IMG_CDN(c.logoUrl, 240)} alt={c.name} className="mq-logo" loading="lazy" />
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

/* ── Corredor de destaques ────────────────────────────────────────────────
   Porte do ImageStreamHero para o JSX/CSS daqui (o original é React+Tailwind+TS
   e depende de `cn`/`@/lib/utils`, que não existem neste projeto). O que veio
   inteiro é a geometria, que é o miolo do componente:

   - a profundidade é escrita como TAMANHO APARENTE, em progressão geométrica —
     cada card é uma razão fixa maior que o de trás. Espaçar z linearmente faz os
     cards da frente se descolarem uns dos outros quando a projeção amplia;
   - os trilhos abrem forte no começo e depois seguram (`fan` > 1). Essa abertura
     cancela o crescimento ainda lento lá no fundo, então a fita sai do centro
     reta, dobra uma vez e só aí corre na diagonal;
   - nenhuma ponta do ciclo aparece: o card morre com a borda interna além de
     50cqw e nasce ATRAVESSANDO o eixo (`railBirth` negativo), o que tampa a
     garganta — sem isso abre um buraco no centro uma vez por ciclo.

   Tudo em `cqw` (porcentagem da largura do contêiner), então o corredor mantém
   a proporção em qualquer tamanho. Os números foram reajustados para card
   deitado 16:9 (o original é retrato). */
const CORRIDOR_PATH = {
  perspective: 30,
  cardWidth: 26,
  cardHeight: 14.6,   // 16:9
  cardRadius: 0.5,
  birthHeight: 4.4,
  /* Altura aparente do card ao deixar a cena. É este número que governa a
     escala do corredor inteiro — o resto é proporção. */
  exitHeight: 20,
  /* Quanto o card se afasta do eixo. Fechado de propósito: com o trilho aberto
     demais, os cards da frente saíam pelas laterais antes de dar para vê-los. */
  railBirth: -8,
  railExit: 30,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 20,
  /* Fração do trajeto em que o card termina de aparecer / começa a se apagar. */
  fadeIn: 0.16,
  fadeOut: 0.86,
};
/* Quantos cards cada trilho mostra ao mesmo tempo. Poucos deixam a fita rala:
   o tamanho aparente cresce em progressão geométrica, então com 4 cards cada um
   é ~1,5x o anterior e sobra vão entre eles. Por isso o nascimento vem grande
   (birthHeight lá em cima), para os quatro caberem numa faixa de tamanhos mais
   curta e o corredor não virar quatro cards perdidos. */
const CORRIDOR_CARDS = 4;    // cards por trilho ao mesmo tempo
const CORRIDOR_SPEED = 30;   // segundos para atravessar o corredor inteiro
const CORRIDOR_AXIS = 54;    // altura do eixo de fuga, em % do palco
/* Faixa sensível: só aqui dentro o ponteiro segura o corredor. O palco é alto
   por causa dos cards da frente, mas a fita de vídeos ocupa uma tira estreita no
   meio — parar a animação ao entrar em qualquer canto do palco fazia o corredor
   travar sem que o visitante estivesse perto de um vídeo. Em % da altura. */
const CORRIDOR_ZONA = { topo: 40, base: 68 };

/* Amostra o caminho uma vez para os keyframes traçarem a curva de verdade.

   São DUAS animações, e não uma: a de fora leva o card pelo corredor (posição,
   opacidade e ponteiro) e a de dentro só faz a inclinação. Separadas porque o
   card em destaque precisa ficar reto, e a inclinação mora no `transform` — que
   pertence à animação e não pode ser sobrescrito por regra nenhuma. Com a
   rotação numa animação própria, basta desligá-la no hover e o card se endireita
   sozinho, sem perder o lugar dele no corredor.

   A opacidade cuida das duas pontas do ciclo: o card entra translúcido para não
   pipocar no ponto de fuga e sai apagando no fim do trajeto, em vez de
   desaparecer de um quadro para o outro quando a volta reinicia.

   Só entram aqui transform e opacity. É deliberado: qualquer propriedade que o
   compositor não saiba animar — pointer-events, por exemplo — derruba a
   animação INTEIRA para a thread principal, e eram 26 delas rodando assim, o
   que aparecia como engasgo. Quem ignora o clique num card quase invisível
   agora é o próprio manipulador, que olha a opacidade na hora. */
const corridorKeyframes = (dir, nomeTrilho, nomeGiro, p) => {
  const trilho = [];
  const giro = [];
  for (let s = 0; s <= p.stops; s++) {
    const u = s / p.stops;
    const scale = (p.birthHeight / p.cardHeight) * Math.pow(p.exitHeight / p.birthHeight, u);
    const z = p.perspective * (1 - 1 / scale);
    const rail = p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan);
    const turn = p.turnBirth + (p.turnExit - p.turnBirth) * u;
    const entra = Math.min(1, u / p.fadeIn);
    const sai = u > p.fadeOut ? Math.max(0, 1 - (u - p.fadeOut) / (1 - p.fadeOut)) : 1;
    const op = Math.min(entra, sai);
    const pct = (u * 100).toFixed(2);
    trilho.push(
      `${pct}%{transform:translate3d(${(dir * rail).toFixed(2)}cqw,0,${z.toFixed(2)}cqw);opacity:${op.toFixed(3)}}`
    );
    giro.push(`${pct}%{transform:rotateY(${(-dir * turn).toFixed(2)}deg)}`);
  }
  return `@keyframes ${nomeTrilho}{${trilho.join("")}}@keyframes ${nomeGiro}{${giro.join("")}}`;
};

const FeaturedSection = ({ onOpenVideo }) => {
  const content = window.FRAMETY_CONTENT.featured;
  const vids = window.FRAMETY_DATA.videos.filter(v => v.featured && v.status !== "draft");
  const [hovered, setHovered] = React.useState(null);   // chave do card sob o mouse
  const [naFaixa, setNaFaixa] = React.useState(false);  // ponteiro dentro da tira sensível

  const seguirPonteiro = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * 100;
    setNaFaixa(y >= CORRIDOR_ZONA.topo && y <= CORRIDOR_ZONA.base);
  };

  /* Fora da tela o corredor não desenha. São 26 cards em 3D girando o tempo
     todo; sem isto eles seguem custando GPU enquanto o visitante lê o resto da
     página. */
  const palcoRef = React.useRef(null);
  const [naTela, setNaTela] = React.useState(true);
  React.useEffect(() => {
    const el = palcoRef.current;
    if (!el || !window.IntersectionObserver) return;
    const obs = new IntersectionObserver(
      ([e]) => setNaTela(e.isIntersecting),
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const nameR = `ishR${uid}`;      // trilho da direita: posição
  const nameL = `ishL${uid}`;      // trilho da esquerda: posição
  const giroR = `ishGR${uid}`;     // inclinação de cada lado, animação à parte
  const giroL = `ishGL${uid}`;
  const css = React.useMemo(
    () => corridorKeyframes(1, nameR, giroR, CORRIDOR_PATH) + corridorKeyframes(-1, nameL, giroL, CORRIDOR_PATH)
      + `@media(prefers-reduced-motion:reduce){.ish-slot,.ish-card{animation-play-state:paused}}`,
    [nameR, nameL, giroR, giroL]
  );

  if (!vids.length) return null;

  /* Os dois trilhos não repetem vídeo entre si: a lista é partida no meio, cada
     metade corre de um lado. (Com um vídeo só não há o que dividir.) */
  const meio = Math.ceil(vids.length / 2);
  const trilhos = vids.length > 1
    ? [{ name: nameR, giro: giroR, dir: "r", list: vids.slice(0, meio) },
       { name: nameL, giro: giroL, dir: "l", list: vids.slice(meio) }]
    : [{ name: nameR, giro: giroR, dir: "r", list: vids },
       { name: nameL, giro: giroL, dir: "l", list: vids }];

  const hoveredVid = hovered ? vids.find(v => v.id === hovered.split("|")[0]) : null;
  const p = CORRIDOR_PATH;

  return (
    <section className="section featured" id="trabalhos" data-screen-label="03 Projetos" style={{ paddingTop: 60, paddingBottom: 0 }}>

      {/* ── Section header ── */}
      <div className="container" style={{ marginBottom: 36 }}>
        <div className="section-head">
          <div>
            <div className="num">{content.eyebrow}</div>
            {/* Os dois-pontos na cor de destaque são decoração: só entram quando o
                título editado no console não termina com pontuação própria. */}
            <h2>{content.title}{/[:.!?…]$/.test(content.title || "") ? null : <span style={{ color: "var(--accent)" }}>:</span>}</h2>
          </div>
        </div>
      </div>

      {/* ── Desktop: corredor 3D ── */}
      <div
        ref={palcoRef}
        className={"ish-stage" + (naFaixa ? " ish-stage--faixa" : "") + (naFaixa && hovered ? " ish-stage--hov" : "") + (naTela ? "" : " ish-stage--off")}
        onMouseMove={seguirPonteiro}
        onMouseLeave={() => setNaFaixa(false)}
      >
        <style>{css}</style>
        <div
          className="ish-space"
          style={{ perspective: `${p.perspective}cqw`, perspectiveOrigin: `50% ${CORRIDOR_AXIS}%` }}
          aria-hidden="true"
        >
          <div className="ish-world">
            {trilhos.map(trilho =>
              Array.from({ length: CORRIDOR_CARDS }, (_, i) => {
                const v = trilho.list[i % trilho.list.length];
                const key = `${v.id}|${trilho.dir}|${i}`;
                const thumb = window.getThumbUrl ? window.getThumbUrl(v) : null;
                const cat = window.FRAMETY_DATA.categories.find(c => c.id === v.category);
                // As duas animações compartilham duração e atraso, então andam juntas.
                const ritmo = {
                  animationDuration: `${CORRIDOR_SPEED}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  // Atraso negativo joga cada card no meio do voo: o corredor
                  // já nasce cheio, sem a fila se formando na primeira volta.
                  animationDelay: `${-(i * CORRIDOR_SPEED) / CORRIDOR_CARDS}s`,
                };
                return (
                  <div
                    key={key}
                    className={`ish-slot ish-slot--${trilho.dir}` + (naFaixa && hovered === key ? " ish-slot--hov" : "")}
                    style={{
                      left: "50%",
                      top: `${CORRIDOR_AXIS}%`,
                      width: `${p.cardWidth}cqw`,
                      height: `${p.cardHeight}cqw`,
                      marginLeft: `${-p.cardWidth / 2}cqw`,
                      marginTop: `${-p.cardHeight / 2}cqw`,
                      // Propriedades separadas de propósito: o atalho `animation` traz
                      // `play-state: running` embutido e, vindo inline, venceria a regra
                      // que pausa o corredor no hover.
                      animationName: trilho.name,
                      ...ritmo,
                    }}
                    /* Card nascendo ou saindo (quase transparente) não responde:
                       antes isso era feito animando pointer-events, o que tirava a
                       animação do compositor. Aqui custa uma leitura por evento. */
                    onMouseEnter={(ev) => {
                      if (parseFloat(getComputedStyle(ev.currentTarget).opacity) < 0.25) return;
                      /* A animação está pausada (o ponteiro está na faixa), então o
                         ângulo é estável: lemos a matriz do card e mandamos a face
                         girar o mesmo tanto ao contrário. É o que deixa a thumb reta
                         sem interromper animação nenhuma. */
                      const card = ev.currentTarget.querySelector(".ish-card");
                      const face = card && card.querySelector(".ish-face");
                      if (card && face) {
                        /* No quadro seguinte: a pausa vem do mousemove que marca a
                           faixa, e ler no mesmo quadro pega o ângulo ainda andando —
                           a thumb ficava um grau ou dois fora do esquadro. */
                        requestAnimationFrame(() => {
                          const m = new DOMMatrixReadOnly(getComputedStyle(card).transform);
                          const ang = Math.atan2(-m.m13, m.m11) * 180 / Math.PI;
                          face.style.transform = "rotateY(" + (-ang).toFixed(2) + "deg)";
                        });
                      }
                      setHovered(key);
                    }}
                    onMouseLeave={(ev) => {
                      const face = ev.currentTarget.querySelector(".ish-face");
                      if (face) face.style.transform = "";
                      setHovered(h => (h === key ? null : h));
                    }}
                    onClick={(ev) => { if (parseFloat(getComputedStyle(ev.currentTarget).opacity) >= 0.25) onOpenVideo(v.id); }}
                  >
                  <div
                    className="ish-card"
                    style={{
                      borderRadius: `${p.cardRadius}cqw`,
                      /* O nome vai numa variável, e não em animationName: estilo
                         inline vence a folha, e a regra que endireita o card em
                         destaque precisa poder desligar esta animação. */
                      "--giro": trilho.giro,
                      ...ritmo,
                    }}
                  >
                  {/* A face é quem se endireita no destaque, girando o contrário
                      do que a animação está aplicando no card. Antes eu desligava
                      a animação de inclinação — e ao voltar ela recomeçava do
                      próprio início, o que fazia o card saltar sem motivo. */}
                  <div className="ish-face">
                    {thumb
                      ? <img src={thumb} alt="" loading="lazy" decoding="async" draggable={false} />
                      : (
                        /* Sem capa, o card mostra o gradiente da categoria com o
                           título por cima — em vez de um retângulo vazio. */
                        <div className={`ish-ph ${cat?.bgClass || "bg-comm"}`}>
                          <span>{v.title}</span>
                        </div>
                      )}
                  </div>
                  </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Nome do vídeo sob o cursor: parado no rodapé do palco, não no card —
            legível mesmo com o card inclinado e correndo. */}
        {naFaixa && hoveredVid && (
          <div className="ish-caption">
            <span className="t">{hoveredVid.title}</span>
            <span className="s">
              {hoveredVid.client}
              {hoveredVid.year ? ` · ${hoveredVid.year}` : ""}
              {hoveredVid.duration ? ` · ${hoveredVid.duration}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* O corredor é decoração para quem usa leitor de tela (aria-hidden): a
          mesma lista fica aqui, alcançável pelo teclado. */}
      <ul className="sr-only">
        {vids.map(v => (
          <li key={v.id}>
            <button type="button" onClick={() => onOpenVideo(v.id)}>{v.title}</button>
          </li>
        ))}
      </ul>

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
        <div className="num" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
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

/* ── Baralho de diferenciais ───────────────────────────────────────────────
   Porte do DisplayCards (o original é React + Tailwind + shadcn, e depende de
   `cn`/`@/lib/utils` e do lucide-react — nada disso existe aqui). O que veio
   inteiro é a ideia: cartões inclinados, empilhados num único lugar do grid,
   cada um deslocado do anterior, apagados em cinza até o ponteiro chegar.

   Três coisas mudaram, e por motivo:

   - **z-index no hover.** O original tem três cartões; com cinco, levantar um
     de trás não adianta — ele continua sendo pintado por baixo dos da frente.
   - **A máscara da direita sai no hover.** No original ela é fixa, porque o
     texto é curto ("Discover amazing content"). Aqui a linha de apoio é uma
     frase inteira, e um degradê permanente comendo metade do cartão deixaria o
     texto ilegível justamente quando ele é lido.
   - **Sem backdrop-filter.** O fundo animado é um canvas redesenhado a cada
     quadro, e desfocar o que está atrás dele foi o que engasgou a página de
     clientes. Aqui o fundo do cartão é opaco e o custo é zero.

   O deslocamento vai na propriedade `translate`, não no `transform`: assim ele
   compõe com o `skewY` sem que um apague o outro. */
const PROCESS_CARD_ICONS = ["star", "sparkles", "video", "grid", "share"];

const ProcessCards = ({ cards }) => {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  return (
    <div className="dc-stack" style={{ "--dc-n": cards.length }}>
      {cards.map((c, i) => (
        /* Duas camadas de propósito: o <article> é o alvo do mouse e NUNCA se
           mexe; quem sobe é o .dc-interno, dentro dele. Quando os dois eram a
           mesma coisa, o cartão subia, saía de debaixo do ponteiro, perdia o
           hover, caía, recebia de novo — e piscava sem parar com o mouse
           parado no mesmo lugar. */
        <article key={i} className="dc-card" style={{ "--i": i }}>
          <div className="dc-interno">
            <div className="dc-topo">
              <span className="dc-icone">
                <Icon name={PROCESS_CARD_ICONS[i % PROCESS_CARD_ICONS.length]} size={13} />
              </span>
              <h3 className="dc-titulo">{c.title}</h3>
            </div>
            {c.sub && <p className="dc-sub">{c.sub}</p>}
          </div>
        </article>
      ))}
    </div>
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
        {/* Texto à esquerda, baralho à direita. O parágrafo saiu de dentro do
            <h2>: ali ele herdava o corpo do título e virava um bloco de letra
            grande e apagada em vez de um texto para ler. */}
        <div className="process-intro">
          <div className="process-intro-texto">
            <h2 className="process-title">{content.title}</h2>
            {content.subtitle && <p className="process-lead">{content.subtitle}</p>}
          </div>
          <ProcessCards cards={content.cards} />
        </div>
        <div className="process-steps">
          {content.steps.map((step, i) => (
            <div key={i} className="process-step-wrap">
              <div className={`process-step${i % 2 === 1 ? " process-step-indent" : ""}`}>
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
        <div className="num" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 40, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 24, height: 1, background: "var(--accent)" }} />{content.eyebrow}
        </div>
        <div className="contact-grid">
          <div>
            <h2 className="contact-headline"><WhisperText html={content.titleHtml} /></h2>
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
            {content.ctaLabel && LINK_SEGURO(content.ctaHref) && (
              <a className="btn btn-accent contact-cta" href={content.ctaHref}
                 target="_blank" rel="noopener noreferrer" data-cursor="hover">
                {content.ctaLabel} <Icon name="arrow-right" size={15} />
              </a>
            )}
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
        <div className="num" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
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
