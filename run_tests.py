# -*- coding: utf-8 -*-
"""Atalho na raiz: python run_tests.py  [mesmos argumentos de test/run_all.py]."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'test'))
from run_all import main  # noqa: E402

if __name__ == '__main__':
    sys.exit(main())
