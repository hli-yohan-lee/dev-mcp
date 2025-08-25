import os, time, hmac, hashlib, json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import PyPDF2
import sqlite3
import requests
import base64

load_dotenv()

APP = FastAPI()

# CORS 미들웨어 추가
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


HMAC_KEY = os.environ.get("HMAC_KEY", "supersecret").encode()
MCP_ID = os.environ.get("MCP_ID","mcp")

# 백엔드 직접 처리용 경로 설정
PDF_PATH = Path("../backend/pdfs").resolve()
DB_PATH = Path("../backend/database.db").resolve()

def read_pdf_direct(filename: str) -> str:
    """PDF 파일 직접 읽기"""
    pdf_file = PDF_PATH / filename
    if not pdf_file.exists():
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {filename}")
    
    try:
        with open(pdf_file, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            content = ""
            for page in pdf_reader.pages:
                content += page.extract_text() + "\n"
        return content.strip()
    except Exception as e:
        raise Exception(f"PDF 읽기 오류: {str(e)}")

def query_database_direct(table: str, filters: dict = None) -> list:
    """데이터베이스 직접 쿼리"""
    if not DB_PATH.exists():
        raise FileNotFoundError(f"데이터베이스를 찾을 수 없습니다: {DB_PATH}")
    
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
        return data
    except Exception as e:
        raise Exception(f"데이터베이스 오류: {str(e)}")

def github_api_direct(repository: str, username: str, password: str, file_path: str = None) -> dict:
    """GitHub API 직접 호출"""
    try:
        auth_str = base64.b64encode(f"{username}:{password}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_str}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        if file_path:
            api_url = f"https://api.github.com/repos/{repository}/contents/{file_path}"
            response = requests.get(api_url, headers=headers)
            
            if response.status_code == 404:
                return {"ok": False, "error": f"파일을 찾을 수 없습니다: {file_path}"}
            elif response.status_code == 401:
                return {"ok": False, "error": "GitHub 인증 실패"}
            elif response.status_code != 200:
                return {"ok": False, "error": "GitHub API 오류"}
            
            file_data = response.json()
            if file_data.get("encoding") == "base64":
                content = base64.b64decode(file_data["content"]).decode('utf-8')
            else:
                content = file_data.get("content", "")
            
            return {
                "ok": True,
                "data": {
                    "repository": repository,
                    "file": file_path,
                    "content": content,
                    "size": file_data.get("size", 0)
                }
            }
        else:
            api_url = f"https://api.github.com/repos/{repository}/contents"
            response = requests.get(api_url, headers=headers)
            
            if response.status_code == 401:
                return {"ok": False, "error": "GitHub 인증 실패"}
            elif response.status_code == 404:
                return {"ok": False, "error": "저장소를 찾을 수 없습니다"}
            elif response.status_code != 200:
                return {"ok": False, "error": "GitHub API 오류"}
            
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
                "ok": True,
                "data": {
                    "repository": repository,
                    "files": files
                }
            }
    except Exception as e:
        return {"ok": False, "error": f"GitHub 연결 오류: {str(e)}"}



@APP.post("/mcp/invoke")
async def invoke(req: Request):
    payload = await req.json()
    action = payload.get("action"); args = payload.get("args", {})
    
    # 백엔드 서버 호출 (프록시 역할)
    backend_url = "http://localhost:9000"
    
    try:
        if action == "pdf":
            filename = args.get("filename", "백엔드_가이드.pdf")
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{backend_url}/api/pdf", json={"filename": filename})
                return response.json()
                
        elif action == "github":
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{backend_url}/api/github", json=args)
                return response.json()
                
        elif action == "database":
            table = args.get("table", "users")
            filters = args.get("filters")
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{backend_url}/api/database", json={"table": table, "filters": filters})
                return response.json()
        
        # 기타 액션들은 지원하지 않음
        else:
            return {"ok": False, "error": f"지원하지 않는 액션: {action}"}
                    
    except Exception as e:
        return {"ok": False, "error": str(e)}





@APP.get("/health")
async def health():
    return {"status": "healthy", "mcp_id": MCP_ID} 