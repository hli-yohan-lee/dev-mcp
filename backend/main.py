from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import os
from pathlib import Path
import PyPDF2
import sqlite3
import requests
from urllib.parse import urlparse
import base64

app = FastAPI(title="MCP Backend API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PDF 저장 경로 설정 (절대 경로로 수정)
PDF_STORAGE_PATH = Path("pdfs").absolute()
PDF_STORAGE_PATH.mkdir(exist_ok=True)

# 데이터베이스 경로
DB_PATH = Path("database.db").absolute()

# 데이터베이스 초기화 함수
def init_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 사용자 테이블 생성
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            experience INTEGER
        )
    ''')
    
    # 가이드 테이블 생성
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS guides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT,
            author TEXT,
            created_at TEXT
        )
    ''')
    
    # 초기 데이터 삽입 (이미 존재하지 않는 경우만)
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        users_data = [
            ("김개발", "kim@company.com", "backend", 5),
            ("이프론트", "lee@company.com", "frontend", 3),
            ("박풀스택", "park@company.com", "fullstack", 7),
            ("최디비", "choi@company.com", "database", 4)
        ]
        cursor.executemany('INSERT INTO users (name, email, role, experience) VALUES (?, ?, ?, ?)', users_data)
    
    cursor.execute('SELECT COUNT(*) FROM guides')
    if cursor.fetchone()[0] == 0:
        guides_data = [
            ("백엔드 개발 가이드", "backend", "FastAPI를 사용한 백엔드 개발 방법론", "김개발", "2024-01-15"),
            ("프론트엔드 베스트 프랙티스", "frontend", "React와 TypeScript를 활용한 모던 프론트엔드 개발", "이프론트", "2024-02-10"),
            ("데이터베이스 설계 원칙", "database", "효율적인 데이터베이스 스키마 설계 및 최적화 방법", "최디비", "2024-03-05"),
            ("API 문서화 가이드", "api", "OpenAPI를 활용한 체계적인 API 문서화", "박풀스택", "2024-03-20")
        ]
        cursor.executemany('INSERT INTO guides (title, category, content, author, created_at) VALUES (?, ?, ?, ?, ?)', guides_data)
    
    conn.commit()
    conn.close()

# 요청 모델들
class GithubRequest(BaseModel):
    repository: Optional[str] = None  # owner/repo 형태
    username: Optional[str] = None
    password: Optional[str] = None  # 또는 personal access token
    file_path: Optional[str] = None

class PDFRequest(BaseModel):
    filename: str

class DatabaseRequest(BaseModel):
    table: str
    filters: Optional[Dict[str, Any]] = None


# PDF 읽기 함수
def read_pdf_content(filename: str) -> str:
    pdf_path = PDF_STORAGE_PATH / filename
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"PDF 파일을 찾을 수 없습니다: {filename}")
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            content = ""
            for page in pdf_reader.pages:
                content += page.extract_text() + "\n"
        return content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 읽기 오류: {str(e)}")

# API 엔드포인트들
@app.get("/")
async def root():
    return {"message": "MCP Backend API Server", "version": "1.0.0"}

