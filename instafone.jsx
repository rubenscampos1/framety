/* instafone.jsx — o celular que sobe no fim da home chamando para seguir.

   Ele espera o visitante chegar ao pé da página, sobe do canto esquerdo com
   metade do aparelho ainda fora da tela (como se estivesse saindo da borda) e
   leva ao perfil quando clicado.

   As fotos são as que estão no console. Não há API do Instagram aqui de
   propósito: o feed oficial pede um token que expira, precisa de renovação
   agendada e derruba o mural sozinho quando ninguém está olhando. Um punhado de
   fotos escolhidas à mão envelhece melhor do que um mural quebrado. */

window.FRAMETY_INSTAGRAM = window.FRAMETY_INSTAGRAM || null;

const useInstagram = () => {
  const [dados, setDados] = React.useState(window.FRAMETY_INSTAGRAM);

  React.useEffect(() => {
    let vivo = true;
    const carregar = () =>
      window.API.getInstagram()
        .then((d) => { window.FRAMETY_INSTAGRAM = d; if (vivo) setDados(d); })
        .catch(() => {});
    if (!window.FRAMETY_INSTAGRAM) carregar();
    const off = window.FRAMETY_LIVE ? window.FRAMETY_LIVE.on("content", carregar) : null;
    return () => { vivo = false; if (off) off(); };
  }, []);

  return dados;
};

/* Quanto falta para o fim da página, em pixels, para o celular subir. */
const INSTA_MARGEM = 260;

const InstaFone = () => {
  const dados = useInstagram();
  const [noAr, setNoAr] = React.useState(false);
  const [fechado, setFechado] = React.useState(false);

  /* Mesma leitura de posição usada no resto do site, em vez de listener de
     scroll ou IntersectionObserver: a página rola dentro de um contêiner e o
     evento nem sempre chega ao window. Aqui o timer não morre no primeiro
     acerto — o celular desce de volta quando o visitante sobe a página. */
  React.useEffect(() => {
    if (fechado) return;
    const olhar = () => {
      const fim = document.documentElement.scrollHeight;
      const base = window.scrollY + window.innerHeight;
      setNoAr(base > fim - INSTA_MARGEM);
    };
    olhar();
    const id = setInterval(olhar, 200);
    return () => clearInterval(id);
  }, [fechado]);

  if (!dados || dados.ativo === false || fechado) return null;
  if (!LINK_SEGURO(dados.perfil)) return null;      // sem perfil, não há para onde levar

  const fotos = Array.isArray(dados.fotos) ? dados.fotos.slice(0, 9) : [];
  if (!dados.print && fotos.length === 0) return null;   // celular de tela vazia não convida ninguém

  const usuario = dados.usuario ? (dados.usuario.startsWith("@") ? dados.usuario : "@" + dados.usuario) : "";

  const abrir = () => window.open(dados.perfil, "_blank", "noopener,noreferrer");

  return (
    <div className={"insta-fone" + (noAr ? " no-ar" : "")} aria-hidden={!noAr}>
      <button className="insta-x" onClick={(e) => { e.stopPropagation(); setFechado(true); }}
              aria-label="Dispensar" tabIndex={noAr ? 0 : -1} data-cursor="hover">
        <Icon name="x" size={12} />
      </button>

      <div className="insta-corpo" onClick={abrir} role="link" tabIndex={noAr ? 0 : -1}
           onKeyDown={(e) => { if (e.key === "Enter") abrir(); }}
           aria-label={"Seguir " + (usuario || "no Instagram")} data-cursor="hover">
        <span className="insta-ilha" />
        {/* Com print, a tela é a foto do perfil de verdade — cabeçalho, bio e
            grade, do jeito que estão no Instagram. Sem print, o celular monta a
            grade com as fotos enviadas no console. */}
        {dados.print ? (
          <div className="insta-tela insta-tela--print">
            <img src={dados.print} alt={"Perfil " + (usuario || "no Instagram")} loading="lazy" />
          </div>
        ) : (
          <div className="insta-tela">
            <div className="insta-topo">
              <span className="insta-foto-perfil">
                <img src={fotos[0]} alt="" loading="lazy" />
              </span>
              <span className="insta-usuario">{usuario || "Instagram"}</span>
              <span className="insta-seguir">Seguir</span>
            </div>
            {dados.chamada && <p className="insta-chamada">{dados.chamada}</p>}
            <div className="insta-grade">
              {fotos.map((f, i) => (
                <span key={i} className="insta-celula"><img src={f} alt="" loading="lazy" /></span>
              ))}
            </div>
          </div>
        )}

        {/* O convite fica por cima do print, na parte que sempre aparece: o pé
            do aparelho vive abaixo da borda da tela. */}
        {dados.print && (
          <div className="insta-convite">
            {dados.chamada && <span className="insta-convite-txt">{dados.chamada}</span>}
            <span className="insta-seguir">Seguir</span>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { InstaFone });
