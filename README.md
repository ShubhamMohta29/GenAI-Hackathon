@echo off
echo ============================================
echo   FRAUD GRAPH MONITOR - Install Prerequisites
echo ============================================
echo.
echo This script will check and install:
echo   - Python 3.12
echo   - Node.js LTS
echo   - Neo4j Desktop
echo.
echo You may be asked to click through some installers.
echo Press any key to begin...
pause >nul

:: ---- PYTHON ----
echo.
echo [1/3] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo Python not found. Downloading Python 3.12...
    curl -L "https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe" -o "%TEMP%\python_installer.exe"
    echo Launching Python installer...
    echo [!] IMPORTANT: Check "Add Python to PATH" on the first screen!
    start /wait "%TEMP%\python_installer.exe"
    del "%TEMP%\python_installer.exe"
    echo [OK] Python installation complete.
) else (
    echo [OK] Python already installed: 
    python --version
)

:: ---- NODE.JS ----
echo.
echo [2/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Downloading Node.js LTS...
    curl -L "https://nodejs.org/dist/lts/node-lts-latest-x64.msi" -o "%TEMP%\node_installer.msi"
    echo Launching Node.js installer...
    start /wait msiexec /i "%TEMP%\node_installer.msi" /qb
    del "%TEMP%\node_installer.msi"
    echo [OK] Node.js installation complete.
) else (
    echo [OK] Node.js already installed:
    node --version
)

:: ---- NEO4J DESKTOP ----
echo.
echo [3/3] Checking Neo4j Desktop...
if exist "%LOCALAPPDATA%\Programs\Neo4j Desktop\Neo4j Desktop.exe" (
    echo [OK] Neo4j Desktop already installed.
) else if exist "%PROGRAMFILES%\Neo4j Desktop\Neo4j Desktop.exe" (
    echo [OK] Neo4j Desktop already installed.
) else (
    echo Neo4j Desktop not found. Downloading...
    curl -L "https://dist.neo4j.org/neo4j-desktop/1.6.0/Neo4j-Desktop-Setup-1.6.0.exe" -o "%TEMP%\neo4j_installer.exe"
    echo Launching Neo4j Desktop installer...
    start /wait "%TEMP%\neo4j_installer.exe"
    del "%TEMP%\neo4j_installer.exe"
    echo [OK] Neo4j Desktop installation complete.
)

echo.
echo ============================================
echo   All prerequisites installed!
echo.
echo   NEXT STEPS:
echo   1. Open Neo4j Desktop
echo   2. Create a new project + Local DBMS
echo   3. Set a password and START the database
echo   4. Add your password to backend\.env
echo   5. Run setup.bat
echo ============================================
echo.
pause