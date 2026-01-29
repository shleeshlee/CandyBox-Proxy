/**
 * CottonCandy Proxy - SillyTavern Extension
 * 棉花糖代理 - 酒馆扩展
 * 
 * 功能：显示状态 + 打开 Applet 按钮
 */

import { extension_settings, getContext } from '../../../extensions.js';

const EXTENSION_NAME = 'CottonCandy';

// ============================================
// 配置 - 根据你的 Applet 地址修改
// ============================================
const CONFIG = {
  // TODO: 替换为你在 AI Studio 创建的 Applet 地址
  APPLET_URL: 'https://ai.studio/apps/drive/1qPTOqe1ub7OaNHgfotbwkHsEPwkfyyqS',
  
  PROXY_URL: 'http://127.0.0.1:8811',
  PROXY_NAME: '棉花糖代理',
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
  const dot = document.getElementById('cc_status_dot');
  const text = document.getElementById('cc_status_text');
  
  if (!dot || !text) return;

  if (state.serverOk && state.browserOk) {
    dot.style.background = '#22c55e'; // 绿色
    text.textContent = '就绪';
    text.style.color = '#22c55e';
  } else if (state.serverOk) {
    dot.style.background = '#f59e0b'; // 黄色
    text.textContent = '等待Applet';
    text.style.color = '#f59e0b';
  } else {
    dot.style.background = '#ef4444'; // 红色
    text.textContent = '离线';
    text.style.color = '#ef4444';
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
  const url = `${CONFIG.APPLET_URL}?fullscreenApplet=true`;
  
  if (isMobile) {
    state.appletWindow = window.open(url, '_blank');
  } else {
    state.appletWindow = window.open(url, 'cottoncandy-applet', 'width=500,height=700');
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

        console.log(`[${EXTENSION_NAME}] 代理已注册: ${CONFIG.PROXY_NAME}`);
      }
    }).catch(() => {});
  } catch {}
}

// ============================================
// 创建 UI
// ============================================
function createUI() {
  const html = `
    <div id="cottoncandy_container" class="extension_container">
      <div id="cc_panel" style="
        cursor: pointer;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 8px;
        transition: all 0.2s ease;
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="cc_status_dot" style="
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ef4444;
            flex-shrink: 0;
          "></span>
          <b style="font-size: 14px;">🍬 棉花糖代理</b>
          <span id="cc_status_text" style="font-size: 12px; color: #ef4444;">离线</span>
        </div>
        <div class="fa-solid fa-external-link-alt" style="opacity: 0.5; font-size: 12px;"></div>
      </div>
    </div>
  `;

  $('#extensions_settings2').append(html);

  // 点击打开 Applet
  $(document).on('click', '#cc_panel', (e) => {
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
    console.log(`[${EXTENSION_NAME}] 正在加载...`);
    
    createUI();
    registerProxy();
    
    await checkStatus();
    state.checkTimer = setInterval(checkStatus, CONFIG.CHECK_INTERVAL);
    
    console.log(`[${EXTENSION_NAME}] 加载完成`);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] 加载失败:`, error);
  }
});

// 清理
window.addEventListener('beforeunload', () => {
  if (state.checkTimer) {
    clearInterval(state.checkTimer);
  }
});
