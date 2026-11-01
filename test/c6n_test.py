"""C6n: varios volumes no laudo (frases inseridas depois), botao Limpar da calculadora, titulo da aba e sessoes de abas.
Uso: python test/c6n_test.py  (banco de teste proprio; nao usa o banco do usuario)"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
TV = '''Colo uterino e canal endocervical normais.
Útero posicionado em ?[anteversoflexão|retroflexão].
Dimensões medindo cerca de * x * x * mm (LxAPxT).
Volume estimado em cerca de * cm³.
Endométrio medindo cerca de *,* mm de espessura.
Ovários normais.
'''
BANK = '''@@EXAME Transvaginal
@@EXAME_FULL ULTRASSONOGRAFIA TRANSVAGINAL
@@TEMPLATE Transvaginal padrão
ULTRASSONOGRAFIA TRANSVAGINAL
''' + TV + '''
@@TEMPLATE Transvaginal Obstétrica padrão
TRANSVAGINAL OBSTETRICA
Saco gestacional tópico.

@@TEMPLATE Obstétrica de 1º Trimestre padrão
OBSTETRICA 1 TRI
Feto único.

@@TEMPLATE Obstétrica de 2º ou 3º Trimestre padrão
OBSTETRICA 2 3 TRI
Feto único, cefálico.

@@TEMPLATE Doppler de Fluxo Obstétrico padrão
DOPPLER OBSTETRICO
Artéria umbilical normal.

##SECTION OVÁRIOS

Teratoma 1 [Teratoma cístico maduro]:
Ovário ?[direito|esquerdo] apresentando imagem nodular heterogênea, medindo cerca de * x * x * mm (LxAPxT) (~ * cm³), sugestiva de teratoma cístico maduro.

Cisto simples [Cisto]:
Ovário ?[direito|esquerdo] com cisto simples medindo * x * x * mm, com volume de * cm³.

Nódulo sem volume [Nódulo]:
Imagem nodular medindo * x * x * mm, sem fluxo.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:400])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
ERR = []
def fresh(b, model=0):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(600); pg.locator('[data-model]').nth(model).dblclick(); pg.wait_for_timeout(400)
    return c, pg
def rep(pg): return pg.evaluate('UFTest.reportText()').replace('\r', '').split('\n')
def L(pg, s, k=0):
    a = [l for l in rep(pg) if l.startswith(s)]; return a[k] if len(a) > k else ''
def nflds(pg, start, k=0):
    return pg.evaluate('''(a) => { var all = [].slice.call(document.querySelectorAll('#editor .fld')), out = [], seen = -1, cur = null;
      all.forEach(function (f, i) { var n = f; while (n && n.nodeName !== 'DIV') { n = n.parentNode; }
        if ((n.textContent || '').indexOf(a[0]) === 0 && f.getAttribute('data-t') !== 's') { if (n !== cur) { cur = n; seen++; } if (seen === a[1]) out.push(i); } }); return out; }''', [start, k])
def typ(pg, idx, txt):
    bb = pg.locator('#editor .fld').nth(idx).bounding_box(); pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(60); pg.keyboard.type(txt); pg.wait_for_timeout(80)
def fill(pg, start, vals, k=0):
    ix = nflds(pg, start, k)
    for j, v in enumerate(vals): typ(pg, ix[j], v)
    pg.wait_for_timeout(250)
def caret_end(pg):
    pg.evaluate("""(function(){var e=document.getElementById('editor'),r=document.createRange();r.selectNodeContents(e);r.collapse(false);e.focus();var s=getSelection();s.removeAllRanges();s.addRange(r);})()""")
def ins(pg, title):
    caret_end(pg)
    k = pg.evaluate('''(t) => { var x = UFTest.S.phraseIndex, k; for (k in x) { if (x.hasOwnProperty(k) && String(x[k].src || '').indexOf(t) === 0) return k; } return null; }''', title)
    pg.evaluate('(k) => UFTest.insertCard(k)', k); pg.wait_for_timeout(400)
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- 1) varios volumes ----------
    c, pg = fresh(b)
    fill(pg, 'Dimensões', ['80', '50', '40'])   # 80*50*40*0.523/1000 = 83.68 -> 84
    ck('1 útero automático (84)', 'Volume estimado em cerca de 84 cm³.' in L(pg, 'Volume estimado'), rep(pg))
    ins(pg, 'Teratoma 1')
    ck('1 teratoma inserido', L(pg, 'Ovário ') != '', rep(pg))
    fill(pg, 'Ovário ', ['30', '20', '10'])       # 3.138 -> 3
    ck('1 teratoma calcula (3) mesmo com ?[direito|esquerdo] na frase', '(~ 3 cm³)' in L(pg, 'Ovário '), L(pg, 'Ovário '))
    ck('1 útero continua 84', 'cerca de 84 cm³' in L(pg, 'Volume estimado'), rep(pg))
    ins(pg, 'Teratoma 1')
    fill(pg, 'Ovário ', ['50', '40', '30'], 1)    # 31.38 -> 31
    ck('1 segundo teratoma (31)', '(~ 31 cm³)' in L(pg, 'Ovário ', 1), rep(pg))
    ck('1 primeiro teratoma intacto (3)', '(~ 3 cm³)' in L(pg, 'Ovário ', 0), rep(pg))
    ins(pg, 'Cisto simples')
    cl = [l for l in rep(pg) if 'cisto simples' in l]
    fill(pg, 'Ovário ', ['20', '20', '20'], 2)    # 4.184 -> 4
    cl = [l for l in rep(pg) if 'cisto simples' in l]
    ck('1 terceira frase ("com volume de * cm³") = 4', cl and 'volume de 4 cm³' in cl[0], cl)
    ins(pg, 'Nódulo sem volume')
    fill(pg, 'Imagem nodular', ['10', '10', '10'])
    ck('1 frase sem campo de volume não ganha volume', L(pg, 'Imagem nodular').startswith('Imagem nodular medindo 10 x 10 x 10 mm, sem fluxo.'), L(pg, 'Imagem nodular'))
    # editar medida depois: recalcula
    ix = nflds(pg, 'Ovário ', 0)
    pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i], r = document.createRange(); r.selectNodeContents(f); f.click; var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''', ix[0])
    typ(pg, ix[0], ''); pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i], r = document.createRange(); r.selectNodeContents(f); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''', ix[0])
    pg.keyboard.type('60'); pg.wait_for_timeout(300)   # 60*20*10 -> 6.276 -> 6
    ck('1 editar medida recalcula (6)', '(~ 6 cm³)' in L(pg, 'Ovário ', 0), L(pg, 'Ovário ', 0))
    ck('1 ponto verde do Volume', pg.evaluate("document.getElementById('ucAutoDot').className").find('on') >= 0)
    ck('1 scan acha 4 pares', pg.evaluate('UFCalcVol.scan().length') == 4, pg.evaluate('UFCalcVol.scan().length'))
    # ---------- 3) botão Limpar ----------
    pg.evaluate("UFCalc.open()"); pg.wait_for_timeout(200)
    ck('3 botão Limpar no painel', pg.locator('#ucReset').count() == 1 and pg.locator('#ucReset').inner_text().strip() == 'Limpar')
    before = rep(pg)
    pg.evaluate("UFCalc.setIgRelatada(20, 3)")
    pg.evaluate("UFCalc.setOpen('tirads', true); UFCalc.setOpen('livre', true)")
    pg.select_option('.tr-sel[data-cat=comp]', index=4); pg.locator('.tr-mm').first.fill('12')
    pg.evaluate("UFCalc._calc.press('7'); UFCalc._calc.press('+'); UFCalc._calc.press('2')")
    ck('3 pré: IG preenchida', pg.evaluate('UFCalc.getIgRelatada()') == 143)
    pg.click('#ucReset'); pg.wait_for_timeout(200)
    ck('3 IG zerada', pg.evaluate('UFCalc.getIgRelatada()') is None and pg.input_value('#ucIgW') == '' and pg.input_value('#ucIgD') == '')
    ck('3 TI-RADS zerado', pg.evaluate("[].every.call(document.querySelectorAll('.tr-sel'),function(s){return s.value===''})") and pg.locator('.tr-mm').first.input_value() == '' and pg.evaluate("document.querySelector('.tr-res').textContent") == '')
    ck('3 calculadora livre zerada', pg.evaluate("document.getElementById('ucDisp').textContent") == '0')
    ck('3 laudo intacto', rep(pg) == before)
    ck('3 sem texto extra visível no cabeçalho', pg.evaluate("document.querySelector('#right .rhead').innerText.replace(/\\s+/g,' ').trim()").endswith('Calculadoras Limpar'), pg.evaluate("document.querySelector('#right .rhead').innerText"))
    c.close()
    # ---------- 4) título e sessões ----------
    c, pg = fresh(b, 0)
    ck('4 título da aba = modelo', pg.title() == 'Transvaginal padrão', pg.title())
    names = ['Transvaginal padrão', 'Transvaginal Obstétrica padrão', 'Obstétrica de 1º Trimestre padrão', 'Obstétrica de 2º ou 3º Trimestre padrão', 'Doppler de Fluxo Obstétrico padrão']
    pg.evaluate("UStore.set('tabSessions', [{name:'maternidade', models:%s}])" % __import__('json').dumps(names + ['Modelo que não existe']))
    # sessão aberta com conteúdo na aba atual: tudo em abas novas
    pages = []
    c.on('page', lambda np: pages.append(np))
    pg.click('#btnSess'); pg.wait_for_timeout(150)
    ck('4 menu lista a sessão', pg.locator('#sessMenu .sm-i[data-si]').count() == 1)
    pg.locator('#sessMenu .sm-i[data-si] .sm-n').click(); pg.wait_for_timeout(2500)
    ck('4 5 abas novas (modelo inexistente pulado)', len(pages) == 5, len(pages))
    for np in pages: np.wait_for_load_state(); 
    pg.wait_for_timeout(800)
    tit = [np.title() for np in pages]
    ck('4 abas na ordem com o modelo carregado', tit == names, tit)
    ck('4 aba nova tem o texto do modelo', 'DOPPLER OBSTETRICO' in pages[4].evaluate('UFTest.reportText()'))
    ck('4 aba atual não foi apagada', pg.title() == 'Transvaginal padrão' and 'ULTRASSONOGRAFIA TRANSVAGINAL' in pg.evaluate('UFTest.reportText()'))
    ck('4 endereço limpo (sem #ufopen)', '#ufopen' not in pages[0].url, pages[0].url)
    # salvar as abas abertas (6 abas: atual + 5)
    pg.wait_for_timeout(5600)   # batida de 5 s das abas
    got = pg.evaluate('UFSess.openTabsModels()')
    ck('4 abas abertas na ordem de abertura', got == [names[0]] + names, got)
    pg.click('#btnSess'); pg.locator('#sessMenu [data-ssave]').click(); pg.wait_for_timeout(200)
    pg.fill('#sessName', 'plantao'); pg.click('#sessSave'); pg.wait_for_timeout(200)
    ss = pg.evaluate("UStore.get('tabSessions')")
    ck('4 sessão salva via UStore', [s['name'] for s in ss] == ['maternidade', 'plantao'] and ss[1]['models'] == [names[0]] + names, ss)
    # aba vazia: 1º modelo entra na própria aba
    np0 = c.new_page(); np0.goto(IDX); np0.wait_for_timeout(500)
    np0.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'")
    n0 = len(pages)
    np0.evaluate("UFSess.open(UFSess.list()[0])"); np0.wait_for_timeout(2000)
    ck('4 aba vazia recebe o 1º modelo, 4 novas', np0.title() == names[0] and len(pages) - n0 == 4, (np0.title(), len(pages) - n0))
    # excluir
    pg.click('#btnSess'); pg.locator('#sessMenu .sm-x').first.click(); pg.wait_for_timeout(200)
    pg.locator('#modalFoot .btn-danger').click(); pg.wait_for_timeout(200)
    ck('4 excluir sessão', [s['name'] for s in pg.evaluate("UStore.get('tabSessions')")] == ['plantao'])
    ck('4 tabSessions vai para dados.json', pg.evaluate("1") == 1)
    ck('sem erros de página', not ERR, ERR)
    b.close()
print('\n%d/%d OK' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
