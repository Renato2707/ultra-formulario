"""C6o: templates intermediarios (texto puro colado de outro sistema vira campos), cartoes "(padrao)" destacados,
Tab/Enter na revisao (campos ja preenchidos) e "Editar banco" grava/carrega na pasta de dados.
Uso: python test/c6o_test.py
O item 1 usa o banco real do usuario SO se UF_BANCO apontar para ele (fora do repo; nada do conteudo e impresso);
sem ele, usa o banco de teste proprio. Opcional: UF_INTER = arquivo templates-intermediarios.txt para conferir."""
import os, sys, json, shutil, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
FAKE = open(os.path.join(HERE, 'fakefs.js'), encoding='utf-8').read()
NAMES = ['Transvaginal (padrão)', 'Transvaginal Obstétrica (padrão)', 'Obstétrica de 1º Trimestre (padrão)',
         'Obstétrica de 2º ou 3º Trimestre (padrão)', 'Doppler de Fluxo Obstétrico (padrão)']
OWN = '''@@EXAME Transvaginal
@@EXAME_FULL ULTRASSONOGRAFIA TRANSVAGINAL
@@TEMPLATE Transvaginal (padrão)
ULTRASSONOGRAFIA TRANSVAGINAL
Útero posicionado em ?[anteversoflexão|retroflexão|postura intermediária].
Dimensões medindo cerca de * x * x * mm (LxAPxT).
Volume estimado em cerca de * cm³.
Endométrio medindo cerca de *,* mm de espessura.

@@TEMPLATE Transvaginal variante
ULTRASSONOGRAFIA TRANSVAGINAL
Texto variante.

##SECTION ÚTERO

Útero normal (padrão) [Normal]:
Útero de aspecto normal.

Mioma [Mioma]:
Nódulo medindo * mm.

@@EXAME Transvaginal Obstétrica
@@TEMPLATE Transvaginal Obstétrica (padrão)
TRANSVAGINAL OBSTETRICA
?[Embrião|Feto] ?[identificado, com batimentos cardíacos detectados (* bpm).|não identificado.]
Saco gestacional com diâmetro médio de * mm.

@@EXAME Obstétrica de 1º Trimestre
@@TEMPLATE Obstétrica de 1º Trimestre (padrão)
OBSTETRICA 1 TRI
***Translucência nucal mede cerca de * mm.

@@EXAME Obstétrica de 2º ou 3º Trimestre
@@TEMPLATE Obstétrica de 2º ou 3º Trimestre (padrão)
OBSTETRICA 2 3 TRI
Feto único em situação ?[longitudinal|transversa], apresentação ?[cefálica|pélvica|córmica].
    • Diâmetro biparietal (DBP): * mm.

@@EXAME Doppler de Fluxo Obstétrico
@@TEMPLATE Doppler de Fluxo Obstétrico (padrão)
DOPPLER
- Índice de pulsatilidade (IP): *

'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
TMP = tempfile.mkdtemp()
def tmpbank(text=None, src=None):
    path = os.path.join(TMP, 'b%d.txt' % len(os.listdir(TMP)))
    if src: shutil.copyfile(src, path)
    else: open(path, 'wb').write(text.replace('\n', '\r\n').encode('utf-8'))
    return path
ERR = []
def page(b, bank, init=None):
    cx = b.new_context(viewport={'width': 1400, 'height': 900})
    if init: cx.add_init_script(init)
    pg = cx.new_page(); pg.set_default_timeout(6000); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', bank); pg.wait_for_timeout(700)
    return cx, pg
def paste(pg, text):
    pg.evaluate("""(t) => { var e = document.getElementById('editor'); e.innerHTML = '<div><br></div>'; e.focus(); var r = document.createRange(); r.setStart(e.firstChild, 0); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      var dt = new DataTransfer(); dt.setData('text/plain', t); e.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""", text)
    pg.wait_for_timeout(300)
# in-page helpers: template body, intermediate text, filled text and the expected fields (lines the app recognizes)
JS_PREP = r'''(names) => {
  var S = UFTest.S, out = [];
  function fill(t, pick, acc) {   /* text as an assistant would leave it: one option chosen, numbers typed */
    var fs = UltraParser.fieldsOf(t), o = '', pos = 0, i, f;
    for (i = 0; i < fs.length; i++) { f = fs[i]; if (f.offset < pos) { continue; } o += t.substring(pos, f.offset);
      if (f.type === 'select') { var k = pick % f.options.length; acc.sel++; o += fill(f.options[k], pick, acc); }
      else if (f.decimal) { acc.num.push('8,5'); o += '8,5'; } else if (f.type === 'text') { acc.txt++; o += 'abc'; } else { var v = String(11 + acc.num.length); acc.num.push(v); o += v; }
      pos = f.offset + f.raw.length; }
    return o + t.substring(pos);
  }
  function count(t, acc) { var fs = UltraParser.fieldsOf(t), i; for (i = 0; i < fs.length; i++) { if (fs[i].type === 'select') { acc.sel++; } else { acc.n++; } } }
  names.forEach(function (n) { S.bank.exams.forEach(function (e) { e.templates.forEach(function (t) { if (t.name !== n) { return; }
    var body = String(t.body).replace(/\r/g, ''), ls = body.split('\n'), inter = [], f0 = [], f1 = [], e0 = { num: [], sel: 0, txt: 0 }, e1 = { num: [], sel: 0, txt: 0 }, ei = { n: 0, sel: 0 }, j, l, lit;
    for (j = 0; j < ls.length; j++) { l = ls[j];
      lit = l.replace(/^\s*[\u2022\-\u2013]\s*/, '').replace(/\?\+?\[[^\]]*\]|\*/g, '').replace(/[^A-Za-z\u00c0-\u00ff]/g, '');
      var rec = /\?\+?\[|\*/.test(l) && lit.length >= 4, a0 = { num: [], sel: 0, txt: 0 }, a1 = { num: [], sel: 0, txt: 0 }, ai = { n: 0, sel: 0 };
      inter.push(UFTest.interText(l)); f0.push(fill(l, 0, a0)); f1.push(fill(l, 1, a1)); count(l, ai);
      if (rec) { e0.num = e0.num.concat(a0.num); e1.num = e1.num.concat(a1.num); ei.n += ai.n; ei.sel += ai.sel; }
    }
    out.push({ name: n, inter: inter.join('\n'), f0: f0.join('\n'), f1: f1.join('\n'), e0: e0.num, e1: e1.num, ei: ei, hasField: /\?\[|\*/.test(body) });
  }); }); });
  return out;
}'''
NUMS = "[].filter.call(document.querySelectorAll('#editor .fld'), function (f) { var t = f.getAttribute('data-t'); return t === 'n' || t === 'd'; }).map(function (f) { return f.textContent; })"
EMPTY = "({ n: [].filter.call(document.querySelectorAll('#editor .fld'), function (f) { return f.getAttribute('data-t') !== 's' && f.className.indexOf('f-ok') < 0; }).length, sel: document.querySelectorAll('#editor .fld[data-t=s]:not(.f-ok)').length })"
def edtext(pg): return pg.evaluate("[].filter.call(document.querySelectorAll('#editor div'), function (d) { return !d.querySelector('div'); }).map(function (d) { return d.textContent; }).join('\\n')")
import re
def nonum(t): return re.sub(r'# semanas e # dias', '# semanas', re.sub(r'\d+(?:,\d+)?', '#', t))   # calculators may complete the IG
def missing(exp, got):   # typed values not found (the app recalculates the volume itself)
    g = list(got); n = 0
    for v in exp:
        if v in g: g.remove(v)
        else: n += 1
    return n
CALC = re.compile(r'cm³|Peso fetal|Relação: IP|Biometria Fetal Composta')   # values the app recalculates itself (volume, PFE, AU/ACM, IG)
def nvol(t): return sum(1 for l in t.split('\n') if CALC.search(l) and re.search(r'\d', l))
REAL = os.environ.get('UF_BANCO')
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- 1) templates intermediarios ----------
    for label, bank in ([('banco real', tmpbank(src=REAL))] if REAL and os.path.exists(REAL) else []) + [('banco de teste', tmpbank(OWN))]:
        cx, pg = page(b, bank)
        tp = pg.evaluate(JS_PREP, NAMES)
        ck('1 [%s] os 5 modelos "(padrão)" existem' % label, [t['name'] for t in tp] == NAMES, [t['name'] for t in tp])
        if label == 'banco real':
            iss = pg.evaluate("UFTest.allIssues().filter(function (i) { return i.severity !== 'info'; }).map(function (i) { return i.line + ':' + i.type; })")
            print('INFO [banco real] erros/avisos do parser (linha:tipo): ' + (', '.join(iss) if iss else 'nenhum'))
            inf = os.environ.get('UF_INTER')
            if inf and os.path.exists(inf):
                want = ''.join('==================== %s ====================\n%s\n\n' % (t['name'], '\n'.join(l.rstrip() for l in t['inter'].split('\n')).strip('\n')) for t in tp).rstrip('\n') + '\n'
                ck('1 templates-intermediarios.txt = gerado do banco atual', open(inf, encoding='utf-8').read() == want)
        for t in tp:
            nm = t['name']
            bad = [c for c in ('?[', '?+[', '*', '@@', '##', '|') if c in t['inter']]
            ck('1 [%s] %s: intermediário sem marcação do banco' % (label, nm), not bad, bad)
            paste(pg, t['inter']); em = pg.evaluate(EMPTY)
            ck('1 [%s] %s: intermediário em branco colado vira campos vazios (%d num, %d escolhas)' % (label, nm, t['ei']['n'], t['ei']['sel']),
               em['n'] == t['ei']['n'] and em['sel'] == t['ei']['sel'] and len(edtext(pg).split('\n')) == len(t['inter'].split('\n')), [em, t['ei']])
            for k in ('0', '1'):
                paste(pg, t['f' + k]); got = pg.evaluate(NUMS)
                ck('1 [%s] %s: laudo preenchido (opção %s) colado: %d medidas viram campos, texto igual' % (label, nm, k, len(t['e' + k])),
                   len(got) >= len(t['e' + k]) and missing(t['e' + k], got) <= nvol(t['f' + k]) and nonum(edtext(pg)) == nonum(t['f' + k]) and pg.evaluate(EMPTY)['n'] == 0, [len(got), len(t['e' + k])])
        cx.close()
    # ---------- 2) cartoes "(padrao)" ----------
    own = tmpbank(OWN)
    cx, pg = page(b, own)
    pg.click('[data-exam="Transvaginal"]'); pg.wait_for_timeout(400)
    info = pg.evaluate("""[].map.call(document.querySelectorAll('#navList [data-model]'), function (c) { var s = getComputedStyle(c); return [c.textContent, c.className.indexOf(' pad') >= 0, parseFloat(s.borderLeftWidth), parseFloat(s.marginBottom)]; })""")
    pad = [i for i in info if '(padrão)' in i[0]]; var = [i for i in info if '(padrão)' not in i[0]]
    ck('2 cartão de modelo "(padrão)" com classe pad, borda e espaço maiores que o variante', pad and var and pad[0][1] and not var[0][1] and pad[0][2] > var[0][2] and pad[0][3] > var[0][3], info)
    txt0 = pg.inner_text('#navList')
    ck('2 nenhum texto novo nos cartões', '\n'.join(i[0] for i in info).replace('Transvaginal (padrão)', '').replace('Transvaginal variante', '').strip() == '', info)
    pg.click('[data-go="3"]'); pg.wait_for_timeout(400)
    pg.evaluate("(function(){var s=document.querySelectorAll('#navList [data-sec]'); for(var i=0;i<s.length;i++){ if(s[i].getAttribute('aria-expanded')!=='true') s[i].click(); }})()"); pg.wait_for_timeout(300)
    ph = pg.evaluate("[].map.call(document.querySelectorAll('#navList .pcard'), function (c) { return [c.querySelector('.ph1').textContent, c.className.indexOf(' pad') >= 0]; })")
    ck('2 cartão de frase "(padrão)" destacado; frase variante não', any(x[1] for x in ph if '(padrão)' in x[0]) and not any(x[1] for x in ph if '(padrão)' not in x[0]), ph)
    cx.close()
    # ---------- 3) Tab/Enter na revisao ----------
    cx, pg = page(b, own)
    pg.click('[data-exam="Transvaginal"]'); pg.wait_for_timeout(400); pg.locator('[data-model]').first.dblclick(); pg.wait_for_timeout(400)
    def cur(): return pg.evaluate("(function(){var s=getSelection(); if(!s.rangeCount) return -1; var r=s.getRangeAt(0), a=[].slice.call(document.querySelectorAll('#editor .fld')), i; for(i=0;i<a.length;i++){ if(a[i].contains(r.startContainer) || (r.startContainer.childNodes && r.startContainer.childNodes[r.startOffset]===a[i])) return i; } return -1;})()")
    def flds(): return pg.evaluate("[].map.call(document.querySelectorAll('#editor .fld'), function (f) { return f.textContent; })")
    n = len(flds())
    pg.evaluate("(function(){var a=document.querySelectorAll('#editor .fld[data-t=n],#editor .fld[data-t=d]'), i; for(i=0;i<a.length;i++){ a[i].textContent = String(20+i); } })()")
    pg.locator('#editor .fld[data-t=s]').first.click(); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)   # choose in the list
    pg.evaluate("UFTest.S && 0"); pg.wait_for_timeout(100)
    unf = pg.evaluate("document.querySelectorAll('#editor .fld:not(.f-ok)').length")
    ck('3 preparação: todos os campos preenchidos', unf == 0, unf)
    pg.evaluate("(function(){var f=document.querySelectorAll('#editor .fld')[1]; var r=document.createRange(); r.selectNodeContents(f); document.getElementById('editor').focus(); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    pg.keyboard.press('Tab'); pg.wait_for_timeout(150)
    ck('3 Tab vai para o próximo campo já preenchido', cur() == 2, cur())
    sel = pg.evaluate("getSelection().toString()")
    ck('3 conteúdo do campo selecionado para sobrescrever', sel == flds()[2], [sel])
    pg.keyboard.type('77'); pg.wait_for_timeout(150)
    ck('3 digitar sobrescreve o valor (campo continua campo)', flds()[2] == '77' and len(flds()) == n, flds())
    pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    ck('3 Enter vai para o próximo campo preenchido', cur() == 3, cur())
    pg.keyboard.press('Shift+Tab'); pg.wait_for_timeout(150)
    ck('3 Shift+Tab volta ao campo anterior', cur() == 2, cur())
    pg.evaluate("(function(){var a=document.querySelectorAll('#editor .fld'); var f=a[a.length-1]; var r=document.createRange(); r.selectNodeContents(f); document.getElementById('editor').focus(); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    ck('3 Enter no último campo: não volta ao início (como antes)', cur() != 0 and flds() and len(flds()) == n, cur())
    pg.evaluate("(function(){var f=document.querySelectorAll('#editor .fld[data-t=n]')[2]; f.textContent='___'; })()")
    pg.evaluate("(function(){var f=document.querySelectorAll('#editor .fld')[1]; var r=document.createRange(); r.selectNodeContents(f); document.getElementById('editor').focus(); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    pg.keyboard.press('Tab'); pg.wait_for_timeout(150)
    ck('3 com campo vazio: Tab continua indo ao vazio (como antes)', cur() == 3, cur())
    cx.close()
    # ---------- 4) Editar banco -> pasta de dados ----------
    def files(pg): return json.loads(pg.evaluate("localStorage.getItem('fakefs.files')") or '{}')
    def bankfile(pg): return (files(pg).get('/banco-de-frases.txt') or {}).get('t') or ''
    def edit(pg, a, z):
        pg.click('#btnSettings'); pg.wait_for_timeout(300); pg.click('#stBankEdit'); pg.wait_for_timeout(300)
        pg.evaluate("(a) => { var t = document.getElementById('beTxt'); t.value = t.value.replace(a[0], a[1]); t.dispatchEvent(new Event('input', {bubbles: true})); }", [a, z])
        pg.click('#beSave'); pg.wait_for_timeout(700)
    def loaded(pg): return pg.evaluate("UFTest.S.srcLines.join('\\n')")
    cx, pg = page(b, own, FAKE)
    pg.evaluate("new Promise(function(ok){UFolder.useHandle(__fakeRoot(), function(){ok();});})"); pg.wait_for_timeout(500)
    edit(pg, 'Texto variante.', 'Texto variante EDITADO.')
    ck('4 pasta conectada: banco editado gravado em banco-de-frases.txt', 'EDITADO' in bankfile(pg))
    ck('4 banco editado aplicado na hora', 'EDITADO' in loaded(pg))
    ck('4 cópia do banco anterior em backups/', any(k.startswith('/backups/') for k in files(pg)), list(files(pg)))
    pg.reload(); pg.wait_for_timeout(1500)
    ck('4 abrir de novo: carrega o banco editado da pasta', 'EDITADO' in loaded(pg) and pg.evaluate('UFolder.status()') == 'folder')
    pg.evaluate("localStorage.setItem('fakefs.perm','prompt')"); pg.reload(); pg.wait_for_timeout(1200)
    ck('4 pasta desconectada (pede permissão)', pg.evaluate('UFolder.status()') == 'needperm')
    edit(pg, 'Texto variante EDITADO.', 'Texto variante OFFLINE.')
    ck('4 desconectada: aplicado na hora, pasta ainda sem a edição', 'OFFLINE' in loaded(pg) and 'OFFLINE' not in bankfile(pg))
    pg.evaluate("new Promise(function(ok){UFolder.reconnect(function(){ok();});})"); pg.wait_for_timeout(800)
    ck('4 ao reconectar: banco editado vai para a pasta (não é perdido)', 'OFFLINE' in bankfile(pg), bankfile(pg)[-80:])
    pg.reload(); pg.wait_for_timeout(1500)
    ck('4 abrir de novo: banco editado offline continua', 'OFFLINE' in loaded(pg))
    # loading late folder: edit while folder still unknown, then boot ready
    cx.close()
    cx, pg = page(b, own)
    ck('4 sem pasta: editar banco continua só no navegador', (edit(pg, 'Texto variante.', 'Texto variante NAV.') or True) and 'NAV' in loaded(pg) and 'NAV' in (pg.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).filter(function(k){return /bank$/.test(k) && !/Backup/.test(k);})[0])).text") or ''))
    pg.reload(); pg.wait_for_timeout(800)
    ck('4 sem pasta: recarregar mantém o banco editado', 'NAV' in loaded(pg))
    cx.close()
    b.close()
shutil.rmtree(TMP, True)
ck('sem erros de página', not ERR, ERR)
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
