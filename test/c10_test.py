"""C10: sessões de abas — abrir um modelo por aba; salvar inclui abas de fundo.
Uso: UF_BANCO=<banco> /workspace/.pwenv/bin/python test/c10_test.py
     (sem UF_BANCO usa /workspace/banco-renato/banco-teste-birads.txt se existir)
"""
import json, os, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IDX = 'file://' + os.path.join(ROOT, 'index.html')
BANK = os.environ.get('UF_BANCO') or '/workspace/banco-renato/banco-teste-birads.txt'
NAMES = [
    'Abdome Total (padrão)',
    'Transvaginal (padrão)',
    'Obstétrica de 1º Trimestre (padrão)',
    'Doppler de Fluxo Obstétrico (padrão)',
]
R = []

def ck(n, c, i=''):
    ok = bool(c)
    R.append(ok)
    print(('PASS ' if ok else 'FAIL ') + n + ('' if ok else '  -> ' + str(i)[:500]))
    sys.stdout.flush()

def load(pg):
    pg.goto(IDX)
    pg.evaluate('localStorage.clear(); sessionStorage.clear(); window.name=""')
    pg.reload()
    pg.wait_for_timeout(250)
    pg.set_input_files('#bankFile0', BANK)
    pg.wait_for_timeout(700)
    pg.wait_for_selector('[data-exam]', timeout=15000)

def use(pg, name):
    ok = pg.evaluate("""(function (nm) {
      var i, m = null;
      for (i = 0; i < UFTest.S.models.length; i++) {
        if (UFTest.S.models[i].name === nm) { m = UFTest.S.models[i]; break; }
      }
      if (!m) { return null; }
      UFTest.useModel(m, true);
      return m.id;
    })""", name)
    pg.wait_for_timeout(300)
    return ok

def title_of(pg):
    try:
        return pg.title()
    except Exception:
        return ''

def text_of(pg):
    try:
        return pg.evaluate('UFTest.reportText()') or ''
    except Exception:
        return ''

def wait_pages(pages, n, timeout_ms=8000):
    import time
    t0 = time.time()
    while len(pages) < n and (time.time() - t0) * 1000 < timeout_ms:
        pg_wait = pages[-1] if pages else None
        if pg_wait:
            try:
                pg_wait.wait_for_timeout(50)
            except Exception:
                pass
        else:
            time.sleep(0.05)
    return len(pages)

