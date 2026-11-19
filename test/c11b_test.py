"""C11b: apagar uma linha crítica leva a marca junto; a marca nunca passa para a linha vizinha (e uma linha comum
apagada acima de uma crítica não tira a marca dela). Banco genérico embutido, sem frases reais. 1024x600 e 1366x768.
Uso: python test/c11b_test.py   (precisa de playwright + chromium)"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Exame Teste
@@EXAME_FULL EXAME TESTE
@@TEMPLATE Padrão
EXAME TESTE
Linha um.
Alfa presente.
*** Beta mede cerca de * mm (V.R.: até 2,5 mm).
Gama ausente em fundo.
*** Delta confere.
Epsilon normal.
Linha final.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:400])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
FIND = '''function fl(w) { var l = UFTest.editorLines(), i; for (i = 0; i < l.length; i++) { if (UFTest.lineText(l[i]).replace(/^\\s+/, '').indexOf(w) === 0) { return l[i]; } } return null; }
  function put(r) { document.getElementById('editor').focus(); var x = window.getSelection(); x.removeAllRanges(); x.addRange(r); }'''
def sel(pg, a, b, end):
    """from the start of line a to: 'next' = start of line b's text, 'eol' = end of line b, 'el' = start of line b element"""
    pg.evaluate('(a) => { ' + FIND + ''' var s = fl(a[0]), e = fl(a[1]), r = document.createRange(); r.setStart(s, 0);
      if (a[2] === 'eol') { r.setEnd(e, e.childNodes.length); } else if (a[2] === 'el') { r.setEnd(e, 0); }
      else { var w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null, false), n; while ((n = w.nextNode()) && !/\\S/.test(n.nodeValue)) {} var k = n.nodeValue.search(/\\S/); r.setEnd(n, k); }
      put(r); }''', [a, b, end])
def caret(pg, a, where):
    pg.evaluate('(a) => { ' + FIND + ''' var s = fl(a[0]), r = document.createRange(); r.selectNodeContents(s); r.collapse(a[1] === 'start'); put(r); }''', [a, where])
def state(pg):
    return pg.evaluate('''() => { var a = [], l = UFTest.editorLines(), i; for (i = 0; i < l.length; i++) { a.push([UFTest.lineText(l[i]).replace(/^\\s+/, ''), /\\bcrit\\b/.test(l[i].className)]); } return a; }''')
def crits(pg): return [t for t, c in state(pg) if c]
def count(pg): return pg.evaluate('UFTest.critState().pend.length')
def footer(pg): return pg.inner_text('#btnCritCount') if pg.is_visible('#btnCritCount') else ''
def line(pg, w):
    for t, c in state(pg):
        if t.startswith(w): return (t, c)
    return None
def key(pg, k, n=1):
    for _ in range(n): pg.keyboard.press(k)
    pg.wait_for_timeout(200)
def fresh(b, vw):
    c = b.new_context(viewport=vw); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.dblclick('[data-model]'); pg.wait_for_timeout(400)
    return pg
