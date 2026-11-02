@echo off
setlocal
call "%~dp0scripts\node.cmd" "%~dp0scripts\verificar.mjs" %*
set "VORA_RESULT=%ERRORLEVEL%"
set "VORA_PAUSE=1"
for %%A in (%*) do if /i "%%~A"=="--sem-pausa" set "VORA_PAUSE="
if defined VORA_PAUSE pause
exit /b %VORA_RESULT%
