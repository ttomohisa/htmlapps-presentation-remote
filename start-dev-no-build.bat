@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0dist\index.html" (
  echo dist\index.html does not exist. Run start-dev.bat first.
  pause
  exit /b 1
)

where pwsh.exe >nul 2>nul
if %errorlevel%==0 (
  pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1" -SkipBuild
) else (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1" -SkipBuild
)

if errorlevel 1 (
  echo.
  echo Development server failed.
  pause
)
endlocal
