@echo off
echo ============================================
echo   FRAUD GRAPH MONITOR - Starting...
echo ============================================
echo.

:: Activate venv
call venv\Scripts\activate

:: Check that Neo4j is running by attempting a connection
echo [!] Make sure Neo4j Desktop is open and your database is STARTED.
echo     Press any key once Neo4j is running...
pause >nul

echo.
echo [1/2] Starting FastAPI backend on http://localhost:8000 ...
start "Backend" cmd /k "call venv\Scripts\activate && cd backend\api && python -m uvicorn main:app --reload --port 8000"

:: Small delay so backend can start before frontend
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