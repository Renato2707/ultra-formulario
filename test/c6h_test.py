"""C6h: escolha múltipla ?+[a|b|c] (banco genérico embutido, nenhum texto real). Uso: python test/c6h_test.py"""
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
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b, 0)
    ck('parser: ?+[ ] vira campo de escolha múltipla', pg.evaluate("document.querySelectorAll('#editor .fld[data-m=\"1\"]').length") == 2)
    ck('parser: sem avisos falsos para ?+[ ]', pg.evaluate("UFTest.S.bank.issues.filter(function(i){return /LEGACY_PIPE|DROPDOWN_SINGLE|STRAY|UNCLOSED/.test(i.type)}).length") == 0,
       pg.evaluate("UFTest.S.bank.issues.map(function(i){return i.type})"))
    ck('parser: fieldsOf marca multi', pg.evaluate("UltraParser.fieldsOf('x ?+[a|b] y ?[c|d]').map(function(f){return !!f.multi}).join()") == 'true,false')
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150)
    ck('popup com caixas de marcar e botão Pronto', popup(pg) and pg.locator('#popup .opt-m').count() == 3 and pg.locator('#popup .opt-ok').count() == 1)
    opt(pg, 'beta'); ck('clicar marca sem fechar', popup(pg) and ticked(pg) == ['beta'], ticked(pg))
    ok(pg); ck('1 opção = só ela', L(pg, 'Achados') == 'Achados: beta.', L(pg, 'Achados'))
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150)
    ck('reabrir mostra as marcadas', ticked(pg) == ['beta'], ticked(pg))
    opt(pg, 'gama'); opt(pg, 'alfa'); ok(pg)
    ck('3 opções: "a, b e c" na ordem do banco', L(pg, 'Achados') == 'Achados: alfa, beta e gama.', L(pg, 'Achados'))
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150); opt(pg, 'beta'); ok(pg)
    ck('2 opções: "a e c"', L(pg, 'Achados') == 'Achados: alfa e gama.', L(pg, 'Achados'))
    pg.click('#editor'); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    ck('Ctrl+Z desfaz a última mudança', L(pg, 'Achados') == 'Achados: alfa, beta e gama.', L(pg, 'Achados'))
    pg.keyboard.press('Control+y'); pg.wait_for_timeout(200)
    ck('Ctrl+Y refaz', L(pg, 'Achados') == 'Achados: alfa e gama.', L(pg, 'Achados'))
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150); opt(pg, 'alfa'); opt(pg, 'gama'); ok(pg)
    ck('desmarcar tudo volta ao placeholder', L(pg, 'Achados') == 'Achados: ___.' and pg.locator('#editor .fld[data-m="1"]').first.inner_text() == 'escolher', L(pg, 'Achados'))
    # teclado
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150)
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('Space'); pg.keyboard.press('3'); pg.wait_for_timeout(80)
    ck('teclado: setas + Espaço e número marcam', ticked(pg) == ['beta', 'gama'], ticked(pg))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    ck('Esc cancela (nada muda)', not popup(pg) and L(pg, 'Achados') == 'Achados: ___.', L(pg, 'Achados'))
    chip(pg, 'Achados').click(); pg.wait_for_timeout(150); pg.keyboard.press('1'); pg.keyboard.press('2'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    ck('Enter confirma', L(pg, 'Achados') == 'Achados: alfa e beta.', L(pg, 'Achados'))
    ck('Enter vai ao próximo campo (abre a lista seguinte)', popup(pg) and pg.locator('#popup .opt-m', has_text='azul, claro').count() == 1)
    pg.keyboard.press('1'); pg.keyboard.press('3'); pg.keyboard.press('Tab'); pg.wait_for_timeout(250)
    ck('Tab confirma e segue; opção com vírgula', L(pg, 'Coloração') == 'Coloração: azul, claro e verde.' and popup(pg), [L(pg, 'Coloração'), popup(pg)])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    chip(pg, 'Coloração').click(); pg.wait_for_timeout(150); pg.mouse.click(5, 880); pg.wait_for_timeout(200)
    ck('clicar fora fecha mantendo as marcadas', not popup(pg) and L(pg, 'Coloração') == 'Coloração: azul, claro e verde.', L(pg, 'Coloração'))
    ck('cópia/saída: texto final', 'Achados: alfa e beta.' in pg.evaluate('UFTest.reportText()'))
    pg.click('#repSearch'); pg.keyboard.type('beta'); pg.wait_for_timeout(500)
    ck('pesquisa no laudo acha o texto escolhido', pg.locator('#editor mark').count() >= 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    full = pg.evaluate('UFTest.reportText()')
    pg.click('#editor'); pg.keyboard.press('Control+End'); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(900); pg2 = pg
    ck('rascunho restaurado mantém o campo múltiplo', pg2.evaluate("(function(){var c=document.querySelector('#editor .fld[data-m=\"1\"]');return c?c.getAttribute('data-v')+'|'+c.textContent:null})()") == '0,1|alfa e beta')
    pg2.locator('#editor div', has_text='Achados').last.locator('.fld').first.click(); pg2.wait_for_timeout(150)
    ck('... e reabre com as marcadas', ticked(pg2) == ['alfa', 'beta'], ticked(pg2))
    # colado
    pg = fresh(b, 0); pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'"); pg.click('#editor')
    txt = full.replace('Coloração: azul, claro e verde.', 'Coloração: verde e azul, claro.')
    pg.evaluate("""(t) => { var dt = new DataTransfer(); dt.setData('text/plain', t); document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""", txt); pg.wait_for_timeout(400)
    vals = pg.evaluate("[].map.call(document.querySelectorAll('#editor .fld[data-m=\"1\"]'),function(c){return c.getAttribute('data-v')})")
    ck('colado: "a e b" reconhece as marcadas', vals[:1] == ['0,1'], vals)
    ck('colado: opção com vírgula (mais longa primeiro)', vals[1:2] == ['2,0'], vals)
    ck('colado: texto igual', L(pg, 'Coloração') == 'Coloração: verde e azul, claro.', L(pg, 'Coloração'))
    # TI-RADS
    pg = fresh(b, 1)
    CH = """(function(a){ var cs=document.querySelectorAll('#editor .fld[data-t=s]'), i, o, k;
     for(i=0;i<cs.length;i++){ if(cs[i].getAttribute('data-v')!==null || cs[i].getAttribute('data-m')) continue; o=JSON.parse(cs[i].getAttribute('data-o'));
      for(k=0;k<o.length;k++){ if(o[k].indexOf(a)===0){ UFTest.openSelect(cs[i]); UFTest.chooseOption(k); return k; } } } return -1; })"""
    for t in ['Observa-se', 'sólido', 'hipoecogênico', 'mais largo', 'lisas']: pg.evaluate(CH + '(%s)' % json.dumps(t)); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150)
    opt(pg, 'puntiformes'); opt(pg, 'macrocalcificações'); ok(pg); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    r = rep(pg)
    ck('TI-RADS: puntiformes + macro = 4 pontos de focos (2+2+0+0+4 = 8, TR5)', 'Pontuação: 8' in r and 'Categoria TIRADS: TR5' in r, [l for l in r if l.startswith(('Pont', 'Cat', 'Observa'))])
    pg.locator('#editor .fld[data-m="1"]').click(); pg.wait_for_timeout(150); opt(pg, 'sem focos')
    ck('"sem focos" desmarca os outros', ticked(pg) == ['sem focos hiperecogênicos'], ticked(pg))
    opt(pg, 'periféricas')
    ck('outro foco desmarca "sem focos"', ticked(pg) == ['com focos hiperecogênicos tipo calcificações periféricas'], ticked(pg))
    ok(pg); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ck('TI-RADS: periféricas = 2 (total 6, TR4)', 'Pontuação: 6' in rep(pg), [l for l in rep(pg) if l.startswith('Pont')])
    # formulário
    pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
    for c, v in (('comp', 'sol'), ('eco', 'hipo'), ('forma', 'larg'), ('marg', 'lisa')): pg.select_option('.tr-sel[data-cat=%s]' % c, v)
    pg.click('input[data-cat=focos][value=macro]'); pg.click('input[data-cat=focos][value=punct]')
    ck('formulário: TR5 · 8 pts', pg.inner_text('.tr-res').strip() == 'TR5 · 8 pts', pg.inner_text('.tr-res'))
    pg.click('#trIns'); pg.wait_for_timeout(300)
    l = L(pg, 'Observa-se')
    ck('formulário escreve os 2 focos na lista múltipla', 'com focos hiperecogênicos tipo macrocalcificações e com focos hiperecogênicos puntiformes.' in l and 'Pontuação: 8' in rep(pg), l)
    ck('sem erros de console', not ERR, ERR[:3])
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
