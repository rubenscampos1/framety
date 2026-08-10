# Changelog

Versionamento do Framety. O que está **no ar no Render** é a versão marcada
(tag git). Correções em andamento entram em "Não lançado" até o próximo deploy.

## Não lançado

- **Tecla `R`: as cenas viram roteiro.** Do mesmo jeito que o `G` abre a grade,
  o `R` abre o roteiro — as mesmas cenas em texto, sem imagem nenhuma, no
  formato de duas colunas **VÍDEO | ÁUDIO** (o padrão de roteiro publicitário e
  institucional). `R` de novo, `G` ou `Esc` fecham.
  - Não existe roteiro digitado à parte: ele sai inteiro dos campos que já estão
    na folha. `VISUAL` vai para a coluna de vídeo, `LOCUÇÃO EM OFF` e `SFX` para
    a de áudio, prefixados por `LOC:` e `SFX:`. Assim não há como o roteiro
    discordar do storyboard.
  - A descrição da cena sem foto (o `placeholder`) entra na coluna de vídeo — é
    informação de imagem também — e some sozinha quando a foto chega.
  - Só páginas do tipo cena entram. Capa, disclaimer, assets e contracapa ficam
    de fora: o roteiro é para quem vai gravar.
  - **Cara de documento, não de deck:** folha branca, tinta preta, margens de
    ~20mm, e o texto composto em **folhas A4 de verdade** (794×1123px, que é
    210×297mm a 96dpi). A barra de cima segue escura porque é ferramenta, não
    papel — é o contraste entre as duas que faz a folha parecer folha. Rodapé
    com "1 / 3" em cada uma.
  - No alto da primeira folha vai a **marca Framety · Grupo Skyline**, a mesma
    das outras páginas do documento, no lugar da palavra "ROTEIRO". Variante
    escura em arquivo próprio (`dual_logo_dark.svg`), não `filter:invert()` — o
    html2canvas ignora filtros CSS e o logo sairia branco no branco da folha.
  - **Os blocos se encostam.** "CENA 01" deixou de ser um título solto acima da
    tabela e virou uma faixa dentro dela; cada bloco puxa 1px para cima, então a
    borda de baixo de um e a de cima do seguinte viram uma linha só em vez de
    somarem duas. O documento é uma grade contínua, como uma tabela de Word. O
    `SB_A4_VAO` da paginação acompanha o mesmo -1: medir com um vão e desenhar
    com outro é como a folha estoura.
  - **`+ Nova cena` na última folha.** Cria a cena de verdade no storyboard,
    pelo mesmo caminho do `+` da calha — entra depois da última cena (antes dos
    assets e da contracapa), é salva e vira a página atual, então fechar o
    roteiro deixa você já nela para preencher. Sem cena nenhuma ainda, entra
    logo após as páginas fixas do documento. O botão é ferramenta dentro do
    papel: **não sai no PDF** (`ignoreElements` na exportação) e não existe na
    visão do cliente.
  - **A paginação mede, não chuta.** Uma régua invisível monta os mesmos blocos
    na largura útil da folha, mede a altura real de cada um e vai enchendo
    páginas — sempre por blocos inteiros, então nenhuma cena é cortada ao meio.
    É o MESMO componente que a folha desenha; medir uma coisa e desenhar outra é
    como a paginação erra. Uma cena mais alta que a página inteira fica sozinha
    na sua folha e a folha cresce (`min-height`): melhor uma folha fora de
    medida do que texto sumido no corte.
  - **Baixar PDF**, em folhas A4 — uma folha da tela vira uma página do PDF, no
    mesmo tamanho. Rasteriza cada folha pelo caminho que o projeto já usa, então
    o arquivo sai igual ao que está na tela, sem uma segunda diagramação para
    sair de sincronia.
  - **Copiar texto** e **.txt** continuam, e continuam entregando a versão de
    colunas por caractere — é ela que sobrevive a um WhatsApp ou a um e-mail sem
    formatação. As duas saídas leem da mesma função de cenas, então a folha
    impressa e o texto colado nunca discordam. Sem permissão de área de
    transferência, o "Copiar" seleciona o conteúdo para o Ctrl+C funcionar, em
    vez de o botão não fazer nada.
  - O roteiro **cobre** o palco em vez de substituir a moldura: as páginas
    seguem montadas embaixo, e é delas que a exportação varre o conteúdo — pedir
    o PDF com o roteiro aberto continua dando o mesmo documento.
  - **VÍDEO e ÁUDIO aparecem uma vez só**, no topo do documento. Repetir os dois
    rótulos em cada cena enchia a folha de linha sem informação nova.
  - **"CENA 01" mora dentro do próprio retângulo**, no alto da coluna de vídeo.
    Antes era uma faixa cinza atravessando as duas colunas — uma linha inteira
    por cena só para dizer um número. Para as duas colunas começarem na mesma
    altura, a de áudio reserva o espaço com uma cópia **invisível** do rótulo,
    não com um `padding` fixo: número mágico erraria assim que a fonte ou o
    corpo do texto mudassem, e a cópia acompanha sozinha (e não vaza para o
    texto copiado).
  - **Editável como um Word.** Com o lápis ligado, as células viram campos de
    texto — sem moldura de formulário, a caixa só aparece no foco. E é o
    **mesmo campo da cena**: o que se digita aqui vai para `visual`, `locucao` e
    `sfx` da página, pelo mesmo caminho do editor do deck. Não existe cópia do
    roteiro em lugar nenhum, então as duas telas não têm como discordar. Os
    campos ficam rotulados e sempre presentes, mesmo vazios — sem a linha não há
    onde clicar para escrever o que ainda não existe. A folha se repagina
    enquanto se escreve. Editando, a cena deixa de ser clicável para comentar:
    o clique passa a ser para pôr o cursor no texto.
  - **O cliente comenta por cena, aqui também.** Clica no retângulo da cena e
    comenta ao lado; o comentário mostra "CENA 03" e, clicado, seleciona e rola
    até o bloco — é como se responde "de qual cena é isto?" num documento de
    várias folhas. Cada cena leva a marca de quantos comentários tem (fora do
    PDF).
  - **O comentário é da CENA, não da tela.** Ele leva o `pageId`, então o que o
    cliente escreve no roteiro aparece na página daquela cena no console, junto
    com os demais. A lista do roteiro mostra os dois e marca "no storyboard" o
    que veio de lá — esconder faria parecer que a cena não tem conversa nenhuma.
  - **Trilha de revisão própria: V1..V4 do roteiro**, com "Enviar e solicitar
    revisão" e "Aprovar roteiro" separados dos do storyboard. É o fluxo real de
    produção — o roteiro fecha antes de o storyboard ser desenhado —, então
    aprovar um não trava o outro.
    O campo `origem` do comentário resolve a tensão entre "comentário
    compartilhado" e "rodadas separadas": ele guarda em qual das duas telas o
    comentário nasceu e, portanto, **qual rodada o consome**. Sem isso, comentar
    no roteiro esvaziaria a rodada do storyboard sem ninguém pedir.
    ([server.js] `SB_TRILHAS`, `/api/sb/:slug/{comments,submit,approve}` com
    `origem`/`escopo`; storyboards criados antes disso valem V1)
  - **Uma lista de comentários por vez.** Com o roteiro aberto, o painel dele
    substitui a coluna de comentários do deck em vez de somar — duas listas do
    mesmo assunto lado a lado era ruído, não escolha. O `R` é do teclado, então
    o estado nasce dentro do deck e sobe por `onRoteiroChange`; fazer o
    contrário obrigaria as duas telas que montam o deck a repetir o atalho.
  - Vale nos dois lados, edição e visão do cliente, porque mora no deck. No
    console o painel mostra os comentários e o status da trilha, mas não compõe
    nem envia: quem revisa é o cliente.
  ([storyboard.jsx] `sbRoteiroTexto`, `SBRoteiro`, `SBRotCena`, `SBRotPainel`,
  `sbRotWrap`)

