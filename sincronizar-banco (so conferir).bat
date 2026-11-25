@echo off
rem So confere e mostra o que seria feito. Nao copia, nao apaga e nao envia nada.
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sincronizar-banco.ps1" -Simular
echo.
pause
