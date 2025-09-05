# MCP Integration System - 완전 상세 설계 문서

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [아키텍처 구조](#아키텍처-구조)
3. [Frontend 상세 설계](#frontend-상세-설계)
4. [Backend 상세 설계](#backend-상세-설계)
5. [MCP Server 상세 설계](#mcp-server-상세-설계)
6. [Gateway Backend 상세 설계](#gateway-backend-상세-설계)
7. [데이터 흐름 상세](#데이터-흐름-상세)
8. [UI/UX 상세 설계](#uiux-상세-설계)
9. [API 스키마 상세](#api-스키마-상세)
10. [보안 및 인증](#보안-및-인증)
11. [실행 방법](#실행-방법)
12. [트러블슈팅](#트러블슈팅)

---

## 시스템 개요

### 핵심 목적
MCP(Model Context Protocol) 통합 시스템은 OpenAI GPT 모델과 로컬 도구들을 연결하여 지능형 자동화를 구현하는 시스템입니다. PDF 읽기, 데이터베이스 조회, GitHub 저장소 접근 등의 로컬 도구들을 GPT가 자동으로 호출하여 복잡한 질문에 답변할 수 있습니다.

### 주요 특징
- **4단계 테스트 환경**: GPT 직접 호출부터 2-Step(Planner-Worker) 패턴까지 단계별 테스트
- **MCP 표준 준수**: JSON-RPC 2.0 프로토콜 기반 표준 MCP 서버 구현
- **실시간 스트리밍**: 응답을 한 글자씩 스트리밍하여 사용자 경험 향상
- **디버그 패널**: 모든 API 호출과 응답을 실시간으로 모니터링
- **자동 토큰 로드**: config/tokens.txt에서 API 키 자동 로드

---

## 아키텍처 구조

### 전체 시스템 구성도
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                  │
│                         Port: 5173                           │
│  ┌─────────┬──────────┬──────────────┬─────────────────┐   │
│  │   GPT   │   API    │     MCP      │    2 STEP       │   │
│  │Streaming│ Backend  │ Integration  │    Test         │   │
│  └─────────┴──────────┴──────────────┴─────────────────┘   │
└──────┬──────────┬──────────────┬────────────────┬──────────┘
       │          │              │                │
       │          ▼              ▼                ▼
       │   ┌──────────┐  ┌──────────────┐  ┌──────────────┐
       │   │ Backend  │  │Gateway Backend│  │Gateway Backend│
       │   │Port: 9002│  │  Port: 9000   │  │  Port: 9000   │
       │   └────┬─────┘  └───────┬───────┘  └───────┬───────┘
       │        │                │                   │
       │        ▼                ▼                   ▼
       │   ┌──────────┐  ┌──────────────┐  ┌──────────────┐
       │   │MCP Server│  │  MCP Server  │  │  MCP Server  │
       │   │Port: 9001│  │  Port: 9001   │  │  Port: 9001   │
       │   └──────────┘  └──────────────┘  └──────────────┘
       │
       ▼
┌──────────────┐
│  OpenAI API  │
└──────────────┘
```

### 포트 할당
- **5173**: Frontend 개발 서버
- **9000**: Gateway Backend (OpenAI 통합)
- **9001**: MCP Server (JSON-RPC 2.0)
- **9002**: Interface Backend (데이터 처리)

---

## Frontend 상세 설계

### 기술 스택
- **Framework**: React 18.3.1
- **Language**: TypeScript 5.6.2
- **Build Tool**: Vite 6.0.3
- **Testing**: Vitest 2.1.8
- **HTTP Client**: Native fetch API

### 디렉토리 구조
```
frontend/
├── src/
│   ├── App.tsx              # 메인 앱 컴포넌트
│   ├── App.css              # 전역 스타일
│   ├── main.tsx             # 엔트리 포인트
│   ├── index.css            # 기본 스타일
│   ├── types/               # TypeScript 타입 정의
│   │   └── index.ts         # 모든 타입 정의
│   ├── pages/               # 페이지 컴포넌트
│   │   ├── GPTStreamingPage.tsx      # 1번 화면
│   │   ├── APIBackendTestPage.tsx    # 2번 화면
│   │   ├── MCPIntegrationPage.tsx    # 3번 화면
│   │   └── TwoStepTestPage.tsx       # 4번 화면
│   ├── hooks/               # 커스텀 훅
│   │   └── useDebug.ts      # 디버그 로그 관리
│   └── utils/               # 유틸리티 함수
│       └── debug.ts         # 디버그 헬퍼
├── package.json             # 의존성 정의
├── tsconfig.json            # TypeScript 설정
├── vite.config.ts           # Vite 설정
└── index.html               # HTML 템플릿
```

### 핵심 컴포넌트 상세

#### App.tsx - 메인 애플리케이션
```typescript
// 주요 기능:
// 1. 탭 네비게이션 관리 (4개 화면)
// 2. API 키 관리 (OpenAI, GitHub)
// 3. 토큰 자동 로드 (/config/tokens.txt)
// 4. 디버그 패널 토글
// 5. 전역 상태 관리

// 상태 관리:
- activeTab: TabType          // 현재 활성 탭
- apiKey: string              // OpenAI API 키
- githubToken: string         // GitHub 토큰
- debugLogs: string[]         // 디버그 로그 배열
- showDebugPanel: boolean     // 디버그 패널 표시 여부

// 토큰 로드 로직:
useEffect(() => {
  const loadTokens = async () => {
    const response = await fetch("/config/tokens.txt");
    const text = await response.text();
    const lines = text.split("\n");
    
    for (const line of lines) {
      if (line.startsWith("OPENAI_API_KEY=")) {
        setApiKey(line.split("=")[1].trim());
      } else if (line.startsWith("GITHUB_TOKEN=")) {
        setGithubToken(line.split("=")[1].trim());
      }
    }
  };
  loadTokens();
}, []);
```

#### GPTStreamingPage.tsx - 1번 화면
```typescript
// 기능: OpenAI API 직접 호출 및 스트리밍

// 핵심 로직:
1. OpenAI API 직접 호출 (https://api.openai.com/v1/chat/completions)
2. 응답 구조 상세 분석 (analyzeResponseStructure 함수)
3. 한 글자씩 스트리밍 효과 (20ms 딜레이)
4. 에러 처리 (401, 429, 500 등 HTTP 상태별)

// API 요청 형식:
{
  model: "gpt-5-mini",
  messages: [{ role: "user", content: prompt }],
  stream: false
}

// 스트리밍 구현:
for (let i = 0; i < responseText.length; i++) {
  currentText += responseText[i];
  setResponse(currentText);
  await new Promise(resolve => setTimeout(resolve, 20));
}
```

#### APIBackendTestPage.tsx - 2번 화면
```typescript
// 기능: Backend API 도구 테스트

// 테스트 가능한 API:
1. PDF API (3개 도구)
   - 백엔드_가이드.pdf
   - 프론트_가이드.pdf
   - 디비_가이드.pdf

2. Database API (5개 도구)
   - users 테이블 조회
   - guides 테이블 조회
   - 역할별 필터링 (backend, frontend, database)

3. GitHub API (2개 도구)
   - API_가이드.pdf 조회
   - GIT_가이드.pdf 조회

4. System API (1개 도구)
   - 헬스체크

// MCP 호출 상태 관리:
interface MCPCall {
  id: string;
  action: string;
  args: any;
  response: any;
  timestamp: string;
  status: 'loading' | 'success' | 'error';
}

// 즉시 로딩 상태 표시:
const loadingCall: MCPCall = {
  status: "loading",
  response: { loading: true }
};
```

#### MCPIntegrationPage.tsx - 3번 화면
```typescript
// 기능: AI + MCP 자동 통합 (1-Step)

// 처리 흐름:
1. Gateway Backend /ask 엔드포인트 호출
2. OpenAI가 자동으로 MCP 도구 선택 및 실행
3. 도구 실행 결과로 최종 답변 생성
4. 응답 스트리밍 + MCP 호출 내역 표시

// 레이아웃: 3단 구성
- 왼쪽: 질문 입력
- 중앙: AI 응답 (스트리밍)
- 오른쪽: MCP 호출 내역

// Gateway 응답 형식:
{
  answer: string,        // AI 최종 답변
  tools_used: string[],  // 사용된 도구 목록
  mcp_calls: MCPCall[]   // 상세 호출 내역
}
```

#### TwoStepTestPage.tsx - 4번 화면
```typescript
// 기능: 2-Step (Planner-Worker) 패턴

// 실행 단계:
1. Planner 단계
   - 질문 분석
   - 필요한 MCP 도구 선택
   - tool_calls 형식으로 계획 수립

2. MCP 실행 단계
   - 각 도구 순차 실행
   - 결과 수집

3. Worker 단계
   - MCP 결과 종합
   - 최종 답변 생성

// 특수 기능:
- GitHub 토큰 자동 주입
- Planner/Worker 탭 자동 전환
- JSON 추출 및 파싱 로직
- tool_calls 패턴 매칭

// 초기 프롬프트:
"400자 이내로 대답해줘.
백엔드 개발할수 있는 사람들한테 교육을 하려고 해.
어떤 내용을 어느 파일에서 교육해야 되는지 알려줘.
대상자들은 누가 되어야 되는지도."
```

### 커스텀 훅 - useDebug.ts
```typescript
export const useDebug = () => {
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [logEntry, ...prev.slice(0, 49)]); // 최대 50개 로그 유지
  };

  const clearDebugLogs = () => setDebugLogs([]);
  const toggleDebugPanel = () => setShowDebugPanel(prev => !prev);

  return { debugLogs, showDebugPanel, addDebugLog, clearDebugLogs, toggleDebugPanel };
};
```

### 타입 정의 (types/index.ts)
```typescript
export type TabType = 'gpt' | 'interface-backend' | '1step' | '2step';
export type ResponseTabType = 'planner' | 'worker';

export interface MCPCall {
  id: string;
  action: string;
  args: any;
  response: any;
  timestamp: string;
  status: 'loading' | 'success' | 'error';
}

export interface DebugHook {
  debugLogs: string[];
  showDebugPanel: boolean;
  addDebugLog: (message: string) => void;
  clearDebugLogs: () => void;
  toggleDebugPanel: () => void;
}
```

---

## Backend 상세 설계

### Interface Backend (포트 9002)

#### 기술 스택
- **Framework**: FastAPI
- **ASGI Server**: Uvicorn
- **Database**: SQLite3
- **PDF Processing**: PyPDF2
- **GitHub API**: requests + base64

#### 핵심 기능 구현

##### 1. 데이터베이스 초기화
```python
def init_database():
    # users 테이블
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        experience INTEGER
    )
    
    # guides 테이블
    CREATE TABLE guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT,
        author TEXT,
        created_at TEXT
    )
    
    # 초기 데이터
    users_data = [
        ("김개발", "kim@company.com", "backend", 5),
        ("이프론트", "lee@company.com", "frontend", 3),
        ("박풀스택", "park@company.com", "fullstack", 7),
        ("최디비", "choi@company.com", "database", 4)
    ]
```

##### 2. PDF 처리
```python
async def process_file_content(file_bytes: bytes, file_path: str) -> str:
    if file_path.lower().endswith('.pdf'):
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        content = ""
        for page in pdf_reader.pages:
            content += page.extract_text() + "\n"
        return content
    else:
        # 텍스트 파일 처리
        return file_bytes.decode('utf-8')
```

##### 3. GitHub API 통합
```python
@app.post("/api/github")
async def get_github_content(request: GithubRequest):
    # Basic Auth 헤더 생성
    auth_str = base64.b64encode(f"{username}:{password}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_str}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # 파일 내용 가져오기
    if file_data.get("encoding") == "base64":
        file_bytes = base64.b64decode(file_data["content"])
        content = await process_file_content(file_bytes, file_path)
    
    # 큰 파일 처리 (1MB 이상)
    elif file_data.get("encoding") == "none":
        download_url = file_data.get("download_url")
        download_response = requests.get(download_url, headers=headers)
        content = await process_file_content(download_response.content, file_path)
```

---

## MCP Server 상세 설계

### MCP Server (포트 9001)

#### 핵심 구현

##### 1. JSON-RPC 2.0 프로토콜
```python
class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = {}
    id: Optional[Union[str, int]] = None

class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    id: Optional[Union[str, int]] = None
```

##### 2. MCP 도구 정의
```python
TOOLS = [
    {
        "name": "read_pdf",
        "description": "PDF 파일을 읽어서 텍스트 내용을 추출합니다",
        "inputSchema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "enum": ["백엔드_가이드.pdf", "프론트_가이드.pdf", "디비_가이드.pdf"]
                }
            },
            "required": ["filename"]
        }
    },
    {
        "name": "query_database",
        "description": "데이터베이스에서 테이블 데이터를 조회합니다",
        "inputSchema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["users", "guides"]
                },
                "filters": {
                    "type": "object",
                    "additionalProperties": True
                }
            },
            "required": ["table"]
        }
    },
    {
        "name": "github_repository_info",
        "description": "GitHub 저장소 정보를 조회합니다",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repository": {"type": "string"},
                "username": {"type": "string"},
                "password": {"type": "string"},
                "file_path": {"type": "string"}
            },
            "required": ["repository", "username", "password"]
        }
    },
    {
        "name": "system_health",
        "description": "시스템 상태를 확인합니다",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    }
]
```

---

## Gateway Backend 상세 설계

### Gateway Backend (포트 9000)

#### 핵심 구현

##### 1. OpenAI 클라이언트 설정
```python
def get_openai_client(api_key: str) -> OpenAI:
    # SSL 검증 비활성화 (기업 환경)
    http_client = httpx.Client(verify=False)
    return OpenAI(
        api_key=api_key,
        http_client=http_client
    )
```

##### 2. /ask 엔드포인트 - 기본 모드
```python
@app.post("/ask")
async def ask_agent(request: dict) -> Dict[str, Any]:
    # MCP 도구 등록
    completion = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": "MCP 도구를 활용하는 AI 어시스턴트"},
            {"role": "user", "content": question}
        ],
        tools=mcp_tools,
        tool_choice="required"  # 반드시 도구 호출
    )
    
    # 도구 호출 처리
    for tool_call in message.tool_calls:
        tool_name = tool_call.function.name
        tool_args = json.loads(tool_call.function.arguments)
        
        # MCP 서버로 도구 실행
        result = await call_mcp_tool(tool_name, tool_args)
        
        # 도구 응답을 메시지에 추가
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result)
        })
    
    # 최종 답변 생성
    final_completion = client.chat.completions.create(
        model="gpt-5-mini",
        messages=messages
    )
