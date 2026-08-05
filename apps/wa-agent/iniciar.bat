@echo off
cd /d "%~dp0"

if not exist ".env" (
  echo.
  echo [ERRO] Arquivo .env nao encontrado nesta pasta.
  echo Copie .env.example para .env e cole o token gerado no CRM ^(Consultores -^> Gerar token WhatsApp^) antes de continuar.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Primeira vez rodando aqui -- instalando dependencias, aguarde...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   BASE7 CRM - Agente de WhatsApp
echo ============================================
echo Se aparecer um QR code, escaneie com o WhatsApp
echo em Aparelhos conectados. Depois da primeira vez
echo nao precisa escanear de novo.
echo.
echo Para DESLIGAR o agente, so fechar esta janela.
echo ============================================
echo.

call npm start

echo.
echo O agente parou. Feche esta janela ou pressione uma tecla.
pause >nul
