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

## [etapa-C8] Modelo em nova guia e seções sem frase ocultas — testado só em Chromium automatizado, NÃO testado pelo usuário
- Cartão de modelo (e o nome do modelo no caminho do painel) virou um link. Clique esquerdo continua carregando o modelo nesta guia, sem recarregar a página. Botão direito → "Abrir em nova guia", Ctrl+clique e clique do meio usam o menu/gesto nativo do navegador.
- A nova guia abre o mesmo `index.html` com o hash `#ufmodel=` + id do modelo (`b:<exame>|<template>` ou o id do modelo do usuário), codificado com `encodeURIComponent`. Funciona em `file://` (hash relativo, sem servidor) e no IE11. Ao carregar, o app aplica esse modelo numa aba nova (não reaproveita o laudo de outra aba) e tira o hash do endereço, para um recarregamento não descartar o que foi digitado. O esquema antigo das sessões (`#ufopen=<nome>&uford=<ordem>`) permanece.
- Painel de frases: seção com zero frases não aparece — seção vazia no banco e seção que ficou sem frase por causa da pesquisa. Seção que tem frases continua na lista mesmo recolhida.
- Testes: `test/c8_test.py`.

## [etapa-C7b] BI-RADS: campos na ordem da frase do banco — testado só em Chromium automatizado, NÃO testado pelo usuário
- Ordem visual/DOM e Enter: tipo, descritores, calcificações e campos específicos, bloco "mais" (continua recolhido), localização, distâncias, medidas e categoria/Inserir.
- Sem campos ou textos novos, mudanças nas regras clínicas ou nas frases do banco.
- `test/c7_test.py`: navegação Enter atualizada e ordem DOM visível do nódulo conferida explicitamente.


## [etapa-C7] Calculadora BI-RADS de ultrassom de mama (ACR BI-RADS v2025) — testado só em Chromium automatizado, NÃO testado pelo usuário
- Novo cartão "BI-RADS US (ACR v2025)" no painel (`js/calc-birads.js`), no padrão do TI-RADS: "+ adicionar nódulo" cria um cartão por achado; cartões colapsam num resumo ("Nódulo 2 – MD 10h – 12 mm – BI-RADS 3") com ponto verde (pronto) ou cinza; Enter passa ao próximo campo e, no último, insere; "Limpar" volta a um cartão vazio.
- Campos na ordem do léxico: tipo (nódulo, cisto simples, cisto complicado, microcistos agrupados, linfonodo intramamário, lesão não nodular, abscesso, achado benigno conhecido), mama, quadrante, horário, distância da papila, distância da pele, L × AP × T, forma, orientação, margem, padrão ecogênico, características acústicas posteriores, calcificações. Bloco "mais" (recolhido): características associadas, vascularização, elastografia e componente de tecido glandular.
- Sem pontuação. Sugestão de categoria só onde o manual tem regra escrita (cisto simples com as 4 características, microcistos, cisto complicado isolado/múltiplos, nódulo sólido oval circunscrito paralelo hipoecogênico sem outra característica, múltiplos bilaterais semelhantes, linfonodo tipicamente benigno, achado benigno da categoria 2, abscesso, lesão não nodular, biópsia maligna); regra e página só no title. Nos demais casos aparece "requer julgamento". Sugestão 2, 3 ou 6 preenche a categoria até o médico escolher outra; 4 exige 4A/4B/4C (não há "4" puro).
- A frase vem do banco (frase com "BI-RADS-US *"): os marcadores recebem os valores do cartão e a categoria do achado vai no próprio "BI-RADS-US". A frase em branco do modelo é preenchida; os achados seguintes entram logo depois do último.
- Categoria final do exame pela hierarquia do manual 5 > 4 > 0 > 6 > 3 > 2 > 1 (empate: o primeiro do laudo), escrita em "Classificação: BI-RADS-US" (valor digitado à mão é respeitado); da legenda "Categoria 0 … 6" fica só a linha da categoria final (conduta única); sem categoria, a legenda volta inteira. Opção "Categoria final pelo laudo" liga/desliga.
- Laudo colado: "BI-RADS-US 4A/4B/4C" é reconhecido (também com "*" esquecido, espaço e minúscula). Campo BI-RADS com valor fora de 0, 1, 2, 3, 4A, 4B, 4C, 5, 6 fica marcado (title explica) e não entra na categoria final.
- `js/ui.js`: `UFInsertHtml` aceita a linha onde inserir; reconhecimento e checagem do campo BI-RADS. Banco real não alterado: proposta do trecho MAMAS fora do repositório, para aprovação.
- Testes: `test/c7_test.py` (120 verificações com o banco de teste; com `UF_BANCO=<cópia do banco com a proposta>` usa o banco).

