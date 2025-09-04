"""
Standard MCP Server with JSON-RPC 2.0 Protocol
Implements Model Context Protocol specification
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Union
import json
import httpx
import uuid
import os
import traceback

# FastAPI 앱 생성
app = FastAPI(title="MCP Server (JSON-RPC 2.0)", version="2.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JSON-RPC 2.0 요청/응답 모델
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

# MCP 표준 도구 정의 (OpenAI 호환 형식 유지)
TOOLS = [
    {
        "name": "read_pdf",
        "description": "PDF 파일을 읽어서 텍스트 내용을 추출합니다",
        "inputSchema": {
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
    },
    {
        "name": "query_database",
        "description": "데이터베이스에서 테이블 데이터를 조회합니다",
        "inputSchema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "조회할 테이블명",
                    "enum": ["users", "guides"]
                },
                "filters": {
                    "type": "object",
                    "description": "필터링 조건 (예: {'role': 'backend'})",
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
                "repository": {
                    "type": "string",
                    "description": "GitHub 저장소명 (예: hli-yohan-lee/dev-guide)"
                },
                "username": {
                    "type": "string",
                    "description": "GitHub 사용자명"
                },
                "password": {
                    "type": "string",
                    "description": "GitHub Personal Access Token"
                },
                "file_path": {
                    "type": "string",
                    "description": "읽을 파일 경로 (예: API_가이드, GIT_가이드)"
                }
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

# MCP 서버 정보
SERVER_INFO = {
    "protocolVersion": "2024-11-05",
    "capabilities": {
        "tools": {}
    },
    "serverInfo": {
        "name": "mcp-server",
        "version": "2.0.0"
    }
}

async def handle_initialize(params: Dict[str, Any]) -> Dict[str, Any]:
    """MCP 초기화 처리"""
    return SERVER_INFO

async def handle_tools_list(params: Dict[str, Any]) -> Dict[str, Any]:
    """도구 목록 반환"""
    return {"tools": TOOLS}

async def handle_tools_call(params: Dict[str, Any]) -> Dict[str, Any]:
    """도구 실행"""
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    if not tool_name:
        raise ValueError("Tool name is required")
    
    print(f"MCP 도구 호출: {tool_name} - {arguments}")
    
    try:
        # 내부 API 서버로 위임
        async with httpx.AsyncClient(timeout=30.0) as client:
            if tool_name == "read_pdf":
                response = await client.post("http://localhost:9002/api/pdf", json=arguments)
            elif tool_name == "query_database":
                response = await client.post("http://localhost:9002/api/database", json=arguments)
            elif tool_name == "github_repository_info":
                # GitHub 플레이스홀더를 실제 값으로 대체
                processed_args = arguments.copy() if arguments else {}
                
                if processed_args.get("username") == "<GITHUB_USERNAME>":
                    processed_args["username"] = "hli.yohan.lee"
                
                if processed_args.get("password") == "<GITHUB_PAT>":
                    github_token = os.getenv("GITHUB_TOKEN", "YOUR_GITHUB_TOKEN_HERE")
                    processed_args["password"] = github_token
                
                response = await client.post("http://localhost:9002/api/github", json=processed_args)
            elif tool_name == "system_health":
                response = await client.post("http://localhost:9002/api/health", json=arguments)
            else:
                raise ValueError(f"Unknown tool: {tool_name}")
            
            if response.status_code == 200:
                # 응답 처리
                content_type = response.headers.get('content-type', '')
                
                if 'application/json' in content_type:
                    response.encoding = 'utf-8'
                    result = response.json()
                    return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]}
                else:
                    response.encoding = 'utf-8'
                    text_data = response.text
                    return {"content": [{"type": "text", "text": text_data}]}
            else:
                error_msg = f"Internal API error: HTTP {response.status_code}"
                raise Exception(error_msg)
                
    except Exception as e:
        print(f"도구 실행 오류: {e}")
        raise

async def process_jsonrpc(request: JSONRPCRequest) -> JSONRPCResponse:
    """JSON-RPC 요청 처리"""
    try:
        # 메서드별 처리
        if request.method == "initialize":
            result = await handle_initialize(request.params or {})
        elif request.method == "tools/list":
            result = await handle_tools_list(request.params or {})
        elif request.method == "tools/call":
            result = await handle_tools_call(request.params or {})
        else:
            # 메서드를 찾을 수 없음
            return JSONRPCResponse(
                jsonrpc="2.0",
                error={
                    "code": -32601,
                    "message": f"Method not found: {request.method}"
                },
                id=request.id
            )
        
        return JSONRPCResponse(
            jsonrpc="2.0",
            result=result,
            id=request.id
        )
        
    except Exception as e:
        print(f"JSON-RPC 처리 오류: {e}")
        return JSONRPCResponse(
            jsonrpc="2.0",
            error={
                "code": -32603,
                "message": str(e),
                "data": traceback.format_exc()
            },
            id=request.id
        )

@app.post("/")
async def jsonrpc_endpoint(request: Request):
    """JSON-RPC 2.0 엔드포인트"""
    try:
        # Raw body 읽기
        body = await request.body()
        data = json.loads(body)
        
        # 배치 요청 처리
        if isinstance(data, list):
            responses = []
            for item in data:
                req = JSONRPCRequest(**item)
                resp = await process_jsonrpc(req)
                responses.append(resp.dict(exclude_none=True))
            return responses
        else:
            # 단일 요청 처리
            req = JSONRPCRequest(**data)
            resp = await process_jsonrpc(req)
            return resp.dict(exclude_none=True)
            
    except json.JSONDecodeError:
        return {
            "jsonrpc": "2.0",
            "error": {
                "code": -32700,
                "message": "Parse error"
            },
            "id": None
        }
    except Exception as e:
        return {
            "jsonrpc": "2.0",
            "error": {
                "code": -32603,
                "message": f"Internal error: {str(e)}"
            },
            "id": None
        }

# 기존 REST API 엔드포인트 (하위 호환성)
@app.get("/mcp/tools")
async def list_tools_legacy():
    """레거시 REST API - 도구 목록"""
    # OpenAI Function Calling 형식으로 변환
    openai_tools = []
    for tool in TOOLS:
        openai_tool = {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["inputSchema"]
            }
        }
        openai_tools.append(openai_tool)
    return openai_tools

@app.post("/mcp/call")
async def call_tool_legacy(request: Dict[str, Any]):
    """레거시 REST API - 도구 호출"""
    # JSON-RPC로 변환하여 호출
    jsonrpc_req = JSONRPCRequest(
        method="tools/call",
        params={
            "name": request.get("tool"),
            "arguments": request.get("arguments", {})
        },
        id=str(uuid.uuid4())
    )
    
    response = await process_jsonrpc(jsonrpc_req)
    
    if response.error:
        return {"error": response.error["message"]}
    else:
        # content 배열에서 텍스트 추출
        if isinstance(response.result, dict) and "content" in response.result:
            content = response.result["content"]
            if content and len(content) > 0:
                text = content[0].get("text", "")
                try:
                    return json.loads(text)
                except:
                    return {"data": text}
        return response.result

@app.get("/health")
async def health_check():
    """헬스체크"""
    return {"status": "healthy", "service": "MCP Server (JSON-RPC 2.0)"}

if __name__ == "__main__":
    import uvicorn
    print("MCP Server (JSON-RPC 2.0) 시작...")
    print("JSON-RPC endpoint: http://localhost:9001/")
    print("Legacy REST endpoints: http://localhost:9001/mcp/tools, /mcp/call")
    uvicorn.run(app, host="0.0.0.0", port=9001)
