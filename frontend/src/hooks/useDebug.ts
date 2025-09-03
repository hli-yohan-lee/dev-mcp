import { useState } from 'react';

export const useDebug = () => {
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [logEntry, ...prev.slice(0, 49)]);
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
  };

  const toggleDebugPanel = () => {
    setShowDebugPanel(prev => !prev);
  };

  return {
    debugLogs,
    showDebugPanel,
    addDebugLog,
    clearDebugLogs,
    toggleDebugPanel
  };
}; 