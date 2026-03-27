# 🍬 CandyBox Proxy

**通过浏览器身份免费使用 Gemini API**

> 让你的 SillyTavern 酒馆连接 Google AI Studio，无需 API Key

> **作者:** WanWan
> **协议:** MIT (免费使用，保留署名)
> **声明:** 本项目完全免费开源，如果你是付费获取的，你被骗了！

---

## 安装

### 方式一：一键安装（推荐）

复制到终端运行，自动检测酒馆目录、验证/补齐依赖、安装插件与扩展、启用 Server Plugins：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

> 如果检测到正在运行的 SillyTavern，会提示重启并在重启后做 CandyBox 健康检查  
> 如果没在运行，会提示启动 SillyTavern；非交互环境不会强行帮你重启现有进程

### 一键安装会做什么

1. 检测 `SillyTavern` 目录，找不到就停止
2. 验证 `git / node / npm` 和 `8811 / 9111` 端口状态
3. 缺少依赖时尽量自动安装
4. 安装 CandyBox 插件和前端扩展
5. 自动设置 `config.yaml` 里的 `enableServerPlugins: true`
6. 在重启/启动 SillyTavern 后检查 `http://127.0.0.1:8811/status`

---

### 方式二：手动安装

适用于无法运行脚本的环境：

1. 下载 [ZIP](https://github.com/shleeshlee/CandyBox-Proxy/archive/main.zip) 并解压
2. 复制 `server/` 文件夹到 `SillyTavern/plugins/CandyBox/server/`
3. 复制 `server/package.json` 和 `server/index.js` 到 `SillyTavern/plugins/CandyBox/`
4. 编辑 `SillyTavern/plugins/CandyBox/index.js`，把 `require('./server')` 改成 `require('./server/server')`
5. 复制 `extension/` 内容到 `SillyTavern/public/scripts/extensions/third-party/CandyBox/`
6. 在 `SillyTavern/plugins/CandyBox/server/` 运行 `npm install`
7. 编辑 `SillyTavern/config.yaml`，设置 `enableServerPlugins: true`
8. 重启酒馆

---

## 各平台安装指引

<details>
<summary><b>📱 手机 (Termux)</b></summary>

#### 1. 安装 Termux

下载 [Termux](https://f-droid.org/packages/com.termux/)（推荐 F-Droid）

#### 2. 安装必要工具

```bash
pkg update && pkg upgrade -y
pkg install git nodejs -y
```

#### 3. 安装 SillyTavern（如果还没装）

```bash
git clone https://github.com/SillyTavern/SillyTavern.git
cd SillyTavern
npm install
```

<details>
<summary>设置快捷指令（可选）</summary>

```bash
nano ~/.bashrc
```

在末尾添加：

```bash
alias qidong='cd ~/SillyTavern && node server.js'
alias gengxin='cd ~/SillyTavern && git checkout package-lock.json && git pull && npm install'
alias chongqi='pkill -9 node; sleep 1; cd ~/SillyTavern && node server.js'
```

保存（`Ctrl+X` → `Y` → `Enter`），然后 `source ~/.bashrc`

</details>

#### 4. 安装 CandyBox

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

#### 5. 启动酒馆

```bash
cd ~/SillyTavern && node server.js
```

浏览器打开 `http://127.0.0.1:8000`

</details>

<details>
<summary><b>☁️ 云端 (HuggingFace / Colab / VPS)</b></summary>

#### HuggingFace Space

1. 复制一个 SillyTavern Space
2. 打开终端（Files → Terminal）
3. 运行：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

4. 重启 Space

#### Google Colab

```python
!curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

#### VPS

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

> 云端环境至少要满足：
> - 已安装 `git`、`node`、`npm`（脚本会尽量自动补）
> - `127.0.0.1:8811` 和 `127.0.0.1:9111` 没被别的服务占用
> - 能正常启动 SillyTavern

</details>

<details>
<summary><b>💻 PC (Windows / Mac / Linux)</b></summary>

#### Windows

1. 安装 [Git](https://git-scm.com/download/win) 和 [Node.js](https://nodejs.org/)（LTS）
2. 右键桌面 → **Git Bash Here**
3. 运行：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

> 如果 curl 不可用，用[方式三：手动安装](#方式三手动安装)

#### Mac / Linux

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

</details>

---

## 使用方法

### 1. 启动或重启 SillyTavern

```bash
pkill -9 node
cd ~/SillyTavern && node server.js
```

> 安装脚本会尽量自动重启/启动并做健康检查；如果你是在非交互环境里安装，通常仍需要手动执行这一步

### 2. 打开 Applet

在酒馆扩展面板点击 **CandyBox Proxy** 按钮，自动打开 Applet

> 需要先登录 Google 账号

### 3. 启动服务

首次点击 Allow 允许权限，然后点击「**连接服务**」

### 4. 配置酒馆

1. **API连接配置** → **聊天补全** → 聊天补全来源 **Google AI Studio**
2. **反向代理** 下拉框选择「**CandyBox**」
3. 选择模型（如 `gemini-2.0-flash`）
4. 开始聊天

---

## 高级选项：创建自己的 Applet

默认使用公共 Applet 链接。如果你想用自己的：

1. 打开 [CandyBox Applet](https://ai.studio/apps/drive/1Q4aqGJNnOzPWh0r1ZpZASoNdojqUkWTk?fullscreenApplet=true)
2. 点击右上角退出全屏 → 右下角 `...` → **Copy app**
3. 打开副本 → **Share app** → 开启 **Publish your app**
4. 复制链接，替换扩展配置中的 APPLET_URL：

```bash
nano ~/SillyTavern/plugins/CandyBox/extension/index.js
# 或者编辑 data/default-user/extensions/CandyBox-Proxy/extension/index.js（直装路径）
```

---

## 端口信息

| 服务 | 端口 | 说明 |
|------|------|------|
| HTTP 代理 | 8811 | 酒馆连接此端口 |
| WebSocket | 9111 | Applet 连接此端口 |

---

## 常见问题

**Q: 怎么更新？**

重新运行安装命令即可覆盖：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

**Q: 怎么卸载？**

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/uninstall.sh | bash
```

**Q: 怎么检查状态？**

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/status.sh | bash
```

或访问 http://127.0.0.1:8811/status

**Q: 一键安装显示完成，但 Applet 还是报 `1006`？**

先检查这 4 件事：

1. `curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/status.sh | bash`
2. `git / node / npm` 是否都存在
3. `8811` / `9111` 是否被其他程序占用
4. `SillyTavern/config.yaml` 里是否是 `enableServerPlugins: true`

常见根因：
- SillyTavern 没有真正重启，CandyBox server plugin 还没加载
- `9111` 被别的程序或 Docker 容器占用
- `node` / `npm` 没装好，CandyBox 依赖没装成功
- `8811` 虽然监听了，但不是 CandyBox 自己的响应

**Q: 报错 400 Bad Request？**

预设界面 → **推理强度** 选择 **自动**

**Q: 连接错误 / 端口占用？**

先跑状态检查脚本，看 `8811/9111` 是不是被别的程序占用；如果是旧 CandyBox 占用，重启 SillyTavern 即可。如果是其他服务占用，先释放端口再装。

<details>
<summary><b>MT 管理器查看/编辑酒馆文件</b></summary>

1. 打开 MT 管理器 → 左上角三条横线
2. 右上角三个竖点 → 「添加本地存储」
3. 点击「使用此文件夹」→ 允许
4. 找到 SillyTavern 目录 → 右上角三个竖点 → 设为主页

</details>

---

## 项目结构

```
CandyBox-Proxy/
├── server/           # 服务端插件
│   ├── index.js      # 插件入口
│   ├── server.js     # 代理服务器
│   └── package.json
├── extension/        # 客户端扩展
│   ├── index.js      # 扩展入口
│   ├── style.css
│   └── manifest.json
├── manifest.json     # 根 manifest（扩展直装用）
├── install.sh        # 一键安装脚本
├── uninstall.sh      # 卸载脚本
├── setup.sh          # 本地安装脚本
└── status.sh         # 状态检查
```

---

## 致谢

- [AIStudioBuildProxy](https://github.com/starowo/AIStudioBuildProxy) - 原始项目
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - 酒馆本体

---

**License:** MIT

**作者:** WanWan ([@shleeshlee](https://github.com/shleeshlee))

> 🍬 CandyBox Proxy - Sweet connection to your AI world
> 本项目免费开源，如果你是付费获取的，你被骗了！
