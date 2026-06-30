@echo off
setlocal
cd /d "%~dp0"
set "SCRIPT=%~dp0Build-Android-APK.ps1"
if not exist "%SCRIPT%" (
  echo Missing Build-Android-APK.ps1
  pause
  exit /b 1
)
start "Trade Discipline Journal APK Build" powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "%SCRIPT%"
