"""Lote de correções (itens 1, 2, 3, 4, 7, 8): Doppler gemelar por feto, histórico da calculadora, número da opção
(teclado de cima e numérico), linhas críticas reconhecidas ao colar, laudo colado preservado, Doppler montado no app.
Banco genérico embutido (frases equivalentes, nenhum texto do banco real).
Uso: python test/lote_test.py   (precisa playwright + chromium)"""
import os, sys, tempfile, math
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Doppler Teste
@@EXAME_FULL DOPPLER TESTE

@@TEMPLATE Doppler Teste (padrão)
DOPPLER TESTE
Relatório ecográfico:

Fluxo do leito vascular fetoplacentário:
Artéria Umbilical: padrão espectral habitual de teste.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

Fluxo do leito vascular fetal:
Artéria Cerebral Média: padrão espectral habitual de teste.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).

Hipótese/impressão diagnóstica:
*****- Artéria Umbilical com padrão de teste habitual.
*****- Ducto venoso com onda A positiva.
- Conclusão de teste habitual.

Considerações gerais: texto de teste.

@@TEMPLATE Doppler Teste (gemelar)
DOPPLER TESTE GEMELAR
Relatório ecográfico:

FETO 1:
Artéria Umbilical: padrão espectral habitual de teste.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

Artéria Cerebral Média: padrão espectral habitual de teste.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).

FETO 2:
Artéria Umbilical: padrão espectral habitual de teste.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

Artéria Cerebral Média: padrão espectral habitual de teste.
- Índice de pulsatilidade (IP): *
- Índice de resistência (IR): *

PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).
- Relação cerebroplacentária (RCP): IP cerebral média / IP umbilical = *,* (p5 para * semanas: *,*).

Hipótese/impressão diagnóstica:
- Conclusão de teste habitual.

##SECTION ARTÉRIA UMBILICAL
@@SUBSTITUI = Artéria Umbilical

Umbilical alta:
Artéria umbilical: padrão espectral de teste alterado.

Hipótese Umbilical alta:
- Artéria umbilical com teste alterado.

##SECTION OUTROS

Outra habitual:
- Artéria umbilical com padrão de teste habitual.

@@EXAME Obstetrica Teste
@@EXAME_FULL OBSTETRICA TESTE

@@TEMPLATE Obstetrica Teste (padrão)
OBSTETRICA TESTE
Técnica: texto de teste.

RELATÓRIO ECOGRÁFICO

Feto em situação ?[longitudinal|transversa|oblíqua], dorso ?[à direita|à esquerda].
***Osso nasal presente.
***Translucência nucal mede cerca de * mm (V.R.: até 2,5 mm).

BIOMETRIA FETAL
    • Diâmetro biparietal (DBP): * mm.
    • Circunferência cefálica (CC): * mm.
    • Circunferência abdominal (CA): * mm.
    • Comprimento do fêmur (CF): * mm.
    • Peso fetal estimado em: * gramas (+- 15%).

Placenta de teste (escala 0 – III).

Hipótese/Impressão diagnóstica:
Biometria Fetal Composta equivalente a * semanas (± 2/3 semanas).
'''
OBST = '''OBSTETRICA TESTE
Técnica: texto de teste.

RELATÓRIO ECOGRÁFICO

Feto em situação longitudinal, dorso à esquerda.

BIOMETRIA FETAL
    • Diâmetro biparietal (DBP): 90 mm.
    • Circunferência cefálica (CC): 325 mm.
    • Circunferência abdominal (CA): 320 mm.
    • Comprimento do fêmur (CF): 70 mm.
    • Peso fetal estimado em: 2900 gramas (+- 15%).

Placenta de teste (escala 0 – III).

Hipótese/Impressão diagnóstica:
Biometria Fetal Composta equivalente a 37 semanas (± 2/3 semanas).'''
DOP = '''DOPPLER TESTE
Relatório ecográfico:

Fluxo do leito vascular fetoplacentário:
Artéria umbilical: padrão espectral de teste alterado.
- Índice de pulsatilidade (IP): 0,96
- Índice de resistência (IR): 0,6

Fluxo do leito vascular fetal:
Artéria Cerebral Média: padrão espectral habitual de teste.
- Índice de pulsatilidade (IP): 0,92
- Índice de resistência (IR): 0,57

PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = 1,04 (V.R.: < 1).

Hipótese/impressão diagnóstica:
- Conclusão de teste com centralização.
- Ducto venoso com onda A positiva.

Considerações gerais: texto de teste.'''
def f2(x):
    c = int(math.floor(x * 100 + 0.5)); s = '%d,%02d' % (c // 100, c % 100); s = s.rstrip('0'); return s[:-1] if s.endswith(',') else s
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:400])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
ERR = []
def fresh(b, exam=0, model=None):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text)); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.locator('[data-exam]').nth(exam).click(); pg.wait_for_timeout(700)
    if model is not None: pg.locator('[data-model]').nth(model).dblclick(); pg.wait_for_timeout(400)
    return pg
def raw(pg):   # texto do laudo sem a troca de travessões/marcadores (opção normPunct) e com \\n
    return pg.evaluate("(function(){var s=UFTest.S.settings, o=s.normPunct; s.normPunct=false; var t=UFTest.reportText(); s.normPunct=o; return t.replace(/\\r/g,'');})()")
def L(pg, start, nth=0):
    ls = [l for l in raw(pg).splitlines() if l.strip().startswith(start)]
    return ls[nth] if len(ls) > nth else ''
def ix(pg, start, nth=0):
    return pg.evaluate('''(a) => { var all = [].slice.call(document.querySelectorAll('#editor .fld')), out = [];
      all.forEach(function (f, i) { var n = f; while (n && n.nodeName !== 'DIV') { n = n.parentNode; }
        if ((n.textContent || '').replace(/^[\\s\\u2022\\u00a0]+/, '').indexOf(a[0]) === 0) { out.push(i); } }); return out[a[1]]; }''', [start, nth])
def typ(pg, i, txt):
    bb = pg.locator('#editor .fld').nth(i).bounding_box(); pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(50)
    pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i], r = document.createRange(); r.selectNodeContents(f);
      var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''', i)
    pg.keyboard.type(txt); pg.wait_for_timeout(80)
def paste(pg, t):
    pg.evaluate('''(t) => { var dt = new DataTransfer(); dt.setData('text/plain', t); document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }''', t); pg.wait_for_timeout(400)
def caret_empty(pg):   # clique no laudo vazio (cursor na própria caixa do laudo)
    pg.evaluate('''() => { var e = document.getElementById('editor'); e.focus(); var r = document.createRange(); r.setStart(e, 0); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''')
def select_all(pg):
    pg.evaluate('''() => { var e = document.getElementById('editor'); e.focus(); var r = document.createRange(); r.selectNodeContents(e); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }''')
def sel_lines(pg, a, z):
    pg.evaluate('''(x) => { var ls = UFTest.editorLines(), i, s = null, e = null; for (i = 0; i < ls.length; i++) { var t = UFTest.lineText(ls[i]).replace(/^\\s+/, ''); if (s === null && t.indexOf(x[0]) === 0) s = ls[i]; if (s !== null && t.indexOf(x[1]) === 0) { e = ls[i]; break; } }
      var ed = document.getElementById('editor'); ed.focus(); var r = document.createRange(); r.setStart(s, 0); r.setEnd(e, e.childNodes.length); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }''', [a, z])
def caret_end_of(pg, start):
    pg.evaluate('''(a) => { var ls = UFTest.editorLines(), i; for (i = 0; i < ls.length; i++) { if (UFTest.lineText(ls[i]).replace(/^\\s+/, '').indexOf(a) === 0) { var e = document.getElementById('editor'); e.focus(); var r = document.createRange(); r.selectNodeContents(ls[i]); r.collapse(false); var s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } } }''', start)
def crits(pg): return pg.evaluate("[].map.call(document.querySelectorAll('#editor .crit'), function(e){return UFTest.lineText(e).replace(/\\s+$/, '')})")
def phid(pg, sec, title):
    return pg.evaluate('''(a) => { var S = UFTest.S, k; for (k in S.phraseIndex) { var c = S.phraseIndex[k]; if (c.section === a[0] && c.ph.title === a[1]) return k; } return null; }''', [sec, title])
