"""D3: automated checks for the review fixes (generic bank embedded, no real phrases, no personal data).
Usage: python test/d3_test.py   (needs playwright + chromium; uses test/fakefs.js = simulated data folder)"""
import os, sys, json, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
FAKE = open(os.path.join(HERE, 'fakefs.js'), encoding='utf-8').read()
BANK = '''@@EXAME Exame Teste
@@EXAME_FULL EXAME TESTE
@@TEMPLATE Padrão
EXAME TESTE
Relatório:

Linha alfa do modelo.

Linha beta do modelo.

Hipótese diagnóstica:
Texto padrão.

##SECTION ALFA
@@SUBSTITUI = Linha alfa

Alfa simples:
FRASE-ALFA texto genérico.

Alfa com hipótese [Hipótese genérica]:
FRASE-HIP texto genérico.

##SECTION BETA
@@ABAIXO_DE = Linha beta

Beta crítica:
***Linha crítica genérica um.
***Linha crítica genérica dois.

Beta crítica com campo:
***Linha crítica genérica com valor * mm.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
def bankfile(text, nl):
    f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(text.replace('\n', nl).encode('utf-8')); f.close(); return f.name
LF = bankfile(BANK, '\n'); CRLF = bankfile(BANK, '\r\n')
def fresh(c, bank=CRLF):
    pg = c.new_page(); pg.set_default_timeout(6000); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', bank); pg.wait_for_timeout(300); return pg
def model(pg):
    pg.click('[data-exam]'); pg.wait_for_timeout(700); pg.dblclick('[data-model]'); pg.wait_for_timeout(400)
def ins(pg, title):
    pg.evaluate('''(t) => { var T = UFTest, S = T.S, secs = T.examSections('Exame Teste'), i, j;
      for (i = 0; i < secs.length; i++) { for (j = 0; j < secs[i].cards.length; j++) { var c = secs[i].cards[j]; if (c.ph.title === t) { c.dispSec = secs[i].name; S.phraseIndex[c.id] = c; T.insertCard(c.id); } } } }''', title)
    pg.wait_for_timeout(200)
txt = lambda pg: pg.evaluate('UFTest.reportText()')
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 1400, 'height': 900}, permissions=['clipboard-read', 'clipboard-write'])
    # ---- 2. undo: one Ctrl+Z per phrase, hypothesis included, no blank line left
    pg = fresh(c); model(pg); t0 = txt(pg)
    ins(pg, 'Alfa simples'); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    ck('1 Ctrl+Z desfaz frase (texto idêntico ao anterior)', txt(pg) == t0, txt(pg))
    pg.keyboard.press('Control+y'); pg.wait_for_timeout(200); ck('Ctrl+Y refaz a frase', 'FRASE-ALFA' in txt(pg))
    pg.keyboard.press('Control+z'); ins(pg, 'Alfa com hipótese'); t1 = txt(pg)
    ck('frase com hipótese insere a hipótese', 'Hipótese genérica' in t1, t1)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    ck('1 Ctrl+Z desfaz frase + hipótese', txt(pg) == t0, txt(pg))
    ins(pg, 'Alfa simples'); t2 = txt(pg); ins(pg, 'Beta crítica')
    pg.click('[data-cmd=undo]'); pg.wait_for_timeout(200); ck('botão Desfazer: 1 passo', txt(pg) == t2, txt(pg))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); ck('2 frases = 2 Ctrl+Z', txt(pg) == t0, txt(pg))
    # ---- 5a. editing a critical line does not count as reviewed; editing a confirmed one reopens it
    ins(pg, 'Beta crítica'); n0 = pg.evaluate('UFTest.critState().pend.length')
    pg.evaluate("(function(){var l=document.querySelector('#editor .crit'); var r=document.createRange(); r.selectNodeContents(l); r.collapse(false); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    pg.keyboard.type(' editada'); pg.wait_for_timeout(300)
    ck('linha crítica editada continua pendente', pg.evaluate('UFTest.critState().pend.length') == n0 == 2, (n0, pg.evaluate('UFTest.critState().pend.length')))
    ev = pg.evaluate; ev("navigator.clipboard.writeText('VAZIO')")
    pg.click('#btnCopy'); pg.wait_for_timeout(200); pg.click('[data-a=ok]'); pg.wait_for_timeout(300)
    ck('sem campos: confirmar o bloco copia direto', 'Linha crítica genérica um. editada' in ev('navigator.clipboard.readText()'))
    pg.evaluate("(function(){var l=document.querySelector('#editor .crit'); var r=document.createRange(); r.selectNodeContents(l); r.collapse(false); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    pg.keyboard.type(' de novo'); pg.wait_for_timeout(300)
    ck('linha confirmada e depois alterada volta a ficar pendente', ev('UFTest.critState().pend.length') == 1, ev('UFTest.critState().pend.length'))
    # ---- 3. "Copiar assim mesmo" available right after the critical lines (one click)
    pg2 = fresh(c); model(pg2); ins(pg2, 'Beta crítica com campo'); pg2.evaluate("navigator.clipboard.writeText('VAZIO')")
    pg2.click('#btnCopy'); pg2.wait_for_timeout(200)
    ck('"assim mesmo" bloqueado enquanto há crítica pendente', pg2.locator('[data-a=anyway]').is_disabled())
    pg2.click('[data-a=ok]'); pg2.wait_for_timeout(200)
    ck('após a crítica, "Copiar assim mesmo" liberado na mesma janela', pg2.is_visible('#modalBack') and not pg2.locator('[data-a=anyway]').is_disabled())
    ck('nada copiado antes da escolha', pg2.evaluate('navigator.clipboard.readText()') == 'VAZIO')
    pg2.click('[data-a=anyway]'); pg2.wait_for_timeout(300)
    ck('1 clique em "Copiar assim mesmo" copia', 'valor ___ mm' in pg2.evaluate('navigator.clipboard.readText()'), pg2.evaluate('navigator.clipboard.readText()'))
    pg2.close(); pg.close()
    # ---- 4d. bank editor keeps line endings
    for nl, f in (('\r\n', CRLF), ('\n', LF)):
        pg = fresh(c, f); pg.click('#btnSettings'); pg.click('#stBankEdit'); pg.wait_for_timeout(200)
        pg.click('#beTxt'); pg.keyboard.press('Control+End'); pg.keyboard.type('\nNova frase:\nTexto novo.\n'); pg.keyboard.press('Control+s'); pg.wait_for_timeout(300)
        t = pg.evaluate("JSON.parse(localStorage.getItem('uf.bank')).text")
        good = ('\r\n' in t and t.replace('\r\n', '').find('\n') < 0) if nl == '\r\n' else ('\r' not in t)
        ck('editor preserva final de linha ' + ('CRLF' if nl == '\r\n' else 'LF'), good and 'Texto novo.' in t)
        pg.close()
    one = bankfile('@@EXAME Exame Teste', '\n')
    pg = fresh(c, one); pg.click('#btnSettings'); pg.click('#stBankEdit'); pg.wait_for_timeout(200)
    pg.click('#beTxt'); pg.keyboard.press('Control+End'); pg.keyboard.type('\n@@TEMPLATE M\nTEXTO\n'); pg.keyboard.press('Control+s'); pg.wait_for_timeout(300)
    t = pg.evaluate("JSON.parse(localStorage.getItem('uf.bank')).text"); ck('banco sem quebras ganha CRLF', '\r\n' in t and t.replace('\r\n', '').find('\n') < 0, repr(t)); pg.close()
    c.close()
    # ---- folder-based checks (simulated folder)
    def fc(slow=False):
        cx = b.new_context(viewport={'width': 1400, 'height': 900}); cx.add_init_script(FAKE)
        cx.add_init_script("window.showDirectoryPicker = function () { return Promise.resolve(__fakeRoot()); };")
        return cx
    files = lambda pg: pg.evaluate("JSON.parse(localStorage.getItem('fakefs.files')||'{}')")
    def connect(pg):
        pg.evaluate("new Promise(function(ok){UFolder.useHandle(__fakeRoot(), function(){ok();});})"); pg.wait_for_timeout(600)
    # 4c. Escolher pasta / Apagar rascunhos save the settings first
    cx = fc(); pg = fresh(cx)
    pg.click('#btnSettings'); pg.check('#st_showUsage'); pg.click('#stPick'); pg.wait_for_timeout(800)
    st = pg.evaluate("JSON.parse(localStorage.getItem('uf.settings')).showUsage")
    ck('"Escolher pasta" salva as configurações antes', st is True and pg.evaluate('UFolder.status()') == 'folder', (st, pg.evaluate('UFolder.status()')))
    ck('... e elas vão para a pasta', json.loads(files(pg)['/configuracoes.json']['t']).get('showUsage') is True)
    if not pg.is_visible('#modalBack'): pg.click('#btnSettings')
    pg.check('#st_sortByUsage'); pg.click('#stDrafts'); pg.wait_for_timeout(300)
    ck('"Apagar rascunhos" salva as configurações antes', pg.evaluate("JSON.parse(localStorage.getItem('uf.settings')).sortByUsage") is True)
    ck('... e o diálogo deixa de mostrar "Alterações não salvas"', not pg.is_visible('#stDirty'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    ck('fechar depois disso não desfaz o que foi salvo', pg.evaluate("JSON.parse(localStorage.getItem('uf.settings')).sortByUsage") is True)
    # 5b. another open tab respects "Apagar rascunhos"
    model(pg); p2 = cx.new_page(); p2.set_default_timeout(6000); p2.goto(IDX); p2.wait_for_timeout(700)
    p2.click('#editor'); p2.keyboard.type('RASCUNHO-ABA-2 generico'); p2.wait_for_timeout(1200)
    t2 = p2.evaluate("sessionStorage.getItem('uf.tab')")
    ck('aba 2 tem rascunho', p2.evaluate("!!localStorage.getItem('uf.draft.' + sessionStorage.getItem('uf.tab'))"))
    pg.bring_to_front(); pg.click('#btnSettings'); pg.click('#stDrafts'); pg.wait_for_timeout(800); pg.keyboard.press('Escape')
    p2.bring_to_front(); p2.wait_for_timeout(300)
    ck('aba 2 avisa (barrinha) e mantém o laudo na tela', p2.is_visible('#fbar') and 'Rascunhos apagados' in p2.inner_text('#fbar') and 'RASCUNHO-ABA-2' in p2.evaluate('UFTest.reportText()'))
    p2.evaluate("window.dispatchEvent(new Event('pagehide'))"); p2.wait_for_timeout(1000)
    ck('aba 2 não regrava o rascunho (navegador e pasta)', p2.evaluate("localStorage.getItem('uf.draft.%s')" % t2) is None and ('/rascunhos/%s.json' % t2) not in files(p2), [k for k in files(p2) if 'rasc' in k])
    p2.click('#editor'); p2.keyboard.press('End'); p2.keyboard.type(' mais'); p2.wait_for_timeout(1200)
    ck('editar de novo na aba 2 volta a guardar (como diz o aviso)', p2.evaluate("!!localStorage.getItem('uf.draft.%s')" % t2))
    p2.close()
    # 4b. browser storage full: folder gets the NEW value, discreet notice
    pg.evaluate("""(function(){ var o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'uf.settings' && window.__full) { var e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } return o.apply(this, arguments); }; window.__full = true; })()""")
    pg.click('#btnSettings'); pg.uncheck('#st_showUsage'); pg.click('#stSave'); pg.wait_for_timeout(900)
    conf = json.loads(files(pg)['/configuracoes.json']['t'])
    ck('localStorage cheio: pasta recebe o valor NOVO', conf.get('showUsage') is False, conf.get('showUsage'))
    ck('localStorage cheio: aviso discreto', 'sem espaço' in pg.inner_text('#toast'), pg.inner_text('#toast'))
    pg.evaluate('window.__full = false')
    ck('sem erros de script (pasta)', not pg.errs, pg.errs)
    # 4a. folder read slower than 4 s: the screen is refreshed when it ends, nothing lost
    f = files(pg); f['/configuracoes.json']['t'] = json.dumps(dict(json.loads(f['/configuracoes.json']['t']), theme='dark'))
    f['/banco-de-frases.txt']['t'] = BANK + '\n##SECTION NOVA DA PASTA\nNova da pasta:\nFRASE-PASTA.\n'
    f['/banco-de-frases.txt']['m'] = 1
    pg.evaluate("(f) => { localStorage.setItem('fakefs.files', JSON.stringify(f)); localStorage.setItem('fakefs.readdelay', '5500'); }", f)
    ph0 = pg.evaluate('UFTest.S.bank.stats.phrases'); pg.reload(); pg.wait_for_timeout(4500)
    ck('pasta lenta: app abre em até 4 s com a cópia do navegador', pg.evaluate('UFolder.status()') == 'loading' and pg.evaluate('UFTest.S.bank.stats.phrases') == ph0, pg.evaluate('UFolder.status()'))
    pg.click('#editor'); pg.keyboard.press('Control+End'); pg.keyboard.type(' DIGITADO-DURANTE-LEITURA'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(3500)
    ck('pasta lenta: ao terminar, estado conectado', pg.evaluate('UFolder.status()') == 'folder', pg.evaluate('UFolder.status()'))
    ck('pasta lenta: tela atualizada (banco e tema da pasta)', pg.evaluate('UFTest.S.bank.stats.phrases') == ph0 + 1 and 'theme-dark' in pg.evaluate('document.body.className'))
    ck('pasta lenta: o que foi digitado durante a leitura continua na tela', 'DIGITADO-DURANTE-LEITURA' in txt(pg))
    pg.wait_for_timeout(1200)
    tab = pg.evaluate("sessionStorage.getItem('uf.tab')")
    ck('pasta lenta: rascunho com o texto digitado gravado na pasta', 'DIGITADO-DURANTE-LEITURA' in files(pg).get('/rascunhos/%s.json' % tab, {}).get('t', ''))
    ck('sem erros de script (pasta lenta)', not pg.errs, pg.errs)
    b.close()
print('RESUMO', sum(R), '/', len(R))
