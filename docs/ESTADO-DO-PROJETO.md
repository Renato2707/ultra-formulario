# Estado do projeto

| Etapa | Conteúdo | Situação |
|---|---|---|
| A | Parser do banco de frases (.txt com instruções `@@`/`##`) | Concluída |
| B | Interface de 3 colunas (rodadas até B25) | Concluída |
| C | Calculadoras (painel lateral) | Pendente |
| D | Armazenamento em pasta/pendrive (D1); Salvar nas configurações, histórico de pesquisa, editor do banco, ordem das diretivas (D2) | D1 e D2 entregues, **não testadas pelo usuário** |
| D3 | Correções da revisão completa (abas, importar, backups, desfazer, revisão de críticas, pasta lenta, navegador sem espaço, final de linha, rascunhos) | Entregue, **não testada pelo usuário** |
| D3b | Editor do banco mantém final de linha só CR | Entregue, **não testada pelo usuário** |
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
- Etapa C quando as fórmulas forem enviadas.
