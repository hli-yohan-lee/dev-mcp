@echo off
chcp 65001 >nul
echo 🚀 MCP 스택 로컬 실행 시작...

REM 현재 스크립트 위치를 기준으로 상위 디렉토리로 이동
cd /d "%~dp0.."



REM MCP 서버 시작
echo 🔧 MCP 서버 시작 중...
cd mcp-server
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt
start "MCP 서버" cmd /k "python -m uvicorn app:APP --host 0.0.0.0 --port 9000"
cd ..

REM 프론트엔드 시작
echo 🌐 프론트엔드 시작 중...
cd frontend
if not exist node_modules (
    npm install
)
start "프론트엔드" cmd /k "npm run dev"
cd ..

echo ⏳ 서비스들이 시작되는 동안 잠시 기다려주세요...
timeout /t 5 /nobreak >nul

echo ✅ MCP 스택이 로컬에서 시작되었습니다!
echo.
echo 🌐 접속 정보:
echo   - 프론트엔드: http://localhost:3000
echo   - MCP 서버: http://localhost:9000
echo.
echo 🛑 중지: 각 터미널 창을 닫거나 ./scripts/stop-local.bat

pause 