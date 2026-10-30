"""C6d: volume da tireoide = soma dos volumes dos lobos (cada um L x AP x T x 0,523, regra da C2); istmo não entra.
Banco genérico embutido (frases equivalentes, nenhum texto real). Uso: python test/c6d_test.py (playwright + chromium)"""
import os, sys, tempfile, math
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Tireoide Teste
@@EXAME_FULL TIREOIDE TESTE
@@TEMPLATE Padrao
TIREOIDE PADRAO
Observa-se nódulo em terço médio de lobo direito, medindo cerca de * x * x * mm (LxAPxT). TI-RADS *.

O lobo direito mede cerca de * x * x * mm (LxAPxT).
O lobo esquerdo mede cerca de * x * x * mm (LxAPxT).
Istmo mede cerca de * mm (AP).
Volume glandular estimado em * cm³.

@@TEMPLATE PorLobo
TIREOIDE POR LOBO
O lobo direito mede cerca de * x * x * mm (LxAPxT) (volume ~ * cm³).
O lobo esquerdo mede cerca de * x * x * mm (LxAPxT) (volume ~ * cm³).
Volume glandular estimado em * cm³.

@@TEMPLATE Primeira
TIREOIDE PRIMEIRA LINHA
Glândula tireoide tópica, de volume * cm³, contornos regulares.
O lobo direito mede cerca de * x * x * mm (LxAPxT).
O lobo esquerdo mede cerca de * x * x * mm (LxAPxT).

@@TEMPLATE UmLobo
TIREOIDE UM LOBO
O lobo esquerdo mede cerca de * x * x * mm (LxAPxT).
Volume glandular estimado em * cm³.

@@TEMPLATE Duplicado
TIREOIDE DUPLICADO
O lobo direito mede cerca de * x * x * mm (LxAPxT).
O lobo direito mede cerca de * x * x * mm (LxAPxT).
Volume glandular estimado em * cm³.

@@TEMPLATE SemTotal
TIREOIDE SEM TOTAL
O lobo direito mede cerca de * x * x * mm (LxAPxT).
O lobo esquerdo mede cerca de * x * x * mm (LxAPxT).
'''
def vl(a, b, c): return a * b * c * 0.523 / 1000
def rnd(x): return int(math.floor(x + 0.5))
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
tf = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); tf.write(BANK.replace('\n', '\r\n').encode('utf-8')); tf.close()
ERR = []
def fresh(b, model):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(5000)
    pg.on('pageerror', lambda e: ERR.append(str(e))); pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', tf.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(600); pg.locator('[data-model]').nth(model).dblclick(); pg.wait_for_timeout(400)
    if not pg.evaluate('UFCalc.isOpen()'): pg.click('#btnCalc'); pg.wait_for_timeout(150)
    return pg
def rep(pg): return pg.evaluate('UFTest.reportText()').splitlines()
def L(pg, s, n=0): return ([l for l in rep(pg) if s in l] + ['', ''])[n]
def ix(pg, start, nth=0):
    return pg.evaluate('''(a) => { var all = [].slice.call(document.querySelectorAll('#editor .fld')), out = [];
      all.forEach(function (f, i) { var n = f; while (n && n.nodeName !== 'DIV') { n = n.parentNode; }
        if ((n.textContent || '').replace(/^[\\s\\u2022\\u00a0-]+/, '').indexOf(a[0]) === 0) { out.push(i); } }); return out[a[1]]; }''', [start, nth])
def typ(pg, i, txt):
    x = pg.locator('#editor .fld').nth(i).bounding_box(); pg.mouse.click(x['x'] + x['width'] / 2, x['y'] + x['height'] / 2); pg.wait_for_timeout(60)
    pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i], r = document.createRange(); r.selectNodeContents(f); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''', i)
    pg.keyboard.type(txt); pg.wait_for_timeout(100)
def lobe(pg, start, vals, nth=0):
    i = ix(pg, start, nth)
    for k, v in enumerate(vals): typ(pg, i + k, v)
def st(pg): return pg.evaluate("document.getElementById('ucAutoSt').textContent")
D, E = (45, 15, 18), (40, 14, 16)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b, 0)
    lobe(pg, 'Observa-se nódulo', ['30', '20', '25'])
    lobe(pg, 'O lobo direito', [str(x) for x in D])
    ck('só um lobo preenchido: total vazio', 'estimado em ___ cm³' in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    lobe(pg, 'O lobo esquerdo', [str(x) for x in E])
    exp = rnd(vl(*D) + vl(*E))
    ck('total = soma dos 2 lobos (%d cm³), nódulo e istmo não entram' % exp, L(pg, 'Volume glandular').strip() == 'Volume glandular estimado em %d cm³.' % exp, L(pg, 'Volume glandular'))
    typ(pg, ix(pg, 'Istmo'), '4'); 
    ck('istmo preenchido não muda o total', ('em %d cm³' % exp) in L(pg, 'Volume glandular'))
    ck('painel: soma de 2 lobos', 'soma de 2 lobos' in st(pg) and 'istmo não entra' in st(pg), st(pg))
    vi = ix(pg, 'Volume glandular'); typ(pg, vi, '20')
    typ(pg, ix(pg, 'Istmo'), '5')
    ck('edição manual do total respeitada (medidas iguais)', 'em 20 cm³' in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    lobe(pg, 'O lobo direito', ['50', '15', '18'])
    exp2 = rnd(vl(50, 15, 18) + vl(*E))
    ck('medida mudou: recalcula (%d)' % exp2, ('em %d cm³' % exp2) in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    pg = fresh(b, 1)
    lobe(pg, 'O lobo direito', [str(x) for x in D]); lobe(pg, 'O lobo esquerdo', [str(x) for x in E])
    ck('volume de cada lobo na própria linha', ('volume ~ %d cm³' % rnd(vl(*D))) in L(pg, 'O lobo direito') and ('volume ~ %d cm³' % rnd(vl(*E))) in L(pg, 'O lobo esquerdo'), [L(pg, 'O lobo direito'), L(pg, 'O lobo esquerdo')])
    ck('e o total = soma', ('em %d cm³' % rnd(vl(*D) + vl(*E))) in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    pg = fresh(b, 2)
    lobe(pg, 'O lobo direito', [str(x) for x in D]); lobe(pg, 'O lobo esquerdo', [str(x) for x in E])
    ck('"Glândula tireoide ... de volume ___ cm³" (linha acima) recebe a soma', ('de volume %d cm³' % rnd(vl(*D) + vl(*E))) in L(pg, 'Glândula tireoide'), L(pg, 'Glândula tireoide'))
    pg = fresh(b, 3)
    lobe(pg, 'O lobo esquerdo', [str(x) for x in E])
    ck('um lobo só (ex.: lobectomia): total = esse lobo', ('em %d cm³' % rnd(vl(*E))) in L(pg, 'Volume glandular') and 'no laudo' in st(pg), [L(pg, 'Volume glandular'), st(pg)])
    pg = fresh(b, 4)
    lobe(pg, 'O lobo direito', [str(x) for x in D], 0); lobe(pg, 'O lobo direito', [str(x) for x in E], 1)
    ck('dois "lobo direito": ambíguo, não calcula', 'estimado em ___ cm³' in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    pg = fresh(b, 5)
    ck('sem linha de volume total: aviso no painel', 'sem linha de volume total' in st(pg), st(pg))
    ck('sem erros de console', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
