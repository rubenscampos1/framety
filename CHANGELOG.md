# Changelog

Versionamento do Framety. O que está **no ar no Render** é a versão marcada
(tag git). Correções em andamento entram em "Não lançado" até o próximo deploy.

## Não lançado

- **"Vídeos em destaque:" desceu mais 80px**, quase encostando na primeira
  fileira do corredor. Quem desce o título é o palco subindo, e não mais espaço
  em cima: aumentar o respiro empurraria título e palco juntos, e a distância
  entre os dois ficaria igual. O cabeçalho sobe de camada para o palco, que vem
  depois no fluxo, não cobrir o texto.

- **Corrigido: vídeos que são Shorts do YouTube não abriam nem mostravam capa.**
  O site só reconhecia `watch?v=`, `embed/` e `youtu.be/` — um endereço
  `youtube.com/shorts/…` não devolvia identificador nenhum, e sem ele não há
  player nem miniatura. São 14 vídeos no ar nessa situação. Passou a reconhecer
  `shorts/` e `live/` também, nos quatro lugares que liam o endereço: página de
  categoria, formulário do console, modo de apresentação e a prévia de link do
  servidor. (Os scripts de importação e a leitura de duração já reconheciam.)

- **Um highlight só para o site inteiro.** Cada lugar tinha o seu jeito de dizer
  "este é o selecionado": uns com o azul cheio e texto branco, outros com um véu
  de 10%, alguns ainda no vermelho do tema antigo. Agora todos leem de
  `--hl-bg` / `--hl-ink` — branco translúcido com texto em azul escuro. Vale
  para: menu e menu mobile do console, pílulas de filtro, abas, alternador de
  lista/grade, botão "Escolher frame do vídeo", coluna e dropdowns do modo de
  apresentação, filtros e dropdown de cliente das páginas de categoria.
  - Contagens e legendas dentro do highlight ganharam tom próprio: no
    cinza-claro de fora elas sumiriam sobre o branco.
- **Corrigido: títulos desalinhados na lista de vídeos do console.** A estrela
  de destaque ficava dentro do texto e empurrava o título uns 17px para a
  direita — só nas linhas em destaque, o que fazia a coluna parecer torta sem
  motivo. Agora ela mora numa calha reservada em todas as linhas.
- **Corrigido: vídeo em destaque repetido no corredor da home.** O corredor
  tinha um número fixo de cards por trilho e dava a volta na lista para
  preenchê-lo; com poucos destaques, o mesmo vídeo passava duas ou três vezes.
  Agora é um card por vídeo, com teto de 8 por trilho, e o intervalo entre eles
  se divide pelos cards que existem de verdade.

- **O item ativo do menu do console é um branco suave com texto em azul
  escuro.** Era um
  vermelho de 10% com o texto na cor de destaque — sobra do tema antigo. O azul
  sai de `--accent-deep`, que o próprio console reescreve junto com a Cor de
  destaque: não é mais uma cor solta na folha de estilo. O branco é translúcido
  (90%) e não chapado — sobre o fundo escuro do menu ele assenta num
  quase-branco, em vez de virar um retângulo aceso.

- **Corrigido: a capa exibida voltou a ser o quadro escolhido no console.** Ao
  aumentar a resolução das capas eu troquei `1.jpg` por `hqdefault.jpg` — que
  não é o mesmo quadro, é a capa padrão do YouTube. Quem escolheu o frame de um
  quarto do vídeo via outro. (Medido: `1.jpg` e `hq1.jpg` diferem 4 numa escala
  de 0 a 255; `1.jpg` e `hqdefault.jpg` diferem 26.)
  - O mesmo quadro existe em vários tamanhos só trocando o prefixo: `hq1`
    (480x360), `sd1` (640x480), `maxres1` (1280x720). Agora o site lê o NÚMERO
    do quadro — que é a escolha de quem cadastrou — e mexe só no prefixo.
  - Cards e listas pedem `hq1/hq2/hq3`, que existem sempre: nesses lugares a
    capa entra como fundo de CSS, onde não há como tratar erro de carregamento.
  - O corredor de destaques tenta `maxres` → `sd` → `hq`, parando no primeiro
    que existir de verdade.

- **Cadastrar cliente sem sair do formulário do vídeo.** O dropdown de cliente
  ganhou "+ Novo cliente…": escolher a opção troca o menu por um campo de nome,
  Enter cria e já deixa o cliente selecionado. A logo continua na aba Clientes,
  que é onde se envia arquivo. Nome que já existe não vira cliente repetido —
  seleciona o que há.
- **"Vídeos em destaque:" centrado verticalmente no vão do corredor.** O eixo de
  fuga fica a 54% do palco, então há sempre uma faixa vazia no alto: o título
  ficava encostado no topo com 175px de folga embaixo contra 110px em cima.
  Agora são 110 de cada lado em 1920x1080, sem mover card nenhum.

- **A legenda do corredor de destaques mostra só a categoria** embaixo do nome
  do vídeo, no lugar de cliente, ano e duração. O nome vem da lista de
  categorias, não do rótulo gravado no vídeo: renomear uma categoria no console
  vale aqui também.

- **Em 1920x1080 o site volta ao tamanho escrito.** O primeiro degrau da escada
  de ampliação abria em 1800px, então a resolução mais comum de monitor já
  pegava 15% de zoom: tudo um pouco grande demais, e 140px de altura útil a
  menos. O degrau passou a abrir em 2000px. A escada acima segue igual — 1.15
  a partir de 2048, 1.35 em 2560, 1.9 em 4K.

- **"Iniciar projeto", no topo, leva ao mesmo lugar que "Entre em contato"**, o
  botão do quadro lá no pé da página. É o mesmo endereço, editável no console:
  mudar um muda os dois. Se ele ficar vazio (ou deixar de ser um link de
  verdade), o botão volta a rolar até a seção de contato.
- **Capas do corredor de destaques em alta.** Os cadastros importados guardaram
  como capa endereços tipo `img.youtube.com/vi/<id>/1.jpg` — os quadrinhos de
  120x90 da barra de progresso do YouTube — e num card de meia tela isso vira
  um borrão. Agora o site reconhece esses endereços e pede o mesmo quadro na
  maior resolução que existir: 1280x720 quando o vídeo foi enviado em HD,
  480x360 quando não.
  - O reserva é necessário porque o YouTube responde 404 para a versão grande
    de vídeos antigos — mandando no corpo uma imagem cinza de 120x90 que o
    navegador aceita como carregada. Por isso a troca olha o tamanho do que
    chegou, e não só o erro de carregamento.
  - Os cards das categorias também deixaram de mostrar o quadrinho de 120x90,
    de quebra: passaram a pedir 480x360.

- **Cabeçalho do modo de apresentação transparente**, como o resto do site: a
  tarja preta saiu e o fundo animado passa por trás dele.
- **As informações do recorte subiram para a barra de cima** — nome, contagem e
  os três dropdowns numa linha só. A área rolável começa direto nos vídeos: com
  o nome do recorte no topo, o título da faixa lá embaixo repetiria a mesma
  informação e custava uma fileira inteira de cards.
  - Em "todos os vídeos" os títulos das faixas continuam, porque ali eles
    separam uma categoria da outra (e é onde mora o "Ver tudo").
  - Sobrou espaço também no respiro do conteúdo e entre as faixas.

- **Padrão, formato e formato do imersivo saíram da coluna e viraram dropdowns
  no topo**, ao lado da contagem de vídeos, no modo de apresentação. Na coluna
  eram três listas compridas que a empurravam para além da altura da tela — e
  o que interessa ali é a categoria.
  - Continua valendo **um recorte de cada vez**: escolher padrão desfaz o
    formato, como sempre foi. Cada dropdown tem "Todos" para voltar ao acervo.
  - Quem está zerado segue na lista, apagado: esconder o que ainda não foi
    classificado esconderia a própria existência do recorte.
  - **Corrigido de passagem: o recorte por formato do imersivo não mostrava
    nada.** A montagem das faixas tratava padrão e formato, mas não ele — a
    seleção caía no filtro por categoria, nenhuma batia, e a tela ficava vazia.
    Entrou nos dois pontos onde os outros dois já estavam.

- **O menu do console deixou de ser cortado embaixo.** A lista cresceu com as
  abas novas (Novidades, Marca & prévia, Minigame) e passou da altura da tela;
  sem tratar o transbordo, o fim dela — Segurança, Modo apresentação e Sair —
  ficava inalcançável. Agora a coluna rola.
  - **`min-height: 0` é o que faz funcionar**: sem ele, o item do grid não
    encolhe abaixo do próprio conteúdo e `overflow` não tem efeito nenhum.
  - A barra de rolagem dali é discreta (6px, cinza), não a branca da página:
    numa coluna de 240px a branca seria pesada demais.

