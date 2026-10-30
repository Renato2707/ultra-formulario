"""C6c: rodada de ajustes (painel em cartões, avisos 'sem linha', Doppler, opção dentro de opção, dropdown, TI-RADS pelo texto).
Banco genérico embutido (frases equivalentes, nenhum texto real). Uso: python test/c6c_test.py (playwright + chromium)"""
import os, sys, tempfile, json
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
NOD = ('?[Sem nódulos.|Observa-se nódulo ?[cístico|espongiforme|misto|sólido|indeterminado], ?[anecoico|hiperecogênico|isoecogênico|hipoecogênico|muito hipoecogênico|indeterminado], '
       '?[mais largo que alto|mais alto que largo], margens ?[lisas|mal definidas|lobuladas|irregulares|com extensão extratireoidiana], ?[sem focos hiperecogênicos|com focos hiperecogênicos tipo cauda de cometa|'
       'com focos hiperecogênicos tipo macrocalcificações|com focos hiperecogênicos tipo calcificações periféricas|com focos hiperecogênicos puntiformes]. Localizado em terço ?[superior|médio|inferior] de lobo ?[direito|esquerdo], medindo cerca de * x * x * mm (LxAPxT). TI-RADS *.]')
BANK = '''@@EXAME Teste Um
@@EXAME_FULL TESTE UM
@@TEMPLATE Tireoide
TIREOIDE TESTE
Glandula de volume ?[normal|aumentado].

''' + NOD + '''

Lista:
- nódulo em terço ?[superior|médio|inferior] de lobo ?[direito|esquerdo], medindo cerca de * x * x * mm (LxAPxT). TI-RADS *.

O lobo direito mede cerca de * x * x * mm (LxAPxT).
O lobo esquerdo mede cerca de * x * x * mm (LxAPxT).
Istmo mede cerca de * mm (AP).
Volume glandular estimado em * cm³.

@@TEMPLATE Pelve
PELVE TESTE
Orgao central.
Dimensões medindo cerca de * x * x * mm (LxAPxT).
Volume estimado em cerca de * cm³.

@@TEMPLATE Doppler
DOPPLER TESTE
Artéria Umbilical: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
Artéria Cerebral Média: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).

@@TEMPLATE Simples
SIMPLES TESTE
Texto sem medidas.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
tf = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); tf.write(BANK.replace('\n', '\r\n').encode('utf-8')); tf.close()
ERR = []
def fresh(b, model=0, clear=True):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(5000)
    pg.on('pageerror', lambda e: ERR.append(str(e))); pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', tf.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(600); pg.locator('[data-model]').nth(model).dblclick(); pg.wait_for_timeout(400)
    if not pg.evaluate('UFCalc.isOpen()'): pg.click('#btnCalc'); pg.wait_for_timeout(150)
    return pg
def rep(pg): return pg.evaluate('UFTest.reportText()').splitlines()
def L(pg, s): return ([l for l in rep(pg) if s in l] + [''])[0]
def ix(pg, start, nth=0):
    return pg.evaluate('''(a) => { var all = [].slice.call(document.querySelectorAll('#editor .fld')), out = [];
      all.forEach(function (f, i) { var n = f; while (n && n.nodeName !== 'DIV') { n = n.parentNode; }
        if ((n.textContent || '').replace(/^[\\s\\u2022\\u00a0-]+/, '').indexOf(a[0]) === 0) { out.push(i); } }); return out[a[1]]; }''', [start, nth])
def typ(pg, i, txt):
    x = pg.locator('#editor .fld').nth(i).bounding_box(); pg.mouse.click(x['x'] + x['width'] / 2, x['y'] + x['height'] / 2); pg.wait_for_timeout(60); pg.keyboard.type(txt); pg.wait_for_timeout(100)
def st(pg, id): return pg.evaluate("(function(){var e=document.getElementById('%sSt');return e?e.textContent:null})()" % id)
def popup(pg): return pg.evaluate("!document.getElementById('popup').hidden")
def cur(pg): return pg.evaluate("(function(){var c=document.querySelector('#editor .f-cur');return c?c.getAttribute('data-o'):null})()")
def optclick(pg, txt): T(lambda: pg.locator('#popup .opt', has_text=txt).first.click(timeout=800)); pg.wait_for_timeout(200)
def T(f, d=None):   # tolerante: na versão antiga alguns elementos não existem (o teste deve FALHAR, não travar)
    try: return f()
    except Exception: return d
def lum(h):
    h = h.strip()
    import re
    m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', h); v = [int(m.group(k)) / 255.0 for k in (1, 2, 3)]
    v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]; return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
def contrast(a, b): la, lb = lum(a), lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- 5/4: cartões e texto de fontes ----------
    pg = fresh(b, 3)
    ck('painel em cartões com cabeçalho-botão', pg.locator('#right .uc-card > button.uc-h').count() >= 4)
    ck('texto longo de fórmulas não aparece no painel', 'Hadlock 1985 (4 parâmetros). IG composta' not in pg.inner_text('#right'))
    ck('fórmula/fonte disponível no ⓘ (tooltip)', 'L × AP × T × 0,523' in (T(lambda: pg.get_attribute('#right .uc-i', 'title', timeout=500)) or ''))
    T(lambda: pg.click('[data-calc="livre"] > .uc-h', timeout=500)); pg.wait_for_timeout(100)
    ck('cartão recolhe', not pg.locator('[data-calc="livre"] .uc-b').is_visible())
    pg.reload(); pg.wait_for_timeout(400)
    if not pg.evaluate('UFCalc.isOpen()'): pg.click('#btnCalc'); pg.wait_for_timeout(150)
    ck('estado recolhido lembrado', not pg.locator('[data-calc="livre"] .uc-b').is_visible() and pg.locator('[data-calc="ig"] .uc-b').is_visible())
    # ---------- 1/2: avisos sem linha ----------
    pg = fresh(b, 3)
    ck('volume: aviso "sem linha correspondente"', 'sem linha correspondente' in (st(pg, 'ucAuto') or ''), st(pg, 'ucAuto'))
    ck('PFE: aviso "sem linha correspondente"', 'sem linha correspondente' in (st(pg, 'ucPfe') or ''), st(pg, 'ucPfe'))
    ck('IG pelo PFE: "desligado" (padrão)', st(pg, 'ucIgp') == 'desligado', st(pg, 'ucIgp'))
    T(lambda: pg.click('#ucIgp', timeout=500)); pg.wait_for_timeout(100)
    ck('IG pelo PFE ligado: aviso "sem linha correspondente"', 'sem linha correspondente' in (st(pg, 'ucIgp') or ''), st(pg, 'ucIgp'))
    pg = fresh(b, 1)
    for k, v in enumerate(['80', '40', '50']): typ(pg, ix(pg, 'Dimensões') + k, v)
    ck('volume funciona (uma linha de medidas + linha de volume)', 'Volume estimado em cerca de 84 cm³.' in L(pg, 'Volume estimado'), L(pg, 'Volume estimado'))
    ck('volume: estado "no laudo"', 'no laudo' in (st(pg, 'ucAuto') or '') and 'sem linha' not in st(pg, 'ucAuto'), st(pg, 'ucAuto'))
    ck('badge do cartão mostra ativo', 'ativo' in (T(lambda: pg.inner_text('[data-calc="auto"] .uc-badge', timeout=500)) or ''))
    pg = fresh(b, 0)
    ck('tireoide 2 lobos: soma dos lobos (C6d)', 'soma de 2 lobos' in (st(pg, 'ucAuto') or ''), st(pg, 'ucAuto'))
    # ---------- 3: Doppler ----------
    pg = fresh(b, 2)
    lab = pg.inner_text('[data-calc="auto"]')
    ck('rótulo Doppler limpo', 'Doppler: relação umbilical/cerebral média e RCP' in lab and 'IP umbilical/cerebral média e RCP' not in lab)
    typ(pg, ix(pg, 'Índice de pulsatilidade', 0), '1'); typ(pg, ix(pg, 'Índice de pulsatilidade', 1), '2')
    ck('relação sem zero inútil (0,5)', '= 0,5 (V.R.: < 1)' in L(pg, 'Relação'), L(pg, 'Relação'))
    ck('painel mostra as duas relações', 'AU/ACM = 0,5' in (st(pg, 'ucDop') or '') and 'ACM/AU (RCP) = 2' in (st(pg, 'ucDop') or ''), (st(pg, 'ucDop') or ''))
    T(lambda: pg.select_option('#ucDopOrd', 'inv', timeout=500)); pg.wait_for_timeout(150)
    ck('inverso: linha vira ACM/AU com valor e V.R. invertidos', L(pg, 'Relação').strip() == '- Relação: IP cerebral média / IP umbilical = 2 (V.R.: > 1).', L(pg, 'Relação'))
    T(lambda: pg.select_option('#ucDopOrd', 'rel', timeout=500)); pg.wait_for_timeout(150)
    ck('volta para AU/ACM', L(pg, 'Relação').strip() == '- Relação: IP umbilical / IP cerebral média = 0,5 (V.R.: < 1).', L(pg, 'Relação'))
    typ(pg, ix(pg, 'Índice de pulsatilidade', 0), '')
    pg.evaluate("UFCalcDop.run()")
    ck('formato: 1,05 e 1 (sem ",00")', pg.evaluate("[UFCalcDop.f2(1.05), UFCalcDop.f2(1), UFCalcDop.f2(0.333), UFCalcDop.f2(1.6)]") == ['1,05', '1', '0,33', '1,6'])
    # ---------- 6/7/8: opção dentro de opção e dropdown ----------
    pg = fresh(b, 0)
    chips = pg.locator('#editor .fld[data-t="s"]')
    k = [i for i in range(chips.count()) if 'Observa-se' in (chips.nth(i).get_attribute('data-o') or '')][0]
    chips.nth(k).click(); pg.wait_for_timeout(150); optclick(pg, 'Observa-se nódulo')
    ck('opção com campos dentro: abre o 1º campo interno', popup(pg) and (cur(pg) or '').startswith('["cístico"'), cur(pg))
    seq = []
    for want in ['sólido', 'hipoecogênico', 'mais alto que largo', 'irregulares', 'puntiformes']:
        seq.append((cur(pg) or '')[:14]); pg.keyboard.press('Enter') if False else None
        opts = pg.evaluate("[].map.call(document.querySelectorAll('#popup .opt'), function(o){return o.textContent})")
        idx = ([i for i, o in enumerate(opts) if want in o] + [0])[0]
        for _ in range(idx): pg.keyboard.press('ArrowDown')
        pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    ck('Enter percorre os campos internos em ordem', [s[:6] for s in seq] == ['["císt', '["anec', '["mais', '["lisa', '["sem '], seq)
    ck('depois das 5 opções vai para "terço" (ainda dentro da frase)', (cur(pg) or '').startswith('["superior"'), cur(pg))
    # 9: TI-RADS pelo texto: sólido 2 + hipo 2 + alto 3 + irregular 2 + puntiforme 3 = 12 -> TR5
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ck('TI-RADS calculado pelas opções do texto (12 pts -> 5)', 'TI-RADS 5.' in L(pg, 'Observa-se nódulo'), L(pg, 'Observa-se nódulo'))
    ck('estado no painel mostra TR5 (12 pts)', 'TR5 (12 pts)' in (st(pg, 'ucTrTxt') or ''), st(pg, 'ucTrTxt'))
    ck('linha da lista (sem as 5 opções) não é tocada', 'TI-RADS ___.' in L(pg, '- nódulo em terço'), L(pg, '- nódulo em terço'))
    # trocar a composição para espongiforme -> 0 -> TR1
    sp = pg.locator('#editor .fld[data-t="s"]', has_text='sólido').first; T(lambda: sp.click(timeout=800)); pg.wait_for_timeout(150); optclick(pg, 'espongiforme'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ck('trocar opção recalcula (espongiforme -> 1)', 'TI-RADS 1.' in L(pg, 'Observa-se nódulo'), L(pg, 'Observa-se nódulo'))
    sp = pg.locator('#editor .fld[data-t="s"]', has_text='espongiforme').first; T(lambda: sp.click(timeout=800)); pg.wait_for_timeout(150); optclick(pg, 'misto'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # misto 1 + hipo 2 + alto 3 + irreg 2 + punct 3 = 11 -> 5 ; mudar forma p/ largo: 8 -> 5; usar hiperecog: 1+1+0+2+3=7 ->5... testar 4:
    for old, new in (('mais alto que largo', 'mais largo que alto'), ('puntiformes', 'sem focos')):
        sp = pg.locator('#editor .fld[data-t="s"]', has_text=old).first; T(lambda: sp.click(timeout=800)); pg.wait_for_timeout(150); optclick(pg, new); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ck('misto+hipo+largo+irregular+sem focos = 5 pts -> TI-RADS 4', 'TI-RADS 4.' in L(pg, 'Observa-se nódulo'), L(pg, 'Observa-se nódulo'))
    ti = ([i for i in range(pg.locator('#editor .fld').count()) if pg.locator('#editor .fld').nth(i).text_content() == '4'] + [0])[0]
    pg.evaluate('''(i) => { var f = document.querySelectorAll('#editor .fld')[i], r = document.createRange(); r.selectNodeContents(f); var s = getSelection(); s.removeAllRanges(); s.addRange(r); document.getElementById('editor').focus(); }''', ti)
    pg.keyboard.type('3'); pg.wait_for_timeout(300)
    ck('valor digitado à mão no TI-RADS é respeitado', 'TI-RADS 3.' in L(pg, 'Observa-se nódulo'), L(pg, 'Observa-se nódulo'))
    # dropdown: escolha com mouse abre o próximo; Esc; seta para baixo e Enter reabrem
    pg = fresh(b, 0)
    pg.locator('#editor .fld[data-t="s"]').nth(0).click(); pg.wait_for_timeout(150); optclick(pg, 'normal')
    ck('escolha com o mouse: lista do próximo campo fica aberta', popup(pg) and (cur(pg) or '').startswith('["Sem nódulos.'), [popup(pg), cur(pg)])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(150)
    ck('seta para baixo no campo destacado abre a lista', popup(pg))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); n0 = len(rep(pg)); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    ck('Enter no campo destacado abre a lista', popup(pg))
    ck('Enter não criou linha nova', len(rep(pg)) == n0, [n0, len(rep(pg))])
    T(lambda: pg.locator('#popup .opt').nth(1).hover(timeout=800)); pg.wait_for_timeout(100)
    if not popup(pg): T(lambda: pg.locator('#editor .fld[data-t="s"]').nth(1).click()); pg.wait_for_timeout(150); T(lambda: pg.locator('#popup .opt').nth(1).hover(timeout=800)); pg.wait_for_timeout(100)
    bg = pg.evaluate("getComputedStyle(document.querySelectorAll('#popup .opt')[1]).backgroundColor"); fg = pg.evaluate("getComputedStyle(document.querySelectorAll('#popup .opt')[1]).color")
    bgn = pg.evaluate("getComputedStyle(document.getElementById('popup')).backgroundColor")
    ck('opção sob o mouse com contraste forte (texto ≥ 4,5:1 e fundo bem diferente do normal)', contrast(bg, fg) >= 4.5 and contrast(bg, bgn if 'rgba(0, 0, 0, 0)' not in bgn else 'rgb(255,255,255)') >= 3, [bg, fg, bgn])
    ck('sem erros de console', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
