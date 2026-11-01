"""C6p: templates intermediarios com "*" no lugar do campo (antes "___"); colar de volta tolera erros comuns
das assistentes (espacos, "*" ao lado do valor, unidade repetida/faltando, caixa diferente, duas opcoes deixadas,
linha apagada) sem perder o resto do laudo. "___" (C6o) continua reconhecido.
Uso: /workspace/.pwenv/bin/python test/c6p_test.py   (UF_BANCO=<banco fora do repo> faz tambem o banco real; nada e impresso)"""
import os, sys, re
sys.argv = sys.argv[:1]
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'c6o_test.py'), encoding='utf-8').read().split('with sync_playwright() as p:')[0]
__file__ = os.path.join(HERE, 'c6o_test.py'); exec(src)
from playwright.sync_api import sync_playwright
FILLED = "[].filter.call(document.querySelectorAll('#editor .fld.f-ok'), function (f) { return true; }).length"
def lines(pg): return len(edtext(pg).split('\n'))
def nfld(pg): return pg.evaluate("document.querySelectorAll('#editor .fld').length")
with sync_playwright() as p:
    b = p.chromium.launch()
    for label, bank in ([('banco real', tmpbank(src=REAL))] if REAL and os.path.exists(REAL) else []) + [('banco de teste', tmpbank(OWN))]:
        cx, pg = page(b, bank)
        tp = pg.evaluate(JS_PREP, NAMES)
        ck('[%s] os 5 modelos existem' % label, [t['name'] for t in tp] == NAMES)
        for t in tp:
            nm = t['name']; it = t['inter']; ls = it.split('\n')
            # 1) "*" no lugar de cada campo; nada de marcação do banco
            ck('[%s] %s: sem ?[ @@ ## | *** ** *,* e sem * colado em letra' % (label, nm),
               not re.search(r'\?\+?\[|@@|##|\||\*\*|\*,\*|[A-Za-z\u00c0-\u00ff]\*|\*[A-Za-z\u00c0-\u00ff]', it) and '___' not in it, '')
            ck('[%s] %s: um "*" por campo' % (label, nm), it.count('*') >= t['ei']['n'], [it.count('*'), t['ei']])
            # 2) em branco com "*" e com "___" (antigo)
            for mk, txt in (('*', it), ('___', it.replace('*', '___'))):
                paste(pg, txt); em = pg.evaluate(EMPTY)
                ck('[%s] %s: em branco com %s vira campos vazios' % (label, nm, mk),
                   em['n'] == t['ei']['n'] and em['sel'] == t['ei']['sel'] and lines(pg) == len(ls), [em, t['ei']])
            # 3) preenchido (as duas opções)
            for k in ('0', '1'):
                paste(pg, t['f' + k]); got = pg.evaluate(NUMS)
                ck('[%s] %s: preenchido (opção %s) vira campos, texto igual' % (label, nm, k),
                   missing(t['e' + k], got) <= nvol(t['f' + k]) and nonum(edtext(pg)) == nonum(t['f' + k]) and pg.evaluate(EMPTY)['n'] == 0, [len(got), len(t['e' + k])])
            # 4) parcial: números digitados, escolhas ainda "a / b / c", alguns "*" ainda
            part = []; c = [0]
            def num(m):
                c[0] += 1; return m.group(0) if c[0] % 2 else str(30 + c[0])
            for l in ls: part.append(re.sub(r'(?<![A-Za-z\u00c0-\u00ff])\*(?![A-Za-z\u00c0-\u00ff])', num, l))
            part = '\n'.join(part); paste(pg, part); em = pg.evaluate(EMPTY)
            ck('[%s] %s: parcial ("*" e números) mantém linhas; campos com número preenchidos' % (label, nm),
               lines(pg) == len(ls) and em['sel'] == t['ei']['sel'] and em['n'] <= t['ei']['n'], [em, t['ei']])
            # 5) erros comuns sobre o laudo preenchido
            f0 = t['f0']; vals = [v for v in t['e0'] if re.fullmatch(r'\d+', v)]
            sl = f0
            if len(vals) >= 1: sl = re.sub(r'(?<![\d,])%s(?![\d,])' % vals[0], '*' + vals[0], sl, count=1)
            if len(vals) >= 2: sl = re.sub(r'(?<![\d,])%s(?![\d,])' % vals[1], vals[1] + '*', sl, count=1)
            if len(vals) >= 3: sl = re.sub(r'(?<![\d,])%s(?![\d,])' % vals[2], '* ' + vals[2] + ' *', sl, count=1)
            sl = sl.replace('8,5', '8.5', 1)
            errs0 = len(ERR); paste(pg, sl); got = pg.evaluate(NUMS)
            ck('[%s] %s: "*" ao lado do valor / ponto decimal: valores recuperados, nenhuma linha perdida' % (label, nm),
               lines(pg) == len(sl.split('\n')) and all(v in got for v in vals[:3] if not CALC.search([l for l in sl.split('\n') if v in l][0])) and len(ERR) == errs0, [got[:6], vals[:3]])
            u = sl.split('\n'); um = [i for i, l in enumerate(u) if re.search(r'\d mm', l)]
            if um:
                u2 = list(u); u2[um[0]] = re.sub(r' mm', ' mm mm', u2[um[0]], count=1)
                if len(um) > 1: u2[um[-1]] = re.sub(r' mm', '', u2[um[-1]], count=1)
                u2 = [re.sub(r'(\S)(\s)', r'\1  \2', l, count=1) if l.strip() else l for l in u2]   # espaços extras
                paste(pg, '\n'.join(u2))
                ck('[%s] %s: unidade repetida/faltando, espaços extras: não trava, linhas mantidas, campos ainda reconhecidos' % (label, nm),
                   lines(pg) == len(u2) and nfld(pg) > 0 and len(ERR) == errs0, lines(pg))
            # escolhas: caixa diferente, duas opções deixadas, linha da escolha apagada
            sel = pg.evaluate("""(t) => { var r = []; t.split('\\n').forEach(function (l, i) { var fs = UltraParser.fieldsOf(l); fs.forEach(function (f) { if (f.type === 'select' && !f.multi && f.options.length >= 3 && !UltraParser.fieldsOf(f.options.join(' ')).length) r.push([i, f.options.map(UFTest.interText)]); }); }); return r; }""",
                              '\n'.join(pg.evaluate(JS_PREP.replace('inter.push(UFTest.interText(l))', 'inter.push(l)'), [nm])[0]['inter'].split('\n')))
            if sel:
                i, op = sel[0]; L = ls[i]; lst = ' / '.join(op)
                if lst in L:
                    up = list(ls); up[i] = L.replace(lst, op[1].upper()); paste(pg, '\n'.join(up))
                    ok = pg.evaluate("(o) => [].some.call(document.querySelectorAll('#editor .fld.f-sel.f-ok'), function (f) { return f.textContent === o; })", op[1])
                    ck('[%s] %s: opção escrita em MAIÚSCULAS é reconhecida' % (label, nm), ok and lines(pg) == len(up))
                    two = list(ls); two[i] = L.replace(lst, op[0] + ' / ' + op[1]); paste(pg, '\n'.join(two)); em = pg.evaluate(EMPTY)
                    ck('[%s] %s: duas opções deixadas ("a / b") = escolha não resolvida, linha mantida' % (label, nm), em['sel'] == t['ei']['sel'] and lines(pg) == len(two), em)
                    gone = list(ls); gone[i] = L.replace(lst, ''); paste(pg, '\n'.join(gone)); em = pg.evaluate(EMPTY)
                    ck('[%s] %s: escolha apagada = não resolvida, resto do laudo inteiro' % (label, nm), em['sel'] == t['ei']['sel'] and lines(pg) == len(gone), em)
                    dl = ls[:i] + ls[i + 1:]; paste(pg, '\n'.join(dl)); em = pg.evaluate(EMPTY)
                    ck('[%s] %s: linha da escolha apagada: demais campos reconhecidos' % (label, nm), lines(pg) == len(dl) and em['sel'] < t['ei']['sel'], em)
        # 6) "*" literal e texto solto não viram campo
        lit = 'Linha comum com ***** no meio.\n*****\nOutra * linha ** qualquer *,* aqui.'
        paste(pg, lit)
        ck('[%s] "*" literal fora do banco continua texto, sem campo' % label, nfld(pg) == 0 and edtext(pg) == lit, edtext(pg))
        cx.close()
    b.close()
ck('sem erros de página', not ERR, ERR[:3])
print('%d/%d PASS' % (sum(R), len(R))); sys.exit(0 if all(R) else 1)
