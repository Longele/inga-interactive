@echo off
rem Inga I + II : lancement en mode musee (plein ecran, son automatique, hors ligne).
rem Pour quitter : Alt + F4.
set "DIR=%~dp0"
set "URL=file:///%DIR:\=/%musee.html"
set "PROFILE=%LOCALAPPDATA%\IngaKiosk"
set FLAGS=--kiosk --autoplay-policy=no-user-gesture-required --allow-file-access-from-files --no-first-run --disable-pinch --overscroll-history-navigation=0 --disable-features=Translate --user-data-dir="%PROFILE%"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" %FLAGS% "%URL%"
) else (
  start "" "%EDGE%" %FLAGS% --edge-kiosk-type=fullscreen "%URL%"
)
