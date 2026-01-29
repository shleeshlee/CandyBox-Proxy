
/**
 * GeminiProxy Core 1.0
 * Refactored - 2024
 */

// === UI 控制器 ===
const UI = {
    elements: {
        wsUrl: document.getElementById('ws-url') as HTMLInputElement,
        streamMode: document.getElementsByName('streamMode'),
        keepAliveMode: document.getElementById('keep-alive-mode') as HTMLSelectElement,
        modelRedirect: document.getElementById('model-redirect') as HTMLInputElement,
        thinkingCompat: document.getElementById('thinking-compat') as HTMLInputElement,
        resumeOnProhibit: document.getElementById('resume-on-prohibit') as HTMLInputElement,
        resumeLimit: document.getElementById('resume-limit') as HTMLInputElement,
        statusDot: document.getElementById('ws-status-dot') as HTMLElement,
        // 新的图标按钮
        wifiBtn: document.getElementById('wifi-btn') as HTMLButtonElement,
        wifiIcon: document.getElementById('wifi-icon') as HTMLElement,
        themeBtn: document.getElementById('theme-btn') as HTMLButtonElement,
        themeIcon: document.getElementById('theme-icon') as HTMLElement,
        // 用户信息
        userAvatar: document.getElementById('user-avatar') as HTMLImageElement,
        // userName has been removed from mobile layout to save space
        
        logs: document.getElementById('log-container') as HTMLElement,
        statsCalls: document.getElementById('stat-calls') as HTMLElement,
        statsTokens: document.getElementById('stat-tokens') as HTMLElement,
        statsUptime: document.getElementById('stat-uptime') as HTMLElement,
        pipVideo: document.getElementById('pip-video') as HTMLVideoElement
    },

    stats: {
        calls: 0,
        tokens: 0,
        startTime: null as number | null
    },

    init() {
        // 加载本地存储配置
        const savedUrl = localStorage.getItem('np_ws_url');
        if (savedUrl) this.elements.wsUrl.value = savedUrl;
        
        const savedMode = localStorage.getItem('np_stream_mode');
        if (savedMode) {
            const el = document.querySelector(`input[name="streamMode"][value="${savedMode}"]`) as HTMLInputElement;
            if (el) el.checked = true;
        }

        const savedRedirect = localStorage.getItem('np_model_redirect');
        if (savedRedirect) {
            this.elements.modelRedirect.checked = savedRedirect === 'true';
        }

        const savedThinkingCompat = localStorage.getItem('np_thinking_compat');
        if (savedThinkingCompat) {
            this.elements.thinkingCompat.checked = savedThinkingCompat === 'true';
        }
        
        const savedResume = localStorage.getItem('np_resume_on_prohibit');
        if (savedResume) {
            this.elements.resumeOnProhibit.checked = savedResume === 'true';
        }
        const savedResumeLimit = localStorage.getItem('np_resume_limit');
        if (savedResumeLimit) {
            this.elements.resumeLimit.value = savedResumeLimit;
        }

        this.loadStats();
        this.startUptimeTimer();
        
        // 绑定配置保存监听
        this.elements.modelRedirect.addEventListener('change', () => {
             localStorage.setItem('np_model_redirect', this.elements.modelRedirect.checked.toString());
             this.log(`模型重定向已${this.elements.modelRedirect.checked ? '开启' : '关闭'}`, 'system');
        });

        this.elements.thinkingCompat.addEventListener('change', () => {
             localStorage.setItem('np_thinking_compat', this.elements.thinkingCompat.checked.toString());
             this.log(`思维等级兼容已${this.elements.thinkingCompat.checked ? '开启' : '关闭'}`, 'system');
        });

        this.elements.resumeOnProhibit.addEventListener('change', () => {
            localStorage.setItem('np_resume_on_prohibit', this.elements.resumeOnProhibit.checked.toString());
            this.log(`截断续写已${this.elements.resumeOnProhibit.checked ? '开启' : '关闭'}`, 'system');
        });
        this.elements.resumeLimit.addEventListener('change', () => {
            localStorage.setItem('np_resume_limit', this.elements.resumeLimit.value);
            this.log(`续写重试次数已设置为: ${this.elements.resumeLimit.value}`, 'system');
        });
    },

    log(message: string, type = 'info') {
        const div = document.createElement('div');
        
        // Tailwind styling for logs - updated for better contrast on colored backgrounds
        let colorClass = 'text-slate-600 dark:text-slate-400 border-l-2 border-transparent pl-2';
        if (type === 'system') colorClass = 'text-amber-600 dark:text-amber-500 border-l-2 border-amber-500 pl-2 bg-amber-50/50 dark:bg-amber-900/10';
        if (type === 'error') colorClass = 'text-red-600 dark:text-red-400 border-l-2 border-red-500 pl-2 bg-red-50/50 dark:bg-red-900/10';
        if (type === 'success') colorClass = 'text-emerald-600 dark:text-emerald-400 border-l-2 border-emerald-500 pl-2 bg-emerald-50/50 dark:bg-emerald-900/10';
        if (type === 'traffic') colorClass = 'text-purple-600 dark:text-purple-400 border-l-2 border-purple-500 pl-2';
        
        div.className = `${colorClass} break-all mb-1 py-0.5 text-[10px] md:text-xs font-mono`;
        
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '.' + new Date().getMilliseconds().toString().padStart(3, '0');
        div.innerHTML = `<span class="opacity-40 mr-2 text-[0.85em] select-none">${time}</span>${message}`;
        
        this.elements.logs.appendChild(div);
        
        // Smart scroll: only scroll if near bottom
        const threshold = 50;
        const isNearBottom = this.elements.logs.scrollHeight - this.elements.logs.scrollTop - this.elements.logs.clientHeight <= threshold;
        if (isNearBottom || type === 'system') {
            this.elements.logs.scrollTop = this.elements.logs.scrollHeight;
        }

        if (this.elements.logs.children.length > 500) {
            this.elements.logs.removeChild(this.elements.logs.firstChild as Node);
        }
    },

    updateStatus(connected: boolean) {
        if (connected) {
            // Dot status
            this.elements.statusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-all';
            this.elements.statusDot.title = "在线";
            
            // WiFi 按钮状态
            this.elements.wifiBtn.dataset.connected = "true";
            this.elements.wifiBtn.classList.add('border-emerald-500', 'bg-emerald-50');
            this.elements.wifiBtn.classList.remove('text-slate-500', 'dark:text-purple-300');
            this.elements.wifiIcon.classList.add('text-emerald-500', 'animate-pulse');
            this.elements.wifiIcon.textContent = 'wifi';
        } else {
            // Dot status
            this.elements.statusDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 transition-all';
            this.elements.statusDot.title = "离线";
            
            // WiFi 按钮状态
            this.elements.wifiBtn.dataset.connected = "false";
            this.elements.wifiBtn.classList.remove('border-emerald-500', 'bg-emerald-50');
            this.elements.wifiBtn.classList.add('text-slate-500', 'dark:text-purple-300');
            this.elements.wifiIcon.classList.remove('text-emerald-500', 'animate-pulse');
            this.elements.wifiIcon.textContent = 'wifi_off';
        }
    },

    recordCall(tokenCount = 0) {
        this.stats.calls++;
        this.stats.tokens += tokenCount;
        this.updateStatsUI();
        this.saveStats();
    },

    updateStatsUI() {
        this.elements.statsCalls.textContent = this.stats.calls.toLocaleString();
        this.elements.statsTokens.textContent = this.stats.tokens.toLocaleString();
    },

    saveStats() {
        localStorage.setItem('np_stats', JSON.stringify(this.stats));
    },

    loadStats() {
        const saved = localStorage.getItem('np_stats');
        if (saved) {
            this.stats = JSON.parse(saved);
            this.updateStatsUI();
        }
    },

    clearStats() {
        this.stats.calls = 0;
        this.stats.tokens = 0;
        this.updateStatsUI();
        this.saveStats();
        this.log('统计数据已重置', 'system');
    },

    startUptimeTimer() {
        this.stats.startTime = Date.now();
        setInterval(() => {
            if (!this.stats.startTime) return;
            const diff = Math.floor((Date.now() - this.stats.startTime) / 1000);
            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            this.elements.statsUptime.textContent = `${h}:${m}:${s}`;
        }, 1000);
    },
    
    getConfig() {
        const streamModeEl = document.querySelector('input[name="streamMode"]:checked') as HTMLInputElement;
        const streamMode = streamModeEl ? streamModeEl.value : 'real';
        return {
            wsUrl: this.elements.wsUrl.value,
            streamMode: streamMode,
            keepAlive: this.elements.keepAliveMode.value,
            modelRedirect: this.elements.modelRedirect.checked,
            thinkingCompat: this.elements.thinkingCompat.checked,
            resumeOnProhibit: this.elements.resumeOnProhibit.checked,
            resumeLimit: parseInt(this.elements.resumeLimit.value, 10) || 3
        };
    }
};

