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
import asyncio
import subprocess
from mcp import ClientSession, StdioServerParameters
import urllib3

# SSL 경고 억제 (로컬 환경에서 인증서 문제 해결)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI(title="Interface Backend API", version="1.0.0")

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


# 파일 내용 처리 함수 (PDF, 텍스트 등)
async def process_file_content(file_bytes: bytes, file_path: str) -> str:
    """파일 내용을 처리하여 텍스트로 변환"""
    try:
        # PDF 파일인 경우 텍스트 추출
        if file_path.lower().endswith('.pdf'):
            import io
            import PyPDF2
            pdf_file = io.BytesIO(file_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            print(f"📄 PDF 페이지 수: {len(pdf_reader.pages)}")
            
            content = ""
            for i, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                print(f"📖 페이지 {i+1} 텍스트 길이: {len(page_text)}")
                content += page_text + "\n"
            
            print(f"📝 총 추출된 텍스트 길이: {len(content)}")
            
            if not content.strip():
                content = "[PDF 파일에서 텍스트를 추출할 수 없습니다. 이미지나 스캔된 PDF일 수 있습니다.]"
                print("⚠️ 텍스트 추출 실패 - 빈 내용")
            else:
                print("✅ 텍스트 추출 성공")
                
        else:
            # 텍스트 파일인 경우 디코딩 시도
            try:
                content = file_bytes.decode('utf-8')
            except UnicodeDecodeError:
                # UTF-8 디코딩 실패 시 다른 인코딩 시도
                try:
                    content = file_bytes.decode('cp949')  # 한글 Windows 인코딩
                except:
                    content = file_bytes.decode('latin-1', errors='ignore')  # 마지막 수단
        
        return content
        
    except Exception as e:
        error_msg = f"[파일 처리 오류: {str(e)}]"
        print(f"💥 파일 처리 오류: {str(e)}")
        return error_msg

# MCP 클라이언트 함수들
async def get_mcp_tools() -> list:
    """MCP 서버에서 사용 가능한 도구 목록을 가져옵니다"""
    try:
        print("MCP 서버 프로세스 시작...")
        
        # MCP 서버 프로세스 시작 (절대 경로 사용)
        mcp_server_path = Path(__file__).parent.parent / "mcp-server" / "app.py"
        print(f"MCP 서버 경로: {mcp_server_path}")
        
        process = await asyncio.create_subprocess_exec(
            "python", str(mcp_server_path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # 프로세스가 시작될 때까지 잠시 대기
        await asyncio.sleep(2)
        
        # 프로세스 상태 확인
        if process.returncode is not None:
            print(f"MCP 서버 프로세스 시작 실패: returncode={process.returncode}")
            return []
        
        print("MCP 서버 프로세스 시작됨, stderr 확인 중...")
        
        # stderr에서 시작 메시지 확인
        stderr_data = b""
        try:
            while True:
                chunk = await asyncio.wait_for(process.stderr.read(1024), timeout=0.1)
                if not chunk:
                    break
                stderr_data += chunk
        except asyncio.TimeoutError:
            pass
        
        if stderr_data:
            print(f"MCP 서버 stderr: {stderr_data.decode()}")
        
        print("MCP ClientSession 생성 시도...")
        
        try:
            # ClientSession 생성 시 write_stream과 read_stream 전달
            async with ClientSession(
                write_stream=process.stdin,
                read_stream=process.stdout
            ) as session:
                print("MCP ClientSession 생성 성공, 도구 목록 조회 중...")
                # 도구 목록 조회
                tools = await session.list_tools()
                print(f"도구 목록 조회 완료: {len(tools)}개")
                return tools
        finally:
            # 프로세스 정리
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5.0)
            except:
                process.kill()
    except Exception as e:
        print(f"MCP 도구 목록 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return []

async def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    """MCP 서버의 도구를 실행합니다"""
    try:
        print(f"MCP 도구 실행 시작: {tool_name}")
        
        # MCP 서버 프로세스 시작 (절대 경로 사용)
        mcp_server_path = Path(__file__).parent.parent / "mcp-server" / "app.py"
        print(f"MCP 서버 경로: {mcp_server_path}")
        
        process = await asyncio.create_subprocess_exec(
            "python", str(mcp_server_path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # 프로세스가 시작될 때까지 잠시 대기
        await asyncio.sleep(2)
        
        # 프로세스 상태 확인
        if process.returncode is not None:
            print(f"MCP 서버 프로세스 시작 실패: returncode={process.returncode}")
            return {"error": "MCP 서버 프로세스 시작 실패"}
        
        print("MCP 서버 프로세스 시작됨, stderr 확인 중...")
        
        # stderr에서 시작 메시지 확인
        stderr_data = b""
        try:
            while True:
                chunk = await asyncio.wait_for(process.stderr.read(1024), timeout=0.1)
                if not chunk:
                    break
                stderr_data += chunk
        except asyncio.TimeoutError:
            pass
        
        if stderr_data:
            print(f"MCP 서버 stderr: {stderr_data.decode()}")
        
        print("MCP ClientSession 생성 시도...")
        
        try:
            # ClientSession 생성 시 write_stream과 read_stream 전달
            async with ClientSession(
                write_stream=process.stdin,
                read_stream=process.stdout
            ) as session:
                print(f"MCP ClientSession 생성 성공, 도구 {tool_name} 실행 중...")
                # 도구 실행
                result = await session.call_tool(tool_name, arguments)
                print(f"도구 {tool_name} 실행 완료")
                return result
        finally:
            # 프로세스 정리
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5.0)
            except:
                process.kill()
    except Exception as e:
        print(f"MCP 도구 실행 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

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
            
            # SSL 검증 우회 (로컬 환경에서 인증서 문제 해결)
            response = requests.get(api_url, headers=headers, verify=False)
            
            if response.status_code == 404:
                return {"ok": False, "error": f"파일을 찾을 수 없습니다: {request.file_path}"}
            elif response.status_code == 401:
                return {"ok": False, "error": "GitHub 인증 실패"}
            elif response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="GitHub API 오류")
            
            file_data = response.json()
            
            # GitHub API 응답 디버깅
            print(f"🔍 GitHub API 응답 구조:")
            print(f"   - encoding: {file_data.get('encoding')}")
            print(f"   - content 길이: {len(file_data.get('content', ''))}")
            print(f"   - size: {file_data.get('size')}")
            print(f"   - type: {file_data.get('type')}")
            print(f"   - path: {file_data.get('path')}")
            
            # 파일 내용 추출
            if file_data.get("encoding") == "base64":
                # Base64로 인코딩된 파일 내용
                file_bytes = base64.b64decode(file_data["content"])
                print(f"🔍 Base64 인코딩 파일 처리: {request.file_path}")
                print(f"📏 파일 크기: {len(file_bytes)} bytes")
                
                content = await process_file_content(file_bytes, request.file_path)
                
            elif file_data.get("encoding") == "none":
                # 파일이 너무 커서 content가 없는 경우 (1MB 이상)
                print(f"🔍 큰 파일 처리 (encoding: none): {request.file_path}")
                print(f"📏 파일 크기: {file_data.get('size')} bytes")
                
                # 별도 API 호출로 파일 내용 가져오기
                download_url = file_data.get("download_url")
                if download_url:
                    print(f"📥 다운로드 URL로 파일 내용 가져오기: {download_url}")
                    try:
                        # SSL 검증 우회 (로컬 환경에서 인증서 문제 해결)
                        download_response = requests.get(download_url, headers=headers, verify=False)
                        if download_response.status_code == 200:
                            file_bytes = download_response.content
                            print(f"📥 다운로드 완료: {len(file_bytes)} bytes")
                            content = await process_file_content(file_bytes, request.file_path)
                        else:
                            content = f"[파일 다운로드 실패: HTTP {download_response.status_code}]"
                            print(f"💥 파일 다운로드 실패: {download_response.status_code}")
                    except Exception as download_error:
                        content = f"[파일 다운로드 오류: {str(download_error)}]"
                        print(f"💥 파일 다운로드 오류: {str(download_error)}")
                else:
                    content = "[파일이 너무 커서 내용을 가져올 수 없습니다. GitHub 웹에서 직접 확인해주세요.]"
                    print("⚠️ 다운로드 URL이 없음")
            else:
                content = file_data.get("content", "")
                print(f"⚠️ 알 수 없는 인코딩: {file_data.get('encoding')}")
            
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
            
            # SSL 검증 우회 (로컬 환경에서 인증서 문제 해결)
            response = requests.get(api_url, headers=headers, verify=False)
            
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
                if key == "role":
                    # 역할별 필터링: 해당 역할 + 풀스택 포함
                    if value == "backend":
                        where_clauses.append("(role = ? OR role = 'fullstack')")
                        params.append(value)
                    elif value == "frontend":
                        where_clauses.append("(role = ? OR role = 'fullstack')")
                        params.append(value)
                    elif value == "database":
                        where_clauses.append("(role = ? OR role = 'fullstack')")
                        params.append(value)
                    elif value == "fullstack":
                        where_clauses.append("role = ?")
                        params.append(value)
                    else:
                        where_clauses.append(f"{key} = ?")
                        params.append(value)
                else:
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

# MCP API 엔드포인트들
@app.get("/api/mcp/tools")
async def get_mcp_tools_endpoint():
    """MCP 서버에서 사용 가능한 도구 목록을 가져옵니다"""
    try:
        tools = await get_mcp_tools()
        if not tools:
            return {"ok": False, "error": "MCP 서버에서 도구 목록을 가져올 수 없습니다"}
        return {
            "ok": True,
            "data": {
                "tools": tools
            }
        }
    except Exception as e:
        print(f"MCP 도구 목록 조회 API 에러: {e}")
        return {"ok": False, "error": f"MCP 서버 연결 실패: {str(e)}"}

@app.post("/api/mcp/call")
async def call_mcp_tool_endpoint(request: dict):
    """MCP 서버의 도구를 실행합니다"""
    try:
        tool_name = request.get("tool")
        arguments = request.get("arguments", {})
        
        if not tool_name:
            return {"ok": False, "error": "tool 이름이 필요합니다"}
        
        print(f"MCP 도구 호출: {tool_name} - {arguments}")
        result = await call_mcp_tool(tool_name, arguments)
        
        if "error" in result:
            return {"ok": False, "error": result["error"]}
        
        return {
            "ok": True,
            "data": result
        }
    except Exception as e:
        print(f"MCP 도구 호출 API 에러: {e}")
        return {"ok": False, "error": f"MCP 도구 실행 실패: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    print(f"PDF 저장 경로: {PDF_STORAGE_PATH.absolute()}")
    print(f"데이터베이스 경로: {DB_PATH.absolute()}")
    
    # 데이터베이스 초기화
    init_database()
    print("데이터베이스 초기화 완료")
    
    uvicorn.run(app, host="0.0.0.0", port=9002)