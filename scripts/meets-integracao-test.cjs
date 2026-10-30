'use strict';
const assert=require('node:assert/strict');
const {montarMeets}=require('../framyo-meets');

const MIME='application/vnd.google-apps.document';
const nota=(id,name,modifiedTime,parents=[],texto='')=>({id,name,mimeType:MIME,createdTime:'2026-10-20T12:00:00Z',modifiedTime,parents,webViewLink:`https://docs.google.com/document/d/${id}/edit`,texto});
const estrutura=(titulo,proxima)=>`${titulo}\nRegistros da reunião\nResumo\nPrazo combinado com o cliente.\nPróximas etapas\n${proxima}\nDetalhes\nTudo confirmado.`;
const arquivos=[
  nota('exata','Kickoff - 2026/10/20 09:00 GMT-03:00 - Anotações do Gemini','2026-10-20T13:00:00Z',['p-reunioes'],estrutura('Kickoff','[Rubens Campos] Enviar V1: Entregar em 5 dias úteis.')),
  nota('renomeada','Projeto Horizonte','2026-10-21T13:00:00Z',[],estrutura('Horizonte','[Cliente XPTO] Aprovar roteiro: Responder em 17 de novembro.')),
  nota('ambigua','Pauta antiga','2026-10-22T13:00:00Z',['p-reunioes'],'Documento sem estrutura de reunião.'),
  nota('comum','Lista de compras','2026-10-22T13:00:00Z',[],'Arroz e café.'),
  nota('falha','Reunião recuperável - Anotações do Gemini','2026-10-22T13:00:00Z',[],estrutura('Recuperável','[Equipe] Enviar material: Entregar amanhã.'))
];
const rotas={};
const r={get:(p,...h)=>rotas[`GET ${p}`]=h.at(-1),post:(p,...h)=>rotas[`POST ${p}`]=h.at(-1),put:(p,...h)=>rotas[`PUT ${p}`]=h.at(-1)};
const loja={dados:{usuarios:[{ativo:true,nome:'Rubens Campos',usuario:'rubens'}]},salvos:0,async salvar(){this.salvos++;}};
let falhasRestantes=1;
const google={
  conectado:()=>true,
  async api(_metodo,url){
    const direto=url.match(/^\/files\/([^?]+)/);
    if(direto){const x=arquivos.find(a=>a.id===decodeURIComponent(direto[1]));if(!x)throw new Error('404');const {texto,...meta}=x;return meta;}
    const q=new URL('https://local'+url).searchParams.get('q')||'';
    let files=arquivos;
    if(q.includes("name contains 'Anotações do Gemini'"))files=arquivos.filter(x=>x.name.includes('Anotações do Gemini'));
    else if(q.includes(' in parents')){const p=(q.match(/'([^']+)' in parents/)||[])[1];files=arquivos.filter(x=>x.parents.includes(p));}
    else if(q.includes('modifiedTime >')){const d=(q.match(/modifiedTime > '([^']+)'/)||[])[1];files=arquivos.filter(x=>x.modifiedTime>d);}
    return {files:files.map(({texto,...x})=>x)};
  },
  async textoDocumento(id){if(id==='falha'&&falhasRestantes-- > 0)throw new Error('falha simulada');return arquivos.find(x=>x.id===id).texto;}
};
const envolve=fn=>fn;

(async()=>{
  const m=montarMeets({r,loja,autenticar:(_q,_s,n)=>n?.(),soAdmin:(_q,_s,n)=>n?.(),envolve,google});
  const primeira=await m.varrer();
  assert.equal(primeira.historico_concluido,true);
  assert.equal(primeira.total,2,'nota renomeada deve ser encontrada pela estrutura');
  assert.equal(loja.dados.meets.candidatos.length,1,'documento ambíguo da pasta deve ir para revisão');
  assert.equal(loja.dados.meets.erros.length,1,'falha isolada deve ficar visível sem interromper o lote');
  assert.equal(loja.dados.meets.avisos.length,0,'carga histórica não deve despejar avisos antigos');
  assert.equal(loja.dados.meets.documentos.some(x=>x.id==='comum'),false);
  const quantidadeExata=loja.dados.meets.compromissos.filter(x=>x.documento_id==='exata').length;
  const recuperada=await m.varrer();
  assert.equal(recuperada.novos,1,'nota com falha temporária deve ser tentada novamente pelo ID');
  assert.equal(loja.dados.meets.erros.length,0);
  assert.match(loja.dados.meets.avisos[0].texto,/Reunião recuperável/);
  const repetida=await m.varrer();
  assert.equal(repetida.novos,0,'varredura idempotente não pode duplicar notas');
  assert.equal(loja.dados.meets.compromissos.filter(x=>x.documento_id==='exata').length,quantidadeExata);
  const compromisso=loja.dados.meets.compromissos.find(x=>x.documento_id==='exata');
  let resposta;
  await rotas['PUT /meets/compromissos/:id']({params:{id:compromisso.id},body:{responsavel:'Rayssa Skyline',papel:'interno',data_inicio:'2026-11-02',data_fim:'2026-11-02',precisao:'dia'},usuario:{id:'u1'}},{json:x=>{resposta=x;}});
  assert.equal(resposta.compromisso.responsavel,'Rayssa Skyline');
  arquivos.find(x=>x.id==='exata').modifiedTime='2029-01-01T12:00:00Z';
  await m.varrer();
  assert.equal(loja.dados.meets.compromissos.find(x=>x.id===compromisso.id).data_inicio,'2026-11-02','correção humana deve sobreviver à reimportação');
  arquivos.push(nota('futura','Ata interna sem sufixo','2030-01-01T12:00:00Z',[],estrutura('Ata','[Equipe] Revisar V2: Apresentar na sexta-feira.')));
  const futura=await m.varrer();
  assert.equal(futura.novos,1,'nota futura renomeada deve ser encontrada pela varredura incremental');
  assert.match(loja.dados.meets.avisos.at(-1).texto,/Ata interna sem sufixo/);
  assert.ok(loja.salvos>=3);
  console.log('Meets: varredura histórica, incremental, idempotência, revisão e tolerância a falhas — OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
