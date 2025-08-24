#!/bin/bash

echo "🔐 TLS 인증서 생성 중..."

# gateway/tls 디렉토리 생성
mkdir -p gateway/tls

# CA 개인키 생성
openssl genrsa -out gateway/tls/ca.key 4096

# CA 인증서 생성
openssl req -new -x509 -days 365 -key gateway/tls/ca.key -out gateway/tls/ca.crt \
  -subj "/C=KR/ST=Seoul/L=Seoul/O=Company/OU=IT/CN=Company CA"

# 서버 개인키 생성
openssl genrsa -out gateway/tls/server.key 2048

# 서버 인증서 서명 요청 생성
openssl req -new -key gateway/tls/server.key -out gateway/tls/server.csr \
  -subj "/C=KR/ST=Seoul/L=Seoul/O=Company/OU=IT/CN=gw.example.com"

# 서버 인증서 생성 (CA로 서명)
openssl x509 -req -days 365 -in gateway/tls/server.csr \
  -CA gateway/tls/ca.crt -CAkey gateway/tls/ca.key -CAcreateserial \
  -out gateway/tls/server.crt

# MCP 클라이언트 개인키 생성
openssl genrsa -out gateway/tls/mcp-client.key 2048

# MCP 클라이언트 인증서 서명 요청 생성
openssl req -new -key gateway/tls/mcp-client.key -out gateway/tls/mcp-client.csr \
  -subj "/C=KR/ST=Seoul/L=Seoul/O=Company/OU=IT/CN=mcp-client"

# MCP 클라이언트 인증서 생성 (CA로 서명)
openssl x509 -req -days 365 -in gateway/tls/mcp-client.csr \
  -CA gateway/tls/ca.crt -CAkey gateway/tls/ca.key \
  -out gateway/tls/mcp-client.crt

# 임시 파일 정리
rm gateway/tls/*.csr gateway/tls/*.srl

echo "✅ TLS 인증서가 생성되었습니다!"
echo ""
echo "📁 생성된 파일들:"
echo "  - gateway/tls/ca.crt (CA 인증서)"
echo "  - gateway/tls/server.crt (서버 인증서)"
echo "  - gateway/tls/server.key (서버 개인키)"
echo "  - gateway/tls/mcp-client.crt (MCP 클라이언트 인증서)"
echo "  - gateway/tls/mcp-client.key (MCP 클라이언트 개인키)"
echo ""
echo "⚠️  실제 운영환경에서는 적절한 CA에서 발급받은 인증서를 사용하세요." 