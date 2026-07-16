# Changelog

Versionamento do Framety. O que está **no ar no Render** é a versão marcada
(tag git). Correções em andamento entram em "Não lançado" até o próximo deploy.

## [Não lançado]

- _(nada ainda — adicionar conforme formos corrigindo)_

## [1.5.0] — No ar no Render (tag `v1.5`) — 2026-07-16

- **Player 360° repensado — giro sempre ativo + barra de controles própria:** saiu
  o botão de liga/desliga do 360. Agora, nos vídeos 360, o giro por arraste fica
  **sempre ativo em qualquer lugar do vídeo**, e o player usa uma **barra de
  controles nossa** (play/pause, linha do tempo com seek, mudo, tela cheia) no lugar
  da barra nativa do YouTube — que "brigava" com a camada de arraste. A **tela
  cheia** agora é do nosso container, então o giro 360 passa a **funcionar também em
  tela cheia**. A resolução nos vídeos 360 fica no **automático** do YouTube (a API
  não permite forçar resolução manualmente). Vídeos **normais** seguem com os
  controles nativos do YouTube (incluindo escolha de resolução). Detecção de 360 é
  automática (`getSphericalProperties`); a camada só aparece em vídeos realmente
  esféricos. ([category.jsx] `CustomYouTubePlayer`, [styles.css])

## [1.4.0] — No ar no Render (tag `v1.4`) — 2026-07-15

- **Vídeos 360° agora giram no player do site (arrastar para olhar em volta):** o
  giro nativo do YouTube **não** ativa dentro de embeds de terceiros (o vídeo é 360
  de verdade, mas o embed não mostra a bússola nem deixa arrastar). Diagnóstico
  confirmado no ar: `getSphericalProperties()` reconhece o 360, mas o arraste nativo
  não engata. Solução: passamos a **girar a esfera pela própria API do YouTube**
  (`setSphericalProperties`). Uma camada de arraste sobre o vídeo 360 converte o
  gesto do mouse/dedo em giro (yaw/pitch); um selo **"360°"** liga/desliga o modo —
  desligado, os controles nativos (resolução, tela cheia) ficam livres. A detecção é
  automática: só vídeos realmente 360 recebem a camada; vídeos normais ficam
  intactos. ([category.jsx] `CustomYouTubePlayer`, [styles.css])

## [1.3.0] — No ar no Render (tag `v1.3`) — 2026-07-14

- **Player grande com controles nativos do YouTube:** no modal de vídeo e na
  playlist, o player passou a usar os controles nativos (`controls: 1`) em vez dos
  customizados. Isso habilita **escolher a resolução** (engrenagem), **tela cheia**
  nativa e, nos vídeos **360°, arrastar com o mouse para olhar em volta** (+ giroscópio
  no celular). A camada que interceptava o mouse e o `pointer-events: none` do iframe
  (que bloqueavam o 360) foram removidos. ([category.jsx] `CustomYouTubePlayer`, [styles.css])
- **Removido o botão extra de tela cheia** do canto do player (modal e playlist) —
  a tela cheia agora é a nativa do YouTube (que também ativa o giroscópio no 360).
  ([category.jsx], [styles.css])

## [1.2.0] — No ar no Render (tag `v1.2`) — 2026-07-13

- **Vídeo novo sumindo sozinho (bug):** ao adicionar um vídeo (que nasce como
  rascunho), ele sumia após o live-update. Causa: `API.getData()` buscava
  `/api/data` **sem o token**, então o servidor devolvia só os vídeos públicos e o
  rascunho recém-criado era filtrado. Agora o `getData` envia o token quando existe
  (console vê tudo, incl. rascunhos; site público continua vendo só os públicos).
  ([api.js])
- **"Remover imagem personalizada":** essa opção volta a aparecer, mas **só quando
  há uma imagem própria carregada** (upload). Para um frame do YouTube escolhido,
  aparece "voltar ao automático". ([admin.jsx] `VideoFormModal`)
- **Thumb do YouTube quebrada:** o site e o form usavam `maxresdefault.jpg`, que
  dá 404 em vídeos não-HD (thumb quebrada). Agora usa `hqdefault.jpg`, que sempre
  existe. ([category.jsx] `getThumbUrl`, [admin.jsx] `VideoFormModal`)
- **"Escolher frame do vídeo" (escolher momento da thumb):** no adicionar **e**
  editar vídeo, um botão claro (apagado sem link, aceso na cor de destaque quando
  cola o link do YouTube) abre o player pra assistir + 4 opções de momento
  (Início / ¼ / Meio / ¾) clicáveis. Continua tendo "Carregar imagem" para máxima
  qualidade. Sem escolha → padrão é um frame do **meio** do vídeo.
  ([admin.jsx] `VideoFormModal` `framePicker`/`ytFrames`/`autoThumb`)
- **Cache de código revalida sempre:** os arquivos de código (.jsx/.css/.html)
  passam a usar `Cache-Control: no-cache` (revalida via ETag → 304 se não mudou).
  Evita ficar com JS/CSS antigo em cache após um deploy (ou edição local), sem
  precisar de hard-refresh. ([server.js])

## [1.1.0] — No ar no Render (tag `v1.1`) — 2026-07-10

- **Mobile — scroll travado nos cards:** o `SpotlightCard` tinha `touch-action: none`
  e um listener global de `pointermove`, o que bloqueava o rolar da página ao tocar
  em qualquer card (rows do console, accordion IA, clipes). Em toque, agora os
  efeitos de brilho/hover são desligados (cards "crus") e o scroll funciona.
  ([primitives.jsx] `IS_TOUCH`)
- **Mobile — accordion IA travando o arraste:** mesma causa acima (era `SpotlightCard`).
- **Mobile — console não rolava nos itens:** mesma causa acima.
- **Mobile — preview de vídeo nos clipes:** hover-preview desativado em toque
  ([category.jsx] e [landing.jsx] `handleCardEnter`/`handleEnter`).
- **Mobile — blocos do processo colados:** `.process-steps` ganhou `gap: 16px`
  no mobile. ([styles.css])
- **Mobile — play do vídeo em 1 toque:** o player do YouTube agora é pré-carregado
  (cued) ao abrir o modal e a reprodução começa a partir do gesto do toque, então
  não aparece mais o segundo "play" do YouTube. ([category.jsx] `CustomYouTubePlayer`
  `autoStart`/`controlRef`, `VideoModal` `startPlay`)

## [1.0] — No ar no Render (tag `v1.0`, commit 87ba798)

Primeira versão publicada do Framety.

- Portfólio público: home (hero/reel, categorias, clientes, seção IA, trabalhos,
  processo, contato), páginas de categoria, modal de vídeo estilo YouTube,
  playlist compartilhável (`/assistir/:cat`), Produções somente-leitura
  externa (`/producoes`).
- Console (`/console`): Vídeos, Clientes, Categorias, Reel, Seção IA, Parceiros,
  Tutorial, Produções (OS em PDF, cards no mobile, senha própria), Links,
  Segurança (recuperação por admin token).
- Tempo real multiusuário (SSE), sessões concorrentes.
- Mobile: player YouTube-style, accordion IA vertical, Produções em cards,
  documento OS com zoom/pan, stats 2×2.
- Desempenho: compressão Brotli/gzip, cache de estáticos, lazy-load de mídia,
  libs de PDF sob demanda.
- Infra: Render + PostgreSQL; **uploads no Cloudinary** (persistem entre
  deploys); CSP liberando `res.cloudinary.com`.
