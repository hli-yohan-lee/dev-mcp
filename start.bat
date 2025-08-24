@echo off
chcp 65001 >nul
echo MCP Stack Starting...

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Python not found. Please install Python 3.11+
    pause
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

echo Starting Corp API Server...
start "Corp API" cmd /k "cd corp-api && set HMAC_KEY=supersecret && python -m venv venv && venv\Scripts\activate.bat && pip install -r requirements.txt && python -m uvicorn app:APP --host 0.0.0.0 --port 8080 --reload"

timeout /t 5 /nobreak >nul

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && if exist venv rmdir /s /q venv && python -m venv venv && venv\Scripts\activate.bat && pip install -r requirements.txt && python main.py"

timeout /t 5 /nobreak >nul

echo Starting MCP Server...
start "MCP Server" cmd /k "cd mcp-server && if exist venv rmdir /s /q venv && set COMPANY_API_BASE=http://localhost:8080 && set HMAC_KEY=supersecret && set MCP_ID=mcp-invest && python -m venv venv && venv\Scripts\activate.bat && pip install -r requirements.txt && python -m uvicorn app:APP --host 0.0.0.0 --port 9000 --reload"

timeout /t 5 /nobreak >nul

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo MCP Stack started!
echo Frontend: http://localhost:3000
echo Backend Server: http://localhost:9001
echo MCP Server: http://localhost:9000
echo Corp API: http://localhost:8080
echo.
echo To stop: close each terminal window or run stop.bat
pause 