# Ultra Formulário — Editor de laudos de ultrassonografia

App de página única (HTML + JavaScript ES5, sem instalação e sem dependências)
para montar laudos a partir de um banco de frases em texto (.txt).
Três colunas: exames/modelos/frases, o laudo, e um painel lateral.

## Como abrir
1. Baixe ou copie a pasta do projeto (por exemplo, para o pendrive).
2. Dê dois cliques em `index.html` (Chrome ou Edge recomendados; Firefox funciona
   sem a pasta de dados).
3. Na primeira vez, escolha o arquivo do banco de frases (.txt).

## Pasta de dados (pendrive)
Em ⚙ Configurações › Armazenamento › **Escolher pasta**, escolha uma pasta uma
vez. O app grava nela o banco, as configurações e os rascunhos como arquivos
comuns (veja `LEIA-ME-frases.txt`). Se o navegador pedir permissão de novo,
clique em **Reconectar**. Sem pasta, use **Exportar** / **Importar**.

## Editar o banco pelo app
⚙ Configurações › Banco de frases › **Editar banco**: edita o .txt dentro do app
(números de linha, "Ir para a linha", Salvar com cópia de segurança). No
relatório de inconsistências, "editar" abre o editor na linha do problema.

## O banco de frases NÃO está aqui
Este repositório é público. Banco de frases, capturas de tela, rascunhos e
dados de pacientes **nunca** são publicados (veja `.gitignore`). Os exemplos
do `LEIA-ME-frases.txt` são genéricos.

## Testes
- `test/parser-test.html`: abra no navegador e escolha um banco .txt; mostra o
  resultado do parser (nada é enviado).
- `test/placement_test.py`: teste de posicionamento com Playwright
  (`pip install playwright`, depois `python test/placement_test.py caminho/do/banco.txt`).
  Gera `test/placement-report.csv`, que **não** deve ser publicado.
  `python test/placement_test.py --diretivas` testa a ordem das diretivas com um banco genérico embutido.

## Documentos
- `CHANGELOG.md`: histórico por rodada.
- `docs/ESTADO-DO-PROJETO.md`: etapas e pendências.
