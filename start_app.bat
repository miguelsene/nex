@echo off
start "Servidor" cmd /k "cd /d ""C:\Users\user\Downloads\nexa-videocall\videocall\server"" && npm run dev"
start "Frontend" cmd /k "cd /d ""C:\Users\user\Downloads\nexa-videocall\videocall\client"" && npm run dev -- --host 0.0.0.0"


