/* ============================================================
   content.js — todos os textos estáticos do site
   Edite aqui, sem precisar mexer no código dos componentes.
   ============================================================ */
window.FRAMETY_CONTENT = {

  nav: {
    links: [
      { id: "home", label: "Início" },
      { id: "trabalhos", label: "Projetos" },
      { id: "categorias", label: "Categorias" },
      { id: "sobre", label: "Sobre" },
      { id: "contato", label: "Contato" },
    ],
    cta: "Iniciar projeto",
  },

  hero: {
    /* Use tags <em> para itálico/destaque e <br/> para quebra de linha */
    titleHtml: "Audiovisual que transforma<br/>empreendimentos em experiências.",
    /* A primeira frase é a afirmação; o resto explica. O <strong> dá o peso
       (o WhisperText anima palavra a palavra dentro da tag). */
    subtitleHtml: "<strong>Somos o audiovisual do Grupo Skyline.</strong> Fazemos parte do hub de tecnologias imersivas e experiências digitais para incorporadoras e construtoras.",
    ctaButton: "Conheça mais vídeos",
    ctaContato: "Fale com um especialista",
    badge: "FRAMETY ·",
  },

  categories: {
    eyebrow: "— 03 / Categorias",
    /* A frase é uma só, partida em duas linhas para manter o desenho da seção:
       a primeira em branco, a segunda em cinza. */
    title: "Soluções audiovisuais",
    subtitle: "para cada etapa do empreendimento.",
    hint: "Passe o cursor para ver a capa. Clique para entrar.",
    hintMobile: "Toque para abrir a categoria.",
    /* Rodapé de cada pasta: contagem de vídeos e data da última mexida */
    countLabel: "vídeos",
    countLabelOne: "vídeo",
    updatedPrefix: "Atual.",
    emptyLabel: "sem vídeos",
    loadMore: "Carregar mais",
  },

  featured: {
    eyebrow: "— 02 / Projetos",
    title: "Vídeos em destaque",
  },

  clients: {
    eyebrow: "— Clientes & Parceiros",
    noProjects: "Nenhum projeto publicado para este cliente.",
  },

  about: {
    eyebrow: "— 04 / Sobre a Framety",
    /* Use <em> para itálico, <span class="strike"> para tachado, <br/> para quebra */
    /* Sem <br/>: a quebra fixa foi escrita para outro corpo de letra e hoje
       deixava "seu" sozinho numa linha. Quem distribui agora é o text-wrap. */
    quoteHtml: "O frame mais importante do seu <em>empreendimento</em> em um vídeo.",
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
    /* Baralho de diferenciais ao lado do texto de abertura. O título é a
       afirmação; o "sub" é a linha miúda que a explica. */
    cards: [
      { title: "Especialização imobiliária.", sub: "Conhecemos as etapas, os desafios e a linguagem dos lançamentos imobiliários." },
      { title: "Estratégia e narrativa.",     sub: "Cada escolha criativa nasce daquilo que o empreendimento precisa comunicar." },
      { title: "Produção completa.",          sub: "Integramos roteiro, captação, animação, edição, som e finalização." },
      { title: "Diversidade de formatos.",    sub: "Criamos soluções para campanhas, salas imersivas, eventos, redes sociais e pontos de venda." },
      { title: "Atuação em todo o Brasil.",   sub: "Produzimos histórias para empreendimentos, incorporadoras e construtoras de diferentes regiões." },
    ],
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
        arrow: "right"
      },
      {
        name: "Entrega",
        desc: null,
        tags: ["Revisão final", "Arquivos finais", "Versões e formatos"],
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
      { label: "Horário comercial", value: "Segunda a sexta, das 8h às 18h" },
    ],
    /* Botão no pé do quadro. O endereço é editável no console, e por isso a
       página só monta o link se ele for http(s), mailto ou tel — um href
       começando com "javascript:" viraria código rodando na home. */
    ctaLabel: "Entre em contato",
    ctaHref: "https://wa.me/5562993030440?text=Ol%C3%A1%21%20Gostaria%20de%20saber%20mais%20sobre%20v%C3%ADdeos%20para%20empreendimentos.",
  },

  footer: {
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

/* ------------------------------------------------------------------
   Os textos acima são o PADRÃO. O console (aba Home) grava uma versão
   editada no banco; ela chega em /api/data e é aplicada por cima daqui.
   Listas (stats, marquee, steps…) são substituídas inteiras — não
   mescladas item a item — para que remover um item no console remova
   de verdade.
   ------------------------------------------------------------------ */
window.FRAMETY_CONTENT_DEFAULTS = JSON.parse(JSON.stringify(window.FRAMETY_CONTENT));

window.FRAMETY_APPLY_CONTENT = function (override) {
  const merge = (base, over) => {
    if (Array.isArray(over)) return JSON.parse(JSON.stringify(over));
    if (over && typeof over === 'object' && base && typeof base === 'object' && !Array.isArray(base)) {
      const out = { ...base };
      for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
      return out;
    }
    return over === undefined ? base : over;
  };
  const defaults = window.FRAMETY_CONTENT_DEFAULTS;
  window.FRAMETY_CONTENT = (override && typeof override === 'object')
    ? merge(JSON.parse(JSON.stringify(defaults)), override)
    : JSON.parse(JSON.stringify(defaults));
  return window.FRAMETY_CONTENT;
};
