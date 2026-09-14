/* O documento da OS e a exportação em PDF moram em os-doc.jsx — carregado
   antes deste arquivo no Framety.html e reaproveitado pelo app de desktop. */
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
  const [buscandoDuracoes, setBuscandoDuracoes] = React.useState(false);

  /* A duração era digitada à mão e quase todo vídeo mostrava o mesmo "03:00".
     Isto lê o número real na página de cada vídeo no YouTube e guarda no
     cadastro — vídeo novo já nasce com ele, isto aqui é para o que já existe. */
  const buscarDuracoes = async () => {
    setBuscandoDuracoes(true);
    try {
      const r = await window.API.buscarDuracoes(true);
      window.__adminToast?.(`Durações: ${r.preenchidos} de ${r.olhados} vídeos atualizados.`, "success");
      if (r.preenchidos) {
        const d = await window.API.getData();
        setVids(d.videos || []);
      }
    } catch (ex) {
      window.__adminToast?.("Erro ao buscar durações: " + (ex?.error || ex));
    } finally {
      setBuscandoDuracoes(false);
    }
  };
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
      links: "links",
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

  const [vids, setVids] = React.useState([]);
  const [cats, setCats] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [reelName, setReelName] = React.useState("");
  const [partners, setPartners] = React.useState([]);
  const [redirects, setRedirects] = React.useState([]);

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
      window.FRAMETY_APPLY_CONTENT?.(data.content);

      window.API.getPartners().then(setPartners).catch(() => {});
      window.API.getRedirects().then(setRedirects).catch(() => {});
      setLoading(false);

      // Views auto-update logic removed per user request
    });
  }, []);

  // Keep global in sync so other pages reflect changes
  React.useEffect(() => { if (window.FRAMETY_DATA) window.FRAMETY_DATA.videos = vids; }, [vids]);
  React.useEffect(() => { if (window.FRAMETY_DATA) window.FRAMETY_DATA.categories = cats; }, [cats]);
  React.useEffect(() => { if (window.FRAMETY_DATA) window.FRAMETY_DATA.clients = clients; }, [clients]);

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
        window.FRAMETY_APPLY_CONTENT?.(data.content);
      }).catch(() => {});
      window.API.getPartners().then(setPartners).catch(() => {});
    });
    const offRed = window.FRAMETY_LIVE.on('redirects', () => {
      window.API.getRedirects().then(setRedirects).catch(() => {});
    });
    return () => { offContent(); offRed(); };
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
    categorias: "Categorias", reel: "Home — capa e textos", ia: "Seção IA",
    seguranca: "Segurança", parceiros: "Parceiros", tutorial: "Tutorial",
    links: "Links",
  };

  if (loading) {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"var(--font-mono)",fontSize:12,letterSpacing:"0.2em",color:"var(--ink-dim)"}}>
        <span className="blink"/> Carregando…
      </div>
    );
  }

  return (
    <div className="admin-shell page-enter" data-screen-label="07 Admin">
      <aside className="admin-side">
        <div className="crest" style={{justifyContent: "center", marginBottom: 30}}>
          <img src="/vector_framety.svg?v=1" alt="Framety" style={{height: 48}}/>
        </div>
        <a className={"admin-nav-item " + (tab==="overview"?"active":"")} onClick={()=>setTab("overview")} data-cursor="hover"><span className="ico"><Icon name="stats" size={15}/></span> Visão geral</a>
        <a className={"admin-nav-item " + (tab==="videos"?"active":"")} onClick={()=>setTab("videos")} data-cursor="hover"><span className="ico"><Icon name="video" size={15}/></span> Vídeos</a>
        <a className={"admin-nav-item " + (tab==="clientes"?"active":"")} onClick={()=>setTab("clientes")} data-cursor="hover"><span className="ico"><Icon name="users" size={15}/></span> Clientes</a>
        <a className={"admin-nav-item " + (tab==="categorias"?"active":"")} onClick={()=>setTab("categorias")} data-cursor="hover"><span className="ico"><Icon name="folder" size={15}/></span> Categorias</a>
        <a className={"admin-nav-item " + (tab==="reel"?"active":"")} onClick={()=>setTab("reel")} data-cursor="hover"><span className="ico"><Icon name="play-line" size={15}/></span> Home</a>
        <a className={"admin-nav-item " + (tab==="ia"?"active":"")} onClick={()=>setTab("ia")} data-cursor="hover"><span className="ico"><Icon name="sparkles" size={15}/></span> Seção IA</a>
        <a className={"admin-nav-item " + (tab==="parceiros"?"active":"")} onClick={()=>setTab("parceiros")} data-cursor="hover">
          <span className="ico"><Icon name="users" size={15}/></span> Parceiros
          {partners.length > 0 && <span className="num" style={{marginLeft:"auto",fontSize:10,background:"var(--accent)",color:"#fff",borderRadius:20,padding:"1px 7px",fontFamily:"var(--font-mono)"}}>{partners.length}</span>}
        </a>
        <a className={"admin-nav-item " + (tab==="tutorial"?"active":"")} onClick={()=>setTab("tutorial")} data-cursor="hover"><span className="ico"><Icon name="help" size={15}/></span> Tutorial</a>
        <a className={"admin-nav-item " + (tab==="links"?"active":"")} onClick={()=>setTab("links")} data-cursor="hover"><span className="ico"><Icon name="share" size={15}/></span> Links</a>
        <a className={"admin-nav-item " + (tab==="novidades"?"active":"")} onClick={()=>setTab("novidades")} data-cursor="hover"><span className="ico"><Icon name="star" size={15}/></span> Novidades</a>
        <a className={"admin-nav-item " + (tab==="marca"?"active":"")} onClick={()=>setTab("marca")} data-cursor="hover"><span className="ico"><Icon name="eye" size={15}/></span> Marca &amp; prévia</a>
        <a className={"admin-nav-item " + (tab==="minigame"?"active":"")} onClick={()=>setTab("minigame")} data-cursor="hover"><span className="ico"><Icon name="play" size={15}/></span> Minigame</a>
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
            <Icon name="play-line" size={16}/><span>Home</span>
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
          <a className={tab==="links"?"active":""} onClick={tapMobile(()=>setTab("links"))}>
            <Icon name="share" size={16}/><span>Links</span>
          </a>
          <a className={tab==="novidades"?"active":""} onClick={tapMobile(()=>setTab("novidades"))}>
            <Icon name="star" size={16}/><span>Novidades</span>
          </a>
          <a className={tab==="marca"?"active":""} onClick={tapMobile(()=>setTab("marca"))}>
            <Icon name="eye" size={16}/><span>Marca</span>
          </a>
          <a className={tab==="minigame"?"active":""} onClick={tapMobile(()=>setTab("minigame"))}>
            <Icon name="play" size={16}/><span>Minigame</span>
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
              : tab==="reel" ? (reelName ? "REEL ATIVO" : "REEL VAZIO")
              : tab==="ia" ? "HOME"
              : tab==="seguranca" ? "ADMIN"
              : tab==="parceiros" ? `${partners.length} CADASTROS`
              : tab==="tutorial" ? "SUPORTE"
              : tab==="links" ? `${redirects.length} LINKS`
              : "DASHBOARD"}
            </span>
          </h2>
          <div className="admin-topbar-right">
            <button className="btn btn-ghost admin-pres-btn" style={{padding:"9px 16px",fontSize:13}} onClick={onOpenPresentation} data-cursor="hover">
              <Icon name="external" size={14}/> Apresentação
            </button>
            {tab === "videos" && (
              <button className="btn btn-ghost" style={{padding:"9px 16px",fontSize:13}}
                onClick={buscarDuracoes} disabled={buscandoDuracoes} data-cursor="hover"
                title="Lê a duração real de cada vídeo na página do YouTube e guarda no cadastro">
                <Icon name="loader" size={14}/> {buscandoDuracoes ? "Buscando…" : "Durações"}
              </button>
            )}
            {(tab === "videos" || tab === "overview") && (
              <button className="btn btn-accent" style={{padding:"9px 18px",fontSize:13}} onClick={()=>setShowAdd(true)} data-cursor="hover">
                <Icon name="plus" size={14}/> <span className="admin-add-label">Adicionar vídeo</span>
              </button>
            )}
          </div>
        </div>

        {tab === "overview" && <OverviewPanel vids={vids} cats={cats} clients={clients} setTab={setTab}/>}
        {tab === "videos" && <VideosPanel vids={vids} setVids={setVids} cats={cats} clients={clients} setClients={setClients}/>}
        {tab === "clientes" && <ClientsPanel clients={clients} setClients={setClients} vids={vids} setVids={setVids}/>}
        {tab === "categorias" && <><CategoriesPanel cats={cats} setCats={setCats}/><FormatosImersivosPanel/></>}
        {tab === "reel" && <><ReelPanel reelName={reelName} onUpload={handleReelUpload} onRemove={removeReel}/><AccentPanel/><HomeCopyPanel/><InstaPanel/></>}
        {tab === "ia" && <AIPanel/>}
        {tab === "seguranca" && <SecurityPanel/>}
        {tab === "parceiros" && <PartnersPanel partners={partners} setPartners={setPartners}/>}
        {tab === "tutorial" && <TutorialPanel/>}
        {tab === "links" && <LinksPanel redirects={redirects} setRedirects={setRedirects}/>}
        {tab === "novidades" && <NovidadesPanel/>}
        {tab === "marca" && <BrandingPanel/>}
        {tab === "minigame" && <MinigamePanel/>}
      </main>

      {/* Floating "Voltar para o site" — visible on all console pages */}
      <button className="admin-exit-fab" onClick={onExit} data-cursor="hover" title="Voltar ao site">
        <Icon name="arrow-right" size={14} style={{ transform: 'rotate(180deg)' }}/>
        <span>Voltar ao site</span>
      </button>

      {showAdd && (
        <VideoFormModal cats={cats} clients={clients} onNovoCliente={(c)=>setClients(cs=>[...cs,c])} onClose={()=>setShowAdd(false)}
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
const VideosPanel = ({ vids, setVids, cats, clients, setClients }) => {
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
          cats={cats} clients={clients} initialData={editVid} onNovoCliente={(c)=>setClients(cs=>[...cs,c])}
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
        {/* Fora do fluxo do texto: dentro dele a estrela empurrava o título
            para a direita, e só nas linhas em destaque — a coluna inteira
            parecia torta sem motivo. A calha está reservada em todas. */}
        {v.featured && <span className="admin-row-star"><Icon name="star" size={11} stroke={2}/></span>}
        {v.title}
        <span className="meta">{v.client}{v.empreendimento ? ` · ${v.empreendimento}` : ""}{v.formato ? ` · ${v.formato}` : ""}{v.padrao ? ` · padrão ${v.padrao.toLowerCase()}` : ""} · {v.duration} · {v.year}</span>
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
          {v.padrao && <><span className="sep">·</span><span>padrão {v.padrao.toLowerCase()}</span></>}
          {v.formato && <><span className="sep">·</span><span>{v.formato}</span></>}
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
/* Lista de formatos de vídeo imersivo (Semicircular, Tradicional, Trapézio…).
   Fica junto das categorias porque é a mesma ideia: recorte do acervo que o
   console define. */
const FormatosImersivosPanel = () => {
  const [formatos, setFormatos] = React.useState(() => [...(window.FRAMETY_DATA.formatosImersivos || [])]);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);

  const salvar = async (lista) => {
    setSalvando(true);
    try {
      const r = await window.API.salvarFormatosImersivos(lista);
      setFormatos(r.formatos);
      window.FRAMETY_DATA.formatosImersivos = r.formatos;
      setSalvo(true); setTimeout(() => setSalvo(false), 2200);
    } catch (ex) {
      window.__adminToast?.("Erro ao salvar: " + (ex?.error || ex));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="hc-panel">
      <h3>Formatos de vídeo imersivo</h3>
      <p className="hc-lead">
        Aparecem como filtro na categoria Imersivo, no cadastro do vídeo e no modo de apresentação.
        Tirar um da lista não apaga o formato dos vídeos que já o usam.
      </p>
      <div className="hc-field">
        {formatos.map((f, i) => (
          <div className="hc-row" key={i}>
            <input type="text" value={f} onChange={(e) => {
              const n = [...formatos]; n[i] = e.target.value; setFormatos(n);
            }} />
            <button className="hc-x" title="Remover" data-cursor="hover"
              onClick={() => salvar(formatos.filter((_, j) => j !== i))}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
        <button className="hc-add" onClick={() => setFormatos([...formatos, ""])} data-cursor="hover">
          <Icon name="plus" size={12} /> Adicionar formato
        </button>
      </div>
      <div className="hc-actions">
        <button className="btn btn-accent" onClick={() => salvar(formatos)} disabled={salvando} data-cursor="hover">
          {salvando ? "Salvando…" : "Salvar formatos"} <Icon name="arrow-right" size={14} />
        </button>
        {salvo && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#22e07c" }}>✓ salvo</span>}
      </div>
    </div>
  );
};

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

/* =========================== Cor de destaque =========================== */
/* Uma cor só governa o site inteiro: o styles.css escreve tudo como
   rgba(var(--accent-rgb), …), então publicar aqui troca botões, bordas, brilhos
   e o glow dos cards de uma vez (ver FRAMETY_APPLY_ACCENT no data.jsx).
   O console usa a mesma folha de estilo — por isso ele repinta enquanto você
   escolhe, e a prévia já é o resultado final. */
const ACCENT_PRESETS = [
  { hex: "#2E86C1", name: "Azul Skyline" },
  { hex: "#E63946", name: "Vermelho Framety" },
  { hex: "#FF6B35", name: "Laranja" },
  { hex: "#F5A524", name: "Âmbar" },
  { hex: "#22C55E", name: "Verde" },
  { hex: "#14B8A6", name: "Turquesa" },
  { hex: "#3B82F6", name: "Azul" },
  { hex: "#6366F1", name: "Índigo" },
  { hex: "#A855F7", name: "Roxo" },
  { hex: "#EC4899", name: "Rosa" },
];

const AccentPanel = () => {
  const inTheAir = () => (window.FRAMETY_DATA?.theme?.accent || window.FRAMETY_ACCENT_DEFAULT).toUpperCase();
  const [published, setPublished] = React.useState(inTheAir);
  const [color, setColor] = React.useState(inTheAir);
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState("");
  const dirty = color.toUpperCase() !== published;

  // A prévia mexe na página inteira: sair da aba sem publicar devolve a cor
  // que está no ar, senão o console fica mentindo até alguém recarregar.
  React.useEffect(() => () => { window.FRAMETY_APPLY_ACCENT?.(window.FRAMETY_DATA?.theme?.accent || ""); }, []);

  const preview = (hex) => {
    setColor(hex.toUpperCase());
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) window.FRAMETY_APPLY_ACCENT?.(hex);
  };

  const publish = async (value) => {
    const next = value === "" ? "" : color;
    setErr(""); setSaving(true);
    try {
      const r = await window.API.saveAccent(next);
      const applied = r.accent || window.FRAMETY_ACCENT_DEFAULT;
      if (window.FRAMETY_DATA) window.FRAMETY_DATA.theme = { accent: r.accent || "" };
      window.FRAMETY_APPLY_ACCENT?.(r.accent);
      setPublished(applied.toUpperCase());
      setColor(applied.toUpperCase());
      setDone(true);
      setTimeout(() => setDone(false), 2400);
    } catch (ex) {
      setErr(ex?.error || "Erro ao salvar a cor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hc-panel accent-panel">
      <h3>Cor de destaque</h3>
      <p className="hc-lead">
        Uma cor governa o site inteiro — botões, links, bordas em foco, o brilho dos cards e os detalhes deste console.
        Escolher já mostra o resultado na tela; só o que for publicado vale para quem abrir o site.
      </p>

      <div className="accent-swatches">
        {ACCENT_PRESETS.map(p => (
          <button key={p.hex} type="button" title={p.name}
            className={"accent-swatch" + (color.toUpperCase() === p.hex.toUpperCase() ? " active" : "")}
            style={{ background: p.hex }}
            onClick={() => preview(p.hex)} data-cursor="hover">
            <span className="sr-only">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="accent-row">
        <label className="accent-picker" data-cursor="hover">
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2E86C1"}
            onChange={(e) => preview(e.target.value)}/>
          <span style={{ background: color }}/>
          Escolher outra cor
        </label>
        <input className="accent-hex" type="text" value={color} maxLength={7} spellCheck={false}
          onChange={(e) => { const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value; preview(v); }}
          placeholder="#2E86C1"/>
        <span className="accent-state">
          {dirty ? "não publicada" : "no ar"}
        </span>
      </div>

      <div className="hc-actions">
        <button className="btn btn-accent" onClick={() => publish()} disabled={saving || !dirty || !/^#[0-9a-fA-F]{6}$/.test(color)} data-cursor="hover">
          {saving ? "Publicando…" : dirty ? "Publicar cor" : "Cor publicada"} <Icon name="arrow-right" size={14}/>
        </button>
        <button className="btn btn-ghost" onClick={() => publish("")} disabled={saving} data-cursor="hover">Voltar à cor padrão</button>
        {done && <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"#22e07c"}}>✓ publicado</span>}
        {err && <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--accent)"}}>{err}</span>}
      </div>
    </div>
  );
};

/* =========================== Textos da home =========================== */
/* A home é montada a partir de window.FRAMETY_CONTENT: o padrão mora no
   content.js e o que é salvo aqui entra por cima (POST /api/site-content,
   devolvido junto de /api/data). O spec abaixo lista os campos na mesma ordem
   em que aparecem na página, para achar o texto pelo lugar e não pelo nome. */
const HOME_COPY_SPEC = [
  {
    key: "nav", title: "Topo / menu", hint: "Barra fixa no alto da página",
    fields: [
      { key: "cta", label: "Botão do topo", type: "text" },
      { key: "links", label: "Itens do menu", type: "objlist", fixed: true, itemLabel: "Link",
        cols: [{ key: "label", label: "Texto" }, { key: "id", label: "Seção (âncora)" }],
        hint: "A âncora precisa bater com o id da seção na página: home, categorias, trabalhos, sobre, contato." },
    ],
  },
  {
    key: "hero", title: "Capa (demoreel)", hint: "Texto por cima do vídeo",
    fields: [
      { key: "titleHtml", label: "Título da capa", type: "html" },
      { key: "subtitleHtml", label: "Subtexto da capa", type: "html" },
      { key: "ctaButton", label: "Botão da capa (leva aos projetos)", type: "text" },
      { key: "ctaContato", label: "Botão da capa (leva ao contato)", type: "text" },
      { key: "badge", label: "Assinatura no rodapé da capa", type: "text",
        hint: "O ano corrente entra automaticamente depois deste texto." },
    ],
  },
  {
    key: "categories", title: "Categorias", hint: "Seção 02 — as pastas",
    fields: [
      { key: "eyebrow", label: "Etiqueta da seção", type: "text" },
      { key: "title", label: "Título", type: "text" },
      { key: "subtitle", label: "Segunda linha do título", type: "text" },
      { key: "hint", label: "Dica no computador", type: "text" },
      { key: "hintMobile", label: "Dica no celular", type: "text" },
      { key: "countLabel", label: "Palavra depois do número (plural)", type: "text" },
      { key: "countLabelOne", label: "Palavra depois do número (singular)", type: "text" },
      { key: "updatedPrefix", label: "Prefixo da data no canto da pasta", type: "text",
        hint: "A data da última publicação entra logo depois, no formato DD/MM." },
      { key: "emptyLabel", label: "Texto quando a categoria não tem vídeo", type: "text" },
      { key: "loadMore", label: "Botão carregar mais", type: "text" },
    ],
  },
  {
    key: "featured", title: "Projetos em destaque", hint: "Seção 03",
    fields: [
      { key: "eyebrow", label: "Etiqueta da seção", type: "text" },
      { key: "title", label: "Título", type: "text",
        hint: "Sem pontuação no fim, a página acrescenta \":\" na cor de destaque." },
    ],
  },
  {
    key: "clients", title: "Clientes & parceiros", hint: "Faixa de logos e página do cliente",
    fields: [
      { key: "eyebrow", label: "Etiqueta da seção", type: "text" },
      { key: "noProjects", label: "Aviso quando o cliente não tem vídeo publicado", type: "text" },
    ],
  },
  {
    key: "about", title: "Sobre a Framety", hint: "Seção 04",
    fields: [
      { key: "eyebrow", label: "Etiqueta da seção", type: "text" },
      { key: "quoteHtml", label: "Frase de destaque", type: "html" },
      { key: "stats", label: "Números", type: "objlist", itemLabel: "Número", addLabel: "Adicionar número",
        cols: [{ key: "num", label: "Número" }, { key: "label", label: "Legenda" }] },
      { key: "marquee", label: "Palavras da faixa rolante", type: "list", addLabel: "Adicionar palavra" },
    ],
  },
  {
    key: "process", title: "Processo", hint: "Como transformamos sua ideia",
    fields: [
      { key: "eyebrow", label: "Etiqueta da seção", type: "text" },
      { key: "title", label: "Título", type: "text" },
      { key: "subtitle", label: "Parágrafo de abertura", type: "area" },
      { key: "cards", label: "Cartões ao lado do texto", type: "objlist", itemLabel: "Cartão", addLabel: "Adicionar cartão",
        hint: "Empilhados à direita do texto de abertura; o visitante passa o mouse para ler cada um.",
        cols: [
          { key: "title", label: "Afirmação" },
          { key: "sub", label: "Linha de apoio", type: "area" },
        ] },
      { key: "steps", label: "Etapas", type: "objlist", itemLabel: "Etapa", addLabel: "Adicionar etapa",
        cols: [
          { key: "name", label: "Nome da etapa" },
          { key: "desc", label: "Descrição (opcional)", type: "area" },
          { key: "tags", label: "Tags (opcional)", type: "tags" },
          { key: "arrow", label: "Seta para a próxima etapa", type: "select",
            options: [{ value: "", label: "Sem seta" }, { value: "right", label: "Curva para a direita" }, { value: "left", label: "Curva para a esquerda" }] },
        ] },
    ],
  },
  {
    key: "contact", title: "Contato", hint: "Seção 05",
    fields: [
      { key: "eyebrow", label: "Etiqueta da seção", type: "text" },
      { key: "titleHtml", label: "Título", type: "html" },
      { key: "rows", label: "Linhas de contato", type: "objlist", itemLabel: "Linha", addLabel: "Adicionar linha",
        cols: [{ key: "label", label: "Rótulo" }, { key: "value", label: "Valor" }] },
      { key: "ctaLabel", label: "Botão do quadro de contato", type: "text",
        hint: "Deixe em branco para não mostrar o botão." },
      { key: "ctaHref", label: "Link do botão", type: "text",
        hint: "Precisa começar com https://, mailto: ou tel: — qualquer outra coisa é ignorada." },
    ],
  },
  {
    key: "footer", title: "Rodapé", hint: "Última faixa da página",
    fields: [
      { key: "phones", label: "Telefones", type: "list", addLabel: "Adicionar telefone" },
      { key: "email", label: "E-mail", type: "text" },
      { key: "cities", label: "Cidades", type: "list", addLabel: "Adicionar cidade" },
      { key: "copyrightHtml", label: "Direitos autorais", type: "html" },
    ],
  },
  {
    key: "video", title: "Player de vídeo", hint: "Botão dentro do player aberto",
    fields: [
      { key: "ctaButton", label: "Botão do player", type: "text" },
    ],
  },
];

const HomeCopyPanel = () => {
  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  const defaults = window.FRAMETY_CONTENT_DEFAULTS || {};
  const [data, setData] = React.useState(() => clone(window.FRAMETY_CONTENT));
  const [openKey, setOpenKey] = React.useState("hero");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [err, setErr] = React.useState("");

  const put = (sec, key, value) => {
    setDirty(true);
    setData((d) => ({ ...d, [sec]: { ...(d[sec] || {}), [key]: value } }));
  };

  const save = async () => {
    setErr(""); setSaving(true);
    try {
      await window.API.saveSiteContent(data);
      window.FRAMETY_APPLY_CONTENT?.(data);
      setDirty(false); setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (ex) {
      setErr(ex?.error || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const restore = () => {
    window.__adminConfirm?.("Restaurar todos os textos da home para o padrão? As edições salvas serão perdidas.", async () => {
      try {
        await window.API.resetSiteContent();
        const fresh = window.FRAMETY_APPLY_CONTENT?.(null) || clone(defaults);
        setData(clone(fresh));
        setDirty(false);
        window.__adminToast?.("Textos da home restaurados.", "success");
      } catch (ex) {
        setErr(ex?.error || "Erro ao restaurar.");
      }
    });
  };

  const renderCol = (items, i, c, onSet) => {
    const v = items[i][c.key];
    if (c.type === "area") return <textarea rows={3} value={v || ""} onChange={(e) => onSet(i, c.key, e.target.value)}/>;
    if (c.type === "tags") return (
      <input type="text" placeholder="separe por vírgula"
        value={Array.isArray(v) ? v.join(", ") : (v || "")}
        onChange={(e) => { const parts = e.target.value.split(",").map(s => s.trim()).filter(Boolean); onSet(i, c.key, parts.length ? parts : null); }}/>
    );
    if (c.type === "select") return (
      <select value={v || ""} onChange={(e) => onSet(i, c.key, e.target.value || null)}>
        {c.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
    return <input type="text" value={v || ""} onChange={(e) => onSet(i, c.key, e.target.value)}/>;
  };

  const renderField = (sec, f) => {
    const val = (data[sec] || {})[f.key];
    const def = (defaults[sec] || {})[f.key];

    if (f.type === "list") {
      const items = Array.isArray(val) ? val : [];
      return (
        <div className="hc-field" key={f.key}>
          <label>{f.label}</label>
          {items.map((it, i) => (
            <div className="hc-row" key={i}>
              <input type="text" value={it || ""} onChange={(e) => { const n = [...items]; n[i] = e.target.value; put(sec, f.key, n); }}/>
              <button className="hc-x" title="Remover" onClick={() => put(sec, f.key, items.filter((_, j) => j !== i))} data-cursor="hover"><Icon name="trash" size={13}/></button>
            </div>
          ))}
          <button className="hc-add" onClick={() => put(sec, f.key, [...items, ""])} data-cursor="hover"><Icon name="plus" size={12}/> {f.addLabel || "Adicionar item"}</button>
          {f.hint && <div className="hc-hint">{f.hint}</div>}
        </div>
      );
    }

    if (f.type === "objlist") {
      const items = Array.isArray(val) ? val : [];
      const setItem = (i, k, v) => put(sec, f.key, items.map((it, j) => j === i ? { ...it, [k]: v } : it));
      const blank = f.cols.reduce((o, c) => ({ ...o, [c.key]: c.type === "tags" ? null : "" }), {});
      return (
        <div className="hc-field" key={f.key}>
          <label>{f.label}</label>
          {items.map((it, i) => (
            <div className="hc-card" key={i}>
              <div className="hc-card-head">
                <span>{f.itemLabel || "Item"} {String(i + 1).padStart(2, "0")}</span>
                {!f.fixed && <button className="hc-x" title="Remover" onClick={() => put(sec, f.key, items.filter((_, j) => j !== i))} data-cursor="hover"><Icon name="trash" size={13}/></button>}
              </div>
              {f.cols.map(c => (
                <div className="hc-sub" key={c.key}>
                  <label>{c.label}</label>
                  {renderCol(items, i, c, setItem)}
                </div>
              ))}
            </div>
          ))}
          {!f.fixed && (
            <button className="hc-add" onClick={() => put(sec, f.key, [...items, { ...blank }])} data-cursor="hover"><Icon name="plus" size={12}/> {f.addLabel || "Adicionar"}</button>
          )}
          {f.hint && <div className="hc-hint">{f.hint}</div>}
        </div>
      );
    }

    const isHtml = f.type === "html";
    return (
      <div className="hc-field" key={f.key}>
        <label>{f.label}</label>
        {(isHtml || f.type === "area") ? (
          <textarea rows={3} value={val || ""} placeholder={def || ""}
            style={isHtml ? { fontFamily: "var(--font-mono)", fontSize: 12 } : null}
            onChange={(e) => put(sec, f.key, e.target.value)}/>
        ) : (
          <input type="text" value={val || ""} placeholder={def || ""} onChange={(e) => put(sec, f.key, e.target.value)}/>
        )}
        {isHtml && <div className="hc-hint">Aceita &lt;em&gt; (itálico), &lt;br/&gt; (quebra de linha) e &lt;span class="strike"&gt; (tachado).</div>}
        {!isHtml && f.hint && <div className="hc-hint">{f.hint}</div>}
      </div>
    );
  };

  return (
    <div className="hc-panel">
      <h3>Textos da home</h3>
      <p className="hc-lead">
        Todo texto escrito na página inicial está aqui, na ordem em que aparece — do menu ao rodapé.
        Publicar já vale para quem abrir o site, sem precisar de deploy. Campo apagado volta ao texto padrão.
      </p>

      {HOME_COPY_SPEC.map(sec => {
        const isOpen = openKey === sec.key;
        return (
          <div className={"hc-sec" + (isOpen ? " open" : "")} key={sec.key}>
            <button className="hc-sec-head" onClick={() => setOpenKey(isOpen ? null : sec.key)} data-cursor="hover">
              <span className="hc-sec-title">{sec.title}</span>
              <span className="hc-sec-hint">{sec.hint}</span>
              <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={14}/>
            </button>
            {isOpen && <div className="hc-sec-body">{sec.fields.map(f => renderField(sec.key, f))}</div>}
          </div>
        );
      })}

      <div className="hc-actions">
        <button className="btn btn-accent" onClick={save} disabled={saving || !dirty} data-cursor="hover">
          {saving ? "Publicando…" : dirty ? "Publicar textos" : "Tudo publicado"} <Icon name="arrow-right" size={14}/>
        </button>
        <a href="/framety" target="_blank" className="btn btn-ghost" data-cursor="hover"><Icon name="external" size={14}/> Ver a home</a>
        <button className="btn btn-ghost" onClick={restore} data-cursor="hover">Restaurar padrão</button>
        {saved && <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"#22e07c"}}>✓ publicado</span>}
        {err && <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--accent)"}}>{err}</span>}
      </div>
    </div>
  );
};

/* =========================== Instagram =========================== */
/* O celular que sobe no canto esquerdo quando o visitante chega ao fim da home.
   As fotos são escolhidas aqui: não há API do Instagram no meio, que traria
   token expirando e um mural quebrando sozinho. */
const InstaPanel = () => {
  const [dados, setDados] = React.useState(null);
  const [enviando, setEnviando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);
  const [erro, setErro] = React.useState("");

  React.useEffect(() => {
    window.API.getInstagram()
      .then((d) => setDados({ ativo: true, perfil: "", usuario: "", chamada: "", print: "", fotos: [], ...d }))
      .catch(() => setDados({ ativo: true, perfil: "", usuario: "", chamada: "", print: "", fotos: [] }));
  }, []);

  const mexer = (fn) => setDados((d) => { const c = JSON.parse(JSON.stringify(d)); fn(c); return c; });

  const enviar = async (files) => {
    if (!files || !files.length) return;
    setEnviando(true);
    try {
      for (const f of [...files].slice(0, 9)) {
        if (f.size > 8 * 1024 * 1024) { window.__adminToast?.(`"${f.name}" passa de 8MB e ficou de fora.`, "warn"); continue; }
        const { url } = await window.API.uploadThumb(f);
        mexer((d) => { if (d.fotos.length < 9) d.fotos.push(url); });
      }
    } catch (ex) {
      window.__adminToast?.("Erro ao enviar: " + (ex?.error || ex));
    } finally {
      setEnviando(false);
    }
  };

  const salvar = async () => {
    setErro(""); setSalvando(true);
    try {
      const r = await window.API.saveInstagram(dados);
      if (r && r.instagram) setDados(r.instagram);
      window.FRAMETY_INSTAGRAM = r && r.instagram ? r.instagram : dados;
      setSalvo(true); setTimeout(() => setSalvo(false), 2400);
    } catch (ex) {
      setErro(ex?.error || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  if (!dados) return <div style={{ padding: 32, color: "var(--ink-dim)" }}>Carregando…</div>;

  const linkOk = /^https?:\/\//i.test((dados.perfil || "").trim());

  return (
    <div className="hc-panel">
      <h3>Instagram no fim da página</h3>
      <p className="hc-lead">
        Um celular sobe no canto esquerdo quando o visitante chega ao pé da home, mostrando estas fotos.
        Clicar leva ao perfil. Em telas de até 900px ele não aparece — num celular de verdade, um celular
        desenhado só atrapalha, e o rodapé já leva ao perfil.
      </p>

      <label className="nov-switch">
        <input type="checkbox" checked={dados.ativo !== false}
          onChange={(e) => mexer((d) => { d.ativo = e.target.checked; })} />
        <span>Mostrar o celular</span>
      </label>

      <div className="hc-sec open" style={{ marginTop: 16 }}>
        <div className="hc-sec-body">
          <div className="hc-field">
            <label>Endereço do perfil</label>
            <input type="text" value={dados.perfil} placeholder="https://www.instagram.com/seuperfil/"
              onChange={(e) => mexer((d) => { d.perfil = e.target.value; })} />
            <div className="hc-hint">
              Precisa começar com https:// — sem isso o celular não aparece, para não virar um link quebrado na tela.
              {dados.perfil && !linkOk && <strong style={{ color: "var(--accent)" }}> Falta o https:// aqui.</strong>}
            </div>
          </div>
          <div className="hc-field">
            <label>Usuário</label>
            <input type="text" value={dados.usuario} placeholder="@framety"
              onChange={(e) => mexer((d) => { d.usuario = e.target.value; })} />
          </div>
          <div className="hc-field">
            <label>Chamada</label>
            <input type="text" value={dados.chamada} placeholder="Acompanhe os bastidores"
              onChange={(e) => mexer((d) => { d.chamada = e.target.value; })} />
          </div>
        </div>
      </div>

      <div className="hc-field" style={{ marginTop: 18 }}>
        <label>Print da tela do perfil</label>
        <div className="nov-img-linha">
          {dados.print
            ? <img src={dados.print} alt="" className="insta-admin-print" />
            : <div className="nov-img-previa nov-img-previa--vazia">sem print</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="hc-add" data-cursor="hover" style={{ cursor: "pointer" }}>
              <Icon name="plus" size={12} /> {dados.print ? "Trocar print" : "Enviar print"}
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  try { const { url } = await window.API.uploadThumb(f); mexer((d) => { d.print = url; }); }
                  catch (ex) { window.__adminToast?.("Erro ao enviar: " + (ex?.error || ex)); }
                }} />
            </label>
            {dados.print && (
              <button className="hc-add" onClick={() => mexer((d) => { d.print = ""; })} data-cursor="hover">
                <Icon name="trash" size={12} /> Remover
              </button>
            )}
          </div>
        </div>
        <div className="hc-hint">
          Uma foto da tela do perfil, em formato de celular (ex.: 440×940). É ela que aparece no aparelho.
          Sem print, o celular monta a grade com as fotos abaixo.
        </div>
      </div>

      <div className="hc-field" style={{ marginTop: 18 }}>
        <label>Fotos do feed ({dados.fotos.length}/9) — usadas quando não há print</label>
        <div className="insta-admin-grade">
          {dados.fotos.map((f, i) => (
            <div className="insta-admin-celula" key={i}>
              <img src={f} alt="" />
              <button className="hc-x" title="Remover" data-cursor="hover"
                onClick={() => mexer((d) => { d.fotos.splice(i, 1); })}>
                <Icon name="trash" size={12} />
              </button>
              <span className="insta-admin-mover">
                <button title="Antes" data-cursor="hover" onClick={() => mexer((d) => {
                  if (i > 0) { const [x] = d.fotos.splice(i, 1); d.fotos.splice(i - 1, 0, x); }
                })}>‹</button>
                <button title="Depois" data-cursor="hover" onClick={() => mexer((d) => {
                  if (i < d.fotos.length - 1) { const [x] = d.fotos.splice(i, 1); d.fotos.splice(i + 1, 0, x); }
                })}>›</button>
              </span>
            </div>
          ))}
          {dados.fotos.length < 9 && (
            <label className="insta-admin-celula insta-admin-add" data-cursor="hover">
              <Icon name="plus" size={16} />
              <span>{enviando ? "Enviando…" : "Adicionar"}</span>
              <input type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => enviar(e.target.files)} />
            </label>
          )}
        </div>
        <div className="hc-hint">
          A primeira foto também vira o retrato do perfil, no alto do celular. A ordem aqui é a ordem na tela.
        </div>
      </div>

      <div className="hc-actions">
        <button className="btn btn-accent" onClick={salvar} disabled={salvando} data-cursor="hover">
          {salvando ? "Publicando…" : "Publicar"} <Icon name="arrow-right" size={14} />
        </button>
        {linkOk && (
          <a href={dados.perfil} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" data-cursor="hover">
            <Icon name="external" size={14} /> Abrir o perfil
          </a>
        )}
        {salvo && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#22e07c" }}>✓ publicado</span>}
        {erro && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>{erro}</span>}
      </div>
    </div>
  );
};

/* =========================== Minigame =========================== */
/* Página escondida em /play, que também abre digitando "play" no site. Aqui só
   duas alavancas: a imagem que vira a barrinha do jogador e o botão de zerar o
   placar. */
const MinigamePanel = () => {
  const [carroUrl, setCarroUrl] = React.useState("");
  const [placar, setPlacar] = React.useState([]);
  const [enviando, setEnviando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);

  const carregar = () => window.API.getPlacar()
    .then((d) => { setCarroUrl(d.carroUrl || ""); setPlacar(d.placar || []); })
    .catch(() => {});

  React.useEffect(() => { carregar(); }, []);

  const gravar = async (url, limparPlacar) => {
    setSalvando(true);
    try {
      const r = await window.API.salvarMinigame({ carroUrl: url, limparPlacar: !!limparPlacar });
      setCarroUrl(r.minigame.carroUrl);
      setPlacar(r.placar || []);
      setSalvo(true); setTimeout(() => setSalvo(false), 2400);
    } catch (ex) {
      window.__adminToast?.("Erro ao salvar: " + (ex?.error || ex));
    } finally {
      setSalvando(false);
    }
  };

  const enviarCarro = async (file) => {
    if (!file) return;
    setEnviando(true);
    try {
      const { url } = await window.API.uploadThumb(file);
      await gravar(url, false);
    } catch (ex) {
      window.__adminToast?.("Erro ao enviar: " + (ex?.error || ex));
    } finally {
      setEnviando(false);
    }
  };

  const zerar = () => {
    window.__adminConfirm?.("Apagar todas as pontuações do placar?", () => gravar(carroUrl, true));
  };

  const lideres = [...placar].sort((a, b) => b.pontos - a.pontos);

  return (
    <div className="hc-panel" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
      <h3>Carro do jogador</h3>
      <p className="hc-lead">
        A imagem que vira a barrinha lá embaixo. Pode enviar o PNG com fundo branco:
        o jogo recorta o branco sozinho ao carregar. Carro de perfil, olhando para a esquerda, funciona melhor.
      </p>
      <div className="hc-sec open">
        <div className="hc-sec-body">
          <div className="hc-field">
            <div className="nov-img-linha">
              {carroUrl
                ? <img src={carroUrl} alt="" className="nov-img-previa" style={{ background: "#0b0d12" }} />
                : <div className="nov-img-previa nov-img-previa--vazia">sem imagem</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label className="hc-add" data-cursor="hover" style={{ cursor: "pointer" }}>
                  <Icon name="plus" size={12} /> {enviando ? "Enviando…" : (carroUrl ? "Trocar carro" : "Enviar carro")}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => enviarCarro(e.target.files[0])} />
                </label>
                {carroUrl && (
                  <button className="hc-add" onClick={() => gravar("", false)} data-cursor="hover">
                    <Icon name="trash" size={12} /> Remover
                  </button>
                )}
              </div>
            </div>
            <div className="hc-hint">Sem imagem, o jogo desenha uma barra na cor de destaque e continua jogável.</div>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 40 }}>Placar</h3>
      <p className="hc-lead">
        Os 20 últimos jogos, do maior para o menor. Quando o 21º entra, o mais antigo sai.
      </p>

      {lideres.length === 0
        ? <div className="hc-hint">Ninguém jogou ainda.</div>
        : (
          <div className="hc-sec open">
            <div className="hc-sec-body">
              <ol className="mg-placar">
                {lideres.map((l, i) => (
                  <li key={l.quando + "-" + i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span>{l.nome}</span>
                    <span>{l.pontos}</span>
                    <span>{new Date(l.quando).toLocaleDateString("pt-BR")}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

      <div className="hc-actions">
        <a href="/play" target="_blank" className="btn btn-accent" data-cursor="hover">
          <Icon name="play-line" size={14} /> Abrir o jogo
        </a>
        <button className="btn btn-ghost" onClick={zerar} disabled={salvando || placar.length === 0} data-cursor="hover">
          Zerar placar
        </button>
        {salvo && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#22e07c" }}>✓ salvo</span>}
      </div>
    </div>
  );
};

/* =========================== Marca e prévia de link =========================== */
/* Duas coisas que só existem fora da página: o ícone da aba e o cartão que o
   WhatsApp (e Telegram, e Facebook) monta quando alguém cola o link. Esse cartão
   é lido do HTML pelo robô da rede, que não roda JavaScript — por isso quem
   monta é o servidor, e não o site. */
const MARCA_PAGINAS = [
  { rota: "/framety",         nome: "Home",                 hint: "o link do site" },
  { rota: "/novidades",       nome: "Novidades",            hint: "o mini blog" },
  { rota: "/tutorial",        nome: "Tutorial",             hint: "página de ajuda ao cliente" },
  { rota: "/cadastroparceiro", nome: "Cadastro de parceiro", hint: "formulário de parceiros" },
  { rota: "/screendimension", nome: "Configurador de sala",  hint: "dimensionamento de projeção" },
];

const MARCA_VAZIA = { favicon: "", ogTitulo: "", ogDescricao: "", ogImagem: "", paginas: {} };

const BrandingPanel = () => {
  const [dados, setDados] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const [enviando, setEnviando] = React.useState(null);

  React.useEffect(() => {
    window.API.getBranding()
      .then((d) => setDados({ ...MARCA_VAZIA, ...d, paginas: { ...(d.paginas || {}) } }))
      .catch(() => setDados(MARCA_VAZIA));
  }, []);

  const mexer = (fn) => setDados((d) => { const c = JSON.parse(JSON.stringify(d)); fn(c); return c; });

  const enviar = async (file, aplicar, chave) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      window.__adminToast?.("Imagem de mais de 8MB. Use uma menor — a prévia é um cartãozinho.", "warn");
      return;
    }
    setEnviando(chave);
    try {
      const { url } = await window.API.uploadThumb(file);
      mexer(aplicar(url));
    } catch (ex) {
      window.__adminToast?.("Erro ao enviar: " + (ex?.error || ex));
    } finally {
      setEnviando(null);
    }
  };

  const salvar = async () => {
    setErro(""); setSalvando(true);
    try {
      await window.API.saveBranding(dados);
      setSalvo(true); setTimeout(() => setSalvo(false), 2400);
    } catch (ex) {
      setErro(ex?.error || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  if (!dados) return <div style={{ padding: 32, color: "var(--ink-dim)" }}>Carregando…</div>;

  const campoImagem = (url, aplicar, chave, formato) => (
    <div className="nov-img-linha">
      {url
        ? <img src={url} alt="" className={"nov-img-previa" + (formato === "quadrado" ? " marca-previa-ico" : "")} />
        : <div className={"nov-img-previa nov-img-previa--vazia" + (formato === "quadrado" ? " marca-previa-ico" : "")}>sem imagem</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="hc-add" data-cursor="hover" style={{ cursor: "pointer" }}>
          <Icon name="plus" size={12} /> {enviando === chave ? "Enviando…" : (url ? "Trocar" : "Enviar imagem")}
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => enviar(e.target.files[0], aplicar, chave)} />
        </label>
        {url && (
          <button className="hc-add" onClick={() => mexer(aplicar(""))} data-cursor="hover">
            <Icon name="trash" size={12} /> Remover
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="hc-panel" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
      <h3>Ícone da aba</h3>
      <p className="hc-lead">
        O quadradinho que aparece na aba do navegador e nos favoritos. Quadrado, de preferência 512×512.
        Trocar o ícone pode demorar a aparecer para quem já visitou o site — o navegador guarda o antigo por um tempo.
      </p>
      <div className="hc-sec open">
        <div className="hc-sec-body">
          <div className="hc-field">
            {campoImagem(dados.favicon, (url) => (d) => { d.favicon = url; }, "favicon", "quadrado")}
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 40 }}>Prévia ao colar o link</h3>
      <p className="hc-lead">
        O cartão que WhatsApp, Telegram e Facebook montam a partir do link. Use uma imagem larga — o recorte é 1200×630;
        o que ficar de fora é cortado nas laterais. Isto aqui vale para o site inteiro; abaixo dá para trocar por página.
      </p>
      <div className="hc-hint" style={{ marginBottom: 14 }}>
        Essas redes guardam a prévia por dias. Depois de publicar, um link já compartilhado
        continua mostrando o cartão antigo até o cache delas expirar.
      </div>
      <div className="hc-sec open">
        <div className="hc-sec-body">
          <div className="hc-field">
            <label>Título</label>
            <input type="text" value={dados.ogTitulo} placeholder="Framety"
              onChange={(e) => mexer((d) => { d.ogTitulo = e.target.value; })} />
          </div>
          <div className="hc-field">
            <label>Descrição</label>
            <textarea rows={2} value={dados.ogDescricao}
              placeholder="Cinema© para marcas que pensam em movimento. Uma empresa do Grupo Skyline."
              onChange={(e) => mexer((d) => { d.ogDescricao = e.target.value; })} />
          </div>
          <div className="hc-field">
            <label>Imagem</label>
            {campoImagem(dados.ogImagem, (url) => (d) => { d.ogImagem = url; }, "og")}
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 40 }}>Por página</h3>
      <p className="hc-lead">
        Cada endereço do site pode ter a sua prévia. Campo em branco herda o padrão acima.
      </p>
      <div className="hc-hint" style={{ marginBottom: 14 }}>
        As páginas de <strong>categoria</strong> e de <strong>vídeo</strong> não estão na lista porque já se viram
        sozinhas: usam a capa da categoria e a thumb do vídeo. E seções da home (destaques, sobre, contato)
        não aparecem aqui porque não têm endereço próprio — colar o link da home mostra a prévia da home.
      </div>

      {MARCA_PAGINAS.map((pg) => {
        const v = dados.paginas[pg.rota] || {};
        const por = (campo) => (e) => mexer((d) => {
          d.paginas[pg.rota] = { ...(d.paginas[pg.rota] || {}), [campo]: e.target.value };
        });
        return (
          <div className="hc-card" key={pg.rota} style={{ marginBottom: 14 }}>
            <div className="hc-card-head">
              <span>{pg.nome} · {pg.rota}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mute)" }}>{pg.hint}</span>
            </div>
            <div className="hc-sub">
              <label>Título</label>
              <input type="text" value={v.titulo || ""} placeholder={dados.ogTitulo || "Framety"} onChange={por("titulo")} />
            </div>
            <div className="hc-sub">
              <label>Descrição</label>
              <textarea rows={2} value={v.descricao || ""} placeholder={dados.ogDescricao || "(usa a descrição padrão)"} onChange={por("descricao")} />
            </div>
            <div className="hc-sub">
              <label>Imagem</label>
              {campoImagem(v.imagem || "", (url) => (d) => {
                d.paginas[pg.rota] = { ...(d.paginas[pg.rota] || {}), imagem: url };
              }, "pg" + pg.rota)}
            </div>
          </div>
        );
      })}

      <div className="hc-actions">
        <button className="btn btn-accent" onClick={salvar} disabled={salvando} data-cursor="hover">
          {salvando ? "Publicando…" : "Publicar"} <Icon name="arrow-right" size={14} />
        </button>
        <a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener noreferrer"
           className="btn btn-ghost" data-cursor="hover">
          <Icon name="external" size={14} /> Forçar atualização da prévia
        </a>
        {salvo && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#22e07c" }}>✓ publicado</span>}
        {erro && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>{erro}</span>}
      </div>
    </div>
  );
};

/* =========================== Novidades =========================== */
/* Edita as duas pontas do mesmo conteúdo: o cartão que aparece na home e a
   página /novidades, montada por blocos (texto, imagem, vídeo). A ordem dos
   blocos é a ordem da página. */
const NOV_VAZIA = {
  ativo: true,
  card: { etiqueta: "Novidades", titulo: "", texto: "", botao: "Saiba mais", imagem: "" },
  pagina: { titulo: "Novidades", resumo: "", blocos: [] },
};

const NovidadesPanel = () => {
  const [dados, setDados] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const [enviando, setEnviando] = React.useState(null);   // id do bloco em upload
  const capaRef = React.useRef(null);

  React.useEffect(() => {
    window.API.getNovidades()
      .then((d) => setDados({ ...NOV_VAZIA, ...d, card: { ...NOV_VAZIA.card, ...(d.card || {}) }, pagina: { ...NOV_VAZIA.pagina, ...(d.pagina || {}) } }))
      .catch(() => setDados(NOV_VAZIA));
  }, []);

  const mexer = (fn) => setDados((d) => { const c = JSON.parse(JSON.stringify(d)); fn(c); return c; });

  const salvar = async () => {
    setErro(""); setSalvando(true);
    try {
      const r = await window.API.saveNovidades(dados);
      if (r && r.novidades) setDados(r.novidades);
      window.FRAMETY_NOVIDADES = r && r.novidades ? r.novidades : dados;
      setSalvo(true); setTimeout(() => setSalvo(false), 2400);
    } catch (ex) {
      setErro(ex?.error || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  /* O upload já aceita foto, gif e vídeo pelo servidor; o teto aqui é de
     bom senso — 20MB num cartão que abre por cima da home é muito. Quem
     precisar de um filme inteiro usa um bloco de vídeo do YouTube. */
  const NOV_TETO_MB = 20;

  const enviarImagem = async (file, aplicar, chave) => {
    if (!file) return;
    if (file.size > NOV_TETO_MB * 1024 * 1024) {
      window.__adminToast?.(
        `Arquivo de ${(file.size / 1048576).toFixed(1)}MB — o limite aqui é ${NOV_TETO_MB}MB. Use um trecho mais curto ou comprima o vídeo.`,
        "warn"
      );
      return;
    }
    setEnviando(chave);
    try {
      const { url } = await window.API.uploadThumb(file);
      mexer(aplicar(url));
    } catch (ex) {
      window.__adminToast?.("Erro ao enviar a imagem: " + (ex?.error || ex));
    } finally {
      setEnviando(null);
    }
  };

  const novoBloco = (tipo) => mexer((d) => {
    d.pagina.blocos.push({
      id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      tipo, titulo: "", textoHtml: "", imagem: "", youtube: "", legenda: "",
    });
  });

  const mover = (i, passo) => mexer((d) => {
    const alvo = i + passo;
    if (alvo < 0 || alvo >= d.pagina.blocos.length) return;
    const [b] = d.pagina.blocos.splice(i, 1);
    d.pagina.blocos.splice(alvo, 0, b);
  });

  if (!dados) return <div style={{ padding: 32, color: "var(--ink-dim)" }}>Carregando…</div>;

  const c = dados.card, p = dados.pagina;

  return (
    <div className="hc-panel" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
      <h3>Cartão na home</h3>
      <p className="hc-lead">
        Aparece no canto superior direito depois que o visitante passa pelos números da Framety, e leva para a página de novidades.
        Fechar guarda na sessão de quem visita — volta na visita seguinte.
      </p>

      <label className="nov-switch">
        <input type="checkbox" checked={dados.ativo !== false} onChange={(e) => mexer((d) => { d.ativo = e.target.checked; })} />
        <span>Mostrar o cartão no site</span>
      </label>

      <div className="hc-sec open" style={{ marginTop: 16 }}>
        <div className="hc-sec-body">
          <div className="hc-field">
            <label>Etiqueta</label>
            <input type="text" value={c.etiqueta || ""} onChange={(e) => mexer((d) => { d.card.etiqueta = e.target.value; })} placeholder="Novidades"/>
          </div>
          <div className="hc-field">
            <label>Título</label>
            <input type="text" value={c.titulo || ""} onChange={(e) => mexer((d) => { d.card.titulo = e.target.value; })}/>
          </div>
          <div className="hc-field">
            <label>Texto</label>
            <textarea rows={2} value={c.texto || ""} onChange={(e) => mexer((d) => { d.card.texto = e.target.value; })}/>
          </div>
          <div className="hc-field">
            <label>Botão</label>
            <input type="text" value={c.botao || ""} onChange={(e) => mexer((d) => { d.card.botao = e.target.value; })} placeholder="Saiba mais"/>
          </div>
          <div className="hc-field">
            <label>Imagem, gif ou vídeo do cartão</label>
            <div className="nov-img-linha">
              {!c.imagem
                ? <div className="nov-img-previa nov-img-previa--vazia">sem mídia</div>
                : EH_VIDEO_URL(c.imagem)
                  ? <video src={c.imagem} className="nov-img-previa" muted loop autoPlay playsInline/>
                  : <img src={c.imagem} alt="" className="nov-img-previa"/>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input ref={capaRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" style={{ display: "none" }}
                  onChange={(e) => enviarImagem(e.target.files[0], (url) => (d) => { d.card.imagem = url; }, "capa")}/>
                <button className="hc-add" onClick={() => capaRef.current.click()} data-cursor="hover">
                  <Icon name="plus" size={12}/> {enviando === "capa" ? "Enviando…" : (c.imagem ? "Trocar arquivo" : "Enviar arquivo")}
                </button>
                {c.imagem && (
                  <button className="hc-add" onClick={() => mexer((d) => { d.card.imagem = ""; })} data-cursor="hover">
                    <Icon name="trash" size={12}/> Remover
                  </button>
                )}
              </div>
            </div>
            <div className="hc-hint">
              Foto, gif ou um vídeo curto (MP4 ou WebM, até 20MB). Vídeo toca sozinho, mudo e em laço.
              Sem nada enviado, o cartão usa um fundo na cor de destaque.
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 40 }}>Página de novidades</h3>
      <p className="hc-lead">
        Fica em <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>/novidades</code>.
        Monte a página com blocos — eles aparecem na ordem em que estão aqui.
      </p>

      <div className="hc-sec open">
        <div className="hc-sec-body">
          <div className="hc-field">
            <label>Título da página</label>
            <input type="text" value={p.titulo || ""} onChange={(e) => mexer((d) => { d.pagina.titulo = e.target.value; })}/>
          </div>
          <div className="hc-field">
            <label>Resumo</label>
            <textarea rows={2} value={p.resumo || ""} onChange={(e) => mexer((d) => { d.pagina.resumo = e.target.value; })}/>
          </div>
        </div>
      </div>

      <div className="nov-blocos-editor">
        {p.blocos.map((b, i) => (
          <div key={b.id} className="hc-card nov-bloco-card">
            <div className="hc-card-head">
              <span>{i + 1} · {b.tipo === "imagem" ? "Imagem" : b.tipo === "video" ? "Vídeo" : "Texto"}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="hc-x" title="Subir" onClick={() => mover(i, -1)} data-cursor="hover"><Icon name="chevron-up" size={13}/></button>
                <button className="hc-x" title="Descer" onClick={() => mover(i, 1)} data-cursor="hover"><Icon name="chevron-down" size={13}/></button>
                <button className="hc-x" title="Remover" onClick={() => mexer((d) => { d.pagina.blocos.splice(i, 1); })} data-cursor="hover"><Icon name="trash" size={13}/></button>
              </div>
            </div>

            {b.tipo === "texto" && (
              <>
                <div className="hc-sub">
                  <label>Título do bloco (opcional)</label>
                  <input type="text" value={b.titulo || ""} onChange={(e) => mexer((d) => { d.pagina.blocos[i].titulo = e.target.value; })}/>
                </div>
                <div className="hc-sub">
                  <label>Texto</label>
                  <textarea rows={6} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                    value={b.textoHtml || ""}
                    onChange={(e) => mexer((d) => { d.pagina.blocos[i].textoHtml = e.target.value; })}
                    placeholder="<p>Escreva aqui…</p>"/>
                  <div className="hc-hint">Aceita HTML simples: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;/&lt;li&gt; e links.</div>
                </div>
              </>
            )}

            {b.tipo === "imagem" && (
              <>
                <div className="nov-img-linha">
                  {b.imagem
                    ? <img src={b.imagem} alt="" className="nov-img-previa"/>
                    : <div className="nov-img-previa nov-img-previa--vazia">sem imagem</div>}
                  <label className="hc-add" data-cursor="hover" style={{ cursor: "pointer" }}>
                    <Icon name="plus" size={12}/> {enviando === b.id ? "Enviando…" : (b.imagem ? "Trocar" : "Enviar imagem")}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => enviarImagem(e.target.files[0], (url) => (d) => { d.pagina.blocos[i].imagem = url; }, b.id)}/>
                  </label>
                </div>
                <div className="hc-sub">
                  <label>Legenda (opcional)</label>
                  <input type="text" value={b.legenda || ""} onChange={(e) => mexer((d) => { d.pagina.blocos[i].legenda = e.target.value; })}/>
                </div>
              </>
            )}

            {b.tipo === "video" && (
              <>
                <div className="hc-sub">
                  <label>Link do vídeo no YouTube</label>
                  <input type="text" value={b.youtube || ""} onChange={(e) => mexer((d) => { d.pagina.blocos[i].youtube = e.target.value; })}
                    placeholder="https://www.youtube.com/watch?v=..."/>
                  <div className="hc-hint">Ao salvar, fica só o identificador do vídeo — a página monta o player com ele.</div>
                </div>
                <div className="hc-sub">
                  <label>Legenda (opcional)</label>
                  <input type="text" value={b.legenda || ""} onChange={(e) => mexer((d) => { d.pagina.blocos[i].legenda = e.target.value; })}/>
                </div>
              </>
            )}
          </div>
        ))}

        <div className="nov-add-linha">
          <button className="hc-add" onClick={() => novoBloco("texto")} data-cursor="hover"><Icon name="plus" size={12}/> Bloco de texto</button>
          <button className="hc-add" onClick={() => novoBloco("imagem")} data-cursor="hover"><Icon name="plus" size={12}/> Imagem</button>
          <button className="hc-add" onClick={() => novoBloco("video")} data-cursor="hover"><Icon name="plus" size={12}/> Vídeo do YouTube</button>
        </div>
      </div>

      <div className="hc-actions">
        <button className="btn btn-accent" onClick={salvar} disabled={salvando} data-cursor="hover">
          {salvando ? "Publicando…" : "Publicar novidades"} <Icon name="arrow-right" size={14}/>
        </button>
        <a href="/novidades" target="_blank" className="btn btn-ghost" data-cursor="hover"><Icon name="external" size={14}/> Ver a página</a>
        {salvo && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#22e07c" }}>✓ publicado</span>}
        {erro && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>{erro}</span>}
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
            background: msg.type === "ok" ? "rgba(34,224,124,0.1)" : "rgba(var(--accent-rgb),0.1)",
            border: "1px solid " + (msg.type === "ok" ? "rgba(34,224,124,0.4)" : "rgba(var(--accent-rgb),0.4)"),
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
/* Classificação do empreendimento por trás do vídeo. Lista fechada de
   propósito: é o que entra no filtro e na ficha, e texto livre viraria
   "Alto"/"alto"/"ALTO" no mesmo relatório. "" = não informado. */
/* "Popular" é o termo de mercado para o segmento econômico, e é o que vem
   escrito na planilha de vídeos. Sem ele na lista, o vídeo importado abriria no
   console como "não informado" e perderia o padrão ao ser salvo. */
const VIDEO_PADROES = [
  { value: "",          label: "— não informado —" },
  { value: "Popular",   label: "Popular" },
  { value: "Baixo",     label: "Baixo" },
  { value: "Médio",     label: "Médio" },
  { value: "Alto",      label: "Alto" },
  { value: "Altíssimo", label: "Altíssimo" },
];
const VIDEO_FORMATOS = [
  { value: "",                      label: "— não informado —" },
  { value: "Condomínio vertical",   label: "Condomínio vertical" },
  { value: "Condomínio horizontal", label: "Condomínio horizontal" },
  { value: "Business",              label: "Business" },
];

const VideoFormModal = ({ cats, clients, initialData, onClose, onSave, onNovoCliente }) => {
  const isEdit     = !!(initialData?.id);
  const iSrc       = initialData?.videoUrl ? (initialData.videoUrl.includes("vimeo") ? "vimeo" : "youtube") : "youtube";
  const [src,      setSrc]      = React.useState(iSrc);
  const [url,      setUrl]      = React.useState(initialData?.videoUrl || "");
  const [title,    setTitle]    = React.useState(initialData?.title || "");
  const [clientNm, setClientNm] = React.useState(initialData?.client || clients[0]?.name || "");
  /* Cadastro de cliente sem sair do formulário: null é o estado normal (o
     dropdown), string é o nome sendo digitado. Aqui entra só o nome — a logo
     continua na aba Clientes, que é onde se envia arquivo. */
  const [novoCliente, setNovoCliente] = React.useState(null);
  const [criandoCliente, setCriandoCliente] = React.useState(false);
  const criarCliente = async () => {
    const nome = (novoCliente || "").trim();
    if (!nome) return;
    /* Nome que já existe não vira cliente repetido: só seleciona o que há. */
    const jaTem = clients.find(c => c.name.toLowerCase() === nome.toLowerCase());
    if (jaTem) { setClientNm(jaTem.name); setNovoCliente(null); return; }
    const id = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16) || "c" + Date.now();
    if (clients.some(c => c.id === id)) {
      window.__adminToast?.("Já existe um cliente com este identificador. Tente um nome ligeiramente diferente.");
      return;
    }
    setCriandoCliente(true);
    try {
      await window.API.addClient({ id, name: nome });
      onNovoCliente?.({ id, name: nome });
      setClientNm(nome);
      setNovoCliente(null);
    } catch (ex) {
      window.__adminToast?.("Erro ao criar cliente: " + (ex?.error || ex));
    } finally {
      setCriandoCliente(false);
    }
  };
  const [year,     setYear]     = React.useState(initialData?.year || "2026");
  const [duration, setDuration] = React.useState(initialData?.duration || "");
  const [empreendimento, setEmpreendimento] = React.useState(initialData?.empreendimento || "");
  // Classificação do empreendimento — listas fixas, combinadas com o comercial.
  const [padrao,  setPadrao]  = React.useState(initialData?.padrao  || "");
  const [formato, setFormato] = React.useState(initialData?.formato || "");
  const [formatoImersivo, setFormatoImersivo] = React.useState(initialData?.formatoImersivo || "");
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
  const [salvandoQuadro, setSalvandoQuadro] = React.useState(false);

  /* Quadro tirado do arquivo do vídeo, aqui no navegador. O YouTube publica só
     quatro capas por vídeo e não entrega mais nada a um servidor (a fita de
     quadros do player some da página quando o pedido vem de datacenter), então
     o único jeito de pegar um segundo qualquer é a partir do arquivo — e de
     quebra sai na resolução do original, não em 320x180. Nada é enviado além
     da imagem final. */
  const videoRef = React.useRef(null);
  const telaArqRef = React.useRef(null);
  const [arqNome, setArqNome] = React.useState("");
  const [arqDur, setArqDur] = React.useState(0);
  const [arqSeg, setArqSeg] = React.useState(0);
  const [arqTam, setArqTam] = React.useState("");
  const [arqErro, setArqErro] = React.useState("");
  const [sugestoes, setSugestoes] = React.useState([]);
  const [gerando, setGerando] = React.useState(false);
  const gerandoRef = React.useRef(false);
  const ytId = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
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

  const abrirArquivo = (file) => {
    if (!file) return;
    setArqErro(""); setArqNome(file.name); setArqDur(0); setArqTam("");
    const v = videoRef.current;
    if (v.src) URL.revokeObjectURL(v.src);
    v.src = URL.createObjectURL(file);
    v.load();
  };

  /* Oito momentos espalhados pelo vídeo, para escolher no olho antes de afinar
     no slider. Do YouTube isto seria impossível: ele publica quatro quadros por
     vídeo e nada além disso (1.jpg, 2.jpg, 3.jpg e a capa) — hq4 em diante é
     404. Aqui saem do próprio arquivo, e são oito de verdade.

     Um de cada vez, esperando o 'seeked': mandar o vídeo para outro tempo antes
     de ele chegar no anterior devolve o quadro errado. */
  const gerarSugestoes = async () => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration) || !v.videoWidth) return;
    setGerando(true); gerandoRef.current = true;
    const quantas = 8;
    const larg = 320;
    const alt = Math.max(1, Math.round(larg * v.videoHeight / v.videoWidth));
    const fora = document.createElement("canvas");
    fora.width = larg; fora.height = alt;
    const ctx = fora.getContext("2d");
    const lista = [];
    try {
      for (let i = 0; i < quantas; i++) {
        const t = Math.min(v.duration * (i + 0.5) / quantas, Math.max(0, v.duration - 0.05));
        await new Promise((ok) => {
          let saiu = false;
          const feito = () => { if (saiu) return; saiu = true; v.removeEventListener("seeked", feito); ok(); };
          v.addEventListener("seeked", feito);
          setTimeout(feito, 4000);          // arquivo travado não trava a tela
          v.currentTime = t;
        });
        ctx.drawImage(v, 0, 0, larg, alt);
        lista.push({ t, img: fora.toDataURL("image/jpeg", 0.7) });
      }
    } catch (e) { /* o que deu tempo de sair já serve */ }
    gerandoRef.current = false;
    setGerando(false);
    setSugestoes(lista);
    irPara(v.duration / 2);
  };

  /* O desenho acontece no 'seeked': pedir o quadro antes de o vídeo chegar no
     tempo pedido copia o quadro anterior. */
  const desenharDoArquivo = () => {
    const v = videoRef.current, c = telaArqRef.current;
    if (gerandoRef.current) return;      // varredura das sugestões: não é a escolha
    if (!v || !c || !v.videoWidth) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0, v.videoWidth, v.videoHeight);
    setArqTam(v.videoWidth + "x" + v.videoHeight);
  };

  const irPara = (seg) => {
    setArqSeg(seg);
    const v = videoRef.current;
    if (v && isFinite(v.duration)) v.currentTime = Math.min(seg, Math.max(0, v.duration - 0.05));
  };

  const relogio = (t) => {
    const s = Math.max(0, Math.round(t));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  const usarQuadro = (deOndeRef, apelido) => {
    const c = deOndeRef && deOndeRef.current;
    if (!c || !c.width) return;
    setSalvandoQuadro(true);
    c.toBlob((blob) => {
      if (!blob) { setSalvandoQuadro(false); return; }
      const arquivo = new File([blob], "quadro-" + (apelido || ytId) + ".jpg", { type: "image/jpeg" });
      uploadThumb(arquivo).finally(() => setSalvandoQuadro(false));
    }, "image/jpeg", 0.92);
  };

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
      formatoImersivo: cat === "imersivo" ? formatoImersivo : "",
      client:   clientNm || "—",
      year:     year || "2026",
      duration: duration || "00:00",
      empreendimento: empreendimento || "",
      padrao:   padrao  || "",
      formato:  formato || "",
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
                background: src===s ? "rgba(var(--accent-rgb),0.1)" : "rgba(255,255,255,0.03)",
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
            {novoCliente === null ? (
              <select value={clientNm} onChange={(e)=>{
                  if (e.target.value === "__novo") { setNovoCliente(""); return; }
                  setClientNm(e.target.value);
                }} style={F}>
                {clients.map(c => <option key={c.id} value={c.name} style={{background:"#0b0b0f"}}>{c.name}</option>)}
                <option value="—" style={{background:"#0b0b0f"}}>— sem cliente —</option>
                <option value="__novo" style={{background:"#0b0b0f"}}>+ Novo cliente…</option>
              </select>
            ) : (
              <div style={{display:"flex",gap:8}}>
                <input autoFocus value={novoCliente} placeholder="Nome do cliente"
                  onChange={(e)=>setNovoCliente(e.target.value)}
                  onKeyDown={(e)=>{
                    if (e.key === "Enter")  { e.preventDefault(); criarCliente(); }
                    if (e.key === "Escape") { e.preventDefault(); setNovoCliente(null); }
                  }}
                  style={{...F, flex:1, minWidth:0}}/>
                <button type="button" className="btn btn-accent" style={{padding:"0 14px",fontSize:12,flexShrink:0}}
                  onClick={criarCliente} disabled={criandoCliente} data-cursor="hover">
                  {criandoCliente ? "…" : "Criar"}
                </button>
                <button type="button" className="btn btn-ghost" style={{padding:"0 12px",fontSize:12,flexShrink:0}}
                  onClick={()=>setNovoCliente(null)} data-cursor="hover">Cancelar</button>
              </div>
            )}
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

        {/* Padrão + Formato do empreendimento */}
        <div className="row">
          <div className="field">
            <label>Padrão do empreendimento</label>
            <select value={padrao} onChange={(e)=>setPadrao(e.target.value)} style={F}>
              {VIDEO_PADROES.map(o => <option key={o.value} value={o.value} style={{background:"#0b0b0f"}}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Formato</label>
            <select value={formato} onChange={(e)=>setFormato(e.target.value)} style={F}>
              {VIDEO_FORMATOS.map(o => <option key={o.value} value={o.value} style={{background:"#0b0b0f"}}>{o.label}</option>)}
            </select>
          </div>
          {/* Só faz sentido em vídeo imersivo — em comercial seria mais um
              campo vazio para ignorar. A lista vem do console, e o valor já
              gravado entra nas opções mesmo que alguém o tenha tirado de lá:
              senão editar outra coisa no vídeo apagaria o formato sem querer. */}
          {cat === "imersivo" && (
            <div className="field">
              <label>Formato do imersivo</label>
              <select value={formatoImersivo} onChange={(e)=>setFormatoImersivo(e.target.value)} style={F}>
                <option value="" style={{background:"#0b0b0f"}}>— não informado —</option>
                {[...new Set([...(window.FRAMETY_DATA.formatosImersivos || []), formatoImersivo].filter(Boolean))]
                  .map(o => <option key={o} value={o} style={{background:"#0b0b0f"}}>{o}</option>)}
              </select>
            </div>
          )}
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
                    border:ytId?"1px solid var(--hl-bg)":"1px solid var(--line-strong)",
                    color:ytId?"var(--hl-ink)":"var(--ink-mute)",
                    background:ytId?"var(--hl-bg)":"transparent",
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
              {/* Do arquivo do vídeo: o caminho que não depende do YouTube, e o
                  único que entrega a capa na resolução do original. */}
              <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--line)"}}>
                <div style={{fontSize:11,color:"var(--ink-dim)",marginBottom:10,fontFamily:"var(--font-mono)",letterSpacing:"0.06em"}}>
                  Ou escolha o segundo exato no arquivo do vídeo:
                </div>
                <video ref={videoRef} muted playsInline preload="metadata" style={{display:"none"}}
                  onLoadedMetadata={(e)=>{
                    const v = e.currentTarget;
                    if (!v.videoWidth) { setArqErro("o navegador não consegue abrir este arquivo — exporte em MP4 (H.264)"); return; }
                    setArqDur(v.duration || 0);
                    setSugestoes([]);
                    gerarSugestoes();
                  }}
                  onSeeked={desenharDoArquivo}
                  onError={()=>setArqErro("o navegador não consegue abrir este arquivo — exporte em MP4 (H.264)")}/>
                {!arqDur ? (
                  <label style={{display:"inline-flex",alignItems:"center",gap:8,padding:"9px 14px",
                    border:"1px solid var(--line-strong)",borderRadius:8,cursor:"pointer",fontSize:12,color:"var(--ink-dim)"}}>
                    <Icon name="upload" size={13}/> Abrir arquivo do vídeo
                    <input type="file" accept="video/*" style={{display:"none"}}
                      onChange={(e)=>{ const f=e.target.files[0]; if(f) abrirArquivo(f); }}/>
                  </label>
                ) : (
                  <div>
                  {/* Oito sugestões, do próprio arquivo. */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(8, 1fr)",gap:6,marginBottom:12}}>
                    {gerando && sugestoes.length === 0 && Array.from({length:8},(_,i)=>(
                      <div key={i} style={{aspectRatio:"16/9",borderRadius:6,background:"rgba(255,255,255,0.04)"}}/>
                    ))}
                    {sugestoes.map((s2) => {
                      const perto = Math.abs(s2.t - arqSeg) < 0.25;
                      return (
                        <button key={s2.t} type="button" onClick={()=>irPara(s2.t)} data-cursor="hover"
                          style={{padding:0,border:perto?"2px solid var(--accent)":"1px solid var(--line-strong)",
                            borderRadius:6,overflow:"hidden",cursor:"pointer",background:"#000"}}>
                          <div style={{width:"100%",aspectRatio:"16/9",backgroundImage:"url("+s2.img+")",backgroundSize:"cover",backgroundPosition:"center"}}/>
                          <div style={{fontSize:9,padding:"3px 0",textAlign:"center",color:perto?"var(--accent)":"var(--ink-mute)",fontFamily:"var(--font-mono)"}}>{relogio(s2.t)}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                    <canvas ref={telaArqRef} style={{width:180,height:"auto",borderRadius:8,background:"#000",flexShrink:0,display:"block"}}/>
                    <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:8}}>
                      <input type="range" min={0} max={Math.max(0.1, arqDur)} step={0.04} value={arqSeg}
                        onChange={(e)=>irPara(+e.target.value)} style={{width:"100%",accentColor:"var(--accent)"}}/>
                      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--ink-dim)"}}>
                        <span>{relogio(arqSeg)}</span>
                        <span style={{color:"var(--ink-mute)"}}>de {relogio(arqDur)}{arqTam ? " · " + arqTam : ""}</span>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <button type="button" onClick={()=>usarQuadro(telaArqRef, "arquivo-" + Math.round(arqSeg) + "s")} disabled={salvandoQuadro} data-cursor="hover"
                          style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 14px",
                            borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",
                            border:"1px solid var(--hl-bg)",color:"var(--hl-ink)",background:"var(--hl-bg)"}}>
                          {salvandoQuadro ? "Enviando…" : "Usar este quadro"}
                        </button>
                        <span style={{fontSize:10,color:"var(--ink-mute)",fontFamily:"var(--font-mono)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220}}>{arqNome}</span>
                      </div>
                    </div>
                  </div>
                  </div>
                )}
                {arqErro && <div style={{fontSize:11,color:"var(--ink-mute)",marginTop:8}}>{arqErro}</div>}
              </div>

              <div style={{fontSize:10,color:"var(--ink-mute)",marginTop:10,lineHeight:1.5}}>
                As quatro capas acima são as únicas que o YouTube publica (480x360) — não existe uma quinta.
                Pelo arquivo do vídeo saem oito sugestões e qualquer segundo, na resolução do original.
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
