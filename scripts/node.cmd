@echo off
setlocal
where node.exe >nul 2>nul
if not errorlevel 1 (
  node.exe %*
  exit /b
)
set "VORA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%VORA_NODE%" (
  "%VORA_NODE%" %*
  exit /b
)
echo Node.js nao encontrado. Instale o Node.js LTS e reabra este comando.
exit /b 1
