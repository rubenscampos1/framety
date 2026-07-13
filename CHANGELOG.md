# Changelog

Versionamento do Framety. O que está **no ar no Render** é a versão marcada
(tag git). Correções em andamento entram em "Não lançado" até o próximo deploy.

## [Não lançado]

- **Thumb do YouTube quebrada:** o site e o form usavam `maxresdefault.jpg`, que
  dá 404 em vídeos não-HD (thumb quebrada). Agora usa `hqdefault.jpg`, que sempre
  existe. ([category.jsx] `getThumbUrl`, [admin.jsx] `VideoFormModal`)
- **"Usar como thumb" (escolher momento):** no adicionar/editar vídeo, um botão
  abre o player do YouTube pra assistir + 4 opções de momento (Início / ¼ / Meio /
  ¾) clicáveis pra usar como thumb. Continua tendo "Carregar imagem" para máxima
  qualidade. Quando nada é escolhido, o padrão passa a ser um frame do **meio** do
  vídeo. ([admin.jsx] `VideoFormModal` `framePicker`/`ytFrames`/`autoThumb`)

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
