#!/bin/bash

# ============================================
# 🍬 CandyBox Proxy 一键安装脚本
# 作者: shleeshlee
# 仓库: https://github.com/shleeshlee/CandyBox-Proxy
# ============================================

echo ""
echo "🍬 ════════════════════════════════════════"
echo "🍬  CandyBox Proxy 一键安装"
echo "🍬  CandyBox Proxy - Connect SillyTavern to Gemini"
echo "🍬 ════════════════════════════════════════"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# 1. 查找 SillyTavern 目录
# ============================================
log_info "正在查找 SillyTavern..."

ST_DIR=""

# 常见位置（包括 Termux）
POSSIBLE_PATHS=(
    "$HOME/SillyTavern"
    "$HOME/sillytavern"
    "$HOME/st"
    "$HOME/ST"
    "/data/data/com.termux/files/home/SillyTavern"
    "/data/data/com.termux/files/home/sillytavern"
    "$(pwd)"
    "$(pwd)/.."
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/server.js" ] && [ -d "$path/public" ]; then
        ST_DIR="$path"
        break
    fi
done

# 如果没找到，用 find 搜索
if [ -z "$ST_DIR" ]; then
    log_info "常见位置未找到，正在搜索..."
    FOUND=$(find ~ -maxdepth 4 -name "server.js" -path "*SillyTavern*" 2>/dev/null | head -1)
    if [ -n "$FOUND" ]; then
        ST_DIR=$(dirname "$FOUND")
    fi
fi

# 还是没找到
if [ -z "$ST_DIR" ]; then
    log_error "找不到 SillyTavern 目录！"
    echo ""
    echo "请手动指定路径运行："
    echo "  ST_DIR=/你的/SillyTavern/路径 bash install.sh"
    echo ""
    exit 1
fi

log_success "找到 SillyTavern: $ST_DIR"

# ============================================
# 2. 创建目录
# ============================================
PLUGINS_DIR="$ST_DIR/plugins"
EXT_DIR="$ST_DIR/public/scripts/extensions/third-party"

mkdir -p "$PLUGINS_DIR"
mkdir -p "$EXT_DIR"

# ============================================
# 3. 检查是否已安装
# ============================================
PLUGIN_INSTALL_DIR="$PLUGINS_DIR/CandyBox"
EXT_INSTALL_DIR="$EXT_DIR/CandyBox"

if [ -d "$PLUGIN_INSTALL_DIR" ] || [ -d "$EXT_INSTALL_DIR" ]; then
    log_warn "检测到已安装，正在更新..."
    rm -rf "$PLUGIN_INSTALL_DIR"
    rm -rf "$EXT_INSTALL_DIR"
fi

# ============================================
# 4. 克隆仓库
# ============================================
log_info "正在下载 CandyBox Proxy..."

cd "$PLUGINS_DIR"

if ! git clone --depth 1 https://github.com/shleeshlee/CandyBox-Proxy.git CandyBox 2>/dev/null; then
    log_error "下载失败！请检查网络连接。"
    echo ""
    echo "如果无法访问 GitHub，可以尝试："
    echo "1. 使用代理"
    echo "2. 手动下载 ZIP 并解压到 $PLUGINS_DIR/CandyBox"
    echo ""
    exit 1
fi

log_success "下载完成"

# ============================================
# 5. 安装依赖
# ============================================
log_info "正在安装依赖..."

cd "$PLUGIN_INSTALL_DIR/server"

if command -v npm &> /dev/null; then
    npm install --silent 2>/dev/null || log_warn "npm install 有警告，但可能不影响使用"
    log_success "依赖安装完成"
else
    log_warn "未检测到 npm，跳过依赖安装"
    log_warn "请手动运行: cd $PLUGIN_INSTALL_DIR/server && npm install"
fi

# ============================================
# 6. 安装扩展
# ============================================
log_info "正在安装扩展..."

mkdir -p "$EXT_INSTALL_DIR"
cp -r "$PLUGIN_INSTALL_DIR/extension/"* "$EXT_INSTALL_DIR/"

log_success "扩展安装完成"

# ============================================
# 7. 启用 Server Plugins
# ============================================
CONFIG_FILE="$ST_DIR/config.yaml"

if [ -f "$CONFIG_FILE" ]; then
    if grep -q "enableServerPlugins: false" "$CONFIG_FILE"; then
        log_info "正在启用 Server Plugins..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' 's/enableServerPlugins: false/enableServerPlugins: true/g' "$CONFIG_FILE"
        else
            sed -i 's/enableServerPlugins: false/enableServerPlugins: true/g' "$CONFIG_FILE"
        fi
        log_success "Server Plugins 已启用"
    else
        log_success "Server Plugins 已经是启用状态"
    fi
fi

# ============================================
# 8. 完成
# ============================================
echo ""
echo "🍬 ════════════════════════════════════════"
echo -e "🍬  ${GREEN}安装成功！${NC}"
echo "🍬 ════════════════════════════════════════"
echo ""
echo "📍 插件位置: $PLUGIN_INSTALL_DIR"
echo "📍 扩展位置: $EXT_INSTALL_DIR"
echo ""
echo "🎮 下一步操作："
echo ""
echo "   1️⃣  重启 SillyTavern"
echo ""
echo "   2️⃣  在 AI Studio 创建 Applet"
echo "       上传 applet/ 文件夹里的文件"
echo ""
echo "   3️⃣  打开 Applet → 点击「启动服务」"
echo ""
echo "   4️⃣  在酒馆设置代理"
echo "       API → OpenAI → Proxy → Select「CandyBox」"
echo ""
echo "🍬 ════════════════════════════════════════"
echo ""
