/* storyboard.jsx — Storyboards (montagem + aprovação do cliente)
   Um storyboard é um "deck" de páginas com formato fixo (1280×994, a mesma
   proporção do modelo impresso). As mesmas páginas são renderizadas em dois
   contextos: o console (editável) e o link público do cliente (somente leitura
   + comentários). Por isso os renderizadores recebem `editable` em vez de
   existirem duplicados.

   A navegação é horizontal (uma página por vez, como uma apresentação). Todas
   as páginas continuam montadas no DOM — só o trilho é deslocado — porque a
   exportação em PDF varre `[data-sb-page]`.                                    */

const SB_PAGE_W = 1280;
const SB_PAGE_H = 994;                 // 1280 / 1.2878 — proporção do modelo

/* As três primeiras páginas (capa, disclaimer, assets) e a contracapa são fixas
   da estrutura do documento e não podem ser excluídas. */
const SB_LOCKED_HEAD = 3;

/* Nome/empresa de quem comenta, guardados uma vez por navegador. */
const SB_IDENT_KEY = "sb_ident";

const SB_DISCLAIMER_DEFAULT =
  "Todo o conteúdo apresentado neste material consiste em representações e projeções baseadas no roteiro, não refletindo necessariamente o resultado final. Alguns elementos poderão sofrer alterações ao longo do desenvolvimento. Este material pode incluir conteúdos gerados por computação gráfica e/ou inteligência artificial.";

const SB_STATUS = {
  v1:       { label: "Aguardando revisão V1", short: "V1", tone: "wait" },
  v2:       { label: "Aguardando revisão V2", short: "V2", tone: "wait" },
  v3:       { label: "Aguardando revisão V3", short: "V3", tone: "wait" },
  v4:       { label: "Aguardando revisão V4", short: "V4", tone: "wait" },
  aprovado: { label: "Aprovado",              short: "OK", tone: "ok"   },
};

const sbUid   = (p) => p + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-4);
const sbPad   = (n) => String(n).padStart(2, "0");
const sbDate  = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString("pt-BR"); };
const sbStamp = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

/* Numeração das cenas: só páginas do tipo `scene` contam, na ordem do deck. */
const sbSceneIndex = (pages, pageId) => {
  let n = 0;
  for (const p of pages) { if (p.type === "scene") { n++; if (p.id === pageId) return n; } }
  return 0;
};

/* ═════════════════ Versões: da cena e do documento ══════════════════════════
   Duas contagens independentes, com a MESMA regra: V1 e mais 3 rodadas de
   alteração, terminando na V4.

   • Cena  — sobe a cada nova imagem enviada naquela cena. Uma cena pode estar
             na V3 enquanto a do lado ainda está na V1.
   • Documento — sobe a cada rodada de revisão que o cliente fecha.

   Cada lugar que recebe imagem (a foto da cena, cada item da página de assets)
   é uma "faixa": a imagem de agora, a versão dela, desde quando está no ar, e o
   histórico das anteriores. Imagem antiga nunca é apagada por uma versão nova —
   é ela que sustenta a comparação.                                            */
const SB_MAX_VER = 4;                  // V1 + 3 rodadas
const SB_ROUNDS  = SB_MAX_VER - 1;

/* Vão entre a calha e a folha, e a largura abaixo da qual as calhas deitam e
   voltam a ser faixas horizontais. Vivem aqui porque o CSS e a conta da escala
   usam os dois — se saírem de sincronia, a calha descola do documento.        */
const SB_RAIL_GAP = 8;
const SB_RAIL_BP  = 900;

const sbRoundsLeft = (v) => Math.max(0, SB_MAX_VER - (v || 1));

/* Aviso de quantas rodadas ainda cabem. `alvo` entra na frase: "essa cena",
   "este storyboard". O texto da última rodada é o combinado com a produção. */
const sbRoundsNote = (v, alvo) => {
  const left = sbRoundsLeft(v);
  if (left <= 0)  return { tone: "stop", text: `Limite de ${SB_ROUNDS} rodadas de alteração atingido para ${alvo}.` };
  if (left === 1) return { tone: "warn", text: `Atenção, resta apenas 1 rodada de alteração disponível para ${alvo}.` };
  return { tone: "ok", text: `Restam ${left} rodadas de alteração para ${alvo}.` };
};

const sbSceneSlot = (page) => ({
  url: page.imageUrl || "", publicId: page.imagePublicId || "",
  version: page.imageVersion || 1, since: page.imageSince || null,
  history: page.imageHistory || [],
});

/* Linha do tempo da faixa, da versão mais antiga para a mais nova. A entrada
   atual entra mesmo sem imagem: "nesta versão a cena ficou sem foto" também é
   um estado, e sem ela o histórico voltaria a aparecer como se fosse o atual. */
const sbSlotTimeline = (slot) => [
  ...(slot.history || []).filter((h) => h.url),
  { url: slot.url || "", publicId: slot.publicId || "", version: slot.version || 1, since: slot.since || null },
].sort((a, b) => (a.version || 1) - (b.version || 1));

/* O que essa faixa mostrava na versão `v` (a última entrada até ela). */
const sbSlotAt = (slot, v) => {
  let pick = null;
  for (const e of sbSlotTimeline(slot)) if ((e.version || 1) <= v) pick = e;
  return pick;
};

const sbPageSlots = (page) => {
  if (!page) return [];
  if (page.type === "scene")  return [sbSceneSlot(page)];
  if (page.type === "assets") return page.items || [];
  return [];
};

/* Versão em que a página está: a mais adiantada entre as faixas dela. */
const sbPageVersion = (page) =>
  sbPageSlots(page).reduce((m, s) => Math.max(m, s.version || 1), 1);

/* Linha do tempo da página: cada versão e o instante em que ela entrou no ar
   (o mais antigo, quando a página tem mais de uma faixa). */
const sbPageTimeline = (page) => {
  const porVersao = new Map();
  for (const slot of sbPageSlots(page)) {
    for (const e of sbSlotTimeline(slot)) {
      const v = e.version || 1;
      const atual = porVersao.get(v);
      // `null` = "desde sempre", então ganha de qualquer data.
      if (!porVersao.has(v) || atual === null || (e.since && atual && e.since < atual)) {
        porVersao.set(v, e.since || null);
      }
    }
  }
  return [...porVersao.entries()].map(([version, since]) => ({ version, since }))
    .sort((a, b) => a.version - b.version);
};

const sbPageVersions = (page) => sbPageTimeline(page).map((e) => e.version);

/* Janela em que a versão `v` desta página esteve no ar: [entrou, saiu). */
const sbVersionWindow = (page, v) => {
  const tl = sbPageTimeline(page);
  const i = tl.findIndex((e) => e.version === v);
  if (i < 0) return { since: null, until: null };
  return { since: tl[i].since, until: i < tl.length - 1 ? tl[i + 1].since : null };
};

/* Comentários feitos enquanto essa versão estava no ar. É por data, e não pela
   versão do documento, porque as duas contagens andam separadas. */
const sbCommentsAtVersion = (page, comments, v) => {
  const { since, until } = sbVersionWindow(page, v);
  return comments.filter((c) => (!since || c.createdAt >= since) && (!until || c.createdAt < until));
};

/* Sobe uma versão nesta faixa: a de agora vai para o histórico e a nova assume.
   A primeira imagem de uma faixa vazia entra como V1, não como V2.            */
const sbBumpSlot = (slot, { url, publicId }) => {
  const agora = new Date().toISOString();
  const atual = slot.version || 1;
  if (!slot.url && !(slot.history || []).length) {
    return { ...slot, url, publicId, version: 1, since: null, history: [] };
  }
  return {
    ...slot, url, publicId, version: Math.min(atual + 1, SB_MAX_VER), since: agora,
    history: [...(slot.history || []),
      { url: slot.url, publicId: slot.publicId, version: atual, since: slot.since || null }],
  };
};

/* Desfaz a versão do topo: devolve a anterior e diz qual imagem apagar. Existe
   para consertar um envio errado sem gastar uma rodada. */
const sbUndoSlot = (slot) => {
  const history = [...(slot.history || [])];
  const prev = history.pop();
  if (!prev) return null;
  return {
    slot: { ...slot, url: prev.url, publicId: prev.publicId, version: prev.version || 1, since: prev.since || null, history },
    drop: slot.url ? { url: slot.url, publicId: slot.publicId } : null,
  };
};

/* A página como ela era na versão `v` — usada só para exibir. */
const sbPageAtVersion = (page, v) => {
  if (v == null || !page) return page;
  if (page.type === "scene") {
    const pick = sbSlotAt(sbSceneSlot(page), v);
    return { ...page, imageUrl: pick?.url || "", imagePublicId: pick?.publicId || "" };
  }
  if (page.type === "assets") {
    return { ...page, items: (page.items || []).map((it) => {
      const pick = sbSlotAt(it, v);
      return { ...it, url: pick?.url || "", publicId: pick?.publicId || "" };
    }) };
  }
  return page;
};

const sbCoverLine = (sb) => {
  const parts = [sb.cliente, sb.produto, "V" + (sb.version || 1), sb.categoria].filter(Boolean);
  return parts.join("-").toUpperCase();
};

/* Correspondência da busca: cliente, projeto, produto e categoria. Sem acento e
   sem caixa, para "sao" achar "São". Usada tanto na barra da tela exclusiva
   quanto na busca global do Ctrl+Espaço. */
const sbNorm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sbMatches = (sb, q) => {
  const alvo = sbNorm(q);
  if (!alvo) return true;
  return [sb.cliente, sb.projeto, sb.produto, sb.categoria].some((f) => sbNorm(f).includes(alvo));
};
window.sbMatchesStoryboard = (sb, q) => sbMatches(sb, q);

/* URL do cliente: domínio/storyboards/<cliente>/<produto>/<projeto>. */
/* Link do CLIENTE: código curto e opaco. Não se adivinha a partir do nome do
   cliente — antes o link aberto era o caminho legível, e bastava conhecer
   cliente/produto/projeto para chegar num storyboard que não era seu. */
const sbShareUrl = (sb) =>
  `${window.location.origin}/sb/${sb.shareSlug || sb.token || ""}`;

/* Endereço de EDIÇÃO de cada documento, atrás da senha:
   /storyboards/<cliente>/<produto>/<projeto>. Tudo sob /storyboards é nosso;
   o cliente nunca recebe um endereço desse prefixo. */
const sbDocSlug = (sb) => String(sb?.pathSlug || "");

/* O que vem depois de /storyboards/ — pode ter barras. "" quando é o índice. */
const sbSlugDaUrl = () => {
  const p = window.location.pathname;
  if (!p.startsWith("/storyboards/")) return "";
  return decodeURIComponent(p.slice("/storyboards/".length).replace(/\/+$/, ""));
};

/* Carrega um script externo uma única vez (libs de PDF sob demanda). */
const sbLoadScript = (src) => new Promise((resolve, reject) => {
  if ([...document.scripts].some((s) => s.src === src)) return resolve();
  const el = document.createElement("script");
  el.src = src; el.async = true;
  el.onload = () => resolve();
  el.onerror = () => reject(new Error("falha ao carregar " + src));
  document.head.appendChild(el);
});

const sbCopy = (url, addToast) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => addToast("Link do cliente copiado: " + url, "success"))
      .catch(() => addToast("Link: " + url, "success"));
  } else addToast("Link: " + url, "success");
};

/* Botão da seção. O realce agora é o reflexo em CSS puro (.sb-sheen) — sem
   anel girando e sem requestAnimationFrame. O `seed` continua sendo aceito e
   simplesmente ignorado, para não ter que mexer em todas as chamadas. */
const SBBtn = ({ className = "", seed, children, ...rest }) => (
  <button className={`${className} sb-sheen`} {...rest}>{children}</button>
);

/* ──────────────────── Barra de progresso (geração do PDF) ───────────────────
   Porte do ProgressBar (motion/react) para CSS puro. `value === null` = fase
   indeterminada (carregando as libs), com a faixa deslizante.                 */
const SBProgress = ({ value, label, pendingLabel = "Preparando", completeLabel = "Concluído" }) => {
  const indeterminate = value === null;
  const pct = indeterminate ? 0 : Math.round(clampFrac(value) * 100);
  return (
    <div className="sb-prog">
      <div className="sb-prog-top">
        <span className="sb-prog-lbl">{label}</span>
        <span className="sb-prog-pct">{indeterminate ? pendingLabel : pct >= 100 ? completeLabel : `${pct}%`}</span>
      </div>
      <div className="sb-prog-track" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        {...(indeterminate ? {} : { "aria-valuenow": pct, "aria-valuetext": `${pct}%` })}>
        <div className="sb-prog-rail">
          {indeterminate
            ? <span className="sb-prog-fill shimmer" />
            : <span className="sb-prog-fill" style={{ transform: `scaleX(${clampFrac(value)})` }} />}
        </div>
      </div>
    </div>
  );
};
const clampFrac = (v) => Math.min(1, Math.max(0, v || 0));

/* ───────────────────────── Campo de texto in-place ──────────────────────────
   Fora do modo edição vira texto puro — o que garante que a página exportada
   em PDF seja idêntica à que o cliente vê.                                    */
const SBText = ({ value, onChange, editable, className = "", placeholder = "", tag = "div" }) => {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!editable || !ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  }, [value, editable]);

  if (!editable) {
    const Tag = tag;
    return <Tag className={className}>{value || <span className="sb-ph">{placeholder}</span>}</Tag>;
  }
  return (
    <textarea ref={ref} rows={1} className={`${className} sb-edit`} value={value || ""}
      placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
};

/* Numeração impressa na página — vai junto na exportação em PDF. */
const SBPageNo = ({ n, total, light }) => (
  <span className={`sb-pageno ${light ? "light" : ""}`}>{sbPad(n)}<i>/{sbPad(total)}</i></span>
);

/* ──────────────────────────── Páginas do deck ──────────────────────────────── */

const SBCover = ({ sb, pageNo, total }) => (
  <div className="sb-p sb-p-cover">
    <img className="sb-logo-lg" src="/dual_logo_dark.svg" alt="Framety · Grupo Skyline" />
    <div className="sb-cover-foot">
      <div className="sb-cover-code">{sbCoverLine(sb) || "STORYBOARD"}</div>
      <div className="sb-cover-date">Atualizado em {sbDate(sb.updatedAt)}</div>
    </div>
    <SBPageNo n={pageNo} total={total} />
  </div>
);

const SBDisclaimer = ({ page, editable, onChange, pageNo, total }) => (
  <div className="sb-p sb-p-disc">
    <SBText className="sb-disc-txt" editable={editable} value={page.text}
      placeholder="Texto do disclaimer…" onChange={(t) => onChange({ ...page, text: t })} />
    <SBPageNo n={pageNo} total={total} />
  </div>
);

/* ─────────────────── Arrastar e soltar imagem numa vaga ─────────────────────
   `dragenter` e `dragleave` também disparam ao cruzar os filhos do elemento, o
   que faria o realce piscar enquanto o arquivo passeia por cima da página. Por
   isso conta-se a profundidade em vez de ligar/desligar a cada travessia.
   Só reage a arquivo: arrastar um texto ou um link não abre nada.             */
const sbTemArquivo = (e) => Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes("Files");

