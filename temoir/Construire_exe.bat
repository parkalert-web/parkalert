@echo off
rem Fabrique Temoir.exe (un seul fichier, aucun Python necessaire ensuite).
rem A lancer une seule fois, sur le PC Windows.
cd /d "%~dp0"

echo [1/2] Installation de PyInstaller...
python -m pip install --upgrade pyinstaller || goto :erreur

echo [2/2] Construction de Temoir.exe...
python -m PyInstaller --noconfirm --onefile --windowed --name Temoir temoir.py || goto :erreur

echo.
echo Termine : dist\Temoir.exe
echo Tu peux copier ce fichier ou tu veux (bureau, cle USB...).
pause
exit /b 0

:erreur
echo.
echo La construction a echoue. Verifie que Python est installe
echo (https://www.python.org/downloads/windows/, case "Add python.exe to PATH").
pause
exit /b 1
