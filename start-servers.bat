@echo off
echo Starting MCP Development Servers...
echo.

echo Starting Corp-API server...
start "Corp-API" cmd /k "cd /d %~dp0corp-api && venv\Scripts\activate && uvicorn app:APP --host 0.0.0.0 --port 8080 --reload"

echo Starting MCP Server...
start "MCP-Server" cmd /k "cd /d %~dp0mcp-server && venv\Scripts\activate && uvicorn app:APP --host 0.0.0.0 --port 9000 --reload"

echo Starting Frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All servers are starting...
echo - Corp-API: http://localhost:8080
echo - MCP Server: http://localhost:9000  
echo - Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause > nul
