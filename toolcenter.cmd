@echo off
setlocal
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0toolcenter.ps1" %*
set "toolcenter_exit_code=%ERRORLEVEL%"
popd
exit /b %toolcenter_exit_code%
