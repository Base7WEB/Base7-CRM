@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

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
echo   BASE7 CRM - Busca de leads
echo ============================================
echo 1 - Google Maps
echo 2 - Instagram ^(experimental^)
echo.
set /p MODO="Escolha (1 ou 2): "

if "%MODO%"=="2" goto instagram

:maps
echo.
set /p NICHO="Nicho/categoria (ex: Barbearia): "
set /p CIDADE="Cidade (ex: Campinas, SP): "
set /p RATING="Avaliacao minima no Google, 0 a 5 (Enter = sem filtro): "
set /p MAX="Quantidade maxima de resultados (Enter = 20): "
if "%RATING%"=="" set RATING=0
if "%MAX%"=="" set MAX=20
echo.
echo Buscando "%NICHO%" em "%CIDADE%" (rating >= %RATING%, ate %MAX% resultados)...
echo.
python run.py maps --nicho "%NICHO%" --cidade "%CIDADE%" --rating-min %RATING% --max-resultados %MAX%
goto fim

:instagram
echo.
set /p HASHTAG="Hashtag, sem # (ex: barbeariacampinas): "
set /p MAX="Quantidade maxima de resultados (Enter = 20): "
if "%MAX%"=="" set MAX=20
echo.
echo Buscando #%HASHTAG% no Instagram...
echo.
python run.py instagram --hashtag "%HASHTAG%" --max-resultados %MAX%
goto fim

:fim
echo.
pause
