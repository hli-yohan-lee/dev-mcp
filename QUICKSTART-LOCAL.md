# 🚀 MCP 스택 로컬 실행 빠른 시작 가이드

## 📋 사전 요구사항

- **Python 3.11+** 설치
- **Node.js 18+** 설치
- **Git** 설치

### 🔧 설치 가이드

#### Windows
```bash
# Python
# https://www.python.org/downloads/ 에서 다운로드

# Node.js
# https://nodejs.org/ 에서 LTS 버전 다운로드
```

#### macOS
```bash
# Homebrew로 설치
brew install python node

# 또는 Python.org에서 Python 다운로드
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install python3 python3-venv python3-pip nodejs npm
```

## 🏃‍♂️ 빠른 시작

### 방법 1: 전체 시스템 한 번에 시작 (권장)

#### Windows
```cmd
scripts\start-local.bat
```

#### Linux/Mac
```bash
chmod +x scripts/start-local.sh
./scripts/start-local.sh
```

### 방법 2: 개별 서비스 시작



#### 2. MCP 서버 시작
```bash
# Windows
start-mcp-server.bat

# Linux/Mac
cd mcp-server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:APP --host 0.0.0.0 --port 9000 --reload
```

#### 3. 프론트엔드 시작
```bash
# Windows
start-frontend.bat

# Linux/Mac
cd frontend
npm install
npm run dev
```

## 🌐 접속 정보

- **프론트엔드**: http://localhost:3000
- **MCP 서버**: http://localhost:9000

## 🧪 테스트

1. 브라우저에서 http://localhost:3000 접속
2. Action 선택 (예: PDF_METADATA)
3. Args JSON 입력
4. Invoke 버튼 클릭
5. 응답 확인

## 🛑 시스템 중지

### 전체 시스템 중지
```bash
# Windows
scripts\stop-local.bat

# Linux/Mac
./scripts/stop-local.sh
```

### 개별 서비스 중지
- 각 터미널 창에서 `Ctrl+C` 입력
- 또는 프로세스 종료

## 🔍 문제 해결

### 포트 충돌
```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :8080
netstat -ano | findstr :9000

# Linux/Mac
lsof -i :3000
lsof -i :8080
lsof -i :9000
```

### Python 가상환경 문제
```bash
# 가상환경 재생성
rm -rf venv
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate.bat  # Windows
pip install -r requirements.txt
```

### Node.js 의존성 문제
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

## 📚 추가 정보

- [README.md](README.md) - 상세한 아키텍처 설명
- [API 문서](http://localhost:9000/docs) - MCP 서버 API 문서
- [회사 API 문서](http://localhost:8080/docs) - 회사 API 서버 문서

## 💡 팁

- **개발 모드**: `--reload` 플래그로 코드 변경 시 자동 재시작
- **포트 변경**: 각 서비스의 시작 명령어에서 포트 번호 수정
- **환경 변수**: `.env` 파일 생성하여 설정 커스터마이징
- **Nonce 검증**: 레디스 대신 메모리 기반으로 동작하여 별도 설치 불필요 