const useSoltaImagem = (ativo, aoSoltar) => {
  const [sobre, setSobre] = React.useState(false);
  const prof = React.useRef(0);
  const handlers = ativo ? {
    onDragEnter: (e) => { if (!sbTemArquivo(e)) return; e.preventDefault(); e.stopPropagation(); prof.current++; setSobre(true); },
    onDragOver:  (e) => { if (!sbTemArquivo(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; },
    onDragLeave: (e) => { if (!sbTemArquivo(e)) return; e.stopPropagation(); prof.current = Math.max(0, prof.current - 1); if (!prof.current) setSobre(false); },
    onDrop: (e) => {
      if (!sbTemArquivo(e)) return;
      e.preventDefault(); e.stopPropagation();
      prof.current = 0; setSobre(false);
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) aoSoltar(f);
    },
  } : {};
  return { sobre, handlers };
};

/* O que vai acontecer se soltar aqui — dito ANTES de soltar, porque soltar
   sobre uma vaga que já tem imagem gasta uma rodada de alteração. */
const sbAvisoSolta = (slot) => {
  const ver = (slot && slot.version) || 1;
  if (!slot || !slot.url) return { texto: "Solte para enviar a imagem", tom: "ok" };
  if (ver >= SB_MAX_VER) return { texto: `Limite de ${SB_ROUNDS} rodadas atingido`, tom: "bloq" };
  return { texto: `Solte para enviar a V${ver + 1} — gasta uma rodada`, tom: "aviso" };
};

/* Botões de uma vaga de imagem na edição: subir a próxima versão, desfazer a
   que está no topo, ou tirar a imagem quando ela ainda é a única.             */
const SBSlotTools = ({ slot, onPick, onUndo, onDrop }) => {
  const ver = slot.version || 1;
  const temImagem = !!slot.url;
  const temHist = (slot.history || []).length > 0;
  const cheio = ver >= SB_MAX_VER;
  return (
    <React.Fragment>
      <button className="sb-minibtn accent" onClick={onPick} disabled={temImagem && cheio}
        title={temImagem && cheio
          ? `Limite de ${SB_ROUNDS} rodadas de alteração atingido.`
          : temImagem ? `A imagem de agora vira a V${ver} e a nova entra como V${ver + 1}.` : ""}>
        {temImagem ? "subir nova versão" : "enviar imagem"}
      </button>
      {temHist && <button className="sb-minibtn" onClick={onUndo} title="Volta para a versão anterior e apaga esta imagem.">desfazer a V{ver}</button>}
      {temImagem && !temHist && <button className="sb-minibtn danger" onClick={onDrop}>remover</button>}
    </React.Fragment>
  );
};

/* Uma vaga do mosaico. Componente próprio porque cada uma tem o seu estado de
   arraste — um hook por item não caberia num laço dentro do pai. */
const SBAssetSlot = ({ it, i, editable, onCaption, onPickImage, onDropImage, onUndoImage, onDropFile }) => {
  /* Ativa mesmo no teto, para o arraste poder explicar a recusa (ver SBScene). */
  const { sobre, handlers } = useSoltaImagem(editable, (f) => onDropFile(i, f));
  const aviso = sbAvisoSolta(it);
  return (
    <figure className={`sb-mo ${sobre ? "soltando" : ""}`} {...handlers}>
      <SBText className="sb-mo-cap" editable={editable} value={it.caption}
        placeholder="legenda" onChange={onCaption} />
      <div className="sb-mo-img">
        {it.url
          ? <img src={it.url} alt={it.caption || ""} />
          : <div className="sb-mo-empty">sem imagem</div>}
        {editable && (
          <div className="sb-mo-tools">
            <SBSlotTools slot={it} onPick={() => onPickImage(i)}
              onUndo={() => onUndoImage(i)} onDrop={() => onDropImage(i)} />
          </div>
        )}
        {sobre && <div className={`sb-solta-aviso ${aviso.tom}`}>{aviso.texto}</div>}
      </div>
    </figure>
  );
};

const SBAssets = ({ page, editable, onChange, onPickImage, onDropImage, onUndoImage, onDropFile, pageNo, total }) => {
  const items = page.items || [];
  const setItem = (i, patch) => onChange({ ...page, items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });

  /* A folha inteira também aceita, criando a PRÓXIMA vaga — sem isso não haveria
     onde soltar numa página de assets ainda vazia (as vagas só nascem pelo botão
     "adicionar imagem"). As vagas existentes tratam o drop antes, com
     stopPropagation, então soltar em cima de uma delas troca aquela imagem. */
  const cabeMais = items.length < 4;
  const { sobre, handlers } = useSoltaImagem(editable, (f) => {
    if (cabeMais) onDropFile(items.length, f);
  });

  return (
    <div className={`sb-p sb-p-assets ${sobre ? "soltando" : ""}`} {...handlers}>
      {sobre && (
        <div className={`sb-solta-aviso ${cabeMais ? "ok" : "bloq"}`}>
          {cabeMais ? `Solte para virar a imagem ${items.length + 1} de 4` : "Esta página já tem 4 imagens"}
        </div>
      )}
      <SBText className="sb-assets-title" editable={editable} value={page.title}
        placeholder="ASSETS" onChange={(t) => onChange({ ...page, title: t })} />

      <div className={`sb-mosaic n${Math.max(items.length, 1)}`}>
        {items.map((it, i) => (
          <SBAssetSlot key={it.id || i} it={it} i={i} editable={editable}
            onCaption={(t) => setItem(i, { caption: t })}
            onPickImage={onPickImage} onDropImage={onDropImage} onUndoImage={onUndoImage}
            onDropFile={onDropFile} />
        ))}
        {editable && items.length < 4 && (
          <button className="sb-mo-add" onClick={() => onPickImage(items.length)}>
            <span>+</span> adicionar imagem
          </button>
        )}
      </div>

      <img className="sb-logo-sm" src="/dual_logo_dark.svg" alt="" />
      <SBPageNo n={pageNo} total={total} />
    </div>
  );
};

const SBScene = ({ page, sceneNo, editable, onChange, onPickImage, onDropImage, onUndoImage, onDropFile, pageNo, total }) => {
  const slot = sbSceneSlot(page);
  /* A folha inteira aceita o arquivo, não só o retângulo da imagem: quem arrasta
     mira "a página", e obrigar a acertar a moldura é atrito à toa. */
  /* A zona segue ativa mesmo no teto de rodadas: assim o arraste consegue
     DIZER que não vai passar ("Limite de 3 rodadas atingido", em vermelho).
     Desligada, o arquivo simplesmente não fazia nada e ninguém entendia por quê.
     Quem recusa o envio é o `enviarImagem`, que já explica no toast. */
  const podeSoltar = editable;
  /* A cena tem uma vaga só — o índice vai indefinido, como no botão. */
  const { sobre, handlers } = useSoltaImagem(podeSoltar, (f) => onDropFile(undefined, f));
  const aviso = sbAvisoSolta(slot);
  return (
  <div className={`sb-p sb-p-scene ${sobre ? "soltando" : ""}`} {...handlers}>
    <div className={`sb-scene-img ${page.imageUrl ? "" : "empty"}`}>
      {page.imageUrl ? (
        <img src={page.imageUrl} alt={`Cena ${sbPad(sceneNo)}`} />
      ) : (
        /* Sem imagem: fundo preto com a descrição do que entra no trecho. */
        <SBText className="sb-scene-ph" editable={editable} value={page.placeholder}
          placeholder="descreva o que vai aparecer nesta cena…"
          onChange={(t) => onChange({ ...page, placeholder: t })} />
      )}
      {editable && (
        <div className="sb-scene-tools">
          <SBSlotTools slot={slot} onPick={onPickImage} onUndo={onUndoImage} onDrop={onDropImage} />
        </div>
      )}
      {sobre && <div className={`sb-solta-aviso ${aviso.tom}`}>{aviso.texto}</div>}
      <SBPageNo n={pageNo} total={total} light />
    </div>

    <div className="sb-scene-box">
      <h3 className="sb-scene-title">CENA {sbPad(sceneNo)}</h3>

      <div className="sb-field">
        <span className="sb-field-lbl">LOCUÇÃO EM OFF:</span>
        <div className="sb-field-row">
          <span className="sb-field-ico">🎙</span>
          <SBText className="sb-field-val" editable={editable} value={page.locucao}
            placeholder="texto da locução" onChange={(t) => onChange({ ...page, locucao: t })} />
        </div>
      </div>

      <div className="sb-field">
        <span className="sb-field-lbl">VISUAL:</span>
        <div className="sb-field-row">
          <span className="sb-field-ico">🎬</span>
          <SBText className="sb-field-val" editable={editable} value={page.visual}
            placeholder="descrição do visual" onChange={(t) => onChange({ ...page, visual: t })} />
        </div>
      </div>

      <div className="sb-field">
        <span className="sb-field-lbl">SFX:</span>
        <div className="sb-field-row">
          <span className="sb-field-ico">🔊</span>
          <SBText className="sb-field-val" editable={editable} value={page.sfx}
            placeholder="trilha e efeitos" onChange={(t) => onChange({ ...page, sfx: t })} />
        </div>
      </div>

      <img className="sb-logo-sm" src="/dual_logo_dark.svg" alt="" />
    </div>
  </div>
  );
};

const SBEnd = ({ pageNo, total }) => (
  <div className="sb-p sb-p-end">
    <img className="sb-logo-lg" src="/dual_logo_dark.svg" alt="Framety · Grupo Skyline" />
    <SBPageNo n={pageNo} total={total} />
  </div>
);

/* ─────────────────────── Uma página + sua moldura/escala ───────────────────── */
const SBPage = ({ sb, page: real, index, scale, editable, viewVersion, onChange, onPickImage, onDropImage, onUndoImage, onDropFile }) => {
  const total = sb.pages.length;
  /* Olhando uma versão anterior: as imagens vêm do histórico e a página fica
     só de leitura — editar sempre acontece sobre o documento de agora. */
  const past = viewVersion != null;
  const page = past ? sbPageAtVersion(real, viewVersion) : real;
  const common = { page, editable: editable && !past, onChange, onPickImage, onDropImage, onUndoImage, onDropFile, pageNo: index + 1, total };
  let inner;
  if (page.type === "cover")           inner = <SBCover sb={sb} pageNo={index + 1} total={total} />;
  else if (page.type === "disclaimer") inner = <SBDisclaimer {...common} />;
  else if (page.type === "assets")     inner = <SBAssets {...common} />;
  else if (page.type === "end")        inner = <SBEnd pageNo={index + 1} total={total} />;
  else inner = <SBScene {...common} sceneNo={sbSceneIndex(sb.pages, page.id)} />;

  return (
    <div className="sb-pagewrap" style={{ width: SB_PAGE_W * scale, height: SB_PAGE_H * scale }}>
      <div className="sb-pageclip">
        {/* fora do .sb-p de propósito: a tarja não entra na exportação do PDF */}
        {past && <div className="sb-pastflag">Você está vendo a V{viewVersion}</div>}
        <div className="sb-pagescale" style={{ transform: `scale(${scale})` }} data-sb-page={page.id}>
          {inner}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────── Abas de versão de uma página ───────────────────────────
   Um quadradinho por versão da cena, na ordem. O aceso é o que está na tela; os
   apagados são as versões anteriores, que continuam clicáveis para comparar.
   As vagas que ainda não existem aparecem como contorno pontilhado — é o que
   deixa visível quantas rodadas ainda cabem.                                   */
const SBVersionBar = ({ page, docVersion = 1, viewVersion, onPick }) => {
  /* As abas existem em TODAS as páginas. Nas que recebem imagem elas contam a
     versão daquela cena e dá para clicar para comparar; nas fixas (capa,
     disclaimer, contracapa) contam a do documento e são só leitura. Assim o
     indicador nunca some do lado da folha. */
  const versions = sbPageVersions(page);
  const daPagina = versions.length > 0;
  const latest = daPagina ? versions[versions.length - 1] : (docVersion || 1);
  const usadas = daPagina ? versions : Array.from({ length: latest }, (_, i) => i + 1);
  const atual = daPagina ? (viewVersion ?? latest) : latest;
  const alvo = !daPagina ? "este storyboard" : page.type !== "assets" ? "essa cena" : "essa página";
  const nota = sbRoundsNote(latest, alvo);
  const clicavel = daPagina && !!onPick;
  const vagas = [];
  for (let v = latest + 1; v <= SB_MAX_VER; v++) vagas.push(v);

  return (
    <div className="sb-verbar" title={nota.text}>
      <span className="sb-verbar-lbl">{!daPagina ? "doc" : page.type !== "assets" ? "cena" : "assets"}</span>
      <div className="sb-verchips">
        {usadas.map((v) => (
          <button key={v} type="button"
            className={`sb-verchip ${v === atual ? "on" : "past"}`}
            title={!clicavel ? `V${v}` : v === latest ? `Versão atual desta cena (V${v})` : `Ver a V${v} desta cena`}
            onClick={() => clicavel && onPick(v === latest ? null : v)}
            disabled={!clicavel}>
            V{v}
          </button>
        ))}
        {vagas.map((v) => (
          <span key={v} className="sb-verchip free" title={`Rodada ainda disponível (V${v})`}>V{v}</span>
        ))}
      </div>
    </div>
  );
};

/* Frase de rodadas da página que está na tela — some da calha (não cabe em
   texto vertical) e reaparece no cabeçalho do painel de comentários. */
const sbPageRoundsNote = (page) => {
  const versions = sbPageVersions(page);
  if (!versions.length) return null;
  return sbRoundsNote(versions[versions.length - 1], page.type !== "assets" ? "essa cena" : "essa página");
};

/* ───────────── Deck horizontal: uma página por vez, como slides ───────────── */
const SBDeck = ({ sb, editable, current, setCurrent, onChangePage, onAddPage, onDeletePage,
                  onMovePage, onPickImage, onDropImage, onUndoImage, onDropFile = () => {},
                  viewVersion = null, onPickVersion, railTop = null }) => {
  const viewRef  = React.useRef(null);
  const stageRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const railLRef = React.useRef(null);
  const railRRef = React.useRef(null);
  const [scale, setScale] = React.useState(0.5);
  /* Tamanho exato da folha na tela. Quando existe, a moldura encolhe até ele e
     as calhas encostam no documento; `null` é o modo deitado, onde a moldura
     volta a ocupar a linha inteira. */
  const [sheet, setSheet] = React.useState(null);
  /* Tamanho do palco, guardado para a grade saber quantas colunas cabem. */
  const [palco, setPalco] = React.useState(null);
  /* Grade: todas as páginas de uma vez, com zoom out. Abre e fecha no G. */
  const [grade, setGrade] = React.useState(false);
  const pages = sb.pages || [];
  const total = pages.length;

  /* Miniaturas da grade: quantas colunas caberem em ~250px, entre 2 e 6, e a
     escala sai da largura que cada coluna recebe. Com muitas páginas a grade
     rola (o `overflow-y` da viewport) em vez de encolher sem limite. */
  const GRADE_VAO = 14;
  const gradeCols = Math.max(2, Math.min(6, Math.floor(((palco?.w || SB_PAGE_W) - 24) / 250) || 2));
  const gradeScale = Math.max(0.04,
    (((palco?.w || SB_PAGE_W) - 24 - GRADE_VAO * (gradeCols - 1)) / gradeCols) / SB_PAGE_W);

  /* Escala para caber inteira no palco (largura E altura).
     A medida sai do PALCO, não da moldura: a moldura passou a ter a largura da
     folha, então medi-la seria medir o próprio resultado — a folha encolheria a
     cada quadro. O palco é uma coluna do `.sb-workspace`, então a largura dele
     não depende do que está dentro. */
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const mq = window.matchMedia(`(max-width:${SB_RAIL_BP}px)`);
    const fit = () => {
      const deitado = mq.matches;
      /* Deitado as calhas são linhas (não tiram largura); de pé elas ladeiam a
         folha, e é a largura delas + os vãos que sobra para o documento. */
      const calhas = deitado ? 0
        : (railLRef.current?.offsetWidth || 0) + (railRRef.current?.offsetWidth || 0) + SB_RAIL_GAP * 2;
      const w = Math.max(140, (stage.clientWidth || SB_PAGE_W) - calhas);
      /* De pé, a altura vem do PALCO: a moldura passa a ter a altura da folha,
         e medi-la aqui prenderia a folha no tamanho anterior (ela nunca voltaria
         a crescer ao abrir a janela). Deitado a moldura é a linha do meio, e aí
         é ela mesma que sabe quanto sobrou entre as duas faixas. */
      const h = (deitado ? frameRef.current?.clientHeight : stage.clientHeight)
        || stage.clientHeight || SB_PAGE_H;
      const s = Math.max(0.15, Math.min(w / SB_PAGE_W, h / SB_PAGE_H));
      setScale(s);
      setSheet(deitado ? null : { w: Math.round(SB_PAGE_W * s), h: Math.round(SB_PAGE_H * s) });
      setPalco({ w: w, h: h });
    };
    fit();
    /* Segunda medida no quadro seguinte. A primeira sai antes de o layout
       assentar — o efeito do filho roda antes do efeito do pai, que é quem põe
       o console em "modo aplicativo" — e a folha nascia menor do que cabia,
       esperando o ResizeObserver para crescer. Aqui ela já abre no tamanho. */
    const raf = requestAnimationFrame(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    mq.addEventListener?.("change", fit);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mq.removeEventListener?.("change", fit); };
  }, []);

  /* Teclado — desligado enquanto se digita num campo (os textos da cena são
     textarea, e o cabeçalho tem inputs; sem esta guarda o G viraria um "g" no
     meio da locução). Vale em leitura e em edição. */
  React.useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "g" || e.key === "G") { e.preventDefault(); setGrade((g) => !g); return; }
      if (e.key === "Escape") { setGrade(false); return; }
      /* Na grade as setas não viram página: quem manda ali é o clique. */
      if (grade) return;
      if (e.key === "ArrowRight") setCurrent((i) => Math.min(i + 1, total - 1));
      if (e.key === "ArrowLeft")  setCurrent((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, setCurrent, grade]);

  const page = pages[current];
  const canDelete = editable && page && current >= SB_LOCKED_HEAD && page.type !== "end";

  return (
    <div className="sb-stage" ref={stageRef}>
      {/* Duas calhas verticais ladeando a folha: à esquerda a identificação do
          documento, à direita as versões da cena (topo) e a paginação (base).
          Nada de faixa horizontal — é o que libera a altura inteira para a
          folha, que é o que o cliente veio ver. A moldura tem o tamanho exato
          da folha, então as calhas ficam a um vão do papel em vez de boiarem na
          sobra da coluna. */}
      {railTop && <aside className="sb-rail sb-rail-l" ref={railLRef}>{railTop}</aside>}

      {/* Na grade a moldura solta o tamanho da folha e ocupa o palco inteiro —
          é a mesma esteira de páginas de sempre, só disposta em colunas e com a
          escala das miniaturas. Nada é montado duas vezes. */}
      <div className={`sb-frame ${sheet && !grade ? "hug" : ""} ${grade ? "emgrade" : ""}`} ref={frameRef}
        style={sheet && !grade ? { width: sheet.w, height: sheet.h } : undefined}>
        {!grade && (
          <SBBtn className="sb-nav prev" seed={11} onClick={() => setCurrent((i) => Math.max(i - 1, 0))}
            disabled={current === 0} aria-label="Página anterior">‹</SBBtn>
        )}

        <div className={`sb-viewport ${grade ? "grade" : ""}`} ref={viewRef}
          style={grade ? { "--sb-cols": gradeCols, "--sb-vao": GRADE_VAO + "px" } : undefined}>
          <div className="sb-track" style={grade ? undefined : { transform: `translateX(${-current * 100}%)` }}>
            {pages.map((p, i) => (
              <div className={`sb-slide ${grade && i === current ? "atual" : ""}`} key={p.id}
                aria-hidden={!grade && i !== current}>
                <SBPage sb={sb} page={p} index={i} scale={grade ? gradeScale : scale} editable={editable && !grade}
                  viewVersion={i === current ? viewVersion : null}
                  onChange={(np) => onChangePage(i, np)}
                  onPickImage={(slot) => onPickImage(i, slot)}
                  onDropImage={(slot) => onDropImage(i, slot)}
                  onUndoImage={(slot) => onUndoImage(i, slot)}
                  onDropFile={(slotIdx, file) => onDropFile(i, slotIdx, file)} />
                {grade && (
                  <button className="sb-gridpick" title={`Ir para a página ${i + 1}`}
                    onClick={() => { setCurrent(i); setGrade(false); }}>
                    <span>{sbPad(i + 1)}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {!grade && (
          <SBBtn className="sb-nav next" seed={12} onClick={() => setCurrent((i) => Math.min(i + 1, total - 1))}
            disabled={current >= total - 1} aria-label="Próxima página">›</SBBtn>
        )}
      </div>

      <aside className="sb-rail sb-rail-r" ref={railRRef}>
        <div className="sb-railtop">
          <SBVersionBar page={page} docVersion={sb.version || 1}
            viewVersion={viewVersion} onPick={onPickVersion} />
        </div>

        <div className="sb-railfoot">
          {editable && (
            <div className="sb-tools">
              <button className="sb-railbtn" title="Página anterior na ordem"
                onClick={() => onMovePage(current, -1)} disabled={current === 0}>↑</button>
              <button className="sb-railbtn" title="Página seguinte na ordem"
                onClick={() => onMovePage(current, +1)} disabled={current >= total - 1}>↓</button>
              <button className="sb-railbtn danger" title={canDelete ? "Excluir página" : "Página fixa do documento"}
                onClick={() => onDeletePage(current)} disabled={!canDelete}>×</button>
              <div className="sb-railadd">
                <button className="sb-railplus" title="Adicionar página depois desta">+</button>
                <div className="sb-railmenu">
                  <button onClick={() => onAddPage(current + 1, "scene")}>Nova cena</button>
                  <button onClick={() => onAddPage(current + 1, "assets")}>Nova página de assets</button>
                  <button onClick={() => onAddPage(current + 1, "disclaimer")}>Novo disclaimer</button>
                </div>
              </div>
            </div>
          )}

          {/* A fileira de bolinhas saiu: com muitas páginas ela não cabia na
              calha e passava a atropelar o resto. A contagem sozinha diz a mesma
              coisa em qualquer tamanho de documento, e a grade abre para quem
              quer ver tudo de uma vez. O botão existe para o atalho não ficar
              invisível para quem não o conhece. */}
          <button className={`sb-gradebtn ${grade ? "on" : ""}`} onClick={() => setGrade((g) => !g)}
            title={grade ? "Fechar a grade (G ou Esc)" : "Ver todas as páginas em grade (G)"}>
            <Icon name="grid" size={13} />
            <i>G</i>
          </button>

          <span className="sb-counter">{sbPad(current + 1)} <i>/ {sbPad(total)}</i></span>
        </div>
      </aside>
    </div>
  );
};

/* ───────────────────────── Painel de comentários ───────────────────────────── */
const SBComments = ({ pageNo, total, comments, editable, canComment, draft, setDraft, onSend,
                      onRemove, onAdminRemove, viewVersion = null, pendingNote = "", contexto = null, acoes }) => {
  /* Apagar comentário do cliente é definitivo: o botão pede o segundo clique
     em vez de abrir mais um modal. */
  const [confirmId, setConfirmId] = React.useState(null);
  React.useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmId]);

  return (
    <aside className="sb-side">
      <div className="sb-side-head">
        <b>Comentários</b>
        <span>
          página {sbPad(pageNo)} de {sbPad(total)}
          {viewVersion != null && <em className="sb-side-ver"> · vendo a V{viewVersion}</em>}
        </span>
        {/* A frase de rodadas da cena mora aqui: na calha ela não caberia de pé. */}
        {contexto && <span className={`sb-vernote ${contexto.tone}`}>{contexto.text}</span>}
      </div>

      <div className="sb-side-body">
        {!comments.length && (
          <p className="sb-side-empty">
            {viewVersion != null ? `Nenhum comentário na V${viewVersion} desta página.` : "Nenhum comentário nesta página."}
          </p>
        )}
        {comments.map((c) => (
          <div className={`sb-cmt ${c.submitted ? "" : "draft"}`} key={c.id}>
            <div className="sb-cmt-who">
              <span className="sb-cmt-av">{(c.author || "?").trim().charAt(0).toUpperCase()}</span>
              <div>
                <b>{c.author}</b>
                {c.company ? <span className="sb-cmt-co">{c.company}</span> : null}
              </div>
              <span className="sb-cmt-ver" title="Versão do documento quando o comentário foi feito">doc V{c.version || 1}</span>
            </div>
            <p>{c.text}</p>
            <div className="sb-cmt-foot">
              <time>{sbStamp(c.createdAt)}</time>
              {!c.submitted && <span className="sb-cmt-tag">não enviado</span>}
              {!c.submitted && onRemove && <button className="sb-cmt-del" onClick={() => onRemove(c.id)}>remover</button>}
              {onAdminRemove && (
                <button className={`sb-cmt-del ${confirmId === c.id ? "armed" : ""}`}
                  onClick={() => (confirmId === c.id ? (setConfirmId(null), onAdminRemove(c.id)) : setConfirmId(c.id))}>
                  {confirmId === c.id ? "confirmar exclusão" : "apagar"}
                </button>
              )}
            </div>
          </div>
        ))}
        {/* Fica no fim da lista de propósito: acompanha os comentários conforme
            eles são adicionados, em vez de esperar lá embaixo. */}
        {pendingNote && <p className="sb-side-pending">{pendingNote}</p>}
      </div>

      {viewVersion != null ? (
        <p className="sb-side-note warn">Esta é a V{viewVersion}, guardada para consulta. Volte para a versão atual para comentar.</p>
      ) : canComment && (
        <div className="sb-cmt-new">
          <textarea placeholder="Comentar esta página…" value={draft}
            onChange={(e) => setDraft(e.target.value)} />
          <SBBtn className="sb-ghostbtn sm" seed={16} onClick={onSend}>Comentar</SBBtn>
        </div>
      )}
      {viewVersion == null && acoes}
    </aside>
  );
};

/* ───────────────────────── Exportação em PDF (cliente) ───────────────────────
   Espera as imagens da cópia decodificarem antes de rasterizar — vêm do cache,
   mas sem isso a página sai sem a foto de vez em quando.                       */
/* Cede um quadro ao navegador. O rAF é congelado em abas ocultas, então há um
   timeout de escape — sem ele a exportação trava se o usuário mudar de aba. */
const sbNextFrame = () => new Promise((resolve) => {
  let done = false;
  const fin = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(fin);
  setTimeout(fin, 60);
});

const sbWaitImages = (root) => Promise.all(
  [...root.querySelectorAll("img")].map((img) =>
    img.complete && img.naturalWidth
      ? Promise.resolve()
      : new Promise((r) => { img.onload = r; img.onerror = r; })));

/* Coluna de comentários à direita da página, na versão "com comentários".
   Desenhada em vetor pelo jsPDF (não rasterizada), então o texto sai
   selecionável e pesa quase nada. Se os comentários não couberem na altura da
   folha, seguem numa folha de continuação com a esquerda em branco. */
const SB_NOTES_W = 430;
function sbDrawNotesColumn(pdf, { index, total, comments, format }) {
  const x0 = SB_PAGE_W;                 // a coluna começa onde a página termina
  const pad = 34;
  const left = x0 + pad;
  const textW = SB_NOTES_W - pad * 2;
  const bottom = SB_PAGE_H - 34;

  // Cinza escuro para a faixa não se confundir com a folha branca do storyboard;
  // cada comentário vem num cartão branco por cima.
  const fundo = () => {
    pdf.setFillColor(38, 38, 44);
    pdf.rect(x0, 0, SB_NOTES_W, SB_PAGE_H, "F");
  };

  const titulo = (sufixo = "") => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`COMENTÁRIOS${sufixo}`, left, 62);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    pdf.setTextColor(158, 158, 170);
    pdf.text(`Página ${sbPad(index + 1)} de ${sbPad(total)}`, left, 80);
    pdf.setDrawColor(74, 74, 84);
    pdf.setLineWidth(1);
    pdf.line(left, 94, x0 + SB_NOTES_W - pad, 94);
    return 124;
  };

  fundo();
  let y = titulo();

  if (!comments.length) {
    pdf.setFontSize(11);
    pdf.setTextColor(150, 150, 158);
    pdf.text("Nenhum comentário nesta página.", left, y);
    return;
  }

  const novaFolha = () => {
    pdf.addPage(format, "l");
    fundo();
    y = titulo(" (cont.)");
  };

  const cardPad = 12;
  for (const c of comments) {
    pdf.setFontSize(10);
    const quem = `${c.author || "—"}${c.company ? " · " + c.company : ""}`;
    const linhasQuem = pdf.splitTextToSize(quem, textW - cardPad * 2);
    const linhasTexto = pdf.splitTextToSize(c.text || "", textW - cardPad * 2);
    const alturaBloco = cardPad * 2 + linhasQuem.length * 13 + 14 + linhasTexto.length * 15;
    // não parte um comentário ao meio se ele cabe inteiro na folha seguinte
    if (y + alturaBloco > bottom && y > 124) novaFolha();

    // cartão branco por baixo do comentário
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(left, y - 12, textW, Math.min(alturaBloco, bottom - y + 12), 6, 6, "F");

    let ty = y + cardPad - 4;
    const tx = left + cardPad;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(16, 16, 19);
    linhasQuem.forEach((l) => { pdf.text(l, tx, ty); ty += 13; });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(140, 140, 150);
    pdf.text(sbStamp(c.createdAt), tx, ty); ty += 14;

    pdf.setFontSize(10.5);
    pdf.setTextColor(38, 38, 46);
    for (const l of linhasTexto) {
      if (ty > bottom) { novaFolha(); ty = y = 124; }
      pdf.text(l, tx, ty); ty += 15;
    }

    y = ty + cardPad + 6;
  }
}

async function sbExportPDF(sb, { withComments, onProgress = () => {} }) {
  // Fase indeterminada: as libs vêm da CDN e não dá para medir o download.
  onProgress(null);
  if (!window.html2canvas) await sbLoadScript("https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js");
  if (!window.jspdf)       await sbLoadScript("https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js");
  const { jsPDF } = window.jspdf;

  // Com comentários a folha fica mais larga: o storyboard ocupa a esquerda no
  // tamanho de sempre e a faixa que sobra à direita vira a coluna de
  // comentários daquela página. Sem comentários, a folha é a página pura.
  const sheetW = withComments ? SB_PAGE_W + SB_NOTES_W : SB_PAGE_W;
  const format = [sheetW, SB_PAGE_H];
  const pdf = new jsPDF({ orientation: "l", unit: "px", format, compress: true });

  const nodes = [...document.querySelectorAll("[data-sb-page]")];
  onProgress(0);

  // As páginas na tela vivem dentro de um contêiner com `transform: scale()`.
  // O html2canvas mede tudo por getBoundingClientRect, que já vem transformado —
  // capturar direto dali produzia páginas na escala errada e com o conteúdo
  // deslocado para fora do recorte (o texto sumia por completo). Por isso cada
  // página é copiada para um palco fora de vista, em tamanho natural 1:1.
  const stage = document.createElement("div");
  stage.className = "sb-exportstage";
  document.body.appendChild(stage);

  try {
    for (let i = 0; i < nodes.length; i++) {
      // Cede um frame antes de cada página: sem isso o rasterizador trava a UI e
      // a própria barra de progresso não chega a repintar.
      await sbNextFrame();
      onProgress(i / nodes.length);

      const copy = nodes[i].querySelector(".sb-p").cloneNode(true);
      stage.replaceChildren(copy);
      await sbWaitImages(stage);

      const canvas = await window.html2canvas(copy, {
        backgroundColor: "#ffffff", scale: 2, useCORS: true,
        width: SB_PAGE_W, height: SB_PAGE_H, windowWidth: SB_PAGE_W, windowHeight: SB_PAGE_H,
        scrollX: 0, scrollY: 0,
      });
      if (i > 0) pdf.addPage(format, "l");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, SB_PAGE_W, SB_PAGE_H);

      if (withComments) {
        const pageId = nodes[i].getAttribute("data-sb-page");
        const cs = (sb.comments || []).filter((c) => c.pageId === pageId);
        sbDrawNotesColumn(pdf, { index: i, total: nodes.length, comments: cs, format });
      }
    }
  } finally {
    stage.remove();
  }
  onProgress(1);
  const name = [sb.cliente, sb.produto, "V" + (sb.version || 1)].filter(Boolean).join("-") || "storyboard";
  pdf.save(`${name}${withComments ? "-com-comentarios" : ""}.pdf`);
}

