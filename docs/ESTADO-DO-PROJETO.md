# Estado do projeto

| Etapa | Conteúdo | Situação |
|---|---|---|
| A | Parser do banco de frases (.txt com instruções `@@`/`##`) | Concluída |
| B | Interface de 3 colunas (rodadas até B25) | Concluída |
| C | Calculadoras (painel lateral) | Pendente |
| D | Armazenamento real em pasta/pendrive | D1 entregue, **não testada pelo usuário** |
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
- O usuário testar a D1 (ver "Não testado pelo usuário" no `CHANGELOG.md`).
- Etapa C quando as fórmulas forem enviadas.
