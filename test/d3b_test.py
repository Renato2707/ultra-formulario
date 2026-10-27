"""D3b: bank editor keeps the original line ending (CRLF, LF, CR-only; CRLF when none).
Generic bank embedded, no real phrases, no personal data. Usage: python test/d3b_test.py"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
FAKE = open(os.path.join(HERE, 'fakefs.js'), encoding='utf-8').read()
BANK = '@@EXAME Exame Teste\n@@TEMPLATE Padrão\nEXAME TESTE\nLinha alfa.\n\n##SECTION ALFA\n\nAlfa simples:\nFRASE-ALFA texto genérico.\n'
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + repr(i)[:300])); sys.stdout.flush()
def bankfile(text):
    f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(text.encode('utf-8')); f.close(); return f.name
def kind(t):
    if '\r\n' in t: return 'CRLF' if t.replace('\r\n', '').find('\r') < 0 and t.replace('\r\n', '').find('\n') < 0 else 'misto'
    if '\n' in t: return 'LF' if '\r' not in t else 'misto'
    return 'CR' if '\r' in t else 'nenhum'
def edit(pg):
    pg.click('#btnSettings'); pg.click('#stBankEdit'); pg.wait_for_timeout(200)
    pg.click('#beTxt'); pg.keyboard.press('Control+End'); pg.keyboard.type('\nNova frase:\nTexto novo.\n'); pg.keyboard.press('Control+s'); pg.wait_for_timeout(400)
CASES = [('CRLF', BANK.replace('\n', '\r\n'), 'CRLF'), ('LF', BANK, 'LF'), ('CR', BANK.replace('\n', '\r'), 'CR'), ('sem quebras', '@@EXAME Exame Teste', 'CRLF')]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, text, want in CASES:
        c = b.new_context(); pg = c.new_page(); pg.set_default_timeout(6000); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(IDX); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
        pg.set_input_files('#bankFile0', bankfile(text)); pg.wait_for_timeout(300); edit(pg)
        t = pg.evaluate("JSON.parse(localStorage.getItem('uf.bank')).text")
        ck('navegador: banco %s salvo como %s' % (name, want), kind(t) == want and 'Texto novo.' in t, t)
        if name != 'sem quebras': ck('navegador: texto original intacto (%s)' % name, t.startswith(text), t)
        ck('sem erros JS (%s)' % name, not errs, errs); c.close()
    # data-folder mode, CR-only: file written keeps CR; backup keeps old bytes
    c = b.new_context(); c.add_init_script(FAKE); c.add_init_script("window.showDirectoryPicker = function () { return Promise.resolve(__fakeRoot()); };")
    pg = c.new_page(); pg.set_default_timeout(6000); pg.goto(IDX); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.evaluate("new Promise(function(ok){UFolder.useHandle(__fakeRoot(), function(){ok();});})"); pg.wait_for_timeout(600)
    cr = BANK.replace('\n', '\r'); pg.set_input_files('#bankFile0', bankfile(cr)); pg.wait_for_timeout(600)
    f = pg.evaluate("JSON.parse(localStorage.getItem('fakefs.files')||'{}')")
    bk = [v['t'] for k, v in f.items() if k.endswith('banco-de-frases.txt') and isinstance(v, dict)]
    ck('pasta: arquivo carregado gravado byte a byte (CR)', cr in bk, list(f.keys()))
    edit(pg); f = pg.evaluate("JSON.parse(localStorage.getItem('fakefs.files')||'{}')")
    bk = [v['t'] for k, v in f.items() if k.endswith('banco-de-frases.txt') and isinstance(v, dict)]
    ck('pasta: banco editado continua só CR', bk and kind(bk[0]) == 'CR' and 'Texto novo.' in bk[0], bk)
    olds = [v['t'] for k, v in f.items() if k != [x for x in f if x.endswith('banco-de-frases.txt')][0] and isinstance(v, dict) and v.get('t') == cr]
    ck('pasta: backup guarda o banco antigo byte a byte', len(olds) >= 1, list(f.keys()))
    c.close(); b.close()
print('%d/%d PASS' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
