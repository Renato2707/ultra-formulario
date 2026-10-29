"""D3c: clicking anywhere inside a blank field (number/decimal/text/select) replaces the whole placeholder.
Generic bank embedded, no real phrases. Usage: python test/d3c_test.py   (needs playwright + chromium)"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Exame Teste
@@EXAME_FULL EXAME TESTE
@@TEMPLATE Padrão
EXAME TESTE
Relatório:

Linha alfa do modelo.

##SECTION ALFA
@@ABAIXO_DE = Linha alfa

Campos:
Numero * mm. Decimal *,* cm. Texto **. Opcao ?[aa|bb].
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
def fresh(b):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.dblclick('[data-model]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => { var T = UFTest, S = T.S, secs = T.examSections('Exame Teste'), i, j;
      for (i = 0; i < secs.length; i++) { for (j = 0; j < secs[i].cards.length; j++) { var c = secs[i].cards[j]; if (c.ph.title === 'Campos') { c.dispSec = secs[i].name; S.phraseIndex[c.id] = c; T.insertCard(c.id); } } } }''')
    pg.wait_for_timeout(200); return pg
def line(pg):
    for l in pg.evaluate('UFTest.reportText()').splitlines():
        if l.startswith('Numero'): return l
    return ''
def click(pg, idx, where):
    bb = pg.locator('#editor .fld').nth(idx).bounding_box()
    x = {'meio': bb['x'] + bb['width'] / 2, 'inicio': bb['x'] + 1, 'fim': bb['x'] + bb['width'] - 1}[where]
    pg.mouse.click(x, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(150)
with sync_playwright() as p:
    b = p.chromium.launch(); c = b
    for where in ('meio', 'inicio', 'fim'):
        for idx, name, want in ((0, 'numero', 'Numero 50 mm.'), (1, 'decimal', 'Decimal 50 cm.'), (2, 'texto', 'Texto 50.')):
            pg = fresh(c); click(pg, idx, where); pg.keyboard.type('50'); pg.wait_for_timeout(150)
            ck('%s/%s -> 50' % (name, where), want in line(pg), line(pg)); pg.close()
        pg = fresh(c); click(pg, 3, where); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
        ck('escolher/%s -> aa' % where, 'Opcao aa.' in line(pg), line(pg)); pg.close()
    # filled field: click in the middle keeps a caret (no select-all), edit normally
    pg = fresh(c); click(pg, 0, 'meio'); pg.keyboard.type('1234'); pg.wait_for_timeout(100)
    click(pg, 0, 'meio'); pg.keyboard.type('9'); pg.wait_for_timeout(100)
    ck('preenchido: clique edita no ponto', '12' in line(pg) and '9' in line(pg) and '34' in line(pg), line(pg))
    # Ctrl+Z after typing in blank field restores placeholder; Tab still goes to next field
    pg.close(); pg = fresh(c); click(pg, 0, 'meio'); pg.keyboard.type('50'); pg.wait_for_timeout(100)
    for _ in range(2): pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    ck('Ctrl+Z volta ao campo vazio', 'Numero ___ mm.' in line(pg), line(pg))
    ck('contagem de vazios', pg.evaluate("document.querySelectorAll('#editor .fld').length") == 4)
    pg.close(); pg = fresh(c); click(pg, 0, 'meio'); pg.keyboard.type('7'); pg.keyboard.press('Tab'); pg.keyboard.type('8'); pg.wait_for_timeout(150)
    ck('Tab vai ao proximo campo', 'Numero 7 mm. Decimal 8 cm.' in line(pg), line(pg))
    pg.close(); b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
