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

## [etapa-C6c] Painel em cartões, avisos de "sem linha", Doppler, opção dentro de opção, listas, TI-RADS pelo texto — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Painel de calculadoras em cartões recolhíveis. O cabeçalho é um botão com seta e um selo de estado ("2 ativos"). O aberto/fechado de cada cartão fica guardado neste navegador.
- "Cálculo no laudo": cada cálculo é uma linha com liga/desliga, um ⓘ (fórmula e fonte só no tooltip) e um estado curto:
  - "linha encontrada no laudo";
  - "sem linha correspondente no laudo";
  - "preencha a IG relatada";
  - "desligado".
  O texto longo de fórmulas saiu do painel.
- Volume: a fórmula não mudou. Com o banco real, funciona onde há uma linha de 3 medidas e a linha de volume (ex.: útero). Na tireoide (dois lobos + istmo) não calcula, de propósito: a soma dos lobos não foi aprovada e o caso é ambíguo; o painel agora avisa. Índice esplênico: a frase do banco não tem as medidas, e o painel avisa.
- IG pelo PFE: vem desligada e o banco não tem a frase. O painel diz isso.
- Doppler:
  - rótulo "Doppler: relação umbilical/cerebral média e RCP";
  - o painel mostra AU/ACM e ACM/AU ao vivo;
  - um seletor inverte a ordem na própria linha "Relação" ("IP cerebral média / IP umbilical", V.R. "> 1") e o valor acompanha;
  - números com até 2 casas, sem zeros finais (0,5; 1; 1,05).
- Editor (`js/ui.js`):
  - opção com campos dentro: o foco vai ao primeiro campo interno (lista aberta), e Enter/Tab seguem em ordem;
  - escolher com o mouse deixa aberta a lista do próximo campo (antes o mesmo clique a fechava);
  - com um campo de opção destacado, Seta para baixo ou Enter abrem a lista;
  - a opção sob o mouse ou o teclado tem destaque forte (azul com texto branco).
- TI-RADS pelo texto: as 5 opções da frase "Observa-se nódulo ..." viram os mesmos pontos ACR da C6, e o número entra em "TI-RADS ___" (1 a 5). "Tipo cauda de cometa" conta 0 ponto e "irregulares" conta 2, como "lobuladas". Valor digitado à mão é respeitado.
- Testes: test/c6c_test.py, 34/34 (2/34 na C6b). As expectativas da c5/c6b passaram ao novo formato sem zeros finais.

## [etapa-C6b] Correção: editar um campo já preenchido — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Bug relatado: ao editar um valor já preenchido (ex.: DBP), o campo virava texto comum e o cálculo (PFE etc.) sumia. O bug já existia antes da etapa C (D3c cb2856d): vem do editor (Chromium/Edge), não dos módulos de cálculo. Os cálculos só deixavam o efeito visível.
- Causas:
  - ao trocar ou apagar todo o texto do campo, o navegador remove o `<span class="fld">`;
  - o duplo clique só seleciona até a vírgula ou o ponto;
  - com o cursor na borda do campo (clique no primeiro ou no último dígito), o que se digita fica fora do campo.
- Correção, só em `js/ui.js` (editor):
  - duplo clique num campo preenchido seleciona o valor inteiro;
  - uma seleção que cobre o valor inteiro (também arrastando a partir de fora do campo) passa a ficar dentro do campo antes de digitar ou colar;
  - apagar o último caractere com Backspace ou Delete devolve o placeholder ao campo, e ele fica selecionado;
  - um dígito ou "," "." digitado na borda de um campo numérico preenchido entra no campo.
- Teste automático: test/c6b_test.py, 61 verificações. Na C6 (38e7ed4) passam 30/61, na D3c 24/61, e com a correção 61/61.

