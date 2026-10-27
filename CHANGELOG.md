# Histórico de mudanças — Ultra Formulário

Editor de laudos de ultrassonografia (HTML/JS estático, ES5, sem dependências).
O banco de frases **nunca** faz parte do repositório.

> Marcadores de rodada: o conector usado para publicar não cria tags git, e as
> rodadas anteriores a este repositório não têm commit próprio. Cada rodada
> abaixo tem um marcador `[etapa-XX]` que faz o papel de tag. O primeiro backup
> publicado (estado B25) está nos commits iniciais de `main`; D1 entra nos
> commits seguintes.
>
> Descrições de B15–B20 são um resumo a partir dos registros disponíveis.

## [etapa-D3b] Final de linha CR preservado no editor do banco — entregue, NÃO testado pelo usuário
- Editor do banco: banco que usa só CR como quebra de linha continua só CR ao salvar (antes virava CRLF).
  CRLF e LF continuam como antes; texto sem quebras continua ganhando CRLF.
- Trocar arquivo, Importar, pasta de dados e cópias de segurança já gravavam o banco byte a byte (sem mudança).
- Testado só em Chromium automatizado (`test/d3b_test.py`).

## [etapa-D3] Correções da revisão completa — entregue, NÃO testado pelo usuário
- Configurações entre abas: fechar sem salvar volta ao que está salvo (não a uma cópia antiga); Salvar grava
  só o que foi mudado naquela janela; a pré-visualização do tema não some quando outra aba salva.
- Importar com pasta de dados: a página só recarrega depois de o banco importado estar gravado na pasta.
- Editor do banco: salvar sem mudança não cria cópia de segurança; mantém o final de linha do arquivo
  (CRLF/Windows se o original era CRLF ou não tinha quebras; LF se era LF).
- Desfazer: cada frase inserida (com a linha de hipótese, se houver) sai com um único Ctrl+Z (ou o botão
  Desfazer), sem deixar linha em branco; Ctrl+Y refaz.
- Revisão: depois de revisar as linhas críticas, "Copiar/Imprimir/Gerar assim mesmo" fica disponível na
  mesma janela (continua bloqueado enquanto houver crítica pendente).
- Linha crítica: alterar o texto NÃO conta como revisada; só "Confirmar" na revisão. Alterar uma linha já
  confirmada faz ela voltar a ficar pendente.
- Pasta lenta (mais de 4 s para ler): o app abre com a cópia do navegador e atualiza a tela quando a leitura
  termina; o que foi mudado nesse meio-tempo é mantido e gravado na pasta.
- Navegador sem espaço: a alteração fica nesta janela (e na pasta de dados, com o valor novo); aviso discreto.
- "Escolher pasta", "Reconectar" e "Apagar rascunhos" salvam as configurações antes de agir.
- "Apagar rascunhos": outra aba aberta deixa de regravar o rascunho dela; o laudo continua na tela dessa
  aba com uma barrinha de aviso e volta a ser guardado só se for editado de novo.
- Testes: `test/d3_test.py` (banco genérico embutido; pasta simulada `test/fakefs.js`).
- Não testado pelo usuário: tudo da D3. Testado só em Chromium automatizado (headless), com pasta de dados
  simulada; Edge, IE11, pendrive real e impressora não testados.

## [etapa-D2] Configurações com Salvar, histórico de pesquisa, editor do banco, ordem das diretivas — entregue, NÃO testado pelo usuário
- Configurações: botões "Salvar alterações" e "Cancelar", sempre visíveis no rodapé.
  Fechar pelo X, por Esc ou clicando fora **descarta** as mudanças; enquanto há
  mudança aparece "Alterações não salvas" e o botão Salvar fica destacado.
  O tema é só pré-visualizado até salvar. Botões de ação dentro da janela
  (Trocar arquivo, Editar banco, Relatório, Armazenamento) salvam antes de agir.
