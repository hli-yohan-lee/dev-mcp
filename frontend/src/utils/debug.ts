export const addDebugLog = (message: string, setDebugLogs: React.Dispatch<React.SetStateAction<string[]>>) => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  setDebugLogs(prev => [logEntry, ...prev.slice(0, 49)]);
};

export const analyzeResponseStructure = (data: any, context: string = "응답", addDebugLog: (message: string) => void) => {
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