# MCP Integration Platform - 구현 가이드

## 목차
1. [핵심 구현 세부사항](#핵심-구현-세부사항)
2. [Frontend 구현 상세](#frontend-구현-상세)
3. [Backend 구현 상세](#backend-구현-상세)
4. [통합 테스트 시나리오](#통합-테스트-시나리오)
5. [보안 고려사항](#보안-고려사항)
6. [확장성 설계](#확장성-설계)

---

## 핵심 구현 세부사항

### 1. OpenAI Function Calling 통합

#### Gateway Backend에서의 구현
```python
# gateway-backend/gateway.py

def get_openai_client(api_key: str) -> OpenAI:
    """SSL 검증을 비활성화한 OpenAI 클라이언트 생성"""
    import httpx
    
    # SSL 검증 비활성화 - 개발 환경용
    http_client = httpx.Client(verify=False)
    
    return OpenAI(
        api_key=api_key,
        http_client=http_client
    )

# OpenAI API 호출시 도구 등록
completion = client.chat.completions.create(
    model="gpt-5-mini",  # 모델명 주의
    messages=[
        {
            "role": "system", 
            "content": "당신은 MCP 도구를 활용하는 AI 어시스턴트입니다..."
        },
        {"role": "user", "content": question}
    ],
    tools=mcp_tools,  # MCP 도구 목록
    tool_choice="required"  # 반드시 도구 사용 강제
)
```

#### 도구 호출 결과 처리
```python
if message.tool_calls:
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
```

### 2. JSON-RPC 2.0 프로토콜 구현

#### 요청/응답 모델
```python
# mcp-server/app.py

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

#### 메서드 라우팅
```python
async def process_jsonrpc(request: JSONRPCRequest) -> JSONRPCResponse:
    """JSON-RPC 요청을 처리하고 적절한 핸들러로 라우팅"""
    try:
        if request.method == "initialize":
            result = await handle_initialize(request.params or {})
        elif request.method == "tools/list":
            result = await handle_tools_list(request.params or {})
        elif request.method == "tools/call":
            result = await handle_tools_call(request.params or {})
        else:
            return JSONRPCResponse(
                jsonrpc="2.0",
                error={
                    "code": -32601,
                    "message": f"Method not found: {request.method}"
                },
                id=request.id
            )
```

### 3. MCP 도구 정의 구조

#### 표준 MCP 도구 스키마
```python
TOOLS = [
    {
        "name": "read_pdf",
        "description": "PDF 파일을 읽어서 텍스트 내용을 추출합니다",
        "inputSchema": {  # JSON Schema 형식
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "읽을 PDF 파일명",
                    "enum": ["백엔드_가이드.pdf", "프론트_가이드.pdf", "디비_가이드.pdf"]
                }
            },
            "required": ["filename"]
        }
    }
]
```

#### OpenAI 형식으로 변환
```python
def convert_to_openai_format(mcp_tool):
    """MCP 도구를 OpenAI Function Calling 형식으로 변환"""
    return {
        "type": "function",
        "function": {
            "name": mcp_tool["name"],
            "description": mcp_tool["description"],
            "parameters": mcp_tool["inputSchema"]
        }
    }
```

---

## Frontend 구현 상세

### 1. React 컴포넌트 구조

#### App.tsx - 메인 컨테이너
```typescript
import React, { useState, useEffect } from 'react';
import './App.css';

// 페이지 컴포넌트 임포트
import { APIBackendTestPage } from './pages/APIBackendTestPage';
import { GPTStreamingPage } from './pages/GPTStreamingPage';
import { MCPIntegrationPage } from './pages/MCPIntegrationPage';
import { TwoStepTestPage } from './pages/TwoStepTestPage';

function App() {
  // 상태 관리
  const [activeTab, setActiveTab] = useState(0);
  const [apiKey, setApiKey] = useState(() => 
    localStorage.getItem('openai_api_key') || ''
  );
  const [githubToken, setGithubToken] = useState(() => 
    localStorage.getItem('github_token') || ''
  );
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // API 키 저장
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
    }
  }, [apiKey]);

  // GitHub 토큰 저장
  useEffect(() => {
    if (githubToken) {
      localStorage.setItem('github_token', githubToken);
    }
  }, [githubToken]);

  // 디버그 로그 추가 함수
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  };

  return (
    <div className="app">
      {/* 헤더 영역 */}
      <header className="app-header">
        <h1>MCP Integration Test</h1>
        <div className="api-key-section">
          <input
            type="password"
            placeholder="OpenAI API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="api-key-input"
          />
          <input
            type="password"
            placeholder="GitHub Token (optional)"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            className="api-key-input"
          />
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="tabs">
        {['API Backend Test', 'GPT Streaming Test', 'MCP Integration', '2 STEP Test'].map((label, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="tab-content">
        {activeTab === 0 && <APIBackendTestPage addDebugLog={addDebugLog} />}
        {activeTab === 1 && <GPTStreamingPage apiKey={apiKey} addDebugLog={addDebugLog} />}
        {activeTab === 2 && <MCPIntegrationPage apiKey={apiKey} addDebugLog={addDebugLog} />}
        {activeTab === 3 && <TwoStepTestPage apiKey={apiKey} githubToken={githubToken} addDebugLog={addDebugLog} />}
      </div>

      {/* 디버그 콘솔 */}
      <div className="debug-console">
        <h3>Debug Logs</h3>
        <div className="debug-logs">
          {debugLogs.map((log, index) => (
            <div key={index} className="debug-log">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 2. 타입 정의 (types/index.ts)

```typescript
// MCP 호출 인터페이스
export interface MCPCall {
  id: string;
  action: string;
  args: any;
  response: any;
  timestamp: string;
  status: 'success' | 'error';
}

// 응답 탭 타입
export type ResponseTabType = 'response' | 'mcp' | 'planner' | 'worker';

// API 응답 타입
export interface APIResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

// 도구 정의 타입
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}
```

### 3. CSS 스타일링 구조

```css
/* App.css - 주요 레이아웃 */

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0e27;
  color: #e0e0e0;
}

/* 3열 레이아웃 */
.three-section-layout {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  height: 100%;
  padding: 20px;
}

/* 입력 섹션 */
.input-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

/* 응답 섹션 */
.response-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

/* MCP 호출 내역 */
.mcp-calls-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
}

.mcp-call {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
  border-left: 3px solid #4caf50;
}

.mcp-call.error {
  border-left-color: #f44336;
}

/* 버튼 스타일 */
.submit-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 탭 스타일 */
.tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px;
  gap: 10px;
}

.tab {
  padding: 10px 20px;
  background: transparent;
  color: #888;
  border: 1px solid #333;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
```

### 4. 스트리밍 구현 (GPTStreamingPage)

```typescript
const handleStreamingGPT = async () => {
  if (!prompt.trim() || !apiKey.trim()) return;
  
  setPrompt("");
  setResponse("");
  setIsLoading(true);

  try {
    // Gateway Backend 호출
    const response = await fetch("http://localhost:9000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: prompt,
        api_key: apiKey,
        mode: "default"
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.answer;
      
      // 스트리밍 효과 구현
      let currentText = "";
      for (let i = 0; i < text.length; i++) {
        currentText += text[i];
        setResponse(currentText);
        
        // 20ms 딜레이로 타이핑 효과
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
  } catch (error) {
    console.error("Streaming error:", error);
    setResponse(`오류: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
};
```

### 5. MCP 호출 추적 구현

```typescript
// MCPIntegrationPage.tsx
const handleCombinedGPT = async () => {
  // MCP 호출 내역 초기화
  setMcpCalls([]);
  setResponse("");
  
  try {
    const response = await fetch("http://localhost:9000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: prompt,
        api_key: apiKey
      }),
    });

    if (response.ok) {
      const data = await response.json();
      
      // MCP 호출 내역 처리
      if (data.mcp_calls && data.mcp_calls.length > 0) {
        const newMcpCalls = data.mcp_calls.map((call: any) => ({
          id: call.id || Date.now().toString(),
          action: call.action,
          args: call.args,
          response: call.response,
          timestamp: new Date().toISOString(),
          status: call.status
        }));
        
        setMcpCalls(newMcpCalls);
      }
      
      // 응답 스트리밍
      const answerText = data.answer;
      let currentText = "";
      for (let i = 0; i < answerText.length; i++) {
        currentText += answerText[i];
        setResponse(currentText);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
  } catch (error) {
    console.error("MCP Integration error:", error);
  }
};
```

---

## Backend 구현 상세

### 1. FastAPI 애플리케이션 구조

#### 기본 설정
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Service Name", version="1.0.0")

# CORS 설정 - 모든 오리진 허용 (개발용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Interface Backend 구현

#### PDF 처리 (PyPDF2 사용)
```python
# interface-backend/main.py
import PyPDF2
from datetime import datetime
import os

@app.post("/api/pdf")
async def read_pdf(request: dict):
    """PDF 파일을 읽어 텍스트 추출"""
    filename = request.get("filename")
    
    if not filename:
        return {"error": "filename is required"}
    
    # PDF 파일 경로
    pdf_path = os.path.join("pdfs", filename)
    
    if not os.path.exists(pdf_path):
        return {"error": f"File not found: {filename}"}
    
    try:
        # PyPDF2로 PDF 읽기
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            
            # 모든 페이지에서 텍스트 추출
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text()
        
        return {
            "filename": filename,
            "content": text,
            "pages": len(pdf_reader.pages),
            "extracted_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": f"PDF reading failed: {str(e)}"}
```

#### SQLite 데이터베이스 처리
```python
import sqlite3
import json

def init_database():
    """데이터베이스 초기화"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # users 테이블 생성
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            role TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # guides 테이블 생성
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS guides (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 샘플 데이터 삽입
    sample_users = [
        ('John Doe', 'john@example.com', 'backend'),
        ('Jane Smith', 'jane@example.com', 'frontend'),
        ('Bob Johnson', 'bob@example.com', 'fullstack')
    ]
    
    cursor.executemany(
        'INSERT OR IGNORE INTO users (name, email, role) VALUES (?, ?, ?)',
        sample_users
    )
    
    conn.commit()
    conn.close()

@app.post("/api/database")
async def query_database(request: dict):
    """데이터베이스 쿼리 실행"""
    table = request.get("table")
    filters = request.get("filters", {})
    
    if not table:
        return {"error": "table is required"}
    
    # SQL Injection 방지를 위한 테이블 화이트리스트
    allowed_tables = ["users", "guides"]
    if table not in allowed_tables:
        return {"error": f"Invalid table: {table}"}
    
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row  # 딕셔너리 형태로 결과 반환
    cursor = conn.cursor()
    
    try:
        # WHERE 절 구성
        where_clauses = []
        params = []
        
        for key, value in filters.items():
            where_clauses.append(f"{key} = ?")
            params.append(value)
        
        # 쿼리 실행
        query = f"SELECT * FROM {table}"
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # 결과를 딕셔너리 리스트로 변환
        data = [dict(row) for row in rows]
        
        return {
            "table": table,
            "data": data,
            "count": len(data)
        }
        
    except Exception as e:
        return {"error": f"Database query failed: {str(e)}"}
    finally:
        conn.close()
```

#### GitHub API 통합
```python
import httpx
import base64

@app.post("/api/github")
async def github_repository_info(request: dict):
    """GitHub 저장소 정보 조회"""
    repository = request.get("repository")
    username = request.get("username")
    password = request.get("password")  # GitHub Personal Access Token
    file_path = request.get("file_path")
    
    if not all([repository, username, password]):
        return {"error": "repository, username, and password are required"}
    
    # GitHub API URL 구성
    if file_path:
        api_url = f"https://api.github.com/repos/{repository}/contents/{file_path}"
    else:
        api_url = f"https://api.github.com/repos/{repository}"
    
    # Basic 인증 헤더
    auth_string = f"{username}:{password}"
    auth_bytes = auth_string.encode('utf-8')
    auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
    
    headers = {
        "Authorization": f"Basic {auth_b64}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(api_url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # 파일 내용이 있는 경우 Base64 디코딩
                if file_path and 'content' in data:
                    content_b64 = data['content']
                    content_bytes = base64.b64decode(content_b64)
                    content_text = content_bytes.decode('utf-8')
                    
                    return {
                        "repository": repository,
                        "file_path": file_path,
                        "content": content_text,
                        "sha": data.get('sha'),
                        "size": data.get('size')
                    }
                else:
                    return data
                    
            else:
                return {"error": f"GitHub API error: {response.status_code}"}
                
        except Exception as e:
            return {"error": f"GitHub request failed: {str(e)}"}
```

### 3. 2-Step 모드 구현

#### Planner 모드
```python
# gateway-backend/gateway.py

if mode == "2step":
    print("2 STEP 모드 - Planner 실행")
    
    # MCP 도구를 OpenAI에 등록
    mcp_tools = await get_mcp_tools()
    
    # Planner 프롬프트
    planner_prompt = f"""
    사용자 질문을 분석하여 필요한 MCP 도구들을 선택하세요.
    
    사용 가능한 도구:
    1. read_pdf - PDF 파일 읽기
    2. query_database - 데이터베이스 조회
    3. github_repository_info - GitHub 저장소 정보 조회
    4. system_health - 시스템 상태 확인
    
    사용자 질문: {question}
    
    필요한 도구들을 선택하여 호출하세요.
    """
    
    # OpenAI API 호출
    completion = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": "당신은 MCP 도구를 선택하는 Planner입니다."},
            {"role": "user", "content": planner_prompt}
        ],
        tools=mcp_tools,
        tool_choice="required"
    )
    
    # tool_calls 추출 및 반환
    tool_calls = []
    if completion.choices[0].message.tool_calls:
        for tool_call in completion.choices[0].message.tool_calls:
            tool_calls.append({
                "tool_name": tool_call.function.name,
                "parameters": json.loads(tool_call.function.arguments)
            })
    
    return {
        "mode": "2step",
        "tool_calls": tool_calls,
        "planner_response": f"MCP 도구 호출 계획을 수립했습니다."
    }
```

#### Worker 모드
```python
elif mode == "worker":
    print("Worker 모드 - MCP 결과로 최종 답변 생성")
    
    # MCP 실행 결과 받기
    mcp_results = request.get("mcp_results", [])
    
    # 결과를 텍스트로 변환
    results_text = "MCP 도구 실행 결과:\n\n"
    for result in mcp_results:
        tool_name = result.get("tool", "unknown")
        tool_result = result.get("result", {})
        results_text += f"도구: {tool_name}\n"
        results_text += f"결과: {json.dumps(tool_result, ensure_ascii=False, indent=2)}\n\n"
    
    # 최종 답변 생성
    completion = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": "당신은 MCP 도구 실행 결과를 바탕으로 사용자 질문에 답변하는 Worker입니다."},
            {"role": "user", "content": f"다음 MCP 도구 실행 결과를 바탕으로 사용자 질문에 답변하세요.\n\n{results_text}\n\n사용자 질문: {question}"}
        ]
    )
    
    return {
        "answer": completion.choices[0].message.content,
        "mode": "worker"
    }
```

---

## 통합 테스트 시나리오

### 테스트 케이스 1: 기본 MCP 통합
```
1. 화면 3 선택
2. OpenAI API 키 입력
3. 질문: "백엔드 가이드 PDF를 읽어서 요약해줘"
4. 예상 결과:
   - MCP 도구 자동 선택 (read_pdf)
   - PDF 내용 추출
   - AI 요약 생성
   - 우측 패널에 MCP 호출 내역 표시
```

### 테스트 케이스 2: 2-Step 처리
```
1. 화면 4 선택
2. 기본 프롬프트 사용
3. 예상 결과:
   - Planner 탭: MCP 도구 선택 계획
   - Worker 탭: 최종 답변
   - 우측 패널: 모든 MCP 호출 내역
```

### 테스트 케이스 3: 멀티 도구 사용
```
1. 질문: "데이터베이스에서 backend 역할의 사용자를 조회하고 백엔드 가이드 PDF도 읽어줘"
2. 예상 결과:
   - query_database 호출
   - read_pdf 호출
   - 두 결과를 종합한 AI 답변
```

### 성능 테스트
```python
# 부하 테스트 스크립트
import asyncio
import httpx
import time

async def test_concurrent_requests(num_requests=10):
    """동시 요청 테스트"""
    async with httpx.AsyncClient() as client:
        tasks = []
        
        for i in range(num_requests):
            task = client.post(
                "http://localhost:9000/ask",
                json={
                    "question": f"테스트 질문 {i}",
                    "api_key": "test-key"
                }
            )
            tasks.append(task)
        
        start_time = time.time()
        responses = await asyncio.gather(*tasks)
        end_time = time.time()
        
        successful = sum(1 for r in responses if r.status_code == 200)
        
        print(f"총 요청: {num_requests}")
        print(f"성공: {successful}")
        print(f"소요 시간: {end_time - start_time:.2f}초")
        print(f"RPS: {num_requests / (end_time - start_time):.2f}")

# 실행
asyncio.run(test_concurrent_requests(10))
```

---

## 보안 고려사항

### 1. API 키 관리
```typescript
// Frontend에서 API 키 관리
const [apiKey, setApiKey] = useState(() => 
  localStorage.getItem('openai_api_key') || ''
);

// 마스킹 입력
<input
  type="password"
  placeholder="OpenAI API Key"
  value={apiKey}
  onChange={(e) => setApiKey(e.target
