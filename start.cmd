@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Цирк Тимоши

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Не найден Node.js. Установи его с https://nodejs.org и запусти этот файл снова.
  echo.
  pause
  exit /b 1
)

start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:1717/ & start "" http://localhost:1717/admin"
node server\server.js

echo.
echo   Сервер остановлен. Окно можно закрывать.
pause
