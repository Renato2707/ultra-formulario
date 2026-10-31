"""C6g (sobre C6e): painel limpo (cartões recolhidos, ponto de estado), barra de formatação acima do laudo, Backspace na pesquisa,
reconhecimento de laudo colado, TI-RADS unificado (6 linhas após a frase do nódulo; formulário que insere a frase do banco).
Banco genérico embutido (frases equivalentes, nenhum texto real). Uso: python test/c6g_test.py (playwright + chromium)"""
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

def mk(b):
    pg = fresh(b, 0)
    typ_line(pg, 'O lobo direito', ['40', '15', '14']); typ_line(pg, 'O lobo esquerdo', ['38', '14', '13'])
    choose(pg, 'Observa-se nódulo')
    for o in ('sólido', 'muito hipo', 'mais alto', 'irregulares', 'com focos hiperecogênicos puntiformes'): choose(pg, o)
    typ_line(pg, 'Observa-se nódulo', ['16', '16', '16'])
    return pg
def txt(pg): return trl(pg)
def kill(pg, k):
    if pg.evaluate("!document.getElementById('popup').hidden"): pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    pg.locator('#editor .uc-trl').nth(k).click(); pg.keyboard.press('Home'); pg.keyboard.press('Shift+End'); pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(500)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = mk(b)
    t = txt(pg)
    ck('1 seis linhas, sem "(indicada: ...)" nem "(indicado: ...)"', len(t) == 6 and t[4] == 'Recomendação de PAAF: se ≥1,0 cm' and t[5].endswith('anos.') and not any('indicad' in x for x in t), t)
    ck('2 linhas editáveis (não contenteditable=false)', pg.evaluate("[].every.call(document.querySelectorAll('#editor .uc-trl'),function(d){return d.isContentEditable})"))
    # editar a linha 1
    pg.locator('#editor .uc-trl').nth(0).click(); pg.keyboard.press('Home'); pg.keyboard.press('Shift+End'); pg.keyboard.type('Minha pontuação: 99'); pg.wait_for_timeout(500)
    t = txt(pg)
    ck('3 texto editado fica como escrito', t[0] == 'Minha pontuação: 99' and len(t) == 6, t)
    choose(pg, 'lisas') if False else None
    for a, o in (('sólido', 'cístico'), ('mais alto', 'mais largo'), ('com focos hiperecogênicos puntiformes', 'sem focos')):
        T(lambda: pg.click('#editor .fld.f-ok >> text=' + a, timeout=800)); pg.wait_for_timeout(150)
        T(lambda: pg.locator('#popup .opt', has_text=o).first.click(timeout=800)); pg.wait_for_timeout(300)
    pg.wait_for_timeout(300)
    t = txt(pg)
    ck('4 mudar a escolha: linha editada continua, as outras atualizam', t[0] == 'Minha pontuação: 99' and t[1] != 'Categoria TIRADS: TR5' and t[1].startswith('Categoria') and len(t) == 6, t)
    # apagar a linha 3
    kill(pg, 2)
    t = txt(pg)
    ck('5 linha apagada não volta', len(t) == 5 and not any(x.startswith('Nível de Risco') for x in t), t)
    T(lambda: pg.click('#editor .fld.f-ok >> text=cístico', timeout=800)); pg.wait_for_timeout(150)
    T(lambda: pg.locator('#popup .opt', has_text='sólido').first.click(timeout=800)); pg.wait_for_timeout(500)
    t = txt(pg)
    ck('6 mudar de novo: continua sem a linha apagada e sem duplicar', len(t) == 5 and not any(x.startswith('Nível de Risco') for x in t) and t[1].startswith('Categoria TIRADS'), t)
    # apagar todas
    for _ in range(8):
        if len(txt(pg)): kill(pg, 0)
    pg.wait_for_timeout(300)
    ck('7 apagar todas: não voltam', txt(pg) == [], txt(pg))
    pg.close()
    # nódulo incompleto e completo de novo: linhas voltam
    pg = mk(b)
    kill(pg, 1)
    ck('8 antes: 5 linhas', len(txt(pg)) == 5, txt(pg))
    T(lambda: pg.click('#editor .fld.f-ok >> text=irregulares', timeout=800)); pg.wait_for_timeout(150)
    pg.evaluate("(function(){var f=document.querySelector('#editor .fld[data-t=s]'); })()")
    pg.close()
    ck('sem erros de console', not ERR, ERR[:3])
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
