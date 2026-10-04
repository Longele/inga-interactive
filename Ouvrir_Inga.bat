@echo off
rem Ouvre Inga I + II dans une fenetre normale (son actif, hors ligne).
set "DIR=%~dp0"
set "URL=file:///%DIR:\=/%index.html"
set "PROFILE=%LOCALAPPDATA%\IngaApp"
set FLAGS=--app="%URL%" --allow-file-access-from-files --no-first-run --user-data-dir="%PROFILE%" --start-maximized
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%CHROME%" (start "" "%CHROME%" %FLAGS%) else (start "" "%EDGE%" %FLAGS%)