## [etapa-C6p] Template intermediário com "*" no lugar do campo; colar tolera erros das assistentes — testado só em Chromium automatizado, NÃO testado pelo usuário
- O template intermediário (`UFTest.interText`) agora usa `*` em cada campo (número, número com vírgula e texto), em vez de `___`. Escolhas continuam "a / b / c". As marcações do banco (`*****`, `***`, `**`, `*,*`, `?[`, `@@`) não aparecem no texto.
- Ao colar: `*` ainda no lugar = campo em branco; número/texto no lugar do `*` = campo preenchido; `___` (C6o) e laudos já colados continuam reconhecidos.
- Tolerância a erros comuns: `*` deixado ao lado do valor (`*52`, `52*`, `* 52 *`), espaços a mais, vírgula ou ponto no decimal, opção escrita com MAIÚSCULAS/minúsculas diferentes. Se a linha não bate exatamente (unidade repetida ou faltando, duas opções deixadas "a / b", escolha apagada), o app tenta uma segunda leitura mais solta da mesma linha: o que estiver claro vira campo; o que tiver dúvida fica em branco / "escolher". Palavras digitadas que não são opção nem número ficam como texto (nunca são apagadas). Linha que não bate com nada continua texto simples; nada do resto do laudo é perdido.
- Sem texto novo na interface.
- Testes: `test/c6p_test.py` (55 verificações com o banco de teste; 117 com `UF_BANCO`); `test/c6o_test.py` ajustado para o `*`.

## [etapa-C6o] Templates intermediários (colar de outro sistema), cartões "(padrão)" destacados, Tab/Enter na revisão, Editar banco na pasta — testado só em Chromium automatizado, NÃO testado pelo usuário
- Laudo colado (C6e) também reconhece o "template intermediário" (texto puro, para outro sistema, sem `?[`, `*`, `@@`): lacuna `___` (qualquer quantidade de sublinhados) = campo vazio; escolha ainda não feita escrita como "a / b / c" (opções separadas por " / ", na ordem do banco) = lista vazia ("escolher"). Depois de preenchido no outro sistema (número no lugar do `___`, só a opção escolhida), o laudo colado volta com os campos preenchidos, como antes. O texto intermediário é gerado pelo próprio app a partir do banco (`UFTest.interText`); os 5 modelos ficam fora do repositório.
- Cartões cujo nome contém "(padrão)" (modelos e frases): borda esquerda na cor de destaque, sombra, título um pouco maior e mais espaço acima/abaixo, separando-os dos variantes. Só CSS + uma classe; nenhum texto novo.
- Revisão: com TODOS os campos preenchidos, Tab/Enter vão ao próximo campo do laudo (mesmo preenchido), com o conteúdo selecionado para sobrescrever; Shift+Tab volta. No último campo: Enter deixa o cursor depois dele e Tab sai do laudo (como antes). Com algum campo vazio, Tab/Enter continuam indo só aos vazios.
- Editar banco com a pasta de dados escolhida mas desconectada (pedindo permissão, pendrive fora, ainda lendo): antes o banco editado ficava só no navegador e, ao reconectar/abrir de novo, o da pasta (antigo) voltava por cima e a edição se perdia. Agora o banco editado (e o "Trocar arquivo") fica pendente e é gravado em `banco-de-frases.txt` (com backup do anterior) assim que a pasta volta; a leitura da pasta não o sobrescreve. Com a pasta conectada já gravava e recarregava (confirmado em teste). Sem pasta: igual.
- Testes: `test/c6o_test.py` (43 verificações com o banco de teste; com `UF_BANCO=<banco real fora do repo>` faz também os 5 modelos reais, sem imprimir conteúdo).

