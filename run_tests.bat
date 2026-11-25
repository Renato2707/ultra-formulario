@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -3 test\run_all.py %*
  exit /b %ERRORLEVEL%
)
where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python test\run_all.py %*
  exit /b %ERRORLEVEL%
)
echo Python nao encontrado. Instale Python 3 e o Playwright:
echo   pip install playwright
echo   python -m playwright install chromium
exit /b 1
