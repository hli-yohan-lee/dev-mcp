import os, time, hmac, hashlib, json, asyncio
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from collections import OrderedDict
import threading
import openai

load_dotenv()

APP = FastAPI()

# CORS 미들웨어 추가
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HMAC_KEY = os.environ.get("HMAC_KEY", "supersecret").encode()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# OpenAI 클라이언트 설정
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY
    openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
else:
    openai_client = None

# 메모리 기반 nonce 저장 (레디스 대신)
nonce_store = OrderedDict()
nonce_lock = threading.Lock()
MAX_NONCES = 1000  # 메모리 사용량 제한

def cleanup_expired_nonces():
    """만료된 nonce 정리"""
    current_time = int(time.time())
    with nonce_lock:
        expired = [nonce for nonce, (timestamp, _) in nonce_store.items() 
                  if current_time - timestamp > 300]
        for nonce in expired:
            nonce_store.pop(nonce, None)

def add_nonce(nonce: str, timestamp: int):
    """nonce 추가"""
    with nonce_lock:
        # 메모리 사용량 제한
        if len(nonce_store) >= MAX_NONCES:
            # 가장 오래된 항목 제거
            nonce_store.popitem(last=False)
        nonce_store[nonce] = (timestamp, time.time())

def is_nonce_exists(nonce: str) -> bool:
    """nonce 존재 여부 확인"""
    with nonce_lock:
        return nonce in nonce_store

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

    # Nonce 1회성 검증
    if is_nonce_exists(nonce):
        raise HTTPException(401, "Replay detected")
    
    # nonce 추가
    add_nonce(nonce, t)
    
    # 주기적으로 만료된 nonce 정리
    if len(nonce_store) % 100 == 0:  # 100개마다 정리
        cleanup_expired_nonces()

    # HMAC 검증
    mac = hmac.new(HMAC_KEY, ts.encode()+b"."+nonce.encode()+b"."+body, hashlib.sha256).hexdigest()
    if sig.split("=",1)[-1] != mac:
        raise HTTPException(401, "Bad signature")

class Invoke(BaseModel):
    action: str
    args: dict

class ChatRequest(BaseModel):
    message: str
    history: list = []

@APP.post("/dispatch")
async def dispatch(req: Request, inv: Invoke):
    try:
        print(f"🔍 Corp-API: dispatch 요청 수신")
        print(f"📝 액션: {inv.action}")
        print(f"📝 인수: {inv.args}")
        
        # 헤더 검증
        ts = req.headers.get("X-Timestamp")
        nonce = req.headers.get("X-Nonce")
        sig = req.headers.get("X-Signature")
        body = await req.body()
        
        print(f"🔐 인증 헤더: ts={ts}, nonce={nonce}, sig={sig[:20]}...")
        
        await verify_signature(body, ts, nonce, sig)
        print(f"✅ 인증 성공")

        # 감사/로깅(민감정보 미저장)
        request_id = hashlib.md5((nonce+ts).encode()).hexdigest()[:12]
        print(f"🆔 요청 ID: {request_id}")

        # 라우팅
        action = inv.action
        if action == "PDF_METADATA":
            print(f"📄 PDF 메타데이터 처리")
            data = await pdf_metadata(inv.args)
        elif action == "PDF_TEXT":
            print(f"📝 PDF 텍스트 처리")
            data = await pdf_text(inv.args)
        elif action == "PDF_LAYOUT":
            print(f"🎨 PDF 레이아웃 처리")
            data = await pdf_layout(inv.args)
        elif action == "PDF_DIFF":
            print(f"🔍 PDF 차이점 처리")
            data = await pdf_diff(inv.args)
        elif action == "GITLAB_GUIDE":
            print(f"🚀 GitLab 가이드 처리")
            data = await gitlab_guide(inv.args)
        elif action == "CHAT":
            print(f"💬 채팅 처리 시작")
            # 채팅 요청 처리
            chat_request = ChatRequest(**inv.args)
            result = await chat(chat_request)
            print(f"💬 채팅 처리 완료: {result}")
            return {"ok": True, "data": result, "meta": {"request_id": request_id}}
        else:
            print(f"❌ 알 수 없는 액션: {action}")
            raise HTTPException(400, f"Unknown action={action}")

        print(f"✅ 액션 처리 완료: {data}")
        return {"ok": True, "data": data, "meta": {"request_id": request_id}}
        
    except Exception as e:
        print(f"💥 dispatch 에러: {str(e)}")
        raise

@APP.post("/api/chat")
async def chat(request: ChatRequest):
    """GPT API를 통한 채팅 응답"""
    try:
        print(f"💬 Corp-API: chat 함수 호출")
        print(f"📝 메시지: {request.message}")
        print(f"📝 히스토리 길이: {len(request.history)}")
        
        if not openai_client:
            print(f"❌ OpenAI 클라이언트가 설정되지 않음")
            raise HTTPException(500, "OpenAI API key not configured")
        
        print(f"✅ OpenAI 클라이언트 확인됨")
        
        # 대화 히스토리 구성
        messages = []
        
        # 시스템 메시지 추가 (MCP 도구 사용 가능함을 안내)
        system_msg = {
            "role": "system",
            "content": """당신은 MCP(Model Context Protocol) 도구들을 사용할 수 있는 AI 어시스턴트입니다. 
사용자가 PDF 문서 분석, GitLab 프로젝트 정보 등이 필요할 때 적절한 MCP 도구를 제안하고 사용법을 안내해주세요.
사용자의 질문에 친근하고 도움이 되는 답변을 제공하세요."""
        }
        messages.append(system_msg)
        print(f"🤖 시스템 메시지 추가: {system_msg['content'][:50]}...")
        
        # 대화 히스토리 추가
        for msg in request.history[-10:]:  # 최근 10개 메시지만 유지
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        print(f"📚 히스토리 메시지 {len(request.history[-10:])}개 추가")
        
        # 현재 사용자 메시지 추가
        user_msg = {
            "role": "user",
            "content": request.message
        }
        messages.append(user_msg)
        print(f"👤 사용자 메시지 추가: {user_msg['content'][:50]}...")
        
        print(f"🚀 OpenAI API 호출 시작...")
        print(f"📊 총 메시지 수: {len(messages)}")
        
        # OpenAI API 호출
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=1000,
            temperature=0.7
        )
        
        print(f"✅ OpenAI API 응답 수신")
        
        # 응답 추출
        assistant_message = response.choices[0].message.content
        print(f"🤖 어시스턴트 응답: {assistant_message[:100]}...")
        
        result = {
            "ok": True,
            "response": assistant_message,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        }
        
        print(f"🎯 최종 결과: {result}")
        return result
        
    except Exception as e:
        print(f"💥 chat 함수 에러: {str(e)}")
        raise HTTPException(500, f"Chat API error: {str(e)}")

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

@APP.get("/health")
async def health():
    return {"status": "healthy", "nonce_count": len(nonce_store)} 