@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Local website build is missing. Build the project first.
  pause
  exit /b 1
)
echo Local website: http://127.0.0.1:4321/boards/
echo This preview is available on this computer only. Press Ctrl+C to stop.
set "HAEIN_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%HAEIN_PYTHON%" (
  "%HAEIN_PYTHON%" -u -m http.server 4321 --bind 127.0.0.1 --directory dist
) else (
  py -3 -u -m http.server 4321 --bind 127.0.0.1 --directory dist
)
