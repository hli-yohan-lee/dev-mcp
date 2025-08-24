# 📋 API 스키마 문서

## 🔄 MCP Invoke API

### 요청

**엔드포인트**: `POST /mcp/invoke`

**헤더**:
```
Content-Type: application/json
```

**본문**:
```json
{
  "action": "PDF_METADATA | PDF_TEXT | PDF_LAYOUT | PDF_DIFF | PDF_CHUNK | PDF_EMBED | GITLAB_GUIDE | GITLAB_PROJECT_INFO",
  "args": {
    "...": "액션별 oneOf 스키마"
  }
}
```

### 응답

**성공 응답**:
```json
{
  "ok": true,
  "data": {
    "...": "액션별 응답 데이터"
  },
  "meta": {
    "request_id": "abcd1234",
    "latency_ms": 1234
  }
}
```

**에러 응답**:
```json
{
  "ok": false,
  "error": {
    "code": "BAD_ARG | RATE_LIMIT | TIMEOUT | ENGINE_FAIL",
    "message": "에러 메시지",
    "retry_after_ms": 5000,
    "is_transient": true
  }
}
```

## 📄 PDF 관련 액션

### PDF_METADATA

**요청**:
```json
{
  "action": "PDF_METADATA",
  "args": {
    "doc_ref": {
      "type": "GITLAB",
      "project_path": "corp/policies",
      "path": "2025/AnnexA.pdf",
      "ref": "v2025.08"
    }
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "pages": 42,
    "sha256": "abc123...",
    "file_size": 1048576,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### PDF_TEXT

**요청**:
```json
{
  "action": "PDF_TEXT",
  "args": {
    "doc_ref": {
      "type": "GITLAB",
      "project_path": "corp/policies",
      "path": "2025/AnnexA.pdf",
      "ref": "v2025.08"
    },
    "pages": [1, 2, 3],
    "extract_tables": true
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "page": 1,
        "text": "문서 내용...",
        "tables": [
          {
            "bbox": [100, 200, 500, 300],
            "data": [["제목1", "제목2"], ["값1", "값2"]]
          }
        ]
      }
    ]
  }
}
```

### PDF_LAYOUT

**요청**:
```json
{
  "action": "PDF_LAYOUT",
  "args": {
    "doc_ref": {
      "type": "GITLAB",
      "project_path": "corp/policies",
      "path": "2025/AnnexA.pdf",
      "ref": "v2025.08"
    },
    "pages": [1, 2],
    "include_images": true
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "pages": [
      {
        "page": 1,
        "blocks": [
          {
            "type": "text",
            "bbox": [0, 0, 100, 30],
            "font": "Arial",
            "size": 12,
            "bold": true,
            "text": "목차"
          },
          {
            "type": "image",
            "bbox": [200, 100, 400, 200],
            "alt_text": "차트 이미지"
          }
        ]
      }
    ]
  }
}
```

### PDF_DIFF

**요청**:
```json
{
  "action": "PDF_DIFF",
  "args": {
    "left_doc": {
      "type": "GITLAB",
      "project_path": "corp/policies",
      "path": "2024/AnnexA.pdf",
      "ref": "v2024.12"
    },
    "right_doc": {
      "type": "GITLAB",
      "project_path": "corp/policies",
      "path": "2025/AnnexA.pdf",
      "ref": "v2025.08"
    },
    "mode": "layout", // "text" | "layout"
    "granularity": "block" // "word" | "line" | "block"
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "report_id": "rep_20250823_abc123",
    "summary": {
      "changes": 12,
      "pages_affected": 4,
      "insertions": 8,
      "deletions": 3,
      "modifications": 1
    },
    "report_url": "/reports/rep_20250823_abc123.html"
  }
}
```

## 🔧 GitLab 관련 액션

### GITLAB_GUIDE

**요청**:
```json
{
  "action": "GITLAB_GUIDE",
  "args": {
    "project_path": "corp/policies",
    "playbook": "deploy-policy",
    "variables": {
      "environment": "production",
      "version": "v2025.08"
    }
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "run_id": "gl_123",
    "status": "QUEUED",
    "pipeline_url": "https://gitlab.company.com/corp/policies/-/pipelines/123",
    "estimated_duration": 300
  }
}
```

### GITLAB_PROJECT_INFO

**요청**:
```json
{
  "action": "GITLAB_PROJECT_INFO",
  "args": {
    "project_path": "corp/policies",
    "include_branches": true,
    "include_tags": true
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "project_id": 123,
    "name": "Policies",
    "description": "회사 정책 문서들",
    "branches": ["main", "develop", "feature/new-policy"],
    "tags": ["v2024.12", "v2025.08"],
    "last_activity": "2025-01-15T10:30:00Z"
  }
}
```

## 🔐 인증 헤더

모든 요청에는 다음 헤더들이 포함됩니다:

```
X-Actor: mcp
X-Tool: corp.ops
X-Action: [액션명]
X-Timestamp: [ISO 8601 타임스탬프]
X-Nonce: [12자리 랜덤 문자열]
X-Signature: hmac-sha256=[HMAC 해시]
X-Client: [MCP 클라이언트 ID]
```

## ⚡ 레이트 리밋

- **기본**: 30 requests/minute per IP
- **PDF_DIFF**: 10 requests/minute per IP
- **PDF_EMBED**: 5 requests/minute per IP

## 🕐 타임아웃

- **조회성 액션**: 10초
- **레이아웃 분석**: 20초
- **Diff 분석**: 30초
- **임베딩**: 45초 