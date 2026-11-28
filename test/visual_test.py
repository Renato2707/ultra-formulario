"""ZEN-9: hierarquia visual da lista da esquerda (Exames / Modelos / Frases).
Escala única (14 cabeçalho de grupo > 13 título de cartão > 12 prévia > 11 contagem), cartões de mesma altura,
um estilo comum e um estilo (padrão) iguais em todas as listas, estados hover/seleção/foco sem conflito.
Banco genérico embutido (nenhum texto do banco real). Uso: python test/visual_test.py"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
BANK = '''@@EXAME Doppler Teste
@@EXAME_FULL DOPPLER TESTE

@@TEMPLATE Doppler Teste (padrão)
DOPPLER TESTE
Artéria Umbilical: padrão habitual de teste.

@@TEMPLATE Doppler Teste (gemelar)
DOPPLER TESTE GEMELAR
Artéria Umbilical: padrão habitual de teste.

@@TEMPLATE Um modelo com um nome bem comprido que não cabe numa linha só da coluna da esquerda
DOPPLER TESTE COMPRIDO
Artéria Umbilical: padrão habitual de teste.

##SECTION ARTÉRIA UMBILICAL

Umbilical (padrão):
Artéria umbilical: padrão de teste curto.

Umbilical alta:
Artéria umbilical: curta.

Umbilical zero:
Artéria umbilical: fluxo diastólico final ausente ao Doppler espectral de teste, com texto longo o bastante para quebrar em várias linhas dentro da coluna estreita da esquerda e passar de duas linhas.

Umbilical reversa com um título muito comprido que não cabe numa única linha da coluna:
Artéria umbilical: primeira linha de teste.
Segunda linha de teste.
Terceira linha de teste.

Hipótese Umbilical (padrão):
- Artéria umbilical com padrão de teste habitual, texto longo o bastante para quebrar em várias linhas dentro da coluna.

Hipótese Umbilical alta:
- Curta.

Hipótese Umbilical zero:
- Artéria umbilical com diástole zero.
- Segunda linha da hipótese de teste.
- Terceira linha da hipótese de teste.

##SECTION OUTROS

Outra (padrão):
- Artéria umbilical com padrão de teste habitual.

Outra comum:
- Texto curto.
'''
R = []; ERR = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:500])); sys.stdout.flush()
f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); f.write(BANK.replace('\n', '\r\n').encode('utf-8')); f.close()
def fresh(b, w=1400):
    c = b.new_context(viewport={'width': w, 'height': 1200}); pg = c.new_page(); pg.set_default_timeout(6000)
    pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text)); pg.on('pageerror', lambda e: ERR.append(str(e)))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', f.name); pg.wait_for_timeout(300)
    pg.locator('[data-exam]').first.click(); pg.wait_for_timeout(600)
    return pg
def phrases(pg):
    pg.evaluate('''() => { var m = UFTest.S.models.filter(function (x) { return x.name === 'Doppler Teste (padrão)'; })[0]; UFTest.useModel(m, true); }'''); pg.wait_for_timeout(400)
    for k in pg.evaluate("[].map.call(document.querySelectorAll('[data-sec]'), function (e) { return e.getAttribute('data-sec'); })"):
        if pg.locator('.sec.open [data-sec="%s"]' % k).count() == 0: pg.locator('[data-sec="%s"]' % k).click(); pg.wait_for_timeout(150)
    pg.mouse.move(900, 900); pg.wait_for_timeout(250)
CARDS = '''() => [].map.call(document.querySelectorAll('#navList .pcard'), function (c) { var t = c.querySelector('.ph1 b'), p = c.querySelector('.pb'), cs = getComputedStyle(c), ts = getComputedStyle(t);
  return { t: t.textContent, pad: /\\bpad\\b/.test(c.className), sel: /\\bsel\\b/.test(c.className), h: c.offsetHeight, fs: parseFloat(ts.fontSize), fw: ts.fontWeight, pfs: parseFloat(getComputedStyle(p).fontSize),
    bg: cs.backgroundColor, bl: cs.borderLeftWidth, blc: cs.borderLeftColor, bt: cs.borderTopWidth, btc: cs.borderTopColor, mt: cs.marginTop, mb: cs.marginBottom, sh: cs.boxShadow, pl: cs.paddingLeft + (cs.borderLeftWidth), tx: t.getBoundingClientRect().left - c.getBoundingClientRect().left }; })'''
HEADS = '''() => [].map.call(document.querySelectorAll('#navList .sec > .card .ct'), function (e) { return parseFloat(getComputedStyle(e).fontSize); })'''
def uniq(a): return sorted(set(a))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('UF_BROWSER') or None)
    for w, label in ((1400, 'painel estreito'), (1400, 'painel largo')):
        pg = fresh(b, w); phrases(pg)
        if label == 'painel largo':
            pg.evaluate("document.getElementById('left').style.width = '460px'"); pg.wait_for_timeout(250)
        cs = pg.evaluate(CARDS); hs = pg.evaluate(HEADS)
        ck(label + ': 9 cartões de frase', len(cs) == 9, len(cs))
        ck(label + ': todos os cartões têm a mesma altura (offsetHeight)', len(uniq([c['h'] for c in cs])) == 1, uniq([c['h'] for c in cs]))
        ck(label + ': mesma altura da prévia e mesmo título nos cartões (padrão) e comuns', uniq([c['fs'] for c in cs]) == [13.0] and uniq([c['pfs'] for c in cs]) == [12.0], (uniq([c['fs'] for c in cs]), uniq([c['pfs'] for c in cs])))
        ck(label + ': nenhum título de cartão é maior que o cabeçalho do grupo', max(c['fs'] for c in cs) < min(hs), (max(c['fs'] for c in cs), hs))
        ck(label + ': cabeçalhos de grupo todos com 14px', uniq(hs) == [14.0], uniq(hs))
        pads = [c for c in cs if c['pad']]; norm = [c for c in cs if not c['pad']]
        ck(label + ': há cartões (padrão) e comuns, incluindo Hipótese', len(pads) == 3 and len(norm) == 6, (len(pads), len(norm)))
        ck(label + ': um só estilo comum (fundo, borda, margem, sombra iguais em todos)', len(set((c['bg'], c['bt'], c['btc'], c['mt'], c['mb'], c['sh'], c['fw']) for c in norm)) == 1, norm[:2])
        ck(label + ': um só estilo (padrão), igual nas listas de frase e de Hipótese', len(set((c['bg'], c['bl'], c['blc'], c['bt'], c['btc'], c['mt'], c['mb'], c['sh'], c['fw']) for c in pads)) == 1, pads[:2])
        ck(label + ': (padrão) = mesma cor de fundo/margem/sombra do comum, só barra à esquerda + negrito', pads[0]['bg'] == norm[0]['bg'] and pads[0]['mt'] == norm[0]['mt'] and pads[0]['mb'] == norm[0]['mb'] and pads[0]['sh'] == norm[0]['sh'] and pads[0]['bl'] == '4px' and norm[0]['bl'] == '1px' and pads[0]['fw'] == '700' and norm[0]['fw'] == '400', (pads[0], norm[0]))
        ck(label + ': o texto começa no mesmo ponto em todos os cartões (barra não desloca)', len(uniq([round(c['tx']) for c in cs])) == 1, uniq([c['tx'] for c in cs]))
        ck(label + ': margem igual entre todos (sem espaço extra em volta do padrão)', uniq([c['mt'] for c in cs]) == ['0px'] and uniq([c['mb'] for c in cs]) == ['6px'], (uniq([c['mt'] for c in cs]), uniq([c['mb'] for c in cs])))
        # estados
        first = pg.locator('#navList .pcard').nth(1)
        base = pg.evaluate("(function(){var c=document.querySelectorAll('#navList .pcard')[1],s=getComputedStyle(c);return {bg:s.backgroundColor,bc:s.borderTopColor}})()")
        first.hover(); pg.wait_for_timeout(150)
        hv = pg.evaluate("(function(){var c=document.querySelectorAll('#navList .pcard')[1],s=getComputedStyle(c);return {bg:s.backgroundColor,bc:s.borderTopColor,h:c.offsetHeight}})()")
        ck(label + ': hover muda só o fundo (borda igual, mesma altura)', hv['bg'] != base['bg'] and hv['bc'] == base['bc'] and hv['h'] == cs[1]['h'], (base, hv))
        first.click(); pg.wait_for_timeout(250); pg.mouse.move(900, 900); pg.wait_for_timeout(150)
        sl = pg.evaluate("(function(){var c=document.querySelector('#navList .pcard.sel'),s=getComputedStyle(c);return {bg:s.backgroundColor,bc:s.borderTopColor,ol:s.outlineStyle}})()")
        acc = pg.evaluate("getComputedStyle(document.body).getPropertyValue('--accent').trim()")
        ck(label + ': selecionado = borda de destaque + fundo de destaque (distinto de hover) e sem anel de foco ao clicar', sl['bg'] != base['bg'] and sl['bc'] != base['bc'] and sl['bg'] != hv['bg'] and sl['ol'] == 'none', (sl, base, hv))
        ck(label + ': só 1 cartão selecionado', pg.locator('#navList .pcard.sel').count() == 1)
        hh = pg.evaluate("(function(){var c=document.querySelectorAll('#navList .sec > .card');return [].map.call(c,function(e){return {ol:getComputedStyle(e).outlineStyle,bg:getComputedStyle(e).backgroundColor,open:/open/.test(e.parentNode.className)}})})()")
        ck(label + ': cabeçalho de grupo clicado não fica com caixa de foco (mouse)', pg.evaluate("(function(){var h=document.querySelector('#navList .sec > .card');h.focus();return getComputedStyle(h).outlineStyle})()") == 'none')
        pg.locator('#navList .sec > .card').first.focus(); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(150)
        kb = pg.evaluate("(function(){var a=document.activeElement,s=getComputedStyle(a);return {ol:s.outlineStyle,w:s.outlineWidth,hasCard:/card/.test(a.className),usekbd:/usekbd/.test(document.body.className)}})()")
        ck(label + ': com o teclado o foco aparece como anel (e só aí)', kb['usekbd'] and kb['ol'] == 'solid' and kb['hasCard'], kb)
        pg.locator('#navList .pcard').nth(2).click(); pg.wait_for_timeout(200)
        ck(label + ': clique do mouse volta a tirar o anel', pg.evaluate("/usekbd/.test(document.body.className)") is False)
        pg.close()
    # busca: mesmos cartões e mesma altura
    pg = fresh(b); phrases(pg); pg.fill('#navSearch', 'umbilical'); pg.wait_for_timeout(500)
    cs = pg.evaluate(CARDS)
    ck('busca: cartões com a mesma altura', len(cs) > 3 and len(uniq([c['h'] for c in cs])) == 1, uniq([c['h'] for c in cs]))
    pg.close()
    # tema escuro
    pg = fresh(b); pg.evaluate("document.body.className = 'theme-dark'"); phrases(pg)
    cs = pg.evaluate(CARDS)
    ck('tema escuro: mesma altura e mesma escala', len(uniq([c['h'] for c in cs])) == 1 and uniq([c['fs'] for c in cs]) == [13.0], (uniq([c['h'] for c in cs]), uniq([c['fs'] for c in cs])))
    pg.close()
    # Modelos e Exames
    pg = fresh(b)
    ex = pg.evaluate("[].map.call(document.querySelectorAll('#navList .card'), function (c) { return [c.offsetHeight, parseFloat(getComputedStyle(c.querySelector('.ct')).fontSize), c.querySelector('.ct').offsetHeight]; })")
    pg.locator('#left').get_by_text('Modelos', exact=True).first.click(); pg.wait_for_timeout(300)
    md = pg.evaluate('''() => [].map.call(document.querySelectorAll('#navList .card'), function (c) { var s = getComputedStyle(c), t = getComputedStyle(c.querySelector('.ct')); return { t: c.querySelector('.ct').textContent.slice(0, 20), h: c.offsetHeight, fs: parseFloat(t.fontSize), fw: t.fontWeight, pad: /\\bpad\\b/.test(c.className), mt: s.marginTop, mb: s.marginBottom, sh: s.boxShadow, bl: s.borderLeftWidth, th: c.querySelector('.ct').offsetHeight }; })''')
    ck('Modelos: 3 cartões, mesma altura (mesmo o de nome comprido) e título de 13px em 1 linha', len(md) == 3 and len(uniq([m['h'] for m in md])) == 1 and uniq([m['fs'] for m in md]) == [13.0] and uniq([m['th'] for m in md]) == [18], md)
    ck('Modelos: (padrão) com barra + negrito; comum sem barra e sem negrito; mesma margem/sombra', [m['fw'] for m in md if m['pad']] == ['700'] and uniq([m['fw'] for m in md if not m['pad']]) == ['400'] and uniq([m['mt'] for m in md]) == ['0px'] and uniq([m['mb'] for m in md]) == ['6px'] and len(uniq([m['sh'] for m in md])) == 1, md)
    ck('Exames: cartões de mesma altura e título de 13px', len(uniq([e[0] for e in ex])) == 1 and uniq([e[1] for e in ex]) == [13.0], ex)
    ck('Calculadoras: cabeçalhos dos grupos com 14px (mesma escala)', pg.evaluate("[].every.call(document.querySelectorAll('.uc-h'), function (h) { return getComputedStyle(h).fontSize === '14px'; })"))
    ck('sem erros no console', not ERR, ERR)
    b.close()
print('%d/%d passed' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
