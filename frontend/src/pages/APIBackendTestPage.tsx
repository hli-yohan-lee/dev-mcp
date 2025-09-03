import React, { useState } from 'react';
import { MCPCall } from '../types';

interface APIBackendTestPageProps {
  addDebugLog: (message: string) => void;
  githubToken: string;
}

export const APIBackendTestPage: React.FC<APIBackendTestPageProps> = ({ addDebugLog, githubToken }) => {
  const [mcpCalls, setMcpCalls] = useState<MCPCall[]>([]);
  const [selectedMcpCall, setSelectedMcpCall] = useState<MCPCall | null>(null);

  // 2번 화면: API 백엔드 테스트
  const testAPIBackend = async (endpoint: string, data: any) => {
    const callId = Date.now().toString();
    
    // 즉시 로딩 상태로 추가
    const loadingCall: MCPCall = {
      id: callId,
      action: endpoint,
      args: data,
      response: { loading: true },
      timestamp: new Date().toISOString(),
      status: "loading",
    };
    
    setMcpCalls(prev => [loadingCall, ...prev]);
    
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
      
      // 로딩 상태를 성공 상태로 업데이트
      setMcpCalls(prev => prev.map(call => 
        call.id === callId 
          ? { ...call, response: responseData, status: responseData.ok ? "success" : "error" }
          : call
      ));
      
      return { id: callId, action: endpoint, args: data, response: responseData, timestamp: new Date().toISOString(), status: responseData.ok ? "success" : "error" };
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
      
      // 로딩 상태를 에러 상태로 업데이트
      setMcpCalls(prev => prev.map(call => 
        call.id === callId 
          ? { ...call, response: { error: userFriendlyMessage }, status: "error" }
          : call
      ));
      
      return { id: callId, action: endpoint, args: data, response: { error: userFriendlyMessage }, timestamp: new Date().toISOString(), status: "error" };
    }
  };

  return (
    <div className="tab-content">
      <div className="combined-section">
        {/* 왼쪽: API 테스트 버튼들 */}
        <div className="input-section">
          <div className="api-test-buttons">
            <h4>PDF API 테스트</h4>
            <div className="button-row">
              <button onClick={() => testAPIBackend("pdf", { filename: "백엔드_가이드.pdf" })}>
                백엔드 가이드 PDF 읽기
              </button>
              <button onClick={() => testAPIBackend("pdf", { filename: "프론트_가이드.pdf" })}>
                프론트 가이드 PDF 읽기
              </button>
              <button onClick={() => testAPIBackend("pdf", { filename: "디비_가이드.pdf" })}>
                디비 가이드 PDF 읽기
              </button>
            </div>
            
            <h4>데이터베이스 API 테스트</h4>
            <div className="button-row">
              <button onClick={() => testAPIBackend("database", { table: "users" })}>
                users 테이블 조회
              </button>
              <button onClick={() => testAPIBackend("database", { table: "guides" })}>
                guides 테이블 조회
              </button>
              <button onClick={() => testAPIBackend("database", { table: "users", filters: { role: "backend" } })}>
                backend 역할 사용자 조회
              </button>
            </div>
            <div className="button-row">
              <button onClick={() => testAPIBackend("database", { table: "users", filters: { role: "frontend" } })}>
                frontend 역할 사용자 조회
              </button>
              <button onClick={() => testAPIBackend("database", { table: "users", filters: { role: "database" } })}>
                database 역할 사용자 조회
              </button>
            </div>
            
            <h4>GitHub API 테스트</h4>
            <div className="button-row">
              <button onClick={() => testAPIBackend("github", { 
                repository: "hli-yohan-lee/dev-guide", 
                username: "hli.yohan.lee", 
                password: githubToken, 
                file_path: "API_가이드.pdf" 
              })}>
                API 가이드 조회
              </button>
              <button onClick={() => testAPIBackend("github", { 
                repository: "hli-yohan-lee/dev-guide", 
                username: "hli.yohan.lee", 
                password: githubToken, 
                file_path: "GIT_가이드.pdf" 
              })}>
                GIT 가이드 조회
              </button>
            </div>
            
            <h4>시스템 상태 API 테스트</h4>
            <div className="button-row">
              <button onClick={() => testAPIBackend("health", {})}>
                시스템 상태 확인
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: MCP 호출 내역 */}
        <div className="response-section">
          <div className="response-content">
            {mcpCalls.length === 0 ? (
              <div className="empty-state">
                <div>
                  <h3>API 테스트 준비 완료</h3>
                  <p>왼쪽의 버튼을 클릭하여 API 테스트를 시작하세요.</p>
                  <div className="grid-container">
                    <div className="api-card">
                      <div className="icon">📄</div>
                      <div className="title">PDF API</div>
                      <div className="count">3개 도구</div>
                    </div>
                    <div className="api-card">
                      <div className="icon">🗄️</div>
                      <div className="title">Database API</div>
                      <div className="count">5개 도구</div>
                    </div>
                    <div className="api-card">
                      <div className="icon">🐙</div>
                      <div className="title">GitHub API</div>
                      <div className="count">2개 도구</div>
                    </div>
                    <div className="api-card">
                      <div className="icon">💻</div>
                      <div className="title">System API</div>
                      <div className="count">1개 도구</div>
                    </div>
                  </div>
                  <p className="summary">총 11개의 API 도구를 테스트할 수 있습니다</p>
                </div>
              </div>
            ) : (
              <div className="mcp-calls-container">
                {mcpCalls.map((call) => (
                  <div 
                    key={call.id} 
                    className={`mcp-call ${call.status}`}
                    onClick={() => setSelectedMcpCall(call)}
                  >
                                      <div className="call-header">
                    <span className="action-badge">{call.action}</span>
                    <span className="status-badge">{call.status}</span>
                    <span className="args-preview">{JSON.stringify(call.args).substring(0, 120)}...</span>
                    <span className="timestamp">{new Date(call.timestamp).toLocaleTimeString()}</span>
                  </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 선택된 MCP 호출 상세 정보 */}
      {selectedMcpCall && (
        <div className="mcp-call-detail">
          <h3>MCP 호출 상세 정보</h3>
          <div className="detail-content">
            <div className="detail-section">
              <h4>Action</h4>
              <p>{selectedMcpCall.action}</p>
            </div>
            <div className="detail-section">
              <h4>Arguments</h4>
              <pre>{JSON.stringify(selectedMcpCall.args, null, 2)}</pre>
            </div>
            <div className="detail-section">
              <h4>Response</h4>
              <pre>{JSON.stringify(selectedMcpCall.response, null, 2)}</pre>
            </div>
            <div className="detail-section">
              <h4>Status</h4>
              <p>{selectedMcpCall.status}</p>
            </div>
            <div className="detail-section">
              <h4>Timestamp</h4>
              <p>{new Date(selectedMcpCall.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={() => setSelectedMcpCall(null)}>닫기</button>
        </div>
      )}
    </div>
  );
}; 