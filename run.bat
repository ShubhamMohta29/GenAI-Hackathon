@echo off
echo ============================================
echo   ARGUS - Starting...
echo ============================================
echo.

call venv\Scripts\activate

echo [1/2] Starting FastAPI backend on http://localhost:8000 ...
start "Backend" cmd /k "call venv\Scripts\activate && cd backend\api && python -m uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting React frontend on http://localhost:5173 ...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo   Both servers are starting!
echo   Open http://localhost:5173 in your browser
echo ============================================
echo.
pause
