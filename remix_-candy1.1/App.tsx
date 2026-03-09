import { useState, useEffect, useCallback, useRef } from 'react';
import { Moon, Sun, Wifi, WifiOff, Trash2, Settings, RotateCcw, Download, LogOut } from 'lucide-react';

// ============================================
// 类型定义
// ============================================
interface LogEntry {
  id: string;
  timestamp: number;
  type: 'system' | 'traffic' | 'success' | 'error';
  message: string;
}

interface WsIncomingMessage {
  request_id?: string;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  body?: string;
  event_type?: 'abort';
}

interface SlotAssignedMessage {
  event_type: 'slot_assigned';
  slot_id: number;
  /** 当前池内序号（1-based），断线重连不会一直涨 */
  pool_index?: number;
  total_slots: number;
  account_label?: string;
}

/** 后端下发的代理请求（必有 request_id/path/method 等） */
interface ProxyRequestSpec {
  request_id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body?: string;
  event_type?: string;
}

interface WsOutgoingMessage {
  event_type: 'response_headers' | 'chunk' | 'error' | 'stream_close';
  request_id: string;
  data?: string;
  message?: string;
  status?: number;
  headers?: Record<string, string>;
}

interface Stats {
  calls: number;
  tokens: number;
  startTime: number | null;
}

interface SessionFingerprint {
  isLoggedIn: boolean;
}

// ============================================
// 常量
// ============================================
const DEFAULT_WS_URL = 'ws://127.0.0.1:9111';
const STORAGE_KEYS = {
  WS_URL: 'candybox_ws_url',
  KEEP_ALIVE: 'candybox_keep_alive',
  ACCOUNT_LABEL: 'candybox_account_label',
  STATS: 'candybox_stats',
  THEME: 'candybox_theme',
};

// ============================================
// CORS 头注入
// ============================================
const injectCORSHeaders = (headers: Record<string, string> = {}) => ({
  ...headers,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400'
});

// ============================================
// 保活管理器
// ============================================
const KeepAliveManager = {
  audioContext: null as AudioContext | null,
  intervalId: null as number | null,

  start(mode: string, onLog: (msg: string, type: string) => void) {
    if (mode === 'none') return;

    if (mode === 'audio') {
      this.startSilentAudio(onLog);
    } else if (mode === 'pip') {
      this.startPiP(onLog);
    }
  },

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
  },

  startSilentAudio(onLog: (msg: string, type: string) => void) {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContext();
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.value = 10;
      gainNode.gain.value = 0.001;
      
      oscillator.start();
      
      this.intervalId = window.setInterval(() => {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
      }, 2000);
      
      onLog('🔇 静默音频保活已激活', 'success');
    } catch (e: any) {
      onLog(`音频保活失败: ${e.message}`, 'error');
    }
  },

  async startPiP(onLog: (msg: string, type: string) => void) {
    try {
      const video = document.getElementById('pip-video') as HTMLVideoElement;
      if (!video) {
        onLog('画中画元素未找到', 'error');
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1, 1);
      }
      
      const stream = canvas.captureStream();
      video.srcObject = stream;
      await video.play();
      await video.requestPictureInPicture();
      
      onLog('🖼️ 画中画保活已激活', 'success');
    } catch (e: any) {
      onLog(`画中画启动失败: ${e.message}`, 'error');
    }
  }
};

// ============================================
// 连接管理器
// ============================================
class ConnectionManager {
  socket: WebSocket | null = null;
  isConnected = false;
  shouldReconnect = false;
  onStatusChange: ((connected: boolean) => void) | null = null;
  onLog: ((message: string, type: string) => void) | null = null;
  onMessage: ((msg: WsIncomingMessage) => void) | null = null;
  onSlotAssigned: ((info: { slot_id: number; pool_index?: number; total_slots: number; account_label?: string }) => void) | null = null;

  // WebSocket 关闭码解决方案
  WS_CLOSE_SOLUTIONS: Record<number, string> = {
    1000: '', // 正常关闭，无需提示
    1001: '服务端主动关闭',
    1002: '检查 WebSocket 地址格式',
    1003: '数据类型不支持',
    1005: '检查网络连接',
    1006: '检查 ruri 服务是否运行，或端口是否被占用',
    1015: '检查 TLS 证书配置',
  };

