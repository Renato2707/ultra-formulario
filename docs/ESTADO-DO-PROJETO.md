# Estado do projeto

| Etapa | Conteúdo | Situação |
|---|---|---|
| A | Parser do banco de frases (.txt com instruções `@@`/`##`) | Concluída |
| B | Interface de 3 colunas (rodadas até B25) | Concluída |
| C | Calculadoras (painel lateral). C1: painel, calculadora livre e IG relatada; C2: volume e índice esplênico em tempo real; C3: biometria fetal (PFE Hadlock 1985, IG composta Hadlock 1984, IG pelo PFE Hadlock 1991) | C1 (painel, calculadora livre, IG) C2 (volume e índice esplênico no laudo) C3 (biometria fetal: PFE, IG composta, IG pelo PFE) C4 (percentis Hadlock pela IG relatada) C5 (Doppler: relação AU/ACM e RCP com p5 de Ebbing 2007) C6 (ACR TI-RADS por nódulo, inserção no laudo) C6b (correção: editar campo preenchido) e C6c (painel em cartões, avisos, Doppler invertível, opção dentro de opção, TI-RADS pelo texto) e C6d (volume da tireoide = soma dos lobos) e C6e (painel limpo com ponto de estado, laudo colado com campos, TI-RADS unificado com as 6 linhas após o nódulo) entregues; em uso diário pelo usuário; C7 (BI-RADS US) entregue |
| D | Armazenamento em pasta/pendrive (D1); Salvar nas configurações, histórico de pesquisa, editor do banco, ordem das diretivas (D2) | D1 e D2 entregues; em uso diário pelo usuário |
| D3 | Correções da revisão completa (abas, importar, backups, desfazer, revisão de críticas, pasta lenta, navegador sem espaço, final de linha, rascunhos) | Entregue; em uso diário pelo usuário |
| D3b | Editor do banco mantém final de linha só CR | Entregue; em uso diário pelo usuário |
| D3c | Clique no meio do campo em branco substitui o campo inteiro | Entregue; em uso diário pelo usuário |
| C6k | TI-RADS: 6 linhas no lugar das 5 antigas, abaixo do título; recomendação única do nódulo de maior pontuação (empate: o primeiro); espongiforme dispensa as demais características (painel e laudo); avisos do ACR e de combinações incoerentes no painel | Entregue; em uso diário pelo usuário |
| C6l | TI-RADS: verificação exaustiva (4.000 combinações; totais 0–17 todos atingíveis; total 1 fora da tabela ACR, tratado como TR1) e 114+7 casos no laudo real; só testes, sem mudança de código | Entregue; em uso diário pelo usuário |
| C6m | Painel TI-RADS sem textos de aviso visíveis (extratireoidiana, misto, PAAF/tamanho, incoerências): só no title ao passar o mouse; travas e cálculo iguais | Entregue; em uso diário pelo usuário |
| C6n | Vários volumes por laudo (frases inseridas depois, ex.: teratoma), botão "Limpar" nas calculadoras, título da aba = modelo, sessões de abas ("Sessões") | Entregue; em uso pelo usuário, exceto as sessões de abas (só Chromium automatizado, **ainda não testadas no Edge**) |
| C6o | Templates intermediários (texto puro "___" e "a / b / c") reconhecidos ao colar; cartões "(padrão)" destacados; Tab/Enter na revisão vai a campos preenchidos; Editar banco gravado na pasta mesmo se ela estava desconectada | Entregue; em uso diário pelo usuário |
| C7 | BI-RADS de US de mama (v2025): cartão por achado, sugestão só com regra escrita do manual (senão "requer julgamento"), 4A/4B/4C obrigatório, categoria na frase, categoria final pela hierarquia 5>4>0>6>3>2>1 e legenda reduzida à linha da final; proposta de texto do banco (seção MAMAS) aguardando aprovação | Entregue; em uso diário pelo usuário |
| C7b | BI-RADS: descritores e bloco "mais" antes de localização/medidas, na ordem da frase; Enter acompanha o DOM | Entregue; em uso diário pelo usuário |
| C7a | BI-RADS: nódulo adicionado pela calculadora em parágrafo próprio, com a linha em branco do laudo (só se o laudo separa parágrafos assim); a linha some se o nódulo for apagado | Entregue; em uso pelo usuário. O teste automático `c7a_test.py` falha 11/17 (linha em branco / parágrafo próprio do nódulo): defeito conhecido do app, ainda não corrigido |
| C8 | Modelo em nova guia (`#ufmodel=<id>`, link nativo: botão direito / Ctrl+clique / clique do meio; clique esquerdo fica nesta guia). O cartão do exame abre o modelo padrão desse exame (o mesmo do duplo clique) noutra guia; o clique esquerdo só entra no exame. Seções sem frase ocultas no painel (vazias no banco ou zeradas pela pesquisa; recolhida com frases continua) | Entregue; em uso diário pelo usuário |
| C9 | Layout Opção B: sem a barra de cima; cada painel com o seu cabeçalho (mesmo cinza) e divisória de 8 px; abas Modelos e Frases; "trocar" volta aos exames; nomes de seção em frase (parênteses como no banco); botões no rodapé de cada painel | Entregue; em uso diário pelo usuário |
| C9b | Caixa do exame mostra o modelo carregado em até 2 linhas; clique nela recarrega o modelo do zero (link para nova guia); "trocar" fica separado; Limpar do laudo volta ao modelo em vez de deixar a página em branco | Entregue; em uso diário pelo usuário |
| C9c | Copiar, Imprimir e Gerar no cabeçalho do laudo (Gerar escuro); rodapé só com as pendências, e some quando não há | Entregue; em uso diário pelo usuário |
| C11b | Apagar linha crítica leva a marca junto; a marca não passa para a linha vizinha (o navegador juntava a linha de baixo na linha crítica); linha comum apagada acima de uma crítica não tira a marca; Ctrl+Z traz a marca de volta | Entregue; testada só em Chromium automatizado, **ainda não testada pelo usuário no Edge** |
| C11 | Escolha já feita no laudo é texto editável: Backspace/Delete apagam um caractere (antes apagavam a frase/linha inteira), Ctrl+Backspace uma palavra; clique ainda abre a lista; "escolher" e "___" iguais | Entregue; testada só em Chromium automatizado, **ainda não testada pelo usuário no Edge** |
| C10c | Abrir sessão: nunca em silêncio; 1ª aba no clique; se o navegador bloquear, um botão por modelo | Entregue; testada só em Chromium automatizado, **ainda não testada pelo usuário no Edge** |
| C10b | Salvar sessão: só abas realmente abertas (ping via storage); nomes sem repetir; caixas para desmarcar um modelo | Entregue; testada só em Chromium automatizado, **ainda não testada pelo usuário no Edge** |
| C10 | Sessões: uma aba por modelo salvo; salvar inclui as abas de fundo (timer atrasado no Edge); hash lido pelo href e fila de reserva se o hash se perder no file:// | Entregue; testada só em Chromium automatizado, **ainda não testada pelo usuário no Edge** |
| C9d | "trocar" na linha do rótulo EXAME; a caixa do nome usa a largura do painel e mostra o nome inteiro, sem corte | Entregue; em uso diário pelo usuário |
| C6p | Template intermediário com "*" no lugar do campo (escolhas "a / b / c"); colar reconhece "*", número no lugar, "___" antigo e tolera erros comuns (asterisco ao lado do valor, espaços, unidade repetida/faltando, caixa, "a / b", escolha apagada) | Entregue; em uso diário pelo usuário |
| C6j | Escolha múltipla pelo teclado (Enter marca, Tab/"Pronto" confirma), Enter-para-próximo no painel, 6 linhas do TI-RADS no lugar das 5 antigas | Entregue; em uso diário pelo usuário |
| C6i | Escolha múltipla: começo comum das opções escrito uma vez | Entregue; em uso diário pelo usuário |
| C6h | Escolha múltipla `?+[ ]` no banco (TI-RADS soma todos os focos) | Entregue; em uso diário pelo usuário |
| C6g | TI-RADS: 6 linhas editáveis/apagáveis, sem o veredito de tamanho | Entregue; em uso diário pelo usuário |
| C6f | Pasta de dados: repete gravações que falham, religa sozinha, rascunhos a cada 5 s, uma aba grava por vez | Entregue; em uso diário pelo usuário |
| Testes | Um comando (`python test/run_all.py` / `run_tests.bat`) roda todos os testes de `test/` e imprime o resumo. Sem caminhos fixos; bancos de exemplo com modelos `X (padrão)` | Entregue (só Chromium automatizado), **não testado pelo usuário** |
| R1 | `js/ui.js` dividido em 14 arquivos por função (`js/ui.js` + `js/ui-*.js`), refatoração pura: mesmo comportamento, mesma tela; `<script>` comuns no `index.html`, sem módulos | Entregue; suíte completa idêntica antes/depois (só Chromium automatizado) |
| E, F | — | Não definidas nos registros disponíveis |

