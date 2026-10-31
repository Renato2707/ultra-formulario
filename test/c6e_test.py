"""C6e: painel limpo (cartões recolhidos, ponto de estado), barra de formatação acima do laudo, Backspace na pesquisa,
reconhecimento de laudo colado, TI-RADS unificado (6 linhas após a frase do nódulo; formulário que insere a frase do banco).
Banco genérico embutido (frases equivalentes, nenhum texto real). Uso: python test/c6e_test.py (playwright + chromium)"""
import os, sys, tempfile, json
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); IDX = 'file://' + os.path.join(os.path.dirname(HERE), 'index.html')
NOD = ('?[Sem nódulos.|Observa-se nódulo ?[cístico|espongiforme|misto|sólido|indeterminado], ?[anecoico|hiperecogênico|isoecogênico|hipoecogênico|muito hipoecogênico|indeterminado], '
       '?[mais largo que alto|mais alto que largo], margens ?[lisas|mal definidas|lobuladas|irregulares|com extensão extratireoidiana], ?[sem focos hiperecogênicos|com focos hiperecogênicos tipo cauda de cometa|'
       'com focos hiperecogênicos tipo macrocalcificações|com focos hiperecogênicos tipo calcificações periféricas|com focos hiperecogênicos puntiformes]. Localizado em terço ?[superior|médio|inferior] de lobo ?[direito|esquerdo], medindo cerca de * x * x * mm (LxAPxT). TI-RADS *.]')
BANK = '''@@EXAME Teste Um
@@EXAME_FULL TESTE UM
@@TEMPLATE Tireoide
TIREOIDE TESTE
Glandula de volume ?[normal|aumentado].

''' + NOD + '''

Lista:
- nódulo em terço ?[superior|médio|inferior] de lobo ?[direito|esquerdo], medindo cerca de * x * x * mm (LxAPxT). TI-RADS *.

O lobo direito mede cerca de * x * x * mm (LxAPxT).
O lobo esquerdo mede cerca de * x * x * mm (LxAPxT).
Istmo mede cerca de * mm (AP).
Volume glandular estimado em * cm³.

@@TEMPLATE Pelve
PELVE TESTE
Orgao central.
Dimensões medindo cerca de * x * x * mm (LxAPxT).
Volume estimado em cerca de * cm³.

@@TEMPLATE Doppler
DOPPLER TESTE
Artéria Umbilical: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
Artéria Cerebral Média: padrão espectral habitual.
- Índice de pulsatilidade (IP): *
PERFIL HEMODINÂMICO FETAL:
- Relação: IP umbilical / IP cerebral média = * (V.R.: < 1).

@@TEMPLATE Simples
SIMPLES TESTE
Texto sem medidas.
'''
R = []
def ck(n, c, i=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:300])); sys.stdout.flush()
tf = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False); tf.write(BANK.replace('\n', '\r\n').encode('utf-8')); tf.close()
ERR = []
def fresh(b, model=0, clear=True):
    c = b.new_context(viewport={'width': 1400, 'height': 900}); pg = c.new_page(); pg.set_default_timeout(5000)
    pg.on('pageerror', lambda e: ERR.append(str(e))); pg.on('console', lambda m: m.type == 'error' and ERR.append(m.text))
    pg.goto(IDX); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    pg.set_input_files('#bankFile0', tf.name); pg.wait_for_timeout(300)
    pg.click('[data-exam]'); pg.wait_for_timeout(600); pg.locator('[data-model]').nth(model).dblclick(); pg.wait_for_timeout(400)
    if not pg.evaluate('UFCalc.isOpen()'): pg.evaluate('UFCalc.open()'); pg.wait_for_timeout(150)
    return pg
def rep(pg): return pg.evaluate('UFTest.reportText()').splitlines()
def L(pg, s): return ([l for l in rep(pg) if s in l] + [''])[0]
def ev(pg, js, d=None):
    try: return pg.evaluate(js)
    except Exception as e: return d
def T(f, d=None):
    try: return f()
    except Exception as e: return d
