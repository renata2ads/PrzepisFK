@echo off
rem PrzepisFK — uruchamiane przez Harmonogram zadań Windows.
rem Pobiera wpisy, streszcza je przez claude -p, wysyła powiadomienia. Wynik dopisuje do logs\fetch.log.

cd /d "%~dp0.."
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;%PATH%"
if not exist logs mkdir logs

echo. >> logs\fetch.log
echo ===== %date% %time% ===== >> logs\fetch.log
call npm run fetch >> logs\fetch.log 2>&1
echo kod wyjscia: %errorlevel% >> logs\fetch.log
