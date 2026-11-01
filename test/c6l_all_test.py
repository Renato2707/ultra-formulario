"""C6l: TI-RADS exaustivo. (A) score() em TODAS as combinações; (B) amostra grande no laudo real. Uso: python test/c6l_all_test.py"""
import os, sys, json, itertools, random, importlib.util
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, 'c6k_test.py'), encoding='utf-8').read()
PRE = SRC.split('with sync_playwright() as p:')[0]   # reaproveita banco/funções da C6k sem rodar os testes dela
G = {'__file__': os.path.join(HERE, 'c6k_test.py')}; exec(PRE, G)
fresh, rep, six, SIX, OLD, T = G['fresh'], G['rep'], G['six'], G['SIX'], G['OLD'], G['T']
R = []; ERR = G['ERR']
def ck(n, c, i=''):
    R.append(bool(c))
    if not c: print('FAIL ' + n + '  -> ' + str(i)[:400]); sys.stdout.flush()
P = {'comp': {'cist': 0, 'esp': 0, 'mist': 1, 'sol': 2, 'ind': 2}, 'eco': {'anec': 0, 'hiper': 1, 'hipo': 2, 'muito': 3, 'ind': 1},
     'forma': {'larg': 0, 'alto': 3}, 'marg': {'lisa': 0, 'mal': 0, 'lob': 2, 'ete': 3, 'ind': 0}, 'focos': {'nenhum': 0, 'macro': 1, 'perif': 2, 'punct': 3}}
def ref(c, e, f, m, fo):
    if c == 'esp': return 0
    return P['comp'][c] + (1 if c == 'ind' else P['eco'][e]) + P['forma'][f] + P['marg'][m] + sum(P['focos'][x] for x in fo)
def lev(t): return 'TR1' if t <= 1 else 'TR2' if t == 2 else 'TR3' if t == 3 else 'TR4' if t <= 6 else 'TR5'
LVX = {'TR1': ('Benigno', '≤2%', 'Nenhuma', 'Nenhuma'), 'TR2': ('Não suspeito', '≤2%', 'Nenhuma', 'Nenhuma'),
       'TR3': ('Levemente suspeito', '~5%', 'se ≥2,5 cm', 'se ≥1,5 cm, US após 1, 3 e 5 anos.'),
       'TR4': ('Moderadamente suspeito', '5-20%', 'se ≥1,5 cm', 'se ≥1,0 cm, US após 1, 2, 3 e 5 anos.'),
       'TR5': ('Altamente suspeito', '≥20%', 'se ≥1,0 cm', 'se ≥0,5 cm, US anual por até 5 anos.')}
def six_exp(t):
    L = lev(t); v = LVX[L]; return ['Pontuação: %d' % t, 'Categoria TIRADS: ' + L, 'Nível de Risco: ' + v[0], 'Risco de Malignidade: ' + v[1], 'Recomendação de PAAF: ' + v[2], 'Sugestão de Acompanhamento: ' + v[3]]
FK = ['nenhum', 'macro', 'perif', 'punct']
SUBS = [list(s) for k in range(1, 5) for s in itertools.combinations(FK, k)]
# texto do banco -> chave/pontos
TC = ['cístico', 'espongiforme', 'misto', 'sólido', 'indeterminado']; TCK = ['cist', 'esp', 'mist', 'sol', 'ind']
TE = ['anecoico', 'hiperecogênico', 'isoecogênico', 'hipoecogênico', 'muito hipoecogênico', 'indeterminado']; TEK = ['anec', 'hiper', 'hiper', 'hipo', 'muito', 'ind']
TF = ['mais largo que alto', 'mais alto que largo']; TFK = ['larg', 'alto']
TM = ['lisas', 'mal definidas', 'lobuladas', 'irregulares', 'com extensão extratireoidiana']; TMK = ['lisa', 'mal', 'lob', 'lob', 'ete']
TFO = ['sem focos', 'tipo cauda de cometa', 'macrocalcificações', 'calcificações periféricas', 'puntiformes']; TFOK = ['nenhum', 'nenhum', 'macro', 'perif', 'punct']
SET = """(function(a){ var e=document.getElementById('editor'), ln=[].filter.call(e.querySelectorAll('div'),function(x){return /^Observa-se/.test(x.textContent)&&!x.querySelector('div')})[0];
 if(!ln){ var c0=e.querySelector('.fld[data-t=s]'); UFTest.openSelect(c0); UFTest.chooseOption(1); ln=[].filter.call(e.querySelectorAll('div'),function(x){return /^Observa-se/.test(x.textContent)&&!x.querySelector('div')})[0]; }
 for(var i=0;i<5;i++){ var cs=ln.querySelectorAll('.fld[data-t=s]'), c=cs[i]; if(!c) break; var o=JSON.parse(c.getAttribute('data-o')), v=a[i];
  if(v===null) continue;
  if(c.getAttribute('data-m')){ var t=[],k; for(k=0;k<v.length;k++) t.push(o[v[k]]); c.setAttribute('data-v', v.join(',')); c.textContent=UltraParser.joinMulti(t); c.className+=' f-ok'; continue; }
  UFTest.openSelect(c); UFTest.chooseOption(v); UFTirads.runTxt(); if(i===0&&a[0]===1) break; }
 UFTirads.runTxt(); UFTirads.runTxt(); return true; })"""