  connect(url: string) {
    this.shouldReconnect = true;
    if (this.isConnected) return;

    try {
      this.log(`正在连接: ${url}`, 'system');
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.updateStatus(true);
        this.log('✓ WebSocket 连接成功', 'success');
      };

      this.socket.onclose = (e) => {
        this.isConnected = false;
        this.updateStatus(false);
        this.log(`连接断开 [${e.code}]`, 'error');
        
        // 显示解决方案
        const solution = this.WS_CLOSE_SOLUTIONS[e.code];
        if (solution) {
          this.log(`         💡 ${solution}`, 'system');
        }
        
        if (this.shouldReconnect) {
          this.log('3秒后重连...', 'system');
          setTimeout(() => this.connect(url), 3000);
        }
      };

      this.socket.onerror = () => {
        this.log('连接错误', 'error');
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if ((msg as SlotAssignedMessage).event_type === 'slot_assigned' && this.onSlotAssigned) {
            const m = msg as SlotAssignedMessage;
            this.onSlotAssigned({
              slot_id: m.slot_id,
              pool_index: m.pool_index,
              total_slots: m.total_slots,
              account_label: m.account_label,
            });
            return;
          }
          if (this.onMessage) {
            this.onMessage(msg as WsIncomingMessage);
          }
        } catch (e) {
          this.log('消息解析失败', 'error');
        }
      };
    } catch (e: any) {
      this.log(`连接异常: ${e.message}`, 'error');
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.updateStatus(false);
  }

  send(data: WsOutgoingMessage) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify(data));
    }
  }

  /** 上报账号标识（邮箱/昵称），后端按标识去重，同标识只保留最新连接 */
  sendClientIdentify(accountLabel: string) {
    if (!accountLabel?.trim() || !this.socket || !this.isConnected) return;
    this.socket.send(JSON.stringify({ event_type: 'client_identify', account_label: accountLabel.trim() }));
  }

  private updateStatus(connected: boolean) {
    if (this.onStatusChange) {
      this.onStatusChange(connected);
    }
  }

  private log(message: string, type: string) {
    if (this.onLog) {
      this.onLog(message, type);
    }
  }
}

// ============================================
// 请求处理器
// ============================================
// ============================================
// 请求处理器 (带 SillyTavern 1.14+/1.15+ 兼容性处理)
// ============================================
const RequestProcessor = {
  targetDomain: 'generativelanguage.googleapis.com',
  activeControllers: new Map<string, AbortController>(),
  abortedRequests: new Set<string>(),

  // 旧模型不支持的 safety categories
  UNSUPPORTED_SAFETY_CATEGORIES: ['HARM_CATEGORY_CIVIC_INTEGRITY'],

  // 从请求路径中提取模型名称
  extractModelFromPath(path: string): string {
    const match = path.match(/models\/([^:\/]+)/);
    return match ? match[1] : '';
  },

  // 核心兼容性处理：清洗请求体
  sanitizeRequestBody(body: string, path: string): string {
    if (!body) return body;

    try {
      const parsed = JSON.parse(body);
      const model = this.extractModelFromPath(path);
      const isGemini25 = model.includes('gemini-2.5') || model.includes('2.5');
      const isGemini3 = model.includes('gemini-3') || model.includes('gemini-exp');
      const isOldModel = !isGemini25 && !isGemini3;

      // 处理 thinkingConfig 兼容性
      if (parsed.generationConfig?.thinkingConfig) {
        const tc = parsed.generationConfig.thinkingConfig;

        if (isGemini25 && tc.thinkingLevel !== undefined) {
          delete tc.thinkingLevel;
        } else if (isGemini3 && tc.thinkingBudget !== undefined) {
          delete tc.thinkingBudget;
        } else if (isOldModel) {
          delete parsed.generationConfig.thinkingConfig;
        }

        if (parsed.generationConfig.thinkingConfig && 
            Object.keys(parsed.generationConfig.thinkingConfig).length === 0) {
          delete parsed.generationConfig.thinkingConfig;
        }
      }

      // 处理 safetySettings 兼容性
      if (parsed.safetySettings && Array.isArray(parsed.safetySettings)) {
        parsed.safetySettings = parsed.safetySettings.filter((s: any) => {
          if (isGemini25 || isGemini3) return true;
          return !this.UNSUPPORTED_SAFETY_CATEGORIES.includes(s.category);
        });
      }

      // 移除 cachedContent
      if (parsed.cachedContent || parsed.cachedContentName) {
        delete parsed.cachedContent;
        delete parsed.cachedContentName;
      }

      return JSON.stringify(parsed);
    } catch {
      return body;
    }
  },

  abort(requestId: string) {
    this.abortedRequests.add(requestId);
    const controller = this.activeControllers.get(requestId);
    if (controller) {
      controller.abort();
    }
  },

  isAborted(requestId: string) {
    return this.abortedRequests.has(requestId);
  },

  clearAborted(requestId: string) {
    this.abortedRequests.delete(requestId);
  },

  async execute(spec: ProxyRequestSpec) {
    const opId = spec.request_id;
    const controller = new AbortController();
    this.activeControllers.set(opId, controller);

    try {
      const url = this.constructUrl(spec);
      const options = this.buildOptions(spec, controller.signal);
      const response = await fetch(url, options);
      return response;
    } finally {
      this.activeControllers.delete(opId);
    }
  },

  constructUrl(spec: ProxyRequestSpec) {
    let path = spec.path.startsWith('/') ? spec.path.slice(1) : spec.path;
    const params = new URLSearchParams(spec.query_params || {});
    params.delete('key');
    const qs = params.toString();
    return `https://${this.targetDomain}/${path}${qs ? '?' + qs : ''}`;
  },

  buildOptions(spec: ProxyRequestSpec, signal: AbortSignal): RequestInit {
    const headers: Record<string, string> = { ...spec.headers };
    ['host', 'origin', 'referer', 'content-length'].forEach(k => {
      delete headers[k];
      delete headers[k.toLowerCase()];
    });

    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const opts: RequestInit = {
      method: spec.method,
      headers: headers,
      signal: signal,
      credentials: 'include'
    };

    if (['POST', 'PUT', 'PATCH'].includes(spec.method) && spec.body) {
      const rawBody = typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body);
      opts.body = this.sanitizeRequestBody(rawBody, spec.path);
    }

    return opts;
  }
};

