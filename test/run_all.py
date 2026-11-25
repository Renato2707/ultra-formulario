# -*- coding: utf-8 -*-
"""Roda todos os testes em test/ em sequência e imprime um resumo final.

Uso (na raiz do repositório, Linux ou Windows):

    python test/run_all.py
    python test/run_all.py --viewport 1366x768
    python test/run_all.py --browser "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    python test/run_all.py --only c11,c11b

Variáveis: UF_VP / UF_VIEWPORT (ex.: 1024x600), UF_BROWSER ou UF_CHROME
(caminho do Chrome/Chromium/Edge), UF_BANCO (banco fora do repo, opcional),
UF_HEADLESS=0 para ver a janela.

O parser-test.html é manual (abre no navegador) e não entra nesta suíte.
placement_test.py roda só no modo --diretivas, com banco genérico embutido
(sem o banco clínico).
"""
from __future__ import print_function

import argparse
import os
import re
import sys
import time
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import uf_testutil  # noqa: E402


COUNT_RE = re.compile(
    r'(?:RESUMO\s+)?(\d+)\s*/\s*(\d+)\s*(?:passed|passaram|PASS|OK)?\s*$',
    re.I,
)
TOTAL_RE = re.compile(r'^TOTAL\s+(\d+)\s*/\s*(\d+)\s*$', re.I)


def discover():
    files = []
    for name in sorted(os.listdir(HERE)):
        if not name.endswith('_test.py'):
            continue
        if name.startswith('_') or name == 'run_all.py':
            continue
        files.append(os.path.join(HERE, name))
    placement = os.path.join(HERE, 'placement_test.py')
    if os.path.isfile(placement) and placement not in files:
        files.append(placement)
    return files


def parse_counts(output):
    got = None
    for line in (output or '').splitlines():
        s = line.strip()
        m = TOTAL_RE.match(s) or COUNT_RE.search(s)
        if m:
            got = (int(m.group(1)), int(m.group(2)))
    return got


def run_one(path, timeout, extra_args=None):
    env = os.environ.copy()
    pp = env.get('PYTHONPATH', '')
    env['PYTHONPATH'] = HERE + (os.pathsep + pp if pp else '')
    ac = uf_testutil.ensure_acorn()
    if ac:
        env.setdefault('UF_ACORN', ac)
        dest = '/tmp/ac/node_modules/acorn'
        if os.name != 'nt' and os.path.isdir(ac) and not os.path.exists(dest):
            try:
                os.makedirs('/tmp/ac/node_modules', exist_ok=True)
                os.symlink(ac, dest)
            except OSError:
                pass

    # Run via a tiny wrapper so patches apply even when the test is invoked directly.
    wrapper = (
        'import sys, runpy\n'
        'sys.path.insert(0, %r)\n'
        'import uf_testutil\n'
        'uf_testutil.install()\n'
        'sys.argv = sys.argv[1:]\n'
        'runpy.run_path(sys.argv[0], run_name="__main__")\n'
    ) % HERE
    cmd = [sys.executable, '-c', wrapper, path] + list(extra_args or [])
    t0 = time.time()
    try:
        proc = subprocess.run(
            cmd, cwd=uf_testutil.repo_root(), env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            timeout=timeout,
        )
        out = proc.stdout.decode('utf-8', 'replace')
        rc = proc.returncode
        timed_out = False
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or b'').decode('utf-8', 'replace')
        out += '\n[TIMEOUT após %ss]\n' % timeout
        rc = 124
        timed_out = True
    elapsed = time.time() - t0
    return rc, out, elapsed, timed_out