B = 'Beta mede cerca de ___ mm (V.R.: até 2,5 mm).'
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw in ({'width': 1024, 'height': 600}, {'width': 1366, 'height': 768}):
        tag = '%dx%d ' % (vw['width'], vw['height'])
        def ok_gone(pg, n, gone='Beta'):
            cs = crits(pg)
            ck(tag + n + ': linha crítica some com a marca', not any(t.startswith(gone) for t, c in state(pg)) and not any(gone in t for t in cs), state(pg))
            ck(tag + n + ': nenhuma vizinha ficou crítica', all(t.startswith('Beta') or t.startswith('Delta') for t in cs), cs)
            ck(tag + n + ': contador', count(pg) == len(cs) == (2 if gone == 'Alfa' else 1), [count(pg), cs, footer(pg)])
        pg = fresh(b, vw)
        ck(tag + '0 início: Beta e Delta críticas', crits(pg) == [B, 'Delta confere.'] and count(pg) == 2 and '2' in footer(pg), [crits(pg), footer(pg)])
        # 1) selecionar do início da crítica até o texto da linha de baixo + Backspace / Delete
        for k in ('Backspace', 'Delete'):
            sel(pg, 'Beta', 'Gama', 'next'); key(pg, k)
            ok_gone(pg, '1 seleção até o texto de baixo + ' + k)
            ck(tag + '1 Gama continua comum (' + k + ')', line(pg, 'Gama') == ('Gama ausente em fundo.', False), state(pg))
            key(pg, 'Control+z')
            ck(tag + '1 Ctrl+Z volta Beta crítica e Gama comum (' + k + ')', line(pg, 'Beta') == (B, True) and line(pg, 'Gama') == ('Gama ausente em fundo.', False) and count(pg) == 2, state(pg))
        pg.close()
        # 2) as duas linhas (Alfa + Beta) selecionadas até o fim da crítica / até a linha seguinte
        for end in ('eol', 'el', 'next'):
            for k in ('Backspace', 'Delete'):
                pg = fresh(b, vw); sel(pg, 'Alfa', 'Beta' if end == 'eol' else 'Gama', end); key(pg, k)
                ok_gone(pg, '2 Alfa+Beta (%s) + %s' % (end, k))
                ck(tag + '2 Gama comum (%s, %s)' % (end, k), line(pg, 'Gama') == ('Gama ausente em fundo.', False), state(pg)); pg.close()
        # 3) selecionar e digitar por cima
        pg = fresh(b, vw); sel(pg, 'Alfa', 'Gama', 'next'); pg.keyboard.type('Nova'); pg.wait_for_timeout(200)
        ok_gone(pg, '3 seleção + digitar')
        ck(tag + '3 texto novo + Gama comum', line(pg, 'NovaGama') == ('NovaGama ausente em fundo.', False), state(pg)); pg.close()
        pg = fresh(b, vw); sel(pg, 'Beta', 'Gama', 'next'); pg.keyboard.type('Z'); pg.wait_for_timeout(200)
        ok_gone(pg, '3b crítica + digitar')
        pg.close()
        # 4) Shift+seta para baixo (seleção de linhas inteiras) + Backspace
        pg = fresh(b, vw); caret(pg, 'Alfa', 'start'); key(pg, 'Shift+ArrowDown', 2); key(pg, 'Backspace')
        cs = crits(pg)   # em 1024 a linha crítica quebra em duas linhas na tela: o resto dela continua crítico
        ck(tag + '4 Shift+baixo + Backspace: só resto da crítica e Delta', all(t == 'Delta confere.' or (t and B.endswith(t)) for t in cs) and 'Delta confere.' in cs, cs)
        ck(tag + '4 Shift+baixo + Backspace: Gama comum, contador', line(pg, 'Gama') == ('Gama ausente em fundo.', False) and count(pg) == len(cs), state(pg))
        pg.close()
        # 5) Backspace do fim da linha crítica até juntar com a de cima; Delete do início até puxar a de baixo
        D = len('Delta confere.')
        pg = fresh(b, vw); caret(pg, 'Delta', 'end'); key(pg, 'Backspace', D + 1)
        ok_gone(pg, '5 Backspace do fim', 'Delta')
        ck(tag + '5 Gama (acima) continua comum', line(pg, 'Gama') == ('Gama ausente em fundo.', False), state(pg)); pg.close()
        pg = fresh(b, vw); caret(pg, 'Delta', 'start'); key(pg, 'Delete', D + 1)
        ok_gone(pg, '5 Delete do início', 'Delta')
        ck(tag + '5 Epsilon (abaixo) não herda a marca', line(pg, 'Epsilon') == ('Epsilon normal.', False), state(pg)); pg.close()
        pg = fresh(b, vw); caret(pg, 'Delta', 'end'); key(pg, 'Shift+Home'); key(pg, 'Backspace'); key(pg, 'Delete')
        ok_gone(pg, '5 Shift+Home + Backspace + Delete', 'Delta')
        ck(tag + '5 Epsilon comum (Shift+Home)', line(pg, 'Epsilon') == ('Epsilon normal.', False), state(pg)); pg.close()
        # 6) inverso: linha comum apagada acima de uma crítica não tira nem move a marca
        G = len('Gama ausente em fundo.')
        for how in ('sel-Backspace', 'sel-Delete', 'Delete-do-inicio', 'Backspace-do-fim', 'Backspace-no-inicio-da-critica'):
            pg = fresh(b, vw)
            if how == 'sel-Backspace': sel(pg, 'Gama', 'Delta', 'next'); key(pg, 'Backspace')
            if how == 'sel-Delete': sel(pg, 'Gama', 'Delta', 'el'); key(pg, 'Delete')
            if how == 'Delete-do-inicio': caret(pg, 'Gama', 'start'); key(pg, 'Delete', G + 1)
            if how == 'Backspace-do-fim': caret(pg, 'Gama', 'end'); key(pg, 'Backspace', G + 1)
            if how == 'Backspace-no-inicio-da-critica': caret(pg, 'Delta', 'start'); key(pg, 'Backspace')
            ls = state(pg)
            want = [B, 'Delta confere.'] if how != 'Backspace-no-inicio-da-critica' else [B, 'Gama ausente em fundo.Delta confere.']
            ck(tag + '6 inverso %s: crítica continua crítica' % how, crits(pg) == want and count(pg) == 2, ls)
            ck(tag + '6 inverso %s: vizinhas comuns' % how, line(pg, 'Epsilon') == ('Epsilon normal.', False) and line(pg, 'Linha final') == ('Linha final.', False), ls)
            pg.close()
        # 7) editar dentro da crítica continua crítica; marca não pula ao preencher o campo
        pg = fresh(b, vw)
        pg.locator('#editor .fld').first.click(); pg.wait_for_timeout(100); pg.keyboard.type('12'); pg.wait_for_timeout(200)
        ck(tag + '7 preencher campo da crítica mantém só ela crítica', crits(pg) == ['Beta mede cerca de 12 mm (V.R.: até 2,5 mm).', 'Delta confere.'], crits(pg))
        caret(pg, 'Delta', 'end'); key(pg, 'Backspace', 3)
        ck(tag + '7 apagar parte da crítica mantém a marca', line(pg, 'Delta con') == ('Delta confe', True) and count(pg) == 2, state(pg))
        pg.close()
    b.close()
os.unlink(f.name)
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
