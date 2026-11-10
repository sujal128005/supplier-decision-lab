@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
) else (
  echo Node.js not found, trying Python...
  start "" http://localhost:8080
  python -m http.server 8080
)
