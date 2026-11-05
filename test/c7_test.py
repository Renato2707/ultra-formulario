"""C7: calculadora BI-RADS de US de mama (ACR BI-RADS v2025). Regras com página, hierarquia 5>4>0>6>3>2>1,
4A/4B/4C obrigatório, sobrescrita, Limpar, colar laudo, vários nódulos, mama D/E, bloco "mais", ES5, tamanho.
Uso: /workspace/.pwenv/bin/python test/c7_test.py
UF_BANCO=<banco com o trecho MAMAS da proposta C7, fora do repo>; sem ele usa um banco mínimo embutido.
Nada do banco nem do laudo é impresso além dos nomes das verificações."""
import os, sys, json, re, random, subprocess, tempfile, itertools
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); IDX = 'file://' + os.path.join(ROOT, 'index.html')
REAL = os.environ.get('UF_BANCO')
LOC = 'Localizado na mama ?[direita|esquerda], às * horas, ?[QSL|QSM|QIL|QIM|UQS|UQI|UQL|UQM|retroareolar], a * mm da papila e * mm da pele, medindo * x * x * mm (LxAPxT). BI-RADS-US *.'
M1 = ('Observa-se nódulo de forma ?[oval|lobulada|redonda|irregular], orientação ?[paralela|não paralela], margem ?[circunscrita|não circunscrita indistinta|não circunscrita angular|não circunscrita microlobulada|não circunscrita espiculada], padrão ecogênico ?[anecoico|hiperecogênico|isoecogênico|hipoecogênico|heterogêneo|misto sólido e cístico], ?[sem características acústicas posteriores|com reforço acústico posterior|com sombra acústica posterior], ?+[sem calcificações|com macrocalcificações|com microcalcificações|com calcificações intraductais], ?+[sem características associadas|com pseudocápsula ecogênica|com halo ecogênico espesso|com distorção arquitetural|com alterações ductais|com espessamento cutâneo|com retração cutânea|com edema|avascular ao Doppler|com vascularização interna ao Doppler|com hipervascularização periférica ao Doppler|de consistência mole à elastografia|de consistência intermediária à elastografia|de consistência dura à elastografia]. ' + LOC)
Q = '?[QSL|UQS|QSM|UQM|QIM|UQI|QIL|UQL]'
LEG = '''BI-RADS ULTRASSONOGRÁFICO:
Categoria 0 - Incompleta. Necessita avaliação adicional por imagem e/ou exames anteriores para comparação.
Categoria 1 - Negativa. Rastreamento de rotina.
Categoria 2 - Benigna. Rastreamento de rotina.
Categoria 3 - Provavelmente benigna. Seguimento em curto intervalo (6 meses) ou vigilância contínua (12 meses).
Categoria 4A - Baixa suspeita de malignidade. Diagnóstico tecidual.
Categoria 4B - Suspeita moderada de malignidade. Diagnóstico tecidual.
Categoria 4C - Alta suspeita de malignidade. Diagnóstico tecidual.
Categoria 5 - Altamente sugestiva de malignidade. Diagnóstico tecidual.
Categoria 6 - Malignidade conhecida, comprovada por biópsia.'''
OWN = '''@@EXAME Mamária Bilateral
@@EXAME_FULL ULTRASSONOGRAFIA MAMÁRIA BILATERAL

@@TEMPLATE Mamária Bilateral (padrão)
ULTRASSONOGRAFIA MAMÁRIA BILATERAL
Parênquima mamário apresentando ecotextura de fundo ?[homogênea – adiposa|homogênea – fibroglandular|heterogênea]. Componente de tecido glandular ?[mínimo|leve|moderado|acentuado].
''' + M1 + '''
Hipótese/Impressão diagnóstica (compatível com):
Classificação: BI-RADS-US *.

''' + LEG + '''

Considerações gerais.

##SECTION MAMAS

M1:
''' + M1 + '''

Simples M1 [Cisto simples]:
Observa-se imagem nodular de forma oval, orientação paralela à pele, margem circunscrita, padrão ecogênico anecoico, com reforço acústico posterior, sugestiva de cisto simples. Destacando-se em ''' + Q + ''' de mama ?[direita|esquerda], medindo cerca de * x * x * mm (LxAPxT), distando cerca de * mm da papila na projeção das * hs. BI-RADS-US *.

Cisto complicado [Cisto complicado]:
Observa-se imagem nodular de forma oval, com ecos internos de baixa intensidade, sem componente sólido, sugestiva de cisto complicado. Destacando-se em ''' + Q + ''' de mama ?[direita|esquerda], medindo cerca de * x * x * mm (LxAPxT). BI-RADS-US *.

Linfo M1 [Linfonodo intramamário]:
Observa-se imagem nodular de forma oval, córtex hipoecogênico e hilo ecogênico (gorduroso). Destacando-se em ''' + Q + ''' de mama ?[direita|esquerda], medindo cerca de * x * x * mm (LxAPxT), distando cerca de * mm da papila na projeção das * hs, sugestiva de linfonodo intramamário. BI-RADS-US *.

Microcistos [Microcistos agrupados]:
Observam-se microcistos agrupados. ''' + LOC.replace('Localizado', 'Localizados') + '''

Não nodular [Lesão não nodular]:
Observa-se lesão não nodular ?[regional|focal|linear|segmentar], ?[hiperecogênica|heterogênea|hipoecogênica], ?[sem características acústicas posteriores|com reforço acústico posterior|com sombra acústica posterior], ?+[sem calcificações|com macrocalcificações|com microcalcificações|com calcificações intraductais]. ''' + LOC.replace('Localizado', 'Localizada') + '''
'''
OLD = '''@@EXAME Mamária Bilateral
@@EXAME_FULL ULTRASSONOGRAFIA MAMÁRIA BILATERAL

@@TEMPLATE Mamária Bilateral (padrão)
ULTRASSONOGRAFIA MAMÁRIA BILATERAL
Observa-se imagem nodular de formato ?[oval|arredondado|irregular], orientação ?[paralela|não paralela] à pele.
Classificação: BI-RADS-US *.

BI-RADS ULTRASSONOGRÁFICO:
Categoria 0 - Inconclusivo.
Categoria 4 - Suspeição.
Categoria 4a: baixa suspeição de malignidade.
Fim.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
def tmp(t):
    f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(t.replace('\n', '\r\n').encode('utf-8')); f.close(); return f.name

# ---------- 0) ES5 (acorn ecmaVersion 5) e tamanho ----------
AC = None
for c in ['/tmp/ac/node_modules/acorn', os.path.join(ROOT, 'node_modules/acorn')]:
    if os.path.isdir(c): AC = c
if AC:
    js = "var a=require(%s),fs=require('fs'),bad=[];process.argv.slice(1).forEach(function(f){var s=fs.readFileSync(f,'utf8');var parts=f.slice(-5)==='.html'?(s.match(/<script>([\\s\\S]*?)<\\/script>/g)||[]).map(function(x){return x.replace(/<\\/?script>/g,'')}):[s];parts.forEach(function(p){try{a.parse(p,{ecmaVersion:5})}catch(e){bad.push(f+': '+e.message)}})});console.log(JSON.stringify(bad))" % json.dumps(AC)
    fl = [os.path.join(ROOT, 'js', f) for f in sorted(os.listdir(os.path.join(ROOT, 'js'))) if f.endswith('.js')] + [os.path.join(ROOT, 'index.html')]
    out = subprocess.run(['node', '-e', js] + fl, capture_output=True, text=True).stdout.strip()
    ck('0 ES5 estrito (acorn ecmaVersion 5) em todos os js e scripts do index.html', out == '[]', out)
else:
    ck('0 acorn disponível', False, 'acorn não encontrado')
src = open(os.path.join(ROOT, 'js', 'calc-birads.js'), encoding='utf-8').read()
ck('0 calc-birads.js sem let/const/=>/template string', not re.search(r'\b(let|const)\s|=>|`', src))
tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, dn, fn in os.walk(ROOT) if '.git' not in dp and '/test' not in dp for f in fn if f.endswith(('.js', '.html', '.css')))
ck('0 app < 1 MB (%d B)' % tot, tot < 1000000, tot)

ERR = []
def fresh(b, bank, model='Mamária Bilateral (padrão)'):
    cx = b.new_context(viewport={'width': 1400, 'height': 1000}); pg = cx.new_page(); pg.set_default_timeout(6000)
    pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.on('console', lambda m: ERR.append('console: ' + m.text) if m.type == 'error' else None)
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', bank); pg.wait_for_timeout(400)
    pg.locator('[data-exam]', has_text='Mamária Bilateral').first.click(); pg.wait_for_timeout(500)
    pg.locator('[data-model]', has_text=model).first.dblclick(); pg.wait_for_timeout(500)
    pg.evaluate('UFCalc.open()'); pg.wait_for_timeout(150)
    if not pg.evaluate("UFCalc.isCardOpen('birads')"): pg.locator('[data-calc=birads] .uc-h').click()
    return pg
OC = '#ucB-birads .br-card.open '
def fill(pg, d):
    """d: tipo, lado, quad, hora, pap, pele, mm (3), forma, orient, marg, eco, post, dist, lnneco, lnnpost, mic, abs,
       calc [..], chips [..] (valores das caixas), more {assoc: [..], vasc, elas, ctg}, cat"""
    for k in ['tipo', 'lado', 'quad', 'forma', 'orient', 'marg', 'eco', 'post', 'dist', 'lnneco', 'lnnpost', 'mic', 'abs']:
        if k in d: pg.select_option(OC + '[data-f=%s]' % k, d[k])
    for k, lab in [('hora', 'Hor'), ('pap', 'Distância da papila'), ('pele', 'Distância da pele')]:
        if k in d: pg.fill(OC + 'input[aria-label^="%s"]' % lab, d[k])
    if 'mm' in d:
        for v, lab in zip(d['mm'], ['L', 'AP', 'T']): pg.fill(OC + 'input[aria-label="%s em mm"]' % lab, v)
    for v in d.get('calc', []) + d.get('chips', []): pg.check(OC + 'input[type=checkbox][value=%s]' % v)
    if 'more' in d:
        if not pg.is_visible(OC + '.br-more'): pg.click(OC + '.br-mbtn')
        m = d['more']
        for v in m.get('assoc', []): pg.check(OC + '.br-more input[value=%s]' % v)
        for k in ['vasc', 'elas', 'ctg']:
            if k in m: pg.select_option(OC + '[data-f=%s]' % k, m[k])
    if 'cat' in d: pg.select_option(OC + '.br-cat', d['cat'])
def st(pg):
    return pg.evaluate("""(function(){var c=document.querySelector('#ucB-birads .br-card.open');if(!c)return null;
      var r=c.querySelector('.br-res');return {res:r.textContent,tip:r.title,cat:c.querySelector('.br-cat').value,ins:!c.querySelector('.tr-ins').disabled,
      sum:c.querySelector('.br-sum').textContent,dot:c.querySelector('.uc-dot').className}})()""")
def rep(pg): return pg.evaluate('UFTest.reportText()').replace('\r', '').split('\n')
def birl(pg): return [l for l in rep(pg) if re.search(r'BI-RADS-US (?!_)', l) and not l.startswith('Classifica')]
def clas(pg): return ([l for l in rep(pg) if l.startswith('Classifica')] + [''])[0]
def legs(pg): return [l for l in rep(pg) if re.match(r'^Categoria\s', l)]
def ins(pg): pg.click(OC + '.tr-ins'); pg.wait_for_timeout(250)
def add(pg): pg.click('#brAdd'); pg.wait_for_timeout(100)
def paste(pg, t):
    pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'"); pg.click('#editor')
    pg.evaluate("""(t) => { var dt = new DataTransfer(); dt.setData('text/plain', t); document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""", t); pg.wait_for_timeout(500)
NOD3 = dict(tipo='nod', lado='direita', quad='QSL', hora='10', pap='20', pele='5', mm=['12', '8', '10'], forma='oval', orient='par', marg='circ', eco='hipo', post='aus')
HIER = ['5', '4', '0', '6', '3', '2', '1']
def pyfinal(cs):
    b = None
    for c in cs:
        if c and (b is None or HIER.index(c[0]) < HIER.index(b[0])): b = c
    return b
CATS = ['0', '1', '2', '3', '4A', '4B', '4C', '5', '6']

with sync_playwright() as p:
    b = p.chromium.launch()
    okreal = REAL and os.path.exists(REAL) and 'Observa-se nódulo de forma ?[' in open(REAL, encoding='utf-8', errors='replace').read()
    bank = REAL if okreal else tmp(OWN)   # banco sem a proposta C7 (ex.: o real de hoje): usa o banco de teste
    lab = 'banco real (proposta C7)' if bank == REAL else 'banco de teste'
    print('# ' + lab)
    pg = fresh(b, bank)
    # ---------- 1) regras escritas do manual (proposta, item 2), com página ----------
    S = lambda v: pg.evaluate('(v) => UFBirads.suggest(v)', v)
    base = dict(tipo='nod', forma='oval', orient='par', marg='circ', eco='hipo', post='aus', calc=[], assoc=[])
    cases = [
        ('cisto simples com as 4 características -> 2 (p.418; p.474; p.486)', dict(tipo='simples', cs=['circ', 'ovred', 'anec', 'fina']), '2', 'p.418'),
        ('cisto simples sem parede fina -> requer julgamento', dict(tipo='simples', cs=['circ', 'ovred', 'anec']), None, None),
        ('microcistos agrupados (septos finos) -> 2 (p.420)', dict(tipo='micro', mic='fino'), '2', 'p.420'),
        ('microcistos com margem indistinta/sólido discreto -> 4 (p.420)', dict(tipo='micro', mic='susp'), '4', 'p.420'),
        ('microcistos sem aspecto -> requer julgamento', dict(tipo='micro'), None, None),
        ('cisto complicado isolado -> 3 (p.475)', dict(tipo='compl'), '3', 'p.475'),
        ('cistos benignos múltiplos -> 2 (p.474; p.479)', dict(tipo='compl', mult=True), '2', 'p.479'),
        ('nódulo sólido oval circunscrito paralelo hipoecogênico -> 3 (p.475; p.486)', base, '3', 'p.486'),
        ('múltiplos sólidos circunscritos bilaterais semelhantes -> 2 (p.223)', dict(base, mbil=True), '2', 'p.223'),
        ('linfonodo intramamário tipicamente benigno -> 2 (p.223; p.474)', dict(tipo='linfo', tip=True), '2', 'p.474'),
        ('linfonodo sem "tipicamente benigno" -> requer julgamento', dict(tipo='linfo'), None, None),
        ('achado benigno da categoria 2 -> 2 (p.474)', dict(tipo='ben'), '2', 'p.474'),
        ('abscesso compatível -> 2 (p.485-486)', dict(tipo='absc', abs='comp'), '2', 'p.485'),
        ('provável abscesso -> 3 (p.485-486)', dict(tipo='absc', abs='prov'), '3', 'p.485'),
        ('lesão não nodular -> 4 (p.351)', dict(tipo='lnn'), '4', 'p.351'),
        ('biópsia comprovou malignidade -> 6 (p.472)', dict(base, bx=True), '6', 'p.472'),
        ('biópsia vale para qualquer tipo (cisto) -> 6', dict(tipo='compl', bx=True), '6', 'p.472'),
    ]
    for n, v, c, pgn in cases:
        r = S(v); ck('1 ' + n, (r['c'] if r else None) == c and (pgn is None or pgn in r.get('p', '')), r)
    # "qualquer outra combinação" -> requer julgamento (sem pontuação)
    J = [('forma irregular', dict(base, forma='irr')), ('forma lobulada', dict(base, forma='lob')), ('forma redonda', dict(base, forma='red')), ('orientação não paralela', dict(base, orient='nao')),
         ('margem indistinta', dict(base, marg='ind')), ('margem angular', dict(base, marg='ang')), ('margem microlobulada', dict(base, marg='mic')), ('margem espiculada', dict(base, marg='esp')),
         ('isoecogênico', dict(base, eco='iso')), ('hiperecogênico', dict(base, eco='hiper')), ('heterogêneo', dict(base, eco='het')), ('misto', dict(base, eco='misto')), ('anecoico', dict(base, eco='anec')),
         ('sombra', dict(base, post='som')), ('reforço', dict(base, post='ref')), ('microcalcificações', dict(base, calc=['micro'])), ('macrocalcificações', dict(base, calc=['macro'])),
         ('característica associada (edema)', dict(base, assoc=['edema'])), ('vascularização interna', dict(base, vasc='vint')), ('elastografia dura', dict(base, elas='edura')),
         ('múltiplos bilaterais com margem não circunscrita', dict(base, marg='ind', mbil=True)), ('nódulo sem descritores', dict(tipo='nod')), ('abscesso sem escolha', dict(tipo='absc'))]
    for n, v in J:
        r = S(v); ck('1 requer julgamento: ' + n, r and r['c'] is None, r)
    # todas as combinações dos 5 descritores do nódulo: só oval+paralela+circunscrita+hipo+ausentes sugere (3)
    G = pg.evaluate("(function(){var o={},k;for(k in UFBirads.G){o[k]=UFBirads.G[k].map(function(x){return x[0]})}return o})()")
    allc = list(itertools.product(G['forma'], G['orient'], G['marg'], G['eco'], G['post']))
    res = pg.evaluate("""(L) => L.map(function (a) { var s = UFBirads.suggest({tipo:'nod',forma:a[0],orient:a[1],marg:a[2],eco:a[3],post:a[4],calc:[],assoc:[]}); return s ? s.c : 'x'; })""", allc)
    bad = [a for a, r in zip(allc, res) if r != ('3' if a == ('oval', 'par', 'circ', 'hipo', 'aus') else None)]
    ck('1 todas as %d combinações de forma×orientação×margem×padrão×posterior: só a regra do manual sugere' % len(allc), not bad, bad[:5])
    # ---------- 2) hierarquia 5>4>0>6>3>2>1 e 4 puro ----------
    allp = [list(x) for n in (1, 2, 3) for x in itertools.product(CATS, repeat=n)]
    got = pg.evaluate("(L) => L.map(function (a) { return UFBirads.finalCat(a); })", allp)
    ck('2 hierarquia em %d combinações de 1 a 3 achados (empate: o primeiro)' % len(allp), all(g == pyfinal(a) for g, a in zip(got, allp)), [(a, g) for g, a in zip(got, allp) if g != pyfinal(a)][:5])
    ck('2 exemplos: [3,0]->0, [6,3]->6, [0,6]->0, [4A,0]->4A, [4A,5]->5, [2,1]->2, [4C,4A]->4C (primeiro)',
       pg.evaluate("[['3','0'],['6','3'],['0','6'],['4A','0'],['4A','5'],['2','1'],['4C','4A']].map(UFBirads.finalCat).join()") == '0,6,0,4A,5,2,4C')
    ck('2 "4" puro não é aceito; tolerância: " 4b ", "*4C", "4 a", "3." aceitos',
       pg.evaluate("[UFBirads.normCat('4'), UFBirads.normCat(' 4b '), UFBirads.normCat('*4C'), UFBirads.normCat('4 a'), UFBirads.normCat('3.'), UFBirads.normCat('7'), UFBirads.normCat('4D')].join('|')") == '|4B|4C|4A|3||')
    ck('2 lista de categorias do cartão: 0,1,2,3,4A,4B,4C,5,6 (sem 4 puro)', pg.evaluate("[].slice.call(document.querySelectorAll('#ucB-birads .br-cat option')).map(function(o){return o.value}).filter(String).join()") == ','.join(CATS))
    # ---------- 3) cartão: sugestão, sobrescrita, inserção, legenda única ----------
    leg0 = legs(pg)
    ck('3 modelo abre com a legenda inteira e Classificação em branco', len(leg0) >= 9 and '*' not in clas(pg) and re.search(r'BI-RADS-US\s+___', clas(pg)), [len(leg0), clas(pg)])
    ck('3 cartão começa aberto, ponto cinza, Inserir desativado, sem texto de resultado', st(pg)['ins'] is False and 'off' in st(pg)['dot'] and st(pg)['res'] == '', st(pg))
    ck('3 bloco "mais" recolhido', not pg.is_visible(OC + '.br-more'))
    fill(pg, NOD3); s = st(pg)
    ck('3 nódulo da regra: "sugestão 3", título com regra e página, categoria 3 preenchida, ponto verde', s['res'] == 'sugestão 3' and 'p.475' in s['tip'] and s['cat'] == '3' and 'on' in s['dot'] and s['ins'], s)
    ck('3 resumo "Nódulo 1 – MD 10h – 12 mm – BI-RADS 3"', s['sum'] == 'Nódulo 1 – MD 10h – 12 mm – BI-RADS 3', s['sum'])
    fill(pg, dict(cat='4B')); fill(pg, dict(pap='22')); s = st(pg)
    ck('3 sobrescrita manual (4B) fica mesmo mudando outro campo', s['cat'] == '4B' and s['res'] == 'sugestão 3', s)
    ins(pg); L = birl(pg)
    ck('3 frase do banco recebe os marcadores (forma ... papila, pele, LxAPxT, BI-RADS-US 4B)', len(L) == 1 and L[0].startswith('Observa-se nódulo de forma oval, orientação paralela, margem circunscrita, padrão ecogênico hipoecogênico, sem características acústicas posteriores, sem calcificações, sem características associadas. Localizado na mama direita, às 10 horas, QSL, a 22 mm da papila e 5 mm da pele, medindo 12 x 8 x 10 mm (LxAPxT). BI-RADS-US 4B.'), L)
    ck('3 a frase em branco do modelo foi preenchida (não duplicou)', pg.evaluate("[].filter.call(document.querySelectorAll('#editor div'),function(d){return /^Observa-se nódulo de forma/.test(d.textContent)}).length") == 1)
    ck('3 Classificação: BI-RADS-US 4B e só a linha 4B da legenda', clas(pg) == 'Classificação: BI-RADS-US 4B.' and len(legs(pg)) == 1 and legs(pg)[0].startswith('Categoria 4B'), [clas(pg), legs(pg)])
    ck('3 cartão inserido colapsa com o resumo', st(pg) is None and 'BI-RADS 4B' in pg.inner_text('#ucB-birads .br-sum'))
    ck('3 ponto do cartão BI-RADS no painel verde', 'on' in pg.evaluate("document.querySelector('[data-calc=birads] .uc-h .uc-dot').className"))
    # 2º nódulo, mama esquerda, irregular -> requer julgamento; 4 exige subcategoria
    add(pg); fill(pg, dict(tipo='nod', lado='esquerda', hora='2', mm=['20', '15', '18'], forma='irr', orient='nao', marg='esp', eco='hipo', post='som', calc=['micro'])); s = st(pg)
    ck('3 2º nódulo (ME, irregular, espiculado): "requer julgamento", sem categoria, Inserir desativado', s['res'] == 'requer julgamento' and s['cat'] == '' and not s['ins'] and 'Nódulo 2 – ME 2h' in s['sum'], s)
    fill(pg, dict(cat='5')); ins(pg); L = birl(pg)
    ck('3 2º nódulo entra logo depois do 1º, mama esquerda, microcalcificações, BI-RADS-US 5', len(L) == 2 and 'mama esquerda, às 2 horas' in L[1] and 'com microcalcificações' in L[1] and 'com sombra acústica posterior' in L[1] and L[1].endswith('BI-RADS-US 5.'), L)
    ck('3 hierarquia no laudo: 4B + 5 -> 5; só a linha 5 da legenda', clas(pg) == 'Classificação: BI-RADS-US 5.' and len(legs(pg)) == 1 and legs(pg)[0].startswith('Categoria 5'), [clas(pg), legs(pg)])
    # 3º: lesão não nodular sugere 4: categoria só com 4A/4B/4C
    add(pg); fill(pg, dict(tipo='lnn', lado='direita', dist='seg', lnneco='hipo', lnnpost='aus')); s = st(pg)
    ck('3 lesão não nodular: "sugestão 4" (p.351), categoria em branco até escolher 4A/4B/4C', s['res'] == 'sugestão 4' and s['cat'] == '' and not s['ins'] and 'p.351' in s['tip'], s)
    fill(pg, dict(cat='4A')); ins(pg); L = birl(pg)
    ck('3 lesão não nodular escrita com a frase do banco e BI-RADS-US 4A', any(l.startswith('Observa-se lesão não nodular segmentar, hipoecogênica, sem características acústicas posteriores') and l.endswith('BI-RADS-US 4A.') for l in L), L)
    ck('3 final continua 5 (5 > 4)', clas(pg) == 'Classificação: BI-RADS-US 5.')
    # editar à mão a categoria do 2º nódulo no laudo
    def setcat(i, v):
        pg.evaluate("""(a) => { var f = UFBirads.scan().nod[a[0]].f; f.textContent = a[1]; document.getElementById('editor').dispatchEvent(new Event('input', {bubbles: true})); }""", [i, v]); pg.wait_for_timeout(300)
    setcat(1, '3'); ck('3 categoria trocada à mão no laudo (5 -> 3): final 4A (4 > 3; primeiro 4 do laudo é 4B? não: 4B é do 1º)', clas(pg) == 'Classificação: BI-RADS-US 4B.', clas(pg))
    setcat(1, '0'); setcat(0, '2'); setcat(2, '1'); ck('3 [2, 0, 1] -> 0 (0 > 2 > 1)', clas(pg) == 'Classificação: BI-RADS-US 0.' and legs(pg)[0].startswith('Categoria 0'), [clas(pg), legs(pg)])
    setcat(1, '6'); ck('3 [2, 6, 1] -> 6', clas(pg) == 'Classificação: BI-RADS-US 6.')
    setcat(1, '4'); ck('3 "4" puro no laudo: ignorado e marcado (title explica)', clas(pg) == 'Classificação: BI-RADS-US 2.' and pg.evaluate("UFBirads.scan().nod[1].f.className").find('f-bad') >= 0, [clas(pg)])
    setcat(1, ' 4c '); ck('3 " 4c " com espaço/minúscula aceito -> 4C', clas(pg) == 'Classificação: BI-RADS-US 4C.', clas(pg))
    for i in range(3): setcat(i, '___')
    ck('3 sem categorias: Classificação volta a ___ e a legenda inteira volta na ordem', re.search(r'BI-RADS-US\s+___', clas(pg)) and legs(pg) == leg0, [clas(pg), legs(pg)[:2]])
    setcat(0, '3'); ck('3 volta a ter categoria: só a linha 3', legs(pg) == [l for l in leg0 if l.startswith('Categoria 3')], legs(pg))
    # toggle desliga
    pg.click('#ucBrTxt'); pg.wait_for_timeout(250)
    ck('3 "Categoria final pelo laudo" desligado: Classificação em branco e legenda inteira', re.search(r'BI-RADS-US\s+___', clas(pg)) and legs(pg) == leg0)
    pg.click('#ucBrTxt'); pg.wait_for_timeout(250)
    ck('3 religado: categoria final volta', clas(pg) == 'Classificação: BI-RADS-US 3.')
    # Classificação digitada à mão é respeitada
    pg.evaluate("""() => { var f = UFBirads.scan().fin[0]; f.textContent = '4A'; f.removeAttribute('data-auto'); document.getElementById('editor').dispatchEvent(new Event('input', {bubbles: true})); }"""); pg.wait_for_timeout(300)
    ck('3 Classificação mudada à mão não é sobrescrita', clas(pg) == 'Classificação: BI-RADS-US 4A.', clas(pg))
    # ---------- 4) Limpar ----------
    pg.click('#ucReset'); pg.wait_for_timeout(150)
    ck('4 Limpar: um cartão vazio aberto, laudo intacto', pg.evaluate("document.querySelectorAll('#ucB-birads .br-card').length") == 1 and st(pg)['res'] == '' and st(pg)['cat'] == '' and len([l for l in rep(pg) if 'BI-RADS-US' in l and not l.startswith('Classifica')]) == 3)
    # ---------- 5) tipos especiais com a frase do banco ----------
    pg2 = fresh(b, bank)
    specs = [
        ('cisto simples (4 características) -> 2', dict(tipo='simples', lado='esquerda', quad='UQS', hora='12', pap='15', mm=['5', '4', '5'], chips=['circ', 'ovred', 'anec', 'fina']), '2', 'sugestiva de cisto simples'),
        ('cisto complicado isolado -> 3', dict(tipo='compl', lado='direita', quad='QIL', mm=['7', '6', '5']), '3', 'cisto complicado'),
        ('cisto complicado múltiplos -> 2', dict(tipo='compl', lado='direita', chips=['mult']), '2', 'cisto complicado'),
        ('microcistos septos finos -> 2', dict(tipo='micro', lado='esquerda', hora='3', mic='fino'), '2', 'microcistos agrupados'),
        ('linfonodo tipicamente benigno -> 2', dict(tipo='linfo', lado='direita', quad='QSL', chips=['tip']), '2', 'linfonodo intramamário'),
        ('abscesso compatível -> 2 (frase de nódulo)', dict(tipo='absc', lado='direita', abs='comp'), '2', 'Observa-se nódulo de forma'),
        ('abscesso provável -> 3', dict(tipo='absc', lado='esquerda', abs='prov'), '3', 'Observa-se nódulo de forma'),
        ('achado benigno conhecido -> 2', dict(tipo='ben', lado='direita'), '2', 'Observa-se nódulo de forma'),
        ('malignidade comprovada por biópsia -> 6', dict(NOD3, forma='irr', chips=['bx']), '6', 'Observa-se nódulo de forma'),
        ('microcistos suspeitos -> 4: escolhido 4C', dict(tipo='micro', lado='direita', mic='susp', cat='4C'), '4C', 'microcistos agrupados'),
    ]
    first = True
    for n, d, c, key in specs:
        if not first: add(pg2)
        first = False; fill(pg2, d); s = st(pg2)
        ck('5 ' + n + ': categoria no cartão', s['cat'] == c and s['ins'], s)
        nb = len(birl(pg2)); ins(pg2); L = birl(pg2)
        ck('5 ' + n + ': frase do banco com "BI-RADS-US %s"' % c, len(L) == nb + 1 and any(key in l and l.endswith('BI-RADS-US %s.' % c) for l in L), L[-1:])
    L = birl(pg2)
    ck('5 cisto simples: mama esquerda, UQS, 5 x 4 x 5 mm, papila 15, 12 hs', any('UQS de mama esquerda, medindo cerca de 5 x 4 x 5 mm (LxAPxT), distando cerca de 15 mm da papila na projeção das 12 hs. BI-RADS-US 2.' in l for l in L), L[:2])
    ck('5 hierarquia com 10 achados (2,3,2,2,2,2,3,2,6,4C) -> 4C', clas(pg2) == 'Classificação: BI-RADS-US 4C.' and legs(pg2)[0].startswith('Categoria 4C'), clas(pg2))
    ck('5 resumos dos cartões colapsados (tipo, lado, categoria)', pg2.evaluate("[].map.call(document.querySelectorAll('#ucB-birads .br-sum'),function(s){return s.textContent})")[0].startswith('Cisto simples 1 – ME 12h – 5 mm – BI-RADS 2'))
    # ---------- 6) bloco "mais" ----------
    pg3 = fresh(b, bank)
    fill(pg3, dict(NOD3, more=dict(assoc=['edema', 'halo'], vasc='vint', elas='edura', ctg='leve')))
    s = st(pg3); ck('6 "mais": característica associada tira a sugestão (requer julgamento)', s['res'] == 'requer julgamento' and s['cat'] == '', s)
    fill(pg3, dict(cat='4A')); ins(pg3); L = birl(pg3)
    ck('6 "mais": halo, edema, vascularização interna e elastografia dura na frase', L and 'com halo ecogênico espesso, com edema, com vascularização interna ao Doppler e de consistência dura à elastografia' in L[0] or (L and all(t in L[0] for t in ['halo ecogênico espesso', 'edema', 'vascularização interna ao Doppler', 'consistência dura à elastografia'])), L)
    ck('6 componente de tecido glandular (CTG) preenche a lista do modelo', any('Componente de tecido glandular leve' in l for l in rep(pg3)))
    add(pg3); ck('6 novo cartão: "mais" recolhido de novo', not pg3.is_visible(OC + '.br-more'))
    # ---------- 7) Enter avança ----------
    pg3.focus(OC + '[data-f=tipo]'); pg3.select_option(OC + '[data-f=tipo]', 'nod')
    order = pg3.locator(OC + '[data-f]:visible').evaluate_all("els => els.map(e => e.getAttribute('data-f'))")
    ck('7 DOM visível: tipo, descritores, depois mama e quadrante', order == ['tipo', 'forma', 'orient', 'marg', 'eco', 'post', 'lado', 'quad'], order)
    for field in ['forma', 'orient', 'marg', 'eco', 'post']:
        pg3.keyboard.press('Enter')
        ck('7 Enter avança para ' + field, pg3.evaluate("document.activeElement.getAttribute('data-f')") == field)
    # Calcificações e campos específicos precedem a localização; "mais" segue recolhido.
    for value in ['macro', 'micro', 'intra', 'mbil', 'bx']:
        pg3.keyboard.press('Enter')
        ck('7 Enter avança para ' + value, pg3.evaluate("document.activeElement.value") == value)
    for field in ['lado', 'quad']:
        pg3.keyboard.press('Enter')
        ck('7 Enter avança para ' + field, pg3.evaluate("document.activeElement.getAttribute('data-f')") == field)
    for label in ['Horário (1 a 12)', 'Distância da papila em mm', 'Distância da pele em mm', 'L em mm', 'AP em mm', 'T em mm', 'Categoria BI-RADS']:
        pg3.keyboard.press('Enter')
        ck('7 Enter avança para ' + label, pg3.evaluate("document.activeElement.getAttribute('aria-label')") == label)
    pg3.click('#ucReset'); pg3.wait_for_timeout(100); fill(pg3, dict(NOD3, lado='esquerda'))
    pg3.focus(OC + '.br-cat'); n0 = len(birl(pg3)); pg3.keyboard.press('Enter'); pg3.wait_for_timeout(300)
    ck('7 Enter no último campo insere', len(birl(pg3)) == n0 + 1 and birl(pg3)[-1].endswith('BI-RADS-US 3.'))
    # ---------- 8) colar laudo ----------
    txt = '\n'.join(rep(pg2)); before = pg2.evaluate("UFBirads.scan().nod.map(function(n){return n.cat})")
    paste(pg2, txt); pg2.wait_for_timeout(300)
    nod = pg2.evaluate("UFBirads.scan().nod.map(function(n){return n.cat})")
    ck('8 laudo colado: os 10 achados reconhecidos com as mesmas categorias', nod == before and len(nod) == 10, [nod, before])
    ck('8 laudo colado: categoria final 4C e só a linha 4C (sem duplicar)', clas(pg2) == 'Classificação: BI-RADS-US 4C.' and len(legs(pg2)) == 1, [clas(pg2), legs(pg2)])
    ck('8 laudo colado: as escolhas viram campos (forma, margem, calcificações múltiplas)', pg2.evaluate("document.querySelectorAll('#editor .fld.f-sel.f-ok').length") > 20)
    t2 = txt.replace('Classificação: BI-RADS-US 4C.', 'Classificação: BI-RADS-US *.').replace('BI-RADS-US 4C.', 'BI-RADS-US *4c .', 1).replace('BI-RADS-US 6.', 'BI-RADS-US  5 .', 1)
    paste(pg2, t2); nod = pg2.evaluate("UFBirads.scan().nod.map(function(n){return n.cat})")
    ck('8 colado com "*" esquecido, espaço e minúscula: reconhecido; final 5', '5' in nod and clas(pg2) == 'Classificação: BI-RADS-US 5.', [nod, clas(pg2)])
    paste(pg2, txt.replace('Classificação: BI-RADS-US 4C.', 'Classificação: BI-RADS-US 3.'))
    ck('8 colado com Classificação escrita pelo médico (3): respeitada', clas(pg2) == 'Classificação: BI-RADS-US 3.', clas(pg2))
    blank = '\n'.join(re.sub(r'BI-RADS-US \S+\.$', 'BI-RADS-US *.', l) if 'BI-RADS-US' in l else l for l in rep(pg2))
    paste(pg2, blank)
    ck('8 colado sem categorias ("*"): campos vazios, Classificação em branco', pg2.evaluate("UFBirads.scan().nod.every(function(n){return n.cat===null})") and '___' in clas(pg2), clas(pg2))
    # ---------- 9) robustez: nenhum erro de JavaScript em estados aleatórios ----------
    pg4 = fresh(b, bank); random.seed(7); e0 = len(ERR)
    sels = ['tipo', 'lado', 'quad', 'forma', 'orient', 'marg', 'eco', 'post', 'dist', 'lnneco', 'lnnpost', 'mic', 'abs']
    for it in range(120):
        if it % 15 == 14: add(pg4)
        if it % 40 == 39: pg4.click('#ucReset'); pg4.wait_for_timeout(50)
        k = random.choice(sels + ['num', 'chk', 'cat', 'ins', 'more'])
        try:
            if k in sels:
                o = pg4.evaluate("(k) => [].map.call(document.querySelectorAll('#ucB-birads .br-card.open [data-f=' + k + '] option'), function (o) { return o.value; })", k)
                if o: pg4.evaluate("(a) => { var s = document.querySelector('#ucB-birads .br-card.open [data-f=' + a[0] + ']'); s.value = a[1]; s.dispatchEvent(new Event('change')); }", [k, random.choice(o)])
            elif k == 'num':
                pg4.evaluate("(v) => { var l = document.querySelectorAll('#ucB-birads .br-card.open input[type=text]'); var i = l[Math.floor(Math.random() * l.length)]; if (i) { i.value = v; i.dispatchEvent(new Event('input')); } }", random.choice(['', ' 12 ', '*', '3,5', 'abc', '10h', '0', '13', '-2', '1.5 mm']))
            elif k == 'chk':
                pg4.evaluate("() => { var l = document.querySelectorAll('#ucB-birads .br-card.open input[type=checkbox]'); var i = l[Math.floor(Math.random() * l.length)]; if (i) { i.checked = !i.checked; i.dispatchEvent(new Event('change')); } }")
            elif k == 'cat':
                pg4.evaluate("(v) => { var s = document.querySelector('#ucB-birads .br-card.open .br-cat'); if (s) { s.value = v; s.dispatchEvent(new Event('change')); } }", random.choice(CATS + ['']))
            elif k == 'more':
                pg4.evaluate("() => { var b = document.querySelector('#ucB-birads .br-card.open .br-mbtn'); if (b) b.click(); }")
            else:
                pg4.evaluate("() => { var b = document.querySelector('#ucB-birads .br-card.open .tr-ins'); if (b && !b.disabled) b.click(); }")
        except Exception as ex:
            ERR.append('teste: ' + str(ex))
    pg4.wait_for_timeout(300)
    ck('9 120 ações aleatórias (campos, sujeira, caixas, Limpar, inserir): nenhum erro de JavaScript', len(ERR) == e0, ERR[e0:e0 + 3])
    fin = pg4.evaluate("UFBirads.finalCat(UFBirads.scan().nod.map(function(n){return n.cat}))")
    ck('9 depois das ações: Classificação coerente com os achados do laudo', (fin is None and '___' in clas(pg4)) or clas(pg4) == 'Classificação: BI-RADS-US %s.' % fin, [fin, clas(pg4)])
    # ---------- 10) sem poluição visual ----------
    vis = pg4.evaluate("""() => { var b = document.getElementById('ucB-birads'), out = [], w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), n;
        while ((n = w.nextNode())) { var e = n.parentNode; if (/\\S/.test(n.nodeValue) && e.offsetParent !== null && e.nodeName !== 'OPTION') out.push(n.nodeValue.trim()); } return out; }""")
    longt = [t for t in vis if len(t) > 40 and not t.startswith(('Nódulo', 'Cisto', 'Microcistos', 'Linfonodo', 'Lesão', 'Abscesso', 'Achado'))]
    ck('10 nenhum texto explicativo visível no cartão (só rótulos curtos; explicação no title)', not longt, longt)
    # ---------- 11) banco antigo (sem a frase da proposta): nada quebra ----------
    pg5 = fresh(b, tmp(OLD)); e0 = len(ERR)
    fill(pg5, NOD3); s = st(pg5)
    ck('11 banco sem a frase "BI-RADS-US *": Inserir desativado (title explica), sugestão continua', not s['ins'] and s['res'] == 'sugestão 3' and 'banco' in pg5.get_attribute(OC + '.tr-ins', 'title'), s)
    ck('11 banco antigo: legenda e Classificação intactas, sem erros', len(legs(pg5)) == 3 and '___' in clas(pg5) and len(ERR) == e0)
    ck('99 nenhum erro de JavaScript no teste inteiro', not ERR, ERR[:3])
    b.close()
print('%d/%d passaram' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
