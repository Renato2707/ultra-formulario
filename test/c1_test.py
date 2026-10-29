"""C1: painel de calculadoras, calculadora livre (4 operações) e IG relatada.
Banco genérico embutido, sem frases reais. Uso: python test/c1_test.py   (precisa playwright + chromium)"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Exame Teste
@@EXAME_FULL EXAME TESTE
@@TEMPLATE Padrão
EXAME TESTE
Relatório:

Linha alfa do modelo.
Linha beta do modelo.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
ERR = []
def disp(pg): return pg.inner_text('#ucDisp')
def keys(pg, seq):
    for k in seq: pg.click('.uc-k[data-k="%s"]' % k)
def calc(pg, seq):
    keys(pg, 'C' + seq); return disp(pg)
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text)); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(300)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.dblclick('[data-model]'); pg.wait_for_timeout(400)
    ck('UFCalc global', pg.evaluate('typeof window.UFCalc === "object" && typeof UFCalc.register === "function"'))
    ck('botao na barra', pg.locator('#editorToolbar #btnCalc').count() == 1)
    # painel abre/fecha
    op0 = pg.evaluate('UFCalc.isOpen()')
    pg.click('#btnCalc'); pg.wait_for_timeout(100); op1 = pg.evaluate('UFCalc.isOpen()')
    pg.click('#btnCalc'); pg.wait_for_timeout(100); op2 = pg.evaluate('UFCalc.isOpen()')
    ck('painel alterna', op0 != op1 and op1 != op2 == op0, (op0, op1, op2))
    pg.evaluate('UFCalc.close()'); ck('close()', not pg.evaluate('UFCalc.isOpen()') and not pg.is_visible('#ucDisp'))
    pg.evaluate('UFCalc.open()'); ck('open()', pg.evaluate('UFCalc.isOpen()') and pg.is_visible('#ucDisp'))
    ck('secoes registradas', pg.evaluate("[].map.call(document.querySelectorAll('[data-calc]'), function(e){return e.getAttribute('data-calc')}).join()") == 'livre,ig')
    ck('registrar modulo futuro', pg.evaluate("UFCalc.register({id:'x', title:'X', build:function(b){b.appendChild(document.createTextNode('ok'))}}) && !!document.querySelector('[data-calc=x]')"))
    pg.evaluate("var s=document.querySelector('[data-calc=x]'); s.parentNode.removeChild(s)")
    # cursor do laudo: colocar caret em 'beta' e conferir que não muda ao usar o painel
    pg.click('#editor'); pg.keyboard.press('Control+End'); pg.keyboard.press('Home'); pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100)
    getr = "(function(){var r=UFTest.S.savedRange; return r ? [r.startContainer.textContent, r.startOffset, r.collapsed] : null})()"
    r0 = pg.evaluate(getr); ck('caret no laudo', r0 is not None, r0)
    # 4 operações
    ck('2+3=5', calc(pg, '2+3=') == '5', disp(pg))
    ck('9-12=-3', calc(pg, '9-12=') == '-3', disp(pg))
    ck('2,5x4=10', calc(pg, '2.5*4=') == '10', disp(pg))
    ck('7/2=3,5', calc(pg, '7/2=') == '3,5', disp(pg))
    ck('0,1+0,2=0,3', calc(pg, '.1+.2=') == '0,3', disp(pg))
    ck('1/3 ~10 digitos', calc(pg, '1/3=') == '0,3333333333', disp(pg))
    ck('exibe virgula ao digitar', calc(pg, '1.5') == '1,5', disp(pg))
    ck('divisao por zero -> erro', calc(pg, '5/0=') == 'erro', disp(pg))
    ck('apos erro continua', (keys(pg, '4+1='), disp(pg))[1] == '5', disp(pg))
    ck('encadeamento 2+3x4=20', calc(pg, '2+3*4=') == '20', disp(pg))
    ck('encadeamento parcial', calc(pg, '10-4+') == '6', disp(pg))
    ck('troca de operador', calc(pg, '8+*2=') == '16', disp(pg))
    ck('sem notacao cientifica grande', calc(pg, '99999999*99999999*99999999=') == '999999970000000000000000', disp(pg))
    ck('sem notacao cientifica pequena', calc(pg, '1/3000000000=') == '0,0000000003333333333', disp(pg))
    ck('backspace botao', (keys(pg, 'C123B'), disp(pg))[1] == '12', disp(pg))
    r1 = pg.evaluate(getr); ck('cursor preservado (botoes)', r1 == r0, (r0, r1))
    # teclado físico (com foco na calculadora)
    pg.click('#ucDisp'); pg.keyboard.press('Escape'); pg.keyboard.type('12,5*2'); pg.keyboard.press('Enter')
    ck('teclado 12,5*2 Enter', disp(pg) == '25', disp(pg))
    pg.keyboard.type('+1.25'); pg.keyboard.press('Enter'); ck('teclado ponto', disp(pg) == '26,25', disp(pg))
    pg.keyboard.type('100/8'); pg.keyboard.press('Backspace'); pg.keyboard.type('4='); ck('teclado backspace e =', disp(pg) == '25', disp(pg))
    pg.keyboard.type('9-'); pg.keyboard.press('Escape'); ck('Esc limpa', disp(pg) == '0', disp(pg))
    pg.keyboard.type('3/0'); pg.keyboard.press('Enter'); ck('teclado /0 erro', disp(pg) == 'erro', disp(pg))
    pg.keyboard.press('Escape')
    ck('laudo intacto apos teclado', 'Linha beta do modelo.' in pg.evaluate('UFTest.reportText()') and '12' not in pg.evaluate('UFTest.reportText()'))
    r2 = pg.evaluate(getr); ck('cursor preservado (teclado)', r2 == r0, (r0, r2))
    # IG relatada
    ig = lambda w, d: (pg.fill('#ucIgW', w), pg.fill('#ucIgD', d), pg.wait_for_timeout(50), pg.evaluate('UFCalc.getIgRelatada()'))[3]
    pg.evaluate('window._ev=[]; UFCalc.onIgChange(function(v){window._ev.push(v)}); 1')
    ck('evento registrado', pg.evaluate('window._ev.length') == 0)
    ck('IG vazia null', ig('', '') is None)
    ck('IG 12s3d = 87', ig('12', '3') == 87)
    ck('IG 20s sem dias = 140', ig('20', '') == 140)
    ck('IG 0s0d = 0', ig('0', '0') == 0)
    ck('IG 45s6d = 321', ig('45', '6') == 321)
    ck('IG semanas 46 invalida', ig('46', '0') is None and pg.inner_text('#ucIgMsg') != '')
    ck('IG dias 7 invalido', ig('10', '7') is None)
    ck('IG so dias invalido', ig('', '3') is None)
    ck('IG texto invalido', ig('1a', '2') is None)
    ck('IG valida limpa aviso', ig('30', '1') == 211 and pg.inner_text('#ucIgMsg') == '')
    ev = pg.evaluate('window._ev'); ck('evento onIgChange', 87 in ev and ev[-1] == 211 and None in ev, ev)
    pg.click('#ucIgW'); pg.keyboard.type('')
    r3 = pg.evaluate(getr); ck('cursor preservado (IG)', r3 == r0, (r0, r3))
    ck('IG nao gravada no storage', '211' not in pg.evaluate('JSON.stringify(localStorage)+JSON.stringify(sessionStorage)') or 'ucIg' not in pg.evaluate('JSON.stringify(localStorage)'))
    # tema escuro: painel continua legível (sem erro)
    pg.evaluate("document.body.className='theme-dark'"); ck('tema escuro aplica', pg.evaluate("getComputedStyle(document.querySelector('.uc-k')).color") != '')
    ck('sem erros no console', not ERR, ERR)
    b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
