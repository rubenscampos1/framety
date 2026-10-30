'use strict';

const crypto = require('crypto');

const FUSO = 'America/Sao_Paulo';
const DOC = 'application/vnd.google-apps.document';
const MESES = { janeiro:1, fevereiro:2, marco:3, março:3, abril:4, maio:5, junho:6,
  julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12 };
const DIAS_SEMANA = { domingo:0, segunda:1, terca:2, terça:2, quarta:3, quinta:4, sexta:5, sabado:6, sábado:6 };

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isoDia = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d);
const somaDias = (base, n) => { const d = new Date(base + 'T12:00:00-03:00'); d.setDate(d.getDate() + n); return isoDia(d); };
const somaUteis = (base, n) => { let d = base; for (let i=0;i<n;) { d=somaDias(d,1); const w=new Date(d+'T12:00:00-03:00').getDay(); if(w!==0&&w!==6)i++; } return d; };
const idCurto = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

function dataDaReuniao(doc) {
  const s = String(doc.name || doc.titulo || '');
  const m = s.match(/(20\d{2})[\/-](\d{2})[\/-](\d{2})\s+(\d{1,2}):(\d{2})\s+GMT([+-]\d{2}:\d{2})/i);
  if (m) return { dia:`${m[1]}-${m[2]}-${m[3]}`, instante:`${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2,'0')}:${m[5]}:00${m[6]}` };
  return { dia: isoDia(new Date(doc.createdTime || Date.now())), instante: doc.createdTime || null };
}

