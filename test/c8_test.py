"""C8: botão direito (link nativo) abre o modelo noutra guia; seções sem frase somem do painel.
O cartão do modelo é um <a href="#ufmodel=<id>">. Clique esquerdo aplica aqui, sem navegar.
Ctrl+clique, clique do meio e abrir o href noutra página carregam esse modelo (file://).
Seção com zero frases (vazia no banco ou zerada pela pesquisa) não aparece; recolhida com frases continua.
Uso: python test/c8_test.py   (banco genérico embutido; nenhum texto clínico real)
"""
import os, sys, tempfile
from urllib.parse import unquote
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Alfa
@@EXAME_FULL ULTRASSONOGRAFIA ALFA
@@TEMPLATE Alfa (padrão)
TEXTO-ALFA-PADRAO
Linha alfa do modelo.

@@TEMPLATE Alfa & 1º
TEXTO-ALFA-E
Linha com e comercial.

@@TEMPLATE Comum
TEXTO-COMUM-ALFA

##SECTION COM FRASES
Frase alfa:
FRASE-ALFA unica-alfa no corpo.

Frase beta:
FRASE-BETA unica-beta no corpo.

##SECTION VAZIA

##SECTION OUTRA
Frase gama:
FRASE-GAMA unica-gama.

##SECTION ECO COMPARTILHADO

@@EXAME Beta
@@EXAME_FULL ULTRASSONOGRAFIA BETA
@@TEMPLATE Comum
TEXTO-COMUM-BETA

@@TEMPLATE Beta especial
TEXTO-BETA-ESPECIAL

##SECTION ECO COMPARTILHADO
Frase compartilhada:
FRASE-COMPARTILHADA texto emprestado.

@@EXAME TODOS
##SECTION COMUNS
Frase comum:
FRASE-COMUM de todos.

