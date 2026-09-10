/* Framety — documento da Ordem de Serviço (compartilhado)
 *
 * Este arquivo saiu de admin.jsx para poder ser usado em dois lugares: o console
 * no navegador e o aplicativo de desktop da aba Produções (os-desktop/). O
 * documento e a exportação em PDF são idênticos nos dois — e uma correção aqui
 * vale para os dois, que é justamente o motivo de existir um arquivo só.
 *
 * Depende de `Icon` (primitives.jsx) e, opcionalmente, de window.__adminToast.
 * As bibliotecas de PDF vêm de window.__PDF_LIBS quando definido (o desktop usa
 * cópias locais, para funcionar sem internet); o padrão é a CDN.
 */

const PDF_LIBS = () => Object.assign({
  html2canvas: 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
  jspdf:       'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
}, window.__PDF_LIBS || {});

/* =========================== Locuções (OS) — shared helpers =========================== */
function osToday() { return new Date().toLocaleDateString('pt-BR'); }
function anoOfRow(r) {
  const m = (r.data || '').match(/(\d{4})/);
  if (m) return m[1];
  const m2 = r.os && r.os.emissao ? ('' + r.os.emissao).match(/(\d{4})/) : null;
  return m2 ? m2[1] : '';
}
/* O valor vem da planilha já formatado; quem somava e reformatava era o total
   da lista, que não existe mais — daí parseBRL/formatBRL terem saído daqui. */
function buildOS(r, over) {
  const parts = (r.locutor || '').split('/');
  const os = {
    date: osToday(),
    servicoId: r.id || '',
    emissao: r.data || osToday(),
    responsavel: '',
    empresa: 'Skyline Inovação',
    projeto: [r.cliente, r.produto].filter(Boolean).join(' - '),
    tipoServico: '',
    fornecedor: (parts[0] || '').trim(),
    responsavel2: (parts[1] || '').trim(),
    banner: 'ATENÇÃO AOS DADOS NO CAMPO "DADOS PARA FATURAMENTO" PARA EMISSÃO DA NOTA FISCAL',
    fatNome: 'SKYLINE INOVACAO E PRODUCOES LTDA',
    fatCnpj: '23.240.029/0001-46',
    fatEndereco: 'Rua 5, S/N Quadra 16 Lote 21 CIDADE JARDIM\nANÁPOLIS - GO 75080-730',
    descNota: '" Referente ao job ' + (r.id || '') + ' "',
    descricao: '',
    infoAdicionais: 'nenhuma',
    nota1: '• NFS recebidas entre os dias 01 e 15 do mês, pagamento dia 05 do mês seguinte;',
    nota2: '• NFS recebidas entre os dias 16 e 30 do mês, pagamento dia 25 do mês seguinte;',
    anexoLabel: 'Anexar esse documento junto a nota fiscal, no link :',
    pipefyLink: 'https://app.pipefy.com/public/form/J1LvfGLJ',
    pixNote: 'Adicionar a chave pix junto aos dados bancários.',
    valorTotal: r.valor || 'R$ 0,00',
    formaPagamento: 'Pix',
    logoSkyline: null,
    logoFramety: null,
    customSobre: [],
    customFat: [],
  };
  return Object.assign(os, over || {});
}
function pdfNameFor(r) {
  if (!r) return 'OS';
  const id = r.id || '';
  const forn = ((r.locutor || '').split('/')[0] || '').trim();
  const ano = anoOfRow(r) || new Date().getFullYear();
  return ['OS', forn, id, ano].filter(Boolean).join(' ');
}

/* =========================== OS Document (full-viewport) =========================== */
function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// Load a script once and cache the promise so repeat calls reuse it.
const _scriptCache = {};
function loadScriptOnce(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => { delete _scriptCache[src]; reject(new Error('load failed: ' + src)); };
    document.head.appendChild(s);
  });
  return _scriptCache[src];
}
// html2canvas + jsPDF are heavy (~600KB) and only needed for PDF export, so we
// fetch them the first time the user actually exports an OS.
async function loadPdfLibs() {
  const libs = PDF_LIBS();
  if (!window.html2canvas) await loadScriptOnce(libs.html2canvas);
  if (!window.jspdf)       await loadScriptOnce(libs.jspdf);
}

