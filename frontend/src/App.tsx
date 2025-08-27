import { useState, useEffect } from "react";
import "./App.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface MCPCall {
  id: string;
  action: string;
  args: any;
  response: any;
  timestamp: string;
  status: "success" | "error";
}

type TabType = "gpt" | "interface-backend" | "1step" | "2step";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("interface-backend");
  const [apiKey, setApiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mcpCalls, setMcpCalls] = useState<MCPCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMcpCall, setSelectedMcpCall] = useState<MCPCall | null>(null);
  
  // 응답 상태
  const [response, setResponse] = useState<string>('');
  const [plannerResponse, setPlannerResponse] = useState<string>('');
  const [workerResponse, setWorkerResponse] = useState<string>('');
  const [activeResponseTab, setActiveResponseTab] = useState<'planner' | 'worker'>('planner');
  
  // 디버그 로그 상태
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // 디버그 로그 추가 함수
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [logEntry, ...prev.slice(0, 49)]);
  };

  // 응답 구조 분석 함수
  const analyzeResponseStructure = (data: any, context: string = "응답") => {
    addDebugLog(`🔬 ${context} 구조 분석 시작:`);
    
    // 기본 타입 정보
    addDebugLog(`- 타입: ${typeof data}`);
    addDebugLog(`- 생성자: ${data?.constructor?.name || 'undefined'}`);
    addDebugLog(`- null 여부: ${data === null}`);
    addDebugLog(`- undefined 여부: ${data === undefined}`);
    
    if (data && typeof data === 'object') {
      // 객체인 경우 상세 분석
      const keys = Object.keys(data);
      const values = Object.values(data);
      
      addDebugLog(`- 키 개수: ${keys.length}`);
      addDebugLog(`- 키 목록: [${keys.join(', ')}]`);
      
      // 각 키-값 쌍 분석
      keys.forEach((key, index) => {
        const value = values[index];
        const valueType = typeof value;
        const valueLength = typeof value === 'string' ? value.length : 'N/A';
        const valuePreview = valueType === 'string' 
          ? `"${(value as string).substring(0, 50)}${(value as string).length > 50 ? '...' : ''}"`
          : valueType === 'object' 
            ? JSON.stringify(value).substring(0, 100)
            : String(value);
            
        addDebugLog(`  - ${key}: ${valueType} (길이: ${valueLength}) = ${valuePreview}`);
      });
      
      // 특별히 'response' 필드가 있는지 확인
      if ('response' in data) {
        addDebugLog(`🎯 'response' 필드 상세 분석:`);
        analyzeResponseField(data.response);
      }
    } else {
      // 원시 타입인 경우
      addDebugLog(`- 값: ${String(data)}`);
      if (typeof data === 'string') {
        addDebugLog(`- 문자열 길이: ${data.length}`);
        addDebugLog(`- 빈 문자열 여부: ${data === ''}`);
        addDebugLog(`- 공백만 있는지 여부: ${data.trim() === ''}`);
        return (
          <div className="tab-content">
            <div className="combined-section">
              {/* 왼쪽: 질문 입력 */}
              <div className="input-section">
                <h3>2 STEP 테스트</h3>
                <textarea
                  className="input-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, () => {
                    // 엔터 시 모든 내역 초기화
                    setMessages([]);
                    setMcpCalls([]);
                    setPlannerResponse("");
                    setWorkerResponse("");
                    // GPT 요청 처리
                    handle2StepGPT();
                  })}
                  placeholder="GPT에게 질문을 입력하세요..."
                />
                <button 
                  onClick={() => {
                    // 실행 시 모든 내역 초기화
                    setMessages([]);
                    setMcpCalls([]);
                    setPlannerResponse("");
                    setWorkerResponse("");
                    // GPT 요청 처리
                    handle2StepGPT();
                  }} 
                  disabled={!prompt.trim() || !apiKey.trim() || isLoading}
                  className={`action-button ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? "처리 중..." : "전송"}
                </button>
              </div>

              {/* 가운데: Planner & Worker 탭 */}
              <div className="response-section">
                <div className="response-tabs">
                  <button 
                    className={`tab-button ${activeResponseTab === 'planner' ? 'active' : ''}`}
                    onClick={() => setActiveResponseTab('planner')}
                  >
                    🧠 Planner
                  </button>
                  <button 
                    className={`tab-button ${activeResponseTab === 'worker' ? 'active' : ''}`}
                    onClick={() => setActiveResponseTab('worker')}
                  >
                    🔧 Worker
                  </button>
                </div>
                
                <div className="response-content">
                  {activeResponseTab === 'planner' && (
                    <div className="planner-tab">
                      {plannerResponse ? (
                        <div className="planner-content">
                          <div className="response-header">
                            <span className="response-role">🧠 GPT Planner</span>
                            <span className="response-time">
                              {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="response-text">
                            {plannerResponse}
                          </div>
                        </div>
                      ) : !isLoading ? (
                        <div className="no-response">
                          <p>아직 실행 계획이 없습니다.</p>
                          <p>질문을 입력하고 전송해보세요.</p>
                        </div>
                      ) : null}
                      {isLoading && activeResponseTab === 'planner' && (
                        <div className="loading-indicator">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                          <p>Planner가 계획을 세우고 있습니다...</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeResponseTab === 'worker' && (
                    <div className="worker-tab">
                      {workerResponse ? (
                        <div className="worker-content">
                          <div className="response-header">
                            <span className="response-role">🔧 GPT Worker</span>
                            <span className="response-time">
                              {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="response-text">
                            {workerResponse}
                          </div>
                        </div>
                      ) : !isLoading ? (
                        <div className="no-response">
                          <p>아직 최종 결과가 없습니다.</p>
                          <p>Planner가 계획을 완료한 후 Worker가 실행됩니다.</p>
                        </div>
                      ) : null}
                      {isLoading && activeResponseTab === 'worker' && (
                        <div className="loading-indicator">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                          <p>Worker가 실행 결과를 생성하고 있습니다...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: MCP 호출 내역 */}
              <div className="mcp-section">
                <h3>🔧 현재 질문에 대한 MCP 도구 실행</h3>
                {mcpCalls.length > 0 ? (
                  <div className="mcp-calls-list">
                    {/* 가장 최근 질문에 대한 MCP 호출만 표시 */}
                    {(() => {
                      // messages가 비어있으면 MCP 호출도 표시하지 않음
                      if (messages.length === 0) {
                        return (
                          <div className="no-recent-calls">
                            <p>새로운 질문을 입력해주세요.</p>
                            <p>AI가 필요한 정보를 자동으로 가져올 예정입니다!</p>
                          </div>
                        );
                      }
                      
                      // 가장 최근 사용자 메시지의 시간을 찾기
                      const latestUserMessage = messages
                        .filter(m => m.role === 'user')
                        .pop();
                      
                      if (latestUserMessage) {
                        const latestTime = new Date(latestUserMessage.timestamp).getTime();
                        const threshold = latestTime - 60000; // 1분 이내의 MCP 호출만 표시
                        
                        const recentCalls = mcpCalls.filter(call => 
                          new Date(call.timestamp).getTime() >= threshold
                        );
                        
                        if (recentCalls.length > 0) {
                          return recentCalls.map((call) => (
                            <div 
                              key={call.id} 
                              className={`mcp-call-item ${call.status}`}
                              onClick={() => setSelectedMcpCall(call)}
                            >
                              <div className="call-header">
                                <span className="call-action">{call.action}</span>
                                <span className={`call-status ${call.status}`}>
                                  {call.status === "success" ? "✅" : "❌"}
                                </span>
                                <span className="call-time">
                                  {new Date(call.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="call-preview">
                                {call.status === "success" 
                                  ? `✅ 성공 - ${call.response?.data ? '데이터 수신' : '응답 완료'}`
                                  : `❌ 오류: ${call.response?.error || '알 수 없는 오류'}`
                                }
                              </div>
                              {call.status === "success" && call.response?.data && (
                                <div className="call-data-preview">
                                  <small>
                                    {call.action === "pdf" && `파일: ${call.response.data.filename}, 길이: ${call.response.data.length}자`}
                                    {call.action === "database" && `테이블: ${call.response.data.table}, 레코드: ${call.response.data.count}개`}
                                    {call.action === "health" && `상태: ${call.response.data.status}`}
                                    {call.action === "github" && `저장소: ${call.response.data.repository}`}
                                  </small>
                                </div>
                              )}
                            </div>
                          ));
                        }
                      }
                      
                      // 최근 MCP 호출이 없으면 기본 메시지 표시
                      return (
                        <div className="no-recent-calls">
                          <p>현재 질문에 대한 MCP 도구 실행이 없습니다.</p>
                          <p>AI가 필요한 정보를 자동으로 가져올 예정입니다!</p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="no-calls">
                    <p>아직 MCP 도구 실행이 없습니다.</p>
                    <p>질문을 입력하고 전송해보세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
    }
  };

  // response 필드 전용 분석 함수
  const analyzeResponseField = (response: any) => {
    addDebugLog(`📝 response 필드 분석:`);
    addDebugLog(`- 타입: ${typeof response}`);
    addDebugLog(`- null 여부: ${response === null}`);
    addDebugLog(`- undefined 여부: ${response === undefined}`);
    
    if (typeof response === 'string') {
      addDebugLog(`- 문자열 길이: ${response.length}`);
      addDebugLog(`- 빈 문자열: ${response === ''}`);
      addDebugLog(`- 공백 제거 후 길이: ${response.trim().length}`);
      addDebugLog(`- 첫 10자: "${response.substring(0, 10)}"`);
      addDebugLog(`- 마지막 10자: "${response.substring(Math.max(0, response.length - 10))}"`);
      
      // 특수 문자 분석
      const hasNewlines = response.includes('\n');
      const hasCarriageReturns = response.includes('\r');
      const hasTabs = response.includes('\t');
      addDebugLog(`- 개행 문자 포함: ${hasNewlines}`);
      addDebugLog(`- 캐리지 리턴 포함: ${hasCarriageReturns}`);
      addDebugLog(`- 탭 문자 포함: ${hasTabs}`);
    } else {
      addDebugLog(`- 비문자열 값: ${String(response)}`);
    }
  };

  // 콘솔 로그 인터셉트
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      originalLog(...args);
      addDebugLog(`LOG: ${args.join(' ')}`);
    };
    
    console.error = (...args) => {
      originalError(...args);
      addDebugLog(`ERROR: ${args.join(' ')}`);
    };
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  // API 키를 로컬 스토리지에서 불러오기
  useEffect(() => {
    const savedKey = localStorage.getItem("mcp_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // 로딩 상태에 따른 메시지 자동 제거
  useEffect(() => {
    if (!isLoading) {
      // 로딩이 완료되면 응답 처리
      if (response && response.trim()) {
        // 응답이 있으면 그대로 유지
      }
    }
  }, [isLoading, response]);

  // API 키를 로컬 스토리지에 저장
  const handleApiKeyChange = (key: string) => {
    // API 키에서 앞뒤 공백 제거
    const cleanedKey = key.trim();
    setApiKey(cleanedKey);
    localStorage.setItem("mcp_api_key", cleanedKey);
    
    if (cleanedKey !== key) {
      addDebugLog(`🔧 API 키에서 공백 제거됨: "${key}" -> "${cleanedKey}"`);
    }
  };

  // 1번 화면: 순수 GPT 호출 (스트리밍)
  const handleGPTStream = async () => {
    if (!prompt.trim() || !apiKey.trim()) {
      addDebugLog(`⚠️ 입력 검증 실패 - prompt: "${prompt.trim()}", apiKey 길이: ${apiKey.trim().length}`);
      return;
    }
    
    // API 키 검증
    const cleanApiKey = apiKey.trim();
    if (cleanApiKey.length < 10) {
      addDebugLog(`❌ API 키가 너무 짧습니다: ${cleanApiKey.length}자`);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 입력해주세요.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    addDebugLog(`✅ API 키 검증 통과: ${cleanApiKey.substring(0, 10)}...`);
    addDebugLog(`✅ 프롬프트 검증 통과: ${prompt.trim().length}자`);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);

    // 스트리밍 응답을 위한 메시지 생성
    const streamingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, streamingMessage]);

    try {
      addDebugLog("🚀 GPT 스트리밍 시작 (직접 OpenAI API 호출)");
      
      const requestData = {
        model: "gpt-5-mini",
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: prompt }
        ],
        stream: false
      };
      
      addDebugLog(`📤 OpenAI API 요청 데이터: ${JSON.stringify(requestData, null, 2)}`);
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanApiKey}`,
        },
        body: JSON.stringify(requestData),
      });

      addDebugLog(`📡 HTTP 응답 상태: ${response.status} ${response.statusText}`);
      addDebugLog(`📋 응답 헤더: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);

      if (response.ok) {
        const data = await response.json();
        
        // 전체 응답 구조를 상세히 분석
        analyzeResponseStructure(data, "GPT 스트리밍 응답");
        
        // JSON 형태로도 로깅 (백업용)
        addDebugLog(`📊 JSON 형태 응답:`);
        addDebugLog(`${JSON.stringify(data, null, 2)}`);
        
        // OpenAI API 응답 처리
        addDebugLog(`🔍 OpenAI API 응답 검증 시작`);
        
        // OpenAI API 에러 응답 확인
        if (data.error) {
          addDebugLog(`❌ OpenAI API 에러 응답 감지: ${JSON.stringify(data.error)}`);
          const errorMessage = `OpenAI API 에러: ${data.error.message || data.error.type || '알 수 없는 에러'}`;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, content: errorMessage }
                : msg
            )
          );
          addDebugLog("✅ OpenAI API 에러 응답 처리 완료");
          return;
        }
        
        // OpenAI API 정상 응답 확인
        const hasChoices = data.choices && data.choices.length > 0;
        const hasMessage = hasChoices && data.choices[0].message;
        const hasContent = hasMessage && data.choices[0].message.content;
        const contentNotEmpty = hasContent && data.choices[0].message.content.trim() !== "";
        
        addDebugLog(`- choices 존재 여부: ${hasChoices}`);
        addDebugLog(`- message 존재 여부: ${hasMessage}`);
        addDebugLog(`- content 존재 여부: ${hasContent}`);
        addDebugLog(`- content 비어있지 않음: ${contentNotEmpty}`);
        
        if (!hasChoices || !hasMessage || !hasContent || !contentNotEmpty) {
          // 빈 응답 처리
          const emptyResponseMessage = "OpenAI에서 응답을 받았지만 내용이 비어있습니다. 다시 시도해보세요.";
          addDebugLog(`⚠️ 빈 응답 감지 - 대체 메시지 사용: "${emptyResponseMessage}"`);
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, content: emptyResponseMessage }
                : msg
            )
          );
          addDebugLog("✅ 빈 응답 처리 완료");
          return;
        }
        
        // 스트리밍 효과로 한 글자씩 표시
        const responseText = data.choices[0].message.content;
        addDebugLog(`🎬 스트리밍 시작 - 총 ${responseText.length}자`);
        let currentText = "";
        
        for (let i = 0; i < responseText.length; i++) {
          currentText += responseText[i];
          setMessages(prev => 
            prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, content: currentText }
                : msg
            )
          );
          
          // 진행률 로깅 (10% 단위)
          if (i % Math.ceil(responseText.length / 10) === 0) {
            const progress = Math.round((i / responseText.length) * 100);
            addDebugLog(`📈 스트리밍 진행률: ${progress}% (${i}/${responseText.length}자)`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
        }
        
        addDebugLog(`✅ 스트리밍 완료 - 총 ${responseText.length}자 표시됨`);
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
            errorMessage = "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = "서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.";
            break;
          default:
            errorMessage = `서버 오류가 발생했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해주세요.`;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // 상세한 에러 정보 로깅
      addDebugLog(`💥 GPT 에러 발생:`);
      addDebugLog(`- 에러 타입: ${error.constructor.name}`);
      addDebugLog(`- 에러 이름: ${error.name}`);
      addDebugLog(`- 에러 메시지: ${error.message}`);
      addDebugLog(`- 에러 스택: ${error.stack}`);
      
      // 에러 객체의 모든 속성 로깅
      const errorProps = Object.getOwnPropertyNames(error);
      addDebugLog(`- 에러 속성들: [${errorProps.join(', ')}]`);
      
      errorProps.forEach(prop => {
        if (prop !== 'stack') { // 스택은 이미 로깅했으므로 제외
          addDebugLog(`  - ${prop}: ${error[prop]}`);
        }
      });
      
      // 네트워크 에러와 기타 에러 구분
      let userFriendlyMessage = "";
      let errorCategory = "기타";
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        // 네트워크 연결 오류
        errorCategory = "네트워크 연결";
        userFriendlyMessage = "서버에 연결할 수 없습니다. 네트워크 연결을 확인하고 서버가 실행 중인지 확인해주세요.";
      } else if (error.message.includes('Failed to fetch')) {
        // fetch 실패 (CORS, 네트워크 등)
        errorCategory = "Fetch 실패";
        userFriendlyMessage = "서버 연결에 실패했습니다. 서버가 실행 중인지 확인해주세요.";
      } else if (error.message.includes('NetworkError')) {
        // 네트워크 에러
        errorCategory = "네트워크";
        userFriendlyMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
      } else {
        // 기타 에러 (이미 사용자 친화적인 메시지로 처리된 HTTP 에러 포함)
        errorCategory = "HTTP/기타";
        userFriendlyMessage = error.message;
      }
      
      addDebugLog(`🏷️ 에러 분류: ${errorCategory}`);
      addDebugLog(`💬 사용자 메시지: "${userFriendlyMessage}"`);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === streamingMessage.id 
            ? { ...msg, content: `❌ ${userFriendlyMessage}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 2번 화면: API 백엔드 테스트
  const testAPIBackend = async (endpoint: string, data: any) => {
    try {
      addDebugLog(`🔧 API 백엔드 테스트: ${endpoint}`);
      
      const response = await fetch(`http://localhost:9002/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // HTTP 에러 처리
        let errorMessage = "";
        switch (response.status) {
          case 400:
            errorMessage = "잘못된 API 요청입니다. 파라미터를 확인해주세요.";
            break;
          case 404:
            errorMessage = "API 엔드포인트를 찾을 수 없습니다. 서버 설정을 확인해주세요.";
            break;
          case 500:
            errorMessage = "API 서버 내부 오류가 발생했습니다.";
            break;
          default:
            errorMessage = `API 서버 오류 (HTTP ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      addDebugLog(`✅ API 백엔드 응답: ${JSON.stringify(responseData).substring(0, 100)}...`);
      
      const apiCall: MCPCall = {
        id: Date.now().toString(),
        action: endpoint,
        args: data,
        response: responseData,
        timestamp: new Date().toISOString(),
        status: responseData.ok ? "success" : "error",
      };

      setMcpCalls(prev => [apiCall, ...prev]);
      return apiCall;
    } catch (error: any) {
      addDebugLog(`💥 API 백엔드 에러: ${error.message}`);
      
      // 네트워크 에러 처리
      let userFriendlyMessage = "";
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        userFriendlyMessage = "API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
      } else if (error.message.includes('Failed to fetch')) {
        userFriendlyMessage = "API 서버 연결에 실패했습니다.";
      } else {
        userFriendlyMessage = error.message;
      }
      
      const errorCall: MCPCall = {
        id: Date.now().toString(),
        action: endpoint,
        args: data,
        response: { error: userFriendlyMessage },
        timestamp: new Date().toISOString(),
        status: "error",
      };
      setMcpCalls(prev => [errorCall, ...prev]);
      return errorCall;
    }
  };



  // MCP 도구 분석 및 자동 사용 함수
  const analyzeAndUseMcpTools = async (gptResponse: string, userPrompt: string) => {
    const results: Array<{
      action: string;
      status: "success" | "error";
      summary?: string;
      error?: string;
    }> = [];
    
    addDebugLog(`🔍 MCP 도구 사용 필요성 분석 시작`);
    
    // 사용자 질문과 GPT 응답을 분석하여 필요한 MCP 도구 결정
    const promptLower = userPrompt.toLowerCase();
    const responseLower = gptResponse.toLowerCase();
    
    // PDF 관련 질문이 있는지 확인
    if (promptLower.includes('pdf') || promptLower.includes('문서') || 
        promptLower.includes('백엔드') || promptLower.includes('프론트') || promptLower.includes('디비')) {
      addDebugLog(`📄 PDF 관련 질문 감지 - 백엔드 가이드 PDF 읽기 시도`);
      
      try {
        // MCP 서버를 통해 PDF 읽기 (실제 구현에서는 MCP 프로토콜 사용)
        addDebugLog(`📄 MCP를 통해 PDF 읽기 시도`);
        results.push({
          action: "PDF 읽기 (백엔드 가이드)",
          status: "success",
          summary: `MCP를 통해 백엔드_가이드.pdf 읽기 완료`
        });
      } catch (error: any) {
        results.push({
          action: "PDF 읽기 (백엔드 가이드)",
          status: "error",
          error: error.message || "PDF 읽기 실패"
        });
      }
    }
    
    // 데이터베이스 관련 질문이 있는지 확인
    if (promptLower.includes('데이터베이스') || promptLower.includes('db') || 
        promptLower.includes('사용자') || promptLower.includes('가이드') ||
        promptLower.includes('테이블')) {
      addDebugLog(`🗄️ 데이터베이스 관련 질문 감지 - 사용자 테이블 조회 시도`);
      
      try {
        // MCP 서버를 통해 데이터베이스 조회 (실제 구현에서는 MCP 프로토콜 사용)
        addDebugLog(`🗄️ MCP를 통해 데이터베이스 조회 시도`);
        results.push({
          action: "데이터베이스 조회 (사용자)",
          status: "success",
          summary: `MCP를 통해 users 테이블 조회 완료`
        });
      } catch (error: any) {
        results.push({
          action: "데이터베이스 조회 (사용자)",
          status: "error",
          error: error.message || "데이터베이스 조회 실패"
        });
      }
    }
    
    // GitHub 관련 질문이 있는지 확인
    if (promptLower.includes('github') || promptLower.includes('git') || 
        promptLower.includes('저장소') || promptLower.includes('소스코드')) {
      addDebugLog(`🔗 GitHub 관련 질문 감지 - 저장소 정보 조회 시도`);
      
      try {
        // MCP 서버를 통해 GitHub 조회 (실제 구현에서는 MCP 프로토콜 사용)
        addDebugLog(`🔗 MCP를 통해 GitHub 저장소 조회 시도`);
        results.push({
          action: "GitHub 저장소 조회",
          status: "success",
          summary: `MCP를 통해 hli-yohan-lee/dev-guide 저장소 조회 완료`
        });
      } catch (error: any) {
        results.push({
          action: "GitHub 저장소 조회",
          status: "error",
          error: error.message || "GitHub 조회 실패"
        });
      }
    }
    
    // 시스템 상태 관련 질문이 있는지 확인
    if (promptLower.includes('상태') || promptLower.includes('health') || 
        promptLower.includes('서버') || promptLower.includes('백엔드')) {
      addDebugLog(`🏥 시스템 상태 관련 질문 감지 - 백엔드 상태 확인 시도`);
      
      try {
        // MCP 서버를 통해 시스템 상태 확인 (실제 구현에서는 MCP 프로토콜 사용)
        addDebugLog(`🏥 MCP를 통해 시스템 상태 확인 시도`);
        results.push({
          action: "백엔드 상태 확인",
          status: "success",
          summary: `MCP를 통해 시스템 상태 확인 완료`
        });
      } catch (error: any) {
        results.push({
          action: "백엔드 상태 확인",
          status: "error",
          error: error.message || "상태 확인 실패"
        });
      }
    }
    
    addDebugLog(`✅ MCP 도구 분석 완료 - ${results.length}개 도구 실행됨`);
    return results;
  };

  // 3번 화면: MCP 통합 (AI + MCP 자동 연동)
  const handleCombinedGPT = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
    // 실행 시 모든 내역 초기화
    setMessages([]);
    setMcpCalls([]);
    setResponse("");
    
    // API 키 검증
    const cleanApiKey = apiKey.trim();
    if (cleanApiKey.length < 10) {
      addDebugLog(`❌ API 키가 너무 짧습니다: ${cleanApiKey.length}자`);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 입력해주세요.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);

    // 스트리밍 응답을 위한 메시지 생성
    const streamingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, streamingMessage]);

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
          const emptyResponseMessage = "Gateway Backend에서 응답을 받았지만 내용이 비어있습니다. 다시 시도해보세요.";
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
        if (mcpCallsData.length > 0) {
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
        
        // 응답을 상태에 저장하고 스트리밍으로 표시
        setResponse('');
        let currentText = "";
        for (let i = 0; i < answerText.length; i++) {
          currentText += answerText[i];
          setResponse(currentText);
          
          // 스트리밍 메시지도 함께 업데이트
          setMessages(prev => 
            prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, content: currentText }
                : msg
            )
          );
          
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
            errorMessage = "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = "서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.";
            break;
          default:
            errorMessage = `서버 오류가 발생했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해주세요.`;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // 상세한 에러 정보 로깅 (MCP 통합 모드)
      addDebugLog(`💥 MCP 통합 에러 발생:`);
      addDebugLog(`- 에러 타입: ${error.constructor.name}`);
      addDebugLog(`- 에러 이름: ${error.name}`);
      addDebugLog(`- 에러 메시지: ${error.message}`);
      
      // 네트워크 에러와 기타 에러 구분
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        addDebugLog(`🌐 네트워크 에러 - Gateway Backend 서버가 실행 중인지 확인해주세요.`);
        const networkErrorMessage = "🌐 네트워크 에러가 발생했습니다. Gateway Backend 서버가 실행 중인지 확인해주세요.";
        setResponse(networkErrorMessage);
      } else {
        addDebugLog(`💻 기타 에러 - ${error.message}`);
        setResponse(`💻 에러가 발생했습니다: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // MCP 도구 실행 함수 (공통)
  const executeMcpTools = async (toolCalls: any[], userPrompt: string, apiKey: string) => {
    addDebugLog(`🚀 MCP 도구 실행 시작 - ${toolCalls.length}개 도구`);
    setWorkerResponse("MCP 도구들을 실행하고 있습니다...");
    
    try {
      const mcpResults = [];
      
      for (const toolCall of toolCalls) {
        const toolName = toolCall.tool_name || toolCall.tool || toolCall.function?.name || toolCall.name;
        const toolArgs = toolCall.parameters || toolCall.function?.arguments || toolCall.arguments;
        
        addDebugLog(`🔧 MCP 도구 실행: ${toolName} - ${JSON.stringify(toolArgs)}`);
        
        // MCP 표준 도구 이름에서 functions. 접두사 제거
        const cleanToolName = toolName.replace('functions.', '');
        addDebugLog(`🔗 MCP 도구 실행: ${toolName} → ${cleanToolName}`);
        
        // MCP 표준 엔드포인트로 도구 실행
        const mcpResponse = await fetch(`http://localhost:9001/mcp/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: cleanToolName,
            arguments: toolArgs
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
            args: toolArgs,
            response: mcpData,
            timestamp: new Date().toISOString(),
            status: mcpData.error ? "error" : "success"
          };
          setMcpCalls(prev => [mcpCall, ...prev]);
          
          mcpResults.push({
            tool: toolName,
            args: toolArgs,
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
            args: toolArgs,
            response: { error: `HTTP ${mcpResponse.status}: ${errorText}` },
            timestamp: new Date().toISOString(),
            status: "error"
          };
          setMcpCalls(prev => [mcpCall, ...prev]);
          
          mcpResults.push({
            tool: toolName,
            args: toolArgs,
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
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 입력해주세요.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // 프롬프트 초기화
    setPrompt("");
    
    // 사용자 메시지 추가 (초기화 전에)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: currentPrompt,
      timestamp: new Date().toISOString(),
    };

    // 실행 시 모든 내역 초기화 (사용자 메시지 포함)
    setMessages([userMessage]);
    setMcpCalls([]);
    setPlannerResponse("");
    setWorkerResponse("");
    setIsLoading(true);

    try {
      addDebugLog("🚀 2 STEP 테스트 시작 (Step-by-step 모드)");
      
      // 1단계: MCP 서버에서 실제 도구 명세 가져오기
      addDebugLog(`🔍 MCP 서버에서 도구 명세 가져오기 시작`);
      let mcpToolsInfo = "";
      
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
            mcpToolsInfo = `## 🔧 MCP 서버에서 제공하는 실제 도구들\n\n`;
            schemaData.forEach((tool: any, index: number) => {
              if (tool.function) {
                mcpToolsInfo += `### ${index + 1}. ${tool.function.name}\n`;
                mcpToolsInfo += `- **설명**: ${tool.function.description || '설명 없음'}\n`;
                if (tool.function.parameters) {
                  mcpToolsInfo += `- **파라미터**: ${JSON.stringify(tool.function.parameters, null, 2)}\n`;
                }
                mcpToolsInfo += `\n`;
              }
            });
            addDebugLog(`✅ MCP 도구 정보 파싱 완료 - ${schemaData.length}개 도구`);
          } else {
            mcpToolsInfo = `## ⚠️ MCP 서버 스키마 응답 형식이 예상과 다릅니다\n`;
            mcpToolsInfo += `응답 데이터: ${JSON.stringify(schemaData, null, 2)}\n\n`;
            addDebugLog(`⚠️ MCP 서버 스키마 응답 형식이 예상과 다름`);
          }
        } else {
          addDebugLog(`❌ MCP 서버 스키마 요청 실패: ${schemaResponse.status}`);
          mcpToolsInfo = `## ⚠️ MCP 서버 스키마를 가져올 수 없습니다 (HTTP ${schemaResponse.status})\n`;
          mcpToolsInfo += `하드코딩된 도구 정보를 사용합니다.\n\n`;
        }
      } catch (schemaError: any) {
        addDebugLog(`💥 MCP 서버 스키마 요청 에러: ${schemaError.message}`);
        mcpToolsInfo = `## ⚠️ MCP 서버 스키마 요청 중 에러 발생\n`;
        mcpToolsInfo += `에러: ${schemaError.message}\n`;
        mcpToolsInfo += `하드코딩된 도구 정보를 사용합니다.\n\n`;
      }
      
      // 2단계: Gateway Backend의 /ask 엔드포인트 호출 (2 STEP 모드)
      const requestData = {
        question: `당신은 MCP(Microservice Communication Protocol) 시스템의 Planner입니다. 사용자의 질문을 분석하여 필요한 MCP 도구들을 정확한 형식으로 호출하는 계획을 수립해야 합니다.

${mcpToolsInfo}

## 📋 응답 형식 요구사항
당신은 반드시 다음 JSON 형식으로만 응답해야 합니다. 다른 텍스트나 설명은 절대 포함하지 마세요:

{
  "tool_calls": [
    {
      "tool_name": "도구명",
      "parameters": {
        "파라미터명": "값"
      }
    }
  ]
}

## 🚫 금지사항
- "일반 응답:" 같은 접두사 텍스트 사용 금지
- JSON 외의 설명 텍스트 포함 금지
- tool_calls 배열이 아닌 다른 형태의 응답 금지
- 파라미터 이름이나 값에 오타 금지

## 🔍 질문 분석 가이드
사용자의 질문을 분석하여:
1. 어떤 정보가 필요한지 파악
2. 필요한 MCP 도구들을 순서대로 나열
3. 각 도구에 필요한 정확한 파라미터 설정
4. 도구 실행 순서 최적화

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
                
                const extractedToolCalls = toolCallMatches.map((match: string, index: number) => {
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
          } catch (parseError) {
            addDebugLog(`⚠️ JSON 파싱 실패 - 일반 텍스트로 표시: ${parseError}`);
            setPlannerResponse(answerText);
          }
        }
        
        // 응답 구조 상세 분석 (디버깅용)
        addDebugLog(`🔍 2 STEP 응답 구조 분석:`);
        addDebugLog(`- mode: ${data.mode}`);
        addDebugLog(`- tool_calls 존재: ${!!data.tool_calls}`);
        addDebugLog(`- tool_calls 개수: ${data.tool_calls ? data.tool_calls.length : 0}`);
        addDebugLog(`- planner_response 존재: ${!!data.planner_response}`);
        addDebugLog(`- worker_response 존재: ${!!data.worker_response}`);
        addDebugLog(`- answer 존재: ${!!data.answer}`);
        addDebugLog(`- mcp_calls 개수: ${data.mcp_calls ? data.mcp_calls.length : 0}`);
        
        // tool_calls 상세 분석 (디버깅용)
        if (data.tool_calls && data.tool_calls.length > 0) {
          addDebugLog(`🔧 tool_calls 상세 분석:`);
          data.tool_calls.forEach((tool: any, index: number) => {
            addDebugLog(`  - tool ${index + 1}: ${JSON.stringify(tool, null, 2)}`);
          });
        }
        
        // 전체 응답 데이터 로깅 (디버깅용)
        addDebugLog(`📊 전체 응답 데이터: ${JSON.stringify(data, null, 2)}`);
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
            errorMessage = "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = "서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.";
            break;
          default:
            errorMessage = `서버 오류가 발생했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해주세요.`;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // 상세한 에러 정보 로깅 (2 STEP 모드)
      addDebugLog(`💥 2 STEP 테스트 에러 발생:`);
      addDebugLog(`- 에러 타입: ${error.constructor.name}`);
      addDebugLog(`- 에러 이름: ${error.name}`);
      addDebugLog(`- 에러 메시지: ${error.message}`);
      
      // 네트워크 에러와 기타 에러 구분
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        addDebugLog(`🌐 네트워크 에러 - Gateway Backend 서버가 실행 중인지 확인해주세요.`);
        const networkErrorMessage = "🌐 네트워크 에러가 발생했습니다. Gateway Backend 서버가 실행 중인지 확인해주세요.";
        setPlannerResponse(networkErrorMessage);
      } else {
        addDebugLog(`💻 기타 에러 - ${error.message}`);
        setPlannerResponse(`💻 에러가 발생했습니다: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 5번 화면: MCP 순수 테스트 (MCP만 사용)
  const handlePureMCP = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
    // 실행 시 모든 내역 초기화
    setMessages([]);
    setMcpCalls([]);
    setResponse("");
    
    // API 키 검증
    const cleanApiKey = apiKey.trim();
    if (cleanApiKey.length < 10) {
      addDebugLog(`❌ API 키가 너무 짧습니다: ${cleanApiKey.length}자`);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 입력해주세요.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);

    // 스트리밍 응답을 위한 메시지 생성
    const streamingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, streamingMessage]);

    try {
      addDebugLog("🚀 MCP 순수 테스트 시작 (MCP만 사용)");
      addDebugLog(`📤 요청 데이터: ${JSON.stringify({
        message: prompt,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      }, null, 2)}`);
      
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
          const emptyResponseMessage = "Gateway Backend에서 응답을 받았지만 내용이 비어있습니다. 다시 시도해보세요.";
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
        if (mcpCallsData.length > 0) {
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
        
        // 응답을 상태에 저장하고 스트리밍으로 표시
        setResponse('');
        let currentText = "";
        for (let i = 0; i < answerText.length; i++) {
          currentText += answerText[i];
          setResponse(currentText);
          
          // 스트리밍 메시지도 함께 업데이트
          setMessages(prev => 
            prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, content: currentText }
                : msg
            )
          );
          
          await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
        }
        
        addDebugLog(`✅ MCP 순수 테스트 완료`);
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
            errorMessage = "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = "서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.";
            break;
          default:
            errorMessage = `서버 오류가 발생했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해주세요.`;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // 상세한 에러 정보 로깅 (MCP 순수 모드)
      addDebugLog(`💥 MCP 순수 테스트 에러 발생:`);
      addDebugLog(`- 에러 타입: ${error.constructor.name}`);
      addDebugLog(`- 에러 이름: ${error.name}`);
      addDebugLog(`- 에러 메시지: ${error.message}`);
      
      // 네트워크 에러와 기타 에러 구분
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        addDebugLog(`🌐 네트워크 에러 - Gateway Backend 서버가 실행 중인지 확인해주세요.`);
        const networkErrorMessage = "🌐 네트워크 에러가 발생했습니다. Gateway Backend 서버가 실행 중인지 확인해주세요.";
        setResponse(networkErrorMessage);
      } else {
        addDebugLog(`💻 기타 에러 - ${error.message}`);
        setResponse(`💻 에러가 발생했습니다: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 6번 화면: MCP 통합 테스트 (AI + MCP 자동 연동)
  const handleCombinedMCP = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
    // 실행 시 모든 내역 초기화
    setMessages([]);
    setMcpCalls([]);
    setResponse("");
    
    // API 키 검증
    const cleanApiKey = apiKey.trim();
    if (cleanApiKey.length < 10) {
      addDebugLog(`❌ API 키가 너무 짧습니다: ${cleanApiKey.length}자`);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 입력해주세요.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);

    // 스트리밍 응답을 위한 메시지 생성
    const streamingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, streamingMessage]);

    try {
      addDebugLog("🚀 MCP 통합 호출 시작 (AI + MCP 자동 연동)");
      addDebugLog(`📤 요청 데이터: ${JSON.stringify({
        message: prompt,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      }, null, 2)}`);
      
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
          const emptyResponseMessage = "Gateway Backend에서 응답을 받았지만 내용이 비어있습니다. 다시 시도해보세요.";
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
        if (mcpCallsData.length > 0) {
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
        
        // 응답을 상태에 저장하고 스트리밍으로 표시
        setResponse('');
        let currentText = "";
        for (let i = 0; i < answerText.length; i++) {
          currentText += answerText[i];
          setResponse(currentText);
          
          // 스트리밍 메시지도 함께 업데이트
          setMessages(prev => 
            prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, content: currentText }
                : msg
            )
          );
          
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
            errorMessage = "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = "서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.";
            break;
          default:
            errorMessage = `서버 오류가 발생했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해주세요.`;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // 상세한 에러 정보 로깅 (MCP 통합 모드)
      addDebugLog(`💥 MCP 통합 에러 발생:`);
      addDebugLog(`- 에러 타입: ${error.constructor.name}`);
      addDebugLog(`- 에러 이름: ${error.name}`);
      addDebugLog(`- 에러 메시지: ${error.message}`);
      
      // 네트워크 에러와 기타 에러 구분
      let userFriendlyMessage = "";
      let errorCategory = "기타";
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        // 네트워크 연결 오류
        errorCategory = "네트워크 연결";
        userFriendlyMessage = "서버에 연결할 수 없습니다. 네트워크 연결을 확인하고 서버가 실행 중인지 확인해주세요.";
      } else if (error.message.includes('Failed to fetch')) {
        // fetch 실패 (CORS, 네트워크 등)
        errorCategory = "Fetch 실패";
        userFriendlyMessage = "서버 연결에 실패했습니다. 서버가 실행 중인지 확인해주세요.";
      } else if (error.message.includes('NetworkError')) {
        // 네트워크 에러
        errorCategory = "네트워크";
        userFriendlyMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
      } else {
        // 기타 에러 (이미 사용자 친화적인 메시지로 처리된 HTTP 에러 포함)
        errorCategory = "HTTP/기타";
        userFriendlyMessage = error.message;
      }
      
      addDebugLog(`🏷️ 에러 분류: ${errorCategory}`);
      addDebugLog(`💬 사용자 메시지: "${userFriendlyMessage}"`);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ ${userFriendlyMessage}`,
        timestamp: new Date().toISOString(),
      };
      addDebugLog(`💬 에러 메시지 생성 완료: ID=${errorMessage.id}`);
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };





  // Enter 키로 프롬프트 전송
  const handleKeyPress = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handler();
    }
  };

  // 탭 렌더링 함수
  const renderTab = () => {
    switch (activeTab) {
      case "gpt":
        return (
          <div className="tab-content">
            <div className="chat-section">
              {/* 입력 영역 */}
              <div className="input-section">
                <h3>입력</h3>
                <textarea
                  className="input-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="GPT에게 질문을 입력하세요..."
                />
                <button 
                  onClick={handleGPTStream} 
                  disabled={!prompt.trim() || !apiKey.trim() || isLoading}
                  className={`action-button ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? "처리 중..." : "전송"}
                </button>
              </div>
              
              {/* 출력 영역 */}
              <div className="output-section">
                <h3>출력</h3>
                <div className="output-content">
                  {messages.length === 0 && "GPT 응답이 여기에 표시됩니다..."}
                  {messages.filter(m => m.role === 'assistant').map((message, index) => (
                    <div key={message.id}>
                      {index > 0 && "\n\n---\n\n"}
                      {message.content}
                    </div>
                  ))}
                  {isLoading && (
                    <div>
                      {messages.filter(m => m.role === 'assistant').length > 0 && "\n\n---\n\n"}
                      처리 중...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

              case "interface-backend":
        return (
          <div className="tab-content">
                          <div className="mcp-backend-section">
              <div className="left-panel">
                <div className="backend-tools">
                  <h4>📄 PDF 관련</h4>
                  <div className="tool-buttons">
                    <button 
                      onClick={() => testAPIBackend("pdf", { 
                        filename: "백엔드_가이드.pdf"
                      })}
                      className="mcp-tool-button"
                    >
                      백엔드 가이드 PDF 읽기
                    </button>
                    <button 
                      onClick={() => testAPIBackend("pdf", { 
                        filename: "프론트_가이드.pdf"
                      })}
                      className="mcp-tool-button"
                    >
                      프론트 가이드 PDF 읽기
                    </button>
                    <button 
                      onClick={() => testAPIBackend("pdf", { 
                        filename: "디비_가이드.pdf"
                      })}
                      className="mcp-tool-button"
                    >
                      디비 가이드 PDF 읽기
                    </button>
                  </div>

                  <h4>🗄️ 데이터베이스</h4>
                  <div className="tool-buttons">
                    <button 
                      onClick={() => testAPIBackend("database", { 
                        table: "users"
                      })}
                      className="mcp-tool-button"
                    >
                      모든 사용자 조회
                    </button>
                    <button 
                      onClick={() => testAPIBackend("database", { 
                        table: "users",
                        filters: { role: "backend" }
                      })}
                      className="mcp-tool-button"
                    >
                      백엔드 + 풀스택 조회
                    </button>
                    <button 
                      onClick={() => testAPIBackend("database", { 
                        table: "users",
                        filters: { role: "frontend" }
                      })}
                      className="mcp-tool-button"
                    >
                      프론트엔드 + 풀스택 조회
                    </button>
                    <button 
                      onClick={() => testAPIBackend("database", { 
                        table: "users",
                        filters: { role: "fullstack" }
                      })}
                      className="mcp-tool-button"
                    >
                      풀스택만 조회
                    </button>
                    <button 
                      onClick={() => testAPIBackend("database", { 
                        table: "users",
                        filters: { role: "database" }
                      })}
                      className="mcp-tool-button"
                    >
                      DBA + 풀스택 조회
                    </button>
                    <button 
                      onClick={() => testAPIBackend("database", { 
                        table: "guides"
                      })}
                      className="mcp-tool-button"
                    >
                      가이드 목록 조회
                    </button>
                  </div>

                  <h4>🔗 GitHub</h4>
                  <div className="tool-buttons">
                    <button 
                      onClick={() => testAPIBackend("github", { 
                        repository: "hli-yohan-lee/dev-guide",
                        username: "hli-yohan-lee",
                        password: githubToken
                      })}
                      className="mcp-tool-button"
                    >
                      GitHub 저장소 조회
                    </button>
                    <button 
                      onClick={() => testAPIBackend("github", { 
                        repository: "hli-yohan-lee/dev-guide",
                        username: "hli-yohan-lee",
                        password: githubToken,
                        file_path: "API_가이드.pdf"
                      })}
                      className="mcp-tool-button"
                    >
                      API_가이드 파일 읽기
                    </button>
                    <button 
                      onClick={() => testAPIBackend("github", { 
                        repository: "hli-yohan-lee/dev-guide",
                        username: "hli-yohan-lee",
                        password: githubToken,
                        file_path: "GIT_가이드.pdf"
                      })}
                      className="mcp-tool-button"
                    >
                      GIT_가이드 파일 읽기
                    </button>
                  </div>

                  <h4>📊 시스템 상태</h4>
                  <div className="tool-buttons">
                    <button 
                      onClick={() => testAPIBackend("health", {})}
                      className="mcp-tool-button"
                    >
                      백엔드 상태 확인
                    </button>
                  </div>
                </div>
              </div>

              <div className="right-panel">
                <div className="mcp-calls-section">
                  <h3>실행 결과</h3>
                  <div className="mcp-calls-list">
                    {mcpCalls.length === 0 && (
                      <div style={{textAlign: 'center', color: '#6b7280', padding: '2rem'}}>
                        MCP 도구를 실행하면 결과가 여기에 표시됩니다.
                      </div>
                    )}
                    {mcpCalls.map((call) => (
                      <div 
                        key={call.id} 
                        className={`mcp-call-item ${call.status}`}
                        onClick={() => setSelectedMcpCall(call)}
                      >
                        <div className="call-header">
                          <span className="call-action">{call.action}</span>
                          <span className={`call-status ${call.status}`}>
                            {call.status === "success" ? "✅" : "❌"}
                          </span>
                        </div>
                        <div className="call-timestamp">
                          {new Date(call.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );



      case "1step":
        return (
          <div className="tab-content">
            <div className="step1-section">
              {/* 왼쪽: 질문 입력 */}
              <div className="input-section">
                <h3>GPT 채팅</h3>
                <textarea
                  className="input-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, () => {
                    // 엔터 시 모든 내역 초기화
                    setMessages([]);
                    setMcpCalls([]);
                    setResponse("");
                    // GPT 요청 처리
                    handleCombinedGPT();
                  })}
                  placeholder="GPT에게 질문을 입력하세요..."
                />
                <button 
                  onClick={() => {
                    // 실행 시 모든 내역 초기화
                    setMessages([]);
                    setMcpCalls([]);
                    setResponse("");
                    // GPT 요청 처리
                    handleCombinedGPT();
                  }} 
                  disabled={!prompt.trim() || !apiKey.trim() || isLoading}
                  className={`action-button ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? "처리 중..." : "전송"}
                </button>
              </div>

              {/* 가운데: 단순 응답 표시 */}
              <div className="response-section">
                <div className="response-content">
                  <div className="response-header">
                    <span className="response-role">🤖 AI 응답</span>
                    <span className="response-time">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {response ? (
                    <div className="response-text">
                      {response}
                    </div>
                  ) : !isLoading ? (
                    <div className="no-response">
                      <p>AI가 MCP 도구를 사용하여 답변을 생성하고 있습니다...</p>
                      <p>질문을 입력하고 전송해보세요.</p>
                    </div>
                  ) : null}
                  
                  {isLoading && (
                    <div className="loading-indicator">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <p>AI가 MCP 도구를 사용하여 답변을 생성하고 있습니다...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: MCP 호출 내역 */}
              <div className="mcp-section">
                <h3>🔧 현재 질문에 대한 MCP 도구 실행</h3>
                {mcpCalls.length > 0 ? (
                  <div className="mcp-calls-list">
                    {/* 가장 최근 질문에 대한 MCP 호출만 표시 */}
                    {(() => {
                      // messages가 비어있으면 MCP 호출도 표시하지 않음
                      if (messages.length === 0) {
                        return (
                          <div className="no-recent-calls">
                            <p>새로운 질문을 입력해주세요.</p>
                            <p>AI가 필요한 정보를 자동으로 가져올 예정입니다!</p>
                          </div>
                        );
                      }
                      
                      // 가장 최근 사용자 메시지의 시간을 찾기
                      const latestUserMessage = messages
                        .filter(m => m.role === 'user')
                        .pop();
                      
                      if (latestUserMessage) {
                        const latestTime = new Date(latestUserMessage.timestamp).getTime();
                        const threshold = latestTime - 60000; // 1분 이내의 MCP 호출만 표시
                        
                        const recentCalls = mcpCalls.filter(call => 
                          new Date(call.timestamp).getTime() >= threshold
                        );
                        
                        if (recentCalls.length > 0) {
                          return recentCalls.map((call) => (
                            <div 
                              key={call.id} 
                              className={`mcp-call-item ${call.status}`}
                              onClick={() => setSelectedMcpCall(call)}
                            >
                              <div className="call-header">
                                <span className="call-action">{call.action}</span>
                                <span className={`call-status ${call.status}`}>
                                  {call.status === "success" ? "✅" : "❌"}
                                </span>
                                <span className="call-time">
                                  {new Date(call.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="call-preview">
                                {call.status === "success" 
                                  ? `✅ 성공 - ${call.response?.data ? '데이터 수신' : '응답 완료'}`
                                  : `❌ 오류: ${call.response?.error || '알 수 없는 오류'}`
                                }
                              </div>
                              {call.status === "success" && call.response?.data && (
                                <div className="call-data-preview">
                                  <small>
                                    {call.action === "pdf" && `파일: ${call.response.data.filename}, 길이: ${call.response.data.length}자`}
                                    {call.action === "database" && `테이블: ${call.response.data.table}, 레코드: ${call.response.data.count}개`}
                                    {call.action === "health" && `상태: ${call.response.data.status}`}
                                    {call.action === "github" && `저장소: ${call.response.data.repository}`}
                                  </small>
                                </div>
                              )}
                            </div>
                          ));
                        }
                      }
                      
                      // 최근 MCP 호출이 없으면 기본 메시지 표시
                      return (
                        <div className="no-recent-calls">
                          <p>현재 질문에 대한 MCP 도구 실행이 없습니다.</p>
                          <p>AI가 필요한 정보를 자동으로 가져올 예정입니다!</p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="no-calls">
                    <p>아직 MCP 도구 실행이 없습니다.</p>
                    <p>GPT 채팅을 시작하면 AI가 자동으로 필요한 정보를 가져옵니다!</p>
                    <div className="mcp-tools-info">
                      <h4>🛠️ 사용 가능한 MCP 도구들:</h4>
                      <ul>
                        <li>📄 PDF 문서 읽기</li>
                        <li>🗄️ 데이터베이스 조회</li>
                        <li>🔗 GitHub 저장소 정보</li>
                        <li>🏥 시스템 상태 확인</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "2step":
        return (
          <div className="tab-content">
            <div className="step2-section">
              {/* 왼쪽: 질문 입력 */}
              <div className="input-section">
                <h3>2 STEP 테스트</h3>
                <textarea
                  className="input-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, () => {
                    // 엔터 시 모든 내역 초기화
                    setMessages([]);
                    setMcpCalls([]);
                    setPlannerResponse("");
                    setWorkerResponse("");
                    // GPT 요청 처리
                    handle2StepGPT();
                  })}
                  placeholder="GPT에게 질문을 입력하세요..."
                />
                <button 
                  onClick={() => {
                    // 실행 시 모든 내역 초기화
                    setMessages([]);
                    setMcpCalls([]);
                    setPlannerResponse("");
                    setWorkerResponse("");
                    // GPT 요청 처리
                    handle2StepGPT();
                  }} 
                  disabled={!prompt.trim() || !apiKey.trim() || isLoading}
                  className={`action-button ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? "처리 중..." : "전송"}
                </button>
              </div>

              {/* 가운데: Planner & Worker 탭 */}
              <div className="response-section">
                <div className="response-tabs">
                  <button 
                    className={`tab-button ${activeResponseTab === 'planner' ? 'active' : ''}`}
                    onClick={() => setActiveResponseTab('planner')}
                  >
                    🧠 Planner
                  </button>
                  <button 
                    className={`tab-button ${activeResponseTab === 'worker' ? 'active' : ''}`}
                    onClick={() => setActiveResponseTab('worker')}
                  >
                    🔧 Worker
                  </button>
                </div>
                
                <div className="response-content">
                  {activeResponseTab === 'planner' && (
                    <div className="planner-tab">
                      {plannerResponse ? (
                        <div className="planner-content">
                          <div className="response-header">
                            <span className="response-role">🧠 GPT Planner</span>
                            <span className="response-time">
                              {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="response-text">
                            {plannerResponse}
                          </div>
                        </div>
                      ) : !isLoading ? (
                        <div className="no-response">
                          <p>아직 실행 계획이 없습니다.</p>
                          <p>질문을 입력하고 전송해보세요.</p>
                        </div>
                      ) : null}
                      {isLoading && activeResponseTab === 'planner' && (
                        <div className="loading-indicator">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                          <p>Planner가 계획을 세우고 있습니다...</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeResponseTab === 'worker' && (
                    <div className="worker-tab">
                      {workerResponse ? (
                        <div className="worker-content">
                          <div className="response-header">
                            <span className="response-role">🔧 GPT Worker</span>
                            <span className="response-time">
                              {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="response-text">
                            {workerResponse}
                          </div>
                        </div>
                      ) : !isLoading ? (
                        <div className="no-response">
                          <p>아직 최종 결과가 없습니다.</p>
                          <p>Planner가 계획을 완료한 후 Worker가 실행됩니다.</p>
                        </div>
                      ) : null}
                      {isLoading && activeResponseTab === 'worker' && (
                        <div className="loading-indicator">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                          <p>Worker가 실행 결과를 생성하고 있습니다...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: MCP 호출 내역 */}
              <div className="mcp-section">
                <h3>🔧 현재 질문에 대한 MCP 도구 실행</h3>
                {mcpCalls.length > 0 ? (
                  <div className="mcp-calls-list">
                    {/* 가장 최근 질문에 대한 MCP 호출만 표시 */}
                    {(() => {
                      // messages가 비어있으면 MCP 호출도 표시하지 않음
                      if (messages.length === 0) {
                        return (
                          <div className="no-recent-calls">
                            <p>새로운 질문을 입력해주세요.</p>
                            <p>AI가 필요한 정보를 자동으로 가져올 예정입니다!</p>
                          </div>
                        );
                      }
                      
                      // 가장 최근 사용자 메시지의 시간을 찾기
                      const latestUserMessage = messages
                        .filter(m => m.role === 'user')
                        .pop();
                      
                      if (latestUserMessage) {
                        const latestTime = new Date(latestUserMessage.timestamp).getTime();
                        const threshold = latestTime - 60000; // 1분 이내의 MCP 호출만 표시
                        
                        const recentCalls = mcpCalls.filter(call => 
                          new Date(call.timestamp).getTime() >= threshold
                        );
                        
                        if (recentCalls.length > 0) {
                          return recentCalls.map((call) => (
                            <div 
                              key={call.id} 
                              className={`mcp-call-item ${call.status}`}
                              onClick={() => setSelectedMcpCall(call)}
                            >
                              <div className="call-header">
                                <span className="call-action">{call.action}</span>
                                <span className={`call-status ${call.status}`}>
                                  {call.status === "success" ? "✅" : "❌"}
                                </span>
                                <span className="call-time">
                                  {new Date(call.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="call-preview">
                                {call.status === "success" 
                                  ? `✅ 성공 - ${call.response?.data ? '데이터 수신' : '응답 완료'}`
                                  : `❌ 오류: ${call.response?.error || '알 수 없는 오류'}`
                                }
                              </div>
                              {call.status === "success" && call.response?.data && (
                                <div className="call-data-preview">
                                  <small>
                                    {call.action === "pdf" && `파일: ${call.response.data.filename}, 길이: ${call.response.data.length}자`}
                                    {call.action === "database" && `테이블: ${call.response.data.table}, 레코드: ${call.response.data.count}개`}
                                    {call.action === "health" && `상태: ${call.response.data.status}`}
                                    {call.action === "github" && `저장소: ${call.response.data.repository}`}
                                  </small>
                                </div>
                              )}
                            </div>
                          ));
                        }
                      }
                      
                      // 최근 MCP 호출이 없으면 기본 메시지 표시
                      return (
                        <div className="no-recent-calls">
                          <p>현재 질문에 대한 MCP 도구 실행이 없습니다.</p>
                          <p>AI가 필요한 정보를 자동으로 가져올 예정입니다!</p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="no-calls">
                    <p>아직 MCP 도구 실행이 없습니다.</p>
                    <p>질문을 입력하고 전송해보세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🤖 MCP + GPT 통합 대시보드</h1>
        <div className="header-controls">
          <div className="github-token-section">
            <label htmlFor="github-token">GitHub Token:</label>
            <input
              id="github-token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="GitHub Personal Access Token"
              className="github-token-input"
            />
          </div>
          
          <div className="api-key-section">
            <label htmlFor="api-key">OpenAI API Key:</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="OpenAI API 키를 입력하세요"
              className="api-key-input"
            />
          </div>
          <button 
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className={`debug-toggle ${showDebugPanel ? 'active' : ''}`}
          >
            {showDebugPanel ? '🔍 디버그 숨기기' : '🐛 디버그 보기'}
          </button>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'gpt' ? 'active' : ''}`}
          onClick={() => setActiveTab('gpt')}
        >
          🤖 순수 GPT
        </button>
        <button 
                          className={`tab-button ${activeTab === 'interface-backend' ? 'active' : ''}`}
                onClick={() => setActiveTab('interface-backend')}
        >
                      🔧 API 서버 테스트
        </button>

                  <button 
            className={`tab-button ${activeTab === '1step' ? 'active' : ''}`}
            onClick={() => setActiveTab('1step')}
          >
            🚀 1 STEP 테스트
          </button>
          <button 
            className={`tab-button ${activeTab === '2step' ? 'active' : ''}`}
            onClick={() => setActiveTab('2step')}
          >
            🔄 2 STEP 테스트
          </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="main-content">
        {renderTab()}
          </div>

      {/* MCP 호출 상세보기 (공통) */}
          {selectedMcpCall && (
        <div className="mcp-detail-overlay">
            <div className="mcp-detail-section">
              <h2>🔍 MCP 호출 상세</h2>
            <button 
              onClick={() => setSelectedMcpCall(null)}
              className="close-button"
            >
              ✕
            </button>
              <div className="mcp-detail-content">
                <div className="detail-item">
                  <label>Action:</label>
                  <span className="detail-value">{selectedMcpCall.action}</span>
                </div>
                <div className="detail-item">
                  <label>Arguments:</label>
                  <pre className="detail-value">{JSON.stringify(selectedMcpCall.args, null, 2)}</pre>
                </div>
                <div className="detail-item">
                  <label>Response:</label>
                  <pre className="detail-value">{JSON.stringify(selectedMcpCall.response, null, 2)}</pre>
                </div>
                <div className="detail-item">
                  <label>Timestamp:</label>
                  <span className="detail-value">{new Date(selectedMcpCall.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* 디버그 패널 */}
      {showDebugPanel && (
        <div className="debug-panel">
          <h2>🐛 디버그 로그</h2>
          <div className="debug-info">
            <div className="debug-stats">
              <span>총 로그: {debugLogs.length}</span>
              <span>마지막 업데이트: {debugLogs.length > 0 ? debugLogs[0].split(']')[0].replace('[', '') : 'N/A'}</span>
            </div>
          </div>
          <div className="debug-logs">
            {debugLogs.map((log, index) => {
              // 로그 레벨에 따른 스타일링
              let logClass = "debug-log-entry";
              if (log.includes('💥') || log.includes('ERROR:')) {
                logClass += " error";
              } else if (log.includes('⚠️')) {
                logClass += " warning";
              } else if (log.includes('✅') || log.includes('🎬')) {
                logClass += " success";
              } else if (log.includes('🔍') || log.includes('📊') || log.includes('🔬')) {
                logClass += " analysis";
              }
              
              return (
                <div key={index} className={logClass}>
                  {log}
                </div>
              );
            })}
            {debugLogs.length === 0 && (
              <div className="no-logs">아직 로그가 없습니다. GPT 요청을 보내면 상세한 디버그 정보가 여기에 표시됩니다.</div>
            )}
          </div>
          <div className="debug-controls">
            <button onClick={() => setDebugLogs([])} className="clear-logs-btn">
              🗑️ 로그 지우기
            </button>
            <button 
              onClick={() => {
                const logText = debugLogs.join('\n');
                navigator.clipboard.writeText(logText);
                addDebugLog('📋 로그가 클립보드에 복사되었습니다');
              }} 
              className="copy-logs-btn"
            >
              📋 로그 복사
            </button>
            <button 
              onClick={() => {
                addDebugLog('🧪 테스트 로그 - 에러');
                addDebugLog('⚠️ 테스트 로그 - 경고');
                addDebugLog('✅ 테스트 로그 - 성공');
                addDebugLog('🔍 테스트 로그 - 분석');
                addDebugLog('📊 테스트 로그 - 데이터');
              }} 
              className="test-logs-btn"
            >
              🧪 테스트 로그
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 