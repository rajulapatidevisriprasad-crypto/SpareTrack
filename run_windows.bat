@echo off
echo.
echo   ╔══════════════════════════════════════════════════╗
echo   ║   SpareTrack v2.0                               ║
echo   ║   Billing, Inventory, Customers, Reports         ║
echo   ╚══════════════════════════════════════════════════╝
echo.

SET DIR=%~dp0
SET BACKEND=%DIR%backend
SET VENV=%BACKEND%\venv

IF NOT EXIST "%VENV%" (
    echo [Setup] Creating virtual environment...
    python -m venv "%VENV%"
    IF ERRORLEVEL 1 ( echo [ERROR] Python not found. Please install Python 3.8+ & pause & exit /b 1 )
)

echo [Setup] Installing dependencies...
"%VENV%\Scripts\pip.exe" install -q flask flask-cors reportlab openpyxl

echo [Flask] Starting server...
start /B "" "%VENV%\Scripts\python.exe" "%BACKEND%\app.py"

echo [Wait] Starting up...
timeout /t 4 /nobreak > nul

IF EXIST "%DIR%node_modules\" (
    echo [Electron] Launching desktop app...
    cd /d "%DIR%"
    npx electron . 2>nul
) ELSE (
    echo [Browser] Opening at http://localhost:5000
    start http://localhost:5000
    echo.
    echo Server running. Close this window to stop.
    pause
)
