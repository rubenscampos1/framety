/* rotas.js — o mapa de endereços públicos do site, num lugar só.

   O mesmo arquivo roda no navegador (window.FRAMETY_ROTAS) e no servidor
   (require), para que quem monta o link e quem o recebe nunca discordem.

     /                          home
     /projetos, /sobre, …       seção da home (ver SECOES)
     /clientes/<cliente>        página do cliente, por cima da home
     /<categoria>               página da categoria
     /<categoria>/<vídeo>       vídeo aberto, com a categoria por trás

   Endereços antigos (/framety, /framety#sobre, /framety/categoria/x,
   /framety/video/<id>, /framety/cliente/<id>) continuam valendo: o resolver
   devolve o endereço novo em `canonico` e quem chamou redireciona. */
(function (raiz) {
  // id da <section> na home → caminho. "trabalhos" aparece no menu como Projetos.
  const SECOES = {
    home: "",
    trabalhos: "projetos",
    categorias: "categorias",
    clientes: "clientes",
    ia: "ia",
    sobre: "sobre",
    processo: "processo",
    contato: "contato",
  };
  const SECAO_POR_CAMINHO = Object.fromEntries(
    Object.entries(SECOES).filter(([, c]) => c).map(([id, c]) => [c, id])
  );

  // Primeiro segmento que pertence a outra parte do site. Uma categoria com um
  // destes nomes ficaria inalcançável, por isso o servidor os recusa.
  const SISTEMA = [
    "api", "uploads", "framety", "console", "presentation", "cadastroparceiro",
    "tutorial", "novidades", "play", "producoes", "assistir", "screendimension",
    "sb", "storyboards",
  ];
  const RESERVADOS = new Set([...SISTEMA, ...Object.keys(SECAO_POR_CAMINHO)]);

  // "Lançamento — Fase 2" → "lancamento-fase-2"
  const slugify = (s) => String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  // Primeiro livre entre base, base-2, base-3…
  const slugUnico = (base, usados) => {
    const b = base || "item";
    if (!usados.has(b)) return b;
    let n = 2;
    while (usados.has(`${b}-${n}`)) n++;
    return `${b}-${n}`;
  };

  const urlSecao    = (id) => "/" + (SECOES[id] || "");
  const urlCategoria = (catId) => "/" + catId;
  const urlVideo    = (v) => `/${v.category}/${v.slug || v.id}`;
  const urlCliente  = (c) => `/clientes/${c.slug || c.id}`;

  const decodifica = (s) => { try { return decodeURIComponent(s); } catch (_) { return s; } };

  const achaCategoria = (cats, bruto, limpo) =>
    cats.find((c) => c.id === bruto || c.id === limpo) ||
    cats.find((c) => (c.idsAntigos || []).some((a) => a === bruto || a === limpo));

  const achaCliente = (clis, bruto, limpo) =>
    clis.find((c) => c.slug === limpo) ||
    clis.find((c) => (c.slugsAntigos || []).includes(limpo)) ||
    clis.find((c) => c.id === bruto);

  const achaVideo = (vids, cat, catSeg, bruto, limpo) =>
    (cat && vids.find((v) => v.category === cat.id && v.slug === limpo)) ||
    vids.find((v) => (v.slugsAntigos || []).includes(`${catSeg}/${limpo}`)) ||
    // Categoria certa, mas o vídeo veio pelo id antigo ou mudou de categoria.
    (cat && (vids.find((v) => v.id === bruto) || vids.find((v) => v.slug === limpo)));

  const resultadoHome = (secao) => ({
    tipo: "home", secao: secao || null, canonico: secao ? urlSecao(secao) : "/",
  });

  /* caminho + dados ({categories, videos, clients}) → o que a URL mostra, ou
     null quando o endereço não é uma página pública desta lista. `hash` só
     serve para os links antigos do tipo /framety#sobre. */
  function resolver(caminho, dados, hash) {
    const d = dados || {};
    const cats = d.categories || [], vids = d.videos || [], clis = d.clients || [];
    const brutos = decodifica(String(caminho || "/").split("?")[0])
      .toLowerCase().split("/").filter(Boolean);
    const limpos = brutos.map((s) => slugify(s) || s);
    const h = String(hash || "").replace(/^#/, "");
    const secaoDoHash = Object.prototype.hasOwnProperty.call(SECOES, h) && h !== "home" ? h : null;

    const categoria = (bruto, limpo) => {
      const c = achaCategoria(cats, bruto, limpo);
      return c ? { tipo: "categoria", categoria: c, canonico: urlCategoria(c.id) } : null;
    };
    const video = (v) => ({
      tipo: "video", video: v,
      categoria: cats.find((c) => c.id === v.category) || null,
      canonico: urlVideo(v),
    });
    const cliente = (c) => ({ tipo: "cliente", cliente: c, secao: "clientes", canonico: urlCliente(c) });

    if (brutos.length === 0) return resultadoHome(secaoDoHash);

    // Links antigos, todos debaixo de /framety.
    if (brutos[0] === "framety") {
      const [, tipo, bruto] = brutos, limpo = limpos[2];
      if (!tipo) return resultadoHome(secaoDoHash);
      if (tipo === "categoria" && bruto) return categoria(bruto, limpo);
      if (tipo === "video" && bruto) {
        const v = vids.find((x) => x.id === bruto) || vids.find((x) => x.slug === limpo);
        return v ? video(v) : null;
      }
      if (tipo === "cliente" && bruto) {
        const c = achaCliente(clis, bruto, limpo);
        return c ? cliente(c) : null;
      }
      return null;
    }

    if (SISTEMA.includes(brutos[0])) return null;

    const secao = SECAO_POR_CAMINHO[limpos[0]];
    if (secao) {
      if (brutos.length === 1) return resultadoHome(secao);
      if (secao === "clientes" && brutos.length === 2) {
        const c = achaCliente(clis, brutos[1], limpos[1]);
        return c ? cliente(c) : null;
      }
      return null;
    }

    if (brutos.length === 1) return categoria(brutos[0], limpos[0]);
    if (brutos.length === 2) {
      const cat = achaCategoria(cats, brutos[0], limpos[0]);
      const v = achaVideo(vids, cat, limpos[0], brutos[1], limpos[1]);
      return v ? video(v) : null;
    }
    return null;
  }

  const R = {
    SECOES, RESERVADOS, slugify, slugUnico,
    urlSecao, urlCategoria, urlVideo, urlCliente, resolver,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = R;
  else raiz.FRAMETY_ROTAS = R;
})(typeof window !== "undefined" ? window : globalThis);