function janelaDeData(frase, base) {
  const t = semAcento(frase);
  if (/\bhoje\b/.test(t)) return { inicio:base, fim:base, precisao:'dia' };
  if (/\bamanha\b/.test(t)) { const d=somaDias(base,1); return { inicio:d,fim:d,precisao:'dia' }; }
  let m=t.match(/(?:daqui a|em(?:\s+ate)?|dentro de)\s+(\d{1,3})\s+dias?\s+uteis?/);
  if (m) { const d=somaUteis(base,+m[1]); return { inicio:d,fim:d,precisao:'calculada' }; }
  m=t.match(/(?:daqui a|em(?:\s+ate)?|dentro de)\s+(\d{1,3})\s+dias?/);
  if (m) { const d=somaDias(base,+m[1]); return { inicio:d,fim:d,precisao:'calculada' }; }
  m=t.match(/\b(?:dia|ate o dia|para o dia)\s+(\d{1,2})(?:[\/-](\d{1,2})(?:[\/-](20\d{2}))?)?/);
  if (m) { let ano=+(m[3]||base.slice(0,4)), mes=+(m[2]||base.slice(5,7)); if(!m[2]&&+m[1]<+base.slice(8,10)) { mes++; if(mes===13){mes=1;ano++;} } const d=`${ano}-${String(mes).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`; return {inicio:d,fim:d,precisao:'dia'}; }
  m=t.match(/\b(primeira|segunda)\s+quinzena\s+de\s+([a-zç]+)/);
  if (m && MESES[m[2]]) { let ano=+base.slice(0,4), mes=MESES[m[2]]; if(mes < +base.slice(5,7)) ano++; const mm=String(mes).padStart(2,'0'); return m[1]==='primeira'?{inicio:`${ano}-${mm}-01`,fim:`${ano}-${mm}-15`,precisao:'janela'}:{inicio:`${ano}-${mm}-16`,fim:`${ano}-${mm}-${new Date(ano,mes,0).getDate()}`,precisao:'janela'}; }
  m=t.match(/\b(?:entre\s+)?(?:os\s+)?dias?\s+(\d{1,2})\s+(?:e|a)\s+(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(20\d{2}))?/);
  if (m && MESES[m[3]]) { let ano=+(m[4]||base.slice(0,4)), mes=MESES[m[3]]; if(!m[4]&&mes < +base.slice(5,7))ano++; const mm=String(mes).padStart(2,'0'); return {inicio:`${ano}-${mm}-${String(+m[1]).padStart(2,'0')}`,fim:`${ano}-${mm}-${String(+m[2]).padStart(2,'0')}`,precisao:'janela'}; }
  m=t.match(/\b(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(20\d{2}))?/);
  if (m && MESES[m[2]]) { let ano=+(m[3]||base.slice(0,4)), mes=MESES[m[2]]; if(!m[3]&&(mes < +base.slice(5,7)||(mes===+base.slice(5,7)&&+m[1]<+base.slice(8,10))))ano++; const d=`${ano}-${String(mes).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`; return {inicio:d,fim:d,precisao:'dia'}; }
  if(/\b(?:na\s+)?(?:proxima\s+semana|semana\s+que\s+vem)\b/.test(t)) { const w=new Date(base+'T12:00:00-03:00').getDay(), inicio=somaDias(base,(8-w)%7||7); return {inicio,fim:somaDias(inicio,6),precisao:'janela'}; }
  m=t.match(/\b(inicio|come[cç]o|fim|final)\s+de\s+([a-zç]+)(?:\s+de\s+(20\d{2}))?/);
  if(m&&MESES[m[2]]){let ano=+(m[3]||base.slice(0,4)),mes=MESES[m[2]];if(!m[3]&&mes<+base.slice(5,7))ano++;const mm=String(mes).padStart(2,'0'),ultimo=new Date(ano,mes,0).getDate();return /^(inicio|comeco)$/.test(m[1])?{inicio:`${ano}-${mm}-01`,fim:`${ano}-${mm}-07`,precisao:'janela'}:{inicio:`${ano}-${mm}-${String(Math.max(1,ultimo-6)).padStart(2,'0')}`,fim:`${ano}-${mm}-${ultimo}`,precisao:'janela'};}
  m=t.match(/\b(?:na\s+|ate(?:\s+(?:a|na))?\s+|para(?:\s+(?:a|na))?\s+|proxima\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?\b/);
  if (m && DIAS_SEMANA[m[1]]!==undefined) { const atual=new Date(base+'T12:00:00-03:00').getDay(), alvo=DIAS_SEMANA[m[1]]; let n=(alvo-atual+7)%7; if(n===0||/proxima/.test(t))n+=7; const d=somaDias(base,n); return {inicio:d,fim:d,precisao:'calculada'}; }
  return { inicio:null, fim:null, precisao:'a_confirmar' };
}

function secoes(texto) {
  const linhas=String(texto||'').replace(/\u000b/g,'\n').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const out={resumo:[],decisoes:[],proximas:[],detalhes:[],original:[]}; let atual='';
  for(const l of linhas){
    const n=semAcento(l);
    if(/^(transcricao|transcript|registro completo)$/.test(n))break;
    if(n==='resumo'){atual='resumo';out.original.push('Resumo');continue;}
    if(/^decisoes?$/.test(n)){atual='decisoes';out.original.push('Decisões');continue;}
    if(n==='proximas etapas'){atual='proximas';out.original.push('Próximas etapas');continue;}
    if(n==='detalhes'){atual='detalhes';out.original.push('Detalhes');continue;}
    if(atual){out[atual].push(l);out.original.push(l);}
  }
  return out;
}

function topicosDe(s) {
  const linhas=[...s.resumo,...s.decisoes].flatMap(x=>String(x).split(/(?<=[.!?])\s+(?=[A-ZÀ-Ü])/)).map(x=>x.replace(/^[•●▪\-*]\s*/,'').trim()).filter(x=>x.length>12);
  const vistos=new Set();return linhas.filter(x=>{const k=semAcento(x);if(vistos.has(k))return false;vistos.add(k);return true;}).slice(0,8);
}

function papelDe(nome, internos) {
  const n=semAcento(nome);
  if (!n || /^(a equipe|equipe|time)$/.test(n)) return 'equipe';
  if (n.includes('skyline') || internos.some(x => n===x || n.includes(x) || x.includes(n))) return 'interno';
  return 'cliente';
}

function semanticaDe(c, internos) {
  const texto=semAcento(`${c.acao} ${c.descricao}`), verbos=[['enviar','envi'],['entregar','entreg'],['receber','receb'],['aprovar','aprov'],['revisar','revis'],['produzir','produz'],['gravar','grav'],['publicar','public'],['apresentar','apresent'],['validar','valid']];
  let responsavel=c.responsavel;
  if(!responsavel){
    if(/\b(cliente|contratante)\b/.test(texto))responsavel='Cliente';
    else if(/\b(equipe|time|skyline|framety)\b/.test(texto))responsavel='Equipe';
  }
  const v=texto.match(/\b(v\s*\d+|primeira versao|segunda versao|terceira versao|versao final)\b/i), versoes={'primeira versao':'V1','segunda versao':'V2','terceira versao':'V3','versao final':'FINAL'};
  return {responsavel:responsavel||null,papel:papelDe(responsavel,internos),tipo_acao:(verbos.find(([,raiz])=>new RegExp(`\\b${raiz}[a-z]*\\b`).test(texto))||['acompanhar'])[0],versao:v?(versoes[semAcento(v[1])]||v[1].toUpperCase().replace(/\s+/g,'')):null};
}

function extrairDocumento(doc, internos=[]) {
  const data=dataDaReuniao(doc), s=secoes(doc.texto), candidatos=[];
  for(const linha of s.proximas){ const m=linha.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/); if(m)candidatos.push({responsavel:m[1].trim(),acao:m[2].trim(),evidencia:linha,descricao:m[3].trim(),fonte:'proximas_etapas'}); }
  const corpo=[...s.resumo,...s.detalhes];
  for(const linha of corpo){ if(!/(\bhoje\b|\bamanh[ãa]\b|\bdia\s+\d|\bquinzena\b|\bdias?\s+[úu]teis?\b|\bentregar\b|\benviar\b|\breceber\b|\bprazo\b)/i.test(linha))continue; candidatos.push({responsavel:'',acao:linha.slice(0,120),descricao:linha,evidencia:linha,fonte:'contexto'}); }
  const vistos=new Set(), compromissos=[];
  for(const c of candidatos){ const chave=semAcento(`${c.responsavel}|${c.acao}|${c.descricao}`).replace(/\s+/g,' '); if(vistos.has(chave))continue; vistos.add(chave); const janela=janelaDeData(`${c.acao} ${c.descricao}`,data.dia), semantica=semanticaDe(c,internos); compromissos.push({id:'mc_'+idCurto(`${doc.id}|${chave}`),documento_id:doc.id,responsavel:semantica.responsavel,papel:semantica.papel,tipo_acao:semantica.tipo_acao,versao:semantica.versao,acao:c.acao,descricao:c.descricao,evidencia:c.evidencia,origem:c.fonte,data_inicio:janela.inicio,data_fim:janela.fim,precisao:janela.precisao,estado:'pendente'}); }
  return { documento:{id:doc.id,titulo:doc.name||doc.titulo,url:doc.webViewLink||doc.url||null,criado_em:doc.createdTime||null,atualizado_em:doc.modifiedTime||null,reuniao_em:data.instante,reuniao_dia:data.dia,status:compromissos.length?'processado':'revisar',topicos:topicosDe(s),resumo:s.resumo.join('\n'),resumo_original:s.original.join('\n'),conteudo_original:String(doc.texto||'')}, compromissos };
}

