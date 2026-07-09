/* tutorial.jsx — Página pública de tutorial / suporte ao cliente */

const getYouTubeId = (url) => {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return m ? m[1] : null;
};

const TutorialPage = () => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.API.getTutorial()
      .then(setData)
      .catch(() => setData({ videoUrl: '', title: '', subtitle: '', text: '' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="tutorial-shell">
        <div className="tutorial-loading">Carregando…</div>
      </div>
    );
  }

  const ytId = getYouTubeId(data?.videoUrl);

  return (
    <div className="tutorial-shell">
      <div className="tutorial-content">
        {/* Header com logos */}
        <header className="tutorial-header">
          <div className="tutorial-logos">
            <img src="/vector_framety.svg?v=1" alt="Framety" className="tutorial-logo-framety" />
            <img src="/vector_bar.svg?v=1" alt="|" className="tutorial-logo-divider" />
            <img src="/vector_skyline.svg?v=1" alt="Grupo Skyline" className="tutorial-logo-skyline" />
          </div>
          <span className="tutorial-tag">— Suporte ao cliente</span>
        </header>

        {/* Title block */}
        <section className="tutorial-title-block">
          <h1 className="tutorial-title">{data.title || 'Tutorial'}</h1>
          {data.subtitle && <p className="tutorial-subtitle">{data.subtitle}</p>}
        </section>

        {/* Video */}
        {ytId && (
          <section className="tutorial-video-wrap">
            <div className="tutorial-video-frame">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                title="Tutorial Framety"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {/* Text content */}
        {data.text && (
          <section
            className="tutorial-text"
            dangerouslySetInnerHTML={{ __html: data.text }}
          />
        )}

        {/* Footer CTA */}
        <footer className="tutorial-footer">
          <a href="/" className="tutorial-back-btn" data-cursor="hover">
            <Icon name="arrow-right" size={14} style={{ transform: 'rotate(180deg)' }} />
            Voltar ao site
          </a>
          <div className="tutorial-help">
            <span>Precisa de mais ajuda?</span>
            <a href="https://wa.me/556237051697" target="_blank" rel="noopener noreferrer">WhatsApp (62) 3705-1697</a>
            <span>·</span>
            <a href="mailto:comercial@skylineip.com.br">comercial@skylineip.com.br</a>
          </div>
        </footer>
      </div>
    </div>
  );
};

Object.assign(window, { TutorialPage });
