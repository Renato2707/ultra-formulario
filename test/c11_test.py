"""C11: Backspace/Delete numa escolha já feita (frase inserida do banco) apagam um caractere, não a frase/linha inteira.
Banco genérico embutido, sem frases reais. Roda em 1024x600 e 1366x768.
Uso: python test/c11_test.py   (precisa de playwright + chromium)"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Exame Teste
@@EXAME_FULL EXAME TESTE
@@TEMPLATE Padrão
EXAME TESTE
Relatório:

Inicio ?[alfa beta gama|delta epsilon] fim.
?[Frase inteira de teste com varias palavras|Outra frase inteira de teste]
Numero * mm.
Varias ?+[um|dois|tres].
Ultima linha.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
CHOOSE = '''(a) => { var l = document.querySelectorAll('#editor .fld.f-sel'), c = l[a[0]]; UFTest.openSelect(c); UFTest.chooseOption(a[1]); }'''
def fresh(b, vw):
    c = b.new_context(viewport=vw); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.dblclick('[data-model]'); pg.wait_for_timeout(400)
    # escolhas feitas: a 1a pelo mouse (clique + Enter), a 2a e a múltipla por código
    pg.locator('#editor .fld.f-sel').nth(0).click(); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.evaluate(CHOOSE, [1, 0]); pg.wait_for_timeout(100)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    return pg
def lines(pg): return [l for l in pg.evaluate('UFTest.reportText()').splitlines()]
def L(pg, start):
    for l in lines(pg):
        if l.startswith(start): return l
    return None
def chip_text(pg, idx=0):
    return pg.evaluate('(i) => { var l = document.querySelectorAll("#editor .fld.f-sel.f-ok"); return l[i] ? l[i].textContent : null; }', idx)
def caret(pg, word, off, where='in'):
    """where='in': caret inside the chip whose text contains word, at offset off; 'after'/'before': just outside it"""
    return pg.evaluate('''(a) => { var l = document.querySelectorAll('#editor .fld'), c = null, i;
      for (i = 0; i < l.length; i++) { if (l[i].textContent.indexOf(a[0]) >= 0) { c = l[i]; } } if (!c) { return false; }
      var r = document.createRange(), ed = document.getElementById('editor'); ed.focus();
      if (a[2] === 'in') { var t = c.firstChild; r.setStart(t, a[1] < 0 ? t.nodeValue.length + a[1] + 1 : a[1]); }
      else if (a[2] === 'after') { r.setStartAfter(c); } else { r.setStartBefore(c); }
      r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return true; }''', [word, off, where])
def click_at(pg, word, frac):
    bb = pg.evaluate('''(w) => { var l = document.querySelectorAll('#editor .fld'), i; for (i = 0; i < l.length; i++) { if (l[i].textContent.indexOf(w) >= 0) { var r = l[i].getBoundingClientRect(); l[i].scrollIntoView({block: 'center'}); r = l[i].getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; } } return null; }''', word)
    pg.mouse.click(bb['x'] + bb['w'] * frac, bb['y'] + bb['h'] / 2); pg.wait_for_timeout(150)
def key(pg, k, n=1):
    for _ in range(n): pg.keyboard.press(k); pg.wait_for_timeout(40)
    pg.wait_for_timeout(120)
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw in ({'width': 1024, 'height': 600}, {'width': 1366, 'height': 768}):
        tag = '%dx%d ' % (vw['width'], vw['height'])
        pg = fresh(b, vw)
        ck(tag + '0 escolhas feitas', L(pg, 'Inicio') == 'Inicio alfa beta gama fim.' and 'Frase inteira de teste com varias palavras' in lines(pg), lines(pg))
        ck(tag + '0 escolha feita não é bloco não editável', pg.evaluate('document.querySelectorAll("#editor .f-ok[contenteditable=false]").length') == 0)
        # 1) Backspace logo depois da frase escolhida: um caractere
        caret(pg, 'alfa beta gama', 0, 'after'); key(pg, 'Backspace')
        ck(tag + '1 Backspace no fim da frase apaga 1 caractere', L(pg, 'Inicio') == 'Inicio alfa beta gam fim.', L(pg, 'Inicio'))
        key(pg, 'Backspace', 2)
        ck(tag + '1 mais 2 Backspace: 1 por vez', L(pg, 'Inicio') == 'Inicio alfa beta g fim.', L(pg, 'Inicio'))
        pg.keyboard.type('ama!'); pg.wait_for_timeout(150)
        ck(tag + '1 reescrever no lugar', L(pg, 'Inicio') == 'Inicio alfa beta gama! fim.', L(pg, 'Inicio'))
        ck(tag + '1 linhas vizinhas intactas', L(pg, 'Frase inteira') == 'Frase inteira de teste com varias palavras' and L(pg, 'Ultima') == 'Ultima linha.', lines(pg))
        # 2) Backspace no meio da frase (linha inteira = escolha)
        caret(pg, 'Frase inteira', 5, 'in'); key(pg, 'Backspace')
        ck(tag + '2 Backspace no meio apaga 1 caractere', L(pg, 'Fras') == 'Fras inteira de teste com varias palavras', lines(pg))
        ck(tag + '2 a linha continua', len([l for l in lines(pg) if l.startswith('Fras')]) == 1 and L(pg, 'Numero') is not None)
        pg.close()
        # 3) clique real no fim da linha inteira (a lista abre) e Backspace: fecha a lista e apaga 1 caractere
        pg = fresh(b, vw)
        click_at(pg, 'Frase inteira', 0.995)
        ck(tag + '3 clique na escolha ainda abre a lista', pg.evaluate('!document.getElementById("popup").hidden'))
        key(pg, 'End'); key(pg, 'Backspace')
        ck(tag + '3 clique + Backspace: 1 caractere', L(pg, 'Frase') == 'Frase inteira de teste com varias palavra', lines(pg))
        ck(tag + '3 lista fechou', pg.evaluate('document.getElementById("popup").hidden'))
        key(pg, 'Backspace', 3)
        ck(tag + '3 segurando: 1 por vez', L(pg, 'Frase') == 'Frase inteira de teste com varias pala', lines(pg))
        # 4) clique no meio da frase e digitar: entra no ponto do clique
        click_at(pg, 'alfa beta gama', 0.5); key(pg, 'Backspace')
        t = L(pg, 'Inicio')
        ck(tag + '4 clique no meio + Backspace: 1 caractere', t is not None and len(t) == len('Inicio alfa beta gama fim.') - 1 and t.startswith('Inicio ') and t.endswith(' fim.'), t)
        pg.close()
        # 5) Delete antes/dentro da frase
        pg = fresh(b, vw)
        caret(pg, 'alfa beta gama', 0, 'before'); key(pg, 'Delete')
        ck(tag + '5 Delete no início da frase: 1 caractere', L(pg, 'Inicio') == 'Inicio lfa beta gama fim.', L(pg, 'Inicio'))
        caret(pg, 'Frase inteira', 6, 'in'); key(pg, 'Delete')
        ck(tag + '5 Delete no meio: 1 caractere', L(pg, 'Frase') == 'Frase nteira de teste com varias palavras', lines(pg))
        pg.close()
        # 6) Ctrl+Backspace apaga uma palavra; Ctrl+Delete também
        pg = fresh(b, vw)
        caret(pg, 'alfa beta gama', 0, 'after'); key(pg, 'Control+Backspace')
        ck(tag + '6 Ctrl+Backspace apaga 1 palavra', L(pg, 'Inicio') == 'Inicio alfa beta  fim.', L(pg, 'Inicio'))
        caret(pg, 'Frase inteira', 0, 'in'); key(pg, 'Control+Delete')
        t = [l for l in lines(pg) if 'inteira de teste' in l]
        ck(tag + '6 Ctrl+Delete apaga 1 palavra', len(t) == 1 and t[0].strip() == 'inteira de teste com varias palavras', lines(pg))
        pg.close()
        # 7) selecionar parte e digitar substitui só a seleção; duplo clique numa palavra
        pg = fresh(b, vw)
        pg.evaluate('''() => { var l = document.querySelectorAll('#editor .fld.f-sel.f-ok'), c = l[1], t = c.firstChild, r = document.createRange();
          document.getElementById('editor').focus(); r.setStart(t, 6); r.setEnd(t, 13); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }''')
        pg.keyboard.type('nova'); pg.wait_for_timeout(150)
        ck(tag + '7 seleção + digitar substitui', L(pg, 'Frase') == 'Frase nova de teste com varias palavras', lines(pg))
        pg.close()
        # 8) tolerância: apagar a frase toda, letra a letra, e escrever outra; a linha e as vizinhas ficam
        pg = fresh(b, vw)
        caret(pg, 'alfa beta gama', 0, 'after'); key(pg, 'Backspace', len('alfa beta gama'))
        ck(tag + '8 apagar letra a letra até o fim', L(pg, 'Inicio') == 'Inicio  fim.', L(pg, 'Inicio'))
        pg.keyboard.type('zeta'); pg.wait_for_timeout(150)
        ck(tag + '8 escrever outra no lugar', L(pg, 'Inicio') == 'Inicio zeta fim.', L(pg, 'Inicio'))
        n0 = len(lines(pg))
        caret(pg, 'Frase inteira', -1, 'in'); key(pg, 'Backspace', len('Frase inteira de teste com varias palavras'))
        ls = lines(pg)
        ck(tag + '8 linha inteira apagada letra a letra: só ela esvazia', len(ls) == n0 and L(pg, 'Inicio') == 'Inicio zeta fim.' and L(pg, 'Numero') == 'Numero ___ mm.' and 'Frase' not in ' '.join(ls), ls)
        pg.keyboard.type('Nova linha'); pg.wait_for_timeout(150)
        ck(tag + '8 escrever outra linha no lugar', L(pg, 'Nova linha') == 'Nova linha' and len(lines(pg)) == n0, lines(pg))
        pg.close()
        # 9) Ctrl+Z desfaz o Backspace
        pg = fresh(b, vw)
        caret(pg, 'alfa beta gama', 0, 'after'); key(pg, 'Backspace', 2); key(pg, 'Control+z')
        ck(tag + '9 Ctrl+Z desfaz', 'alfa beta ga' in (L(pg, 'Inicio') or '') and (L(pg, 'Inicio') or '') != 'Inicio alfa beta ga fim.', L(pg, 'Inicio'))
        pg.close()
        # 10) "escolher" e "___" continuam funcionando
        pg = fresh(b, vw)
        ck(tag + '10 escolha intacta continua escolha', chip_text(pg, 0) == 'alfa beta gama')
        click_at(pg, 'alfa beta gama', 0.5); key(pg, '2')
        ck(tag + '10 clique + número troca a escolha', L(pg, 'Inicio') == 'Inicio delta epsilon fim.', L(pg, 'Inicio'))
        click_at(pg, 'escolher', 0.5)
        ck(tag + '10 escolher abre a lista', pg.evaluate('!document.getElementById("popup").hidden'))
        pg.keyboard.type('xy'); pg.wait_for_timeout(120)
        ck(tag + '10 digitar com a lista do escolher aberta não estraga', L(pg, 'Varias') == 'Varias ___.' and pg.evaluate('document.querySelectorAll("#editor .fld.f-multi").length') == 1, L(pg, 'Varias'))
        key(pg, 'Enter'); key(pg, 'Tab')
        ck(tag + '10 escolha múltipla marca e confirma', L(pg, 'Varias') == 'Varias um.', L(pg, 'Varias'))
        click_at(pg, '___', 0.5); pg.keyboard.type('123'); pg.wait_for_timeout(100); key(pg, 'Backspace')
        ck(tag + '10 campo ___: Backspace apaga 1 dígito', L(pg, 'Numero') == 'Numero 12 mm.', L(pg, 'Numero'))
        key(pg, 'Backspace', 2)
        ck(tag + '10 campo ___ volta ao vazio', L(pg, 'Numero') == 'Numero ___ mm.', L(pg, 'Numero'))
        # escolha múltipla feita: Backspace no fim apaga 1 caractere
        caret(pg, 'um', 0, 'after'); key(pg, 'Backspace')
        ck(tag + '10 múltipla feita: Backspace 1 caractere', L(pg, 'Varias') == 'Varias u.', L(pg, 'Varias'))
        pg.close()
        # 11) escolha antiga/calculadora gravada como bloco (contenteditable=false): também apaga 1 caractere
        pg = fresh(b, vw)
        pg.evaluate('''() => { var l = document.querySelectorAll('#editor .fld.f-sel.f-ok'), i; for (i = 0; i < l.length; i++) { l[i].setAttribute('contenteditable', 'false'); l[i]._ufx = undefined; } }''')
        caret(pg, 'alfa beta gama', 0, 'after'); key(pg, 'Backspace')
        ck(tag + '11 rascunho antigo (bloco) também 1 caractere', L(pg, 'Inicio') == 'Inicio alfa beta gam fim.', L(pg, 'Inicio'))
        # 12) Enter dentro da frase quebra a linha normalmente
        caret(pg, 'Frase inteira', 5, 'in'); key(pg, 'Enter')
        ck(tag + '12 Enter no meio da frase quebra a linha', L(pg, 'Frase') == 'Frase' and len([l for l in lines(pg) if l.strip() == 'inteira de teste com varias palavras']) == 1, lines(pg))
        pg.close()
    b.close()
os.unlink(f.name)
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
