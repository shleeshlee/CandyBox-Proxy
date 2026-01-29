/**
 * CottonCandy Proxy - AI Studio Applet
 * 棉花糖代理 - 核心引擎
 * 
 * 作者: shleeshlee & Claude
 * 端口: HTTP 8811 / WebSocket 9111
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// ============================================
// 配置
// ============================================
const CONFIG = {
  WS_URL: 'ws://127.0.0.1:9111',
  GEMINI_API: 'https://generativelanguage.googleapis.com',
  PRESET_MODELS: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
};

// ============================================
// 类型定义
// ============================================
interface LogEntry {
  id: string;
  time: string;
  type: 'system' | 'request' | 'response' | 'error';
  message: string;
}

// Server发来的请求格式（关键！这是生命线）
interface ProxyRequest {
  request_id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body: string;
}

// ============================================
// 工具函数
// ============================================
const Helpers = {
  // 注入CORS头
  injectCORSHeaders(headers: Record<string, string> = {}) {
    return {
      ...headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    };
  },

  // 生成时间戳
  timestamp() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false });
  },
};

// ============================================
// 主应用
// ============================================
function App() {
  // --- 状态 ---
  const [isConnected, setIsConnected] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ calls: 0, tokens: 0 });

  // --- Refs ---
  const wsRef = useRef<WebSocket | null>(null);
  const shouldReconnect = useRef(false);

  // --- 日志 ---
  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => {
      const newLogs = [...prev, {
        id: Math.random().toString(36).slice(2),
        time: Helpers.timestamp(),
        type,
        message,
      }];
      return newLogs.slice(-100); // 保留最近100条
    });
  }, []);

  // --- 检查登录状态 ---
  const checkLogin = useCallback(async () => {
    try {
      const res = await fetch(`${CONFIG.GEMINI_API}/v1beta/models?pageSize=1`, {
        credentials: 'include',
      });
      const loggedIn = res.ok;
      setIsLoggedIn(loggedIn);
      addLog('system', loggedIn ? '✓ Google 登录状态正常' : '✗ 未检测到登录，请先登录 Google');
      return loggedIn;
    } catch (e) {
      setIsLoggedIn(false);
      addLog('error', '检查登录状态失败');
      return false;
    }
  }, [addLog]);

  // --- WebSocket 消息发送 ---
  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // --- 核心：处理代理请求 ---
  const handleProxyRequest = useCallback(async (request: ProxyRequest) => {
    const { request_id, path, method, headers, query_params, body } = request;

    addLog('request', `[${request_id.slice(-6)}] ${method} ${path}`);

    // 1. 处理 OPTIONS 预检请求
    if (method === 'OPTIONS') {
      sendMessage({
        request_id,
        event_type: 'response_headers',
        status: 204,
        headers: Helpers.injectCORSHeaders(),
      });
      sendMessage({ request_id, event_type: 'stream_close' });
      return;
    }

    // 2. 构建目标URL
    let targetPath = path.startsWith('/') ? path.slice(1) : path;
    const params = new URLSearchParams(query_params);
    
    // 移除可能存在的 key 参数（安全）
    params.delete('key');
    
    const queryString = params.toString();
    const url = `${CONFIG.GEMINI_API}/${targetPath}${queryString ? '?' + queryString : ''}`;

    // 3. 构建请求选项
    const fetchHeaders: Record<string, string> = { ...headers };
    // 移除不能手动设置的头
    ['host', 'origin', 'referer', 'content-length'].forEach(k => {
      delete fetchHeaders[k];
      delete fetchHeaders[k.toLowerCase()];
    });

    const fetchOptions: RequestInit = {
      method,
      headers: fetchHeaders,
      credentials: 'include', // 关键！使用浏览器cookie
    };

    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      fetchOptions.body = body;
    }

    try {
      // 4. 发起请求
      const response = await fetch(url, fetchOptions);

      // 5. 发送响应头
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });

      sendMessage({
        request_id,
        event_type: 'response_headers',
        status: response.status,
        headers: Helpers.injectCORSHeaders(responseHeaders),
      });

      // 6. 流式传输响应体
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let tokenCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // 尝试提取token计数
          const tokenMatch = chunk.match(/"totalTokenCount"\s*:\s*(\d+)/);
          if (tokenMatch) {
            tokenCount = parseInt(tokenMatch[1], 10);
          }

          sendMessage({
            request_id,
            event_type: 'chunk',
            data: chunk,
          });
        }

        // 更新统计
        setStats(prev => ({
          calls: prev.calls + 1,
          tokens: prev.tokens + tokenCount,
        }));
      }

      // 7. 发送结束信号
      sendMessage({ request_id, event_type: 'stream_close' });
      addLog('response', `[${request_id.slice(-6)}] 完成 (${response.status})`);

    } catch (err: any) {
      addLog('error', `[${request_id.slice(-6)}] 失败: ${err.message}`);
      sendMessage({
        request_id,
        event_type: 'error',
        status: 500,
        message: err.message,
      });
    }
  }, [addLog, sendMessage]);

  // --- WebSocket 连接 ---
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addLog('system', 'WebSocket 已经连接');
      return;
    }

    addLog('system', `正在连接 ${CONFIG.WS_URL}...`);
    shouldReconnect.current = true;

    try {
      const ws = new WebSocket(CONFIG.WS_URL);

      ws.onopen = () => {
        setIsConnected(true);
        addLog('system', '✓ WebSocket 连接成功');
      };

      ws.onclose = (e) => {
        setIsConnected(false);
        wsRef.current = null;
        
        if (shouldReconnect.current) {
          addLog('system', `连接断开 [${e.code}]，3秒后重连...`);
          setTimeout(connect, 3000);
        } else {
          addLog('system', '连接已断开');
        }
      };

      ws.onerror = () => {
        addLog('error', '连接错误，请确保 Server 已启动');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          // 处理中断信号
          if (msg.event_type === 'abort') {
            addLog('system', `请求 ${msg.request_id} 被中断`);
            return;
          }
          
          // 处理代理请求
          if (msg.request_id && msg.path) {
            handleProxyRequest(msg as ProxyRequest);
          }
        } catch (e) {
          addLog('error', '解析消息失败');
        }
      };

      wsRef.current = ws;
    } catch (e: any) {
      addLog('error', `连接失败: ${e.message}`);
    }
  }, [addLog, handleProxyRequest]);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    wsRef.current?.close();
    setIsConnected(false);
  }, []);

  // --- 初始化 ---
  useEffect(() => {
    checkLogin();
    return () => {
      shouldReconnect.current = false;
      wsRef.current?.close();
    };
  }, [checkLogin]);

  // --- 渲染 ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-cyan-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        
        {/* 头部 */}
        <div className="glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🍬</span>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                  CottonCandy Proxy
                </h1>
                <p className="text-xs text-gray-500">棉花糖代理 · 端口 8811/9111</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isLoggedIn ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-300'}`} />
            </div>
          </div>

          {/* 状态栏 */}
          <div className="flex gap-2 text-sm mb-4">
            <span className={`px-3 py-1 rounded-full ${isLoggedIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isLoggedIn ? '已登录 Google' : '未登录'}
            </span>
            <span className={`px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {isConnected ? 'WS 已连接' : 'WS 未连接'}
            </span>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={isConnected ? disconnect : connect}
              className={`flex-1 py-3 rounded-2xl font-bold text-white transition-all active:scale-95 ${
                isConnected
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600'
                  : 'bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 shadow-lg shadow-pink-200'
              }`}
            >
              {isConnected ? '断开连接' : '启动服务'}
            </button>
            <button
              onClick={checkLogin}
              className="px-4 py-3 rounded-2xl bg-white/60 hover:bg-white/80 text-gray-600 font-medium transition-all active:scale-95"
            >
              刷新状态
            </button>
          </div>
        </div>

        {/* 统计 */}
        <div className="glass-card rounded-3xl p-4">
          <div className="flex justify-around text-center">
            <div>
              <div className="text-2xl font-bold text-purple-500">{stats.calls}</div>
              <div className="text-xs text-gray-500">请求次数</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <div className="text-2xl font-bold text-pink-500">{stats.tokens.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Token 消耗</div>
            </div>
          </div>
        </div>

        {/* 日志 */}
        <div className="glass-card rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">📋 运行日志</span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              清空
            </button>
          </div>
          <div className="h-64 overflow-y-auto space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-400 text-center py-8">等待日志...</div>
            ) : (
              logs.map(log => (
                <div
                  key={log.id}
                  className={`px-2 py-1 rounded ${
                    log.type === 'error' ? 'bg-red-50 text-red-600' :
                    log.type === 'request' ? 'bg-blue-50 text-blue-600' :
                    log.type === 'response' ? 'bg-green-50 text-green-600' :
                    'bg-gray-50 text-gray-600'
                  }`}
                >
                  <span className="text-gray-400 mr-2">[{log.time}]</span>
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 使用说明 */}
        {!isLoggedIn && (
          <div className="glass-card rounded-3xl p-4 border border-pink-200">
            <p className="text-sm text-gray-600 mb-3">
              ⚠️ 请先在此浏览器登录 Google 账号，代理需要借用您的登录状态访问 Gemini API。
            </p>
            <a
              href="https://accounts.google.com/AddSession"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all"
            >
              去登录 Google →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// 样式
// ============================================
const style = document.createElement('style');
style.textContent = `
  .glass-card {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  }
  
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #e9d5ff;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #d8b4fe;
  }
`;
document.head.appendChild(style);

// ============================================
// 挂载
// ============================================
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<App />);
}
