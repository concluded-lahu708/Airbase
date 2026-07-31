@echo off
title Airbase — Push to GitHub (SakethGoljana/Airbase)
cls

echo =========================================================================
echo             AIRBASE — PUSH TO GITHUB REPOSITORY
echo =========================================================================
echo  Repository: https://github.com/SakethGoljana/Airbase.git
echo =========================================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Git command-line tool is not detected in your PATH.
    echo.
    echo Easy Options to Upload to GitHub:
    echo -------------------------------------------------------------------------
    echo OPTION A (Recommended): GitHub Desktop App
    echo   1. Open GitHub Desktop app
    echo   2. Click File -> Add Local Repository
    echo   3. Select this folder: %~dp0
    echo   4. Click "Publish repository" to https://github.com/SakethGoljana/Airbase
    echo.
    echo OPTION B: Web Upload (Drag & Drop)
    echo   1. Go to https://github.com/SakethGoljana/Airbase
    echo   2. Click "uploading an existing file"
    echo   3. Drag and drop all files from this folder into the web browser!
    echo.
    echo Opening repository page in browser now...
    start https://github.com/SakethGoljana/Airbase
    pause
    exit /b
)

echo [1/3] Initializing Git repository...
git init
git remote remove origin 2>nul
git remote add origin https://github.com/SakethGoljana/Airbase.git
git branch -M main

echo [2/3] Adding clean source files...
git add .

echo [3/3] Committing and pushing to GitHub...
git commit -m "Initial release: Airbase v1.0.0 — Home LAN File Sharing Hub"
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo =========================================================================
    echo  SUCCESSFULLY PUSHED TO GITHUB!
    echo  URL: https://github.com/SakethGoljana/Airbase
    echo =========================================================================
) else (
    echo.
    echo Push failed. Please verify your GitHub credentials or use GitHub Desktop.
)

pause
