@echo off
echo Iniciando backend...
start "Servidor" cmd /k "cd /d ""C:\Users\user\Downloads\nexa-videocall\videocall\server"" && npm run dev"

echo Iniciando frontend...
start "Frontend" cmd /k "cd /d ""C:\Users\user\Downloads\nexa-videocall\videocall\client"" && npm run dev -- --host 0.0.0.0"

echo Pronto.
echo Abra: http://localhost:5173
exit