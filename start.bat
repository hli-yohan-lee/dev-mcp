@echo off
chcp 65001 >nul
echo MCP Stack Starting...

REM Kill existing processes
echo Killing existing Node, Python, and Java processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM java.exe >nul 2>&1



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




timeout /t 2 /nobreak >nul

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && python main.py"

timeout /t 2 /nobreak >nul

echo Starting MCP Server...
start "MCP Server" cmd /k "cd mcp-server && set MCP_ID=mcp && python app.py"

timeout /t 2 /nobreak >nul

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo MCP Stack started!
echo Frontend: http://localhost:3000
echo Backend Server: http://localhost:9000
echo MCP Server: http://localhost:9001
echo.
echo To stop: close each terminal window or run stop.bat
pause