def numpad(pg, d):   # tecla do teclado numérico com NumLock ligado (keyCode 96+d), via CDP
    s = pg.context.new_cdp_session(pg)
    s.send('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'key': str(d), 'code': 'Numpad%d' % d, 'windowsVirtualKeyCode': 96 + d, 'nativeVirtualKeyCode': 96 + d, 'location': 3})
    s.send('Input.dispatchKeyEvent', {'type': 'char', 'text': str(d), 'key': str(d), 'code': 'Numpad%d' % d, 'location': 3})
    s.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': str(d), 'code': 'Numpad%d' % d, 'windowsVirtualKeyCode': 96 + d, 'nativeVirtualKeyCode': 96 + d, 'location': 3})
    s.detach(); pg.wait_for_timeout(150)
IP = '- Índice de pulsatilidade (IP):'; IR = '- Índice de resistência (IR):'; REL = '- Relação: IP umbilical'

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- item 1: Doppler gemelar, um cálculo por feto ----------
    pg = fresh(b, 0, 1)
    for n, v in enumerate(['0,96', '0,92', '1,1', '1,5']): typ(pg, ix(pg, IP, n), v)
    ck('1 gemelar: relação do feto 1 = 0,96/0,92', L(pg, REL, 0) == '- Relação: IP umbilical / IP cerebral média = %s (V.R.: < 1).' % f2(0.96 / 0.92), L(pg, REL, 0))
    ck('1 gemelar: relação do feto 2 = 1,1/1,5', L(pg, REL, 1) == '- Relação: IP umbilical / IP cerebral média = %s (V.R.: < 1).' % f2(1.1 / 1.5), L(pg, REL, 1))
    ck('1 gemelar: RCP do feto 2 com os IP do feto 2', '= %s (p5' % f2(1.5 / 1.1) in L(pg, '- Relação cerebroplacentária'), L(pg, '- Relação cerebroplacentária'))
    typ(pg, ix(pg, IP, 2), 'x')
    ck('1 gemelar: IP do feto 2 apagado -> só o feto 2 fica em branco', '= ___ (V.R.' in L(pg, REL, 1) and '= %s (V.R.' % f2(0.96 / 0.92) in L(pg, REL, 0), (L(pg, REL, 0), L(pg, REL, 1)))
    pg.close()
    pg = fresh(b, 0, 0); typ(pg, ix(pg, IP, 0), '0,96'); typ(pg, ix(pg, IP, 1), '0,92')
    ck('1 feto único continua: 0,96/0,92 = 1,04', L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = 1,04 (V.R.: < 1).', L(pg, REL))
    pg.close()

    # ---------- item 2: histórico da calculadora ----------
    pg = fresh(b, 0, 0); pg.evaluate("UFCalc.open(); UFCalc.setOpen('livre', true)")
    pg.click('.uc-calc'); pg.keyboard.type('2+3*4='); pg.keyboard.type('10/4='); pg.wait_for_timeout(100)
    hs = pg.evaluate("[].map.call(document.querySelectorAll('#ucHist .uc-hi'), function(e){return e.textContent})")
    ck('2 histórico: contas inteiras, a mais nova primeiro', hs == ['10 \u00f7 4 = 2,5', '2 + 3 \u00d7 4 = 20'], hs)
    pg.click('#ucHist .uc-hi >> nth=1'); pg.wait_for_timeout(80)
    ck('2 clicar no histórico volta o resultado ao visor', pg.inner_text('#ucDisp') == '20', pg.inner_text('#ucDisp'))
    pg.keyboard.type('+1='); pg.wait_for_timeout(80)
    ck('2 continua a conta a partir do resultado', pg.evaluate("document.querySelector('#ucHist .uc-hi').textContent") == '20 + 1 = 21')
    for k in range(12): pg.keyboard.type('%d+1=' % k)
    ck('2 histórico guarda no máximo 10', pg.locator('#ucHist .uc-hi').count() == 10, pg.locator('#ucHist .uc-hi').count())
    ck('2 Esc limpa o visor mas não o histórico', (pg.keyboard.press('Escape') or True) and pg.locator('#ucHist .uc-hi').count() == 10)
    pg.click('#ucReset'); pg.wait_for_timeout(80)
    ck('2 Limpar do painel apaga o histórico (e o esconde)', pg.locator('#ucHist .uc-hi').count() == 0 and pg.evaluate("document.getElementById('ucHist').style.display") == 'none')
    ck('2 laudo não muda com a calculadora', L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = ___ (V.R.: < 1).', L(pg, REL))
    pg.close()

    # ---------- item 3: número da opção pelo teclado ----------
    FT = 'Feto em situação'
    pg = fresh(b, 1, 0); caret_empty(pg); pg.keyboard.press('Tab'); pg.wait_for_timeout(150)
    ck('3 lista aberta no 1º campo (Tab)', pg.evaluate("!document.getElementById('popup').hidden"))
    pg.keyboard.press('2'); pg.wait_for_timeout(150)
    ck('3 tecla 2 (linha de cima) escolhe a 2ª opção', L(pg, FT).startswith('Feto em situação transversa, dorso'), L(pg, FT))
    ck('3 depois da escolha vai à próxima lista (aberta)', pg.evaluate("!document.getElementById('popup').hidden"))
    numpad(pg, 2)
    ck('3 tecla 2 do teclado numérico escolhe a 2ª opção', L(pg, FT) == 'Feto em situação transversa, dorso à esquerda.', L(pg, FT))
    pg.close()
    pg = fresh(b, 1, 0); caret_empty(pg); pg.keyboard.press('Tab'); pg.wait_for_timeout(150); numpad(pg, 3)
    ck('3 numérico 3 na lista aberta', L(pg, FT).startswith('Feto em situação oblíqua,'), L(pg, FT))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    pg.evaluate("(function(){var f=document.querySelectorAll('#editor .fld')[1]; var r=document.createRange(); r.selectNode(f); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    numpad(pg, 1)
    ck('3 campo destacado (lista fechada) + numérico 1: escolhe, não digita "1"', L(pg, FT) == 'Feto em situação oblíqua, dorso à direita.', L(pg, FT))
    pg.keyboard.press('Escape')
    pg.evaluate("(function(){var f=document.querySelectorAll('#editor .fld')[1]; var r=document.createRange(); r.selectNode(f); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    pg.keyboard.press('9'); pg.wait_for_timeout(120)
    ck('3 número maior que as opções não faz nada', L(pg, FT) == 'Feto em situação oblíqua, dorso à direita.' and pg.evaluate("document.getElementById('popup').hidden"), L(pg, FT))
    bb = pg.locator('#editor .fld').nth(0).bounding_box(); pg.mouse.click(bb['x'] + 4, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(150)
    numpad(pg, 1)
    ck('3 lista reaberta numa escolha feita + numérico 1 troca a opção', L(pg, FT) == 'Feto em situação longitudinal, dorso à direita.', L(pg, FT))
    ck('3 nenhum número aparece na tela além dos que a lista já tinha', pg.evaluate("document.querySelectorAll('#editor .fld b').length") == 0)
    pg.close()

    # ---------- item 4: linhas críticas do banco reconhecidas ao colar ----------
    pg = fresh(b, 1); caret_empty(pg)
    paste(pg, 'Linha comum.\n\u00a0 Osso  nasal\u00a0presente.   \nTRANSLUCENCIA NUCAL mede cerca de 1,8 mm (V.R.: até 2,5 mm).\nTranslucência nucal mede cerca de ___ mm (V.R.: até 2,5 mm).\nOsso nasal ausente.')
    c = crits(pg)
    ck('4 NBSP, espaços duplos e no fim: crítica', '\u00a0 Osso  nasal\u00a0presente.' in c or 'Osso  nasal presente.' in [x.strip().replace('\u00a0', ' ') for x in c], c)
    ck('4 maiúsculas/sem acento e número no campo: crítica', 'TRANSLUCENCIA NUCAL mede cerca de 1,8 mm (V.R.: até 2,5 mm).' in c, c)
    ck('4 campo "___": crítica', 'Translucência nucal mede cerca de ___ mm (V.R.: até 2,5 mm).' in c, c)
    ck('4 texto diferente não é crítico', len(c) == 3, c)
    ck('4 contador de críticas', '3' in pg.evaluate("document.getElementById('btnCritCount').textContent"), pg.evaluate("document.getElementById('btnCritCount').textContent"))
    pg.close()
    pg = fresh(b, 0); caret_empty(pg)
    paste(pg, '- Artéria umbilical com padrão de teste habitual.\n- Artéria Umbilical com padrão de teste habitual.\n-\u00a0Ducto venoso com onda A positiva.')
    c = crits(pg)
    ck('4 igual a uma linha NÃO crítica do banco (escrita igual): não marca', '- Artéria umbilical com padrão de teste habitual.' not in c, c)
    ck('4 igual à linha crítica do modelo: marca', '- Artéria Umbilical com padrão de teste habitual.' in c and len(c) == 2, c)
    pg.close()
    pg = fresh(b, 0, 0)
    sel_lines(pg, '- Artéria Umbilical com', '- Conclusão de teste'); paste(pg, '- Conclusão livre um.\n- Conclusão livre dois.')
    ck('4 texto colado sobre linhas críticas não herda a marca', crits(pg) == [], crits(pg))
    pg.close()
    pg = fresh(b, 0, 0); caret_end_of(pg, '- Ducto venoso'); pg.keyboard.press('Enter'); pg.keyboard.type('linha nova'); pg.wait_for_timeout(150)
    ck('4 Enter no fim de uma crítica: a linha nova não é crítica', crits(pg) == ['- Artéria Umbilical com padrão de teste habitual.', '- Ducto venoso com onda A positiva.'], crits(pg))
    pg.close()

    # ---------- item 7: laudo colado preservado ----------
    pg = fresh(b, 1); caret_empty(pg); paste(pg, OBST)
    t = raw(pg)
    ck('7 colado no laudo vazio: texto idêntico', t == OBST, '\n'.join(l for l in __import__('difflib').unified_diff(OBST.splitlines(), t.splitlines(), lineterm='', n=0)))
    ck('7 sem linha em branco antes do título', t.splitlines()[0] == 'OBSTETRICA TESTE' and pg.evaluate("UFTest.reportText()").split('\r\n')[0] == 'OBSTETRICA TESTE', repr(t[:40]))
    ck('7 linha em branco depois de "RELATÓRIO ECOGRÁFICO"', t.splitlines()[3:5] == ['RELATÓRIO ECOGRÁFICO', ''], t.splitlines()[2:6])
    ck('7 4 espaços antes de "•"', L(pg, '• Diâmetro biparietal') == '    • Diâmetro biparietal (DBP): 90 mm.', repr(L(pg, '• Diâmetro biparietal')))
    ck('7 "37 semanas" com espaço e sem ser recalculado', L(pg, 'Biometria Fetal Composta') == 'Biometria Fetal Composta equivalente a 37 semanas (± 2/3 semanas).', L(pg, 'Biometria Fetal Composta'))
    ck('7 PFE colado não é recalculado', L(pg, '• Peso fetal') == '    • Peso fetal estimado em: 2900 gramas (+- 15%).', L(pg, '• Peso fetal'))
    ck('7 campos voltaram (calculadora lê os valores)', pg.locator('#editor .fld').count() == 8, pg.locator('#editor .fld').count())
    typ(pg, ix(pg, 'Comprimento do fêmur'), '72'); pg.wait_for_timeout(250)
    ck('7 medida mudada depois: a calculadora volta a calcular', L(pg, '• Peso fetal') != '    • Peso fetal estimado em: 2900 gramas (+- 15%).' and 'semanas' in L(pg, 'Biometria Fetal Composta'), (L(pg, '• Peso fetal'), L(pg, 'Biometria Fetal Composta')))
    pg.close()
    pg = fresh(b, 1, 0); select_all(pg); paste(pg, OBST)
    ck('7 colado sobre o modelo (Ctrl+A): idêntico, sem linha em branco no início', raw(pg) == OBST, repr(raw(pg)[:80]))
    pg.close()
    pg = fresh(b, 1); caret_empty(pg); paste(pg, OBST.replace(' ', '\u00a0').replace('\n', '\r\n'))
    ck('7 NBSP e CRLF: mesmo texto', raw(pg).replace('\u00a0', ' ') == OBST, repr(raw(pg)[:80]))
    pg.close()
    pg = fresh(b, 1); caret_empty(pg); paste(pg, 'Texto livre\n\n    • item com recuo\n37 semanas')
    ck('7 texto fora do banco: preservado', raw(pg) == 'Texto livre\n\n    • item com recuo\n37 semanas', repr(raw(pg)))
    pg.close()

    # ---------- item 8: Doppler montado no app ----------
    pg = fresh(b, 0, 0)
    ua = phid(pg, 'ARTÉRIA UMBILICAL', 'Umbilical alta'); pg.evaluate('(k)=>UFTest.insertCard(k)', ua); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
    ck('8 frase com @@SUBSTITUI antes dos valores: troca só a linha, IP/IR ficam', raw(pg).count(IP) == 2 and L(pg, 'Artéria umbilical:') == 'Artéria umbilical: padrão espectral de teste alterado.' and L(pg, 'Artéria Umbilical:') == '', raw(pg))
    for n, v in [(0, '0,96'), (1, '0,92')]: typ(pg, ix(pg, IP, n), v)
    typ(pg, ix(pg, IR, 0), '0,6'); typ(pg, ix(pg, IR, 1), '0,57')
    ck('8 relação 0,96/0,92 = 1,04', L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = 1,04 (V.R.: < 1).', L(pg, REL))
    pg.close()
    pg = fresh(b, 0, 0)
    for n, v in [(0, '0,96'), (1, '0,92')]: typ(pg, ix(pg, IP, n), v)
    pg.evaluate('(k)=>UFTest.insertCard(k)', phid(pg, 'ARTÉRIA UMBILICAL', 'Umbilical alta')); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
    t = raw(pg).splitlines()
    ck('8 frase com @@SUBSTITUI depois dos valores: substitui a linha (não entra abaixo do IR)', L(pg, 'Artéria Umbilical:') == '' and t.index('Artéria umbilical: padrão espectral de teste alterado.') + 1 == t.index('- Índice de pulsatilidade (IP): 0,96'), t[3:9])
    pg.evaluate('(k)=>UFTest.insertCard(k)', phid(pg, 'ARTÉRIA UMBILICAL', 'Hipótese Umbilical alta')); pg.wait_for_timeout(300)
    t = raw(pg).splitlines()
    ck('8 frase "Hipótese ..." entra no bloco Hipótese, não sobre o achado', 'Artéria umbilical: padrão espectral de teste alterado.' in t and t.index('- Artéria umbilical com teste alterado.') == t.index('- Conclusão de teste habitual.') + 1, t)
    ck('8 relação continua 1,04', L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = 1,04 (V.R.: < 1).', L(pg, REL))
    pg.close()
    pg = fresh(b, 0, 0); select_all(pg); paste(pg, DOP)
    ck('8 laudo colado inteiro: idêntico (traços e valores)', raw(pg) == DOP, '\n'.join(__import__('difflib').unified_diff(DOP.splitlines(), raw(pg).splitlines(), lineterm='', n=0)))
    ck('8 só a linha crítica do banco fica marcada', crits(pg) == ['- Ducto venoso com onda A positiva.'], crits(pg))
    ck('8 relação colada coerente com os IP (1,04)', L(pg, REL).endswith('= 1,04 (V.R.: < 1).'), L(pg, REL))
    typ(pg, ix(pg, IP, 1), '0,8'); pg.wait_for_timeout(200)
    ck('8 IP mudado depois de colar: relação recalculada', L(pg, REL) == '- Relação: IP umbilical / IP cerebral média = %s (V.R.: < 1).' % f2(0.96 / 0.8), L(pg, REL))
    pg.close()
    pg = fresh(b, 0, 0)
    sel_lines(pg, '- Artéria Umbilical com', '- Conclusão de teste'); pg.keyboard.type('- Conclusão de teste com centralização.'); pg.keyboard.press('Enter'); pg.keyboard.type('- Outra linha.'); pg.wait_for_timeout(200)
    t = raw(pg).splitlines()
    ck('8 linhas digitadas: traços mantidos, sem duplicar', t.count('- Conclusão de teste com centralização.') == 1 and '- Outra linha.' in t and crits(pg) == [], (t, crits(pg)))
    ck('sem erros no console', not ERR, ERR)
    b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
