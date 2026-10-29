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
    if not pg.evaluate('UFCalc.isOpen()'): pg.click('#btnCalc'); pg.wait_for_timeout(150)
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
    ck('módulo UFTirads e seção no painel', pg.evaluate('!!window.UFTirads') and pg.locator('#trAdd').count() == 1)
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
    # 2) UI
    base = rep(pg)
    pg.click('#trAdd'); fill(pg, 0, 'sol', 'hipo', 'alto', 'lob', ['punct'], 'direito', 'médio', '12')
    ck('total ao vivo no painel', 'Total: 12 pontos — TR5' in nod(pg, 0).locator('.tr-res').inner_text(), nod(pg, 0).locator('.tr-res').inner_text())
    ck('pontos por categoria visíveis', nod(pg, 0).locator('fieldset[data-cat="focos"] .tr-pts').inner_text().strip() == '— 3 pts')
    ck('destaque de tamanho no painel', 'corte de PAAF' in nod(pg, 0).locator('.tr-size').inner_text())
    ck('nada no laudo antes de inserir', rep(pg) == base)
    caret(pg, 'Linha dois do laudo.', 5)
    nod(pg, 0).locator('.tr-ins').click(); pg.wait_for_timeout(150)
    exp = ['Nódulo do lobo direito, terço médio, medindo 12 mm (ACR TI-RADS):'] + ref_lines(12)
    r = rep(pg); i2 = r.index('Linha dois do laudo.')
    ck('meio do texto: bloco exato logo abaixo da linha do cursor', r[i2 + 1:i2 + 8] == exp and r[i2 + 8] == 'Linha tres do laudo.', r)
    ck('mensagem de inserção no cursor', 'cursor' in nod(pg, 0).locator('.tr-msg').inner_text())
    ck('linha de tamanho NÃO vai ao laudo', not any('Pelo tamanho' in x for x in r))
    pg.keyboard.type('X'); pg.wait_for_timeout(80)
    r = rep(pg); ck('cursor termina após o bloco', r[i2 + 7].endswith('X') and r[i2 + 7].startswith('Sugestão'), r[i2 + 7])
    pg.keyboard.press('Backspace'); pg.wait_for_timeout(80)
    pg = fresh(b); base = rep(pg)
    pg.click('#trAdd'); fill(pg, 0, 'mist', 'hiper', 'larg', 'lisa', ['nenhum'])
    caret(pg, 'Linha dois do laudo.', 5); nod(pg, 0).locator('.tr-ins').click(); pg.wait_for_timeout(150)
    ck('inserido (TR2)', rep(pg) != base and 'Categoria TIRADS: TR2' in rep(pg))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    ck('Ctrl+Z remove o bloco inteiro de uma vez', rep(pg) == base, rep(pg))
    # início
    pg = fresh(b); caret(pg, 'TIREOIDE TESTE', 0)
    pg.click('#trAdd'); fill(pg, 0, 'cist', 'anec', 'larg', 'lisa', ['nenhum'])
    nod(pg, 0).locator('.tr-ins').click(); pg.wait_for_timeout(150); r = rep(pg)
    ck('início: bloco após a 1ª linha, cabeçalho sem partes', r[1:8] == ['Nódulo (ACR TI-RADS):'] + ref_lines(0), r)
    # fim
    pg = fresh(b); caret(pg, 'Linha tres do laudo.', len('Linha tres do laudo.'))
    pg.click('#trAdd'); fill(pg, 0, 'esp', '', '', '', [], 'esquerdo', 'inferior', '30')
    ck('espongiforme: demais categorias desativadas', nod(pg, 0).locator('input[data-cat="eco"]').first.is_disabled() and nod(pg, 0).locator('input[data-cat="focos"]').first.is_disabled())
    ck('espongiforme: aviso na tela', 'Espongiforme' in nod(pg, 0).locator('.tr-note').inner_text())
    nod(pg, 0).locator('.tr-ins').click(); pg.wait_for_timeout(150); r = [x for x in rep(pg) if x.strip()]
    ck('fim: bloco após a última linha (espongiforme TR1)', r[-7:] == ['Nódulo do lobo esquerdo, terço inferior, medindo 30 mm (ACR TI-RADS):'] + ref_lines(0), r)
    # sem cursor
    pg = fresh(b); pg.evaluate('UFTest.S.savedRange = null; getSelection().removeAllRanges(); document.activeElement && document.activeElement.blur()')
    pg.click('#trAdd'); fill(pg, 0, 'ind', '', 'larg', 'ind', ['macro', 'perif'], 'istmo', '', '7')
    ck('indeterminável: ecogenicidade desativada e 1 pt', nod(pg, 0).locator('input[data-cat="eco"]').first.is_disabled() and '— 1 pt' in nod(pg, 0).locator('fieldset[data-cat="eco"] .tr-pts').inner_text())
    pg.evaluate('UFTest.S.savedRange = null')
    nod(pg, 0).locator('.tr-ins').click(); pg.wait_for_timeout(150); r = [x for x in rep(pg) if x.strip()]
    ck('sem cursor: no fim do laudo, com mensagem', r[-7:] == ['Nódulo do istmo, medindo 7 mm (ACR TI-RADS):'] + ref_lines(6) and 'fim do laudo' in nod(pg, 0).locator('.tr-msg').inner_text(), r)
    # focos: nenhum exclui os demais
    pg.click('#trAdd'); pick(pg, 1, 'focos', 'macro'); pick(pg, 1, 'focos', 'punct'); pick(pg, 1, 'focos', 'nenhum')
    ck('"nenhum" desmarca os outros', [nod(pg, 1).locator('input[data-cat="focos"]').nth(k).is_checked() for k in range(4)] == [True, False, False, False])
    pick(pg, 1, 'focos', 'perif')
    ck('outro foco desmarca "nenhum"', [nod(pg, 1).locator('input[data-cat="focos"]').nth(k).is_checked() for k in range(4)] == [False, False, True, False])
    # múltiplos nódulos independentes, recolher, remover
    fill(pg, 1, 'sol', 'muito', 'larg', 'lisa', [])
    ck('nódulos independentes', 'TR4' in nod(pg, 0).locator('.tr-res').inner_text() and 'Total: 7 pontos — TR5' in nod(pg, 1).locator('.tr-res').inner_text(), [nod(pg, 0).locator('.tr-res').inner_text(), nod(pg, 1).locator('.tr-res').inner_text()])
    nod(pg, 1).locator('.tr-tg').click(); ck('recolher', not nod(pg, 1).locator('.tr-body').is_visible() and nod(pg, 0).locator('.tr-body').is_visible())
    ck('título recolhido mostra categoria', 'TR5' in nod(pg, 1).locator('.tr-tg').inner_text())
    nod(pg, 1).locator('.tr-tg').click(); ck('expandir', nod(pg, 1).locator('.tr-body').is_visible())
    nod(pg, 0).locator('.tr-rm').click()
    ck('remover só o nódulo 1', pg.locator('.tr-nod').count() == 1 and pg.evaluate('UFTirads.count()') == 1 and 'TR5' in nod(pg, 0).locator('.tr-res').inner_text())
    pg.click('#trAdd'); ck('botão inserir desativado em nódulo vazio', nod(pg, 1).locator('.tr-ins').is_disabled())
    # Tab alcança os controles
    pg.focus('#trAdd'); seen = []
    for k in range(12): pg.keyboard.press('Tab'); seen.append(pg.evaluate("document.activeElement.className + '|' + (document.activeElement.type||'')"))
    ck('Tab percorre os controles do painel', any('tr-tg' in x for x in seen) and any('tr-sel' in x for x in seen), seen)
    # estado só na sessão
    pg.reload(); pg.wait_for_timeout(300)
    if not pg.evaluate('UFCalc.isOpen()'): pg.click('#btnCalc'); pg.wait_for_timeout(150)
    ck('após recarregar não há nódulos', pg.locator('.tr-nod').count() == 0)
    ck('sem erros de console', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
