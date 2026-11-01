# Estado do projeto

| Etapa | Conteúdo | Situação |
|---|---|---|
| A | Parser do banco de frases (.txt com instruções `@@`/`##`) | Concluída |
| B | Interface de 3 colunas (rodadas até B25) | Concluída |
| C | Calculadoras (painel lateral). C1: painel, calculadora livre e IG relatada; C2: volume e índice esplênico em tempo real; C3: biometria fetal (PFE Hadlock 1985, IG composta Hadlock 1984, IG pelo PFE Hadlock 1991) | C1 (painel, calculadora livre, IG) C2 (volume e índice esplênico no laudo) C3 (biometria fetal: PFE, IG composta, IG pelo PFE) C4 (percentis Hadlock pela IG relatada) C5 (Doppler: relação AU/ACM e RCP com p5 de Ebbing 2007) C6 (ACR TI-RADS por nódulo, inserção no laudo) C6b (correção: editar campo preenchido) e C6c (painel em cartões, avisos, Doppler invertível, opção dentro de opção, TI-RADS pelo texto) e C6d (volume da tireoide = soma dos lobos) e C6e (painel limpo com ponto de estado, laudo colado com campos, TI-RADS unificado com as 6 linhas após o nódulo) entregues (só Chromium automatizado), **não testadas pelo usuário**; C7 pendente |
| D | Armazenamento em pasta/pendrive (D1); Salvar nas configurações, histórico de pesquisa, editor do banco, ordem das diretivas (D2) | D1 e D2 entregues, **não testadas pelo usuário** |
| D3 | Correções da revisão completa (abas, importar, backups, desfazer, revisão de críticas, pasta lenta, navegador sem espaço, final de linha, rascunhos) | Entregue, **não testada pelo usuário** |
| D3b | Editor do banco mantém final de linha só CR | Entregue, **não testada pelo usuário** |
| D3c | Clique no meio do campo em branco substitui o campo inteiro | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6k | TI-RADS: 6 linhas no lugar das 5 antigas, abaixo do título; recomendação única do nódulo de maior pontuação (empate: o primeiro); espongiforme dispensa as demais características (painel e laudo); avisos do ACR e de combinações incoerentes no painel | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6l | TI-RADS: verificação exaustiva (4.000 combinações; totais 0–17 todos atingíveis; total 1 fora da tabela ACR, tratado como TR1) e 114+7 casos no laudo real; só testes, sem mudança de código | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6m | Painel TI-RADS sem textos de aviso visíveis (extratireoidiana, misto, PAAF/tamanho, incoerências): só no title ao passar o mouse; travas e cálculo iguais | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6n | Vários volumes por laudo (frases inseridas depois, ex.: teratoma), botão "Limpar" nas calculadoras, título da aba = modelo, sessões de abas ("Sessões") | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6o | Templates intermediários (texto puro "___" e "a / b / c") reconhecidos ao colar; cartões "(padrão)" destacados; Tab/Enter na revisão vai a campos preenchidos; Editar banco gravado na pasta mesmo se ela estava desconectada | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6p | Template intermediário com "*" no lugar do campo (escolhas "a / b / c"); colar reconhece "*", número no lugar, "___" antigo e tolera erros comuns (asterisco ao lado do valor, espaços, unidade repetida/faltando, caixa, "a / b", escolha apagada) | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6j | Escolha múltipla pelo teclado (Enter marca, Tab/"Pronto" confirma), Enter-para-próximo no painel, 6 linhas do TI-RADS no lugar das 5 antigas | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6i | Escolha múltipla: começo comum das opções escrito uma vez | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6h | Escolha múltipla `?+[ ]` no banco (TI-RADS soma todos os focos) | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6g | TI-RADS: 6 linhas editáveis/apagáveis, sem o veredito de tamanho | Entregue (só Chromium automatizado), **não testada pelo usuário** |
| C6f | Pasta de dados: repete gravações que falham, religa sozinha, rascunhos a cada 5 s, uma aba grava por vez | Entregue (só Chromium com pasta simulada), **não testada pelo usuário** |
| E, F | — | Não definidas nos registros disponíveis |

## Regras
- Texto clínico do banco nunca é alterado pelo app.
- ES5 estrito, sem dependências, funciona abrindo o `index.html` direto do
  computador, menos de 1 MB; IE11 deve abrir (com recursos reduzidos).
- Calculadoras (etapa C): as fórmulas e valores de referência **devem vir do
  médico responsável pelo projeto**; nada é inventado.
- TI-RADS: baixa prioridade.
- Repositório público: nada de banco, capturas ou dados de pacientes.

## Próximos passos
- O usuário testar a D1, a D2 e a D3 (ver "Não testado pelo usuário" no `CHANGELOG.md`).
- O usuário testar a C1 a C6e.
- Reconhecimento de laudo colado: só linhas iguais às do banco (com valores no lugar dos campos) viram campos; não há importação de arquivo (.doc/.pdf).
- RCP: o banco não tem linha; texto sugerido "- Relação cerebroplacentária (RCP): IP cerebral média / IP umbilical = *,* (p5 para * semanas: *,*)." (o médico decide se acrescenta).
- IG pelo PFE: o banco não tem linha de saída; texto sugerido "Idade gestacional estimada pelo peso fetal: * semanas." (o médico decide se acrescenta).
- Índice esplênico: o banco precisa ganhar as 3 medidas (C x L x E, em cm) na frase do índice para o cálculo funcionar; aguardando orientação do médico.
- Etapa C (entregas 6 e 7: TI-RADS e o que mais for definido) quando as fórmulas forem enviadas; cada uma entra como módulo `UFCalc.register(...)`.
