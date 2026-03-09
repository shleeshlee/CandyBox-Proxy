## 🍬 CandyBox Proxy

**CandyBox Proxy**：通过“浏览器已登录的 Google 账号”访问 Gemini API，让 SillyTavern 走本地反代，无需填写 API Key。

- **HTTP 代理**：`http://127.0.0.1:8811`（SillyTavern 连接）
- **WebSocket**：`ws://127.0.0.1:9111`（AI Studio Applet 连接）
- **多号轮询**：支持同时连接多个 Applet 窗口，后端对请求做轮询分发，降低单号 429 风险
- **账号标识去重**：可在前端填“账号标识（邮箱/昵称）”，同标识重复连接会自动踢掉旧连接，避免重复占号位

> ⚠️ 声明：本项目免费开源，禁止倒卖。

---

## 工作原理（30 秒读懂）

1. SillyTavern 把 Gemini API 请求发到本地 `CandyBox`（HTTP `8811`）
2. 本地后端把请求通过 WebSocket 转发给 AI Studio 里的 Applet
3. Applet 在浏览器环境用 `fetch(..., credentials: 'include')` 调 Google API（使用当前浏览器已登录的账号 Cookie）
4. Applet 把响应流回传给本地后端 → 再返回给 SillyTavern

---

## 安装

### 一键安装（推荐）

在终端执行：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

安装脚本会：
- 安装 **SillyTavern Server Plugin** 到 `SillyTavern/plugins/CandyBox/`
- 安装 **SillyTavern 前端扩展** 到 `SillyTavern/public/scripts/extensions/third-party/CandyBox/`
- 在插件目录里执行 `npm install`

> 如果你使用的是 fork 仓库，请把上面的 URL 换成你自己的仓库地址；或使用“手动安装”。

### Windows 说明

`install.sh` 需要 bash 环境，建议以下任一方式：
- **Git Bash**
- **WSL**

如果不方便使用 bash，请走“手动安装”。

### 手动安装（任何系统通用）

1. 复制 `server/` 到：
   - `SillyTavern/plugins/CandyBox/server/`
2. 复制 `server/index.js` 和 `server/package.json` 到：
   - `SillyTavern/plugins/CandyBox/`（插件入口要求）
3. 安装依赖：

```bash
cd "SillyTavern/plugins/CandyBox/server" && npm install
```

4. 复制 `extension/` 到：
   - `SillyTavern/public/scripts/extensions/third-party/CandyBox/`

---

## 使用说明（SillyTavern）

### 1) 重启 SillyTavern

重启后插件会自动启动代理服务（默认占用 `8811/9111`）。

### 2) 打开 AI Studio Applet 并连接

在 SillyTavern 扩展面板点击 CandyBox 按钮，会自动打开 Applet。

- 确保你已在该窗口 **登录 Google 账号**
- 在 Applet 页面点击 **「连接服务」**

### 3) 在 SillyTavern 选择代理

在 SillyTavern 的 API 配置里（不同版本 UI 可能略有差异）：
- 聊天补全来源选 **Google AI Studio**
- 反向代理/Proxy 选择 **CandyBox**
- 选择模型（如 `gemini-2.0-flash` / `gemini-2.5-*` 等）

### 4) 状态检查

打开：
- `http://127.0.0.1:8811/status`

你会看到类似字段：
- `browser_connected`
- `slot_count`（当前已连接的 Applet 窗口数）

---

## 多账号轮询（重点：Chrome 多用户）

> 目标：**5 个账号 = 5 个独立浏览器环境**，每个环境打开 1 个 Applet 并连接服务。后端会对请求做轮询分发，避免单号频繁触发 429。

### 推荐方案：Chrome 多用户（多配置文件）

对每个 Google 账号做一次：

1. Chrome 右上角头像 → **添加**（Add）/ **添加个人资料**
2. 用新个人资料打开一个新窗口
3. 在该窗口登录 **一个** Google 账号（建议只登录一个，减少“默认账号”抢占问题）
4. 在该窗口打开 Applet，并点击 **「连接服务」**

你最终会得到多个 Chrome 窗口（每个窗口是不同 profile），每个窗口里一个不同账号。

### 不推荐：无痕窗口切号

Chrome 的无痕窗口不适合做“同一环境多账号切换”，并且 Google 登录/跳转行为可能导致你总是回到默认账号。要稳定多账号轮询，请使用 **Chrome 多用户** 或不同浏览器/不同系统用户。

### 账号标识去重（避免重复占号位）

Applet 右上角 **高级配置** 里有：
- **账号标识（选填，用于去重）**：建议填邮箱或昵称（例如 `user1@gmail.com` / `主号`）

行为：
- 同一标识如果重复连接，后端会 **踢掉旧连接，只保留最新连接**
- 前端会展示：`[账号标识] [1/5 号位]`

> 说明：出于浏览器跨域/权限限制，Applet 不稳定获取你的真实邮箱，因此采用“手动填标识”方案，最可靠也最可控。

---

## 更换/自建 Applet（可选）

你可以在 AI Studio 里复制一份 Applet 并发布成自己的链接，然后修改扩展里的 `APPLET_URL`。

### 修改位置

文件：`extension/index.js`

```js
APPLET_URL: 'https://ai.studio/apps/xxxxxx'
```

修改后需要：
- 重新安装扩展文件到 SillyTavern（或覆盖同路径文件）
- 刷新 SillyTavern 页面

---

## 端口与环境变量

后端在 `server/server.js` 里支持环境变量覆盖：

- **HTTP_PORT**：默认 `8811`
- **WS_PORT**：默认 `9111`
- **HOST**：默认 `0.0.0.0`

---

## 常见问题（Troubleshooting）

### 1) 503：没有可用的浏览器连接

- 打开 Applet
- 登录账号
- 点击 **「连接服务」**

### 2) `EADDRINUSE`：端口被占用（8811/9111）

说明已有旧进程占用端口。处理方式：
- 重启 SillyTavern（最简单）
- 或停止占用端口的旧进程后再启动

### 3) 429：请求过多 / 额度超限

- 开更多账号（Chrome 多用户），让后端轮询分摊
- 避免在同一账号/同一窗口短时间内高并发

### 4) 更新/卸载

- 更新：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

- 卸载：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/uninstall.sh | bash
```

---

## 项目结构

```text
CandyBox-Proxy/
├── server/                # 本地代理（HTTP+WS），SillyTavern Server Plugin
│   ├── index.js           # 插件入口
│   ├── server.js          # 代理服务器实现（含多号轮询/去重）
│   └── package.json
├── extension/             # SillyTavern 前端扩展（打开 Applet、注册代理预设）
│   ├── index.js
│   ├── style.css
│   └── manifest.json
├── remix_-candy1.1/       # Applet 前端源代码（Vite + React，需手动同步到 AI Studio）
├── install.sh             # 一键安装脚本
├── uninstall.sh           # 卸载脚本
├── status.sh              # 状态检查脚本
├── setup.sh               # 本地安装脚本（在 SillyTavern 父目录执行）
└── README.md
```

---

## License

MIT

