(() => {
  'use strict';
  const API = '/api/framyo/tasky';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, dataOnly) => v ? new Intl.DateTimeFormat('pt-BR', dataOnly ? { dateStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '—';
  const tokenKey = 'tasky_token';
  const tokenFramePlus = location.hash.match(/(?:^#|&)frameplus_token=([^&]+)/);
  if (tokenFramePlus) {
    localStorage.setItem(tokenKey, decodeURIComponent(tokenFramePlus[1]));
    history.replaceState({}, '', location.pathname + location.search);
  }
  const raizTasky = location.hostname.toLowerCase() === 'tasky.framety.com.br' ? '' : '/tasky';
  let state = { token: localStorage.getItem(tokenKey), usuario: null, times: [], tipos: [], membros: [], tarefas: [], aba: 'painel', filtro: 'ativas', busca: '', detalhe: null, admin: null, side: false, concluidasN: 3 };
  let streamAbort = null, streamToken = null, recargaTimer = null;

  async function api(path, opt = {}) {
    const r = await fetch(API + path, { method: opt.method || 'GET', headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !path.includes('/login')) { state.token = null; localStorage.removeItem(tokenKey); render(); }
    if (!r.ok) throw new Error(j.erro || j.error || 'Nao foi possivel concluir.');
    return j;
  }
  function toast(msg) { const x = document.createElement('div'); x.className = 'toast'; x.textContent = msg; document.body.appendChild(x); setTimeout(() => x.remove(), 2400); }
  function erro(el, e) { let x = $('.error', el); if (!x) { x = document.createElement('div'); x.className = 'error'; el.prepend(x); } x.textContent = e.message; }
  function iniciais(nome) { return String(nome || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase(); }
  function duracao(ms) { if (ms < 0) ms = 0; const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60; return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}min`; }
  function tempo(t) { const fim = t.resgatado_em || Date.now(); return duracao(new Date(fim) - new Date(t.criado_em)); }
  function total(t) { return duracao(new Date(t.concluido_em || Date.now()) - new Date(t.criado_em)); }
  function statusNome(v) { return ({ aberta: 'Aberta', em_andamento: 'Em andamento', aguardando: 'Aguardando', concluida: 'Concluida', cancelada: 'Cancelada' })[v] || v; }
  function shareUrl(t) { return `${location.origin}${raizTasky}/t/${t.slug}`; }
  function timeInfo(id) { return state.times.find((x)=>x.id===id) || { nome: 'Sem equipe', cor: '#788395' }; }
  function saudacao() { const h=new Date().getHours(); return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'; }
  function assetsRow(valor) {
    if (!valor) return '';
    if (/^https?:\/\//i.test(valor)) return `<a class="link-row" href="${esc(valor)}" target="_blank"><span>Assets · ${esc(valor)}</span><b>↗</b></a>`;
    return `<div class="link-row"><span>Assets · ${esc(valor)}</span><button class="btn ghost small" data-copy-assets="${esc(valor)}">Copiar caminho</button></div>`;
  }
  async function carregar() {
    if (!state.token) return render();
    try {
      const j = await api('/inicio'); Object.assign(state, j); state.usuario = j.usuario;
      const match = location.pathname.match(/^\/(?:tasky\/)?t\/([^/]+)/); if (match) await abrir(match[1], false);
      render(); conectarTempoReal();
    } catch (e) { state.token = null; localStorage.removeItem(tokenKey); render(); }
  }

  function atualizarAoVivo() {
    clearTimeout(recargaTimer);
    recargaTimer = setTimeout(async () => {
      if (!state.token) return;
      try {
        if (state.aba === 'config' || state.aba === 'admin') {
          state.admin = await api('/admin');
          await recarregar(true);
        } else await recarregar(true);
      } catch (e) { if (state.token) console.warn('[Tasky] atualização em tempo real:', e.message); }
    }, 90);
  }

  async function conectarTempoReal() {
    if (!state.token || streamToken === state.token) return;
    if (streamAbort) streamAbort.abort();
    const token = state.token, controle = new AbortController();
    streamAbort = controle; streamToken = token;
    try {
      const r = await fetch(API + '/stream', { headers: { Authorization: `Bearer ${token}` }, signal: controle.signal, cache: 'no-store' });
      if (!r.ok || !r.body) throw new Error('Canal indisponível');
      const leitor = r.body.getReader(), dec = new TextDecoder(); let resto = '';
      while (state.token === token) {
        const { value, done } = await leitor.read(); if (done) break;
        resto += dec.decode(value, { stream: true });
        const blocos = resto.split('\n\n'); resto = blocos.pop() || '';
        for (const bloco of blocos) if (/^event: mudou/m.test(bloco)) atualizarAoVivo();
      }
    } catch (e) { if (e.name !== 'AbortError' && state.token === token) setTimeout(() => { streamToken = null; conectarTempoReal(); }, 1500); }
    finally { if (streamAbort === controle) { streamAbort = null; streamToken = null; } }
  }

  function authView() {
    return `<div class="auth"><div class="ambient ambient-a"></div><div class="ambient ambient-b"></div><section class="auth-card"><div class="brand"><span class="brand-mark">T</span>Tasky <em>by Framety</em></div>
      <h1>O trabalho<br>encontra o time.</h1><p class="auth-copy">Pedidos do dia a dia, formalizados, acompanhados e resolvidos sem se perder em conversas.</p>
      <p class="auth-note">Use a mesma conta do FramePlus.</p>
      <form id="login"><div class="field"><label>Usuário ou nome</label><input name="nome" autocomplete="username" required placeholder="Ex.: rubens"></div><div class="field"><label>Senha do FramePlus</label><input name="senha" type="password" autocomplete="current-password" required></div><button class="btn" style="width:100%">Entrar no Tasky</button></form>
    </section><aside class="auth-visual"><div class="auth-demo"><div class="demo-top"><span class="demo-live"><i></i> fluxo ativo</span><span>23 OUT · 2026</span></div><div class="demo-title"><span>Agora na equipe</span><strong>Trabalho em movimento.</strong></div><div class="demo-card card-one"><i class="demo-priority red"></i><div><small>TASK-0031 · URGENTE</small><b>Correção em vídeo imersivo</b><span>Ultratour · resgatada por Lucas</span></div><em>1h 24m</em></div><div class="demo-card card-two"><i class="demo-priority blue"></i><div><small>TASK-0032 · NORMAL</small><b>Animação de imagens com IA</b><span>Framety · aguardando resgate</span></div><em>08:42</em></div><div class="demo-card card-three"><i class="demo-priority cyan"></i><div><small>TASK-0030 · CONCLUÍDA</small><b>Nova versão de vídeo imersivo</b><span>Programação · entregue</span></div><em>✓</em></div><div class="auth-quote"><span class="eyebrow">FRAMETY WORKFLOW</span><strong>Uma fila clara.<br>Um dono. Um prazo.</strong><p>A task chega para o time inteiro. Quem estiver disponível resgata e assume a entrega.</p></div></div></aside></div>`;
  }

  function side() {
    const u = state.usuario, ativas = state.tarefas.filter((t) => !['concluida','cancelada'].includes(t.status)).length;
    const nomeTime = timeInfo(u.equipe).nome;
    return `<aside class="side ${state.side ? 'open' : ''}"><div class="brand"><span class="brand-mark">T</span>Tasky</div><nav>
      <button class="nav-btn ${state.aba==='painel'?'on':''}" data-nav="painel">▦ ${esc(nomeTime)} <span class="count">${ativas}</span></button>
      <button class="nav-btn ${state.aba==='minha'?'on':''}" data-nav="minha">◇ Minha página</button>
      <button class="nav-btn ${state.aba==='historico'?'on':''}" data-nav="historico">◷ Historico</button>
      ${u.admin ? `<button class="nav-btn ${state.aba==='admin'?'on':''}" data-nav="admin">◎ Painel geral</button><button class="nav-btn ${state.aba==='config'?'on':''}" data-nav="config">⚙ Configuracoes</button>` : ''}
    </nav><div class="side-foot"><div class="user-chip"><div class="avatar">${iniciais(u.nome)}</div><div><strong>${esc(u.nome)}</strong><span>${esc((state.times.find(x=>x.id===u.equipe)||{}).nome || (u.admin?'Administrador':'Sem time'))}</span></div></div><button class="btn ghost small logout" id="logout">Sair</button></div></aside>`;
  }
  function metricas(lista) {
    const hoje = new Date().toISOString().slice(0,10);
    const atrasadas = lista.filter((t)=>t.prazo && t.prazo < hoje && !['concluida','cancelada'].includes(t.status)).length;
    return `<div class="metrics"><div class="metric blue"><div class="metric-icon">↗</div><span>Em aberto</span><strong>${lista.filter(t=>t.status==='aberta').length}</strong><small>esperando um time</small></div><div class="metric cyan"><div class="metric-icon">◌</div><span>Em andamento</span><strong>${lista.filter(t=>t.status==='em_andamento').length}</strong><small>em produção agora</small></div><div class="metric alert"><div class="metric-icon">!</div><span>Atrasadas</span><strong>${atrasadas}</strong><small>precisam de atenção</small></div><div class="metric green"><div class="metric-icon">✓</div><span>Concluídas</span><strong>${lista.filter(t=>t.status==='concluida').length}</strong><small>histórico de entregas</small></div></div>`;
  }
  function filtradas(lista) {
    let r = lista.filter((t) => state.aba === 'historico' ? ['concluida','cancelada'].includes(t.status) : !['concluida','cancelada'].includes(t.status));
    if (state.filtro === 'recebidas') r = r.filter((t)=>t.time.id===state.usuario.equipe);
    if (state.filtro === 'minhas') r = r.filter((t)=>t.responsavel && t.responsavel.id===state.usuario.id);
    if (state.filtro === 'enviadas') r = r.filter((t)=>t.criador.id===state.usuario.id);
    if (state.busca) { const q=state.busca.toLowerCase(); r=r.filter((t)=>[t.codigo,t.tipo.nome,t.cliente,t.time.nome,t.criador.nome,t.responsavel&&t.responsavel.nome].join(' ').toLowerCase().includes(q)); }
    return r;
  }
  function taskCard(t) {
    const origem=timeInfo(t.criador.equipe);
    return `<article class="task-card history-task" style="--team:${esc(origem.cor)}" data-open="${t.id}"><span class="priority"></span><div class="task-title"><span class="task-code">${esc(t.codigo)}</span><strong>${esc(t.tipo.nome)}</strong><span class="task-client">${esc(t.cliente || 'Sem cliente')}</span></div><div class="task-meta"><small>FLUXO</small><strong><i class="team-dot"></i>${esc(origem.nome)} <em>→</em> ${esc(t.time.nome)}</strong><span>por ${esc(t.criador.nome)}</span></div><div class="task-meta"><small>CATEGORIA</small><strong>${esc(t.tipo.nome)}</strong><span>${t.prazo ? `Entrega ${fmt(t.prazo,true)}` : 'Sem prazo'}</span></div><div class="task-state"><span class="badge ${t.status}"><i class="dot"></i>${statusNome(t.status)}</span><div class="timebox" data-clock="${t.id}">${tempo(t)}<small>${t.resgatado_em?'até o resgate':'aguardando resgate'}</small></div></div><span class="open-arrow">↗</span></article>`;
  }
  function filaCard(t) {
    const disponivel = t.status === 'aberta' && !t.responsavel;
    const atrasada = t.prazo && t.prazo < new Date().toISOString().slice(0,10);
    const contexto = disponivel ? 'aguardando resgate' : t.responsavel ? `resgatada por ${t.responsavel.nome}` : statusNome(t.status);
    const solicitante = timeInfo(t.criador.equipe);
    const acao = t.responsavel ? `<button class="queue-claim is-done" disabled><span>Resgatado</span><b>✓</b></button>` : t.permissoes.resgatar ? `<button class="queue-claim is-ready" data-claim="${t.id}"><span>Resgatar</span><b>↗</b></button>` : `<button class="queue-claim is-done" disabled><span>Aguardando</span><b>•</b></button>`;
    return `<article class="queue-card ${disponivel?'is-available':'is-claimed'}" style="--team:${esc(solicitante.cor)}" data-open="${t.id}"><i class="queue-priority"></i><div class="queue-copy"><span>${esc(t.codigo)} · ${esc(t.urgencia)}</span><strong>${esc(t.tipo.nome)}${t.quantidade?` · ${t.quantidade} imagens`:''}</strong><small>${esc(t.cliente||'Sem cliente')} · ${esc(contexto)}</small></div><div class="queue-flow"><span>DE → PARA</span><strong><i></i>${esc(solicitante.nome)} <em>→</em> ${esc(t.time.nome)}</strong></div><div class="queue-owner"><span>QUEM SOLICITOU</span><strong>${esc(t.criador.nome)}</strong></div><div class="queue-category"><span>CATEGORIA</span><strong>${esc(t.tipo.nome)}</strong></div><div class="queue-clock" data-clock="${t.id}">${tempo(t)}<small>${disponivel?'em aberto':'até o resgate'}</small></div>${acao}</article>`;
  }
  function homeTime() {
    const meuTime = state.usuario.equipe;
    const equipe = state.times.find((x)=>x.id===meuTime);
    const base = state.usuario.admin && !meuTime ? state.tarefas : state.tarefas.filter((t)=>t.time.id===meuTime);
    const ativas = base.filter((t)=>!['concluida','cancelada'].includes(t.status));
    ativas.sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em));
    const enviadas = state.tarefas.filter((t)=>t.criador.id===state.usuario.id&&!['concluida','cancelada'].includes(t.status)&&t.time.id!==meuTime).sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em));
    return `<h2 class="queue-intro">Confira as tasks disponíveis para a <span>${esc(equipe?equipe.nome:'sua equipe')}</span>:</h2>
      <section class="queue-section"><div class="queue-stack">${ativas.length?ativas.map(filaCard).join(''):`<div class="queue-empty"><span>✓</span><strong>A fila está livre.</strong><p>Quando uma nova task chegar para o time, ela aparecerá aqui.</p></div>`}</div></section>
      ${enviadas.length?`<section class="queue-section sent-section"><header class="queue-heading"><div><div><h3>Tasks que você enviou</h3><p>Acompanhe abaixo os pedidos enviados para outros times.</p></div></div><span class="queue-count">${enviadas.length}</span></header><div class="queue-stack">${enviadas.map(filaCard).join('')}</div></section>`:''}`;
  }
  function painel(lista = state.tarefas) {
    const itens = filtradas(lista);
    return `${metricas(lista)}<div class="toolbar"><div class="seg">${['todas','recebidas','minhas','enviadas'].map((x)=>`<button class="${state.filtro===x?'on':''}" data-filter="${x}">${({todas:'Todas',recebidas:'Do meu time',minhas:'Resgatadas por mim',enviadas:'Enviadas'})[x]}</button>`).join('')}</div><input class="search" id="search" value="${esc(state.busca)}" placeholder="Buscar task, cliente ou pessoa"></div><div class="task-list">${itens.length?itens.map(taskCard).join(''):`<div class="empty"><strong>Nada por aqui.</strong>As tasks que combinam com este filtro aparecerao aqui.</div>`}</div>`;
  }
  function miniTask(t, concluida) {
    const origem=timeInfo(t.criador.equipe);
    return `<button class="mini-task" data-open="${t.id}"><i style="--team:${esc(origem.cor)}"></i><div><span>${esc(t.codigo)} · ${esc(origem.nome)} → ${esc(t.time.nome)}</span><strong>${esc(t.tipo.nome)}</strong><small>${concluida?`Concluída em ${fmt(t.concluido_em,true)}`:`Prazo ${t.prazo?fmt(t.prazo,true):'não definido'}`}</small></div><b>↗</b></button>`;
  }
  function minhaPagina() {
    const eu = state.usuario.id;
    const pendentes = state.tarefas.filter(t=>t.responsavel&&t.responsavel.id===eu&&!['concluida','cancelada'].includes(t.status)).sort((a,b)=>new Date(b.resgatado_em)-new Date(a.resgatado_em));
    const concluidas = state.tarefas.filter(t=>t.responsavel&&t.responsavel.id===eu&&t.status==='concluida').sort((a,b)=>new Date(b.concluido_em)-new Date(a.concluido_em));
    const hoje = new Date().toDateString();
    const chegaramHoje = state.tarefas.filter(t=>t.time.id===state.usuario.equipe&&new Date(t.criado_em).toDateString()===hoje).length;
    const abertasHoje = state.tarefas.filter(t=>t.time.id===state.usuario.equipe&&new Date(t.criado_em).toDateString()===hoje&&t.status==='aberta').length;
    const resolvidasHoje = state.tarefas.filter(t=>t.time.id===state.usuario.equipe&&t.concluido_em&&new Date(t.concluido_em).toDateString()===hoje).length;
    return `<section class="personal-grid"><article class="dash-card pending-card"><header><div><span class="dash-icon">⌁</span><h2>Tasks pendentes</h2></div><b>${pendentes.length}</b></header><p>Você aceitou e ainda não marcou como concluída.</p><div class="mini-list">${pendentes.length?pendentes.map(t=>miniTask(t,false)).join(''):`<div class="dash-empty">Nenhuma entrega pendente com você.</div>`}</div></article>
      <article class="dash-card completed-card"><header><div><span class="dash-icon">✓</span><h2>Últimas concluídas</h2></div><select id="completed-limit">${[3,5,10].map(n=>`<option value="${n}" ${state.concluidasN===n?'selected':''}>${n} tasks</option>`).join('')}</select></header><p>Suas entregas finalizadas mais recentemente.</p><div class="mini-list">${concluidas.length?concluidas.slice(0,state.concluidasN).map(t=>miniTask(t,true)).join(''):`<div class="dash-empty">Você ainda não concluiu nenhuma task.</div>`}</div></article>
      <article class="dash-card members-card"><header><div><span class="dash-icon">◎</span><h2>Membros do meu time</h2></div><b>${state.membros.length}</b></header><div class="member-heads">${state.membros.map(m=>`<div class="member-head" title="${esc(m.nome)} · ${m.admin?'Administrador':'Membro'}"><span>${iniciais(m.nome)}</span><i></i></div>`).join('')}</div></article>
      <article class="dash-card summary-card"><header><div><span class="dash-icon">↗</span><h2>Resumo do dia</h2></div><span>HOJE</span></header><p>Movimento da sua equipe desde o início do dia.</p><div class="summary-number"><strong>${chegaramHoje}</strong><span>tasks chegaram</span></div><div class="summary-bars"><div><span>Disponíveis</span><b>${abertasHoje}</b></div><progress max="${Math.max(chegaramHoje,1)}" value="${abertasHoje}"></progress><div><span>Concluídas hoje</span><b>${resolvidasHoje}</b></div><progress max="${Math.max(chegaramHoje,1)}" value="${resolvidasHoje}"></progress></div></article></section>`;
  }
  function adminPainel() { return `<div id="admin-view">${metricas(state.tarefas)}<div class="toolbar"><div><span class="eyebrow">TODOS OS TIMES</span><h2 style="margin:6px 0 0">Visao global</h2></div><input class="search" id="search" value="${esc(state.busca)}" placeholder="Buscar em todas as tasks"></div>${painel(state.tarefas).replace(metricas(state.tarefas),'')}</div>`; }
  function configPainel() {
    if (!state.admin) return `<div class="empty"><strong>Carregando configuracoes…</strong></div>`;
    return `<div class="settings-layout"><section class="panel team-settings"><div class="settings-head"><div><span class="eyebrow">IDENTIDADE</span><h2>Times e cores</h2><p>A cor salva aqui será usada nos LEDs e cards de todo o Tasky.</p></div></div>${state.admin.times.map((t)=>`<form class="team-setting" data-team-form="${t.id}"><label class="color-control"><input type="color" name="cor" value="${esc(t.cor||'#7c6cff')}"><span style="--swatch:${esc(t.cor||'#7c6cff')}"></span></label><input name="nome" value="${esc(t.nome)}"><span>${state.admin.usuarios.filter(u=>u.equipe===t.id).length} membros</span><button class="btn small">Salvar cor e nome</button></form>`).join('')}<form id="novo-time" class="new-team"><input type="color" name="cor" value="#7c6cff"><input class="search" name="nome" placeholder="Nome do novo time" required><button class="btn secondary small">Adicionar time</button></form></section>
      <section class="panel members-settings"><div class="settings-head"><div><span class="eyebrow">ACESSOS</span><h2>Membros</h2><p>Troque a equipe, promova administradores ou remova acessos.</p></div></div><div class="members-admin">${state.admin.usuarios.map((u)=>`<div class="member-admin-row"><span class="member-admin-avatar">${iniciais(u.nome)}</span><div><strong>${esc(u.nome)}</strong><small>${esc(timeInfo(u.equipe).nome)}</small></div><select data-user-team="${u.id}"><option value="">Sem time</option>${state.admin.times.map((t)=>`<option value="${t.id}" ${u.equipe===t.id?'selected':''}>${esc(t.nome)}</option>`).join('')}</select><button class="admin-switch ${u.admin?'on':''}" data-user-admin="${u.id}" data-admin="${!!u.admin}">${u.admin?'Admin':'Usuário'}</button>${u.id!==state.usuario.id?`<button class="btn danger small" data-remove-user="${u.id}">Remover</button>`:'<span></span>'}</div>`).join('')}</div></section>
      <section class="settings-secondary"><section class="panel"><h2>Tipos de task</h2><div class="type-list">${state.admin.tipos.map((t)=>`<div class="type-item ${t.ativo===false?'off':''}"><div><strong>${esc(t.nome)}</strong><small style="display:block;color:var(--muted)">${t.pede_quantidade?'Pede quantidade':'Sem quantidade'}</small></div><button class="btn ghost small" data-toggle-type="${t.id}" data-active="${t.ativo!==false}">${t.ativo!==false?'Desativar':'Ativar'}</button></div>`).join('')}</div><form id="novo-tipo" style="margin-top:14px"><div class="field"><input name="nome" placeholder="Novo tipo de task" required></div><label style="font-size:13px"><input type="checkbox" name="pede_quantidade"> Pedir quantidade</label><button class="btn small" style="margin-top:10px">Adicionar tipo</button></form></section><section class="panel"><h2>Pasta raiz</h2><p style="color:var(--muted);font-size:13px">As pastas mensais e as tasks são criadas aqui.</p><a class="btn ghost small" href="${esc(state.admin.raiz_url)}" target="_blank">Abrir RAIZ TASKY</a></section></section></div>`;
  }
  function appView() {
    const titulo = state.aba==='historico'?'Histórico':state.aba==='admin'?'Painel geral':state.aba==='config'?'Configurações':state.aba==='minha'?`${saudacao()}, ${esc(state.usuario.nome.split(' ')[0])}`:`${saudacao()}, ${esc(state.usuario.nome.split(' ')[0])}`;
    const partes = new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit'}).formatToParts(new Date());
    const hoje = `${partes.find(x=>x.type==='weekday').value}, dia ${partes.find(x=>x.type==='day').value}`.toUpperCase();
    return `<div class="shell">${side()}<main class="main"><header class="topbar"><div style="display:flex;gap:12px"><button class="btn ghost mobile-menu" id="menu">☰</button><div><span class="eyebrow">${state.aba==='painel'||state.aba==='minha'?hoje:'TASKY · FRAMETY'}</span><h1>${titulo}</h1></div></div><div class="top-actions"><button class="btn" id="new-task"><span>＋</span> Nova task</button></div></header><section id="content">${state.aba==='painel'?homeTime():state.aba==='minha'?minhaPagina():state.aba==='config'?configPainel():state.aba==='admin'?adminPainel():painel()}</section></main>${state.detalhe?drawer(state.detalhe):''}</div>`;
  }
  function modalNova(base, editando = false) {
    const propria = state.usuario.equipe;
    const origem = timeInfo(propria).nome;
    return `<div class="modal-wrap" id="modal"><div class="modal"><div class="modal-head"><div><span class="eyebrow">${editando?'AJUSTAR PEDIDO':'NOVO PEDIDO'}</span><h2 id="task-modal-title">${editando?'Editar '+esc(base.codigo):`Nova task de ${esc(state.usuario.nome)}, da ${esc(origem)} para outra equipe.`}</h2></div><button class="close" data-close>×</button></div><form class="modal-body" id="task-form" data-edit="${editando&&base?base.id:''}"><div class="row"><div class="field"><label>Para qual time?</label><select name="time_id" id="task-destination" required ${editando&&base.responsavel?'disabled':''}><option value="">Selecione</option>${state.times.filter(t=>editando||state.usuario.admin||t.id!==propria).map(t=>`<option value="${t.id}" ${base&&base.time.id===t.id?'selected':''}>${esc(t.nome)}</option>`).join('')}</select></div><div class="field"><label>Tipo de task</label><select name="tipo_id" id="tipo-select" required><option value="">Selecione</option>${state.tipos.map(t=>`<option value="${t.id}" data-qtd="${!!t.pede_quantidade}" ${base&&base.tipo.id===t.id?'selected':''}>${esc(t.nome)}</option>`).join('')}</select></div></div><div class="row"><div class="field" id="qtd-field" style="display:none"><label>Quantidade de imagens</label><input name="quantidade" type="number" min="1" max="999" value="${base&&base.quantidade||''}"></div><div class="field"><label>Urgencia</label><select name="urgencia">${['baixa','normal','alta','urgente'].map(x=>`<option value="${x}" ${base&&base.urgencia===x?'selected':''}>${x[0].toUpperCase()+x.slice(1)}</option>`).join('')}</select></div><div class="field"><label>Data maxima</label><input name="prazo" type="date" value="${base&&base.prazo||''}"></div></div><div class="field"><label>Cliente</label><input name="cliente" value="${esc(base&&base.cliente||'')}" placeholder="Preenchimento manual"></div><div class="field"><label>Comentario / briefing</label><textarea name="comentario" placeholder="Explique o que precisa ser feito">${esc(base&&base.comentario||'')}</textarea></div><div class="field"><label>Caminho dos assets</label><input name="assets_url" type="text" value="${esc(base&&base.assets_url||'')}" placeholder="C:\\Projetos\\Cliente ou \\\\servidor\\pasta"><small style="color:var(--muted)">Aceita caminho local, pasta de servidor ou link web.</small></div><div class="form-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn">${editando?'Salvar alteracoes':'Criar task e pasta'}</button></div></form></div></div>`;
  }
  function media(a) {
    if (/^video\//.test(a.tipo)) return `<div class="media"><video src="${esc(a.arquivo)}" poster="${esc(a.capa)}" controls preload="metadata"></video><span class="media-name">${esc(a.nome)}</span></div>`;
    if (/^image\//.test(a.tipo)) return `<a class="media" href="${esc(a.url)}" target="_blank"><img src="${esc(a.capa)}" loading="lazy"><span class="media-name">${esc(a.nome)}</span></a>`;
    return `<a class="media" href="${esc(a.url)}" target="_blank"><div class="media-file">↗<br>${esc(a.nome)}</div></a>`;
  }
  function drawer(t) {
    const eu = state.usuario.id;
    const solicitante = timeInfo(t.criador.equipe);
    return `<div class="drawer-wrap" id="drawer"><aside class="drawer ticket" style="--team:${esc(solicitante.cor)}"><div class="ticket-led"></div><div class="drawer-head"><div><span class="eyebrow">${esc(t.codigo)} · TICKET ${esc(t.time.nome)}</span><h2>${esc(t.tipo.nome)}</h2><p>${esc(t.cliente||'Sem cliente')}</p></div><button class="close" data-close-detail>×</button></div><div class="drawer-body"><div class="ticket-route"><div><span>DE</span><strong>${esc(solicitante.nome)}</strong></div><b>→</b><div><span>PARA</span><strong>${esc(t.time.nome)}</strong></div><div><span>CATEGORIA</span><strong>${esc(t.tipo.nome)}</strong></div></div><div class="copy"><span class="badge ${t.status}"><i class="dot"></i>${statusNome(t.status)}</span><span class="badge">${esc(t.urgencia)}</span>${t.quantidade?`<span class="badge">${t.quantidade} imagens</span>`:''}</div>
      <div class="detail-grid"><div class="detail-stat"><span>Solicitante</span><strong>${esc(t.criador.nome)}</strong></div><div class="detail-stat"><span>Responsavel</span><strong>${esc(t.responsavel?t.responsavel.nome:'Nao resgatada')}</strong></div><div class="detail-stat"><span>Prazo</span><strong>${t.prazo?fmt(t.prazo,true):'Sem prazo'}</strong></div><div class="detail-stat"><span>Tempo ate resgate</span><strong>${tempo(t)}</strong></div><div class="detail-stat"><span>Tempo total</span><strong>${total(t)}</strong></div><div class="detail-stat"><span>Cliente</span><strong>${esc(t.cliente||'—')}</strong></div></div>
      <div class="copy ticket-actions"><button class="btn small" data-share="${t.id}">Copiar link</button>${t.permissoes.resgatar?`<button class="btn small" data-claim="${t.id}">Resgatar para mim</button>`:`<button class="btn ghost small" disabled>Resgatado</button>`}${t.permissoes.editar?`<button class="btn ghost small" data-edit-task="${t.id}">Editar</button>`:''}${t.permissoes.excluir?`<button class="btn danger small" data-delete="${t.id}">Excluir</button>`:''}</div>
      ${t.responsavel||t.permissoes.admin?`<div class="section"><div class="field"><label>Status da task</label><select id="status-task" data-id="${t.id}">${['aberta','em_andamento','aguardando','concluida','cancelada'].map(x=>`<option value="${x}" ${t.status===x?'selected':''}>${statusNome(x)}</option>`).join('')}</select></div></div>`:''}
      ${t.comentario?`<section class="section"><div class="section-title"><h3>Briefing</h3></div><div class="note">${esc(t.comentario)}</div></section>`:''}
      <section class="section"><div class="section-title"><h3>Links e caminhos</h3></div><div class="links">${assetsRow(t.assets_url)}<a class="link-row" href="${esc(t.drive_url||'#')}" target="_blank"><span>Pasta final no Google Drive</span><b>↗</b></a><div class="link-row"><input id="final-url" value="${esc(t.final_url||'')}" placeholder="Cole aqui o link final" style="flex:1;background:transparent;border:0;color:#fff;outline:0"><button class="btn small" data-save-final="${t.id}">Salvar</button></div></div></section>
      <section class="section"><div class="section-title"><h3>Previa dos arquivos</h3><button class="btn ghost small" data-refresh-files="${t.id}">Atualizar</button></div>${t.drive_erro?`<div class="error">${esc(t.drive_erro)}</div>`:''}<div class="media-grid">${t.arquivos.length?t.arquivos.map(media).join(''):`<div class="empty" style="grid-column:1/-1;padding:35px"><strong>Nenhum arquivo final.</strong>Envie os arquivos pela pasta do Drive e clique em Atualizar.</div>`}</div></section>
      <section class="section"><div class="section-title"><h3>Chat da task</h3><span style="color:var(--muted);font-size:12px">${t.responsavel?'Solicitante + responsavel':'Disponivel apos o resgate'}</span></div><div class="chat">${(t.mensagens||[]).map(m=>`<div class="message ${m.autor.id===eu?'mine':''}"><strong>${esc(m.autor.nome)}</strong><time>${fmt(m.em)}</time><p>${esc(m.mensagem)}</p></div>`).join('')}</div>${t.permissoes.conversar?`<form class="chat-send" id="chat-form" data-id="${t.id}"><input name="mensagem" placeholder="Escreva sobre esta task" autocomplete="off"><button class="btn small">Enviar</button></form>`:''}</section>
      </div></aside></div>`;
  }

  function render() { document.getElementById('app').innerHTML = state.token && state.usuario ? appView() : authView(); bind(); }
  function formObj(f) { return Object.fromEntries(new FormData(f).entries()); }
  async function abrir(id, push = true) { const j = await api(`/tarefas/${id}`); state.detalhe = j.tarefa; if (push) history.pushState({},'',`${raizTasky}/t/${j.tarefa.slug}`); render(); }
  async function recarregar(manterDetalhe) { const id = manterDetalhe && state.detalhe && state.detalhe.id; const j=await api('/inicio'); Object.assign(state,j); if(id){const d=await api(`/tarefas/${id}`);state.detalhe=d.tarefa;} render(); }
  async function carregarAdmin(){ const j=await api('/admin'); state.admin=j; render(); }
  function bind() {
    const login=$('#login'); if(login) login.onsubmit=async e=>{e.preventDefault();try{const j=await api('/login',{method:'POST',body:formObj(login)});state.token=j.token;localStorage.setItem(tokenKey,j.token);await carregar();}catch(x){erro(login,x)}};
    $('#logout')?.addEventListener('click',()=>{if(streamAbort)streamAbort.abort();localStorage.removeItem(tokenKey);state={...state,token:null,usuario:null,detalhe:null};history.replaceState({},'',raizTasky || '/');render()});
    $('#menu')?.addEventListener('click',()=>{state.side=!state.side;render()});
    $$('[data-nav]').forEach(b=>b.onclick=async()=>{state.aba=b.dataset.nav;state.side=false;state.filtro='todas';state.busca='';if(state.aba==='config')await carregarAdmin();else render()});
    $$('[data-filter]').forEach(b=>b.onclick=()=>{state.filtro=b.dataset.filter;render()});
    $('#completed-limit')?.addEventListener('change',e=>{state.concluidasN=Number(e.target.value)||3;render()});
    $('#search')?.addEventListener('input',e=>{state.busca=e.target.value;const c=$('#content');if(c)c.innerHTML=state.aba==='admin'?adminPainel():painel();bind()});
    $$('[data-open]').forEach(x=>x.onclick=()=>abrir(x.dataset.open));
    $('#new-task')?.addEventListener('click',()=>{document.body.insertAdjacentHTML('beforeend',modalNova());bind()});
    $$('[data-close]').forEach(x=>x.onclick=()=>x.closest('.modal-wrap')?.remove());
    $$('[data-close-detail]').forEach(x=>x.onclick=()=>{state.detalhe=null;history.pushState({},'',raizTasky || '/');render()});
    const tipo=$('#tipo-select'); if(tipo){const q=()=>{$('#qtd-field').style.display=tipo.selectedOptions[0]?.dataset.qtd==='true'?'block':'none'};tipo.onchange=q;q()}
    const destino=$('#task-destination'); if(destino&&!destino.closest('form').dataset.edit){destino.onchange=()=>{const nome=destino.selectedOptions[0]?.textContent||'outra equipe';$('#task-modal-title').textContent=`Nova task de ${state.usuario.nome}, da ${timeInfo(state.usuario.equipe).nome} para ${nome}.`;};}
    $$('[data-edit-task]').forEach(b=>b.onclick=()=>{document.body.insertAdjacentHTML('beforeend',modalNova(state.detalhe,true));bind()});
    const tf=$('#task-form'); if(tf)tf.onsubmit=async e=>{e.preventDefault();try{const id=tf.dataset.edit;const corpo=formObj(tf);const j=await api(id?`/tarefas/${id}`:'/tarefas',{method:id?'PUT':'POST',body:corpo});document.getElementById('modal')?.remove();await recarregar(false);await abrir(j.tarefa.id);toast(id?'Task atualizada':'Task criada')}catch(x){erro(tf,x)}};
    $$('[data-share]').forEach(b=>b.onclick=async()=>{const t=state.detalhe;await navigator.clipboard.writeText(shareUrl(t));toast('Link copiado')});
    $$('[data-whatsapp]').forEach(b=>b.onclick=()=>{const t=state.detalhe;const msg=`Nova task ${t.codigo}: ${t.tipo.nome}\n${shareUrl(t)}`;window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank')});
    $$('[data-copy-assets]').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.copyAssets);toast('Caminho dos assets copiado')});
    $$('[data-claim]').forEach(b=>b.onclick=async(e)=>{e.stopPropagation();try{await api(`/tarefas/${b.dataset.claim}/resgatar`,{method:'POST'});await recarregar(!!state.detalhe);toast('Task resgatada para você')}catch(x){toast(x.message)}});
    $$('[data-duplicate]').forEach(b=>b.onclick=async()=>{try{const j=await api(`/tarefas/${b.dataset.duplicate}/duplicar`,{method:'POST'});await recarregar(false);await abrir(j.tarefa.id);toast('Task duplicada')}catch(x){toast(x.message)}});
    $$('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta task? A pasta e os arquivos no Drive serao preservados.'))return;try{await api(`/tarefas/${b.dataset.delete}`,{method:'DELETE'});state.detalhe=null;history.pushState({},'',raizTasky || '/');await recarregar(false);toast('Task excluida')}catch(x){toast(x.message)}});
    $('#status-task')?.addEventListener('change',async e=>{try{await api(`/tarefas/${e.target.dataset.id}`,{method:'PUT',body:{status:e.target.value}});await recarregar(true);toast('Status atualizado')}catch(x){toast(x.message)}});
    $$('[data-save-final]').forEach(b=>b.onclick=async()=>{try{await api(`/tarefas/${b.dataset.saveFinal}`,{method:'PUT',body:{final_url:$('#final-url').value}});await recarregar(true);toast('Link final salvo')}catch(x){toast(x.message)}});
    $$('[data-refresh-files]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const j=await api(`/tarefas/${b.dataset.refreshFiles}/arquivos`,{method:'POST'});state.detalhe=j.tarefa;render();toast('Arquivos atualizados')}catch(x){toast(x.message)}});
    const chat=$('#chat-form');if(chat)chat.onsubmit=async e=>{e.preventDefault();const o=formObj(chat);if(!o.mensagem)return;try{await api(`/tarefas/${chat.dataset.id}/mensagens`,{method:'POST',body:o});await recarregar(true)}catch(x){toast(x.message)}};
    $$('[data-user-team]').forEach(s=>s.onchange=async()=>{try{await api(`/admin/usuarios/${s.dataset.userTeam}`,{method:'PUT',body:{equipe:s.value}});toast('Time atualizado');state.admin=await api('/admin')}catch(x){toast(x.message)}});
    $$('[data-user-admin]').forEach(b=>b.onclick=async()=>{try{await api(`/admin/usuarios/${b.dataset.userAdmin}`,{method:'PUT',body:{admin:b.dataset.admin!=='true'}});await carregarAdmin();toast('Permissão atualizada')}catch(x){toast(x.message)}});
    $$('[data-remove-user]').forEach(b=>b.onclick=async()=>{if(!confirm('Remover o acesso deste membro ao Tasky?'))return;try{await api(`/admin/usuarios/${b.dataset.removeUser}`,{method:'PUT',body:{ativo:false}});await carregarAdmin();toast('Membro removido')}catch(x){toast(x.message)}});
    $$('[data-team-form]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await api(`/admin/times/${f.dataset.teamForm}`,{method:'PUT',body:formObj(f)});const inicio=await api('/inicio');Object.assign(state,inicio);state.admin=await api('/admin');render();toast('Cor e nome salvos')}catch(x){erro(f,x)}});
    $$('.color-control input[type="color"]').forEach(i=>i.oninput=()=>i.nextElementSibling.style.setProperty('--swatch',i.value));
    const nt=$('#novo-tipo');if(nt)nt.onsubmit=async e=>{e.preventDefault();const o=formObj(nt);o.pede_quantidade=!!nt.elements.pede_quantidade.checked;try{await api('/admin/tipos',{method:'POST',body:o});await carregarAdmin();toast('Tipo adicionado')}catch(x){erro(nt,x)}};
    const ntime=$('#novo-time');if(ntime)ntime.onsubmit=async e=>{e.preventDefault();try{await api('/admin/times',{method:'POST',body:formObj(ntime)});await carregarAdmin();toast('Time adicionado')}catch(x){erro(ntime,x)}};
    $$('[data-toggle-type]').forEach(b=>b.onclick=async()=>{try{await api(`/admin/tipos/${b.dataset.toggleType}`,{method:'PUT',body:{ativo:b.dataset.active!=='true'}});await carregarAdmin()}catch(x){toast(x.message)}});
  }
  window.addEventListener('pointermove',(e)=>{document.documentElement.style.setProperty('--mouse-x',`${e.clientX}px`);document.documentElement.style.setProperty('--mouse-y',`${e.clientY}px`)});
  window.addEventListener('popstate',()=>{const m=location.pathname.match(/^\/(?:tasky\/)?t\/([^/]+)/);if(m&&state.token)abrir(m[1],false);else{state.detalhe=null;render()}});
  setInterval(()=>{if(!state.usuario)return;$$('[data-clock]').forEach(el=>{const t=state.tarefas.find(x=>x.id===el.dataset.clock);if(t)el.childNodes[0].nodeValue=tempo(t)})},60000);
  carregar();
})();