## Regras
- Texto clínico do banco nunca é alterado pelo app.
- ES5 estrito, sem dependências, funciona abrindo o `index.html` direto do
  computador, menos de 1 MB; IE11 deve abrir (com recursos reduzidos).
- Calculadoras (etapa C): as fórmulas e valores de referência **devem vir do
  médico responsável pelo projeto**; nada é inventado.
- TI-RADS: baixa prioridade.
- BI-RADS: só critérios do manual ACR BI-RADS v2025 (proposta aprovada); sem pontuação; a categoria é do médico.
- Repositório público: nada de banco, capturas ou dados de pacientes.

## Próximos passos
- Testar no Edge as sessões de abas (C6n, C10, C10b, C10c) e a C11/C11b: até agora só testes automáticos em Chromium. O resto do app está em uso diário pelo Renato.
- Corrigir a C7a: o teste `c7a_test.py` falha 11/17 (o nódulo inserido não fica em parágrafo próprio com a linha em branco).
- BI-RADS (C7): o Renato aprovar o texto proposto da seção MAMAS antes de ir ao banco (frase de nódulo com "BI-RADS-US *", legenda v2025, papila, LxAPxT).
- Reconhecimento de laudo colado: só linhas iguais às do banco (com valores no lugar dos campos) viram campos; não há importação de arquivo (.doc/.pdf).
- RCP: o banco não tem linha; texto sugerido "- Relação cerebroplacentária (RCP): IP cerebral média / IP umbilical = *,* (p5 para * semanas: *,*)." (o médico decide se acrescenta).
- IG pelo PFE: o banco não tem linha de saída; texto sugerido "Idade gestacional estimada pelo peso fetal: * semanas." (o médico decide se acrescenta).
- Índice esplênico: o banco precisa ganhar as 3 medidas (C x L x E, em cm) na frase do índice para o cálculo funcionar; aguardando orientação do médico.
- Etapa C (entregas 6 e 7: TI-RADS e o que mais for definido) quando as fórmulas forem enviadas; cada uma entra como módulo `UFCalc.register(...)`.
