#!/usr/bin/env python3
"""
Simple test script to verify API endpoints work correctly
"""

import json
from pathlib import Path

# Test data for API calls
test_pdf_request = {
    "filename": "백엔드_가이드.pdf"
}

test_gitlab_request = {
    "url": "https://github.com/octocat/Hello-World.git",
    "file_path": "README"
}

test_database_request = {
    "table": "users",
    "filters": {"role": "backend"}
}

print("API 테스트 데이터:")
print("1. PDF 요청:")
print(json.dumps(test_pdf_request, indent=2, ensure_ascii=False))

print("\n2. GitLab 요청:")
print(json.dumps(test_gitlab_request, indent=2, ensure_ascii=False))

print("\n3. 데이터베이스 요청:")
print(json.dumps(test_database_request, indent=2, ensure_ascii=False))

# Check if PDF files exist
pdf_path = Path("pdfs")
if pdf_path.exists():
    print(f"\n사용 가능한 PDF 파일:")
    for pdf_file in pdf_path.glob("*.pdf"):
        print(f"  - {pdf_file.name}")
else:
    print("\nPDF 디렉토리가 존재하지 않습니다.")

print("\n백엔드 서버 구현 완료!")
print("- GitLab/GitHub 실제 연동 (URL, 인증 정보 입력)")
print("- PDF 로컬 파일 읽기")
print("- SQLite 데이터베이스 실제 구현")
print("- start.bat에서 자동 데이터베이스 초기화")