// ============================================
// 代理系统
// ============================================
const createProxySystem = () => {
  const conn = new ConnectionManager();
  let isRunning = false;
  let onLog: ((message: string, type: string) => void) | null = null;
  let onStats: ((tokens: number) => void) | null = null;

  const log = (message: string, type: string) => {
    if (onLog) onLog(message, type);
  };

  const handleMessage = async (request: WsIncomingMessage) => {
    if (!request.request_id || request.path === undefined || request.method === undefined) return;

    // 处理中断信号
    if (request.event_type === 'abort') {
      RequestProcessor.abort(request.request_id);
      return;
    }

    const spec: ProxyRequestSpec = {
      request_id: request.request_id,
      path: request.path,
      method: request.method,
      headers: request.headers ?? {},
      query_params: request.query_params ?? {},
      body: request.body,
    };

    const opId = spec.request_id;
    const shortId = opId.slice(-6);

    // 处理 OPTIONS 预检请求
    if (spec.method === 'OPTIONS') {
      conn.send({
        request_id: opId,
        event_type: 'response_headers',
        status: 204,
        headers: injectCORSHeaders()
      });
      conn.send({ request_id: opId, event_type: 'stream_close' });
      return;
    }

    // 提取模型名称
    const modelMatch = spec.path.match(/models\/([^:\/]+)/);
    const modelName = modelMatch ? modelMatch[1] : 'unknown';

    log(`[${shortId}] ${modelName}`, 'traffic');

    try {
      const response = await RequestProcessor.execute(spec);

      if (RequestProcessor.isAborted(opId)) {
        RequestProcessor.clearAborted(opId);
        return;
      }

      // 发送响应头
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => headers[k] = v);
      
      conn.send({
        request_id: opId,
        event_type: 'response_headers',
        status: response.status,
        headers: injectCORSHeaders(headers)
      });

      // 流式传输响应体
      let detectedTokens = 0;
      let lastChunkTail = '';
      let fullResponseForError = '';
      const isErrorResponse = response.status >= 400;

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          if (RequestProcessor.isAborted(opId)) {
            reader.cancel();
            RequestProcessor.clearAborted(opId);
            return;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // 收集错误响应内容
          if (isErrorResponse) {
            fullResponseForError += chunk;
          }

          // 提取 token 数量
          const searchArea = lastChunkTail + chunk;
          const tokenMatch = searchArea.match(/"totalTokenCount"\s*:\s*(\d+)/);
          if (tokenMatch) {
            detectedTokens = parseInt(tokenMatch[1], 10);
          }
          lastChunkTail = chunk.slice(-50);

          conn.send({
            request_id: opId,
            event_type: 'chunk',
            data: chunk
          });
        }
      }

      // 发送结束信号
      conn.send({ request_id: opId, event_type: 'stream_close' });

      // 根据状态码显示不同日志
      if (response.status >= 200 && response.status < 300) {
        log(`[${shortId}] ✓ ${response.status}`, 'success');
        // 只有成功时才计入统计
        if (onStats && detectedTokens > 0) {
          onStats(detectedTokens);
        }
      } else {
        // 解析 Google API 错误信息
        let errorMsg = '';
        try {
          const errJson = JSON.parse(fullResponseForError);
          errorMsg = errJson.error?.message || errJson.error?.status || '';
        } catch {
          errorMsg = fullResponseForError.slice(0, 80);
        }
        const statusMap: Record<number, string> = {
          400: '请求无效', 401: '未认证', 403: '无权限', 404: '未找到',
          429: '请求过多', 500: '服务器错误', 502: '网关错误', 503: '服务不可用'
        };
        // 错误日志
        log(`[${shortId}] ✗ ${response.status} ${statusMap[response.status] || '错误'}: ${errorMsg}`, 'error');
        // 解决方案提示
        const solution = ERROR_SOLUTIONS[response.status];
        if (solution) {
          log(`         💡 ${solution}`, 'system');
        }
      }

    } catch (err: any) {
      if (err.name === 'AbortError' || RequestProcessor.isAborted(opId)) {
        RequestProcessor.clearAborted(opId);
        log(`[${shortId}] 已中断`, 'system');
        return;
      }

      log(`[${shortId}] ✗ ${err.message}`, 'error');
      conn.send({
        request_id: opId,
        event_type: 'error',
        status: 500,
        message: err.message
      });
    }
  };

  conn.onMessage = handleMessage;

  return {
    conn,
    get isRunning() { return isRunning; },
    setLogCallback(cb: (message: string, type: string) => void) {
      onLog = cb;
      conn.onLog = cb;
    },
    setStatsCallback(cb: (tokens: number) => void) {
      onStats = cb;
    },
    setStatusCallback(cb: (connected: boolean) => void) {
      conn.onStatusChange = cb;
    },
    setSlotCallback(cb: (info: { slot_id: number; pool_index?: number; total_slots: number; account_label?: string }) => void) {
      conn.onSlotAssigned = cb;
    },
    sendClientIdentify(accountLabel: string) {
      conn.sendClientIdentify(accountLabel);
    },
    start(url: string, keepAliveMode: string) {
      conn.connect(url);
      isRunning = true;
      KeepAliveManager.start(keepAliveMode, log);
      log('🍬 服务已启动', 'success');
    },
    stop() {
      conn.disconnect();
      KeepAliveManager.stop();
      isRunning = false;
      log('服务已停止', 'system');
    },
    toggle(url: string, keepAliveMode: string) {
      if (isRunning) {
        this.stop();
      } else {
        this.start(url, keepAliveMode);
      }
    }
  };
};

