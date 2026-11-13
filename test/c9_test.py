"""C9: layout Opção B — cada painel com o seu cabeçalho, abas Modelos/Frases, rodapés.
Sem barra de cima. Divisória de 8 px. Nome de seção em frase, parênteses como no banco.
Nada de um painel invade o outro (1024 px). Sem sintaxe ES6 e sem CSS gap.
Uso: python test/c9_test.py   (banco genérico embutido; nenhum texto clínico real)
"""
import os, re, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IDX = 'file://' + os.path.join(ROOT, 'index.html')
BANK = '''@@EXAME Alfa
@@EXAME_FULL ULTRASSONOGRAFIA ALFA
@@TEMPLATE Alfa (padrão)
TEXTO-ALFA-PADRAO
Linha alfa do modelo.

@@TEMPLATE Alfa variante
TEXTO-ALFA-VAR

##SECTION COM FRASES
Frase alfa:
FRASE-ALFA unica-alfa no corpo.

##SECTION VIAS BILIARES (CCN)
Frase da via:
FRASE-VIA texto da via.

##SECTION ACHADOS ADICIONAIS DO COMPARTIMENTO POSTERIOR DIREITO E ANEXOS SUPERIORES (CCN)
Frase longa:
FRASE-LONGA texto longo para a secao.

##SECTION VAZIA OCULTA

@@EXAME Beta
@@EXAME_FULL ULTRASSONOGRAFIA BETA
@@TEMPLATE Beta (padrão)
TEXTO-BETA-PADRAO
'''
LONG = 'ACHADOS ADICIONAIS DO COMPARTIMENTO POSTERIOR DIREITO E ANEXOS SUPERIORES (CCN)'
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:500])); sys.stdout.flush()
def strip_comments(src):
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'(^|[^:\'"])//.*?$', r'\1', src, flags=re.M)
    return src
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False)
f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
INSIDE = """(function () {
  function box(el) { return el.getBoundingClientRect(); }
  function panelOf(el) {
    while (el && el !== document.body) {
      if (el.id === 'left' || el.id === 'center' || el.id === 'right') { return el.id; }
      el = el.parentNode;
    }
    return '';
  }
  function bad(sel, panel) {
    var nodes = document.querySelectorAll(sel), i, el, r, p, pr, out = [];
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      if (!el || el.offsetParent === null) { continue; }
      r = box(el); if (r.width < 1 && r.height < 1) { continue; }
      if (panelOf(el) !== panel) { out.push((el.id || sel) + ' em ' + (panelOf(el) || '?')); continue; }
      p = document.getElementById(panel); pr = box(p);
      if (r.left < pr.left - 1 || r.right > pr.right + 1 || r.top < pr.top - 1 || r.bottom > pr.bottom + 1) {
        out.push((el.id || el.className || sel) + ' fora');
      }
    }
    return out;
  }
  var L = box(document.getElementById('left')), C = box(document.getElementById('center')), R = box(document.getElementById('right'));
  var s1 = box(document.getElementById('splitL')), s2 = box(document.getElementById('splitR'));
  function hit(a, b) { return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; }
  var bg = function (id) { return getComputedStyle(document.querySelector(id)).backgroundColor; };
  return {
    topbar: !!document.getElementById('topbar'),
    overlap: hit(L, C) || hit(C, R) || hit(L, R) || hit(L, s1) || hit(s1, C) || hit(C, s2) || hit(s2, R),
    order: L.right <= s1.left + 1 && s1.right <= C.left + 1 && C.right <= s2.left + 1 && s2.right <= R.left + 1,
    splitW: [Math.round(s1.width), Math.round(s2.width)],
    fits: L.left >= -1 && R.right <= (window.innerWidth || 1024) + 1,
    leftW: Math.round(L.width), rightW: Math.round(R.width),
    heads: bg('#navHead') === bg('#centerHead') && bg('#centerHead') === bg('#right .rhead'),
    bad: bad('#examName, #navBack, #tabModelos, #tabFrases, #navSearch, #navFoot, #navFoot .btn', 'left')
      .concat(bad('#repSearch, #repPrev, #repNext, #btnSess, #btnClear, #btnSettings, #fmtBar, #fmtBar .tb, #centerFoot, #btnCopy, #btnPrint, #btnGen', 'center'))
      .concat(bad('#rightToggle, .rtitle, #ucReset', 'right'))
  };
})()"""
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 1024, 'height': 600})
    pg = c.new_page(); pg.set_default_timeout(8000)
    ERR = []
    pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(250)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    # ---------- 0) lista de exames, painéis lado a lado ----------
    ck('0 sem barra de cima', pg.locator('#topbar').count() == 0)
    ck('0 lista de exames', pg.evaluate('UFTest.S.level') == 1 and pg.locator('[data-exam="Alfa"]').count() == 1 and pg.inner_text('#listHead').strip() == 'Exames')
    ck('0 caixa do exame oculta na lista', not pg.locator('#examBox').is_visible())
    lay = pg.evaluate(INSIDE)
    ck('0 painéis não se sobrepõem e cabem em 1024', not lay['overlap'] and lay['order'] and lay['fits'] and not lay['topbar'], lay)
    ck('0 divisória de 8 px', lay['splitW'] == [8, 8], lay['splitW'])
    ck('0 largura padrão ~300 e ~280', abs(lay['leftW'] - 300) <= 2 and abs(lay['rightW'] - 280) <= 2, [lay['leftW'], lay['rightW']])
    ck('0 cabeçalhos com o mesmo cinza', lay['heads'] is True, lay['heads'])
    # ---------- 1) abas, trocar, rodapé de modelos, links C8 ----------
    pg.click('[data-exam="Alfa"]'); pg.wait_for_timeout(250)
    ck('1 entrou no exame, aba Modelos', pg.evaluate('UFTest.S.level') == 2 and pg.evaluate('UFTest.S.navExam') == 'Alfa' and pg.get_attribute('#tabModelos', 'aria-selected') == 'true')
    ck('1 EXAME com o nome e trocar', pg.inner_text('#examName').strip() == 'Alfa' and 'trocar' in pg.inner_text('#navBack').lower())
    ck('1 modelos do exame, (padrão) destacado', pg.locator('#navList [data-model]').count() == 2 and 'pad' in (pg.locator('#navList [data-model]', has_text='(padrão)').get_attribute('class') or ''))
    foot = pg.inner_text('#navFoot')
    ck('1 rodapé Modelos: Novo modelo, Editar, Clonar', '+ Novo modelo' in foot and 'Editar' in foot and 'Clonar' in foot, foot)
    ck('1 sem Inserir e sem Ver frases', pg.locator('#tPIns').count() == 0 and 'Ver frases sem carregar modelo' not in pg.inner_text('#left') and 'Inserir' not in foot)
    hrefs = pg.evaluate("""(function () {
      var a = document.querySelectorAll('#navList [data-model]'), i, o = [];
      for (i = 0; i < a.length; i++) { o.push({ tag: a[i].nodeName, href: a[i].getAttribute('href') || '' }); }
      return o;
    })()""")
    ck('1 links C8 #ufmodel= nos modelos', len(hrefs) == 2 and all(x['tag'] == 'A' and x['href'].startswith('#ufmodel=') for x in hrefs), hrefs)
    pg.click('#tabFrases'); pg.wait_for_timeout(200)
    ck('1 aba Frases sem modelo carregado mostra as frases do exame', pg.evaluate('UFTest.S.level') == 3 and pg.get_attribute('#tabFrases', 'aria-selected') == 'true' and pg.locator('#navList [data-model]').count() == 0 and pg.locator('#navList [data-sec]').count() >= 3)
    ck('1 pesquisa de frases', pg.get_attribute('#navSearch', 'placeholder') == 'Pesquisar frases...')
    ff = pg.inner_text('#navFoot')
    ck('1 rodapé Frases: Nova frase, Importar, Editar', '+ Nova frase' in ff and 'Importar' in ff and 'Editar' in ff and pg.locator('#tPIns').count() == 0, ff)
    # ---------- 2) frase (sentence case), parênteses, quebra, seção vazia oculta ----------
    names = pg.evaluate("""(function () {
      var out = [], nodes = document.querySelectorAll('#navList .sec > .card'), i, t, s, k;
      for (i = 0; i < nodes.length; i++) {
        t = nodes[i].querySelector('.ct'); s = '';
        for (k = 0; k < t.childNodes.length; k++) { if (t.childNodes[k].nodeType === 3) { s += t.childNodes[k].nodeValue; } }
        out.push({ name: s.replace(/^\\s+|\\s+$/g, ''), title: nodes[i].getAttribute('title') || '' });
      }
      return out;
    })()""")
    shown = [x['name'] for x in names]
    via = [x for x in names if x['title'] == 'VIAS BILIARES (CCN)']
    long = [x for x in names if x['title'] == LONG]
    ck('2 parênteses preservados e o resto em frase', via and via[0]['name'] == 'Vias biliares (CCN)' and '(CCN)' in via[0]['name'] and '(ccn)' not in via[0]['name'], via)
    ck('2 dica com o nome inteiro do banco', via and via[0]['title'] == 'VIAS BILIARES (CCN)' and long and long[0]['title'] == LONG, names)
    sc = pg.evaluate("""function (longName) { return { a: UFTest.sentenceCase('VIAS BILIARES (CCN)'), b: UFTest.sentenceCase('ECO (CCN) EXTRA'), c: UFTest.sentenceCase(longName) }; }""", LONG)
    ck('2 função sentenceCase', sc['a'] == 'Vias biliares (CCN)' and sc['b'] == 'Eco (CCN) extra' and long and sc['c'] == long[0]['name'], sc)
    ck('2 seção vazia oculta', 'Vazia oculta' not in shown and all('VAZIA' not in x['title'] for x in names), shown)
    wrap = pg.evaluate("""function (title) {
      var nodes = document.querySelectorAll('#navList [data-sec]'), i, el, ct, cs, left = document.getElementById('left').getBoundingClientRect();
      for (i = 0; i < nodes.length; i++) { if (nodes[i].getAttribute('title') === title) { el = nodes[i]; break; } }
      ct = el.querySelector('.ct'); cs = getComputedStyle(ct);
      var r = el.getBoundingClientRect();
      return { h: ct.offsetHeight, ws: cs.whiteSpace, ov: cs.textOverflow, tr: cs.textTransform,
        inside: r.left >= left.left - 1 && r.right <= left.right + 1, full: ct.textContent.indexOf('(CCN)') >= 0 };
    }""", LONG)
    ck('2 nome longo quebra, não corta, e fica no painel', wrap['h'] > 32 and wrap['ws'] != 'nowrap' and wrap['ov'] != 'ellipsis' and wrap['tr'] == 'none' and wrap['inside'] and wrap['full'], wrap)
    # ---------- 3) trocar e Esc voltam aos exames; seta anda na lista ----------
    pg.click('#navBack'); pg.wait_for_timeout(200)
    ck('3 trocar volta à lista', pg.evaluate('UFTest.S.level') == 1 and pg.locator('[data-exam="Alfa"]').count() == 1 and not pg.locator('#examBox').is_visible())
    pg.click('[data-exam="Alfa"]'); pg.wait_for_timeout(200)
    ids = pg.evaluate("""(function () { var a = document.querySelectorAll('#navList [data-model]'), i, o = []; for (i = 0; i < a.length; i++) { o.push(a[i].getAttribute('data-model')); } return o; })()""")
    pg.locator('#navList [data-model]').first.focus(); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100)
    ck('3 seta para baixo anda na lista de modelos', len(ids) >= 2 and pg.evaluate("document.activeElement && document.activeElement.getAttribute('data-model')") == ids[1], ids)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ck('3 Esc em Modelos volta aos exames', pg.evaluate('UFTest.S.level') == 1)
    pg.click('[data-exam="Alfa"]'); pg.wait_for_timeout(150); pg.click('#tabFrases'); pg.wait_for_timeout(150)
    pg.locator('#navList [data-sec]').first.focus(); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ck('3 Esc em Frases volta aos exames', pg.evaluate('UFTest.S.level') == 1 and pg.locator('[data-exam="Beta"]').count() == 1)
    # ---------- 4) modelo carregado marcado; clique recarrega; seta da frase fica ----------
    pg.click('[data-exam="Alfa"]'); pg.wait_for_timeout(150)
    pg.locator('#navList [data-model]', has_text='Alfa (padrão)').click(); pg.wait_for_timeout(300)
    ck('4 carregar o modelo abre Frases', pg.evaluate('UFTest.S.level') == 3 and 'TEXTO-ALFA-PADRAO' in pg.evaluate('UFTest.reportText()'))
    pg.evaluate("""(function () { var d = document.createElement('div'); d.textContent = 'RASCUNHO-C9'; document.getElementById('editor').appendChild(d); })()""")
    pg.click('#tabModelos'); pg.wait_for_timeout(200)
    ck('4 modelo carregado marcado', 'loaded' in (pg.locator('#navList [data-model]', has_text='Alfa (padrão)').get_attribute('class') or ''))
    pg.locator('#navList .card.loaded').click(); pg.wait_for_timeout(300)
    rep = pg.evaluate('UFTest.reportText()')
    ck('4 clique no modelo carregado recarrega do zero', 'TEXTO-ALFA-PADRAO' in rep and 'RASCUNHO-C9' not in rep and 'ufmodel' not in pg.url, rep[:160])
    pg.locator('#navList [data-sec]', has_text='COM FRASES').click(); pg.wait_for_timeout(150)
    ck('4 seta da frase continua; não há botão Inserir na barra', pg.locator('#navList .pcard .pins').count() >= 1 and pg.locator('#tPIns').count() == 0)
    # ---------- 5) em 1024 nada do cabeçalho sai do painel; laudo e calculadoras ----------
    lay2 = pg.evaluate(INSIDE)
    ck('5 cabeçalhos dentro do próprio painel', lay2['bad'] == [] and not lay2['overlap'] and lay2['fits'], lay2)
    ck('5 laudo: buscar, sessões, limpar, formatação, copiar/imprimir/gerar',
       pg.get_attribute('#repSearch', 'placeholder') == 'Buscar no laudo...' and pg.locator('#btnSess').count() == 1 and pg.locator('#btnClear').count() == 1 and pg.locator('#fmtBar .tb').count() >= 9 and 'Copiar' in pg.inner_text('#centerFoot') and 'Imprimir' in pg.inner_text('#centerFoot') and 'Gerar' in pg.inner_text('#centerFoot') and 'btn-primary' in (pg.get_attribute('#btnGen', 'class') or ''))
    ck('5 calculadoras: título e Limpar', 'Calculadoras' in pg.inner_text('#right .rhead') and pg.inner_text('#ucReset').strip() == 'Limpar')
    ck('5 sem erro de página', not ERR, ERR[:3])
    c.close(); b.close()
# ---------- 6) fonte: ES5, sem gap, menos de 1 MB ----------
es6 = []
rels = ['index.html', 'css/app.css'] + ['js/' + fn for fn in os.listdir(os.path.join(ROOT, 'js')) if fn.endswith('.js')]
for rel in rels:
    raw = open(os.path.join(ROOT, rel), encoding='utf-8').read()
    src = strip_comments(raw)
    if '=>' in src: es6.append(rel + ' =>')
    if re.search(r'\b(let|const)\b', src): es6.append(rel + ' let/const')
    if '`' in src: es6.append(rel + ' template')
css = strip_comments(open(os.path.join(ROOT, 'css', 'app.css'), encoding='utf-8').read())
ck('6 sem sintaxe ES6 nos arquivos do app', not es6, es6)
ck('6 CSS sem gap', not re.search(r'gap\s*:', css), 'gap')
total = 0
for dirpath, _, files in os.walk(ROOT):
    if 'test' in dirpath.split(os.sep): continue
    for fn in files:
        if fn.endswith(('.html', '.css', '.js')): total += os.path.getsize(os.path.join(dirpath, fn))
ck('6 app menor que 1 MB', total < 1024 * 1024, total)
os.unlink(f.name)
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
