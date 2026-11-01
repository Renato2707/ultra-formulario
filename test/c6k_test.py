"""C6k: as 6 linhas do TI-RADS ficam no lugar das 5 antigas, logo abaixo do título. Uso: python test/c6k_test.py"""
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
Coloração: ?+[azul, claro|azul|verde].
Lista simples: ?[um|dois].
Fim do teste.

@@TEMPLATE Tireoide
TIREOIDE TESTE
''' + NOD + '''
Recomendação de acordo com o ACR:
TI-RADS 1 (nódulo benigno): sem necessidade de PAAF.
TI-RADS 2 (nódulo não suspeito): sem necessidade de PAAF.
TI-RADS 3 (nódulo levemente suspeito): PAAF se o nódulo for ≥ 2,5 cm.
TI-RADS 4 (nódulo moderadamente suspeito): PAAF se o nódulo for ≥ 1,5 cm.
TI-RADS 5 (nódulo altamente suspeito): PAAF se o nódulo for ≥ 1,0 cm (considerar PAAF se o nódulo for ≥ 0,5 cm).
Fim.

@@TEMPLATE SemAntigas
TIREOIDE SEM
''' + NOD + '''
Conclusão livre.
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

OLD = lambda pg: [l for l in rep(pg) if l.startswith('TI-RADS ') and '(nódulo' in l]
SIX = ['Pontuação: ', 'Categoria TIRADS: ', 'Nível de Risco: ', 'Risco de Malignidade: ', 'Recomendação de PAAF: ', 'Sugestão de Acompanhamento: ']
def six(pg):
    r = rep(pg); return [l for l in r if l.startswith(tuple(SIX))]
def cur(pg): return pg.evaluate("(function(){var l=document.querySelectorAll('#popup .opt'),i;for(i=0;i<l.length;i++){if(/\\bkbd\\b/.test(l[i].className))return i;}return -1})()")
def paste(pg, t):
    pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'"); pg.click('#editor')
    pg.evaluate("""(t) => { var dt = new DataTransfer(); dt.setData('text/plain', t); document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""", t); pg.wait_for_timeout(500)
CH = """(function(a){ var cs=document.querySelectorAll('#editor .fld[data-t=s]'), i, o, k;
 for(i=0;i<cs.length;i++){ if(cs[i].getAttribute('data-v')!==null || cs[i].getAttribute('data-m')) continue; o=JSON.parse(cs[i].getAttribute('data-o'));
  for(k=0;k<o.length;k++){ if(o[k].indexOf(a)===0){ UFTest.openSelect(cs[i]); UFTest.chooseOption(k); return k; } } } return -1; })"""
