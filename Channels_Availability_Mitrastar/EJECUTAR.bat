@echo off
setlocal

:: ========================================================
::  Channels Availability - Mitrastar Router - Launcher
:: ========================================================

cd /d "%~dp0app"
set "PATH=%~dp0runtime;%PATH%"

cls
echo.
echo ========================================================
echo   Channels Availability - Mitrastar Router
echo   Version: 1.0 - PORTABLE
echo ========================================================
echo.
echo [INFO] Iniciando script...
echo        Esto puede tardar unos segundos...
echo.

"%~dp0runtime\node.exe" mitra_channels.js

set EXIT_CODE=%ERRORLEVEL%

echo.
echo ========================================================
if %EXIT_CODE% EQU 0 (
    echo   Ejecucion completada exitosamente
) else (
    echo   Ejecucion finalizada con errores
    echo   Codigo de salida: %EXIT_CODE%
)
echo ========================================================
echo.
echo Las capturas se encuentran en: C:\CapturasCanales
echo.

pause
endlocal
