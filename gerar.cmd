@echo off
setlocal
call "%~dp0scripts\node.cmd" "%~dp0scripts\gerar.mjs"
set "VORA_RESULT=%ERRORLEVEL%"
if /i not "%~1"=="--sem-pausa" pause
exit /b %VORA_RESULT%