with sync_playwright() as p:
    b = p.chromium.launch()
    ERR = []
    # ---------- 1) abrir sessão a partir de aba com conteúdo ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.set_default_timeout(20000)
    pg.on('pageerror', lambda e: ERR.append('p:' + str(e)))
    load(pg)
    ck('1 banco com os 4 modelos', all(pg.evaluate('(nm) => UFSess.findModelByName(nm) && UFSess.findModelByName(nm).name', n) for n in NAMES), NAMES)
    use(pg, NAMES[0])
    ck('1 aba atual é Abdome Total', pg.title() == NAMES[0] and 'ABDÔMEN TOTAL' in text_of(pg).upper().replace('ABDOMEN', 'ABDÔMEN'))
    before = text_of(pg)
    pg.evaluate("UStore.set('tabSessions', [{name:'Plantão maternidade', models: %s}])" % json.dumps(NAMES, ensure_ascii=False))
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    pg.click('#btnSess'); pg.wait_for_timeout(150)
    ck('1 menu lista a sessão', pg.locator('#sessMenu .sm-i[data-si]').count() == 1)
    pg.locator('#sessMenu .sm-i[data-si] .sm-n').click()
    pg.wait_for_timeout(2800)
    ck('1 4 abas novas', len(pages) == 4, len(pages))
    for np in pages:
        np.wait_for_load_state()
        np.wait_for_timeout(250)
    tit = [title_of(np) for np in pages]
    ck('1 cada aba nova tem o modelo da sessão, na ordem', tit == NAMES, tit)
    ck('1 nenhuma aba nova é só cópia vazia/default', all(title_of(np) in NAMES and len(text_of(np)) > 40 for np in pages), tit)
    ck('1 a aba atual não foi apagada', pg.title() == NAMES[0] and text_of(pg) == before)
    ck('1 endereço das abas novas sem hash', all('#ufopen' not in (np.url or '') and '#ufmodel' not in (np.url or '') for np in pages), [np.url for np in pages])
    # accents / parentheses in Obstétrica
    ck('1 modelo com acento e parênteses carregou', 'OBSTÉTRICA' in text_of(pages[2]).upper() or 'OBSTETRICA' in text_of(pages[2]).upper(), text_of(pages[2])[:80])
    ctx.close()

    # ---------- 2) sessão só com nomes (formato antigo) e aba vazia ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p2:' + str(e)))
    load(pg)
    pg.evaluate("UStore.set('tabSessions', [{name:'maternidade', models: %s}])" % json.dumps(NAMES, ensure_ascii=False))
    # empty editor
    pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'")
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    pg.evaluate("UFSess.open(UFSess.list()[0])")
    pg.wait_for_timeout(2800)
    for np in pages:
        np.wait_for_load_state(); np.wait_for_timeout(200)
    ck('2 aba vazia recebe o 1º modelo', pg.title() == NAMES[0], pg.title())
    ck('2 as outras 3 abas abrem os modelos restantes', [title_of(np) for np in pages] == NAMES[1:], [title_of(np) for np in pages])
    ctx.close()

    # ---------- 3) salvar inclui abas de fundo com heartbeat vencido ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p3:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    # open the other 3 via #ufmodel (real window.open, shared localStorage)
    ids = [pg.evaluate("(nm) => { var m=UFSess.findModelByName(nm); return m && m.id; }", n) for n in NAMES]
    for mid in ids[1:]:
        pg.evaluate("(id) => window.open(location.href.replace(/#.*$/,'') + '#ufmodel=' + encodeURIComponent(id), '_blank')", mid)
        pg.wait_for_timeout(700)
    pg.wait_for_timeout(800)
    for np in pages:
        np.wait_for_load_state(); np.wait_for_timeout(150)
    got = pg.evaluate('UFSess.openTabsModels()')
    ck('3 imediatamente as 4 abas entram na sessão', got == NAMES, got)
    aged = pg.evaluate("""() => {
      var m = UStore.get('tabs', {}), k, t = Date.now();
      for (k in m) { if (m.hasOwnProperty(k)) { m[k] = t - 20000; } }
      UStore.set('tabs', m);
      return UFSess.openTabsModels();
    }""")
    ck('3 depois de 20 s sem heartbeat, as 4 abas ainda entram', aged == NAMES, aged)
    pg.click('#btnSess'); pg.locator('#sessMenu [data-ssave]').click(); pg.wait_for_timeout(200)
    ol = pg.evaluate("document.querySelector('.sess-ol') && document.querySelector('.sess-ol').innerText")
    ck('3 diálogo lista os 4 modelos', all(n in (ol or '') for n in NAMES), ol)
    pg.fill('#sessName', 'Plantão maternidade')
    pg.click('#sessSave'); pg.wait_for_timeout(200)
    ss = pg.evaluate("UStore.get('tabSessions')")
    ck('3 sessão salva com nomes e ids', ss and ss[0]['name'] == 'Plantão maternidade' and ss[0]['models'] == NAMES and ss[0].get('ids') and len(ss[0]['ids']) == 4, ss)
    ctx.close()

    # ---------- 4) fila de reserva: window.open sem hash não copia a aba atual ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p4:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    parent_txt = text_of(pg)
    mid = pg.evaluate("(nm) => UFSess.findModelByName(nm).id", NAMES[1])
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    # enqueue Transvaginal, open the same file with NO hash (simula o Edge perder o #)
    pg.evaluate("""(item) => {
      UFSess.enqueueSessOpen(item);
      window.open(String(location.href).replace(/#.*$/, ''), '_blank');
    }""", {'id': mid, 'name': NAMES[1], 'ord': 1})
    pg.wait_for_timeout(2000)
    ck('4 uma aba nova', len(pages) == 1, len(pages))
    if pages:
        pages[0].wait_for_load_state(); pages[0].wait_for_timeout(300)
        ck('4 a aba nova carregou o modelo da fila, não a cópia da atual',
           title_of(pages[0]) == NAMES[1] and 'TRANSVAGINAL' in text_of(pages[0]).upper() and text_of(pages[0])[:40] != parent_txt[:40],
           {'title': title_of(pages[0]), 'text': text_of(pages[0])[:80]})
        ck('4 a aba atual continua Abdome Total', pg.title() == NAMES[0])
    ctx.close()

    ck('sem erros de página', not ERR, ERR)
    b.close()

print('\n%d/%d OK' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