T = 'Recomendação de acordo com o ACR:'
def build(pg):
    for t in ['Observa-se', 'sólido', 'hipoecogênico', 'mais alto', 'lisas']: pg.evaluate(CH + '(%s)' % json.dumps(t)); pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.keyboard.press('Tab'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
def under(pg):
    r = rep(pg); i = r.index(T); return r[i + 1:i + 7]
EXP = lambda pg: six(pg)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b, 1); build(pg)
    s6 = six(pg); r = rep(pg)
    ck('1 título preservado', T in r, r)
    ck('1 6 linhas logo abaixo do título', len(s6) == 6 and under(pg) == s6, r)
    ck('1 5 antigas saíram', OLD(pg) == [], OLD(pg))
    ck('1 sem duplicação (6 no laudo, 6 .uc-trl)', len(s6) == 6 and pg.locator('#editor .uc-trl').count() == 6, s6)
    nod = [i for i, l in enumerate(r) if l.startswith('Observa-se')][0]
    ck('1 nada de linhas junto da frase do nódulo', not r[nod + 1].startswith(tuple(SIX)), r[nod + 1])
    e = pg.locator('#editor .uc-trl').nth(2); e.click(); pg.keyboard.press('End'); pg.keyboard.type(' X'); pg.wait_for_timeout(300)
    ck('1 linha editável no lugar', under(pg)[2].endswith(' X') and len(six(pg)) == 6, under(pg))
    full = pg.evaluate('UFTest.reportText()')
    pg.evaluate("UFTirads.runTxt(); UFTirads.runTxt()"); pg.wait_for_timeout(100)
    ck('1 rodar de novo não duplica', len(six(pg)) == 6, six(pg))
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.keyboard.press('Tab'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    r = rep(pg)
    ck('2 nódulo incompleto: 5 antigas voltam abaixo do título', len(OLD(pg)) == 5 and r[r.index(T) + 1:r.index(T) + 6] == OLD(pg), r)
    ck('2 linhas não mexidas saíram', [l for l in six(pg) if not l.endswith(' X')] == [], six(pg))
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.keyboard.press('Tab'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ck('2 completo de novo: 6 no lugar, sem duplicar', OLD(pg) == [] and len(six(pg)) == 6 and under(pg) == six(pg), rep(pg))
    # colado (formato C6k)
    pg = fresh(b, 1); paste(pg, full)
    ck('3 colado novo: 6 abaixo do título sem duplicar', len(six(pg)) == 6 and under(pg) == six(pg) and pg.locator('#editor .uc-trl').count() == 6, rep(pg))
    oldtxt = '\n'.join([l for l in full.replace('\r', '').split('\n') if not l.startswith(tuple(SIX))]).replace(T, T + '\nTI-RADS 1 (nódulo benigno): sem necessidade de PAAF.\nTI-RADS 2 (nódulo não suspeito): sem necessidade de PAAF.\nTI-RADS 3 (nódulo levemente suspeito): PAAF se o nódulo for ≥ 2,5 cm.\nTI-RADS 4 (nódulo moderadamente suspeito): PAAF se o nódulo for ≥ 1,5 cm.\nTI-RADS 5 (nódulo altamente suspeito): PAAF se o nódulo for ≥ 1,0 cm (considerar PAAF se o nódulo for ≥ 0,5 cm).')
    pg = fresh(b, 1); paste(pg, oldtxt)
    ck('3 colado antigo: vira 6 no lugar das 5', OLD(pg) == [] and len(six(pg)) == 6 and under(pg) == six(pg), rep(pg))
    # fallback: banco sem as 5
    pg = fresh(b, 2); build(pg)
    r = rep(pg); nod = [i for i, l in enumerate(r) if l.startswith('Observa-se')][0]
    ck('4 sem as 5: linhas junto da frase do nódulo (C6j)', len(six(pg)) == 6 and r[nod + 1:nod + 7] == six(pg), r)
    # 5) dois nódulos: cada um com seu TI-RADS na frase; recomendação única do de maior pontuação
    pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
    def ins(vals, focos):
        for c, v in zip(('comp', 'eco', 'forma', 'marg'), vals):
            if v: pg.select_option('.tr-sel[data-cat=%s]' % c, v)
        for f in focos: pg.click('input[data-cat=focos][value=%s]' % f)
        pg.evaluate("(function(){var e=document.getElementById('editor'),r=document.createRange();var d=[].filter.call(e.querySelectorAll('div'),function(x){return /^TIREOIDE/.test(x.textContent)})[0]||e.firstChild;r.selectNodeContents(d);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);e.focus()})()")
        pg.click('#trIns'); pg.wait_for_timeout(500)
    ins(('mist', 'hiper', 'larg', 'lisa'), [])
    ins(('sol', 'hipo', 'alto', 'ete'), ['punct'])
    r = rep(pg); nods = [l for l in r if l.startswith('Observa-se')]
    ck('5 cada nódulo com seu TI-RADS na frase', len(nods) >= 2 and sorted(l.split('TI-RADS')[-1].strip(' .') for l in nods) == ['2', '5'], nods)
    ck('5 recomendação única (6 linhas) do nódulo de maior pontuação', len(six(pg)) == 6 and six(pg)[0] == 'Pontuação: 13' and under(pg) == six(pg), r)
    # 6) espongiforme
    pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
    pg.select_option('.tr-sel[data-cat=comp]', 'sol'); pg.select_option('.tr-sel[data-cat=eco]', 'muito'); pg.select_option('.tr-sel[data-cat=forma]', 'alto'); pg.select_option('.tr-sel[data-cat=marg]', 'ete'); pg.click('input[data-cat=focos][value=punct]')
    pg.select_option('.tr-sel[data-cat=comp]', 'esp'); pg.wait_for_timeout(100)
    st = pg.evaluate("[].map.call(document.querySelectorAll('.tr-sel[data-cat=eco],.tr-sel[data-cat=forma],.tr-sel[data-cat=marg]'),function(s){return s.disabled+':'+s.value}).concat([].map.call(document.querySelectorAll('input[data-cat=focos]'),function(c){return c.disabled+':'+c.checked}))")
    ck('6 painel: espongiforme desativa e zera as demais', st == ['true:'] * 3 + ['true:false'] * 4, st)
    ck('6 painel: TR1 · 0 pts', 'TR1' in pg.inner_text('.tr-res') and '0 pts' in pg.inner_text('.tr-res'), pg.inner_text('.tr-res'))
    pg.click('#trIns'); pg.wait_for_timeout(500)
    l = L(pg, 'Observa-se')
    ck('6 frase do painel só com o que se aplica', l.startswith('Observa-se nódulo espongiforme. Localizado') and 'hipoecog' not in l and 'margens' not in l and l.rstrip('.').endswith('TI-RADS 1'), l)
    ck('6 recomendação TR1 (0 pts)', six(pg)[:2] == ['Pontuação: 0', 'Categoria TIRADS: TR1'], six(pg))
    # laudo: escolher espongiforme direto no texto
    pg = fresh(b, 1); pg.evaluate(CH + '("Observa-se")'); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.evaluate(CH + '("espongiforme")'); pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    l = L(pg, 'Observa-se')
    ck('6 laudo: espongiforme dispensa as demais e calcula TR1', l.startswith('Observa-se nódulo espongiforme. Localizado') and 'escolher' not in l and '___' not in l.split('mm (')[-1] and l.rstrip('.').endswith('TI-RADS 1'), l)
    pg.locator('#editor .fld[data-t=s]').first.click(); pg.wait_for_timeout(150); opt(pg, 'sólido'); pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    l = L(pg, 'Observa-se')
    ck('6 voltar para sólido: características voltam, TI-RADS em branco', 'margens' in l and l.count('___') >= 4 and six(pg) == [], l)
    pg.locator('#editor .fld[data-t=s]').first.click(); pg.wait_for_timeout(150); opt(pg, 'espongiforme'); pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    l = L(pg, 'Observa-se')
    ck('6 espongiforme de novo: encurta e TR1', l.startswith('Observa-se nódulo espongiforme. Localizado') and l.rstrip('.').endswith('TI-RADS 1') and len(six(pg)) == 6, l)
    # 7) avisos ACR no painel
    pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
    for c, v in (('comp', 'sol'), ('eco', 'hipo'), ('forma', 'larg'), ('marg', 'ete')): pg.select_option('.tr-sel[data-cat=%s]' % c, v)
    pg.locator('.tr-mm').nth(0).fill('8'); pg.locator('.tr-mm').nth(0).dispatch_event('input'); pg.wait_for_timeout(100)
    n = pg.inner_text('.tr-note')
    ck('7 aviso de extensão extratireoidiana', 'invasão óbvia' in n, n)
    ck('7 corte de tamanho no painel (TR5 7 pts, 8 mm: seguimento, sem PAAF)', 'atinge o corte de seguimento' in n and 'não o de PAAF' in n, n)
    pg.select_option('.tr-sel[data-cat=comp]', 'ind'); pg.wait_for_timeout(100)
    ck('7 indeterminável: eco desativada e 1 ponto', pg.evaluate("document.querySelector('.tr-sel[data-cat=eco]').disabled") and 'Composição indeterminável' in pg.inner_text('.tr-note'))
    pg.select_option('.tr-sel[data-cat=comp]', 'esp'); pg.wait_for_timeout(100)
    ck('7 espongiforme: explicação nos campos desativados', 'Não se aplica' in (pg.get_attribute('.tr-sel[data-cat=forma]', 'title') or ''))
    pg.select_option('.tr-sel[data-cat=comp]', 'cist'); pg.select_option('.tr-sel[data-cat=eco]', 'muito'); pg.wait_for_timeout(100)
    ck('7 cístico com eco não anecoica: aviso', 'cístico costuma ser anecoico' in pg.inner_text('.tr-note'), pg.inner_text('.tr-note'))
    pg.select_option('.tr-sel[data-cat=comp]', 'sol'); pg.select_option('.tr-sel[data-cat=eco]', 'muito'); pg.select_option('.tr-sel[data-cat=forma]', 'alto'); pg.select_option('.tr-sel[data-cat=marg]', 'ete')
    for f in ('macro', 'perif', 'punct'): pg.click('input[data-cat=focos][value=%s]' % f)
    pg.wait_for_timeout(100)
    ck('7 máximo ACR: 17 pts TR5', 'TR5 · 17 pts' in pg.inner_text('.tr-res'), pg.inner_text('.tr-res'))
    pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
    for c, v in (('comp', 'ind'), ('forma', 'larg'), ('marg', 'lisa')): pg.select_option('.tr-sel[data-cat=%s]' % c, v)
    pg.click('input[data-cat=focos][value=nenhum]'); pg.click('input[data-cat=focos][value=macro]'); pg.click('#trIns'); pg.wait_for_timeout(500)
    l = L(pg, 'Observa-se')
    ck('8 calcificado: eco indeterminada, TI-RADS 4 sem campo em branco', 'indeterminado, indeterminado,' in l and l.rstrip('.').endswith('TI-RADS 4') and six(pg)[0] == 'Pontuação: 4', l)
    ck('sem erros de página', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
