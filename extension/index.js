/**
 * 🍬 CandyBox Proxy - SillyTavern Extension
 * 
 * 版本: 1.0.0
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
  // Applet 地址 - 替换为你自己的
  APPLET_URL: 'https://ai.studio/apps/drive/1Q4aqGJNnOzPWh0r1ZpZASoNdojqUkWTk',
  
  // 代理设置
  PROXY_URL: 'http://127.0.0.1:8811',
  PROXY_NAME: 'CandyBox',
};

// ============================================
// 状态
// ============================================
let state = {
  appletWindow: null,
};

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
    </div>
  `;

  $('#extensions_settings2').append(html);

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
    
    console.log(`[${EXTENSION_NAME}] ✅ 加载完成`);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] ❌ 加载失败:`, error);
  }
});
