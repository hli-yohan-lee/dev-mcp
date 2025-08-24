@echo off
chcp 65001 >nul
echo 🛑 MCP 스택 로컬 실행 중지 중...

REM 포트를 사용하는 프로세스 종료
echo 🔍 포트 3000 (프론트엔드) 사용 프로세스 종료 중...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /f /pid %%a 2>nul
)

echo 🔍 포트 8080 (회사 API) 사용 프로세스 종료 중...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do (
    taskkill /f /pid %%a 2>nul
)

echo 🔍 포트 9000 (MCP 서버) 사용 프로세스 종료 중...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :9000') do (
    taskkill /f /pid %%a 2>nul
)

echo ✅ MCP 스택이 중지되었습니다!
echo.
echo 💡 각 터미널 창도 수동으로 닫아주세요.

pause 