"""C5: Doppler obstétrico: relação IP umbilical/IP cerebral média e RCP com p5 de Ebbing 2007 (interpolado por dia).
Banco genérico embutido (frases equivalentes, nenhum texto real). Referências calculadas aqui em Python, independente do JS (tabela de Ebbing copiada de /workspace/doppler-fontes.md).
Uso: python test/c3_test.py   (precisa playwright + chromium)"""
import os, sys, tempfile, math
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Doppler Teste
@@EXAME_FULL DOPPLER TESTE
@@TEMPLATE Padrao
DOPPLER TESTE
Fluxo do leito vascular fetoplacentário:
Artéria Umbilical: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

Fluxo do leito vascular fetal:
Artéria Cerebral Média: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

Artérias uterinas:
- Índice de pulsatilidade (IP) médio das artérias uterinas: *

PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).
- Relação cerebroplacentária (RCP): IP cerebral média / IP umbilical = *,* (p5 para * semanas: *,*).

@@TEMPLATE SemRCP
DOPPLER SO RELACAO
Artéria Umbilical: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
Artéria Cerebral Média: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).
'''
EBB = {21: 0.90, 22: 0.98, 23: 1.07, 24: 1.16, 25: 1.24, 26: 1.32, 27: 1.40, 28: 1.47, 29: 1.53, 30: 1.58, 31: 1.62, 32: 1.64, 33: 1.65, 34: 1.63, 35: 1.60, 36: 1.55, 37: 1.48, 38: 1.40, 39: 1.29}
def f2(x):
    c = int(math.floor(x * 100 + 0.5)); return '%d,%02d' % (c // 100, c % 100)
def p5(d):
    if d is None or d < 147 or d > 273: return None
    w, r = d // 7, d % 7
    return EBB[w] if r == 0 else EBB[w] + (EBB[w + 1] - EBB[w]) * r / 7.0
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

def setig(pg, w, d): pg.evaluate('(a) => UFCalc.setIgRelatada(a[0], a[1])', [w, d]); pg.wait_for_timeout(80)
UA, ACM = 'Índice de pulsatilidade (IP): ', None
def ipix(pg, n): return ix(pg, '- Índice de pulsatilidade (IP):', n)
def ips(pg, ua, acm):
    if ua is not None: typ(pg, ipix(pg, 0), ua, True)
    if acm is not None: typ(pg, ipix(pg, 1), acm, True)
REL = '- Relação: IP umbilical'; RCP = '- Relação cerebroplacentária'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b)
    ck('caixa Doppler ligada', pg.is_checked('#ucDop'))
    ck('tabela p5 do JS = doppler-fontes.md', pg.evaluate('JSON.stringify(UFCalcDop.P5)') == '{' + ','.join('"%d":%s' % (k, repr(v)) for k, v in sorted(EBB.items())) + '}', pg.evaluate('JSON.stringify(UFCalcDop.P5)'))
    for d in [147, 150, 153, 196, 200, 230, 273, 146, 274]:
        r = p5(d); j = pg.evaluate('(d) => UFCalcDop.p5(d)', d)
        print('   ref p5 IG %d d (%ds%dd) -> %s' % (d, d // 7, d % 7, 'nada' if r is None else '%.6f -> %s' % (r, f2(r))))
        ck('p5 JS=Python %d' % d, (r is None and j is None) or (r is not None and j is not None and abs(r - j) < 1e-12 and f2(r) == pg.evaluate('(x) => UFCalcDop.f2(x)', j)), j)
    # só um IP
    ips(pg, '1,05', None)
    ck('falta IP ACM: relação em branco', '= ___ (V.R.' in L(pg, REL), L(pg, REL))
    typ(pg, ipix(pg, 1), '1,68', True)
    ck('relação UA/ACM = %s' % f2(1.05 / 1.68), L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = %s (V.R.: < 1).' % f2(1.05 / 1.68), L(pg, REL))
    ck('sem IG: RCP preenchida, p5 em branco', ('= %s (p5 para ___ semanas' % f2(1.68 / 1.05)) in L(pg, RCP), L(pg, RCP))
    ck('IP uterinas intacto', L(pg, '- Índice de pulsatilidade (IP) médio').endswith(': ___'), L(pg, '- Índice de pulsatilidade (IP) médio'))
    typ(pg, ix(pg, '- Índice de pulsatilidade (IP) médio'), '2,5')
    ck('IP uterinas nao entra na conta', L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = %s (V.R.: < 1).' % f2(1.05 / 1.68), L(pg, REL))
    setig(pg, 28, 3); d = 199; r = 1.68 / 1.05
    ck('RCP %s com p5 28s3d = %s' % (f2(r), f2(p5(d))), L(pg, RCP) == '- Relação cerebroplacentária (RCP): IP cerebral média / IP umbilical = %s (p5 para 28 semanas: %s).' % (f2(r), f2(p5(d))), L(pg, RCP))
    # abaixo do p5
    ips(pg, '1,20', '1,50'); r = 1.50 / 1.20
    ck('RCP %s < p5 %s: abaixo do p5' % (f2(r), f2(p5(d))), L(pg, RCP) == '- Relação cerebroplacentária (RCP): IP cerebral média / IP umbilical = %s (abaixo do p5) (p5 para 28 semanas: %s).' % (f2(r), f2(p5(d))), L(pg, RCP))
    ck('relação inversa %s' % f2(1.2 / 1.5), '= %s (V.R.' % f2(1.2 / 1.5) in L(pg, REL), L(pg, REL))
    ips(pg, '1,00', None); r = 1.5
    ck('volta acima do p5: trecho some', '(abaixo' not in L(pg, RCP) and '= %s (p5' % f2(r) in L(pg, RCP), L(pg, RCP))
    # faixa de IG
    setig(pg, 20, 6); ck('20s6d: p5 e semanas em branco, sem classificação', '(p5 para ___ semanas: ___)' in L(pg, RCP) and '(abaixo' not in L(pg, RCP), L(pg, RCP))
    setig(pg, 21, 0); ck('21s0d: p5 0,90', '(p5 para 21 semanas: 0,90)' in L(pg, RCP), L(pg, RCP))
    setig(pg, 39, 0); ck('39s0d: p5 1,29', '(p5 para 39 semanas: 1,29)' in L(pg, RCP), L(pg, RCP))
    setig(pg, 39, 1); ck('39s1d: nada', '(p5 para ___ semanas: ___)' in L(pg, RCP), L(pg, RCP))
    setig(pg, 32, 4); ck('32s4d: p5 interpolado %s' % f2(p5(228)), '(p5 para 32 semanas: %s)' % f2(p5(228)) in L(pg, RCP), L(pg, RCP))
    # edição manual
    typ(pg, ix(pg, REL), '0,70', True)
    ck('relação manual mantida', '= 0,70 (V.R.' in L(pg, REL), L(pg, REL))
    setig(pg, 33, 0); ck('IG muda: manual mantida (nao depende de IG)', '= 0,70 (V.R.' in L(pg, REL), L(pg, REL))
    typ(pg, ipix(pg, 0), '1,10', True)
    ck('IP muda: recalcula sobre manual', '= %s (V.R.' % f2(1.1 / 1.5) in L(pg, REL), L(pg, REL))
    # IP inválido / zero
    typ(pg, ipix(pg, 1), '0', True)
    ck('IP ACM = 0: relação e RCP em branco', '= ___ (V.R.' in L(pg, REL) and 'IP umbilical = ___' in L(pg, RCP) and '(abaixo' not in L(pg, RCP), (L(pg, REL), L(pg, RCP)))
    typ(pg, ipix(pg, 1), 'abc', True)
    ck('IP texto: em branco', '= ___ (V.R.' in L(pg, REL), L(pg, REL))
    # liga/desliga
    typ(pg, ipix(pg, 1), '1,5', True); pg.evaluate('UFCalc.open()'); pg.uncheck('#ucDop'); pg.wait_for_timeout(100)
    ck('desligado: tudo em branco', '= ___ (V.R.' in L(pg, REL) and 'IP umbilical = ___' in L(pg, RCP), (L(pg, REL), L(pg, RCP)))
    pg.check('#ucDop'); pg.wait_for_timeout(100); ck('religado', '= %s (V.R.' % f2(1.1 / 1.5) in L(pg, REL), L(pg, REL))
    # cursor preservado ao mudar IG pelo painel
    typ(pg, ix(pg, '- Índice de resistência'), '')
    r0 = pg.evaluate('(function(){var r=UFTest.S.savedRange; return r ? [r.startContainer.textContent, r.startOffset] : null})()')
    pg.fill('#ucIgW', '30'); pg.wait_for_timeout(100)
    r1 = pg.evaluate('(function(){var r=UFTest.S.savedRange; return r ? [r.startContainer.textContent, r.startOffset] : null})()')
    ck('cursor preservado', r0 == r1 and r0 is not None, (r0, r1))
    pg.close()
    # desfazer/refazer
    pg = fresh(b); setig(pg, 28, 0); typ(pg, ipix(pg, 0), '1,2'); typ(pg, ipix(pg, 1), '1,5')
    a0 = L(pg, RCP); ck('antes de desfazer: abaixo do p5', '(abaixo do p5)' in a0, a0)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    a = L(pg, RCP); ck('Ctrl+Z: sem valor velho', '= %s' % f2(1.5 / 1.2) not in a, a)
    for _ in range(8): pg.keyboard.press('Control+z'); pg.wait_for_timeout(80)
    for _ in range(14): pg.keyboard.press('Control+y'); pg.wait_for_timeout(80)
    a = L(pg, RCP); ck('Ctrl+Y: volta igual e sem duplicar', a == a0, (a, a0))
    ck('texto do laudo (copiar) inclui a classificação', '(abaixo do p5)' in pg.evaluate('UFTest.reportText()'))
    pg.close()
    # modelo sem linha de RCP (como o banco real)
    pg = fresh(b, 1); typ(pg, ipix(pg, 0), '0,9'); typ(pg, ipix(pg, 1), '1,8')
    ck('sem linha de RCP: só a relação (0,50)', L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = 0,50 (V.R.: < 1).' and pg.locator('#editor .uc-dop').count() == 0, L(pg, REL))
    ck('sem erros no console', not ERR, ERR)
    b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