## [etapa-C6] Calculadora ACR TI-RADS (tireoide) — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Novo `js/calc-tirads.js` (`UFTirads`), com a seção "TI-RADS (ACR 2017)" no painel e o botão "Adicionar nódulo". Cada nódulo tem seu próprio painel, que pode ser recolhido ou removido. Os nódulos ficam só na sessão.
- Fonte dos pontos, níveis e cortes: Tessler et al., ACR TI-RADS White Paper, JACR 2017;14:587-595. O texto de saída copia o protótipo do Dr. Renato (xlsx): 6 linhas "Rótulo: valor".
- Espongiforme vale 0 no total (TR1): as outras categorias ficam desativadas e há aviso na tela. Composição indeterminável por calcificação vale 2 e fixa a ecogenicidade em 1 ponto, como manda o artigo. Margem indeterminável vale 0. Em focos ecogênicos, "Nenhum" desmarca os outros.
- Total ≤1 conta como TR1, como no protótipo. O artigo não tem nível para 1 ponto.
- O tamanho só gera um destaque no painel, sem linha nova no laudo. Cortes: TR3 PAAF ≥25 mm e seguimento ≥15 mm; TR4 15/10 mm; TR5 10/5 mm.
- "Inserir no laudo" põe um cabeçalho e as 6 linhas abaixo da linha do cursor salvo. Sem cursor no laudo, o bloco vai para o fim, com aviso. Um Ctrl+Z desfaz o bloco inteiro.
- Para inserir, `js/ui.js` ganhou `window.UFInsertLines(lines)`, que reaproveita `insertBlock` e a pilha de desfazer de uma vez (D3). O resto do ui.js não mudou.
- Teste automático: test/c6_test.py (2000 combinações conferidas contra um cálculo independente em Python).

## [etapa-C5] Doppler: relação IP umbilical / IP cerebral média e RCP — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Novo `js/calc-dop.js` (`UFCalcDop`), com a caixa "Doppler: IP umbilical/cerebral média e RCP" no painel (ligada).
- Lê o IP digitado logo abaixo de "Artéria Umbilical:" e de "Artéria Cerebral Média:". IP de artérias uterinas e IR não entram na conta. Se houver mais de um IP para a mesma artéria, nada é calculado. Só feto único.
- Preenche "- Relação: IP umbilical / IP cerebral média = ___ (V.R.: < 1)." com IP AU ÷ IP ACM, 2 casas com vírgula. O "V.R.: < 1" não muda.
- RCP (IP ACM ÷ IP AU), só numa linha com "cerebroplacentária" ou "RCP" (o banco atual não tem). Se a linha tiver "(p5 para ___ semanas: ___)", preenche as semanas completas da IG relatada e o p5 de Ebbing 2007 (UOG 30:287, Tabela 5).
- **Interpolação declarada:** entre semanas inteiras, o p5 é interpolado linearmente por dia (ex.: 32s4d = p5(32) + (p5(33) − p5(32))·4/7). Fora de 21s0d a 39s0d, o p5 não é preenchido.
- " (abaixo do p5)" entra logo após o valor da RCP, num pedaço não editável, quando a RCP mostrada (2 casas) é menor que o p5 mostrado (2 casas). Some quando deixa de valer. Nenhuma linha nova é criada.
- Edição manual, desfazer/refazer e cursor: mesmo comportamento da C2/C3. Teste automático: test/c5_test.py.

## [etapa-C4] Percentis Hadlock ao lado de cada medida da biometria — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Pela IG relatada (painel, C1), entre 14s0d e 40s0d. Sem IG ou fora dessa faixa, nada aparece.
- DBP, CC, CA, CF: z = (medida em cm − média de Hadlock 1984) ÷ DP fixo (DBP 0,3 cm; CC 1 cm; CA 1,34 cm; CF 0,3 cm). As equações da Tabela III diferem da tabela no máximo 0,1 cm (DBP, CC, CF) e 0,2 cm (CA).
- PFE: z = (ln PFE − ln p50) ÷ 0,12, com ln p50 = 0,578 + 0,332·IG − 0,00354·IG² (Hadlock 1991), usando o valor mostrado no campo (calculado ou digitado).
- Percentil = Φ(z)·100 arredondado; abaixo de 3 mostra "<p3", acima de 97 mostra ">p97". Φ por série de Taylor (erro < 1e-15).
- Texto: "80 mm (p40)." e "1740 gramas (p17) (+- 15%)". O trecho fica num pedaço não editável depois de "mm"/"gramas". É trocado sem acumular quando a medida ou a IG mudam, e some se a medida ou a IG forem apagadas. Entra no texto copiado/impresso. Caixa "Percentis Hadlock" no painel (ligada).
- Teste automático: test/c4_test.py (referência independente em Python).