@app.post("/api/github")
async def get_github_content(request: GithubRequest):
    """GitHub 저장소에서 소스코드 가져오기"""
    try:
        # 필수 필드 체크
        if not request.repository:
            raise HTTPException(status_code=400, detail="Repository is required")
        if not request.username:
            raise HTTPException(status_code=400, detail="Username is required")
        if not request.password:
            raise HTTPException(status_code=400, detail="Password/Token is required")
            
        # GitHub API 인증 헤더
        auth_str = base64.b64encode(f"{request.username}:{request.password}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_str}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        if request.file_path:
            # 특정 파일 내용 가져오기
            api_url = f"https://api.github.com/repos/{request.repository}/contents/{request.file_path}"
            
            response = requests.get(api_url, headers=headers)
            
            if response.status_code == 404:
                return {"ok": False, "error": f"파일을 찾을 수 없습니다: {request.file_path}"}
            elif response.status_code == 401:
                return {"ok": False, "error": "GitHub 인증 실패"}
            elif response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="GitHub API 오류")
            
            file_data = response.json()
            
            # Base64 디코딩하여 파일 내용 추출
            if file_data.get("encoding") == "base64":
                content = base64.b64decode(file_data["content"]).decode('utf-8')
            else:
                content = file_data.get("content", "")
            
            return {
                "ok": True,
                "data": {
                    "repository": request.repository,
                    "file": request.file_path,
                    "content": content,
                    "size": file_data.get("size", 0)
                }
            }
        else:
            # 저장소 파일 목록 가져오기
            api_url = f"https://api.github.com/repos/{request.repository}/contents"
            
            response = requests.get(api_url, headers=headers)
            
            if response.status_code == 401:
                return {"ok": False, "error": "GitHub 인증 실패"}
            elif response.status_code == 404:
                return {"ok": False, "error": "저장소를 찾을 수 없습니다"}
            elif response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="GitHub API 오류")
            
            files_data = response.json()
            files = []
            
            for item in files_data:
                files.append({
                    "name": item["name"],
                    "path": item["path"],
                    "type": item["type"],  # file or dir
                    "size": item.get("size", 0)
                })
            
            return {
                "ok": True,
                "data": {
                    "repository": request.repository,
                    "files": files
                }
            }
            
    except Exception as e:
        return {"ok": False, "error": f"GitHub 연결 오류: {str(e)}"}

@app.post("/api/pdf")
async def get_pdf_content(request: PDFRequest):
    """저장된 PDF 내용 가져오기"""
    try:
        content = read_pdf_content(request.filename)
        return {
            "ok": True,
            "data": {
                "filename": request.filename,
                "content": content,
                "length": len(content)
            }
        }
    except Exception as e:
        return {"ok": False, "error": f"PDF 처리 오류: {str(e)}"}

@app.post("/api/database")
async def get_database_content(request: DatabaseRequest):
    """SQLite 데이터베이스에서 데이터 가져오기"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # dict-like access
        cursor = conn.cursor()
        
        # 테이블 존재 확인
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (request.table,))
        if not cursor.fetchone():
            conn.close()
            return {"ok": False, "error": f"테이블을 찾을 수 없습니다: {request.table}"}
        
        # 기본 쿼리
        query = f"SELECT * FROM {request.table}"
        params = []
        
        # 필터 조건 추가
        if request.filters:
            where_clauses = []
            for key, value in request.filters.items():
                where_clauses.append(f"{key} = ?")
                params.append(value)
            if where_clauses:
                query += " WHERE " + " AND ".join(where_clauses)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # dict 형태로 변환
        data = [dict(row) for row in rows]
        
        conn.close()
        
        return {
            "ok": True,
            "data": {
                "table": request.table,
                "records": data,
                "count": len(data)
            }
        }
    except Exception as e:
        return {"ok": False, "error": f"데이터베이스 오류: {str(e)}"}


# 헬스체크
@app.get("/health")
async def health_check():
    return {"status": "healthy", "pdf_path": str(PDF_STORAGE_PATH.absolute())}

@app.post("/health")
async def health_check_post():
    return {"ok": True, "data": {"status": "healthy", "pdf_path": str(PDF_STORAGE_PATH.absolute())}}

# API 헬스체크 (프론트엔드 호출용)
@app.post("/api/health")
async def api_health_check():
    return {"ok": True, "data": {"status": "healthy", "pdf_path": str(PDF_STORAGE_PATH.absolute())}}

if __name__ == "__main__":
    import uvicorn
    print(f"PDF 저장 경로: {PDF_STORAGE_PATH.absolute()}")
    print(f"데이터베이스 경로: {DB_PATH.absolute()}")
    
    # 데이터베이스 초기화
    init_database()
    print("데이터베이스 초기화 완료")
    
    uvicorn.run(app, host="0.0.0.0", port=9000)