## [etapa-C6n] Vários volumes no laudo, "Limpar" nas calculadoras, título e sessões de abas — testado só em Chromium automatizado, NÃO testado pelo usuário
- Volume: cada frase com "* x * x * mm" e campo de volume ("(~ * cm³)", "volume de * cm³", ou "Volume ..." na linha seguinte) é calculada separadamente, inclusive frases inseridas depois (ex.: Transvaginal padrão com útero calculado + "Teratoma 1", dois teratomas, cisto). Causa do erro: a frase só era reconhecida se TODOS os campos dela fossem numéricos; o "?[direito|esquerdo]" do "Ovário ..." impedia o cálculo. Agora vale o último trio "# x # x # mm" antes do campo de volume; outros campos da frase não atrapalham. Fórmula sem mudança (elipsoide 0,523; tireoide = soma dos lobos, sem istmo; índice esplênico). Editar uma medida recalcula aquela frase.
- Calculadoras: botão "Limpar" no cabeçalho do painel: zera IG relatada, formulário do TI-RADS e a calculadora livre; o laudo não muda.
- Abas: o título da aba do navegador mostra o nome do modelo aberto (sem modelo: título original). Renomear à mão não existe (aba do navegador).
- Sessões: botão "Sessões" na barra de cima: "Salvar abas abertas…" (guarda, com um nome, os modelos das abas abertas na ordem em que foram abertas), clicar numa sessão abre uma aba por modelo na ordem (se a aba atual estiver vazia, ela recebe o 1º; com conteúdo, nada é apagado e todas vão para abas novas), "×" exclui (com confirmação). Modelo que não existe mais no banco é pulado. Guardado em `tabSessions` (dados.json da pasta de dados).
- Limitações: o navegador pode bloquear a abertura de várias abas de uma vez (aparece um aviso rápido; é preciso permitir pop-ups para o arquivo). Uma aba aberta há menos de ~5 s pode não entrar ao salvar a sessão. A sessão identifica o modelo só pelo nome (dois modelos com o mesmo nome: vale o primeiro).
- Testes: `test/c6n_test.py` (31 verificações).

## [etapa-C6m] Painel TI-RADS sem textos de aviso visíveis — testado só em Chromium automatizado, NÃO testado pelo usuário
- Saiu do cartão TI-RADS a linha cinza de avisos (C6k): extensão extratireoidiana/invasão óbvia, misto, indeterminável, espongiforme, combinações incoerentes (cístico/anecoico) e o corte de tamanho para PAAF/seguimento. O painel mostra só campos, "TRx · N pts", o botão "Inserir nódulo" e a opção "Calcular pelo texto do laudo".
- Essas explicações ficam apenas no title (passar o mouse) do resultado "TRx · N pts" e dos campos travados. Travas (espongiforme, indeterminável), cálculo e texto do laudo sem mudança.
- Testes: `test/c6k_test.py` ajustado (verifica que não há texto visível; avisos no title).