## [etapa-C3] Biometria fetal calculada no próprio laudo (PFE, IG composta, IG pelo PFE) — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Novo `js/calc-bio.js` (`UFCalcBio`), com caixas no painel "Cálculo no laudo": PFE (ligada), IG pela biometria composta (ligada), IG pelo PFE (desligada).
- Reconhece o bloco de biometria (DBP, CC/perímetro cefálico, CA, CF/comprimento femoral, cada um "___ mm", em qualquer ordem) e preenche só campos que já existem: "Peso fetal estimado em(:) ___ gramas" e "Biometria fetal composta ... equivalente a ___ semanas".
- PFE: Hadlock 1985 (4 parâmetros, cm), grama inteiro. IG composta: Hadlock 1984 (cm), mostrada como "32 semanas e 3 dias" ("dia" no singular para 0 e 1; arredonda ao dia mais próximo): o número vai no campo e " e N dias" entra logo depois da palavra "semanas" do texto.
- IG pelo PFE: inverso de Hadlock 1991 (raiz menor), a partir do PFE já arredondado mostrado no laudo; só entre 14 e 42 semanas, e só numa linha com "pelo peso fetal ... ___ semanas" (o banco atual não tem essa linha).
- Gemelar: blocos "BIOMETRIA FETAL A/B" (ou depois de "FETO A/B") ficam separados; "composta do feto A/B" usa o bloco certo; linha sem feto com dois blocos não é preenchida.
- Proteções técnicas (não são valores clínicos): medidas devem ser > 0; PFE só até 10.000 g e IG composta só entre 10 e 45 semanas, senão o campo fica em branco.
- Edição manual, mudança de medida e desfazer/refazer com o mesmo comportamento da C2. Teste automático: test/c3_test.py.

## [etapa-C2] Volume e índice esplênico calculados no próprio laudo — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Novo `js/calc-vol.js` (`UFCalcVol`, registrado no painel como "Cálculo no laudo", com caixa para ligar/desligar nesta janela).
- Volume (elipsoide): L × AP × T × 0,523, medidas em mm, ÷ 1000 → cm³ inteiro. Só preenche um campo de volume que já existe ("volume ~ ___ cm³", "(~ ___ cm³)", "volume estimado em ___ cm³"), quando há exatamente 3 medidas "___ x ___ x ___ mm" na mesma frase, ou na linha imediatamente anterior se a linha do campo começa com "Volume". Duas linhas seguidas de medidas (ex.: lobos da tireoide) não são calculadas. Aceita vírgula ou ponto.
- Índice esplênico triplanar: C × L × E em cm → inteiro, só se a frase do índice tiver as 3 medidas antes do campo. O banco atual não tem essas medidas na frase do índice, então nada é calculado ali (aguardando orientação).
- Medida apagada: o volume calculado volta ao campo vazio. Volume digitado à mão é mantido até alguma medida mudar. Desfazer/refazer continuam funcionando (o volume acompanha as medidas).
- Teste automático: test/c2_test.py.

## [etapa-C1] Painel de calculadoras, calculadora livre e IG relatada — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Novo `js/calc.js` (namespace `UFCalc`): o painel lateral direito ("Calculadoras") ganhou conteúdo; botão discreto "±" na barra (antes de "Limpar") abre/fecha o mesmo painel (mesma preferência do botão do próprio painel).
- Calculadora livre: só + − × ÷, vírgula na exibição (aceita vírgula ou ponto), teclado na tela e teclado físico com a calculadora focada (0-9 , . + - * / Enter, Backspace, Esc limpa). Contas em sequência são feitas da esquerda para a direita (2 + 3 × 4 = 20). Divisão por zero mostra "erro". Até 10 dígitos significativos, sem zeros à direita e sem notação científica.
- IG relatada: semanas (0–45) e dias (0–6); valor só na janela atual (não é gravado). Para módulos futuros: `UFCalc.getIgRelatada()` (total em dias ou null), `UFCalc.onIgChange(fn)`, `UFCalc.register({id, title, build})`.
- Usar o painel não move o cursor do laudo. Nenhuma fórmula clínica nesta entrega. Banco de frases e gravação de arquivos sem mudança.
- Teste automático: test/c1_test.py.

## [etapa-D3c] Clique no meio do campo em branco substitui o campo inteiro — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Clicar com o mouse em qualquer ponto de um campo em branco (número, decimal, texto), inclusive nas bordas, seleciona o campo todo; digitar "50" resulta em "50" (antes ficava "_50_"). Campos já preenchidos continuam editáveis no ponto do clique.
- Teste automático: test/d3c_test.py.

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