def foc_idx(sub): return [i for i, k in enumerate(TFOK) if k in sub and not (k == 'nenhum' and i == 1)] if sub else []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = fresh(b, 1)
    # (A) exaustivo no módulo
    allc = []
    for c in P['comp']:
        for e in P['eco']:
            for f in P['forma']:
                for m in P['marg']:
                    for s in [[]] + SUBS: allc.append([c, e, f, m, s])
    got = pg.evaluate("""(L)=>L.map(function(x){var r=UFTirads.score({comp:x[0],eco:x[1],forma:x[2],marg:x[3],focos:x[4]});return [r.total,r.complete,UFTirads.level(r.total),UFTirads.lines(r.total)]})""", allc)
    tot = set(); bad = 0
    for x, g in zip(allc, got):
        t = ref(*x); comp = bool(x[4]) or x[0] == 'esp'
        if g[1] != comp or (comp and (g[0] != t or g[2] != lev(t) or g[3] != six_exp(t))): bad += 1; ck('A ' + str(x), False, g)
        if comp: tot.add(t)
    ck('A %d combinações conferidas' % len(allc), bad == 0)
    ck('A totais atingíveis = 0..17 (nenhum impossível)', tot == set(range(18)), sorted(tot))
    print('A: %d combinações, totais atingíveis %s' % (len(allc), sorted(tot)))
    # (B) laudo real
    cases = []
    for i in range(5):
        for j in range(6): cases.append((i, j, 1, 2, [4]))
    for f in range(2): cases.append((3, 3, f, 0, [0]))
    for m in range(5): cases.append((3, 1, 0, m, [2]))
    for k in range(1, 6):
        for s in itertools.combinations(range(5), k):
            if not (0 in s and len(s) > 1): cases.append((2, 4, 1, 4, list(s)))
    random.seed(17)
    for _ in range(60): cases.append((random.choice([0, 2, 3, 4]), random.randrange(6), random.randrange(2), random.randrange(5), sorted(random.sample(range(1, 5), random.randrange(1, 5)))))
    cases.append((3, 4, 1, 4, [2, 3, 4]))   # 17
    def exp_of(c):
        i, j, f, m, s = c; fk = [TFOK[x] for x in s]
        return ref(TCK[i], TEK[j], TFK[f], TMK[m], fk)
    def check_rep(name, pg, t, single=True):
        r = rep(pg); s6 = six(pg); nod = [l for l in r if l.startswith('Observa-se')]
        ck(name + ' 6 linhas', s6 == six_exp(t), (s6, nod))
        ck(name + ' sem escolher/TI-RADS vazio', all('escolher' not in l and not l.rstrip('. ').endswith('TI-RADS') and 'TI-RADS ___' not in l for l in nod), nod)
        ck(name + ' 6 linhas abaixo do título, 5 antigas fora', T in r and r[r.index(T) + 1:r.index(T) + 7] == s6 and OLD(pg) == [] and pg.locator('#editor .uc-trl').count() == 6, r)
        return nod
    for n, c in enumerate(cases):
        if n: pg.evaluate("UFTest.clearEditor ? UFTest.clearEditor() : 0")
        pg.close(); pg = fresh(b, 1)
        i, j, f, m, s = c
        pg.evaluate("""(a)=>{ var e=document.getElementById('editor'); var c0=e.querySelector('.fld[data-t=s]'); UFTest.openSelect(c0); UFTest.chooseOption(1); }""", None)
        pg.evaluate(SET + '(%s)' % json.dumps([i, None if i == 1 else j, None if i == 1 else f, None if i == 1 else m, None if i == 1 else s]))
        pg.wait_for_timeout(60)
        t = exp_of(c) if i != 1 else 0
        nod = check_rep('B %s' % (c,), pg, t)
        ck('B %s TI-RADS na frase' % (c,), len(nod) == 1 and nod[0].rstrip('. ').endswith('TI-RADS ' + lev(t)[2:]), nod)
        if n in (0, 10, len(cases) - 1): print('  texto: ' + nod[0] + ' | ' + ' / '.join(six(pg)))
        if i == 1: ck('B esp frase curta', nod and nod[0].startswith('Observa-se nódulo espongiforme. Localizado'), nod)
    print('B: %d casos no laudo' % len(cases))
    # (C) 2 nódulos pelo painel: recomendação única do maior
    def ins(pg, vals, focos):
        for cc, v in zip(('comp', 'eco', 'forma', 'marg'), vals):
            if v: pg.select_option('.tr-sel[data-cat=%s]' % cc, v)
        for x in pg.locator('input[data-cat=focos]').all():
            if x.is_checked() and x.get_attribute('value') not in focos and not x.is_disabled(): x.click()
        for fo in focos:
            if not pg.is_checked('input[data-cat=focos][value=%s]' % fo): pg.click('input[data-cat=focos][value=%s]' % fo)
        pg.evaluate("(function(){var e=document.getElementById('editor'),r=document.createRange();var d=[].filter.call(e.querySelectorAll('div'),function(x){return /^TIREOIDE/.test(x.textContent)})[0]||e.firstChild;r.selectNodeContents(d);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);e.focus()})()")
        pg.click('#trIns'); pg.wait_for_timeout(400)
    PAIRS = [(('esp', None, None, None), [], ('sol', 'muito', 'alto', 'ete'), ['macro', 'perif', 'punct']),
             (('sol', 'hipo', 'larg', 'lisa'), ['nenhum'], ('mist', 'hiper', 'larg', 'lisa'), ['nenhum']),
             (('cist', 'anec', 'larg', 'lisa'), ['nenhum'], ('esp', None, None, None), []),
             (('sol', 'hipo', 'alto', 'lob'), ['punct'], ('sol', 'hipo', 'alto', 'lob'), ['punct']),
             (('ind', None, 'larg', 'lisa'), ['macro'], ('mist', 'hiper', 'larg', 'lisa'), ['nenhum']),
             (('mist', 'hipo', 'larg', 'mal'), ['perif'], ('sol', 'hiper', 'larg', 'lob'), ['macro']),
             (('cist', 'anec', 'larg', 'lisa'), ['nenhum'], ('cist', 'hiper', 'larg', 'lisa'), ['nenhum'])]
    for a1, f1, a2, f2 in PAIRS:
        pg.close(); pg = fresh(b, 1); pg.evaluate("UFCalc.open(); UFCalc.setOpen('tirads', true)")
        ins(pg, a1, f1); ins(pg, a2, f2)
        t1 = ref(a1[0], a1[1], a1[2], a1[3], f1) if a1[0] != 'esp' else 0; t2 = ref(a2[0], a2[1], a2[2], a2[3], f2) if a2[0] != 'esp' else 0
        nod = check_rep('C %s/%s' % (a1, a2), pg, max(t1, t2))
        ck('C %s/%s 2 frases com o próprio TI-RADS' % (a1, a2), len(nod) == 2 and sorted(l.rstrip('. ').split('TI-RADS ')[-1] for l in nod) == sorted([lev(t1)[2:], lev(t2)[2:]]), nod)
    ck('sem erros de página', not ERR, ERR)
    b.close()
print('%d/%d' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
