@echo off
title SKYFALL - server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 18+ or run with Python:
  echo   python -m http.server 8080
  pause
  exit /b 1
)
node server.js
pause
