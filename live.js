// live.js — real-time updates via Server-Sent Events (plain JS, no Babel).
// Exposes window.FRAMETY_LIVE.on(domain, cb) → returns an unsubscribe fn.
// Domains emitted by the server: 'content' | 'locucoes' | 'redirects' | 'storyboards'.
(function () {
  const listeners = { content: new Set(), locucoes: new Set(), redirects: new Set(), storyboards: new Set() };
  let source = null;
  let reconnectedOnce = false;

  const emit = (domain) => {
    (listeners[domain] || []).forEach((cb) => { try { cb(domain); } catch (e) { /* ignore */ } });
  };

  function connect() {
    try {
      source = new EventSource('/api/events');
    } catch (e) { return; }

    source.addEventListener('change', (e) => {
      let domain = null;
      try { domain = JSON.parse(e.data).domain; } catch (_) {}
      if (domain) emit(domain);
    });

    source.addEventListener('open', () => {
      // On a (re)connection after the first, refresh everything so a client that
      // was briefly offline catches up on anything it missed.
      if (reconnectedOnce) { emit('content'); emit('locucoes'); emit('redirects'); emit('storyboards'); }
      reconnectedOnce = true;
    });

    // EventSource reconnects automatically on error; nothing else to do here.
  }

  window.FRAMETY_LIVE = {
    on(domain, cb) {
      if (!listeners[domain]) listeners[domain] = new Set();
      listeners[domain].add(cb);
      return () => listeners[domain].delete(cb);
    },
  };

  connect();
})();
