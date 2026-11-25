"""C10/C10b/C10c: sessões de abas — abrir com mensagem visível; salvar só as abas realmente abertas.
Uso: python test/c10_test.py
     Sem UF_BANCO, usa um banco de exemplo embutido com modelos "X (padrão)".
     UF_BANCO=<banco fora do repo> testa também com o banco do usuário (nada do conteúdo é impresso).
"""
import json, os, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import uf_testutil
uf_testutil.install()
ROOT = uf_testutil.repo_root()
IDX = uf_testutil.index_url()
BANK = uf_testutil.resolve_bank_path()
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
    ck('1 3 abas novas (o 1º modelo já está nesta aba)', len(pages) == 3, len(pages))
    for np in pages:
        np.wait_for_load_state()
        np.wait_for_timeout(250)
    tit = [title_of(np) for np in pages]
    ck('1 cada aba nova tem o restante da sessão, na ordem', tit == NAMES[1:], tit)
    ck('1 nenhuma aba nova é só cópia vazia/default', all(title_of(np) in NAMES and len(text_of(np)) > 40 for np in pages), tit)
    ck('1 a aba atual não foi apagada', pg.title() == NAMES[0] and text_of(pg) == before)
    ck('1 endereço das abas novas sem hash', all('#ufopen' not in (np.url or '') and '#ufmodel' not in (np.url or '') for np in pages), [np.url for np in pages])
    # accents / parentheses in Obstétrica
    ck('1 modelo com acento e parênteses carregou', 'OBSTÉTRICA' in text_of(pages[1]).upper() or 'OBSTETRICA' in text_of(pages[1]).upper(), text_of(pages[1])[:80])
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
    pg.click('#btnSess'); pg.locator('#sessMenu [data-ssave]').click()
    pg.wait_for_selector('.sess-ol', timeout=4000)
    ol = pg.evaluate("document.querySelector('.sess-ol') && document.querySelector('.sess-ol').innerText")
    nchk = pg.evaluate("document.querySelectorAll('.sess-ol input[type=checkbox]').length")
    allck = pg.evaluate("Array.prototype.every.call(document.querySelectorAll('.sess-ol input[type=checkbox]'), function (c) { return c.checked; })")
    ck('3 diálogo lista os 4 modelos', all(n in (ol or '') for n in NAMES) and (ol or '').count('\n') <= 4, ol)
    ck('3 diálogo tem 4 caixas marcadas', nchk == 4 and allck, (nchk, allck))
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

    # ---------- 5+6) entradas velhas e nomes repetidos não entram ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p5:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    mid_tv = pg.evaluate("(nm) => UFSess.findModelByName(nm).id", NAMES[1])
    pg.evaluate("(id) => window.open(location.href.replace(/#.*$/,'') + '#ufmodel=' + encodeURIComponent(id), '_blank')", mid_tv)
    pg.wait_for_timeout(1200)
    for np in pages:
        np.wait_for_load_state(); np.wait_for_timeout(150)
    stale_ids = [pg.evaluate("(nm) => UFSess.findModelByName(nm).id", n) for n in NAMES]
    # imita o que o Renato viu: tabStay/drafts de abas já fechadas, com nomes repetidos
    before = pg.evaluate("""(items) => {
      var stay = UStore.get('tabStay', {}) || {};
      var tabs = UStore.get('tabs', {}) || {};
      var t = Date.now(), i, id;
      for (i = 0; i < items.length; i++) {
        id = 'stale-' + i;
        stay[id] = t - 60000;
        tabs[id] = t - 20000;
        UStore.set('draft.' + id, { model: items[i % items.length], text: 'stale', ord: t + i, saved: t });
      }
      UStore.set('tabStay', stay);
      UStore.set('tabs', tabs);
      return UFSess.openTabsModels();
    }""", stale_ids + stale_ids)
    ck('5 o mapa velho teria a mais (antes do ping)', 'Obstétrica de 1º Trimestre (padrão)' in (before or []) or len(before or []) > 2, before)
    live = pg.evaluate("""() => new Promise(function (resolve) {
      UFSess.probeLiveTabs(function (recs) { resolve(recs); });
    })""")
    live_names = [r['name'] for r in (live or [])]
    ck('5 o ping só conta as 2 abas realmente abertas', live_names == [NAMES[0], NAMES[1]], live_names)
    stay_after = pg.evaluate("""() => {
      var s = UStore.get('tabStay', {}) || {}, k, n = 0;
      for (k in s) { if (s.hasOwnProperty(k) && String(k).indexOf('stale-') === 0) { n++; } }
      return n;
    }""")
    ck('5 entradas velhas saem do tabStay depois do ping', stay_after == 0, stay_after)
    sync_after = pg.evaluate('UFSess.openTabsModels()')
    ck('5 depois do ping, a lista síncrona também fica só com as 2', sync_after == [NAMES[0], NAMES[1]], sync_after)
    pg.click('#btnSess'); pg.locator('#sessMenu [data-ssave]').click()
    pg.wait_for_selector('.sess-ol', timeout=4000)
    ol = pg.evaluate("document.querySelector('.sess-ol') && document.querySelector('.sess-ol').innerText")
    nchk = pg.evaluate("document.querySelectorAll('.sess-ol input[type=checkbox]').length")
    ck('5 diálogo lista 2 modelos, sem repetir e sem as fechadas', nchk == 2 and NAMES[0] in (ol or '') and NAMES[1] in (ol or '') and 'Obstétrica' not in (ol or ''), (nchk, ol))
    pg.click('text=Cancelar')
    ctx.close()

    # ---------- 7) aba de fundo com timer atrasado ainda responde ao ping ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p7:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    ids = [pg.evaluate("(nm) => { var m=UFSess.findModelByName(nm); return m && m.id; }", n) for n in NAMES]
    for mid in ids[1:]:
        pg.evaluate("(id) => window.open(location.href.replace(/#.*$/,'') + '#ufmodel=' + encodeURIComponent(id), '_blank')", mid)
        pg.wait_for_timeout(700)
    pg.wait_for_timeout(800)
    for np in pages:
        np.wait_for_load_state(); np.wait_for_timeout(150)
    pg.evaluate("""() => {
      var m = UStore.get('tabs', {}), k, t = Date.now();
      for (k in m) { if (m.hasOwnProperty(k)) { m[k] = t - 20000; } }
      UStore.set('tabs', m);
      UStore.set('tabStay', {});
    }""")
    live7 = pg.evaluate("""() => new Promise(function (resolve) {
      UFSess.probeLiveTabs(function (recs) { resolve(recs.map(function (r) { return r.name; })); });
    })""")
    ck('7 ping encontra as 4 abas mesmo sem tabStay e com heartbeat vencido', live7 == NAMES, live7)
    ctx.close()

    # ---------- 8) desmarcar um modelo no diálogo não o salva ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p8:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    ids = [pg.evaluate("(nm) => { var m=UFSess.findModelByName(nm); return m && m.id; }", n) for n in NAMES[:3]]
    for mid in ids[1:]:
        pg.evaluate("(id) => window.open(location.href.replace(/#.*$/,'') + '#ufmodel=' + encodeURIComponent(id), '_blank')", mid)
        pg.wait_for_timeout(700)
    pg.wait_for_timeout(800)
    for np in pages:
        np.wait_for_load_state(); np.wait_for_timeout(150)
    pg.click('#btnSess'); pg.locator('#sessMenu [data-ssave]').click()
    pg.wait_for_selector('.sess-ol', timeout=4000)
    pg.evaluate("document.getElementById('sessCb1').checked = false")
    pg.fill('#sessName', 'sem o do meio')
    pg.click('#sessSave'); pg.wait_for_timeout(200)
    ss = pg.evaluate("UStore.get('tabSessions')")
    want = [NAMES[0], NAMES[2]]
    ck('8 sessão salva sem o modelo desmarcado', ss and ss[0]['name'] == 'sem o do meio' and ss[0]['models'] == want and len(ss[0].get('ids') or []) == 2, ss)
    ctx.close()

    # ---------- 9) C10c: sessão só com o modelo já aberto nesta aba — mensagem, não silêncio ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p9:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    pg.evaluate("UStore.set('tabSessions', [{name:'Plantão maternidade', models: %s}])" % json.dumps([NAMES[0]], ensure_ascii=False))
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    pg.click('#btnSess')
    pg.locator('#sessMenu .sm-i[data-si] .sm-n').click()
    pg.wait_for_selector('#modalBack:not([hidden])', timeout=3000)
    body = pg.evaluate("document.getElementById('modalBody') && document.getElementById('modalBody').innerText")
    ck('9 nenhuma aba nova', len(pages) == 0, len(pages))
    ck('9 avisa que o modelo já está nesta aba', body and 'já está nesta aba' in body and NAMES[0] in body, body)
    pg.click('#modalFoot .btn-primary')
    ctx.close()

    # ---------- 10) C10c: modelos que não existem — mensagem, não silêncio ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p10:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    pg.evaluate("UStore.set('tabSessions', [{name:'vazia', models: ['Modelo que não existe']}])")
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    pg.evaluate("UFSess.open(UFSess.list()[0])")
    pg.wait_for_selector('#modalBack:not([hidden])', timeout=3000)
    body = pg.evaluate("document.getElementById('modalBody') && document.getElementById('modalBody').innerText")
    ck('10 nenhuma aba nova', len(pages) == 0, len(pages))
    ck('10 avisa que o modelo não existe no banco', body and 'Nenhum modelo desta sessão existe' in body, body)
    pg.click('#modalFoot .btn-primary')
    ctx.close()

    # ---------- 11) C10c: pop-ups bloqueados após o 1º — modal com um botão por modelo ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p11:' + str(e)))
    load(pg)
    use(pg, NAMES[0])
    pg.evaluate("UStore.set('tabSessions', [{name:'Plantão maternidade', models: %s}])" % json.dumps(NAMES, ensure_ascii=False))
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    # 1º window.open do gesto passa; os seguintes voltam null (como o bloqueio do Edge)
    pg.evaluate("""() => {
      var orig = window.open, n = 0;
      window.__allowOpen = 1;
      window.open = function () {
        n += 1;
        if (n > window.__allowOpen) { return null; }
        return orig.apply(this, arguments);
      };
      window.__origOpen = orig;
    }""")
    pg.click('#btnSess')
    pg.locator('#sessMenu .sm-i[data-si] .sm-n').click()
    pg.wait_for_selector('#modal .sess-open-list', timeout=4000)
    pg.wait_for_timeout(800)
    ck('11 uma aba nova (a primeira do restante)', len(pages) == 1, len(pages))
    if pages:
        pages[0].wait_for_load_state(); pages[0].wait_for_timeout(200)
        ck('11 a aba nova é o 2º modelo', title_of(pages[0]) == NAMES[1], title_of(pages[0]))
    btns = pg.evaluate("""() => {
      var b = document.querySelectorAll('#modal .sess-open-one'), i, a = [];
      for (i = 0; i < b.length; i++) { a.push(b[i].innerText); }
      return a;
    }""")
    ck('11 modal tem um botão para cada modelo bloqueado', btns == ['Abrir ' + n for n in NAMES[2:]], btns)
    # cada clique no botão é um gesto: libera mais um window.open
    pg.evaluate('window.__allowOpen = 100')
    pg.locator('.sess-open-one').first.click()
    pg.wait_for_timeout(800)
    pg.locator('.sess-open-one').nth(1).click()
    pg.wait_for_timeout(800)
    ck('11 clicar nos botões abre as abas que faltavam', len(pages) == 3, len(pages))
    if len(pages) >= 3:
        for np in pages[1:]:
            np.wait_for_load_state(); np.wait_for_timeout(150)
        ck('11 as abas dos botões têm os modelos certos', [title_of(np) for np in pages[1:]] == NAMES[2:], [title_of(np) for np in pages[1:]])
    done = pg.evaluate("""() => {
      var b = document.querySelectorAll('#modal .sess-open-one'), i, n = 0;
      for (i = 0; i < b.length; i++) { if (b[i].disabled) { n++; } }
      return n;
    }""")
    ck('11 os botões usados ficam como Aberto', done == 2, done)
    ctx.close()

    # ---------- 12) C10c: aba vazia + um modelo — avisa que abriu nesta aba ----------
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERR.append('p12:' + str(e)))
    load(pg)
    pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'")
    pg.evaluate("UStore.set('tabSessions', [{name:'so um', models: %s}])" % json.dumps([NAMES[1]], ensure_ascii=False))
    pages = []
    ctx.on('page', lambda np: pages.append(np))
    pg.evaluate("UFSess.open(UFSess.list()[0])")
    pg.wait_for_selector('#modalBack:not([hidden])', timeout=3000)
    body = pg.evaluate("document.getElementById('modalBody') && document.getElementById('modalBody').innerText")
    ck('12 nenhuma aba nova', len(pages) == 0, len(pages))
    ck('12 a aba atual recebeu o modelo', pg.title() == NAMES[1], pg.title())
    ck('12 avisa que abriu nesta aba', body and 'foi aberto nesta aba' in body and NAMES[1] in body, body)
    ctx.close()

    ck('sem erros de página', not ERR, ERR)
    b.close()

print('\n%d/%d OK' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
