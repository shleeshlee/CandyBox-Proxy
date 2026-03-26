#!/bin/bash

# ============================================
# 🍬 CandyBox Proxy 一键安装脚本
# 作者: WanWan
# 仓库: https://github.com/shleeshlee/CandyBox-Proxy
# ============================================

VERSION="1.0.2"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# 回滚标记
PLUGIN_INSTALLED=false
EXT_INSTALLED=false
ROLLBACK_PLUGIN_DIR=""
ROLLBACK_EXT_DIR=""

# 清理函数（安装失败时调用）
cleanup_on_failure() {
    echo ""
    echo -e "${RED}[ERROR]${NC} 安装失败，正在回滚..."
    
    if $PLUGIN_INSTALLED && [ -n "$ROLLBACK_PLUGIN_DIR" ]; then
        rm -rf "$ROLLBACK_PLUGIN_DIR" 2>/dev/null
        echo -e "${YELLOW}[ROLLBACK]${NC} 已删除插件目录"
    fi
    
    if $EXT_INSTALLED && [ -n "$ROLLBACK_EXT_DIR" ]; then
        rm -rf "$ROLLBACK_EXT_DIR" 2>/dev/null
        echo -e "${YELLOW}[ROLLBACK]${NC} 已删除扩展目录"
    fi
    
    echo -e "${RED}安装已回滚，请检查错误信息后重试${NC}"
    exit 1
}

# 捕获错误
trap cleanup_on_failure ERR

clear

# ========== 署名横幅 ==========
echo -e "${MAGENTA}"
cat << "EOF"
   ____                _       ____            
  / ___|__ _ _ __   __| |_   _| __ )  _____  __
 | |   / _` | '_ \ / _` | | | |  _ \ / _ \ \/ /
 | |__| (_| | | | | (_| | |_| | |_) | (_) >  < 
  \____\__,_|_| |_|\__,_|\__, |____/ \___/_/\_\
                         |___/                 
EOF
echo -e "${NC}"

echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}║  ${BOLD}CandyBox Proxy${NC}${MAGENTA} v${VERSION} - 通过浏览器身份免费使用 Gemini   ║${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}║  ${CYAN}作者: WanWan${NC}${MAGENTA}                                              ║${NC}"
echo -e "${MAGENTA}║  ${CYAN}GitHub: https://github.com/shleeshlee/CandyBox-Proxy${NC}${MAGENTA}      ║${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}║  ${GREEN}✓ 免费开源 | ✓ MIT 协议 | ✓ 禁止倒卖${NC}${MAGENTA}                     ║${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}║  ${YELLOW}⚠ 如果你是付费获取的本项目，你被骗了！${NC}${MAGENTA}                  ║${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ========== 端口冲突检测 ==========
check_port_conflict() {
    local port=$1
    local name=$2
    
    if command -v lsof &> /dev/null; then
        if lsof -i:$port &> /dev/null; then
            echo -e "${YELLOW}[WARN]${NC} 端口 $port ($name) 已被占用"
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "${YELLOW}[WARN]${NC} 端口 $port ($name) 已被占用"
            return 1
        fi
    fi
    return 0
}

# 检查端口
PORT_CONFLICT=false
if ! check_port_conflict 8811 "HTTP 代理"; then
    PORT_CONFLICT=true
fi
if ! check_port_conflict 9111 "WebSocket"; then
    PORT_CONFLICT=true
fi

if $PORT_CONFLICT; then
    echo ""
    echo -e "${YELLOW}检测到端口冲突，可能是之前的 CandyBox 仍在运行${NC}"
    echo -e "${CYAN}提示: 重启 SillyTavern 后端口会自动释放${NC}"
    echo ""
fi

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# 1. 查找 SillyTavern 目录
# ============================================
log_info "正在查找 SillyTavern..."

