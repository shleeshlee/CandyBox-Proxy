/**
 * 🍬 CandyBox Proxy - SillyTavern Extension
 * 
 * 版本: 1.4.4
 * 功能: PC 直达 + AI Studio 站内入口 + 429 换号提醒
 * 作者: WanWan
 * 仓库: https://github.com/shleeshlee/CandyBox-Proxy
 * 
 * 免费开源，禁止倒卖
 */

import { extension_settings, getContext } from '../../../extensions.js';

const EXTENSION_NAME = 'CandyBox';
const VERSION = '1.4.4';

// ============================================
// 配置
// ============================================
const CONFIG = {
  // 公共 Applet 链接（PC 直达的默认目标；可在面板粘贴自己 Remix 副本的公共链接覆盖）。
  // 2026-08 Google 改版后必须带 showAssistant+showPreview 参数打开（withAppletParams 统一追加）
  APPLET_URL: 'https://ai.studio/apps/09f6ee61-3e9e-4123-8d22-b1b473593d82',

  // 代理设置
  PROXY_URL: 'http://127.0.0.1:8811',
  PROXY_NAME: 'CandyBox',

  // AI Studio 站内入口：My apps 的 By you 列表（自己 Remix 的 app 直接在这页点开）。
  // 换号也在站内完成（头像 → 退出当前账号 → 登下一个号；必须退出，点"切换"无效）。
  STUDIO_URL: 'https://aistudio.google.com/apps?source=user&tag=created-by-you',
};

// 2026-08 改版后直接渲染 app 本体所必需的打开参数（2026-08-10 定案）
function withAppletParams(u) {
  const parts = ['fullscreenApplet=true', 'showAssistant=true', 'showPreview=true']
    .filter((p) => !u.includes(p.split('=')[0]));
  if (!parts.length) return u;
  return `${u}${u.includes('?') ? '&' : '?'}${parts.join('&')}`;
}

// 必须以 noopener,noreferrer 开完整新标签页：带来源信息(referrer/opener)跳转时
// AI Studio 会把页面丢进无法交互的 Remix 壳，只有"等价于直接输入地址"的打开方式能进 app(2026-08-10 实测)
function openUrl(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ============================================
// 打开 Applet（PC 直达：固定开公共链接。自定义链接保存功能已随名册一并移除——
// 存下来的链接曾在平台改版后变成死链还继续掌舵，此类状态一律不留）
// ============================================
function openApplet() {
  openUrl(withAppletParams(CONFIG.APPLET_URL));
}

// ============================================
// 429 换号提醒（SSE，服务端检测到配额 429 时推送）
// ============================================
let eventSource = null;
function connectEvents() {
  try {
    if (eventSource) eventSource.close();
    eventSource = new EventSource(`${CONFIG.PROXY_URL}/events`);
    eventSource.addEventListener('quota', () => {
      console.warn(`[${EXTENSION_NAME}] 🍬 收到 429，该换号了`);
      if (typeof toastr !== 'undefined') {
        toastr.warning('这个号的额度可能用完了（429）。点面板里的「AI Studio 入口」进站内换号。', 'CandyBox', { timeOut: 10000 });
      }
    });
    eventSource.onerror = () => {
      eventSource.close();
      eventSource = null;
      setTimeout(connectEvents, 15000);
    };
  } catch { /* 服务端没启动，重连兜底 */ }
}

// ============================================
// 注册代理
// ============================================
function injectProxy() {
  import('../../../openai.js').then(({ proxies }) => {
    if (!proxies) return;

    if (!proxies.find(p => p.name === CONFIG.PROXY_NAME)) {
      proxies.push({
        name: CONFIG.PROXY_NAME,
        url: CONFIG.PROXY_URL,
        password: '',
      });
    }

    // 往下拉框补选项（如果还没有）
    const select = document.querySelector('#openai_proxy_preset');
    if (select && !select.querySelector(`option[value="${CONFIG.PROXY_NAME}"]`)) {
      const option = document.createElement('option');
      option.text = CONFIG.PROXY_NAME;
      option.value = CONFIG.PROXY_NAME;
      select.appendChild(option);
      console.log(`[${EXTENSION_NAME}] 🍬 代理已注册: ${CONFIG.PROXY_NAME}`);
    }
  }).catch(() => {});
}

function registerProxy() {
  // 立即尝试一次
  injectProxy();

  // 监听下拉框重建（ST 的 loadProxyPresets 会 empty + 重建）
  const select = document.querySelector('#openai_proxy_preset');
  if (select) {
    new MutationObserver(() => injectProxy()).observe(select, { childList: true });
  }
}

// ============================================
// 创建 UI - 星空灰主题 + 闪烁星星
// ============================================
function createUI() {
  // 注入闪烁动画样式
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes cb-twinkle-1 {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    @keyframes cb-twinkle-2 {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.9); }
    }
    .cb-star-1 {
      animation: cb-twinkle-1 2s ease-in-out infinite;
    }
    .cb-star-2 {
      animation: cb-twinkle-2 2.5s ease-in-out infinite 0.5s;
    }
    #cb_panel {
      cursor: pointer;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 8px;
      background: linear-gradient(135deg, #374151 0%, #4b5563 50%, #6b7280 100%);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
      margin: 2px 0;
      color: #f3f4f6;
    }
    #cb_panel:hover {
      background: linear-gradient(135deg, #4b5563 0%, #6b7280 50%, #9ca3af 100%);
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
    }
    #cb_studio {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 6px;
      background: rgba(107, 114, 128, 0.25);
      user-select: none;
      margin: 3px 0 1px;
    }
    #cb_studio:hover { background: rgba(107, 114, 128, 0.4); }
  `;
  document.head.appendChild(styleSheet);

  const html = `
    <div id="candybox_container" class="extension_container">
      <div id="cb_panel" title="PC 浏览器用：直接打开 Applet 链接">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="cb-star-1" style="font-size: 10px;">✦</span>
          <b style="font-size: 12px; font-weight: 500;">CandyBox</b>
          <span style="font-size: 12px; font-weight: 400; opacity: 0.8;">Proxy</span>
          <span style="font-size: 10px; opacity: 0.55;">v${VERSION}</span>
          <span class="cb-star-2" style="font-size: 10px;">✧</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 10px; opacity: 0.6;">⚡ PC 直达</span>
          <div class="fa-solid fa-chevron-right" style="opacity: 0.7; font-size: 10px;"></div>
        </div>
      </div>
      <div id="cb_studio" title="手机/换号用：进 AI Studio 的 By you 列表，点你 Remix 的 app">
        <span>📱 AI Studio 入口</span>
        <span style="font-weight: 400; opacity: 0.6; font-size: 11px;">先remix后使用，换号必须退出再登录</span>
      </div>
    </div>
  `;

  $('#extensions_settings2').append(html);

  // 点击本体：PC 直达
  $(document).on('click', '#cb_panel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openApplet();
  });

  // AI Studio 站内入口（手机 / 换号）
  $(document).on('click', '#cb_studio', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openUrl(CONFIG.STUDIO_URL);
  });
}

// ============================================
// 初始化
// ============================================
jQuery(async () => {
  try {
    console.log(`[${EXTENSION_NAME}] 🍬 v${VERSION} 正在加载...`);
    
    createUI();
    registerProxy();
    connectEvents();

    console.log(`[${EXTENSION_NAME}] ✅ 加载完成`);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] ❌ 加载失败:`, error);
  }
});
