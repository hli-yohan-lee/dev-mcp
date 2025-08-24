@echo off
chcp 65001 >nul
echo Stopping MCP Stack...

echo Stopping processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a 2>nul

echo Stopping processes on port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /f /pid %%a 2>nul

echo Stopping processes on port 9000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :9000') do taskkill /f /pid %%a 2>nul

echo.
echo MCP Stack stopped!
echo Close any remaining terminal windows manually.
pause 