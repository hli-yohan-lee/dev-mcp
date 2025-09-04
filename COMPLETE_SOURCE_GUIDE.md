# MCP Integration Platform - 완전 소스코드 가이드

## 목차
1. [Frontend 전체 소스코드](#frontend-전체-소스코드)
2. [Backend 전체 소스코드](#backend-전체-소스코드)
3. [설정 파일들](#설정-파일들)
4. [실행 스크립트](#실행-스크립트)
5. [디버깅 및 테스트](#디버깅-및-테스트)

---

## Frontend 전체 소스코드

### 1. package.json
```json
{
  "name": "mcp-test-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.24.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "typescript": "^5.5.2",
    "vite": "^5.3.5",
    "vitest": "^1.6.0"
  }
}
```

### 2. App.tsx - 완전한 메인 컴포넌트
```typescript
import React, { useState, useEffect } from 'react';
import './App.css';
import { APIBackendTestPage } from './pages/APIBackendTestPage';
import { GPTStreamingPage } from './pages/GPTStreamingPage';
import { MCPIntegrationPage } from './pages/MCPIntegrationPage';
import { TwoStepTestPage } from './pages/TwoStepTestPage';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [apiKey, setApiKey] = useState(() => 
    localStorage.getItem('openai_api_key') || ''
  );
  const [githubToken, setGithubToken] = useState(() => 
    localStorage.getItem('github_token') || ''
  );
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugEnabled, setDebugEnabled] = useState(true);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    if (githubToken) {
      localStorage.setItem('github_token', githubToken);
    }
  }, [githubToken]);

  const addDebugLog = (message: string) => {
    if (!debugEnabled) return;
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>MCP Integration Test</h1>
        <div className="api-key-section">
          <input
            type="password"
            placeholder="OpenAI API Key (required)"
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

      <div className="tabs">
        <button
          className={`tab ${activeTab === 0 ? 'active' : ''}`}
          onClick={() => setActiveTab(0)}
        >
          1. API Backend Test
        </button>
        <button
          className={`tab ${activeTab === 1 ? 'active' : ''}`}
          onClick={() => setActiveTab(1)}
        >
          2. GPT Streaming Test
        </button>
        <button
          className={`tab ${activeTab === 2 ? 'active' : ''}`}
          onClick={() => setActiveTab(2)}
        >
          3. MCP Integration
        </button>
        <button
          className={`tab ${activeTab === 3 ? 'active' : ''}`}
          onClick={() => setActiveTab(3)}
        >
          4. 2 STEP Test
        </button>
      </div>

      <div className="main-content">
        {activeTab === 0 && <APIBackendTestPage addDebugLog={addDebugLog} />}
        {activeTab === 1 && <GPTStreamingPage apiKey={apiKey} addDebugLog={addDebugLog} />}
        {activeTab === 2 && <MCPIntegrationPage apiKey={apiKey} addDebugLog={addDebugLog} />}
        {activeTab === 3 && <TwoStepTestPage apiKey={apiKey} githubToken={githubToken} addDebugLog={addDebugLog} />}
      </div>

      {debugEnabled && (
        <div className="debug-console">
          <div className="debug-header">
            <h3>Debug Console</h3>
            <div className="debug-controls">
              <button onClick={clearDebugLogs}>Clear</button>
              <button onClick={() => setDebugEnabled(false)}>Hide</button>
            </div>
          </div>
          <div className="debug-logs">
            {debugLogs.map((log, index) => (
              <div key={index} className={`debug-log ${
                log.includes('❌') ? 'error' : 
                log.includes('✅') ? 'success' : 
                log.includes('⚠️') ? 'warning' : ''
              }`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {!debugEnabled && (
        <button className="debug-toggle" onClick={() => setDebugEnabled(true)}>
          Show Debug
        </button>
      )}
    </div>
  );
}

export default App;
```

### 3. App.css - 완전한 스타일시트
```css
/* 기본 리셋 및 변수 */
:root {
  --bg-primary: #0a0e27;
  --bg-secondary: rgba(255, 255, 255, 0.05);
  --bg-hover: rgba(255, 255, 255, 0.08);
  --text-primary: #e0e0e0;
  --text-secondary: #888;
  --accent-primary: #667eea;
  --accent-secondary: #764ba2;
  --success: #4caf50;
  --error: #f44336;
  --warning: #ff9800;
  --border: #333;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

/* 메인 레이아웃 */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  background: var(--bg-secondary);
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  font-size: 1.5rem;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.api-key-section {
  display: flex;
  gap: 1rem;
}

.api-key-input {
  padding: 0.5rem 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  width: 250px;
  font-size: 0.9rem;
}

.api-key-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

/* 탭 네비게이션 */
.tabs {
  display: flex;
  background: var(--bg-secondary);
  padding: 0.5rem 1rem;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.tab {
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  font-weight: 500;
}

.tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab.active {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
  border-color: transparent;
}

/* 메인 컨텐츠 영역 */
.main-content {
  flex: 1;
  overflow: hidden;
}

/* 3열 레이아웃 */
.three-section-layout {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  height: 100%;
  padding: 1rem;
}

/* 2열 레이아웃 */
.two-section-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  height: 100%;
  padding: 1rem;
}

/* 섹션 스타일 */
.input-section,
.response-section,
.mcp-calls-section {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

/* 입력 영역 */
.input-textarea {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  padding: 1rem;
  font-size: 0.95rem;
  font-family: 'Monaco', 'Menlo', monospace;
  resize: none;
  margin-bottom: 1rem;
}

.input-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
}

/* 버튼 스타일 */
.submit-button {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 응답 영역 */
.response-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);
  border-radius: 4px;
  padding: 1rem;
}

.response-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

/* 응답 탭 */
.response-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab-button {
  padding: 0.5rem 1rem;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.85rem;
}

.tab-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-button.active {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

/* MCP 호출 내역 */
.mcp-calls-container {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);
  border-radius: 4px;
  padding: 1rem;
}

.mcp-call {
  background: var(--bg-hover);
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-left: 3px solid var(--success);
  transition: all 0.3s ease;
}

.mcp-call:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mcp-call.error {
  border-left-color: var(--error);
}

.call-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-badge {
  background: var(--accent-primary);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.success {
  background: var(--success);
  color: white;
}

.status-badge.error {
  background: var(--error);
  color: white;
}

.args-preview {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-family: monospace;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timestamp {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  text-align: center;
}

.empty-state p {
  margin-bottom: 0.5rem;
}

/* 디버그 콘솔 */
.debug-console {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: rgba(10, 14, 39, 0.98);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.debug-header h3 {
  font-size: 0.9rem;
  font-weight: 600;
}

.debug-controls {
  display: flex;
  gap: 0.5rem;
}

.debug-controls button {
  padding: 0.25rem 0.75rem;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.debug-controls button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.debug-logs {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1rem;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
}

.debug-log {
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
}

.debug-log.error {
  color: var(--error);
}

.debug-log.success {
  color: var(--success);
}

.debug-log.warning {
  color: var(--warning);
}

.debug-toggle {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  z-index: 999;
  transition: all 0.3s ease;
}

.debug-toggle:hover {
  background: var(--bg-hover);
}

/* Tool 선택 영역 (화면 1) */
.tool-selector {
  margin-bottom: 1rem;
}

.tool-selector select {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.95rem;
  cursor: pointer;
}

.tool-selector select:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.tool-params {
  margin-bottom: 1rem;
}

.param-group {
  margin-bottom: 1rem;
}

.param-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.param-group input,
.param-group select {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.9rem;
}

.param-group input:focus,
.param-group select:focus {
  outline: none;
  border-color: var(--accent-primary);
}

/* JSON Response Display */
.json-response {
  background: var(--bg-primary);
  border-radius: 4px;
  padding: 1rem;
  overflow: auto;
  height: 100%;
}

.json-response pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--text-primary);
}

/* 로딩 상태 */
.loading-indicator {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-left: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 반응형 디자인 */
@media (max-width: 1200px) {
  .three-section-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .two-section-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  
  .api-key-section {
    flex-direction: column;
    width: 100%;
  }
  
  .api-key-input {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .tabs {
    flex-wrap: wrap;
  }
  
  .tab {
    flex: 1;
    min-width: calc(50% - 0.25rem);
  }
}
```

### 4. types/index.ts - 완전한 타입 정의
```typescript
// MCP 호출 관련 타입
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

// OpenAI 도구 형식
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

// 도구 호출 타입
export interface ToolCall {
  tool_name: string;
  parameters: any;
}

// 2-Step 응답 타입
export interface TwoStepResponse {
  mode: '2step';
  tool_calls: ToolCall[];
  planner_response?: string;
  error?: string;
}

// Worker 응답 타입
export interface WorkerResponse {
  answer: string;
  mode: 'worker';
}

// 기본 응답 타입
export interface DefaultResponse {
  answer: string;
  tools_used: string[];
  mcp_calls: MCPCall[];
}

// MCP 결과 타입
export interface MCPResult {
  tool: string;
  args: any;
  result: any;
}

// 디버그 로그 타입
export interface DebugLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

// 페이지 Props 타입
export interface PageProps {
  addDebugLog: (message: string) => void;
}

export interface AuthPageProps extends PageProps {
  apiKey: string;
}

export interface ExtendedPageProps extends AuthPageProps {
  githubToken: string;
}
```

---

## Backend 전체 소스코드

### 1. requirements.txt (공통)
```txt
fastapi==0.104.1
uvicorn==0.24.0
httpx==0.25.1
openai==1.3.5
pydantic==2.5.0
python-multipart==0.0.6
PyPDF2==3.0.1
python-dotenv==1.0.0
```

### 2. Gateway Backend - gateway.py (완전체)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import json
import asyncio
import httpx
from openai import OpenAI
import traceback
import time

app = FastAPI(title="MCP Gateway Backend", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MCP 서버 엔드포인트
MCP_ENDPOINT = "http://localhost:9001"

# OpenAI 클라이언트 생성
def get_openai_client(api_key: str) -> OpenAI:
    """SSL 검증을 비활성화한 OpenAI 클라이언트 생성"""
    import httpx
    http_client = httpx.Client(verify=False)
    return OpenAI(api_key=api_key, http_client=http_client)

async def get_mcp_tools() -> List[Dict[str, Any]]:
    """MCP 서버에서 사용 가능한 도구 목록을 가져옵니다 (JSON-RPC 2.0)"""
    try:
        print("MCP 서버에서 도구 목록 조회 중 (JSON-RPC)...")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # JSON-RPC 2.0 요청
            jsonrpc_request = {
                "jsonrpc": "2.0",
                "method": "tools/list",
                "params": {},
                "id": 1
            }
            
            # JSON-RPC 엔드포인트로 시도
            try:
                response = await client.post(f"{MCP_ENDPOINT}/", json=jsonrpc_request)
                
                if response.status_code == 200:
                    jsonrpc_response = response.json()
                    
                    if "error" in jsonrpc_response:
                        print(f"JSON-RPC 에러: {jsonrpc_response['error']}")
                        # 레거시 REST API로 폴백
                        response = await client.get(f"{MCP_ENDPOINT}/mcp/tools")
                        if response.status_code == 200:
                            tools = response.json()
                            print(f"MCP 도구 목록 조회 완료 (REST): {len(tools)}개")
                            return tools
                    else:
                        # JSON-RPC 응답에서 도구 추출
                        tools_data = jsonrpc_response.get("result", {}).get("tools", [])
                        # OpenAI 형식으로 변환
                        openai_tools = []
                        for tool in tools_data:
                            openai_tool = {
                                "type": "function",
                                "function": {
                                    "name": tool["name"],
                                    "description": tool["description"],
                                    "parameters": tool.get("inputSchema", tool.get("parameters", {}))
                                }
                            }
                            openai_tools.append(openai_tool)
                        print(f"MCP 도구 목록 조회 완료 (JSON-RPC): {len(openai_tools)}개")
                        return openai_tools
            except Exception as json_error:
                print(f"JSON-RPC 실패: {json_error}, REST API로 폴백")
                # JSON-RPC 실패 시 레거시 REST API 사용
                response = await client.get(f"{MCP_ENDPOINT}/mcp/tools")
                if response.status_code == 200:
                    tools = response.json()
                    print(f"MCP 도구 목록 조회 완료 (REST fallback): {len(tools)}개")
                    return tools
                    
        return []
                
    except Exception as e:
        print(f"MCP 도구 목록 조회 실패: {e}")
        traceback.print_exc()
        return []

async def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    """MCP 서버의 도구를 실행합니다 (JSON-RPC 2.0)"""
    try:
        print(f"MCP 도구 실행 시작: {tool_name}")
        print(f"파라미터: {json.dumps(arguments, ensure_ascii=False)}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # JSON-RPC 2.0 요청
            jsonrpc_request = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": tool_name,
