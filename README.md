# 🍬 CottonCandy Proxy

**棉花糖代理** - 通过浏览器身份免费使用 Gemini API

> 基于 [AIStudioBuildProxy](https://github.com/starowo/AIStudioBuildProxy) 重构

---

## 🚀 一键安装

在 Termux 或终端运行：

```bash
curl -sL https://raw.githubusercontent.com/shleeshlee/CottonCandy-Proxy/main/install.sh | bash
```

安装完成后会显示下一步操作。

---

## 📖 手动安装

如果一键安装失败，按以下步骤操作：

### 1. 安装 Server

```bash
cd SillyTavern/plugins
git clone https://github.com/shleeshlee/CottonCandy-Proxy.git CottonCandy
cd CottonCandy/server
npm install
```

### 2. 安装扩展（可选）

```bash
cp -r SillyTavern/plugins/CottonCandy/extension SillyTavern/public/scripts/extensions/third-party/CottonCandy
```

### 3. 重启 SillyTavern

---

## 🎮 使用方法

1. **重启 SillyTavern**
2. **在 AI Studio 创建 Applet**，上传 `applet/` 文件夹里的文件
3. **打开 Applet** → 点击「启动服务」
4. **酒馆设置代理**：API → OpenAI → Proxy → 选「棉花糖代理」

---

## 🔌 端口

| 服务 | 端口 |
|------|------|
| HTTP | 8811 |
| WebSocket | 9111 |

---

## ❓ 常见问题

**Q: 酒馆显示"没有可用的浏览器连接"**  
A: 打开 Applet 并点击「启动服务」

**Q: Applet 显示"未检测到登录"**  
A: 先在浏览器登录 Google 账号

---

## 🙏 致谢

- [AIStudioBuildProxy](https://github.com/starowo/AIStudioBuildProxy)
- [SillyTavern](https://github.com/SillyTavern/SillyTavern)

---

MIT License
