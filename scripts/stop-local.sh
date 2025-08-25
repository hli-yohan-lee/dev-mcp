#!/bin/bash

echo "🛑 MCP 스택 로컬 실행 중지 중..."

# PID 파일에서 프로세스 ID 읽기

if [ -f .mcp-server.pid ]; then
    MCP_SERVER_PID=$(cat .mcp-server.pid)
    echo "🔧 MCP 서버 중지 중 (PID: $MCP_SERVER_PID)..."
    kill $MCP_SERVER_PID 2>/dev/null || echo "프로세스가 이미 종료되었습니다."
    rm .mcp-server.pid
fi

if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    echo "🌐 프론트엔드 중지 중 (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || echo "프로세스가 이미 종료되었습니다."
    rm .frontend.pid
fi

# 포트 사용 확인
echo "🔍 포트 사용 상태 확인 중..."
if lsof -i :3000 >/dev/null 2>&1; then
    echo "⚠️  포트 3000이 여전히 사용 중입니다."
fi

if lsof -i :9000 >/dev/null 2>&1; then
    echo "⚠️  포트 9000이 여전히 사용 중입니다."
fi

echo "✅ MCP 스택이 중지되었습니다!" 