"""C6b: editar um campo JÁ PREENCHIDO não pode desfazer o campo (span .fld) nem apagar o cálculo.
Reproduz o relato do Dr. Renato (biometria: DBP editado, PFE some). Banco genérico embutido (nenhum texto real).
Uso: python test/c6b_test.py   (precisa playwright + chromium)"""
import os, sys, tempfile, math
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Edicao Teste
@@EXAME_FULL EDICAO TESTE
@@TEMPLATE Unico
EDICAO TESTE
Batimentos cardiacos fetais ( * bpm).

BIOMETRIA FETAL
    • Diâmetro biparietal (DBP): * mm.
    • Circunferência cefálica (CC): * mm.
    • Circunferência abdominal (CA): * mm.
    • Comprimento do fêmur (CF): * mm.
    • Peso fetal estimado em: * gramas (+- 15%).

Orgao direito medindo cerca de * x * x * mm (LxAPxT) (volume ~ * cm³).

Artéria Umbilical: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
Artéria Cerebral Média: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).
'''
def pfe(b, h, a, f):   # Hadlock 1985 (BPD, HC, AC, FL), mm -> g (independente do JS)
    b, h, a, f = b / 10.0, h / 10.0, a / 10.0, f / 10.0
    return int(math.floor(10 ** (1.3596 - 0.00386 * a * f + 0.0064 * h + 0.00061 * b * a + 0.0424 * a + 0.174 * f) + 0.5))
def vol(l, ap, t): return int(math.floor(l * ap * t * 0.523 / 1000 + 0.5))
def f2(x): c = int(math.floor(x * 100 + 0.5)); return '%d,%02d' % (c // 100, c % 100)
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
tf = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); tf.write(BANK.replace('\n', '\r\n').encode('utf-8')); tf.close()
ERR = []
def fresh(b):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text)); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', tf.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.locator('[data-model]').nth(0).dblclick(); pg.wait_for_timeout(400)
    return pg
def rep(pg): return pg.evaluate('UFTest.reportText()').splitlines()
def L(pg, s): return ([l for l in rep(pg) if s in l] + [''])[0]
def nf(pg): return pg.evaluate("document.querySelectorAll('#editor .fld').length")
def ix(pg, start, nth=0):
    return pg.evaluate('''(a) => { var all = [].slice.call(document.querySelectorAll('#editor .fld')), out = [];
      all.forEach(function (f, i) { var n = f; while (n && n.nodeName !== 'DIV') { n = n.parentNode; }
        if ((n.textContent || '').replace(/^[\\s\\u2022\\u00a0-]+/, '').indexOf(a[0]) === 0) { out.push(i); } }); return out[a[1]]; }''', [start, nth])
def box(pg, i): return pg.locator('#editor .fld').nth(i).bounding_box()
def fld(pg, i): return pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i]; return f ? [f.className, f.getAttribute('data-t'), f.textContent] : null; }''', i)
def typ(pg, i, txt):   # preenchimento inicial (campo vazio: o clique seleciona o placeholder, D3c)
    x = box(pg, i); pg.mouse.click(x['x'] + x['width'] / 2, x['y'] + x['height'] / 2); pg.wait_for_timeout(60); pg.keyboard.type(txt); pg.wait_for_timeout(80)
def selnode(pg, i, inner):
    pg.evaluate('''(a) => { var f = document.querySelectorAll('#editor .fld')[a[0]], r = document.createRange(); if (a[1]) { r.selectNodeContents(f); } else { r.selectNode(f); }
      var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''', [i, inner])
def paste(pg, t):
    pg.evaluate('''(t) => { var dt = new DataTransfer(); dt.setData('text/plain', t);
      document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }''', t)
K = pg = None
def ed_click(pg, i, where):
    x = box(pg, i); xx = {'mid': x['x'] + x['width'] / 2, 'start': x['x'] + 2, 'end': x['x'] + x['width'] - 2}[where]
    pg.mouse.click(xx, x['y'] + x['height'] / 2); pg.wait_for_timeout(60)
def dbl(pg, i): x = box(pg, i); pg.mouse.dblclick(x['x'] + x['width'] - 4, x['y'] + x['height'] / 2); pg.wait_for_timeout(80)
def drag(pg, i):
    x = box(pg, i); y = x['y'] + x['height'] / 2; pg.mouse.move(x['x'] + x['width'] - 1, y); pg.mouse.down(); pg.mouse.move(x['x'] - 3, y, steps=6); pg.mouse.up(); pg.wait_for_timeout(60)