// === 主题管理器 ===
const ThemeManager = {
    isDark: false,
    init() {
        const saved = localStorage.getItem('gp_theme');
        // Default to light as requested if not set
        this.isDark = saved === 'dark';
        this.apply();

        UI.elements.themeBtn.addEventListener('click', () => this.toggle());
    },
    toggle() {
        this.isDark = !this.isDark;
        localStorage.setItem('gp_theme', this.isDark ? 'dark' : 'light');
        this.apply();
    },
    apply() {
        const html = document.documentElement;
        const icon = UI.elements.themeIcon;
        
        if (this.isDark) {
            html.classList.add('dark');
            icon.textContent = 'dark_mode';
        } else {
            html.classList.remove('dark');
            icon.textContent = 'light_mode';
        }
    }
};

// === 身份与会话管理器 (Auth) ===
const AuthManager = {
    init() {
        this.checkLoginStatus();
        
        // 智能刷新：当页面重新获得焦点时刷新用户信息
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkLoginStatus();
                UI.log('检测到页面唤醒，正在刷新身份信息...', 'system');
            }
        });
        
        window.addEventListener('focus', () => {
             this.checkLoginStatus();
        });
    },

    async checkLoginStatus() {
        try {
            // 1. 使用 Google Models API 探测登录状态 (轻量)
            const probe = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
                credentials: 'include'
            });

            if (probe.status === 200) {
                // 2. 尝试获取用户详情 (OAuth userinfo)
                try {
                     const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                         credentials: 'include'
                     });
                     
                     if (infoRes.ok) {
                         const userData = await infoRes.json();
                         this.updateUI(userData.name, userData.picture);
                         return;
                     }
                } catch(e) {
                    // ignore userinfo fail
                }
                
                // 如果 userinfo 失败但 model probe 成功，显示通用登录状态
                this.updateUI('Google User', 'https://lh3.googleusercontent.com/a/default-user=s96-c');
                
            } else {
                this.updateUI('Guest', 'https://lh3.googleusercontent.com/a/default-user=s96-c');
            }
        } catch (e) {
            this.updateUI('Guest', 'https://lh3.googleusercontent.com/a/default-user=s96-c');
        }
    },

    updateUI(name: string, picture: string) {
        // Name element removed from HTML for compactness, only avatar is used
        if (UI.elements.userAvatar && picture) UI.elements.userAvatar.src = picture;
    }
};

// === 辅助函数 ===
const Helpers = {
    injectCORSHeaders(headers: Record<string, string>) {
        headers['Access-Control-Allow-Origin'] = '*';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
        headers['Access-Control-Allow-Headers'] = '*';
        headers['Access-Control-Max-Age'] = '86400';
        return headers;
    }
};

// === 保活管理器 (Keep-Alive) ===
const KeepAliveManager = {
    audioContext: null as AudioContext | null,
    oscillator: null as OscillatorNode | null,
    videoElement: null as HTMLVideoElement | null,

    async start(mode: string) {
        if (mode === 'none') return;

        UI.log(`正在启动保活策略: ${mode}`, 'system');

        if (mode === 'audio') {
            this.startSilentAudio();
        } else if (mode === 'pip') {
            await this.startPiP();
        }
    },

    stop() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {});
        }
    },

    startSilentAudio() {
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
            this.oscillator = oscillator;
            
            setInterval(() => {
                if (this.audioContext && this.audioContext.state === 'suspended') this.audioContext.resume();
            }, 2000);
            
            UI.log('静默音频保活已激活', 'success');
        } catch (e: any) {
            UI.log(`音频保活失败: ${e.message}`, 'error');
        }
    },

    async startPiP() {
        try {
            const video = UI.elements.pipVideo;
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0,0,1,1);
            }
            
            const stream = canvas.captureStream();
            video.srcObject = stream;
            await video.play();
            
            await video.requestPictureInPicture();
            UI.log('画中画保活已激活', 'success');
        } catch (e: any) {
            UI.log(`画中画启动失败: ${e.message}`, 'error');
        }
    }
};