function ehCandidato(f, paisConhecidos=new Set()) {
  if (!f || f.mimeType!==DOC || f.trashed) return false;
  if (/anota[cç][oõ]es do gemini/i.test(f.name||'')) return true;
  if ((f.parents||[]).some(x=>paisConhecidos.has(x)) && /20\d{2}[\/-]\d{2}[\/-]\d{2}/.test(f.name||'')) return true;
  return false;
}

function montarMeets({ r, loja, autenticar, soAdmin, envolve, google }) {
  const D=()=>loja.dados;
  const dados=()=>D().meets||(D().meets={documentos:[],compromissos:[],candidatos:[],erros:[],correcoes:{},pais:[],versao_extracao:0,historico_concluido:false,ultima_varredura:null,avisos:[],seq:0});
  const internos=()=>D().usuarios.filter(u=>u.ativo!==false).flatMap(u=>[semAcento(u.nome),semAcento(u.usuario)]).filter(Boolean);
  const listar=()=>({documentos:dados().documentos,compromissos:dados().compromissos,candidatos:dados().candidatos||[],erros:dados().erros||[],historico_concluido:!!dados().historico_concluido,ultima_varredura:dados().ultima_varredura,pendentes:dados().documentos.filter(x=>x.status==='revisar').length+(dados().candidatos||[]).length+(dados().erros||[]).length});

  async function executarVarredura() {
    if (!google.conectado()) throw Object.assign(new Error('Conecte a conta Google no FramePlus.'),{status:409});
    const campos='nextPageToken,files(id,name,mimeType,parents,createdTime,modifiedTime,webViewLink,trashed)';
    async function buscar(q){const itens=[];let token='';do{const j=await google.api('GET',`/files?${new URLSearchParams({q,pageSize:'1000',fields:campos,spaces:'drive',includeItemsFromAllDrives:'true',supportsAllDrives:'true',...(token?{pageToken:token}:{})})}`);itens.push(...(j.files||[]));token=j.nextPageToken||'';}while(token);return itens;}
    const base=dados(), primeiraCarga=!base.historico_concluido, atualizarModelo=Number(base.versao_extracao||0)<3, conhecidos=new Map(base.documentos.map(x=>[x.id,x])), porId=new Map(), origens=new Map(), avisar=[];
    const incluir=(x,origem)=>{porId.set(x.id,x);const o=origens.get(x.id)||new Set();o.add(origem);origens.set(x.id,o);};
    const exatos=await buscar(`mimeType = '${DOC}' and trashed = false and name contains 'Anotações do Gemini'`);
    exatos.forEach(x=>incluir(x,'titulo'));
    const pais=new Set(base.pais||[]); exatos.forEach(x=>(x.parents||[]).forEach(p=>pais.add(p)));
    // A pasta é apenas uma rede adicional: notas compartilhadas podem não ter pai visível.
    for(const pai of [...pais].slice(0,30)){const itens=await buscar(`mimeType = '${DOC}' and trashed = false and '${pai.replace(/'/g,"\\'")}' in parents`);itens.forEach(x=>incluir(x,'pasta'));}
    // Na primeira execução lemos todos os Docs acessíveis e confirmamos pelo
    // conteúdo. Isso cobre notas antigas renomeadas, movidas ou compartilhadas sem pai.
    // O marco só é gravado ao final; uma interrupção retoma a auditoria completa.
    if(!base.historico_concluido){const historicos=await buscar(`mimeType = '${DOC}' and trashed = false`);historicos.forEach(x=>incluir(x,'historico'));}
    // Uma falha temporária não pode fazer uma nota sumir depois da carga
    // histórica. Cada erro pendente é consultado diretamente pelo ID até ser lido.
    for(const erro of (base.erros||[])){
      try { const f=await google.api('GET',`/files/${encodeURIComponent(erro.id)}?${new URLSearchParams({fields:'id,name,mimeType,parents,createdTime,modifiedTime,webViewLink,trashed',supportsAllDrives:'true'})}`); if(f&&!f.trashed)incluir(f,'repetir_erro'); }
      catch(_e) { /* continua visível na fila de erros */ }
    }
    // Ao evoluir o extrator, releia também as notas já catalogadas.
    // Assim os novos campos aparecem sem depender de uma edição no Google Doc.
    if(atualizarModelo){
      for(const antigo of (base.documentos||[])){
        if(porId.has(antigo.id))continue;
        try {
          const f=await google.api('GET',`/files/${encodeURIComponent(antigo.id)}?${new URLSearchParams({fields:'id,name,mimeType,parents,createdTime,modifiedTime,webViewLink,trashed',supportsAllDrives:'true'})}`);
          if(f&&!f.trashed)incluir(f,'atualizar_modelo');
        } catch(_e) { /* permanece no acervo e será tentado novamente */ }
      }
    }
    // Depois da primeira carga, olha todo Doc novo/modificado (com margem de 48 h)
    // e confirma pela estrutura interna; assim uma futura mudança no título não some.
    if(base.ultima_varredura){const desde=new Date(Date.parse(base.ultima_varredura)-48*3600e3).toISOString();const recentes=await buscar(`mimeType = '${DOC}' and trashed = false and modifiedTime > '${desde}'`);recentes.forEach(x=>incluir(x,'recente'));}
    const achados=[...porId.values()], observados=new Map([
      ...base.documentos.map(x=>[x.id,x.atualizado_em]),
      ...(base.candidatos||[]).map(x=>[x.id,x.atualizado_em]),
      ...(base.erros||[]).map(x=>[x.id,x.atualizado_em])
    ]);
    let novos=0, processados=0;
    for(const f of achados){
      if(!atualizarModelo&&observados.get(f.id)===f.modifiedTime&&!origens.get(f.id)?.has('repetir_erro'))continue;
      const origem=origens.get(f.id)||new Set(), explicito=origem.has('titulo'), naPasta=origem.has('pasta');
      let texto='';
      try { texto=await google.textoDocumento(f.id); base.erros=(base.erros||[]).filter(x=>x.id!==f.id); }
      catch(e){base.erros=(base.erros||[]).filter(x=>x.id!==f.id);base.erros.push({id:f.id,titulo:f.name,url:f.webViewLink||null,atualizado_em:f.modifiedTime,motivo:'Não foi possível ler o documento',detalhe:String(e.message||e)});continue;}
      const assinatura=/registros da reuni[aã]o/i.test(texto)&&/\bresumo\b/i.test(texto);
      if(!explicito&&!assinatura){
        if(naPasta){base.candidatos=(base.candidatos||[]).filter(x=>x.id!==f.id);base.candidatos.push({id:f.id,titulo:f.name,url:f.webViewLink||null,atualizado_em:f.modifiedTime,motivo:'Documento na pasta de reuniões sem a estrutura esperada'});}
        continue;
      }
      base.candidatos=(base.candidatos||[]).filter(x=>x.id!==f.id);
      const documentoNovo=!conhecidos.has(f.id);
      const extraido=extrairDocumento({...f,texto},internos());
      extraido.compromissos=extraido.compromissos.map(c=>({...c,...((base.correcoes||{})[c.id]||{})}));
      base.documentos=base.documentos.filter(x=>x.id!==f.id); base.compromissos=base.compromissos.filter(x=>x.documento_id!==f.id); base.documentos.push(extraido.documento); base.compromissos.push(...extraido.compromissos); conhecidos.set(f.id,extraido.documento); novos++;
      if(!primeiraCarga&&documentoNovo)avisar.push(String(f.name||'Nova reunião').replace(/\s*-\s*20\d{2}[/-]\d{2}[/-]\d{2}.*$/i,'').replace(/\s*-\s*Anota[cç][oõ]es do Gemini.*$/i,'').trim()||'Nova reunião');
      processados++; if(processados%20===0)await loja.salvar();
    }
    base.pais=[...pais]; base.versao_extracao=3; base.historico_concluido=true; base.ultima_varredura=new Date().toISOString(); base.documentos.sort((a,b)=>String(b.reuniao_dia).localeCompare(String(a.reuniao_dia))); base.compromissos.sort((a,b)=>String(a.data_inicio||'9999').localeCompare(String(b.data_inicio||'9999'))); for(const titulo of avisar){base.seq++;base.avisos.push({seq:base.seq,em:base.ultima_varredura,documento:titulo,texto:`Resumo de ${titulo} pronto.`});}if(base.avisos.length>100)base.avisos=base.avisos.slice(-100); await loja.salvar(); return {novos,total:base.documentos.length,compromissos:base.compromissos.length,pendentes:base.documentos.filter(x=>x.status==='revisar').length+(base.candidatos||[]).length+(base.erros||[]).length,erros:(base.erros||[]).length,historico_concluido:true};
  }

  let varredura=null;
  async function varrer(){
    if(varredura)return varredura;
    varredura=executarVarredura().finally(()=>{varredura=null;});
    return varredura;
  }

  r.get('/meets',autenticar,(req,res)=>res.json(listar()));
  r.post('/meets/varrer',autenticar,soAdmin,envolve(async(req,res)=>res.json(await varrer())));
  r.put('/meets/compromissos/:id',autenticar,envolve(async(req,res)=>{
    const base=dados(), atual=base.compromissos.find(x=>x.id===req.params.id);
    if(!atual)throw Object.assign(new Error('Compromisso não encontrado.'),{status:404});
    const permitidos=['responsavel','papel','tipo_acao','versao','acao','descricao','data_inicio','data_fim','precisao','estado'];
    const correcao={}; for(const k of permitidos)if(Object.prototype.hasOwnProperty.call(req.body||{},k))correcao[k]=req.body[k];
    if(correcao.papel&&!['interno','equipe','cliente'].includes(correcao.papel))throw Object.assign(new Error('Papel inválido.'),{status:400});
    if(correcao.precisao&&!['dia','janela','calculada','a_confirmar'].includes(correcao.precisao))throw Object.assign(new Error('Precisão inválida.'),{status:400});
    base.correcoes=base.correcoes||{}; base.correcoes[atual.id]={...(base.correcoes[atual.id]||{}),...correcao,corrigido_em:new Date().toISOString(),corrigido_por:req.usuario?.id||null};
    Object.assign(atual,base.correcoes[atual.id]); await loja.salvar(); res.json({compromisso:atual});
  }));
  r.get('/meets/avisos',autenticar,(req,res)=>{const desde=Number(req.query.desde)||0;res.json({seq:dados().seq,avisos:dados().avisos.filter(x=>x.seq>desde)});});
  let timer=null;
  function iniciarAutomatico(){if(timer)return;const rodar=()=>google.conectado()&&varrer().catch(e=>console.error('[framyo meets]',e.message));setTimeout(rodar,30000).unref?.();timer=setInterval(rodar,5*60000);timer.unref?.();}
  iniciarAutomatico();
  return { varrer, extrairDocumento, ehCandidato, iniciarAutomatico };
}

module.exports={ montarMeets, extrairDocumento, ehCandidato, janelaDeData, dataDaReuniao };
