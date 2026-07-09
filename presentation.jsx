/* presentation.jsx — clean YouTube-like presentation mode */

const PresentationMode = ({ onExit, onOpenVideo }) => {
  const [activeCat, setActiveCat] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState("recent");
  const [loading, setLoading] = React.useState(true);
  const [fade, setFade] = React.useState(false);
  const [heroHover, setHeroHover] = React.useState(false);

  React.useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1200);
    const t2 = setTimeout(() => setLoading(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const cats = window.FRAMETY_DATA.categories;
  let videos = window.FRAMETY_DATA.videos.filter(v => v.status !== "draft");
  if (activeCat !== "all") videos = videos.filter(v => v.category === activeCat);
  if (search) videos = videos.filter(v => v.title.toLowerCase().includes(search.toLowerCase()) || (v.client || "").toLowerCase().includes(search.toLowerCase()));
  if (sort === "views") {
    const parseViews = (v) => {
      if (!v || v.startsWith("—")) return 0;
      let num = parseFloat(v);
      if (v.includes("M")) num *= 1000000;
      else if (v.includes("K")) num *= 1000;
      return isNaN(num) ? 0 : num;
    };
    videos.sort((a,b) => parseViews(b.views) - parseViews(a.views));
  }

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const featured = window.FRAMETY_DATA.videos.find(v => v.featured && v.status !== "draft") || window.FRAMETY_DATA.videos.find(v => v.status !== "draft");
  const featuredCat = cats.find(c => c.id === featured?.category);

  const featThumb = featured ? (window.getThumbUrl ? window.getThumbUrl(featured) : null) : null;
  const ytId = featured?.videoUrl?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];

   return (
     <div className="pres-shell page-enter" data-screen-label="08 Apresentação">
       {loading && (
         <div className={`preloader-overlay ${fade ? "fade-out" : ""}`} style={{zIndex: 9999}}>
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
       )}
       <div style={{
         opacity: loading ? 0 : 1,
         transition: "opacity 1.2s ease",
         pointerEvents: loading ? "none" : "auto",
         display: "flex", flexDirection: "column", flex: 1, overflow: "hidden"
       }}>
         <header className="pres-top" style={{paddingLeft: 60}}>
         <div className="pres-top-left" style={{flex: 1, display: "flex", alignItems: "center", gap: "36px"}}>
           <div style={{display: "flex", alignItems: "center", gap: "20px"}}>
             <img src="/vector_framety.svg?v=1" alt="Framety" style={{height: 71, transform: "translateY(12px)"}}/>
             <img src="/vector_bar.svg?v=1" alt="|" style={{height: 40, opacity: 0.5}}/>
             <img src="/vector_skyline.svg?v=1" alt="Grupo Skyline" style={{height: 40}}/>
           </div>
           <span className="pres-mode-tag">MODO APRESENTAÇÃO</span>
         </div>
         <div className="pres-search">
           <Icon name="search" size={14}/>
           <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar vídeo, cliente ou tag…"/>
         </div>
         <div className="pres-top-right" style={{flex: 1, display: "flex", justifyContent: "flex-end"}}>
           {/* Botão de sair removido por solicitação do usuário */}
         </div>
       </header>

       <div className="pres-body">
         <aside className="pres-side glass-strong glass">
          <div className="pres-side-group">
            <div className="pres-side-label">— Categorias</div>
            <button className={"pres-side-item " + (activeCat==="all"?"active":"")} onClick={()=>setActiveCat("all")} data-cursor="hover">
              <span className="ico"><Icon name="folder" size={14}/></span>
              <span>Todos os vídeos</span>
              <span className="num">{window.FRAMETY_DATA.videos.filter(v => v.status !== "draft").length}</span>
            </button>
            {cats.map(c => (
              <button key={c.id} className={"pres-side-item " + (activeCat===c.id?"active":"")} onClick={()=>setActiveCat(c.id)} data-cursor="hover">
                <span className={`ico-thumb ${c.bgClass}`}/>
                <span>{c.name}</span>
                <span className="num">{c.count}</span>
              </button>
            ))}
          </div>
          <div className="pres-side-group">
            <div className="pres-side-label">— Ordenar</div>
            <button className={"pres-side-item compact " + (sort==="recent"?"active":"")} onClick={()=>setSort("recent")} data-cursor="hover">
              <span>Mais recentes</span>
            </button>
            <button className={"pres-side-item compact " + (sort==="views"?"active":"")} onClick={()=>setSort("views")} data-cursor="hover">
              <span>Mais vistos</span>
            </button>
          </div>
        </aside>

        <main className="pres-main">
            {activeCat === "all" && !search && featured && (
              <SpotlightCard
                color="red"
                className="pres-hero"
                onClick={() => onOpenVideo(featured.id)}
                data-cursor="hover"
                onMouseEnter={() => setHeroHover(true)}
                onMouseLeave={() => setHeroHover(false)}
                style={{ '--radius': 20 }}
              >
                <div className={`pres-hero-thumb ${featuredCat?.bgClass || "bg-comm"}`}
                  style={!heroHover && featThumb ? { backgroundImage: `url(${featThumb})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>

                  {heroHover && ytId && (
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${ytId}&start=10`}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
                      allow="autoplay"
                      title="featured"
                    />
                  )}

                  {!featThumb && !heroHover && <div className="pres-placeholder">[ DESTAQUE ]</div>}
                </div>
                <div className="pres-hero-info">
                  <span className="pres-hero-tag">Em destaque <span className="dot-sep">·</span> {featured.catLabel}</span>
                  <h1>{featured.title}</h1>
                  <div className="pres-hero-meta">
                    <span>{featured.client}</span>
                    <span className="dot-sep">·</span>
                    <span>{featured.year}</span>
                    <span className="dot-sep">·</span>
                    <span>{featured.duration}</span>
                    <span className="dot-sep">·</span>
                    <span>{featured.views} views</span>
                  </div>
                  <div className="pres-hero-cta">
                    <button className="btn btn-accent" data-cursor="hover">
                      <Icon name="play" size={12} /> Reproduzir
                    </button>
                  </div>
                </div>
              </SpotlightCard>
            )}

            {cats.filter(c => activeCat === "all" || c.id === activeCat).map(cat => {
              const items = videos.filter(v => v.category === cat.id);
              if (items.length === 0) return null;
              return (
                <section key={cat.id} className="pres-row">
                  <header className="pres-row-head">
                    <h2>{cat.name}</h2>
                    <span className="pres-row-count">{items.length} {items.length === 1 ? "vídeo" : "vídeos"}</span>
                    {activeCat === "all" && (
                      <button className="pres-row-more" onClick={() => setActiveCat(cat.id)} data-cursor="hover">
                        Ver tudo <Icon name="arrow-right" size={12} />
                      </button>
                    )}
                  </header>
                  <div className="pres-grid">
                    {items.map(v => {
                      const thumb = window.getThumbUrl ? window.getThumbUrl(v) : null;
                      return (
                        <SpotlightCard
                          key={v.id}
                          color="red"
                          className="pres-card"
                          onClick={() => onOpenVideo(v.id)}
                          data-cursor="hover"
                          style={{ '--radius': 14 }}
                        >
                          <div className={`pres-card-thumb ${cat.bgClass}`}
                            style={thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
                            {!thumb && <div className="pres-placeholder small">[ THUMB ]</div>}
                            <span className="pres-card-duration">{v.duration}</span>
                            <div className="pres-card-play"><Icon name="play" size={20} /></div>
                          </div>
                          <div className="pres-card-info">
                            <h3>{v.title}</h3>
                            <div className="pres-card-meta">
                              <span>{v.client || "—"}</span>
                              <span className="dot-sep">·</span>
                              <span>{v.views} views</span>
                              <span className="dot-sep">·</span>
                              <span>{v.year}</span>
                            </div>
                          </div>
                        </SpotlightCard>
                      );
                    })}
                  </div>
                </section>
              );
            })}

          {videos.length === 0 && (
            <div style={{padding:80,textAlign:"center",color:"var(--ink-dim)",fontFamily:"var(--font-mono)",fontSize:12,letterSpacing:"0.15em"}}>
              Nenhum vídeo encontrado.
            </div>
          )}
         </main>
       </div>
      </div>
    </div>
  );
};

Object.assign(window, { PresentationMode });
