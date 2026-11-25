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

## Sincronizar o banco (pendrive, Google Drive e GitHub privado)
`sincronizar-banco.bat` (duplo clique) mantém o banco de frases e os templates intermediários iguais no pendrive, na pasta do Google Drive para computador e num **repositório GitHub privado só do banco**. Vale o arquivo mais novo; antes de substituir qualquer arquivo ele guarda um backup datado em `Trampo\Ultra-formulario (backups)\banco` (20 mais recentes). `sincronizar-banco (so conferir).bat` só mostra o que seria feito. Os caminhos ficam em `sincronizar-banco-config.ini`. O script só copia arquivos inteiros e não contém banco, senhas nem tokens. Precisa do Git for Windows e da conta GitHub logada só para a parte do GitHub; sem ele, ou sem internet/pendrive/Drive, o lugar é pulado e o resumo avisa.

## Editar o banco pelo app
⚙ Configurações › Banco de frases › **Editar banco**: edita o .txt dentro do app
(números de linha, "Ir para a linha", Salvar com cópia de segurança). No
relatório de inconsistências, "editar" abre o editor na linha do problema.

## O banco de frases NÃO está aqui
Este repositório é público. Banco de frases, capturas de tela, rascunhos e
dados de pacientes **nunca** são publicados (veja `.gitignore`). Os exemplos
do `LEIA-ME-frases.txt` são genéricos.

## Testes
Um comando roda todos os testes automatizados de `test/` em sequência e imprime
um resumo (passou/falhou por arquivo e totais):

    python test/run_all.py
    python run_tests.py
    run_tests.bat

No Windows: instale Python 3 e o Playwright (`pip install playwright` e
`python -m playwright install chromium`). O runner acha o Chrome, o Chromium
ou o Edge sozinho; ou passe `--browser` / `UF_BROWSER`. A raiz do repositório
é relativa ao script (sem caminhos fixos de máquina).

Viewport (opcional): `--viewport 1366x768` ou `UF_VP=1024x600`. Sem isso, cada
teste usa o tamanho que já definia. Banco clínico: só se `UF_BANCO` apontar
para um arquivo fora do repositório; senão os testes usam bancos de exemplo
embutidos, com modelos no formato `X (padrão)`.

- `test/parser-test.html`: abra no navegador e escolha um banco .txt; mostra o
  resultado do parser (nada é enviado). Não entra no comando acima.
- `test/placement_test.py`: `python test/placement_test.py --diretivas` (banco
  genérico embutido) já roda no comando único. Com um banco fora do repo:
  `python test/placement_test.py caminho/do/banco.txt` gera
  `test/placement-report.csv`, que **não** deve ser publicado.
- `test/d3_test.py`: correções da D3 (banco genérico embutido, pasta de dados simulada por `test/fakefs.js`).

## Documentos
- `CHANGELOG.md`: histórico por rodada.
- `docs/ESTADO-DO-PROJETO.md`: etapas e pendências.

## Escolha múltipla
No banco, `?+[a|b|c]` permite marcar várias opções (o laudo recebe "a, b e c", com o começo comum das opções escrito uma vez só: "dor leve e forte"); `?[a|b|c]` continua escolha única. Detalhes em `LEIA-ME-frases.txt`.
