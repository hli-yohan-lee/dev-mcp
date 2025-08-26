# MCP Backend API Server

FastAPI 기반의 백엔드 API 서버입니다.

## 기능

1. **GitLab 연결**: 가상의 GitLab 저장소에서 소스코드 가져오기
2. **PDF 읽기**: 로컬에 저장된 PDF 파일 내용 추출
3. **데이터베이스 조회**: 메모리 기반 가상 데이터베이스에서 데이터 조회

## 설치 및 실행

### 1. 의존성 설치
```bash
cd backend
pip install -r requirements.txt
```

### 2. PDF 파일 준비
`backend/pdfs/` 폴더에 다음 PDF 파일들을 저장하세요:
- `백엔드_가이드.pdf`
- `프론트_가이드.pdf`
- `디비_가이드.pdf`

**PDF 저장 경로**: `backend/pdfs/`

### 3. 서버 실행
```bash
cd backend
python run_server.py
```

또는

```bash
cd backend
python main.py
```

서버가 실행되면:
- 서버 주소: http://localhost:9000
- API 문서: http://localhost:9000/docs
- 헬스체크: http://localhost:9000/health

## API 엔드포인트

### 1. GitLab API
```
POST /api/gitlab
{
  "project": "corp/policies",
  "file_path": "backend-guide.md"  // 선택사항
}
```

### 2. PDF API
```
POST /api/pdf
{
  "filename": "백엔드_가이드.pdf"
}
```

### 3. Database API
```
POST /api/database
{
  "table": "users",
  "filters": {"role": "backend"}  // 선택사항
}
```

### 4. MCP 호환 API (기존 프론트엔드 호환용)
```
POST /mcp/invoke
{
  "action": "GITLAB_GUIDE",
  "args": {"project": "corp/policies"}
}
```

## 가상 데이터

### 사용자 테이블 (users)
- 김개발 (backend, 5년 경력)
- 이프론트 (frontend, 3년 경력)
- 박풀스택 (fullstack, 7년 경력)
- 최디비 (database, 4년 경력)

### 가이드 테이블 (guides)
- 백엔드 개발 가이드
- 프론트엔드 베스트 프랙티스
- 데이터베이스 설계 원칙
- API 문서화 가이드

### GitLab 저장소
- corp/policies: 회사 정책 저장소
- corp/backend: 백엔드 관련 저장소

## 주의사항

1. PDF 파일들을 `backend/pdfs/` 폴더에 미리 저장해야 합니다.
2. 현재는 메모리 기반 데이터베이스를 사용하므로 서버 재시작 시 데이터가 초기화됩니다.
3. CORS가 모든 도메인에 대해 허용되어 있습니다 (개발용).