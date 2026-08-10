/* admin.jsx — console admin com persistência via API */

const AdminLogin = ({ onClose, onSuccess }) => {
  const [pass, setPass] = React.useState("");
  const [shake, setShake] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [recovOpen, setRecovOpen] = React.useState(false);
  const [recovToken, setRecovToken] = React.useState("");
  const [recovPass, setRecovPass] = React.useState("");
  const [recovMsg, setRecovMsg] = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const result = await window.API.login(pass);
      window.API.setToken(result.token);
      setErr("");
      onSuccess();
    } catch (ex) {
      setErr(ex?.error || "Senha incorreta. Tente novamente.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const submitRecovery = async (e) => {
    e.preventDefault();
    setRecovMsg(null);
    if (recovPass.length < 4) { setRecovMsg({ type: "err", text: "A nova senha precisa ter no mínimo 4 caracteres." }); return; }
    try {
      await window.API.recoverWithToken(recovToken.trim(), recovPass);
      setRecovMsg({ type: "ok", text: "Senha redefinida! Faça login com a nova senha." });
      setRecovOpen(false);
      setPass(""); setRecovToken(""); setRecovPass("");
    } catch (ex) {
      setRecovMsg({ type: "err", text: ex?.error || "Não foi possível redefinir a senha." });
    }
  };

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="admin-login">
      <div className="admin-login-bg"/>
      <div className="admin-login-grid"/>
      {recovOpen ? (
        <form className="admin-login-card glass-strong glass" onSubmit={submitRecovery}>
          <div className="crest"><img src="/vector_framety.svg?v=1" alt="Framety" style={{height: 70, marginBottom: 30}}/></div>
          <h1>Recuperar senha.</h1>
          <p className="sub">Digite o admin token para autorizar e definir uma nova senha do console.</p>
          <div className="field"><label>Admin token</label><input type="text" value={recovToken} onChange={(e)=>setRecovToken(e.target.value)} placeholder="admin token" autoFocus/></div>
          <div className="field"><label>Nova senha</label><input type="text" value={recovPass} onChange={(e)=>setRecovPass(e.target.value)} placeholder="mín. 4 caracteres"/></div>
          {recovMsg && <span style={{color: recovMsg.type==="ok"?"#22e07c":"var(--accent)",fontSize:11,fontFamily:"var(--font-mono)",letterSpacing:"0.1em"}}>{recovMsg.text}</span>}
          <button type="submit" className="btn btn-accent" data-cursor="hover">Redefinir senha <Icon name="arrow-right" size={14}/></button>
          <div className="admin-login-foot"><a onClick={()=>{setRecovOpen(false);setRecovMsg(null);}} data-cursor="hover">← voltar ao login</a></div>
        </form>
      ) : (
        <form className="admin-login-card glass-strong glass" onSubmit={submit} style={shake ? { animation: "shake 0.4s" } : null}>
          <div className="crest">
            <img src="/vector_framety.svg?v=1" alt="Framety" style={{height: 70, marginBottom: 30}}/>
          </div>
          <h1>Acesso restrito.</h1>
          <p className="sub">Digite a senha do console para continuar.</p>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={pass} onChange={(e)=>setPass(e.target.value)} autoFocus/>
            {err && <span style={{color:"var(--accent)",fontSize:11,fontFamily:"var(--font-mono)",letterSpacing:"0.1em",marginTop:4}}>{err}</span>}
          </div>
          <button type="submit" className="btn btn-accent" data-cursor="hover">
            Entrar no console <Icon name="arrow-right" size={14}/>
          </button>
          {recovMsg && recovMsg.type==="ok" && (
            <div style={{fontSize:11,fontFamily:"var(--font-mono)",lineHeight:1.6,color:"#22e07c",marginTop:4,padding:"8px 12px",borderRadius:8,background:"rgba(34,224,124,0.08)",border:"1px solid rgba(34,224,124,0.4)"}}>{recovMsg.text}</div>
          )}
          <div className="admin-login-foot">
            <a onClick={()=>{setRecovOpen(true);setRecovMsg(null);}} data-cursor="hover">esqueci a senha</a>
            <a onClick={onClose} data-cursor="hover">← voltar ao site</a>
          </div>
        </form>
      )}
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`}</style>
    </div>
  );
};

/* =========================== Dashboard =========================== */
const AdminDashboard = ({ initialTab = "videos", onExit, onOpenPresentation }) => {
  const [tab, setTab] = React.useState(initialTab);
  const [showAdd, setShowAdd] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Sync URL when tab changes
  React.useEffect(() => {
    const slugMap = {
      overview: "visao-geral",
      videos: "videos",
      clientes: "clientes",
      categorias: "categorias",
      reel: "demoreel",
      ia: "ia",
      seguranca: "seguranca",
      parceiros: "parceiros",
      tutorial: "tutorial",
      locucoes: "locucoes",
      links: "links",
      storyboards: "storyboards",
    };
    const slug = slugMap[tab] || "visao-geral";
    const newPath = `/console/${slug}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, "", newPath);
    }
  }, [tab]);

  // Update tab if props change (browser back/forward)
  React.useEffect(() => {
    if (initialTab !== tab) setTab(initialTab);
  }, [initialTab]);

  // Ensure videos tab is active when global search triggers an edit
  React.useEffect(() => {
    const onEdit = () => setTab("videos");
    window.addEventListener('framety-admin-edit', onEdit);
    return () => window.removeEventListener('framety-admin-edit', onEdit);
  }, []);

  // Busca global (Ctrl+Espaço) → abre o storyboard escolhido. O id fica guardado
  // porque o painel só existe depois que a aba troca — ele lê o pedido ao montar.
  const [sbRequestOpen, setSbRequestOpen] = React.useState(null);
  React.useEffect(() => {
    const onOpenSb = (e) => { setTab("storyboards"); setSbRequestOpen(e.detail?.id || null); };
    window.addEventListener('framety-open-storyboard', onOpenSb);
    return () => window.removeEventListener('framety-open-storyboard', onOpenSb);
  }, []);

  const [vids, setVids] = React.useState([]);
  const [cats, setCats] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [reelName, setReelName] = React.useState("");
  const [partners, setPartners] = React.useState([]);
  const [storyboards, setStoryboards] = React.useState([]);
  const [locucoesPages, setLocucoesPages] = React.useState([]);
  const [locucoesActivePageId, setLocucoesActivePageId] = React.useState(null);
  const [locucoesCad, setLocucoesCad] = React.useState({ clientes: [], projetos: [], empreendimentos: [], categorias: [] });
  const [redirects, setRedirects] = React.useState([]);
  const [producoesUnlocked, setProducoesUnlocked] = React.useState(false);
  const [showProducoesPass, setShowProducoesPass] = React.useState(false);
  // Modo foco do storyboard: recolhe o menu do console para o deck (1280px de
  // página) ganhar largura. A preferência persiste entre sessões, mas só tem
  // efeito na aba de storyboards — sair dela sempre devolve o menu.
  const [sbFocus, setSbFocus] = React.useState(() => {
    try { return localStorage.getItem("framety.sbFocus") === "1"; } catch { return false; }
  });
  const toggleSbFocus = () => setSbFocus((v) => {
    const next = !v;
    try { localStorage.setItem("framety.sbFocus", next ? "1" : "0"); } catch {}
    return next;
  });
  const navHidden = tab === "storyboards" && sbFocus;

  // ── Toast & confirm system ────────────────────────────────────────────────────
  const [toasts, setToasts] = React.useState([]);
  const [confirmReq, setConfirmReq] = React.useState(null);
  const addToast = React.useCallback((msg, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);
  const adminConfirm = React.useCallback((msg, onOk) => {
    setConfirmReq({ msg, onOk });
  }, []);
  React.useEffect(() => {
    window.__adminToast = addToast;
    window.__adminConfirm = adminConfirm;
    return () => { delete window.__adminToast; delete window.__adminConfirm; };
  }, [addToast, adminConfirm]);

  // Sessão expirada → volta para login
  React.useEffect(() => {
    const onExpired = () => {
      addToast("Sessão expirada. Fazendo logout...", 'error');
      setTimeout(() => { window.location.href = "/console"; }, 1500);
    };
    window.addEventListener("framety:session-expired", onExpired);
    return () => window.removeEventListener("framety:session-expired", onExpired);
  }, [addToast]);

  // Load fresh data from API on mount
  React.useEffect(() => {
    window.API.getData().then(data => {
      setVids(data.videos);
      setCats(data.categories);
      setClients([...data.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setReelName(data.reel?.name || "");
      window.FRAMETY_DATA = data;
      window.getStoredReelUrl = () => data.reel?.url || '';

      window.API.getPartners().then(setPartners).catch(() => {});
      window.API.getLocucoes().then(d => {
        setLocucoesPages(d.pages || []);
        setLocucoesActivePageId(d.activePageId || (d.pages && d.pages[0] && d.pages[0].id) || null);
        setLocucoesCad(d.cad || { clientes: [], projetos: [], empreendimentos: [], categorias: [] });
      }).catch(() => {});
      window.API.getRedirects().then(setRedirects).catch(() => {});
      window.API.getStoryboards().then(setStoryboards).catch(() => {});
      setLoading(false);

      // Views auto-update logic removed per user request
    });
  }, []);

  // Keep global in sync so other pages reflect changes
  React.useEffect(() => { window.FRAMETY_SB = storyboards; }, [storyboards]);   // busca global
  React.useEffect(() => { if (window.FRAMETY_DATA) window.FRAMETY_DATA.videos = vids; }, [vids]);
  React.useEffect(() => { if (window.FRAMETY_DATA) window.FRAMETY_DATA.categories = cats; }, [cats]);
  React.useEffect(() => { if (window.FRAMETY_DATA) window.FRAMETY_DATA.clients = clients; }, [clients]);

  // Locuções: debounced whole-blob save, kept here (not inside LocucoesPanel) so
  // a pending edit still persists even if the admin switches tabs before it fires
  // (switching tabs unmounts the panel, which would otherwise cancel the timer).
  const locucoesSaveTimer = React.useRef(null);
  const locucoesSavePending = React.useRef(false);  // true while a local save is queued/in-flight
  const applyingRemoteLoc = React.useRef(false);     // true when state was just replaced by a live refetch
  React.useEffect(() => {
    if (loading) return;
    if (applyingRemoteLoc.current) { applyingRemoteLoc.current = false; return; } // remote update → don't re-save (avoids echo loop)
    locucoesSavePending.current = true;
    clearTimeout(locucoesSaveTimer.current);
    locucoesSaveTimer.current = setTimeout(() => {
      window.API.saveLocucoes({ pages: locucoesPages, activePageId: locucoesActivePageId, cad: locucoesCad })
        .catch(() => {})
        .finally(() => { locucoesSavePending.current = false; });
    }, 700);
    return () => clearTimeout(locucoesSaveTimer.current);
  }, [locucoesPages, locucoesActivePageId, locucoesCad, loading]);

  // Live updates: re-fetch when another user (or myself elsewhere) changes data.
  React.useEffect(() => {
    if (!window.FRAMETY_LIVE || loading) return;
    const offContent = window.FRAMETY_LIVE.on('content', () => {
      window.API.getData().then(data => {
        setVids(data.videos);
        setCats(data.categories);
        setClients([...data.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
        setReelName(data.reel?.name || "");
        window.FRAMETY_DATA = data;
        window.getStoredReelUrl = () => data.reel?.url || '';
      }).catch(() => {});
      window.API.getPartners().then(setPartners).catch(() => {});
    });
    // Comentários chegam pelo link do cliente — o console precisa acender o sino
    // sem depender de recarregar a página.
    const offSb = window.FRAMETY_LIVE.on('storyboards', () => {
      window.API.getStoryboards().then(setStoryboards).catch(() => {});
    });
    const offLoc = window.FRAMETY_LIVE.on('locucoes', () => {
      if (locucoesSavePending.current) return; // don't clobber my own in-progress edit
      window.API.getLocucoes().then(d => {
        applyingRemoteLoc.current = true;
        setLocucoesPages(d.pages || []);
        setLocucoesCad(d.cad || { clientes: [], projetos: [], empreendimentos: [], categorias: [] });
      }).catch(() => {});
    });
    const offRed = window.FRAMETY_LIVE.on('redirects', () => {
      window.API.getRedirects().then(setRedirects).catch(() => {});
    });
    return () => { offContent(); offSb(); offLoc(); offRed(); };
  }, [loading]);

  const handleReelUpload = async (file) => {
    if (!file) return;
    try {
      const result = await window.API.uploadReel(file);
      setReelName(result.name);
      window.getStoredReelUrl = () => result.url;
      window.dispatchEvent(new CustomEvent("framety:reel-updated"));
    } catch (ex) {
      window.__adminToast?.("Erro ao enviar reel: " + (ex?.error || ex));
    }
  };

  const removeReel = async () => {
    await window.API.deleteReel();
    setReelName("");
    window.getStoredReelUrl = () => "";
    window.dispatchEvent(new CustomEvent("framety:reel-updated"));
  };

  const mobileNavRef = React.useRef(null);
  const mobileDrag = React.useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const onMobileNavDown = (e) => {
    const el = mobileNavRef.current; if (!el) return;
    mobileDrag.current = { active: true, startX: e.pageX, scrollLeft: el.scrollLeft, moved: false };
    el.style.cursor = 'grabbing';
  };
  const onMobileNavMove = (e) => {
    const d = mobileDrag.current; if (!d.active) return;
    const dx = e.pageX - d.startX;
    if (Math.abs(dx) > 5) d.moved = true;
    if (mobileNavRef.current) mobileNavRef.current.scrollLeft = d.scrollLeft - dx;
  };
  const onMobileNavUp = () => {
    mobileDrag.current.active = false;
    if (mobileNavRef.current) mobileNavRef.current.style.cursor = '';
  };
  const tapMobile = (fn) => (e) => {
    if (mobileDrag.current.moved) { mobileDrag.current.moved = false; return; }
    fn(e);
  };

  const titleMap = {
    overview: "Visão geral", videos: "Vídeos", clientes: "Clientes",
    categorias: "Categorias", reel: "Demoreel da capa", ia: "Seção IA",
    seguranca: "Segurança", parceiros: "Parceiros", tutorial: "Tutorial",
    storyboards: "Storyboards", locucoes: "Produções", links: "Links",
  };

  // Soma dos comentários novos que ainda não foram abertos — acende o sino.
  const sbUnread = storyboards.reduce((n, s) => n + (s.unread || 0), 0);

  if (loading) {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"var(--font-mono)",fontSize:12,letterSpacing:"0.2em",color:"var(--ink-dim)"}}>
        <span className="blink"/> Carregando…
      </div>
    );
  }

  return (
    <div className={"admin-shell page-enter" + (navHidden ? " nav-hidden" : "")} data-screen-label="07 Admin">
      <aside className="admin-side" {...(navHidden ? { inert: "", "aria-hidden": "true" } : {})}>
        <div className="crest" style={{justifyContent: "center", marginBottom: 30}}>
          <img src="/vector_framety.svg?v=1" alt="Framety" style={{height: 48}}/>
        </div>
        <a className={"admin-nav-item " + (tab==="overview"?"active":"")} onClick={()=>setTab("overview")} data-cursor="hover"><span className="ico"><Icon name="stats" size={15}/></span> Visão geral</a>
        <a className={"admin-nav-item " + (tab==="videos"?"active":"")} onClick={()=>setTab("videos")} data-cursor="hover"><span className="ico"><Icon name="video" size={15}/></span> Vídeos</a>
        <a className={"admin-nav-item " + (tab==="clientes"?"active":"")} onClick={()=>setTab("clientes")} data-cursor="hover"><span className="ico"><Icon name="users" size={15}/></span> Clientes</a>
        <a className={"admin-nav-item " + (tab==="categorias"?"active":"")} onClick={()=>setTab("categorias")} data-cursor="hover"><span className="ico"><Icon name="folder" size={15}/></span> Categorias</a>
        <a className={"admin-nav-item " + (tab==="reel"?"active":"")} onClick={()=>setTab("reel")} data-cursor="hover"><span className="ico"><Icon name="play-line" size={15}/></span> Demoreel</a>
        <a className={"admin-nav-item " + (tab==="ia"?"active":"")} onClick={()=>setTab("ia")} data-cursor="hover"><span className="ico"><Icon name="sparkles" size={15}/></span> Seção IA</a>
        <a className={"admin-nav-item " + (tab==="parceiros"?"active":"")} onClick={()=>setTab("parceiros")} data-cursor="hover">
          <span className="ico"><Icon name="users" size={15}/></span> Parceiros
          {partners.length > 0 && <span className="num" style={{marginLeft:"auto",fontSize:10,background:"var(--accent)",color:"#fff",borderRadius:20,padding:"1px 7px",fontFamily:"var(--font-mono)"}}>{partners.length}</span>}
        </a>
        <a className={"admin-nav-item " + (tab==="tutorial"?"active":"")} onClick={()=>setTab("tutorial")} data-cursor="hover"><span className="ico"><Icon name="help" size={15}/></span> Tutorial</a>
        <a className={"admin-nav-item " + (tab==="storyboards"?"active":"")} onClick={()=>setTab("storyboards")} data-cursor="hover">
          <span className="ico"><Icon name="list" size={15}/></span> Storyboards
          {sbUnread > 0 && <span className="num" style={{marginLeft:"auto",fontSize:10,background:"var(--accent)",color:"#fff",borderRadius:20,padding:"1px 7px",fontFamily:"var(--font-mono)"}} title={`${sbUnread} atualização(ões) do cliente`}>🔔 {sbUnread}</span>}
        </a>
        <div className="group-label">— Ordens de serviço</div>
        <a className={"admin-nav-item " + (tab==="locucoes"?"active":"")} onClick={()=>setTab("locucoes")} data-cursor="hover"><span className="ico"><Icon name="list" size={15}/></span> Produções</a>
        <a className={"admin-nav-item " + (tab==="links"?"active":"")} onClick={()=>setTab("links")} data-cursor="hover"><span className="ico"><Icon name="share" size={15}/></span> Links</a>
        <div className="group-label">— Configurações</div>
        <a className={"admin-nav-item " + (tab==="seguranca"?"active":"")} onClick={()=>setTab("seguranca")} data-cursor="hover"><span className="ico"><Icon name="settings" size={15}/></span> Segurança</a>
        <a className="admin-nav-item" onClick={onOpenPresentation} data-cursor="hover"><span className="ico"><Icon name="external" size={15}/></span> Modo apresentação</a>
        <a className="exit" onClick={onExit} data-cursor="hover"><span className="ico"><Icon name="logout" size={15}/></span> Sair do console</a>
      </aside>

      <main className="admin-main">

        {/* ── Mobile-only tab bar (replaces hidden sidebar) ── */}
        <div className="admin-mobile-nav" ref={mobileNavRef}
          onMouseDown={onMobileNavDown} onMouseMove={onMobileNavMove} onMouseUp={onMobileNavUp} onMouseLeave={onMobileNavUp}>
          <a className={tab==="overview"?"active":""} onClick={tapMobile(()=>setTab("overview"))}>
            <Icon name="stats" size={16}/><span>Visão geral</span>
          </a>
          <a className={tab==="videos"?"active":""} onClick={tapMobile(()=>setTab("videos"))}>
            <Icon name="video" size={16}/><span>Vídeos</span>
          </a>
          <a className={tab==="clientes"?"active":""} onClick={tapMobile(()=>setTab("clientes"))}>
            <Icon name="users" size={16}/><span>Clientes</span>
          </a>
          <a className={tab==="categorias"?"active":""} onClick={tapMobile(()=>setTab("categorias"))}>
            <Icon name="folder" size={16}/><span>Categorias</span>
          </a>
          <a className={tab==="reel"?"active":""} onClick={tapMobile(()=>setTab("reel"))}>
            <Icon name="play-line" size={16}/><span>Reel</span>
          </a>
          <a className={tab==="ia"?"active":""} onClick={tapMobile(()=>setTab("ia"))}>
            <Icon name="sparkles" size={16}/><span>Seção IA</span>
          </a>
          <a className={tab==="parceiros"?"active":""} onClick={tapMobile(()=>setTab("parceiros"))}>
            <Icon name="users" size={16}/><span>Parceiros</span>
          </a>
          <a className={tab==="tutorial"?"active":""} onClick={tapMobile(()=>setTab("tutorial"))}>
            <Icon name="help" size={16}/><span>Tutorial</span>
          </a>
          <a className={tab==="storyboards"?"active":""} onClick={tapMobile(()=>setTab("storyboards"))}>
            <Icon name="list" size={16}/><span>Storyboards</span>
          </a>
          <a className={tab==="locucoes"?"active":""} onClick={tapMobile(()=>setTab("locucoes"))}>
            <Icon name="list" size={16}/><span>Produções</span>
          </a>
          <a className={tab==="links"?"active":""} onClick={tapMobile(()=>setTab("links"))}>
            <Icon name="share" size={16}/><span>Links</span>
          </a>
          <a className={tab==="seguranca"?"active":""} onClick={tapMobile(()=>setTab("seguranca"))}>
            <Icon name="settings" size={16}/><span>Config</span>
          </a>
          <a onClick={tapMobile(onOpenPresentation)}>
            <Icon name="external" size={16}/><span>Apresent.</span>
          </a>
          <a className="exit-mobile" onClick={tapMobile(onExit)}>
            <Icon name="logout" size={16}/><span>Sair</span>
          </a>
        </div>

        <div className="admin-topbar">
          <h2>
            {titleMap[tab]}
            <span className="count">
              {tab==="videos" ? `${vids.length} ITEMS`
              : tab==="clientes" ? `${clients.length} ITEMS`
              : tab==="categorias" ? `${cats.length} ITEMS`
              : tab==="reel" ? (reelName ? "ATIVO" : "VAZIO")
              : tab==="ia" ? "HOME"
              : tab==="seguranca" ? "ADMIN"
              : tab==="parceiros" ? `${partners.length} CADASTROS`
              : tab==="tutorial" ? "SUPORTE"
              : tab==="storyboards" ? `${storyboards.length} STORYBOARDS`
              : tab==="locucoes" ? "OS POR #SKY"
              : tab==="links" ? `${redirects.length} LINKS`
              : "DASHBOARD"}
            </span>
          </h2>
          <div className="admin-topbar-right">
            {tab === "storyboards" && (
              <button className="btn btn-ghost admin-focus-btn" style={{padding:"9px 14px",fontSize:13}}
                onClick={toggleSbFocus} data-cursor="hover"
                aria-pressed={sbFocus}
                title={sbFocus ? "Mostrar o menu do console" : "Ocultar o menu do console e focar no storyboard"}>
                <Icon name={sbFocus ? "chevron-right" : "chevron-left"} size={14}/>
                <span className="admin-focus-label">{sbFocus ? "Mostrar menu" : "Modo foco"}</span>
              </button>
            )}
            <button className="btn btn-ghost admin-pres-btn" style={{padding:"9px 16px",fontSize:13}} onClick={onOpenPresentation} data-cursor="hover">
              <Icon name="external" size={14}/> Apresentação
            </button>
            {(tab === "videos" || tab === "overview") && (
              <button className="btn btn-accent" style={{padding:"9px 18px",fontSize:13}} onClick={()=>setShowAdd(true)} data-cursor="hover">
                <Icon name="plus" size={14}/> <span className="admin-add-label">Adicionar vídeo</span>
              </button>
            )}
          </div>
        </div>

        {tab === "overview" && <OverviewPanel vids={vids} cats={cats} clients={clients} setTab={setTab}/>}
        {tab === "videos" && <VideosPanel vids={vids} setVids={setVids} cats={cats} clients={clients}/>}
        {tab === "clientes" && <ClientsPanel clients={clients} setClients={setClients} vids={vids} setVids={setVids}/>}
        {tab === "categorias" && <CategoriesPanel cats={cats} setCats={setCats}/>}
        {tab === "reel" && <ReelPanel reelName={reelName} onUpload={handleReelUpload} onRemove={removeReel}/>}
        {tab === "ia" && <AIPanel/>}
        {tab === "seguranca" && <SecurityPanel/>}
        {tab === "parceiros" && <PartnersPanel partners={partners} setPartners={setPartners}/>}
        {tab === "tutorial" && <TutorialPanel/>}
        {tab === "storyboards" && <StoryboardsPanel list={storyboards} setList={setStoryboards} addToast={addToast}
          requestOpen={sbRequestOpen} onOpened={() => setSbRequestOpen(null)}/>}
        {tab === "locucoes" && (producoesUnlocked
          ? <LocucoesPanel cad={locucoesCad} setCad={setLocucoesCad}
              onChangePassword={() => setShowProducoesPass(true)}
              onShare={() => {
                const url = window.location.origin + "/producoes";
                if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => addToast("Link de compartilhamento copiado: " + url, "success")).catch(() => addToast("Link: " + url, "success"));
                else addToast("Link: " + url, "success");
              }}/>
          : <ProducoesGate onUnlock={() => setProducoesUnlocked(true)}/>)}
        {tab === "links" && <LinksPanel redirects={redirects} setRedirects={setRedirects}/>}
      </main>

      {/* Floating "Voltar para o site" — visible on all console pages */}
      <button className="admin-exit-fab" onClick={onExit} data-cursor="hover" title="Voltar ao site">
        <Icon name="arrow-right" size={14} style={{ transform: 'rotate(180deg)' }}/>
        <span>Voltar ao site</span>
      </button>

      {showAdd && (
        <VideoFormModal cats={cats} clients={clients} onClose={()=>setShowAdd(false)}
          onSave={async (nv) => {
            try {
              const result = await window.API.addVideo(nv);
              setVids(vs => [{ ...nv, id: result?.id || nv.id }, ...vs]);
              setShowAdd(false);
            } catch (ex) { addToast("Erro ao salvar vídeo: " + (ex?.error || ex)); }
          }}
        />
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="admin-toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`admin-toast admin-toast-${t.type}`}>
              <span>{t.msg}</span>
              <button className="admin-toast-close" onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmReq && (
        <div className="admin-confirm-backdrop" onClick={() => { confirmReq.onOk && confirmReq.resolve?.(false); setConfirmReq(null); }}>
          <div className="admin-confirm-box" onClick={e => e.stopPropagation()}>
            <p className="admin-confirm-msg">{confirmReq.msg}</p>
            <div className="admin-confirm-btns">
              <button className="btn btn-ghost" onClick={() => setConfirmReq(null)}>Cancelar</button>
              <button className="btn btn-accent" onClick={() => { const cb = confirmReq.onOk; setConfirmReq(null); cb?.(); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showProducoesPass && <ProducoesPasswordModal onClose={() => setShowProducoesPass(false)}/>}
    </div>
  );
};

/* =========================== Produções — section password gate =========================== */
const ProducoesGate = ({ onUnlock }) => {
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await window.API.unlockProducoes(pass);
      onUnlock();
    } catch (ex) {
      setErr(ex?.error || "Senha da seção incorreta.");
    }
  };
  return (
    <div style={{ maxWidth: 420, margin: "40px auto 0", textAlign: "center" }}>
      <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
        <Icon name="settings" size={22} style={{ color: "var(--ink-dim)" }}/>
      </div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 8 }}>Seção protegida</h3>
      <p style={{ color: "var(--ink-dim)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
        A seção Produções tem uma senha própria. Digite a senha de Produções para continuar.
      </p>
      <form className="glass" onSubmit={submit} style={{ padding: 24, borderRadius: 14, display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
        <div className="field" style={{ margin: 0 }}><label>Senha de Produções</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••" autoFocus/></div>
        {err && <span style={{ color: "var(--accent)", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>{err}</span>}
        <button type="submit" className="btn btn-accent" data-cursor="hover" style={{ justifyContent: "center" }}>Desbloquear <Icon name="arrow-right" size={14}/></button>
      </form>
    </div>
  );
};

/* Change the Produções section password (modal) */
const ProducoesPasswordModal = ({ onClose }) => {
  const [next1, setNext1] = React.useState("");
  const [next2, setNext2] = React.useState("");
  const [msg, setMsg] = React.useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (next1.length < 4) { setMsg({ type: "err", text: "Mínimo 4 caracteres." }); return; }
    if (next1 !== next2) { setMsg({ type: "err", text: "As senhas não conferem." }); return; }
    try {
      await window.API.setProducoesPassword(next1);
      window.__adminToast?.("Senha de Produções atualizada.", "success");
      onClose();
    } catch (ex) {
      setMsg({ type: "err", text: ex?.error || "Erro ao salvar." });
    }
  };
  return (
    <div className="admin-modal-back" onClick={onClose}>
      <form className="admin-modal glass-strong glass" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3>Senha da seção Produções</h3>
        <p className="sub">Esta é a senha exigida ao abrir Produções (no console e no link externo). Padrão: 1111.</p>
        <div className="field"><label>Nova senha</label><input type="text" value={next1} onChange={e => setNext1(e.target.value)} placeholder="mín. 4 caracteres" autoFocus/></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Confirmar nova senha</label><input type="text" value={next2} onChange={e => setNext2(e.target.value)} placeholder="repita a nova senha"/></div>
        {msg && <span style={{ color: "var(--accent)", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>{msg.text}</span>}
        <div className="admin-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} data-cursor="hover">Cancelar</button>
          <button type="submit" className="btn btn-accent" data-cursor="hover">Salvar <Icon name="arrow-right" size={14}/></button>
        </div>
      </form>
    </div>
  );
};

/* =========================== Overview =========================== */
const OverviewPanel = ({ vids, cats, clients, setTab }) => (
  <>
    <div className="admin-stats">
      <SpotlightCard color="red" className="admin-stat" style={{ '--radius': 14, '--size': 120 }}>
        <div className="lab">Total de vídeos</div><div className="num">{vids.length}</div>
      </SpotlightCard>
      <SpotlightCard color="red" className="admin-stat" style={{ '--radius': 14, '--size': 120 }}>
        <div className="lab">Categorias</div><div className="num">{cats.length}</div>
      </SpotlightCard>
      <SpotlightCard color="red" className="admin-stat" style={{ '--radius': 14, '--size': 120 }}>
        <div className="lab">Clientes</div><div className="num">{clients.length}</div>
      </SpotlightCard>
      <SpotlightCard color="red" className="admin-stat" style={{ '--radius': 14, '--size': 120 }}>
        <div className="lab">Orçamentos</div><div className="num">14</div>
      </SpotlightCard>
    </div>
    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:14}}>
      <h3 style={{fontFamily:"var(--font-display)",fontSize:18,letterSpacing:"-0.01em"}}>Últimos vídeos</h3>
      <button className="pres-row-more" onClick={()=>setTab("videos")} data-cursor="hover" style={{fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--ink-dim)"}}>
        Ver todos <Icon name="arrow-right" size={12}/>
      </button>
    </div>
    <div className="admin-rows">
      {vids.slice(0,5).map((v, i) => <RowAdmin key={v.id} v={v} i={i}/>)}
    </div>
  </>
);

/* =========================== Videos =========================== */
const VideosPanel = ({ vids, setVids, cats, clients }) => {
  const [view, setView] = React.useState("list");
  const [search, setSearch] = React.useState("");
  const [fCat, setFCat] = React.useState("all");
  const [fClient, setFClient] = React.useState("all");
  const [fYear, setFYear] = React.useState("all");
  const [fStatus, setFStatus] = React.useState("all");
  const [fFeatured, setFFeatured] = React.useState("all");
  const [dragId, setDragId] = React.useState(null);
  const [editVid, setEditVid] = React.useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const vidsRef = React.useRef(vids);
  React.useEffect(() => { vidsRef.current = vids; }, [vids]);

  // Global search edit shortcut
  React.useEffect(() => {
    const onEdit = (e) => {
      const v = vidsRef.current.find(x => x.id === e.detail.videoId);
      if (v) setEditVid(v);
    };
    window.addEventListener('framety-admin-edit', onEdit);
    return () => window.removeEventListener('framety-admin-edit', onEdit);
  }, []);
  const dragIdRef = React.useRef(null);
  const preDragRef = React.useRef(null);

  const years = Array.from(new Set(vids.map(v => v.year))).sort().reverse();

  const filtered = vids.filter(v =>
    (search === "" || v.title.toLowerCase().includes(search.toLowerCase()) || (v.client||"").toLowerCase().includes(search.toLowerCase())) &&
    (fCat === "all" || v.category === fCat) &&
    (fClient === "all" || v.client === fClient) &&
    (fYear === "all" || v.year === fYear) &&
    (fStatus === "all" || v.status === fStatus) &&
    (fFeatured === "all" || (fFeatured === "yes" ? v.featured : !v.featured))
  );

  const onDragStart = (id) => { dragIdRef.current = id; preDragRef.current = vids.slice(); setDragId(id); };
  const onDragOver = (e, id) => {
    e.preventDefault();
    if (!dragIdRef.current || dragIdRef.current === id) return;
    // Use IDs (not indices) so the swap works correctly regardless of active filters
    const dragId = dragIdRef.current;
    setVids(prev => {
      const a = prev.findIndex(v => v.id === dragId);
      const b = prev.findIndex(v => v.id === id);
      if (a < 0 || b < 0) return prev;
      const next = prev.slice();
      const [m] = next.splice(a, 1);
      next.splice(b, 0, m);
      return next;
    });
  };
  const onDragEnd = () => {
    dragIdRef.current = null;
    setDragId(null);
    window.API.reorderVideos(vidsRef.current.map(v => v.id)).catch(err => {
      console.error("Reorder failed:", err);
      if (preDragRef.current) setVids(preDragRef.current);
      window.__adminToast?.("Erro ao salvar ordem. Sua sessão pode ter expirado — faça login novamente.");
    });
  };

  const removeVid = (id) => {
    window.__adminConfirm?.("Excluir este vídeo permanentemente?", async () => {
      try {
        await window.API.deleteVideo(id);
        setVids(vs => vs.filter(v => v.id !== id));
      } catch (ex) {
        window.__adminToast?.("Erro ao excluir: " + (ex?.error || ex.message || "tente novamente"));
      }
    });
  };
  const togglePub = async (id) => {
    const prev = vids.find(v => v.id === id);
    if (!prev) return;
    const updated = { ...prev, status: prev.status === "live" ? "draft" : "live" };
    setVids(vs => vs.map(v => v.id === id ? updated : v));
    try {
      await window.API.updateVideo(id, updated);
    } catch {
      setVids(vs => vs.map(v => v.id === id ? prev : v));
    }
  };
  const toggleFeat = async (id) => {
    const prev = vids.find(v => v.id === id);
    if (!prev) return;
    const updated = { ...prev, featured: !prev.featured };
    setVids(vs => vs.map(v => v.id === id ? updated : v));
    try {
      await window.API.updateVideo(id, updated);
    } catch {
      setVids(vs => vs.map(v => v.id === id ? prev : v));
    }
  };

  const duplicateVid = async (v) => {
    const newId = "v" + Math.random().toString(36).slice(2, 9);
    const newVid = {
      ...v,
      id: newId,
      title: v.title + " (cópia)",
      status: "draft",
      featured: false,
    };
    try {
      const result = await window.API.addVideo(newVid);
      setVids(vs => [{ ...newVid, id: result?.id || newVid.id }, ...vs]);
      window.__adminToast?.("Vídeo duplicado com sucesso.");
    } catch (ex) {
      window.__adminToast?.("Erro ao duplicar: " + (ex?.error || ex?.message || "tente novamente"));
    }
  };

  const reset = () => { setSearch(""); setFCat("all"); setFClient("all"); setFYear("all"); setFStatus("all"); setFFeatured("all"); };

  const activeFilterCount = [fCat!=="all", fClient!=="all", fYear!=="all", fStatus!=="all", fFeatured!=="all"].filter(Boolean).length;

  return (
    <>
      {/* Mobile-only: combined filters dropdown trigger */}
      <div className="admin-mobile-filter-bar">
        <div className="admin-search" style={{margin:0,flex:1}}>
          <Icon name="search" size={14}/>
          <input placeholder="Buscar título ou cliente…" value={search} onChange={(e)=>setSearch(e.target.value)}/>
        </div>
        <button
          className={"admin-mobile-filter-btn" + (mobileFiltersOpen ? " open" : "") + (activeFilterCount > 0 ? " has-active" : "")}
          onClick={()=>setMobileFiltersOpen(o=>!o)}>
          <Icon name="filter" size={14}/>
          <span>Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
          <Icon name={mobileFiltersOpen ? "chevron-up" : "chevron-down"} size={11}/>
        </button>
        <div className="view-toggle">
          <button className={view==="list"?"active":""} onClick={()=>setView("list")} data-cursor="hover">
            <Icon name="list" size={12}/>
          </button>
          <button className={view==="grid"?"active":""} onClick={()=>setView("grid")} data-cursor="hover">
            <Icon name="grid" size={12}/>
          </button>
        </div>
      </div>

      <div className={"admin-toolbar" + (mobileFiltersOpen ? " mobile-open" : "")}>
        <div className="admin-search" style={{margin:0}}>
          <Icon name="search" size={14}/>
          <input placeholder="Buscar título ou cliente…" value={search} onChange={(e)=>setSearch(e.target.value)}/>
        </div>
        <div className="admin-toolbar-group">
          <span className="admin-toolbar-label">Cat.</span>
          <select value={fCat} onChange={(e)=>setFCat(e.target.value)} data-cursor="hover">
            <option value="all">todas</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="admin-toolbar-group">
          <span className="admin-toolbar-label">Cliente</span>
          <select value={fClient} onChange={(e)=>setFClient(e.target.value)} data-cursor="hover">
            <option value="all">todos</option>
            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="admin-toolbar-group">
          <span className="admin-toolbar-label">Ano</span>
          <select value={fYear} onChange={(e)=>setFYear(e.target.value)} data-cursor="hover">
            <option value="all">todos</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="admin-toolbar-group">
          <span className="admin-toolbar-label">Status</span>
          <button className={"filter-pill " + (fStatus==="live"?"active":"")} onClick={()=>setFStatus(fStatus==="live"?"all":"live")} data-cursor="hover">Publicado</button>
          <button className={"filter-pill " + (fStatus==="draft"?"active":"")} onClick={()=>setFStatus(fStatus==="draft"?"all":"draft")} data-cursor="hover">Rascunho</button>
        </div>
        <div className="admin-toolbar-group">
          <span className="admin-toolbar-label">Destaque</span>
          <button className={"filter-pill " + (fFeatured==="yes"?"active":"")} onClick={()=>setFFeatured(fFeatured==="yes"?"all":"yes")} data-cursor="hover">★ Sim</button>
        </div>
        {(search || fCat!=="all" || fClient!=="all" || fYear!=="all" || fStatus!=="all" || fFeatured!=="all") && (
          <button className="filter-pill" onClick={reset} data-cursor="hover" style={{borderColor:"var(--accent)",color:"var(--accent)"}}>limpar</button>
        )}
        <div className="view-toggle">
          <button className={view==="list"?"active":""} onClick={()=>setView("list")} data-cursor="hover">
            <Icon name="list" size={12}/> Lista
          </button>
          <button className={view==="grid"?"active":""} onClick={()=>setView("grid")} data-cursor="hover">
            <Icon name="grid" size={12}/> Grade
          </button>
        </div>
      </div>

      <div style={{fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:"0.14em",color:"var(--ink-mute)",marginBottom:14}}>
        — {filtered.length} de {vids.length} vídeo{vids.length===1?"":"s"}
      </div>

      {view === "list" ? (
        <div className="admin-rows">
          {filtered.map((v, i) => (
            <RowAdmin key={v.id} v={v} i={i} onTogglePub={togglePub} onToggleFeat={toggleFeat} onRemove={removeVid}
              onEdit={setEditVid} onDuplicate={duplicateVid}
              onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} dragging={dragId===v.id}/>
          ))}
          {filtered.length === 0 && <Empty/>}
        </div>
      ) : (
        <div className="admin-grid">
          {filtered.map((v) => (
            <GridCardAdmin key={v.id} v={v} cats={cats} onTogglePub={togglePub} onToggleFeat={toggleFeat} onRemove={removeVid} onEdit={setEditVid} onDuplicate={duplicateVid}/>
          ))}
          {filtered.length === 0 && <Empty/>}
        </div>
      )}

      {editVid && (
        <VideoFormModal
          cats={cats} clients={clients} initialData={editVid}
          onClose={() => setEditVid(null)}
          onSave={async (updated) => {
            try {
              await window.API.updateVideo(updated.id, updated);
              setVids(vs => vs.map(v => v.id === updated.id ? updated : v));
              setEditVid(null);
            } catch (ex) { window.__adminToast?.("Erro ao salvar vídeo: " + (ex?.error || ex)); }
          }}
        />
      )}
    </>
  );
};

const Empty = () => (
  <div style={{padding:60,textAlign:"center",color:"var(--ink-dim)",fontFamily:"var(--font-mono)",fontSize:12,letterSpacing:"0.15em",gridColumn:"1 / -1"}}>
    Nenhum resultado.
  </div>
);

const RowAdmin = ({ v, i, onTogglePub, onToggleFeat, onRemove, onEdit, onDuplicate, onDragStart, onDragOver, onDragEnd, dragging }) => {
  const cat = window.FRAMETY_DATA.categories.find(c => c.id === v.category);
  const draggable = !!onDragStart;
  const thumb = window.getThumbUrl ? window.getThumbUrl(v) : null;
  return (
    <SpotlightCard
      color="red"
      overlay={false}
      className={"admin-row" + (dragging ? " dragging" : "")}
      style={{ '--radius': 10, '--size': 100 }}
      draggable={draggable}
      onDragStart={()=>draggable && onDragStart(v.id)}
      onDragOver={(e)=>draggable && onDragOver(e, v.id)}
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      <span className="grip" data-cursor="hover"><Icon name="grip" size={14}/></span>
      <span className="num">— {String(i+1).padStart(3,"0")}</span>
      <div className={`thumb ${cat?.bgClass||"bg-comm"}`}
        style={thumb ? {backgroundImage:`url(${thumb})`,backgroundSize:"cover",backgroundPosition:"center"} : {}}/>
      <div className="title">
        {v.featured && <Icon name="star" size={11} stroke={2} style={{color:"var(--accent)",marginRight:6,verticalAlign:"-1px"}}/>}
        {v.title}
        <span className="meta">{v.client}{v.empreendimento ? ` · ${v.empreendimento}` : ""} · {v.duration} · {v.year}</span>
      </div>
      <span className="cat-pill">{v.catLabel}</span>
      <span className={"status " + v.status} onClick={()=>onTogglePub && onTogglePub(v.id)} data-cursor="hover">
        <span className="dot"/>{v.status === "live" ? "público" : "privado"}
      </span>
      <div className="actions">
        {onToggleFeat && (
          <button data-cursor="hover" title="Destaque" onClick={()=>onToggleFeat(v.id)}
            style={{color: v.featured ? "var(--accent)" : "var(--ink-dim)"}}>
            <Icon name="star" size={14} stroke={v.featured ? 2.4 : 1.6}/>
          </button>
        )}
        {onEdit && <button data-cursor="hover" title="Editar" onClick={()=>onEdit(v)}><Icon name="edit" size={14}/></button>}
        {onDuplicate && <button data-cursor="hover" title="Duplicar" onClick={()=>onDuplicate(v)}><Icon name="copy" size={14}/></button>}
        {onRemove && <button className="del" data-cursor="hover" title="Excluir" onClick={()=>onRemove(v.id)}><Icon name="trash" size={14}/></button>}
      </div>
    </SpotlightCard>
  );
};

const GridCardAdmin = ({ v, cats, onTogglePub, onToggleFeat, onRemove, onEdit, onDuplicate }) => {
  const cat   = cats.find(c => c.id === v.category);
  const thumb = window.getThumbUrl ? window.getThumbUrl(v) : null;
  return (
    <SpotlightCard color="red" className="admin-grid-card" data-cursor="hover" style={{ '--radius': 14, '--size': 140 }}>
      <div className={`admin-grid-thumb ${cat?.bgClass||"bg-comm"}`}
        style={thumb ? {backgroundImage:`url(${thumb})`,backgroundSize:"cover",backgroundPosition:"center"} : {}}>
        <span className={"admin-grid-status " + v.status} onClick={()=>onTogglePub(v.id)}>
          <span className="dot"/>{v.status === "live" ? "público" : "privado"}
        </span>
        {v.featured && (
          <span className="admin-grid-feat" title="Destaque">
            <Icon name="star" size={12} stroke={2.4}/>
          </span>
        )}
        <span className="admin-grid-duration">{v.duration}</span>
      </div>
      <div className="admin-grid-body">
        <div className="title">{v.title}</div>
        <div className="meta">
          <span>{v.catLabel}</span><span className="sep">·</span>
          <span>{v.client}</span>
          {v.empreendimento && <><span className="sep">·</span><span>{v.empreendimento}</span></>}
          <span className="sep">·</span><span>{v.year}</span>
        </div>
      </div>
      <div className="admin-grid-actions">
        <button data-cursor="hover" title="Destaque" onClick={()=>onToggleFeat(v.id)}
          style={{color: v.featured ? "var(--accent)" : "var(--ink-dim)"}}>
          <Icon name="star" size={14} stroke={v.featured ? 2.4 : 1.6}/>
        </button>
        <button data-cursor="hover" title="Editar" onClick={()=>onEdit && onEdit(v)}><Icon name="edit" size={14}/></button>
        <button data-cursor="hover" title="Duplicar" onClick={()=>onDuplicate && onDuplicate(v)}><Icon name="copy" size={14}/></button>
        <button className="del" data-cursor="hover" title="Excluir" onClick={()=>onRemove(v.id)}><Icon name="trash" size={14}/></button>
      </div>
    </SpotlightCard>
  );
};

/* =========================== Clients =========================== */
const ClientsPanel = ({ clients, setClients, vids, setVids }) => {
  const [editing, setEditing] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);

  const startAdd  = () => { setEditing({ name: "" }); setShowForm(true); };
  const startEdit = (c) => { setEditing({ ...c }); setShowForm(true); };

  const save = async () => {
    if (!editing.name.trim()) return;
    const newName = editing.name.trim();
    // Duplicate-name guard (only when editing or creating)
    const dup = clients.find(c => c.name.toLowerCase() === newName.toLowerCase() && c.id !== editing.id);
    if (dup) { window.__adminToast?.("Já existe outro cliente com este nome."); return; }
    try {
      if (editing.id) {
        const old = clients.find(c => c.id === editing.id);
        await window.API.updateClient(editing.id, { name: newName, logoUrl: editing.logoUrl });
        setClients(cs => cs.map(c => c.id === editing.id ? { ...c, name: newName } : c));
        if (old && old.name !== newName) {
          // Cascade rename — wait for ALL video updates and report failures
          const affected = vids.filter(v => v.client === old.name);
          const results = await Promise.allSettled(
            affected.map(v => window.API.updateVideo(v.id, { ...v, client: newName }))
          );
          const failed = results.filter(r => r.status === 'rejected');
          if (failed.length > 0) {
            window.__adminToast?.(`Atenção: ${failed.length} vídeo(s) não atualizaram com o novo nome do cliente. Recarregue a página.`, 'warn');
          } else {
            setVids(vs => vs.map(v => v.client === old.name ? { ...v, client: newName } : v));
          }
        }
      } else {
        const id = editing.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,16) || "c"+Date.now();
        // Duplicate id guard
        if (clients.some(c => c.id === id)) {
          window.__adminToast?.("Já existe um cliente com este identificador. Tente um nome ligeiramente diferente.");
          return;
        }
        await window.API.addClient({ id, name: newName });
        setClients(cs => [...cs, { id, name: newName }]);
      }
      setShowForm(false); setEditing(null);
    } catch (ex) { window.__adminToast?.("Erro ao salvar cliente: " + (ex?.error || ex)); }
  };

  const remove = (c) => {
    window.__adminConfirm?.(`Excluir cliente "${c.name}"? Vídeos vinculados ficam sem cliente.`, async () => {
      try {
        await window.API.deleteClient(c.id);
        setClients(cs => cs.filter(x => x.id !== c.id));
        setVids(vs => vs.map(v => v.client === c.name ? { ...v, client: "—" } : v));
      } catch (ex) {
        window.__adminToast?.("Erro ao excluir cliente: " + (ex?.error || ex.message || "tente novamente"));
      }
    });
  };

  const countFor = (name) => vids.filter(v => v.client === name).length;
  const initials = (s) => s.split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();

  return (
    <>
      <div className="client-grid">
        {clients.map(c => (
          <SpotlightCard key={c.id} color="red" className="client-card" style={{ '--radius': 16, '--size': 130 }}>
            <div className="client-card-mark" style={{position:"relative"}}>
              {c.logoUrl ? (
                <img src={c.logoUrl} alt={c.name} style={{width:"100%",height:"100%",objectFit:"contain",filter:"brightness(0) invert(1)",borderRadius:8}}/>
              ) : initials(c.name)}
              <label style={{position:"absolute",bottom:-8,right:-8,width:22,height:22,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10,boxShadow:"0 0 8px var(--accent-glow)"}}>
                <Icon name="upload" size={10} style={{color:"#fff"}}/>
                <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" style={{display:"none"}}
                  onChange={async (e) => {
                    const f = e.target.files[0];
                    if (!f) return;
                    try {
                      const result = await window.API.uploadLogo(c.id, f);
                      setClients(cs => cs.map(x => x.id === c.id ? { ...x, logoUrl: result.url } : x));
                    } catch (ex) { window.__adminToast?.("Erro ao enviar logo: " + (ex?.error || ex)); }
                  }}
                />
              </label>
            </div>
            <div>
              <div className="client-card-name">{c.name}</div>
              <div className="client-card-meta" style={{marginTop:6}}>
                <span className="client-card-count">{countFor(c.name)} vídeo{countFor(c.name)===1?"":"s"}</span>
              </div>
            </div>
            <div className="client-card-actions">
              <button data-cursor="hover" title="Editar" onClick={()=>startEdit(c)}><Icon name="edit" size={14}/></button>
              <button className="del" data-cursor="hover" title="Excluir" onClick={()=>remove(c)}><Icon name="trash" size={14}/></button>
            </div>
          </SpotlightCard>
        ))}
        <SpotlightCard color="red" className="client-card client-card-add" onClick={startAdd} data-cursor="hover" style={{ '--radius': 16, '--size': 130 }}>
          <Icon name="plus" size={20}/>
          Adicionar cliente
        </SpotlightCard>
      </div>

      {showForm && (
        <div className="admin-modal-back" onClick={()=>{setShowForm(false);setEditing(null);}}>
          <form className="admin-modal glass-strong glass" onClick={(e)=>e.stopPropagation()} onSubmit={(e)=>{e.preventDefault();save();}}>
            <h3>{editing?.id ? "Editar cliente" : "Novo cliente"}</h3>
            <p className="sub">Você poderá vincular vídeos a este cliente no momento de criar/editar um vídeo.</p>
            <div className="field" style={{marginBottom:0}}>
              <label>Nome do cliente</label>
              <input value={editing?.name || ""} onChange={(e)=>setEditing({...editing, name: e.target.value})} placeholder="Ex.: Atlas Motors" autoFocus/>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={()=>{setShowForm(false);setEditing(null);}} data-cursor="hover">Cancelar</button>
              <button type="submit" className="btn btn-accent" data-cursor="hover">{editing?.id ? "Salvar" : "Adicionar"} <Icon name="arrow-right" size={14}/></button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

/* =========================== Categories =========================== */
const CategoriesPanel = ({ cats, setCats }) => {
  const [dragId,         setDragId]         = React.useState(null);
  const [bgPickerFor,    setBgPickerFor]    = React.useState(null);
  const [newCatName,     setNewCatName]     = React.useState('');
  const [showNewCatForm, setShowNewCatForm] = React.useState(false);
  const [nameDraft,      setNameDraft]      = React.useState({}); // catId → string while typing
  const catsRef = React.useRef(cats);
  React.useEffect(() => { catsRef.current = cats; }, [cats]);

  // Convert any display name to a URL-safe slug
  const toSlug = (s) =>
    s.toLowerCase()
     .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics
     .replace(/[^a-z0-9]+/g, '-')
     .replace(/^-+|-+$/g, '')
     .slice(0, 50) || 'categoria';

  const update = (id, patch) => {
    const newId = patch.id || id;
    setCats(cs => {
      const next    = cs.map(c => c.id === id ? { ...c, ...patch } : c);
      const updated = next.find(c => c.id === newId);
      if (updated)
        window.API.updateCategory(id, { ...updated, sortOrder: next.indexOf(updated) })
          .catch(err => window.__adminToast?.(err?.error || 'Erro ao salvar.'));
      return next;
    });
  };

  // Commit name edit: rename display name + derive new slug
  const commitName = (catId) => {
    const newName = (nameDraft[catId] ?? cats.find(c => c.id === catId)?.name ?? '').trim();
    setNameDraft(d => { const n = { ...d }; delete n[catId]; return n; });
    if (!newName) return;
    const newSlug = toSlug(newName);
    const cat     = cats.find(c => c.id === catId);
    if (!cat) return;
    const nameChanged = newName !== cat.name;
    const slugChanged = newSlug !== catId;
    if (!nameChanged && !slugChanged) return;
    update(catId, { name: newName, ...(slugChanged ? { id: newSlug } : {}) });
  };

  const onDragStart = (id) => setDragId(id);
  const onDragOver  = (e, id) => {
    e.preventDefault();
    if (!dragId || dragId === id) return;
    const a = cats.findIndex(c => c.id === dragId);
    const b = cats.findIndex(c => c.id === id);
    if (a < 0 || b < 0) return;
    const next = cats.slice();
    const [m]  = next.splice(a, 1);
    next.splice(b, 0, m);
    setCats(next);
  };
  const onDragEnd = () => {
    setDragId(null);
    window.API.reorderCategories(catsRef.current.map(c => c.id)).catch(console.error);
  };

  const remove = (id) => {
    window.__adminConfirm?.("Excluir esta categoria?", async () => {
      await window.API.deleteCategory(id).catch(console.error);
      setCats(cs => cs.filter(c => c.id !== id));
    });
  };

  const addCat = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const id     = toSlug(name);
    const newCat = {
      id, name, desc: "Descreva esta categoria…", count: 0,
      bgClass: window.FRAMETY_DATA.bgChoices[cats.length % 6], size: "size-sm",
    };
    try {
      await window.API.addCategory(newCat);
      setCats(cs => [...cs, newCat]);
      setNewCatName('');
      setShowNewCatForm(false);
    } catch (ex) { window.__adminToast?.("Erro ao criar categoria: " + (ex?.error || ex)); }
  };

  return (
    <>
      <div className="cat-edit-header">
        <p style={{color:"var(--ink-dim)",fontSize:13,maxWidth:520,lineHeight:1.6}}>
          Clique em qualquer texto para renomear. Arraste pelas alças para reordenar. Clique no thumbnail para trocar o fundo.
        </p>
        <button className="btn btn-accent" style={{padding:"9px 18px",fontSize:13}} onClick={() => setShowNewCatForm(true)} data-cursor="hover">
          <Icon name="plus" size={14}/> Nova categoria
        </button>
      </div>

      <div className="admin-rows">
        {cats.map((c, i) => (
          <SpotlightCard
            key={c.id}
            color="red"
            overlay={false}
            className={"cat-edit-row" + (dragId===c.id ? " dragging" : "")}
            style={{ '--radius': 10, '--size': 110 }}
            draggable
            onDragStart={()=>onDragStart(c.id)}
            onDragOver={(e)=>onDragOver(e, c.id)}
            onDragEnd={onDragEnd}
          >
            <span className="grip" data-cursor="hover"><Icon name="grip" size={14}/></span>
            <div className="cat-edit-thumb-wrap" style={{position:"relative"}}>
              <div className={`cat-edit-thumb ${c.bgClass}`} onClick={()=>setBgPickerFor(bgPickerFor===c.id?null:c.id)} data-cursor="hover">
                {c.coverUrl && <img src={c.coverUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}
              </div>
              <label style={{position:"absolute",bottom:-8,right:-8,width:22,height:22,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10,boxShadow:"0 0 8px var(--accent-glow)"}}>
                <Icon name="upload" size={10} style={{color:"#fff"}}/>
                <input type="file" accept="image/gif,image/webp,image/png,image/jpeg" style={{display:"none"}}
                  onChange={async (e) => {
                    const f = e.target.files[0];
                    if (!f) return;
                    try {
                      const result = await window.API.uploadCover(c.id, f);
                      update(c.id, { coverUrl: result.url });
                    } catch (ex) { window.__adminToast?.("Erro ao enviar capa: " + (ex?.error || ex)); }
                  }}
                />
              </label>
              {bgPickerFor === c.id && (
                <div className="bg-picker" style={{top:50,left:0}}>
                  {window.FRAMETY_DATA.bgChoices.map(bg => (
                    <div key={bg}
                      className={`bg-picker-swatch ${bg} ${c.bgClass===bg?"active":""}`}
                      onClick={()=>{ update(c.id, { bgClass: bg }); setBgPickerFor(null); }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="cat-edit-fields">
              <input className="cat-edit-input"
                value={nameDraft[c.id] ?? c.name}
                onChange={(e) => setNameDraft(d => ({ ...d, [c.id]: e.target.value }))}
                onBlur={() => commitName(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                data-cursor="text"
                placeholder="Nome da categoria"
              />
              <input className="cat-edit-input desc"
                value={c.desc}
                onChange={(e)=>update(c.id, { desc: e.target.value })}
                data-cursor="text"
              />
              <div className="cat-edit-slug-row">
                <span className="cat-edit-slug-prefix">/categoria/</span>
                <span className="cat-edit-slug-value">
                  {toSlug(nameDraft[c.id] ?? c.name)}
                </span>
              </div>
            </div>
            <span className="cat-pill">{c.count} VÍDEOS</span>
            <span className="status live"><span className="dot"/> publicada</span>
            <div className="actions">
              <button className="del" data-cursor="hover" title="Excluir" onClick={()=>remove(c.id)}><Icon name="trash" size={14}/></button>
            </div>
          </SpotlightCard>
        ))}
      </div>

      {showNewCatForm && (
        <div className="admin-modal-back" onClick={() => { setShowNewCatForm(false); setNewCatName(''); }}>
          <form className="admin-modal glass-strong glass" onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); addCat(); }}>
            <h3>Nova categoria</h3>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Nome da categoria</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                placeholder="Ex.: Reels Imobiliários" autoFocus />
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowNewCatForm(false); setNewCatName(''); }}>Cancelar</button>
              <button type="submit" className="btn btn-accent" disabled={!newCatName.trim()}>Criar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

/* =========================== Reel =========================== */
const ReelPanel = ({ reelName, onUpload, onRemove }) => {
  const inputRef = React.useRef(null);
  return (
    <div style={{maxWidth:880}}>
      <div className="reel-panel-grid">
        <div>
          <h3 style={{fontFamily:"var(--font-display)",fontSize:22,marginBottom:8,letterSpacing:"-0.02em"}}>Vídeo de capa (demoreel)</h3>
          <p style={{color:"var(--ink-dim)",fontSize:13,lineHeight:1.6,marginBottom:24,maxWidth:560}}>
            Este é o vídeo que toca em loop na capa do site, ocupando a tela inteira atrás da logo Framety. Recomendado: MP4/WebM, 1920×1080 ou 4K, no máx. 60s, sem áudio.
          </p>
          <div className={"reel-drop " + (reelName ? "filled" : "")}
            onClick={() => inputRef.current.click()} data-cursor="hover">
            <input type="file" ref={inputRef} style={{display:"none"}} onChange={(e)=>onUpload(e.target.files[0])}/>
            {reelName ? (
              <>
                <div className="reel-drop-info">
                  <Icon name="video" size={32}/>
                  <div className="name">{reelName}</div>
                  <div className="sub">Clique para substituir</div>
                </div>
                <button className="reel-drop-remove" onClick={(e)=>{e.stopPropagation();onRemove();}} data-cursor="hover">
                  <Icon name="trash" size={14}/>
                </button>
              </>
            ) : (
              <div className="reel-drop-empty">
                <Icon name="plus" size={32}/>
                <div className="label">Carregar vídeo de fundo</div>
              </div>
            )}
          </div>
        </div>
        <div className="glass" style={{padding:20,borderRadius:14}}>
          <div style={{fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:"0.18em",textTransform:"uppercase",color:"var(--ink-dim)",marginBottom:14}}>— Status na capa</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{width:8,height:8,borderRadius:"50%",background: reelName ? "#22e07c" : "var(--ink-mute)",boxShadow: reelName ? "0 0 8px rgba(34,224,124,0.6)" : "none"}}/>
            <span style={{fontSize:13,fontWeight:500}}>{reelName ? "Publicado" : "Usando placeholder padrão"}</span>
          </div>
          <div style={{fontSize:12,color:"var(--ink-dim)",lineHeight:1.6}}>
            Quando vazio, o site exibe a animação de placeholder com transições entre frames coloridos. Ao publicar, o vídeo entra em loop, sem som, com fade no topo e na base.
          </div>
          <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid var(--line)",fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:"0.16em",color:"var(--ink-mute)"}}>
            DICA: vídeos curtos (15–30s) em loop performam melhor.
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================== Security =========================== */
const SecurityPanel = () => {
  const [current, setCurrent] = React.useState("");
  const [next1,   setNext1]   = React.useState("");
  const [next2,   setNext2]   = React.useState("");
  const [msg,     setMsg]     = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (next1.length < 4) { setMsg({ type:"err", text:"A nova senha precisa ter pelo menos 4 caracteres." }); return; }
    if (next1 !== next2)  { setMsg({ type:"err", text:"As senhas não conferem." }); return; }
    try {
      await window.API.changePassword(current, next1);
      setMsg({ type:"ok", text:"Senha redefinida com sucesso." });
      setCurrent(""); setNext1(""); setNext2("");
    } catch (ex) {
      setMsg({ type:"err", text: ex?.error || "Erro ao redefinir a senha." });
    }
  };

  const resetToDefault = async () => {
    try {
      await window.API.changePassword(current, "0000");
      setMsg({ type:"ok", text:"Senha restaurada para o padrão (0000)." });
      setCurrent(""); setNext1(""); setNext2("");
    } catch (ex) {
      setMsg({ type:"err", text: ex?.error || "Informe a senha atual para redefinir." });
    }
  };

  return (
    <div style={{maxWidth:560}}>
      <h3 style={{fontFamily:"var(--font-display)",fontSize:22,marginBottom:8,letterSpacing:"-0.02em"}}>Redefinir senha do console</h3>
      <p style={{color:"var(--ink-dim)",fontSize:13,lineHeight:1.6,marginBottom:24}}>
        A senha protege o acesso ao painel de controle. A senha inicial é <code style={{fontFamily:"var(--font-mono)",color:"var(--ink)",background:"rgba(255,255,255,0.06)",padding:"2px 6px",borderRadius:4}}>0000</code> — recomendamos trocar imediatamente.
      </p>
      <form className="glass" onSubmit={submit} style={{padding:24,borderRadius:14,display:"flex",flexDirection:"column",gap:14}}>
        <div className="field" style={{margin:0}}><label>Senha atual</label><input type="password" value={current} onChange={(e)=>setCurrent(e.target.value)} placeholder="••••"/></div>
        <div className="field" style={{margin:0}}><label>Nova senha</label><input type="password" value={next1} onChange={(e)=>setNext1(e.target.value)} placeholder="mín. 4 caracteres"/></div>
        <div className="field" style={{margin:0}}><label>Confirmar nova senha</label><input type="password" value={next2} onChange={(e)=>setNext2(e.target.value)} placeholder="repita a nova senha"/></div>
        {msg && (
          <div style={{
            fontSize:12,fontFamily:"var(--font-mono)",letterSpacing:"0.1em",
            padding:"10px 14px",borderRadius:10,
            background: msg.type === "ok" ? "rgba(34,224,124,0.1)" : "rgba(230,57,70,0.1)",
            border: "1px solid " + (msg.type === "ok" ? "rgba(34,224,124,0.4)" : "rgba(230,57,70,0.4)"),
            color: msg.type === "ok" ? "#22e07c" : "var(--accent)"
          }}>{msg.text}</div>
        )}
        <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",marginTop:6}}>
          <button type="button" className="btn btn-ghost" style={{padding:"9px 16px",fontSize:12}} onClick={resetToDefault} data-cursor="hover">Restaurar padrão (0000)</button>
          <button type="submit" className="btn btn-accent" data-cursor="hover">Salvar nova senha <Icon name="arrow-right" size={14}/></button>
        </div>
      </form>
      <p style={{color:"var(--ink-dim)",fontSize:12,lineHeight:1.6,marginTop:20}}>
        Esqueceu a senha? Na tela de login use <strong>"esqueci a senha"</strong> e informe o <strong>admin token</strong> para redefinir.
      </p>
    </div>
  );
};

/* =========================== Video Form Modal (add + edit) =========================== */
const VideoFormModal = ({ cats, clients, initialData, onClose, onSave }) => {
  const isEdit     = !!(initialData?.id);
  const iSrc       = initialData?.videoUrl ? (initialData.videoUrl.includes("vimeo") ? "vimeo" : "youtube") : "youtube";
  const [src,      setSrc]      = React.useState(iSrc);
  const [url,      setUrl]      = React.useState(initialData?.videoUrl || "");
  const [title,    setTitle]    = React.useState(initialData?.title || "");
  const [clientNm, setClientNm] = React.useState(initialData?.client || clients[0]?.name || "");
  const [year,     setYear]     = React.useState(initialData?.year || "2026");
  const [duration, setDuration] = React.useState(initialData?.duration || "");
  const [empreendimento, setEmpreendimento] = React.useState(initialData?.empreendimento || "");
  const [cat,      setCat]      = React.useState(initialData?.category || cats[0]?.id || "");
  const [views,    setViews]    = React.useState(initialData?.views || "—");
  const [tags,     setTags]     = React.useState((initialData?.tags||[]).join(", "));
  const [feat,     setFeat]     = React.useState(initialData?.featured || false);
  const [aiGen,    setAiGen]    = React.useState(initialData?.aiGenerated || false);
  const [has360,   setHas360]   = React.useState(initialData?.has360 || false);
  const [status,   setStatus]   = React.useState(initialData?.status || "draft");
  const [thumbUrl, setThumbUrl] = React.useState(initialData?.thumbUrl || "");
  const [baImages, setBaImages] = React.useState(initialData?.baImages || []);
  const [uploading, setUploading] = React.useState(false);
  const [uploadingBA, setUploadingBA] = React.useState(false);
  const descRef = React.useRef(null);
  React.useEffect(() => { if (descRef.current) descRef.current.innerHTML = initialData?.description || ""; }, []);

  const [framePicker, setFramePicker] = React.useState(false);
  const ytId = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  // YouTube frame options (moments of the video). hqdefault = início (alta res);
  // 1/2/3.jpg = ¼ / meio / ¾ do vídeo. maxresdefault 404s em vídeos não-HD.
  const ytFrames = ytId ? {
    inicio: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    q1:     `https://img.youtube.com/vi/${ytId}/1.jpg`,
    meio:   `https://img.youtube.com/vi/${ytId}/2.jpg`,
    q3:     `https://img.youtube.com/vi/${ytId}/3.jpg`,
  } : null;
  // Default when nothing chosen: a frame from the MIDDLE of the video.
  const autoThumb = ytFrames ? ytFrames.meio : null;
  const previewThumb = thumbUrl || autoThumb;

  const uploadThumb = async (file) => {
    setUploading(true);
    try {
      const result = await window.API.uploadThumb(file);
      setThumbUrl(result.url);
    } catch (ex) { window.__adminToast?.("Erro ao enviar thumbnail: " + (ex?.error || ex)); }
    setUploading(false);
  };

  const F = {width:"100%",padding:"11px 13px",background:"rgba(255,255,255,0.03)",border:"1px solid var(--line-strong)",borderRadius:10,color:"var(--ink)",font:"inherit",fontSize:13,outline:"none"};

  const submit = (e) => {
    e.preventDefault();
    const c = cats.find(c => c.id === cat);
    const tagsArr = tags.split(",").map(t => t.trim()).filter(Boolean);
    onSave({
      ...(initialData || {}),
      id:       initialData?.id || ("v" + Math.random().toString(36).slice(2,7)),
      title:    title || "Novo projeto",
      category: cat,
      catLabel: c?.name || "Categoria",
      client:   clientNm || "—",
      year:     year || "2026",
      duration: duration || "00:00",
      empreendimento: empreendimento || "",
      tags:     tagsArr.length ? tagsArr : [c?.name || "Novo"],
      featured: feat,
      aiGenerated: aiGen,
      has360,
      status,
      views:    views || "—",
      videoUrl: src !== "upload" ? (url || null) : (initialData?.videoUrl || null),
      // No custom/chosen thumb → auto-pick a frame from the middle of the video.
      thumbUrl: thumbUrl || autoThumb || null,
      description: descRef.current?.innerHTML || "",
      baImages: baImages,
    });
  };

  return (
    <div className="admin-modal-back" onClick={onClose}>
      <form className="admin-modal glass-strong glass" onClick={(e)=>e.stopPropagation()} onSubmit={submit}
        style={{maxWidth:660,maxHeight:"92vh",overflowY:"auto"}}>
        <h3>{isEdit ? "Editar vídeo" : "Adicionar vídeo"}</h3>
        <p className="sub">{isEdit ? "Edite os metadados e configurações do projeto." : "Cole um link do YouTube ou Vimeo e preencha os dados."}</p>

        {/* Source selector */}
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {["youtube","vimeo","upload"].map(s => (
            <button type="button" key={s} onClick={()=>setSrc(s)} data-cursor="hover" className="btn"
              style={{flex:1,justifyContent:"center",padding:"9px 0",fontSize:12,
                background: src===s ? "rgba(230,57,70,0.1)" : "rgba(255,255,255,0.03)",
                border:"1px solid " + (src===s ? "var(--accent)" : "var(--line-strong)"),
                color: src===s ? "var(--accent)" : "var(--ink-dim)"}}>
              {s === "youtube" ? "YouTube" : s === "vimeo" ? "Vimeo" : "Upload"}
            </button>
          ))}
        </div>

        {/* URL */}
        <div className="field">
          <label>{src === "upload" ? "Arquivo de vídeo" : "Link do vídeo"}</label>
          {src === "upload" ? (
            <div style={{padding:20,border:"1px dashed var(--line-strong)",borderRadius:10,textAlign:"center",color:"var(--ink-dim)",fontSize:13}}>
              <Icon name="upload" size={18}/><div style={{marginTop:6}}>Funcionalidade de upload em breve</div>
            </div>
          ) : (
            <input value={url} onChange={(e)=>setUrl(e.target.value)} style={F}
              placeholder={src==="youtube" ? "https://youtube.com/watch?v=…" : "https://vimeo.com/123456789"}/>
          )}
        </div>

        {/* Title + Client */}
        <div className="row">
          <div className="field"><label>Título</label><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Título do projeto" style={F}/></div>
          <div className="field">
            <label>Cliente</label>
            <select value={clientNm} onChange={(e)=>setClientNm(e.target.value)} style={F}>
              {clients.map(c => <option key={c.id} value={c.name} style={{background:"#0b0b0f"}}>{c.name}</option>)}
              <option value="—" style={{background:"#0b0b0f"}}>— sem cliente —</option>
            </select>
          </div>
        </div>

        {/* Category + Year + Duration + Views */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}}>
          <div className="field">
            <label>Categoria</label>
            <select value={cat} onChange={(e)=>setCat(e.target.value)} style={F}>
              {cats.map(c => <option key={c.id} value={c.id} style={{background:"#0b0b0f"}}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Ano</label><input value={year} onChange={(e)=>setYear(e.target.value)} placeholder="2026" style={F}/></div>
          <div className="field"><label>Duração</label><input value={duration} onChange={(e)=>setDuration(e.target.value)} placeholder="01:30" style={F}/></div>
        </div>

        {/* Empreendimento + Tags */}
        <div className="row">
          <div className="field"><label>Empreendimento</label><input value={empreendimento} onChange={(e)=>setEmpreendimento(e.target.value)} placeholder="Ex.: Edifício Horizonte" style={F}/></div>
          <div className="field"><label>Tags (vírgula)</label><input value={tags} onChange={(e)=>setTags(e.target.value)} placeholder="Auto, Branded, Música" style={F}/></div>
        </div>

        {/* Description — contenteditable with paste-image support */}
        <div className="field">
          <label>Comentários <span style={{color:"var(--ink-mute)",fontWeight:400,fontSize:11}}>(cole imagens com Ctrl+V)</span></label>
          <div
            ref={descRef}
            contentEditable suppressContentEditableWarning
            data-placeholder="Adicione comentários, contexto ou detalhes sobre este vídeo…"
            style={{...F, minHeight:80, maxHeight:320, overflowY:"auto", outline:"none", lineHeight:1.7, cursor:"text", whiteSpace:"pre-wrap"}}
            onPaste={async (e) => {
              const items = Array.from(e.clipboardData.items || []);
              const imgItem = items.find(x => x.type.startsWith("image/"));
              if (!imgItem) return;
              e.preventDefault();
              const file = imgItem.getAsFile();
              try {
                const { url } = await window.API.uploadThumb(file);
                document.execCommand("insertHTML", false, `<img src="${url}" style="max-width:100%;border-radius:8px;margin:8px 0;display:block;">`);
              } catch {
                const reader = new FileReader();
                reader.onload = ev => document.execCommand("insertHTML", false, `<img src="${ev.target.result}" style="max-width:100%;border-radius:8px;margin:8px 0;display:block;">`);
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>

        {/* Before / After images removed per user request */}

        {/* Thumbnail */}
        <div className="field">
          <label>Thumbnail</label>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{width:128,height:72,borderRadius:8,overflow:"hidden",flexShrink:0,
              background:previewThumb?"transparent":"rgba(255,255,255,0.04)",
              border:"1px solid var(--line-strong)",
              backgroundImage:previewThumb?`url(${previewThumb})`:"none",
              backgroundSize:"cover",backgroundPosition:"center",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {!previewThumb && <Icon name="video" size={18} style={{color:"var(--ink-dim)"}}/>}
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button type="button" disabled={!ytId} onClick={()=>ytId && setFramePicker(v=>!v)}
                  title={ytId ? "Assistir e escolher um frame do vídeo" : "Cole um link do YouTube para habilitar"}
                  style={{display:"inline-flex",alignItems:"center",gap:8,padding:"9px 14px",borderRadius:8,
                    fontSize:12,fontWeight:600,cursor:ytId?"pointer":"not-allowed",
                    border:ytId?"1px solid var(--accent)":"1px solid var(--line-strong)",
                    color:ytId?"var(--accent)":"var(--ink-mute)",
                    background:ytId?"rgba(255,45,45,0.10)":"transparent",
                    opacity:ytId?1:0.5}}>
                  <Icon name="play" size={12}/>
                  {framePicker ? "Fechar" : "Escolher frame do vídeo"}
                </button>
                <label style={{display:"inline-flex",alignItems:"center",gap:8,padding:"9px 14px",
                  border:"1px solid var(--line-strong)",borderRadius:8,cursor:"pointer",
                  fontSize:12,color:"var(--ink-dim)"}}>
                  <Icon name="upload" size={13}/>
                  {uploading ? "Enviando…" : "Carregar imagem"}
                  <input type="file" accept="image/jpeg,image/png" style={{display:"none"}}
                    onChange={(e)=>{ const f=e.target.files[0]; if(f) uploadThumb(f); }}/>
                </label>
              </div>
              {ytId && !thumbUrl && (
                <span style={{fontSize:11,color:"var(--ink-dim)",fontFamily:"var(--font-mono)",letterSpacing:"0.08em"}}>
                  Automático: um frame do meio do vídeo
                </span>
              )}
              {thumbUrl && !/img\.youtube\.com/.test(thumbUrl) && (
                <button type="button" onClick={()=>setThumbUrl("")}
                  style={{fontSize:11,color:"var(--accent)",background:"none",border:"none",cursor:"pointer",fontFamily:"var(--font-mono)",letterSpacing:"0.08em",textAlign:"left",padding:0}}>
                  × remover imagem personalizada
                </button>
              )}
              {thumbUrl && /img\.youtube\.com/.test(thumbUrl) && (
                <button type="button" onClick={()=>setThumbUrl("")}
                  style={{fontSize:11,color:"var(--ink-dim)",background:"none",border:"none",cursor:"pointer",fontFamily:"var(--font-mono)",letterSpacing:"0.08em",textAlign:"left",padding:0}}>
                  × voltar ao automático (meio do vídeo)
                </button>
              )}
            </div>
          </div>

          {/* Moment picker — watch the video and pick a frame */}
          {framePicker && ytId && (
            <div style={{marginTop:12,padding:12,border:"1px solid var(--line-strong)",borderRadius:10,background:"rgba(255,255,255,0.02)"}}>
              <div style={{position:"relative",width:"100%",aspectRatio:"16/9",borderRadius:8,overflow:"hidden",marginBottom:10,background:"#000"}}>
                <iframe src={`https://www.youtube.com/embed/${ytId}`} allow="encrypted-media; fullscreen" allowFullScreen
                  title="Assistir para escolher a thumb" style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}/>
              </div>
              <div style={{fontSize:11,color:"var(--ink-dim)",marginBottom:8,fontFamily:"var(--font-mono)",letterSpacing:"0.06em"}}>
                Escolha um momento do vídeo:
              </div>
              <div style={{display:"flex",gap:8}}>
                {[["Início",ytFrames.inicio],["¼",ytFrames.q1],["Meio",ytFrames.meio],["¾",ytFrames.q3]].map(([label,frameUrl])=>{
                  const selected = thumbUrl ? thumbUrl===frameUrl : frameUrl===autoThumb;
                  return (
                    <button key={label} type="button" onClick={()=>setThumbUrl(frameUrl)}
                      style={{flex:1,padding:0,border:selected?"2px solid var(--accent)":"1px solid var(--line-strong)",
                        borderRadius:8,overflow:"hidden",cursor:"pointer",background:"#000"}}>
                      <div style={{width:"100%",aspectRatio:"16/9",backgroundImage:`url(${frameUrl})`,backgroundSize:"cover",backgroundPosition:"center"}}/>
                      <div style={{fontSize:10,padding:"4px 0",textAlign:"center",color:selected?"var(--accent)":"var(--ink-dim)",fontFamily:"var(--font-mono)"}}>{label}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{fontSize:10,color:"var(--ink-mute)",marginTop:8,lineHeight:1.5}}>
                Os frames ¼/meio/¾ vêm do YouTube em resolução menor. Para máxima qualidade, use "Carregar imagem" com um print do momento exato.
              </div>
            </div>
          )}
        </div>

        {/* Toggles */}
        <div style={{display:"flex",gap:24,marginTop:4,flexWrap:"wrap"}}>
          <div className={"toggle " + (feat ? "on" : "")} onClick={()=>setFeat(f=>!f)} data-cursor="hover">
            <span className="switch"/> Destacar na home
          </div>
          <div className={"toggle " + (aiGen ? "on" : "")} onClick={()=>setAiGen(a=>!a)} data-cursor="hover">
            <span className="switch"/> Gerado com IA
          </div>
          <div className={"toggle " + (has360 ? "on" : "")} onClick={()=>setHas360(a=>!a)} data-cursor="hover"
            style={{ "--toggle-accent": "#FF3B8A" }}>
            <span className="switch"/> Simulação 360°
          </div>
          <div className={"toggle " + (status==="live" ? "on" : "")}
            onClick={()=>setStatus(s => s==="live" ? "draft" : "live")}
            data-cursor="hover">
            <span className="switch"/>
            <span>{status === "live" ? "Público" : "Privado (só no console)"}</span>
          </div>
        </div>

        <div className="admin-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} data-cursor="hover">Cancelar</button>
          <button type="submit" className="btn btn-accent" data-cursor="hover">
            {isEdit ? "Salvar alterações" : "Salvar vídeo"} <Icon name="arrow-right" size={14}/>
          </button>
        </div>
      </form>
    </div>
  );
};

/* =========================== Partners =========================== */
const PartnerInfoItem = ({ label, value, href }) => {
  if (!value) return null;
  return (
    <div className="pi-item">
      <span className="pi-label">{label}</span>
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" className="pi-value pi-link">{value}</a>
        : <span className="pi-value">{value}</span>
      }
    </div>
  );
};

const PartnersPanel = ({ partners, setPartners }) => {
  const [expanded, setExpanded] = React.useState(null);
  const [search, setSearch] = React.useState("");

  const filtered = partners.filter(p =>
    !search ||
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.cidade?.toLowerCase().includes(search.toLowerCase()) ||
    p.tipoServico?.toLowerCase().includes(search.toLowerCase())
  );

  const remove = (id) => {
    window.__adminConfirm?.("Excluir este cadastro?", async () => {
      try {
        await window.API.deletePartner(id);
        setPartners(ps => ps.filter(p => p.id !== id));
        if (expanded === id) setExpanded(null);
      } catch (ex) { window.__adminToast?.("Erro ao excluir: " + (ex?.error || ex)); }
    });
  };

  const fmt = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div className="admin-search" style={{ margin: 0, flex: 1 }}>
          <Icon name="search" size={14} />
          <input
            placeholder="Buscar por nome, cidade ou tipo de serviço…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <a
          href="/cadastroparceiro"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          style={{ padding: "9px 16px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
          data-cursor="hover"
        >
          <Icon name="external" size={14} /> Ver formulário público
        </a>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.15em" }}>
          {search ? "Nenhum resultado." : "Nenhum cadastro ainda. Compartilhe o link /cadastroparceiro."}
        </div>
      )}

      <div className="admin-rows">
        {filtered.map((p) => (
          <div key={p.id} className="partner-card-row">
            <div
              className="partner-row-head"
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              data-cursor="hover"
            >
              <div className="partner-row-avatar">
                {(p.nome || "?")[0].toUpperCase()}
              </div>
              <div className="partner-row-info">
                <div className="partner-row-name">{p.nome}</div>
                <div className="partner-row-meta">
                  {p.tipoServico && <span className="cat-pill" style={{ fontSize: 10, padding: "2px 8px" }}>{p.tipoServico}</span>}
                  <span>{p.cidade}</span>
                  <span className="dot-sep">·</span>
                  <span>{p.email}</span>
                </div>
              </div>
              <div className="partner-row-date">{fmt(p.createdAt)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}>
                <button
                  className="partner-row-del"
                  data-cursor="hover"
                  title="Excluir"
                  onClick={e => { e.stopPropagation(); remove(p.id); }}
                >
                  <Icon name="trash" size={14} />
                </button>
                <span style={{ color: "var(--ink-mute)", fontSize: 10 }}>{expanded === p.id ? "▲" : "▼"}</span>
              </div>
            </div>

            {expanded === p.id && (
              <div className="partner-row-body">
                <PartnerInfoItem label="WhatsApp" value={p.contato} />
                <PartnerInfoItem label="Tipo de serviço" value={p.tipoServico} />
                <PartnerInfoItem label="Equipamentos" value={p.equipamento} />
                <PartnerInfoItem label="Portfólio" value={p.portfolio} href={p.portfolio} />
                <PartnerInfoItem label="Média de valores" value={p.mediaValor} />
                <PartnerInfoItem label="Cadastrado em" value={fmt(p.createdAt)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

/* =========================== Tutorial Admin =========================== */
const TutorialPanel = () => {
  const [data, setData] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    window.API.getTutorial()
      .then(setData)
      .catch(() => setData({ videoUrl: '', title: '', subtitle: '', text: '' }));
  }, []);

  const update = (k, v) => setData(d => ({ ...d, [k]: v }));

  const save = async () => {
    setErr("");
    setSaving(true);
    try {
      await window.API.saveTutorial(data);
      setSavedAt(new Date());
      setTimeout(() => setSavedAt(null), 2400);
    } catch (ex) {
      setErr(ex?.error || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div style={{padding:32,color:"var(--ink-dim)"}}>Carregando…</div>;

  // Preview ID for embed
  const m = (data.videoUrl || '').match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  const ytId = m ? m[1] : null;

  return (
    <div className="tutorial-panel" style={{maxWidth:880}}>
      <p style={{color:"var(--ink-dim)",fontSize:13,lineHeight:1.6,marginBottom:24,maxWidth:560}}>
        Edite o conteúdo da página de tutorial pública (acessível em <code style={{background:"rgba(255,255,255,0.06)",padding:"2px 6px",borderRadius:4}}>/tutorial</code>). Use HTML simples no campo de texto se quiser formatação rica.
      </p>

      <div className="tutorial-panel-grid">
        <div className="tutorial-panel-form">
          <div className="vf-field">
            <label>Link do vídeo (YouTube)</label>
            <input type="url" value={data.videoUrl} onChange={(e)=>update('videoUrl', e.target.value)} placeholder="https://www.youtube.com/watch?v=..."/>
          </div>

          <div className="vf-field">
            <label>Título principal</label>
            <input type="text" value={data.title} onChange={(e)=>update('title', e.target.value)} placeholder="Ex: Recebeu a primeira versão do seu vídeo..."/>
          </div>

          <div className="vf-field">
            <label>Subtítulo (em destaque)</label>
            <input type="text" value={data.subtitle} onChange={(e)=>update('subtitle', e.target.value)} placeholder="Ex: Siga este guia rápido..."/>
          </div>

          <div className="vf-field">
            <label>Texto / Conteúdo (HTML permitido)</label>
            <textarea
              value={data.text}
              onChange={(e)=>update('text', e.target.value)}
              rows={14}
              placeholder="<p>Texto do tutorial...</p>"
              style={{fontFamily:"var(--font-mono)",fontSize:12,lineHeight:1.5}}
            />
          </div>

          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:12}}>
            <button className="btn btn-accent" onClick={save} disabled={saving} data-cursor="hover">
              {saving ? "Salvando…" : "Salvar alterações"} <Icon name="arrow-right" size={14}/>
            </button>
            <a href="/tutorial" target="_blank" className="btn btn-ghost" data-cursor="hover">
              <Icon name="external" size={14}/> Visualizar página
            </a>
            {savedAt && <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"#22e07c"}}>✓ salvo</span>}
            {err && <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--accent)"}}>{err}</span>}
          </div>
        </div>

        <div className="tutorial-panel-preview glass" style={{padding:18,borderRadius:14}}>
          <div style={{fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:"0.18em",textTransform:"uppercase",color:"var(--ink-dim)",marginBottom:14}}>— Preview do vídeo</div>
          {ytId ? (
            <div style={{aspectRatio:"16/9",borderRadius:10,overflow:"hidden",background:"#000"}}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                style={{width:"100%",height:"100%",border:"none"}}
                allowFullScreen
                title="Preview"
              />
            </div>
          ) : (
            <div style={{aspectRatio:"16/9",borderRadius:10,background:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--ink-mute)",fontSize:12}}>
              Cole um link válido do YouTube
            </div>
          )}
          <div style={{fontSize:11,color:"var(--ink-dim)",lineHeight:1.55,marginTop:14}}>
            A página é pública e fica disponível em <strong>/tutorial</strong>. Você pode compartilhar o link diretamente com clientes que precisam de suporte.
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================== AI Panel =========================== */
const AIPanel = () => {
  const getInitial = () => {
    const raw = window.FRAMETY_DATA?.aiSection || {};
    return {
      eyebrow:  raw.eyebrow  || '— 07 / Inteligência Artificial',
      title:    raw.title    || 'Introducing the future',
      subtitle: raw.subtitle || 'Geração de cenas com inteligência artificial.',
      body:     raw.body     || '',
      features: Array.isArray(raw.features) ? raw.features.join('\n') : '',
      items: Array.isArray(raw.items) && raw.items.length === 5 ? raw.items : [
        { id: 'ai-1', title: 'Voice Assistant',        imageUrl: '' },
        { id: 'ai-2', title: 'AI Image Generation',    imageUrl: '' },
        { id: 'ai-3', title: 'AI Chatbot + Local RAG', imageUrl: '' },
        { id: 'ai-4', title: 'AI Agent',               imageUrl: '' },
        { id: 'ai-5', title: 'Visual Understanding',   imageUrl: '' },
      ],
    };
  };

  const [data, setData] = React.useState(getInitial);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState({});

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        features: data.features.split('\n').map(f => f.trim()).filter(Boolean),
      };
      await window.API.saveAiSection(payload);
      if (window.FRAMETY_DATA) window.FRAMETY_DATA.aiSection = { ...payload };
      window.__adminToast?.('Seção IA salva com sucesso!', 'success');
    } catch (ex) {
      window.__adminToast?.('Erro ao salvar: ' + (ex?.error || ex));
    }
    setSaving(false);
  };

  const uploadImage = async (itemId, file) => {
    setUploading(u => ({ ...u, [itemId]: true }));
    try {
      const result = await window.API.uploadAiImage(itemId, file);
      setData(d => ({
        ...d,
        items: d.items.map(i => i.id === itemId ? { ...i, imageUrl: result.url } : i),
      }));
      if (window.FRAMETY_DATA?.aiSection?.items) {
        window.FRAMETY_DATA.aiSection.items = window.FRAMETY_DATA.aiSection.items.map(
          i => i.id === itemId ? { ...i, imageUrl: result.url } : i
        );
      }
    } catch (ex) {
      window.__adminToast?.('Erro ao enviar imagem: ' + (ex?.error || ex));
    }
    setUploading(u => ({ ...u, [itemId]: false }));
  };

  const field = (label, key, multi, rows = 3) => (
    <div className="field" style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 6 }}>{label}</label>
      {multi
        ? <textarea rows={rows} value={data[key]} onChange={e => setData(d => ({ ...d, [key]: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
        : <input value={data[key]} onChange={e => setData(d => ({ ...d, [key]: e.target.value }))} style={{ width: '100%' }} />}
    </div>
  );

  return (
    <div className="ai-admin-panel">
      {/* ── Texts ── */}
      <div className="ai-admin-form-section">
        <h3>Textos da seção</h3>
        {field('Eyebrow (rótulo superior)', 'eyebrow')}
        {field('Título principal', 'title')}
        {field('Subtítulo', 'subtitle')}
        {field('Texto de contexto', 'body', true, 5)}
        {field('Lista de benefícios (um por linha)', 'features', true, 9)}
      </div>

      {/* ── Accordion items ── */}
      <div className="ai-admin-form-section">
        <h3>Itens do acordeão de imagens</h3>
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 18, lineHeight: 1.5 }}>
          Edite a legenda de cada item e faça upload da imagem correspondente. As imagens aparecem no acordeão interativo da seção IA.
        </p>
        {data.items.map((item, idx) => (
          <div key={item.id} className="ai-acc-editor">
            <span className="ai-acc-num">{String(idx + 1).padStart(2, '0')}</span>
            <div className="ai-acc-preview">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.title} />
                : <Icon name="image" size={18} style={{ color: 'var(--ink-mute)' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 5 }}>Legenda</label>
              <input
                value={item.title}
                onChange={e => setData(d => ({ ...d, items: d.items.map(i => i.id === item.id ? { ...i, title: e.target.value } : i) }))}
                style={{ width: '100%' }}
                placeholder="Ex.: Visual Understanding"
              />
            </div>
            <label className="btn btn-ghost" style={{ cursor: 'pointer', padding: '8px 14px', fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, opacity: uploading[item.id] ? 0.5 : 1 }} data-cursor="hover">
              {uploading[item.id] ? <><Icon name="loader" size={13}/> Enviando…</> : <><Icon name="upload" size={13}/> Mídia</>}
              <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" style={{ display: 'none' }}
                disabled={!!uploading[item.id]}
                onChange={e => { const f = e.target.files[0]; if (f) uploadImage(item.id, f); e.target.value = ''; }}
              />
            </label>
          </div>
        ))}
      </div>

      <button className="btn btn-accent" onClick={save} disabled={saving} data-cursor="hover" style={{ marginTop: 4 }}>
        {saving ? <><Icon name="loader" size={14}/> Salvando…</> : <><Icon name="check" size={14}/> Salvar alterações</>}
      </button>
    </div>
  );
};

/* =========================== Links (short-link redirects) =========================== */
const fieldLabelStyle = { display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 6 };
const linkInputStyle = { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', font: 'inherit', fontSize: 12.5, outline: 'none' };

const LinksPanel = ({ redirects, setRedirects }) => {
  const [newSlug, setNewSlug] = React.useState('');
  const [newTarget, setNewTarget] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [fCategory, setFCategory] = React.useState('all');
  const [saving, setSaving] = React.useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const categories = Array.from(new Set(redirects.map(r => r.category || 'Sem categoria'))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const addLink = async () => {
    const slug = newSlug.trim();
    const target = newTarget.trim();
    if (!slug) { window.__adminToast?.('Informe um nome para o link.'); return; }
    if (!target) { window.__adminToast?.('Informe a URL de destino.'); return; }
    setSaving(true);
    try {
      const redirect = await window.API.addRedirect({ slug, target, category: newCategory.trim() });
      setRedirects(rs => [...rs, redirect]);
      setNewSlug(''); setNewTarget(''); setNewCategory('');
    } catch (ex) {
      window.__adminToast?.(ex?.error || 'Erro ao criar link.');
    } finally { setSaving(false); }
  };

  const removeLink = (slug) => {
    window.__adminConfirm?.(`Excluir o link "/${slug}"?`, async () => {
      try {
        await window.API.deleteRedirect(slug);
        setRedirects(rs => rs.filter(r => r.slug !== slug));
      } catch (ex) { window.__adminToast?.(ex?.error || 'Erro ao excluir link.'); }
    });
  };

  const copyLink = (fullUrl) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => window.__adminToast?.('Link copiado!', 'success')).catch(() => {});
    }
  };

  const filtered = redirects.filter(r => {
    const cat = r.category || 'Sem categoria';
    if (fCategory !== 'all' && cat !== fCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(r.slug + ' ' + r.target + ' ' + cat).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const groupsMap = {};
  filtered.forEach(r => {
    const cat = r.category || 'Sem categoria';
    (groupsMap[cat] = groupsMap[cat] || []).push(r);
  });
  const groups = Object.keys(groupsMap).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(cat => ({ category: cat, items: groupsMap[cat] }));

  return (
    <>
      <div className="glass" style={{ padding: 20, borderRadius: 16, marginBottom: 22 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 16 }}>Criar novo link</h3>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={fieldLabelStyle}>Link</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-dim)', whiteSpace: 'nowrap' }}>{origin}/</span>
              <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="rodolfo" style={{ border: 'none', outline: 'none', background: 'none', flex: 1, minWidth: 40, font: 'inherit', fontSize: 12.5, color: 'var(--ink)' }}/>
            </div>
          </div>
          <div style={{ flex: '2 1 280px' }}>
            <label style={fieldLabelStyle}>Redireciona para</label>
            <input value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="https://www.google.com.br" style={linkInputStyle}/>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={fieldLabelStyle}>Categoria</label>
            <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Ex.: Clientes" style={linkInputStyle}/>
          </div>
          <button className="btn btn-accent" onClick={addLink} disabled={saving} data-cursor="hover">
            {saving ? <><Icon name="loader" size={14}/> Criando…</> : <><Icon name="plus" size={14}/> Criar link</>}
          </button>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search" style={{ margin: 0 }}>
          <Icon name="search" size={14}/>
          <input placeholder="Buscar links…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="admin-toolbar-group">
          <span className="admin-toolbar-label">Categoria</span>
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} data-cursor="hover">
            <option value="all">todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {(search || fCategory !== 'all') && (
          <button className="filter-pill" onClick={() => { setSearch(''); setFCategory('all'); }} data-cursor="hover" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>limpar</button>
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-mute)', margin: '14px 0' }}>
        — {filtered.length} de {redirects.length} link{redirects.length === 1 ? '' : 's'}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
          {redirects.length === 0 ? 'Nenhum link criado ainda.' : 'Nenhum link corresponde aos filtros.'}
        </div>
      )}

      {groups.map(g => (
        <div key={g.category} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>{g.category}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.items.map(r => (
              <div key={r.slug} className="glass" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14 }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{origin}/{r.slug}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {r.target}</div>
                </div>
                <div style={{ flex: '0 0 auto', fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>{r.clicks || 0} clique{(r.clicks || 0) === 1 ? '' : 's'}</div>
                <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 11.5 }} onClick={() => copyLink(`${origin}/${r.slug}`)} data-cursor="hover"><Icon name="copy" size={13}/> Copiar</button>
                <button onClick={() => removeLink(r.slug)} data-cursor="hover" title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4, flex: '0 0 auto' }}><Icon name="trash" size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

/* =========================== Locuções (OS) — shared helpers =========================== */
function osToday() { return new Date().toLocaleDateString('pt-BR'); }
function anoOfRow(r) {
  const m = (r.data || '').match(/(\d{4})/);
  if (m) return m[1];
  const m2 = r.os && r.os.emissao ? ('' + r.os.emissao).match(/(\d{4})/) : null;
  return m2 ? m2[1] : '';
}
/* O valor vem da planilha já formatado; quem somava e reformatava era o total
   da lista, que não existe mais — daí parseBRL/formatBRL terem saído daqui. */
function buildOS(r, over) {
  const parts = (r.locutor || '').split('/');
  const os = {
    date: osToday(),
    servicoId: r.id || '',
    emissao: r.data || osToday(),
    responsavel: '',
    empresa: 'Skyline Inovação',
    projeto: [r.cliente, r.produto].filter(Boolean).join(' - '),
    tipoServico: '',
    fornecedor: (parts[0] || '').trim(),
    responsavel2: (parts[1] || '').trim(),
    banner: 'ATENÇÃO AOS DADOS NO CAMPO "DADOS PARA FATURAMENTO" PARA EMISSÃO DA NOTA FISCAL',
    fatNome: 'SKYLINE INOVACAO E PRODUCOES LTDA',
    fatCnpj: '23.240.029/0001-46',
    fatEndereco: 'Rua 5, S/N Quadra 16 Lote 21 CIDADE JARDIM\nANÁPOLIS - GO 75080-730',
    descNota: '" Referente ao job ' + (r.id || '') + ' "',
    descricao: '',
    infoAdicionais: 'nenhuma',
    nota1: '• NFS recebidas entre os dias 01 e 15 do mês, pagamento dia 05 do mês seguinte;',
    nota2: '• NFS recebidas entre os dias 16 e 30 do mês, pagamento dia 25 do mês seguinte;',
    anexoLabel: 'Anexar esse documento junto a nota fiscal, no link :',
    pipefyLink: 'https://app.pipefy.com/public/form/J1LvfGLJ',
    pixNote: 'Adicionar a chave pix junto aos dados bancários.',
    valorTotal: r.valor || 'R$ 0,00',
    formaPagamento: 'Pix',
    logoSkyline: null,
    logoFramety: null,
    customSobre: [],
    customFat: [],
  };
  return Object.assign(os, over || {});
}
function pdfNameFor(r) {
  if (!r) return 'OS';
  const id = r.id || '';
  const forn = ((r.locutor || '').split('/')[0] || '').trim();
  const ano = anoOfRow(r) || new Date().getFullYear();
  return ['OS', forn, id, ano].filter(Boolean).join(' ');
}
const cadSectionDefs = [
  { key: 'clientes', label: 'Clientes' },
  { key: 'projetos', label: 'Projetos' },
  { key: 'empreendimentos', label: 'Empreendimentos' },
  { key: 'categorias', label: 'Categorias' },
];

/* =========================== Locuções (OS) =========================== */
/* A aba não guarda mais uma lista. A planilha de produção já tem o job inteiro
   em uma linha, então aqui só se digita o #SKY: o servidor acha aquela linha e
   devolve os campos, e a OS é montada com o que já existe.

   A OS resultante vive em memória — a fonte é a planilha e o entregável é o
   PDF. Ajustes feitos no documento valem para aquele PDF e não voltam para a
   planilha; por isso não há nada para salvar aqui.

   As páginas de lista que já estavam no banco continuam lá, intactas: elas
   deixaram de ser a interface, não foram apagadas. Enquanto a planilha não
   estiver configurada, o servidor busca o #SKY nessas linhas salvas — assim a
   tela segue utilizável antes da integração ficar de pé. */
const LocucoesPanel = ({ cad, setCad, readOnly = false, roToken = '', onShare, onChangePassword }) => {
  const [subTab, setSubTab] = React.useState('busca');   // 'busca' | 'cadastros'
  const [sky, setSky] = React.useState('');
  const [buscando, setBuscando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [fonte, setFonte] = React.useState('');          // 'sheet' | 'local'
  const [doc, setDoc] = React.useState(null);            // linha da planilha + OS montada
  const [osEdit, setOsEdit] = React.useState(false);
  const [autoDownload, setAutoDownload] = React.useState(false);
  const [diag, setDiag] = React.useState(null);
  const [cadDraft, setCadDraft] = React.useState({ clientes: '', projetos: '', empreendimentos: '', categorias: '' });

  const abrirDoc = (row, editavel) => {
    setDoc({ ...row, uid: 'os_' + Date.now(), os: buildOS(row) });
    setOsEdit(editavel);
    setAutoDownload(false);
  };

  const buscar = async (e) => {
    if (e) e.preventDefault();
    const termo = sky.trim();
    if (!termo || buscando) return;
    setBuscando(true); setErro(''); setDiag(null);
    try {
      // No link somente-leitura o token é o do compartilhamento, não o do admin.
      const d = roToken ? await window.API.lookupOsWith(roToken, termo) : await window.API.lookupOs(termo);
      setFonte(d.source || '');
      abrirDoc(d.row || {}, !readOnly);
    } catch (ex) {
      setErro((ex && ex.error) || 'Não consegui buscar o job. Tente de novo.');
    } finally {
      setBuscando(false);
    }
  };

  // Saída para o job que ainda não entrou na planilha — sem isso, um #SKY que
  // não existe lá seria um beco sem saída.
  const abrirEmBranco = () => {
    setErro(''); setDiag(null); setFonte('');
    abrirDoc({ id: sky.trim(), data: osToday(), cliente: '', produto: '', locutor: '', valor: '' }, true);
  };

  // Quando a busca falha, o motivo quase sempre está na configuração da
  // planilha — mostrar o que o servidor enxerga evita adivinhação.
  const verDiagnostico = () => {
    window.API.getSheetStatus()
      .then(setDiag)
      .catch(ex => setDiag({ configured: false, error: (ex && ex.error) || 'Não consegui ler o diagnóstico.' }));
  };

  /* Endereço da planilha, editado aqui e guardado no banco. Fora do código de
     propósito: o repositório é público, e o link dá leitura a cachê e
     fornecedor de todos os jobs. Fora do Render também, para trocar de planilha
     não exigir um deploy. */
  const [cfgAberta, setCfgAberta] = React.useState(false);
  const [cfgUrl, setCfgUrl] = React.useState('');
  const [cfgSalvando, setCfgSalvando] = React.useState(false);
  const [cfgAviso, setCfgAviso] = React.useState(null);
  const [temPlanilha, setTemPlanilha] = React.useState(null);   // null = ainda perguntando

  React.useEffect(() => {
    if (readOnly) return;
    window.API.getSheetConfig()
      .then(c => { setCfgUrl(c.spreadsheetId || ''); setTemPlanilha(!!c.spreadsheetId); })
      .catch(() => setTemPlanilha(false));
  }, [readOnly]);

  const salvarPlanilha = async () => {
    setCfgSalvando(true); setCfgAviso(null);
    try {
      const r = await window.API.saveSheetConfig({ spreadsheetId: cfgUrl.trim() });
      const st = r.status || {};
      setTemPlanilha(!!cfgUrl.trim());
      setCfgAviso(st.configured
        ? { ok: true, txt: `Planilha conectada: ${st.rows} linhas, cabeçalho na linha ${st.headerRow}.` }
        : { ok: false, txt: st.error || 'Salvei, mas não consegui ler a planilha.' });
      if (st.configured) { setErro(''); setDiag(null); }
    } catch (ex) {
      setCfgAviso({ ok: false, txt: (ex && ex.error) || 'Não foi possível salvar.' });
    } finally { setCfgSalvando(false); }
  };

  const updateOS = (field, value) => setDoc(d => (d ? { ...d, os: { ...d.os, [field]: value } } : d));

  const addCadItem = (key) => {
    const value = (cadDraft[key] || '').trim();
    if (!value) return;
    const list = cad[key] || [];
    if (list.some(v => v.toLowerCase() === value.toLowerCase())) return;
    setCad(c => ({ ...c, [key]: [...list, value].sort((a, b) => a.localeCompare(b, 'pt-BR')) }));
    setCadDraft(d => ({ ...d, [key]: '' }));
  };
  const removeCadItem = (key, value) => setCad(c => ({ ...c, [key]: (c[key] || []).filter(v => v !== value) }));

  if (doc) {
    return (
      <OsDocumentView
        row={doc}
        osEdit={osEdit}
        setOsEdit={setOsEdit}
        autoDownload={autoDownload}
        readOnly={readOnly}
        onBack={() => setDoc(null)}
        onUpdateOS={updateOS}
      />
    );
  }

  const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'underline' };

  return (
    <>
      <div className="loc-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <button className={"filter-pill " + (subTab === 'busca' ? 'active' : '')} onClick={() => setSubTab('busca')} data-cursor="hover">
          <Icon name="search" size={12}/> Ordem de serviço
        </button>
        <div className="loc-toolbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!readOnly && onChangePassword && (
            <button className="filter-pill" onClick={onChangePassword} data-cursor="hover" title="Alterar a senha da seção Produções"><Icon name="settings" size={12}/> Senha</button>
          )}
          {!readOnly && onShare && (
            <button className="filter-pill" onClick={onShare} data-cursor="hover"><Icon name="share" size={12}/> Compartilhar</button>
          )}
          {!readOnly && (
            <button className={"filter-pill " + (subTab === 'cadastros' ? 'active' : '')} onClick={() => setSubTab('cadastros')} data-cursor="hover">
              <Icon name="folder" size={12}/> Cadastros
            </button>
          )}
        </div>
      </div>

      {subTab === 'cadastros' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
          {cadSectionDefs.map(sec => (
            <div key={sec.key} className="glass" style={{ padding: 20, borderRadius: 16 }}>
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 14 }}>{sec.label}</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input value={cadDraft[sec.key]} onChange={e => setCadDraft(d => ({ ...d, [sec.key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCadItem(sec.key); } }}
                  placeholder="Adicionar…" style={{ flex: 1 }}/>
                <button className="btn btn-accent" style={{ padding: '8px 14px' }} onClick={() => addCadItem(sec.key)} data-cursor="hover"><Icon name="plus" size={13}/></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {(cad[sec.key] || []).map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 12.5 }}>
                    <span>{item}</span>
                    <button onClick={() => removeCadItem(sec.key, item)} data-cursor="hover" style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer' }}><Icon name="x" size={12}/></button>
                  </div>
                ))}
                {(cad[sec.key] || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '6px 2px' }}>Nenhum item cadastrado.</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="loc-busca" style={{ maxWidth: 540, margin: '0 auto', paddingTop: '7vh' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 27, lineHeight: 1.2, marginBottom: 10, textAlign: 'center' }}>Ordem de serviço</h3>
          <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.65, marginBottom: 24, textAlign: 'center' }}>
            Digite o <b>#SKY</b> do job. Os dados vêm da planilha de produção — a OS
            é montada com o que já está lá.
          </p>

          <form onSubmit={buscar} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div className="admin-search" style={{ margin: 0, flex: 1, minWidth: 0 }}>
              <Icon name="search" size={15}/>
              <input value={sky} onChange={e => setSky(e.target.value)} placeholder="#SKY171-B"
                autoFocus spellCheck={false} autoComplete="off"
                style={{ fontWeight: 700, letterSpacing: '0.04em' }}/>
            </div>
            <button type="submit" className="btn btn-accent" disabled={buscando || !sky.trim()} data-cursor="hover"
              style={{ padding: '0 20px', fontSize: 13, whiteSpace: 'nowrap', opacity: (buscando || !sky.trim()) ? 0.5 : 1 }}>
              {buscando ? <><span className="blink"/> Buscando…</> : <>Abrir OS <Icon name="arrow-right" size={14}/></>}
            </button>
          </form>

          <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 10, textAlign: 'center' }}>
            Pode digitar do jeito que vier: <code>#SKY171-B</code>, <code>sky 171 b</code> ou <code>SKY171B</code>.
          </p>

          {erro && (
            <div style={{ marginTop: 18, padding: '13px 16px', borderRadius: 12, border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 13, lineHeight: 1.55 }}>
              {erro}
              {!readOnly && (
                <div style={{ marginTop: 9 }}>
                  <button onClick={verDiagnostico} data-cursor="hover" style={{ ...linkBtn, fontSize: 12, color: 'var(--ink-dim)' }}>
                    ver o que o servidor enxerga da planilha
                  </button>
                </div>
              )}
            </div>
          )}

          {diag && (
            <pre style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, border: '1px solid var(--line)', borderRadius: 12, padding: 14, overflowX: 'auto', color: 'var(--ink-dim)' }}>
              {JSON.stringify(diag, null, 2)}
            </pre>
          )}

          {fonte === 'local' && !erro && (
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.6, textAlign: 'center' }}>
              A planilha ainda não está configurada — a última busca veio das linhas salvas no banco.
            </p>
          )}

          {!readOnly && (
            <p style={{ marginTop: 28, fontSize: 12.5, color: 'var(--ink-mute)', textAlign: 'center' }}>
              O job ainda não está na planilha?{' '}
              <button onClick={abrirEmBranco} data-cursor="hover" style={{ ...linkBtn, fontSize: 12.5, color: 'var(--ink-dim)' }}>
                abrir uma OS em branco
              </button>
            </p>
          )}

          {/* Conectar a planilha. Aberto de saída enquanto não houver nenhuma —
              sem ela a aba busca nas linhas velhas do banco, e o operador
              precisa saber onde resolver isso. */}
          {!readOnly && temPlanilha !== null && (
            <div style={{ marginTop: 30, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
              {(cfgAberta || !temPlanilha) ? (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 8, lineHeight: 1.6 }}>
                    <b style={{ color: 'var(--ink)' }}>Planilha de produção.</b>{' '}
                    Cole o endereço da planilha (a URL inteira serve). Ela precisa estar
                    compartilhada como <i>qualquer pessoa com o link pode ver</i>.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={cfgUrl} onChange={e => setCfgUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarPlanilha(); } }}
                      placeholder="https://docs.google.com/spreadsheets/d/…"
                      spellCheck={false} style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}/>
                    <button className="btn btn-accent" onClick={salvarPlanilha} data-cursor="hover"
                      disabled={cfgSalvando} style={{ padding: '0 16px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {cfgSalvando ? 'Conferindo…' : 'Conectar'}
                    </button>
                  </div>
                  {cfgAviso && (
                    <p style={{ marginTop: 9, fontSize: 12, lineHeight: 1.55,
                      color: cfgAviso.ok ? 'var(--ink-dim)' : 'var(--accent)' }}>
                      {cfgAviso.ok ? '✓ ' : ''}{cfgAviso.txt}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>
                  Planilha conectada.{' '}
                  <button onClick={() => { setCfgAberta(true); setCfgAviso(null); }} data-cursor="hover"
                    style={{ ...linkBtn, fontSize: 12, color: 'var(--ink-dim)' }}>trocar</button>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

/* =========================== OS Document (full-viewport) =========================== */
function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// Load a script once and cache the promise so repeat calls reuse it.
const _scriptCache = {};
function loadScriptOnce(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => { delete _scriptCache[src]; reject(new Error('load failed: ' + src)); };
    document.head.appendChild(s);
  });
  return _scriptCache[src];
}
// html2canvas + jsPDF are heavy (~600KB) and only needed for PDF export, so we
// fetch them the first time the user actually exports an OS.
async function loadPdfLibs() {
  if (!window.html2canvas) await loadScriptOnce('https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js');
  if (!window.jspdf)       await loadScriptOnce('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
}

async function exportOsPdf(rootEl, filename) {
  if (!rootEl) return;
  try {
    await loadPdfLibs();
  } catch (e) {
    window.__adminToast?.('Não foi possível carregar a biblioteca de PDF. Verifique sua conexão com a internet.');
    return;
  }
  if (!window.html2canvas || !window.jspdf) {
    window.__adminToast?.('Não foi possível gerar o PDF (biblioteca não carregada). Verifique sua conexão com a internet.');
    return;
  }

  // Capture the pipefy link's on-screen position before cloning, so we can
  // overlay a clickable link area in the PDF.
  let linkRect = null;
  const linkEl = rootEl.querySelector('textarea[data-field="pipefyLink"]');
  if (linkEl && /^https?:\/\//i.test(linkEl.value.trim())) {
    const srcRect = rootEl.getBoundingClientRect();
    const elRect = linkEl.getBoundingClientRect();
    linkRect = { url: linkEl.value.trim(), x: elRect.left - srcRect.left, y: elRect.top - srcRect.top, w: elRect.width, h: elRect.height };
  }

  // Clone off-screen and swap textareas/inputs for plain wrapped text nodes:
  // html2canvas doesn't render multi-line textarea values correctly.
  const clone = rootEl.cloneNode(true);
  clone.style.position = 'fixed';
  clone.style.left = '-99999px';
  clone.style.top = '0';
  clone.style.width = rootEl.offsetWidth + 'px';
  // Neutralize any on-screen zoom transform so the PDF captures the doc at full size.
  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';
  document.body.appendChild(clone);

  const origEls = Array.from(rootEl.querySelectorAll('textarea, input'));
  const cloneEls = Array.from(clone.querySelectorAll('textarea, input'));
  cloneEls.forEach((el, i) => {
    const orig = origEls[i];
    if (!orig || (orig.tagName === 'INPUT' && orig.type === 'file')) { el.remove(); return; }
    const cs = getComputedStyle(orig);
    const div = document.createElement('div');
    div.textContent = orig.value;
    div.style.font = cs.font;
    div.style.color = cs.color;
    div.style.textAlign = cs.textAlign;
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordBreak = 'break-word';
    div.style.width = orig.offsetWidth + 'px';
    div.style.flex = cs.flex;
    div.style.padding = cs.padding;
    el.replaceWith(div);
  });

  try {
    const canvas = await window.html2canvas(clone, { backgroundColor: '#ffffff', scale: 1.5, useCORS: true });
    const { jsPDF } = window.jspdf;
    const mmPerPx = 0.2645833;
    const marginMm = 10;
    const wMm = clone.offsetWidth * mmPerPx;
    const hMm = clone.offsetHeight * mmPerPx;
    const pdf = new jsPDF({ unit: 'mm', format: [wMm + marginMm * 2, hMm + marginMm * 2], compress: true });
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, wMm + marginMm * 2, hMm + marginMm * 2, 'F');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', marginMm, marginMm, wMm, hMm, undefined, 'FAST');
    if (linkRect) {
      pdf.link(marginMm + linkRect.x * mmPerPx, marginMm + linkRect.y * mmPerPx, linkRect.w * mmPerPx, linkRect.h * mmPerPx, { url: linkRect.url });
    }
    pdf.save(filename + '.pdf');
  } catch (e) {
    window.__adminToast?.('Erro ao gerar PDF: ' + e.message);
  } finally {
    document.body.removeChild(clone);
  }
}

const OsDocumentView = ({ row, osEdit, setOsEdit, autoDownload, readOnly: shared = false, onBack, onUpdateOS }) => {
  const rootRef = React.useRef(null);
  const deskRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const fileWhichRef = React.useRef(null);
  const lastTapRef = React.useRef(0);
  const os = row.os || {};

  // ── Fit the fixed-width (820px) document to the screen; double-tap zooms to 100%,
  //    drag pans (native scroll). On wide screens fit === 1, so desktop is unchanged. ──
  const DOC_W = 820;
  const [fit, setFit] = React.useState(1);
  const [zoomed, setZoomed] = React.useState(false);
  const [docH, setDocH] = React.useState(0);
  const eff = zoomed ? 1 : fit;

  React.useLayoutEffect(() => {
    const measure = () => {
      const desk = deskRef.current, doc = rootRef.current;
      if (!desk || !doc) return;
      const cs = getComputedStyle(desk);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      setFit(Math.min(1, (desk.clientWidth - pad) / DOC_W));
      setDocH(doc.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (deskRef.current) ro.observe(deskRef.current);
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('orientationchange', measure); };
  }, [os]);

  // Double-tap toggles between fit-to-width and natural (100%), keeping the tapped point stable.
  const applyZoom = (willZoom, clientX, clientY) => {
    const desk = deskRef.current;
    const oldEff = zoomed ? 1 : fit;
    const newEff = willZoom ? 1 : fit;
    setZoomed(willZoom);
    if (!desk) return;
    requestAnimationFrame(() => {
      if (willZoom && clientX != null) {
        const rect = desk.getBoundingClientRect();
        const docX = (desk.scrollLeft + clientX - rect.left) / oldEff;
        const docY = (desk.scrollTop + clientY - rect.top) / oldEff;
        desk.scrollLeft = docX * newEff - (clientX - rect.left);
        desk.scrollTop = docY * newEff - (clientY - rect.top);
      } else {
        desk.scrollLeft = 0;
      }
    });
  };
  const onDeskTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      const t = e.changedTouches[0];
      applyZoom(!zoomed, t ? t.clientX : null, t ? t.clientY : null);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  React.useEffect(() => {
    if (rootRef.current) rootRef.current.querySelectorAll('textarea').forEach(autoGrow);
  }, [os]);

  React.useEffect(() => {
    if (!autoDownload) return;
    const t = setTimeout(() => exportOsPdf(rootRef.current, pdfNameFor(row)), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (field) => (e) => { autoGrow(e.target); onUpdateOS(field, e.target.value); };

  const addField = (sec) => {
    const key = sec === 'sobre' ? 'customSobre' : 'customFat';
    onUpdateOS(key, (os[key] || []).concat([{ label: 'Novo campo :', value: '' }]));
  };
  const removeField = (sec, idx) => {
    const key = sec === 'sobre' ? 'customSobre' : 'customFat';
    onUpdateOS(key, (os[key] || []).filter((_, i) => i !== idx));
  };
  const updateCustomField = (sec, idx, k, value) => {
    const key = sec === 'sobre' ? 'customSobre' : 'customFat';
    onUpdateOS(key, (os[key] || []).map((it, i) => i === idx ? { ...it, [k]: value } : it));
  };

  const onPickLogo = (which) => { fileWhichRef.current = which; fileInputRef.current && fileInputRef.current.click(); };
  const onLogoFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateOS('logo' + fileWhichRef.current, reader.result);
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const tBase = { font: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.4, color: '#111', margin: 0, outline: 'none', boxSizing: 'border-box', width: '100%' };
  const aff = osEdit ? { border: '1px dashed #ff2e6b', background: '#fff5f9', borderRadius: 5 } : { border: '1px solid transparent', background: 'transparent' };
  const readOnly = !osEdit;
  const rowStyle = { display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 5 };
  const labelStyle = { fontWeight: 700, fontSize: 13, flex: '0 0 auto', whiteSpace: 'nowrap', paddingTop: 2, color: '#111' };
  const valStyle = { ...tBase, ...aff, flex: '1 1 auto', minWidth: 30, padding: '1px 5px', fontSize: 13 };
  const customLabelStyle = { ...tBase, ...aff, fontSize: 13, fontWeight: 700, flex: '0 0 auto', width: 110, padding: '1px 5px' };
  const addFieldBtnStyle = { background: 'none', color: '#ff2e6b', border: '1px dashed #ff2e6b', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 8 };
  const removeFieldBtnStyle = { background: 'none', border: 'none', color: '#c0c0c0', fontSize: 13, cursor: 'pointer', flex: '0 0 auto', padding: '0 2px' };

  return (
    <div className="os-view-shell">
      <div className="os-view-toolbar">
        <button className="btn btn-ghost" onClick={onBack} data-cursor="hover"><Icon name="chevron-left" size={14}/> Voltar</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{shared ? 'Somente leitura' : (osEdit ? 'Modo edição — clique nos campos para alterar' : 'Modo visualização')}</span>
          {!shared && (
            <button className={osEdit ? 'btn btn-accent' : 'btn btn-ghost'} onClick={() => setOsEdit(!osEdit)} data-cursor="hover">
              {osEdit ? <><Icon name="check" size={13}/> Concluir edição</> : <><Icon name="edit" size={13}/> Editar documento</>}
            </button>
          )}
          <button className="btn btn-accent" onClick={() => exportOsPdf(rootRef.current, pdfNameFor(row))} data-cursor="hover">
            <Icon name="download" size={13}/> Baixar PDF
          </button>
        </div>
      </div>

      <div className="os-desk" ref={deskRef} onTouchEnd={onDeskTouchEnd}>
        <div className="os-zoom-hint" onClick={() => applyZoom(!zoomed, null, null)}>{zoomed ? 'Toque duplo para ajustar' : 'Toque duplo para ampliar · arraste para navegar'}</div>
        <div className="os-stage" style={{ width: DOC_W * eff, height: docH ? docH * eff : undefined }}>
        <div className="os-doc" ref={rootRef} style={{ transform: `scale(${eff})`, transformOrigin: 'top left' }}>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={onLogoFile} style={{ display: 'none' }}/>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: '1 1 auto' }}>
              <textarea value={os.date || ''} data-field="date" onChange={set('date')} readOnly={readOnly} rows={1}
                style={{ ...tBase, ...aff, fontSize: 10, color: '#333', width: 120, padding: '1px 4px' }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 14 }}>
                {os.logoSkyline
                  ? <img src={os.logoSkyline} alt="Skyline" style={{ height: 78, objectFit: 'contain' }}/>
                  : <img src="/os-skyline-logo.png" alt="Grupo Skyline" style={{ height: 78, width: 'auto', display: 'block' }}/>}
                <div style={{ width: 3, height: 82, background: '#d0d0d0' }}/>
                {os.logoFramety
                  ? <img src={os.logoFramety} alt="Framety" style={{ height: 58, objectFit: 'contain' }}/>
                  : <img src="/os-framety-logo.png" alt="Framety" style={{ height: 58, width: 'auto', display: 'block' }}/>}
              </div>
              {osEdit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => onPickLogo('Skyline')} data-cursor="hover" style={{ background: '#fff', color: '#ff2e6b', border: '1px solid #ff2e6b', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Trocar logo Skyline</button>
                  <button onClick={() => onPickLogo('Framety')} data-cursor="hover" style={{ background: '#fff', color: '#ff2e6b', border: '1px solid #ff2e6b', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Trocar logo Framety</button>
                </div>
              )}
            </div>
            <div style={{ flex: '0 0 320px', textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: '#111' }}>ID do Serviço:</div>
              <div style={{ border: '2px solid #111', borderRadius: 16, padding: '10px 16px' }}>
                <textarea value={os.servicoId || ''} data-field="servicoId" onChange={set('servicoId')} readOnly={readOnly} rows={1}
                  style={{ ...tBase, ...aff, fontSize: 34, fontWeight: 800, textAlign: 'center', padding: 2 }}/>
              </div>
            </div>
          </div>

          <div style={{ background: '#ff2e6b', borderRadius: 20, padding: '8px 16px', margin: '18px 0 16px', textAlign: 'center' }}>
            <textarea value={os.banner || ''} data-field="banner" onChange={set('banner')} readOnly={readOnly} rows={1}
              style={{ ...tBase, border: osEdit ? '1px dashed #fff' : '1px solid transparent', background: 'transparent', color: '#fff', fontSize: 11.5, fontWeight: 700, textAlign: 'center', letterSpacing: '0.2px', padding: '1px 4px' }}/>
          </div>

          <div style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 50%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#111' }}>Sobre o serviço:</div>
              <div style={{ border: '2px solid #111', borderRadius: 18, padding: '14px 16px' }}>
                <div style={rowStyle}><span style={labelStyle}>ID do serviço :</span><textarea value={os.servicoId || ''} data-field="servicoId" onChange={set('servicoId')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Emissão:</span><textarea value={os.emissao || ''} data-field="emissao" onChange={set('emissao')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Responsável:</span><textarea value={os.responsavel || ''} data-field="responsavel" onChange={set('responsavel')} readOnly={readOnly} rows={1} placeholder="—" style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Empresa:</span><textarea value={os.empresa || ''} data-field="empresa" onChange={set('empresa')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Projeto :</span><textarea value={os.projeto || ''} data-field="projeto" onChange={set('projeto')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Tipo de serviço :</span><textarea value={os.tipoServico || ''} data-field="tipoServico" onChange={set('tipoServico')} readOnly={readOnly} rows={1} placeholder="—" style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Fornecedor :</span><textarea value={os.fornecedor || ''} data-field="fornecedor" onChange={set('fornecedor')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Responsável :</span><textarea value={os.responsavel2 || ''} data-field="responsavel2" onChange={set('responsavel2')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                {(os.customSobre || []).map((cf, idx) => (
                  <div key={idx} style={rowStyle}>
                    <input value={cf.label} onChange={e => updateCustomField('sobre', idx, 'label', e.target.value)} readOnly={readOnly} style={customLabelStyle}/>
                    <textarea value={cf.value} onChange={e => { autoGrow(e.target); updateCustomField('sobre', idx, 'value', e.target.value); }} readOnly={readOnly} rows={1} style={valStyle}/>
                    {osEdit && <button onClick={() => removeField('sobre', idx)} data-cursor="hover" style={removeFieldBtnStyle}>✕</button>}
                  </div>
                ))}
                {osEdit && <button onClick={() => addField('sobre')} data-cursor="hover" style={addFieldBtnStyle}>＋ Adicionar campo</button>}
              </div>
            </div>

            <div style={{ flex: '1 1 50%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#111' }}>Dados para faturamento:</div>
              <div style={{ border: '2px solid #111', borderRadius: 18, padding: '14px 16px', height: 'calc(100% - 25px)' }}>
                <div style={rowStyle}><span style={labelStyle}>Nome :</span><textarea value={os.fatNome || ''} data-field="fatNome" onChange={set('fatNome')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>CNPJ :</span><textarea value={os.fatCnpj || ''} data-field="fatCnpj" onChange={set('fatCnpj')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Endereço :</span><textarea value={os.fatEndereco || ''} data-field="fatEndereco" onChange={set('fatEndereco')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                {(os.customFat || []).map((cf, idx) => (
                  <div key={idx} style={rowStyle}>
                    <input value={cf.label} onChange={e => updateCustomField('fat', idx, 'label', e.target.value)} readOnly={readOnly} style={customLabelStyle}/>
                    <textarea value={cf.value} onChange={e => { autoGrow(e.target); updateCustomField('fat', idx, 'value', e.target.value); }} readOnly={readOnly} rows={1} style={valStyle}/>
                    {osEdit && <button onClick={() => removeField('fat', idx)} data-cursor="hover" style={removeFieldBtnStyle}>✕</button>}
                  </div>
                ))}
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: '#111' }}>Adicionar na descrição da nota e da plataforma :</div>
                  <textarea value={os.descNota || ''} data-field="descNota" onChange={set('descNota')} readOnly={readOnly} rows={1}
                    style={{ ...tBase, ...aff, fontSize: 13, textAlign: 'center', fontStyle: 'italic', padding: '2px 6px' }}/>
                </div>
                {osEdit && <button onClick={() => addField('fat')} data-cursor="hover" style={addFieldBtnStyle}>＋ Adicionar campo</button>}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ border: '2px solid #111', borderRadius: 18, padding: '12px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#111' }}>Descrição:</div>
              <textarea value={os.descricao || ''} data-field="descricao" onChange={set('descricao')} readOnly={readOnly} rows={2} placeholder="Descreva o serviço..."
                style={{ ...tBase, ...aff, fontSize: 13, textAlign: 'center', padding: '2px 6px', fontStyle: 'italic' }}/>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ border: '2px solid #111', borderRadius: 18, padding: '12px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#111' }}>Informações adicionais:</div>
              <textarea value={os.infoAdicionais || ''} data-field="infoAdicionais" onChange={set('infoAdicionais')} readOnly={readOnly} rows={1}
                style={{ ...tBase, ...aff, fontSize: 13, textAlign: 'center', padding: '2px 6px', fontStyle: 'italic' }}/>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 20, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 auto' }}>
              <textarea value={os.nota1 || ''} data-field="nota1" onChange={set('nota1')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 11.5, padding: '1px 5px' }}/>
              <textarea value={os.nota2 || ''} data-field="nota2" onChange={set('nota2')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 11.5, padding: '1px 5px' }}/>
              <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 700, color: '#111' }}>{os.anexoLabel}</div>
              <textarea value={os.pipefyLink || ''} data-field="pipefyLink" onChange={set('pipefyLink')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 12, fontWeight: 700, padding: '1px 5px', color: '#111' }}/>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 15 }}>⚠</span>
                <textarea value={os.pixNote || ''} data-field="pixNote" onChange={set('pixNote')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 11.5, padding: '1px 5px' }}/>
              </div>
            </div>
            <div style={{ flex: '0 0 250px', textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: '#111' }}>Valor total :</div>
              <div style={{ border: '2px solid #111', borderRadius: 16, padding: '10px 14px' }}>
                <textarea value={os.valorTotal || ''} data-field="valorTotal" onChange={set('valorTotal')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 29, fontWeight: 800, textAlign: 'center', padding: 2 }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: '#111' }}>Forma de pagamento :</span>
                <textarea value={os.formaPagamento || ''} data-field="formaPagamento" onChange={set('formaPagamento')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 13, fontWeight: 700, textAlign: 'right', width: 90, padding: '1px 5px' }}/>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

/* =========================== Produções — read-only shared view =========================== */
const RO_KEY = 'framety_ro_token';

const ProducoesShareApp = () => {
  const [token, setToken] = React.useState(() => sessionStorage.getItem(RO_KEY) || '');
  const [pass, setPass] = React.useState('');
  const [err, setErr] = React.useState('');
  const [shake, setShake] = React.useState(false);
  const [loading, setLoading] = React.useState(!!token);
  const [cad, setCad] = React.useState({ clientes: [], projetos: [], empreendimentos: [], categorias: [] });
  const [toasts, setToasts] = React.useState([]);

  // Minimal toast so ported components (OsDocumentView PDF errors) keep working.
  React.useEffect(() => {
    window.__adminToast = (msg) => {
      const id = Date.now() + Math.random();
      setToasts(t => [...t, { id, msg }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
    };
    return () => { delete window.__adminToast; };
  }, []);

  /* A tela não mostra mais uma lista, então isto não é o carregamento do
     conteúdo: é a checagem do token guardado na sessão. Se ele expirou, o
     visitante volta para a senha em vez de descobrir isso só ao buscar um
     #SKY. Pelo mesmo motivo não há mais assinatura de "live": nada aqui
     depende do estado do servidor até que se busque um job. */
  const load = React.useCallback((tk) => {
    setLoading(true);
    window.API.getLocucoesWith(tk).then(d => {
      setCad(d.cad || { clientes: [], projetos: [], empreendimentos: [], categorias: [] });
      setLoading(false);
    }).catch(() => {
      sessionStorage.removeItem(RO_KEY);
      setToken(''); setLoading(false);
    });
  }, []);

  React.useEffect(() => { if (token) load(token); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const result = await window.API.loginProducoesRO(pass);
      sessionStorage.setItem(RO_KEY, result.token);
      setToken(result.token);
      setErr('');
      load(result.token);
    } catch (ex) {
      setErr(ex?.error || 'Senha incorreta.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  if (!token) {
    return (
      <div className="admin-login">
        <div className="admin-login-bg"/>
        <div className="admin-login-grid"/>
        <form className="admin-login-card glass-strong glass" onSubmit={submit} style={shake ? { animation: 'shake 0.4s' } : null}>
          <div className="crest"><img src="/vector_framety.svg?v=1" alt="Framety" style={{height: 70, marginBottom: 30}}/></div>
          <h1>Produções.</h1>
          <p className="sub">Digite a senha de Produções para visualizar (somente leitura).</p>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={pass} onChange={(e)=>setPass(e.target.value)} autoFocus/>
            {err && <span style={{color:'var(--accent)',fontSize:11,fontFamily:'var(--font-mono)',letterSpacing:'0.1em',marginTop:4}}>{err}</span>}
          </div>
          <button type="submit" className="btn btn-accent" data-cursor="hover">Acessar <Icon name="arrow-right" size={14}/></button>
          <div className="admin-login-foot"><span><span className="blink"/>SOMENTE LEITURA</span><a href="/framety" data-cursor="hover">← ir ao site</a></div>
        </form>
        <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`}</style>
      </div>
    );
  }

  if (loading) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'0.2em',color:'var(--ink-dim)'}}><span className="blink"/> Carregando…</div>;
  }

  return (
    <div className="admin-shell page-enter" style={{ gridTemplateColumns: '1fr' }}>
      <main className="admin-main">
        <div className="admin-topbar" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/vector_framety.svg?v=1" alt="Framety" style={{ height: 30 }}/>
            <h2 style={{ margin: 0 }}>Produções <span className="count">SOMENTE LEITURA</span></h2>
          </div>
          <a className="btn btn-ghost" href="/framety" style={{ padding: '9px 16px', fontSize: 13, textDecoration: 'none' }} data-cursor="hover">
            <Icon name="video" size={14}/> Conhecer outros vídeos
          </a>
        </div>
        <LocucoesPanel
          cad={cad} setCad={setCad}
          readOnly={true}
          roToken={token}
        />
      </main>
      {toasts.length > 0 && (
        <div className="admin-toast-container">
          {toasts.map(t => <div key={t.id} className="admin-toast admin-toast-error"><span>{t.msg}</span></div>)}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { AdminLogin, AdminDashboard, ProducoesShareApp });
