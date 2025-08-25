# 🚀 MCP 스택 시작하기

## 🎯 빠른 시작

### 🐳 Docker 사용 (전체 시스템)
```bash
# 1. TLS 인증서 생성
./scripts/setup-tls.sh

# 2. 시스템 시작
./scripts/start.sh

# 3. 브라우저에서 http://localhost:3000 접속
```

### 💻 로컬 실행 (개발용)

#### **Windows (권장)**
```cmd
# 전체 시스템 한 번에 시작
start-all.bat

# 중지
stop-all.bat
```

#### **Linux/Mac**
```bash
# 전체 시스템 한 번에 시작
./scripts/start-local.sh

# 중지
./scripts/stop-local.sh
```

#### **개별 서비스 시작**
```bash
# Windows (안전한 버전)
start-frontend-safe.bat      # 프론트엔드
start-mcp-server-safe.bat    # MCP 서버  


# Linux/Mac
cd frontend && npm install && npm run dev
cd mcp-server && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python -m uvicorn app:APP --host 0.0.0.0 --port 9000 --reload

```

## 📚 상세 가이드

- **[QUICKSTART.md](QUICKSTART.md)** - Docker 기반 실행 가이드
- **[QUICKSTART-LOCAL.md](QUICKSTART-LOCAL.md)** - 로컬 실행 가이드
- **[API_SCHEMAS.md](API_SCHEMAS.md)** - API 스키마 문서

## 🔧 사전 요구사항

- **Docker**: Docker & Docker Compose
- **로컬 실행**: Python 3.11+, Node.js 18+

## 🌐 접속 정보

- **프론트엔드**: http://localhost:3000
- **MCP 서버**: http://localhost:9000

## 🆘 문제 해결

### Windows 경로 문제
- `start-all.bat` 사용 (권장)
- 또는 각 서비스를 개별적으로 시작

### 가상환경 문제 (파일 시스템 레이블 오류 등)
```cmd
# 가상환경 문제 해결
fix-venv.bat

# 또는 안전한 개별 시작 스크립트 사용

start-mcp-server-safe.bat
start-frontend-safe.bat
```

### 일반적인 문제들
- **관리자 권한**: 가상환경 생성 시 관리자 권한으로 실행
- **경로 문제**: 한글이나 특수문자가 포함된 경로 피하기
- **의존성 문제**: `fix-venv.bat`로 가상환경 재생성

### 문제가 발생하면
[QUICKSTART-LOCAL.md](QUICKSTART-LOCAL.md)의 문제 해결 섹션을 참조하세요. 