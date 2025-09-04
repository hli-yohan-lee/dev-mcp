# MCP Integration Platform - 완전 기술 문서

## 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [기술 스택](#기술-스택)
4. [컴포넌트 상세](#컴포넌트-상세)
5. [API 명세](#api-명세)
6. [데이터 플로우](#데이터-플로우)
7. [MCP 프로토콜 구현](#mcp-프로토콜-구현)
8. [화면별 기능 상세](#화면별-기능-상세)
9. [설치 및 실행](#설치-및-실행)
10. [개발 환경 설정](#개발-환경-설정)

---

## 프로젝트 개요

### 핵심 목적
OpenAI GPT 모델과 MCP(Model Context Protocol) 도구를 통합하여 AI가 PDF 읽기, 데이터베이스 조회, GitHub 저장소 접근 등의 외부 도구를 활용할 수 있게 하는 통합 플랫폼.

### 주요 특징
- **JSON-RPC 2.0 표준 MCP 프로토콜** 구현
- **REST API 폴백** 지원으로 하위 호환성 보장
- **4개의 독립적인 테스트 화면** 제공
- **2-Step 처리 모드** (Planner → Worker) 지원
- **실시간 MCP 호출 내역 추적**

---

## 시스템 아키텍처

### 전체 구조도
```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│                    Port: 3000                           │
│  ┌──────────┬──────────┬──────────┬──────────┐        │
│  │ Screen 1 │ Screen 2 │ Screen 3 │ Screen 4 │        │
│  │   API    │   GPT    │   MCP    │  2-Step  │        │
│  │  Backend │ Streaming│Integration│   Test   │        │
│  └──────────┴──────────┴──────────┴──────────┘        │
└─────────────┬──────────────┬────────────┬──────────────┘
              │              │            │
              ▼              ▼            ▼
┌─────────────────────────────────────────────────────────┐
│              Gateway Backend (FastAPI)                   │
│                    Port: 9000                           │
│  - OpenAI Integration                                   │
│  - MCP Tool Registration                                │
│  - Request Routing                                      │
│  - 2-Step Mode Processing                               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                MCP Server (FastAPI)                      │
│                    Port: 9001                           │
│  - JSON-RPC 2.0 Endpoint (/)                           │
│  - REST API Endpoints (/mcp/tools, /mcp/call)          │
│  - Tool Definitions                                     │
│  - Request Processing                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            Interface Backend (FastAPI)                   │
│                    Port: 9002                           │
│  - PDF Processing (/api/pdf)                           │
│  - Database Query (/api/database)                      │
│  - GitHub Integration (/api/github)                    │
│  - System Health (/api/health)                         │
└─────────────────────────────────────────────────────────┘
```

### 포트 할당
- **3000**: Frontend (React + Vite)
- **9000**: Gateway Backend (AI 통합 레이어)
- **9001**: MCP Server (도구 프로토콜 서버)
- **9002**: Interface Backend (실제 도구 실행 서버)

---

## 기술 스택

### Frontend
- **React 18.2.0** - UI 라이브러리
- **TypeScript 5.5.2** - 타입 안정성
- **Vite 5.3.5** - 빌드 도구
- **React Router DOM 6.24.1** - 라우팅
- **CSS3** - 스타일링 (순수 CSS 사용)

### Backend
- **Python 3.11+** - 런타임
- **FastAPI** - 웹 프레임워크
- **Uvicorn** - ASGI 서버
- **OpenAI Python SDK** - GPT 통합
- **HTTPX** - 비동기 HTTP 클라이언트
- **Pydantic** - 데이터 검증
- **SQLite** - 데이터베이스
- **PyPDF2** - PDF 처리

### 프로토콜
- **JSON-RPC 2.0** - 기본 MCP 통신 프로토콜
- **REST API** - 폴백 및 호환성
- **WebSocket** - 실시간 통신 (향후 확장 가능)

---

## 컴포넌트 상세

### 1. Frontend 컴포넌트 구조

#### App.tsx - 메인 애플리케이션
```typescript
// 핵심 구조
- 4개의 탭 관리 (APIBackendTestPage, GPTStreamingPage, MCPIntegrationPage, TwoStepTestPage)
- API 키 관리 (localStorage 저장)
- GitHub 토큰 관리
- 디버그 로그 시스템
- 전역 상태 관리
```

#### 페이지별 컴포넌트

**1. APIBackendTestPage.tsx**
```typescript
목적: Interface Backend API 직접 테스트
주요 기능:
- PDF 읽기 테스트
- 데이터베이스 조회 테스트  
- GitHub 저장소 정보 조회
- 시스템 상태 체크

상태 관리:
- selectedTool: 선택된 도구
- toolParams: 도구 파라미터
- response: API 응답
- isLoading: 로딩 상태
```

**2. GPTStreamingPage.tsx**
```typescript
목적: OpenAI GPT 스트리밍 응답 테스트
주요 기능:
- 실시간 스트리밍 응답 표시
- 타이핑 애니메이션 효과
- 중단/재개 기능

구현 상세:
- 20ms 딜레이로 한 글자씩 표시
- 비동기 스트리밍 처리
```

**3. MCPIntegrationPage.tsx**
```typescript
목적: AI + MCP 자동 통합
주요 기능:
- OpenAI Function Calling 활용
- 자동 MCP 도구 선택 및 실행
- 실시간 MCP 호출 내역 표시

구현 흐름:
1. 사용자 질문 입력
2. Gateway Backend로 전송
3. OpenAI가 필요한 MCP 도구 자동 선택
4. MCP 도구 실행 및 결과 수집
5. 최종 AI 답변 생성
```

**4. TwoStepTestPage.tsx**
```typescript
목적: 2-Step 처리 모드 (Planner → Worker)
주요 기능:
- Planner: MCP 도구 선택 계획 수립
- 직접 MCP 서버 호출
- Worker: 결과 기반 최종 답변 생성

특징:
- Frontend에서 직접 MCP 서버 호출 (http://localhost:9001/mcp/call)
- Planner/Worker 탭 분리 표시
```

### 2. Gateway Backend (gateway.py)

```python
핵심 함수:

1. get_openai_client(api_key: str)
   - SSL 검증 비활성화 httpx 클라이언트 생성
   - OpenAI 클라이언트 반환

2. get_mcp_tools()
   - JSON-RPC 우선 시도 (POST /)
   - 실패 시 REST API 폴백 (GET /mcp/tools)
   - OpenAI Function Calling 형식으로 변환

3. call_mcp_tool(tool_name, arguments)
   - JSON-RPC 우선 시도
   - 실패 시 REST API 폴백
   - content 배열에서 텍스트 추출

4. ask_agent(request)
   - mode별 처리:
     * default: 일반 MCP 통합
     * 2step: Planner 모드
     * worker: Worker 모드
   - tool_choice="required" 설정
```

### 3. MCP Server (mcp-server/app.py)

```python
JSON-RPC 2.0 구현:

1. 메서드:
   - initialize: 서버 정보 반환
   - tools/list: 도구 목록 반환  
   - tools/call: 도구 실행

2. 도구 정의:
   - read_pdf: PDF 파일 읽기
   - query_database: DB 조회
   - github_repository_info: GitHub 정보
   - system_health: 시스템 상태

3. 엔드포인트:
   - POST /: JSON-RPC 2.0
   - GET /mcp/tools: REST API (레거시)
   - POST /mcp/call: REST API (레거시)
```

### 4. Interface Backend (interface-backend/main.py)

```python
실제 도구 실행 서버:

1. /api/pdf
   - PyPDF2로 PDF 텍스트 추출
   - 한국어 인코딩 처리

2. /api/database
   - SQLite 데이터베이스 조회
   - 필터링 지원

3. /api/github
   - GitHub API 통합
   - 파일 내용 Base64 디코딩

4. /api/health
   - 시스템 메트릭 수집
```

---

## API 명세

### Gateway Backend API

#### POST /ask
**요청:**
```json
{
  "question": "사용자 질문",
  "api_key": "OpenAI API 키",
  "mode": "default|2step|worker",
  "mcp_results": [] // worker 모드에서만
}
```

**응답 (default 모드):**
```json
{
  "answer": "AI 응답",
  "tools_used": ["read_pdf", "query_database"],
  "mcp_calls": [
    {
      "id": "call_1",
      "action": "read_pdf",
      "args": {"filename": "백엔드_가이드.pdf"},
      "response": {...},
      "timestamp": 1234567890,
      "status": "success"
    }
  ]
}
```

**응답 (2step 모드):**
```json
{
  "mode": "2step",
  "tool_calls": [
    {
      "tool_name": "read_pdf",
      "parameters": {"filename": "백엔드_가이드.pdf"}
    }
  ],
  "planner_response": "MCP 도구 호출 계획을 수립했습니다."
}
```

### MCP Server API

#### JSON-RPC 2.0 엔드포인트

**POST /**

초기화:
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {},
  "id": 1
}
```

도구 목록:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 1
}
```

도구 실행:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_pdf",
    "arguments": {"filename": "백엔드_가이드.pdf"}
  },
  "id": "call_1"
}
```

#### REST API 엔드포인트 (레거시)

**GET /mcp/tools**
```json
[
  {
    "type": "function",
    "function": {
      "name": "read_pdf",
      "description": "PDF 파일을 읽어서 텍스트 내용을 추출합니다",
      "parameters": {
        "type": "object",
        "properties": {
          "filename": {
            "type": "string",
            "enum": ["백엔드_가이드.pdf", "프론트_가이드.pdf", "디비_가이드.pdf"]
          }
        },
        "required": ["filename"]
      }
    }
  }
]
```

**POST /mcp/call**
```json
{
  "tool": "read_pdf",
  "arguments": {"filename": "백엔드_가이드.pdf"}
}
```

### Interface Backend API

#### POST /api/pdf
```json
요청:
{
  "filename": "백엔드_가이드.pdf"
}

응답:
{
  "filename": "백엔드_가이드.pdf",
  "content": "PDF 텍스트 내용...",
  "pages": 10,
  "extracted_at": "2024-01-01T00:00:00"
}
```

#### POST /api/database
```json
요청:
{
  "table": "users",
  "filters": {"role": "backend"}
}

응답:
{
  "table": "users",
  "data": [
    {"id": 1, "name": "John", "role": "backend"}
  ],
  "count": 1
}
```

#### POST /api/github
```json
요청:
{
  "repository": "hli-yohan-lee/dev-guide",
  "username": "hli.yohan.lee",
  "password": "github_token",
  "file_path": "README.md"
}

응답:
{
  "repository": "hli-yohan-lee/dev-guide",
  "file_path": "README.md",
  "content": "파일 내용...",
  "sha": "abc123"
}
```

---

## 데이터 플로우

### 화면 3 (MCPIntegrationPage) 플로우
```
1. 사용자 질문 입력
   ↓
2. Frontend → Gateway Backend /ask
   ↓
3. Gateway Backend: OpenAI API 호출 (도구 등록)
   ↓
4. OpenAI: Function Calling으로 도구 선택
   ↓
5. Gateway Backend → MCP Server (JSON-RPC/REST)
   ↓
6. MCP Server → Interface Backend (실제 실행)
   ↓
7. 결과 역순 전달
   ↓
8. Gateway Backend: 최종 답변 생성
   ↓
9. Frontend: 응답 및 MCP 호출 내역 표시
```

### 화면 4 (TwoStepTestPage) 플로우
```
1단계 - Planner:
1. 사용자 질문 입력
   ↓
2. Frontend → Gateway Backend /ask (mode: 2step)
   ↓
3. OpenAI: 도구 선택 계획 수립
   ↓
4. tool_calls 반환

2단계 - MCP 실행:
5. Frontend → MCP Server /mcp/call (직접 호출)
   ↓
6. MCP Server → Interface Backend
   ↓
7. 결과 수집

3단계 - Worker:
8. Frontend → Gateway Backend /ask (mode: worker)
   ↓
9. OpenAI: MCP 결과로 최종 답변 생성
   ↓
10. Frontend: Planner/Worker 탭에 표시
```

---

## MCP 프로토콜 구현

### JSON-RPC 2.0 표준 준수
```python
# 요청 형식
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": {...},
  "id": "unique_id"
}

# 성공 응답
{
  "jsonrpc": "2.0",
  "result": {...},
  "id": "unique_id"
}

# 에러 응답
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": "추가 정보"
  },
  "id": "unique_id"
}
```

### 에러 코드
- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

### 도구 스키마 형식
```python
{
  "name": "tool_name",
  "description": "도구 설명",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "파라미터 설명"
      }
    },
    "required": ["param1"]
  }
}
```

---

## 화면별 기능 상세

### 화면 1: API Backend Test
**목적**: Interface Backend의 각 API를 개별적으로 테스트

**UI 구성**:
- 왼쪽: 도구 선택 드롭다운 및 파라미터 입력
- 오른쪽: JSON 응답 표시

**테스트 가능 도구**:
- PDF 읽기: 백엔드_가이드.pdf, 프론트_가이드.pdf, 디비_가이드.pdf
- DB 조회: users, guides 테이블
- GitHub: 저장소 파일 읽기
- 시스템: 헬스 체크

### 화면 2: GPT Streaming Test
**목적**: OpenAI GPT 스트리밍 응답 테스트

**UI 구성**:
- 왼쪽: 질문 입력 텍스트 영역
- 오른쪽: 스트리밍 응답 (타이핑 효과)

**특징**:
- 실시간 문자 단위 스트리밍
- 20ms 딜레이 타이핑 애니메이션
- 응답 중단 가능

### 화면 3: MCP Integration
**목적**: AI + MCP 완전 자동 통합

**UI 구성**:
- 왼쪽: 질문 입력
- 중앙: AI 응답
- 오른쪽: MCP 호출 내역

**MCP 호출 내역 표시**:
```typescript
interface MCPCall {
  id: string;
  action: string;      // 도구 이름
  args: object;        // 입력 파라미터
  response: object;    // 응답 데이터
  timestamp: string;   // 호출 시간
  status: 'success' | 'error';
}
```

### 화면 4: 2 STEP Test
**목적**: Planner-Worker 패턴 테스트

**UI 구성**:
- 왼쪽: 질문 입력 (기본 프롬프트 제공)
- 중앙: Planner/Worker 탭
  - Planner 탭: MCP 도구 선택 계획
  - Worker 탭: 최종 AI 응답
- 오른쪽: MCP 호출 내역

**기본 프롬프트**:
```
400자 이내로 대답해줘.
백엔드 개발할수 있는 사람들한테 교육을 하려고 해.
어떤 내용을 어느 파일에서 교육해야 되는지 알려줘.
대상자들은 누가 되어야 되는지도.
```

---

## 설치 및 실행

### 사전 요구사항
```bash
# Python 3.11+
python --version

# Node.js 18+
node --version

# npm 9+
npm --version
```

### 1. 저장소 클론
```bash
git clone https://github.com/hli-yohan-lee/dev-mcp.git
cd dev-mcp
```

### 2. Python 가상환경 설정
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python -m venv venv
source venv/bin/activate
```

### 3. Backend 의존성 설치
```bash
# Gateway Backend
cd gateway-backend
pip install -r requirements.txt
cd ..

# MCP Server
cd mcp-server
pip install -r requirements.txt
cd ..

# Interface Backend
cd interface-backend
pip install -r requirements.txt
cd ..
```

### 4. Frontend 의존성 설치
```bash
cd frontend
npm install
cd ..
```

### 5. 환경 변수 설정
```bash
# OpenAI API 키 (Frontend에서 입력 가능)
# GitHub Token (Frontend에서 입력 가능)
```

### 6. 서버 실행
```bash
# Windows
start.bat

# 개별 실행 (디버깅용)
# Terminal 1: Gateway Backend
cd gateway-backend && python gateway.py

# Terminal 2: MCP Server
cd mcp-server && python app.py

# Terminal 3: Interface Backend
cd interface-backend && python main.py

# Terminal 4: Frontend
cd frontend && npm run dev
```

### 7. 접속
```
http://localhost:3000
```

---

## 개발 환경 설정

### VSCode 추천 확장
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-tslint-plugin"
  ]
}
```

### Python 린터 설정
```json
{
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black"
}
```

### TypeScript 설정 (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 디버깅 설정 (launch.json)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Gateway Backend",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["gateway:app", "--reload", "--port", "9000"],
      "cwd": "${workspaceFolder}/gateway-backend"
    },
    {
      "name": "MCP Server",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app:app", "--reload", "--port", "9001"],
      "cwd": "${workspaceFolder}/mcp-server"
    },
    {
      "name": "Interface Backend",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["main:app", "--reload", "--port", "9002"],
      "cwd": "${workspaceFolder}/interface-backend"
    },
    {
      "name": "Frontend",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

---

## 트러블슈팅

### 일반적인 문제 해결

#### 1. MCP 서버 연결 실패
```
증상: "MCP 도구를 가져올 수 없습니다"
원인: MCP 서버가 실행되지 않음
해결:
1. start.bat 실행 확인
2. 포트 9001 사용 확인: netstat -an | findstr :9001
3. app.py 파일 존재 확인
```

#### 2. OpenAI API 오류
```
증상: API 키 오류 메시지
원인: 잘못된 API 키
해결:
1. OpenAI API 키 확인
2. 키 앞뒤 공백 제거
3. 키가 sk-로 시작하는지 확인
```

#### 3. PDF 읽기 실패
```
증상: PDF 파일을 찾을 수 없음
원인: 파일 경로 문제
해결:
1. interface-backend/pdfs/ 폴더 확인
2. 파일명 정확히 일치 확인
3. 파일 권한 확인
```

#### 4. 포트 충돌
```
증상: Address already in use
원인: 포트가 이미 사용 중
해결:
Windows:
netstat -ano | findstr :9000
taskkill /PID <PID> /F

Linux/Mac:
lsof -i :9000
kill -9 <PID>
```

#### 5. CORS 오류
```
증상: CORS policy 오류
원인: CORS 설정 문제
해결:
모든 백엔드 서버에 CORS 미들웨어 확인:
allow_origins=["*"]
allow_methods=["*"]
allow_headers=["*"]
```

### 성능 최적화

#### Frontend 최적화
```typescript
// 불필요한 리렌더링 방지
const MemoizedComponent = React.memo(Component);

// 상태 업데이트 배치 처리
import { flushSync } from 'react-dom';

// 디바운싱 적용
const debouncedSearch = debounce(search, 500);
```

#### Backend 최적화
```python
# 비동기 처리
async with httpx.AsyncClient() as client:
    responses = await asyncio.gather(*tasks)

# 연결 풀링
client = httpx.AsyncClient(
    limits=httpx.Limits(max_keepalive_connections=5)
)

# 타임아웃 설정
timeout = httpx.Timeout(30.0, connect=5.0)
```

### 로깅 및 디버깅

#### Frontend 디버그 로그
```typescript
// useDebug 훅 사용
const { debugLogs, addDebugLog } = useDebug();

addDebugLog(`🚀 작업 시작: ${taskName}`);
addDebugLog(`✅ 작업 완료: ${result}`);
addDebugLog(`❌ 오류 발생: ${error}`);
```

#### Backend 로깅
```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info(f"MCP 도구 호
