"""C4: percentis Hadlock ao lado de cada medida (DBP/CC/CA/CF: Hadlock 1984, normal com DP fixo; PFE: Hadlock 1991, ln com DP 0,12).
Banco genérico embutido (frases equivalentes, nenhum texto real). Referências calculadas aqui em Python (math.erfc; scipy.stats.norm se instalado), independente do JS.
Uso: python test/c3_test.py   (precisa playwright + chromium)"""
import os, sys, tempfile, math
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Obst Teste
@@EXAME_FULL OBST TESTE
@@TEMPLATE Unico
OBST TESTE
Feto unico.

BIOMETRIA FETAL
    • Diâmetro biparietal (DBP): * mm.
    • Circunferência cefálica (CC): * mm.
    • Circunferência abdominal (CA): * mm.
    • Comprimento do fêmur (CF): * mm.
    • Peso fetal estimado em: * gramas (+- 15%).

Hipótese:
Biometria Fetal Composta equivalente a * semanas (± 2/3 semanas).
Idade gestacional estimada pelo peso fetal: * semanas.

@@TEMPLATE Gemelar
OBST GEMELAR
FETO A
Feto A descrito.
BIOMETRIA FETAL A
    • Diâmetro biparietal (DBP): * mm.
    • Circunferência cefálica (CC): * mm.
    • Circunferência abdominal (CA): * mm.
    • Comprimento do fêmur (CF): * mm.
    • Peso fetal estimado em: * gramas (+- 15%).
FETO B
Feto B descrito.
BIOMETRIA FETAL B
    • Diâmetro biparietal (DBP): * mm.
    • Circunferência cefálica (CC): * mm.
    • Circunferência abdominal (CA): * mm.
    • Comprimento do fêmur (CF): * mm.
    • Peso fetal estimado em: * gramas (+- 15%).
Hipótese:
Biometria fetal composta do feto A equivalente a * semanas (± 2/3 semanas).
Biometria fetal composta do feto B equivalente a * semanas (± 2/3 semanas).
Biometria Fetal Composta equivalente a * semanas (± 2/3 semanas).

@@TEMPLATE Outra
OBST OUTRA
Biometria fetal:
Diâmetro cerebelar transverso mede: * mm.
Diâmetro biparietal mede: * mm.
Perímetro cefálico mede: * mm.
Comprimento femoral: * mm.
Comprimento do úmero: * mm.
Circunferência abdominal: * mm.
Peso fetal estimado em * gramas (+-10%).
CF/CA: * (20-24).
'''
# ---- referência independente (Python) ----
def ref(b, h, a, f):
    b, h, a, f = b / 10, h / 10, a / 10, f / 10
    g = 10 ** (1.3596 - 0.00386 * a * f + 0.0064 * h + 0.00061 * b * a + 0.0424 * a + 0.174 * f)
    ig = 10.85 + 0.060 * h * f + 0.670 * b + 0.168 * a
    gi = int(math.floor(g + 0.5)); C = math.log(gi) - 0.578; d = 0.332 ** 2 - 4 * 0.00354 * C
    igp = (0.332 - math.sqrt(d)) / (2 * 0.00354) if d >= 0 else None
    if igp is not None and not (14 <= igp <= 42): igp = None
    return gi, ig, igp
def sd(x):
    d = int(math.floor(x * 7 + 0.5)); w, r = d // 7, d % 7
    return w, r, '%d semanas e %d %s' % (w, r, 'dia' if r <= 1 else 'dias')
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
ERR = []
def fresh(b, model=0):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text)); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.locator('[data-model]').nth(model).dblclick(); pg.wait_for_timeout(400)
    return pg
def L(pg, start, nth=0):
    ls = [l for l in pg.evaluate('UFTest.reportText()').splitlines() if l.strip().startswith(start)]
    return ls[nth] if len(ls) > nth else ''
def ix(pg, start, nth=0):
    return pg.evaluate('''(a) => { var all = [].slice.call(document.querySelectorAll('#editor .fld')), out = [];
      all.forEach(function (f, i) { var n = f; while (n && n.nodeName !== 'DIV') { n = n.parentNode; }
        if ((n.textContent || '').replace(/^[\\s\\u2022\\u00a0]+/, '').indexOf(a[0]) === 0) { out.push(i); } }); return out[a[1]]; }''', [start, nth])
def typ(pg, i, txt, over=False):
    bb = pg.locator('#editor .fld').nth(i).bounding_box(); pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(50)
    if over:
        pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i], r = document.createRange(); r.selectNodeContents(f);
          var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''', i)
    pg.keyboard.type(txt); pg.wait_for_timeout(70)
