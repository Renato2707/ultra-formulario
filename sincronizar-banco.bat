@echo off
rem Sincroniza o banco de frases entre pendrive, Google Drive e GitHub (privado).
rem Duplo clique para rodar. Para so conferir sem copiar nada, use "sincronizar-banco (so conferir).bat".
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sincronizar-banco.ps1"
echo.
pause