- **Cabeçalho da categoria mais baixo: 285px viraram 184.** Ele comia mais
  espaço que uma fileira inteira de cards antes de o primeiro vídeo aparecer.
  - O que mais pesava não era o título, era a **coluna de informações à direita**
    (contagem, data e botão de compartilhar, empilhados): 71px de altura contra
    36 do título, e era ela quem definia a altura do cabeçalho. Em linha, cabe
    na altura do próprio título.
  - Título de 56px para 40px no máximo — 56 era tamanho de capa, e aqui ele só
    diz em que categoria se está.
  - Folgas apertadas em toda a pilha: topo da página, botão voltar, cabeçalho e
    controles. A descrição some quando a categoria não tem uma, em vez de deixar
    um parágrafo vazio empurrando os vídeos para baixo.
  - **Uma margem estava declarada duas vezes no mesmo bloco**, e a segunda
    vencia: baixar a primeira não surtia efeito nenhum. Só medindo para notar.

- **Barra de rolagem branca e visível.** Ela existia, mas o polegar estava em
  branco a 8% de opacidade — sobre um fundo quase preto, o mesmo que invisível:
  não dava para saber onde se está na página.
  - **Declarar `scrollbar-color` faz o Chrome desenhar a barra padrão e ignorar
    as regras `::-webkit-scrollbar`.** Descobri isso medindo: a largura
    reservada continuava 15px em vez dos 10px que eu tinha pedido. Por isso a
    espessura vai junto, em `scrollbar-width: thin` — as duas propriedades
    andam em par. As regras `-webkit-` ficam de reserva para o Safari, que
    ainda não entende as padronizadas.
  - **Ela entra depois da abertura**, não junto com ela: começa transparente e
    ganha cor quando a página termina de aparecer, pelo mesmo `body.home-pronta`
    que destrava as entradas em cascata. Como a marca vive no `<body>` e a barra
    é do `<html>`, a regra usa `:has()` para olhar de cima para baixo.
  - **O espaço dela é reservado desde o primeiro quadro** — só a cor entra
    depois. Fosse a largura a mudar, a página inteira daria um pulo de 10px no
    fim da abertura.
  - No celular ela segue escondida: ali o sistema desenha um indicador que
    aparece durante a rolagem e some sozinho.

- **Formato do vídeo imersivo**, em lista aberta. Semicircular, Tradicional e
  Trapézio saem de fábrica, e o console acrescenta e remove — a sala imersiva
  ganha formato novo com o tempo, então fixar três no código seria apertado.
  - Aparece nos três lugares: **filtro** na categoria Imersivo, **campo** no
    cadastro do vídeo e **grupo** na coluna do modo de apresentação.
  - No cadastro ele só aparece quando a categoria é Imersivo — num comercial
    seria mais um campo vazio para ignorar.
  - **O valor já gravado entra nas opções mesmo que tenha saído da lista.** Sem
    isso, editar outra coisa no vídeo apagaria o formato sem querer.
  - O filtro da categoria tem "Sem formato": os 30 imersivos entraram sem
    classificação, e o que não foi classificado precisa ser achável.
  - O editor da lista fica na aba Categorias, que é a mesma ideia — recorte do
    acervo definido no console.

- **Cards maiores no grid: três colunas em vez de quatro**, com a margem entre
  eles caindo de 14px para 8px. O card saiu de ~340px para 440px de largura.
  - Antes disto eu tinha ampliado a IMAGEM em 115%, o que era o oposto do
    pedido: agrandar a imagem come as bordas dela. Quem precisava crescer era o
    quadro, e quem decide largura de card é a contagem de colunas. A imagem
    voltou a caber inteira.
  - O tamanho do fundo é escrito no próprio elemento, e inline vence folha de
    estilo — por isso ele lê uma variável CSS, que é onde o enquadramento se
    ajusta sem tocar no JSX.

- **Duração real, lida do YouTube.** Ela era um campo digitado à mão, e por isso
  quase todo card mostrava o mesmo "03:00" de exemplo. Agora o servidor lê o
  `lengthSeconds` da página do vídeo — não precisa de chave de API — e guarda no
  cadastro; a página nunca consulta o YouTube para desenhar um card.
  - **Vídeo novo já nasce com ela**: ao cadastrar ou editar sem duração, o
    servidor busca depois de responder, para quem cadastrou não esperar a rede.
  - Para o que já existia, um botão **"Durações"** na aba Vídeos varre o
    catálogo inteiro. Medido: 104 de 108 preenchidos.
  - Os 4 que faltaram **não têm duração para ler**: dois vídeos removidos
    (status ERROR) e dois que exigem login. Esses links também não tocam no site.

- **Os 30 vídeos imersivos do site antigo (Wix)** entraram na categoria Imersivo
  (`importar-imersivos.js`).
  - Os dados vêm do **VideoObject** que a página publica sobre si — nome,
    duração e embed — e não do texto visível. Eles aparecem de duas formas na
    página, dentro de uma lista e soltos; a primeira versão da varredura exigia
    o campo "position" e **perdia 17 dos 30**.
  - Os 12 que o Wix não informava duração foram preenchidos pela busca
    automática no YouTube, ao serem cadastrados. Nenhum ficou sem.
  - O sufixo "injected", sujeira do editor do Wix, sai do nome. O marcador de
    360° é ligado quando o próprio nome diz 360.

- **O card não fica mais transparente ao passar o mouse.** Ao entrar o ponteiro,
  a thumb sai para o preview do YouTube ocupar o lugar — e nesse intervalo não
  havia nada por baixo: o card virava um buraco com o fundo da página passando
  através. Agora a thumb tem base preta. Vale também para vídeo sem thumb e para
  preview que não carrega.
  - Efeito colateral de o card ter deixado de ter fundo próprio: o fundo escuro
    vinha do SpotlightCard, que foi desligado para tirar o contorno azul.

- **Grid de vídeos: o card virou a thumb.** Fora a barra preta de baixo, fora o
  contorno azul fixo; ficou o retângulo 16:9 da imagem, com o título dentro dela
  e o brilho de destaque só ao passar o mouse — o mesmo do resto do site.
  - **O contorno azul vinha escrito no elemento**, não na folha de estilo: é o
    SpotlightCard que aplica fundo e borda inline, e inline vence CSS. Por isso
    ele é desligado ali onde o card é montado, e não em `styles.css`. Era também
    o motivo de a regra de hover que pintava a borda nunca ter efeito.
  - **A grade deixou de empilhar os cards.** A sobreposição de 38px existia para
    esconder a barra de texto do card debaixo; sem a barra, ela cortaria a
    imagem. Agora é um grid com espaço entre as linhas.
  - O título desceu para dentro da imagem, sobre o degradê que já escurecia o pé
    dela. Sem isso o grid vira um mosaico de fotos sem nome.
  - A página de cliente usa o mesmo card e recebeu o mesmo tratamento; deixá-la
    de fora daria uma barra de texto solta no ar.

- **Fora a barra de filtro por empreendimento** nas categorias. Ela criava um
  botão por empreendimento: com quase cem vídeos cadastrados virou uma parede de
  botões, e o nome do empreendimento já é o título do vídeo. Saiu o estado, o
  parâmetro na URL e o filtro.

- **Importador da planilha de portfólio** (`importar-planilha.js`). Lê a
  planilha PORTFÓLIO FRAMETY e cadastra os vídeos pela API do site.
  - **A categoria é o nome da tabela do Google Sheets**, e esse nome é metadado:
    não sai na exportação em CSV. Foi preciso abrir a planilha para lê-los. Os
    dez nomes estão escritos no script, na ordem em que as tabelas aparecem em
    cada bloco de colunas; se alguém acrescentar uma tabela, o script para e
    avisa que a contagem não bate, em vez de cadastrar na categoria errada.
  - A coluna chamada CATEGORIA na planilha (ALTO/MÉDIO PADRÃO, POPULAR) é o
    **padrão do empreendimento** — campo do vídeo, visível só no modo de
    apresentação. PORTFÓLIO (case de sucesso / comercial) vira etiqueta.
  - **"Popular" entrou na lista de padrões** do console e do modo de
    apresentação: é o termo que a planilha usa, e sem ele o vídeo importado
    abriria como "não informado" e perderia o dado ao ser salvo.
  - Seguro de repetir: vídeo cujo link do YouTube já esteja cadastrado é pulado.
    Roda em ensaio por padrão; só grava com `--valendo`. A senha vem do
    ambiente, nunca do arquivo.
  - Ensaiado contra um banco descartável antes de encostar em produção: 96
    vídeos nas dez categorias, com "Timelapse" criada do zero.

