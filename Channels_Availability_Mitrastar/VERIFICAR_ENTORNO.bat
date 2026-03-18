@echo off
echo.
echo ========================================================
echo   VERIFICACION DE ENTORNO
echo ========================================================
echo.

echo [Verificando Node.js...]
"%~dp0runtime\node.exe" -v
echo.

echo [Verificando Puppeteer...]
cd /d "%~dp0app"
set "PATH=%~dp0runtime;%PATH%"
"%~dp0runtime\node.exe" -e "try{require('puppeteer');console.log('Puppeteer: OK')}catch(e){console.log('Puppeteer: ERROR')}"
echo.

echo [Verificando screenshot-desktop...]
"%~dp0runtime\node.exe" -e "try{require('screenshot-desktop');console.log('Screenshot: OK')}catch(e){console.log('Screenshot: ERROR')}"
echo.

echo ========================================================
echo   Verificacion completada
echo ========================================================
echo.
pause