- Pesquisa: o texto digitado já era lembrado (recarregar/abas/reinício: confirmado
  no Chrome real); corrigido um defeito real entre abas (uma aba sobrescrevia o
  texto pesquisado na outra). Novo histórico por campo (exames, modelos, frases,
  laudo): o termo entra ao confirmar (Enter, sair do campo, escolher resultado),
  cada termo tem "x", ordem = último pesquisado no topo e depois frequência.
- "Ordenar por frequência de uso" (modelos): o modelo usado por último em cada
  exame fica no topo; os demais por frequência.
- Editor do banco dentro do app (Configurações › Banco de frases › Editar banco):
  números de linha, "Ir para a linha" (Ctrl+G), Ctrl+S, Salvar (cópia de
  segurança do banco anterior, recarrega e revalida), Cancelar, aviso de
  alterações não salvas. Cada item do relatório de inconsistências tem "editar"
  que abre o editor na linha.
- Diretivas: várias @@SUBSTITUI/@@ABAIXO_DE na mesma frase ou seção agora valem
  na ordem escrita (de cima para baixo): vale a primeira cujo alvo existe
  (antes valia a última). Precedência frase > seção > genérico mantida.
  Palavras reservadas documentadas: "TOPO" e "Relatório" (sem linha "Relatório…"
  no modelo = logo abaixo do título). O aviso DIRECTIVE_DUPLICATE virou informativo.