LBL = ['Diâmetro biparietal', 'Circunferência cefálica', 'Circunferência abdominal', 'Comprimento do fêmur']
def bio(pg, vals, nth=0, labels=LBL):
    for k, v in enumerate(vals):
        if v is not None: typ(pg, ix(pg, labels[k], nth), v)

try:
    from scipy.stats import norm; PHI = norm.cdf; PHI_SRC = 'scipy'
except Exception:
    PHI = lambda z: 0.5 * math.erfc(-z / math.sqrt(2)); PHI_SRC = 'math.erfc'
MEAN = {'bpd': lambda a: -3.08 + 0.41 * a - 0.000061 * a ** 3, 'hc': lambda a: -11.48 + 1.56 * a - 0.0002548 * a ** 3,
        'ac': lambda a: -13.3 + 1.61 * a - 0.00998 * a ** 2, 'fl': lambda a: -3.91 + 0.427 * a - 0.0034 * a ** 2}
SD = {'bpd': 0.3, 'hc': 1.0, 'ac': 1.34, 'fl': 0.3}
def lab(p):
    return '<p3' if p < 3 else ('>p97' if p > 97 else 'p%d' % int(math.floor(p + 0.5)))
def pm(k, mm, days): a = days / 7.0; return lab(100 * PHI((mm / 10.0 - MEAN[k](a)) / SD[k]))
def pp(g, days): a = days / 7.0; return lab(100 * PHI((math.log(g) - (0.578 + 0.332 * a - 0.00354 * a * a)) / 0.12))
print('Phi de referencia:', PHI_SRC)
def setig(pg, w, d): pg.evaluate('(a) => UFCalc.setIgRelatada(a[0], a[1])', [w, d]); pg.wait_for_timeout(80)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b)
    ck('caixa Percentis ligada', pg.is_checked('#ucPct'))
    # Φ do JS contra referência
    zs = [-8, -6, -4, -3, -2.5, -1.8808, -1.2816, -0.5, 0, 0.3, 1, 1.645, 2, 3, 5, 7.5]
    js = pg.evaluate('(zs) => zs.map(function (z) { return UFCalcBio.phi(z); })', zs)
    err = max(abs(js[i] - PHI(z)) for i, z in enumerate(zs)); print('   max |Phi_js - Phi_ref| = %.3g' % err)
    ck('Phi precisao >= 1e-7 (abs)', err < 1e-7, err)
    CASES = [('bpd', 78, 220), ('hc', 290, 224), ('ac', 270, 224), ('fl', 60, 224), ('bpd', 50, 224), ('fl', 75, 224), ('ac', 250, 98), ('hc', 340, 280), ('bpd', 80, 225)]
    for k, mm, d in CASES:
        r = pm(k, mm, d); j = pg.evaluate('(a) => UFCalcBio.pctMeasure(a[0], a[1], a[2])', [k, mm, d])
        print('   ref %s %s mm IG %d d -> %s' % (k, mm, d, r)); ck('JS=Python %s %s %d' % (k, mm, d), j == r, j)
    for g, d in [(1740, 224), (1000, 224), (3000, 224), (1394, 205), (3619, 280), (93, 98)]:
        r = pp(g, d); j = pg.evaluate('(a) => UFCalcBio.pctPfe(a[0], a[1])', [g, d])
        print('   ref PFE %d g IG %d d -> %s' % (g, d, r)); ck('JS=Python PFE %d %d' % (g, d), j == r, j)
    # máxima diferença equação x Tabela III (valores da tabela em percentis-fontes.md, conferidos)
    T3 = {14: (2.5, 9.7, 7.3, 1.4), 20: (4.6, 17.7, 15.0, 3.3), 25: (6.2, 23.5, 20.8, 4.6), 30: (7.6, 28.4, 26.1, 5.8), 35: (8.7, 32.2, 30.9, 6.8), 40: (9.4, 34.6, 35.3, 7.7)}
    mx = max(abs(round(pg.evaluate('(a) => UFCalcBio.MEAN[a[0]](a[1])', [k, w]), 1) - T3[w][i]) for w in T3 for i, k in enumerate(['bpd', 'hc', 'ac', 'fl']))
    ck('equacoes ~ Tabela III (<=0,2 cm)', mx <= 0.2 + 1e-9, mx)
    # laudo
    bio(pg, ['80', '290', '270', '60'])
    ck('sem IG: nada', '(p' not in pg.evaluate('UFTest.reportText()') and '<p3' not in pg.evaluate('UFTest.reportText()'))
    setig(pg, 32, 0); d = 224; g = ref(80, 290, 270, 60)[0]
    ck('DBP com percentil', L(pg, '- Diâmetro').strip() == '- Diâmetro biparietal (DBP): 80 mm (%s).' % pm('bpd', 80, d), L(pg, '- Diâmetro'))
    ck('CC', L(pg, '- Circunferência cefálica').strip().endswith('290 mm (%s).' % pm('hc', 290, d)), L(pg, '- Circunferência cefálica'))
    ck('CA', L(pg, '- Circunferência abdominal').strip().endswith('270 mm (%s).' % pm('ac', 270, d)), L(pg, '- Circunferência abdominal'))
    ck('CF', L(pg, '- Comprimento').strip().endswith('60 mm (%s).' % pm('fl', 60, d)), L(pg, '- Comprimento'))
    ck('PFE: apos gramas, antes de (+- 15%%)', L(pg, '- Peso').strip() == '- Peso fetal estimado em: %d gramas (%s) (+- 15%%).' % (g, pp(g, d)), L(pg, '- Peso'))
    ck('IG composta intacta', 'equivalente a ' in L(pg, 'Biometria Fetal Composta') and '(p' not in L(pg, 'Biometria Fetal Composta'))
    setig(pg, 28, 3); d = 199
    ck('IG muda: recalcula sem acumular', L(pg, '- Diâmetro').strip() == '- Diâmetro biparietal (DBP): 80 mm (%s).' % pm('bpd', 80, d) and L(pg, '- Peso').count('(') == 2, (L(pg, '- Diâmetro'), L(pg, '- Peso')))
    typ(pg, ix(pg, 'Diâmetro biparietal'), '50', True)
    ck('medida muda: <p3', L(pg, '- Diâmetro').strip() == '- Diâmetro biparietal (DBP): 50 mm (<p3).', L(pg, '- Diâmetro'))
    typ(pg, ix(pg, 'Diâmetro biparietal'), '80', True)
    typ(pg, ix(pg, 'Comprimento do fêmur'), '75', True)
    ck('>p97', '75 mm (>p97).' in L(pg, '- Comprimento'), L(pg, '- Comprimento'))
    setig(pg, 13, 6); t = pg.evaluate('UFTest.reportText()'); ck('13s6d: sem saida', '(p' not in t and 'p3)' not in t and 'p97)' not in t)
    setig(pg, 40, 0); ck('40s0d: mostra', '80 mm (%s).' % pm('bpd', 80, 280) in L(pg, '- Diâmetro'), L(pg, '- Diâmetro'))
    setig(pg, 40, 1); t = pg.evaluate('UFTest.reportText()'); ck('40s1d: sem saida', '(p' not in t and 'p3)' not in t and 'p97)' not in t)
    setig(pg, 14, 0); ck('14s0d: mostra', '80 mm (%s).' % pm('bpd', 80, 98) in L(pg, '- Diâmetro'), L(pg, '- Diâmetro'))
    setig(pg, None, None); ck('IG apagada: some', pg.locator('#editor .uc-pct').count() == 0)
    setig(pg, 32, 0)
    # edição manual do PFE: percentil do valor mostrado
    typ(pg, ix(pg, 'Peso fetal'), '3000', True)
    ck('PFE manual: percentil do valor digitado', L(pg, '- Peso').strip() == '- Peso fetal estimado em: 3000 gramas (%s) (+- 15%%).' % pp(3000, 224), L(pg, '- Peso'))
    # liga/desliga
    pg.evaluate('UFCalc.open()'); pg.uncheck('#ucPct'); pg.wait_for_timeout(100)
    t = pg.evaluate('UFTest.reportText()'); ck('desligado: nenhum trecho', pg.locator('#editor .uc-pct').count() == 0 and ' (p' not in t, t[:200])
    pg.check('#ucPct'); pg.wait_for_timeout(100); ck('religado', pg.locator('#editor .uc-pct').count() == 5, pg.locator('#editor .uc-pct').count())
    # cursor preservado ao mudar IG pelo painel
    typ(pg, ix(pg, 'Circunferência cefálica'), '')
    r0 = pg.evaluate('(function(){var r=UFTest.S.savedRange; return r ? [r.startContainer.textContent, r.startOffset] : null})()')
    pg.fill('#ucIgW', '33'); pg.wait_for_timeout(100)
    r1 = pg.evaluate('(function(){var r=UFTest.S.savedRange; return r ? [r.startContainer.textContent, r.startOffset] : null})()')
    ck('cursor preservado (IG pelo painel)', r0 == r1 and r0 is not None, (r0, r1))
    ck('IG pelo painel recalcula', '(%s)' % pm('hc', 290, 33 * 7) in L(pg, '- Circunferência cefálica'), L(pg, '- Circunferência cefálica'))
    typ(pg, ix(pg, 'Circunferência abdominal'), '', True); pg.keyboard.press('Backspace'); pg.wait_for_timeout(100)
    a = L(pg, '- Circunferência abdominal'); ck('medida apagada: trecho some', '(p' not in a and '<p3' not in a and 'mm.' in a, a)
    ck('campo em branco ainda detectado', pg.evaluate("document.querySelectorAll('#editor .fld:not(.f-ok)').length") >= 1 and pg.evaluate("document.querySelectorAll('#editor .uc-pct.fld').length") == 0)
    pg.close()
    # desfazer/refazer
    pg = fresh(b); setig(pg, 32, 0); bio(pg, ['80', '290', '270', '60'])
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    a = L(pg, '- Comprimento'); ck('Ctrl+Z: CF sem percentil velho', '60 mm (%s)' % pm('fl', 60, 224) not in a and a.count('(') <= 2, a)
    for _ in range(8): pg.keyboard.press('Control+z'); pg.wait_for_timeout(80)
    for _ in range(14): pg.keyboard.press('Control+y'); pg.wait_for_timeout(80)
    a = L(pg, '- Comprimento'); ck('Ctrl+Y: volta com 1 percentil', a.strip() == '- Comprimento do fêmur (CF): 60 mm (%s).' % pm('fl', 60, 224), a)
    ck('Ctrl+Y: PFE com 1 percentil', L(pg, '- Peso').count('(p') + L(pg, '- Peso').count('(<') + L(pg, '- Peso').count('(>') == 1, L(pg, '- Peso'))
    # copiar inclui o trecho e campos em branco continuam contados
    ck('texto do laudo (copiar) inclui percentil', '(%s)' % pm('bpd', 80, 224) in pg.evaluate('UFTest.reportText()'))
    pg.close()
    # gemelar
    pg = fresh(b, 1); setig(pg, 32, 0); bio(pg, ['80', '290', '270', '60'], 0); bio(pg, ['85', '310', '300', '65'], 1)
    ck('gemelar A', '80 mm (%s).' % pm('bpd', 80, 224) in L(pg, '- Diâmetro', 0), L(pg, '- Diâmetro', 0))
    ck('gemelar B', '85 mm (%s).' % pm('bpd', 85, 224) in L(pg, '- Diâmetro', 1), L(pg, '- Diâmetro', 1))
    gB = ref(85, 310, 300, 65)[0]; ck('gemelar PFE B', '%d gramas (%s)' % (gB, pp(gB, 224)) in L(pg, '- Peso', 1), L(pg, '- Peso', 1))
    pg.close()
    # morfológico
    pg = fresh(b, 2); setig(pg, 32, 0); bio(pg, ['80', '290', '270', '60'], 0, ['Diâmetro biparietal', 'Perímetro cefálico', 'Circunferência abdominal', 'Comprimento femoral'])
    typ(pg, ix(pg, 'Comprimento do úmero'), '55')
    ck('morfologico: DBP', L(pg, 'Diâmetro biparietal') == 'Diâmetro biparietal mede: 80 mm (%s).' % pm('bpd', 80, 224), L(pg, 'Diâmetro biparietal'))
    ck('morfologico: PFE (+-10%)', L(pg, 'Peso fetal') == 'Peso fetal estimado em %d gramas (%s) (+-10%%).' % (g, pp(g, 224)), L(pg, 'Peso fetal'))
    ck('morfologico: umero sem percentil', L(pg, 'Comprimento do úmero') == 'Comprimento do úmero: 55 mm.', L(pg, 'Comprimento do úmero'))
    ck('sem erros no console', not ERR, ERR)
    b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
