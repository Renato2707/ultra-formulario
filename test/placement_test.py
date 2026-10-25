"""Automated placement test: every exam x template x section -> insert 1st phrase into a fresh template.
Usage: python placement_test.py /path/to/bank.txt   (needs playwright + chrome)"""
import sys, csv, os, collections
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
BANK = sys.argv[1] if len(sys.argv) > 1 else '/workspace/bank.txt'
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