CH = """(function(a){ var cs=document.querySelectorAll('#editor .fld[data-t=s]'), i, o, k;
 for(i=0;i<cs.length;i++){ if(cs[i].getAttribute('data-v')!==null) continue; o=JSON.parse(cs[i].getAttribute('data-o'));
  for(k=0;k<o.length;k++){ if(o[k].indexOf(a)===0){ UFTest.openSelect(cs[i]); UFTest.chooseOption(k); return k; } } } return -1; })"""
def choose(pg, txt): r = pg.evaluate(CH + '(%s)' % json.dumps(txt)); pg.keyboard.press('Escape'); pg.wait_for_timeout(120); return r
def nums(pg, start):   # campos numéricos da linha que começa com start
    return pg.evaluate("""(function(s){ var ds=document.querySelectorAll('#editor div'), i; for(i=0;i<ds.length;i++){ if((ds[i].textContent||'').indexOf(s)===0 && !ds[i].querySelector('div')) return [].map.call(ds[i].querySelectorAll('.fld[data-t=n],.fld[data-t=d]'), function(f){return f.textContent}); } return null; })""", start)
def typ_line(pg, start, vals):
    if pg.evaluate("!document.getElementById('popup').hidden"): pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    for k, v in enumerate(vals):
        pg.evaluate("""(function(a){ var ds=document.querySelectorAll('#editor div'), i; for(i=0;i<ds.length;i++){ if((ds[i].textContent||'').indexOf(a[0])===0 && !ds[i].querySelector('div')){
          var f=ds[i].querySelectorAll('.fld[data-t=n],.fld[data-t=d]')[a[1]]; document.getElementById('editor').focus(); var r=document.createRange(); r.selectNodeContents(f); var s=getSelection(); s.removeAllRanges(); s.addRange(r); return; } } })""", [start, k])
        pg.keyboard.type(v); pg.wait_for_timeout(60)
    pg.wait_for_timeout(150)
def dot(pg, id): return ev(pg, "(function(){var e=document.getElementById('%sDot');return e?(e.className.indexOf(' on')>=0?'on':'off'):null})()" % id)
def cardOpen(pg, id): return ev(pg, "UFCalc.isCardOpen('%s')" % id)
def paste(pg, text):
    pg.evaluate("""(function(t){var dt=new DataTransfer(); dt.setData('text/plain', t); document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));})""", text)
    pg.wait_for_timeout(400)
