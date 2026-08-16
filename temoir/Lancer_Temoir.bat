@echo off
rem Lance Temoir sans fenetre noire. Double-clique simplement sur ce fichier.
cd /d "%~dp0"
where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw "%~dp0temoir.py"
) else (
    echo Python n'est pas installe.
    echo Installe-le depuis https://www.python.org/downloads/windows/
    echo en cochant "Add python.exe to PATH", puis relance ce fichier.
    pause
)
