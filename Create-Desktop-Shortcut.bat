@echo off
title Airbase — Create Desktop Shortcut
cls

echo Creating Airbase desktop shortcut...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Airbase.lnk')); $exePath = Join-Path '%~dp0' 'Airbase.exe'; $s.TargetPath = $exePath; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '$exePath,0'; $s.Description = 'Airbase Home LAN File Sharing Hub'; $s.Save()"

if %errorlevel% equ 0 (
    echo.
    echo =========================================================================
    echo  SUCCESS! Airbase desktop shortcut created on your Desktop.
    echo =========================================================================
) else (
    echo.
    echo =========================================================================
    echo  FAILED to create shortcut. Please try running as Administrator.
    echo =========================================================================
)

echo.
pause
