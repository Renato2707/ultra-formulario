"""C6j: teclado da escolha múltipla, Enter no cartão TI-RADS, 6 linhas substituem as 5 antigas. Uso: python test/c6j_test.py"""
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
with sync_playwright() as p:
    b = p.chromium.launch()
    # 1) teclado da escolha múltipla
    pg = fresh(b, 0)
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150)
    ck('1 foco inicial na 1ª opção', cur(pg) == 0, cur(pg))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(80)
    ck('1 Enter marca sem fechar', popup(pg) and ticked(pg) == ['alfa'], ticked(pg))
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); pg.wait_for_timeout(80)
    ck('1 setas navegam; Enter marca a opção em foco', popup(pg) and ticked(pg) == ['alfa', 'gama'], ticked(pg))
    pg.keyboard.press('ArrowUp'); pg.keyboard.press('Space'); pg.keyboard.press('Space'); pg.keyboard.press('ArrowUp'); pg.keyboard.press('Enter'); pg.wait_for_timeout(80)
    ck('1 Espaço/Enter desmarcam', popup(pg) and ticked(pg) == ['gama'], ticked(pg))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    ck('1 Esc descarta as marcas', not popup(pg) and L(pg, 'Achados') == 'Achados: ___.', L(pg, 'Achados'))
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150)
    pg.keyboard.press('Enter'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter')
    for _ in range(5): pg.keyboard.press('ArrowDown')
    ck('1 seta para baixo chega ao "Pronto" e para nele', cur(pg) == 3, cur(pg))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    ck('1 Enter no "Pronto" confirma', L(pg, 'Achados') == 'Achados: alfa e beta.', L(pg, 'Achados'))
    ck('1 ... e vai ao próximo campo', popup(pg) and pg.locator('#popup .opt-m', has_text='azul, claro').count() == 1)
    pg.keyboard.press('Enter'); pg.keyboard.press('Tab'); pg.wait_for_timeout(250)
    ck('1 Tab confirma', L(pg, 'Coloração') == 'Coloração: azul, claro.', L(pg, 'Coloração'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    chip(pg, 'Coloração').click(); pg.wait_for_timeout(150); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); pg.mouse.click(5, 880); pg.wait_for_timeout(200)
    ck('1 clicar fora confirma', L(pg, 'Coloração') == 'Coloração: azul, claro e azul.', L(pg, 'Coloração'))
    pg = fresh(b, 1)
    pg.evaluate(CH + '("Observa-se")'); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150)
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); pg.keyboard.press('ArrowUp'); pg.keyboard.press('ArrowUp'); pg.keyboard.press('Enter'); pg.wait_for_timeout(80)
    ck('1 "sem …" continua exclusivo pelo teclado', ticked(pg) == ['sem focos hiperecogênicos'], ticked(pg))
    pg.keyboard.press('Escape')
    # 2) Enter no cartão TI-RADS
    pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
    for c, v in (('comp', 'sol'), ('eco', 'hipo'), ('forma', 'alto'), ('marg', 'ete')): pg.select_option('.tr-sel[data-cat=%s]' % c, v)
    pg.click('input[data-cat=focos][value=punct]')
    mm = pg.locator('.tr-mm')
    mm.nth(0).click(); pg.keyboard.type('12'); pg.keyboard.press('Enter')
    ck('2 Enter na 1ª medida vai à 2ª', pg.evaluate("document.activeElement===document.querySelectorAll('.tr-mm')[1]"))
    pg.keyboard.type('8'); pg.keyboard.press('Enter')
    ck('2 Enter na 2ª vai à 3ª', pg.evaluate("document.activeElement===document.querySelectorAll('.tr-mm')[2]"))
    pg.keyboard.type('7'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    l = L(pg, 'Observa-se')
    ck('2 Enter na última insere o nódulo', '12 x 8 x 7' in l, l)
    pg.locator('.tr-sel[data-cat=marg]').focus(); pg.keyboard.press('Enter')
    ck('2 Enter na margem vai ao terço', pg.evaluate("document.activeElement.getAttribute('aria-label')") == 'Terço')
    pg.evaluate("UFCalc.setOpen('obst', true); document.getElementById('ucIgW').focus()"); pg.keyboard.type('30'); pg.keyboard.press('Enter')
    ck('2 IG relatada: Enter em semanas vai a dias', pg.evaluate("document.activeElement.id") == 'ucIgD')
    # 3) 6 linhas novas substituem as antigas
    s6 = six(pg)
    ck('3 formato exato (TR5, 13 pts)', s6 == ['Pontuação: 13', 'Categoria TIRADS: TR5', 'Nível de Risco: Altamente suspeito', 'Risco de Malignidade: ≥20%', 'Recomendação de PAAF: se ≥1,0 cm', 'Sugestão de Acompanhamento: se ≥0,5 cm, US anual por até 5 anos.'], s6)
    ck('3 as 5 linhas antigas saíram', OLD(pg) == [], OLD(pg))
    full = pg.evaluate('UFTest.reportText()')
    e = pg.locator('#editor .uc-trl').nth(2); e.click(); pg.keyboard.press('End'); pg.keyboard.type(' X'); pg.wait_for_timeout(300)
    ck('3 linhas continuam editáveis', 'Nível de Risco: Altamente suspeito X' in rep(pg))
    pg = fresh(b, 1)
    for t in ['Observa-se', 'cístico', 'anecoico', 'mais largo', 'lisas']: pg.evaluate(CH + '(%s)' % json.dumps(t)); pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.keyboard.press('Tab'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ck('3 TR1: valores da categoria', six(pg) == ['Pontuação: 0', 'Categoria TIRADS: TR1', 'Nível de Risco: Benigno', 'Risco de Malignidade: ≤2%', 'Recomendação de PAAF: Nenhuma', 'Sugestão de Acompanhamento: Nenhuma'], six(pg))
    ck('3 TR1: antigas saíram', OLD(pg) == [])
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.keyboard.press('Tab'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ck('3 nódulo incompleto: as 5 antigas voltam no lugar', len(OLD(pg)) == 5 and six(pg) == [] and rep(pg).index('Recomendação de acordo com o ACR:') + 1 == rep(pg).index(OLD(pg)[0]), rep(pg))
    # colado: novo e antigo
    pg = fresh(b, 1); paste(pg, full)
    ck('3 colado novo: 6 linhas reconhecidas sem duplicar', six(pg) == ['Pontuação: 13', 'Categoria TIRADS: TR5', 'Nível de Risco: Altamente suspeito', 'Risco de Malignidade: ≥20%', 'Recomendação de PAAF: se ≥1,0 cm', 'Sugestão de Acompanhamento: se ≥0,5 cm, US anual por até 5 anos.'] and pg.locator('#editor .uc-trl').count() == 6, six(pg))
    oldtxt = '\n'.join([l for l in full.replace('\r', '').split('\n') if not l.startswith(tuple(SIX))]).replace('Recomendação de acordo com o ACR:', 'Recomendação de acordo com o ACR:\nTI-RADS 1 (nódulo benigno): sem necessidade de PAAF.\nTI-RADS 2 (nódulo não suspeito): sem necessidade de PAAF.\nTI-RADS 3 (nódulo levemente suspeito): PAAF se o nódulo for ≥ 2,5 cm.\nTI-RADS 4 (nódulo moderadamente suspeito): PAAF se o nódulo for ≥ 1,5 cm.\nTI-RADS 5 (nódulo altamente suspeito): PAAF se o nódulo for ≥ 1,0 cm (considerar PAAF se o nódulo for ≥ 0,5 cm).')
    pg = fresh(b, 1); paste(pg, oldtxt)
    ck('3 colado antigo: 5 antigas viram as 6 novas', OLD(pg) == [] and len(six(pg)) == 6 and six(pg)[0] == 'Pontuação: 13', [OLD(pg), six(pg)])
    ck('sem erros de página', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