## [etapa-C6l] TI-RADS: verificação exaustiva das combinações (só testes, sem mudança de código) — testado só em Chromium automatizado, NÃO testado pelo usuário
- Todas as 4.000 combinações do cálculo (5 composições × 5 ecogenicidades × 2 formas × 5 margens × 16 subconjuntos de focos, incluindo "nenhum") conferidas contra a tabela ACR 2017: pontuação, categoria e as 6 linhas.
- Totais atingíveis: 0 a 17, todos. Nenhum total é impossível pela soma (focos somam 0–6 sem buraco; os outros itens completam até 17). Espongiforme trava em 0; mesmo só com combinações coerentes (cístico só anecoico, anecoico só cístico) todos os 18 totais continuam possíveis (cístico/anecoico: 0–12; sólido/misto: 2–17).
- Ponto a observar: a tabela do ACR 2017 não lista o total 1 (TR1 = 0, TR2 = 2). O total 1 existe (ex.: cístico + iso/hiperecogênico, ou cístico + macrocalcificação) e o código o classifica como TR1 (comportamento mantido; decisão do Renato).
- Laudo real: 114 casos (cada composição, cada ecogenicidade do texto, forma, margem, cada subconjunto de focos, 60 aleatórios, máximo 17) e 7 pares de 2 nódulos: pontuação, categoria, 6 linhas abaixo do título, recomendação única do maior, TI-RADS na frase, sem "escolher"/TI-RADS em branco/duplicação. Nenhum bug encontrado.
- Testes: `test/c6l_all_test.py` (493 verificações).

## [etapa-C6k] TI-RADS: 6 linhas no lugar das 5 antigas, abaixo do título; recomendação única — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- O título "Recomendação de acordo com o ACR:" fica; enquanto houver nódulo calculado, as 6 linhas aparecem exatamente no lugar das 5 antigas, logo abaixo do título (e não mais junto da frase do nódulo). Se nenhum nódulo ficar completo, as 5 antigas voltam no mesmo lugar (linhas editadas à mão ficam).
- Cada nódulo continua com o seu TI-RADS na própria frase ("TI-RADS ___"). A recomendação (as 6 linhas) aparece UMA só vez: a do nódulo de maior pontuação. Empate na pontuação: maior categoria (a categoria segue a pontuação, então é o mesmo critério); ainda empatado: o primeiro nódulo do laudo.
- Banco sem as 5 antigas: comportamento da C6j (linhas logo após a frase do nódulo), também com recomendação única.
- Laudo colado: formato C6k (6 linhas abaixo do título), C6j (6 linhas após o nódulo) e antigo (5 linhas) reconhecidos sem duplicar. Linhas editáveis/apagáveis (C6g) e soma de focos (C6h) mantidas.
- Espongiforme (ACR: "não adicione mais pontos para outras categorias"): no painel, ecogenicidade, forma, margem e focos ficam desativados e zerados (TR1 · 0 pts). No laudo, ao escolher "espongiforme" (pelo painel ou no próprio campo), a frase perde o trecho ", ecogenicidade, forma, margens …, focos" (fica "Observa-se nódulo espongiforme. Localizado …"), os outros campos não são exigidos e sai TI-RADS 1 / 0 pontos. Trocando a composição para outra, o trecho volta no mesmo lugar (guardado no atributo `data-esprest` da linha); voltando a espongiforme, encurta de novo.
- Regras de pontuação conferidas com o texto do ACR enviado pelo Renato: todas as pontuações coincidem. Divergência para o Renato decidir: com composição "indeterminável (calcificação)" o código também fixa a ecogenicidade em 1 ponto (nota da C6), o que o texto enviado não diz.
- Limitação: um laudo colado com a frase do espongiforme já encurtada não é reconhecido como nódulo (o reconhecimento só conhece a frase completa do banco).
- Painel: linha de avisos abaixo do resultado (pontuações não mudaram): espongiforme; composição indeterminável (ecogenicidade 1 ponto, campo travado); misto (pontuar o componente predominantemente sólido); extensão extratireoidiana = invasão óbvia (malignidade); corte de tamanho para PAAF/seguimento da categoria (tabela já existente: TR1/TR2 sem PAAF nem seguimento; TR3 PAAF ≥25 mm, seguimento ≥15 mm; TR4 15/10; TR5 10/5). Campos travados têm a explicação no título (passar o mouse).
- Combinações incoerentes pelas definições do ACR só AVISAM (não mudam a soma): cístico com ecogenicidade diferente de anecoico; anecoico com composição sólida ou mista; anecoico com focos que pontuam. Única trava: espongiforme.
- Máximo 17 pontos (2+3+3+3+1+2+3) é possível pela regra aditiva dos focos do ACR 2017; extensão extratireoidiana = 3 pontos.
- Composição indeterminável (calcificação): o painel escreve "indeterminado" na ecogenicidade (opção do banco) e, no laudo, a ecogenicidade em branco não impede o cálculo (conta 1 ponto, regra já existente); antes o TI-RADS ficava em branco.
- Testes: `test/c6k_test.py` (30 verificações).

