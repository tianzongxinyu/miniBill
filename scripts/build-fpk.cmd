@echo off
REM Wrapper so Windows users can build .fpk without changing ExecutionPolicy.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-fpk.ps1" %*
exit /b %ERRORLEVEL%
