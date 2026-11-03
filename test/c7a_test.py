"""C7a: nódulo adicionado pela calculadora BI-RADS fica em parágrafo próprio, com a mesma separação do laudo
(linha em branco se o laudo separa parágrafos assim; sem ela se o laudo usa uma linha por frase).
Uso: UF_BANCO=<banco com o modelo Mamária Bilateral (padrão)> /workspace/.pwenv/bin/python test/c7a_test.py"""
import os, sys, re
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, 'c7_test.py'), encoding='utf-8').read()
G = {'__file__': os.path.join(HERE, 'c7_test.py'), '__name__': 'c7a'}
exec(SRC.split('# ---------- 0)')[0], G)   # imports, bancos, ck, tmp
exec('ERR = []\n' + SRC.split('ERR = []')[1].split('HIER =')[0], G)   # fresh, fill, rep, ins, add, paste, NOD3
globals().update(G)
NOD = NOD3
def lines(pg): return rep(pg)
def nodidx(L): return [i for i, l in enumerate(L) if re.search(r'BI-RADS-US (?!_)', l) and not l.startswith('Classifica')]
def blanks_between(L, a, b): return all(l.strip() == '' for l in L[a + 1:b]) and b - a - 1
def dbl_blank(L): return any(L[i].strip() == '' and L[i + 1].strip() == '' for i in range(len(L) - 1))
def seps(pg): return pg.evaluate("document.querySelectorAll('#editor [data-brsep]').length")
def inp(pg): pg.evaluate("document.getElementById('editor').dispatchEvent(new Event('input', {bubbles: true}))"); pg.wait_for_timeout(300)
bank = REAL if REAL and os.path.exists(REAL) else tmp(OWN)
with sync_playwright() as p:
    b = p.chromium.launch()
    # 1) modelo real: nódulo do modelo + adicionado
    pg = fresh(b, bank); L0 = lines(pg)
    fill(pg, NOD); ins(pg); add(pg); fill(pg, dict(NOD, lado='esquerda', hora='2', cat='3')); ins(pg); L = lines(pg); n = nodidx(L)
    usa_branco = any(l.strip() == '' for l in L0)
    ck('1 dois nódulos, cada um em linha própria', len(n) == 2 and 'mama direita' in L[n[0]] and 'mama esquerda' in L[n[1]], n)
    ck('1 separação igual à do laudo (%s)' % ('linha em branco' if usa_branco else 'uma linha por frase'), (blanks_between(L, n[0], n[1]) == 1) if usa_branco else n[1] == n[0] + 1, L[n[0]:n[1] + 2])
    ck('1 sem duas linhas em branco seguidas a mais que o modelo', dbl_blank(L) == dbl_blank(L0))
    ck('1 linha depois do 2º nódulo segue o padrão', (L[n[1] + 1].strip() == '') == (L[n[0] + 1].strip() == '' if not usa_branco else True))
    # 2) três nódulos
    add(pg); fill(pg, dict(NOD, hora='5', cat='2')); ins(pg); L = lines(pg); n = nodidx(L)
    ck('2 três nódulos em ordem, um por parágrafo', len(n) == 3 and 'às 5 horas' in L[n[2]] and all((blanks_between(L, n[i], n[i + 1]) == 1) if usa_branco else n[i + 1] == n[i] + 1 for i in range(2)), n)
    ck('2 nenhuma linha em branco dupla nova', dbl_blank(L) == dbl_blank(L0))
    # 3) remover o 2º nódulo (linha apagada): a linha em branco extra some
    pg.evaluate("""() => { var d = UFBirads.scan().nod[1].f; while (!(d.tagName === 'DIV' && d.parentNode.children.length > 3)) d = d.parentNode; d.parentNode.removeChild(d); }"""); inp(pg)
    L = lines(pg); n = nodidx(L)
    if len(n) != 2: print(n, L)
    ck('3 removido o 2º: dois nódulos e sem linha em branco sobrando', len(n) == 2 and dbl_blank(L) == dbl_blank(L0) and ((blanks_between(L, n[0], n[1]) == 1) if usa_branco else n[1] == n[0] + 1), L[n[0]:n[-1] + 2])
    # 4) desfazer (Ctrl+Z) a inserção do 3º: volta ao laudo anterior sem sobra
    pg.click('#editor'); pg.keyboard.press('Control+z'); pg.wait_for_timeout(300); L = lines(pg)
    ck('4 Ctrl+Z não deixa linha em branco dupla', not dbl_blank(L) or dbl_blank(L0), L)
    # 5) apagar o texto do último nódulo (linha fica vazia) e então a linha: nada sobra
    pg.evaluate("""() => { var n = UFBirads.scan().nod; var d = n[n.length - 1].f; while (!(d.tagName === 'DIV' && d.parentNode.children.length > 3)) d = d.parentNode; d.parentNode.removeChild(d); }"""); inp(pg)
    L = lines(pg); ck('5 último nódulo adicionado removido: sem linhas em branco sobrando', dbl_blank(L) == dbl_blank(L0) and seps(pg) == 0, L)
    pg.context.close()
    # 6) laudo vazio: nódulo entra sem linha em branco antes
    pg = fresh(b, bank); pg.evaluate("document.getElementById('editor').innerHTML='<div><br></div>'"); inp(pg)
    fill(pg, NOD); ins(pg); add(pg); fill(pg, dict(NOD, lado='esquerda', cat='3')); ins(pg); L = lines(pg); n = nodidx(L)
    ck('6 laudo vazio (sem convenção visível): dois nódulos em linhas próprias, sem linha em branco dupla nem marcador', len(n) == 2 and n[1] == n[0] + 1 and not dbl_blank(L) and seps(pg) == 0, L)
    pg.context.close()
    # 7) nódulo no fim do texto sem quebra final
    pg = fresh(b, bank)
    fill(pg, NOD); ins(pg)
    pg.evaluate("""() => { var d = UFBirads.scan().nod[0].f; while (!(d.tagName === 'DIV' && d.parentNode.children.length > 3)) d = d.parentNode; var e = document.getElementById('editor'); for (var x = d; x && x !== e; x = x.parentNode) { while (x.nextSibling) x.parentNode.removeChild(x.nextSibling); } }"""); inp(pg)
    add(pg); fill(pg, dict(NOD, lado='esquerda', cat='3')); ins(pg); L = lines(pg); n = nodidx(L)
    ck('7 nódulo no fim do texto: o novo vem depois, em parágrafo próprio, e é o fim', len(n) == 2 and n[1] == len(L) - 1 or (len(n) == 2 and all(l.strip() == '' for l in L[n[1] + 1:])), L[-4:])
    ck('7 separação igual à do laudo', (blanks_between(L, n[0], n[1]) == 1) if usa_branco else n[1] == n[0] + 1)
    pg.context.close()
    # 8) colar laudo com 2 nódulos (separados por linha em branco) e reconhecer ambos; o 3º segue o padrão
    pg = fresh(b, bank)
    fill(pg, NOD); ins(pg); add(pg); fill(pg, dict(NOD, lado='esquerda', cat='4A')); ins(pg)
    txt = '\n'.join(lines(pg)).replace('BI-RADS-US 3.', 'BI-RADS-US 3.', 1)
    paste(pg, txt); cats = pg.evaluate("UFBirads.scan().nod.map(function(n){return n.cat})")
    ck('8 colado: os 2 nódulos reconhecidos (3 e 4A)', cats == ['3', '4A'], cats)
    ck('8 Classificação 4A', clas(pg) == 'Classificação: BI-RADS-US 4A.', clas(pg))
    add(pg); fill(pg, dict(NOD, hora='7', cat='2')); ins(pg); L = lines(pg); n = nodidx(L)
    ck('8 3º nódulo depois dos colados, em parágrafo próprio', len(n) == 3 and 'às 7 horas' in L[n[2]] and ((blanks_between(L, n[1], n[2]) == 1) if usa_branco else n[2] == n[1] + 1), L[n[0]:n[-1] + 2])
    pg.context.close()
    # 9) banco de uma linha por frase (sem linhas em branco): nenhuma linha em branco é criada
    pg = fresh(b, tmp(OWN)); fill(pg, NOD); ins(pg); add(pg); fill(pg, dict(NOD, lado='esquerda', cat='3')); ins(pg); L = lines(pg); n = nodidx(L)
    ck('9 laudo de uma linha por frase: o novo nódulo na linha seguinte, sem linha em branco', len(n) == 2 and n[1] == n[0] + 1 and seps(pg) == 0, L[n[0]:n[1] + 1])
    pg.context.close()
    ck('sem erros de página', not ERR, ERR[:3])
    b.close()
print('%d/%d' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
