import asyncio
import os
from typing import Any, Dict, List
from dotenv import load_dotenv
import httpx

from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

load_dotenv()

# MCP 서버 인스턴스 생성
server = Server("mcp-integration-server")

# 백엔드 API URL
BACKEND_URL = "http://localhost:9000"

# 도구 목록 정의
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
                    "description": "읽을 파일 경로 (선택사항)"
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

@server.list_tools()
async def list_tools() -> List[Dict[str, Any]]:
    """사용 가능한 도구 목록을 반환합니다"""
    return TOOLS

@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """도구를 실행합니다 - 백엔드 API 호출"""
    try:
        if name == "read_pdf":
            return await call_backend_api("pdf", {"filename": arguments.get("filename")})
        elif name == "query_database":
            return await call_backend_api("database", arguments)
        elif name == "github_repository_info":
            return await call_backend_api("github", arguments)
        elif name == "system_health":
            return await call_backend_api("health", {})
        else:
            return {"error": f"알 수 없는 도구: {name}"}
    except Exception as e:
        return {"error": f"도구 실행 오류: {str(e)}"}

async def call_backend_api(endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """백엔드 API 호출"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{BACKEND_URL}/api/{endpoint}", json=data, timeout=30.0)
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"백엔드 API 오류: HTTP {response.status_code}"}
                
    except httpx.TimeoutException:
        return {"error": "백엔드 API 호출 시간 초과"}
    except httpx.ConnectError:
        return {"error": "백엔드 서버에 연결할 수 없습니다"}
    except Exception as e:
        return {"error": f"백엔드 API 호출 실패: {str(e)}"}

async def main():
    """MCP 서버 실행"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="mcp-integration-server",
                server_version="1.0.0",
                capabilities={
                    "tools": {}
                }
            )
        )

if __name__ == "__main__":
    asyncio.run(main()) 