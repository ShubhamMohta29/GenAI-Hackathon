@echo off
echo ============================================
echo   FRAUD GRAPH MONITOR - Setup
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)
echo [OK] Python found

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found

echo.
echo [1/3] Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate

echo.
echo [2/3] Installing Python dependencies...
pip install -r backend/requirements.txt

echo.
echo [3/3] Installing frontend dependencies...
cd frontend
npm install
cd ..

echo.
echo ============================================
echo   Setup complete!
echo   Run "run.bat" to start the application.
echo ============================================
pause