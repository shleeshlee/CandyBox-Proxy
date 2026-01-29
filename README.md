# 🍬 CandyBox Proxy

**CandyBox Proxy** - 通过浏览器身份免费使用 Gemini API

> 让你的 SillyTavern 酒馆连接 Google AI Studio，无需 API Key

---

## ✨ 特性

- 🔌 **即插即用** - 一键安装，自动配置
- 📱 **全平台支持** - 手机 / 云端 / PC 都能用
- 🎯 **状态指示** - 实时显示连接状态（🟢就绪 🟡等待 🔴离线）
- 🚀 **自动注册** - 代理地址自动添加到酒馆，无需手动输入

---

## 📦 一键安装

复制下面的命令，粘贴到终端运行：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

安装完成后按提示操作即可。

---

## 📖 详细安装教程

根据你的设备选择对应教程：

---

### 📱 手机安装 (Termux)

适用于：Android 手机 / 平板

#### 第一步：安装 Termux

1. 下载 [Termux](https://f-droid.org/packages/com.termux/)（推荐从 F-Droid 下载）
2. 打开 Termux，等待初始化完成

#### 第二步：安装必要工具

```bash
pkg update && pkg upgrade -y
pkg install git nodejs -y
```

#### 第三步：安装 SillyTavern（如果还没装）

```bash
git clone https://github.com/SillyTavern/SillyTavern.git
cd SillyTavern
npm install
```

##### 设置快捷指令（可选）

```bash
nano ~/.bashrc
```

在文件末尾添加：
```bash
alias qidong='cd ~/SillyTavern && node server.js'
alias gengxin='cd ~/SillyTavern && git pull && npm install'
alias chongqi='pkill -f "node server.js"; cd ~/SillyTavern && node server.js'
```

保存退出（`Ctrl+X` → `Y` → `Enter`），然后执行：
```bash
source ~/.bashrc
```

以后输入 `qidong` 启动酒馆，`gengxin` 更新酒馆，`chongqi` 重启酒馆。

#### 第四步：安装 CandyBox

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

#### 第五步：启动酒馆

```bash
cd ~/SillyTavern
node server.js
```

然后在浏览器打开 `http://127.0.0.1:8000`

---

### ☁️ 云端安装 (HuggingFace / Colab / VPS)

适用于：HuggingFace Space / Google Colab / 云服务器

#### HuggingFace Space

1. 复制一个 SillyTavern Space 到你的账号
2. 打开 Space 的终端（Files → Terminal）
3. 运行安装命令：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

4. 重启 Space

#### Google Colab

在代码单元格中运行：

```python
!curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

#### VPS / 云服务器

```bash
# SSH 连接到服务器后
cd ~
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

---

### 💻 PC 安装 (Windows / Mac / Linux)

#### Windows

1. 安装 [Git](https://git-scm.com/download/win)
2. 安装 [Node.js](https://nodejs.org/)（选择 LTS 版本）
3. 打开 **Git Bash** 或 **PowerShell**
4. 运行：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

> 💡 Windows 用户如果 curl 不可用，可以手动下载 ZIP：
> 1. 下载 [CandyBox-Proxy ZIP](https://github.com/shleeshlee/CandyBox-Proxy/archive/main.zip)
> 2. 解压到 SillyTavern 的**父目录**（即和 SillyTavern 文件夹同级）
> 3. 进入解压后的文件夹，运行：
>    ```bash
>    bash setup.sh
>    ```
> 4. 如果 bash 不可用，手动操作：
>    - 复制 `server` 文件夹内容到 `SillyTavern/plugins/CandyBox/`
>    - 复制 `extension` 文件夹内容到 `SillyTavern/public/scripts/extensions/third-party/CandyBox/`
>    - 在 `SillyTavern/plugins/CandyBox/` 运行 `npm install`

#### Mac

```bash
# 打开终端
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

#### Linux

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

---

## 🎮 使用方法

安装完成后，按以下步骤操作：

### 1️⃣ 重启 SillyTavern

关闭酒馆，重新运行 `node server.js`

### 2️⃣ 打开 CandyBox Applet

在酒馆扩展面板点击「✦ ✧ 糖果盒代理」按钮，会自动打开 Applet

> ⚠️ 需要先登录 Google 账号

### 3️⃣ 启动服务

在 Applet 页面点击「**启动服务**」按钮，看到「已连接」提示

### 4️⃣ 配置酒馆

1. 打开酒馆设置
2. 进入 **API** → **Chat Completion** → **OpenAI**
3. 在 **Proxy** 下拉框选择「**CandyBox**」
4. 选择模型（如 `gemini-2.0-flash`）
5. 开始聊天！

---

## 🔧 高级选项：创建自己的 Applet

如果你想使用自己的 Applet（而不是公共链接），可以按以下步骤操作：

### 方法：复制现有 Applet

1. 打开 [CandyBox Applet](你的Applet链接)

2. 点击右上角的 **Copy app** 按钮
   
   ![Copy app](docs/copy-app.png)

3. 在你的 AI Studio 中会生成一个副本

4. 点击 **Share** 按钮

5. **打开 Publish your app 开关**（重要！）

6. 复制生成的链接
   
   ![Share](docs/share.png)

7. 使用你自己的链接即可

> ⚠️ **注意**：必须开启 **Publish your app** 才能正常使用！

---

## 🔌 端口信息

| 服务 | 端口 | 说明 |
|------|------|------|
| HTTP 代理 | 8811 | 酒馆连接这个端口 |
| WebSocket | 9111 | Applet 连接这个端口 |

---

## 🚦 状态说明

酒馆扩展面板会显示连接状态：

| 状态 | 颜色 | 说明 |
|------|------|------|
| 🟢 就绪 | 绿色 | 一切正常，可以使用 |
| 🟡 等待Applet | 黄色 | 服务器已启动，请打开 Applet |
| 🔴 离线 | 红色 | 服务器未启动，请重启酒馆 |

---

## ❓ 常见问题

### Q: 酒馆显示「没有可用的浏览器连接」

**A:** 打开 CandyBox Applet 并点击「启动服务」

---

### Q: Applet 显示「未检测到登录」

**A:** 先在浏览器登录 Google 账号，然后刷新 Applet

---

### Q: 安装脚本找不到 SillyTavern

**A:** 手动指定路径：

```bash
ST_DIR=/你的/SillyTavern/路径 bash install.sh
```

---

### Q: Windows 下 curl 命令不可用

**A:** 使用 Git Bash 运行，或者手动下载 ZIP 安装（见上方 Windows 安装说明）

---

### Q: 手机上 Termux 安装失败

**A:** 确保已安装 git 和 nodejs：

```bash
pkg install git nodejs -y
```

---

### Q: 如何更新到最新版本？

**A:** 重新运行安装命令，会自动覆盖旧版本：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash
```

---

### Q: 如何卸载？

**A:** 删除以下文件夹：

```bash
rm -rf ~/SillyTavern/plugins/CandyBox
rm -rf ~/SillyTavern/public/scripts/extensions/third-party/CandyBox
```

---

## 📁 项目结构

```
CandyBox-Proxy/
├── server/           # 服务端插件
│   ├── index.js      # 插件入口
│   ├── server.js     # 代理服务器
│   └── package.json
├── extension/        # 客户端扩展
│   ├── index.js      # 扩展入口
│   ├── style.css     # 样式
│   └── manifest.json
├── docs/             # 文档图片
├── install.sh        # 一键安装脚本
└── README.md
```

---

## 🙏 致谢

- [AIStudioBuildProxy](https://github.com/starowo/AIStudioBuildProxy) - 原始项目
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - 酒馆本体

---

## 📄 License

MIT License

---

## 🍬 作者

**shleeshlee**

- GitHub: [@shleeshlee](https://github.com/shleeshlee)

---

> 🍬 CandyBox Proxy - Sweet connection to your AI world
