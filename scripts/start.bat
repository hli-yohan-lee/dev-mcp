@echo off
echo 🚀 MCP 스택 시작 중...

REM Docker Compose로 전체 시스템 시작
docker-compose up -d

echo ⏳ 서비스들이 시작되는 동안 잠시 기다려주세요...

REM 서비스 상태 확인
timeout /t 10 /nobreak >nul

echo 📊 서비스 상태 확인 중...
docker-compose ps

echo ✅ MCP 스택이 시작되었습니다!
echo.
echo 🌐 접속 정보:
echo   - 프론트엔드: http://localhost:3000
echo   - MCP 서버: http://localhost:9000
echo   - 게이트웨이: https://localhost:8443
echo   - Redis: localhost:6379
echo.
echo 📝 로그 확인: docker-compose logs -f [서비스명]
echo 🛑 중지: docker-compose down

pause 