from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import json
import asyncio
import httpx
from openai import OpenAI
import os

app = FastAPI(title="MCP Gateway Backend", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 요청 모델
class AskRequest(BaseModel):
    question: str
    api_key: str

class AskResponse(BaseModel):
    answer: str
    tools_used: List[str] = []
    mcp_calls: List[Dict[str, Any]] = []  # MCP 호출 상세 정보

# MCP 서버 엔드포인트
MCP_ENDPOINT = "http://localhost:9001"

# OpenAI 클라이언트 (API 키는 요청에서 받음)
def get_openai_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key)

async def get_mcp_tools() -> List[Dict[str, Any]]:
    """MCP 서버에서 사용 가능한 도구 목록을 가져옵니다"""
    try:
        print("MCP 서버에서 도구 목록 조회 중...")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{MCP_ENDPOINT}/mcp/tools")
            
            if response.status_code == 200:
                tools = response.json()
                print(f"MCP 도구 목록 조회 완료: {len(tools)}개")
                return tools
            else:
                print(f"MCP 서버 응답 오류: HTTP {response.status_code}")
                return []
                
    except Exception as e:
        print(f"MCP 도구 목록 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return []

async def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    """MCP 서버의 도구를 실행합니다"""
    try:
        print(f"MCP 도구 실행 시작: {tool_name}")
        
        # MCP 서버 HTTP API 호출
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{MCP_ENDPOINT}/mcp/call", json={
                "tool": tool_name,
                "arguments": arguments
            })
            
            if response.status_code == 200:
                result = response.json()
                print(f"도구 {tool_name} 실행 완료")
                return result
            else:
                error_msg = f"MCP 서버 응답 오류: HTTP {response.status_code}"
                print(error_msg)
                return {"error": error_msg}
                
    except Exception as e:
        print(f"MCP 도구 실행 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# API 엔드포인트들
@app.get("/health")
async def health_check():
    """헬스체크"""
    return {"status": "healthy", "service": "MCP Gateway Backend"}

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

@app.post("/ask")
async def ask_agent(request: AskRequest) -> AskResponse:
    """LLM에 MCP tool을 등록하여 질문에 답변합니다"""
    try:
        print(f"에이전트 질문: {request.question}")
        
        # OpenAI 클라이언트 생성
        client = get_openai_client(request.api_key)
        
        # MCP 도구 목록 가져오기
        mcp_tools_raw = await get_mcp_tools()
        
        if not mcp_tools_raw:
            return AskResponse(
                answer="MCP 도구를 가져올 수 없습니다. 서버 상태를 확인해주세요.",
                tools_used=[]
            )
        
        # OpenAI tools 형식으로 변환
        mcp_tools = []
        for tool in mcp_tools_raw:
            mcp_tool = {
                "type": "function",
                "function": {
                    "name": tool["function"]["name"],
                    "description": tool["function"]["description"],
                    "parameters": tool["function"]["parameters"]
                }
            }
            mcp_tools.append(mcp_tool)
        
        print(f"MCP 도구 생성 완료: {len(mcp_tools)}개")
        
        # OpenAI API 호출 (MCP tools 등록)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",  # gpt-5가 없으면 gpt-4o-mini 사용
            messages=[{"role": "user", "content": request.question}],
            tools=mcp_tools,
            tool_choice="auto"
        )
        
        # 응답 처리
        message = completion.choices[0].message
        tools_used = []
        
        # 도구 호출이 있는 경우 처리
        mcp_calls = []  # MCP 호출 상세 정보 수집
        
        if message.tool_calls:
            # 모든 도구 호출을 처리하기 위한 메시지 배열
            messages = [
                {"role": "user", "content": request.question},
                message
            ]
            
            for tool_call in message.tool_calls:
                try:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)
                    tools_used.append(tool_name)
                    
                    print(f"도구 호출: {tool_name} - {tool_args}")
                    
                    # MCP 서버로 도구 실행
                    result = await call_mcp_tool(tool_name, tool_args)
                    
                    # MCP 호출 상세 정보 수집
                    mcp_call = {
                        "id": f"call_{len(mcp_calls) + 1}",
                        "action": tool_name,
                        "args": tool_args,
                        "response": result,
                        "timestamp": asyncio.get_event_loop().time(),
                        "status": "success" if "error" not in result else "error"
                    }
                    mcp_calls.append(mcp_call)
                    
                    # 도구 응답을 메시지 배열에 추가
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result)
                    })
                    
                    print(f"도구 {tool_name} 실행 완료")
                    
                except Exception as tool_error:
                    print(f"도구 {tool_name} 실행 실패: {tool_error}")
                    
                    # MCP 호출 실패 정보 수집
                    mcp_call = {
                        "id": f"call_{len(mcp_calls) + 1}",
                        "action": tool_name,
                        "args": tool_args,
                        "response": {"error": f"도구 실행 실패: {str(tool_error)}"},
                        "timestamp": asyncio.get_event_loop().time(),
                        "status": "error"
                    }
                    mcp_calls.append(mcp_call)
                    
                    # 도구 실행 실패 시 에러 응답을 메시지에 추가
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps({"error": f"도구 실행 실패: {str(tool_error)}"})
                    })
            
            try:
                # 모든 도구 응답을 포함하여 최종 답변 생성
                final_completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages
                )
                
                message = final_completion.choices[0].message
                print("최종 답변 생성 완료")
                
            except Exception as final_error:
                print(f"최종 답변 생성 실패: {final_error}")
                # 최종 답변 생성 실패 시 기본 메시지 사용
                message.content = f"도구 실행은 완료되었지만 최종 답변 생성에 실패했습니다. 에러: {str(final_error)}"
        
        return AskResponse(
            answer=message.content or "답변을 생성할 수 없습니다.",
            tools_used=tools_used,
            mcp_calls=mcp_calls
        )
        
    except Exception as e:
        print(f"에이전트 질문 처리 실패: {e}")
        import traceback
        traceback.print_exc()
        return AskResponse(
            answer=f"질문 처리 중 오류가 발생했습니다: {str(e)}",
            tools_used=[]
        )

if __name__ == "__main__":
    import uvicorn
    print("MCP Gateway Backend 시작...")
    uvicorn.run(app, host="0.0.0.0", port=9000) 