// === 网络连接管理器 ===
class ConnectionManager {
    socket: WebSocket | null;
    isConnected: boolean;
    shouldReconnect: boolean;

    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.shouldReconnect = false;
    }

    connect(url: string) {
        this.shouldReconnect = true;
        if (this.isConnected) return;

        try {
            UI.log(`正在连接 WebSocket: ${url}`, 'system');
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                this.isConnected = true;
                UI.updateStatus(true);
                UI.log('WebSocket 连接成功', 'success');
                localStorage.setItem('np_ws_url', url);
            };

            this.socket.onclose = () => {
                this.isConnected = false;
                UI.updateStatus(false);
                UI.log('WebSocket 连接断开', 'error');
                if (this.shouldReconnect) {
                    setTimeout(() => this.connect(url), 3000);
                }
            };

            this.socket.onerror = (err) => {
                UI.log('WebSocket 发生错误', 'error');
            };

            this.socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.event_type === 'abort' && msg.request_id) {
                        RequestProcessor.abort(msg.request_id);
                        return;
                    }
                } catch (e) {
                }
                ProxySystem.handleMessage(event.data);
            };
        } catch (e: any) {
            UI.log(`连接异常: ${e.message}`, 'error');
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
        UI.updateStatus(false);
    }

    send(data: any) {
        if (this.socket && this.isConnected) {
            this.socket.send(JSON.stringify(data));
        }
    }
}

// === OpenAI 兼容适配器 ===
const OpenAIAdapter = {
    modelMapping: {
        'gpt-4': 'gemini-2.0-flash',
        'gpt-4-turbo': 'gemini-2.0-flash',
        'gpt-4o': 'gemini-2.0-flash',
        'gpt-4o-mini': 'gemini-2.0-flash',
        'gpt-3.5-turbo': 'gemini-2.0-flash',
        'gpt-4-vision-preview': 'gemini-2.0-flash',
    } as Record<string, string>,

    isOpenAIRequest(spec: any): boolean {
        return spec.path?.includes('/v1/chat/completions') || spec.path?.includes('/v1/models');
    },

    isModelsRequest(spec: any): boolean {
        return spec.path?.includes('/v1/models') && spec.method === 'GET';
    },

    buildModelsRequestSpec(spec: any): any {
        const newHeaders = { ...spec.headers };
        delete newHeaders['authorization'];
        delete newHeaders['openai-organization'];

        return {
            ...spec,
            path: '/v1beta/models',
            headers: newHeaders,
            query_params: {}
        };
    },

    convertModelsResponse(geminiResponse: string): string {
        try {
            const geminiData = JSON.parse(geminiResponse);
            const models = (geminiData.models || [])
                .filter((m: any) => {
                    const methods = m.supportedGenerationMethods || [];
                    return methods.includes('generateContent') || methods.includes('streamGenerateContent');
                })
                .map((m: any) => ({
                    id: m.name?.replace('models/', '') || m.name,
                    object: 'model',
                    created: Math.floor(Date.now() / 1000),
                    owned_by: 'google',
                    permission: [],
                    root: m.name?.replace('models/', '') || m.name,
                    parent: null,
                }));

            return JSON.stringify({
                object: 'list',
                data: models
            });
        } catch (e) {
            UI.log(`[OpenAI] models 响应转换失败: ${e}`, 'error');
            return JSON.stringify({ object: 'list', data: [] });
        }
    },

    getGeminiModel(openaiModel: string): string {
        if (openaiModel?.startsWith('gemini')) {
            return openaiModel;
        }
        return this.modelMapping[openaiModel] || 'gemini-2.0-flash';
    },

    convertRequest(spec: any): { geminiSpec: any; isStream: boolean; originalModel: string } {
        const body = typeof spec.body === 'string' ? JSON.parse(spec.body) : spec.body;
        const isStream = body.stream === true;
        const originalModel = body.model || 'gpt-4';
        const geminiModel = this.getGeminiModel(originalModel);

        UI.log(`[OpenAI] 转换请求: ${originalModel} → ${geminiModel}`, 'system');

        const contents: any[] = [];
        let systemInstruction: any = null;
        let isTopSystem = true;

        for (const msg of body.messages || []) {
            if (msg.role === 'system') {
                const text = this._extractTextContent(msg.content);
                
                if (isTopSystem) {
                    if (systemInstruction) {
                        systemInstruction.parts[0].text += '\n' + text;
                    } else {
                        systemInstruction = { parts: [{ text }] };
                    }
                } else {
                    if (contents.length > 0) {
                        const lastContent = contents[contents.length - 1];
                        const lastTextPart = lastContent.parts.findLast((p: any) => p.text !== undefined);
                        if (lastTextPart) {
                            lastTextPart.text += '\n' + text;
                        } else {
                            lastContent.parts.push({ text });
                        }
                    } else {
                        contents.push({ role: 'user', parts: [{ text }] });
                    }
                }
            } else {
                isTopSystem = false;
                const role = msg.role === 'assistant' ? 'model' : 'user';
                const parts = this._convertContentToParts(msg.content);
                contents.push({ role, parts });
            }
        }

        const mergedContents = this._mergeConsecutiveRoles(contents);

        const generationConfig: any = {};
        if (body.max_tokens) generationConfig.maxOutputTokens = body.max_tokens;
        if (body.temperature !== undefined) generationConfig.temperature = body.temperature;
        if (body.top_p !== undefined) generationConfig.topP = body.top_p;
        if (body.stop) {
            generationConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];
        }

        const geminiBody: any = { contents: mergedContents };
        if (systemInstruction) geminiBody.systemInstruction = systemInstruction;
        if (Object.keys(generationConfig).length > 0) geminiBody.generationConfig = generationConfig;

        const action = isStream ? 'streamGenerateContent' : 'generateContent';
        const geminiPath = `/v1beta/models/${geminiModel}:${action}`;
        
        const newHeaders = { ...spec.headers };
        newHeaders['content-type'] = 'application/json';
        delete newHeaders['authorization'];
        delete newHeaders['openai-organization'];

        const geminiSpec = {
            ...spec,
            path: geminiPath,
            headers: newHeaders,
            body: JSON.stringify(geminiBody),
            query_params: isStream ? { alt: 'sse' } : {}
        };

        return { geminiSpec, isStream, originalModel };
    },

    _extractTextContent(content: any): string {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join('\n');
        }
        return '';
    },

    _convertContentToParts(content: any): any[] {
        if (typeof content === 'string') {
            return [{ text: content }];
        }
        if (Array.isArray(content)) {
            const parts: any[] = [];
            for (const item of content) {
                if (item.type === 'text') {
                    parts.push({ text: item.text });
                } else if (item.type === 'image_url') {
                    const url = item.image_url?.url || '';
                    if (url.startsWith('data:')) {
                        const match = url.match(/^data:(.+?);base64,(.+)$/);
                        if (match) {
                            parts.push({
                                inlineData: {
                                    mimeType: match[1],
                                    data: match[2]
                                }
                            });
                        }
                    }
                }
            }
            return parts.length > 0 ? parts : [{ text: '' }];
        }
        return [{ text: '' }];
    },

    _mergeConsecutiveRoles(contents: any[]): any[] {
        if (contents.length === 0) return contents;
        
        const merged: any[] = [];
        for (const content of contents) {
            const last = merged[merged.length - 1];
            if (last && last.role === content.role) {
                last.parts = last.parts.concat(content.parts);
            } else {
                merged.push({ ...content, parts: [...content.parts] });
            }
        }
        return merged;
    },

    convertStreamChunk(geminiChunk: string, model: string, requestId: string): string {
        const lines = geminiChunk.split('\n');
        const outputLines: string[] = [];

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.substring(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
                const geminiData = JSON.parse(jsonStr);
                const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const finishReason = this._mapFinishReason(geminiData.candidates?.[0]?.finishReason);

                const openaiChunk = {
                    id: `chatcmpl-${requestId}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{
                        index: 0,
                        delta: text ? { content: text } : {},
                        finish_reason: finishReason
                    }]
                };

                outputLines.push(`data: ${JSON.stringify(openaiChunk)}\n\n`);
            } catch (e) {
            }
        }

        return outputLines.join('');
    },

    convertResponse(geminiResponse: string, model: string, requestId: string): string {
        try {
            const geminiData = JSON.parse(geminiResponse);
            const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const finishReason = this._mapFinishReason(geminiData.candidates?.[0]?.finishReason);
            const usage = geminiData.usageMetadata;

            const openaiResponse = {
                id: `chatcmpl-${requestId}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: text
                    },
                    finish_reason: finishReason || 'stop'
                }],
                usage: usage ? {
                    prompt_tokens: usage.promptTokenCount || 0,
                    completion_tokens: usage.candidatesTokenCount || 0,
                    total_tokens: usage.totalTokenCount || 0
                } : undefined
            };

            return JSON.stringify(openaiResponse);
        } catch (e) {
            UI.log(`[OpenAI] 响应转换失败: ${e}`, 'error');
            return geminiResponse;
        }
    },

    _mapFinishReason(geminiReason: string | undefined): string | null {
        if (!geminiReason) return null;
        const mapping: Record<string, string> = {
            'STOP': 'stop',
            'MAX_TOKENS': 'length',
            'SAFETY': 'content_filter',
            'RECITATION': 'content_filter',
            'PROHIBITED_CONTENT': 'content_filter',
            'OTHER': 'stop'
        };
        return mapping[geminiReason] || 'stop';
    },

    getOpenAIHeaders(isStream: boolean): Record<string, string> {
        const headers: Record<string, string> = {
            'content-type': isStream ? 'text/event-stream' : 'application/json',
            'cache-control': 'no-cache',
        };
        if (isStream) {
            headers['connection'] = 'keep-alive';
        }
        Helpers.injectCORSHeaders(headers);
        return headers;
    }
};

