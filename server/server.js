/**
 * 🍬 CandyBox Proxy - Server
 * 
 * 版本: 1.0.0
 * 作者: WanWan
 * 端口: HTTP 8811 / WebSocket 9111
 * 仓库: https://github.com/shleeshlee/CandyBox-Proxy
 * 
 * 免费开源，禁止倒卖
 * 如果你是付费获取的本项目，你被骗了！
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const { EventEmitter } = require('events');

// ============================================
// 配置
// ============================================
const CONFIG = {
  HTTP_PORT: process.env.HTTP_PORT || 8811,
  WS_PORT: process.env.WS_PORT || 9111,
  HOST: process.env.HOST || '0.0.0.0',
  TIMEOUT_MS: 600000, // 10分钟
  MAX_BODY: '100mb',
};

// ============================================
// 日志
// ============================================
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`),
};

// ============================================
// 消息队列
// ============================================
class MessageQueue {
  constructor(timeoutMs = CONFIG.TIMEOUT_MS) {
    this.messages = [];
    this.waiters = [];
    this.timeout = timeoutMs;
    this.closed = false;
  }

  push(msg) {
    if (this.closed) return;
    
    if (this.waiters.length > 0) {
      const { resolve, timer } = this.waiters.shift();
      clearTimeout(timer);
      resolve(msg);
    } else {
      this.messages.push(msg);
    }
  }

  async pop() {
    if (this.closed) throw new Error('队列已关闭');
    
    if (this.messages.length > 0) {
      return this.messages.shift();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.resolve === resolve);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error('超时'));
      }, this.timeout);

      this.waiters.push({ resolve, reject, timer });
    });
  }

  close() {
    this.closed = true;
    this.waiters.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error('队列已关闭'));
    });
    this.waiters = [];
    this.messages = [];
  }
}

// ============================================
// 连接管理器（多号轮询）
// ============================================
class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    /** @type {{ ws: WebSocket, slotId: number, accountLabel?: string }[]} 多窗口连接池 */
    this.connections = [];
    this._nextSlotId = 0;
    this._roundRobinIndex = 0;
    this.queues = new Map();
    /** request_id -> ws，用于 abort 时发给正确窗口 */
    this.requestTargets = new Map();
  }

  add(ws, info) {
    const slotId = ++this._nextSlotId;
    const entry = { ws, slotId, accountLabel: undefined };
    this.connections.push(entry);
    ws.slotId = slotId;

    const poolIndex = this.connections.length;
    log.info(`🍬 浏览器已连接 [${poolIndex} 号位] 当前共 ${this.connections.length} 个窗口: ${info.address}`);

    ws.on('message', (data) => this.handleMessage(data.toString(), ws));
    ws.on('close', () => this.remove(ws));
    ws.on('error', (err) => log.error(`WebSocket错误 [${slotId}]: ${err.message}`));

    // 通知该窗口其号位与总数（多号轮询用）
    this.sendSlotAssigned(ws, entry);

    this.emit('connected', ws);
  }

  /** 向单个连接发送 slot_assigned（池内序号 + 总数，避免断线重连后号位一直涨） */
  sendSlotAssigned(ws, entry) {
    const poolIndex = this.connections.findIndex((e) => e.ws === entry.ws) + 1;
    const payload = {
      event_type: 'slot_assigned',
      slot_id: entry.slotId,
      pool_index: poolIndex,
      total_slots: this.connections.length,
    };
    if (entry.accountLabel) payload.account_label = entry.accountLabel;
    this.sendTo(ws, payload);
  }

  /** 向所有连接广播当前 slot 信息 */
  broadcastSlotAssigned() {
    this.connections.forEach((entry) => {
      this.sendSlotAssigned(entry.ws, entry);
    });
  }

  remove(ws) {
    const slotId = ws.slotId;
    const idx = this.connections.findIndex((e) => e.ws === ws);
    const poolIndex = idx === -1 ? -1 : idx + 1;
    if (idx !== -1) this.connections.splice(idx, 1);
    log.info(`🍬 浏览器已断开 [${poolIndex} 号位] 剩余 ${this.connections.length} 个窗口`);

    for (const [rid, w] of this.requestTargets) {
      if (w === ws) this.requestTargets.delete(rid);
    }
    this.queues.forEach((q) => q.close());
    this.queues.clear();

    this.broadcastSlotAssigned();
    this.emit('disconnected', ws);
  }

  handleMessage(data, ws) {
    try {
      const msg = JSON.parse(data);
      const { request_id, event_type } = msg;

      // 客户端上报账号标识（邮箱/昵称），用于去重：同标识只保留最新连接
      if (event_type === 'client_identify' && typeof msg.account_label === 'string' && msg.account_label.trim()) {
        const label = msg.account_label.trim();
        const currentEntry = this.connections.find((e) => e.ws === ws);
        if (!currentEntry) return;

        const sameLabel = this.connections.find((e) => e.ws !== ws && e.accountLabel === label);
        if (sameLabel) {
          log.info(`🍬 同账号标识 [${label}] 已有连接，关闭旧连接`);
          sameLabel.ws.close();
        }
        currentEntry.accountLabel = label;
        const poolIndex = this.connections.findIndex((e) => e.ws === ws) + 1;
        log.info(`🍬 已绑定账号标识 [${label}] 号位 ${poolIndex}`);
        this.broadcastSlotAssigned();
        return;
      }

      if (!request_id) {
        log.warn('收到无效消息: 缺少 request_id');
        return;
      }

      const queue = this.queues.get(request_id);
      if (!queue) {
        log.warn(`未知请求ID: ${request_id}`);
        return;
      }

      switch (event_type) {
        case 'response_headers':
        case 'chunk':
        case 'error':
          queue.push(msg);
          break;
        case 'stream_close':
          queue.push({ type: 'END' });
          break;
        default:
          log.warn(`未知事件: ${event_type}`);
      }
    } catch (e) {
      log.error(`解析消息失败: ${e.message}`);
    }
  }

  get isConnected() {
    return this.connections.length > 0;
  }

  /** 轮询取下一个连接，避免单号超限 */
  getNextConnection() {
    if (this.connections.length === 0) return null;
    const idx = this._roundRobinIndex % this.connections.length;
    this._roundRobinIndex = (this._roundRobinIndex + 1) % this.connections.length;
    return this.connections[idx];
  }

  createQueue(requestId) {
    const queue = new MessageQueue();
    this.queues.set(requestId, queue);
    return queue;
  }

  removeQueue(requestId) {
    const queue = this.queues.get(requestId);
    if (queue) {
      queue.close();
      this.queues.delete(requestId);
    }
  }

  sendTo(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  /** 将代理请求发送到轮询选中的连接 */
  send(data) {
    const entry = this.getNextConnection();
    if (!entry) return false;
    return this.sendToConnection(entry, data);
  }

  /** 向指定连接发送数据并记录 request_id（用于轮询时 abort 正确窗口） */
  sendToConnection(entry, data) {
    if (!entry || !entry.ws) return false;
    if (data.request_id) this.requestTargets.set(data.request_id, entry.ws);
    return this.sendTo(entry.ws, data);
  }

  sendAbort(requestId) {
    const ws = this.requestTargets.get(requestId);
    this.requestTargets.delete(requestId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      return this.sendTo(ws, { request_id: requestId, event_type: 'abort' });
    }
    return false;
  }
}

