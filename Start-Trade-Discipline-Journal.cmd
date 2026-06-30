@echo off
setlocal
cd /d "%~dp0"
set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
echo Trade Discipline Journal
echo.
echo This is an Expo mobile app. Do not open http://localhost:8081 directly in a browser.
echo Use Expo Go on your phone and scan the QR code shown below.
echo If port 8082 is busy, close the old Expo window and run this file again.
echo.
call "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" exec expo start --host lan --port 8082
pause
