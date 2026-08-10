/**
 * 🍬 CandyBox Proxy - SillyTavern Extension
 * 
 * 版本: 1.0.2
 * 功能: 一键打开 Applet
 * 作者: WanWan
 * 仓库: https://github.com/shleeshlee/CandyBox-Proxy
 * 
 * 免费开源，禁止倒卖
 */

import { extension_settings, getContext } from '../../../extensions.js';

const EXTENSION_NAME = 'CandyBox';

// ============================================
// 配置
// ============================================
const CONFIG = {
  // 公共 Applet 链接。2026-08 Google 改版后必须带 showAssistant+showPreview 参数打开，
  // 否则会落在无法交互的 Remix 页（withAppletParams 统一追加）
  APPLET_URL: 'https://ai.studio/apps/09f6ee61-3e9e-4123-8d22-b1b473593d82',

  // 代理设置
  PROXY_URL: 'http://127.0.0.1:8811',
  PROXY_NAME: 'CandyBox',
};

// 2026-08 改版后直接渲染 app 本体所必需的打开参数
function withAppletParams(u) {
  const parts = ['fullscreenApplet=true', 'showAssistant=true', 'showPreview=true']
    .filter((p) => !u.includes(p.split('=')[0]));
  if (!parts.length) return u;
  return `${u}${u.includes('?') ? '&' : '?'}${parts.join('&')}`;
}

// ============================================
// 状态
// ============================================
let state = {
  appletWindow: null,
};

// ============================================
// 用户自己的 Applet 链接（保存在本地 server，粘贴一次永久生效）
// ============================================
async function getSavedAppletUrl() {
  try {
    const r = await fetch(`${CONFIG.PROXY_URL}/applet-url`);
    const j = await r.json();
    return j.url || null;
  } catch {
    return null;
  }
}

async function saveAppletUrl(url) {
  // text/plain 避免 CORS 预检（服务端会自己解析）
  const r = await fetch(`${CONFIG.PROXY_URL}/applet-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ url }),
  });
  return r.ok;
}

// ============================================
// 打开 Applet
// ============================================
async function openApplet() {
  const saved = await getSavedAppletUrl();
  const url = withAppletParams(saved || CONFIG.APPLET_URL);

  // 必须以 noopener,noreferrer 开完整新标签页：带来源信息(referrer/opener)跳转时
  // AI Studio 会把页面丢进无法交互的 Remix 壳，只有"等价于直接输入地址"的打开方式能进 app(2026-08-10 实测)
  window.open(url, '_blank', 'noopener,noreferrer');
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
  `;
  document.head.appendChild(styleSheet);

  const html = `
    <div id="candybox_container" class="extension_container">
      <div id="cb_panel">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="cb-star-1" style="font-size: 10px;">✦</span>
          <b style="font-size: 12px; font-weight: 500;">CandyBox</b>
          <span style="font-size: 12px; font-weight: 400; opacity: 0.8;">Proxy</span>
          <span class="cb-star-2" style="font-size: 10px;">✧</span>
        </div>
        <div class="fa-solid fa-chevron-right" style="opacity: 0.7; font-size: 10px;"></div>
      </div>
      <div id="cb_setup" style="margin: 4px 0 2px;">
        <input id="cb_applet_url" class="text_pole" type="text"
          placeholder="可选：想用自己的 Applet 副本？点 Remix 拷贝后把链接粘到这里"
          style="width: 100%; font-size: 11px; box-sizing: border-box;">
        <div style="display: flex; gap: 6px; margin-top: 4px; align-items: center;">
          <div id="cb_save_url" class="menu_button" style="font-size: 11px; padding: 2px 12px; margin: 0;">保存链接</div>
          <span id="cb_url_status" style="font-size: 11px; opacity: 0.75;"></span>
        </div>
      </div>
    </div>
  `;

  $('#extensions_settings2').append(html);

  // 显示已保存的链接
  getSavedAppletUrl().then((saved) => {
    if (saved) {
      $('#cb_applet_url').val(saved);
      $('#cb_url_status').text('✓ 使用你自己的 Applet 副本');
    }
  });

  // 点击打开 Applet
  $(document).on('click', '#cb_panel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openApplet();
  });

  // 保存用户自己的 Applet 链接
  $(document).on('click', '#cb_save_url', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = String($('#cb_applet_url').val() || '').trim();
    if (!/^https:\/\/(aistudio\.google\.com|ai\.studio)\/apps\//.test(url)) {
      $('#cb_url_status').text('✗ 链接不对，要 aistudio.google.com/apps/... 形态');
      return;
    }
    try {
      const ok = await saveAppletUrl(url);
      $('#cb_url_status').text(ok ? '✓ 已保存，以后点上方按钮直达你的 Applet' : '✗ 保存失败，服务端未运行？');
    } catch {
      $('#cb_url_status').text('✗ 保存失败，CandyBox 服务没启动？');
    }
  });
}

// ============================================
// 初始化
// ============================================
jQuery(async () => {
  try {
    console.log(`[${EXTENSION_NAME}] 🍬 正在加载...`);
    
    createUI();
    registerProxy();
    
    console.log(`[${EXTENSION_NAME}] ✅ 加载完成`);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] ❌ 加载失败:`, error);
  }
});
