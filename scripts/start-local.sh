#!/bin/bash

echo "🚀 MCP 스택 로컬 실행 시작..."

# 회사 API 서버 시작
echo "🏢 회사 API 서버 시작 중..."

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:APP --host 0.0.0.0 --port 8080 &
CORP_API_PID=$!
cd ..

# MCP 서버 시작
echo "🔧 MCP 서버 시작 중..."
cd mcp-server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:APP --host 0.0.0.0 --port 9000 &
MCP_SERVER_PID=$!
cd ..

# 프론트엔드 시작
echo "🌐 프론트엔드 시작 중..."
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

# PID 저장

echo $MCP_SERVER_PID > .mcp-server.pid
echo $FRONTEND_PID > .frontend.pid

echo "⏳ 서비스들이 시작되는 동안 잠시 기다려주세요..."
sleep 5

echo "✅ MCP 스택이 로컬에서 시작되었습니다!"
echo ""
echo "🌐 접속 정보:"
echo "  - 프론트엔드: http://localhost:3000"
echo "  - MCP 서버: http://localhost:9000"
echo "  - 회사 API: http://localhost:8080"
echo ""
echo "📝 프로세스 ID:"
echo "  - 회사 API: $CORP_API_PID"
echo "  - MCP 서버: $MCP_SERVER_PID"
echo "  - 프론트엔드: $FRONTEND_PID"
echo ""
echo "🛑 중지: ./scripts/stop-local.sh" 