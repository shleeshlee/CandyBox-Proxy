#!/bin/bash

# ============================================
# 🍬 CottonCandy Proxy 一键安装脚本
# ============================================

echo ""
echo "🍬 ════════════════════════════════════════"
echo "🍬  CottonCandy Proxy 一键安装"
echo "🍬 ════════════════════════════════════════"
echo ""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 查找 SillyTavern 目录
echo "📍 正在查找 SillyTavern..."

ST_DIR=""

# 常见位置
POSSIBLE_PATHS=(
    "$HOME/SillyTavern"
    "$HOME/sillytavern"
    "$HOME/st"
    "$HOME/ST"
    "/data/data/com.termux/files/home/SillyTavern"
    "/data/data/com.termux/files/home/sillytavern"
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/server.js" ]; then
        ST_DIR="$path"
        break
    fi
done

# 如果没找到，用 find 搜索
if [ -z "$ST_DIR" ]; then
    FOUND=$(find ~ -maxdepth 4 -name "server.js" -path "*/SillyTavern/*" 2>/dev/null | head -1)
    if [ -n "$FOUND" ]; then
        ST_DIR=$(dirname "$FOUND")
    fi
fi

# 还是没找到
if [ -z "$ST_DIR" ]; then
    echo -e "${RED}❌ 找不到 SillyTavern 目录！${NC}"
    echo ""
    echo "请手动指定路径，运行："
    echo "  ST_DIR=/你的/SillyTavern/路径 bash install.sh"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ 找到 SillyTavern: $ST_DIR${NC}"

# 2. 创建 plugins 目录（如果不存在）
PLUGINS_DIR="$ST_DIR/plugins"
if [ ! -d "$PLUGINS_DIR" ]; then
    echo "📁 创建 plugins 目录..."
    mkdir -p "$PLUGINS_DIR"
fi

# 3. 检查是否已安装
INSTALL_DIR="$PLUGINS_DIR/CottonCandy"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠️  检测到已安装，正在更新...${NC}"
    rm -rf "$INSTALL_DIR"
fi

# 4. 克隆仓库
echo "📥 正在下载 CottonCandy Proxy..."
cd "$PLUGINS_DIR"

if ! git clone --depth 1 https://github.com/shleeshlee/CottonCandy-Proxy.git CottonCandy 2>/dev/null; then
    echo -e "${RED}❌ 下载失败！请检查网络连接。${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 下载完成${NC}"

# 5. 安装依赖
echo "📦 正在安装依赖..."
cd "$INSTALL_DIR/server"

if ! npm install --silent 2>/dev/null; then
    echo -e "${YELLOW}⚠️  npm install 有警告，但可能不影响使用${NC}"
fi

echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 6. 安装扩展（可选）
EXT_DIR="$ST_DIR/public/scripts/extensions/third-party/CottonCandy"
echo "📁 正在安装扩展..."

if [ -d "$EXT_DIR" ]; then
    rm -rf "$EXT_DIR"
fi

mkdir -p "$EXT_DIR"
cp -r "$INSTALL_DIR/extension/"* "$EXT_DIR/"

echo -e "${GREEN}✓ 扩展安装完成${NC}"

# 7. 完成
echo ""
echo "🍬 ════════════════════════════════════════"
echo -e "🍬  ${GREEN}安装成功！${NC}"
echo "🍬 ════════════════════════════════════════"
echo ""
echo "📍 Server 安装位置: $INSTALL_DIR/server"
echo "📍 扩展安装位置: $EXT_DIR"
echo ""
echo "🎮 下一步："
echo "   1. 重启 SillyTavern"
echo "   2. 在 AI Studio 创建 Applet（上传 applet/ 文件夹）"
echo "   3. 打开 Applet → 点击「启动服务」"
echo "   4. 在酒馆选择代理 → 棉花糖代理"
echo ""
echo "📂 Applet 文件位置: $INSTALL_DIR/applet/"
echo ""
