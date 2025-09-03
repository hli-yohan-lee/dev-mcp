import React, { useState } from 'react';
import { MCPCall, ResponseTabType } from '../types';

interface TwoStepTestPageProps {
  apiKey: string;
  addDebugLog: (message: string) => void;
  githubToken: string;
}

export const TwoStepTestPage: React.FC<TwoStepTestPageProps> = ({ apiKey, addDebugLog, githubToken }) => {
  const [prompt, setPrompt] = useState("400자 이내로 대답해줘.\n백엔드 개발할수 있는 사람들한테 교육을 하려고 해.\n어떤 내용을 어느 파일에서 교육해야 되는지 알려줘.\n대상자들은 누가 되어야 되는지도.");
  const [mcpCalls, setMcpCalls] = useState<MCPCall[]>([]);
  const [plannerResponse, setPlannerResponse] = useState<string>('');
  const [workerResponse, setWorkerResponse] = useState<string>('');
  const [activeResponseTab, setActiveResponseTab] = useState<ResponseTabType>('planner');
  const [isLoading, setIsLoading] = useState(false);

  // MCP 도구 실행 함수 (공통)
  const executeMcpTools = async (toolCalls: any[], userPrompt: string, apiKey: string) => {
    addDebugLog(`🚀 MCP 도구 실행 시작 - ${toolCalls.length}개 도구`);
    setWorkerResponse("MCP 도구들을 실행하고 있습니다...");
    
    try {
      const mcpResults = [];
      
      for (const toolCall of toolCalls) {
        const toolName = toolCall.tool_name || toolCall.tool || toolCall.function?.name || toolCall.name;
        const toolArgs = toolCall.parameters || toolCall.function?.arguments || toolCall.arguments;
        
        // toolName이 undefined인 경우 처리
        if (!toolName) {
          addDebugLog(`❌ MCP 도구 이름이 undefined입니다: ${JSON.stringify(toolCall)}`);
          continue; // 다음 도구로 건너뛰기
        }
        
        addDebugLog(`🔧 MCP 도구 실행: ${toolName} - ${JSON.stringify(toolArgs)}`);
        
        // MCP 표준 도구 이름에서 functions. 접두사 제거
        const cleanToolName = toolName.replace('functions.', '');
        addDebugLog(`🔗 MCP 도구 실행: ${toolName} → ${cleanToolName}`);
        
        // toolArgs가 undefined인 경우 빈 객체로 처리
        let safeToolArgs = toolArgs || {};
        
        // GitHub 도구인 경우 사용자명과 토큰을 실제 값으로 대체
        if (cleanToolName === "github_repository_info") {
          safeToolArgs = {
            ...safeToolArgs,
            username: "hli.yohan.lee",
            password: githubToken
          };
          addDebugLog(`🔧 GitHub 도구 - 사용자명: hli.yohan.lee, 토큰: ${githubToken ? '설정됨' : '설정되지 않음'}`);
        }
        
        // MCP 표준 엔드포인트로 도구 실행
        const mcpResponse = await fetch(`http://localhost:9001/mcp/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: cleanToolName,
            arguments: safeToolArgs
          }),
        });
        
        if (mcpResponse.ok) {
          const mcpData = await mcpResponse.json();
          addDebugLog(`✅ MCP 도구 실행 성공: ${toolName}`);
          addDebugLog(`📊 응답 데이터: ${JSON.stringify(mcpData, null, 2)}`);
          
          // MCP 호출 결과를 mcpCalls 상태에 추가
          const mcpCall: MCPCall = {
            id: Date.now().toString(),
            action: cleanToolName,
            args: safeToolArgs,
            response: mcpData,
            timestamp: new Date().toISOString(),
            status: mcpData.error ? "error" : "success"
          };
          setMcpCalls(prev => [mcpCall, ...prev]);
          
          mcpResults.push({
            tool: toolName,
            args: safeToolArgs,
            result: mcpData
          });
        } else {
          addDebugLog(`❌ MCP 도구 실행 실패: ${toolName} - ${mcpResponse.status}`);
          const errorText = await mcpResponse.text();
          addDebugLog(`❌ 에러 응답: ${errorText}`);
          
          // MCP 호출 실패도 mcpCalls 상태에 추가
          const mcpCall: MCPCall = {
            id: Date.now().toString(),
            action: cleanToolName,
            args: safeToolArgs,
            response: { error: `HTTP ${mcpResponse.status}: ${errorText}` },
            timestamp: new Date().toISOString(),
            status: "error"
          };
          setMcpCalls(prev => [mcpCall, ...prev]);
          
          mcpResults.push({
            tool: toolName,
            args: safeToolArgs,
            result: { error: `HTTP ${mcpResponse.status}` }
          });
        }
      }
      
      // MCP 결과를 GPT에게 전달해서 Worker가 최종 답변 생성
      addDebugLog(`🤖 Worker 실행 시작 - MCP 결과와 함께 최종 답변 생성`);
      
      const workerRequestData = {
        question: userPrompt,
        api_key: apiKey,
        mode: "worker",
        mcp_results: mcpResults
      };
      
      addDebugLog(`📤 Worker 요청 데이터: ${JSON.stringify(workerRequestData, null, 2)}`);
      
      const workerResponse = await fetch("http://localhost:9000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workerRequestData),
      });
      
      if (workerResponse.ok) {
        const workerData = await workerResponse.json();
        
        if (workerData.error) {
          setWorkerResponse(`❌ Worker 에러: ${workerData.error}`);
          return;
        }
        
        // Worker 응답을 스트리밍으로 표시
        const workerText = workerData.answer || workerData.worker_response || "Worker 응답이 비어있습니다.";
        setWorkerResponse('');
        let currentWorkerText = "";
        
        for (let i = 0; i < workerText.length; i++) {
          currentWorkerText += workerText[i];
          setWorkerResponse(currentWorkerText);
          await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
        }
        
        addDebugLog(`✅ Worker 최종 답변 스트리밍 완료 - ${workerText.length}자`);
      } else {
        setWorkerResponse(`❌ Worker HTTP 에러: ${workerResponse.status}`);
      }
      
    } catch (mcpError: any) {
      addDebugLog(`💥 MCP 도구 실행 에러: ${mcpError.message}`);
      setWorkerResponse(`❌ MCP 도구 실행 실패: ${mcpError.message}`);
    }
  };

  // 4번 화면: 2 STEP 테스트 (Step-by-step 모드)
  const handle2StepGPT = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
    // 현재 프롬프트 내용을 저장 (초기화 전에)
    const currentPrompt = prompt.trim();
    
    // API 키 검증
    const cleanApiKey = apiKey.trim();
    if (cleanApiKey.length < 10) {
      addDebugLog(`❌ API 키가 너무 짧습니다: ${cleanApiKey.length}자`);
      setPlannerResponse("❌ API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 입력해주세요.");
      return;
    }

    // 프롬프트 초기화
    setPrompt("");
    
    // 실행 시 모든 내역 초기화
    setMcpCalls([]);
    setPlannerResponse("");
    setWorkerResponse("");
    setIsLoading(true);

    try {
      addDebugLog("🚀 2 STEP 테스트 시작 (Step-by-step 모드)");
      
      // 1단계: MCP 서버에서 실제 도구 명세 가져오기
      addDebugLog(`🔍 MCP 서버에서 도구 명세 가져오기 시작`);
      
      try {
        const schemaResponse = await fetch("http://localhost:9001/mcp/tools", {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });
        
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          addDebugLog(`✅ MCP 서버 스키마 응답 수신: ${JSON.stringify(schemaData).substring(0, 200)}...`);
          
          // 스키마 데이터를 읽기 쉬운 형태로 변환
          if (schemaData && Array.isArray(schemaData)) {
            addDebugLog(`✅ MCP 도구 정보 파싱 완료 - ${schemaData.length}개 도구`);
          } else {
            addDebugLog(`⚠️ MCP 서버 스키마 응답 형식이 예상과 다름`);
          }
        } else {
          addDebugLog(`❌ MCP 서버 스키마 요청 실패: ${schemaResponse.status}`);
        }
      } catch (schemaError: any) {
        addDebugLog(`💥 MCP 서버 스키마 요청 에러: ${schemaError.message}`);
      }
      
      // 2단계: Gateway Backend의 /ask 엔드포인트 호출 (2 STEP 모드)
      const requestData = {
        question: `당신은 MCP(Microservice Communication Protocol) 시스템의 Planner입니다. 사용자의 질문을 분석하여 필요한 MCP 도구들을 정확한 형식으로 호출하는 계획을 수립해야 합니다.

## 📝 현재 질문
${currentPrompt}

위 질문에 답하기 위해 필요한 MCP 도구들을 정확한 tool_calls 형식으로 반환하세요.`,
        api_key: cleanApiKey,
        mode: "2step", // 2 STEP 모드 지정
        model: "gpt-5-mini", // GPT-5-mini 모델 사용
        response_format: "json_object", // JSON 형태로 강제
        functions: [ // Function Calling으로 JSON 구조 강제
          {
            name: "execute_mcp_tools",
            description: "MCP 도구들을 실행하는 계획을 JSON 형태로 반환",
            parameters: {
              type: "object",
              required: ["tool_calls"],
              properties: {
                tool_calls: {
                  type: "array",
                  description: "실행할 MCP 도구들의 목록",
                  items: {
                    type: "object",
                    required: ["tool_name", "parameters"],
                    properties: {
                      tool_name: {
                        type: "string",
                        description: "실행할 MCP 도구의 이름"
                      },
                      parameters: {
                        type: "object",
                        description: "도구 실행에 필요한 파라미터들"
                      }
                    }
                  }
                }
              }
            }
          }
        ],
        function_call: { name: "execute_mcp_tools" } // 이 함수만 호출하도록 강제
      };
      
      addDebugLog(`📤 Gateway Backend /ask 요청 (2 STEP): ${JSON.stringify(requestData, null, 2)}`);
      
      const response = await fetch("http://localhost:9000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      addDebugLog(`📡 HTTP 응답 상태: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        addDebugLog(`✅ Gateway Backend 응답 수신 (2 STEP)`);
        
        // Gateway Backend 에러 응답 확인
        if (data.error) {
          addDebugLog(`❌ Gateway Backend 에러 응답 감지: ${JSON.stringify(data.error)}`);
          const errorMessage = `Gateway Backend 에러: ${data.error}`;
          
          setPlannerResponse(errorMessage);
          return;
        }
        
        // 2 STEP 모드 응답 처리
        if (data.mode === "2step") {
          addDebugLog(`🧠 2 STEP 모드 감지 - Planner 계획 수신`);
          
          // 1단계: Planner 응답 처리 (MCP 도구 호출 계획)
          if (data.tool_calls && data.tool_calls.length > 0) {
            addDebugLog(`🔧 tool_calls 감지 - MCP 도구 호출 계획`);
            
            // tool_calls를 읽기 쉬운 형태로 변환
            const toolCallsText = data.tool_calls.map((tool: any, index: number) => {
              const toolName = tool.tool_name || tool.tool || tool.function?.name || tool.name || 'unknown';
              const toolArgs = tool.parameters || tool.function?.arguments || tool.arguments || '{}';
              return `${index + 1}. ${toolName} - ${JSON.stringify(toolArgs)}`;
            }).join('\n');
            
            const plannerText = `MCP 도구 호출 계획:\n\n${toolCallsText}`;
            setPlannerResponse('');
            let currentPlannerText = "";
            
            for (let i = 0; i < plannerText.length; i++) {
              currentPlannerText += plannerText[i];
              setPlannerResponse(currentPlannerText);
              await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
            }
            
            addDebugLog(`✅ Planner MCP 도구 계획 스트리밍 완료 - ${toolCallsText.length}자`);
            
            // Planner 완료 후 자동으로 Worker 탭으로 이동
            setActiveResponseTab('worker');
            
            // 2단계: 실제 MCP 도구들 호출
            await executeMcpTools(data.tool_calls, currentPrompt, cleanApiKey);
            
          } else if (data.planner_response) {
            // 기존 planner_response가 있는 경우
            addDebugLog(`📋 Planner 계획 수신 - 스트리밍 시작`);
            
            const plannerText = data.planner_response;
            setPlannerResponse('');
            let currentPlannerText = "";
            
            for (let i = 0; i < plannerText.length; i++) {
              currentPlannerText += plannerText[i];
              setPlannerResponse(currentPlannerText);
              await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
            }
            
            addDebugLog(`✅ Planner 계획 스트리밍 완료 - ${plannerText.length}자`);
            
            // Planner 완료 후 자동으로 Worker 탭으로 이동
            setActiveResponseTab('worker');
          }
          
          // 2단계: MCP 도구 실행 결과 처리 (기존 mcp_calls가 있는 경우)
          const mcpCallsData = data.mcp_calls || [];
          if (mcpCallsData.length > 0) {
            addDebugLog(`🔧 기존 MCP 도구 실행 결과 수신 - ${mcpCallsData.length}개 도구`);
            
            const newMcpCalls = mcpCallsData.map((call: any) => ({
              id: call.id || Date.now().toString(),
              action: call.action,
              args: call.args,
              response: call.response,
              timestamp: new Date().toISOString(),
              status: call.status
            }));
            
            setMcpCalls(prev => [...newMcpCalls, ...prev]);
          }
          
          addDebugLog(`✅ 2 STEP 테스트 완료 - Planner 계획 → MCP 실행 → Worker 답변`);
        } else {
          // 일반 응답 처리 (2 STEP 모드가 아닌 경우)
          addDebugLog(`⚠️ 일반 응답 모드 - 2 STEP 모드가 아님`);
          const answerText = data.answer || "응답을 받았지만 내용이 비어있습니다.";
          
          // JSON 추출 시도
          try {
            // "일반 응답:" 같은 텍스트 제거하고 JSON만 추출
            const jsonMatch = answerText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonText = jsonMatch[0];
              const parsedData = JSON.parse(jsonText);
              
              if (parsedData.tool_calls && parsedData.tool_calls.length > 0) {
                addDebugLog(`🔧 JSON에서 tool_calls 추출 성공 - ${parsedData.tool_calls.length}개`);
                
                // tool_calls를 읽기 쉬운 형태로 변환
                const toolCallsText = parsedData.tool_calls.map((tool: any, index: number) => {
                  const toolName = tool.tool_name || tool.tool || tool.function?.name || tool.name || 'unknown';
                  const toolArgs = tool.parameters || tool.function?.arguments || tool.arguments || '{}';
                  return `${index + 1}. ${toolName} - ${JSON.stringify(toolArgs)}`;
                }).join('\n');
                
                const plannerText = `MCP 도구 호출 계획:\n\n${toolCallsText}`;
                setPlannerResponse('');
                let currentPlannerText = "";
                
                for (let i = 0; i < plannerText.length; i++) {
                  currentPlannerText += plannerText[i];
                  setPlannerResponse(currentPlannerText);
                  await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
                }
                
                addDebugLog(`✅ Planner MCP 도구 계획 스트리밍 완료 - ${toolCallsText.length}자`);
                
                // Planner 완료 후 자동으로 Worker 탭으로 이동
                setActiveResponseTab('worker');
                
                // MCP 도구 실행
                await executeMcpTools(parsedData.tool_calls, currentPrompt, cleanApiKey);
              } else {
                setPlannerResponse(answerText);
              }
            } else {
              // JSON이 없는 경우, 텍스트에서 tool_calls 정보 추출 시도
              addDebugLog(`🔍 JSON이 없음 - 텍스트에서 tool_calls 정보 추출 시도`);
              
              // "functions.xxx - {...}" 패턴 찾기
              const toolCallMatches = answerText.match(/functions\.\w+ - \{[\s\S]*?\}/g);
              if (toolCallMatches && toolCallMatches.length > 0) {
                addDebugLog(`🔧 텍스트에서 tool_calls 패턴 발견 - ${toolCallMatches.length}개`);
                
                const extractedToolCalls = toolCallMatches.map((match: string) => {
                  // "functions.read_pdf - {"filename":"백엔드_가이드.pdf"}" 형태 파싱
                  const toolMatch = match.match(/functions\.(\w+) - (\{[\s\S]*\})/);
                  if (toolMatch) {
                    const toolName = `functions.${toolMatch[1]}`;
                    const parameters = JSON.parse(toolMatch[2]);
                    return {
                      tool_name: toolName,
                      parameters: parameters
                    };
                  }
                  return null;
                }).filter((tool: any) => tool !== null);
                
                if (extractedToolCalls.length > 0) {
                  addDebugLog(`✅ 텍스트에서 tool_calls 추출 성공 - ${extractedToolCalls.length}개`);
                  
                  // tool_calls를 읽기 쉬운 형태로 변환
                  const toolCallsText = extractedToolCalls.map((tool: any, index: number) => {
                    return `${index + 1}. ${tool.tool_name} - ${JSON.stringify(tool.parameters)}`;
                  }).join('\n');
                  
                  const plannerText = `MCP 도구 호출 계획:\n\n${toolCallsText}`;
                  setPlannerResponse('');
                  let currentPlannerText = "";
                  
                  for (let i = 0; i < plannerText.length; i++) {
                    currentPlannerText += plannerText[i];
                    setPlannerResponse(currentPlannerText);
                    await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
                  }
                  
                  addDebugLog(`✅ Planner MCP 도구 계획 스트리밍 완료 - ${toolCallsText.length}자`);
                  
                  // Planner 완료 후 자동으로 Worker 탭으로 이동
                  setActiveResponseTab('worker');
                  
                  // MCP 도구 실행
                  await executeMcpTools(extractedToolCalls, currentPrompt, cleanApiKey);
                } else {
                  setPlannerResponse(answerText);
                }
              } else {
                setPlannerResponse(answerText);
              }
            }
          } catch (jsonError: any) {
            addDebugLog(`💥 JSON 파싱 에러: ${jsonError.message}`);
            setPlannerResponse(answerText);
          }
        }
      } else {
        // HTTP 에러 처리
        let errorMessage = "";
        switch (response.status) {
          case 400:
            errorMessage = "잘못된 요청입니다. 입력 내용을 확인해주세요.";
            break;
          case 401:
            errorMessage = "API 키가 유효하지 않습니다. API 키를 확인해주세요.";
            break;
          case 403:
            errorMessage = "API 사용 권한이 없습니다. API 키 권한을 확인해주세요.";
            break;
          case 429:
            errorMessage = "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
            break;
          case 500:
            errorMessage = "Gateway Backend 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            break;
          default:
            errorMessage = `HTTP 오류 (${response.status})`;
        }
        
        setPlannerResponse(errorMessage);
      }
    } catch (error: any) {
      addDebugLog(`💥 2 STEP 테스트 에러: ${error.message}`);
      setPlannerResponse(`💻 에러가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tab-content">
      <div className="three-section-layout">
        {/* 첫 번째: 질문 입력 */}
        <div className="input-section">
          <textarea
            className="input-textarea"
            placeholder="질문을 입력하세요..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
          />
          <button 
            className="submit-button" 
            onClick={handle2StepGPT}
            disabled={isLoading || !prompt.trim() || !apiKey.trim()}
          >
            {isLoading ? "처리 중..." : "질문 시작"}
          </button>
        </div>

        {/* 두 번째: Planner/Worker 응답 */}
        <div className="response-section">
          <div className="response-tabs">
            <button 
              className={`tab-button ${activeResponseTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveResponseTab('planner')}
            >
              Planner
            </button>
            <button 
              className={`tab-button ${activeResponseTab === 'worker' ? 'active' : ''}`}
              onClick={() => setActiveResponseTab('worker')}
            >
              Worker
            </button>
          </div>

          {/* Planner 응답 */}
          {activeResponseTab === 'planner' && (
            <div className="tab-content">
              <div className="response-content">
                {plannerResponse && (
                  <div className="response-text">
                    <pre>{plannerResponse}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Worker 응답 */}
          {activeResponseTab === 'worker' && (
            <div className="tab-content">
              <div className="response-content">
                {workerResponse && (
                  <div className="response-text">
                    <pre>{workerResponse}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 세 번째: MCP 호출 내역 */}
        <div className="mcp-calls-section">
          <div className="mcp-calls-container">
            {mcpCalls.length === 0 ? (
              <div className="empty-state">
                <p>아직 MCP 호출이 없습니다.</p>
              </div>
            ) : (
              mcpCalls.map((call) => (
                <div key={call.id} className={`mcp-call ${call.status}`}>
                  <div className="call-header">
                    <span className="action-badge">{call.action}</span>
                    <span className="status-badge">{call.status}</span>
                    <span className="timestamp">{new Date(call.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="call-preview">
                    <strong>Args:</strong> {JSON.stringify(call.args).substring(0, 100)}...
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 