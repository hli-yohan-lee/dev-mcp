사내 MCP 스택 구축 가이드 (Python 백엔드 + React 프론트)

전제: 모든 호출은 “회사 API 서버” 1곳으로만 간다. MCP 서버는 회사 API 서버만 호출.
프록시 계층(게이트웨이)은 mTLS + HMAC + 레이트리밋 + 감사/로깅 + 캐싱/서킷브레이커를 담당.

[Browser/React] ───────→ [MCP 서버(FastAPI)] ──(mTLS+HMAC)──→ [게이트웨이(Nginx/Envoy)]
       │                                    (단일 엔드포인트)             │
       │                                                                  ▼
       └────────────(선택) OpenAI(Chat) 테스트────────────→        [회사 API 서버(FastAPI)]
                                                                            ├─ GitLab 어댑터
                                                                            ├─ PDF 파이프라인(추출/OCR/Diff/임베딩)
                                                                            └─ 기타 사내 시스템

0) 레포 구조
mcp-stack/
├─ frontend/                 # React 테스트 UI
├─ mcp-server/               # MCP 서버(FastAPI) — 회사 API 서버만 호출
├─ gateway/                  # Nginx(또는 Envoy) mTLS/정책
└─ corp-api/                 # 회사 API 서버(FastAPI) — 실제 기능/검증/어댑터

1) 프론트엔드(React) — “MCP 호출 테스트 + 호출 로그 보기 + (옵션) GPT 테스트”
1.1 .env 예시
VITE_MCP_BASE_URL=https://mcp.example.com

1.2 최소 UI (액션 선택 → args JSON → Invoke → 로그)
// frontend/src/App.tsx
import { useState } from "react";

type Log = { ts: string; action: string; status: string; latencyMs?: number; id?: string };