- **Etiquetas de seção em branco pleno.** As linhas miúdas que abrem cada seção
  ("— 03 / CATEGORIAS") estavam no cinza de apoio (`--ink-mute`, #5b5b66). Esse
  tom serve a parágrafo; em letra de 11px, maiúscula e espaçada, ele deixava a
  etiqueta quase ilegível. Agora são brancas e opacas — a hierarquia continua
  vindo do tamanho, que é o que ela sempre foi ali.
  - São sete, e estavam escritas em três lugares diferentes: as classes
    `.eyebrow`, `.section-head .num` e `.process-section-label`, mais quatro
    com a cor dentro do próprio elemento no JSX. Cor escrita no elemento vence
    folha de estilo, então não bastava mexer no CSS.

- **O baralho do processo parou de piscar.** O cartão subia, saía de debaixo do
  ponteiro, perdia o hover, caía, recebia de novo — e oscilava sozinho com o
  mouse parado no mesmo lugar.
  - A causa era alvo e movimento serem a mesma coisa. Agora são duas camadas: o
    `<article>` é a área de mouse e **nunca se mexe**; quem sobe é um
    `.dc-interno` dentro dele. As áreas se encostam, cobrindo o baralho inteiro,
    então o destaque só troca quando o ponteiro chega ao cartão vizinho.
  - A subida caiu de 420ms para **190ms**: o movimento acompanha o mouse em vez
    de arrastar atrás dele. Cor e brilho continuam em 380ms, onde a demora não
    aparece.

- **Telas grandes: o site inteiro é ampliado em bloco.** Num 4K a 100%, o
  conteúdo ficava do tamanho de sempre dentro de uma tela três vezes maior.
  - **A estratégia anterior era a oposta e foi removida**: alargava o contêiner
    (2000px em 2K, 3000px em 4K, 5600px em 8K), aumentava as colunas da grade e
    remendava tamanhos à mão. Isso *espalhava* o conteúdo em vez de aumentá-lo —
    linhas longuíssimas e a letra do mesmo tamanho. As duas juntas enchiam a
    tela inteira, sem margem nenhuma.
  - O layout tem **3102 valores em px fixo contra 30 clamp()**: reescrever em
    unidade relativa seria trocar três mil números e ainda assim perder a
    proporção entre eles. Ampliar em bloco preserva o desenho exato — a mesma
    cara, só maior.
  - A escada pede **largura E altura**: numa tela larga e baixa, ampliar pela
    largura faria o conteúdo não caber na vertical.
  - **As 29 unidades de viewport foram divididas pela ampliação.** Sem isso, uma
    capa de 100vh com o site em 1,9 renderizaria 1,9 telas de altura: o zoom
    amplia o que é px, mas 100vh continua sendo a tela, medida por fora.
  - Medido: 1366 e 375 sem ampliação, 1920 em 1,15, 2560 em 1,35, 3840 em 1,9.
    Em todas, a capa cabe exata na tela e não há rolagem horizontal.

- **O ponteiro some e o carro obedece de qualquer canto da tela.** Enquanto a
  partida corre, o jogo prende o ponteiro ao campo: o cursor desaparece, o mouse
  não sai da janela e o movimento chega como deslocamento em vez de posição.
  Resolve as duas queixas de uma vez — a seta deixa de atravessar o jogo, e a
  mão longe do campo continua valendo, porque não existe mais dentro e fora.
  - **Prender é pedido no clique de "Começar"**, que é o gesto que o navegador
    exige; o fim da partida devolve o cursor, necessário para digitar o nome.
  - **Quando prender não é permitido** (página embutida num painel, navegador
    antigo), nada quebra: o controle volta a ser por posição, mas ouvindo o
    documento inteiro em vez de só o campo — o carro continua respondendo de
    qualquer lugar da tela. E o cursor some assim mesmo, por CSS, na tela
    inteira do jogo enquanto se joga.
  - Toda recusa do navegador é engolida: promessa rejeitada sem tratamento
    virava erro vermelho no console de quem só queria jogar.
  - Nada disso toca o placar: a mudança é só na tela do jogo.

- **A faixa preta no topo era do arquivo do reel, não da página.** O vídeo é
  exportado em cinemascope: o quadro é 1920×1080, mas com tarjas pretas coladas
  em cima (115px) e embaixo (136px). Como a capa é colada na borda superior da
  tela, a tarja de cima virava uma faixa atravessando o topo do site. O ajuste
  anterior, na animação de entrada, não podia resolver isso — era outro
  problema, no mesmo lugar.
  - **A medida não é fixa nem chutada.** A capa busca dois quadros do próprio
    vídeo (o Cloudinary entrega qualquer segundo como JPEG), procura em
    miniatura onde a imagem começa e termina, e fica com o MENOR corte entre os
    dois — uma cena escura sozinha faria a conta enxergar tarja onde não há.
    Assim vale para qualquer reel que venha a ser enviado, com tarja ou sem.
  - Medido no reel atual: ampliação de 1,295 e recentragem de 1,08%, porque as
    tarjas são desiguais. **Custo de nitidez: 8%** — o trecho útil sai de 1080px
    de fonte para 900px de tela, então continua havendo mais pixel do que tela.
  - Sem Cloudinary (upload local, em desenvolvimento) a medição não roda e o
    vídeo fica como está.

- **Mídia servida pelo Cloudinary já convertida e no tamanho certo.** O arquivo
  continua no banco como veio; o que mudou foi a URL com que a página o pede.
  - **O reel da capa era 29,5MB** — mais do que todo o resto do site somado.
    Agora vai com q_auto, largura limitada a 1600 e **sem trilha de áudio**
    (ac_none): ele toca mudo, a faixa era peso puro. Medido: **12MB**, 59% a
    menos. Com q_auto:eco e 1280 desceria a 6,7MB, ao custo de artefato visível
    no céu — que é metade da imagem.
  - **Uma única thumb era um PNG de 2.255KB.** Com f_auto (WebP/AVIF para quem
    aceita), q_auto e c_limit na largura de uso: **41KB**. Cinquenta e cinco
    vezes menor, mesma imagem na tela.
  - As larguras são o dobro do espaço em tela, para telas densas: 800 para
    thumbs de vídeo, 600 para capa de categoria, 240 para logo de cliente. O
    c_limit nunca amplia — pedir 800 de uma foto de 600 devolve 600.
  - Passa direto o que não é do Cloudinary: upload local em desenvolvimento,
    thumb do YouTube, campo vazio. E aplicar duas vezes não duplica a receita.
  - O storyboard ficou de fora de propósito: o PDF precisa da imagem cheia.

- **Fim da faixa preta no topo do vídeo.** A entrada da página deslizava o
  `<main>` 20px para cima; como a capa é colada na borda de cima, durante esse
  trajeto o fundo da página aparecia acima dela, numa faixa preta atravessando a
  tela — a cada carga e a cada volta para a home. A entrada agora é só
  opacidade: deslizar 20px acrescentava pouco e a faixa custava caro.

- **Celular do Instagram no fim da home.** Chegando ao pé da página, um aparelho
  sobe do canto esquerdo, inclinado, mostrando o feed e um botão "Seguir";
  clicar leva ao perfil em aba nova. Sobe e desce conforme o visitante vai e
  volta do fim da página, e tem um X para dispensar.
  - **A tela é um print do perfil de verdade** (@frametyfilmes), tirado com o
    Chrome headless falando CDP: o `--screenshot` puro não servia porque o
    Instagram cobre o perfil com o modal "veja no app" e uma camada que escurece
    tudo. Pelo protocolo dá para remover as duas coisas e só então disparar a
    foto, com a tela emulada em 440×940. O print é trocável no console — e
    envelhece: é uma foto, não uma janela.
  - **As fotos são enviadas no console**, não puxadas do Instagram. O feed
    oficial exige conta Business ligada a uma página do Facebook, app na Meta e
    um token que expira a cada 60 dias — sem renovação, o mural quebra sozinho
    quando ninguém está olhando. Raspar também não é caminho: a página do perfil
    devolve só a casca para quem não está logado, e as imagens ficam em URLs
    assinadas que vencem.
  - O celular **não aparece** sem endereço de perfil válido (https://) ou sem
    print nem fotos: melhor ausente do que um aparelho de tela vazia convidando
    a lugar nenhum.
  - Abaixo de 900px ele some. Num celular de verdade, um celular desenhado no
    canto é estorvo em cima do conteúdo, e o rodapé já leva ao perfil.
  - O anel do retrato usa a cor de destaque do site, não o degradê do Instagram:
    o aparelho é nosso, não uma imitação da interface deles.

- **Minigame escondido em `/play`.** Pong na vertical: a barrinha de baixo é o
  carro da Skyline, a de cima é o computador, e a bola é um play azul. Cada
  rebatida vale um ponto; a cada ponto o adversário anda mais rápido atrás da
  bola e devolve mais forte. Perde-se de um jeito só — deixando a bola passar
  por baixo. Se o computador errar, ela bate no teto e volta.
  - Abre digitando **play** em qualquer lugar do site, ou pelo endereço direto.
    O atalho ignora campos de texto (ninguém quer o jogo abrindo no meio de um
    formulário) e zera o que já foi digitado depois de 1,2s sem tecla, para
    letras soltas não formarem a palavra por acaso.
  - **O carro é preparado no carregamento, em quatro passos.** O PNG enviado no
    console vira sprite sem que ninguém precise abrir um editor:
    1. **balde a partir das bordas**, não corte por limiar — o carro é branco no
       capô e no teto, e apagar "todo pixel claro" comeria o próprio carro; o que
       é fundo é o branco LIGADO à borda;
    2. **segunda passada só na base**, para a sombra sob as rodas: cinza sem cor
       na faixa 188–242. A faixa de tom sozinha não bastava — reflexo de capô e
       de vidro caem nela, e a passada entrou pelo para-brisa e abriu buracos na
       lataria; quem segura é a altura;
    3. **esfumar a franja** que sobra na fronteira do balde (o antisserrilhado do
       arquivo original) — era ela o chuvisco branco em volta do carro;
    4. **cortar na medida** e **reduzir pela metade a cada passo**, uma vez só.
       Ir de 640px para 168px num único desenho, a cada quadro, era o que deixava
       a imagem chiada. E a margem vazia do PNG fazia o carro sair menor do que a
       área que rebate — a bola voltava sem encostar em nada visível.
    Se a leitura dos pixels falhar (imagem de outro domínio sem CORS, que suja o
    canvas), a imagem é usada como veio: melhor um carro num quadrado branco do
    que um jogo sem carro.
  - **O campo tem tamanho lógico fixo (720×960)**, esticado por CSS. A física
    não muda de comportamento conforme a tela: a bola atravessa sempre os mesmos
    960 pixels, no celular ou no monitor grande. O passo de tempo é travado em
    1/30s — voltando de uma aba em segundo plano, um quadro gigante faria a bola
    atravessar a barrinha sem tocá-la.
  - O estado da partida mora num `ref`, não em `useState`: sessenta quadros por
    segundo mexendo em estado do React re-renderizariam a árvore sessenta vezes.
    Só pontos e fase são estado de verdade.
  - **Placar dos 20 últimos jogos**, guardado no servidor e mostrado do maior
    para o menor. Gravar é público — quem joga não tem login —, então a entrada
    é validada com rigor (nome curto e sem marcação, pontos inteiros com teto) e
    limitada a 20 registros por hora por IP.
  - **Ponto em cima do computador vale 20.** Quando ele não alcança a bola e ela
    bate no teto, o placar sobe vinte de uma vez, com um "+20" subindo na tela e
    um clarão na linha que o play atravessou.
  - **A dificuldade acompanha as rebatidas, não os pontos.** Com o bônus de 20
    entrando na conta da velocidade, um único ponto em cima do computador
    jogaria o jogo direto para o teto de velocidade — o prêmio viraria castigo.
    O aperto continua gradual; o bônus é só placar.
  - No console, aba **Minigame**: trocar o carro e zerar o placar.

- **Ícone da aba e prévia de link agora saem do console.** Nova aba "Marca &
  prévia": o favicon, e o cartão que WhatsApp, Telegram e Facebook montam quando
  alguém cola o link — título, descrição e imagem.
  - **Quem monta a prévia é o servidor, não o site.** O robô dessas redes não
    roda JavaScript: ele lê o HTML que sai do `/framety` e vai embora. As meta
    tags já eram injetadas na rota da SPA; o que mudou é que os valores vêm do
    banco em vez de estarem escritos no código.
  - **Prévia por página** para as rotas fixas (home, novidades, tutorial,
    cadastro de parceiro, configurador de sala); campo em branco herda o padrão.
    Só essas cinco são aceitas — categoria e vídeo já montavam a prévia com a
    capa do próprio conteúdo, e aceitar caminho livre deixaria pendurar meta tag
    em qualquer endereço do site.
  - **Seção da home não tem prévia própria**, e o painel diz isso: a prévia é por
    endereço, e destaques/sobre/contato não têm um.
  - `limparBranding` **não usa o `cleanContent`** do resto do conteúdo: aquele
    descarta qualquer chave fora de `[A-Za-z0-9_]`, e as chaves de "paginas" são
    caminhos (`/novidades`) — passavam por ele e sumiam. A limpeza é campo a
    campo, cortando tamanho e tirando tags.
  - O `type="image/png"` sai do `<link rel="icon">` quando o ícone vem do
    console: o arquivo enviado pode ser png, webp ou svg, e declarar o tipo
    errado é pior do que não declarar nenhum.

- **A cascata do lettering agora espera o texto entrar na tela** — e o título do
  contato ("Transforme seu próximo empreendimento…") passou a usá-la.
  - Antes bastava `body.home-pronta`. Na capa isso funcionava porque o texto já
    está visível quando a página abre; num título lá embaixo, a cascata rodaria
    inteira no primeiro segundo, longe dos olhos, e quem rolasse até lá acharia
    o texto parado. Agora são duas condições: página pronta **e** texto na tela.
  - A checagem é uma leitura de posição a cada 140ms, que morre quando o texto
    entra — não um IntersectionObserver, pela mesma razão do cartão de
    novidades: a página rola dentro de um contêiner e o evento nem sempre chega
    ao `window`.

- **Quadro de contato: horário comercial e botão para o WhatsApp.** Entrou a
  linha "Horário comercial — Segunda a sexta, das 8h às 18h" e, no pé do quadro,
  um botão "Entre em contato" que abre a conversa no WhatsApp já com a mensagem
  escrita.
  - O rótulo e o endereço do botão saem no console. Endereço em branco (ou
    inválido) esconde o botão em vez de renderizar um link quebrado.
  - **A página só monta o link se ele for http(s), mailto ou tel.** O campo é
    digitado no painel, e um href começando com `javascript:` viraria código
    rodando na home de quem visita. O botão abre em aba nova, com
    `rel="noopener noreferrer"`.

- **Quarta etapa no processo: "Entrega".** Entrou com o mesmo cartão das
  outras e a seta que vem da pós-produção.
  - **O recuo do zigue-zague deixou de ser um índice fixo.** Ele valia só para a
    segunda etapa (`i === 1`), então a quarta nasceria alinhada com a terceira e
    a seta ligaria dois cartões na mesma coluna. Agora alterna por índice ímpar,
    para qualquer quantidade de etapas criada no console.
  - As três tags da etapa nova ("Revisão final", "Arquivos finais", "Versões e
    formatos") são um recheio provisório — não foram ditadas, e saem no console.

- **Abertura do "Processo" em duas colunas, com um baralho de diferenciais.** O
  texto virou bloco de leitura à esquerda e cinco cartões empilhados ocupam a
  direita.
  - **O parágrafo saiu de dentro do `<h2>`.** Ele morava lá junto do título,
    separado só por um `<br/>` e uma cor apagada — herdava o corpo do título e
    virava um bloco de letra grande e cinza em vez de um texto para ler. Agora é
    um `<p>` de 15,5px com medida de 52ch; o título ganhou corpo próprio
    (`clamp(26px, 2.4vw, 36px)`), que ele nunca teve — vinha do `1.5em` que o
    navegador dá a qualquer `h2`.
  - **Os cartões são um porte do DisplayCards**, que chegou em React + Tailwind
    + shadcn com `lucide-react`. Nada disso existe aqui, então veio a ideia:
    cartões inclinados 8°, empilhados numa única célula do grid, cada um
    deslocado do anterior, apagados em cinza até o ponteiro chegar. O
    deslocamento vai na propriedade `translate`, separada do `transform`, para
    não brigar com o `skewY`.
  - Três desvios do original, cada um por um motivo: **z-index no hover** (com
    cinco cartões, levantar um de trás não adianta se ele continua pintado por
    baixo); **a máscara da direita sai no hover** (no original ela é fixa porque
    o texto é curto — aqui a linha de apoio é uma frase inteira); e **sem
    backdrop-filter** (desfocar o canvas do fundo animado foi o que engasgou a
    página de clientes).
  - **Cada cartão tem luz própria**: um respingo da cor de destaque no canto de
    cima, um fio claro na borda superior e um halo baixo em volta; o ícone
    acende junto e dobra o brilho no hover. O cinza de repouso caiu de 1 para
    0,25 — o filtro lava também as sombras coloridas, então cinza demais
    apagava justamente o brilho que ele deveria deixar passar.
  - **A caixa do baralho vem da contagem, não de um número escrito à mão.** Os
    deslocamentos vivem em `translate`, que não ocupa espaço: a altura reservada
    é calculada a partir de quantos cartões existem, e a largura de cada um cede
    quando são muitos. Assim ninguém adiciona um cartão no console e ele vaza
    por cima das etapas ou sai da coluna.
  - Abaixo de 980px o baralho vira lista: sem passar o mouse, uma pilha é um
    monte de cartão que ninguém abre.
  - Texto e cartões são editáveis no console, em Home → Processo.

- **Novidades: um mini blog dentro do site, montado no console.** Na abertura da
  home, um cartão entra no canto superior direito com etiqueta, título, texto,
  mídia e um botão que leva a `/novidades`.
  - **O cartão aceita foto, gif ou vídeo curto.** O upload já servia os três; o
    que mudou foi a página: URL de vídeo vira `<video>` mudo, em laço e sem
    controles — é um banner, não um player. Com "menos movimento" ligado no
    sistema ele fica parado e ganha controles. Gif continua sendo `<img>`.
  - O console barra arquivo acima de **20MB** antes de sair do navegador. O
    servidor aceita até 600MB, mas isso é teto de reel, não de um cartão que
    abre por cima da home; para um filme inteiro existe o bloco de YouTube.
  - **A página é feita de blocos** — texto, imagem ou vídeo do YouTube — na
    ordem definida no console. Cada tipo carrega só os campos que usa, então não
    existe bloco meio preenchido: um vídeo não guarda imagem, uma imagem não
    guarda HTML.
  - **O YouTube entra por id, não por URL.** O servidor extrai os 11 caracteres
    do endereço colado (`watch?v=`, `youtu.be`, `shorts`, `embed`) e guarda só
    isso; a página monta o player com o id. Nenhum endereço digitado no console
    vira `src` de iframe.
  - O texto dos blocos passa pelo mesmo `sanitizeHtml` do resto do site, e o
    conteúdo inteiro pelo `cleanContent` — os mesmos limites de tamanho e de
    profundidade dos textos da home. Ler é público; gravar exige o login.
  - **A entrada não usa IntersectionObserver.** O cartão espera `body.home-pronta`
    (o fim da animação de abertura) e entra 400ms depois — nascer antes seria um
    cartão por cima da abertura. A espera é uma leitura de classe a cada 120ms,
    que morre assim que o cartão entra: observers e eventos de scroll não são
    confiáveis aqui, porque a página rola dentro de um contêiner.
  - **Fechar vale só para a carga atual da página**: recarregar traz o cartão de
    volta. A primeira versão guardava em `sessionStorage`, e aí o X calava o
    aviso pelo resto da sessão — um aviso que some no primeiro clique não é
    visto por quem volta. Para tirá-lo do ar de vez existe o botão no console.

- **A frase do "Sobre" reorganizada.** "O frame mais importante do seu
  empreendimento em um vídeo." saía em três linhas, com "seu" sozinho no meio.
  - A culpada era uma quebra manual (`<br/>`) escrita para outro corpo de letra:
    o texto já quebrava sozinho antes de chegar nela. Tirada a quebra, a medida
    virou **30ch** e o `text-wrap: balance` distribui — agora são duas linhas
    parecidas, com o "empreendimento" em itálico abrindo a segunda.
  - Peso de 400 para 500 e corpo de até 88px para até 68px: no corpo grande da
    Albert Sans o 400 ficava esguio demais para a afirmação da seção, e 88px
    empurrava a frase para mais linhas do que ela precisa.

- **Parágrafo da capa reorganizado.** A primeira frase ("Somos o audiovisual do
  Grupo Skyline.") passou a carregar o peso — 500 e branco quase pleno — e o
  resto explica em tom mais baixo. Mesma família e mesmo tamanho: a hierarquia
  vem do peso e do brilho, não de outro corpo de letra.
  - Corpo de 14.5 para 15.5px, entrelinha de 1.6 para 1.68, e a medida agora é
    **56ch** em vez de 520px fixos — a linha de leitura acompanha o tamanho da
    letra em vez de ser um número solto. Com `text-wrap: balance` as três linhas
    saem equilibradas, em vez da última com duas palavras soltas.
  - Para o `<strong>` funcionar dentro da animação, o WhisperText teve de mudar:
    ele fatiava a string por espaços, o que partiria `<strong>duas palavras</strong>`
    no meio da tag. Agora lê o HTML como DOM e reconstrói, animando cada palavra
    DENTRO das tags. Reconstruir também descarta qualquer atributo — mais
    restrito do que o `dangerouslySetInnerHTML` que estava ali.

- **Albert Sans no lugar da Gibson/Outfit.** A tipografia do site inteiro passou
  a ser Albert Sans, nos mesmos pesos que o CSS já usava (300 a 800) e sem
  mexer em cor nenhuma.
  - Vem do **Google Fonts, não da Adobe**: o CSP do `server.js` já libera
    `fonts.googleapis`/`gstatic`, enquanto a Adobe Fonts exigiria abrir
    `use.typekit.net` no CSP e um kit próprio — para chegar na mesma família.
  - Saiu junto um `@font-face` morto: a Gibson era declarada só com `local()`,
    isto é, funcionava apenas em máquinas que tivessem a fonte instalada; todo o
    resto caía na Outfit. E o itálico do destaque do título pedia Space Grotesk,
    que nunca chegou a ser carregada (caía numa serifada do sistema) — agora é o
    itálico da própria Albert Sans.
  - **A JetBrains Mono ficou** nas etiquetas técnicas (REC · 00:00:19, ATUAL.
    22/05, as etiquetas de seção). Não é teimosia: com fonte proporcional os
    dígitos têm larguras diferentes e o cronômetro do REC dança a cada segundo.

- **O texto da capa entra em cascata, palavra a palavra.** Cada palavra aparece
  80ms depois da anterior, em 0.4s, com a curva do power2.out — o mesmo efeito do
  componente de referência.
  - Ele veio em GSAP + ScrollTrigger + Tailwind, e aqui não há nenhum dos três.
    Além disso o texto fica no topo da página: o gatilho de rolagem dispararia no
    primeiro quadro de qualquer jeito. Portado para CSS, o efeito não custa uma
    biblioteca e, sendo só opacidade, roda no compositor.
  - **A cascata espera a página aparecer** (`body.home-pronta`): a home entra com
    um fade de 1.2s que começa em 1.8s, e sem essa trava a animação toda
    aconteceria atrás da cortina.
  - A divisão em palavras respeita o HTML do campo: `<br>` vira uma peça própria
    (senão ficaria grudado na palavra vizinha) e uma tag aberta segura as
    palavras seguintes, para `<em>duas palavras</em>` não virar duas metades de
    tag. O subtexto usa cascata mais rápida (18ms) e começa depois do título — a
    80ms por palavra, um parágrafo de 20 palavras levaria quase dois segundos
    pingando na tela.
  - Entre as palavras vai um espaço de verdade, não margem: com margem o texto
    do `<h1>` sai "Audiovisualquetransforma" para quem copia, para o leitor de
    tela e para o buscador — parece certo na tela e está errado no conteúdo.
  - Com `prefers-reduced-motion` o texto aparece inteiro, sem cascata.

- **A capa ganhou texto.** No canto de baixo à esquerda entrou a frase
  "Audiovisual que transforma empreendimentos em experiências." com o parágrafo
  sobre o Grupo Skyline embaixo.
  - O `h1` da capa existia mas vivia escondido (servia só a buscador e leitor de
    tela, com um texto que não era o da tela). Agora ele é o texto de verdade,
    num corpo bem menor que o antigo (48px no lugar de até 132px): a frase é
    longa e divide a tela com o vídeo. No celular ele passou a aparecer — antes
    era `display: none`, porque não havia texto nenhum na capa.
  - O rodapé da capa subiu de 80px para 116px: a última linha do subtexto
    encostava na barra do REC, que é absoluta no rodapé da seção. Agora sobram
    28px entre as duas.
  - Título e subtexto são editáveis no console, no mesmo bloco da capa.

- **A marca do Grupo Skyline no topo virou link** para skylineip.com.br, em nova
  aba — no cabeçalho e na barrinha compacta das páginas de categoria. O clique
  para nela (`stopPropagation`), senão contaria também para o atalho de três
  cliques no logo que abre o login do console.

- **Capa mais direta.** As duas linhas de texto sobre o vídeo (Demo Reel /
  Director's cut e Studio / Go-Sp-Brasil) saíram, e entrou um segundo botão,
  **Fale com um especialista**, que leva à seção de contato — ao lado do
  "Conheça mais vídeos", que continua indo para os projetos. Os dois textos
  também saíram do painel de textos do console, onde agora só existem os dois
  botões; no celular eles ficam lado a lado em vez de empilhados.
  - Os dois têm o mesmo tamanho (240×51): a coluna passou a esticar os botões até
    o mais largo, e o `.btn-accent` ganhou uma borda transparente de 1px para ter
    a mesma caixa do `.btn-ghost`, que sempre teve borda — sem isso, dois botões
    lado a lado saem 2px diferentes em qualquer lugar do site.

- **Modo Apresentação com texto legível.** Os cinzas de 20–40% que funcionam num
  monitor somem no projetor, que é onde essa tela é usada. Subida geral, mantendo
  a hierarquia (rótulo < item < ativo): itens da coluna de 0.38 para 0.72,
  rótulos dos grupos de 0.20 para 0.42, contagens de 0.18 para 0.50, meta dos
  cards de 0.30 para 0.60, título do card para branco puro. As opções sem vídeo
  continuam apagadas, mas de 0.42 para 0.62 — apagado o bastante para ceder
  atenção, não para sumir.

- **Padrão e formato saíram do site e viraram filtro na Apresentação.** A
  classificação do empreendimento é conversa comercial, não informação de
  visitante: ela sumiu da ficha do vídeo no site aberto e virou **dois grupos a
  mais na coluna do modo Apresentação**, ao lado de Categorias e Ordenar.
  - Eles **não filtram por cima da categoria**: são outra maneira de recortar o
    acervo, no mesmo nível dela. As três listas dividem uma seleção só, então
    escolher "Altíssimo" mostra uma faixa chamada Altíssimo com os vídeos daquele
    padrão, de qualquer categoria — e desmarca a categoria que estava escolhida.
    Em "Todos os vídeos" o acervo continua vindo separado por categoria.
  - As listas ficam sempre à vista, com a contagem ao lado; as opções zeradas
    ficam apagadas, mas continuam clicáveis e levam ao aviso de lista vazia. O
    destaque do topo só aparece em "Todos os vídeos" — em qualquer recorte ele
    exibiria um vídeo de fora.
  - Onde continua visível: o formulário de vídeo (que é onde se preenche) e a
    linha da lista no console, que também é tela interna.

- **O salto das thumbs era eu quem causava.** Para deixar o card em destaque
  reto, eu desligava a animação de inclinação (`animation-name: none`) — e ao
  sair do hover ela **recomeçava do próprio início**, com o atraso negativo
  levando o card para uma fase que não era a dele. Daí o pulo do nada.
  - Agora a animação nunca para. O card ganhou uma **face interna** que gira o
    contrário do ângulo em que o card está: o ângulo é lido da matriz no quadro
    seguinte ao hover (a pausa vem do mousemove da faixa, e ler no mesmo quadro
    pegava o valor ainda andando). Resultado medido: inclinação do card −10,83°,
    giro da face +10,83°, **resultante 0** — reta, sem interromper nada.
  - O nascimento também ficou mais gradual (a entrada passou de 5% para 16% do
    trajeto), para o card não brotar no meio da cena.

- **Passo do destaque mais contido**, agora que são poucos cards: 11cqw para
  5cqw, e a transição de 0.18s para 0.32s.

- **A faixa perdeu o limite visível.** Em vez de uma segunda camada de máscara
  (que custaria a cada quadro), o próprio fundo termina transparente em cima e
  embaixo. Os dois fios de 1px saíram — eram justamente a linha que denunciava a
  borda.

- **Quatro cards por trilho, e a faixa deixou de ser preta chapada.**
  - O tamanho aparente cresce em progressão geométrica, então cortar de 13 para 4
    cards abriria vãos enormes entre eles. Para os quatro caberem numa faixa de
    tamanhos mais curta, o nascimento subiu de 1.4 para 4.4cqw — cada card fica
    ~1,45x o anterior (93 · 136 · 199 · 291px numa tela de 1200) e a fita segue
    contínua: a linha do eixo continua clicável de ponta a ponta.
  - O fundo do palco caiu de 86–97% para **42–66% de opacidade**: ainda separa o
    corredor do fundo animado, mas agora deixa o site aparecer por trás em vez de
    virar uma tarja preta.

- **Corredor liso: a animação estava presa na thread principal.** Os keyframes
  animavam `pointer-events` junto com `transform`/`opacity` — e basta uma
  propriedade que o compositor não saiba animar para a animação INTEIRA cair na
  thread principal. Eram 26 rodando assim, o que aparecia exatamente como
  engasgo. Agora só entram `transform` e `opacity`; quem ignora o clique num
  card quase invisível é o próprio manipulador, que lê a opacidade na hora.
  - Cuidado que isso trouxe: os contêineres do palco têm `pointer-events: none`
    (para não roubarem o clique dos cards do fundo) e isso é **herdado** — era o
    keyframe que devolvia `auto` ao card. Sem ele, nada era clicável; o `auto`
    passou para a regra do card.
  - Junto: a máscara do palco virou uma camada em vez de duas compostas, e o
    palco ganhou `contain: layout paint`.
  - **O maior peso da página não era o corredor:** o fundo animado tinha um
    `blur(18px)` de tela cheia refeito a cada quadro, porque o canvas redesenha
    sempre. Caiu para `blur(9px)` com metade da resolução — o desfoque esconde a
    diferença.

- **Os cards saem apagando.** A opacidade voltou ao fim do trajeto (últimos 12%):
  antes o card sumia de um quadro para o outro quando a volta reiniciava.

- **A pausa do corredor agora tem uma faixa própria.** Antes qualquer canto do
  palco segurava a animação; o palco é alto por causa dos cards da frente, mas a
  fita de vídeos ocupa só uma tira no meio — então o corredor travava com o
  ponteiro longe de qualquer vídeo. A zona sensível passou a ser 40%–68% da
  altura, centrada no eixo de fuga, medida pela posição do ponteiro (o CSS não
  sabe recortar :hover). Fora dela o corredor segue andando; o destaque e a
  legenda também só valem lá dentro.

- **Menu do topo acertado com a nova ordem das seções.** Os links passaram a ser
  Início · Projetos · Categorias · Sobre · Contato, seguindo a página.
  - Junto, um bug que a reordenação expôs: o item aceso saía de um laço que
    confiava na ORDEM DO ARRAY de ids, e não na posição das seções. Com Projetos
    acima de Categorias, estar em Categorias acendia Projetos. Agora vence a
    seção mais abaixo que já passou pela linha de leitura — reordenar a página de
    novo não quebra mais o menu.

- **Destaque do card de vídeo agora é instantâneo**: as transições voltaram de
  0.45–0.5s para 0.14–0.18s. O movimento do corredor segue calmo (30s); o que
  ficou rápido é só a resposta ao cursor.

- **Corredor mais calmo, e sobre uma faixa preta.**
  - **Ritmo:** a travessia passou de 20s para 30s e os keyframes de 28 para 20
    amostras; as transições do destaque foram de 0.3s para 0.45–0.5s com uma
    curva sem repique. O movimento acompanha o cursor em vez de estalar.
  - **Leveza de verdade:** o corredor **para de desenhar quando a seção sai da
    tela** (IntersectionObserver com 120px de folga). São 26 cards em 3D girando
    o tempo todo; sem isso eles seguiam custando GPU enquanto o visitante lia o
    resto da página. Se o navegador não tiver o observer, o padrão é seguir
    animando — nunca ficar parado por engano.
  - **Faixa preta ao fundo:** um radial quase preto atrás do corredor, com dois
    fios de luz de 1px em cima e embaixo. Como a máscara do palco dissolve as
    quatro bordas, a faixa não tem contorno — ela simplesmente some no fundo
    animado do site em vez de brigar com ele.

- **Corredor: pontas que somem, cards do meio clicáveis e salto no destaque.**
  - **O clique no meio não funcionava por um motivo de geometria, não de código
    de evento:** um card com tamanho aparente menor que o próprio tem `z`
    NEGATIVO — ele fica atrás do plano z=0 dos contêineres do palco, e uma caixa
    transparente que cobre o palco inteiro continua valendo no teste de clique.
    Só os cards da frente (z positivo) respondiam. `pointer-events: none` nos
    dois contêineres resolve; quem volta a receber o ponteiro é o card. Medido:
    a linha do eixo saiu de "clicável só nos 15% de cada ponta" para clicável
    inteira.
  - **O corredor inteiro se dissolve no fundo da página**, por máscara no palco:
    forte nas laterais, onde os cards sairiam cortados pelo limite, e suave em
    cima e embaixo, para a seção não ter borda. A máscara fica fora do contexto
    3D (que vive nos contêineres internos) — aplicada no meio dele, achataria a
    cena. Nos keyframes sobrou só o nascimento translúcido, para o card não
    pipocar no ponto de fuga; enquanto está assim ele solta o ponteiro (a
    propriedade `pointer-events` anima em degrau), para não roubar o clique de
    quem está atrás.
  - **Trilhos mais fechados** (afastamento do eixo de 42 para 30cqw): os cards
    vêm mais por dentro e os da frente não escapam pelas laterais antes de dar
    para vê-los.
  - **O card sob o cursor desliza para o lado e fica reto.** Só isso: um passo
    lateral de 11cqw em direção ao miolo do corredor (para a esquerda se estiver
    no trilho da direita e vice-versa), sem crescer e sem avançar em profundidade.
    - Para o card poder ficar **reto** foi preciso partir a animação em duas: uma
      leva o invólucro pelo corredor (posição, opacidade, ponteiro) e outra só
      inclina o card dentro dele. A inclinação vive no `transform`, que pertence
      à animação e não pode ser sobrescrito por regra nenhuma — com ela numa
      animação própria, basta desligá-la no hover e o card se endireita sozinho,
      sem perder o lugar no corredor. Medido no card em destaque: matriz
      identidade, ou seja, zero perspectiva.
    - O nome dessa animação vai numa variável CSS, não em `animation-name`
      inline: estilo inline vence a folha, e a regra do destaque precisa poder
      desligá-la (foi o mesmo tropeço do atalho `animation`, algumas rodadas
      atrás).
  - **Escala geral menor**: a altura aparente na saída caiu de 30 para 20cqw (e o
    nascimento de 1.7 para 1.4), o número que governa o tamanho do corredor
    inteiro. Na prática o maior card foi de 922px para 504px numa tela de 1200.
  - A fita passou de 9 para 13 cards por trilho: ela só fica sólida enquanto
    cards vizinhos se sobrepõem, e com poucos cards sobravam vãos no meio.

- **Destaques viraram um corredor 3D, e subiram na página.** A seção *Vídeos em
  destaque* passou para antes de *Categorias* (as etiquetas trocaram de número
  junto: 02 para projetos, 03 para categorias) e trocou a galeria empilhada por
  um corredor em perspectiva — dois trilhos de cards vindo do fundo em direção a
  quem olha.
  - O componente de referência é React+Tailwind+TS e depende de `cn`/`@/lib/utils`;
    aqui virou JSX simples com CSS. O que veio inteiro é a **geometria**, que é o
    miolo dele: profundidade escrita como tamanho aparente em progressão
    geométrica (espaçar z linearmente descola os cards da frente), trilhos que
    abrem forte e depois seguram, e o card nascendo do outro lado do eixo para a
    garganta do corredor nunca abrir um buraco. Os números foram reajustados de
    card retrato para 16:9.
  - **As três diferenças pedidas:** passar o mouse **para** o corredor; o card sob
    o cursor acende enquanto os outros recuam, com o nome do vídeo numa legenda
    parada no rodapé do palco (legível, já que o card está inclinado); e os dois
    trilhos **não repetem vídeo entre si** — a lista de destaques é partida ao
    meio, cada metade corre de um lado.
  - A pausa exigiu separar as propriedades de animação: o atalho `animation`
    carrega `play-state: running` embutido e, aplicado inline, vencia a regra do
    `:hover`. Card sem capa mostra o gradiente da categoria com o título por
    cima, em vez de um retângulo vazio. No celular o corredor sai de cena — 18
    cards em 3D não valem a bateria — e a faixa horizontal que já existia
    continua no lugar dele.

- **Descrição da pasta não corta mais.** Duas causas empilhadas. A primeira: o
  recorte de duas linhas nunca chegou a valer, porque `.folder-panel` é flex e
  item de flex blockifica o `display:-webkit-box` de que o `-webkit-line-clamp`
  depende — o clamp mudou para um `<span>` dentro do `<p>` e o `max-height`
  virou 2.9em, exatamente duas linhas de 1.45 de entrelinha.
  - A segunda, que era a de verdade: **a altura do painel era uma porcentagem do
    card**. Card estreito, painel curto — e a descrição, que tem altura em pixels,
    não cabia. O painel passou a ser ancorado embaixo com altura do próprio
    conteúdo (`bottom: 0; top: auto`), então ele cresce o quanto o texto precisar
    e nunca corta. A aba mudou para dentro do painel, pendurada em `bottom: 100%`,
    para acompanhar a borda de cima que agora se move. O `--folder-lip` deixou de
    existir.
  - De quebra, a pasta fechada ficou igual em todo card (uma faixa de ~52px em vez
    de 36% da altura), o que dá ainda mais capa à mostra nos cards maiores. O
    rodapé, ao sumir no hover, devolve o espaço dele para a descrição em vez de
    só ficar invisível.

- **Pasta aberta fica limpa e ganha um botão de compartilhar.** Ao passar o
  mouse, a contagem de vídeos e a data de atualização somem e a frente da pasta
  desce 24px em vez de subir — a área de foto salta de 42% para **59% do card**,
  sobrando na tela só o nome e a descrição.
  - No canto de cima aparece um **botão pequeno de compartilhar** que copia o
    link daquela categoria (`/assistir/<id>`, o mesmo endereço que o botão da
    própria página de categoria usa) e mostra um **"Link copiado."** no rodapé da
    tela — o primeiro aviso desse tipo no site público; o console já tinha o seu.
  - O clique no botão não abre a categoria junto, e o Enter/Espaço no card só
    vale quando o foco está no card, não no botão.
  - A cópia tenta três caminhos: a API moderna, um `textarea` + `execCommand`
    (que cobre o site aberto pelo IP da rede no celular, onde `navigator.clipboard`
    não existe, e a janela sem foco) e, por último, o prompt.

- **A capa dissolve no fundo animado.** O `.hero` era preto opaco e terminava
  numa linha reta contra o fundo animado. Agora ele é transparente e quem fecha a
  capa é uma máscara no `.hero-bg`: vídeo, véu e grão somem aos poucos no último
  terço, então existe um trecho onde a capa e o fundo convivem em vez de uma
  borda entre os dois. Os dois gradientes que terminavam em `var(--bg)` passaram
  a terminar em preto translúcido — o encerramento agora é da máscara.

- **A roleta de clientes para no hover.** Passar o mouse sobre um logo segura a
  fita; ao sair, ela volta a andar. Feito em CSS puro com `:has(.mq-item:hover)`,
  para o vão entre os logos não parar a rolagem por engano — e sem re-render.

- **Página de projetos por cliente: mais leve e sem baralho.** Ela abria um
  `backdrop-filter` de tela cheia por cima do canvas que redesenha todo quadro —
  o navegador refazia o desfoque da tela inteira a cada frame, e era daí que vinha
  o engasgo. Virou fundo quase opaco, que custa zero e esconde o mesmo tanto.
  Junto: enquanto qualquer overlay de tela cheia está aberto, o fundo animado
  para de desenhar (o próprio `_scrollLock` avisa o `wave-bg`). Os cards ficaram
  menores (5 colunas no desktop) e pararam de se sobrepor: o `-38px` de margem
  que cria o efeito de baralho na página de categoria não vale aqui, e o hover
  passou a ser um passo curto em vez do salto de 42px.

- **Mais capa à mostra na pasta.** A dobra desceu de 56% para 64%, a aba ficou
  6px mais baixa e o card ficou mais alto (proporção de 1.38 para 1.15) — a
  frente da pasta tem altura fixa em pixels, então esticar o card sobra tudo para
  a foto. A área de imagem saiu de ~25% para **42% da altura do card**, quase o
  dobro em pixels. A capa também clareou: 0.5 → 0.8 em repouso e 1.0 no hover,
  com o véu do topo e o facho azul mais leves (eram eles que lavavam a foto).

- **Pasta de categoria menor, com a foto saindo dela.** Fechada, a frente da
  pasta ocupa só o rodapé (a dobra desceu de 42% para 56%) — o miolo agora é a
  capa. No hover a frente desce 26px e a foto sobe 16px, como quem puxa a
  fotografia de dentro da pasta; a dobra volta a 46% para caber a descrição que
  se abre.

- **Storyboards e Produções saíram do console.** As duas abas, com tudo que as
  sustentava dentro do painel: estados, carregamento, salvamento automático das
  locuções, assinaturas de live-update, o modo foco do deck, o sino de
  comentários novos, o portão de senha da seção e o modal que trocava essa senha.
  A busca global (Ctrl+Espaço) também parou de oferecer storyboards no console —
  um resultado clicável que não abre nada é pior do que resultado nenhum; na
  página `/storyboards`, que continua existindo, a busca segue igual.
  - **O que continua no ar, de propósito:** `/storyboards` (índice protegido),
    `/sb/<código>` (o link que o cliente já recebeu para revisar) e
    `/producoes` (a visão somente-leitura), com as respectivas rotas da API. O
    `LocucoesPanel` continua no arquivo porque a visão compartilhada o usa.
  - **Efeito colateral a saber:** a senha da seção Produções não tem mais tela
    para ser trocada — o link `/producoes` continua pedindo ela, mas mudá-la só
    pela API. Se a ideia é aposentar também esses links, é outra remoção.

- **O vermelho da abertura virou azul.** A animação do preloader é um `.lottie`
  de quadros webp e o quadrado vermelho dos primeiros frames está assado nas
  imagens — não há cor para trocar por variável. A saída foi girar a matiz no
  próprio player: `hue-rotate(220deg) saturate(.7) brightness(1.2)` leva o
  `rgb(255,23,81)` original a `rgb(32,122,190)`, o azul do site, e não toca no
  resto — preto e branco não têm matiz para girar. Os valores saíram de uma
  varredura medindo o pixel em canvas, não de chute.

- **Vidro escuro com contorno azul em tudo.** O padrão do `SpotlightCard` deixou
  de ser branco a 4% e passou a ser `rgba(8,9,13,0.72)` com borda na cor de
  destaque — como ele desenha os cards do console, os cards de vídeo do site, a
  busca global e o modo apresentação, a mudança vale em todos de uma vez. As
  linhas da lista do console, os cards em grade e os destaques da home ganharam a
  mesma caixa. As pastas de categoria receberam o mesmo contorno e mostram mais
  da capa já fechadas (opacidade de 0.34 para 0.5).

- **Fundo animado com o brilho de volta.** O escurecimento do ajuste anterior foi
  desfeito (feixe em 0.6, sem fator final, esferas como eram). O desfoque e a
  rolagem continuam.

- **Fundo animado: mais escuro, desfocado e preso à rolagem.** O campo perdeu
  cerca de 40% de brilho (feixe de 0.6 para 0.45 e um fator final de 0.62; as
  esferas ficaram mais discretas) e ganhou `filter: blur(18px)`. O canvas é
  escalado em 1.12 por causa do desfoque: sem essa sobra o blur puxaria o vazio
  de fora e deixaria uma moldura clara na borda da tela. Como o desfoque cobre
  qualquer serrilhado, a cena passou a ser desenhada a 1x — no fim ficou mais
  barata do que antes.
  - **Rola junto com a página:** o campo desliza no eixo Y e as esferas sobem
    conforme a rolagem, sempre mais devagar que o conteúdo. A posição é lida no
    próprio quadro em vez de num listener de `scroll`: com o `body` como
    container de rolagem, o evento não chega à `window` e o fundo ficaria
    parado. Ler no rAF ainda dispensa debounce — já roda uma vez por quadro.
    A vinheta continua presa à tela, para as bordas não clarearem no meio da
    página.

- **Azul Skyline no lugar do vermelho.** A cor de destaque padrão do site passou
  a ser o azul da referência da marca (`#2E86C1`) — mesmo peso visual do vermelho
  antigo sobre o fundo escuro (contraste com o branco praticamente idêntico), só
  que azul. Como o CSS já era todo `rgba(var(--accent-rgb), …)`, bastou trocar o
  `:root`; os literais que sobravam no storyboard e no screendimension foram
  junto. O seletor de cor do console continua valendo por cima, e ganhou o azul
  como primeira opção.
  - No desenho 3D do screendimension o acento virou um azul mais claro
    (`0x5EC8F2`): no azul do site ele ficaria idêntico ao `blue` que já existia
    ali e as duas peças do desenho não se distinguiriam.

- **Fundo animado novo: campo dimensional.** O `wave-bg.js` — que desenhava onda
  pixel a pixel em canvas 2D — deu lugar a feixes de luz em ruído simplex com
  esferas de vidro (fresnel) em WebGL, com paralaxe do ponteiro.
  - O componente veio embrulhado num `<iframe srcdoc>` que busca three.js e
    tailwind no cdnjs. Não dava para usar assim: o CSP do site só libera script
    de `self` e unpkg, e `frame-src` apenas YouTube/Vimeo — o iframe carregaria
    em branco. O shader foi portado para o canvas que já existia; o three.js vem
    do unpkg, que o CSP já permitia por causa do React.
  - Rodando na própria página, o fundo ganha o que o iframe não teria: **segue a
    cor de destaque publicada no console** (o feixe usa `--accent`) e para de
    desenhar quando a aba está escondida. Com `prefers-reduced-motion` a cena
    congela num quadro. Sem three.js, cai num gradiente estático em vez de preto.

- **A pasta abre no hover.** A descrição da categoria agora fica fechada: em
  repouso o card mostra só o nome e a contagem. Ao passar o mouse (ou focar pelo
  teclado) a frente desce 22px em vez de 12px — mais capa à mostra — e a
  descrição se abre junto. O card deixou de recortar o próprio conteúdo para a
  frente poder descer para fora da caixa; quem arredonda a capa agora é o
  `.folder-cover-wrap`, e a pasta aberta sobe de camada para passar por cima das
  vizinhas.

- **Cor de destaque trocável pelo console.** Aba Home → *Cor de destaque*: nove
  cores prontas, seletor livre e campo hex. A escolha já repinta a tela enquanto
  você decide; só o que é publicado vale para quem abre o site.
  - Funciona porque o `styles.css` inteiro passou a escrever o vermelho como
    `rgba(var(--accent-rgb), …)` — eram 45 lugares com `rgba(230,57,70,…)` fixo.
    Publicar reescreve quatro variáveis no `<html>` (`--accent`, `--accent-rgb`,
    `--accent-hue` e `--accent-deep`) e o resto acompanha sozinho, inclusive o
    tom escuro e o brilho que segue o cursor nos cards (que é montado em `hsl`
    a partir da matiz).
  - O servidor só aceita `#RRGGBB`: o valor vira variável CSS na página de
    quem visita, então nada além de cor pode entrar por ali. Vazio = volta ao
    vermelho padrão. O painel de tweaks local virou reserva: a cor publicada
    ganha dele.
  - O deck de storyboard e o screendimension seguem no vermelho fixo — são
    ferramenta interna e o PDF exportado não entende variável CSS.

- **Categorias viraram pastas.** Os chips retangulares deram lugar a um card de
  pasta: a capa da categoria fica *dentro* dela, fraca em repouso; ao passar o
  mouse a frente desce alguns pixels — como quem abre a pasta — e a capa acende.
  Cada pasta mostra o nome na aba, a descrição, **quantos vídeos tem dentro** e a
  data da última publicação.
  - A silhueta da aba sai de dois raios: o convexo do próprio canto e um filete
    côncavo (máscara radial em `.folder-tab::after`) que emenda a aba na borda
    da frente — sem SVG, então o card estica em qualquer largura.
  - Sem capa enviada, o miolo é o gradiente da própria categoria, com um facho
    da cor de destaque por cima.
  - Um clique entra na categoria. O comportamento antigo — expandir no hover,
    tocar duas vezes no celular e o preview em vídeo do YouTube dentro do chip —
    saiu junto com os chips.

- **Textos da home que o console prometia e não entregava.** Os cabeçalhos de
  *Categorias* e *Projetos em destaque* e o botão do player estavam escritos
  direto no JSX — editar no console não mudava nada, e o `content.js` guardava
  um texto que já não era o da tela. Agora saem do console de verdade, e os
  padrões do `content.js` foram acertados para o que está no ar. Os campos que
  não existiam em lugar nenhum da página (rótulo e nome do grupo no rodapé,
  sufixo de projetos, botão do card de categoria) saíram do painel.

- **Padrão e formato do empreendimento na ficha do vídeo.** Duas listas novas no
  formulário de vídeo (valem tanto para criar quanto para editar): **padrão** —
  Baixo, Médio, Alto, Altíssimo — e **formato** — condomínio vertical, condomínio
  horizontal, business. São listas fechadas de propósito: texto livre viraria
  "Alto"/"alto"/"ALTO" no mesmo relatório. Ficam vazias ("não informado") nos
  vídeos antigos e aparecem na linha da lista do console e na ficha do vídeo
  aberto no site, só quando preenchidas.

- **Cards de categoria visíveis.** O contorno do card vinha do SpotlightCard, que
  usa a mesma cor do fundo translúcido para a borda — branco a 4%, invisível
  sobre a home escura. O chip agora passa `--backdrop` (base escura própria) e
  `--backup-border` (branco a 24%) para o componente, e o CSS cuida do que não é
  inline: brilho no topo, sombra embaixo e um anel claro no hover. O contador de
  vídeos saiu do cinza mais apagado, e as categorias sem vídeo (ou fora do hover)
  não caem mais para 28% de opacidade — ficam em 62%, discretas mas legíveis.

- **Os textos da home viraram campo no console.** A aba do demoreel virou
  **Home**: em cima continua o vídeo de capa, embaixo entrou todo o texto escrito
  na página inicial — menu, capa, categorias, destaques, clientes, sobre (com os
  números e a faixa rolante), processo, contato, rodapé e o botão do player.
  Cada seção é um bloco que abre; listas (números, palavras da faixa, etapas,
  linhas de contato, telefones, cidades) ganham e perdem itens ali mesmo.
  - O `content.js` continua sendo a fonte do texto **padrão**. O que é publicado
    no console fica no banco (`settings.siteContent`), volta em `/api/data` e
    entra por cima do padrão em `FRAMETY_APPLY_CONTENT` — listas são trocadas
    inteiras, não item a item, senão apagar um item não apagaria de verdade.
    "Restaurar padrão" apaga a versão salva e a home volta ao `content.js`.
  - Publicar vale na hora para quem já está com o site aberto: o `POST` entra no
    domínio `content` do live-update, o mesmo que já avisava sobre vídeos e reel.
  - Os campos `*Html` (título da capa, frase do sobre, título do contato,
    direitos autorais) passam pelo sanitizador — que agora aceita `class`, senão
    o `<span class="strike">` do texto padrão perderia o tachado.
  - **Painel longo não some mais no fim da tela.** A linha do grid do console
    crescia com o conteúdo em vez de rolar dentro da área principal; com
    `grid-template-rows: 100%` + `min-height: 0` a rolagem volta para o `main`
    e a barra de publicar fica sempre alcançável.

- **Vídeo da capa mais visível.** As três camadas que escureciam o demoreel
  (filtro do vídeo, vinheta e gradiente do `.hero-bg`) foram aliviadas —
  `brightness` de 0.6 para 0.92 e os pretos de 0.55 para ~0.30. O fade para o
  fundo na base continua, então o texto da capa e a próxima seção seguem legíveis.

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
