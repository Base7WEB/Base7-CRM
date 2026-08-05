@echo off
cd /d "%~dp0"

if not exist ".env" (
  echo.
  echo [ERRO] Arquivo .env nao encontrado. Rode instalar.bat primeiro e configure o .env.
  echo.
  pause
  exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
  echo.
  echo [ERRO] Ambiente virtual nao encontrado. Rode instalar.bat primeiro.
  echo.
  pause
  exit /b 1
)

call venv\Scripts\activate.bat

echo.
echo ============================================
echo   BASE7 CRM - Prospeccao (fila)
echo ============================================
echo Deixe esta janela aberta. Toda busca pedida
echo na tela Prospeccao do CRM sera feita aqui
echo automaticamente.
echo.
echo Para DESLIGAR, so fechar esta janela.
echo ============================================
echo.

python run.py watch

echo.
pause
