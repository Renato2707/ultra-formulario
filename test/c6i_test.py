"""C6i: a frase da escolha múltipla escreve o começo comum uma vez só. Banco genérico embutido. Uso: python test/c6i_test.py"""
import os, sys, tempfile, json
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
NOD = ('?[Sem nódulos.|Observa-se nódulo ?[cístico|espongiforme|misto|sólido|indeterminado], ?[anecoico|hiperecogênico|isoecogênico|hipoecogênico|muito hipoecogênico|indeterminado], '
       '?[mais largo que alto|mais alto que largo], margens ?[lisas|mal definidas|lobuladas|irregulares|com extensão extratireoidiana], ?+[sem focos hiperecogênicos|com focos hiperecogênicos tipo cauda de cometa|'
       'com focos hiperecogênicos tipo macrocalcificações|com focos hiperecogênicos tipo calcificações periféricas|com focos hiperecogênicos puntiformes]. Localizado em terço ?[superior|médio|inferior] de lobo ?[direito|esquerdo], medindo cerca de * x * x * mm (LxAPxT). TI-RADS *.]')
BANK = '''@@EXAME Teste Um
@@EXAME_FULL TESTE UM
@@TEMPLATE Multi
MULTI TESTE
Achados: ?+[alfa|beta|gama].
Queixa de ?+[dor leve|dor forte].
Lista simples: ?[um|dois].
Fim do teste.

@@TEMPLATE Tireoide
TIREOIDE TESTE
''' + NOD + '''
Fim.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
tf = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); tf.write(BANK.replace('\n', '\r\n').encode('utf-8')); tf.close()
ERR = []
def fresh(b, model=0, clear=True, cx=None):
    c = cx or b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(5000)
    pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX)
    if clear:
        pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
        pg.set_input_files('#bankFile0', tf.name); pg.wait_for_timeout(300)
        pg.click('[data-exam]'); pg.wait_for_timeout(600); pg.locator('[data-model]').nth(model).dblclick(); pg.wait_for_timeout(400)
    return pg
def rep(pg): return pg.evaluate('UFTest.reportText()').replace('\r', '').split('\n')
def L(pg, s): return ([l for l in rep(pg) if l.startswith(s)] + [''])[0]
def popup(pg): return pg.evaluate("!document.getElementById('popup').hidden")
def chip(pg, line, k=0): return pg.locator('#editor div', has_text=line).last.locator('.fld').nth(k)
def opt(pg, t): pg.locator('#popup .opt[data-i]', has_text=t).first.click(); pg.wait_for_timeout(80)
def ok(pg): pg.locator('#popup .opt-ok').click(); pg.wait_for_timeout(200)
def ticked(pg): return pg.evaluate("[].map.call(document.querySelectorAll('#popup .opt.on'),function(o){return o.textContent.replace(/^\\S+\\s+\\d+\\.\\s*/,'')})")
FO = ['sem focos hiperecogênicos', 'com focos hiperecogênicos tipo cauda de cometa', 'com focos hiperecogênicos tipo macrocalcificações', 'com focos hiperecogênicos tipo calcificações periféricas', 'com focos hiperecogênicos puntiformes']
CH = """(function(a){ var cs=document.querySelectorAll('#editor .fld[data-t=s]'), i, o, k;
 for(i=0;i<cs.length;i++){ if(cs[i].getAttribute('data-v')!==null || cs[i].getAttribute('data-m')) continue; o=JSON.parse(cs[i].getAttribute('data-o'));
  for(k=0;k<o.length;k++){ if(o[k].indexOf(a)===0){ UFTest.openSelect(cs[i]); UFTest.chooseOption(k); return k; } } } return -1; })"""
def nodule(pg):
    for t in ['Observa-se', 'sólido', 'hipoecogênico', 'mais largo', 'lisas']: pg.evaluate(CH + '(%s)' % json.dumps(t)); pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
def setfoc(pg, idx):
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(120)
    cur = [int(x) for x in (pg.evaluate("document.querySelector('#editor .fld[data-m=\"1\"]').getAttribute('data-v')") or '').split(',') if x != '']
    for k in range(5):
        if (k in idx) != (k in cur): pg.locator('#popup .opt[data-i="%d"]' % k).click(); pg.wait_for_timeout(60)
    ok(pg); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
def foctext(pg): return pg.locator('#editor .fld[data-m="1"]').inner_text()
def pts(pg): return ([l for l in rep(pg) if l.startswith('Pontuação:')] + [''])[0]
def paste(pg, t):
    pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'"); pg.click('#editor')
    pg.evaluate("""(t) => { var dt = new DataTransfer(); dt.setData('text/plain', t); document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""", t); pg.wait_for_timeout(400)
def dv(pg): return pg.evaluate("(function(){var c=document.querySelector('#editor .fld[data-m=\"1\"]');return c?c.getAttribute('data-v'):null})()")
EXP = [([1, 2], 'com focos hiperecogênicos tipo cauda de cometa e macrocalcificações', 1),
       ([1, 2, 3, 4], 'com focos hiperecogênicos tipo cauda de cometa, macrocalcificações, calcificações periféricas e puntiformes', 6),
       ([2, 4], 'com focos hiperecogênicos tipo macrocalcificações e puntiformes', 4),
       ([4], 'com focos hiperecogênicos puntiformes', 3),
       ([1], 'com focos hiperecogênicos tipo cauda de cometa', 0)]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b, 0)
    J = lambda a: pg.evaluate('(a) => UltraParser.joinMulti(a)', a)
    for idx, txt, f in EXP: ck('joinMulti %s' % idx, J([FO[i] for i in idx]) == txt, J([FO[i] for i in idx]))
    ck('sem começo comum: "a, b e c"', J(['a', 'b', 'c']) == 'a, b e c')
    ck('começo de uma palavra: "dor leve e forte"', J(['dor leve', 'dor forte']) == 'dor leve e forte')
    ck('opção igual ao começo fica inteira', J(['dor', 'dor forte']) == 'dor e dor forte', J(['dor', 'dor forte']))
    chip(pg, 'Achados').click(); pg.wait_for_timeout(120); opt(pg, 'alfa'); opt(pg, 'beta'); opt(pg, 'gama'); ok(pg)
    ck('lista genérica no laudo: alfa, beta e gama', L(pg, 'Achados') == 'Achados: alfa, beta e gama.', L(pg, 'Achados'))
    pg.keyboard.press('Escape'); chip(pg, 'Queixa').click(); pg.wait_for_timeout(120); opt(pg, 'dor leve'); opt(pg, 'dor forte'); ok(pg)
    ck('lista genérica no laudo: dor leve e forte', L(pg, 'Queixa') == 'Queixa de dor leve e forte.', L(pg, 'Queixa'))
    pg.keyboard.press('Escape'); full = pg.evaluate('UFTest.reportText()')
    paste(pg, full)
    ck('colado: "dor leve e forte" reconhecido', pg.evaluate("[].map.call(document.querySelectorAll('#editor .fld[data-m=\"1\"]'),function(c){return c.getAttribute('data-v')})") == ['0,1,2', '0,1'])
    pg = fresh(b, 1); nodule(pg)
    for idx, txt, f in EXP:
        setfoc(pg, idx)
        ck('laudo %s: texto juntado' % idx, foctext(pg) == txt, foctext(pg))
        ck('laudo %s: TI-RADS focos = %d (total %d)' % (idx, f, 4 + f), pts(pg) == 'Pontuação: %d' % (4 + f), pts(pg))
    setfoc(pg, [1, 2, 3, 4]); pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(120)
    ck('reabrir com as 4 marcadas', ticked(pg) == [FO[i] for i in (1, 2, 3, 4)], ticked(pg))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    nod = [l for l in rep(pg) if l.startswith('Observa-se')][0]
    for idx, txt, f in EXP:
        old = 'Observa-se nódulo sólido, hipoecogênico, mais largo que alto, margens lisas, %s. Localizado em terço médio de lobo direito, medindo cerca de 9 x 8 x 7 mm (LxAPxT). TI-RADS ___.'
        for kind, ft in (('novo', txt), ('antigo C6h', ', '.join(FO[i] for i in idx[:-1]) + (' e ' if len(idx) > 1 else '') + FO[idx[-1]])):
            pg2 = pg; paste(pg2, 'TIREOIDE TESTE\n' + old % ft + '\nFim.')
            got = dv(pg2)
            ck('colado (%s) %s: focos reconhecidos e TI-RADS %d' % (kind, idx, 4 + f), got == ','.join(str(i) for i in idx) and pts(pg2) == 'Pontuação: %d' % (4 + f), [got, pts(pg2), L(pg2, 'Observa-se')[60:160]])
    pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
    for c, v in (('comp', 'sol'), ('eco', 'hipo'), ('forma', 'larg'), ('marg', 'lisa')): pg.select_option('.tr-sel[data-cat=%s]' % c, v)
    for v in ('macro', 'perif', 'punct'): pg.click('input[data-cat=focos][value=%s]' % v)
    pg.click('#trIns'); pg.wait_for_timeout(300)
    ck('cartão TI-RADS escreve a frase juntada', 'com focos hiperecogênicos tipo macrocalcificações, calcificações periféricas e puntiformes.' in L(pg, 'Observa-se') and pts(pg) == 'Pontuação: 10', [L(pg, 'Observa-se'), pts(pg)])
    ck('sem erros de console', not ERR, ERR[:3])
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
