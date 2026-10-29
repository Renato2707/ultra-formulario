# Estado do projeto

| Etapa | Conteúdo | Situação |
|---|---|---|
| A | Parser do banco de frases (.txt com instruções `@@`/`##`) | Concluída |
| B | Interface de 3 colunas (rodadas até B25) | Concluída |
| C | Calculadoras (painel lateral). C1: painel, calculadora livre e IG relatada; C2: volume e índice esplênico em tempo real; C3: biometria fetal (PFE Hadlock 1985, IG composta Hadlock 1984, IG pelo PFE Hadlock 1991) | C1 (painel, calculadora livre, IG) C2 (volume e índice esplênico no laudo) C3 (biometria fetal: PFE, IG composta, IG pelo PFE) C4 (percentis Hadlock pela IG relatada) e C5 (Doppler: relação AU/ACM e RCP com p5 de Ebbing 2007) entregues (só Chromium automatizado), **não testadas pelo usuário**; C6–C7 pendentes |
| D | Armazenamento em pasta/pendrive (D1); Salvar nas configurações, histórico de pesquisa, editor do banco, ordem das diretivas (D2) | D1 e D2 entregues, **não testadas pelo usuário** |
| D3 | Correções da revisão completa (abas, importar, backups, desfazer, revisão de críticas, pasta lenta, navegador sem espaço, final de linha, rascunhos) | Entregue, **não testada pelo usuário** |
| D3b | Editor do banco mantém final de linha só CR | Entregue, **não testada pelo usuário** |
| D3c | Clique no meio do campo em branco substitui o campo inteiro | Entregue (só Chromium automatizado), **não testada pelo usuário** |
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
- O usuário testar a C1 a C5.
- RCP: o banco não tem linha; texto sugerido "- Relação cerebroplacentária (RCP): IP cerebral média / IP umbilical = *,* (p5 para * semanas: *,*)." (o médico decide se acrescenta).
- IG pelo PFE: o banco não tem linha de saída; texto sugerido "Idade gestacional estimada pelo peso fetal: * semanas." (o médico decide se acrescenta).
- Índice esplênico: o banco precisa ganhar as 3 medidas (C x L x E, em cm) na frase do índice para o cálculo funcionar; aguardando orientação do médico.
- Etapa C (entregas 6 e 7: TI-RADS e o que mais for definido) quando as fórmulas forem enviadas; cada uma entra como módulo `UFCalc.register(...)`.
