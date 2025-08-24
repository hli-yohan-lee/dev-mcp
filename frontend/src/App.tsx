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

type TabType = "gpt" | "mcp-backend" | "mcp-pure" | "combined";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("gpt");
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mcpCalls, setMcpCalls] = useState<MCPCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMcpCall, setSelectedMcpCall] = useState<MCPCall | null>(null);
  
  // MCP 파라미터 입력 상태
  const [mcpParams, setMcpParams] = useState({
    projectPath: "corp/policies",
    pdfPath: "2025/AnnexA.pdf",
    pdfRef: "v2025.08",
    project: "corp/policies"
  });

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
        const valueLength = value?.length || 'N/A';
        const valuePreview = valueType === 'string' 
          ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`
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
        model: "gpt-3.5-turbo",
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
      
      const response = await fetch(`http://localhost:9001/api/${endpoint}`, {
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

  // 3번 화면: 순수 MCP 호출
  const invokePureMCP = async (action: string, args: any) => {
    try {
      addDebugLog(`🔧 순수 MCP 호출: ${action}`);
      
      const response = await fetch(`http://localhost:9000/mcp/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, args }),
      });

      if (!response.ok) {
        // HTTP 에러 처리
        let errorMessage = "";
        switch (response.status) {
          case 400:
            errorMessage = "잘못된 MCP 요청입니다. 파라미터를 확인해주세요.";
            break;
          case 404:
            errorMessage = "MCP 엔드포인트를 찾을 수 없습니다. 서버 설정을 확인해주세요.";
            break;
          case 500:
            errorMessage = "MCP 서버 내부 오류가 발생했습니다.";
            break;
          default:
            errorMessage = `MCP 서버 오류 (HTTP ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      addDebugLog(`✅ 순수 MCP 응답: ${JSON.stringify(data).substring(0, 100)}...`);
      
      const mcpCall: MCPCall = {
        id: Date.now().toString(),
        action,
        args,
        response: data,
        timestamp: new Date().toISOString(),
        status: data.ok ? "success" : "error",
      };

      setMcpCalls(prev => [mcpCall, ...prev]);
      return mcpCall;
    } catch (error: any) {
      addDebugLog(`💥 순수 MCP 에러: ${error.message}`);
      
      // 네트워크 에러 처리
      let userFriendlyMessage = "";
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        userFriendlyMessage = "MCP 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
      } else if (error.message.includes('Failed to fetch')) {
        userFriendlyMessage = "MCP 서버 연결에 실패했습니다.";
      } else {
        userFriendlyMessage = error.message;
      }
      
      const errorCall: MCPCall = {
        id: Date.now().toString(),
        action,
        args,
        response: { error: userFriendlyMessage },
        timestamp: new Date().toISOString(),
        status: "error",
      };
      setMcpCalls(prev => [errorCall, ...prev]);
      return errorCall;
    }
  };

  // 4번 화면: 복합 통합 (기존 기능)
  const handleCombinedGPT = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
    // API 키 검증
    const cleanApiKey = apiKey.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);

    try {
      addDebugLog("🚀 복합 GPT 호출 시작");
      addDebugLog(`📤 요청 데이터: ${JSON.stringify({
        message: prompt,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      }, null, 2)}`);
      
      const response = await fetch("http://localhost:9000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanApiKey}`,
        },
        body: JSON.stringify({
          message: prompt,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      addDebugLog(`📡 HTTP 응답 상태: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        
        // 전체 응답 구조를 상세히 분석
        analyzeResponseStructure(data, "복합 GPT 응답");
        
        // JSON 형태로도 로깅 (백업용)
        addDebugLog(`📊 JSON 형태 응답:`);
        addDebugLog(`${JSON.stringify(data, null, 2)}`);
        
        // 응답 내용 확인 및 처리
        addDebugLog(`🔍 응답 내용 검증:`);
        
        // 백엔드 에러 응답 확인
        if (data.ok === false && data.error) {
          addDebugLog(`❌ 백엔드 에러 응답 감지: ${data.error}`);
          const responseContent = `서버 에러: ${data.error}`;
          
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: responseContent,
            timestamp: new Date().toISOString(),
          };
          
          addDebugLog(`💬 에러 메시지 생성 완료: ID=${assistantMessage.id}`);
          setMessages(prev => [...prev, assistantMessage]);
          return;
        }
        
        // 정상 응답 확인
        const responseExists = data.response !== undefined && data.response !== null;
        const responseNotEmpty = responseExists && data.response.trim() !== "";
        
        addDebugLog(`- 응답 존재 여부: ${responseExists}`);
        addDebugLog(`- 응답 비어있지 않음: ${responseNotEmpty}`);
        
        const responseContent = (!responseExists || !responseNotEmpty) 
          ? "응답을 받았지만 내용이 비어있습니다. 다시 시도해보세요."
          : data.response;
        
        if (!responseExists || !responseNotEmpty) {
          addDebugLog(`⚠️ 빈 응답 감지 - 대체 메시지 사용`);
        } else {
          addDebugLog(`✅ 정상 응답 처리`);
        }
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseContent,
          timestamp: new Date().toISOString(),
        };
        
        addDebugLog(`💬 메시지 생성 완료: ID=${assistantMessage.id}, 길이=${responseContent.length}자`);
        setMessages(prev => [...prev, assistantMessage]);
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
      // 상세한 에러 정보 로깅 (복합 모드)
      addDebugLog(`💥 복합 GPT 에러 발생:`);
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

      case "mcp-backend":
        return (
          <div className="tab-content">
            <div className="mcp-backend-section">
              <div className="backend-tools">
                <h3>API 도구</h3>
                <button 
                  onClick={() => testAPIBackend("github", { 
                    repository: "hli-yohan-lee/dev-guide",
                    username: "hli-yohan-lee",
                    password: "test"
                  })}
                  className="mcp-tool-button"
                >
                  🔗 GitHub 저장소
                </button>
                <button 
                  onClick={() => testAPIBackend("pdf", { 
                    filename: "백엔드_가이드.pdf"
                  })}
                  className="mcp-tool-button"
                >
                  📄 PDF 내용 읽기
                </button>
                <button 
                  onClick={() => testAPIBackend("database", { 
                    table: "users",
                    filters: { role: "backend" }
                  })}
                  className="mcp-tool-button"
                >
                  🗄️ 데이터베이스 조회
                </button>
              </div>

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
        );

      case "mcp-pure":
        return (
          <div className="tab-content">
            <div className="mcp-backend-section">
              <div className="mcp-params">
                <h3>파라미터 설정</h3>
                <div className="param-group">
                  <label>프로젝트 경로:</label>
                  <input
                    type="text"
                    value={mcpParams.projectPath}
                    onChange={(e) => setMcpParams(prev => ({...prev, projectPath: e.target.value}))}
                    placeholder="corp/policies"
                  />
                </div>
                <div className="param-group">
                  <label>PDF 경로:</label>
                  <input
                    type="text"
                    value={mcpParams.pdfPath}
                    onChange={(e) => setMcpParams(prev => ({...prev, pdfPath: e.target.value}))}
                    placeholder="2025/AnnexA.pdf"
                  />
                </div>
                <div className="param-group">
                  <label>PDF 참조:</label>
                  <input
                    type="text"
                    value={mcpParams.pdfRef}
                    onChange={(e) => setMcpParams(prev => ({...prev, pdfRef: e.target.value}))}
                    placeholder="v2025.08"
                  />
                </div>
                <div className="param-group">
                  <label>GitLab 프로젝트:</label>
                  <input
                    type="text"
                    value={mcpParams.project}
                    onChange={(e) => setMcpParams(prev => ({...prev, project: e.target.value}))}
                    placeholder="corp/policies"
                  />
                </div>
              </div>

              <div className="mcp-tools">
                <h3>MCP 도구</h3>
                <button 
                  onClick={() => invokePureMCP("PDF_METADATA", { 
                    doc_ref: { 
                      type: "GITLAB", 
                      project_path: mcpParams.projectPath, 
                      path: mcpParams.pdfPath, 
                      ref: mcpParams.pdfRef 
                    } 
                  })}
                  className="mcp-tool-button"
                >
                  📄 PDF 메타데이터
                </button>
                <button 
                  onClick={() => invokePureMCP("PDF_TEXT", { 
                    doc_ref: { 
                      type: "GITLAB", 
                      project_path: mcpParams.projectPath, 
                      path: mcpParams.pdfPath, 
                      ref: mcpParams.pdfRef 
                    } 
                  })}
                  className="mcp-tool-button"
                >
                  📝 PDF 텍스트 추출
                </button>
                <button 
                  onClick={() => invokePureMCP("GITLAB_GUIDE", { 
                    project: mcpParams.project 
                  })}
                  className="mcp-tool-button"
                >
                  🚀 GitLab 가이드
                </button>
              </div>
            </div>
          </div>
        );

      case "combined":
        return (
          <div className="tab-content">
            <div className="combined-section">
              <div className="input-section">
                <h3>GPT 채팅</h3>
                <textarea
                  className="input-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="GPT에게 질문을 입력하세요..."
                />
                <button 
                  onClick={handleCombinedGPT} 
                  disabled={!prompt.trim() || !apiKey.trim() || isLoading}
                  className={`action-button ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? "처리 중..." : "전송"}
                </button>
              </div>

              <div className="mcp-section">
                <h3>MCP 도구</h3>
                <button 
                  onClick={() => invokePureMCP("PDF_METADATA", { 
                    doc_ref: { 
                      type: "GITLAB", 
                      project_path: mcpParams.projectPath, 
                      path: mcpParams.pdfPath, 
                      ref: mcpParams.pdfRef 
                    } 
                  })}
                  className="mcp-tool-button"
                >
                  📄 PDF 메타데이터
                </button>
                <button 
                  onClick={() => invokePureMCP("PDF_TEXT", { 
                    doc_ref: { 
                      type: "GITLAB", 
                      project_path: mcpParams.projectPath, 
                      path: mcpParams.pdfPath, 
                      ref: mcpParams.pdfRef 
                    } 
                  })}
                  className="mcp-tool-button"
                >
                  📝 PDF 텍스트 추출
                </button>
                <button 
                  onClick={() => invokePureMCP("GITLAB_GUIDE", { 
                    project: mcpParams.project 
                  })}
                  className="mcp-tool-button"
                >
                  🚀 GitLab 가이드
                </button>
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
          <div className="api-key-section">
            <label htmlFor="api-key">API 키:</label>
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
          className={`tab-button ${activeTab === 'mcp-backend' ? 'active' : ''}`}
          onClick={() => setActiveTab('mcp-backend')}
        >
          🔧 API 백엔드
        </button>
        <button 
          className={`tab-button ${activeTab === 'mcp-pure' ? 'active' : ''}`}
          onClick={() => setActiveTab('mcp-pure')}
        >
          🔧 순수 MCP
        </button>
        <button 
          className={`tab-button ${activeTab === 'combined' ? 'active' : ''}`}
          onClick={() => setActiveTab('combined')}
        >
          🚀 복합 통합
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