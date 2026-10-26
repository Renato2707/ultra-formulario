"""Automated placement test: every exam x template x section -> insert 1st phrase into a fresh template.
Usage: python placement_test.py /path/to/bank.txt   (needs playwright + chrome)
       python placement_test.py --diretivas          (D2: order of several directives, fallback, TOPO/Relatório;
                                                      uses a small generic bank written below, no real phrases)"""
import sys, csv, os, collections
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
BANK = sys.argv[1] if len(sys.argv) > 1 else '/workspace/bank.txt'
DIR_BANK = '''@@EXAME Exame Teste
@@TEMPLATE Com alvo
EXAME TESTE COM ALVO
Técnica: texto genérico de técnica.

Relatório do exame:

Linha alvo do modelo, texto padrão.

Outra linha do modelo.

@@TEMPLATE Sem alvo
EXAME TESTE SEM ALVO
Técnica: texto genérico de técnica.

Relatório do exame:

Outra linha do modelo.

@@TEMPLATE Sem relatorio
EXAME TESTE SEM RELATORIO
Texto corrido genérico do modelo.

Outra linha do modelo.

##SECTION ORDEM NORMAL
@@SUBSTITUI = Linha alvo
@@ABAIXO_DE = Relatório

Frase A:
FRASE-A substitui ou topo.

##SECTION ORDEM INVERTIDA
@@ABAIXO_DE = Relatório
@@SUBSTITUI = Linha alvo

Frase B:
FRASE-B primeiro relatorio.

##SECTION FRASE VENCE
@@SUBSTITUI = Linha alvo

Frase C:
@@ABAIXO_DE = TOPO
FRASE-C no topo.

##SECTION TRES OPCOES
@@SUBSTITUI = Linha inexistente
@@ABAIXO_DE = Outra linha
@@ABAIXO_DE = TOPO

Frase D:
FRASE-D abaixo de outra linha.
'''
JS = r"""() => {
  var T = window.UFTest, S = T.S, out = [], ex = T.examNames(), i, j, k;
  for (i = 0; i < ex.length; i++) {
    var models = T.sortedModels().filter(function (m) { return m.exam === ex[i]; });
    var secs = T.examSections(ex[i]);
    for (j = 0; j < models.length; j++) {
      for (k = 0; k < secs.length; k++) {
        var c = secs[k].cards[0];
        if (!c) { out.push([ex[i], models[j].name, secs[k].name, '', 'no-phrase', '', '', '']); continue; }
        T.useModel(models[j], true);
        c.dispSec = secs[k].name; S.phraseIndex[c.id] = c;
        S.lastPlacement = null;
        var err = '';
        try { T.insertCard(c.id); } catch (e) { err = String(e); }
        var L = T.editorLines(), first = -1, firstText = -1, n;
        for (n = 0; n < L.length; n++) { if (T.lineText(L[n]).replace(/\s/g, '') !== '' && firstText < 0) { firstText = n; } if (L[n].className.indexOf('chg') >= 0 && first < 0) { first = n; } }
        var how = err ? 'error' : (S.lastPlacement || '?');
        if (first >= 0 && first <= firstText && how !== 'replace' && how !== 'heading') { how = 'top'; }
        out.push([ex[i], models[j].name, secs[k].name, c.ph.title, how, String(first), (S.lastPlacementLine || '').slice(0, 80), err]);
      }
    }
  }
  return out;
}"""
def diretivas():
    import tempfile
    tf = tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8'); tf.write(DIR_BANK); tf.close()
    # (template, phrase title, expected: 'replace' | text of the line right ABOVE the inserted phrase)
    cases = [('Com alvo', 'Frase A', 'replace'), ('Sem alvo', 'Frase A', 'Relatório do exame:'), ('Sem relatorio', 'Frase A', 'EXAME TESTE SEM RELATORIO'),
             ('Com alvo', 'Frase B', 'Relatório do exame:'),
             ('Com alvo', 'Frase C', 'EXAME TESTE COM ALVO'),
             ('Com alvo', 'Frase D', 'Outra linha do modelo.'), ('Sem relatorio', 'Frase D', 'Outra linha do modelo.')]
    js = r'''(a) => { var T = window.UFTest, S = T.S, m = T.sortedModels().filter(function (x) { return x.name === a[0]; })[0];
      T.useModel(m, true); var secs = T.examSections('Exame Teste'), c = null, i, j;
      for (i = 0; i < secs.length; i++) { for (j = 0; j < secs[i].cards.length; j++) { if (secs[i].cards[j].ph.title === a[1]) { c = secs[i].cards[j]; c.dispSec = secs[i].name; } } }
      S.phraseIndex[c.id] = c; T.insertCard(c.id);
      var L = T.editorLines(), t = L.map(function (l) { return T.lineText(l); }), k = -1;
      for (i = 0; i < t.length; i++) { if (/^FRASE-/.test(t[i])) { k = i; break; } }
      var above = ''; for (i = k - 1; i >= 0; i--) { if (t[i].replace(/\s/g, '')) { above = t[i]; break; } }
      return { k: k, above: above, all: t, replaced: t.join('\n').indexOf('Linha alvo do modelo') < 0 }; }'''
    ok = 0
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1400, 'height': 900})
        pg.goto('file://' + os.path.join(os.path.dirname(HERE), 'index.html')); pg.evaluate("localStorage.clear()"); pg.reload()
        pg.set_input_files('#bankFile0', tf.name); pg.wait_for_timeout(500)
        for tpl, ph, exp in cases:
            r = pg.evaluate(js, [tpl, ph])
            good = r['k'] >= 0 and ((exp == 'replace' and r['replaced']) or (exp != 'replace' and r['above'] == exp and (tpl != 'Com alvo' or not r['replaced'])))
            ok += good; print(('PASS ' if good else 'FAIL ') + tpl + ' / ' + ph + ' -> ' + exp + ('' if good else '  got: %r' % r))
        b.close()
    os.unlink(tf.name)
    print('TOTAL', ok, '/', len(cases))
if BANK == '--diretivas':
    diretivas(); sys.exit(0)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(os.path.dirname(HERE), 'index.html'))
    pg.evaluate("localStorage.clear()"); pg.reload()
    pg.set_input_files('#bankFile0', BANK); pg.wait_for_timeout(500)
    rows = pg.evaluate(JS)
    b.close()
with open(os.path.join(HERE, 'placement-report.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['exame', 'modelo', 'secao', 'frase', 'resultado', 'linha_inserida', 'linha_alvo', 'erro']); w.writerows(rows)
cnt = collections.Counter(r[4] for r in rows)
print('TOTAL', len(rows), dict(cnt), 'pageerrors', len(errs))
nomatch = collections.OrderedDict()
for r in rows:
    if r[4] in ('end', 'caret', 'top', 'error'): nomatch.setdefault((r[0], r[2]), []).append(r[1])
for (e, s), ms in nomatch.items(): print('SEM PARÁGRAFO:', e, '|', s, '|', len(ms), 'modelo(s)')
