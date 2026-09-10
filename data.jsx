// data.jsx — carrega dados do banco via API (síncrono para que o React renderize com dados frescos)

/* Cor de destaque do site. O CSS inteiro usa rgba(var(--accent-rgb), …), então
   reescrever essas quatro variáveis no <html> troca o acento da página toda —
   botões, bordas, brilhos, o glow dos cards e os detalhes do console.
   --accent-glow/-soft derivam de --accent-rgb no próprio styles.css. */
window.FRAMETY_ACCENT_DEFAULT = "#2E86C1";
window.FRAMETY_APPLY_ACCENT = function (hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || "").trim());
  const value = m ? m[1] : window.FRAMETY_ACCENT_DEFAULT.slice(1);
  const int = parseInt(value, 16);
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;

  // matiz para o glow dos cards (SpotlightCard monta a cor em hsl)
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
  let h = 0;
  if (d) {
    const rr = r / 255, gg = g / 255, bb = b / 255;
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const deep = "#" + [r, g, b].map(c => Math.round(c * 0.72).toString(16).padStart(2, "0")).join("");

  const root = document.documentElement;
  root.style.setProperty("--accent", "#" + value);
  root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--accent-hue", String(Math.round(h)));
  root.style.setProperty("--accent-deep", deep);
  // o fundo animado (wave-bg.js) usa a mesma cor no feixe de luz
  window.__waveBgAccent?.("#" + value);
  return "#" + value;
};

(function () {
  const FALLBACK = {
    brand: { name: "Framety", tagline: "Produtora audiovisual", location: "São Paulo, BR", year: "2026" },
    bgChoices: ["bg-comm", "bg-music", "bg-doc", "bg-brand", "bg-after", "bg-corp"],
    categories: [], videos: [], clients: [], reel: { url: "", name: "" },
  };

  let data = FALLBACK;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data', false); // síncrono — bloqueia até o servidor responder
    xhr.send();
    if (xhr.status === 200) data = JSON.parse(xhr.responseText);
  } catch (e) {
    console.warn('Framety: API indisponível, usando dados padrão.');
  }

  window.FRAMETY_DATA = data;
  // Textos da home salvos no console entram por cima do padrão do content.js.
  window.FRAMETY_APPLY_CONTENT?.(data.content);
  window.FRAMETY_APPLY_ACCENT(data.theme?.accent);
  window.getStoredReelUrl = () => window.FRAMETY_DATA.reel?.url || '';
})();
