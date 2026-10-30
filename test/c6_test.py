"""C6: ACR TI-RADS (Tessler et al., JACR 2017;14:587-595). Pontuação de referência calculada aqui em Python,
independente do JS, para TODAS as combinações; texto de saída do protótipo. Banco genérico embutido (nenhum texto real).
Uso: python test/c6_test.py   (precisa playwright + chromium)"""
import os, sys, tempfile, itertools
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Tireoide Teste
@@EXAME_FULL TIREOIDE TESTE
@@TEMPLATE Padrao
TIREOIDE TESTE
Linha um do laudo.
Linha dois do laudo.
Linha tres do laudo.
'''
COMP = {'cist': 0, 'esp': 0, 'mist': 1, 'sol': 2, 'ind': 2}
ECO = {'anec': 0, 'hiper': 1, 'hipo': 2, 'muito': 3, 'ind': 1}
FORMA = {'larg': 0, 'alto': 3}
MARG = {'lisa': 0, 'mal': 0, 'lob': 2, 'ete': 3, 'ind': 0}
FOC = {'nenhum': 0, 'macro': 1, 'perif': 2, 'punct': 3}
def ref_total(c, e, s, m, fo):
    if c == 'esp': return 0
    return COMP[c] + (1 if c == 'ind' else ECO[e]) + FORMA[s] + MARG[m] + sum(FOC[x] for x in fo)
def ref_level(t):
    if t <= 1: return 'TR1'
    if t == 2: return 'TR2'
    if t == 3: return 'TR3'
    if t <= 6: return 'TR4'
    return 'TR5'
TXT = {'TR1': ('Benigno', '≤2%', 'Nenhuma', 'Nenhuma'), 'TR2': ('Não suspeito', '≤2%', 'Nenhuma', 'Nenhuma'),
       'TR3': ('Levemente suspeito', '~5%', 'se ≥2,5 cm', 'se ≥1,5 cm, US após 1, 3 e 5 anos.'),
       'TR4': ('Moderadamente suspeito', '5-20%', 'se ≥1,5 cm', 'se ≥1,0 cm, US após 1, 2, 3 e 5 anos.'),
       'TR5': ('Altamente suspeito', '≥20%', 'se ≥1,0 cm', 'se ≥0,5 cm, US anual por até 5 anos.')}
def ref_lines(t):
    L = ref_level(t); v = TXT[L]
    return ['Pontuação: %d' % t, 'Categoria TIRADS: ' + L, 'Nível de Risco: ' + v[0], 'Risco de Malignidade: ' + v[1], 'Recomendação de PAAF: ' + v[2], 'Sugestão de Acompanhamento: ' + v[3]]
FOCSETS = [['nenhum']] + [list(x) for r in (1, 2, 3) for x in itertools.combinations(['macro', 'perif', 'punct'], r)]
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:400])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
ERR = []
def fresh(b):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text)); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.locator('[data-model]').nth(0).dblclick(); pg.wait_for_timeout(400)
    if not pg.evaluate('UFCalc.isOpen()'): pg.evaluate('UFCalc.open()'); pg.wait_for_timeout(150)
    return pg
def rep(pg): return [l for l in pg.evaluate('UFTest.reportText()').splitlines()]
def nod(pg, k): return pg.locator('.tr-nod').nth(k)
def pick(pg, k, cat, val): nod(pg, k).locator('input[data-cat="%s"][value="%s"]' % (cat, val)).click()
def fill(pg, k, c, e, s, m, fo, lado='', terco='', mm=''):
    pick(pg, k, 'comp', c)
    if c not in ('esp', 'ind'): pick(pg, k, 'eco', e)
    if c != 'esp':
        pick(pg, k, 'forma', s); pick(pg, k, 'marg', m)
        for x in fo: pick(pg, k, 'focos', x)
    if lado: nod(pg, k).locator('select[data-k="lado"]').select_option(lado)
    if terco: nod(pg, k).locator('select[data-k="terco"]').select_option(terco)
    if mm: nod(pg, k).locator('input[data-k="mm"]').fill(mm)
def caret(pg, line_text, off):
    pg.evaluate('''(a) => { var ls = [].slice.call(document.querySelectorAll('#editor div')).filter(function (d) { return d.textContent === a[0]; });
      var d = ls[ls.length - 1], t = d.firstChild; while (t && t.nodeType !== 3) { t = t.firstChild; }
      var r = document.createRange(); r.setStart(t, a[1]); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      document.getElementById('editor').focus(); document.dispatchEvent(new Event('selectionchange')); }''', [line_text, off])
    pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(80)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b)
    ck('módulo UFTirads e seção no painel', pg.evaluate('!!window.UFTirads') and pg.locator('#trIns').count() == 1)
    # 1) exaustivo: JS puro x Python
    combos = [[c, e, s, m, fo] for c in COMP for e in ECO for s in FORMA for m in MARG for fo in FOCSETS]
    js = pg.evaluate('''(cs) => cs.map(function (a) { var r = UFTirads.score({comp: a[0], eco: a[1], forma: a[2], marg: a[3], focos: a[4]});
        return [r.total, r.complete, UFTirads.level(r.total), UFTirads.lines(r.total)]; })''', combos)
    bad = [(combos[i], js[i]) for i in range(len(combos)) if js[i][0] != ref_total(*combos[i]) or not js[i][1] or js[i][2] != ref_level(js[i][0]) or js[i][3] != ref_lines(js[i][0])]
    ck('exaustivo %d combinações (composição x ecogenicidade x forma x margem x subconjuntos de focos): total, nível e 6 linhas' % len(combos), not bad, bad[:3])
    ck('cobre todos os níveis TR1..TR5', set(x[2] for x in js) == {'TR1', 'TR2', 'TR3', 'TR4', 'TR5'})
    ck('limites 0,1,2,3,4,6,7,15', [pg.evaluate('UFTirads.level(%d)' % t) for t in (0, 1, 2, 3, 4, 6, 7, 15)] == ['TR1', 'TR1', 'TR2', 'TR3', 'TR4', 'TR4', 'TR5', 'TR5'])
    ck('incompleto não é completo', not pg.evaluate("UFTirads.score({comp:'sol',eco:'hipo',forma:'larg',marg:null,focos:[]}).complete"))
    ck('sem focos marcados = incompleto', not pg.evaluate("UFTirads.score({comp:'sol',eco:'hipo',forma:'larg',marg:'lisa',focos:[]}).complete"))
    ck('espongiforme ignora o resto (=0, TR1)', pg.evaluate("UFTirads.score({comp:'esp',eco:'muito',forma:'alto',marg:'ete',focos:['punct']}).total") == 0)
    ck('indeterminável: eco forçada em 1', pg.evaluate("UFTirads.score({comp:'ind',eco:'muito',forma:'larg',marg:'lisa',focos:['nenhum']}).total") == 3)
    ck('cabeçalho completo', pg.evaluate("UFTirads.header({lado:'direito',terco:'médio',mm:'12'})") == 'Nódulo do lobo direito, terço médio, medindo 12 mm (ACR TI-RADS):')
    ck('cabeçalho istmo/decimal', pg.evaluate("UFTirads.header({lado:'istmo',terco:'',mm:'8.5'})") == 'Nódulo do istmo, medindo 8,5 mm (ACR TI-RADS):')
    ck('cabeçalho vazio', pg.evaluate("UFTirads.header({lado:'',terco:'',mm:''})") == 'Nódulo (ACR TI-RADS):')
    ck('cabeçalho mm inválido omitido', pg.evaluate("UFTirads.header({lado:'esquerdo',terco:'inferior',mm:'abc'})") == 'Nódulo do lobo esquerdo, terço inferior (ACR TI-RADS):')
    # cortes de tamanho (painel)
    cuts = [(3, '25', 'PAAF'), (3, '24.9', 'seguimento'), (3, '15', 'seguimento'), (3, '14', 'abaixo'), (5, '15', 'PAAF'), (5, '10', 'seguimento'), (5, '9', 'abaixo'),
            (7, '10', 'PAAF'), (7, '5', 'seguimento'), (7, '4', 'abaixo'), (2, '40', 'sem PAAF')]
    sb = [(t, mm, w, pg.evaluate('UFTirads.sizeNote(%d,"%s")' % (t, mm))) for t, mm, w in cuts]
    sb = [x for x in sb if (x[2] == 'PAAF' and 'corte de PAAF' not in x[3]) or (x[2] == 'seguimento' and 'corte de seguimento' not in x[3]) or (x[2] not in ('PAAF', 'seguimento') and x[2] not in x[3])]
    ck('cortes de tamanho TR3 25/15, TR4 15/10, TR5 10/5 mm', not sb, sb)
    # 2) UI  (C6e: um formulário único no cartão TI-RADS; banco sem a frase do nódulo -> bloco da C6)
    base = rep(pg)
    pg.evaluate("UFCalc.setOpen('tirads', true)")
    def form(c, e, s, m, fo, lado='', terco='', mm=''):
        for k, v in (('comp', c), ('eco', e), ('forma', s), ('marg', m)):
            if v and pg.locator('.tr-sel[data-cat=%s]' % k).is_enabled(): pg.select_option('.tr-sel[data-cat=%s]' % k, v)
        for x in fo:
            if not pg.locator('input[data-cat=focos][value=%s]' % x).is_checked(): pg.click('input[data-cat=focos][value=%s]' % x)
        if terco: pg.locator('.tr-loc select').nth(0).select_option(terco)
        if lado: pg.locator('.tr-loc select').nth(1).select_option(lado)
        if mm: pg.locator('.tr-mm').nth(0).fill(mm)
    ck('botão inserir desativado com formulário vazio', pg.locator('#trIns').is_disabled())
    form('sol', 'hipo', 'alto', 'lob', ['punct'], 'direito', 'médio', '12')
    ck('total ao vivo no painel', pg.inner_text('.tr-res').strip() == 'TR5 · 12 pts', pg.inner_text('.tr-res'))
    ck('pontos de cada opção visíveis', '· 3' in pg.inner_text('.tr-foc'))
    ck('nada no laudo antes de inserir', rep(pg) == base)
    caret(pg, 'Linha dois do laudo.', 5)
    pg.click('#trIns'); pg.wait_for_timeout(150)
    exp = ['Nódulo do lobo direito, terço médio, medindo 12 mm (ACR TI-RADS):'] + ref_lines(12)
    r = rep(pg); i2 = r.index('Linha dois do laudo.')
    ck('meio do texto: bloco exato logo abaixo da linha do cursor', r[i2 + 1:i2 + 8] == exp and r[i2 + 8] == 'Linha tres do laudo.', r)
    pg = fresh(b); base = rep(pg); pg.evaluate("UFCalc.setOpen('tirads', true)")
    form('mist', 'hiper', 'larg', 'lisa', ['nenhum'])
    caret(pg, 'Linha dois do laudo.', 5); pg.click('#trIns'); pg.wait_for_timeout(150)
    ck('inserido (TR2)', rep(pg) != base and 'Categoria TIRADS: TR2' in rep(pg))
    pg.click('#editor'); pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    ck('Ctrl+Z remove o bloco inteiro de uma vez', rep(pg) == base, rep(pg))
    pg = fresh(b); pg.evaluate("UFCalc.setOpen('tirads', true)")
    pg.select_option('.tr-sel[data-cat=comp]', 'esp')
    ck('espongiforme: demais categorias desativadas', pg.locator('.tr-sel[data-cat=eco]').is_disabled() and pg.locator('input[data-cat=focos]').first.is_disabled())
    ck('espongiforme = TR1 0 pts', pg.inner_text('.tr-res').strip() == 'TR1 · 0 pts', pg.inner_text('.tr-res'))
    pg.select_option('.tr-sel[data-cat=comp]', 'sol')
    pg.click('input[data-cat=focos][value=macro]'); pg.click('input[data-cat=focos][value=punct]')
    ck('outro foco desmarca "sem focos"', [pg.locator('input[data-cat=focos]').nth(k).is_checked() for k in range(4)] == [False, True, False, True])
    pg.click('input[data-cat=focos][value=nenhum]')
    ck('"sem focos" desmarca os outros', [pg.locator('input[data-cat=focos]').nth(k).is_checked() for k in range(4)] == [True, False, False, False])
    ck('sem erros de console', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
