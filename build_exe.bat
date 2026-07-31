@echo off
title Airbase — Build Standalone Executable
cls

echo =========================================================================
echo                 AIRBASE — BUILD STANDALONE EXECUTABLE
echo =========================================================================
echo.
echo This script will compile Airbase into a standalone Windows executable.
echo No Python required to run the output!
echo.

:: 1. Check for virtual environment
if not exist ".venv\Scripts\python.exe" (
    echo [1/4] Creating virtual environment...
    py -m venv .venv
    if %errorlevel% neq 0 (
        python -m venv .venv
    )
)

:: 2. Install all dependencies including pyinstaller
echo [2/4] Installing dependencies and PyInstaller...
call .venv\Scripts\activate.bat
pip install --quiet -r requirements.txt
pip install --quiet pyinstaller pystray

:: 3. Clean previous build artifacts
echo [3/4] Cleaning previous build...
if exist "build" rmdir /s /q build
if exist "dist\Airbase" rmdir /s /q dist\Airbase

:: 4. Compile with PyInstaller
echo [4/4] Compiling Airbase.exe (this may take 1-3 minutes)...
pyinstaller airbase.spec --noconfirm

:: Check build success
if exist "dist\Airbase\Airbase.exe" (
    echo.
    echo =========================================================================
    echo  BUILD SUCCESSFUL!
    echo =========================================================================
    echo.
    echo  Output: dist\Airbase\Airbase.exe
    echo.
    echo  To distribute Airbase, zip the entire dist\Airbase\ folder.
    echo  Anyone can double-click Airbase.exe without installing Python!
    echo.
    echo  Opening output folder now...
    echo =========================================================================
    start explorer "dist\Airbase"
) else (
    echo.
    echo =========================================================================
    echo  BUILD FAILED — Check the output above for errors.
    echo =========================================================================
)

pause
