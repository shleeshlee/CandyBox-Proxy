/**
 * 🍬 CandyBox Proxy - SillyTavern Extension
 * 
 * 版本: 1.4.2
 * 功能: PC 直达 + AI Studio 站内入口 + 429 换号提醒
 * 作者: WanWan
 * 仓库: https://github.com/shleeshlee/CandyBox-Proxy
 * 
 * 免费开源，禁止倒卖
 */

import { extension_settings, getContext } from '../../../extensions.js';

const EXTENSION_NAME = 'CandyBox';
const VERSION = '1.4.2';

// ============================================
// 配置
// ============================================
const CONFIG = {
  // 公共 Applet 链接（PC 直达的默认目标；可在面板粘贴自己 Remix 副本的公共链接覆盖）。
  // 一律裸链接打开：2026-08-12 实测带 fullscreenApplet/showAssistant/showPreview 参数
  // 会触发"送进你自己的 remix 副本"的路由并卡死，裸链接才是新体系的正确姿势。
  APPLET_URL: 'https://ai.studio/apps/09f6ee61-3e9e-4123-8d22-b1b473593d82',

  // 代理设置
  PROXY_URL: 'http://127.0.0.1:8811',
  PROXY_NAME: 'CandyBox',

  // AI Studio 站内入口（My apps 列表页）。2026-08-12 改版后手机端唯一可用入口：
  // 链接直开会撞 Remix 墙，从站内列表点 app 一切正常。换号也在站内完成
  // （头像 → 退出当前账号 → 登下一个号；注意必须退出，点"切换"无效）。
  STUDIO_URL: 'https://aistudio.google.com/apps',
};

// 以 noopener,noreferrer 开完整新标签页，等价于"地址栏直接输入"的打开方式
function openUrl(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ============================================
// 服务端接口（链接保存在本地 server，粘贴一次永久生效）
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

// text/plain 避免 CORS 预检（服务端会自己解析）
async function postPlain(path, data) {
  return fetch(`${CONFIG.PROXY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(data),
  });
}

// ============================================
// 打开 Applet（PC 直达：开保存的链接，没存过就开公共链接）
// ============================================
async function openApplet() {
  const saved = await getSavedAppletUrl();
  openUrl(saved || CONFIG.APPLET_URL);
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
      <div id="cb_studio" title="手机/换号用：进 AI Studio，从 My apps 列表点你 Remix 的 app">
        <span>📱 AI Studio 入口</span>
        <span style="font-weight: 400; opacity: 0.6; font-size: 11px;">手机从 My apps 点 app · 换号先退出再登录</span>
      </div>
      <div id="cb_setup" style="margin: 4px 0 2px;">
        <input id="cb_applet_url" class="text_pole" type="text"
          placeholder="可选：粘贴你自己 Remix 副本的公共链接（PC 直达用）"
          style="width: 100%; font-size: 11px; box-sizing: border-box;">
        <div style="display: flex; gap: 6px; margin-top: 4px; align-items: center;">
          <div id="cb_save_url" class="menu_button" style="font-size: 11px; padding: 2px 12px; margin: 0; white-space: nowrap; width: auto;">保存链接</div>
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
      $('#cb_url_status').text('✓ PC 直达用你自己的副本');
    }
  });

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

  // 保存用户自己的副本链接（PC 直达用）
  $(document).on('click', '#cb_save_url', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = String($('#cb_applet_url').val() || '').trim();
    if (!/^https:\/\/(aistudio\.google\.com|ai\.studio)\/apps\//.test(url)) {
      $('#cb_url_status').text('✗ 链接不对，要 aistudio.google.com/apps/... 形态');
      return;
    }
    try {
      const r = await postPlain('/applet-url', { url });
      if (r.ok) {
        $('#cb_url_status').text('✓ 已保存，PC 直达走你自己的副本');
      } else {
        const j = await r.json().catch(() => ({}));
        $('#cb_url_status').text(`✗ ${j.error || '保存失败'}`);
      }
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
    console.log(`[${EXTENSION_NAME}] 🍬 v${VERSION} 正在加载...`);
    
    createUI();
    registerProxy();
    connectEvents();

    console.log(`[${EXTENSION_NAME}] ✅ 加载完成`);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] ❌ 加载失败:`, error);
  }
});
