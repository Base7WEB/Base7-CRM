@echo off
cd /d "%~dp0"

echo ============================================
echo   BASE7 CRM - Instalacao do scraper
echo   (rodar so uma vez, ou quando der problema)
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python nao encontrado. Instale o Python 3 antes de continuar ^(python.org^).
  pause
  exit /b 1
)

echo Criando ambiente virtual...
python -m venv venv
if errorlevel 1 (
  echo [ERRO] Falha ao criar o ambiente virtual.
  pause
  exit /b 1
)

call venv\Scripts\activate.bat

echo Instalando dependencias Python...
pip install -r requirements.txt
if errorlevel 1 (
  echo [ERRO] Falha ao instalar dependencias.
  pause
  exit /b 1
)

echo Instalando navegador do Playwright...
python -m playwright install chromium

if not exist ".env" (
  copy .env.example .env >nul
  echo.
  echo Criei o arquivo .env a partir do exemplo -- abra ele e cole o token
  echo gerado no CRM ^(Consultores -^> Gerar token^) antes de rodar uma busca.
)

echo.
echo ============================================
echo Instalacao concluida!
echo Use buscar-leads.bat para rodar uma busca.
echo ============================================
pause
