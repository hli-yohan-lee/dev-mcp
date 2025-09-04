from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import json
import asyncio
import httpx
from openai import OpenAI

app = FastAPI(title="MCP Gateway Backend", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MCP 서버 엔드포인트
MCP_ENDPOINT = "http://localhost:9001"

# OpenAI 클라이언트 (API 키는 요청에서 받음)
def get_openai_client(api_key: str) -> OpenAI:
    import httpx
    
    # SSL 검증 비활성화한 httpx 클라이언트 생성
    http_client = httpx.Client(verify=False)
    
    return OpenAI(
        api_key=api_key,
        http_client=http_client
    )

async def get_mcp_tools() -> List[Dict[str, Any]]:
    """MCP 서버에서 사용 가능한 도구 목록을 가져옵니다 (JSON-RPC 2.0)"""
    try:
        print("MCP 서버에서 도구 목록 조회 중 (JSON-RPC)...")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # JSON-RPC 2.0 요청
            jsonrpc_request = {
                "jsonrpc": "2.0",
                "method": "tools/list",
                "params": {},
                "id": 1
            }
            
            # JSON-RPC 엔드포인트로 시도
            try:
                response = await client.post(f"{MCP_ENDPOINT}/", json=jsonrpc_request)
                
                if response.status_code == 200:
                    jsonrpc_response = response.json()
                    
                    if "error" in jsonrpc_response:
                        print(f"JSON-RPC 에러: {jsonrpc_response['error']}")
                        # 레거시 REST API로 폴백
                        response = await client.get(f"{MCP_ENDPOINT}/mcp/tools")
                        if response.status_code == 200:
                            tools = response.json()
                            print(f"MCP 도구 목록 조회 완료 (REST): {len(tools)}개")
                            return tools
                    else:
                        # JSON-RPC 응답에서 도구 추출
                        tools_data = jsonrpc_response.get("result", {}).get("tools", [])
                        # OpenAI 형식으로 변환
                        openai_tools = []
                        for tool in tools_data:
                            openai_tool = {
                                "type": "function",
                                "function": {
                                    "name": tool["name"],
                                    "description": tool["description"],
                                    "parameters": tool.get("inputSchema", tool.get("parameters", {}))
                                }
                            }
                            openai_tools.append(openai_tool)
                        print(f"MCP 도구 목록 조회 완료 (JSON-RPC): {len(openai_tools)}개")
                        return openai_tools
            except:
                # JSON-RPC 실패 시 레거시 REST API 사용
                response = await client.get(f"{MCP_ENDPOINT}/mcp/tools")
                if response.status_code == 200:
                    tools = response.json()
                    print(f"MCP 도구 목록 조회 완료 (REST fallback): {len(tools)}개")
                    return tools
                    
        return []
                
    except Exception as e:
        print(f"MCP 도구 목록 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return []

async def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    """MCP 서버의 도구를 실행합니다 (JSON-RPC 2.0)"""
    try:
        print(f"MCP 도구 실행 시작 (JSON-RPC): {tool_name}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # JSON-RPC 2.0 요청
            jsonrpc_request = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                },
                "id": f"call_{tool_name}_{asyncio.get_event_loop().time()}"
            }
            
            # JSON-RPC 엔드포인트로 시도
            try:
                response = await client.post(f"{MCP_ENDPOINT}/", json=jsonrpc_request)
                
                if response.status_code == 200:
                    jsonrpc_response = response.json()
                    
                    if "error" in jsonrpc_response:
                        print(f"JSON-RPC 에러: {jsonrpc_response['error']}")
                        # 레거시 REST API로 폴백
                        response = await client.post(f"{MCP_ENDPOINT}/mcp/call", json={
                            "tool": tool_name,
                            "arguments": arguments
                        })
                        if response.status_code == 200:
                            result = response.json()
                            print(f"도구 {tool_name} 실행 완료 (REST fallback)")
                            return result
                    else:
                        # JSON-RPC 응답 처리
                        result_data = jsonrpc_response.get("result", {})
                        # content 배열이 있으면 텍스트 추출
                        if "content" in result_data:
                            content = result_data["content"]
                            if content and len(content) > 0:
                                text = content[0].get("text", "")
                                try:
                                    return json.loads(text)
                                except:
                                    return {"data": text}
                        print(f"도구 {tool_name} 실행 완료 (JSON-RPC)")
                        return result_data
            except:
                # JSON-RPC 실패 시 레거시 REST API 사용
                response = await client.post(f"{MCP_ENDPOINT}/mcp/call", json={
                    "tool": tool_name,
                    "arguments": arguments
                })
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"도구 {tool_name} 실행 완료 (REST fallback)")
                    return result
                    
            error_msg = f"MCP 서버 응답 오류"
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
async def ask_agent(request: dict) -> Dict[str, Any]:
    """LLM에 MCP tool을 등록하여 질문에 답변합니다"""
    try:
        # request를 dict로 받아서 mode 확인
        mode = request.get("mode", "default")
        question = request.get("question", "")
        api_key = request.get("api_key", "")
        
        print(f"에이전트 질문: {question} (모드: {mode})")
        
        # 2step 모드 처리
        if mode == "2step":
            print("2 STEP 모드 - Planner 실행")
            
            # OpenAI 클라이언트 생성
            client = get_openai_client(api_key)
            
            # MCP 도구 목록 가져오기
            mcp_tools_raw = await get_mcp_tools()
            
            if not mcp_tools_raw:
                return {
                    "mode": "2step",
                    "error": "MCP 도구를 가져올 수 없습니다.",
                    "tool_calls": []
                }
            
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
            
            # Planner 실행 - 도구 선택만 하도록
            planner_prompt = f"""사용자 질문을 분석하여 필요한 MCP 도구들을 선택하세요.

사용 가능한 도구:
1. read_pdf - PDF 파일 읽기
2. query_database - 데이터베이스 조회
3. github_repository_info - GitHub 저장소 정보 조회
4. system_health - 시스템 상태 확인

사용자 질문: {question}

필요한 도구들을 선택하여 호출하세요."""
            
            # OpenAI API 호출 (도구 선택)
            completion = client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": "당신은 MCP 도구를 선택하는 Planner입니다. 사용자 질문에 답하기 위해 필요한 도구들을 선택하세요."},
                    {"role": "user", "content": planner_prompt}
                ],
                tools=mcp_tools,
                tool_choice="required"  # 반드시 도구 호출
            )
            
            # tool_calls 추출
            message = completion.choices[0].message
            tool_calls = []
            
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)
                    
                    tool_calls.append({
                        "tool_name": tool_name,  # 이 키가 중요!
                        "parameters": tool_args
                    })
                    
                    print(f"Planner 도구 선택: {tool_name} - {tool_args}")
            
            return {
                "mode": "2step",
                "tool_calls": tool_calls,
                "planner_response": f"MCP 도구 호출 계획을 수립했습니다. {len(tool_calls)}개의 도구를 호출할 예정입니다."
            }
        
        # worker 모드 처리
        elif mode == "worker":
            print("Worker 모드 - MCP 결과로 최종 답변 생성")
            
            # OpenAI 클라이언트 생성
            client = get_openai_client(api_key)
            
            mcp_results = request.get("mcp_results", [])
            
            # MCP 결과를 텍스트로 변환
            results_text = "MCP 도구 실행 결과:\n\n"
            for result in mcp_results:
                tool_name = result.get("tool", "unknown")
                tool_result = result.get("result", {})
                results_text += f"도구: {tool_name}\n결과: {json.dumps(tool_result, ensure_ascii=False, indent=2)}\n\n"
            
            # 최종 답변 생성
            completion = client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": "당신은 MCP 도구 실행 결과를 바탕으로 사용자 질문에 답변하는 Worker입니다."},
                    {"role": "user", "content": f"다음 MCP 도구 실행 결과를 바탕으로 사용자 질문에 답변하세요.\n\n{results_text}\n\n사용자 질문: {question}"}
                ]
            )
            
            return {
                "answer": completion.choices[0].message.content,
                "mode": "worker"
            }
        
        # 기본 모드 (3번 화면용)
        # OpenAI 클라이언트 생성
        client = get_openai_client(api_key)
        
        # MCP 도구 목록 가져오기
        mcp_tools_raw = await get_mcp_tools()
        
        if not mcp_tools_raw:
            return {
                "answer": "MCP 도구를 가져올 수 없습니다. 서버 상태를 확인해주세요.",
                "tools_used": [],
                "mcp_calls": []
            }
        
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
            model="gpt-5-mini",  # gpt-5-mini 모델 사용
            messages=[
                {
                    "role": "system", 
                    "content": "당신은 MCP(Model Context Protocol) 도구를 활용하는 AI 어시스턴트입니다. 사용자 질문에 답하기 위해 가능한 한 제공된 MCP 도구들을 적극적으로 활용하세요. 특히 파일 읽기, 데이터베이스 조회, GitHub 정보 등이 필요한 질문에는 반드시 해당 도구를 사용해야 합니다."
                },
                {"role": "user", "content": question}
            ],
            tools=mcp_tools,
            tool_choice="required"  # 반드시 도구 호출하도록 강제
        )
        
        # 응답 처리
        message = completion.choices[0].message
        tools_used = []
        
        # 도구 호출이 있는 경우 처리
        mcp_calls = []  # MCP 호출 상세 정보 수집
        
        if message.tool_calls:
            # 모든 도구 호출을 처리하기 위한 메시지 배열
            messages = [
                {"role": "user", "content": question},
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
                final_client = get_openai_client(api_key)  # SSL 설정이 적용된 클라이언트 사용
                final_completion = final_client.chat.completions.create(
                    model="gpt-5-mini",
                    messages=messages
                )
                
                message = final_completion.choices[0].message
                print("최종 답변 생성 완료")
                
            except Exception as final_error:
                print(f"최종 답변 생성 실패: {final_error}")
                # 최종 답변 생성 실패 시 기본 메시지 사용
                message.content = f"도구 실행은 완료되었지만 최종 답변 생성에 실패했습니다. 에러: {str(final_error)}"
        
        return {
            "answer": message.content or "답변을 생성할 수 없습니다.",
            "tools_used": tools_used,
            "mcp_calls": mcp_calls
        }
        
    except Exception as e:
        print(f"에이전트 질문 처리 실패: {e}")
        import traceback
        traceback.print_exc()
        return {
            "answer": f"질문 처리 중 오류가 발생했습니다: {str(e)}",
            "tools_used": [],
            "mcp_calls": []
        }

if __name__ == "__main__":
    import uvicorn
    print("MCP Gateway Backend 시작...")
    uvicorn.run(app, host="0.0.0.0", port=9000)
