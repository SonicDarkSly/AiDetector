@echo off
rem Lanceur Windows. Fermer la fenetre arrete l'application.
chcp 65001 >nul
cd /d "%~dp0"

set NODE_VERSION=24.18.0
if exist "%CD%\.node\node.exe" set "PATH=%CD%\.node;%PATH%"

where npm >nul 2>nul
if not errorlevel 1 goto nodeok
echo [..] Node.js est introuvable - installation portable dans le dossier de l'app...
curl -fL -o node-portable.zip https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip
if errorlevel 1 (
  echo [X] Telechargement de Node.js impossible - connexion internet ?
  echo     Alternative : installer Node.js depuis https://nodejs.org puis relancer.
  pause
  exit /b 1
)
tar -xf node-portable.zip
ren node-v%NODE_VERSION%-win-x64 .node
del node-portable.zip
set "PATH=%CD%\.node;%PATH%"
echo [OK] Node.js installe localement dans .node\ - supprimer ce dossier pour desinstaller.

where npm >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js reste introuvable apres l'installation portable.
  pause
  exit /b 1
)
:nodeok

curl -s --max-time 2 http://localhost:3002/api/health 2>nul | findstr ok >nul
if not errorlevel 1 (
  echo [OK] MefIAnce tourne deja - ouverture de la page.
  start "" http://localhost:5174
  exit /b 0
)

echo [1/4] Verification des dependances...
if not exist node_modules\.bin\vite.cmd goto installdeps
if not exist node_modules\.bin\tsc.cmd goto installdeps
if not exist node_modules\mammoth goto installdeps
if not exist node_modules\pdfjs-dist goto installdeps
if not exist node_modules\node-llama-cpp goto installdeps
if not exist node_modules\@dnd-kit\sortable goto installdeps
echo [OK] Dependances deja installees - node_modules complet.
goto depsok
:installdeps
echo [..] Dependances manquantes ou incompletes - installation, quelques minutes...
call npm install
echo [OK] Dependances installees.
:depsok

echo [2/4] Preparation du modele d'analyse (environ 2 Go, une seule fois)...
call node scripts\warmup-model.mjs
if errorlevel 1 (
  echo [!] Modele indisponible - l'analyse fonctionnera sans lui.
) else (
  echo [OK] Modele d'analyse pret.
)

echo [3/4] Demarrage d'MefIAnce...
start /b cmd /c "npm run dev"

echo [4/4] Preparation en cours - compilation du serveur...
set /a tries=0
:wait
set /a tries+=1
curl -s --max-time 2 http://localhost:3002/api/health 2>nul | findstr ok >nul && goto ready
if %tries% geq 90 goto ready
timeout /t 1 /nobreak >nul
goto wait

:ready
start "" http://localhost:5174
echo.
echo [OK] MefIAnce est ouvert : http://localhost:5174
echo      Laissez cette fenetre ouverte pendant l'utilisation.
echo      Pour arreter : fermez cette fenetre.
pause >nul
