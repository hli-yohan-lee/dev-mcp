# Design Document

## Overview

GPT 채팅 응답이 비어있는 문제는 프론트엔드에서 백엔드 API 응답을 잘못 파싱하는 것이 원인입니다. 백엔드는 `{"ok": true, "response": "실제내용"}` 형태로 응답하지만, 프론트엔드에서는 `data.response || data.data?.response` 순서로 접근하여 올바른 데이터를 추출하지 못하고 있습니다.

현재 문제점:
- 백엔드 `/api/chat` 엔드포인트는 `{"ok": true, "response": "내용"}` 형태로 응답
- 프론트엔드는 `data.response`로 접근하지만 실제로는 `data.data?.response`를 먼저 확인
- 이로 인해 정상적인 응답도 빈 내용으로 처리됨

## Architecture

### Current Flow (문제 상황)
```
사용자 입력 → 프론트엔드 → 백엔드 API → GPT API → 백엔드 응답 → 프론트엔드 파싱 (실패) → 빈 메시지 표시
```

### Fixed Flow (수정 후)
```
사용자 입력 → 프론트엔드 → 백엔드 API → GPT API → 백엔드 응답 → 프론트엔드 파싱 (성공) → 스트리밍 표시
```

## Components and Interfaces

### 백엔드 API 응답 구조
```typescript
interface ChatResponse {
  ok: boolean;
  response: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### 프론트엔드 응답 처리 로직
```typescript
// 현재 (문제)
const responseText = data.response || data.data?.response || "응답을 받았지만 내용이 비어있습니다.";

// 수정 후
const responseText = data.response || "응답을 받았지만 내용이 비어있습니다.";
```

## Data Models

### Message Interface (기존 유지)
```typescript
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
```

### API Request/Response Models
```typescript
// 요청
interface ChatRequest {
  message: string;
  history: Array<{role: string, content: string}>;
}

// 응답
interface ChatResponse {
  ok: boolean;
  response: string;
  usage?: TokenUsage;
}
```

## Error Handling

### 응답 파싱 에러 처리
1. **정상 응답**: `data.response`에서 내용 추출
2. **빈 응답**: 기본 메시지 "응답을 받았지만 내용이 비어있습니다." 표시
3. **HTTP 에러**: 상태 코드와 함께 에러 메시지 표시
4. **네트워크 에러**: 연결 문제 메시지 표시

### 에러 메시지 개선
```typescript
// HTTP 에러
throw new Error(`서버 오류 (HTTP ${response.status})`);

// 네트워크 에러
catch (error: any) {
  const errorMessage = error.message.includes('fetch') 
    ? '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
    : `에러: ${error.message}`;
}
```

## Testing Strategy

### 단위 테스트
1. **응답 파싱 테스트**: 다양한 응답 형태에 대한 파싱 로직 검증
2. **에러 처리 테스트**: 각종 에러 상황에서의 메시지 표시 검증
3. **스트리밍 테스트**: 스트리밍 효과의 정상 작동 검증

### 통합 테스트
1. **전체 플로우 테스트**: 사용자 입력부터 응답 표시까지 전체 과정 검증
2. **백엔드 연동 테스트**: 실제 백엔드 API와의 연동 검증

### 수동 테스트 시나리오
1. **정상 케이스**: 일반적인 질문에 대한 GPT 응답 확인
2. **긴 응답**: 긴 텍스트 응답의 스트리밍 효과 확인
3. **에러 케이스**: API 키 없음, 서버 다운 등 에러 상황 확인
4. **빈 응답**: GPT가 빈 응답을 보낸 경우 처리 확인

## Implementation Notes

### 주요 수정 사항
1. **응답 파싱 로직 수정**: `data.data?.response` 제거하고 `data.response`만 사용
2. **에러 메시지 개선**: 더 사용자 친화적인 에러 메시지 제공
3. **디버그 로그 강화**: 응답 데이터 구조를 명확히 로그에 기록

### 성능 고려사항
- 스트리밍 효과의 딜레이(20ms)는 적절한 수준으로 유지
- 긴 응답에 대해서도 부드러운 스트리밍 효과 보장

### 호환성
- 기존 백엔드 API 구조는 변경하지 않음
- 프론트엔드만 수정하여 문제 해결