```

---

## 데이터 흐름 상세

### 1번 화면 - GPT 직접 호출
```
User Input → Frontend → OpenAI API → Response → Streaming Display
```

### 2번 화면 - API Backend 테스트
```
Button Click → Frontend → Backend API → Database/PDF/GitHub → Response → UI Update
```

### 3번 화면 - MCP 통합 (1-Step)
```
User Question → Gateway Backend → OpenAI (with MCP tools) → MCP Server → Backend API → Response → Streaming Display
```

### 4번 화면 - 2-Step 테스트
```
User Question → Gateway (Planner) → Tool Selection → MCP Execution → Gateway (Worker) → Final Response
```

---

## UI/UX 상세 설계

### 색상 팔레트
- **Primary**: #667eea (보라색)
- **Secondary**: #764ba2 (진한 보라색)
- **Success**: #10b981 (녹색)
- **Warning**: #f59e0b (주황색)
- **Error**: #ef4444 (빨강색)
- **Background**: #f7f7f7 (연한 회색)
- **Dark**: #1e1e1e (디버그 패널)

### 레이아웃 구조
- **헤더**: 그라데이션 배경, 제목, API 키 입력, 디버그 토글
- **탭 네비게이션**: 4개 탭 버튼
- **메인 콘텐츠**: 각 화면별 레이아웃
- **디버그 패널**: 우측 하단 고정, 300px 높이

### 반응형 디자인
- 최소 너비: 1024px
- 3단 레이아웃: 각 열 1fr
- 디버그 패널: 400px 고정 너비

---

## API 스키마 상세

### PDF API
```json
POST /api/pdf
Request: {
  "filename": "백엔드_가이드.pdf"
}
Response: {
  "ok": true,
  "data": {
    "filename": "백엔드_가이드.pdf",
    "content": "PDF 내용...",
    "length": 1234
  }
}
```

### Database API
```json
POST /api/database
Request: {
  "table": "users",
  "filters": {"role": "backend"}
}
Response: {
  "ok": true,
  "data": {
    "table": "users",
    "records": [...],
    "count": 2
  }
}
```

### GitHub API
```json
POST /api/github
Request: {
  "repository": "hli-yohan-lee/dev-guide",
  "username": "hli.yohan.lee",
  "password": "ghp_xxx",
  "file_path": "API_가이드.pdf"
}
Response: {
  "ok": true,
  "data": {
    "repository": "hli-yohan-lee/dev-guide",
    "file": "API_가이드.pdf",
    "content": "파일 내용...",
    "size": 12345
  }
}
```

### Gateway /ask API
```json
POST /ask
Request: {
  "question": "백엔드 교육 자료를 찾아줘",
  "api_key": "sk-xxx",
  "mode": "default" | "2step" | "worker"
}
Response: {
  "answer": "AI 응답 내용",
  "tools_used": ["read_pdf", "query_database"],
  "mcp_calls": [
    {
      "id": "call_1",
      "action": "read_pdf",
      "args": {"filename": "백엔드_가이드.pdf"},
      "response": {...},
      "timestamp": "2024-01-01T12:00:00",
      "status": "success"
    }
  ]
}
```

---

## 보안 및 인증

### API 키 관리
- **OpenAI API Key**: config/tokens.txt에서 로드
- **GitHub Token**: Personal Access Token 사용
- **환경 변수**: 서버 측에서 os.getenv() 사용

### CORS 설정
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### SSL 처리
```python
# 기업 프록시 환경을 위한 SSL 검증 비활성화
http_client = httpx.Client(verify=False)
```

---

## 실행 방법

### 1. 토큰 설정
```bash
# config/tokens.txt 생성
OPENAI_API_KEY=sk-xxx
GITHUB_TOKEN=ghp_xxx
```

### 2. 의존성 설치
```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
pip install -r requirements.txt

