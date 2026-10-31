"""C6f: gravação na pasta de dados mais robusta (pasta simulada em test/fakefs.js; banco genérico, nenhum dado real).
Uso: python test/c6f_test.py (playwright + chromium)"""
import os, sys, json, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
FAKE = open(os.path.join(HERE, 'fakefs.js'), encoding='utf-8').read()
BANK = '@@EXAME Exame Teste\n@@EXAME_FULL EXAME TESTE\n@@TEMPLATE Padrão\nEXAME TESTE\nLinha alfa do modelo.\n'
tf = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); tf.write(BANK.replace('\n', '\r\n').encode('utf-8')); tf.close()
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
ERR = []
def page(cx, clear=True):
    pg = cx.new_page(); pg.set_default_timeout(6000); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX)
    if clear: pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200); pg.set_input_files('#bankFile0', tf.name); pg.wait_for_timeout(300)
    return pg
def ctx(b, nolocks=False):
    cx = b.new_context(viewport={'width': 1300, 'height': 850}); cx.add_init_script(FAKE)
    if nolocks: cx.add_init_script("try{Object.defineProperty(navigator,'locks',{value:undefined,configurable:true})}catch(e){}")
    return cx
def connect(pg):
    pg.evaluate("new Promise(function(ok){UFolder.useHandle(__fakeRoot(), function(){ok();});})"); pg.wait_for_timeout(500)
    pg.evaluate("UFolder._timing([100, 200, 300], 400, 1000)")
