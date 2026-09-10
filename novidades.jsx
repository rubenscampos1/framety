/* novidades.jsx — o cartão que aparece na home e a página /novidades.

   A página é um mini blog montado por blocos (texto, imagem, vídeo do YouTube),
   todos editados no console. O conteúdo chega uma vez e fica num global, porque
   o cartão da home e a página leem a mesma coisa. */

window.FRAMETY_NOVIDADES = window.FRAMETY_NOVIDADES || null;

const useNovidades = () => {
  const [dados, setDados] = React.useState(window.FRAMETY_NOVIDADES);

  React.useEffect(() => {
    let vivo = true;
    const carregar = () =>
      window.API.getNovidades()
        .then((d) => { window.FRAMETY_NOVIDADES = d; if (vivo) setDados(d); })
        .catch(() => {});
    if (!window.FRAMETY_NOVIDADES) carregar();
    // editar no console reflete em quem já está com o site aberto
    const off = window.FRAMETY_LIVE ? window.FRAMETY_LIVE.on("content", carregar) : null;
    return () => { vivo = false; if (off) off(); };
  }, []);

  return dados;
};

/* ── Cartão no canto superior direito ────────────────────────────────────────
   Entra logo na abertura da home, depois que a página termina de aparecer.
   Fechar dispensa o cartão até a próxima carga da página. */
const NovidadesPopup = ({ onAbrir }) => {
  const dados = useNovidades();
  const [visivel, setVisivel] = React.useState(false);
  // Fechar vale só para esta visita à página: recarregar traz o cartão de volta.
  // Guardar em sessionStorage fazia o X calar o aviso pelo resto da sessão, e um
  // aviso que some depois do primeiro clique não é visto por quem volta.
  const [fechado, setFechado] = React.useState(false);

  /* Aparece na abertura, assim que a home termina de surgir. A entrada do site
     leva o conteúdo de opacity 0 a 1 e marca body.home-pronta; nascer antes
     disso seria um cartão por cima da animação de abertura. Os 400ms depois
     disso separam uma entrada da outra: o cartão chega como segunda coisa a se
     mexer, não junto com o herói. */
  React.useEffect(() => {
    if (fechado || visivel) return;
    let intervalo = null, atraso = null;
    const olhar = () => {
      if (!document.body.classList.contains("home-pronta")) return;
      clearInterval(intervalo);
      intervalo = null;
      if (!atraso) atraso = setTimeout(() => setVisivel(true), 400);
    };
    intervalo = setInterval(olhar, 120);   // a classe pode chegar depois deste efeito
    olhar();
    return () => { if (intervalo) clearInterval(intervalo); if (atraso) clearTimeout(atraso); };
  }, [fechado, visivel]);

  if (!dados || !dados.ativo || fechado || !visivel) return null;
  const c = dados.card || {};

  const fechar = () => setFechado(true);

  return (
    <aside className="nov-pop" role="complementary" aria-label={c.titulo || "Novidades"}>
      <button className="nov-pop-x" onClick={fechar} aria-label="Fechar aviso" data-cursor="hover">
        <Icon name="x" size={13} />
      </button>
      {/* Vídeo curto toca sozinho, mudo e em laço — é um banner, não um player.
          Com "menos movimento" ligado ele fica parado, com controles à mão. */}
      {!c.imagem ? <div className="nov-pop-img nov-pop-img--vazia" />
        : EH_VIDEO_URL(c.imagem)
          ? <video className="nov-pop-img" src={c.imagem} muted playsInline
                   loop={!SEM_MOVIMENTO} autoPlay={!SEM_MOVIMENTO}
                   controls={SEM_MOVIMENTO} preload="metadata" />
          : <img className="nov-pop-img" src={c.imagem} alt="" loading="lazy" />}
      <div className="nov-pop-corpo">
        {c.etiqueta && <span className="nov-pop-tag">{c.etiqueta}</span>}
        {c.titulo && <h3 className="nov-pop-titulo">{c.titulo}</h3>}
        {c.texto && <p className="nov-pop-texto">{c.texto}</p>}
        <button className="btn btn-accent nov-pop-btn" onClick={onAbrir} data-cursor="hover">
          {c.botao || "Saiba mais"} <Icon name="arrow-right" size={13} />
        </button>
      </div>
    </aside>
  );
};

/* ── A página ───────────────────────────────────────────────────────────────
   Os blocos vêm na ordem definida no console. O vídeo entra pelo id que o
   servidor extraiu da URL — a página nunca monta um embed com endereço solto. */
const NovidadesPage = ({ onVoltar }) => {
  const dados = useNovidades();

  React.useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!dados) {
    return (
      <div className="nov-pagina">
        <div className="container nov-vazio">Carregando…</div>
      </div>
    );
  }

  const p = dados.pagina || {};
  const blocos = Array.isArray(p.blocos) ? p.blocos : [];

  return (
    <div className="nov-pagina page-enter" data-screen-label="09 Novidades">
      <div className="container">
        <button className="nov-voltar" onClick={onVoltar} data-cursor="hover">
          <Icon name="arrow-right" size={13} style={{ transform: "rotate(180deg)" }} /> Voltar ao site
        </button>

        <header className="nov-cabecalho">
          <h1>{p.titulo || "Novidades"}</h1>
          {p.resumo && <p>{p.resumo}</p>}
        </header>

        {blocos.length === 0 && (
          <div className="nov-vazio">Nada publicado por aqui ainda.</div>
        )}

        <div className="nov-blocos">
          {blocos.map((b) => {
            if (b.tipo === "imagem") {
              return (
                <figure key={b.id} className="nov-bloco nov-bloco--imagem">
                  {b.imagem && <img src={b.imagem} alt={b.legenda || ""} loading="lazy" />}
                  {b.legenda && <figcaption>{b.legenda}</figcaption>}
                </figure>
              );
            }
            if (b.tipo === "video") {
              return (
                <figure key={b.id} className="nov-bloco nov-bloco--video">
                  {b.youtube && (
                    <div className="nov-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${b.youtube}?rel=0`}
                        title={b.legenda || b.titulo || "Vídeo"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                  {b.legenda && <figcaption>{b.legenda}</figcaption>}
                </figure>
              );
            }
            return (
              <section key={b.id} className="nov-bloco nov-bloco--texto">
                {b.titulo && <h2>{b.titulo}</h2>}
                {b.textoHtml && <div className="nov-texto" dangerouslySetInnerHTML={{ __html: b.textoHtml }} />}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { NovidadesPopup, NovidadesPage });
