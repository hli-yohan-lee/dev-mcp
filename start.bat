@echo off
echo Starting MCP Development Servers...
echo.

echo Starting Gateway Backend...
start "Gateway-Backend" cmd /k "cd /d %~dp0gateway-backend && python gateway.py"

echo Starting MCP Server (JSON-RPC 2.0)...
start "MCP-Server" cmd /k "cd /d %~dp0mcp-server && python app.py"

echo Starting Interface Backend...
start "Interface-Backend" cmd /k "cd /d %~dp0interface-backend && python main.py"

echo Starting Frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All servers are starting...
echo - Frontend: http://localhost:3000
echo - Gateway Backend: http://localhost:9000
echo - MCP Server (JSON-RPC): http://localhost:9001/
echo - MCP Server (REST Legacy): http://localhost:9001/mcp/tools
echo - Interface Backend: http://localhost:9002
echo.
echo Press any key to exit...
pause > nul
