/**
 * 🍬 CandyBox Proxy - SillyTavern Extension
 * 糖果盒代理 - 酒馆扩展
 * 
 * 功能：状态显示 + 一键打开 Applet
 * 作者：shleeshlee
 * 仓库：https://github.com/shleeshlee/CandyBox-Proxy
 */

import { extension_settings, getContext } from '../../../extensions.js';

const EXTENSION_NAME = 'CandyBox';

// ============================================
// 配置
// ============================================
const CONFIG = {
  // Applet 地址 - 替换为你自己的
  APPLET_URL: 'https://aistudio.google.com/',
  
  // 代理设置
  PROXY_URL: 'http://127.0.0.1:8811',
  PROXY_NAME: '糖果盒代理',
  
  // 状态检查间隔 (毫秒)
  CHECK_INTERVAL: 5000,
};

// ============================================
// 状态
// ============================================
let state = {
  serverOk: false,
  browserOk: false,
  checkTimer: null,
  appletWindow: null,
};

// ============================================
// 状态检查
// ============================================
async function checkStatus() {
  try {
    const res = await fetch(`${CONFIG.PROXY_URL}/status`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      state.serverOk = true;
      state.browserOk = data.browser_connected || false;
    } else {
      state.serverOk = false;
      state.browserOk = false;
    }
  } catch {
    state.serverOk = false;
    state.browserOk = false;
  }
  updateUI();
}

// ============================================
// UI 更新
// ============================================
function updateUI() {
  const dot = document.getElementById('cb_status_dot');
  const text = document.getElementById('cb_status_text');
  
  if (!dot || !text) return;

  if (state.serverOk && state.browserOk) {
    dot.style.background = '#22c55e';
    dot.style.boxShadow = '0 0 6px #22c55e';
    text.textContent = '就绪';
    text.style.color = '#86efac';
  } else if (state.serverOk) {
    dot.style.background = '#f59e0b';
    dot.style.boxShadow = '0 0 6px #f59e0b';
    text.textContent = '等待Applet';
    text.style.color = '#fcd34d';
  } else {
    dot.style.background = '#ef4444';
    dot.style.boxShadow = '0 0 6px #ef4444';
    text.textContent = '离线';
    text.style.color = '#fca5a5';
  }
}

// ============================================
// 打开 Applet
// ============================================
function openApplet() {
  if (state.appletWindow && !state.appletWindow.closed) {
    state.appletWindow.focus();
    return;
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const url = CONFIG.APPLET_URL.includes('?') 
    ? `${CONFIG.APPLET_URL}&fullscreenApplet=true`
    : `${CONFIG.APPLET_URL}?fullscreenApplet=true`;
  
  if (isMobile) {
    state.appletWindow = window.open(url, '_blank');
  } else {
    state.appletWindow = window.open(url, 'candybox-applet', 'width=500,height=700');
  }
  
  setTimeout(checkStatus, 3000);
}

// ============================================
// 注册代理
// ============================================
function registerProxy() {
  try {
    import('../../../openai.js').then(({ proxies }) => {
      if (!proxies) return;
      
      if (!proxies.find(p => p.name === CONFIG.PROXY_NAME)) {
        proxies.push({
          name: CONFIG.PROXY_NAME,
          url: CONFIG.PROXY_URL,
          password: '',
        });

        const select = document.querySelector('#openai_proxy_preset');
        if (select) {
          const option = document.createElement('option');
          option.text = CONFIG.PROXY_NAME;
          option.value = CONFIG.PROXY_NAME;
          select.appendChild(option);
        }

        console.log(`[${EXTENSION_NAME}] 🍬 代理已注册: ${CONFIG.PROXY_NAME}`);
      }
    }).catch(() => {});
  } catch {}
}

// ============================================
// 创建 UI - 星空灰主题
// ============================================
function createUI() {
  const html = `
    <div id="candybox_container" class="extension_container">
      <div id="cb_panel" style="
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
      ">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 10px; opacity: 0.9;">✦ ✧</span>
          <b style="font-size: 12px; font-weight: 500;">糖果盒代理</b>
          <span id="cb_status_dot" style="
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 6px #ef4444;
            flex-shrink: 0;
          "></span>
          <span id="cb_status_text" style="font-size: 10px; color: #fca5a5;">离线</span>
        </div>
        <div class="fa-solid fa-chevron-right" style="opacity: 0.7; font-size: 12px;"></div>
      </div>
    </div>
  `;

  $('#extensions_settings2').append(html);

  // 悬停效果
  $('#cb_panel').on('mouseenter', function() {
    $(this).css('background', 'linear-gradient(135deg, #4b5563 0%, #6b7280 50%, #9ca3af 100%)');
    $(this).css('box-shadow', '0 3px 10px rgba(0, 0, 0, 0.3)');
  }).on('mouseleave', function() {
    $(this).css('background', 'linear-gradient(135deg, #374151 0%, #4b5563 50%, #6b7280 100%)');
    $(this).css('box-shadow', '0 2px 6px rgba(0, 0, 0, 0.2)');
  });

  // 点击打开 Applet
  $(document).on('click', '#cb_panel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openApplet();
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
    
    await checkStatus();
    state.checkTimer = setInterval(checkStatus, CONFIG.CHECK_INTERVAL);
    
    console.log(`[${EXTENSION_NAME}] ✅ 加载完成`);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] ❌ 加载失败:`, error);
  }
});

// 清理
window.addEventListener('beforeunload', () => {
  if (state.checkTimer) {
    clearInterval(state.checkTimer);
  }
});
