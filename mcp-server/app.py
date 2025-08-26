import asyncio
import os
from typing import Any, Dict, List
from pathlib import Path
import sqlite3
import requests
import base64
from dotenv import load_dotenv

from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

load_dotenv()

# MCP 서버 인스턴스 생성
server = Server("mcp-integration-server")

# 백엔드 경로 설정
PDF_PATH = Path("../backend/pdfs").resolve()
DB_PATH = Path("../backend/database.db").resolve()

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
                "token": {
                    "type": "string",
                    "description": "GitHub Personal Access Token"
                },
                "file_path": {
                    "type": "string",
                    "description": "읽을 파일 경로 (선택사항)"
                }
            },
            "required": ["repository", "username", "token"]
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
    """도구를 실행합니다"""
    try:
        if name == "read_pdf":
            return await read_pdf_tool(arguments)
        elif name == "query_database":
            return await query_database_tool(arguments)
        elif name == "github_repository_info":
            return await github_tool(arguments)
        elif name == "system_health":
            return await system_health_tool(arguments)
        else:
            return {"error": f"알 수 없는 도구: {name}"}
    except Exception as e:
        return {"error": f"도구 실행 오류: {str(e)}"}

async def read_pdf_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """PDF 파일 읽기 도구"""
    filename = args.get("filename", "백엔드_가이드.pdf")
    pdf_file = PDF_PATH / filename
    
    if not pdf_file.exists():
        return {"error": f"PDF 파일을 찾을 수 없습니다: {filename}"}
    
    try:
        import PyPDF2
        with open(pdf_file, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            content = ""
            for page in pdf_reader.pages:
                content += page.extract_text() + "\n"
        
        return {
            "content": content.strip(),
            "filename": filename,
            "pages": len(pdf_reader.pages),
            "length": len(content.strip())
        }
    except Exception as e:
        return {"error": f"PDF 읽기 오류: {str(e)}"}

async def query_database_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """데이터베이스 쿼리 도구"""
    table = args.get("table", "users")
    filters = args.get("filters", {})
    
    if not DB_PATH.exists():
        return {"error": f"데이터베이스를 찾을 수 없습니다: {DB_PATH}"}
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = f"SELECT * FROM {table}"
        params = []
        
        if filters:
            where_clauses = []
            for key, value in filters.items():
                where_clauses.append(f"{key} = ?")
                params.append(value)
            if where_clauses:
                query += " WHERE " + " AND ".join(where_clauses)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        data = [dict(row) for row in rows]
        
        conn.close()
        
        return {
            "table": table,
            "count": len(data),
            "data": data,
            "filters": filters
        }
    except Exception as e:
        return {"error": f"데이터베이스 오류: {str(e)}"}

async def github_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """GitHub API 도구"""
    repository = args.get("repository")
    username = args.get("username")
    token = args.get("token")
    file_path = args.get("file_path")
    
    try:
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        if file_path:
            # 특정 파일 내용 읽기
            api_url = f"https://api.github.com/repos/{repository}/contents/{file_path}"
            response = requests.get(api_url, headers=headers)
            
            if response.status_code == 404:
                return {"error": f"파일을 찾을 수 없습니다: {file_path}"}
            elif response.status_code == 401:
                return {"error": "GitHub 인증 실패"}
            elif response.status_code != 200:
                return {"error": f"GitHub API 오류: {response.status_code}"}
            
            file_data = response.json()
            if file_data.get("encoding") == "base64":
                content = base64.b64decode(file_data["content"]).decode('utf-8')
            else:
                content = file_data.get("content", "")
            
            return {
                "repository": repository,
                "file": file_path,
                "content": content,
                "size": file_data.get("size", 0)
            }
        else:
            # 저장소 파일 목록 조회
            api_url = f"https://api.github.com/repos/{repository}/contents"
            response = requests.get(api_url, headers=headers)
            
            if response.status_code == 401:
                return {"error": "GitHub 인증 실패"}
            elif response.status_code == 404:
                return {"error": "저장소를 찾을 수 없습니다"}
            elif response.status_code != 200:
                return {"error": f"GitHub API 오류: {response.status_code}"}
            
            files_data = response.json()
            files = []
            for item in files_data:
                files.append({
                    "name": item["name"],
                    "path": item["path"],
                    "type": item["type"],
                    "size": item.get("size", 0)
                })
            
            return {
                "repository": repository,
                "files": files,
                "file_count": len(files)
            }
    except Exception as e:
        return {"error": f"GitHub 연결 오류: {str(e)}"}

async def system_health_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """시스템 상태 확인 도구"""
    try:
        # 백엔드 서버 상태 확인
        backend_status = "unknown"
        try:
            response = requests.get("http://localhost:9000/health", timeout=5)
            if response.status_code == 200:
                backend_status = "healthy"
            else:
                backend_status = f"error_{response.status_code}"
        except:
            backend_status = "unreachable"
        
        # PDF 디렉토리 상태 확인
        pdf_status = "available" if PDF_PATH.exists() else "not_found"
        
        # 데이터베이스 상태 확인
        db_status = "available" if DB_PATH.exists() else "not_found"
        
        return {
            "status": "healthy",
            "mcp_id": os.environ.get("MCP_ID", "mcp"),
            "backend": backend_status,
            "pdf_directory": pdf_status,
            "database": db_status,
            "timestamp": asyncio.get_event_loop().time()
        }
    except Exception as e:
        return {"error": f"상태 확인 오류: {str(e)}"}

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