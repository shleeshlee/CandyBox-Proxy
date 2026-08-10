/**
 * 🍬 CandyBox Proxy - SillyTavern Extension
 * 
 * 版本: 1.3.1
 * 功能: 一键打开 Applet + 多账号名册下拉栏
 * 作者: WanWan
 * 仓库: https://github.com/shleeshlee/CandyBox-Proxy
 * 
 * 免费开源，禁止倒卖
 */

import { extension_settings, getContext } from '../../../extensions.js';

const EXTENSION_NAME = 'CandyBox';
const VERSION = '1.3.1';

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

  // 下拉栏第一项：切换 Google 账号（applet 面板「退出账号」的同款去处）。
  // 选完账号会落回 AI Studio，再点名册里对应的 applet 即可
  ACCOUNT_SWITCH_URL: 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Faistudio.google.com%2Fapps',
};

// 2026-08 改版后直接渲染 app 本体所必需的打开参数
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
// 服务端接口（名册保存在本地 server，粘贴一次永久生效）
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

// 名册。服务端是 v1.2 旧版或没启动时返回 null，UI 会提示
async function getRoster() {
  try {
    const r = await fetch(`${CONFIG.PROXY_URL}/applet-urls`);
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.list) ? j : null;
  } catch {
    return null;
  }
}

// ============================================
// 打开 Applet（本体按钮：开当前选中那条）
// ============================================
async function openApplet() {
  const saved = await getSavedAppletUrl();
  openUrl(withAppletParams(saved || CONFIG.APPLET_URL));
}

// ============================================
// 名册下拉栏渲染
// ============================================
async function renderRoster() {
  const roster = await getRoster();
  const $entries = $('#cb_dd_entries').empty();

  if (!roster) {
    $entries.append(
      $('<div>').css({ 'font-size': '11px', opacity: 0.6, padding: '4px 8px' })
        .text('名册不可用：CandyBox 服务未启动或还是 v1.2 旧版')
    );
    return;
  }

  for (const entry of roster.list) {
    const isActive = entry.name === roster.active;
    const $row = $('<div>').addClass('cb-dd-item cb-dd-applet').attr('data-name', entry.name);
    $row.append($('<span>').text(`${isActive ? '✓ ' : ''}${entry.name}`));
    $row.append($('<span>').addClass('cb-dd-del').attr('data-name', entry.name).attr('title', '删除').text('✕'));
    $entries.append($row);
  }
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
    #cb_dd_toggle {
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(107, 114, 128, 0.25);
      user-select: none;
      margin: 3px 0 1px;
    }
    #cb_dd_toggle:hover { background: rgba(107, 114, 128, 0.4); }
    .cb-dd-item {
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      margin: 1px 0;
    }
    .cb-dd-item:hover { background: rgba(107, 114, 128, 0.35); }
    .cb-dd-del {
      opacity: 0.5;
      font-size: 11px;
      padding: 0 4px;
    }
    .cb-dd-del:hover { opacity: 1; }
  `;
  document.head.appendChild(styleSheet);

  const html = `
    <div id="candybox_container" class="extension_container">
      <div id="cb_panel">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="cb-star-1" style="font-size: 10px;">✦</span>
          <b style="font-size: 12px; font-weight: 500;">CandyBox</b>
          <span style="font-size: 12px; font-weight: 400; opacity: 0.8;">Proxy</span>
          <span style="font-size: 10px; opacity: 0.55;">v${VERSION}</span>
          <span class="cb-star-2" style="font-size: 10px;">✧</span>
        </div>
        <div class="fa-solid fa-chevron-right" style="opacity: 0.7; font-size: 10px;"></div>
      </div>
      <div id="cb_dd_toggle">▾ 账号名册</div>
      <div id="cb_dd_list">
        <div class="cb-dd-item" id="cb_switch_google">
          <span>🔄 切换 Google 账号</span>
        </div>
        <div id="cb_dd_entries"></div>
        <div id="cb_setup" style="margin: 4px 0 2px;">
          <input id="cb_applet_name" class="text_pole" type="text"
            placeholder="名称（比如：A号）"
            style="width: 100%; font-size: 11px; box-sizing: border-box;">
          <input id="cb_applet_url" class="text_pole" type="text"
            placeholder="该账号 Remix 出的 Applet 链接（aistudio.google.com/apps/...）"
            style="width: 100%; font-size: 11px; box-sizing: border-box; margin-top: 3px;">
          <div style="display: flex; gap: 6px; margin-top: 4px; align-items: center;">
            <div id="cb_save_url" class="menu_button" style="font-size: 11px; padding: 2px 12px; margin: 0; white-space: nowrap; width: auto;">添加 / 更新</div>
            <span id="cb_url_status" style="font-size: 11px; opacity: 0.75;"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  $('#extensions_settings2').append(html);
  renderRoster();

  // 点击本体：打开当前选中的 Applet（PC 直达）
  $(document).on('click', '#cb_panel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openApplet();
  });

  // 展开/收起名册
  $(document).on('click', '#cb_dd_toggle', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const $list = $('#cb_dd_list');
    const open = $list.is(':visible');
    $list.toggle(!open);
    $('#cb_dd_toggle').text(`${open ? '▸' : '▾'} 账号名册`);
    if (!open) renderRoster();
  });

  // 第一项：切换 Google 账号
  $(document).on('click', '#cb_switch_google', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openUrl(CONFIG.ACCOUNT_SWITCH_URL);
  });

  // 点名字：选中并打开该账号的 Applet
  $(document).on('click', '.cb-dd-applet', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = $(e.currentTarget).attr('data-name');
    try {
      const r = await postPlain('/applet-urls/active', { name });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) {
        openUrl(withAppletParams(j.url));
        renderRoster();
      } else {
        $('#cb_url_status').text(`✗ ${j.error || '切换失败'}`);
      }
    } catch {
      $('#cb_url_status').text('✗ CandyBox 服务没启动？');
    }
  });

  // 删除名册条目
  $(document).on('click', '.cb-dd-del', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = $(e.currentTarget).attr('data-name');
    try {
      await postPlain('/applet-urls/delete', { name });
      renderRoster();
    } catch { /* 服务端没起，renderRoster 会提示 */ }
  });

  // 添加 / 更新名册条目（服务端是 v1.2 旧版时退回单链接保存）
  $(document).on('click', '#cb_save_url', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = String($('#cb_applet_name').val() || '').trim();
    const url = String($('#cb_applet_url').val() || '').trim();
    if (!/^https:\/\/(aistudio\.google\.com|ai\.studio)\/apps\//.test(url)) {
      $('#cb_url_status').text('✗ 链接不对，要 aistudio.google.com/apps/... 形态');
      return;
    }
    try {
      let r;
      if (name) {
        r = await postPlain('/applet-urls', { name, url });
        if (r.status === 404) r = await postPlain('/applet-url', { url }); // 旧版服务端
      } else {
        r = await postPlain('/applet-url', { url });
      }
      if (r.ok) {
        $('#cb_url_status').text('✓ 已保存');
        $('#cb_applet_name').val('');
        $('#cb_applet_url').val('');
        renderRoster();
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
    
    console.log(`[${EXTENSION_NAME}] ✅ 加载完成`);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] ❌ 加载失败:`, error);
  }
});
