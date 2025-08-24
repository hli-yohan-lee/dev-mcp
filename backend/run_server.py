#!/usr/bin/env python3
"""
MCP Backend API Server 실행 스크립트
"""
import uvicorn
from pathlib import Path

if __name__ == "__main__":
    # PDF 저장 경로 출력
    pdf_path = Path("backend/pdfs").absolute()
    print("=" * 60)
    print("🚀 MCP Backend API Server 시작")
    print("=" * 60)
    print(f"📁 PDF 저장 경로: {pdf_path}")
    print("📋 필요한 PDF 파일들:")
    print("   - 백엔드_가이드.pdf")
    print("   - 프론트_가이드.pdf")
    print("   - 디비_가이드.pdf")
    print("=" * 60)
    print("🌐 서버 주소: http://localhost:9000")
    print("📖 API 문서: http://localhost:9000/docs")
    print("=" * 60)
    
    # 서버 실행
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        log_level="info"
    )