##SECTION TODOS VAZIA
'''
R = []
ERR = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:500])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False)
f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
def sec_names(pg):
    return pg.evaluate("""(function () {
      var out = [], nodes = document.querySelectorAll('#navList .sec > .card .ct'), i, t, s, k;
      for (i = 0; i < nodes.length; i++) {
        t = nodes[i]; s = '';
        for (k = 0; k < t.childNodes.length; k++) { if (t.childNodes[k].nodeType === 3) { s += t.childNodes[k].nodeValue; } }
        out.push(s.replace(/^\\s+|\\s+$/g, ''));
      }
      return out;
    })()""")
def rep(pg):
    return pg.evaluate('UFTest.reportText()')
def model_by_text(pg, text):
    return pg.locator('#navList [data-model]', has_text=text).first
def href_of(pg, text):
    return model_by_text(pg, text).get_attribute('href')
def id_of(pg, text):
    return model_by_text(pg, text).get_attribute('data-model')
def go_exams(pg):
    for _ in range(4):
        if pg.locator('[data-exam="Alfa"]').count():
            return
        if pg.locator('[data-go="1"]').count():
            pg.click('[data-go="1"]'); pg.wait_for_timeout(200); continue
        if not pg.locator('#navBack').is_disabled():
            pg.click('#navBack'); pg.wait_for_timeout(200); continue
        break
def open_href(c, href):
    np = c.new_page(); np.set_default_timeout(8000)
    np.on('pageerror', lambda e: ERR.append(str(e)))
    np.goto(IDX + href)
    np.wait_for_function('function () { return window.UFTest && document.getElementById("editor"); }')
    np.wait_for_timeout(250)
    return np
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 1400, 'height': 900})
    pages = []
    c.on('page', lambda np: pages.append(np))
    pg = c.new_page(); pg.set_default_timeout(8000)
    pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(250)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    # ---------- 1) cartões de modelo são links; exames e "ver frases" continuam botões ----------
    ck('1 exames são botões', pg.evaluate("document.querySelector('[data-exam]').nodeName") == 'BUTTON')
    pg.click('[data-exam="Alfa"]'); pg.wait_for_timeout(700)
    ck('1 ver frases continua botão', pg.evaluate("document.querySelector('[data-go=\"3\"]').nodeName") == 'BUTTON')
    info = pg.evaluate("""(function () {
      var a = document.querySelectorAll('#navList [data-model]'), i, o = [], s;
      for (i = 0; i < a.length; i++) {
        s = getComputedStyle(a[i]);
        o.push({ tag: a[i].nodeName, href: a[i].getAttribute('href'), id: a[i].getAttribute('data-model'),
          drag: a[i].getAttribute('draggable'), dec: (s.textDecorationLine || s.textDecoration || ''), color: s.color, disp: s.display });
      }
      return o;
    })()""")
    ck('1 três modelos de Alfa são links', len(info) == 3 and all(x['tag'] == 'A' and x['href'] and x['href'].startswith('#ufmodel=') for x in info), info)
    ck('1 href decodifica o id (inclusive & e º)', all(unquote(x['href'].split('=', 1)[1]) == x['id'] for x in info), info)
    ck('1 ids dos dois "Comum" são por exame', id_of(pg, 'Comum') == 'b:Alfa|Comum', id_of(pg, 'Comum'))
    ck('1 link sem sublinhado, bloco, cor herdada', all('none' in x['dec'] and x['disp'] == 'block' and x['color'] not in ('rgb(0, 0, 238)', 'rgb(0, 0, 255)', 'blue') for x in info), info)
    ck('1 arrastar desligado: draggable=false', all(x['drag'] == 'false' for x in info), info)
    prevented = pg.evaluate("""(function () {
      var a = document.querySelector('#navList [data-model]');
      var ev = document.createEvent('MouseEvents');
      ev.initMouseEvent('contextmenu', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 2, null);
      return a.dispatchEvent(ev);
    })()""")
    ck('1 menu de contexto não é cancelado (o nativo abre a guia)', prevented is True, prevented)
    # ---------- 2) clique esquerdo aplica aqui, sem nova guia e sem hash ----------
    n0 = len(pages)
    url0 = pg.url
    pg.locator('#navList [data-model]', has_text='Alfa (padrão)').click(); pg.wait_for_timeout(300)
    ck('2 clique esquerdo não abre guia', len(pages) == n0, len(pages))
    ck('2 endereço sem #ufmodel', 'ufmodel' not in pg.url and pg.url.split('#')[0] == url0.split('#')[0], pg.url)
    ck('2 modelo carregado nesta guia', 'TEXTO-ALFA-PADRAO' in rep(pg), rep(pg))
    ck('2 nível das frases', pg.evaluate('UFTest.S.level') == 3)
    # frases continuam botões; inserir ainda funciona
    pg.locator('#navList [data-sec]', has_text='COM FRASES').click(); pg.wait_for_timeout(200)
    ck('2 frase continua botão', pg.evaluate("document.querySelector('#navList .pcard').nodeName") == 'BUTTON')
    before = rep(pg)
    pg.locator('#navList .pcard', has_text='Frase alfa').click(); pg.wait_for_timeout(150)
    ck('2 clique na frase só seleciona', rep(pg) == before and 'sel' in (pg.locator('#navList .pcard', has_text='Frase alfa').get_attribute('class') or ''))
    pg.locator('#navList .pcard', has_text='Frase alfa').locator('.pins').click(); pg.wait_for_timeout(250)
    ck('2 seta insere a frase', 'FRASE-ALFA' in rep(pg) and 'TEXTO-ALFA-PADRAO' in rep(pg), rep(pg))
    # ---------- 3) teclado: Enter e Espaço aplicam aqui ----------
    pg.click('#navBack'); pg.wait_for_timeout(200)
    model_by_text(pg, 'Alfa & 1º').focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ck('3 Enter carrega o modelo nesta guia', 'TEXTO-ALFA-E' in rep(pg) and 'ufmodel' not in pg.url, (pg.url, rep(pg)[:80]))
    pg.click('#navBack'); pg.wait_for_timeout(200)
    model_by_text(pg, 'Comum').focus(); pg.keyboard.press('Space'); pg.wait_for_timeout(300)
    ck('3 Espaço carrega o modelo (não só rola a página)', 'TEXTO-COMUM-ALFA' in rep(pg) and 'ufmodel' not in pg.url, rep(pg)[:80])
    # ---------- 4) miolo do caminho também é o link do modelo ----------
    cur = pg.locator('#crumb .ccur').get_attribute('href')
    ck('4 miolo é #ufmodel do Comum de Alfa', cur and unquote(cur.split('=', 1)[1]) == 'b:Alfa|Comum', cur)
    pg.evaluate("""(function () { var d = document.createElement('div'); d.textContent = 'RASCUNHO-C8'; document.getElementById('editor').appendChild(d); })()""")
    pg.locator('#crumb .ccur').click(); pg.wait_for_timeout(300)
    ck('4 clique no miolo recarrega aqui e limpa o rascunho', 'TEXTO-COMUM-ALFA' in rep(pg) and 'RASCUNHO-C8' not in rep(pg) and 'ufmodel' not in pg.url, rep(pg)[:120])
    # ---------- 5) nova guia pelo href (o que o botão direito faz) e pelo Ctrl+clique ----------
    pg.evaluate("""(function () { var d = document.createElement('div'); d.textContent = 'MARCA-ABA-1'; document.getElementById('editor').appendChild(d);
      document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true })); })()""")
    pg.wait_for_timeout(150)
    pg.click('#navBack'); pg.wait_for_timeout(200)
    href_e = href_of(pg, 'Alfa & 1º')
    np = open_href(c, href_e)
    ck('5 nova guia aplica Alfa & 1º', 'TEXTO-ALFA-E' in rep(np), rep(np)[:160])
    ck('5 nova guia não traz o laudo da outra', 'MARCA-ABA-1' not in rep(np) and 'TEXTO-COMUM-ALFA' not in rep(np), rep(np)[:160])
    ck('5 hash consumido (recarregar não zera o laudo)', 'ufmodel' not in np.url, np.url)
    ck('5 aba de origem intacta', 'MARCA-ABA-1' in rep(pg) and 'TEXTO-COMUM-ALFA' in rep(pg), rep(pg)[:160])
    # dois "Comum": o id escolhe o exame certo
    pg.click('[data-go="1"]'); pg.wait_for_timeout(200)
    pg.click('[data-exam="Beta"]'); pg.wait_for_timeout(700)
    href_b = href_of(pg, 'Comum')
    ck('5 Comum de Beta tem outro id', id_of(pg, 'Comum') == 'b:Beta|Comum' and href_b != href_e, (id_of(pg, 'Comum'), href_b))
    npb = open_href(c, href_b)
    ck('5 href do Comum de Beta carrega TEXTO-COMUM-BETA', 'TEXTO-COMUM-BETA' in rep(npb) and 'TEXTO-COMUM-ALFA' not in rep(npb), rep(npb)[:160])
    ck('5 trocar de exame no painel não apaga o laudo', 'MARCA-ABA-1' in rep(pg) and 'TEXTO-COMUM-ALFA' in rep(pg), rep(pg)[:180])
    n_before = len(pages)
    with c.expect_page(timeout=8000) as pi:
        model_by_text(pg, 'Beta especial').click(modifiers=['Control'])
    npc = pi.value
    npc.wait_for_function('function () { return window.UFTest && document.getElementById("editor"); }')
    npc.wait_for_timeout(300)
    ck('5 Ctrl+clique abre guia', len(pages) == n_before + 1, len(pages))
    ck('5 Ctrl+clique aplica Beta especial', 'TEXTO-BETA-ESPECIAL' in rep(npc) and 'ufmodel' not in npc.url, (npc.url, rep(npc)[:120]))
    ck('5 Ctrl+clique não mexe na guia atual', 'MARCA-ABA-1' in rep(pg), rep(pg)[:120])
    n_mid = len(pages)
    with c.expect_page(timeout=8000) as pm:
        model_by_text(pg, 'Comum').click(button='middle')
    npm = pm.value
    npm.wait_for_function('function () { return window.UFTest && document.getElementById("editor"); }')
    npm.wait_for_timeout(300)
    ck('5 clique do meio abre guia', len(pages) == n_mid + 1)
    ck('5 clique do meio aplica o Comum de Beta', 'TEXTO-COMUM-BETA' in rep(npm) and 'TEXTO-COMUM-ALFA' not in rep(npm), rep(npm)[:160])
    ck('5 clique do meio não mexe na guia atual', 'MARCA-ABA-1' in rep(pg))
    # modelo do usuário (id u:)
    pg.evaluate("""(function () { UStore.set('userModels', [{ id: 'u:teste', name: 'Meu & modelo', exam: 'Alfa', text: 'TEXTO-MEU\\nlinha do usuario' }]); })()""")
    pg.reload(); pg.wait_for_timeout(400)
    go_exams(pg)
    pg.click('[data-exam="Alfa"]'); pg.wait_for_timeout(700)
    ck('5 modelo do usuário é link com o id u:', id_of(pg, 'Meu & modelo') == 'u:teste' and unquote(href_of(pg, 'Meu & modelo').split('=', 1)[1]) == 'u:teste')
    npu = open_href(c, href_of(pg, 'Meu & modelo'))
    ck('5 nova guia carrega o modelo do usuário', 'TEXTO-MEU' in rep(npu), rep(npu)[:160])
    # arrastar quando a opção está ligada
    pg.evaluate("""(function () { UFTest.S.settings.dragReorder = true; document.getElementById('navSearch').dispatchEvent(new Event('input', { bubbles: true })); })()""")
    pg.wait_for_timeout(100)
    ck('5 com reordenar, o link é arrastável', pg.evaluate("document.querySelector('#navList [data-model]').getAttribute('draggable')") == 'true' and pg.locator('#navList .grip').count() > 0)
    pg.evaluate("""(function () { UFTest.S.settings.dragReorder = false; document.getElementById('navSearch').dispatchEvent(new Event('input', { bubbles: true })); })()""")
    # ---------- 6) seções sem frase ocultas; recolhida com frases continua ----------
    model_by_text(pg, 'Alfa (padrão)').click(); pg.wait_for_timeout(300)
    names = sec_names(pg)
    ck('6 seções com frase aparecem', all(x in names for x in ['COM FRASES', 'OUTRA', 'ECO COMPARTILHADO', 'COMUNS']), names)
    ck('6 vazia do exame, vazia de TODOS e aviso somem', 'VAZIA' not in names and 'TODOS VAZIA' not in names and 'Sem frases ainda' not in pg.inner_text('#navList'), names)
    exp = pg.evaluate("""(function () {
      var nodes = document.querySelectorAll('#navList [data-sec]'), i, o = [];
      for (i = 0; i < nodes.length; i++) { o.push(nodes[i].getAttribute('aria-expanded')); }
      return o;
    })()""")
    ck('6 aparecem recolhidas (não é o recolhimento que esconde)', exp and all(x == 'false' for x in exp) and pg.locator('#navList .pcard').count() == 0, exp)
    pg.locator('#navList [data-sec]', has_text='ECO COMPARTILHADO').click(); pg.wait_for_timeout(200)
    ck('6 referência com frases emprestadas mostra a frase', pg.locator('#navList .pcard', has_text='FRASE-COMPARTILHADA').count() == 1)
    ck('6 vazia continua oculta depois de abrir outra', 'VAZIA' not in sec_names(pg))
    pg.fill('#navSearch', 'unica-alfa'); pg.wait_for_timeout(200)
    fn = sec_names(pg)
    ck('6 filtro deixa só a seção com a frase', fn == ['COM FRASES'], fn)
    ck('6 contagem do filtro é 1/2', pg.locator('#navList [data-sec] .n').inner_text().strip() == '1/2', pg.locator('#navList [data-sec] .n').inner_text())
    ck('6 frase que não bate some, a que bate fica', pg.locator('#navList .pcard', has_text='unica-alfa').count() == 1 and pg.locator('#navList .pcard', has_text='unica-beta').count() == 0)
    pg.fill('#navSearch', 'zzz-nenhuma'); pg.wait_for_timeout(200)
    ck('6 filtro sem match não lista seção', sec_names(pg) == [] and 'Nenhuma frase encontrada' in pg.inner_text('#navList'), sec_names(pg))
    pg.click('#navSearchX'); pg.wait_for_timeout(200)
    back = sec_names(pg)
    ck('6 limpar a pesquisa devolve as seções com frase', all(x in back for x in ['COM FRASES', 'OUTRA', 'ECO COMPARTILHADO', 'COMUNS']) and 'VAZIA' not in back, back)
    pg.evaluate("""(function () {
      UFTest.S.userPhrases.push({ id: 'up1', exam: 'Alfa', section: 'VAZIA', titleLine: 'Minha:', body: 'TEXTO-USUARIO' });
      document.getElementById('navSearch').dispatchEvent(new Event('input', { bubbles: true }));
    })()""")
    pg.wait_for_timeout(150)
    ck('6 frase do usuário faz a seção vazia aparecer', 'VAZIA' in sec_names(pg), sec_names(pg))
    pg.fill('#navSearch', 'TEXTO-USUARIO'); pg.wait_for_timeout(150)
    ck('6 filtro dessa frase deixa a seção', sec_names(pg) == ['VAZIA'], sec_names(pg))
    pg.fill('#navSearch', 'nao-esta'); pg.wait_for_timeout(150)
    ck('6 filtro que não bate esconde de novo', 'VAZIA' not in sec_names(pg) and sec_names(pg) == [], sec_names(pg))
    ck('sem erros de página', not ERR, ERR[:4])
    c.close(); b.close()
os.unlink(f.name)
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