- **Produções deixou de ser uma lista e virou uma busca por `#SKY`.** A planilha
  de produção já tem o job inteiro em uma linha — cliente, produto, minutagem,
  produtora, valor. Manter uma segunda cópia disso no console significava
  digitar tudo de novo e conviver com duas versões do mesmo job. Agora a tela
  abre com um campo só: digita-se o `#SKY`, o servidor acha aquela linha na
  planilha e a OS é montada com o que já está lá.
  - O código pode ser digitado como vier à cabeça: `#SKY171-B`, `sky 171 b` e
    `SKY171B` chegam todos na mesma linha (acento, espaço e pontuação são
    ignorados dos dois lados da comparação).
  - A OS resultante **vive em memória**. A fonte é a planilha e o entregável é o
    PDF; o que se ajusta no documento vale para aquele PDF e não volta para a
    planilha. Por isso não há mais nada para salvar nesta aba.
  - **As listas antigas continuam no banco**, intactas — elas deixaram de ser a
    interface, não foram apagadas. E enquanto a planilha não estiver
    configurada, é justamente nelas que o servidor procura o `#SKY`, com um
    aviso na tela dizendo de onde veio. A aba fica utilizável antes de a
    integração ficar de pé.
  - Um `#SKY` que ainda não entrou na planilha não é um beco sem saída: há um
    atalho para **abrir uma OS em branco** já com o código preenchido.
  - Quando a busca falha, o motivo quase sempre está na configuração da
    planilha, não no código — daí o **"ver o que o servidor enxerga da
    planilha"** ao lado do erro: diz se a configuração está completa, com qual
    e-mail compartilhar a planilha, em que linha achou o cabeçalho e quais
    colunas foram reconhecidas.
  - O **link somente-leitura** (`/producoes`) acompanha: mesma busca, com o
    token do compartilhamento em vez do token do admin, e o documento abre
    fechado para edição (o PDF continua disponível). Como nada mais na tela
    depende do estado do servidor, a assinatura de "live" e o salvamento de
    status por ali saíram.
  - **Traço não é valor.** A planilha marca célula vazia com `-------------` em
    vez de deixar em branco; sem tratar isso, o valor total da OS sairia
    `-------------`. Agora uma célula só de traços vira vazia, e o valor cai no
    `R$ 0,00` de sempre. Atinge 62 das 109 linhas.
  - **Um `#SKY` pode ocupar mais de uma linha** — entregas diferentes do mesmo
    job (LANÇAMENTO e TRAJETO, IMERSIVO ESPANHOL e INGLÊS). São 5 casos hoje.
    Nesses pares a planilha repete cliente, produto e locutor e escreve o valor
    só na primeira linha; a OS é uma só, do job inteiro, então entre as linhas
    que casam fica a que tem valor. Hoje ela é sempre a primeira, mas a regra
    não depende dessa ordem continuar valendo.
  - **Quebra de linha é diagramação, não nome.** `QUINTA DAS\n MANGUEIRAS` está
    quebrado na planilha para caber na coluna; sem colapsar, a quebra
    reapareceria no meio do campo "Projeto" da OS.
  - **Mapeamento de colunas conferido contra a planilha real:** o cabeçalho é
    achado na linha 2 (pulando o título "Locuções 2026") e 11 colunas casam sem
    nenhuma configuração. `empreendimento` e `categoria` não existem lá e não
    fazem falta — o documento da OS não usa esses dois. Varredura completa: os
    48 `#SKY` da planilha são encontrados.
  - A planilha é lida pelo **CSV de exportação público** — ela está
    compartilhada como "qualquer pessoa com o link pode ver", e a decisão foi
    manter assim para que o console consiga puxar os dados a qualquer momento
    sem depender de credencial. Não há chave, token nem conta de serviço no
    projeto. Em troca, quem tiver a URL da planilha lê os mesmos dados.
    Se a planilha for fechada, o Google devolve a página de login em HTML com
    status 200; o módulo detecta e diz isso, em vez de deixar a busca falhar
    como "nenhum job com esse código". Cache de 60s. Passo a passo em
    [README-os-sheet.md](README-os-sheet.md).
  - `os-sheet.config.json` entrou no `.gitignore`: aponta para uma planilha
    específica e não precisa viajar no repositório.
  ([sheets.js], [server.js] `/api/os/lookup`, `/api/os/sheet-status`,
  [admin.jsx] `LocucoesPanel`, [api.js] `lookupOs`, `lookupOsWith`)

