@echo off
echo 🛑 MCP 스택 중지 중...

REM Docker Compose로 전체 시스템 중지
docker-compose down

echo 🧹 컨테이너와 네트워크 정리 중...

REM 볼륨도 함께 정리하려면 아래 주석 해제
REM docker-compose down -v

echo ✅ MCP 스택이 중지되었습니다!

pause 