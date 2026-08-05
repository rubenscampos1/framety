# Changelog

Versionamento do Framety. O que está **no ar no Render** é a versão marcada
(tag git). Correções em andamento entram em "Não lançado" até o próximo deploy.

## [1.6.0] — No ar no Render (tag `v1.6`) — 2026-08-05

**Estreia da aba de Storyboards em produção.** Todo o recurso — console, link do
cliente, comentários, versões por cena, PDF e capa — vai ao ar neste deploy; até
aqui ele só existia localmente.

- **`/storyboards` com o documento aberto perdeu a faixa de cima:** logo,
  "N documento(s) · sincronizado com o console" e a busca não diziam nada sobre
  o documento na tela. Com um storyboard aberto a faixa sai inteira e a moldura
  da página encolhe para a mesma da tela do cliente. A folha passou de 998×775
  para **1070×831** — de 85% para **91% da altura da janela**. Ao voltar para a
  lista tudo reaparece. ([storyboard.jsx] `StoryboardIndexPage`, `.sb-standalone.lendo`)
- **"Sair" desceu para o cabeçalho do documento**, ao lado do lápis, junto com
  um **Baixar PDF** (com o mesmo menu da tela do cliente: só o storyboard ou
  com os comentários). Os dois só existem **fora da edição** — o PDF sairia de
  um documento em meio a alterações, e sair no meio da edição levaria junto o
  que ainda não foi gravado. O download também passou a existir no console, que
  usa o mesmo editor. ([storyboard.jsx] `SBEditor`)