## [1.8.0] — No ar no Render (tag `v1.8`) — 2026-08-06

- **Arrastar a imagem para dentro da página (edição):** soltar um arquivo sobre
  o documento envia e aplica na hora, pelo **mesmo caminho do botão** — por isso
  a regra de versão é idêntica nos dois: vaga vazia entra como **V1**; vaga que
  já tem imagem **gasta uma rodada** e vira a próxima V. Para trocar a imagem
  sem gastar rodada, remove-se a atual antes (*remover*, ou *desfazer a V&lt;n&gt;*
  quando já há histórico) e envia-se de novo.
  Antes de soltar, o aviso no meio da folha diz o que vai acontecer, com cor:
  verde "Solte para enviar a imagem", âmbar "Solte para enviar a V3 — gasta uma
  rodada", vermelho "Limite de 3 rodadas atingido". A consequência aparece
  **antes** do gesto, não depois.
  - Na **cena**, a folha inteira aceita — mirar a moldura da imagem seria atrito
    à toa.
  - Nos **assets**, cada vaga aceita a sua (soltar sobre uma troca aquela), e a
    folha aceita criando a próxima das 4 — sem isso não haveria onde soltar numa
    página de assets ainda vazia, já que as vagas só nascem pelo botão.
  - Só em edição: em leitura e na visão do cliente não há zona nenhuma.
  - Arquivo que não é imagem é recusado com o motivo; arrastar texto ou link não
    acende nada.
  - **Rede de segurança:** a janela inteira recusa arquivo solto fora de uma
    vaga. Sem isso, errar o alvo por pouco faria o navegador abrir a imagem e
    sair do editor, levando junto o que ainda não tinha sido gravado.
  ([storyboard.jsx] `useSoltaImagem`, `sbAvisoSolta`, `SBAssetSlot`, `enviarImagem`)

