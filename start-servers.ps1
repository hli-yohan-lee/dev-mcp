Write-Host "Starting MCP Development Servers..." -ForegroundColor Green
Write-Host ""



# 잠시 대기
Start-Sleep -Seconds 3

# MCP 서버 시작
Write-Host "Starting MCP Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\mcp-server'; venv\Scripts\activate; uvicorn app:APP --host 0.0.0.0 --port 9000 --reload"

# 잠시 대기
Start-Sleep -Seconds 3

# 프론트엔드 시작
Write-Host "Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "All servers are starting..." -ForegroundColor Green

Write-Host "- MCP Server: http://localhost:9000" -ForegroundColor Cyan
Write-Host "- Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