def trl(pg): return ev(pg, "[].map.call(document.querySelectorAll('#editor .uc-trl'),function(d){return d.textContent})", [])
SIX13 = ['Pontuação: 13', 'Categoria TIRADS: TR5', 'Nível de Risco: Altamente suspeito', 'Risco de Malignidade: ≥20%', 'Recomendação de PAAF: se ≥1,0 cm', 'Sugestão de Acompanhamento: se ≥0,5 cm, US anual por até 5 anos.']

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- 1/9: layout ----------
    pg = fresh(b, 3)
    ck('1 formatação acima do laudo (#fmtBar dentro do centro, antes do editor)', ev(pg, "(function(){var f=document.getElementById('fmtBar');return !!f && f.parentNode.id==='center' && f.nextElementSibling.id==='editorWrap' && f.querySelectorAll('.tb[data-cmd]').length>=9})()"))
    ck('1 barra de cima sem botões de formatação', ev(pg, "document.querySelectorAll('#editorToolbar .tb[data-cmd]').length") == 0)
    ck('1 botões das frases (+ ⇩ ✎ →) em linha própria acima da pesquisa', ev(pg, "(function(){var t=document.getElementById('navTools'), s=document.getElementById('navSearch'); return t.parentNode!==s.parentNode.parentNode && t.getBoundingClientRect().bottom<=s.getBoundingClientRect().top+1})()"))
    ck('1 pesquisa de frases ocupa a largura do painel', ev(pg, "document.getElementById('navSearch').offsetWidth / document.getElementById('left').offsetWidth", 0) > 0.85, ev(pg, "document.getElementById('navSearch').offsetWidth"))
    ck('1 pesquisa no laudo mais larga (≥ 200 px)', ev(pg, "document.getElementById('repSearch').offsetWidth", 0) >= 200)
    pg.evaluate("(function(){var d=document.querySelector('#editor div'); var r=document.createRange(); r.selectNodeContents(d); var s=getSelection(); s.removeAllRanges(); s.addRange(r);})()")
    T(lambda: pg.click('#fmtBar .tb[data-cmd=bold]', timeout=800)); pg.wait_for_timeout(100)
    ck('1 negrito funciona pela nova barra', ev(pg, "!!document.querySelector('#editor b, #editor strong')"))
    ck('9 sem botão ± (painel sempre visível)', pg.locator('#btnCalc').count() == 0 and '±' not in pg.inner_text('#topbar'))
    # ---------- 2: Backspace na pesquisa ----------
    crumb0 = pg.inner_text('#crumb')
    pg.click('#navSearch'); pg.keyboard.type('ab'); pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(200)
    ck('2 Backspace na pesquisa vazia não volta aos modelos', pg.inner_text('#crumb') == crumb0 and ev(pg, "document.activeElement.id") == 'navSearch', [crumb0, pg.inner_text('#crumb')])
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # ---------- 4/5/7/8/10: painel ----------
    ids = ev(pg, "[].map.call(document.querySelectorAll('[data-calc]'),function(e){return e.getAttribute('data-calc')}).join()")
    ck('8/7 cartões: Calculadora, Obstetrícia, Volume, TI-RADS (um só)', ids == 'livre,obst,auto,tirads', ids)
    ck('8 obstetrícia reúne IG relatada, PFE, IG composta, IG pelo PFE, percentis e Doppler', ev(pg, "(function(){var c=document.querySelector('[data-calc=obst]'); return ['ucPfe','ucIgc','ucIgp','ucPct','ucDop'].every(function(i){return c.querySelector('#'+i)}) && !!c.querySelector('[data-calc-part=ig] input')})()"))
    ck('7 TI-RADS: chave do texto e formulário no mesmo cartão; sem "adicionar nódulo"', ev(pg, "(function(){var c=document.querySelector('[data-calc=tirads]'); return !!c.querySelector('#ucTrTxt') && !!c.querySelector('#trIns') && !document.getElementById('trAdd')})()"))
    ck('5 modelo sem medidas: todos os cartões recolhidos', not any(cardOpen(pg, i) for i in ('livre', 'obst', 'auto', 'tirads')))
    for i in ('livre', 'obst', 'auto', 'tirads'): pg.evaluate("UFCalc.setOpen('%s', true)" % i)
    txt = pg.inner_text('#right')
    junk = [j for j in ('AU/ACM =', 'Ordem na linha', 'desligado', 'Desligado', 'sem linha', 'Sem linha', 'linha encontrada', 'no laudo:') if j in txt]
    ck('10 sem texto descritivo no painel', not junk, junk)
    ck('4/10 estado só por ponto (com dica)', ev(pg, "[].every.call(document.querySelectorAll('#right .uc-row[data-ready]'),function(r){var d=r.querySelector('.uc-dot');return d && d.title})") and pg.locator('#right .uc-dot').count() >= 8)
    # ---------- 5/6: tireoide: abre o pronto; chaves ligam/desligam de verdade ----------
    pg = fresh(b, 0)
    ck('5 tireoide sem medidas: Volume recolhido, ponto cinza', not cardOpen(pg, 'auto') and dot(pg, 'ucAuto') == 'off')
    typ_line(pg, 'O lobo direito', ['40', '15', '14']); typ_line(pg, 'O lobo esquerdo', ['38', '14', '13'])
    vol = L(pg, 'Volume glandular')
    ck('5 medidas completas: ponto verde e o cartão Volume abre sozinho', dot(pg, 'ucAuto') == 'on' and cardOpen(pg, 'auto') and not cardOpen(pg, 'obst'), [dot(pg, 'ucAuto'), cardOpen(pg, 'auto')])
    ck('6 volume ligado escreve o total', '___' not in vol and 'cm³' in vol, vol)
    pg.click('#ucAuto'); pg.wait_for_timeout(200)
    ck('6 desligado: caixa desmarcada, ponto cinza e valor sai do laudo', not pg.is_checked('#ucAuto') and dot(pg, 'ucAuto') == 'off' and '___' in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    pg.click('#ucAuto'); pg.wait_for_timeout(200)
    ck('6 religado: volta o valor', pg.is_checked('#ucAuto') and L(pg, 'Volume glandular') == vol, L(pg, 'Volume glandular'))
    # ---------- 11: TI-RADS pelo texto ----------
    choose(pg, 'Observa-se nódulo')
    for o in ('sólido', 'muito hipo', 'mais alto', 'irregulares', 'com focos hiperecogênicos puntiformes'): choose(pg, o)
    r = rep(pg); i = [k for k, l in enumerate(r) if l.startswith('Observa-se nódulo')][0]
    ck('11 seis linhas logo após a frase do nódulo (modelo exato)', r[i + 1:i + 7] == SIX13, r[i:i + 7])
    ck('11 número no campo TI-RADS', r[i].endswith('TI-RADS 5.'), r[i])
    ck('11 ponto verde e cartão TI-RADS abre sozinho', dot(pg, 'ucTrTxt') == 'on' and cardOpen(pg, 'tirads'))
    T(lambda: pg.click('#editor .fld.f-ok >> text=irregulares', timeout=800)); pg.wait_for_timeout(150)
    T(lambda: pg.locator('#popup .opt', has_text='lisas').first.click(timeout=800)); pg.wait_for_timeout(250)
    ck('11 trocar opção atualiza as linhas (lisas: 11 pts)', trl(pg)[:2] == ['Pontuação: 11', 'Categoria TIRADS: TR5'], trl(pg)[:2])
    typ_line(pg, 'Observa-se nódulo', ['12', '8', '9'])
    t6 = trl(pg)
    ck('11 com medidas: veredito pelo tamanho (≥10 mm → PAAF indicada)', len(t6) == 6 and t6[4] == 'Recomendação de PAAF: se ≥1,0 cm' and t6[5].endswith('US anual por até 5 anos.'), t6)
    typ_line(pg, 'Observa-se nódulo', ['7', '5', '6'])
    t6 = trl(pg)
    ck('11 medida muda o veredito (7 mm → não indicada; seguimento indicado)', len(t6) == 6 and t6[4] == 'Recomendação de PAAF: se ≥1,0 cm' and '(' not in t6[5], t6)
    ck('11 linhas não ficam duplicadas', len(trl(pg)) == 6)
    pg.click('#ucTrTxt'); pg.wait_for_timeout(250)
    ck('6 TI-RADS desligado: linhas e número saem do laudo', not pg.is_checked('#ucTrTxt') and trl(pg) == [] and 'TI-RADS ___' in L(pg, 'Observa-se nódulo') and dot(pg, 'ucTrTxt') == 'off', L(pg, 'Observa-se'))
    pg.click('#ucTrTxt'); pg.wait_for_timeout(250)
    ck('6 TI-RADS religado: voltam', len(trl(pg)) == 6 and dot(pg, 'ucTrTxt') == 'on')
    filled = pg.evaluate('UFTest.reportText()')
    # ---------- 3: laudo pronto colado ----------
    pg = fresh(b, 3); pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'"); pg.click('#editor')
    paste(pg, filled)
    ck('3 colado: campos reconhecidos', ev(pg, "document.querySelectorAll('#editor .fld').length", 0) >= 10, ev(pg, "document.querySelectorAll('#editor .fld').length"))
    ck('3 valores das medidas viram campos preenchidos', nums(pg, 'O lobo direito') == ['40', '15', '14'], nums(pg, 'O lobo direito'))
    ck('3 escolhas viram campos de escolha', ev(pg, "[].map.call(document.querySelectorAll('#editor .fld.f-sel.f-ok'),function(c){return c.textContent}).indexOf('sólido')>=0"))
    ck('3 linhas do TI-RADS coladas não duplicam (passam a ser as calculadas)', len(trl(pg)) == 6 and sum(1 for l in rep(pg) if l.startswith('Pontuação:')) == 1, [l for l in rep(pg) if l.startswith('Pontuação')])
    ck('3 texto do laudo igual ao colado', [l.rstrip() for l in rep(pg)] == [l.rstrip() for l in filled.replace('\r', '').split('\n')][:len(rep(pg))])
    typ_line(pg, 'O lobo direito', ['50'])
    ck('3 calculadora funciona no laudo colado (volume recalcula)', L(pg, 'Volume glandular') != vol and '___' not in L(pg, 'Volume glandular'), L(pg, 'Volume glandular'))
    typ_line(pg, 'Observa-se nódulo', ['15'])
    ck('3 TI-RADS do laudo colado atualiza com a medida', trl(pg)[4:5] == ['Recomendação de PAAF: se ≥1,0 cm'], trl(pg))
    pg.click('#editor'); pg.keyboard.press('End'); pg.wait_for_timeout(1500)
    pg.reload(); pg.wait_for_timeout(800)
    ck('3 rascunho recarregado mantém os campos', ev(pg, "document.querySelectorAll('#editor .fld').length", 0) >= 10)
    paste2 = 'Linha comum um.\nOutra linha qualquer.'
    pg2 = fresh(b, 3); pg2.click('#editor'); pg2.keyboard.press('Control+End'); paste(pg2, paste2)
    ck('3 texto que não é do banco continua texto simples', 'Outra linha qualquer.' in rep(pg2) and ev(pg2, "document.querySelectorAll('#editor .fld').length") == 0)
    # ---------- 12: formulário insere a frase do banco ----------
    pg = fresh(b, 0); pg.evaluate("UFCalc.setOpen('tirads', true)")
    for c, v in (('comp', 'sol'), ('eco', 'hipo'), ('forma', 'larg'), ('marg', 'lisa')): T(lambda: pg.select_option('.tr-sel[data-cat=%s]' % c, v, timeout=800))
    T(lambda: pg.locator('.tr-loc select').nth(0).select_option('médio', timeout=800)); T(lambda: pg.locator('.tr-loc select').nth(1).select_option('direito', timeout=800))
    for k, v in enumerate(['12', '8', '9']): T(lambda: pg.locator('.tr-mm').nth(k).fill(v, timeout=800))
    ck('12 resultado ao vivo', T(lambda: pg.inner_text('.tr-res', timeout=800).strip()) == 'TR4 · 4 pts')
    base = rep(pg)
    T(lambda: pg.click('#trIns', timeout=800)); pg.wait_for_timeout(300)
    r = rep(pg); i = ([k for k, l in enumerate(r) if l.startswith('Observa-se nódulo')] + [0])[0]
    ck('12 frase real do banco com os valores escolhidos', r[i] == 'Observa-se nódulo sólido, hipoecogênico, mais largo que alto, margens lisas, sem focos hiperecogênicos. Localizado em terço médio de lobo direito, medindo cerca de 12 x 8 x 9 mm (LxAPxT). TI-RADS 4.', r[i])
    ck('12 seguida das 6 linhas', r[i + 1:i + 3] == ['Pontuação: 4', 'Categoria TIRADS: TR4'] and r[i + 5] == 'Recomendação de PAAF: se ≥1,5 cm', r[i + 1:i + 7])
    ck('12 a frase entra no lugar do campo de escolha (não duplica)', sum(1 for l in r if 'nódulo' in l and 'Sem nódulos' in l) == 0 and r.count(r[i]) == 1)
    ck('12 campos continuam editáveis (7 escolhas + 4 números)', ev(pg, "(function(){var ds=document.querySelectorAll('#editor div'),i;for(i=0;i<ds.length;i++){if((ds[i].textContent||'').indexOf('Observa-se')===0)return ds[i].querySelectorAll('.fld').length}})()") == 11)
    pg.click('#editor'); pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    ck('12 Ctrl+Z desfaz a inserção de uma vez', rep(pg) == base, [l for l in rep(pg) if 'nódulo' in l.lower()][:2])
    pg.keyboard.press('Control+y'); pg.wait_for_timeout(300)
    if rep(pg) == base: T(lambda: pg.click('#trIns', timeout=800)); pg.wait_for_timeout(300)
    T(lambda: pg.click('#editor .fld.f-ok >> text=lisas', timeout=800)); pg.wait_for_timeout(150)
    T(lambda: pg.locator('#popup .opt', has_text='irregulares').first.click(timeout=800)); pg.wait_for_timeout(250)
    ck('12 editar no laudo recalcula (irregulares: 6 pts TR4)', trl(pg)[:2] == ['Pontuação: 6', 'Categoria TIRADS: TR4'], trl(pg)[:2])
    pg.screenshot(path='/tmp/c6e_final.png')
    ck('sem erros de console', not ERR, ERR[:3])
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