## [1.7.0] — No ar no Render (tag `v1.7`) — 2026-08-05

- **Link do cliente e link de edição trocaram de forma — e o legível deixou de
  ser público.** Os dois se distinguiam só por `-` no lugar de `/`
  (`/storyboards/ebm-marista-video-imersivo` contra
  `/storyboards/ebm/marista/video-imersivo`), o que tornava fácil colar o
  errado. Agora:

  | endereço | quem vê |
  |---|---|
  | `/sb/<código>` | **link do cliente** — código opaco, curto |
  | `/storyboards` | índice, protegido por senha |
  | `/storyboards/<cliente>/<produto>/<projeto>` | o documento, para **editar** (protegido) |

  Tudo sob `/storyboards` passou a ser área interna: sem contar segmentos, sem
  exceção. Os links internos com hífen da 1.6.1 continuam abrindo e são
  reescritos para a forma nova, sem entrada extra no histórico.
- **Buraco de privacidade fechado no caminho:** o caminho legível era o link
  **aberto** do cliente, e havia uma busca pública por ele
  (`GET /api/sb/path/*`) que devolvia o documento inteiro **junto com o token de
  escrita**. Como o próprio caminho é formado pelos nomes de cliente, produto e
  projeto, quem os conhecesse (ou os adivinhasse) lia o storyboard, comentava e
  podia **aprová-lo**. A rota foi removida; o cliente chega só pelo código
  opaco. ([server.js], [api.js])
- **A área interna não descreve mais o documento nas meta tags:** `/storyboards*`
  passou a anunciar só "Storyboards | Framety — Área restrita.", sem nome de
  cliente e sem capa. Um link interno colado num grupo não revela de quem é o
  projeto antes de a senha ser pedida. O link do cliente (`/sb/…`) continua com
  título e capa, que é o que ele precisa mostrar.
- **A tarja de "não salvo" parou de mexer no documento (bug):** ela era uma linha
  da coluna do editor, então aparecer e desaparecer a cada tecla mudava a altura
  do palco — e a folha era reescalada junto, "pulando" enquanto se digitava.
  Agora ela **flutua sobre o documento**, no topo e centrada, sem ocupar espaço
  nenhum e sem receber clique. Medido: a folha fica em 989×768 antes e depois de
  a tarja aparecer. ([storyboard.jsx] `.sb-dirty`, `.sb-workspace`)
- **Grade de páginas na tecla G:** em leitura ou em edição, o **G** dá zoom out e
  mostra o documento inteiro em miniaturas; clicar numa delas abre aquela página,
  e **G** ou **Esc** fecham. Com muitas páginas a grade rola (testado com 22
  páginas: 5 colunas, miniaturas de 243×189, scroll ativo). Não é uma segunda
  montagem do documento — é a **mesma** esteira de páginas, que deixa de ser uma
  faixa horizontal e se quebra em colunas, então abrir a grade não custa memória
  nova. O atalho não dispara enquanto se digita (os textos da cena são
  `textarea`), e um botão no pé da calha faz o mesmo, para o atalho não ficar
  invisível. ([storyboard.jsx] `SBDeck`, `.sb-viewport.grade`, `.sb-gridpick`)