// ============================================
// 代理服务器
// ============================================
class ProxyServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...CONFIG, ...config };
    this.connections = new ConnectionManager();
    this.httpServer = null;
    this.wsServer = null;
  }

  async start() {
    try {
      await this.startHTTP();
      await this.startWebSocket();
      
      console.log('');
      console.log('🍬 ═══════════════════════════════════════════');
      console.log('🍬  CandyBox Proxy v1.0.0');
      console.log('🍬  作者: WanWan');
      console.log('🍬 ═══════════════════════════════════════════');
      console.log(`🍬  HTTP:      http://${this.config.HOST}:${this.config.HTTP_PORT}`);
      console.log(`🍬  WebSocket: ws://${this.config.HOST}:${this.config.WS_PORT}`);
      console.log(`🍬  状态检查:  http://127.0.0.1:${this.config.HTTP_PORT}/status`);
      console.log('🍬 ═══════════════════════════════════════════');
      console.log('🍬  免费开源，禁止倒卖');
      console.log('🍬 ═══════════════════════════════════════════');
      console.log('');
      
      this.emit('started');
    } catch (err) {
      log.error(`启动失败: ${err.message}`);
      this.emit('error', err);
      throw err;
    }
  }

  async startHTTP() {
    const app = express();
    
    app.use(express.json({ limit: this.config.MAX_BODY }));
    app.use(express.urlencoded({ extended: true, limit: this.config.MAX_BODY }));
    app.use(express.raw({ limit: this.config.MAX_BODY, type: '*/*' }));

    // 状态端点
    app.get('/status', (req, res) => {
      res.json({
        name: 'CandyBox Proxy',
        status: 'running',
        browser_connected: this.connections.isConnected,
        slot_count: this.connections.connections.length,
        timestamp: new Date().toISOString(),
      });
    });

    // 拦截酒馆健康检查（/accounts 不存在于 Gemini API）
    app.get('/accounts', (req, res) => {
      res.json({ accounts: [{ id: 'candybox', name: 'CandyBox Proxy' }] });
    });

    // 代理所有其他请求
    app.all('*', (req, res) => this.handleRequest(req, res));

    this.httpServer = http.createServer(app);

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.HTTP_PORT, this.config.HOST, resolve);
      this.httpServer.once('error', reject);
    });
  }

  async startWebSocket() {
    this.wsServer = new WebSocket.Server({
      port: this.config.WS_PORT,
      host: this.config.HOST,
    });

    this.wsServer.on('connection', (ws, req) => {
      this.connections.add(ws, { address: req.socket.remoteAddress });
    });

    this.wsServer.on('error', (err) => {
      log.error(`WebSocket服务器错误: ${err.message}`);
      this.emit('error', err);
    });
  }

  async handleRequest(req, res) {
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    log.info(`[${requestId.slice(-6)}] ${req.method} ${req.path}`);

    const conn = this.connections.getNextConnection();
    if (!conn) {
      log.warn(`[${requestId.slice(-6)}] 无浏览器连接`);
      return res.status(503).json({ 
        error: '没有可用的浏览器连接',
        hint: '请打开 AI Studio 中的 CandyBox Applet 并点击「连接服务」（可开多个窗口登录不同谷歌账号，后端将轮询使用）',
      });
    }

    const queue = this.connections.createQueue(requestId);
    let aborted = false;

    // 监听客户端断开
    res.on('close', () => {
      if (!res.writableEnded) {
        aborted = true;
        log.info(`[${requestId.slice(-6)}] 客户端断开`);
        this.connections.sendAbort(requestId);
        queue.close();
      }
    });

    try {
      // 构建代理请求
      let body = '';
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : 
               Buffer.isBuffer(req.body) ? req.body.toString() :
               JSON.stringify(req.body);
      }

      const proxyReq = {
        request_id: requestId,
        path: req.path,
        method: req.method,
        headers: req.headers,
        query_params: req.query,
        body: body,
      };

      // 发送到当前轮询选中的浏览器窗口
      this.connections.sendToConnection(conn, proxyReq);

      // 等待响应头
      const headerMsg = await queue.pop();
      
      if (aborted) return;

      if (headerMsg.event_type === 'error') {
        return res.status(headerMsg.status || 500).json({ error: headerMsg.message });
      }

      // 设置响应头
      res.status(headerMsg.status || 200);
      if (headerMsg.headers) {
        Object.entries(headerMsg.headers).forEach(([k, v]) => {
          // 跳过某些不能设置的头
          if (!['transfer-encoding', 'content-encoding'].includes(k.toLowerCase())) {
            res.set(k, v);
          }
        });
      }

      // 流式传输响应
      while (!aborted) {
        try {
          const msg = await queue.pop();
          
          if (msg.type === 'END') break;
          if (msg.data) res.write(msg.data);
        } catch (err) {
          if (err.message === '队列已关闭') break;
          if (err.message === '超时') {
            const contentType = res.get('Content-Type') || '';
            if (contentType.includes('text/event-stream')) {
              res.write(': keepalive\n\n');
              continue;
            }
            break;
          }
          throw err;
        }
      }

      if (!aborted) res.end();
      
    } catch (err) {
      if (!aborted) {
        log.error(`[${requestId.slice(-6)}] 错误: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: `代理错误: ${err.message}` });
        }
      }
    } finally {
      this.connections.requestTargets.delete(requestId);
      this.connections.removeQueue(requestId);
    }
  }

  async stop() {
    log.info('正在停止服务器...');

    const promises = [];

    if (this.httpServer) {
      promises.push(new Promise(r => this.httpServer.close(r)));
    }

    if (this.wsServer) {
      this.connections.connections.forEach(ws => ws.terminate());
      promises.push(new Promise(r => this.wsServer.close(r)));
    }

    await Promise.all(promises);
    log.info('服务器已停止');
    this.emit('stopped');
  }
}

// ============================================
// 导出
// ============================================
module.exports = { ProxyServer, CONFIG };

// 直接运行
if (require.main === module) {
  const server = new ProxyServer();
  server.start().catch(() => process.exit(1));

  process.on('SIGINT', async () => {
    console.log('\n正在关闭...');
    await server.stop();
    process.exit(0);
  });
}