- **Texto de instruções do hub removido** ("Monte o storyboard, compartilhe o
  link…"): a tela já se explica e a linha só empurrava a lista para baixo.
- **Aviso de armazenamento removido do hub:** ele estava certo, mas aparecia
  também em desenvolvimento — onde gravar no disco local é o comportamento
  normal — e assustava sem ter o que corrigir ali. O diagnóstico continua
  disponível em `GET /api/storage-status`. Em produção o que vale segue valendo:
  sem `CLOUDINARY_URL` as imagens não sobrevivem ao deploy.
- **Capa do storyboard — miniatura no hub e imagem do link no WhatsApp:** cada
  storyboard ganhou uma capa própria. No hub ela é a **primeira coluna** e a
  própria miniatura é o botão: clicar troca a imagem (um × no canto remove),
  sem abrir o documento. A mesma capa vira a **imagem de preview** quando o link
  do cliente é colado no WhatsApp/Telegram. A capa anterior é destruída no
  armazenamento ao ser trocada, e sai junto quando o storyboard é apagado.
  ([server.js] `POST|DELETE /api/storyboards/:id/cover`, `sbAssets`,
  [storyboard.jsx] `StoryboardsPanel`, [api.js])
- **`og:image` era relativa — nenhum link do site tinha miniatura:** as meta tags
  sociais saíam com `/framety_social_preview.png`, e WhatsApp, Telegram e
  Facebook não resolvem caminho relativo (eles buscam a imagem fora da página).
  Atingia todo link cuja imagem não fosse do Cloudinary — a de fábrica, as de
  `/uploads/` e, agora, a capa do storyboard; capa de categoria e thumb de vídeo
  já hospedadas no Cloudinary escapavam por já serem absolutas. Agora a URL
  é absoluta, montada a partir do `x-forwarded-proto`/`x-forwarded-host` (é o
  proxy do Render que sabe o domínio e o https reais), com `PUBLIC_ORIGIN` para
  fixar o domínio se algum dia o Host que chega não for o público.
  ([server.js] `absoluteUrl`)
- **Remoção de arquivo não funcionava com disco persistente (bug):**
  `unlinkUpload` montava o caminho a partir da pasta do projeto em vez da pasta
  de uploads. Com `UPLOADS_DIR` apontando para fora do projeto — que é
  exatamente o disco persistente descrito para o Render (`/var/data/uploads`) —
  o caminho nunca casava com a checagem de segurança e **toda remoção virava um
  nada em silêncio**: apagar um storyboard, trocar uma capa ou remover uma
  imagem deixava o arquivo no disco para sempre. ([server.js] `unlinkUpload`)
- **Gravação do deck: responde só depois de gravar, e com porteiro:** o `PUT` do
  storyboard respondia "salvo" antes de o banco confirmar — com o Postgres fora
  do ar o console dizia que tinha salvo e a perda só aparecia no carregamento
  seguinte. Agora a resposta espera a gravação e, se ela falhar, a memória volta
  ao que está no banco e o console recebe erro. Junto entrou uma checagem do
  `pages` que chega: array vazio, página sem `id`, tipo desconhecido, `id`
  repetido ou item nulo são **recusados** em vez de substituírem o documento —
  antes qualquer um deles apagaria o deck inteiro, com o histórico de versões
  junto. ([server.js] `sbPagesProblem`, `PUT /api/storyboards/:id`)
- **Limite do corpo do pedido:** o `express.json` estava no padrão de 100kb e o
  console grava o deck inteiro de uma vez. Um documento longo passaria disso e
  morreria com 413 no meio do trabalho — agora são 4mb. ([server.js])
- **Aviso quando as imagens não são permanentes:** sem `CLOUDINARY_URL` os
  envios vão para o disco da instância, que o Render apaga a cada deploy. O hub
  passou a dizer isso numa faixa, em vez de deixar a descoberta para depois de
  perder as imagens. ([server.js] `GET /api/storage-status`, [storyboard.jsx])
- **Console com o desenho da tela do cliente:** o storyboard aberto no console
  (e em `/storyboards`) passou a usar a **mesma calha** da visão do cliente —
  mesma marcação, mesmo `dual_logo.svg`, mesma posição — com a identificação de
  pé ao lado da folha. O título repetido no cabeçalho saiu (a calha já o mostra)
  e o **cabeçalho do console some enquanto o documento está aberto**: são ~77px
  de moldura que viram documento. Num monitor de 1868×913 a folha do console
  passou de 1011×785 para **1068×829** — de 86% para **91% da altura da janela**
  (o cliente, sem menu lateral, segue em 98%). ([storyboard.jsx] `SBEditor`,
  `body.sb-appmode`)
- **Botão "Salvo" removido:** ficava apagado o tempo todo, porque o documento já
  se grava sozinho pouco depois da última tecla. Ficou só **Concluir**, que
  grava o que estiver pendente e volta para a leitura (mostrando "Salvando…"
  enquanto isso). A faixa amarela de alterações não gravadas continua.
  ([storyboard.jsx] `SBEditor`)
- **Suíte de integridade da aba (`_sbtest/`):** sobe uma instância isolada
  (banco e uploads próprios, sem tocar nos reais), percorre criar → subir imagem
  → subir capa → gravar → recusar deck inválido → preview do link → **reiniciar
  o servidor** → ler como cliente → comentar → apagar, e confere que tudo
  sobrevive ao reinício e que apagar limpa o armazenamento. 32 verificações,
  `node _sbtest/run.js`. Foi ela que encontrou o bug do `unlinkUpload`.
- **As abas de versão agora existem em todas as telas do documento:** antes elas
  só apareciam nas páginas que já tinham recebido imagem — capa, disclaimer,
  contracapa e uma página de assets ainda vazia ficavam sem nada na calha, e o
  indicador parecia sumir. Agora a calha nunca fica vazia: nas páginas que
  recebem imagem as abas contam a versão **daquela cena** e continuam clicáveis
  para comparar; nas páginas fixas elas contam a versão **do documento** (rótulo
  `doc`) e são só leitura. ([storyboard.jsx] `SBVersionBar`)
- **Calhas encostadas na folha:** a moldura do palco deixou de ser uma coluna
  elástica e passou a ter o **tamanho exato da folha**, então as duas calhas
  ficam a 8px do papel em vez de boiarem na borda do palco. Num monitor de
  1868×913 cada lado tinha **85px de vão morto** entre a calha e o documento —
  agora são **8px**, sem tirar um pixel da folha (segue 1155×897, 98% da altura).
  A sombra da folha passou para a moldura, que virou o próprio papel: a viewport
  recorta a esteira de páginas e cortaria a sombra rente à borda. Em telas
  estreitas nada muda — as calhas deitam e a moldura volta a ocupar a linha
  inteira. ([storyboard.jsx] `SBDeck`, `.sb-stage` / `.sb-frame.hug`)
- **Versão por cena, com abas em cima da folha:** cada cena passou a ter a sua
  própria contagem de versões, independente das outras e do documento. Acima da
  página fica uma fileira de quadradinhos — o **aceso** é a versão na tela, os
  **apagados** são as anteriores (clicáveis para comparar) e os **pontilhados**
  são as rodadas que ainda cabem. Clicar numa versão antiga traz a imagem de
  antes, com tarja de aviso e **só os comentários feitos enquanto ela estava no
  ar**; virar a página volta tudo sozinho para a versão mais recente.
  ([storyboard.jsx] `SBVersionBar`)
- **"Subir nova versão" na cena:** com imagem no lugar, o botão sobre a foto vira
  *subir nova versão* — a que estava lá vira a V anterior e a nova entra como a
  próxima. Ao lado aparece *desfazer a V&lt;n&gt;*, que apaga a imagem recém-enviada e
  devolve a anterior sem gastar rodada (conserto de envio errado).
  ([storyboard.jsx] `SBSlotTools`)
- **Tela do cliente redesenhada em torno do documento:** o cabeçalho horizontal
  deixou de existir. A folha passou a ser ladeada por duas **calhas verticais**:
  à esquerda a identificação (cliente, produto·projeto·categoria e o logo, de pé,
  lidos de baixo para cima); à direita as **abas de versão da cena no topo** e a
  **paginação na base** (no console, também as ferramentas de página). *Baixar
  PDF* e o status subiram para o topo da coluna de comentários. Como a folha é
  limitada pela **altura**, cada pixel de moldura horizontal que saiu virou
  documento: num monitor de 1868×913 a página passou de 950×745 para
  **1155×897** — **+46% de área**, ocupando 98% da altura da janela (antes 82%).
  Em telas estreitas as calhas deitam e voltam a ser faixas horizontais.
  ([storyboard.jsx] `SBDeck`, `.sb-rail-l` / `.sb-rail-r`)
- **Onde cada contagem mora:** a das **cenas** fica no cabeçalho do painel de
  comentários, sempre falando de cena ("Restam 2 rodadas de alteração para essa
  cena"). A do **storyboard** fica no pé do painel, colada no botão que consome a
  rodada, e o "N comentário(s) ainda não enviado(s)" subiu para o fim da lista de
  comentários, acompanhando o que vai sendo escrito. ([storyboard.jsx] `SBComments`)
- **Limite de 3 rodadas de alteração — na cena e no documento:** os dois seguem a
  mesma regra, V1 + 3 rodadas até a **V4**. A mensagem acompanha a contagem e, na
  V3, avisa: *"Atenção, resta apenas 1 rodada de alteração disponível para essa
  cena."* Na V4 o envio de nova versão fica bloqueado, e no documento o cliente
  deixa de poder pedir revisão — só aprovar. ([storyboard.jsx] `sbRoundsNote`,
  [server.js] `SB_MAX_VERSION`)
- **Comentário enviado só o console apaga:** o cliente continua podendo retirar o
  que ainda não enviou; depois de enviado, a exclusão existe apenas dentro do
  console (botão "apagar" em cada comentário, com confirmação em dois cliques).
  ([server.js] `DELETE /api/storyboards/:id/comments/:cid`, [storyboard.jsx])
- **`/console/storyboards`:** a aba de Storyboards ganhou URL própria — antes o
  endereço voltava para `/console/visao-geral`. ([admin.jsx], [app.jsx])
- **`/storyboards` virou o painel completo:** o link independente deixou de ser
  uma lista de atalhos e passou a servir **o mesmo painel do console**, sem o menu
  lateral e sem acesso ao resto do console, protegido pela senha do console.
  Storyboards, páginas, imagens e comentários são os mesmos do console e andam em
  tempo real entre as máquinas abertas. ([storyboard.jsx] `StoryboardIndexPage`)
- **Busca acha storyboards:** o **Ctrl+Espaço** do console passou a listar
  storyboards junto com vídeos, categorias e clientes — clicar abre a aba de
  Storyboards já com o documento aberto. Em `/storyboards` a mesma tecla abre uma
  busca **restrita a storyboards**, e o topo da tela ganhou uma **barra de busca**
  (que some ao abrir um storyboard — lá dentro ela não procura nada). Os dois
  procuram por cliente, projeto, produto e categoria, sem depender de acento ou
  caixa. ([app.jsx] `GlobalSearch`, [storyboard.jsx] `sbMatches`)
- **PDF sempre com as cenas mais atuais:** o download passou a ser feito em duas
  etapas — o clique devolve a exibição para a versão atual e a rasterização só
  começa no commit seguinte. Se o cliente estiver comparando uma V1 na tela, o
  arquivo sai mesmo assim com a sequência mais recente. ([storyboard.jsx])

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
