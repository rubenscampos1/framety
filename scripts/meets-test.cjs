'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const modulo=fs.existsSync(path.join(__dirname,'framyo-meets.js'))?'./framyo-meets':'../framyo-meets';
const {extrairDocumento,ehCandidato,janelaDeData,dataDaReuniao}=require(modulo);

const doc={id:'doc1',name:'Kickoff Cliente - 2026/10/23 09:54 GMT-03:00 - Anotações do Gemini',mimeType:'application/vnd.google-apps.document',createdTime:'2026-10-23T13:34:47Z',modifiedTime:'2026-10-23T13:35:12Z',webViewLink:'https://docs.google.com/document/d/doc1/edit',texto:`Kickoff Cliente
Resumo
O cliente enviará o material na primeira quinzena de dezembro.
Próximas etapas
[Rayssa Skyline] Redigir roteiro: Enviar a primeira versão para a cliente em até 5 dias úteis.
[Alessandra Marques] Enviar identidade visual: Disponibilizar o material dia 27.
Detalhes
Foi combinado que o lançamento acontecerá na primeira quinzena de dezembro.`};

assert.equal(ehCandidato(doc,new Set()),true);
assert.equal(ehCandidato({...doc,name:'Documento comum'},new Set()),false);
assert.equal(dataDaReuniao(doc).dia,'2026-10-23');
assert.deepEqual(janelaDeData('daqui a 15 dias','2026-10-23'),{inicio:'2026-11-07',fim:'2026-11-07',precisao:'calculada'});
assert.deepEqual(janelaDeData('primeira quinzena de dezembro','2026-10-23'),{inicio:'2026-12-01',fim:'2026-12-15',precisao:'janela'});
assert.deepEqual(janelaDeData('entregar na sexta-feira','2026-10-23'),{inicio:'2026-10-30',fim:'2026-10-30',precisao:'calculada'});
assert.deepEqual(janelaDeData('entregar até sexta','2026-10-26'),{inicio:'2026-10-30',fim:'2026-10-30',precisao:'calculada'});
assert.deepEqual(janelaDeData('revisar na semana que vem','2026-10-23'),{inicio:'2026-10-26',fim:'2026-11-01',precisao:'janela'});
assert.deepEqual(janelaDeData('aprovar no início de dezembro','2026-10-23'),{inicio:'2026-12-01',fim:'2026-12-07',precisao:'janela'});
assert.deepEqual(janelaDeData('publicar no fim de novembro','2026-10-23'),{inicio:'2026-11-24',fim:'2026-11-30',precisao:'janela'});
assert.deepEqual(janelaDeData('apresentar em 17 de novembro','2026-10-23'),{inicio:'2026-11-17',fim:'2026-11-17',precisao:'dia'});
assert.deepEqual(janelaDeData('aprovar entre os dias 17 e 19 de novembro','2026-10-23'),{inicio:'2026-11-17',fim:'2026-11-19',precisao:'janela'});
const x=extrairDocumento(doc,['rayssa skyline','rubens campos']);
assert.equal(x.documento.status,'processado');
assert.ok(x.documento.topicos.length>0);
assert.equal(x.documento.conteudo_original,doc.texto);
assert.match(x.documento.resumo_original,/Próximas etapas/);
assert.ok(x.compromissos.length>=3);
const rayssa=x.compromissos.find(c=>c.responsavel==='Rayssa Skyline');
assert.equal(rayssa.papel,'interno');
assert.equal(rayssa.data_inicio,'2026-10-30');
assert.equal(rayssa.tipo_acao,'enviar');
assert.equal(rayssa.versao,'V1');
const cliente=x.compromissos.find(c=>c.responsavel==='Alessandra Marques');
assert.equal(cliente.papel,'cliente');
assert.equal(cliente.data_inicio,'2026-10-27');
const clienteContexto=x.compromissos.find(c=>c.origem==='contexto' && /cliente enviar/i.test(c.descricao));
assert.equal(clienteContexto.papel,'cliente');
assert.equal(clienteContexto.tipo_acao,'enviar');
const vazio=extrairDocumento({...doc,id:'doc2',texto:'Resumo\nConversa geral sem encaminhamentos.'},[]);
assert.equal(vazio.documento.status,'revisar');
console.log('Meets: identificação, datas, papéis e fila de revisão — OK');