## [etapa-C6j] Teclado da escolha múltipla, Enter no painel, 6 linhas do TI-RADS no lugar das 5 antigas — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Escolha múltipla `?+[ ]`: a lista abre com o foco na 1ª opção; setas cima/baixo andam pelas opções e pela linha "Pronto"; Enter ou Espaço marcam/desmarcam a opção em foco sem fechar; número marca direto. Confirmar: Tab (segue ao próximo campo), Enter na linha "✓ Pronto (Tab)" (segue ao próximo campo) ou clicar fora. Esc descarta as marcas. "sem …" continua exclusivo.
- Painel: cartão TI-RADS — Enter passa ao próximo campo (composição → ecogenicidade → forma → margem → terço → lobo → L → AP → T; pula campos desativados); Enter no T insere o nódulo como o botão (se completo). IG relatada: Enter em semanas vai a dias. Volume e biometria leem o laudo (não têm campos no painel).
- TI-RADS no laudo: as 6 linhas ("Pontuação: …", "Categoria TIRADS: …", "Nível de Risco: …", "Risco de Malignidade: …", "Recomendação de PAAF: …", "Sugestão de Acompanhamento: …") substituem as 5 linhas antigas do banco ("TI-RADS 1 (nódulo benigno): …" a "TI-RADS 5 (…): …"): enquanto houver nódulo calculado, as 5 antigas saem do laudo; se nenhum nódulo ficar completo, voltam no mesmo lugar. O banco não é alterado. Laudo colado com as 6 linhas novas ou com as 5 antigas é reconhecido (as antigas viram as 6 novas). Linhas continuam editáveis/apagáveis (C6g) e com soma de focos (C6h).
- Testes: `test/c6j_test.py` (25 verificações); `test/c6h_test.py` ajustado (Enter agora marca; confirmar é Enter no "Pronto").

## [etapa-C6i] Escolha múltipla: começo comum escrito uma vez — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Antes: "com focos hiperecogênicos tipo cauda de cometa, com focos hiperecogênicos tipo macrocalcificações, ...". Agora: "com focos hiperecogênicos tipo cauda de cometa, macrocalcificações, calcificações periféricas e puntiformes".
- Regra: o maior começo comum (palavras inteiras) de todas as marcadas sai uma vez; nos restos, uma palavra igual no início de itens seguidos ("tipo") fica só no primeiro; nenhum item fica vazio (opção igual ao começo sai inteira: "dor e dor forte"); uma só marcada sai inteira. Ordem do banco.
- Vale para o campo no laudo, o cartão TI-RADS e o laudo colado. Laudo colado reconhece o texto novo e o antigo da C6h (o antigo é reescrito no formato novo); o TI-RADS soma os focos reconhecidos.
- Testes: `test/c6i_test.py` (34 verificações); `test/c6h_test.py` atualizado para o texto novo.

