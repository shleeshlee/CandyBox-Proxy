#!/bin/bash

# ============================================
# 🍬 CandyBox Proxy - 快速安装脚本
# 作者: WanWan
# 仓库: https://github.com/shleeshlee/CandyBox-Proxy
# 免费开源，禁止倒卖
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║  ${BOLD}CandyBox Proxy${NC}${MAGENTA} - 安装助手                                 ║${NC}"
echo -e "${MAGENTA}║  ${CYAN}作者: WanWan${NC}${MAGENTA}                                              ║${NC}"
echo -e "${MAGENTA}║  ${CYAN}GitHub: https://github.com/shleeshlee/CandyBox-Proxy${NC}${MAGENTA}      ║${NC}"
echo -e "${MAGENTA}║  ${YELLOW}⚠ 如果你是付费获取的本项目，你被骗了！${NC}${MAGENTA}                  ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查 SillyTavern 目录
if [ ! -d "SillyTavern" ]; then
    echo "❌ 未找到 SillyTavern 目录"
    echo "请在 SillyTavern 所在的父目录运行此脚本"
    exit 1
fi

echo "✓ 找到 SillyTavern 目录"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 安装 Server 插件
echo ""
echo "📦 正在安装 Server 插件..."
mkdir -p SillyTavern/plugins/CandyBox
cp -r "$SCRIPT_DIR/server" SillyTavern/plugins/CandyBox/
cp "$SCRIPT_DIR/server/package.json" SillyTavern/plugins/CandyBox/
cp "$SCRIPT_DIR/server/index.js" SillyTavern/plugins/CandyBox/
sed -i "s|require('./server')|require('./server/server')|g" SillyTavern/plugins/CandyBox/index.js
cd SillyTavern/plugins/CandyBox/server && npm install --silent
cd - > /dev/null
echo "✓ Server 插件安装完成"

# 安装 Extension
echo ""
echo "📦 正在安装扩展..."
mkdir -p SillyTavern/public/scripts/extensions/third-party/CandyBox
cp "$SCRIPT_DIR/extension/"* SillyTavern/public/scripts/extensions/third-party/CandyBox/
echo "✓ 扩展安装完成"

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ 安装完成！${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}📝 接下来请:${NC}"
echo "     1. 重启 SillyTavern"
echo "     2. 打开 CandyBox Applet"
echo "     3. 点击「启动服务」"
echo ""
echo -e "  ${BOLD}🎮 使用方法:${NC}"
echo "     1. 打开 Applet → 点击「启动服务」"
echo "     2. 在 API Google AI Studio 的代理 → CandyBox"
echo ""
echo -e "${MAGENTA}────────────────────────────────────────────────────────────────────${NC}"
echo -e "  ${BOLD}CandyBox Proxy${NC} - 开源免费"
echo -e "  作者: ${CYAN}WanWan${NC}"
echo -e "  GitHub: ${CYAN}https://github.com/shleeshlee/CandyBox-Proxy${NC}"
echo -e "  ${YELLOW}★ 如果觉得好用，请给项目点个 Star！${NC}"
echo -e "${MAGENTA}────────────────────────────────────────────────────────────────────${NC}"
echo ""
