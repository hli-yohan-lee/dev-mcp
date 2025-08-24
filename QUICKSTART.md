# 🚀 MCP 스택 빠른 시작 가이드

## 📋 사전 요구사항

- Docker & Docker Compose 설치
- OpenSSL (TLS 인증서 생성용)
- Git

## 🏃‍♂️ 빠른 시작

### 1. TLS 인증서 생성

```bash
# Linux/Mac
chmod +x scripts/setup-tls.sh
./scripts/setup-tls.sh

# Windows
scripts\setup-tls.bat
```

### 2. 시스템 시작

```bash
# Linux/Mac
chmod +x scripts/start.sh
./scripts/start.sh

# Windows
scripts\start.bat
```

### 3. 브라우저에서 접속

- **프론트엔드**: http://localhost:3000
- **MCP 서버**: http://localhost:9000/health
- **회사 API**: http://localhost:8080/health

## 🧪 테스트

1. 브라우저에서 http://localhost:3000 접속
2. Action 선택 (예: PDF_METADATA)
3. Args JSON 입력
4. Invoke 버튼 클릭
5. 응답 확인

## 🛑 시스템 중지

```bash
# Linux/Mac
./scripts/stop.sh

# Windows
scripts\stop.bat
```

## 🔍 문제 해결

### 포트 충돌
```bash
# 사용 중인 포트 확인
netstat -tulpn | grep :3000
netstat -tulpn | grep :9000
netstat -tulpn | grep :8080
```

### 로그 확인
```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f frontend
docker-compose logs -f mcp-server
docker-compose logs -f corp-api
```

### 컨테이너 재시작
```bash
docker-compose restart [서비스명]
```

## 📚 추가 정보

- [README.md](README.md) - 상세한 아키텍처 설명
- [API 문서](http://localhost:9000/docs) - MCP 서버 API 문서
- [회사 API 문서](http://localhost:8080/docs) - 회사 API 서버 문서 