// === 核心反代逻辑 (RequestProcessor) ===
const RequestProcessor = {
    targetDomain: 'generativelanguage.googleapis.com',
    activeControllers: new Map<string, AbortController>(),
    abortedRequests: new Set<string>(),

    abort(requestId: string) {
        this.abortedRequests.add(requestId);
        
        const controller = this.activeControllers.get(requestId);
        if (controller) {
            controller.abort();
            this.activeControllers.delete(requestId);
        }
        UI.log(`[ABORT] 请求已中断: ${requestId}`, 'system');
        return true;
    },

    isAborted(requestId: string): boolean {
        return this.abortedRequests.has(requestId);
    },

    clearAborted(requestId: string) {
        this.abortedRequests.delete(requestId);
    },

    async execute(requestSpec: any, config: any) {
        const opId = requestSpec.request_id;
        const controller = new AbortController();
        this.activeControllers.set(opId, controller);

        // --- 思维等级兼容逻辑 (Thinking Level Compatibility) ---
        if (config.thinkingCompat) {
             try {
                const headers = requestSpec.headers || {};
                const body = typeof requestSpec.body === 'string' ? JSON.parse(requestSpec.body) : requestSpec.body;
                
                const levelKey = Object.keys(headers).find(k => k.toLowerCase() === 'thinkinglevel');
                let level = levelKey ? headers[levelKey]?.toLowerCase() : null;
                if (levelKey) delete headers[levelKey]; 

                if (body.generationConfig?.thinkingConfig?.thinkingLevel) {
                    level = body.generationConfig.thinkingConfig.thinkingLevel.toLowerCase();
                    delete body.generationConfig.thinkingConfig.thinkingLevel;
                }

                if (level) {
                    if (!body.generationConfig) body.generationConfig = {};
                    
                    if (level === 'high') {
                        delete body.generationConfig.thinkingConfig;
                        UI.log(`[Thinking] 思维等级映射: ${level} → 默认`, 'traffic');
                    } else {
                        const mapping: Record<string, number> = {
                            'minimal': 0,
                            'low': 1024,
                            'medium': 8192
                        };
                        const budget = mapping[level];
                        if (budget !== undefined) {
                            body.generationConfig.thinkingConfig = { thinkingBudget: budget };
                            UI.log(`[Thinking] 思维等级映射: ${level} → thinkingBudget: ${budget}`, 'traffic');
                        }
                    }
                    requestSpec.body = JSON.stringify(body);
                }
             } catch (e) {
                 UI.log(`[Thinking] 处理兼容逻辑失败: ${e}`, 'error');
             }
        }

        UI.log(`[REQ] ${requestSpec.method} ${requestSpec.path}`, 'traffic');
        
        try {
            const url = this._constructUrl(requestSpec, config);
            const options = this._buildOptions(requestSpec, controller.signal);
            
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            return response;

        } catch (error) {
            throw error;
        } finally {
            this.activeControllers.delete(opId);
        }
    },

    _constructUrl(spec: any, config: any) {
        let path = spec.path.startsWith('/') ? spec.path.substring(1) : spec.path;
        const params = new URLSearchParams(spec.query_params);

        if (config.modelRedirect) {
             if (path.includes('generateContent') || path.includes('streamGenerateContent')) {
                 if (path.includes('gemini-2.5-pro')) {
                     path = path.replace('gemini-2.5-pro', 'gemini-3-pro-preview');
                     UI.log('[Redirect] 已重定向至 gemini-3-pro-preview', 'system');
                 }
             }
        }

        if (params.has('key')) {
            params.delete('key');
            UI.log('[Security] 已移除 URL 中的 API Key 参数', 'system');
        }

        if (config.streamMode === 'fake') {
            if (path.includes(':streamGenerateContent')) {
                path = path.replace(':streamGenerateContent', ':generateContent');
                UI.log('已修正 Path 为非流式以适配 Fake 模式', 'system');
            }
            if (params.get('alt') === 'sse') {
                params.delete('alt');
            }
        }

        const qs = params.toString();
        return `https://${this.targetDomain}/${path}${qs ? '?' + qs : ''}`;
    },

    _buildOptions(spec: any, signal: AbortSignal) {
        const headers: any = { ...spec.headers };
        ['host', 'origin', 'referer', 'content-length'].forEach(k => delete headers[k]);
        
        const opts: RequestInit = {
            method: spec.method,
            headers: headers,
            signal: signal
        };

        if (['POST', 'PUT', 'PATCH'].includes(spec.method) && spec.body) {
            opts.body = typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body);
        }

        return opts;
    }
};

