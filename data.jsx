// data.jsx — carrega dados do banco via API (síncrono para que o React renderize com dados frescos)
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
  window.getStoredReelUrl = () => window.FRAMETY_DATA.reel?.url || '';
})();