files = lambda pg: pg.evaluate("JSON.parse(localStorage.getItem('fakefs.files')||'{}')")
def data(pg): return json.loads(files(pg).get('/dados.json', {}).get('t') or 'null') or {}
st = lambda pg: pg.evaluate('UFolder.status()')
def setv(pg, v): pg.evaluate("(v) => UStore.set('searchHist', v)", v)
with sync_playwright() as p:
    b = p.chromium.launch()
    cx = ctx(b); pg = page(cx); connect(pg)
    ck('pasta conectada', st(pg) == 'folder', st(pg))
    # 1) transitório: 2 falhas seguidas -> repete e grava, sem sair de 'folder'
    pg.evaluate("localStorage.setItem('fakefs.flaky','2')"); setv(pg, ['t1']); pg.wait_for_timeout(1300)
    ck('1 erro transitório (NoModificationAllowedError x2): repetido e gravado', data(pg).get('searchHist') == ['t1'] and pg.evaluate('window.__flakyHits') == 2, [data(pg).get('searchHist'), pg.evaluate('window.__flakyHits')])
    ck('1 ... e o espelhamento continua ligado (sem aviso)', st(pg) == 'folder' and not pg.is_visible('#fbar'), st(pg))
    for nm in ('InvalidStateError', 'NotReadableError'):
        pg.evaluate("(n) => { localStorage.setItem('fakefs.flaky','1'); localStorage.setItem('fakefs.flakyname', n); }", nm); setv(pg, [nm]); pg.wait_for_timeout(900)
        ck('1 transitório %s não derruba' % nm, st(pg) == 'folder' and data(pg).get('searchHist') == [nm], [st(pg), data(pg).get('searchHist')])
    pg.evaluate("localStorage.removeItem('fakefs.flakyname')")
    # 1b) persistente: pendrive removido -> 'error' com nome técnico
    pg.evaluate("localStorage.setItem('fakefs.unplugged','1')"); setv(pg, ['fora']); pg.wait_for_timeout(1200)
    ck('1 pendrive removido (NotFoundError): estado error', st(pg) == 'error' and pg.evaluate('UFolder.lastError()') == 'NotFoundError', [st(pg), pg.evaluate('UFolder.lastError()')])
    ck('4 barra mostra o nome técnico em fonte pequena', pg.is_visible('#fbar') and pg.inner_text('#fbar .fbar-err') == '(NotFoundError)', T := pg.inner_text('#fbar'))
    pg.wait_for_timeout(1000)
    ck('2 continua em error enquanto o pendrive está fora (tenta sozinho, sem quebrar)', st(pg) == 'error')
    setv(pg, ['fora2'])
    # 2) recolocado: volta sozinho e envia o pendente
    pg.evaluate("localStorage.setItem('fakefs.unplugged','0')"); pg.wait_for_timeout(1200)
    ck('2 pendrive de volta: religa sozinho (sem clique)', st(pg) == 'folder' and not pg.is_visible('#fbar'), st(pg))
    ck('2 ... e grava o que ficou pendente', data(pg).get('searchHist') == ['fora2'], data(pg).get('searchHist'))
    ck('2 folderDirty limpo', not pg.evaluate("UStore.get('folderDirty', 0)"))
    # 2b) pasta mais nova (outro computador) não é sobrescrita
    pg.evaluate("localStorage.setItem('fakefs.unplugged','1')"); setv(pg, ['local']); pg.wait_for_timeout(1000)
    ck('2b em error', st(pg) == 'error')
    pg.evaluate("""() => { var f = JSON.parse(localStorage.getItem('fakefs.files')); var d = JSON.parse(f['/dados.json'].t); d.searchHist = ['de outro computador'];
       f['/dados.json'] = { t: JSON.stringify(d), m: Date.now() + 60000 }; localStorage.setItem('fakefs.files', JSON.stringify(f)); localStorage.setItem('fakefs.unplugged','0'); }""")
    pg.wait_for_timeout(1300)
    ck('2b religa e a pasta mais nova vence (não sobrescreve)', st(pg) == 'folder' and data(pg).get('searchHist') == ['de outro computador'] and pg.evaluate("UStore.get('searchHist')") == ['de outro computador'], [st(pg), data(pg).get('searchHist'), pg.evaluate("UStore.get('searchHist')")])
    # 1c) transitório que não passa: entra em error e depois recupera sozinho
    pg.evaluate("window.__sts = []; UFolder.onStatus(function (s) { __sts.push(s + ':' + UFolder.lastError()); })")
    pg.evaluate("localStorage.setItem('fakefs.flaky','6')"); setv(pg, ['teimoso']); pg.wait_for_timeout(3000)
    sts = pg.evaluate('__sts')
    ck('1 falha transitória que persiste: error só após as tentativas', bool(sts) and sts[0] == 'error:NoModificationAllowedError', sts)
    ck('2 ... e recupera sozinho quando o arquivo libera', st(pg) == 'folder' and data(pg).get('searchHist') == ['teimoso'], [st(pg), data(pg).get('searchHist')])
    # 1d) permissão retirada -> needperm
    pg.evaluate("localStorage.setItem('fakefs.flaky','1'); localStorage.setItem('fakefs.flakyname','NotAllowedError')"); setv(pg, ['perm']); pg.wait_for_timeout(600)
    ck('1 NotAllowedError: needperm (pede clique)', st(pg) == 'needperm', st(pg))
    pg.evaluate("localStorage.removeItem('fakefs.flakyname')")
    # 3) rascunhos com menos gravações
    cx2 = ctx(b); pg = page(cx2); connect(pg)
    pg.click('[data-exam]'); pg.wait_for_timeout(600); pg.dblclick('[data-model]'); pg.wait_for_timeout(1500)
    pg.evaluate("localStorage.setItem('fakefs.wc','{}')"); pg.click('#editor'); pg.keyboard.press('Control+End')
    for k in range(8): pg.keyboard.type('x'); pg.wait_for_timeout(120)
    wc = lambda: sum(v for k, v in json.loads(pg.evaluate("localStorage.getItem('fakefs.wc')") or '{}').items() if k.startswith('/rascunhos/'))
    n1 = wc()
    ck('3 rascunho: no máximo 1 gravação por intervalo enquanto digita', n1 <= 1, n1)
    draft = lambda: pg.evaluate("(function(){var i,k,o='';for(i=0;i<localStorage.length;i++){k=localStorage.key(i);if(k.indexOf('draft.')>=0&&k.indexOf('fakefs')<0)o+=localStorage.getItem(k)}return o})()")
    pg.wait_for_timeout(800)
    ck('3 navegador continua salvando como antes (≤0,7 s)', 'xxxxxxxx' in (draft() or ''))
    ck('3 ... ainda no máximo 1 gravação na pasta', wc() <= 1, wc())
    pg.wait_for_timeout(1300)
    fd = [v['t'] for k, v in files(pg).items() if k.startswith('/rascunhos/')]
    ck('3 a gravação adiada leva o texto final', any('xxxxxxxx' in t for t in fd), fd)
    pg.keyboard.type('YZ'); pg.wait_for_timeout(150); pg.evaluate("window.dispatchEvent(new Event('pagehide'))"); pg.wait_for_timeout(300)
    fd = [v['t'] for k, v in files(pg).items() if k.startswith('/rascunhos/')]
    ck('3 ao sair da aba (pagehide) grava na hora', any('xxxxxxxxYZ' in t for t in fd), fd)
    # 5) duas abas gravando dados.json ao mesmo tempo
    for nl in (False, True):
        cx3 = ctx(b, nl); a = page(cx3); connect(a); a2 = page(cx3, False); a2.wait_for_timeout(800); a2.evaluate("UFolder._timing([100, 200, 300], 400, 1000)")
        a.evaluate("localStorage.setItem('fakefs.delay','150')")
        a.evaluate("UStore.set('searchHist', ['aba1'])"); a2.evaluate("UStore.set('usage', {'z': 1})"); a.wait_for_timeout(1500)
        ck('5 duas abas %s: nenhuma cai em error' % ('sem navigator.locks' if nl else 'com navigator.locks'), st(a) == 'folder' and st(a2) == 'folder', [st(a), st(a2)])
        ck('5 ... dados.json válido', bool(data(a)))
        if not nl: ck('5 navigator.locks disponível no teste', a.evaluate("!!(navigator.locks && navigator.locks.request)"))
    ck('sem erros de script', not ERR, ERR[:3])
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