# MCP Server
cd mcp-server
pip install -r requirements.txt

# Gateway Backend
cd gateway-backend
pip install -r requirements.txt
```

### 3. 서버 실행
```bash
# 방법 1: 개별 실행
cd backend && python main.py          # 포트 9002
cd mcp-server && python app.py        # 포트 9001
cd gateway-backend && python gateway.py # 포트 9000
cd frontend && npm run dev            # 포트 5173

# 방법 2: 배치 파일 사용
start.bat  # Windows
```

### 4. 접속
```
http://localhost:5173
```

---

## 트러블슈팅

### 자주 발생하는 문제

#### 1. API 키 오류
- **증상**: 401 Unauthorized
- **해결**: config/tokens.txt 확인, API 키 유효성 확인

#### 2. CORS 오류
- **증상**: CORS policy 에러
- **해결**: 모든 백엔드 서버가 실행 중인지 확인

#### 3. MCP 도구 호출 실패
- **증상**: MCP 도구가 undefined
- **해결**: MCP Server (9001) 실행 상태 확인

#### 4. PDF 읽기 실패
- **증상**: PDF 내용이 비어있음
- **해결**: backend/pdfs 폴더에 PDF 파일 존재 확인

#### 5. 데이터베이스 오류
- **증상**: 테이블을 찾을 수 없음
- **해결**: backend/database.db 파일 삭제 후 재시작

### 디버깅 팁
1. 디버그 패널 활용 - 모든 API 호출 로그 확인
2. 브라우저 개발자 도구 - Network 탭에서 요청/응답 확인
3. 서버 콘솔 로그 - 각 서버의 print 문 확인
4. 단계별 테스트 - 1번 화면부터 순차적으로 테스트

### 성능 최적화
1. **스트리밍 딜레이 조정**: 20ms → 10ms (빠른 표시)
2. **디버그 로그 제한**: 최대 50개 유지
3. **API 타임아웃**: 30초로 설정
4. **동시 요청 제한**: 한 번에 하나의 MCP 도구만 실행

---

## 마무리

이 시스템은 MCP(Model Context Protocol)를 통해 GPT와 로컬 도구들을 연결하는 완전한 통합 시스템입니다. 4단계의 점진적인 테스트 환경을 제공하여 개발자가 MCP 통합을 단계별로 이해하고 구현할 수 있도록 설계되었습니다.

핵심 특징:
- **표준 준수**: JSON-RPC 2.0 기반 MCP 구현
- **확장 가능**: 새로운 도구 쉽게 추가 가능
- **디버깅 용이**: 실시간 로그 및 상태 모니터링
- **사용자 친화적**: 직관적인 UI와 스트리밍 응답

이 설계 문서를 참고하여 동일한 시스템을 구축하거나 확장할 수 있습니