// === 代理系统协调者 ===
const ProxySystem = {
    conn: new ConnectionManager(),
    isRunning: false,

    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
    },

    start() {
        const config = UI.getConfig();
        
        localStorage.setItem('np_stream_mode', config.streamMode);

        this.conn.connect(config.wsUrl);
        
        KeepAliveManager.start(config.keepAlive);
        
        this.isRunning = true;
        UI.log('系统服务已启动', 'system');
    },

    stop() {
        this.conn.disconnect();
        KeepAliveManager.stop();
        this.isRunning = false;
        UI.log('系统服务已停止', 'system');
    },

    async handleResumableStream(initialSpec: any, config: any) {
        const opId = initialSpec.request_id;
        let currentSpec = JSON.parse(JSON.stringify(initialSpec)); 
        let accumulatedSinceLastRetry = '';
        let headersSent = false;
        let finalTokenCount = 0;
    
        UI.log(`[RESUME] 启动截断续写任务 (ID: ${opId}), 最大重试: ${config.resumeLimit}`, 'system');
    
        for (let attempt = 0; attempt <= config.resumeLimit; attempt++) {
            if (RequestProcessor.isAborted(opId)) {
                RequestProcessor.clearAborted(opId);
                UI.log(`[RESUME] 请求已被中断 (ID: ${opId})`, 'system');
                return;
            }
            
            let wasProhibited = false;
            
            try {
                const response = await RequestProcessor.execute(currentSpec, { ...config, streamMode: 'real' });
                
                if (RequestProcessor.isAborted(opId)) {
                    RequestProcessor.clearAborted(opId);
                    return;
                }
                
                if (!headersSent) {
                    const headers: any = {};
                    response.headers.forEach((v, k) => headers[k] = v);
                    Helpers.injectCORSHeaders(headers);
                    this.conn.send({
                        request_id: opId,
                        event_type: 'response_headers',
                        status: response.status,
                        headers: headers
                    });
                    headersSent = true;
                }
    
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                
                if (reader) {
                    while (true) {
                        if (RequestProcessor.isAborted(opId)) {
                            reader.cancel();
                            RequestProcessor.clearAborted(opId);
                            return;
                        }
                        
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (!line.startsWith('data: ')) continue;
                            const jsonData = line.substring(6).trim();
                            if (!jsonData || jsonData === '[DONE]') continue;

                            try {
                                const chunkJson = JSON.parse(jsonData);
                                
                                if (chunkJson.candidates?.[0]?.finishReason === 'PROHIBITED_CONTENT') {
                                    wasProhibited = true;
                                    UI.log(`[RESUME] 检测到内容截断 (Attempt ${attempt + 1})`, 'error');
                                    break;
                                }

                                const textPart = chunkJson.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (textPart) {
                                    accumulatedSinceLastRetry += textPart;
                                }
                                
                                if (chunkJson.usageMetadata?.totalTokenCount) {
                                    finalTokenCount = chunkJson.usageMetadata.totalTokenCount;
                                }

                                this.conn.send({ request_id: opId, event_type: 'chunk', data: line + '\n\n' });
                            } catch (e) {
                                UI.log(`[RESUME] JSON 解析错误: ${e}`, 'error');
                            }
                        }
                        if (wasProhibited) break;
                    }
                }
    
                if (!wasProhibited) {
                    UI.log(`[RESUME] 请求成功完成 (ID: ${opId})`, 'success');
                    UI.recordCall(finalTokenCount);
                    this.conn.send({ request_id: opId, event_type: 'stream_close' });
                    RequestProcessor.clearAborted(opId);
                    return;
                }
                
                if (attempt >= config.resumeLimit) {
                    UI.log(`[RESUME] 达到最大重试次数，任务终止 (ID: ${opId})`, 'error');
                    break;
                }
    
                UI.log(`[RESUME] 准备重试... (Attempt ${attempt + 2})`, 'system');
    
                const body = JSON.parse(currentSpec.body);
                if (!body.contents) body.contents = [];
    
                const lastMessage = body.contents[body.contents.length - 1];
                if (lastMessage && lastMessage.role === 'model') {
                    lastMessage.parts[0].text += accumulatedSinceLastRetry;
                    UI.log('[RESUME] 已追加内容到上一条 model 消息', 'info');
                } else {
                    body.contents.push({
                        role: 'model',
                        parts: [{ text: accumulatedSinceLastRetry }]
                    });
                    UI.log('[RESUME] 已添加新的 model 消息', 'info');
                }
    
                currentSpec.body = JSON.stringify(body);
                accumulatedSinceLastRetry = ''; 
    
            } catch (err: any) {
                if (err.name === 'AbortError' || RequestProcessor.isAborted(opId)) {
                    RequestProcessor.clearAborted(opId);
                    UI.log(`[RESUME] 请求已被服务端中断 (ID: ${opId})`, 'system');
                    return;
                }
                
                UI.log(`[RESUME] 请求失败: ${err.message}`, 'error');
                this.conn.send({
                    request_id: opId, event_type: 'error', status: 500, message: err.message
                });
                return;
            }
        }
    
        UI.recordCall(finalTokenCount);
        this.conn.send({ request_id: opId, event_type: 'stream_close' });
    },

    async handleMessage(rawMsg: string) {
        let spec;
        try {
            spec = JSON.parse(rawMsg);
        } catch (e) { return; }

        const config = UI.getConfig();
        const opId = spec.request_id;

        if (spec.method === 'OPTIONS') {
            UI.log(`[CORS] 处理 Preflight 请求 (ID: ${opId})`, 'traffic');
            const headers = Helpers.injectCORSHeaders({});
            this.conn.send({
                request_id: opId,
                event_type: 'response_headers',
                status: 204, 
                headers: headers
            });
            this.conn.send({ request_id: opId, event_type: 'stream_close' });
            return;
        }

        if (OpenAIAdapter.isOpenAIRequest(spec)) {
            await this.handleOpenAIRequest(spec, config);
            return;
        }
        
        const currentMode = config.streamMode; 
        const isOriginalStream = spec.path.includes(':streamGenerateContent') || spec.query_params?.alt === 'sse';
        let keepAliveTimer: any = null;

        if (currentMode === 'real' && isOriginalStream && config.resumeOnProhibit) {
            await this.handleResumableStream(spec, config);
            return;
        }

        if (currentMode === 'fake' && isOriginalStream) {
            UI.log(`[Keep-Alive] 启动假流式心跳 (ID: ${opId})`, 'system');
            keepAliveTimer = setInterval(() => {
                this.conn.send({ 
                    request_id: opId, 
                    event_type: 'chunk', 
                    data: `data: {"candidates":[{"content":{"parts":[{"text":""}],"role":"model"},"index":0}]}\n\n`
                });
            }, 1500);
        }

        try {
            const response = await RequestProcessor.execute(spec, config);
            
            if (RequestProcessor.isAborted(opId)) {
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                RequestProcessor.clearAborted(opId);
                return;
            }
            
            const headers: any = {};
            response.headers.forEach((v, k) => headers[k] = v);
            Helpers.injectCORSHeaders(headers);

            if (currentMode === 'fake' && isOriginalStream) {
                headers['content-type'] = 'text/event-stream';
                headers['cache-control'] = 'no-cache';
                headers['connection'] = 'keep-alive';
                delete headers['content-length'];
            }

            this.conn.send({
                request_id: opId,
                event_type: 'response_headers',
                status: response.status,
                headers: headers
            });

            if (currentMode === 'real') {
                if (keepAliveTimer) clearInterval(keepAliveTimer);

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                
                let detectedTokens = 0;
                let lastChunkTail = '';

                if (reader) {
                    while (true) {
                        if (RequestProcessor.isAborted(opId)) {
                            reader.cancel();
                            RequestProcessor.clearAborted(opId);
                            return;
                        }
                        
                        const {done, value} = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, {stream: true});
                        
                        const searchArea = lastChunkTail + chunk;
                        const tokenMatch = searchArea.match(/"totalTokenCount"\s*:\s*(\d+)/);
                        if (tokenMatch) {
                            detectedTokens = parseInt(tokenMatch[1], 10);
                        }
                        lastChunkTail = chunk.slice(-50);
                        this.conn.send({ request_id: opId, event_type: 'chunk', data: chunk });
                    }
                }
                
                UI.recordCall(detectedTokens);
                
            } else {
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let text = '';
                
                if (reader) {
                    while (true) {
                        if (RequestProcessor.isAborted(opId)) {
                            reader.cancel();
                            if (keepAliveTimer) clearInterval(keepAliveTimer);
                            RequestProcessor.clearAborted(opId);
                            return;
                        }
                        
                        const { done, value } = await reader.read();
                        if (done) break;
                        text += decoder.decode(value, { stream: true });
                    }
                    text += decoder.decode(); 
                }
                
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                
                if (RequestProcessor.isAborted(opId)) {
                    RequestProcessor.clearAborted(opId);
                    return;
                }
                
                let tokenCount = 0;
                try {
                    const json = JSON.parse(text);
                    let meta = json.usageMetadata;
                    if (!meta && Array.isArray(json) && json.length > 0) {
                        meta = json[json.length - 1].usageMetadata;
                    }
                    if(meta?.totalTokenCount) tokenCount = meta.totalTokenCount;
                } catch(e){}

                UI.recordCall(tokenCount);
                this.conn.send({ request_id: opId, event_type: 'chunk', data: isOriginalStream ? (`data: ${text}\n\n`) : text});
            }

            this.conn.send({ request_id: opId, event_type: 'stream_close' });
            UI.log(`[RES] 请求完成 (${currentMode})`, 'success');

        } catch (err: any) {
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            
            if (err.name === 'AbortError' || RequestProcessor.isAborted(opId)) {
                RequestProcessor.clearAborted(opId);
                UI.log(`[ABORT] 请求已被服务端中断 (ID: ${opId})`, 'system');
                return;
            }
            
            UI.log(`请求失败: ${err.message}`, 'error');
            this.conn.send({
                request_id: opId,
                event_type: 'error',
                status: 500,
                message: err.message
            });
        } finally {
            RequestProcessor.clearAborted(opId);
        }
    },

    async handleOpenAIRequest(spec: any, config: any) {
        const opId = spec.request_id;
        
        if (OpenAIAdapter.isModelsRequest(spec)) {
            UI.log(`[OpenAI] 获取模型列表 (ID: ${opId})`, 'system');
            
            try {
                const modelsSpec = OpenAIAdapter.buildModelsRequestSpec(spec);
                const response = await RequestProcessor.execute(modelsSpec, config);
                const text = await response.text();
                
                const openaiModels = OpenAIAdapter.convertModelsResponse(text);
                const headers = { 'content-type': 'application/json' };
                Helpers.injectCORSHeaders(headers);
                
                this.conn.send({
                    request_id: opId,
                    event_type: 'response_headers',
                    status: 200,
                    headers: headers
                });
                this.conn.send({
                    request_id: opId,
                    event_type: 'chunk',
                    data: openaiModels
                });
                this.conn.send({ request_id: opId, event_type: 'stream_close' });
                UI.log(`[OpenAI] 模型列表获取成功 (ID: ${opId})`, 'success');
            } catch (err: any) {
                UI.log(`[OpenAI] 获取模型列表失败: ${err.message}`, 'error');
                const headers = { 'content-type': 'application/json' };
                Helpers.injectCORSHeaders(headers);
                this.conn.send({
                    request_id: opId,
                    event_type: 'response_headers',
                    status: 500,
                    headers: headers
                });
                this.conn.send({
                    request_id: opId,
                    event_type: 'chunk',
                    data: JSON.stringify({ error: { message: err.message, type: 'api_error' } })
                });
                this.conn.send({ request_id: opId, event_type: 'stream_close' });
            }
            return;
        }

        UI.log(`[OpenAI] 接收到 chat/completions 请求 (ID: ${opId})`, 'system');

        try {
            const { geminiSpec, isStream, originalModel } = OpenAIAdapter.convertRequest(spec);
            const currentMode = config.streamMode;

            if (isStream && config.resumeOnProhibit && currentMode === 'real') {
                await this.handleOpenAIResumableStream(geminiSpec, config, originalModel, opId);
                return;
            }

            let keepAliveTimer: any = null;

            if (isStream && currentMode === 'fake') {
                UI.log(`[OpenAI] 启动假流式心跳 (ID: ${opId})`, 'system');
                this.conn.send({
                    request_id: opId,
                    event_type: 'response_headers',
                    status: 200,
                    headers: OpenAIAdapter.getOpenAIHeaders(true)
                });
                
                keepAliveTimer = setInterval(() => {
                    const heartbeat = {
                        id: `chatcmpl-${opId}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: originalModel,
                        choices: [{ index: 0, delta: {}, finish_reason: null }]
                    };
                    this.conn.send({ 
                        request_id: opId, 
                        event_type: 'chunk', 
                        data: `data: ${JSON.stringify(heartbeat)}\n\n`
                    });
                }, 1500);
            }

            try {
                const response = await RequestProcessor.execute(geminiSpec, config);

                if (RequestProcessor.isAborted(opId)) {
                    if (keepAliveTimer) clearInterval(keepAliveTimer);
                    RequestProcessor.clearAborted(opId);
                    return;
                }

                if (!keepAliveTimer) {
                    this.conn.send({
                        request_id: opId,
                        event_type: 'response_headers',
                        status: response.status,
                        headers: OpenAIAdapter.getOpenAIHeaders(isStream)
                    });
                }

                if (isStream) {
                    if (currentMode === 'real') {
                        const reader = response.body?.getReader();
                        const decoder = new TextDecoder();
                        let detectedTokens = 0;

                        if (reader) {
                            while (true) {
                                if (RequestProcessor.isAborted(opId)) {
                                    reader.cancel();
                                    RequestProcessor.clearAborted(opId);
                                    return;
                                }
                                
                                const { done, value } = await reader.read();
                                if (done) break;
                                
                                const chunk = decoder.decode(value, { stream: true });
                                
                                const tokenMatch = chunk.match(/"totalTokenCount"\s*:\s*(\d+)/);
                                if (tokenMatch) {
                                    detectedTokens = parseInt(tokenMatch[1], 10);
                                }

                                const openaiChunk = OpenAIAdapter.convertStreamChunk(chunk, originalModel, opId);
                                if (openaiChunk) {
                                    this.conn.send({ request_id: opId, event_type: 'chunk', data: openaiChunk });
                                }
                            }
                        }

                        this.conn.send({ request_id: opId, event_type: 'chunk', data: 'data: [DONE]\n\n' });
                        UI.recordCall(detectedTokens);
                    } else {
                        const reader = response.body?.getReader();
                        const decoder = new TextDecoder();
                        let text = '';
                        
                        if (reader) {
                            while (true) {
                                if (RequestProcessor.isAborted(opId)) {
                                    reader.cancel();
                                    if (keepAliveTimer) clearInterval(keepAliveTimer);
                                    RequestProcessor.clearAborted(opId);
                                    return;
                                }
                                
                                const { done, value } = await reader.read();
                                if (done) break;
                                text += decoder.decode(value, { stream: true });
                            }
                            text += decoder.decode(); 
                        }
                        
                        if (keepAliveTimer) clearInterval(keepAliveTimer);

                        if (RequestProcessor.isAborted(opId)) {
                            RequestProcessor.clearAborted(opId);
                            return;
                        }

                        let tokenCount = 0;
                        try {
                            const json = JSON.parse(text);
                            if (json.usageMetadata?.totalTokenCount) {
                                tokenCount = json.usageMetadata.totalTokenCount;
                            }
                            
                            const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            const finishReason = OpenAIAdapter._mapFinishReason(json.candidates?.[0]?.finishReason);
                            
                            if (content) {
                                const contentChunk = {
                                    id: `chatcmpl-${opId}`,
                                    object: 'chat.completion.chunk',
                                    created: Math.floor(Date.now() / 1000),
                                    model: originalModel,
                                    choices: [{ index: 0, delta: { content }, finish_reason: null }]
                                };
                                this.conn.send({ request_id: opId, event_type: 'chunk', data: `data: ${JSON.stringify(contentChunk)}\n\n` });
                            }
                            
                            const endChunk = {
                                id: `chatcmpl-${opId}`,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: originalModel,
                                choices: [{ index: 0, delta: {}, finish_reason: finishReason || 'stop' }]
                            };
                            this.conn.send({ request_id: opId, event_type: 'chunk', data: `data: ${JSON.stringify(endChunk)}\n\n` });
                        } catch (e) {
                            UI.log(`[OpenAI] 假流式响应解析失败: ${e}`, 'error');
                        }

                        this.conn.send({ request_id: opId, event_type: 'chunk', data: 'data: [DONE]\n\n' });
                        UI.recordCall(tokenCount);
                    }
                } else {
                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder();
                    let text = '';
                    
                    if (reader) {
                        while (true) {
                            if (RequestProcessor.isAborted(opId)) {
                                reader.cancel();
                                RequestProcessor.clearAborted(opId);
                                return;
                            }
                            
                            const { done, value } = await reader.read();
                            if (done) break;
                            text += decoder.decode(value, { stream: true });
                        }
                        text += decoder.decode(); 
                    }
                    
                    if (RequestProcessor.isAborted(opId)) {
                        RequestProcessor.clearAborted(opId);
                        return;
                    }
                    
                    let tokenCount = 0;
                    try {
                        const json = JSON.parse(text);
                        if (json.usageMetadata?.totalTokenCount) {
                            tokenCount = json.usageMetadata.totalTokenCount;
                        }
                    } catch (e) {}

                    const openaiResponse = OpenAIAdapter.convertResponse(text, originalModel, opId);
                    this.conn.send({ request_id: opId, event_type: 'chunk', data: openaiResponse });
                    UI.recordCall(tokenCount);
                }

                this.conn.send({ request_id: opId, event_type: 'stream_close' });
                UI.log(`[OpenAI] 请求完成 (${currentMode}) (ID: ${opId})`, 'success');

            } catch (err: any) {
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                throw err;
            } finally {
                RequestProcessor.clearAborted(opId);
            }

        } catch (err: any) {
            if (err.name === 'AbortError' || RequestProcessor.isAborted(opId)) {
                RequestProcessor.clearAborted(opId);
                UI.log(`[OpenAI] 请求已被服务端中断 (ID: ${opId})`, 'system');
                return;
            }

            UI.log(`[OpenAI] 请求失败: ${err.message}`, 'error');
            
            const errorResponse = {
                error: {
                    message: err.message,
                    type: 'api_error',
                    code: 'internal_error'
                }
            };
            
            const headers = { 'content-type': 'application/json' };
            Helpers.injectCORSHeaders(headers);

            this.conn.send({
                request_id: opId,
                event_type: 'response_headers',
                status: 500,
                headers: headers
            });
            this.conn.send({
                request_id: opId,
                event_type: 'chunk',
                data: JSON.stringify(errorResponse)
            });
            this.conn.send({ request_id: opId, event_type: 'stream_close' });
        }
    },

    async handleOpenAIResumableStream(initialSpec: any, config: any, originalModel: string, opId: string) {
        let currentSpec = JSON.parse(JSON.stringify(initialSpec));
        let accumulatedText = '';
        let headersSent = false;
        let finalTokenCount = 0;

        UI.log(`[OpenAI-RESUME] 启动截断续写 (ID: ${opId}), 最大重试: ${config.resumeLimit}`, 'system');

        for (let attempt = 0; attempt <= config.resumeLimit; attempt++) {
            if (RequestProcessor.isAborted(opId)) {
                RequestProcessor.clearAborted(opId);
                UI.log(`[OpenAI-RESUME] 请求已被中断 (ID: ${opId})`, 'system');
                return;
            }
            
            let wasProhibited = false;

            try {
                const response = await RequestProcessor.execute(currentSpec, { ...config, streamMode: 'real' });

                if (RequestProcessor.isAborted(opId)) {
                    RequestProcessor.clearAborted(opId);
                    return;
                }

                if (!headersSent) {
                    this.conn.send({
                        request_id: opId,
                        event_type: 'response_headers',
                        status: response.status,
                        headers: OpenAIAdapter.getOpenAIHeaders(true)
                    });
                    headersSent = true;
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (reader) {
                    while (true) {
                        if (RequestProcessor.isAborted(opId)) {
                            reader.cancel();
                            RequestProcessor.clearAborted(opId);
                            return;
                        }
                        
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (!line.startsWith('data: ')) continue;
                            const jsonStr = line.substring(6).trim();
                            if (!jsonStr || jsonStr === '[DONE]') continue;

                            try {
                                const geminiData = JSON.parse(jsonStr);

                                if (geminiData.candidates?.[0]?.finishReason === 'PROHIBITED_CONTENT') {
                                    wasProhibited = true;
                                    UI.log(`[OpenAI-RESUME] 检测到内容截断 (Attempt ${attempt + 1})`, 'error');
                                    break;
                                }

                                const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                                if (text) {
                                    accumulatedText += text;

                                    const openaiChunk = {
                                        id: `chatcmpl-${opId}`,
                                        object: 'chat.completion.chunk',
                                        created: Math.floor(Date.now() / 1000),
                                        model: originalModel,
                                        choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
                                    };
                                    this.conn.send({ request_id: opId, event_type: 'chunk', data: `data: ${JSON.stringify(openaiChunk)}\n\n` });
                                }

                                if (geminiData.usageMetadata?.totalTokenCount) {
                                    finalTokenCount = geminiData.usageMetadata.totalTokenCount;
                                }
                            } catch (e) {
                            }
                        }
                        if (wasProhibited) break;
                    }
                }

                if (!wasProhibited) {
                    const endChunk = {
                        id: `chatcmpl-${opId}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: originalModel,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                    };
                    this.conn.send({ request_id: opId, event_type: 'chunk', data: `data: ${JSON.stringify(endChunk)}\n\n` });
                    this.conn.send({ request_id: opId, event_type: 'chunk', data: 'data: [DONE]\n\n' });
                    
                    UI.log(`[OpenAI-RESUME] 请求成功完成 (ID: ${opId})`, 'success');
                    UI.recordCall(finalTokenCount);
                    this.conn.send({ request_id: opId, event_type: 'stream_close' });
                    return;
                }

                if (attempt >= config.resumeLimit) {
                    UI.log(`[OpenAI-RESUME] 达到最大重试次数 (ID: ${opId})`, 'error');
                    break;
                }

                UI.log(`[OpenAI-RESUME] 准备重试... (Attempt ${attempt + 2})`, 'system');

                const body = JSON.parse(currentSpec.body);
                if (!body.contents) body.contents = [];

                const lastMessage = body.contents[body.contents.length - 1];
                if (lastMessage && lastMessage.role === 'model') {
                    lastMessage.parts[0].text += accumulatedText;
                } else {
                    body.contents.push({
                        role: 'model',
                        parts: [{ text: accumulatedText }]
                    });
                }

                currentSpec.body = JSON.stringify(body);
                accumulatedText = '';

            } catch (err: any) {
                if (err.name === 'AbortError' || RequestProcessor.isAborted(opId)) {
                    RequestProcessor.clearAborted(opId);
                    UI.log(`[OpenAI-RESUME] 请求已被中断 (ID: ${opId})`, 'system');
                    return;
                }

                UI.log(`[OpenAI-RESUME] 请求失败: ${err.message}`, 'error');
                
                const errorResponse = {
                    error: { message: err.message, type: 'api_error', code: 'internal_error' }
                };
                const headers = { 'content-type': 'application/json' };
                Helpers.injectCORSHeaders(headers);
                this.conn.send({
                    request_id: opId,
                    event_type: 'response_headers',
                    status: 500,
                    headers: headers
                });
                this.conn.send({ request_id: opId, event_type: 'chunk', data: JSON.stringify(errorResponse) });
                this.conn.send({ request_id: opId, event_type: 'stream_close' });
                RequestProcessor.clearAborted(opId);
                return;
            }
        }

        const endChunk = {
            id: `chatcmpl-${opId}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: originalModel,
            choices: [{ index: 0, delta: {}, finish_reason: 'content_filter' }]
        };
        this.conn.send({ request_id: opId, event_type: 'chunk', data: `data: ${JSON.stringify(endChunk)}\n\n` });
        this.conn.send({ request_id: opId, event_type: 'chunk', data: 'data: [DONE]\n\n' });
        UI.recordCall(finalTokenCount);
        this.conn.send({ request_id: opId, event_type: 'stream_close' });
        RequestProcessor.clearAborted(opId);
    }
};

// === 初始化 ===
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    ThemeManager.init();
    AuthManager.init();

    // WiFi 按钮点击切换连接状态
    if (UI.elements.wifiBtn) {
        UI.elements.wifiBtn.addEventListener('click', () => ProxySystem.toggle());
    }

    const clearLogsBtn = document.getElementById('btn-clear-logs');
    if (clearLogsBtn) clearLogsBtn.addEventListener('click', () => {
        const container = document.getElementById('log-container');
        if (container) container.innerHTML = '';
    });

    const clearStatsBtn = document.getElementById('btn-clear-stats');
    if (clearStatsBtn) clearStatsBtn.addEventListener('click', () => UI.clearStats());
    
    const exportStatsBtn = document.getElementById('btn-export-stats');
    if (exportStatsBtn) exportStatsBtn.addEventListener('click', () => {
        const data = JSON.stringify(UI.stats, null, 2);
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proxy-stats-${Date.now()}.json`;
        a.click();
    });
});
