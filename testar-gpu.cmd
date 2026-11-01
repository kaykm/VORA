@echo off
setlocal
call "%~dp0scripts\node.cmd" "%~dp0scripts\preparar-gpu.mjs"
if errorlevel 1 exit /b 1
set "VORA_ANGLE_DIR=%~1"
if not defined VORA_ANGLE_DIR set "VORA_ANGLE_DIR=%ProgramFiles(x86)%\Steam\bin\cef\cef.win64"
if not exist "%VORA_ANGLE_DIR%\libEGL.dll" (
  echo Informe uma pasta local do ANGLE com libEGL.dll e libGLESv2.dll.
  exit /b 1
)
python "%~dp0scripts\testar-gpu.py" --angle-dir "%VORA_ANGLE_DIR%"
set "VORA_RESULT=%ERRORLEVEL%"
if /i not "%~2"=="--sem-pausa" pause
exit /b %VORA_RESULT%
