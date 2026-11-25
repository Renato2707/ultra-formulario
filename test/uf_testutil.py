# -*- coding: utf-8 -*-
"""Helpers partilhados pelos testes Playwright do Ultra Formulário.

Usado pelo test/run_all.py (instala patches antes de cada arquivo) e
importável nos testes que precisam de caminho do repositório, banco de
exemplo ou navegador. Não altera o comportamento do app (js/*.js).
"""
from __future__ import print_function

import os
import sys
import shutil
import tempfile
import pathlib

_installed = False


def repo_root():
    return str(pathlib.Path(__file__).resolve().parent.parent)


def index_path():
    return os.path.join(repo_root(), 'index.html')


def index_url():
    return pathlib.Path(index_path()).resolve().as_uri()


def parse_viewport(text):
    if not text:
        return None
    text = text.strip().lower().replace(' ', '')
    if 'x' not in text:
        raise ValueError('viewport esperado no formato LARGURAxALTURA, ex.: 1366x768')
    w, h = text.split('x', 1)
    return {'width': int(w), 'height': int(h)}


def viewport_from_env():
    return parse_viewport(os.environ.get('UF_VP') or os.environ.get('UF_VIEWPORT') or '')


def find_browser_executable():
    """Chrome, Chromium ou Edge: variável de ambiente, depois PATH, depois caminhos usuais."""
    env = os.environ.get('UF_BROWSER') or os.environ.get('UF_CHROME')
    if env:
        if os.path.isfile(env):
            return env
        found = shutil.which(env)
        if found:
            return found
        print('aviso: UF_BROWSER/UF_CHROME=%r nao encontrado, tentando outros' % env, file=sys.stderr)

    names = []
    extra = []
    plat = sys.platform
    if plat.startswith('win') or os.name == 'nt':
        names = ['msedge', 'chrome', 'chromium']
        roots = [
            os.environ.get('PROGRAMFILES', r'C:\Program Files'),
            os.environ.get('PROGRAMFILES(X86)', r'C:\Program Files (x86)'),
            os.environ.get('LOCALAPPDATA', ''),
        ]
        rels = [
            r'Microsoft\Edge\Application\msedge.exe',
            r'Google\Chrome\Application\chrome.exe',
            r'Chromium\Application\chrome.exe',
        ]
        for root in roots:
            if not root:
                continue
            for rel in rels:
                p = os.path.join(root, rel)
                if os.path.isfile(p):
                    extra.append(p)
    elif plat == 'darwin':
        names = ['google-chrome', 'chromium', 'microsoft-edge', 'chrome']
        extra = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
    else:
        names = [
            'google-chrome', 'google-chrome-stable', 'chromium',
            'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'chrome',
        ]
        extra = [
            '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium', '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge', '/snap/bin/chromium',
        ]

    for p in extra:
        if p and os.path.isfile(p):
            return p
    for n in names:
        w = shutil.which(n)
        if w:
            return w
    return None


def launch_kwargs(extra=None):
    """Argumentos para playwright chromium.launch(), sem caminhos fixos."""
    kw = dict(extra or {})
    exe = find_browser_executable()
    # Playwright bundled Chromium is preferred unless the user asked for a specific binary.
    if os.environ.get('UF_BROWSER') or os.environ.get('UF_CHROME') or os.environ.get('UF_USE_SYSTEM_BROWSER') == '1':
        if exe:
            kw['executable_path'] = exe
    args = list(kw.get('args') or [])
    if sys.platform.startswith('linux') and '--no-sandbox' not in args:
        args.append('--no-sandbox')
    if os.environ.get('UF_HEADLESS', '1') in ('0', 'false', 'no'):
        kw['headless'] = False
    kw['args'] = args
    return kw


def launch_chromium(playwright, **extra):
    kw = launch_kwargs(extra)
    try:
        return playwright.chromium.launch(**kw)
    except Exception as first:
        exe = find_browser_executable()
        if exe and kw.get('executable_path') != exe:
            kw['executable_path'] = exe
            try:
                return playwright.chromium.launch(**kw)
            except Exception:
                pass
        last = first
        for ch in ('chrome', 'msedge', 'chromium'):
            kw2 = dict(kw)
            kw2.pop('executable_path', None)
            kw2['channel'] = ch
            try:
                return playwright.chromium.launch(**kw2)
            except Exception as e:
                last = e
        raise last


