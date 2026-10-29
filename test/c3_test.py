"""C3: biometria fetal no laudo (PFE Hadlock 1985, IG composta Hadlock 1984, IG pelo PFE inverso de Hadlock 1991).
Banco genérico embutido (frases equivalentes, nenhum texto real). Referências calculadas aqui em Python, independente do JS.
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
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b)
    ck('caixas no painel', pg.locator('#ucPfe').count() == 1 and pg.locator('#ucIgc').count() == 1 and pg.locator('#ucIgp').count() == 1 and not pg.is_checked('#ucIgp'))
    # funções puras x Python
    CASES = [(80, 290, 270, 60), (85, 310, 300, 65), (50, 180, 160, 35), (92, 330, 340, 72), (75.5, 280.5, 250, 55.5)]
    for c in CASES:
        g, ig, igp = ref(*c)
        js = pg.evaluate('(c) => { var m = {bpd:c[0],hc:c[1],ac:c[2],fl:c[3]}, g = Math.round(UFCalcBio.pfe(m)); return [g, UFCalcBio.igComp(m), UFCalcBio.igPeso(g)]; }', list(c))
        print('   ref', c, '-> PFE', g, 'g | IG comp %.4f (%s) | IG pelo PFE %s' % (ig, sd(ig)[2], igp and '%.4f (%s)' % (igp, sd(igp)[2])))
        ck('JS = Python %s' % (c,), js[0] == g and abs(js[1] - ig) < 1e-9 and (js[2] is None) == (igp is None) and (igp is None or abs(js[2] - igp) < 1e-9), js)
    ck('32,0 -> 32 semanas e 0 dia', pg.evaluate('UFCalcBio.semDias(32).txt') == '32 semanas e 0 dia')
    ck('32,99 -> 33 semanas e 0 dia', pg.evaluate('UFCalcBio.semDias(32.99).txt') == '33 semanas e 0 dia')
    ck('32,15 -> 32 semanas e 1 dia', pg.evaluate('UFCalcBio.semDias(32.15).txt') == '32 semanas e 1 dia')
    ck('32,43 -> 32 semanas e 3 dias', pg.evaluate('UFCalcBio.semDias(32.43).txt') == '32 semanas e 3 dias')
    ck('IG pelo PFE fora de 14-42 -> null', pg.evaluate('UFCalcBio.igPeso(20) === null && UFCalcBio.igPeso(9000) === null'))
    # laudo: campo faltando
    bio(pg, ['80', '290', '270', None])
    ck('faltando CF: PFE em branco', 'em: ___ gramas' in L(pg, '- Peso'), L(pg, '- Peso'))
    ck('faltando CF: IG em branco', 'a ___ semanas (±' in L(pg, 'Biometria Fetal Composta'), L(pg, 'Biometria Fetal Composta'))
    typ(pg, ix(pg, 'Comprimento do fêmur'), '60')
    g, ig, igp = ref(80, 290, 270, 60)
    ck('PFE no laudo = %d' % g, L(pg, '- Peso').strip() == '- Peso fetal estimado em: %d gramas (+- 15%%).' % g, L(pg, '- Peso'))
    ck('IG composta no laudo = %s' % sd(ig)[2], L(pg, 'Biometria Fetal Composta') == 'Biometria Fetal Composta equivalente a %s (± 2/3 semanas).' % sd(ig)[2], L(pg, 'Biometria Fetal Composta'))
    ck('IG pelo PFE desligada por padrao', 'peso fetal: ___ semanas' in L(pg, 'Idade gestacional'), L(pg, 'Idade gestacional'))
    pg.evaluate('UFCalc.open()'); pg.check('#ucIgp'); pg.wait_for_timeout(100)
    ck('IG pelo PFE ligada = %s' % sd(igp)[2], L(pg, 'Idade gestacional') == 'Idade gestacional estimada pelo peso fetal: %s.' % sd(igp)[2], L(pg, 'Idade gestacional'))
    pg.uncheck('#ucIgp'); pg.wait_for_timeout(100)
    ck('IG pelo PFE desligada limpa', 'peso fetal: ___ semanas.' in L(pg, 'Idade gestacional'), L(pg, 'Idade gestacional'))
    pg.uncheck('#ucPfe'); pg.wait_for_timeout(100); ck('PFE desligado limpa', 'em: ___ gramas' in L(pg, '- Peso'))
    pg.check('#ucPfe'); pg.wait_for_timeout(100); ck('PFE religado', '%d gramas' % g in L(pg, '- Peso'))
    # vírgula
    typ(pg, ix(pg, 'Diâmetro biparietal'), '75,5', True); typ(pg, ix(pg, 'Circunferência cefálica'), '280,5', True)
    typ(pg, ix(pg, 'Circunferência abdominal'), '250', True); typ(pg, ix(pg, 'Comprimento do fêmur'), '55,5', True)
    g2, ig2, _ = ref(75.5, 280.5, 250, 55.5)
    ck('virgula: PFE %d e %s' % (g2, sd(ig2)[2]), '%d gramas' % g2 in L(pg, '- Peso') and sd(ig2)[2] + ' (±' in L(pg, 'Biometria Fetal Composta'), (L(pg, '- Peso'), L(pg, 'Biometria Fetal Composta')))
    # edição manual
    typ(pg, ix(pg, 'Peso fetal'), '1500', True)
    ck('PFE manual mantido', '1500 gramas' in L(pg, '- Peso'), L(pg, '- Peso'))
    typ(pg, ix(pg, 'Biometria Fetal Composta'), '30', True)
    ck('IG manual mantida (sem sufixo)', L(pg, 'Biometria Fetal Composta') == 'Biometria Fetal Composta equivalente a 30 semanas (± 2/3 semanas).', L(pg, 'Biometria Fetal Composta'))
    typ(pg, ix(pg, 'Circunferência abdominal'), '270', True)
    g3, ig3, _ = ref(75.5, 280.5, 270, 55.5)
    ck('medida muda -> recalcula PFE %d e IG %s' % (g3, sd(ig3)[2]), '%d gramas' % g3 in L(pg, '- Peso') and sd(ig3)[2] + ' (±' in L(pg, 'Biometria Fetal Composta'), (L(pg, '- Peso'), L(pg, 'Biometria Fetal Composta')))
    # absurdos
    typ(pg, ix(pg, 'Circunferência abdominal'), '99999', True)
    ck('absurdo: PFE e IG em branco', '___ gramas' in L(pg, '- Peso') and '___ semanas (±' in L(pg, 'Biometria Fetal Composta'), (L(pg, '- Peso'), L(pg, 'Biometria Fetal Composta')))
    typ(pg, ix(pg, 'Circunferência abdominal'), '0', True)
    ck('zero: nao preenche', '___ gramas' in L(pg, '- Peso'), L(pg, '- Peso'))
    pg.close()
    # desfazer/refazer
    pg = fresh(b); bio(pg, ['80', '290', '270', '60'])
    ck('antes de desfazer', '%d gramas' % g in L(pg, '- Peso'))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    a = L(pg, '- Peso'); ck('Ctrl+Z: PFE nao fica velho', '%d gramas' % g not in a, a)
    for _ in range(8): pg.keyboard.press('Control+z'); pg.wait_for_timeout(80)
    for _ in range(14): pg.keyboard.press('Control+y'); pg.wait_for_timeout(80)
    a = L(pg, '- Peso'); c2 = L(pg, 'Biometria Fetal Composta')
    ck('Ctrl+Y: volta PFE e IG', '%d gramas' % g in a and sd(ig)[2] + ' (±' in c2, (a, c2))
    ck('sufixo unico apos desfazer/refazer', c2.count('dia') == 1, c2)
    pg.close()
    # gemelar
    pg = fresh(b, 1); bio(pg, ['80', '290', '270', '60'], 0); bio(pg, ['85', '310', '300', '65'], 1)
    gA, igA, _ = ref(80, 290, 270, 60); gB, igB, _ = ref(85, 310, 300, 65)
    ck('gemelar A PFE %d' % gA, '%d gramas' % gA in L(pg, '- Peso', 0), L(pg, '- Peso', 0))
    ck('gemelar B PFE %d' % gB, '%d gramas' % gB in L(pg, '- Peso', 1), L(pg, '- Peso', 1))
    ck('gemelar IG A %s' % sd(igA)[2], sd(igA)[2] in L(pg, 'Biometria fetal composta do feto A'), L(pg, 'Biometria fetal composta do feto A'))
    ck('gemelar IG B %s' % sd(igB)[2], sd(igB)[2] in L(pg, 'Biometria fetal composta do feto B'), L(pg, 'Biometria fetal composta do feto B'))
    ck('gemelar: linha sem feto nao preenche (ambigua)', '___ semanas' in L(pg, 'Biometria Fetal Composta'), L(pg, 'Biometria Fetal Composta'))
    typ(pg, ix(pg, 'Comprimento do fêmur', 1), '', True); pg.keyboard.press('Backspace'); pg.wait_for_timeout(100)
    ck('gemelar: apagar B nao mexe em A', '%d gramas' % gA in L(pg, '- Peso', 0) and '___ gramas' in L(pg, '- Peso', 1), (L(pg, '- Peso', 0), L(pg, '- Peso', 1)))
    pg.close()
    # outro formato (rótulos "mede", ordem diferente, outras medidas no meio)
    pg = fresh(b, 2); bio(pg, ['80', '290', '270', '60'], 0, ['Diâmetro biparietal', 'Perímetro cefálico', 'Circunferência abdominal', 'Comprimento femoral'])
    typ(pg, ix(pg, 'Diâmetro cerebelar'), '40'); typ(pg, ix(pg, 'Comprimento do úmero'), '55')
    ck('formato alternativo: PFE %d' % g, L(pg, 'Peso fetal') == 'Peso fetal estimado em %d gramas (+-10%%).' % g, L(pg, 'Peso fetal'))
    ck('razao CF/CA nao preenchida', 'CF/CA: ___' in L(pg, 'CF/CA'), L(pg, 'CF/CA'))
    ck('sem erros no console', not ERR, ERR)
    b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
