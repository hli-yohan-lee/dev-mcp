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
  const [githubToken, setGithubToken] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mcpCalls, setMcpCalls] = useState<MCPCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMcpCall, setSelectedMcpCall] = useState<MCPCall | null>(null);
  
  // Planner & Worker 탭 상태
  const [activeResponseTab, setActiveResponseTab] = useState<'planner' | 'worker'>('planner');
  const [plannerResponse, setPlannerResponse] = useState<string>('');
  const [workerResponse, setWorkerResponse] = useState<string>('');
  
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
      
      const response = await fetch(`http://localhost:9000/api/${endpoint}`, {
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

  // 3번 화면: 순수 MCP 호출 (백엔드 API 직접 호출)
  const invokePureMCP = async (action: string, args: any) => {
    try {
      addDebugLog(`🔧 백엔드 API 직접 호출: ${action}`);
      
      // 백엔드 서버로 직접 호출 (포트 9000)
      const response = await fetch(`http://localhost:9000/api/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        // HTTP 에러 처리
        let errorMessage = "";
        switch (response.status) {
          case 400:
            errorMessage = "잘못된 요청입니다. 파라미터를 확인해주세요.";
            break;
          case 404:
            errorMessage = "API 엔드포인트를 찾을 수 없습니다.";
            break;
          case 500:
            errorMessage = "백엔드 서버 내부 오류가 발생했습니다.";
            break;
          default:
            errorMessage = `백엔드 서버 오류 (HTTP ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      addDebugLog(`✅ 백엔드 API 응답: ${JSON.stringify(data).substring(0, 100)}...`);
      
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
      addDebugLog(`💥 백엔드 API 호출 에러: ${error.message}`);
      
      // 네트워크 에러 처리
      let userFriendlyMessage = "";
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        userFriendlyMessage = "백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
      } else if (error.message.includes('Failed to fetch')) {
        userFriendlyMessage = "백엔드 서버 연결에 실패했습니다.";
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
        const pdfResult = await invokePureMCP("pdf", { filename: "백엔드_가이드.pdf" });
        if (pdfResult && pdfResult.status === "success") {
          results.push({
            action: "PDF 읽기 (백엔드 가이드)",
            status: "success",
            summary: `파일: ${pdfResult.response?.data?.filename}, 길이: ${pdfResult.response?.data?.length}자`
          });
        } else {
          results.push({
            action: "PDF 읽기 (백엔드 가이드)",
            status: "error",
            error: pdfResult?.response?.error || "알 수 없는 오류"
          });
        }
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
        const dbResult = await invokePureMCP("database", { table: "users" });
        if (dbResult && dbResult.status === "success") {
          results.push({
            action: "데이터베이스 조회 (사용자)",
            status: "success",
            summary: `테이블: ${dbResult.response?.data?.table}, 레코드: ${dbResult.response?.data?.count}개`
          });
        } else {
          results.push({
            action: "데이터베이스 조회 (사용자)",
            status: "error",
            error: dbResult?.response?.error || "알 수 없는 오류"
          });
        }
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
        const githubResult = await invokePureMCP("github", { 
          repository: "hli-yohan-lee/dev-guide",
          username: "hli-yohan-lee",
          password: githubToken
        });
        if (githubResult && githubResult.status === "success") {
          results.push({
            action: "GitHub 저장소 조회",
            status: "success",
            summary: `저장소: ${githubResult.response?.data?.repository}, 파일 수: ${githubResult.response?.data?.files?.length || 0}개`
          });
        } else {
          results.push({
            action: "GitHub 저장소 조회",
            status: "error",
            error: githubResult?.response?.error || "알 수 없는 오류"
          });
        }
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
        const healthResult = await invokePureMCP("health", {});
        if (healthResult && healthResult.status === "success") {
          results.push({
            action: "백엔드 상태 확인",
            status: "success",
            summary: `상태: ${healthResult.response?.data?.status}`
          });
        } else {
          results.push({
            action: "백엔드 상태 확인",
            status: "error",
            error: healthResult?.response?.error || "알 수 없는 오류"
          });
        }
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

  // 4번 화면: 복합 통합 (OpenAI + MCP 자동 연동)
  const handleCombinedGPT = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
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
      addDebugLog("🚀 복합 GPT 호출 시작 (OpenAI API + MCP 자동 연동)");
      addDebugLog(`📤 요청 데이터: ${JSON.stringify({
        message: prompt,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      }, null, 2)}`);
      
      const requestData = {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `당신은 MCP(Model Context Protocol) 도구들을 사용할 수 있는 AI 어시스턴트입니다. 
사용자의 질문에 답변할 때, 필요한 정보가 있다면 MCP 도구를 사용하여 자동으로 가져와야 합니다.

사용 가능한 MCP 도구들:
- PDF 관련: pdf (파일명으로 PDF 내용 읽기)
- 데이터베이스: database (테이블명으로 데이터 조회)
- GitHub: github (저장소 정보 및 파일 내용)
- 시스템 상태: health (백엔드 상태 확인)

사용자의 질문을 분석하여 필요한 MCP 도구를 자동으로 호출하고, 그 결과를 포함하여 답변하세요.
답변은 친근하고 도움이 되는 톤으로 작성하세요.`
          },
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

      if (response.ok) {
        const data = await response.json();
        addDebugLog(`✅ OpenAI API 응답 수신`);
        
        // OpenAI API 에러 응답 확인
        if (data.error) {
          addDebugLog(`❌ OpenAI API 에러 응답 감지: ${JSON.stringify(data.error)}`);
          const errorMessage = `OpenAI API 에러: ${data.error.message || data.error.type || '알 수 없는 에러'}`;
          
          setPlannerResponse(errorMessage);
          return;
        }
        
        // OpenAI API 정상 응답 확인
        const hasChoices = data.choices && data.choices.length > 0;
        const hasMessage = hasChoices && data.choices[0].message;
        const hasContent = hasMessage && data.choices[0].message.content;
        const contentNotEmpty = hasContent && data.choices[0].message.content.trim() !== "";
        
        if (!hasChoices || !hasMessage || !hasContent || !contentNotEmpty) {
          const emptyResponseMessage = "OpenAI에서 응답을 받았지만 내용이 비어있습니다. 다시 시도해보세요.";
          setPlannerResponse(emptyResponseMessage);
          return;
        }
        
        // 2단계: GPT 응답에서 MCP 도구 사용 필요성 분석
        const gptResponse = data.choices[0].message.content;
        addDebugLog(`🤖 GPT 초기 응답: ${gptResponse.substring(0, 100)}...`);
        
        // MCP 도구 사용이 필요한지 판단
        const needsMcpTools = await analyzeAndUseMcpTools(gptResponse, prompt);
        
        // 3단계: 최종 응답 생성 (MCP 도구 결과 포함)
        let finalResponse = gptResponse;
        if (needsMcpTools.length > 0) {
          finalResponse += "\n\n🔧 **MCP 도구 실행 결과:**\n";
          needsMcpTools.forEach((result, index) => {
            finalResponse += `\n**${index + 1}. ${result.action}**\n`;
            if (result.status === "success") {
              finalResponse += `✅ 성공: ${result.summary}\n`;
            } else {
              finalResponse += `❌ 실패: ${result.error}\n`;
            }
          });
        }
        
        // 스트리밍 효과로 최종 응답 표시
        addDebugLog(`🎬 최종 응답 스트리밍 시작 - 총 ${finalResponse.length}자`);
        let currentText = "";
        
        for (let i = 0; i < finalResponse.length; i++) {
          currentText += finalResponse[i];
          setMessages(prev => 
            prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, content: currentText }
                : msg
            )
          );
          
          // 진행률 로깅 (10% 단위)
          if (i % Math.ceil(finalResponse.length / 10) === 0) {
            const progress = Math.round((i / finalResponse.length) * 100);
            addDebugLog(`📈 스트리밍 진행률: ${progress}% (${i}/${finalResponse.length}자)`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
        }
        
        addDebugLog(`✅ 복합 통합 스트리밍 완료 - 총 ${finalResponse.length}자 표시됨`);
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

  // 실행 계획 파싱 함수
  const parseExecutionPlan = (plannerResponse: string) => {
    try {
      // JSON 배열 형태로 파싱 시도
      const jsonMatch = plannerResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      
      // 마크다운 리스트 형태로 파싱 시도
      const lines = plannerResponse.split('\n');
      const plan = [];
      let currentStep = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('1.') || trimmed.startsWith('2.')) {
          if (currentStep) {
            plan.push(currentStep);
          }
          currentStep = { step: trimmed.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, ''), tool: '', params: {} };
        } else if (currentStep && trimmed.includes('tool:')) {
          currentStep.tool = trimmed.split('tool:')[1].trim().replace(/['"]/g, '');
        } else if (currentStep && trimmed.includes('params:')) {
          try {
            const paramsStr = trimmed.split('params:')[1].trim();
            currentStep.params = JSON.parse(paramsStr);
          } catch (e) {
            // JSON 파싱 실패 시 기본값
            currentStep.params = {};
          }
        }
      }
      
      if (currentStep) {
        plan.push(currentStep);
      }
      
      return plan;
    } catch (error) {
      addDebugLog(`❌ 실행 계획 파싱 실패: ${error.message}`);
      return [];
    }
  };

  // MCP 단계 실행 함수
  const executeMcpStep = async (step: any) => {
    try {
      addDebugLog(`⚡ MCP 단계 실행: ${step.step} (${step.tool})`);
      
      let result;
      switch (step.tool) {
        case 'pdf':
          result = await invokePureMCP('pdf', step.params);
          break;
        case 'database':
          result = await invokePureMCP('database', step.params);
          break;
        case 'github':
          result = await invokePureMCP('github', { ...step.params, password: githubToken });
          break;
        case 'health':
          result = await invokePureMCP('health', step.params);
          break;
        default:
          throw new Error(`알 수 없는 도구: ${step.tool}`);
      }
      
      return {
        step: step.step,
        tool: step.tool,
        status: result.status,
        data: result.response?.data,
        error: result.response?.error
      };
    } catch (error: any) {
      addDebugLog(`❌ MCP 단계 실행 실패: ${error.message}`);
      return {
        step: step.step,
        tool: step.tool,
        status: 'error',
        error: error.message
      };
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
            <div className="mcp-pure-section">
              <div className="mcp-tools">
                <h4>📄 PDF 관련</h4>
                <div className="tool-buttons">
                  <button 
                    onClick={() => invokePureMCP("pdf", { filename: "백엔드_가이드.pdf" })}
                    className="mcp-tool-button"
                  >
                    백엔드 가이드 PDF 읽기
                  </button>
                  <button 
                    onClick={() => invokePureMCP("pdf", { filename: "프론트_가이드.pdf" })}
                    className="mcp-tool-button"
                  >
                    프론트 가이드 PDF 읽기
                  </button>
                  <button 
                    onClick={() => invokePureMCP("pdf", { filename: "디비_가이드.pdf" })}
                    className="mcp-tool-button"
                  >
                    디비 가이드 PDF 읽기
                  </button>
                </div>

                <h4>🗄️ 데이터베이스</h4>
                <div className="tool-buttons">
                  <button 
                    onClick={() => invokePureMCP("database", { table: "users" })}
                    className="mcp-tool-button"
                  >
                    사용자 목록 조회
                  </button>
                  <button 
                    onClick={() => invokePureMCP("database", { table: "guides" })}
                    className="mcp-tool-button"
                  >
                    가이드 목록 조회
                  </button>
                  <button 
                    onClick={() => invokePureMCP("database", { 
                      table: "users", 
                      filters: { role: "backend" } 
                    })}
                    className="mcp-tool-button"
                  >
                    백엔드 개발자만 조회
                  </button>
                </div>

                <h4>📊 시스템 상태</h4>
                <div className="tool-buttons">
                  <button 
                    onClick={() => invokePureMCP("health", {})}
                    className="mcp-tool-button"
                  >
                    백엔드 상태 확인
                  </button>
                </div>
              </div>

              {mcpCalls.length > 0 && (
                <div className="mcp-results">
                  <h4>📋 MCP 호출 결과</h4>
                  <div className="mcp-calls-list">
                    {mcpCalls.slice(0, 5).map((call) => (
                      <div 
                        key={call.id} 
                        className={`mcp-call-item ${call.status}`}
                        onClick={() => setSelectedMcpCall(call)}
                      >
                        <div className="call-header">
                          <span className="call-action">{call.action}</span>
                          <span className="call-status">{call.status}</span>
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
                            </small>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MCP 호출 상세보기 */}
              {selectedMcpCall && (
                <div className="mcp-detail-overlay" onClick={() => setSelectedMcpCall(null)}>
                  <div className="mcp-detail-section" onClick={(e) => e.stopPropagation()}>
                    <button className="close-button" onClick={() => setSelectedMcpCall(null)}>×</button>
                    <h3>MCP 호출 상세보기</h3>
                    <div className="detail-content">
                      <div className="detail-section">
                        <h4>📤 요청 정보</h4>
                        <p><strong>액션:</strong> {selectedMcpCall.action}</p>
                        <p><strong>파라미터:</strong></p>
                        <pre>{JSON.stringify(selectedMcpCall.args, null, 2)}</pre>
                      </div>
                      
                      <div className="detail-section">
                        <h4>📥 응답 정보</h4>
                        <p><strong>상태:</strong> <span className={`status-badge ${selectedMcpCall.status}`}>{selectedMcpCall.status}</span></p>
                        <p><strong>시간:</strong> {new Date(selectedMcpCall.timestamp).toLocaleString()}</p>
                        <p><strong>응답 데이터:</strong></p>
                        <pre>{JSON.stringify(selectedMcpCall.response, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case "combined":
        return (
          <div className="tab-content">
            <div className="combined-section">
              {/* 왼쪽: 질문 입력 */}
              <div className="input-section">
                <h3>GPT 채팅</h3>
                <textarea
                  className="input-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, () => {
                    // 엔터 시 중간과 오른쪽 내역 초기화
                    setMessages([]);
                    setMcpCalls([]);
                    // GPT 요청 처리
                    handleCombinedGPT();
                  })}
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
                      <h3>🧠 Planner - 실행 계획</h3>
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
                      ) : (
                        <div className="no-response">
                          <p>아직 실행 계획이 없습니다.</p>
                          <p>질문을 입력하고 전송해보세요.</p>
                        </div>
                      )}
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
                      <h3>🔧 Worker - 최종 실행 결과</h3>
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
                      ) : (
                        <div className="no-response">
                          <p>아직 최종 결과가 없습니다.</p>
                          <p>Planner가 계획을 완료한 후 Worker가 실행됩니다.</p>
                        </div>
                      )}
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