# 🤖 MCP + GPT 통합 대시보드

MCP(Model Context Protocol)와 GPT를 통합한 개발 및 테스트 대시보드입니다.

## 🚀 기능

### 1. 🤖 순수 GPT 호출 (스트리밍)
- OpenAI GPT API를 직접 호출
- 실시간 스트리밍 응답 출력
- 대화 히스토리 관리

### 2. 🔧 MCP 백엔드 개별 실행
- 각 MCP 도구를 개별적으로 테스트
- 백엔드 응답 결과 확인
- 실행 로그 및 에러 추적

### 3. 🔧 순수 MCP 호출
- MCP 도구 직접 호출
- 파라미터 설정 및 테스트
- 응답 데이터 상세 분석

### 4. 🚀 복합 통합 시스템
- GPT와 MCP 도구를 함께 사용
- 통합 워크플로우 테스트
- 전체 시스템 시뮬레이션

## 🛠️ 설치 및 실행

### 1. 의존성 설치

#### Corp-API 서버
```bash
cd corp-api
python -m venv venv
venv\Scripts\activate  # Windows
pip install fastapi uvicorn python-dotenv openai httpx
```

#### MCP 서버
```bash
cd mcp-server
python -m venv venv
venv\Scripts\activate  # Windows
pip install fastapi uvicorn python-dotenv httpx
```

#### 프론트엔드
```bash
cd frontend
npm install
```

### 2. 환경 변수 설정

#### Corp-API (.env 파일)
```env
HMAC_KEY=supersecret
OPENAI_API_KEY=your_openai_api_key_here
```

#### MCP 서버 (env.txt 파일)
```env
COMPANY_API_BASE=http://localhost:8080
HMAC_KEY=supersecret
MCP_ID=mcp
```

### 3. 서버 실행

#### 자동 실행 (PowerShell)
```powershell
.\start-servers.ps1
```

#### 수동 실행
```bash
# Corp-API 서버
cd corp-api
venv\Scripts\activate
uvicorn app:APP --host 0.0.0.0 --port 8080 --reload

# MCP 서버
cd mcp-server
venv\Scripts\activate
uvicorn app:APP --host 0.0.0.0 --port 9000 --reload

# 프론트엔드
cd frontend
npm run dev
```

## 🌐 접속 주소

- **Corp-API**: http://localhost:8080
- **MCP Server**: http://localhost:9000
- **Frontend**: http://localhost:3000

## 🔍 사용법

### 1. API 키 설정
상단에 OpenAI API 키를 입력하세요.

### 2. 탭 선택
- **🤖 순수 GPT**: GPT API 직접 호출 및 스트리밍
- **🔧 MCP 백엔드**: 백엔드 도구 개별 테스트
- **🔧 순수 MCP**: MCP 도구 직접 호출
- **🚀 복합 통합**: 전체 시스템 통합 테스트

### 3. 디버그 모드
🐛 디버그 보기 버튼을 클릭하여 실시간 로그를 확인할 수 있습니다.

## 📁 프로젝트 구조

```
dev-mcp/
├── corp-api/          # 회사 API 서버 (GPT API 포함)
├── mcp-server/        # MCP 서버 (프록시)
├── frontend/          # React 프론트엔드
├── gateway/           # Nginx 게이트웨이
├── scripts/           # 실행 스크립트
└── docker-compose.yml # Docker 구성
```

## 🧪 테스트 시나리오

### GPT 스트리밍 테스트
1. "🤖 순수 GPT" 탭 선택
2. 질문 입력 후 "스트리밍 전송" 클릭
3. 실시간 응답 확인

### MCP 백엔드 테스트
1. "🔧 MCP 백엔드" 탭 선택
2. 원하는 도구 버튼 클릭
3. 응답 결과 확인

### MCP 도구 테스트
1. "🔧 순수 MCP" 탭 선택
2. 파라미터 설정
3. 도구 호출 및 결과 확인

### 통합 시스템 테스트
1. "🚀 복합 통합" 탭 선택
2. GPT 질문과 MCP 도구 함께 사용
3. 전체 워크플로우 테스트

## 🔧 문제 해결

### 서버 연결 실패
- 각 서버가 올바른 포트에서 실행되고 있는지 확인
- 방화벽 설정 확인
- 로그에서 에러 메시지 확인

### GPT 응답이 비어있음
- API 키가 올바르게 설정되었는지 확인
- 디버그 패널에서 로그 확인
- 서버 상태 확인

### MCP 호출 실패
- corp-api 서버가 실행 중인지 확인
- HMAC 키가 일치하는지 확인
- 네트워크 연결 상태 확인

## 📝 로그 및 디버깅

모든 요청과 응답은 실시간으로 로깅됩니다:
- 프론트엔드: 디버그 패널에서 확인
- 백엔드: 터미널 콘솔에서 확인
- MCP 서버: 터미널 콘솔에서 확인

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해 주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.