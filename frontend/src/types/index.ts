export interface MCPCall {
  id: string;
  action: string;
  args: any;
  response: any;
  timestamp: string;
  status: 'success' | 'error' | 'loading';
}

export type ResponseTabType = 'response' | 'mcp' | 'planner' | 'worker';
