# Planilha de jobs → OS

A aba **Produções** não guarda mais uma lista. O operador digita o `#SKY`, o
servidor procura aquela linha na planilha de produção e a OS é montada com os
campos que já estão lá. A planilha é a fonte; o entregável é o PDF.

## Como o acesso funciona

A planilha está compartilhada como **"qualquer pessoa com o link pode ver"**, e
é para ficar assim — foi a decisão, para que o console consiga puxar os dados a
qualquer momento sem depender de credencial. O servidor baixa o CSV de
exportação, que o Google serve sem autenticação para uma planilha aberta.

Consequência a ter em mente: **quem tiver a URL da planilha lê os mesmos dados**
— cachê, fornecedor e cliente de todos os jobs. Se um dia isso passar a
incomodar, o caminho é fechar o compartilhamento e trocar a leitura por uma
conta de serviço do Google Cloud; o resto do módulo (cabeçalho, mapeamento de
colunas, busca) não muda.

## Configuração

`os-sheet.config.json` na raiz do projeto:

```json
{
  "spreadsheetId": "https://docs.google.com/spreadsheets/d/1hg_6b8.../edit?usp=sharing"
}
```

- `spreadsheetId` aceita o ID puro **ou** a URL inteira colada da barra do
  navegador — o servidor extrai o ID.
- `gid` é opcional. Sem ele, lê a primeira aba. A exportação em CSV identifica a
  aba pelo **gid**, não pelo nome; ele está na própria URL, depois de `#gid=`.
  Se você colar a URL inteira com o `#gid=`, ele é aproveitado sozinho.
- O arquivo está no `.gitignore` — a configuração aponta para uma planilha
  específica e não precisa viajar no repositório.

### No Render (produção)

Não há arquivo lá; use variáveis de ambiente:

| variável | conteúdo |
|---|---|
| `GSHEET_ID` | ID ou URL da planilha |
| `GSHEET_GID` | gid da aba (opcional) |

## Colunas

O servidor acha sozinho a linha de cabeçalho (procura nas primeiras 15 linhas
aquela que casa com mais nomes conhecidos), então o título "Locuções 2026" no
topo não atrapalha. Na planilha de hoje ele acha o cabeçalho na **linha 2** e
mapeia 11 colunas sem nenhuma configuração:

| campo | coluna na planilha | cabeçalhos também aceitos |
|---|---|---|
| `id` | `ID` | SKY, JOB, CODIGO, COD, OS, N OS, NUMERO |
| `data` | `DATA` | DATA DE ENTRADA, EMISSAO, DT |
| `cliente` | `CLIENTE` | |
| `produto` | `PRODUTO` | |
| `projeto` | `PROJETO` | |
| `minutagem` | `MINUTAGEM` | MIN, DURACAO, TEMPO |
| `veiculacao` | `VEICULAÇÃO` | VEIC |
| `locutor` | `PRODUTORA/LOCUTOR` | LOCUTOR, PRODUTORA, FORNECEDOR |
| `status` | `STATUS` | |
| `valor` | `VALOR` | VALOR TOTAL, PRECO, CACHE |
| `liberado` | `LIB. P/ PAGAMENTO` | LIBERADO, LIB |
| `empreendimento` | *(não existe)* | EMPREENDIMENTO, EMPREEND |
| `categoria` | *(não existe)* | CATEGORIA |

Acento, maiúscula e pontuação não contam: `VEICULAÇÃO` casa com `VEICULACAO` e
`PRODUTORA/LOCUTOR` com `PRODUTORA LOCUTOR`. O casamento exato vem primeiro; só
depois aceita "começa com", que é como `LIB. P/ PAGAMENTO` casa com `LIB`.

`empreendimento` e `categoria` não existem na planilha e **não fazem falta** — o
documento da OS não usa esses dois campos. Os que ele usa de verdade são `id`,
`data`, `cliente`, `produto`, `locutor` e `valor`, todos mapeados.

Se um dia um cabeçalho mudar e deixar de casar, mapeie à mão em vez de renomear
a coluna:

```json
{
  "columns": { "locutor": "Produtora / Locutor", "valor": "Cachê negociado" }
}
```

## O que o módulo faz com os dados

Três coisas que vêm do formato da planilha, não de teoria:

- **Traço não é valor.** Célula vazia é preenchida com `-------------`. Em 62
  das 109 linhas o campo VALOR é assim. Uma célula só de traços vira vazia, e a
  OS cai no `R$ 0,00`.
- **Quebra de linha é diagramação.** `QUINTA DAS\n MANGUEIRAS` existe para caber
  na coluna; sem colapsar, a quebra reapareceria no meio do campo "Projeto" da
  OS. Espaços repetidos e quebras viram um espaço só.
- **Um `#SKY` pode ocupar duas linhas** — entregas diferentes do mesmo job
  (LANÇAMENTO e TRAJETO, IMERSIVO ESPANHOL e INGLÊS). São 5 casos hoje. A
  planilha repete cliente, produto e locutor e põe o valor só na primeira; entre
  as linhas que casam, fica **a que tem valor**.

### Como o `#SKY` é comparado

`#SKY171-B`, `sky 171 b` e `SKY171B` viram todos `SKY171B` — o operador digita
do jeito que vier à cabeça. A mesma regra vale para o que está na planilha, dos
dois lados da comparação. `#SKY171` e `#SKY171-B` continuam sendo jobs
diferentes.

## Conferir

Na aba Produções, uma busca que falha mostra **"ver o que o servidor enxerga da
planilha"**. É o `GET /api/os/sheet-status`: diz se a configuração está
completa, em que linha achou o cabeçalho, quantas linhas de job existem, quais
colunas foram mapeadas e a lista de cabeçalhos como estão na planilha. É por ali
que se descobre um cabeçalho que parou de casar.

O servidor guarda a planilha em cache por **60 segundos** — uma alteração feita
agora aparece no próximo minuto.

Se a planilha for fechada, o Google passa a responder a página de login em HTML
em vez do CSV, com status 200. O módulo detecta isso e diz exatamente
`A planilha não está mais aberta para leitura` — sem essa checagem, o HTML seria
lido como CSV e a busca diria só "nenhum job com esse código", mandando procurar
o erro no lugar errado.