const ProxySystem = createProxySystem();

// ============================================
// 身份检查
// ============================================
const checkLoginStatus = async (): Promise<SessionFingerprint> => {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      method: 'GET',
      credentials: 'include',
    });
    return { isLoggedIn: response.status === 200 };
  } catch {
    return { isLoggedIn: false };
  }
};

// ============================================
// 格式化 Token 数量
// ============================================
const formatTokens = (num: number): string => {
  if (num < 10000) return num.toLocaleString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
};

// ============================================
// 错误解决方案映射
// ============================================
const ERROR_SOLUTIONS: Record<number, string> = {
  400: '酒馆设置 推理强度 为 自动',
  401: '重新登录 Google 账号',
  403: '重新进入代理页',
  429: '本号额度用尽；可多开窗口登录不同谷歌账号，后端将轮询使用',
  500: 'Google 服务异常，稍后重试',
  503: 'Google 服务过载，稍后重试',
};

// ============================================
// React 组件
// ============================================
export default function App() {
  // 状态
  const [isDark, setIsDark] = useState(() => localStorage.getItem(STORAGE_KEYS.THEME) === 'dark');
  const [sessionInfo, setSessionInfo] = useState<SessionFingerprint | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [slotInfo, setSlotInfo] = useState<{ slot_id: number; pool_index?: number; total_slots: number; account_label?: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // 配置
  const [wsUrl, setWsUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.WS_URL) || DEFAULT_WS_URL);
  const [keepAliveMode, setKeepAliveMode] = useState(() => localStorage.getItem(STORAGE_KEYS.KEEP_ALIVE) || 'none');
  const [accountLabel, setAccountLabel] = useState(() => localStorage.getItem(STORAGE_KEYS.ACCOUNT_LABEL) || '');
  
  // 统计
  const [stats, setStats] = useState<Stats>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STATS);
    if (saved) {
      return JSON.parse(saved);
    }
    return { calls: 0, tokens: 0, startTime: null };
  });
  const [uptime, setUptime] = useState('00:00:00');

  const logsEndRef = useRef<HTMLDivElement>(null);

  // 日志函数
  const addLog = useCallback((message: string, type: string) => {
    setLogs((prev: LogEntry[]) => {
      const newLogs = [...prev, {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        type: type as LogEntry['type'],
        message
      }];
      if (newLogs.length > 200) return newLogs.slice(-200);
      return newLogs;
    });
  }, []);

  // 统计更新
  const recordStats = useCallback((tokens: number) => {
    setStats((prev: Stats) => {
      const newStats = {
        ...prev,
        calls: prev.calls + 1,
        tokens: prev.tokens + tokens,
        startTime: prev.startTime || Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(newStats));
      return newStats;
    });
  }, []);

  // 初始化代理系统回调
  useEffect(() => {
    ProxySystem.setLogCallback(addLog);
    ProxySystem.setStatusCallback(setWsConnected);
    ProxySystem.setStatsCallback(recordStats);
    ProxySystem.setSlotCallback(setSlotInfo);
  }, [addLog, recordStats]);

  // 连接成功后上报账号标识，便于后端按邮箱/昵称去重
  useEffect(() => {
    if (wsConnected && accountLabel.trim()) {
      ProxySystem.sendClientIdentify(accountLabel.trim());
    }
  }, [wsConnected, accountLabel]);

  // 主题切换
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  }, [isDark]);

  // 运行时长计时器
  useEffect(() => {
    const timer = setInterval(() => {
      if (stats.startTime) {
        const diff = Math.floor((Date.now() - stats.startTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setUptime(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stats.startTime]);

  // 初始身份检查（只在启动时执行一次）
  useEffect(() => {
    const initCheck = async () => {
      const status = await checkLoginStatus();
      setSessionInfo(status);
      
      if (status.isLoggedIn) {
        addLog('✓ 已登录', 'success');
      } else {
        addLog('⚠️ 未登录', 'error');
      }
    };
    initCheck();
  }, [addLog]);

  // 自动滚动日志
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 保存配置
  // 断开连接时清除号位信息
  useEffect(() => {
    if (!wsConnected) setSlotInfo(null);
  }, [wsConnected]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WS_URL, wsUrl);
  }, [wsUrl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KEEP_ALIVE, keepAliveMode);
  }, [keepAliveMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_LABEL, accountLabel);
  }, [accountLabel]);

  // 连接切换
  const handleToggleConnection = useCallback(() => {
    ProxySystem.toggle(wsUrl, keepAliveMode);
  }, [wsUrl, keepAliveMode]);

  // 清空统计
  const clearStats = useCallback(() => {
    const newStats = { calls: 0, tokens: 0, startTime: Date.now() };
    setStats(newStats);
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(newStats));
    addLog('统计数据已重置', 'system');
  }, [addLog]);

  // 导出统计
  const exportStats = useCallback(() => {
    const data = JSON.stringify({ ...stats, exportTime: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candybox-stats-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stats]);

  // 日志颜色 - 优化版 (高清晰度，适配黑白)
  const getLogStyle = (type: LogEntry['type']) => {
    // 基础样式：加粗字体提高中文清晰度，左侧边框指示
    const base = "border-l-[3px] font-medium transition-colors";
    
    switch (type) {
      case 'system': // 蓝色系：信息提示
        return `${base} border-blue-400 text-blue-700 bg-blue-50/50 dark:border-blue-400 dark:text-blue-300 dark:bg-blue-500/10`;
        
      case 'error': // 红色系：错误警告
        return `${base} border-rose-500 text-rose-700 bg-rose-50/50 dark:border-rose-500 dark:text-rose-300 dark:bg-rose-500/10`;
        
      case 'success': // 绿色系：成功状态
        return `${base} border-emerald-500 text-emerald-700 bg-emerald-50/50 dark:border-emerald-500 dark:text-emerald-300 dark:bg-emerald-500/10`;
        
      case 'traffic': // 紫色系：数据流
        return `${base} border-violet-500 text-violet-700 bg-violet-50/50 dark:border-violet-500 dark:text-violet-300 dark:bg-violet-500/10`;
        
      default: // 默认：灰色系，确保高对比度
        return `${base} border-slate-300 text-slate-700 bg-slate-50/50 dark:border-slate-600 dark:text-slate-300 dark:bg-slate-800/30`;
    }
  };

  const isLoggedIn = sessionInfo?.isLoggedIn ?? false;

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden p-3 md:p-6 gap-3 md:gap-5 max-w-5xl mx-auto w-full">
      {/* 顶部导航栏 */}
      <header className="flex justify-between items-center shrink-0 px-4 py-3 rounded-2xl transition-all duration-300 bg-white/70 border border-white/60 backdrop-blur-xl shadow-sm dark:bg-slate-900/60 dark:border-purple-500/20 z-50 relative">
        <div className="flex items-center gap-2">
          {/* 心形 Logo - 连接时心跳 */}
          <div className={wsConnected ? 'animate-heartbeat' : ''}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: wsConnected ? '#f472b6' : '#94a3b8' }} />
                  <stop offset="100%" style={{ stopColor: wsConnected ? '#a855f7' : '#64748b' }} />
                </linearGradient>
              </defs>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#heartGradient)"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 to-violet-600 dark:from-cyan-400 dark:to-purple-500 bg-clip-text text-transparent drop-shadow-sm">
              CandyBox
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 退出所有账号 */}
          <a
            href="https://accounts.google.com/SignOutOptions"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/50 border border-white/40 text-slate-500 dark:bg-slate-800/50 dark:border-purple-500/30 dark:text-purple-300 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all"
            title="退出所有 Google 账号"
          >
            <LogOut size={18} />
          </a>

          <div className="h-6 w-px bg-purple-200 dark:bg-purple-700/50"></div>

          {/* WiFi 开关 */}
          <button
            onClick={handleToggleConnection}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
              wsConnected
                ? 'bg-emerald-50 border border-emerald-500 text-emerald-500 dark:bg-emerald-900/30 dark:border-emerald-500/50'
                : 'bg-white/50 border border-white/40 text-slate-500 dark:bg-slate-800/50 dark:border-purple-500/30 dark:text-purple-300'
            }`}
            title={wsConnected ? '断开连接' : '连接服务'}
          >
            {wsConnected ? <Wifi size={18} className="animate-pulse" /> : <WifiOff size={18} />}
          </button>

          <div className="h-6 w-px bg-purple-200 dark:bg-purple-700/50"></div>

          {/* 高级配置 */}
          <details className="relative group">
            <summary className="flex items-center justify-center w-9 h-9 rounded-full bg-white/50 border border-white/40 text-slate-500 dark:bg-slate-800/50 dark:border-purple-500/30 dark:text-purple-300 hover:bg-purple-50 hover:text-purple-500 transition-all cursor-pointer list-none"
              title="高级配置">
              <Settings size={18} />
            </summary>
            
            <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-purple-500/30 shadow-xl z-50 space-y-4">
              {/* WebSocket 地址 */}
              <div>
                <label className="text-xs text-slate-500 dark:text-purple-300/70 block mb-1">WebSocket 地址</label>
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWsUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-purple-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:text-purple-100"
                  placeholder="ws://127.0.0.1:9111"
                />
              </div>

              {/* 后台保活 */}
              <div>
                <label className="text-xs text-slate-500 dark:text-purple-300/70 block mb-1">后台保活策略</label>
                <select
                  value={keepAliveMode}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setKeepAliveMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-purple-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:text-purple-100"
                >
                  <option value="none">关闭 (默认)</option>
                  <option value="audio">静默音频</option>
                  <option value="pip">画中画视频</option>
                </select>
              </div>

              {/* 账号标识：用于多账号去重，同标识只保留最新连接 */}
              <div>
                <label className="text-xs text-slate-500 dark:text-purple-300/70 block mb-1">账号标识（选填，用于去重）</label>
                <input
                  type="text"
                  value={accountLabel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccountLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-purple-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:text-purple-100"
                  placeholder="如：主号邮箱或昵称"
                />
                <p className="text-[10px] text-slate-400 mt-1">同一标识重复连接时，后端会踢掉旧连接，避免重复占用号位</p>
              </div>
            </div>
          </details>

          {/* 主题切换 */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/50 border border-white/40 text-slate-500 dark:bg-slate-800/50 dark:border-purple-500/30 dark:text-purple-300 hover:bg-white transition-all"
          >
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col gap-3 md:gap-5 min-h-0">
        {/* 未登录提示 */}
        {!isLoggedIn && (
          <div className="shrink-0 p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/30">
            <p className="text-sm text-rose-700 dark:text-rose-300 mb-2">
              ⚠️ 未检测到 Google 登录。请先退出所有账号，登录新账号后重新打开此页面。
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              支持多号轮询：可开多个独立窗口，每个窗口登录不同谷歌账号并点击「连接服务」，后端将轮询使用以降低单号超限风险。
            </p>
            <a
              href="https://accounts.google.com/SignOutOptions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-colors"
            >
              退出账号
            </a>
          </div>
        )}

        {/* 监控面板 */}
        <section className="shrink-0 p-4 rounded-2xl bg-white/70 border border-white/60 backdrop-blur-xl dark:bg-slate-900/60 dark:border-purple-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-700 dark:text-purple-100">运行监控</span>
              <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                wsConnected 
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                  : 'bg-slate-300 dark:bg-slate-600'
              }`} />
              {/* 登录状态 */}
              <span className={`text-xs font-bold ${
                isLoggedIn 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-rose-500 dark:text-rose-400'
              }`}>
                {isLoggedIn ? '✓ 已登录' : '✗ 未登录'}
              </span>
              {/* 多号轮询：当前窗口号位（含账号标识时显示） */}
              {slotInfo && (
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400" title="多窗口时后端将轮询使用各账号，避免单号超限">
                  {slotInfo.account_label ? `[${slotInfo.account_label}] ` : ''}[{slotInfo.total_slots === 1 ? 1 : (slotInfo.pool_index ?? slotInfo.slot_id)}/{slotInfo.total_slots} 号位]
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={clearStats} className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 text-slate-400 hover:text-purple-500 transition-colors" title="清空统计">
                <RotateCcw size={16} />
              </button>
              <button onClick={exportStats} className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 text-slate-400 hover:text-purple-500 transition-colors" title="导出数据">
                <Download size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-purple-500/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Calls</span>
              <span className="text-lg font-bold font-mono text-slate-700 dark:text-purple-100">
                {stats.calls > 999 ? '999+' : stats.calls}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-purple-500/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tokens</span>
              <span className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">{formatTokens(stats.tokens)}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-purple-500/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Uptime</span>
              <span className="text-sm font-bold font-mono text-slate-600 dark:text-purple-200">{uptime}</span>
            </div>
          </div>
        </section>

        {/* 日志面板（最大化） */}
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/80 border border-white/60 dark:border-purple-500/20">
          <div className="flex justify-between items-center px-4 py-2 bg-white/40 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/5 shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              📋 LOGS
            </span>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-white/50"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 font-mono text-sm leading-relaxed">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-purple-400/50">
                等待活动...
              </div>
            ) : (
              logs.map((entry: LogEntry) => (
                <div key={entry.id} className={`${getLogStyle(entry.type)} break-all mb-1 py-1 pl-2 rounded-r-md`}>
                  <span className="opacity-50 mr-2 text-[0.85em] select-none font-normal">
                    {new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}.
                    {new Date(entry.timestamp).getMilliseconds().toString().padStart(3, '0')}
                  </span>
                  {entry.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </section>
      </div>

      {/* 隐藏的保活元素 */}
      <video id="pip-video" muted playsInline className="absolute w-px h-px opacity-0 pointer-events-none" />

      {/* 心跳动画样式 */}
      <style>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          15% { transform: scale(1.15); }
          30% { transform: scale(1); }
          45% { transform: scale(1.15); }
          60% { transform: scale(1); }
          100% { transform: scale(1); }
        }
        .animate-heartbeat {
          animation: heartbeat 1.5s infinite ease-in-out;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        details summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </div>
  );
}