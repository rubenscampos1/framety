/* ============================================================
   content.js — todos os textos estáticos do site
   Edite aqui, sem precisar mexer no código dos componentes.
   ============================================================ */
window.FRAMETY_CONTENT = {

  nav: {
    links: [
      { id: "home", label: "Início" },
      { id: "categorias", label: "Categorias" },
      { id: "trabalhos", label: "Projetos" },
      { id: "sobre", label: "Sobre" },
      { id: "contato", label: "Contato" },
    ],
    cta: "Iniciar projeto",
  },

  hero: {
    /* Use tags <em> para itálico/destaque e <br/> para quebra de linha */
    titleHtml: "O frame mais importante do seu<br/>empreendimento em um vídeo.",
    meta1Label: "Demo Reel",
    meta1Value: "2026 · Director's cut",
    meta2Label: "Studio",
    meta2Value: "Go/Sp/Brasil",
    ctaButton: "Conheça mais vídeos",
    badge: "FRAMETY ·",
  },

  categories: {
    eyebrow: "— 02 / Categorias",
    title: "O que produzimos.",
    subtitle: "Em formatos que importam.",
    hint: "Passe o cursor para expandir. Clique para entrar.",
    cardBtn: "Ver filmes",
    loadMore: "Carregar mais",
  },

  featured: {
    eyebrow: "— 03 / Projetos em destaque",
    title: "Melhores vídeos:",
    subtitle: "Clique e assista.",
    desc: "Uma seleção dos últimos meses. Passe o cursor para ver o preview, clique para abrir o player limpo.",
  },

  clients: {
    eyebrow: "— Clientes & Parceiros",
    projectSuffix: "projetos",
    noProjects: "Nenhum projeto publicado para este cliente.",
  },

  about: {
    eyebrow: "— 04 / Sobre a Framety",
    /* Use <em> para itálico, <span class="strike"> para tachado, <br/> para quebra */
    quoteHtml: "O frame mais importante do seu<br/><em>empreendimento</em> em um vídeo.",
    stats: [
      { num: "+ de 1.000", label: "vídeos entregues" },
      { num: "+ de 80", label: "construtoras atendidas" },
      { num: "+ de 7", label: "anos de história" },
      { num: "+ de 11", label: "categorias de vídeos" },
    ],
    marquee: [
      "Direção", "Roteiro", "Captação", "Color grading",
      "Pós-produção", "Sound design", "Inteligência artificial",
    ],
  },

  process: {
    eyebrow: "— Sobre o processo",
    title: "Como transformamos",
    subtitle: "sua ideia em realidade.",
    steps: [
      {
        name: "Roteirização",
        desc: "Como etapa inicial do processo, conforme a categoria do vídeo, ajudamos a organizar suas ideias até chegarmos a uma estrutura coesa e que faça sentido para a sua produção.",
        tags: null,
        arrow: "right"
      },
      {
        name: "Produção",
        desc: null,
        tags: ["Captação", "Reuniões de alinhamento", "Aprovação de música e voz"],
        arrow: "left"
      },
      {
        name: "Pós produção",
        desc: null,
        tags: ["Edição", "Composição", "SFX", "VFX", "3D"],
        arrow: null
      },
    ],
  },

  contact: {
    eyebrow: "— 05 / Vamos conversar",
    /* Use <em> para itálico e <br/> para quebra de linha */
    titleHtml: "Tem um filme<br/>na cabeça? <em>Vamos<br/>tirar daí.</em>",
    rows: [
      { label: "E-mail", value: "comercial@skylineip.com.br" },
      { label: "Whatsapp", value: "(62)3705-1697" },
      { label: "Atendimento:", value: "Todo o território nacional" },
    ],
  },

  footer: {
    grupoLabel: "GRUPO",
    grupoName: "SKY LINE",
    phones: ["GO : 6237051697"],
    email: "comercial@skylineip.com.br",
    cities: ["Anápolis, GO"],
    /* Use <br/> para quebra de linha */
    copyrightHtml: "© 2026 Framety. Todos os direitos reservados.<br/>Uma empresa do grupo Skyline. Uso de imagem restrito.",
  },

  video: {
    ctaButton: "Quero um vídeo assim",
  },

};