## [etapa-C6h] Escolha múltipla ?+[ ] — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Nova sintaxe no banco: `?+[a|b|c]`. A lista abre com caixinhas (clique, Espaço ou número marcam; Enter/"Pronto" confirma e vai ao próximo campo; Tab confirma e segue; Esc cancela; clicar fora confirma).
- Texto no laudo: "a", "a e b", "a, b e c" (ordem do banco); nada marcado = volta a "escolher". Reabrir mostra as marcadas.
- Opção que começa com "sem" desmarca as outras, e marcar outra desmarca o "sem".
- Funciona com desfazer/refazer, rascunho, cópia, pesquisa no laudo e laudo colado (reconhece "a, b e c", inclusive opções com vírgula; mantém a ordem colada).
- `?+[ ]` dentro de uma opção de `?[ ]` funciona como o aninhado de sempre. Limitação: dentro das opções do próprio `?+[ ]`, campos e listas viram texto (aviso MULTI_NESTED). `?+[a]` com uma opção só não gera aviso.
- TI-RADS: se os focos do nódulo estiverem como `?+[ ]`, todos os marcados somam (cauda de cometa 0, macro 1, periféricas 2, puntiformes 3; "sem focos" 0). O formulário do cartão escreve todos os focos marcados nessa lista. Com `?[ ]` continua como antes (um foco, o de maior pontuação).
- O banco real não foi alterado: para usar, troque no banco o `?[` dos focos por `?+[`.
- Testes: `test/c6h_test.py` (32 verificações).

## [etapa-C6g] Linhas do TI-RADS editáveis, sem o "(indicada: N mm)" — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Saiu o acréscimo "(indicada/não indicada: N mm)" das linhas "Recomendação de PAAF" e "Sugestão de Acompanhamento": as 6 linhas seguem exatamente o modelo.
- As 6 linhas são texto comum do laudo: dá para editar ou apagar. Linha editada não é sobrescrita; linha apagada não volta enquanto o nódulo continuar completo. Se o nódulo ficar incompleto, as linhas não mexidas somem e o controle recomeça.
- Testes: `test/c6g_test.py` (9 verificações); `test/c6e_test.py` atualizado.

## [etapa-C6f] Gravação na pasta de dados mais robusta — entregue, testado só em Chromium automatizado (pasta simulada), NÃO testado pelo usuário
- Corrige o aviso recorrente "Não foi possível gravar na pasta de dados (pendrive removido?)". Causa: uma única falha passageira na gravação (arquivo preso por antivírus/OneDrive, outra aba gravando, oscilação do pendrive) já desligava o espelhamento.
- Gravação que falha é repetida sozinha 3 vezes (espera de 0,5 s, 1,5 s e 4 s) antes de virar erro. Pendrive removido (NotFoundError) não é repetido e vai direto para erro; permissão retirada (NotAllowedError) vai para "desconectada".
- Em erro, o app tenta religar sozinho a cada 15 s (sem clique, se a permissão continuar concedida). Ao voltar grava o que ficou pendente; se dados.json/configuracoes.json da pasta forem mais novos que a última gravação deste computador, os da pasta valem (lidos, não sobrescritos).
- Rascunhos: no pendrive no máximo 1 gravação a cada 5 s por rascunho, e sempre uma ao fechar/sair da aba. No navegador continua como antes.
- Aviso e Configurações mostram o nome técnico do erro em letra pequena, ex.: "(NotFoundError)".
- Duas abas não gravam a pasta ao mesmo tempo (navigator.locks quando existe; sem ele, as repetições cobrem a colisão). IE11/navegador sem pasta: nada muda.
- Testes: `test/c6f_test.py` (27 verificações; na versão 790078c a primeira falha passageira já leva a erro e o teste para no item 4). `test/fakefs.js` ganhou falhas simuladas (fakefs.flaky) e contagem de gravações.

## [etapa-C6e] Painel limpo, laudo colado com campos, TI-RADS unificado — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Layout:
  - botões de formatação (N I S, alinhamento, desfazer/refazer) numa barra própria logo acima do laudo;
  - botões das frases (+ ⇩ ✎ →) numa linha acima da pesquisa de frases, que agora ocupa a largura do painel;
  - pesquisa no laudo mais larga.