export default function App() {
  const [action, setAction] = useState("PDF_METADATA");
  const [args, setArgs] = useState(`{
  "doc_ref": { "type":"GITLAB", "project_path":"corp/policies", "path":"2025/AnnexA.pdf", "ref":"v2025.08" }
}`);
  const [logs, setLogs] = useState<Log[]>([]);
  const [resp, setResp] = useState("");

  async function invoke() {
    const started = Date.now();
    try {
      const r = await fetch(`${import.meta.env.VITE_MCP_BASE_URL}/mcp/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, args: JSON.parse(args) }),
      });
      const data = await r.json();
      setResp(JSON.stringify(data, null, 2));
      setLogs((prev) => [{ ts: new Date().toISOString(), action, status: data.ok ? "OK" : "ERR", latencyMs: Date.now()-started, id: data.meta?.request_id }, ...prev]);
    } catch (e:any) {
      setResp(String(e));
      setLogs((prev) => [{ ts: new Date().toISOString(), action, status: "ERR" }, ...prev]);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", fontFamily: "ui-sans-serif" }}>
      <h1>🛠 MCP Invoke Tester</h1>
      <label>Action</label>{" "}
      <select value={action} onChange={(e)=>setAction(e.target.value)}>
        <option>PDF_METADATA</option>
        <option>PDF_TEXT</option>
        <option>PDF_LAYOUT</option>
        <option>PDF_DIFF</option>
        <option>PDF_CHUNK</option>
        <option>PDF_EMBED</option>
        <option>GITLAB_GUIDE</option>
        <option>GITLAB_PROJECT_INFO</option>
      </select>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16 }}>
        <div>
          <label>Args (JSON)</label>
          <textarea rows={18} value={args} onChange={(e)=>setArgs(e.target.value)} style={{ width:"100%" }}/>
          <button onClick={invoke} style={{ marginTop: 8 }}>Invoke</button>
        </div>
        <div>
          <label>Response</label>
          <pre style={{ background:"#111", color:"#0f0", padding:12, height:330, overflow:"auto" }}>{resp}</pre>
        </div>
      </div>

      <h3 style={{ marginTop:24 }}>Recent Invokes</h3>
      <table width="100%" border={1} cellPadding={6}>
        <thead><tr><th>Time</th><th>Action</th><th>Status</th><th>Latency(ms)</th><th>ReqID</th></tr></thead>
        <tbody>
          {logs.map((l,i)=>(<tr key={i}><td>{l.ts}</td><td>{l.action}</td><td>{l.status}</td><td>{l.latencyMs??""}</td><td>{l.id??""}</td></tr>))}
        </tbody>
      </table>
    </div>
  );
}


(옵션) GPT 키 입력 후 채팅으로 툴콜 테스트하는 화면은 후속으로 붙일 수 있음: 백엔드에 /chat 엔드포인트(OpenAI SDK) 추가 → 모델에게 tools(=MCP 액션들) 정의 전달 → tool_call 발생 시 mcp/invoke 호출.

2) MCP 서버(FastAPI) — 회사 API 서버만 호출
2.1 .env
COMPANY_API_BASE=https://gw.example.com  # 게이트웨이 주소(단일)
HMAC_KEY=supersecret
MCP_ID=mcp-invest

2.2 서버 코드(서명/Nonce/Timestamp 부착 → 게이트웨이로 포워딩)
# mcp-server/app.py
import os, time, hmac, hashlib, json, secrets
from fastapi import FastAPI, Request
import httpx

APP = FastAPI()
BASE = os.environ["COMPANY_API_BASE"]
HMAC_KEY = os.environ["HMAC_KEY"].encode()
MCP_ID = os.environ.get("MCP_ID","mcp")

def sign(body: bytes, ts: str, nonce: str) -> str:
    msg = ts.encode() + b"." + nonce.encode() + b"." + body
    mac = hmac.new(HMAC_KEY, msg, hashlib.sha256).hexdigest()
    return f"hmac-sha256={mac}"

@APP.post("/mcp/invoke")
async def invoke(req: Request):
    payload = await req.json()
    action = payload.get("action"); args = payload.get("args", {})
    body = json.dumps({"action":action, "args":args}, separators=(",",":")).encode()
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    nonce = secrets.token_hex(12)
    sig = sign(body, ts, nonce)

    headers = {
        "Content-Type":"application/json",
        "X-Actor":"mcp",           # (필요시 사용자 매핑)
        "X-Tool":"corp.ops",
        "X-Action":action or "",
        "X-Timestamp":ts,
        "X-Nonce":nonce,
        "X-Signature":sig,
        "X-Client": MCP_ID,
    }

    # 단일 엔드포인트 — 게이트웨이가 라우팅
    url = f"{BASE}/mcp/dispatch"
    async with httpx.AsyncClient(verify=True, timeout=30.0) as client:
        r = await client.post(url, content=body, headers=headers)
        data = r.json()
        # 호출 로그용 request_id 주입(게이트웨이/회사 API 서버가 생성)
        return {"ok": r.status_code < 400, **data}


포인트: MCP는 라우팅을 신경쓰지 않음. 항상 gw.example.com/mcp/dispatch로만 보냄(게이트웨이가 액션별로 회사 API 서버로 라우팅).

3) 프록시 계층 — mTLS + HMAC + 레이트리밋 + 캐싱 + 로깅 + 서킷브레이커

Nginx 예시(초기 도입 간단). 규모 커지면 Envoy로 전환.

3.1 인증서/키

server.crt/server.key : 게이트웨이 서버 인증서

ca.crt : 클라이언트(MCP) 인증서 검증용 CA

mcp-client.crt/mcp-client.key : MCP 클라이언트 인증서(사내 CA로 발급)

3.2 Nginx 설정 스니펫
# gateway/nginx.conf
events {}
http {
  # 로그(JSON 형태 권장. 예시는 단순화)
  log_format main '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent '
                  '"$http_user_agent" rt=$request_time rid=$upstream_http_x_request_id';
  access_log /var/log/nginx/access.log main;

  # 레이트리밋: IP 기준(초기), 필요시 X-Actor 단위로 확장
  limit_req_zone $binary_remote_addr zone=reqs:10m rate=30r/m;

  # 캐시
  proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=apicache:100m max_size=1g inactive=6h use_temp_path=off;

  upstream corp_api {
    server corp-api:8080;  # 회사 API 서버(내부)
  }

  server {
    listen 443 ssl;
    server_name gw.example.com;

    # 서버 TLS
    ssl_certificate /etc/nginx/tls/server.crt;
    ssl_certificate_key /etc/nginx/tls/server.key;

    # mTLS(클라이언트 인증)
    ssl_client_certificate /etc/nginx/tls/ca.crt;
    ssl_verify_client on;

    # 공통 헤더 전달
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;

    location /mcp/dispatch {
      limit_req zone=reqs burst=10 nodelay;

      # 캐시: 멱등 조회성 응답만(회사 API 서버에서 Cache-Control 헤더로 제어 권장)
      proxy_cache apicache;
      proxy_cache_valid 200 10m;
      proxy_ignore_headers Set-Cookie;

      # 서킷브레이커 유사(단순화): 백엔드 실패시 빠른 우회/실패
      proxy_next_upstream error timeout http_502 http_503 http_504;
      proxy_next_upstream_tries 1;
      proxy_read_timeout 60s;

      proxy_pass http://corp_api/dispatch;
    }
  }
}


mTLS: ssl_verify_client on; 이 핵심. MCP의 클라이언트 인증서를 사내 CA로 발급해 검증.

4) 회사 API 서버(FastAPI) — HMAC 검증 + 라우팅 + 실기능
4.1 .env
HMAC_KEY=supersecret
NONCE_REDIS_URL=redis://redis:6379/3

4.2 HMAC/Nonce 미들웨어
# corp-api/app.py
import os, time, hmac, hashlib, json, asyncio
from fastapi import FastAPI, Request, HTTPException
import aioredis
from pydantic import BaseModel

APP = FastAPI()
HMAC_KEY = os.environ["HMAC_KEY"].encode()
REDIS_URL = os.environ["NONCE_REDIS_URL"]
redis = None

@APP.on_event("startup")
async def startup():
    global redis
    redis = await aioredis.from_url(REDIS_URL, decode_responses=True)

def verify_signature(body: bytes, ts: str, nonce: str, sig: str):
    if not ts or not nonce or not sig:
        raise HTTPException(401, "Missing auth headers")
    # 5분 허용
    now = int(time.time())
    try:
        t = int(time.mktime(time.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")))
    except:
        raise HTTPException(401, "Bad timestamp")
    if abs(now - t) > 300:
        raise HTTPException(401, "Timestamp skew")

    # Nonce 1회성
    if redis is None: raise HTTPException(500, "Redis not ready")
    if asyncio.get_event_loop().is_running():
        pass
    if redis.get(nonce):
        raise HTTPException(401, "Replay detected")
    await redis.setex(nonce, 300, "1")

    mac = hmac.new(HMAC_KEY, ts.encode()+b"."+nonce.encode()+b"."+body, hashlib.sha256).hexdigest()
    if sig.split("=",1)[-1] != mac:
        raise HTTPException(401, "Bad signature")

class Invoke(BaseModel):
    action: str
    args: dict

@APP.post("/dispatch")
async def dispatch(req: Request, inv: Invoke):
    # 헤더 검증
    ts = req.headers.get("X-Timestamp")
    nonce = req.headers.get("X-Nonce")
    sig = req.headers.get("X-Signature")
    body = await req.body()
    await verify_signature(body, ts, nonce, sig)

    # 감사/로깅(민감정보 미저장)
    request_id = hashlib.md5((nonce+ts).encode()).hexdigest()[:12]

    # 라우팅
    action = inv.action
    if action == "PDF_METADATA":
        data = await pdf_metadata(inv.args)
    elif action == "PDF_TEXT":
        data = await pdf_text(inv.args)
    elif action == "PDF_LAYOUT":
        data = await pdf_layout(inv.args)
    elif action == "PDF_DIFF":
        data = await pdf_diff(inv.args)
    elif action == "GITLAB_GUIDE":
        data = await gitlab_guide(inv.args)
    else:
        raise HTTPException(400, f"Unknown action={action}")

    return {"ok": True, "data": data, "meta": {"request_id": request_id}}

# --------- 기능 스텁(실서비스에서는 어댑터 모듈로 분리) ---------
async def pdf_metadata(args: dict):
    # doc_ref 읽어와서 페이지수/해시 계산 등
    return {"pages": 42, "sha256": "abc..."}  # 예시

async def pdf_text(args: dict):
    # PyMuPDF 등으로 {page, text} JSONL 만들기
    return {"items": [{"page":1, "text":"..."}]}

async def pdf_layout(args: dict):
    # {blocks:[{type,bbox,font,size,bold,text}]}
    return {"pages":[{"page":1,"blocks":[{"type":"text","bbox":[0,0,100,30],"bold":True,"text":"목차"}]}]}

async def pdf_diff(args: dict):
    # left/right 문서 레이아웃 추출 → 매칭 → 변경점 계산 → HTML 리포트 저장 후 ID 반환
    return {"report_id":"rep_20250823_abc123", "summary":{"changes":12,"pages_affected":4}}

async def gitlab_guide(args: dict):
    # 내부 토큰으로 GitLab/런북 시스템 호출
    return {"run_id":"gl_123", "status":"QUEUED"}


레이트리밋: Nginx에서 1차(IP 기반). 필요 시 여기에서도 X-Actor 기반으로 Redis 토큰버킷 추가.
캐싱: PDF_METADATA/TEXT/OUTLINE처럼 멱등 조회에는 Cache-Control 헤더를 세팅해 Nginx 캐시 활용.

5) Diff(텍스트/레이아웃) 구현 개요

Text Diff: PyMuPDF로 텍스트 → 줄/문장 토큰화 → LCS 알고리즘으로 diff → {page, op, span} JSON.

Layout Diff: PyMuPDF/pdfplumber로 블록(bbox/font/size/bold) 추출 → 좌표/유사도 기반 매칭 → insert|delete|modify 분류 → HTML 오버레이 생성.

스캔본: 텍스트 밀도 낮으면 Tesseract OCR로 텍스트/레이아웃 재구성 후 동일 처리.

대형 문서(>150p)는 잡 큐로 분리: /jobs/submit(async) → /jobs/{id}/status → /jobs/{id}/result.

6) mTLS/HMAC/레이트리밋/감사/캐싱/서킷브레이커 — 한 줄 요약

mTLS: “MCP가 진짜 우리 것인지” 네트워크 레벨 신원증명(클라이언트 인증서 검증).

HMAC: 요청 본문 변조/재전송 방지(본문+타임스탬프+Nonce로 서명).

레이트리밋: 남용/폭주 방지(분/초당 호출 수 제한).

감사/로깅: 누가/언제/무엇을/결과/지연을 구조화해 추적.

캐싱: 같은 멱등 결과 재사용(성능/비용 절감).

서킷브레이커: 뒷단 장애 시 빠른 실패로 연쇄붕괴 방지.

별도 서버 필수 아님: 초기엔 게이트웨이=Nginx + 회사 API 서버 2티어로 충분. 점차 Envoy/Service Mesh로 진화 가능.

7) 실행 방법(로컬 데모 가정)
7.1 회사 API 서버
cd corp-api
pip install fastapi uvicorn aioredis
uvicorn app:APP --host 0.0.0.0 --port 8080

7.2 게이트웨이(Nginx)

gateway/nginx.conf와 인증서 파일 배치 후 Docker로 띄우기:

docker run -it --rm -p 443:443 \
  -v $PWD/gateway/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $PWD/gateway/tls:/etc/nginx/tls:ro \
  --add-host=corp-api:host-gateway \
  nginx:stable

7.3 MCP 서버
cd mcp-server
pip install fastapi uvicorn httpx python-dotenv
uvicorn app:APP --host 0.0.0.0 --port 9000

7.4 프론트엔드
cd frontend
npm i
npm run dev
# 브라우저에서 Action/Args 입력 → Invoke

8) 액션 스키마(요약)
{
  "action": "PDF_DIFF | PDF_METADATA | PDF_TEXT | PDF_LAYOUT | PDF_CHUNK | PDF_EMBED | GITLAB_GUIDE | GITLAB_PROJECT_INFO",
  "args": {
    "...": "액션별 oneOf 스키마 (doc_ref/pages/mode/granularity/output 등)"
  }
}


응답 공통

{ "ok": true, "data": { ... }, "meta": { "request_id": "abcd1234", "latency_ms": 1234 } }


에러

{ "ok": false, "error": { "code":"BAD_ARG|RATE_LIMIT|TIMEOUT|ENGINE_FAIL", "message":"...", "retry_after_ms": 5000, "is_transient": true } }

9) 운영 체크리스트

 mTLS: MCP 클라이언트 인증서 배포/로테이션 정책

 HMAC: 서버/클라이언트 키 보관(KMS/Vault) + Nonce Redis TTL=5m

 레이트리밋: 액션별 정책(PDF_DIFF/EMBED 낮게)

 캐시: 멱등 응답에 Cache-Control: public, max-age=...

 감사로그: PII/원문 미저장, 해시/요약만

 타임아웃: 조회 10s, 레이아웃/테이블 20s, Diff 30s, Embed 45s

 배치/대형 문서: /jobs 경로 + 멱등키

 버전닝: 깨지는 변경은 action@v2 신규 추가