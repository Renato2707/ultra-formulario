"""C2: volume (elipsoide) e índice esplênico calculados em tempo real no laudo.
Banco genérico embutido (frases equivalentes, nenhum texto real). Uso: python test/c2_test.py   (precisa playwright + chromium)"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Exame Teste
@@EXAME_FULL EXAME TESTE
@@TEMPLATE Padrão
EXAME TESTE
Relatório:

Orgao direito medindo cerca de * x * x * mm (LxAPxT) (volume ~ * cm³).
Orgao esquerdo medindo cerca de * x * x * mm (LxAPxT) (~ * cm³).
Corpo central:
Dimensoes medindo cerca de * x * x * mm (LxAPxT).
Volume estimado em cerca de * cm³.
Estrutura medindo * x * x * mm (LxAPxT), volume ~ * cm³, sem outros achados.
Decimal medindo *,* x *,* x *,* mm (LxAPxT) (volume ~ *,* cm³).
Colecao medindo * x * mm (volume ~ * mL).
Lobo um mede * x * x * mm (LxAPxT).
Lobo dois mede * x * x * mm (LxAPxT).
Volume glandular estimado em * cm³.
Sem campo medindo * x * x * mm (LxAPxT), forma normal.
Dimensoes aumentadas, com indice esplenico ausente de medidas, índice esplênico triplanar medindo cerca de * cm³ (V.R.: < 480 cm³).
Baco medindo * x * x * cm (CxLxE), com índice esplênico triplanar de * cm³ (V.R.: 120 a 480 cm³).
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
ERR = []
def fresh(b):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text)); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.dblclick('[data-model]'); pg.wait_for_timeout(400)
    return pg
def L(pg, start):
    for l in pg.evaluate('UFTest.reportText()').splitlines():
        if l.startswith(start): return l
    return ''
def nflds(pg, start):   # índices globais dos campos da linha que começa com start
    return pg.evaluate('''(s) => { var all = [].slice.call(document.querySelectorAll('#editor .fld')), out = [];
      all.forEach(function (f, i) { var n = f; while (n && n.nodeName !== 'DIV') { n = n.parentNode; }
        if ((n.textContent || '').indexOf(s) === 0) { out.push(i); } }); return out; }''', start)
def typ(pg, idx, txt):
    bb = pg.locator('#editor .fld').nth(idx).bounding_box(); pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(60); pg.keyboard.type(txt); pg.wait_for_timeout(80)
def retyp(pg, idx, txt):   # campo preenchido: seleciona o conteúdo e digita por cima
    typ(pg, idx, '') ; pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i], r = document.createRange(); r.selectNodeContents(f);
      var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''', idx)
    pg.keyboard.type(txt); pg.wait_for_timeout(80)
def fill(pg, start, vals):
    ix = nflds(pg, start)
    for k, v in enumerate(vals): typ(pg, ix[k], v)
    return ix
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b)
    ck('modulo registrado no painel', pg.locator('[data-calc=auto]').count() == 1)
    fill(pg, 'Orgao direito', ['100', '50'])
    ck('campo faltando: volume em branco', 'volume ~ ___ cm³' in L(pg, 'Orgao direito'), L(pg, 'Orgao direito'))
    ix = nflds(pg, 'Orgao direito'); typ(pg, ix[2], '40')
    ck('100x50x40 mm -> 105', '(volume ~ 105 cm³)' in L(pg, 'Orgao direito'), L(pg, 'Orgao direito'))
    ck('sem mistura com o outro orgao', 'Orgao esquerdo medindo cerca de ___ x ___ x ___ mm (LxAPxT) (~ ___ cm³)' in L(pg, 'Orgao esquerdo'), L(pg, 'Orgao esquerdo'))
    fill(pg, 'Orgao esquerdo', ['30', '20', '10'])   # 3,138 -> 3
    ck('arredonda para baixo (30x20x10 -> 3)', '(~ 3 cm³)' in L(pg, 'Orgao esquerdo'), L(pg, 'Orgao esquerdo'))
    ck('orgao direito intacto', '(volume ~ 105 cm³)' in L(pg, 'Orgao direito'))
    fill(pg, 'Estrutura', ['31', '20', '10'])        # 3,2426 -> 3
    ck('volume no meio da frase', 'volume ~ 3 cm³, sem' in L(pg, 'Estrutura'), L(pg, 'Estrutura'))
    ix = nflds(pg, 'Estrutura'); retyp(pg, ix[0], '35')   # 3,661 -> 4
    ck('mudanca posterior + arredonda p/ cima (35x20x10 -> 4)', 'volume ~ 4 cm³' in L(pg, 'Estrutura'), L(pg, 'Estrutura'))
    fill(pg, 'Decimal', ['12,5', '10,0', '8.0'])     # 0,523 -> 1
    ck('virgula e ponto decimal (12,5x10,0x8.0 -> 1)', 'volume ~ 1 cm³' in L(pg, 'Decimal'), L(pg, 'Decimal'))
    fill(pg, 'Dimensoes medindo', ['80', '50', '40'])  # 83,68 -> 84
    ck('volume na linha seguinte (80x50x40 -> 84)', L(pg, 'Volume estimado') == 'Volume estimado em cerca de 84 cm³.', L(pg, 'Volume estimado'))
    fill(pg, 'Colecao', ['50', '40'])
    ck('mL / 2 medidas: nao calcula', 'volume ~ ___ mL' in L(pg, 'Colecao'), L(pg, 'Colecao'))
    fill(pg, 'Lobo um', ['40', '20', '15']); fill(pg, 'Lobo dois', ['40', '20', '15'])
    ck('duas linhas de medidas (lobos): nao calcula', '___' in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    n0 = pg.evaluate("document.querySelectorAll('#editor .fld').length")
    fill(pg, 'Sem campo', ['10', '10', '10'])
    ck('sem campo de volume: nada criado', L(pg, 'Sem campo') == 'Sem campo medindo 10 x 10 x 10 mm (LxAPxT), forma normal.' and pg.evaluate("document.querySelectorAll('#editor .fld').length") == n0, L(pg, 'Sem campo'))
    ck('indice sem medidas: campo intacto', 'triplanar medindo cerca de ___ cm³' in L(pg, 'Dimensoes aumentadas'))
    fill(pg, 'Baco', ['12', '5', '4,5'])
    ck('indice esplenico 12x5x4,5 cm -> 270', 'triplanar de 270 cm³' in L(pg, 'Baco'), L(pg, 'Baco'))
    ix = nflds(pg, 'Baco'); retyp(pg, ix[0], '13,3')    # 13,3*5*4,5 = 299,25 -> 299
    ck('indice atualiza (-> 299)', 'triplanar de 299 cm³' in L(pg, 'Baco'), L(pg, 'Baco'))
    # edição manual respeitada
    ix = nflds(pg, 'Orgao direito'); retyp(pg, ix[3], '110')
    ck('edicao manual do volume', '(volume ~ 110 cm³)' in L(pg, 'Orgao direito'), L(pg, 'Orgao direito'))
    retyp(pg, nflds(pg, 'Estrutura')[0], '36')   # mexe em outro órgão
    ck('manual mantida quando outro orgao muda', '(volume ~ 110 cm³)' in L(pg, 'Orgao direito'))
    retyp(pg, ix[0], '120')           # 120x50x40 -> 125,52 -> 126
    ck('medida muda -> recalcula sobre manual', '(volume ~ 126 cm³)' in L(pg, 'Orgao direito'), L(pg, 'Orgao direito'))
    ck('campo calculado conta como preenchido', pg.evaluate("document.querySelectorAll('#editor .fld')[nflds_ix].className", ) if False else pg.evaluate("(i) => /f-ok/.test(document.querySelectorAll('#editor .fld')[i].className)", nflds(pg, 'Orgao esquerdo')[3]))
    pg.close()
    # desfazer / refazer
    pg = fresh(b); ix = nflds(pg, 'Orgao direito')
    typ(pg, ix[0], '100'); typ(pg, ix[1], '50'); typ(pg, ix[2], '40')
    ck('antes de desfazer: 105', '(volume ~ 105 cm³)' in L(pg, 'Orgao direito'), L(pg, 'Orgao direito'))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    a = L(pg, 'Orgao direito')
    ck('Ctrl+Z na medida recalcula/limpa volume', ('x 4 mm' in a and '(volume ~ 10 cm³)' in a) or ('x ___ mm' in a and 'volume ~ ___' in a) or ('x 40 mm' not in a and '105' not in a), a)
    for _ in range(6): pg.keyboard.press('Control+z'); pg.wait_for_timeout(100)
    a = L(pg, 'Orgao direito'); ck('varios Ctrl+Z: sem volume velho', '105' not in a, a)
    for _ in range(12): pg.keyboard.press('Control+y'); pg.wait_for_timeout(100)
    a = L(pg, 'Orgao direito'); ck('Ctrl+Y refaz e volume volta a 105', '100 x 50 x 40' in a and '(volume ~ 105 cm³)' in a, a)
    ck('editor continua editavel', pg.evaluate("document.getElementById('editor').isContentEditable"))
    # desligar no painel
    pg.evaluate('UFCalc.open()'); pg.uncheck('#ucAuto'); ix = nflds(pg, 'Orgao esquerdo')
    for k, v in enumerate(['30', '20', '10']): typ(pg, ix[k], v)
    ck('desligado: nao calcula', '(~ ___ cm³)' in L(pg, 'Orgao esquerdo'), L(pg, 'Orgao esquerdo'))
    pg.check('#ucAuto'); pg.wait_for_timeout(100)
    ck('religado: calcula', '(~ 3 cm³)' in L(pg, 'Orgao esquerdo'), L(pg, 'Orgao esquerdo'))
    ck('sem erros no console', not ERR, ERR)
    b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
