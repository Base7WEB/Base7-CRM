@echo off
title BASE7 CRM PRO
color 0B

echo.
echo  ============================================
echo    BASE7 CRM PRO - Iniciando...
echo  ============================================
echo.

cd /d "%~dp0backend"

echo  [1/3] Verificando Python...
python --version
if errorlevel 1 (
    echo  ERRO: Python nao encontrado. Instale em python.org
    pause
    exit /b
)

echo  [2/3] Instalando dependencias...
pip install -r requirements.txt -q

echo  [3/3] Instalando browser do Playwright...
python -m playwright install chromium

echo.
echo  Iniciando servidor backend (esta janela = backend)...
echo  Nao feche esta janela!
echo.

start "" "http://localhost:5000"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5000"

python app.py

echo.
echo  BACKEND ENCERRADO. Se houve erro, leia acima.
pause