# 用户通过 ST_DIR 环境变量手动指定
if [ -n "$ST_DIR" ]; then
    if [ -d "$ST_DIR" ] && [ -f "$ST_DIR/server.js" ]; then
        log_success "使用指定路径: $ST_DIR"
    else
        log_error "指定的路径无效: $ST_DIR"
        exit 1
    fi
fi

# 自动搜索（未手动指定时）
if [ -z "$ST_DIR" ]; then
# 常见位置（包括 Termux）
POSSIBLE_PATHS=(
    "$(pwd)/SillyTavern"
    "$(pwd)/sillytavern"
    "$(pwd)/../SillyTavern"
    "$(pwd)"
    "$(pwd)/.."
    "$HOME/SillyTavern"
    "$HOME/sillytavern"
    "$HOME/st"
    "$HOME/ST"
    "/data/data/com.termux/files/home/SillyTavern"
    "/data/data/com.termux/files/home/sillytavern"
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
    FOUND=$(find ~ "$(pwd)" -maxdepth 4 -name "server.js" -path "*SillyTavern*" 2>/dev/null | head -1)
    if [ -n "$FOUND" ]; then
        ST_DIR=$(dirname "$FOUND")
    fi
fi

fi  # 结束自动搜索

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

# 设置回滚路径
ROLLBACK_PLUGIN_DIR="$PLUGIN_INSTALL_DIR"

if ! git clone --depth 1 https://github.com/shleeshlee/CandyBox-Proxy.git CandyBox 2>/dev/null; then
    log_error "下载失败！请检查网络连接。"
    echo ""
    echo "如果无法访问 GitHub，可以尝试："
    echo "1. 使用代理"
    echo "2. 手动下载 ZIP 并解压到 $PLUGINS_DIR/CandyBox"
    echo ""
    exit 1
fi

PLUGIN_INSTALLED=true
log_success "下载完成"

# 复制入口文件到插件根目录（SillyTavern 要求）
cp "$PLUGINS_DIR/CandyBox/server/package.json" "$PLUGINS_DIR/CandyBox/"
cp "$PLUGINS_DIR/CandyBox/server/index.js" "$PLUGINS_DIR/CandyBox/"
# 修复模块引用路径
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|require('./server')|require('./server/server')|g" "$PLUGINS_DIR/CandyBox/index.js"
else
    sed -i.bak "s|require('./server')|require('./server/server')|g" "$PLUGINS_DIR/CandyBox/index.js"
    rm -f "$PLUGINS_DIR/CandyBox/index.js.bak"
fi

# ============================================
# 5. 安装依赖
# ============================================
log_info "正在安装依赖..."

if command -v npm &> /dev/null; then
    (cd "$PLUGIN_INSTALL_DIR/server" && npm install --silent 2>/dev/null) || log_warn "npm install 有警告，但可能不影响使用"
    log_success "依赖安装完成"
else
    log_warn "未检测到 npm，跳过依赖安装"
    log_warn "请手动运行: cd $PLUGIN_INSTALL_DIR/server && npm install"
fi

# ============================================
# 6. 安装扩展
# ============================================
log_info "正在安装扩展..."

ROLLBACK_EXT_DIR="$EXT_INSTALL_DIR"

mkdir -p "$EXT_INSTALL_DIR"
cp -r "$PLUGIN_INSTALL_DIR/extension/"* "$EXT_INSTALL_DIR/"

EXT_INSTALLED=true
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
            sed -i.bak 's/enableServerPlugins: false/enableServerPlugins: true/g' "$CONFIG_FILE"
            rm -f "$CONFIG_FILE.bak"
        fi
        log_success "Server Plugins 已启用"
    else
        log_success "Server Plugins 已经是启用状态"
    fi
fi

# ============================================
# 8. 自动重启 SillyTavern
# ============================================

# 取消错误捕获
trap - ERR

ST_RESTARTED=false

# 检测酒馆是否在运行，提供自动重启
ST_PID=$(pgrep -f "node.*server\.js" 2>/dev/null | head -1)

# Termux 环境下 pgrep 可能不可用，尝试用 ps
if [ -z "$ST_PID" ] && command -v ps &> /dev/null; then
    ST_PID=$(ps aux 2>/dev/null | grep "node.*server\.js" | grep -v grep | awk '{print $2}' | head -1)
fi

if [ -n "$ST_PID" ]; then
    echo ""
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${YELLOW}⚠ 检测到 SillyTavern 正在运行 (PID: $ST_PID)${NC}"
    echo -e "  ${YELLOW}  需要重启才能加载 CandyBox 插件${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -ne "  ${BOLD}是否自动重启 SillyTavern？${NC} [Y/n] "
    read -r RESTART_CHOICE </dev/tty 2>/dev/null || RESTART_CHOICE="y"
    RESTART_CHOICE=${RESTART_CHOICE:-y}

    if [[ "$RESTART_CHOICE" =~ ^[Yy]$ ]]; then
        log_info "正在重启 SillyTavern..."
        kill "$ST_PID" 2>/dev/null
        sleep 2

        # 等待进程结束（最多 10 秒）
        for i in {1..10}; do
            if ! kill -0 "$ST_PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done

        # 在酒馆目录后台启动
        cd "$ST_DIR"
        nohup node server.js > /dev/null 2>&1 &
        NEW_PID=$!
        sleep 3

        if kill -0 "$NEW_PID" 2>/dev/null; then
            log_success "SillyTavern 已重启 (PID: $NEW_PID)"
            ST_RESTARTED=true
        else
            log_warn "自动重启失败，请手动重启 SillyTavern"
        fi
    else
        log_warn "请记得手动重启 SillyTavern"
    fi
fi

# ============================================
# 9. 完成
# ============================================

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}${BOLD}  ✓ 安装成功！${NC} (v${VERSION})"
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}📍 安装位置:${NC}"
echo -e "     插件: $PLUGIN_INSTALL_DIR"
echo -e "     扩展: $EXT_INSTALL_DIR"
echo ""
echo -e "${CYAN}────────────────────────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${BOLD}🎮 下一步操作:${NC}"
echo ""
if $ST_RESTARTED; then
echo -e "     ${GREEN}✓ SillyTavern 已自动重启${NC}"
echo ""
echo -e "     1️⃣  可选：在 AI Studio 创建自己的 Applet"
echo -e "         选择 Copy App → Share App 获取链接"
echo ""
echo -e "     2️⃣  打开 Applet → 点击「启动服务」"
echo ""
echo -e "     3️⃣  在酒馆设置代理"
echo -e "         API → Google AI Studio → Proxy → 选择「CandyBox」"
else
echo -e "     ${RED}${BOLD}1️⃣  重启 SillyTavern ← 必须！不重启插件不会生效${NC}"
echo ""
echo -e "     2️⃣  可选：在 AI Studio 创建自己的 Applet"
echo -e "         选择 Copy App → Share App 获取链接"
echo ""
echo -e "     3️⃣  打开 Applet → 点击「启动服务」"
echo ""
echo -e "     4️⃣  在酒馆设置代理"
echo -e "         API → Google AI Studio → Proxy → 选择「CandyBox」"
fi
echo ""
echo -e "${CYAN}────────────────────────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${BOLD}🔧 常用命令:${NC}"
echo -e "     检查状态: ${CYAN}curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/status.sh | bash${NC}"
echo -e "     卸载:     ${CYAN}curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/uninstall.sh | bash${NC}"
echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}CandyBox Proxy${NC} v${VERSION} - 开源免费"
echo -e "  作者: ${CYAN}WanWan${NC}"
echo -e "  GitHub: ${CYAN}https://github.com/shleeshlee/CandyBox-Proxy${NC}"
echo ""
echo -e "  ${YELLOW}★ 如果觉得好用，请给项目点个 Star！${NC}"
echo -e "  ${RED}✗ 本项目免费开源，如果你是付费获取的，你被骗了！${NC}"
echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════${NC}"
echo ""