# Banco genérico para testes de sessão (c10): nomes no formato atual "X (padrão)".
# Texto curto e inventado; não é o banco clínico do usuário.
SESSION_BANK = (
    "@@EXAME Abdome Total\n"
    "@@EXAME_FULL ULTRASSONOGRAFIA DE ABDÔMEN TOTAL\n"
    "@@TEMPLATE Abdome Total (padrão)\n"
    "ULTRASSONOGRAFIA DE ABDÔMEN TOTAL\n"
    "Fígado de ecotextura homogênea, genérico de teste.\n"
    "Vesícula sem cálculos neste banco de teste.\n"
    "Pâncreas e baço descritos só para o teste de sessões.\n"
    "\n"
    "@@EXAME Transvaginal\n"
    "@@EXAME_FULL ULTRASSONOGRAFIA TRANSVAGINAL\n"
    "@@TEMPLATE Transvaginal (padrão)\n"
    "ULTRASSONOGRAFIA TRANSVAGINAL\n"
    "Útero e ovários em texto genérico de teste, sem frases clínicas reais.\n"
    "\n"
    "@@EXAME Obstétrica de 1º Trimestre\n"
    "@@EXAME_FULL ULTRASSONOGRAFIA OBSTÉTRICA DE PRIMEIRO TRIMESTRE\n"
    "@@TEMPLATE Obstétrica de 1º Trimestre (padrão)\n"
    "ULTRASSONOGRAFIA OBSTÉTRICA DE PRIMEIRO TRIMESTRE\n"
    "Texto genérico de obstétrica para o teste de sessões.\n"
    "\n"
    "@@EXAME Doppler de Fluxo Obstétrico\n"
    "@@EXAME_FULL ULTRASSONOGRAFIA DOPPLER DE FLUXO OBSTÉTRICO\n"
    "@@TEMPLATE Doppler de Fluxo Obstétrico (padrão)\n"
    "ULTRASSONOGRAFIA DOPPLER DE FLUXO OBSTÉTRICO\n"
    "Texto genérico de Doppler para o teste de sessões.\n"
)


def write_temp_bank(text):
    f = tempfile.NamedTemporaryFile('wb', suffix='.txt', delete=False)
    f.write(text.replace('\n', '\r\n').encode('utf-8'))
    f.close()
    return f.name


def resolve_bank_path(default_text=None):
    """UF_BANCO se existir; senão grava o banco de exemplo (nunca um caminho /workspace fixo)."""
    env = os.environ.get('UF_BANCO')
    if env and os.path.isfile(env):
        return env
    text = default_text if default_text is not None else SESSION_BANK
    return write_temp_bank(text)


def ensure_acorn():
    """Devolve o diretório do pacote acorn, instalando-o se o npm estiver disponível."""
    candidates = [
        os.environ.get('UF_ACORN'),
        os.path.join(tempfile.gettempdir(), 'uf-acorn', 'node_modules', 'acorn'),
        os.path.join(tempfile.gettempdir(), 'ac', 'node_modules', 'acorn'),
        '/tmp/ac/node_modules/acorn',
        os.path.join(repo_root(), 'node_modules', 'acorn'),
    ]
    for p in candidates:
        if p and os.path.isdir(p):
            return p
    npm = shutil.which('npm')
    if not npm:
        return None
    dest = os.path.join(tempfile.gettempdir(), 'uf-acorn')
    os.makedirs(dest, exist_ok=True)
    try:
        import subprocess
        r = subprocess.run(
            [npm, 'install', '--prefix', dest, 'acorn@8', '--no-fund', '--no-audit', '--silent'],
            capture_output=True, text=True, timeout=120,
        )
        p = os.path.join(dest, 'node_modules', 'acorn')
        if r.returncode == 0 and os.path.isdir(p):
            return p
    except Exception:
        return None
    return None


def _patch_launch():
    from playwright.sync_api._generated import BrowserType
    orig = BrowserType.launch

    def launch(self, *a, **k):
        exe_req = k.get('executable_path')
        if exe_req and not os.path.isfile(exe_req):
            k.pop('executable_path', None)
        base = launch_kwargs()
        args = list(base.get('args') or [])
        for extra in (k.get('args') or []):
            if extra not in args:
                args.append(extra)
        k['args'] = args
        if 'headless' in base and 'headless' not in k:
            k['headless'] = base['headless']
        if 'executable_path' not in k and base.get('executable_path'):
            k['executable_path'] = base['executable_path']
        try:
            return orig(self, *a, **k)
        except Exception as first:
            exe = find_browser_executable()
            if exe and k.get('executable_path') != exe:
                k['executable_path'] = exe
                try:
                    return orig(self, *a, **k)
                except Exception:
                    pass
            last = first
            for ch in ('chrome', 'msedge', 'chromium'):
                k2 = dict(k)
                k2.pop('executable_path', None)
                k2['channel'] = ch
                try:
                    return orig(self, *a, **k2)
                except Exception as e:
                    last = e
            raise last

    BrowserType.launch = launch


def _patch_viewport():
    vp = viewport_from_env()
    if not vp:
        return
    from playwright.sync_api._generated import Browser
    orig_ctx = Browser.new_context
    orig_page = Browser.new_page

    def new_context(self, *a, **k):
        k['viewport'] = vp
        return orig_ctx(self, *a, **k)

    def new_page(self, *a, **k):
        k['viewport'] = vp
        return orig_page(self, *a, **k)

    Browser.new_context = new_context
    Browser.new_page = new_page


def _patch_scroll_into_view():
    """Clique por bounding_box falha em 1024x600 se o campo está fora da área visível."""
    from playwright.sync_api._generated import Locator
    orig = Locator.bounding_box

    def bounding_box(self, *a, **k):
        try:
            self.scroll_into_view_if_needed(timeout=3000)
        except Exception:
            pass
        return orig(self, *a, **k)

    Locator.bounding_box = bounding_box


def install():
    global _installed
    if _installed:
        return
    _installed = True
    try:
        _patch_launch()
        _patch_viewport()
        _patch_scroll_into_view()
    except ImportError:
        pass