/* ═══════════════════════ CONSOLE — lista de storyboards ═════════════════════ */
const StoryboardsPanel = ({ list, setList, addToast, query = "", requestOpen = null, onOpened, onOpenChange, onExit = null, requestClose = 0 }) => {
  const [openId, setOpenId] = React.useState(null);
  const [openInEdit, setOpenInEdit] = React.useState(false);   // lápis abre já editando
  const [confirmDel, setConfirmDel] = React.useState(null);
  /* Capa: a miniatura do card é o próprio botão de enviar. */
  const capaRef = React.useRef(null);
  const capaAlvo = React.useRef(null);
  const [capaBusy, setCapaBusy] = React.useState(null);

  const open = list.find((s) => s.id === openId);

  const pedirCapa = (sb) => { capaAlvo.current = sb.id; capaRef.current && capaRef.current.click(); };

  const enviarCapa = async (e) => {
    const file = e.target.files && e.target.files[0];
    const id = capaAlvo.current;
    e.target.value = "";                       // permite reenviar o mesmo arquivo
    if (!file || !id) return;
    setCapaBusy(id);
    try {
      const { coverUrl } = await window.API.uploadStoryboardCover(id, file);
      // forma funcional: entre o envio e a resposta o tempo real pode ter
      // reescrito a lista, e um `list` capturado antes desfaria aquilo.
      setList((prev) => prev.map((s) => (s.id === id ? { ...s, coverUrl } : s)));
      addToast("Capa atualizada. É ela que aparece ao compartilhar o link.", "success");
    } catch (err) { addToast(err.error || "Não foi possível enviar a capa.", "error"); }
    finally { setCapaBusy(null); }
  };

  const tirarCapa = async (sb) => {
    setCapaBusy(sb.id);
    try {
      await window.API.removeStoryboardCover(sb.id);
      setList((prev) => prev.map((s) => (s.id === sb.id ? { ...s, coverUrl: "" } : s)));
      addToast("Capa removida.", "success");
    } catch (err) { addToast(err.error || "Não foi possível remover a capa.", "error"); }
    finally { setCapaBusy(null); }
  };

  /* Pedido vindo de fora (busca global): abre o storyboard pedido. */
  React.useEffect(() => {
    if (!requestOpen) return;
    setOpenInEdit(false);
    setOpenId(requestOpen);
    onOpened && onOpened();
  }, [requestOpen]);

  /* Avisa quem hospeda o painel QUAL documento está aberto (ou null). A tela
     exclusiva usa isso para esconder a busca e para pôr o endereço do documento
     na barra do navegador. O `pathSlug` entra nas dependências porque renomear
     o storyboard muda o endereço dele. */
  React.useEffect(() => { onOpenChange && onOpenChange(open || null); }, [openId, open && open.pathSlug]);

  /* Pedido de fechar vindo de fora — o "voltar" do navegador. */
  React.useEffect(() => {
    if (!requestClose) return;
    setOpenId(null); setOpenInEdit(false);
  }, [requestClose]);

  /* Filtro da busca — só filtra o que aparece; `list` continua inteira, senão
     apagar um storyboard com a busca ativa derrubaria os escondidos. */
  const q = (query || "").trim().toLowerCase();
  const shown = !q ? list : list.filter((s) => sbMatches(s, q));

  const create = async () => {
    try {
      const sb = await window.API.addStoryboard({ cliente: "", projeto: "", categoria: "", produto: "" });
      setList([sb, ...list]);
      setOpenId(sb.id); setOpenInEdit(true);   // recém-criado nasce vazio: já entra editando
    } catch (e) { addToast(e.error || "Não foi possível criar o storyboard.", "error"); }
  };

  const remove = async (sb) => {
    try {
      await window.API.deleteStoryboard(sb.id);
      setList(list.filter((s) => s.id !== sb.id));
      setConfirmDel(null);
      addToast("Storyboard apagado. As imagens foram removidas do armazenamento.", "success");
    } catch (e) { addToast(e.error || "Não foi possível apagar.", "error"); }
  };

  if (open) {
    // key: garante estado limpo do editor ao trocar de storyboard.
    return <SBEditor key={open.id} sb={open} addToast={addToast} startInEdit={openInEdit}
      onBack={() => { setOpenId(null); setOpenInEdit(false); }}
      onExit={onExit}
      onPatch={(patch) => setList(list.map((s) => (s.id === open.id ? { ...s, ...patch } : s)))} />;
  }

  return (
    <div className="sb-panel">
      <style>{SB_CSS}</style>

      <input ref={capaRef} type="file" accept="image/*" hidden onChange={enviarCapa} />

      <div className="sb-panel-head">
        <button className="btn btn-accent" onClick={create} data-cursor="hover">
          <Icon name="plus" size={14} /> Novo storyboard
        </button>
      </div>

      {!list.length ? (
        <div className="sb-empty">
          <Icon name="folder" size={26} />
          <p>Nenhum storyboard ainda.</p>
          <button className="btn btn-accent" onClick={create}>Criar o primeiro</button>
        </div>
      ) : !shown.length ? (
        <div className="sb-empty">
          <Icon name="search" size={26} />
          <p>Nenhum storyboard para “{query}”.</p>
        </div>
      ) : (
        <div className="sb-table">
          <div className="sb-tr sb-th">
            <span className="sb-col-capa">Capa</span>
            <span>Cliente</span><span className="sb-col-proj">Projeto</span><span className="sb-col-cat">Categoria</span>
            <span className="sb-col-status">Status</span><span className="sb-col-last">Últ. comentário</span><span className="ta-r">Ações</span>
          </div>
          {shown.map((sb, i) => {
            const st = SB_STATUS[sb.status] || SB_STATUS.v1;
            return (
              <div className={`sb-tr sb-row sb-sheen ${sb.unread ? "has-unread" : ""}`} key={sb.id} onClick={() => { setOpenInEdit(false); setOpenId(sb.id); }} data-cursor="hover">
                {/* A miniatura é o botão: clicar troca a capa, sem abrir o deck. */}
                <span className="sb-col-capa" onClick={(e) => e.stopPropagation()}>
                  <button className={`sb-capa ${sb.coverUrl ? "tem" : ""}`} disabled={capaBusy === sb.id}
                    title={sb.coverUrl ? "Trocar a capa" : "Enviar uma capa — é a imagem que aparece ao colar o link do cliente"}
                    onClick={() => pedirCapa(sb)}>
                    {sb.coverUrl
                      ? <img src={sb.coverUrl} alt="" loading="lazy" />
                      : <Icon name="upload" size={14} />}
                    <i className="sb-capa-hint">{capaBusy === sb.id ? "…" : sb.coverUrl ? "trocar" : "capa"}</i>
                  </button>
                  {sb.coverUrl && (
                    <button className="sb-capa-x" title="Remover a capa" disabled={capaBusy === sb.id}
                      onClick={() => tirarCapa(sb)}>×</button>
                  )}
                </span>
                <span className="sb-c-strong">
                  {sb.unread > 0 && <span className="sb-bell" title={`${sb.unread} atualização(ões) não vista(s)`}>🔔 {sb.unread}</span>}
                  {sb.cliente || <em>sem cliente</em>}
                </span>
                <span className="sb-col-proj">{sb.projeto || "—"}</span>
                <span className="sb-col-cat">{sb.categoria || "—"}</span>
                <span className="sb-col-status"><b className={`sb-pill ${st.tone}`}>{st.label}</b></span>
                <span className="sb-c-dim sb-col-last">{sb.lastCommentAt ? sbStamp(sb.lastCommentAt) : "—"}</span>
                <span className="sb-acts" onClick={(e) => e.stopPropagation()}>
                  <button className="sb-ico" title="Editar"        onClick={() => { setOpenInEdit(true); setOpenId(sb.id); }}><Icon name="edit" size={15} /></button>
                  <button className="sb-ico" title="Compartilhar"  onClick={() => sbCopy(sbShareUrl(sb), addToast)}><Icon name="share" size={15} /></button>
                  <button className="sb-ico danger" title="Apagar" onClick={() => setConfirmDel(sb)}><Icon name="trash" size={15} /></button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {confirmDel && (
        <div className="sb-modal-bg" onClick={() => setConfirmDel(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Apagar storyboard?</h3>
            <p>
              <b>{confirmDel.cliente || "Sem cliente"}</b> — {confirmDel.projeto || "sem projeto"}.<br />
              Todas as páginas, comentários e <b>imagens enviadas</b> serão removidos definitivamente.
            </p>
            <div className="sb-modal-acts">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-accent" onClick={() => remove(confirmDel)}>Apagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═════════════════════════ CONSOLE — editor do deck ═════════════════════════ */
const SBEditor = ({ sb: initial, onBack, onPatch, addToast, startInEdit = false, onExit = null }) => {
  const [sb, setSb] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);              // trava interna
  const [salvandoVisivel, setSalvandoVisivel] = React.useState(false);  // o que o botão mostra
  const [enviando, setEnviando] = React.useState(false);                // upload de imagem em curso
  const [dirty, setDirty] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  /* Abrir uma linha cai em leitura; editar é um passo deliberado (o lápis). */
  const [editing, setEditing] = React.useState(startInEdit);
  /* Versão da página que está na tela (null = a atual). Trocar de página ou
     entrar em edição sempre devolve o documento de agora. */
  const [verView, setVerView] = React.useState(null);
  React.useEffect(() => { setVerView(null); }, [current, editing]);
  const fileRef = React.useRef(null);
  const target = React.useRef({ page: -1, slot: null });
  const digitouEm = React.useRef(0);              // instante da última tecla
  const [syncTick, setSyncTick] = React.useState(0);  // reprocessa doc remoto adiado

  /* Ao abrir, zera o sino: o admin acabou de ver as atualizações. */
  React.useEffect(() => {
    if (!initial.unread) return;
    window.API.seenStoryboard(initial.id)
      .then(() => onPatch({ unread: 0 }))
      .catch(() => {});
  }, [initial.id]);

  /* Enquanto o storyboard está aberto o console vira "aplicativo": o
     .admin-main deixa de rolar e o palco passa a ocupar a altura que sobra. */
  React.useEffect(() => {
    document.body.classList.add("sb-appmode");
    return () => document.body.classList.remove("sb-appmode");
  }, []);

  const patch = (p) => { digitouEm.current = Date.now(); setSb((s) => ({ ...s, ...p })); setDirty(true); };

  const save = async ({ silent = false } = {}) => {
    setSaving(true);
    /* A gravação automática não mexe em nada que se veja: `saving` é só a trava
       interna (impede duas gravações ao mesmo tempo), enquanto `salvandoVisivel`
       é o que o botão mostra. Antes o botão virava "Salvando…" a cada pausa da
       digitação, e era esse piscar que dava a impressão de estar salvando sem
       parar. */
    if (!silent) setSalvandoVisivel(true);
    try {
      const saved = await window.API.updateStoryboard(sb.id, {
        cliente: sb.cliente, projeto: sb.projeto, categoria: sb.categoria,
        produto: sb.produto, pages: sb.pages,
      });
      setSb(saved); onPatch(saved); setDirty(false);
      if (!silent) addToast("Storyboard salvo.", "success");
      return true;
    } catch (e) { addToast(e.error || "Não foi possível salvar.", "error"); return false; }
    finally { setSaving(false); if (!silent) setSalvandoVisivel(false); }
  };

  /* ── Sincronização entre sessões ────────────────────────────────────────
     Duas pessoas no console veem o trabalho uma da outra porque (a) tudo que
     se edita é gravado sozinho pouco depois da última tecla e (b) o servidor
     avisa por SSE, o painel rebusca a lista e o documento novo desce até aqui
     pelo `initial`.

     Por que NÃO é de 10 em 10 minutos: a gravação é justamente o que leva a
     alteração para as outras sessões — é ela que dispara o aviso do servidor.
     Espaçá-la para 10 minutos deixaria quem está do outro lado até 10 minutos
     atrasado (e o cliente, no link dele, vendo um documento velho), além de
     colocar 10 minutos de trabalho em risco a cada queda de rede ou aba
     fechada. O incômodo era o aviso na tela, não a gravação: ela continua a
     cada pausa da digitação, agora sem nada piscando.

     Ressalva honesta: a gravação é do documento inteiro, então duas pessoas no
     MESMO campo ao mesmo tempo terminam com o texto de quem gravou por último.
     Em campos/páginas diferentes convivem bem. */
  React.useEffect(() => {
    if (!editing || !dirty || saving) return;
    const t = setTimeout(() => { save({ silent: true }); }, 900);
    return () => clearTimeout(t);
  }, [editing, dirty, saving, sb]);

  /* Documento vindo de outra sessão. Não aplica por cima de alteração local
     ainda não gravada nem no meio de uma digitação — nesses casos tenta de
     novo, e o autosave acima logo libera o caminho. */
  React.useEffect(() => {
    if (!initial || initial.updatedAt === sb.updatedAt) return;
    const ocupado = dirty || saving || Date.now() - digitouEm.current < 1200;
    if (ocupado) {
      const t = setTimeout(() => setSyncTick((n) => n + 1), 500);
      return () => clearTimeout(t);
    }
    setSb(initial);
  }, [initial, dirty, saving, syncTick]);

  /* Sair da edição salva o que estiver pendente — sair com alterações soltas
     deixaria a tela de leitura mostrando algo que o cliente não recebeu. */
  const leaveEdit = async () => {
    if (dirty && !(await save())) return;   // falhou ao salvar: continua editando
    setEditing(false);
  };

  const changePage = (i, page) => patch({ pages: sb.pages.map((p, k) => (k === i ? page : p)) });

  const addPage = (at, type) => {
    const page = type === "assets"
      ? { id: sbUid("pg_"), type: "assets", title: "ASSETS", items: [] }
      : type === "disclaimer"
        ? { id: sbUid("pg_"), type: "disclaimer", text: SB_DISCLAIMER_DEFAULT }
        : { id: sbUid("pg_"), type: "scene", imageUrl: "", imagePublicId: "", imageVersion: 1, imageSince: null, imageHistory: [], placeholder: "", locucao: "", visual: "", sfx: "" };
    const pages = [...sb.pages];
    pages.splice(at, 0, page);
    patch({ pages });
    setCurrent(at);
  };

  const deletePage = async (i) => {
    const page = sb.pages[i];
    if (i < SB_LOCKED_HEAD || page.type === "end") return;   // páginas fixas do documento
    patch({ pages: sb.pages.filter((_, k) => k !== i) });
    setCurrent((c) => Math.max(0, Math.min(c, sb.pages.length - 2)));
    // Libera no armazenamento as imagens da página removida — a atual e todas
    // as versões guardadas nela.
    const assets = page.type === "assets"
      ? (page.items || []).flatMap((it) => [it, ...(it.history || [])])
      : [{ url: page.imageUrl, publicId: page.imagePublicId }, ...(page.imageHistory || [])];
    for (const a of assets) if (a.url) window.API.removeStoryboardAsset(sb.id, a.url, a.publicId).catch(() => {});
  };

  const dropAsset = (a) => { if (a?.url) window.API.removeStoryboardAsset(sb.id, a.url, a.publicId).catch(() => {}); };

  /* Aplica uma faixa nova na página, no formato que cada tipo de página usa. */
  const setSlot = (pageIdx, slotIdx, slot) => {
    const page = sb.pages[pageIdx];
    if (page.type === "assets") {
      const items = [...(page.items || [])];
      items[slotIdx] = { id: items[slotIdx]?.id || sbUid("as_"), caption: items[slotIdx]?.caption || "", ...slot };
      changePage(pageIdx, { ...page, items: items.slice(0, 4) });
    } else {
      changePage(pageIdx, { ...page, imageUrl: slot.url || "", imagePublicId: slot.publicId || "",
                            imageVersion: slot.version || 1, imageSince: slot.since || null,
                            imageHistory: slot.history || [] });
    }
  };
  const getSlot = (pageIdx, slotIdx) => {
    const page = sb.pages[pageIdx];
    if (!page) return null;
    return page.type === "assets" ? (page.items || [])[slotIdx] || null : sbSceneSlot(page);
  };

  const movePage = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sb.pages.length) return;
    const pages = [...sb.pages];
    [pages[i], pages[j]] = [pages[j], pages[i]];
    patch({ pages });
    setCurrent(j);
  };

  const pickImage = (pageIdx, slot) => {
    target.current = { page: pageIdx, slot };
    fileRef.current.value = "";
    fileRef.current.click();
  };

  /* Tira a imagem da vaga. Só aparece quando ela ainda é a única versão — com
     histórico o botão da tela é "desfazer a V<n>". */
  const dropImage = (pageIdx, slotIdx) => {
    const page = sb.pages[pageIdx];
    const slot = getSlot(pageIdx, slotIdx);
    if (!slot) return;
    dropAsset(slot);
    if (page.type === "assets") changePage(pageIdx, { ...page, items: page.items.filter((_, k) => k !== slotIdx) });
    else setSlot(pageIdx, slotIdx, { url: "", publicId: "", version: 1, since: null, history: [] });
  };

  /* Desfaz a versão do topo: a imagem dela sai do armazenamento e a anterior
     volta a valer. É o conserto de um envio errado sem gastar uma rodada. */
  const undoImage = (pageIdx, slotIdx) => {
    const slot = getSlot(pageIdx, slotIdx);
    const r = slot && sbUndoSlot(slot);
    if (!r) return;
    dropAsset(r.drop);
    setSlot(pageIdx, slotIdx, r.slot);
    addToast(`Voltou para a V${r.slot.version} desta cena.`, "success");
  };

  /* Caminho único de envio: o botão e o arrastar passam por aqui, então a regra
     de versão é a MESMA nos dois. Vaga vazia entra como V1; vaga que já tem
     imagem gasta uma rodada e vira a próxima V. Para trocar a imagem SEM gastar
     rodada, remove-se a atual antes ("remover", ou "desfazer a V<n>" quando já
     há histórico) — a vaga fica vazia e o envio seguinte volta a ser V1. */
  const enviarImagem = async (pageIdx, slotIdx, file) => {
    if (!file || pageIdx < 0) return;
    if (!/^image\//.test(file.type || "")) {
      return addToast("Isso não é uma imagem. Envie JPG, PNG, WEBP ou GIF.", "error");
    }
    const antes = getSlot(pageIdx, slotIdx) || {};
    if (antes.url && (antes.version || 1) >= SB_MAX_VER) {
      return addToast(`Esta cena já usou as ${SB_ROUNDS} rodadas de alteração.`, "error");
    }
    setEnviando(true);
    try {
      const { url, publicId } = await window.API.uploadStoryboardImage(sb.id, file);
      const novo = sbBumpSlot(antes, { url, publicId });
      setSlot(pageIdx, slotIdx, novo);
      if (novo.version > 1) addToast(`Nova versão enviada: esta cena está na V${novo.version}.`, "success");
    } catch (err) { addToast(err.error || "Falha no envio da imagem.", "error"); }
    finally { setEnviando(false); }
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    const { page: pageIdx, slot: slotIdx } = target.current;
    enviarImagem(pageIdx, slotIdx, file);
  };

  /* Arrastou um arquivo para cima da página. Mesmo caminho do botão. */
  const soltarArquivo = (pageIdx, slotIdx, file) => enviarImagem(pageIdx, slotIdx, file);

  /* Rede de segurança do arraste: um arquivo solto FORA de uma vaga faria o
     navegador abrir a imagem e sair do editor, levando junto o que ainda não
     foi gravado. Aqui a janela inteira recusa o arquivo em silêncio — as vagas
     tratam o drop antes, com stopPropagation. */
  React.useEffect(() => {
    if (!editing) return;
    const recusar = (e) => { if (sbTemArquivo(e)) e.preventDefault(); };
    window.addEventListener("dragover", recusar);
    window.addEventListener("drop", recusar);
    return () => {
      window.removeEventListener("dragover", recusar);
      window.removeEventListener("drop", recusar);
    };
  }, [editing]);

  /* Apagar comentário do cliente — só existe aqui dentro. O documento não muda,
     então a lista é ajustada na mão para não disparar o autosave. */
  const removeComment = async (cid) => {
    try {
      await window.API.deleteSbCommentAdmin(sb.id, cid);
      const comments = (sb.comments || []).filter((c) => c.id !== cid);
      setSb((s) => ({ ...s, comments }));
      onPatch({ comments });
      addToast("Comentário apagado.", "success");
    } catch (e) { addToast(e.error || "Não foi possível apagar o comentário.", "error"); }
  };

  /* ── Baixar em PDF (só fora da edição) ────────────────────────────────────
     Mesmo caminho da tela do cliente: o clique devolve a exibição para a versão
     atual e a rasterização só começa no commit seguinte, senão um documento
     aberto numa V1 antiga sairia impresso naquela versão. */
  const [exportState, setExport] = React.useState(null);
  const [pedidoPdf, setPedidoPdf] = React.useState(null);
  const [baixando, setBaixando] = React.useState(false);

  const baixarPdf = (withComments) => {
    setBaixando(true);
    setVerView(null);
    setExport({ value: null, withComments });
    setPedidoPdf({ withComments, em: Date.now() });
  };

  React.useEffect(() => {
    if (!pedidoPdf) return;
    let vivo = true;
    (async () => {
      try {
        await sbExportPDF(sb, {
          withComments: pedidoPdf.withComments,
          onProgress: (v) => vivo && setExport((s) => (s ? { ...s, value: v } : s)),
        });
        if (vivo) setTimeout(() => setExport(null), 700);   // deixa o "Concluído" aparecer
      } catch (e) {
        if (vivo) { setExport(null); addToast("Não foi possível gerar o PDF.", "error"); }
      } finally {
        if (vivo) { setBaixando(false); setPedidoPdf(null); }
      }
    })();
    return () => { vivo = false; };
  }, [pedidoPdf]);

  const st = SB_STATUS[sb.status] || SB_STATUS.v1;
  const page = sb.pages[current];
  const pageComments = (sb.comments || []).filter((c) => page && c.pageId === page.id);
  const shownComments = verView == null ? pageComments : sbCommentsAtVersion(page, pageComments, verView);
  const docNote = sbRoundsNote(sb.version || 1, "este storyboard");
  const naoEnviados = shownComments.filter((c) => !c.submitted).length;

  return (
    <div className="sb-editor">
      <style>{SB_CSS}</style>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      <header className="sb-ed-head">
        <button className="sb-back" onClick={onBack}><Icon name="chevron-left" size={16} /> Storyboards</button>

        {/* Em leitura a identificação não aparece aqui: ela está na calha do
            palco, de pé, exatamente como na tela do cliente. Só na edição o
            cabeçalho volta a ter os campos — é onde se digita. */}
        {editing && (
          <div className="sb-ed-meta">
            <input className="sb-ed-in strong" value={sb.cliente} placeholder="Cliente"   onChange={(e) => patch({ cliente: e.target.value })} />
            <input className="sb-ed-in"        value={sb.projeto} placeholder="Projeto"   onChange={(e) => patch({ projeto: e.target.value })} />
            <input className="sb-ed-in"        value={sb.produto} placeholder="Produto"   onChange={(e) => patch({ produto: e.target.value })} />
            <input className="sb-ed-in"        value={sb.categoria} placeholder="Categoria" onChange={(e) => patch({ categoria: e.target.value })} />
          </div>
        )}

        <div className="sb-ed-acts">
          <div className={`sb-versionchip ${st.tone}`}>
            <b>{st.label}</b>
            <span title={sb.lastCommentAt ? `Último comentário em ${sbStamp(sb.lastCommentAt)}` : ""}>
              {sb.lastCommentAt ? `últ. comentário ${sbStamp(sb.lastCommentAt)}` : "sem comentários"}
            </span>
          </div>
          <button className="sb-ico" title="Copiar link do cliente" onClick={() => sbCopy(sbShareUrl(sb), addToast)}><Icon name="share" size={16} /></button>
          {editing ? (
            /* Um botão só. O documento se grava sozinho pouco depois da última
               tecla, e "Concluir" grava o que estiver pendente antes de voltar
               para a leitura — o botão "Salvar/Salvo" ao lado passava o tempo
               todo apagado, dizendo apenas o que a faixa amarela já diz. */
            <button className="btn btn-accent" onClick={leaveEdit} disabled={salvandoVisivel}>
              {salvandoVisivel ? "Salvando…" : "Concluir"}
            </button>
          ) : (
            /* Baixar e sair só existem fora da edição: o PDF sairia de um
               documento em meio a alterações, e sair no meio da edição levaria
               junto o que ainda não foi gravado. */
            <React.Fragment>
              <div className="sb-dl">
                <SBBtn className="sb-ghostbtn sm" seed={19} disabled={baixando}>
                  <Icon name="download" size={15} /> Baixar PDF
                </SBBtn>
                <div className="sb-dlmenu">
                  <button onClick={() => baixarPdf(false)}>Somente o storyboard</button>
                  <button onClick={() => baixarPdf(true)}>Com os comentários</button>
                </div>
              </div>
              <button className="sb-ico accent" title="Editar este storyboard" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} />
              </button>
              {onExit && <button className="sb-ghostbtn sm" onClick={onExit}>Sair</button>}
            </React.Fragment>
          )}
        </div>
      </header>

      <div className="sb-workspace">
        {/* A tarja flutua sobre o documento em vez de ser uma linha da coluna.
            Entrando e saindo do fluxo a cada tecla, ela mudava a altura do palco
            e a folha era reescalada junto — o documento "pulava" enquanto se
            digitava. Aqui ela não ocupa espaço nenhum. */}
        {editing && dirty && !enviando && (
          <div className="sb-dirty">Alterações não salvas — o link do cliente ainda mostra a versão anterior.</div>
        )}
        {enviando && <div className="sb-enviando">Enviando a imagem…</div>}

        {/* Mesma calha da tela do cliente — mesma marcação, mesmo logo, mesma
            posição. O console deixa de ter um desenho próprio: o que se revisa
            aqui é o que o cliente vê do outro lado. */}
        <SBDeck sb={sb} editable={editing} current={current} setCurrent={setCurrent}
          onChangePage={changePage} onAddPage={addPage} onDeletePage={deletePage} onMovePage={movePage}
          onPickImage={pickImage} onDropImage={dropImage} onUndoImage={undoImage}
          onDropFile={soltarArquivo}
          viewVersion={editing ? null : verView} onPickVersion={editing ? null : setVerView}
          railTop={
            <React.Fragment>
              <div className="sb-rail-id">
                <b>{sb.cliente || "Storyboard"}</b>
                <span>{[sb.produto, sb.projeto, sb.categoria].filter(Boolean).join("  ·  ") || "—"}</span>
              </div>
              <span className="sb-rail-logo"><img src="/dual_logo.svg" alt="Framety · Grupo Skyline" /></span>
            </React.Fragment>
          } />
        <SBComments pageNo={current + 1} total={sb.pages.length} comments={shownComments}
          editable canComment={false} draft="" setDraft={() => {}} onSend={() => {}}
          viewVersion={editing ? null : verView} onAdminRemove={removeComment}
          contexto={sbPageRoundsNote(page)}
          pendingNote={naoEnviados ? `${naoEnviados} comentário(s) que o cliente ainda não enviou` : ""}
          acoes={sb.status !== "aprovado" && (
            <div className="sb-side-acts">
              <span className={`sb-vernote ${docNote.tone}`}>{docNote.text}</span>
            </div>
          )} />
      </div>

      {exportState && (
        <div className="sb-modal-bg solid">
          <div className="sb-modal sb-expmodal">
            <h3>Gerando o documento</h3>
            <p>{exportState.withComments ? "Storyboard com os comentários incluídos." : "Storyboard sem os comentários."}</p>
            <SBProgress value={exportState.value}
              label={`${[sb.cliente, sb.produto].filter(Boolean).join("-") || "storyboard"}.pdf`}
              pendingLabel="Preparando" completeLabel="Concluído" />
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════ /storyboards — o mesmo painel do console, sozinho na página ═════════
   Mesma senha, mesmos dados, mesmo tempo real: é a aba de Storyboards do
   console servida por um link próprio, sem o menu e sem o resto do console.
   Duas máquinas abertas ao mesmo tempo (aqui, no console, ou uma de cada)
   enxergam as mesmas páginas, comentários e imagens.                          */
const StoryboardIndexPage = () => {
  const [list, setList] = React.useState(null);
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [toasts, setToasts] = React.useState([]);
  const [busca, setBusca] = React.useState("");
  const [pedidoAbrir, setPedidoAbrir] = React.useState(null);
  const [aberto, setAberto] = React.useState(false);   // um storyboard está aberto?
  const [pedidoFechar, setPedidoFechar] = React.useState(0);
  /* Atalho pedido pela URL, esperando a lista chegar para virar um id. O ref
     acompanha o estado porque `aoAbrir` é estável (useCallback sem deps) e
     precisa enxergar o valor de agora. */
  const [slugPendente, setSlugPendente] = React.useState(() => sbSlugDaUrl());
  const pendenteRef = React.useRef(slugPendente);
  const ultimoAberto = React.useRef(null);

  /* ── Endereço próprio de cada documento ──────────────────────────────────
     Abrir um storyboard escreve /storyboards/<cliente>-<produto>-<projeto> na
     barra; fechar devolve /storyboards. Trocar de documento empilha (o "voltar"
     do navegador funciona); renomear o que já está aberto só corrige o endereço
     no lugar, sem criar uma volta a mais. */
  const aoAbrir = React.useCallback((sb) => {
    setAberto(!!sb);
    /* Enquanto um atalho da URL não foi resolvido, o painel ainda está de mãos
       vazias e avisa "nada aberto" — obedecer a isso apagaria justamente o
       endereço pelo qual a pessoa entrou, antes de ele abrir o documento. */
    if (!sb && pendenteRef.current) return;
    const destino = sb ? `/storyboards/${sbDocSlug(sb)}` : "/storyboards";
    if (window.location.pathname === destino) { ultimoAberto.current = sb ? sb.id : null; return; }
    const mesmoDoc = sb && ultimoAberto.current === sb.id;
    window.history[mesmoDoc ? "replaceState" : "pushState"]({}, "", destino);
    ultimoAberto.current = sb ? sb.id : null;
  }, []);

  /* Chegou por um link direto: assim que a lista existe, abre aquele documento. */
  React.useEffect(() => {
    if (!slugPendente || !list) return;
    const alvo = list.find((s) => sbDocSlug(s) === slugPendente)
      /* Atalhos gravados na v1.6.1 vinham com hífen no lugar da barra
         (/storyboards/ebm-marista-video-imersivo). Continuam abrindo. */
      || list.find((s) => sbDocSlug(s).replace(/\//g, "-") === slugPendente);
    if (alvo) {
      /* Marca antes de pedir a abertura: assim `aoAbrir` entende que já estamos
         neste documento e corrige o endereço no lugar, em vez de empilhar uma
         volta a mais no histórico só para trocar a forma do link. */
      ultimoAberto.current = alvo.id;
      setPedidoAbrir(alvo.id);
    } else {
      addToast("Storyboard não encontrado para esse link.", "error");
      window.history.replaceState({}, "", "/storyboards");
    }
    pendenteRef.current = "";
    setSlugPendente("");
  }, [slugPendente, list]);

  /* Voltar/avançar do navegador: relê o endereço e abre ou fecha conforme ele. */
  React.useEffect(() => {
    const onPop = () => {
      const slug = sbSlugDaUrl();
      if (slug) { pendenteRef.current = slug; setSlugPendente(slug); }
      else { ultimoAberto.current = null; setPedidoFechar((n) => n + 1); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* Abrir um storyboard a partir da busca global (Ctrl+Espaço). */
  React.useEffect(() => {
    const onOpen = (e) => setPedidoAbrir(e.detail?.id || null);
    window.addEventListener("framety-open-storyboard", onOpen);
    return () => window.removeEventListener("framety-open-storyboard", onOpen);
  }, []);

  /* A busca global lê daqui enquanto busca a lista dela. */
  React.useEffect(() => { if (list) window.FRAMETY_SB = list; }, [list]);

  const addToast = React.useCallback((msg, type = "error") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  /* Se já houver sessão admin ativa neste navegador, entra direto. */
  React.useEffect(() => {
    if (!window.API.getToken()) return;
    window.API.getStoryboards().then(setList).catch(() => {});
  }, []);

  /* Tempo real: o que outra sessão publicar (páginas, imagens, comentários do
     cliente) chega aqui sem recarregar — igual ao console. */
  const authed = !!list;
  React.useEffect(() => {
    if (!authed || !window.FRAMETY_LIVE) return;
    return window.FRAMETY_LIVE.on("storyboards", () => {
      window.API.getStoryboards().then(setList).catch(() => {});
    });
  }, [authed]);

  /* Sessão caiu → volta para a senha em vez de deixar a tela quebrada. */
  React.useEffect(() => {
    const onExpired = () => { setList(null); setErr("Sessão expirada. Entre novamente."); };
    window.addEventListener("framety:session-expired", onExpired);
    return () => window.removeEventListener("framety:session-expired", onExpired);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await window.API.login(pass);
      window.API.setToken(r.token);
      setList(await window.API.getStoryboards());
      setPass("");
    } catch (ex) {
      setErr(ex?.error || "Senha incorreta.");
    } finally { setBusy(false); }
  };

  const sair = () => { window.API.clearToken(); setList(null); setErr(""); };

  if (!list) {
    return (
      <div className="sb-gate">
        <style>{SB_CSS}</style>
        <form className="sb-gate-box" onSubmit={submit}>
          <img className="sb-gate-logo" src="/dual_logo.svg" alt="Framety · Grupo Skyline" />
          <h2>Storyboards</h2>
          <p>Esta área é restrita. Digite sua senha do console para continuar.</p>
          <input type="password" value={pass} autoFocus placeholder="••••"
            onChange={(e) => setPass(e.target.value)} />
          {err && <span className="sb-gate-err">{err}</span>}
          <SBBtn className="sb-okbtn" type="submit" seed={17} disabled={busy || !pass}>
            {busy ? "Verificando…" : "Entrar"}
          </SBBtn>
        </form>
      </div>
    );
  }

  return (
    <div className={`sb-standalone ${aberto ? "lendo" : ""}`}>
      <style>{SB_CSS}</style>
      {/* Com um storyboard aberto a faixa de cima sai inteira: logo, contagem e
          busca não dizem nada sobre o documento que está na tela, e são ~55px
          que a folha aproveita. O "Sair" desce para o cabeçalho do editor, ao
          lado do lápis. Ao voltar para a lista tudo reaparece. */}
      {!aberto && (
        <header className="sb-share-head">
          <img className="sb-share-logo" src="/dual_logo.svg" alt="Framety · Grupo Skyline" />
          <div className="sb-share-id">
            <b>Storyboards</b>
            <span>{list.length} documento(s) · sincronizado com o console</span>
          </div>
          <div className="sb-searchbox">
            <Icon name="search" size={14} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, projeto ou produto…" autoComplete="off" spellCheck={false} />
            {busca && <button className="sb-searchclear" onClick={() => setBusca("")} aria-label="Limpar busca">×</button>}
          </div>
          <div className="sb-share-acts">
            <button className="sb-ghostbtn" onClick={sair}>Sair</button>
          </div>
        </header>
      )}

      <StoryboardsPanel list={list} setList={setList} addToast={addToast} query={busca}
        requestOpen={pedidoAbrir} onOpened={() => setPedidoAbrir(null)} onOpenChange={aoAbrir}
        requestClose={pedidoFechar} onExit={sair} />

      {!!toasts.length && (
        <div className="sb-toasts">
          {toasts.map((t) => <div className={`sb-toast ${t.type}`} key={t.id}>{t.msg}</div>)}
        </div>
      )}
    </div>
  );
};

/* ═══════ PÚBLICO — visão do cliente (/sb/<código>) ══════════════════════════
   Só o código opaco chega aqui. O caminho legível cliente/produto/projeto virou
   endereço de edição, atrás da senha: com ele público, quem soubesse os nomes
   chegava a um storyboard alheio sem nenhum segredo. */
const StoryboardSharePage = () => {
  const ref = React.useMemo(
    () => ({ kind: "slug", value: window.location.pathname.split("/")[2] || "" }), []);

  const [sb, setSb] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [current, setCurrent] = React.useState(0);
  /* Versão da imagem em exibição nesta página (null = a atual). Ao virar a
     página tudo volta sozinho para a versão mais recente. */
  const [verView, setVerView] = React.useState(null);
  React.useEffect(() => { setVerView(null); }, [current]);
  /* Identificação do cliente: chave única do navegador, não por documento —
     quem já se apresentou num storyboard não é perguntado de novo nos outros.
     Fica no localStorage, ou seja, até ele limpar os dados do navegador.
     A chave antiga (por caminho) ainda é lida uma vez, para não represar quem
     já tinha se identificado antes desta mudança. */
  const [ident, setIdent] = React.useState(() => {
    const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
    return ler(SB_IDENT_KEY) || ler("sb_ident_" + ref.value);
  });
  const [askFor, setAskFor] = React.useState(null);   // ação pendente até se identificar
  const [draft, setDraft] = React.useState({});       // pageId → texto em digitação
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [askApprove, setAskApprove] = React.useState(false);
  const [exportState, setExport] = React.useState(null);   // {value, withComments} enquanto gera o PDF
  const [pedidoPdf, setPedidoPdf] = React.useState(null);  // exportação agendada para o próximo commit

  const fetchSb = React.useCallback(
    () => window.API.getSharedStoryboard(ref.value), [ref]);

  React.useEffect(() => {
    fetchSb().then(setSb).catch((e) => setErr(e.error || "Storyboard não encontrado."));
  }, [fetchSb]);

  const reload = () => fetchSb().then(setSb).catch(() => {});

  /* O cliente também acompanha ao vivo: páginas novas, textos e imagens que o
     console publicar aparecem sem precisar recarregar. */
  React.useEffect(() => {
    if (!window.FRAMETY_LIVE) return;
    return window.FRAMETY_LIVE.on("storyboards", () => { reload(); });
  }, [fetchSb]);

  const saveIdent = (name, company) => {
    const id = { name: name.trim(), company: company.trim() };
    setIdent(id);
    try { localStorage.setItem(SB_IDENT_KEY, JSON.stringify(id)); } catch {}
    return id;
  };

  const postComment = async (pageId, who) => {
    const text = (draft[pageId] || "").trim();
    if (!text) return;
    try {
      await window.API.addSbComment(sb.token, { pageId, author: who.name, company: who.company, text });
      setDraft((d) => ({ ...d, [pageId]: "" }));
      reload();
    } catch (e) { setNote(e.error || "Não foi possível comentar."); }
  };

  const tryComment = (pageId) => {
    if (!(draft[pageId] || "").trim()) return;
    if (ident?.name) return postComment(pageId, ident);
    setAskFor({ kind: "comment", pageId });
  };

  const removeComment = async (cid) => {
    try { await window.API.deleteSbComment(sb.token, cid); reload(); }
    catch (e) { setNote(e.error || "Não foi possível remover."); }
  };

  const submitAll = async () => {
    setBusy(true);
    try {
      const r = await window.API.submitSbComments(sb.token);
      setNote(`Comentários enviados. O storyboard passou para ${SB_STATUS[r.status]?.label || r.status}.`);
      reload();
    } catch (e) { setNote(e.error || "Não foi possível enviar."); }
    finally { setBusy(false); }
  };

  const approve = async (who) => {
    setBusy(true);
    try {
      await window.API.approveSb(sb.token, { author: who.name, company: who.company });
      setNote("Storyboard aprovado. Obrigado!");
      setAskApprove(false);
      reload();
    } catch (e) { setNote(e.error || "Não foi possível aprovar."); }
    finally { setBusy(false); }
  };

  /* O PDF sai sempre com a sequência de cenas mais atual. A exportação varre as
     páginas montadas na tela, e o pedido é feito em duas etapas de propósito:
     o clique só devolve a exibição para a versão atual e agenda; quem rasteriza
     é o efeito abaixo, que o React só executa depois de a tela já estar
     atualizada. Sem isso a rasterização competiria com o repintar. */
  const download = (withComments) => {
    setBusy(true);
    setVerView(null);
    setExport({ value: null, withComments });
    setPedidoPdf({ withComments, em: Date.now() });
  };

  React.useEffect(() => {
    if (!pedidoPdf) return;
    let vivo = true;
    (async () => {
      try {
        await sbExportPDF(sb, {
          withComments: pedidoPdf.withComments,
          onProgress: (v) => vivo && setExport((s) => (s ? { ...s, value: v } : s)),
        });
        if (vivo) setTimeout(() => setExport(null), 700);   // deixa o "Concluído" aparecer
      } catch (e) {
        if (vivo) { setExport(null); setNote("Não foi possível gerar o PDF."); }
      } finally {
        if (vivo) { setBusy(false); setPedidoPdf(null); }
      }
    })();
    return () => { vivo = false; };
  }, [pedidoPdf]);

  if (err) return <div className="sb-share-msg"><style>{SB_CSS}</style><h2>Ops</h2><p>{err}</p></div>;
  if (!sb) return <div className="sb-share-msg"><style>{SB_CSS}</style><p>Carregando storyboard…</p></div>;

  const st = SB_STATUS[sb.status] || SB_STATUS.v1;
  const pending = (sb.comments || []).filter((c) => !c.submitted);
  const approved = sb.status === "aprovado";
  const page = sb.pages[current];
  const pageComments = (sb.comments || []).filter((c) => page && c.pageId === page.id);
  /* Numa versão anterior o painel mostra só os comentários feitos enquanto ela
     estava no ar. */
  const shownComments = verView == null ? pageComments : sbCommentsAtVersion(page, pageComments, verView);
  const docNote = sbRoundsNote(sb.version || 1, "este storyboard");
  const semRodadas = sbRoundsLeft(sb.version || 1) <= 0;

  return (
    <div className="sb-share">
      <style>{SB_CSS}</style>

      <div className="sb-workspace">
        {/* A identificação do documento vai de pé, na calha do palco: é o que
            libera a altura inteira da janela para a folha. */}
        <SBDeck sb={sb} editable={false} current={current} setCurrent={setCurrent}
          onChangePage={() => {}} onAddPage={() => {}} onDeletePage={() => {}} onMovePage={() => {}}
          onPickImage={() => {}} onDropImage={() => {}} onUndoImage={() => {}}
          viewVersion={verView} onPickVersion={setVerView}
          railTop={
            <React.Fragment>
              <div className="sb-rail-id">
                <b>{sb.cliente || "Storyboard"}</b>
                <span>{[sb.produto, sb.projeto, sb.categoria].filter(Boolean).join("  ·  ") || "—"}</span>
              </div>
              <span className="sb-rail-logo"><img src="/dual_logo.svg" alt="Framety · Grupo Skyline" /></span>
            </React.Fragment>
          } />

        <div className="sb-sidecol">
          <div className="sb-sidetop">
            <div className="sb-dl">
              <SBBtn className="sb-ghostbtn" seed={13} disabled={busy}><Icon name="download" size={15} /> Baixar PDF</SBBtn>
              <div className="sb-dlmenu">
                <button onClick={() => download(false)}>Somente o storyboard</button>
                <button onClick={() => download(true)}>Com os comentários</button>
              </div>
            </div>
            <div className={`sb-versionchip ${st.tone}`}>
              <b>{st.label}</b>
              <span title={sb.lastCommentAt ? `Último comentário em ${sbStamp(sb.lastCommentAt)}` : ""}>
              {sb.lastCommentAt ? `últ. comentário ${sbStamp(sb.lastCommentAt)}` : "sem comentários"}
            </span>
            </div>
          </div>

          {note && <div className="sb-note" onClick={() => setNote("")}>{note} <em>(toque para fechar)</em></div>}
          {approved && <div className="sb-approved">✓ Este storyboard foi aprovado. Não é mais possível comentar.</div>}

          <SBComments pageNo={current + 1} total={sb.pages.length} comments={shownComments} viewVersion={verView}
          canComment={!approved} draft={page ? (draft[page.id] || "") : ""}
          setDraft={(t) => page && setDraft((d) => ({ ...d, [page.id]: t }))}
          onSend={() => page && tryComment(page.id)}
          onRemove={removeComment}
          contexto={sbPageRoundsNote(page)}
          pendingNote={pending.length ? `${pending.length} comentário(s) ainda não enviado(s)` : ""}
          acoes={!approved && (
            /* Enviar/aprovar moraram numa faixa fixa no rodapé; vieram para o pé
               do painel — é onde a ação pertence e devolve altura ao documento.
               A contagem de rodadas do storyboard fica aqui, colada no botão que
               consome uma delas. */
            <div className="sb-side-acts">
              <span className={`sb-vernote ${docNote.tone}`}>{docNote.text}</span>
              {semRodadas && (
                <p className="sb-side-note warn">
                  Para seguir ajustando, fale com a produção; aqui só resta aprovar.
                </p>
              )}
              <SBBtn className="sb-ghostbtn sm" seed={14} disabled={busy || !pending.length || semRodadas} onClick={submitAll}>
                <Icon name="send" size={14} /> Enviar e solicitar revisão
              </SBBtn>
              <SBBtn className="sb-okbtn sm" seed={15} disabled={busy} onClick={() => (ident?.name ? setAskApprove(true) : setAskFor({ kind: "approve" }))}>
                <Icon name="check" size={14} /> Aprovar storyboard
              </SBBtn>
            </div>
          )} />
        </div>
      </div>

      {exportState && (
        <div className="sb-modal-bg solid">
          <div className="sb-modal sb-expmodal">
            <h3>Gerando o documento</h3>
            <p>{exportState.withComments ? "Storyboard com os comentários incluídos." : "Storyboard sem os comentários."}</p>
            <SBProgress value={exportState.value}
              label={`${[sb.cliente, sb.produto].filter(Boolean).join("-") || "storyboard"}.pdf`}
              pendingLabel="Preparando" completeLabel="Concluído" />
          </div>
        </div>
      )}

      {askFor && (
        <SBIdentModal onCancel={() => setAskFor(null)} onConfirm={(name, company) => {
          const who = saveIdent(name, company);
          const a = askFor; setAskFor(null);
          if (a.kind === "comment") postComment(a.pageId, who);
          else setAskApprove(true);
        }} />
      )}

      {askApprove && (
        <div className="sb-modal-bg" onClick={() => setAskApprove(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Aprovar este storyboard?</h3>
            <p>Depois de aprovado o storyboard fica travado e não será mais possível comentar.</p>
            <div className="sb-modal-acts">
              <button className="sb-ghostbtn" onClick={() => setAskApprove(false)}>Cancelar</button>
              <button className="sb-okbtn" disabled={busy} onClick={() => approve(ident)}>Confirmar aprovação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Nome + empresa, pedidos uma única vez e lembrados neste navegador. */
const SBIdentModal = ({ onConfirm, onCancel }) => {
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  return (
    <div className="sb-modal-bg" onClick={onCancel}>
      <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Identifique-se</h3>
        <p>Seus comentários ficam registrados com estes dados.</p>
        <label className="sb-lbl">Nome<input value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></label>
        <label className="sb-lbl">Empresa<input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Sua empresa" /></label>
        <div className="sb-modal-acts">
          <button className="sb-ghostbtn" onClick={onCancel}>Cancelar</button>
          <button className="sb-okbtn" disabled={!name.trim()} onClick={() => onConfirm(name, company)}>Continuar</button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════ Estilos ═══════════════════════════════════ */
const SB_CSS = `
/* ── console: lista ─────────────────────────────────────────────────────── */
.sb-panel{ max-width:1320px; }
.sb-panel-head{ display:flex; align-items:center; justify-content:flex-end; gap:24px; flex-wrap:wrap; margin-bottom:14px; }
.sb-empty{ text-align:center; padding:70px 20px; color:var(--ink-mute,#9a9aa6); display:flex; flex-direction:column; align-items:center; gap:12px; }
/* Linhas soltas como cards: o brilho do anel não pode ser cortado por um
   contêiner com overflow:hidden. */
.sb-table{ display:flex; flex-direction:column; gap:10px; }
.sb-tr{ display:grid; grid-template-columns:74px 1.3fr 1.2fr 1fr 1.1fr 1.1fr 120px; gap:14px; align-items:center; padding:15px 18px; }
/* ── capa do storyboard (miniatura do hub = imagem de preview do link) ────── */
.sb-col-capa{ position:relative; display:flex; align-items:center; }
.sb-capa{ position:relative; width:74px; height:46px; border-radius:9px; overflow:hidden; cursor:pointer; padding:0;
  border:1px dashed rgba(255,255,255,0.22); background:rgba(255,255,255,0.04); color:#7b7b88;
  display:flex; align-items:center; justify-content:center; transition:.15s; }
.sb-capa.tem{ border-style:solid; border-color:rgba(255,255,255,0.14); background:#0e0e12; }
.sb-capa:hover:not(:disabled){ border-color:rgba(255,255,255,0.42); color:#fff; }
.sb-capa:disabled{ opacity:.6; cursor:default; }
.sb-capa img{ width:100%; height:100%; object-fit:cover; display:block; }
/* a legenda só aparece no hover (ou quando não há capa, para convidar ao envio) */
.sb-capa-hint{ position:absolute; inset:auto 0 0 0; font-style:normal; font-family:var(--font-mono); font-size:8.5px;
  letter-spacing:.14em; text-transform:uppercase; padding:2px 0; background:rgba(0,0,0,.62); color:#fff;
  opacity:0; transition:opacity .15s; }
.sb-capa:hover .sb-capa-hint{ opacity:1; }
.sb-capa:not(.tem) .sb-capa-hint{ opacity:.75; background:none; color:#7b7b88; }
.sb-capa-x{ position:absolute; top:-6px; right:-6px; width:18px; height:18px; border-radius:50%; cursor:pointer;
  border:1px solid rgba(255,255,255,0.2); background:#22222a; color:#c9c9d2; font-size:12px; line-height:1; padding:0;
  display:none; align-items:center; justify-content:center; }
.sb-col-capa:hover .sb-capa-x{ display:flex; }
.sb-capa-x:hover{ background:var(--accent,#E63946); border-color:transparent; color:#fff; }
.sb-th{ font-family:var(--font-mono); font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--ink-mute,#9a9aa6); padding-bottom:2px; }
/* Cards de verdade: superfície mais clara que o fundo, borda visível e uma
   sombra rasa que dá elevação. Antes eram quase invisíveis sobre o preto. */
.sb-row{ border:1px solid rgba(255,255,255,0.10); border-radius:14px; background:#17171d;
  box-shadow:0 1px 0 rgba(255,255,255,.04) inset, 0 6px 18px rgba(0,0,0,.34);
  cursor:pointer; font-size:13.5px; transition:background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
.sb-row:hover{ background:#1e1e25; border-color:rgba(255,255,255,0.20);
  transform:translateY(-1px); box-shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 10px 26px rgba(0,0,0,.44); }
/* pendência do cliente: faixa de acento na borda esquerda, sem tingir o card */
.sb-row.has-unread{ border-color:rgba(230,57,70,0.42); box-shadow:inset 3px 0 0 var(--accent,#E63946), 0 6px 18px rgba(0,0,0,.34); }
.sb-row.has-unread:hover{ box-shadow:inset 3px 0 0 var(--accent,#E63946), 0 10px 26px rgba(0,0,0,.44); }
.sb-c-strong{ font-weight:600; display:flex; align-items:center; gap:8px; }
.sb-c-strong em{ color:var(--ink-mute,#9a9aa6); font-weight:400; }
.sb-c-dim{ color:var(--ink-mute,#9a9aa6); font-family:var(--font-mono); font-size:11.5px; }
.sb-bell{ background:var(--accent,#E63946); color:#fff; border-radius:20px; padding:1px 8px; font-size:10.5px; font-family:var(--font-mono); white-space:nowrap; }
.sb-pill{ font-family:var(--font-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; padding:4px 9px; border-radius:20px; white-space:nowrap; }
.sb-pill.wait{ background:rgba(255,183,3,0.14); color:#ffb703; }
.sb-pill.ok{ background:rgba(46,196,132,0.14); color:#2ec484; }
.sb-acts{ display:flex; gap:6px; justify-content:flex-end; }
.ta-r{ text-align:right; }
.sb-ico{ background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09); color:inherit; width:32px; height:32px; border-radius:9px;
  display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition:.15s; text-decoration:none; }
.sb-ico:hover{ background:rgba(255,255,255,0.12); }
.sb-ico.danger:hover{ background:rgba(230,57,70,0.9); border-color:transparent; color:#fff; }
.sb-ico.accent{ background:rgba(230,57,70,0.14); border-color:rgba(230,57,70,0.4); color:#ff6b76; }
.sb-ico.accent:hover{ background:var(--accent,#E63946); border-color:transparent; color:#fff; }

/* ── console: editor ────────────────────────────────────────────────────── */
/* Aplicativo de revisão, não página de blog: com o storyboard aberto o
   .admin-main para de rolar e vira uma coluna; o palco fica com a altura que
   sobra e só a lista de comentários rola por dentro. */
body.sb-appmode .admin-main{ display:flex; flex-direction:column; overflow:hidden; padding:9px 11px; }
/* Com o storyboard aberto o cabeçalho do console sai de cena. Ele repetia o que
   já está na tela: o título vive na calha (como no cliente) e voltar/status/
   ações estão no cabeçalho do editor, a dois centímetros dali. São ~77px de
   moldura que viram documento — a folha é limitada pela ALTURA aqui dentro,
   então cada pixel que sai daqui aparece na página. Ao voltar para a lista o
   cabeçalho reaparece sozinho. */
body.sb-appmode .admin-topbar{ display:none; }
.sb-editor{ max-width:1760px; width:100%; flex:1; min-height:0; display:flex; flex-direction:column; }
.sb-ed-head{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; flex:none; padding-bottom:11px; margin-bottom:11px; border-bottom:1px solid rgba(255,255,255,0.08); }
.sb-ed-title{ display:flex; flex-direction:column; gap:2px; flex:1; min-width:220px; line-height:1.35; }
.sb-ed-title b{ font-size:16px; }
.sb-ed-title span{ font-family:var(--font-mono); font-size:11px; color:var(--ink-mute,#9a9aa6); }
.sb-back{ background:none; border:none; color:var(--ink-mute,#9a9aa6); cursor:pointer; display:flex; align-items:center; gap:5px; font-size:13px; padding:6px 4px; }
.sb-back:hover{ color:#fff; }
.sb-ed-meta{ display:flex; gap:8px; flex-wrap:wrap; flex:1; min-width:280px; }
.sb-ed-in{ background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:9px; padding:8px 11px; color:inherit; font-size:13px; min-width:120px; flex:1; }
.sb-ed-in.strong{ font-weight:600; }
.sb-ed-in:focus{ outline:none; border-color:var(--accent,#E63946); }
/* Em leitura o cabeçalho tem só o voltar à esquerda e as ações à direita — a
   identificação mora na calha, como no cliente. */
.sb-ed-acts{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-left:auto; }
/* Uma linha para o status e outra para a data, nenhuma delas quebrando: o
   "Último comentário em 04/08/2026, 12:27" vinha partido no meio. */
.sb-versionchip{ display:flex; flex-direction:column; justify-content:center; gap:3px; padding:7px 13px; border-radius:10px;
  min-width:0; overflow:hidden; background:rgba(255,183,3,0.12); border:1px solid rgba(255,183,3,0.3); }
.sb-versionchip.ok{ background:rgba(46,196,132,0.12); border-color:rgba(46,196,132,0.32); }
.sb-versionchip b{ font-size:12.5px; font-weight:600; letter-spacing:.02em; line-height:1.1; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.sb-versionchip span{ font-family:var(--font-mono); font-size:9.5px; letter-spacing:.04em; line-height:1.1; opacity:.72;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
/* Sobreposta ao documento, nunca no fluxo: é o que impede a folha de ser
   reescalada a cada tecla. Não recebe clique (pointer-events:none) porque é só
   recado — não pode roubar um clique do que está embaixo. */
.sb-dirty{ position:absolute; top:8px; left:0; right:0; z-index:40; margin:0 auto; width:max-content;
  max-width:min(92%, 640px); pointer-events:none; text-align:center;
  background:rgba(40,30,4,0.92); border:1px solid rgba(255,183,3,0.4); color:#ffb703; border-radius:10px;
  padding:8px 14px; font-size:12.5px; box-shadow:0 10px 30px rgba(0,0,0,.55);
  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }

/* ── palco horizontal (uma página por vez) ──────────────────────────────── */
/* O palco não tem mais altura em vh: ele ocupa a linha que sobra do pai e o
   min-height:0 é o que permite encolher (item de grid/flex não encolhe sem
   ele, e a página voltaria a rolar). */
/* A folha é limitada pela altura, então alargar a coluna de comentários não
   custa documento — e o texto respira. */
/* position:relative para a tarja de "não salvo" poder flutuar sobre o documento
   sem entrar no fluxo (ver .sb-dirty). */
.sb-workspace{ position:relative; display:grid; grid-template-columns:minmax(0,1fr) clamp(260px,21vw,370px); gap:14px; align-items:stretch;
  flex:1; min-height:0; }
/* As setas deixaram de ser colunas do grid e passaram a flutuar sobre as
   bordas do palco: são ~96px de largura que voltam para o documento. */
/* Palco = calha vertical + folha. Nada de faixa horizontal: a folha é limitada
   pela ALTURA (1280×994 numa janela mais larga que alta), então tudo que era
   cabeçalho virou coluna estreita ao lado e a altura inteira sobrou para o
   documento. */
/* As três colunas encolhem até o conteúdo e o conjunto fica centrado: a coluna
   do meio tem a largura da folha (vem do JS), então a calha encosta no papel em
   vez de ficar na borda do palco com a sobra da coluna no meio. */
.sb-stage{ position:relative; display:grid; grid-template-columns:auto auto auto; justify-content:center;
  gap:0 ${SB_RAIL_GAP}px; align-items:stretch; min-width:0; min-height:0; }
.sb-frame{ position:relative; grid-column:2; min-height:0; height:100%; display:flex; align-items:center; justify-content:center; }
/* Com o tamanho exato da folha, a moldura passa a ser o papel: é ela que leva a
   sombra (a viewport recorta a esteira de páginas e cortaria a sombra rente à
   borda) e é sobre as bordas dela que as setas flutuam. */
.sb-frame.hug{ height:auto; align-self:center; border-radius:14px; box-shadow:0 18px 60px rgba(0,0,0,.5); }
.sb-frame.hug .sb-pagewrap{ box-shadow:none; }
.sb-viewport{ overflow:hidden; min-height:0; height:100%; width:100%; display:flex; align-items:center; justify-content:center; }

/* ── arrastar e soltar imagem ───────────────────────────────────────────────
   O realce vive DENTRO da folha, então some por completo quando não se está
   arrastando — e a exportação em PDF, que acontece fora de um arraste, nunca o
   encontra. */
.sb-p.soltando, .sb-mo.soltando{ outline:3px dashed var(--accent,#E63946); outline-offset:-6px; }
.sb-p.soltando{ outline-offset:-10px; }
.sb-solta-aviso{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:12;
  padding:10px 18px; border-radius:12px; white-space:nowrap; pointer-events:none;
  font-family:var(--font-sans,'Inter',system-ui,sans-serif); font-size:15px; font-weight:600; letter-spacing:.01em;
  background:rgba(8,8,10,.9); color:#f2f2f4; border:1px solid rgba(255,255,255,0.2);
  box-shadow:0 12px 34px rgba(0,0,0,.6); }
/* o tom diz a consequência antes de soltar: verde entra como primeira imagem,
   âmbar gasta uma rodada, vermelho não vai acontecer */
.sb-solta-aviso.ok{ border-color:rgba(46,196,132,.55); color:#7ff0bf; }
.sb-solta-aviso.aviso{ border-color:rgba(255,183,3,.55); color:#ffd166; }
.sb-solta-aviso.bloq{ border-color:rgba(230,57,70,.6); color:#ff8b93; }
/* enviando: faixa discreta sobre o documento, sem mexer no fluxo */
.sb-enviando{ position:absolute; top:8px; left:0; right:0; z-index:41; margin:0 auto; width:max-content;
  pointer-events:none; padding:8px 14px; border-radius:10px; font-size:12.5px;
  background:rgba(8,8,10,.9); border:1px solid rgba(255,255,255,0.18); color:#e9e9f1;
  box-shadow:0 10px 30px rgba(0,0,0,.55); }

/* ── grade (tecla G): todas as páginas de uma vez ──────────────────────────
   Não é uma segunda montagem do documento: é a MESMA esteira de páginas, que
   deixa de ser uma faixa horizontal e passa a se quebrar em colunas, com a
   escala das miniaturas. Com muitas páginas, rola. */
.sb-frame.emgrade{ width:100%; height:100%; align-self:stretch; }
.sb-viewport.grade{ overflow-y:auto; overflow-x:hidden; align-items:flex-start; justify-content:center; padding:8px 4px 14px; }
.sb-viewport.grade .sb-track{ display:grid; grid-template-columns:repeat(var(--sb-cols,4), max-content);
  gap:var(--sb-vao,14px); width:auto; height:auto; transform:none; justify-content:center; align-content:start; transition:none; }
.sb-viewport.grade .sb-slide{ flex:none; width:auto; height:auto; position:relative; }
/* o conteúdo da página não recebe clique na grade — quem responde é a moldura
   de seleção por cima, senão clicar numa miniatura em modo edição focaria um
   campo de texto em vez de abrir a página */
.sb-viewport.grade .sb-pagewrap{ pointer-events:none; box-shadow:0 6px 18px rgba(0,0,0,.45); }
.sb-gridpick{ position:absolute; inset:0; z-index:8; cursor:pointer; padding:0; background:none;
  border:2px solid transparent; border-radius:14px; display:flex; align-items:flex-end; justify-content:flex-start;
  transition:border-color .14s, background .14s; }
.sb-gridpick:hover{ border-color:var(--accent,#E63946); background:rgba(230,57,70,0.10); }
.sb-gridpick span{ margin:6px; font-family:var(--font-mono); font-size:10.5px; font-weight:600; line-height:1;
  padding:3px 6px; border-radius:6px; background:rgba(8,8,10,.82); color:#f2f2f4; }
.sb-slide.atual .sb-gridpick{ border-color:var(--accent,#E63946); }
.sb-slide.atual .sb-gridpick span{ background:var(--accent,#E63946); }

/* ── calhas verticais ───────────────────────────────────────────────────── */
.sb-rail{ display:flex; flex-direction:column; align-items:center; min-height:0; }
/* esquerda: só a identificação do documento, centrada na altura, com o logo
   ancorado no pé para não puxar o bloco para baixo */
.sb-rail-l{ grid-column:1; width:72px; position:relative; justify-content:center; padding:6px 0 150px; }
.sb-rail-id{ writing-mode:vertical-rl; transform:rotate(180deg); display:flex; align-items:flex-start; gap:11px;
  max-height:100%; overflow:hidden; line-height:1.2; }
.sb-rail-id b{ font-size:16px; font-weight:600; letter-spacing:.09em; text-transform:uppercase; white-space:nowrap; }
.sb-rail-id span{ font-family:var(--font-mono); font-size:10px; letter-spacing:.19em; text-transform:uppercase; color:#8c8c99;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
/* o logo não acompanha writing-mode: gira por transform, com a caixa trocada */
.sb-rail-logo{ position:absolute; left:50%; bottom:8px; transform:translateX(-50%);
  width:22px; height:128px; display:flex; align-items:center; justify-content:center; }
.sb-rail-logo img{ height:19px; width:auto; max-width:none; flex:none; transform:rotate(-90deg); opacity:.85; }
/* direita: versões da cena no topo, paginação na base */
.sb-rail-r{ grid-column:3; width:58px; justify-content:space-between; padding:2px 0; }
.sb-railtop, .sb-railfoot{ display:flex; flex-direction:column; align-items:center; gap:14px; flex:none; }
.sb-track{ display:flex; width:100%; height:100%; transition:transform .32s cubic-bezier(.4,0,.2,1); }
.sb-slide{ flex:0 0 100%; width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
.sb-pagewrap{ position:relative; border-radius:14px; background:#fff; flex:none;
  box-shadow:0 18px 60px rgba(0,0,0,.5); }
.sb-pageclip{ position:absolute; inset:0; border-radius:14px; overflow:hidden; z-index:1; }
.sb-pagescale{ width:${SB_PAGE_W}px; height:${SB_PAGE_H}px; transform-origin:0 0; }

/* ── reflexo no hover ─────────────────────────────────────────────────────
   Substitui o anel cônico animado. É só um brilho diagonal que atravessa o
   elemento ao passar o mouse: CSS puro, sem rAF e sem pintar a cada quadro. */
.sb-sheen{ position:relative; isolation:isolate; overflow:hidden; }
.sb-sheen::after{
  content:''; position:absolute; inset:0; z-index:3; pointer-events:none;
  background:linear-gradient(104deg,
    transparent 38%,
    rgba(255,255,255,.10) 47%,
    rgba(255,255,255,.16) 50%,
    rgba(255,255,255,.06) 55%,
    transparent 64%);
  transform:translateX(-115%);
  transition:transform .62s cubic-bezier(.33,0,.2,1);
}
.sb-sheen:hover::after, .sb-sheen:focus-visible::after{ transform:translateX(115%); }
.sb-sheen:disabled::after{ display:none; }
@media (prefers-reduced-motion:reduce){ .sb-sheen::after{ transition:none; display:none; } }
@media (forced-colors:active){ .sb-sheen::after{ display:none; } }
/* o reflexo é absoluto: não vira coluna do grid nem cobre o conteúdo da linha */
.sb-row > *{ position:relative; z-index:2; }
.sb-p{ width:${SB_PAGE_W}px; height:${SB_PAGE_H}px; background:#fff; color:#101013; position:relative; overflow:hidden;
  font-family:'JetBrains Mono', ui-monospace, monospace; }
/* Flutuam sobre a página; o vidro fosco mantém a legibilidade sobre o branco. */
.sb-nav{ position:absolute; top:50%; transform:translateY(-50%); z-index:6;
  width:42px; height:70px; border-radius:12px; border:1px solid rgba(255,255,255,0.16);
  background:rgba(12,12,16,.52); backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px);
  color:#fff; font-size:24px; line-height:1; cursor:pointer; transition:background .15s, opacity .15s; }
.sb-nav:hover:not(:disabled){ background:rgba(12,12,16,.78); }
.sb-nav:disabled{ opacity:.16; cursor:default; }
.sb-nav.prev{ left:6px; }
.sb-nav.next{ right:6px; }
/* contador e bolinhas, agora de pé na calha */
.sb-counter{ writing-mode:vertical-rl; transform:rotate(180deg); font-family:var(--font-mono); font-size:12.5px; font-weight:600; }
.sb-counter i{ font-style:normal; opacity:.5; font-weight:400; }
/* atalho da grade, no pé da calha */
.sb-gradebtn{ display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; padding:6px 5px;
  border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04); color:#9a9aa6; border-radius:9px; transition:.15s; }
.sb-gradebtn:hover{ background:rgba(255,255,255,0.12); color:#fff; }
.sb-gradebtn.on{ background:rgba(230,57,70,0.16); border-color:rgba(230,57,70,0.42); color:#ff6b76; }
.sb-gradebtn i{ font-style:normal; font-family:var(--font-mono); font-size:9px; letter-spacing:.06em; }
/* ── abas de versão da página (os quadradinhos acima da folha) ───────────────
   Aceso = versão que está na tela. Apagado = versão anterior, clicável para
   comparar. Pontilhado = rodada que ainda não foi usada. */
.sb-verbar{ display:flex; flex-direction:column; align-items:center; gap:7px; }
.sb-verbar-lbl{ writing-mode:vertical-rl; transform:rotate(180deg); font-family:var(--font-mono); font-size:9px;
  letter-spacing:.18em; text-transform:uppercase; color:#7b7b88; }
.sb-verchips{ display:flex; flex-direction:column; align-items:center; gap:5px; }
/* As versões já usadas ficam sólidas e legíveis — só a acesa é vermelha. As
   rodadas que ainda cabem ficam pontilhadas, mas ainda dá para ler o número. */
.sb-verchip{ width:38px; height:26px; padding:0; border-radius:7px; cursor:pointer;
  font-family:var(--font-mono); font-size:11px; font-weight:600; letter-spacing:.04em; line-height:1; transition:.15s;
  display:inline-flex; align-items:center; justify-content:center; flex:none;
  border:1px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.12); color:#e9e9f1; }
.sb-verchip.past:hover:not(:disabled){ background:rgba(255,255,255,0.24); border-color:rgba(255,255,255,0.55); color:#fff; }
.sb-verchip.on{ width:46px; height:30px; font-size:12px; background:var(--accent,#E63946); border-color:transparent; color:#fff;
  box-shadow:0 5px 16px rgba(230,57,70,.5), inset 0 1px 0 rgba(255,255,255,.25); }
.sb-verchip.free{ border-style:dashed; border-color:rgba(255,255,255,0.24); background:rgba(255,255,255,0.03);
  color:rgba(255,255,255,0.4); font-weight:400; cursor:default; }
.sb-verchip:disabled{ cursor:default; }
.sb-vernote{ font-family:var(--font-mono); font-size:11px; letter-spacing:.02em; color:#b6b6c4;
  border:1px solid transparent; border-radius:20px; padding:4px 11px; }
.sb-vernote.warn{ color:#ffb703; background:rgba(255,183,3,.1); border-color:rgba(255,183,3,.3); }
.sb-vernote.stop{ color:#ff6b76; background:rgba(230,57,70,.12); border-color:rgba(230,57,70,.34); }
/* tarja de "isto é a versão antiga" — mora fora da folha, então não vai no PDF */
.sb-pastflag{ position:absolute; left:0; right:0; top:0; z-index:5; text-align:center;
  background:rgba(255,183,3,.94); color:#241a00; font-family:var(--font-mono); font-size:11px;
  letter-spacing:.1em; text-transform:uppercase; padding:5px 10px; pointer-events:none; }

.sb-tools{ display:flex; flex-direction:column; align-items:center; gap:6px; }
.sb-railbtn, .sb-railplus{ width:32px; height:32px; border-radius:9px; border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.05); color:inherit; cursor:pointer; font-size:15px; line-height:1; }
.sb-railbtn:hover:not(:disabled), .sb-railplus:hover{ background:rgba(255,255,255,0.13); }
.sb-railbtn:disabled{ opacity:.28; cursor:default; }
.sb-railbtn.danger:hover:not(:disabled){ background:#e63946; border-color:transparent; color:#fff; }
.sb-railadd{ position:relative; }
.sb-railplus{ background:var(--accent,#E63946); border-color:transparent; color:#fff; font-size:19px; }
.sb-railmenu{ position:absolute; left:38px; bottom:0; background:#17171c; border:1px solid rgba(255,255,255,0.12); border-radius:10px;
  padding:5px; display:none; flex-direction:column; min-width:200px; z-index:20; box-shadow:0 12px 30px rgba(0,0,0,.5); }
.sb-railadd:hover .sb-railmenu{ display:flex; }
.sb-railmenu button{ background:none; border:none; color:inherit; text-align:left; padding:8px 10px; border-radius:7px; cursor:pointer; font-size:12.5px; }
.sb-railmenu button:hover{ background:rgba(255,255,255,0.1); }

/* numeração impressa na página */
.sb-pageno{ position:absolute; right:38px; top:28px; font-size:15px; color:#a8a8b2; letter-spacing:.06em; z-index:4; }
.sb-pageno i{ font-style:normal; opacity:.55; font-size:12px; }
.sb-pageno.light{ color:rgba(255,255,255,.92); text-shadow:0 1px 6px rgba(0,0,0,.55); }

/* capa / contracapa */
.sb-p-cover, .sb-p-end{ display:flex; align-items:center; justify-content:center; }
/* Variante escura do logo em arquivo próprio, e não filter:invert() — o
   html2canvas ignora filtros CSS e o logo saía branco no branco do PDF. */
.sb-logo-lg{ width:520px; }
.sb-logo-sm{ position:absolute; right:38px; bottom:26px; width:150px; }
.sb-cover-foot{ position:absolute; left:52px; bottom:40px; }
.sb-cover-code{ font-size:21px; letter-spacing:.02em; font-weight:500; }
.sb-cover-date{ font-size:13px; color:#8a8a93; margin-top:5px; }

/* disclaimer */
.sb-p-disc{ display:flex; align-items:center; padding:0 68px; }
.sb-disc-txt{ font-size:21px; line-height:1.62; text-align:justify; font-weight:500; width:100%; }

/* assets */
.sb-p-assets{ padding:44px 52px 70px; display:flex; flex-direction:column; }
.sb-assets-title{ font-size:30px; font-weight:700; letter-spacing:.02em; margin-bottom:18px; }
.sb-mosaic{ flex:1; display:grid; gap:20px; min-height:0; }
.sb-mosaic.n1{ grid-template-columns:1fr; }
.sb-mosaic.n2{ grid-template-columns:1fr 1fr; }
.sb-mosaic.n3{ grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; }
.sb-mosaic.n3 .sb-mo:first-child{ grid-row:span 2; }
.sb-mosaic.n4{ grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; }
.sb-mo{ margin:0; display:flex; flex-direction:column; min-height:0; }
.sb-mo-cap{ font-size:19px; color:#8a8a93; text-align:center; margin-bottom:8px; }
.sb-mo-img{ flex:1; position:relative; min-height:0; background:#f2f2f4; }
.sb-mo-img img{ width:100%; height:100%; object-fit:cover; display:block; }
.sb-mo-empty{ height:100%; display:flex; align-items:center; justify-content:center; color:#b0b0b8; font-size:15px; }
.sb-mo-tools, .sb-scene-tools{ position:absolute; left:8px; top:8px; display:flex; gap:6px; z-index:5; }
.sb-minibtn{ background:rgba(0,0,0,.72); color:#fff; border:none; border-radius:7px; padding:6px 11px; font-size:12px; cursor:pointer; font-family:inherit; }
.sb-minibtn:hover{ background:#000; }
.sb-minibtn.danger:hover{ background:#e63946; }
.sb-minibtn.accent{ background:var(--accent,#E63946); }
.sb-minibtn.accent:hover:not(:disabled){ background:#ff5763; }
.sb-minibtn:disabled{ opacity:.45; cursor:not-allowed; }
.sb-mo-add{ border:2px dashed #ccccd4; background:#fafafc; color:#8a8a93; border-radius:6px; cursor:pointer; font-family:inherit;
  font-size:15px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:120px; }
.sb-mo-add span{ font-size:30px; line-height:1; }
.sb-mo-add:hover{ border-color:#e63946; color:#e63946; }

/* cena */
.sb-p-scene{ display:flex; flex-direction:column; }
.sb-scene-img{ position:relative; width:${SB_PAGE_W}px; height:720px; flex:none; background:#000; }
.sb-scene-img img{ width:100%; height:100%; object-fit:cover; display:block; }
.sb-scene-img.empty{ display:flex; align-items:center; justify-content:center; padding:0 90px; }
.sb-scene-ph{ color:#fff; font-size:22px; line-height:1.55; text-align:center; width:100%; opacity:.92; }
.sb-scene-ph .sb-ph{ color:rgba(255,255,255,.42); }
.sb-scene-box{ flex:1; background:#fff; padding:26px 52px 0; position:relative; }
.sb-scene-title{ font-size:34px; font-weight:700; letter-spacing:.06em; margin:0 0 10px; }
.sb-field{ margin-bottom:9px; }
.sb-field-lbl{ display:block; font-size:11.5px; letter-spacing:.12em; color:#a8a8b2; margin-left:36px; }
.sb-field-row{ display:flex; align-items:flex-start; gap:9px; }
.sb-field-ico{ font-size:17px; width:26px; text-align:center; flex:none; padding-top:1px; }
.sb-field-val{ flex:1; font-size:19px; font-style:italic; line-height:1.42; }
.sb-ph{ color:#c2c2ca; font-style:italic; }

/* edição in-place */
.sb-edit{ background:rgba(230,57,70,.05); border:1px dashed rgba(230,57,70,.45); border-radius:4px; padding:2px 6px;
  font:inherit; color:inherit; letter-spacing:inherit; line-height:inherit; text-align:inherit; width:100%; resize:none; overflow:hidden; display:block; }
.sb-edit:focus{ outline:none; background:rgba(230,57,70,.09); border-style:solid; }
.sb-scene-ph.sb-edit{ color:#fff; background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.4); }

/* ── painel de comentários ──────────────────────────────────────────────── */
/* Acompanha a altura do palco (o pai é align-items:stretch) e nunca cresce
   além dela — o único scroll da tela é o .sb-side-body aqui dentro. */
.sb-side{ display:flex; flex-direction:column; gap:10px; min-width:0; border:1px solid rgba(255,255,255,0.10);
  border-radius:14px; padding:15px; background:#141419; height:100%; min-height:0; overflow:hidden; }
.sb-side > *{ position:relative; z-index:2; }
.sb-side-head{ display:flex; flex-direction:column; gap:2px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08); }
.sb-side-head b{ font-size:13.5px; }
.sb-side-head span{ font-family:var(--font-mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-mute,#9a9aa6); }
.sb-side-head .sb-vernote{ text-transform:none; letter-spacing:.02em; padding:4px 0 0; align-self:flex-start; }
.sb-side-body{ flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:9px; min-height:0; }
.sb-side-empty{ font-size:12.5px; color:var(--ink-mute,#9a9aa6); margin:6px 0; }
.sb-side-note{ font-size:11px; color:var(--ink-mute,#9a9aa6); margin:0; padding-top:8px; border-top:1px solid rgba(255,255,255,0.07); }
.sb-cmt{ background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09); border-radius:11px; padding:11px 12px; font-size:13px; }
.sb-cmt.draft{ border-color:rgba(255,183,3,0.4); background:rgba(255,183,3,0.07); }
.sb-cmt-who{ display:flex; align-items:center; gap:8px; margin-bottom:7px; }
.sb-cmt-av{ width:26px; height:26px; border-radius:50%; background:var(--accent,#E63946); color:#fff; flex:none;
  display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; }
.sb-cmt-who b{ display:block; font-size:12.5px; line-height:1.25; }
.sb-cmt-co{ display:block; font-size:10.5px; color:var(--ink-mute,#9a9aa6); }
.sb-cmt p{ margin:0; line-height:1.5; white-space:pre-wrap; }
.sb-cmt-foot{ display:flex; align-items:center; gap:9px; margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,0.07); }
.sb-cmt-foot time{ font-family:var(--font-mono); font-size:10px; color:var(--ink-mute,#9a9aa6); }
.sb-cmt-tag{ font-family:var(--font-mono); font-size:9.5px; letter-spacing:.09em; text-transform:uppercase; color:#ffb703; }
.sb-cmt-del{ margin-left:auto; background:none; border:none; color:var(--ink-mute,#9a9aa6); font-size:11px; cursor:pointer; text-decoration:underline; padding:0; }
.sb-cmt-del:hover{ color:#e63946; }
.sb-cmt-del.armed{ color:#e63946; font-weight:600; text-decoration:none; }
/* de qual rodada é este comentário — some a dúvida ao comparar V1 com V2 */
.sb-cmt-ver{ margin-left:auto; font-family:var(--font-mono); font-size:9.5px; letter-spacing:.08em;
  color:var(--ink-mute,#9a9aa6); border:1px solid rgba(255,255,255,0.14); border-radius:20px; padding:2px 7px; flex:none; }
.sb-side-ver{ font-style:normal; color:#ffb703; }
.sb-side-note.warn{ color:#ffb703; }
.sb-cmt-new{ display:flex; flex-direction:column; gap:7px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); }
.sb-cmt-new textarea{ background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:9px 11px;
  color:inherit; font-family:inherit; font-size:13px; min-height:70px; resize:vertical; }
.sb-cmt-new textarea:focus{ outline:none; border-color:var(--accent,#E63946); }

/* ── visão pública do cliente ───────────────────────────────────────────── */
/* Mesma regra do console: a tela do cliente é um app de revisão. Altura fixa
   da viewport, nada rola a não ser a lista de comentários. */
/* A folha é limitada pela ALTURA (1280×994 numa janela mais larga que alta), então
   cada pixel de moldura vertical que sai daqui vira documento maior na tela. Por
   isso o cabeçalho é enxuto e o palco tem uma faixa só. */
.sb-share{ height:100vh; height:100dvh; overflow:hidden; display:flex; flex-direction:column;
  background:#08080a; color:#f2f2f4; padding:8px clamp(8px,1.2vw,14px);
  font-family:var(--font-sans,'Inter',system-ui,sans-serif); }
.sb-share > .sb-workspace{ flex:1; min-height:0; }
/* coluna da direita: PDF + status no topo, comentários ocupando o resto */
.sb-sidecol{ display:flex; flex-direction:column; gap:9px; min-height:0; min-width:0; }
.sb-sidetop{ flex:none; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.sb-sidetop .sb-versionchip{ flex:1; min-width:0; }
.sb-sidecol > .sb-side{ flex:1; min-height:0; }
.sb-share-msg{ min-height:100vh; background:#08080a; color:#f2f2f4; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  font-family:var(--font-sans,'Inter',system-ui,sans-serif); }
.sb-share-head{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; flex:none; padding-bottom:7px; margin-bottom:7px; border-bottom:1px solid #1e1e24; }
.sb-share-logo{ height:24px; }
.sb-share-id{ display:flex; flex-direction:column; line-height:1.3; }
.sb-share-id b{ font-size:15px; }
.sb-share-id span{ font-family:var(--font-mono); font-size:10.5px; color:#9a9aa6; }
.sb-share-acts{ margin-left:auto; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.sb-ghostbtn, .sb-okbtn{ display:inline-flex; align-items:center; gap:7px; border-radius:10px; padding:9px 15px; font-size:13px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.06); color:inherit; font-family:inherit; text-decoration:none; }
.sb-ghostbtn.sm{ padding:6px 12px; font-size:12px; align-self:flex-start; }
.sb-ghostbtn:hover:not(:disabled){ background:rgba(255,255,255,0.13); }
.sb-ghostbtn:disabled, .sb-okbtn:disabled{ opacity:.45; cursor:default; }
.sb-okbtn{ background:#2ec484; border-color:transparent; color:#04231a; font-weight:600; justify-content:center; }
.sb-okbtn:hover:not(:disabled){ filter:brightness(1.08); }
.sb-dl{ position:relative; }
.sb-dlmenu{ position:absolute; right:0; top:40px; background:#17171c; border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:5px;
  display:none; flex-direction:column; min-width:210px; z-index:30; box-shadow:0 12px 30px rgba(0,0,0,.5); }
.sb-dl:hover .sb-dlmenu{ display:flex; }
.sb-dlmenu button{ background:none; border:none; color:inherit; text-align:left; padding:9px 11px; border-radius:7px; cursor:pointer; font-size:13px; font-family:inherit; }
.sb-dlmenu button:hover{ background:rgba(255,255,255,0.1); }
.sb-note{ background:rgba(46,196,132,0.12); border:1px solid rgba(46,196,132,0.35); border-radius:11px; padding:10px 13px; font-size:12.5px; cursor:pointer; flex:none; }
.sb-note em{ opacity:.6; font-size:11px; }
.sb-approved{ background:rgba(46,196,132,0.12); border:1px solid rgba(46,196,132,0.35); border-radius:11px; padding:10px 13px; font-size:13px; flex:none; }
/* As ações do cliente moram no pé do painel de comentários — a faixa de rodapé
   de largura inteira sumiu, e aquela altura foi para o documento. */
.sb-side-acts{ flex:none; display:flex; flex-direction:column; gap:7px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); }
.sb-side-acts > .sb-vernote{ align-self:stretch; text-align:center; }
/* contagem de não enviados: mora no fim da lista, junto dos comentários */
.sb-side-pending{ margin:2px 0 0; font-family:var(--font-mono); font-size:10.5px; letter-spacing:.02em; color:#ffb703;
  background:rgba(255,183,3,0.1); border:1px solid rgba(255,183,3,0.28); border-radius:9px; padding:7px 10px; text-align:center; }
.sb-side-acts .sb-ghostbtn, .sb-side-acts .sb-okbtn{ width:100%; justify-content:center; align-self:auto; }
.sb-share-foot > span{ font-family:var(--font-mono); font-size:11.5px; color:#9a9aa6; margin-right:auto; }

/* índice protegido */
.sb-gate{ min-height:100vh; background:#08080a; color:#f2f2f4; display:flex; align-items:center; justify-content:center; padding:20px;
  font-family:var(--font-sans,'Inter',system-ui,sans-serif); }
.sb-gate-box{ width:100%; max-width:380px; display:flex; flex-direction:column; gap:12px; text-align:center;
  background:#121216; border:1px solid rgba(255,255,255,0.1); border-radius:18px; padding:30px 26px; }
.sb-gate-box > *, .sb-modal > *{ position:relative; z-index:2; }
.sb-gate-logo{ height:30px; margin:0 auto 6px; }
.sb-gate-box h2{ margin:0; font-size:20px; }
.sb-gate-box p{ margin:0 0 6px; font-size:13px; color:#9a9aa6; line-height:1.55; }
.sb-gate-box input{ background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:10px;
  padding:11px 13px; color:#f2f2f4; font-size:15px; text-align:center; letter-spacing:.2em; font-family:inherit; }
.sb-gate-box input:focus{ outline:none; border-color:var(--accent,#E63946); }
.sb-gate-err{ color:#e63946; font-size:11.5px; font-family:var(--font-mono); }
/* ── /storyboards: o painel do console sozinho na página ────────────────────
   Mesma moldura de app da visão do cliente: a página não rola, quem rola é a
   lista (ou, com um storyboard aberto, só o painel de comentários). */
.sb-standalone{ height:100vh; height:100dvh; overflow:hidden; display:flex; flex-direction:column;
  background:#08080a; color:#f2f2f4; padding:12px clamp(12px,2vw,22px);
  font-family:var(--font-sans,'Inter',system-ui,sans-serif); }
.sb-standalone > .sb-panel{ flex:1; min-height:0; overflow-y:auto; width:100%; margin:0 auto; padding-right:4px; }
.sb-standalone > .sb-editor{ max-width:none; }
/* Com o documento aberto a moldura da página encolhe para a mesma da tela do
   cliente — aqui a folha é limitada pela altura, então isto é documento. */
.sb-standalone.lendo{ padding:8px clamp(8px,1.2vw,14px); }
/* barra de busca da tela exclusiva */
.sb-searchbox{ display:flex; align-items:center; gap:8px; flex:1; min-width:180px; max-width:420px;
  border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); border-radius:11px; padding:0 11px; color:#9a9aa6; }
.sb-searchbox:focus-within{ border-color:var(--accent,#E63946); color:#e9e9f1; }
.sb-searchbox input{ flex:1; min-width:0; background:none; border:none; outline:none; color:#f2f2f4;
  font-family:inherit; font-size:13px; padding:10px 0; }
.sb-searchbox input::placeholder{ color:#77778a; }
.sb-searchclear{ background:none; border:none; color:inherit; cursor:pointer; font-size:17px; line-height:1; padding:0 2px; }
.sb-searchclear:hover{ color:#fff; }
.sb-toasts{ position:fixed; right:18px; bottom:18px; z-index:200; display:flex; flex-direction:column; gap:8px; }
.sb-toast{ background:#17171c; border:1px solid rgba(255,255,255,0.14); border-left:3px solid var(--accent,#E63946);
  border-radius:10px; padding:11px 15px; font-size:13px; max-width:340px; box-shadow:0 12px 30px rgba(0,0,0,.5); }
.sb-toast.success{ border-left-color:#2ec484; }

/* barra de progresso (geração do PDF) */
.sb-prog{ width:100%; }
.sb-prog-top{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
.sb-prog-lbl{ font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-prog-pct{ font-family:var(--font-mono); font-size:12px; color:#9a9aa6; font-variant-numeric:tabular-nums; white-space:nowrap; }
.sb-prog-track{ margin-top:9px; border-radius:5px; padding:2px; background:rgba(0,0,0,.4);
  box-shadow:inset 0 1px 2px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.05); }
.sb-prog-rail{ position:relative; height:9px; overflow:hidden; border-radius:3px; }
.sb-prog-fill{ position:absolute; inset:0; display:block; border-radius:3px; transform-origin:left center;
  background:var(--accent,#E63946); box-shadow:inset 0 1px 0 rgba(255,255,255,.3);
  transition:transform .45s cubic-bezier(.32,.72,0,1); }
.sb-prog-fill.shimmer{ inset:0 auto 0 0; width:40%; transform:none; animation:sb-prog-slide 1.25s ease-in-out infinite; }
@keyframes sb-prog-slide{ from{ transform:translateX(-100%);} to{ transform:translateX(250%);} }
.sb-expmodal{ max-width:400px; }
/* Palco 1:1 usado só durante a exportação — fica sob o overlay opaco do modal. */
.sb-exportstage{ position:fixed; left:0; top:0; width:${SB_PAGE_W}px; height:${SB_PAGE_H}px;
  background:#fff; z-index:1; pointer-events:none; overflow:hidden; }
.sb-modal-bg.solid{ background:#08080a; }
@media (prefers-reduced-motion:reduce){
  .sb-prog-fill{ transition:none; }
  .sb-prog-fill.shimmer{ animation:none; width:100%; opacity:.4; }
}

/* modais */
.sb-modal-bg{ position:fixed; inset:0; background:rgba(0,0,0,.7); backdrop-filter:blur(3px); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; }
.sb-modal{ background:#141419; border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:24px; max-width:440px; width:100%;
  color:#f2f2f4; font-family:var(--font-sans,'Inter',system-ui,sans-serif); }
.sb-modal h3{ margin:0 0 9px; font-size:18px; }
.sb-modal p{ margin:0 0 16px; font-size:13.5px; line-height:1.6; color:#b8b8c2; }
.sb-lbl{ display:flex; flex-direction:column; gap:5px; font-size:12px; color:#9a9aa6; margin-bottom:12px; }
.sb-lbl input{ background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:9px; padding:9px 11px; color:#f2f2f4; font-size:13.5px; font-family:inherit; }
.sb-lbl input:focus{ outline:none; border-color:var(--accent,#E63946); }
.sb-modal-acts{ display:flex; gap:9px; justify-content:flex-end; margin-top:6px; }

/* Telas estreitas: a calha deita e vira faixa horizontal outra vez. */
@media (max-width:${SB_RAIL_BP}px){
  .sb-stage{ grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr) auto; gap:${SB_RAIL_GAP}px 0;
    justify-content:stretch; }
  .sb-rail{ width:auto; flex-direction:row; justify-content:flex-start; gap:14px; flex-wrap:wrap; }
  .sb-rail-l{ grid-column:1; grid-row:1; padding:0 0 6px; border-bottom:1px solid rgba(255,255,255,0.07); }
  .sb-frame{ grid-column:1; grid-row:2; }
  .sb-rail-r{ grid-column:1; grid-row:3; padding-top:6px; border-top:1px solid rgba(255,255,255,0.07); }
  .sb-rail-id{ writing-mode:horizontal-tb; transform:none; flex-direction:column; align-items:flex-start; gap:1px; }
  .sb-rail-logo{ position:static; transform:none; width:auto; height:22px; }
  .sb-rail-logo img{ transform:none; }
  .sb-railtop, .sb-railfoot, .sb-verbar, .sb-verchips, .sb-tools{ flex-direction:row; align-items:center; }
  .sb-counter, .sb-verbar-lbl{ writing-mode:horizontal-tb; transform:none; }
  .sb-railmenu{ left:auto; right:0; bottom:38px; }
}
@media (max-width:1180px){
  .sb-workspace{ grid-template-columns:minmax(0,1fr); }
  .sb-side{ max-height:none; }
  /* por classe, não por :nth-child — a linha tem os dois spans do feixe na
     frente e o cabeçalho não, então a contagem não bate entre os dois. */
  .sb-tr{ grid-template-columns:74px 1.2fr 1fr 1.1fr 110px; }
  .sb-tr > .sb-col-cat, .sb-tr > .sb-col-last{ display:none; }
}
@media (max-width:760px){
  .sb-stage{ gap:6px; }
  .sb-nav{ width:34px; height:60px; font-size:20px; }
  .sb-viewport{ height:46vh; }
  .sb-verbar{ gap:8px; }
  .sb-verchip{ min-width:38px; height:26px; padding:0 7px; font-size:10.5px; }
  .sb-verchip.on{ height:30px; }
  .sb-vernote{ font-size:9.5px; padding:3px 8px; }
  .sb-tr{ grid-template-columns:60px 1fr 100px; }
  .sb-tr > .sb-col-proj, .sb-tr > .sb-col-status{ display:none; }
  .sb-capa{ width:60px; height:38px; }
}
`;