- Relatório de inconsistências: TITLE_LIKE_IN_BODY ("linha terminada em ':'
  colada ao texto") não é mais listado nem contado (o parser continua gerando).
- Testes: `test/placement_test.py --diretivas` (banco genérico embutido).

## [etapa-D1] Armazenamento em pasta (pendrive) — entregue, NÃO testado pelo usuário
- Nova "Pasta de dados" (Configurações › Armazenamento), escolhida uma vez pela
  File System Access API (Chrome/Edge). Arquivos comuns na pasta:
  `banco-de-frases.txt`, `configuracoes.json`, `dados.json`, `rascunhos/`,
  `backups/` (últimos 10 bancos).
- Banco carregado sozinho da pasta ao abrir; "Trocar arquivo" grava o novo banco
  byte a byte e guarda o anterior em `backups/`.
- Edição externa do banco detectada ao voltar à janela: barrinha
  "Banco de frases alterado fora do app — Recarregar" (sem diálogo).
- Permissão perdida (reinício do navegador): barrinha "Reconectar" (um clique);
  o app continua funcionando com a cópia do navegador.
- Sem a API (Firefox, IE11) ou "Usar só o navegador": localStorage como antes,
  com Exportar/Importar (.json com banco e configurações, sem rascunhos).
- "Apagar rascunhos" (rascunhos de outras abas; o laudo aberto fica).
- Isolamento de rascunho por aba (B21) e sincronização de configurações mantidos.
- Novo `js/folder.js`; `js/store.js` ganhou ganchos de gravação; `ui.js` passa a
  iniciar depois da leitura da pasta (`UFolder.boot(UFMain)`).
- Por quê: levar banco, configurações e rascunhos no pendrive entre computadores.

## [etapa-B25] Tema escuro
- Claro / Escuro / Seguir o sistema (padrão Claro), aplicado na hora, salvo e
  compartilhado entre abas. Todas as telas tematizadas, contraste WCAG AA.
- A folha do laudo continua branca; opção "Laudo escuro também" (desligada).
- Impressão e cópia sempre claras; IE11 cai no tema claro.

## [etapa-B24] Barras compactadas
- Barra de formatação, Copiar/Imprimir/Gerar e pesquisa unificadas numa só faixa
  no topo; mais altura útil para o laudo. Botões grandes do diálogo de revisão e
  a seta de inserir mantidos.

## [etapa-B23] Todas as saídas passam pela revisão
- Imprimir, Ctrl+P, Gerar e Copiar usam a mesma revisão obrigatória de linhas
  críticas e campos vazios. Menu de impressão do navegador: proteção por CSS de
  impressão (o conteúdo é ocultado e aparece um aviso enquanto há pendências).

## [etapa-B22] Pesquisa e correção de remoção em grupo
- Botão "x" para limpar todos os campos de pesquisa (Esc também limpa); texto
  pesquisado lembrado entre navegação, recarga e abas.
- Corrigido: remover um grupo de linhas críticas apagava também as linhas
  seguintes. Remoção passou a ser feita direto no documento, com desfazer.

## [etapa-B21] Abas, navegação por Tab e relatório de inconsistências
- Cada aba com seu próprio rascunho; configurações e banco sincronizados ao vivo.
- Tab / Shift+Tab percorrem todos os campos, com ou sem menu aberto.
- Relatório de inconsistências do banco agrupado por gravidade e tipo, com linha,
  caminho e "Copiar como texto".

## [etapa-B20] Revisão em grupo
- Linhas críticas consecutivas revisadas como um único item; a assinatura
  automática é um grupo próprio.

## [etapa-B19] Frases que entram sempre e inserção
- Instrução `@@SEMPRE` (ex.: assinatura) inserida automaticamente no modelo.
- Seta de inserir no cartão aberto; botão de inserir no topo; dica de instruções.

## [etapa-B18] Posicionamento de frases
- Ajustes de `@@SUBSTITUI` / `@@ABAIXO_DE` testados no Chrome real; seção
  posicionada corretamente quando o alvo está no topo.

## [etapa-B17] Instruções de posicionamento e bloqueio de cópia
- Frases substituem a linha indicada do modelo; opção de bloquear cópia fora do
  botão Copiar.

## [etapa-B16] Configurações e arrastar
- Configurações alinhadas; arrastar texto dentro do laudo (opção).

## [etapa-B15] Laudo
- Sublinhar o título da hipótese diagnóstica (opção); seções sem rótulo; busca
  global; bloqueio de cópia.

## Não testado pelo usuário
Tudo desde o início da etapa D foi entregue sem teste do usuário:
- D3 (tudo): ver a entrada [etapa-D3]. Os 2 itens da D1 em tema escuro ("Reconectar com um clique",
  "Apagar rascunhos") foram reverificados em teste automático com tema escuro fixo e passaram.
- D2 (tudo): Salvar/Cancelar nas Configurações, histórico de pesquisa, ordem por
  frequência com último no topo, editor do banco (inclusive salvar na pasta de
  dados com backup), ordem das diretivas e "TOPO"/"Relatório", ocultação de
  TITLE_LIKE_IN_BODY. Testado só em Chrome automatizado (headless e com janela,
  perfil persistente), não no PC do usuário; Edge e IE11 não testados.
- D2, editor do banco: salvar grava o texto em UTF-8 (se o arquivo original
  era ANSI/Windows-1252, ele passa a ser UTF-8). Desde a D3 o final de linha original é mantido.
- D2: o defeito "a pesquisa não persiste" relatado não foi reproduzido no Chrome
  automatizado; só foi corrigida a sobrescrita entre abas.
- D1, pasta de dados: janela real de escolher pasta; pendrive de verdade
  (inclusive retirá-lo com o app aberto); Microsoft Edge; permissão depois de
  reiniciar o Chrome; usar o mesmo pendrive em dois computadores.
- D1, testes automáticos: na variante tema escuro, 2 itens falharam
  ("Reconectar com um clique" e "Apagar rascunhos"). Foram atribuídos ao próprio
  teste (ele força o tema a cada recarga), mas **não foram reverificados**.
- D1: Exportar/Importar e "Usar só o navegador" só em teste automático.
- IE11: nunca testado em IE11 real (só o caminho sem a API foi simulado).
- B23: Ctrl+P e menu de impressão com teclado/impressora física.