async function exportOsPdf(rootEl, filename) {
  if (!rootEl) return;
  try {
    await loadPdfLibs();
  } catch (e) {
    window.__adminToast?.('Não foi possível carregar a biblioteca de PDF. Verifique sua conexão com a internet.');
    return;
  }
  if (!window.html2canvas || !window.jspdf) {
    window.__adminToast?.('Não foi possível gerar o PDF (biblioteca não carregada). Verifique sua conexão com a internet.');
    return;
  }

  const pipefyUrl = (rootEl.querySelector('textarea[data-field="pipefyLink"]')?.value || '').trim();

  // Clone off-screen and swap textareas/inputs for plain wrapped text nodes:
  // html2canvas doesn't render multi-line textarea values correctly.
  const clone = rootEl.cloneNode(true);
  clone.style.position = 'fixed';
  clone.style.left = '-99999px';
  clone.style.top = '0';
  clone.style.width = rootEl.offsetWidth + 'px';
  // Neutralize any on-screen zoom transform so the PDF captures the doc at full size.
  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';
  document.body.appendChild(clone);

  const origEls = Array.from(rootEl.querySelectorAll('textarea, input'));
  const cloneEls = Array.from(clone.querySelectorAll('textarea, input'));
  cloneEls.forEach((el, i) => {
    const orig = origEls[i];
    if (!orig || (orig.tagName === 'INPUT' && orig.type === 'file')) { el.remove(); return; }
    const cs = getComputedStyle(orig);
    const div = document.createElement('div');
    div.textContent = orig.value;
    div.style.font = cs.font;
    div.style.color = cs.color;
    div.style.textAlign = cs.textAlign;
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordBreak = 'break-word';
    div.style.width = orig.offsetWidth + 'px';
    div.style.flex = cs.flex;
    div.style.padding = cs.padding;
    // Wrap the pipefy URL so we can measure exactly where it lands *in the clone*.
    // Measuring it on screen doesn't work: these divs replace bordered textareas, so the
    // clone's layout drifts a couple of px per field and the link ends up way off.
    if (orig.dataset.field === 'pipefyLink' && /^https?:\/\//i.test(pipefyUrl)) {
      div.textContent = '';
      const span = document.createElement('span');
      span.textContent = orig.value;
      span.setAttribute('data-pdf-link', '1');
      div.appendChild(span);
    }
    el.replaceWith(div);
  });

  // Now that the clone is laid out, take the link's box from the span itself, so the
  // clickable area matches the text as rendered into the PDF image.
  let linkRect = null;
  const linkSpan = clone.querySelector('span[data-pdf-link]');
  if (linkSpan) {
    const cloneRect = clone.getBoundingClientRect();
    const spanRect = linkSpan.getBoundingClientRect();
    // The span box hugs the glyphs; grow it to the line box (plus a hair) and centre it
    // on the text so the hotspot is comfortable to hit without drifting off the line.
    const lineH = parseFloat(getComputedStyle(linkSpan.parentNode).lineHeight) || spanRect.height;
    const h = Math.max(spanRect.height, lineH) + 4;
    linkRect = {
      url: pipefyUrl,
      x: spanRect.left - cloneRect.left,
      y: spanRect.top - cloneRect.top - (h - spanRect.height) / 2,
      w: spanRect.width,
      h,
    };
  }

  try {
    const canvas = await window.html2canvas(clone, { backgroundColor: '#ffffff', scale: 1.5, useCORS: true });
    const { jsPDF } = window.jspdf;
    const mmPerPx = 0.2645833;
    const marginMm = 10;
    const wMm = clone.offsetWidth * mmPerPx;
    const hMm = clone.offsetHeight * mmPerPx;
    const pdf = new jsPDF({ unit: 'mm', format: [wMm + marginMm * 2, hMm + marginMm * 2], compress: true });
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, wMm + marginMm * 2, hMm + marginMm * 2, 'F');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', marginMm, marginMm, wMm, hMm, undefined, 'FAST');
    if (linkRect) {
      pdf.link(marginMm + linkRect.x * mmPerPx, marginMm + linkRect.y * mmPerPx, linkRect.w * mmPerPx, linkRect.h * mmPerPx, { url: linkRect.url });
    }
    pdf.save(filename + '.pdf');
  } catch (e) {
    window.__adminToast?.('Erro ao gerar PDF: ' + e.message);
  } finally {
    document.body.removeChild(clone);
  }
}

