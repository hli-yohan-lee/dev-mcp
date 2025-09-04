import React, { useState } from 'react';
import { MCPCall } from '../types';

interface MCPIntegrationPageProps {
  apiKey: string;
  addDebugLog: (message: string) => void;
}

export const MCPIntegrationPage: React.FC<MCPIntegrationPageProps> = ({ apiKey, addDebugLog }) => {
  const [prompt, setPrompt] = useState("");
  const [mcpCalls, setMcpCalls] = useState<MCPCall[]>([]);
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // 3번 화면: MCP 통합 (AI + MCP 자동 연동)
  const handleCombinedGPT = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
    // 실행 시 모든 내역 초기화
    setMcpCalls([]);
    setResponse("");
    
    // API 키 검증
    const cleanApiKey = apiKey.trim();
    if (cleanApiKey.length < 10) {
      addDebugLog(`❌ API 키가 너무 짧습니다: ${cleanApiKey.length}자`);
      setResponse("❌ API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 입력해주세요.");
      return;
    }

    setPrompt("");
    setIsLoading(true);

    try {
      addDebugLog("🚀 MCP 통합 호출 시작 (AI + MCP 자동 연동)");
      
      // Gateway Backend의 /ask 엔드포인트 호출
      const requestData = {
        question: prompt,
        api_key: cleanApiKey
      };
      
      addDebugLog(`📤 Gateway Backend /ask 요청: ${JSON.stringify(requestData, null, 2)}`);
      
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
        addDebugLog(`✅ Gateway Backend 응답 수신`);
        
        // Gateway Backend 에러 응답 확인
        if (data.error) {
          addDebugLog(`❌ Gateway Backend 에러 응답 감지: ${JSON.stringify(data.error)}`);
          const errorMessage = `Gateway Backend 에러: ${data.error}`;
          
          setResponse(errorMessage);
          return;
        }
        
        // Gateway Backend 정상 응답 확인
        const hasAnswer = data.answer && data.answer.trim() !== "";
        
        if (!hasAnswer) {
          const emptyResponseMessage = "Gateway Backend에서 응답을 받았지만 내용이 비어있습니다. 다시 시도해주세요.";
          setResponse(emptyResponseMessage);
          return;
        }
        
        // 응답 처리
        const answerText = data.answer;
        const toolsUsed = data.tools_used || [];
        const mcpCallsData = data.mcp_calls || [];
        
        addDebugLog(`🤖 AI 어시스턴트 응답: ${answerText.substring(0, 100)}...`);
        addDebugLog(`🔧 사용된 도구: ${toolsUsed.join(', ')}`);
        addDebugLog(`📊 MCP 호출 수: ${mcpCallsData.length}개`);
        
        // MCP 호출 내역을 mcpCalls 상태에 추가
        addDebugLog(`📊 MCP 호출 수신: ${mcpCallsData.length}개`);
        if (mcpCallsData.length > 0) {
          const newMcpCalls = mcpCallsData.map((call: any) => ({
            id: call.id || Date.now().toString(),
            action: call.action,
            args: call.args,
            response: call.response,
            timestamp: new Date().toISOString(),
            status: call.status
          }));
          
          addDebugLog(`✅ MCP 호출 내역 상태 업데이트: ${JSON.stringify(newMcpCalls, null, 2)}`);
          setMcpCalls(prev => [...newMcpCalls, ...prev]);
        } else {
          addDebugLog(`⚠️ MCP 호출 내역이 비어있음 - OpenAI가 도구를 호출하지 않았을 가능성`);
        }
        
        // 응답을 상태에 저장하고 스트리밍으로 표시
        setResponse('');
        let currentText = "";
        for (let i = 0; i < answerText.length; i++) {
          currentText += answerText[i];
          setResponse(currentText);
          await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
        }
        
        // 단순한 응답으로 설정
        setResponse(`사용된 도구: ${toolsUsed.join(', ')}\n\n답변: ${answerText}`);
        
        addDebugLog(`✅ MCP 통합 완료 - AI 어시스턴트 응답 생성됨`);
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
        
        setResponse(errorMessage);
      }
    } catch (error: any) {
      addDebugLog(`💥 MCP 통합 에러: ${error.message}`);
      setResponse(`💻 에러가 발생했습니다: ${error.message}`);
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
            onClick={handleCombinedGPT}
            disabled={isLoading || !prompt.trim() || !apiKey.trim()}
          >
            {isLoading ? "처리 중..." : "질문 시작"}
          </button>
        </div>

        {/* 두 번째: 응답 */}
        <div className="response-section">
          <div className="response-content">
            {response && (
              <div className="response-text">
                <pre>{response}</pre>
              </div>
            )}
          </div>
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
                    <span className="args-preview">{JSON.stringify(call.args).substring(0, 120)}...</span>
                    <span className="timestamp">{new Date(call.timestamp).toLocaleTimeString()}</span>
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
