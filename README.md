# 🍬 CottonCandy Proxy

**棉花糖代理** - 通过浏览器身份免费使用 Gemini API 的 SillyTavern 代理方案。

> 基于 [AIStudioBuildProxy](https://github.com/starowo/AIStudioBuildProxy) 重构，感谢原作者 [@starowo](https://github.com/starowo) 的开源贡献！

---

## ✨ 特性

- 🍭 棉花糖配色 UI，清新可爱
- 🔌 端口 8811/9111，与原版隔离可共存
- 📦 结构清晰，易于维护
- 🚀 一键启动，开箱即用

---

## 📁 项目结构

```
CottonCandy/
├── applet/          # AI Studio Applet（核心引擎）
│   ├── index.tsx    # 主逻辑
│   ├── index.html   # 入口页面
│   ├── index.css    # 样式
│   └── metadata.json
│
├── server/          # Node.js 中转服务器
│   ├── server.js    # 服务器核心
│   ├── index.js     # SillyTavern 插件入口
│   └── package.json
│
├── extension/       # SillyTavern 扩展（可选）
│   ├── index.js     # 扩展逻辑
│   ├── manifest.json
│   └── style.css
│
└── README.md
```

---

## 🚀 安装步骤

### 第一步：部署 Applet（在 AI Studio 中）

1. 打开 [Google AI Studio](https://aistudio.google.com/)
2. 确保已登录 Google 账号
3. 点击左侧菜单 → **Build** → **Applet**
4. 创建新 Applet，将 `applet/` 文件夹中的文件上传
5. 保存并获取 Applet 的 URL（类似 `https://aistudio.google.com/prompts/xxx`）

### 第二步：安装 Server（作为 SillyTavern 插件）

```bash
# 进入 SillyTavern 插件目录
cd SillyTavern/plugins

# 创建插件文件夹
mkdir CottonCandy

# 复制 server/ 文件夹内容到这里
cp -r /path/to/CottonCandy/server/* CottonCandy/

# 安装依赖
cd CottonCandy && npm install
```

### 第三步：安装扩展（可选，用于在酒馆显示状态）

```bash
# 进入 SillyTavern 扩展目录
cd SillyTavern/public/scripts/extensions/third-party

# 创建扩展文件夹
mkdir CottonCandy

# 复制 extension/ 文件夹内容
cp -r /path/to/CottonCandy/extension/* CottonCandy/
```

**重要：** 记得修改 `extension/index.js` 中的 `APPLET_URL` 为你的 Applet 地址！

---

## 🎮 使用方法

1. **启动 SillyTavern**（Server 插件会自动启动）
2. **打开 AI Studio Applet**（通过扩展按钮或直接访问）
3. **在 Applet 中点击「启动服务」**
4. **在酒馆中选择代理**：设置 → Chat API → OpenAI → Proxy → 选择「棉花糖代理」

---

## 🔌 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| HTTP | 8811 | 酒馆连接地址 |
| WebSocket | 9111 | Applet 连接地址 |

---

## 📋 工作原理

```
SillyTavern ──HTTP:8811──▶ Server (Node.js)
                              │
                              │ WebSocket:9111
                              ▼
                         Applet (AI Studio)
                              │
                              │ fetch with cookies
                              ▼
                         Gemini API
```

---

## ❓ 常见问题

**Q: Applet 显示"未检测到登录"**  
A: 请确保在同一浏览器中已登录 Google 账号。

**Q: 酒馆显示"没有可用的浏览器连接"**  
A: 请打开 Applet 页面并点击「启动服务」按钮。

**Q: 和原版 AIStudioBuildProxy 有什么区别？**  
A: 端口不同（8811/9111 vs 8889/9998），UI 重构，可以同时安装互不干扰。

---

## 🙏 致谢

- [AIStudioBuildProxy](https://github.com/starowo/AIStudioBuildProxy) - 原版项目，本项目基于其核心思路重构
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - 优秀的前端界面

---

## 📜 许可证

MIT License
