// Framety — API client (plain JS, sem Babel)
(function () {
  const T_KEY = 'framety_token';
  const getToken  = () => sessionStorage.getItem(T_KEY) || '';
  const setToken  = (t) => sessionStorage.setItem(T_KEY, t);
  const clearToken = () => sessionStorage.removeItem(T_KEY);

  async function req(method, url, body, isForm) {
    const opts = { method, headers: { 'x-auth-token': getToken() } };
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    else if (body) opts.body = body;
    const r = await fetch(url, opts);
    if (r.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("framety:session-expired"));
      throw { error: 'Sessão expirada. Faça login novamente.' };
    }
    if (r.status === 204) return null;
    const data = await r.json();
    if (!r.ok) throw data;
    return data;
  }

  window.API = {
    setToken, getToken, clearToken,

    // Auth
    login:          (password)       => req('POST', '/api/auth/login',    { password }),
    logout:         ()               => { req('POST', '/api/auth/logout'); clearToken(); },
    changePassword: (current, next)  => req('POST', '/api/auth/password', { current, next }),

    // Password recovery (admin token)
    recoverWithToken: (token, next) => req('POST', '/api/auth/recover-with-token', { token, next }),

    // Produções section password
    unlockProducoes:     (password) => req('POST', '/api/producoes/unlock',   { password }),
    setProducoesPassword:(next)     => req('POST', '/api/producoes/password', { next }),

    // Produções read-only share (scoped token, separate from the admin token)
    loginProducoesRO: (password)  => req('POST', '/api/auth/login', { password, scope: 'producoes-ro' }),
    getLocucoesWith:  (token)     => fetch('/api/locucoes', { headers: { 'x-auth-token': token } }).then(r => { if (!r.ok) throw { status: r.status }; return r.json(); }),
    setProducoesStatus: (token, pageId, uid, status) => fetch('/api/producoes/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ pageId, uid, status }) }).then(r => { if (!r.ok) throw { status: r.status }; return r.json(); }),

    // Data. Sends the auth token when present so the console sees ALL videos
    // (incl. drafts); on the public site there's no token → only public videos.
    // Without this, a newly-added draft video vanishes on the next live refetch.
    getData: () => fetch('/api/data', { headers: { 'x-auth-token': getToken() } }).then(r => r.json()),

    // Videos
    addVideo:      (v)    => req('POST',   '/api/videos',          v),
    updateVideo:   (id,v) => req('PUT',    `/api/videos/${id}`,    v),
    deleteVideo:   (id)   => req('DELETE', `/api/videos/${id}`),
    reorderVideos: (order)=> req('PUT',    '/api/videos/reorder',  { order }),

    // Categories
    addCategory:      (c)    => req('POST',   '/api/categories',       c),
    updateCategory:   (id,c) => req('PUT',    `/api/categories/${id}`, c),
    deleteCategory:   (id)   => req('DELETE', `/api/categories/${id}`),
    reorderCategories:(order)=> req('PUT',    '/api/categories/reorder',{ order }),

    // Clients
    addClient:    (c)    => req('POST',   '/api/clients',       c),
    updateClient: (id,c) => req('PUT',    `/api/clients/${id}`, c),
    deleteClient: (id)   => req('DELETE', `/api/clients/${id}`),

    // Uploads
    uploadReel:  (file)         => { const fd = new FormData(); fd.append('file', file); return req('POST', '/api/upload/reel',              fd, true); },
    deleteReel:  ()             => req('DELETE', '/api/upload/reel'),
    uploadCover: (catId, file)  => { const fd = new FormData(); fd.append('file', file); return req('POST', `/api/upload/cover/${catId}`,   fd, true); },
    uploadLogo:  (clientId, file)=>{ const fd = new FormData(); fd.append('file', file); return req('POST', `/api/upload/logo/${clientId}`, fd, true); },
    uploadThumb: (file)          =>{ const fd = new FormData(); fd.append('file', file); return req('POST', '/api/upload/thumb',             fd, true); },

    // Partners
    submitPartner: (data)  => req('POST',   '/api/partners',       data),
    getPartners:   ()      => req('GET',    '/api/partners'),
    deletePartner: (id)    => req('DELETE', `/api/partners/${id}`),

    // Tutorial — public read, admin write
    getTutorial:   ()      => req('GET',    '/api/tutorial'),
    saveTutorial:  (data)  => req('POST',   '/api/tutorial',       data),

    // AI Section
    saveAiSection:  (data)           => req('PUT',  '/api/ai-section',              data),
    uploadAiImage:  (itemId, file)   => { const fd = new FormData(); fd.append('file', file); return req('POST', `/api/upload/ai-image/${itemId}`, fd, true); },

    // Locuções (OS)
    getLocucoes:   ()      => req('GET',  '/api/locucoes'),
    saveLocucoes:  (data)  => req('POST', '/api/locucoes', data),

    // Storyboards — admin
    getStoryboards:   ()      => req('GET',    '/api/storyboards'),
    addStoryboard:    (data)  => req('POST',   '/api/storyboards', data),
    updateStoryboard: (id, d) => req('PUT',    `/api/storyboards/${id}`, d),
    deleteStoryboard: (id)    => req('DELETE', `/api/storyboards/${id}`),
    seenStoryboard:   (id)    => req('POST',   `/api/storyboards/${id}/seen`),
    // Só o console apaga comentário já enviado pelo cliente.
    deleteSbCommentAdmin: (id, cid) => req('DELETE', `/api/storyboards/${id}/comments/${cid}`),
    uploadStoryboardImage: (id, file) => { const fd = new FormData(); fd.append('file', file); return req('POST', `/api/upload/storyboard/${id}`, fd, true); },
    removeStoryboardAsset: (id, url, publicId) => req('POST', `/api/storyboards/${id}/asset/remove`, { url, publicId }),
    // Capa: miniatura do hub e imagem de preview do link do cliente (WhatsApp).
    uploadStoryboardCover: (id, file) => { const fd = new FormData(); fd.append('file', file); return req('POST', `/api/storyboards/${id}/cover`, fd, true); },
    removeStoryboardCover: (id) => req('DELETE', `/api/storyboards/${id}/cover`),
    // Onde as imagens enviadas ficam (durable = sobrevive a deploy).
    getStorageStatus: () => req('GET', '/api/storage-status'),

    // Storyboards — public client view (sem auth).
    // Leitura pelo caminho amigável cliente/produto/projeto (rota curinga, para
    // sobreviver a proxies que normalizam %2F) ou pelo shareSlug antigo; escritas
    // sempre pelo `token` opaco que veio na leitura.
    getStoryboardByPath: (path)        => req('GET',    `/api/sb/path/${path}`),
    getSharedStoryboard: (slug)        => req('GET',    `/api/sb/${slug}`),
    addSbComment:        (tok, data)   => req('POST',   `/api/sb/${tok}/comments`, data),
    deleteSbComment:     (tok, cid)    => req('DELETE', `/api/sb/${tok}/comments/${cid}`),
    submitSbComments:    (tok)         => req('POST',   `/api/sb/${tok}/submit`),
    approveSb:           (tok, data)   => req('POST',   `/api/sb/${tok}/approve`, data),

    // Links (short-link redirects)
    getRedirects:    ()          => req('GET',    '/api/redirects'),
    addRedirect:     (data)      => req('POST',   '/api/redirects', data),
    updateRedirect:  (slug,data) => req('PUT',    `/api/redirects/${slug}`, data),
    deleteRedirect:  (slug)      => req('DELETE', `/api/redirects/${slug}`),
  };
})();
