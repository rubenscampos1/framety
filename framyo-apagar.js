// framyo-apagar.js — apagar UMA versão de uma pilha no Frame.io, sem levar a pilha junto.
//
// O Frame.io V4 não tem "apagar só esta versão", e um DELETE /files/<id> num
// arquivo que está dentro de uma pilha pode apagar a pilha inteira (aconteceu em
// 14/10/2026: todas as versões e o item dos links de revisão sumiram). Por isso:
//   1. confere que o id é de um ARQUIVO (pilha ou pasta nunca são apagadas por aqui);
//   2. se ele está numa pilha: tira da pilha primeiro (move para a pasta da pilha,
//      o mesmo que "Tirar da pilha"), e só segue depois de conferir que ele saiu e
//      que a pilha continua lá com as outras versões;
//   3. só então apaga o arquivo — que agora é um vídeo solto;
//   4. confere de novo que a pilha continua existindo.
// Qualquer dúvida no caminho interrompe ANTES de apagar.

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const falha = (status, msg) => Object.assign(new Error(msg), { status });

async function existe(api, caminho) {
  try {
    return (await api('GET', caminho)).data || null;
  } catch (e) {
    if (e.status === 404 || e.status === 410) return null;
    throw e;
  }
}

/**
 * api(metodo, caminho, corpo) e tudo(caminho) são os do cliente Frame.io do servidor.
 * pilhaEsperada: id da pilha que a tela mostrou (opcional; se vier, tem de bater).
 * Devolve { ok, pilha_id, restantes, pasta_id }.
 */
async function apagarVersao({ api, tudo, conta, id, pilhaEsperada = null, tentativas = 10, intervaloMs = 600 }) {
  const enc = encodeURIComponent;
  if (!id) throw falha(400, 'Qual versão apagar?');

  // 1. Tem de ser um arquivo. Id de pilha ou de pasta: recusa (não apaga pilha inteira pelo FramePlus).
  const arquivo = await existe(api, `/accounts/${conta}/files/${enc(id)}`);
  if (!arquivo || (arquivo.type && arquivo.type !== 'file')) {
    throw falha(409, 'Por segurança, o FramePlus só apaga versões (arquivos). Pilhas e pastas não são apagadas por aqui.');
  }

  // O pai é uma pilha? (o Frame.io devolve 404 se o pai for uma pasta)
  const pilha = arquivo.parent_id ? await existe(api, `/accounts/${conta}/version_stacks/${enc(arquivo.parent_id)}`) : null;
  if (pilhaEsperada && (!pilha || pilha.id !== pilhaEsperada)) {
    throw falha(409, 'A versão não está mais nesta pilha. Atualize a tela e tente de novo. Nada foi apagado.');
  }

  if (!pilha) {                                   // vídeo solto: apagar é só apagar ele mesmo
    await api('DELETE', `/accounts/${conta}/files/${enc(id)}`);
    return { ok: true, pilha_id: null, restantes: null, pasta_id: arquivo.parent_id || null };
  }

  const filhos = async () => (await tudo(`/accounts/${conta}/version_stacks/${enc(pilha.id)}/children`))
    .filter((x) => !x.type || x.type === 'file');
  const antes = await filhos();
  if (!antes.some((x) => x.id === id)) {
    throw falha(409, 'A versão não aparece nesta pilha. Atualize a tela e tente de novo. Nada foi apagado.');
  }
  if (antes.length < 2) {
    throw falha(409, 'É a única versão desta pilha. Para não apagar o vídeo inteiro, o FramePlus não apaga a última versão. Nada foi apagado.');
  }
  const pasta = pilha.parent_id;
  if (!pasta) throw falha(409, 'Não foi possível saber a pasta desta pilha. Nada foi apagado.');

  // 2. Tira da pilha (vira um vídeo solto na pasta da pilha) e confere.
  await api('PATCH', `/accounts/${conta}/files/${enc(id)}/move`, { data: { parent_id: pasta } });
  const outras = antes.filter((x) => x.id !== id).map((x) => x.id);
  let conferido = false;
  let restantes = [];
  let desfeita = false;                           // pilha de 2 que o Frame.io desfez ao sair uma
  for (let i = 0; i < tentativas && !conferido; i++) {
    if (i) await espera(intervaloMs);
    const solto = await existe(api, `/accounts/${conta}/files/${enc(id)}`);
    if (!solto || solto.parent_id !== pasta) continue;
    const aindaPilha = await existe(api, `/accounts/${conta}/version_stacks/${enc(pilha.id)}`);
    if (aindaPilha) {
      restantes = await filhos();
      conferido = restantes.length >= 1 && !restantes.some((x) => x.id === id);
    } else if (outras.length === 1) {
      const outra = await existe(api, `/accounts/${conta}/files/${enc(outras[0])}`);
      conferido = desfeita = !!(outra && outra.id === outras[0]);
      restantes = conferido ? [outra] : [];
    }
  }
  if (!conferido) {
    throw falha(409, 'O Frame.io não confirmou a saída da versão da pilha. Por segurança, nada foi apagado. '
                     + 'Confira a pasta: a versão pode ter ficado solta ao lado da pilha.');
  }

  // 3. Agora é um arquivo solto: apagar não alcança a pilha.
  await api('DELETE', `/accounts/${conta}/files/${enc(id)}`);

  // 4. O que ficou continua lá?
  if (desfeita) {
    const outra = await existe(api, `/accounts/${conta}/files/${enc(outras[0])}`);
    if (!outra) throw falha(502, 'A versão foi apagada, mas o Frame.io não mostra mais a outra versão. Confira no Frame.io (Recentemente apagados).');
    return { ok: true, pilha_id: null, restantes: 1, pasta_id: pasta, desfeita: true };
  }
  const depois = await existe(api, `/accounts/${conta}/version_stacks/${enc(pilha.id)}`);
  if (!depois) {
    throw falha(502, 'A versão foi apagada, mas o Frame.io não mostra mais a pilha. Confira no Frame.io (Recentemente apagados).');
  }
  return { ok: true, pilha_id: pilha.id, restantes: restantes.length, pasta_id: pasta };
}

module.exports = { apagarVersao };