def main(argv=None):
    ap = argparse.ArgumentParser(description='Roda todos os testes em test/ e imprime um resumo.')
    ap.add_argument('--viewport', default=None, help='Ex.: 1024x600 ou 1366x768 (também UF_VP)')
    ap.add_argument('--browser', default=None, help='Caminho do Chrome, Chromium ou Edge (também UF_BROWSER)')
    ap.add_argument('--timeout', type=int, default=900, help='Segundos máximos por arquivo (padrão 900)')
    ap.add_argument('--only', default=None, help='Lista de nomes parciais separados por vírgula (ex.: c11,c6o)')
    ap.add_argument('--list', action='store_true', help='Só lista os arquivos e sai')
    args = ap.parse_args(argv)

    if args.viewport:
        os.environ['UF_VP'] = args.viewport
    if args.browser:
        os.environ['UF_BROWSER'] = args.browser

    files = discover()
    if args.only:
        keys = [k.strip().lower() for k in args.only.split(',') if k.strip()]
        files = [f for f in files if any(k in os.path.basename(f).lower() for k in keys)]
        if not files:
            print('Nenhum teste corresponde a --only %s' % args.only, file=sys.stderr)
            return 2

    if args.list:
        for f in files:
            print(os.path.relpath(f, uf_testutil.repo_root()))
        return 0

    uf_testutil.install()
    ac = uf_testutil.ensure_acorn()
    vp = uf_testutil.viewport_from_env()
    exe = os.environ.get('UF_BROWSER') or os.environ.get('UF_CHROME') or uf_testutil.find_browser_executable()
    print('Raiz:     %s' % uf_testutil.repo_root())
    print('Python:   %s' % sys.executable)
    print('Navegador:%s' % (exe or 'Chromium do Playwright (padrão)'))
    print('Viewport: %s' % ('%dx%d (UF_VP)' % (vp['width'], vp['height']) if vp else 'o de cada teste (não forçado)'))
    print('Acorn:    %s' % (ac or 'não encontrado (c7 avisará)'))
    print('Arquivos: %d' % len(files))
    print('')

    rows = []
    for path in files:
        rel = os.path.relpath(path, uf_testutil.repo_root()).replace('\\', '/')
        extra = ['--diretivas'] if os.path.basename(path) == 'placement_test.py' else []
        print('>>> %s' % rel, flush=True)
        rc, out, elapsed, timed_out = run_one(path, args.timeout, extra)
        sys.stdout.write(out)
        if not out.endswith('\n'):
            print('')
        counts = parse_counts(out)
        ok = (rc == 0) and not timed_out
        rows.append({
            'file': rel, 'ok': ok, 'rc': rc, 'elapsed': elapsed,
            'counts': counts, 'timed_out': timed_out,
        })
        if counts:
            status = 'PASS' if ok else 'FAIL'
            print('--- %s %s  %d/%d  %.1fs%s' % (
                status, rel, counts[0], counts[1], elapsed,
                ' TIMEOUT' if timed_out else '',
            ), flush=True)
        else:
            print('--- %s %s  rc=%s  %.1fs%s' % (
                'PASS' if ok else 'FAIL', rel, rc, elapsed,
                ' TIMEOUT' if timed_out else '',
            ), flush=True)
        print('', flush=True)

    # Summary
    print('=' * 64)
    print('RESUMO')
    print('=' * 64)
    width = max(len(r['file']) for r in rows) if rows else 20
    n_pass = n_fail = t_ok = t_all = 0
    failed = []
    for r in rows:
        if r['ok']:
            tag = 'PASS'
            n_pass += 1
        else:
            tag = 'FAIL'
            n_fail += 1
            failed.append(r['file'])
        if r['counts']:
            cnt = '%d/%d' % r['counts']
            t_ok += r['counts'][0]
            t_all += r['counts'][1]
        else:
            cnt = 'rc=%s' % r['rc']
        extra = ' TIMEOUT' if r['timed_out'] else ''
        print('%-4s  %-*s  %8s  %6.1fs%s' % (tag, width, r['file'], cnt, r['elapsed'], extra))

    print('-' * 64)
    print('Arquivos: %d passou, %d falhou, %d no total' % (n_pass, n_fail, len(rows)))
    if t_all:
        print('Casos:    %d passou, %d falhou, %d no total (pelas linhas de contagem)' % (
            t_ok, t_all - t_ok, t_all,
        ))
    if failed:
        print('Falhou:   %s' % ' '.join(failed))
    print('parser-test.html não entra nesta suíte (abrir no navegador).')
    return 0 if n_fail == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