const OsDocumentView = ({ row, osEdit, setOsEdit, autoDownload, readOnly: shared = false, onBack, onUpdateOS }) => {
  const rootRef = React.useRef(null);
  const deskRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const fileWhichRef = React.useRef(null);
  const lastTapRef = React.useRef(0);
  const os = row.os || {};

  // ── Fit the fixed-width (820px) document to the screen; double-tap zooms to 100%,
  //    drag pans (native scroll). On wide screens fit === 1, so desktop is unchanged. ──
  const DOC_W = 820;
  const [fit, setFit] = React.useState(1);
  const [zoomed, setZoomed] = React.useState(false);
  const [docH, setDocH] = React.useState(0);
  const eff = zoomed ? 1 : fit;

  React.useLayoutEffect(() => {
    const measure = () => {
      const desk = deskRef.current, doc = rootRef.current;
      if (!desk || !doc) return;
      const cs = getComputedStyle(desk);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      /* O teto do zoom é 1 no navegador, mas o aplicativo de desktop abre numa
         janela larga, onde o documento caberia em tamanho natural — e a 100% o
         traço das letras fica mais encorpado que no site, onde a janela mais
         estreita já o reduz. Como o documento impresso é o mesmo nos dois, o
         que se iguala aqui é só a apresentação na tela. */
      const teto = typeof window.__OS_ZOOM_MAX === 'number' ? window.__OS_ZOOM_MAX : 1;
      setFit(Math.min(teto, (desk.clientWidth - pad) / DOC_W));
      setDocH(doc.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (deskRef.current) ro.observe(deskRef.current);
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('orientationchange', measure); };
  }, [os]);

  // Double-tap toggles between fit-to-width and natural (100%), keeping the tapped point stable.
  const applyZoom = (willZoom, clientX, clientY) => {
    const desk = deskRef.current;
    const oldEff = zoomed ? 1 : fit;
    const newEff = willZoom ? 1 : fit;
    setZoomed(willZoom);
    if (!desk) return;
    requestAnimationFrame(() => {
      if (willZoom && clientX != null) {
        const rect = desk.getBoundingClientRect();
        const docX = (desk.scrollLeft + clientX - rect.left) / oldEff;
        const docY = (desk.scrollTop + clientY - rect.top) / oldEff;
        desk.scrollLeft = docX * newEff - (clientX - rect.left);
        desk.scrollTop = docY * newEff - (clientY - rect.top);
      } else {
        desk.scrollLeft = 0;
      }
    });
  };
  const onDeskTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      const t = e.changedTouches[0];
      applyZoom(!zoomed, t ? t.clientX : null, t ? t.clientY : null);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  React.useEffect(() => {
    if (rootRef.current) rootRef.current.querySelectorAll('textarea').forEach(autoGrow);
  }, [os]);

  React.useEffect(() => {
    if (!autoDownload) return;
    const t = setTimeout(() => exportOsPdf(rootRef.current, pdfNameFor(row)), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (field) => (e) => { autoGrow(e.target); onUpdateOS(field, e.target.value); };

  const addField = (sec) => {
    const key = sec === 'sobre' ? 'customSobre' : 'customFat';
    onUpdateOS(key, (os[key] || []).concat([{ label: 'Novo campo :', value: '' }]));
  };
  const removeField = (sec, idx) => {
    const key = sec === 'sobre' ? 'customSobre' : 'customFat';
    onUpdateOS(key, (os[key] || []).filter((_, i) => i !== idx));
  };
  const updateCustomField = (sec, idx, k, value) => {
    const key = sec === 'sobre' ? 'customSobre' : 'customFat';
    onUpdateOS(key, (os[key] || []).map((it, i) => i === idx ? { ...it, [k]: value } : it));
  };

  const onPickLogo = (which) => { fileWhichRef.current = which; fileInputRef.current && fileInputRef.current.click(); };
  const onLogoFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateOS('logo' + fileWhichRef.current, reader.result);
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const tBase = { font: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.4, color: '#111', margin: 0, outline: 'none', boxSizing: 'border-box', width: '100%' };
  const aff = osEdit ? { border: '1px dashed #ff2e6b', background: '#fff5f9', borderRadius: 5 } : { border: '1px solid transparent', background: 'transparent' };
  const readOnly = !osEdit;
  const rowStyle = { display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 5 };
  const labelStyle = { fontWeight: 700, fontSize: 13, flex: '0 0 auto', whiteSpace: 'nowrap', paddingTop: 2, color: '#111' };
  const valStyle = { ...tBase, ...aff, flex: '1 1 auto', minWidth: 30, padding: '1px 5px', fontSize: 13 };
  const customLabelStyle = { ...tBase, ...aff, fontSize: 13, fontWeight: 700, flex: '0 0 auto', width: 110, padding: '1px 5px' };
  const addFieldBtnStyle = { background: 'none', color: '#ff2e6b', border: '1px dashed #ff2e6b', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 8 };
  const removeFieldBtnStyle = { background: 'none', border: 'none', color: '#c0c0c0', fontSize: 13, cursor: 'pointer', flex: '0 0 auto', padding: '0 2px' };

  return (
    <div className="os-view-shell">
      <div className="os-view-toolbar">
        <button className="btn btn-ghost" onClick={onBack} data-cursor="hover"><Icon name="chevron-left" size={14}/> Voltar</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{shared ? 'Somente leitura' : (osEdit ? 'Modo edição — clique nos campos para alterar' : 'Modo visualização')}</span>
          {!shared && (
            <button className={osEdit ? 'btn btn-accent' : 'btn btn-ghost'} onClick={() => setOsEdit(!osEdit)} data-cursor="hover">
              {osEdit ? <><Icon name="check" size={13}/> Concluir edição</> : <><Icon name="edit" size={13}/> Editar documento</>}
            </button>
          )}
          <button className="btn btn-accent" onClick={() => exportOsPdf(rootRef.current, pdfNameFor(row))} data-cursor="hover">
            <Icon name="download" size={13}/> Baixar PDF
          </button>
        </div>
      </div>

      <div className="os-desk" ref={deskRef} onTouchEnd={onDeskTouchEnd}>
        <div className="os-zoom-hint" onClick={() => applyZoom(!zoomed, null, null)}>{zoomed ? 'Toque duplo para ajustar' : 'Toque duplo para ampliar · arraste para navegar'}</div>
        <div className="os-stage" style={{ width: DOC_W * eff, height: docH ? docH * eff : undefined }}>
        <div className="os-doc" ref={rootRef} style={{ transform: `scale(${eff})`, transformOrigin: 'top left' }}>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={onLogoFile} style={{ display: 'none' }}/>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: '1 1 auto' }}>
              <textarea value={os.date || ''} data-field="date" onChange={set('date')} readOnly={readOnly} rows={1}
                style={{ ...tBase, ...aff, fontSize: 10, color: '#333', width: 120, padding: '1px 4px' }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 14 }}>
                {os.logoSkyline
                  ? <img src={os.logoSkyline} alt="Skyline" style={{ height: 78, objectFit: 'contain' }}/>
                  : <img src="/os-skyline-logo.png" alt="Grupo Skyline" style={{ height: 78, width: 'auto', display: 'block' }}/>}
                <div style={{ width: 3, height: 82, background: '#d0d0d0' }}/>
                {os.logoFramety
                  ? <img src={os.logoFramety} alt="Framety" style={{ height: 58, objectFit: 'contain' }}/>
                  : <img src="/os-framety-logo.png" alt="Framety" style={{ height: 58, width: 'auto', display: 'block' }}/>}
              </div>
              {osEdit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => onPickLogo('Skyline')} data-cursor="hover" style={{ background: '#fff', color: '#ff2e6b', border: '1px solid #ff2e6b', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Trocar logo Skyline</button>
                  <button onClick={() => onPickLogo('Framety')} data-cursor="hover" style={{ background: '#fff', color: '#ff2e6b', border: '1px solid #ff2e6b', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Trocar logo Framety</button>
                </div>
              )}
            </div>
            <div style={{ flex: '0 0 320px', textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: '#111' }}>ID do Serviço:</div>
              <div style={{ border: '2px solid #111', borderRadius: 16, padding: '10px 16px' }}>
                {/* O ID e o titulo do documento, mas 34px em peso 800 pesava mais que
                    todo o resto junto. Menor e menos gordo continua sendo a primeira
                    coisa que se le, sem parecer carimbo. */}
                <textarea value={os.servicoId || ''} data-field="servicoId" onChange={set('servicoId')} readOnly={readOnly} rows={1}
                  style={{ ...tBase, ...aff, fontSize: 26, fontWeight: 700, textAlign: 'center', padding: 2 }}/>
              </div>
            </div>
          </div>

          <div style={{ background: '#ff2e6b', borderRadius: 20, padding: '8px 16px', margin: '18px 0 16px', textAlign: 'center' }}>
            <textarea value={os.banner || ''} data-field="banner" onChange={set('banner')} readOnly={readOnly} rows={1}
              style={{ ...tBase, border: osEdit ? '1px dashed #fff' : '1px solid transparent', background: 'transparent', color: '#fff', fontSize: 11.5, fontWeight: 700, textAlign: 'center', letterSpacing: '0.2px', padding: '1px 4px' }}/>
          </div>

          <div style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 50%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#111' }}>Sobre o serviço:</div>
              <div style={{ border: '2px solid #111', borderRadius: 18, padding: '14px 16px' }}>
                <div style={rowStyle}><span style={labelStyle}>ID do serviço :</span><textarea value={os.servicoId || ''} data-field="servicoId" onChange={set('servicoId')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Emissão:</span><textarea value={os.emissao || ''} data-field="emissao" onChange={set('emissao')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Responsável:</span><textarea value={os.responsavel || ''} data-field="responsavel" onChange={set('responsavel')} readOnly={readOnly} rows={1} placeholder="—" style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Empresa:</span><textarea value={os.empresa || ''} data-field="empresa" onChange={set('empresa')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Projeto :</span><textarea value={os.projeto || ''} data-field="projeto" onChange={set('projeto')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Tipo de serviço :</span><textarea value={os.tipoServico || ''} data-field="tipoServico" onChange={set('tipoServico')} readOnly={readOnly} rows={1} placeholder="—" style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Fornecedor :</span><textarea value={os.fornecedor || ''} data-field="fornecedor" onChange={set('fornecedor')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Responsável :</span><textarea value={os.responsavel2 || ''} data-field="responsavel2" onChange={set('responsavel2')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                {(os.customSobre || []).map((cf, idx) => (
                  <div key={idx} style={rowStyle}>
                    <input value={cf.label} onChange={e => updateCustomField('sobre', idx, 'label', e.target.value)} readOnly={readOnly} style={customLabelStyle}/>
                    <textarea value={cf.value} onChange={e => { autoGrow(e.target); updateCustomField('sobre', idx, 'value', e.target.value); }} readOnly={readOnly} rows={1} style={valStyle}/>
                    {osEdit && <button onClick={() => removeField('sobre', idx)} data-cursor="hover" style={removeFieldBtnStyle}>✕</button>}
                  </div>
                ))}
                {osEdit && <button onClick={() => addField('sobre')} data-cursor="hover" style={addFieldBtnStyle}>＋ Adicionar campo</button>}
              </div>
            </div>

            <div style={{ flex: '1 1 50%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#111' }}>Dados para faturamento:</div>
              <div style={{ border: '2px solid #111', borderRadius: 18, padding: '14px 16px', height: 'calc(100% - 25px)' }}>
                <div style={rowStyle}><span style={labelStyle}>Nome :</span><textarea value={os.fatNome || ''} data-field="fatNome" onChange={set('fatNome')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>CNPJ :</span><textarea value={os.fatCnpj || ''} data-field="fatCnpj" onChange={set('fatCnpj')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                <div style={rowStyle}><span style={labelStyle}>Endereço :</span><textarea value={os.fatEndereco || ''} data-field="fatEndereco" onChange={set('fatEndereco')} readOnly={readOnly} rows={1} style={valStyle}/></div>
                {(os.customFat || []).map((cf, idx) => (
                  <div key={idx} style={rowStyle}>
                    <input value={cf.label} onChange={e => updateCustomField('fat', idx, 'label', e.target.value)} readOnly={readOnly} style={customLabelStyle}/>
                    <textarea value={cf.value} onChange={e => { autoGrow(e.target); updateCustomField('fat', idx, 'value', e.target.value); }} readOnly={readOnly} rows={1} style={valStyle}/>
                    {osEdit && <button onClick={() => removeField('fat', idx)} data-cursor="hover" style={removeFieldBtnStyle}>✕</button>}
                  </div>
                ))}
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: '#111' }}>Adicionar na descrição da nota e da plataforma :</div>
                  <textarea value={os.descNota || ''} data-field="descNota" onChange={set('descNota')} readOnly={readOnly} rows={1}
                    style={{ ...tBase, ...aff, fontSize: 13, textAlign: 'center', fontStyle: 'italic', padding: '2px 6px' }}/>
                </div>
                {osEdit && <button onClick={() => addField('fat')} data-cursor="hover" style={addFieldBtnStyle}>＋ Adicionar campo</button>}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ border: '2px solid #111', borderRadius: 18, padding: '12px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#111' }}>Descrição:</div>
              <textarea value={os.descricao || ''} data-field="descricao" onChange={set('descricao')} readOnly={readOnly} rows={2} placeholder="Descreva o serviço..."
                style={{ ...tBase, ...aff, fontSize: 13, textAlign: 'center', padding: '2px 6px', fontStyle: 'italic' }}/>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ border: '2px solid #111', borderRadius: 18, padding: '12px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#111' }}>Informações adicionais:</div>
              <textarea value={os.infoAdicionais || ''} data-field="infoAdicionais" onChange={set('infoAdicionais')} readOnly={readOnly} rows={1}
                style={{ ...tBase, ...aff, fontSize: 13, textAlign: 'center', padding: '2px 6px', fontStyle: 'italic' }}/>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 20, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 auto' }}>
              <textarea value={os.nota1 || ''} data-field="nota1" onChange={set('nota1')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 11.5, padding: '1px 5px' }}/>
              <textarea value={os.nota2 || ''} data-field="nota2" onChange={set('nota2')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 11.5, padding: '1px 5px' }}/>
              <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 700, color: '#111' }}>{os.anexoLabel}</div>
              <textarea value={os.pipefyLink || ''} data-field="pipefyLink" onChange={set('pipefyLink')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 12, fontWeight: 700, padding: '1px 5px', color: '#111' }}/>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 15 }}>⚠</span>
                <textarea value={os.pixNote || ''} data-field="pixNote" onChange={set('pixNote')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 11.5, padding: '1px 5px' }}/>
              </div>
            </div>
            <div style={{ flex: '0 0 250px', textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: '#111' }}>Valor total :</div>
              <div style={{ border: '2px solid #111', borderRadius: 16, padding: '10px 14px' }}>
                <textarea value={os.valorTotal || ''} data-field="valorTotal" onChange={set('valorTotal')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 29, fontWeight: 800, textAlign: 'center', padding: 2 }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: '#111' }}>Forma de pagamento :</span>
                <textarea value={os.formaPagamento || ''} data-field="formaPagamento" onChange={set('formaPagamento')} readOnly={readOnly} rows={1} style={{ ...tBase, ...aff, fontSize: 13, fontWeight: 700, textAlign: 'right', width: 90, padding: '1px 5px' }}/>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};


Object.assign(window, { osToday, anoOfRow, buildOS, pdfNameFor, autoGrow, exportOsPdf, OsDocumentView });
