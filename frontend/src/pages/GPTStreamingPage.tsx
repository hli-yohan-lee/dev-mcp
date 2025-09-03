import React, { useState } from 'react';

interface GPTStreamingPageProps {
  apiKey: string;
  addDebugLog: (message: string) => void;
}

export const GPTStreamingPage: React.FC<GPTStreamingPageProps> = ({ apiKey, addDebugLog }) => {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  const handleGPTStream = async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    
    // 실행 시 응답 초기화
    setResponse("");
    setIsLoading(true);

    try {
      addDebugLog("🚀 GPT 스트리밍 시작 (직접 OpenAI API 호출)");
      
      const requestData = {
        model: "gpt-5-mini",
        messages: [
          { role: "user", content: prompt }
        ],
        stream: false
      };
      
      addDebugLog(`📤 OpenAI API 요청 데이터: ${JSON.stringify(requestData, null, 2)}`);
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestData),
      });

      addDebugLog(`📡 HTTP 응답 상태: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        
        // 전체 응답 구조를 상세히 분석
        analyzeResponseStructure(data, "GPT 스트리밍 응답");
        
        // OpenAI API 응답 처리
        if (data.error) {
          const errorMessage = `OpenAI API 에러: ${data.error.message || data.error.type || '알 수 없는 에러'}`;
          setResponse(errorMessage);
          return;
        }
        
        // OpenAI API 정상 응답 확인
        const hasChoices = data.choices && data.choices.length > 0;
        const hasMessage = hasChoices && data.choices[0].message;
        const hasContent = hasMessage && data.choices[0].message.content;
        const contentNotEmpty = hasContent && data.choices[0].message.content.trim() !== "";
        
        if (!hasChoices || !hasMessage || !hasContent || !contentNotEmpty) {
          const emptyResponseMessage = "OpenAI에서 응답을 받았지만 내용이 비어있습니다. 다시 시도해주세요.";
          setResponse(emptyResponseMessage);
          return;
        }
        
        // 스트리밍 효과로 한 글자씩 표시
        const responseText = data.choices[0].message.content;
        let currentText = "";
        
        for (let i = 0; i < responseText.length; i++) {
          currentText += responseText[i];
          setResponse(currentText);
          await new Promise(resolve => setTimeout(resolve, 20)); // 20ms 딜레이
        }
        
        addDebugLog(`✅ GPT 스트리밍 완료 - ${responseText.length}자`);
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
            errorMessage = "OpenAI 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            break;
          default:
            errorMessage = `HTTP 오류 (${response.status})`;
        }
        
        setResponse(errorMessage);
      }
    } catch (error: any) {
      addDebugLog(`💥 GPT 스트리밍 에러: ${error.message}`);
      setResponse(`💻 에러가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tab-content">
      <div className="combined-section">
        {/* 왼쪽: 질문 입력 */}
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
            onClick={handleGPTStream}
            disabled={isLoading || !prompt.trim() || !apiKey.trim()}
          >
            {isLoading ? "처리 중..." : "질문 시작"}
          </button>
        </div>

        {/* 오른쪽: 스트리밍 응답 */}
        <div className="response-section">
          <div className="response-content">
            {response && (
              <div className="response-text">
                <pre>{response}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 