# (nome, valor inicial, ação, valor esperado)
SC = [
    ('duplo clique + digitar', '90', lambda pg, i: (dbl(pg, i), pg.keyboard.type('72')), '72'),
    ('duplo clique em decimal com vírgula + digitar', '72,1', lambda pg, i: (dbl(pg, i), pg.keyboard.type('73')), '73'),
    ('duplo clique em decimal com ponto + digitar', '72.1', lambda pg, i: (dbl(pg, i), pg.keyboard.type('73')), '73'),
    ('arrastar seleção + digitar', '90', lambda pg, i: (drag(pg, i), pg.keyboard.type('72')), '72'),
    ('selecionar parte (Shift+←) + digitar', '90', lambda pg, i: (ed_click(pg, i, 'end'), pg.keyboard.press('Shift+ArrowLeft'), pg.keyboard.type('5')), '95'),
    ('clique no meio + Backspace + digitar', '90', lambda pg, i: (ed_click(pg, i, 'mid'), pg.keyboard.press('Backspace'), pg.keyboard.type('1')), '10'),
    ('Backspace até apagar tudo + redigitar', '90', lambda pg, i: (ed_click(pg, i, 'end'), pg.keyboard.press('Backspace'), pg.keyboard.press('Backspace'), pg.keyboard.type('72')), '72'),
    ('clique no início + Delete + digitar', '90', lambda pg, i: (ed_click(pg, i, 'start'), pg.keyboard.press('Delete'), pg.keyboard.type('8')), '80'),
    ('clique no fim + digitar dígito', '90', lambda pg, i: (ed_click(pg, i, 'end'), pg.keyboard.type('5')), '905'),
    ('seleção do span inteiro + digitar', '90', lambda pg, i: (ed_click(pg, i, 'mid'), selnode(pg, i, False), pg.keyboard.type('72')), '72'),
    ('seleção do span inteiro + Backspace + digitar', '90', lambda pg, i: (ed_click(pg, i, 'mid'), selnode(pg, i, False), pg.keyboard.press('Backspace'), pg.keyboard.type('72')), '72'),
    ('selecionar valor + colar', '90', lambda pg, i: (ed_click(pg, i, 'mid'), selnode(pg, i, True), paste(pg, '68')), '68'),
    ('selecionar span + colar', '90', lambda pg, i: (ed_click(pg, i, 'mid'), selnode(pg, i, False), paste(pg, '68')), '68'),
]
def num(s): return float(s.replace(',', '.'))
with sync_playwright() as p:
    b = p.chromium.launch()
    # biometria: DBP editado, PFE tem de recalcular
    for nm, v0, act, exp in SC:
        pg = fresh(b)
        for lab, v in (('Diâmetro biparietal', v0), ('Circunferência cefálica', '300'), ('Circunferência abdominal', '300'), ('Comprimento do fêmur', '75')): typ(pg, ix(pg, lab), v)
        n0 = nf(pg); i = ix(pg, 'Diâmetro biparietal'); act(pg, i); pg.wait_for_timeout(150)
        fi = fld(pg, i); g = pfe(num(exp), 300, 300, 75); want = ('Peso fetal estimado em: %d gramas' % g) if g <= 10000 else 'Peso fetal estimado em: ___ gramas'
        ck('DBP %s: continua campo (.fld f-ok, data-t=n), mesmo nº de campos' % nm, nf(pg) == n0 and fi and 'fld' in fi[0].split() and 'f-ok' in fi[0].split() and fi[1] == 'n', [n0, nf(pg), fi, L(pg, 'Diâmetro')])
        ck('DBP %s: valor = %s' % (nm, exp), fi and fi[2] == exp and ('(DBP): %s mm.' % exp) in L(pg, 'Diâmetro'), [fi, L(pg, 'Diâmetro')])
        ck('DBP %s: PFE recalculado' % nm, want in L(pg, 'Peso fetal'), L(pg, 'Peso fetal'))
    # apagar tudo deixa o campo vazio (placeholder) e o PFE some; redigitar volta
    pg = fresh(b)
    for lab, v in (('Diâmetro biparietal', '90'), ('Circunferência cefálica', '300'), ('Circunferência abdominal', '300'), ('Comprimento do fêmur', '75')): typ(pg, ix(pg, lab), v)
    i = ix(pg, 'Diâmetro biparietal'); n0 = nf(pg); ed_click(pg, i, 'end'); pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(120)
    fi = fld(pg, i)
    ck('campo esvaziado vira campo vazio (placeholder), não some', nf(pg) == n0 and fi[2] == '___' and 'f-ok' not in fi[0].split(), fi)
    ck('campo esvaziado: placeholder selecionado', pg.evaluate('getSelection().toString()') == '___')
    ck('campo esvaziado: PFE some', '___ gramas' in L(pg, 'Peso fetal'), L(pg, 'Peso fetal'))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    ck('Ctrl+Z após esvaziar devolve um valor ao campo', fld(pg, i)[2] in ('9', '90') and nf(pg) == n0, fld(pg, i))
    # desfazer após duplo clique + digitar
    pg = fresh(b)
    for lab, v in (('Diâmetro biparietal', '90'), ('Circunferência cefálica', '300'), ('Circunferência abdominal', '300'), ('Comprimento do fêmur', '75')): typ(pg, ix(pg, lab), v)
    i = ix(pg, 'Diâmetro biparietal'); dbl(pg, i); pg.keyboard.type('72'); pg.wait_for_timeout(120)
    for k in range(4):
        if fld(pg, i)[2] == '90': break
        pg.keyboard.press('Control+z'); pg.wait_for_timeout(120)
    ck('Ctrl+Z volta ao 90 com o campo reconhecido', fld(pg, i)[2] == '90' and 'f-ok' in fld(pg, i)[0], fld(pg, i))
    ck('após desfazer, PFE do 90', ('%d gramas' % pfe(90, 300, 300, 75)) in L(pg, 'Peso fetal'), L(pg, 'Peso fetal'))
    # edição manual do PFE respeitada ao editar outra coisa que não medida? (mudar medida recalcula)
    pi = ix(pg, 'Peso fetal'); ed_click(pg, pi, 'mid'); selnode(pg, pi, True); pg.keyboard.type('2000'); pg.wait_for_timeout(120)
    ck('PFE editado à mão fica', 'em: 2000 gramas' in L(pg, 'Peso fetal'), L(pg, 'Peso fetal'))
    i = ix(pg, 'Diâmetro biparietal'); dbl(pg, i); pg.keyboard.type('80'); pg.wait_for_timeout(150)
    ck('mudar a medida recalcula o PFE manual', ('%d gramas' % pfe(80, 300, 300, 75)) in L(pg, 'Peso fetal'), L(pg, 'Peso fetal'))
    # outros módulos: volume (C2), Doppler (C5) e campo comum (D3c)
    sub = [SC[0], SC[1], SC[6], SC[7], SC[11]]
    for nm, v0, act, exp in sub:
        pg = fresh(b)
        vi = ix(pg, 'Orgao direito')
        for k, v in enumerate([v0, '40', '30']): typ(pg, vi + k, v)
        n0 = nf(pg); act(pg, vi); pg.wait_for_timeout(150); fi = fld(pg, vi)
        ck('volume C2 %s: campo e volume' % nm, nf(pg) == n0 and fi[2] == exp and 'f-ok' in fi[0] and ('volume ~ %d cm³' % vol(num(exp), 40, 30)) in L(pg, 'Orgao direito'), [fi, L(pg, 'Orgao direito')])
    for nm, v0, act, exp in [('duplo clique + digitar', '1,20', lambda pg, i: (dbl(pg, i), pg.keyboard.type('1,4')), '1,4'),
                             ('Backspace até apagar tudo + redigitar', '12', lambda pg, i: (ed_click(pg, i, 'end'), pg.keyboard.press('Backspace'), pg.keyboard.press('Backspace'), pg.keyboard.type('1,4')), '1,4'),
                             ('selecionar valor + colar', '1,20', lambda pg, i: (ed_click(pg, i, 'mid'), selnode(pg, i, True), paste(pg, '1,4')), '1,4')]:
        pg = fresh(b)
        au = ix(pg, 'Índice de pulsatilidade', 0); acm = ix(pg, 'Índice de pulsatilidade', 1)
        typ(pg, au, v0); typ(pg, acm, '2,00'); n0 = nf(pg); act(pg, au); pg.wait_for_timeout(150); fi = fld(pg, au)
        ck('Doppler C5 %s: campo e relação' % nm, nf(pg) == n0 and fi[2] == exp and ('= %s (V.R.' % f2(num(exp) / 2.0)) in L(pg, 'Relação'), [fi, L(pg, 'Relação')])
    for nm, v0, act, exp in [SC[0], SC[6], SC[7], SC[8], SC[11]]:
        pg = fresh(b); bi = ix(pg, 'Batimentos'); typ(pg, bi, '150' if v0 == '90' else v0)
        e2 = {'duplo clique + digitar': '72', 'Backspace até apagar tudo + redigitar': '172', 'clique no início + Delete + digitar': '850', 'clique no fim + digitar dígito': '1505', 'selecionar valor + colar': '68'}[nm]
        n0 = nf(pg); act(pg, bi); pg.wait_for_timeout(120); fi = fld(pg, bi)
        ck('campo comum (sem cálculo) %s: continua campo' % nm, nf(pg) == n0 and fi and 'f-ok' in fi[0] and fi[2] == e2, [fi, L(pg, 'Batimentos')])
    ck('sem erros de console', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