- **Bolinhas de página removidas:** com muitas páginas a fileira não cabia na
  calha e atropelava o resto. Ficou só a contagem (`07/22`), que diz a mesma
  coisa em qualquer tamanho de documento — e a grade cobre quem quer ver tudo.
- **Gravação automática deixou de piscar:** o botão virava "Salvando…" a cada
  pausa da digitação, e era esse piscar que dava a impressão de estar salvando
  sem parar. Agora `saving` é só a trava interna e o botão só muda em gravação
  pedida à mão.
  **Por que não de 10 em 10 minutos:** a gravação é justamente o que leva a
  alteração para as outras sessões — é ela que dispara o aviso do servidor.
  Espaçá-la deixaria a outra pessoa (e o cliente, no link dele) até 10 minutos
  atrasada, e colocaria 10 minutos de trabalho em risco a cada queda de rede.
  O tempo real foi medido entre duas sessões abertas no mesmo documento, com os
  dois relógios: **929 ms** entre digitar numa e aparecer na outra, sem recarregar.
- **Preview do link: a capa agora aparece de verdade.** A capa já era a imagem
  anunciada nas meta tags desde a 1.6.0 — o que faltava era ela ser *aceita*. O
  WhatsApp **descarta em silêncio** imagem grande, e as nossas vêm da câmera: a
  capa enviada para o storyboard EBM tem **27 MB**, e uma capa de categoria em
  produção tem 6,5 MB. Sem erro nenhum para investigar, o link aparecia com a
  imagem genérica do site (ou sem imagem).
  Agora, quando a imagem está no Cloudinary, o preview pede a ele a versão que as
  redes esperam — **1200×630, JPEG, recortada pelo assunto** (`c_fill,g_auto`).
  Medido na conta real: **6503 KB → 81 KB**, e a imagem continua sendo a mesma
  (mesmo `public_id`). Isso resolve de tabela o SVG, que o WhatsApp também não
  renderiza, porque `f_jpg` converte.
  Entraram também `og:image:secure_url`, `og:image:alt` e, **somente quando o
  recorte foi feito por nós**, `og:image:width/height/type` — anunciar 1200×630
  de uma imagem não verificada faz algumas redes desistirem do preview.
  Fora do Cloudinary (disco, em desenvolvimento) a URL passa como está e nenhuma
  medida é declarada. ([server.js] `socialImage`)
- **Suíte:** 10 verificações novas — a capa vale para as duas formas de link
  (`/sb/<slug>` e `/storyboards/<cliente>/<produto>/<projeto>`), o recorte é
  pedido uma vez só (não empilha transformação), as medidas anunciadas conferem
  com o JPEG devolvido, e capa fora do Cloudinary não inventa medida. 42 no total.

  **Pendente, fora do storyboard:** a imagem padrão do site
  (`framety_social_preview.png`, 685 KB) é servida pelo próprio site, não passa
  pelo Cloudinary e portanto não é reduzida. Ela ainda é o preview de todo link
  sem capa própria.

## [1.6.1] — No ar no Render (tag `v1.6.1`) — 2026-08-05

- **Cada storyboard tem o seu endereço:** abrir um documento no painel passou a
  escrever o link dele na barra —
  `/storyboards/<cliente>-<produto>-<projeto>` — e esse link, colado num
  navegador, abre direto naquele documento. Fechar devolve `/storyboards`,
  trocar de documento empilha (o **voltar** do navegador funciona) e renomear o
  storyboard corrige o endereço sem criar uma volta a mais.
  Os três endereços convivem no mesmo prefixo porque se distinguem pelo número
  de segmentos — o link aberto do cliente tem sempre os três
  (`cliente/produto/projeto`), o atalho interno tem um:

  | endereço | quem vê |
  |---|---|
  | `/storyboards` | índice, protegido por senha |
  | `/storyboards/ebm-metropolitan-marista-video-imersivo` | o documento **dentro do painel**, protegido |
  | `/storyboards/ebm/metropolitan-marista/video-imersivo` | link aberto do cliente |

  Quem abrir o atalho interno sem sessão encontra a senha — o documento e o
  nome do cliente não aparecem. Link que não corresponde a nenhum documento
  avisa e volta para a lista. ([app.jsx] roteamento, [storyboard.jsx]
  `sbDocSlug`/`sbSlugDaUrl`, `StoryboardIndexPage`)

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
