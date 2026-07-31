@echo off
title Home LAN Share - Local Network File Hub
cls

echo =========================================================================
echo                    HOME LAN SHARE - STARTUP LAUNCHER
echo =========================================================================
echo.

:: 1. Check if virtual environment already exists
if exist ".venv\Scripts\python.exe" (
    set "PY_BIN=.venv\Scripts\python.exe"
    goto HAVE_VENV
)

:: 2. Find system Python launcher (try 'python' then 'py')
set "PY_LAUNCHER="

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_LAUNCHER=python"
    goto CREATE_VENV
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_LAUNCHER=py"
    goto CREATE_VENV
)

:: 3. If no Python found
color 0C
echo =========================================================================
echo [ERROR] PYTHON WAS NOT FOUND ON THIS LAPTOP
echo =========================================================================
echo.
echo Home LAN Share requires Python to run.
echo Opening the official Python download page in your browser...
start https://www.python.org/downloads/
echo.
echo Press any key to exit...
pause
exit /b 1

:CREATE_VENV
echo [1/3] Creating virtual environment (.venv) using %PY_LAUNCHER%...
%PY_LAUNCHER% -m venv .venv
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to create virtual environment with %PY_LAUNCHER%.
    echo Press any key to exit...
    pause
    exit /b 1
)
set "PY_BIN=.venv\Scripts\python.exe"

:HAVE_VENV
echo [2/3] Installing dependencies (Flask, qrcode, Pillow)...
"%PY_BIN%" -m pip install --quiet -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Pip install encountered a non-fatal warning, proceeding...
)

echo [3/3] Launching web browser at http://localhost:5000 ...
start http://localhost:5000

echo.
echo =========================================================================
echo  SERVER IS RUNNING! DO NOT CLOSE THIS TERMINAL WINDOW WHILE SHARING.
echo =========================================================================
echo.
echo  - Windows Firewall: If prompted, click "Allow access" on Private networks.
echo  - Laptop Power:    Keep laptop awake while file sharing is active.
echo  - Shared Folder:   SharedFiles\ next to this script.
echo.
echo =========================================================================
echo.

:: Run system tray version if pystray available, else fallback to terminal server
python -c "import pystray" 2>nul
if %errorlevel% equ 0 (
    echo Starting Airbase in system tray mode...
    python share_server_gui.py
) else (
    echo Starting Airbase in terminal mode...
    python share_server.py
)

echo.
echo =========================================================================
echo Server stopped.
echo =========================================================================
pause
