from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import asyncio
import httpx
from pathlib import Path

# FastAPI 앱 생성
app = FastAPI(title="MCP Integration Server", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 요청 모델
class MCPToolRequest(BaseModel):
    tool: str
    arguments: Dict[str, Any] = {}

# MCP 표준 스펙에 맞는 도구 정의
TOOLS = [
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
                        "description": "읽을 PDF 파일명",
                        "enum": ["백엔드_가이드.pdf", "프론트_가이드.pdf", "디비_가이드.pdf"]
                    }
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_database",
            "description": "데이터베이스에서 테이블 데이터를 조회합니다",
            "parameters": {
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
        }
    },
    {
        "type": "function",
        "function": {
            "name": "github_repository_info",
            "description": "GitHub 저장소 정보를 조회합니다",
            "parameters": {
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
        }
    },
    {
        "type": "function",
        "function": {
            "name": "system_health",
            "description": "시스템 상태를 확인합니다",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False
            }
        }
    }
]

@app.get("/mcp/tools")
async def list_tools() -> List[Dict[str, Any]]:
    """MCP 표준 스펙에 맞는 도구 목록을 반환합니다"""
    return TOOLS

@app.post("/mcp/call")
async def call_tool(request: MCPToolRequest) -> Dict[str, Any]:
    """MCP 도구를 실행합니다 - 내부 API 서버로 위임"""
    try:
        name = request.tool
        arguments = request.arguments
        print(f"MCP 도구 호출: {name} - {arguments}")
        
        # 내부 API 서버로 위임
        async with httpx.AsyncClient(timeout=30.0) as client:
            if name == "read_pdf":
                response = await client.post("http://localhost:9002/api/pdf", json=arguments)
            elif name == "query_database":
                response = await client.post("http://localhost:9002/api/database", json=arguments)
            elif name == "github_repository_info":
                # GitHub 플레이스홀더를 실제 값으로 대체
                processed_args = arguments.copy() if arguments else {}
                
                # username이 플레이스홀더인 경우 실제 값으로 대체
                if processed_args.get("username") == "<GITHUB_USERNAME>":
                    processed_args["username"] = "hli.yohan.lee"
                
                # password가 플레이스홀더인 경우 실제 값으로 대체
                if processed_args.get("password") == "<GITHUB_PAT>":
                    # 환경변수에서 GitHub 토큰 가져오기
                    import os
                    github_token = os.getenv("GITHUB_TOKEN", "YOUR_GITHUB_TOKEN_HERE")
                    processed_args["password"] = github_token
                
                response = await client.post("http://localhost:9002/api/github", json=processed_args)
            elif name == "system_health":
                response = await client.post("http://localhost:9002/api/health", json=arguments)
            else:
                return {"error": f"알 수 없는 도구: {name}"}
            
            if response.status_code == 200:
                try:
                    # 응답 헤더 확인
                    content_type = response.headers.get('content-type', '')
                    print(f"응답 Content-Type: {content_type}")
                    
                    # JSON 응답인 경우
                    if 'application/json' in content_type:
                        response.encoding = 'utf-8'
                        json_data = response.json()
                        print(f"JSON 응답 성공: {type(json_data)}")
                        return json_data
                    else:
                        # JSON이 아닌 경우 텍스트로 처리
                        response.encoding = 'utf-8'
                        text_data = response.text
                        print(f"텍스트 응답 성공: 길이 {len(text_data)}")
                        return {"data": text_data, "content_type": content_type, "encoding": "text"}
                        
                except Exception as json_error:
                    print(f"응답 처리 오류: {json_error}")
                    print(f"응답 헤더: {dict(response.headers)}")
                    
                    # 텍스트로 반환 시도
                    try:
                        response.encoding = 'utf-8'
                        text_data = response.text
                        return {"data": text_data, "encoding": "text", "parse_error": str(json_error)}
                    except Exception as text_error:
                        print(f"텍스트 처리도 실패: {text_error}")
                        # 바이너리 데이터로 처리
                        try:
                            binary_data = response.content
                            return {"data": str(binary_data[:1000]), "encoding": "binary", "size": len(binary_data)}
                        except Exception as binary_error:
                            return {"error": f"모든 응답 처리 실패: {str(binary_error)}"}
            else:
                try:
                    error_detail = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                    return {"error": f"내부 API 오류: HTTP {response.status_code}", "detail": error_detail}
                except:
                    return {"error": f"내부 API 오류: HTTP {response.status_code}"}
    except Exception as e:
        print(f"MCP 도구 실행 오류: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"도구 실행 오류: {str(e)}", "traceback": traceback.format_exc()}

# 헬스체크
@app.get("/health")
async def health_check():
    """헬스체크"""
    return {"status": "healthy", "service": "MCP Integration Server"}

if __name__ == "__main__":
    import uvicorn
    print("MCP Integration Server 시작...")
    uvicorn.run(app, host="0.0.0.0", port=9001) 