- Backspace na pesquisa de frases vazia não volta mais aos modelos (voltar: botão ‹ ou Esc).
- Laudo colado (2 ou mais linhas): cada linha que corresponde a uma linha do banco (modelos e frases) volta com os campos, já preenchidos com os valores colados; escolhas viram campos de escolha; linhas que não são do banco ficam texto simples. As calculadoras funcionam em cima disso. Um Ctrl+Z desfaz a colagem. O rascunho recarregado mantém os campos.
- Painel de calculadoras:
  - cartões Calculadora, Obstetrícia (IG relatada, PFE, IG composta, IG pelo PFE, percentis, Doppler AU/ACM e RCP), Volume e TI-RADS;
  - todos começam recolhidos; o cartão abre sozinho uma vez quando fica pronto;
  - estado só por um ponto: verde = pronto, cinza = sem linha / faltam dados / desligado; o motivo fica na dica do ponto; fórmula e fonte na dica do nome;
  - textos removidos: "linha encontrada no laudo", "AU/ACM = …", "Ordem na linha…", "desligado", "sem linha correspondente…";
  - botão ± removido (o painel fica sempre disponível; ainda dá para recolher pelo ›);
  - ordem do Doppler: botão ⇅.
- Chaves: o estado da caixa sempre igual ao efeito. Volume desligado agora tira o valor calculado do laudo (antes ficava).
- TI-RADS num cartão só:
  - "Calcular pelo texto do laudo": com as 5 escolhas da frase "Observa-se nódulo … TI-RADS ___", escreve o número e as 6 linhas (Pontuação / Categoria TIRADS / Nível de Risco / Risco de Malignidade / Recomendação de PAAF / Sugestão de Acompanhamento) logo depois da frase; atualiza ao trocar opção ou medida; somem se ficar incompleto ou desligado; linhas coladas iguais não duplicam;
  - com medida no nódulo, a maior medida é comparada aos cortes ACR 2017 já da C6 e o resultado vai entre parênteses nas linhas de PAAF e acompanhamento, ex.: "(indicada: 12 mm)" / "(não indicada: 7 mm)" — único acréscimo ao modelo das 6 linhas;
  - formulário (composição, ecogenicidade, forma, margem com pontos, focos, terço, lobo, L×AP×T, resultado ao vivo) e "Inserir nódulo": escreve a frase do próprio banco carregado com as escolhas já feitas e os campos editáveis, no lugar do campo de escolha do nódulo se houver; as 6 linhas vêm junto. Um Ctrl+Z desfaz. Banco sem essa frase: insere o bloco da C6;
  - a frase do banco aceita um tipo de foco: o formulário escreve o de maior pontuação (a pontuação usa todos os marcados).
- Testes: `test/c6e_test.py` (45 verificações; na versão 6d2b1eb: 5 passam, 28 falham e o teste para no formulário que não existia). Atualizados para o novo painel: c1 (sem ±, cartões), c6 (UI do formulário novo; 25 verificações), c6c e c6d (estado lido pela dica do ponto).

## [etapa-C6d] Volume da tireoide = soma dos lobos — entregue, testado só em Chromium automatizado, NÃO testado pelo usuário
- Aprovado pelo Dr. Renato.
- Cada lobo usa a regra da C2: L × AP × T × 0,523 (mm → cm³). Conta como lobo a frase "O lobo direito/esquerdo mede cerca de # x # x # mm".
- O campo de volume total recebe a soma dos lobos, arredondada no fim:
  - "Volume glandular estimado em ___ cm³";
  - ou "Glândula tireoide ... de volume ___ cm³".
- Se a frase do lobo tiver o próprio campo de volume, ele também é preenchido.
- O istmo não entra na soma: a fórmula aprovada é a soma dos lobos, e o banco só tem a espessura AP do istmo, sem 3 medidas.
- Só um lobo no laudo (ex.: lobectomia): o total é esse lobo. Dois lobos do mesmo lado: ambíguo, não calcula. Medidas de nódulo não contam.
- Valor digitado à mão é respeitado até alguma medida de lobo mudar, como na C2.
- Painel: "tireoide: soma de 2 lobos (istmo não entra)", ou aviso quando há lobos sem linha de volume total.
- Teste automático: test/c6d_test.py, 13/13 (6/13 na C6c).

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
