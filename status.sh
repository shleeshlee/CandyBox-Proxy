#!/bin/bash

# ============================================
# 🍬 CandyBox Proxy 状态检查脚本
# 作者: WanWan
# 仓库: https://github.com/shleeshlee/CandyBox-Proxy
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

VERSION="1.0.2"

echo ""
echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║  ${BOLD}CandyBox Proxy${NC}${MAGENTA} - 状态检查 v${VERSION}                        ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 检查端口函数
# ============================================
check_cmd() {
    command -v "$1" >/dev/null 2>&1
}

describe_port_owner() {
    local port=$1

    if check_cmd lsof; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " (PID " $2 ")"}'
        return 0
    fi

    if check_cmd ss; then
        ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print $NF; exit}'
        return 0
    fi

    return 1
}

check_port() {
    local port=$1
    local name=$2
    
    if command -v lsof &> /dev/null; then
        if lsof -i:$port &> /dev/null; then
            echo -e "  ${GREEN}✓${NC} $name (端口 $port): ${GREEN}监听中${NC}"
            return 0
        fi
    elif check_cmd ss; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "  ${GREEN}✓${NC} $name (端口 $port): ${GREEN}监听中${NC}"
            return 0
        fi
    elif check_cmd netstat; then
        if netstat -ano 2>/dev/null | grep -qE "LISTEN.*:$port |:$port .*LISTEN"; then
            echo -e "  ${GREEN}✓${NC} $name (端口 $port): ${GREEN}监听中${NC}"
            return 0
        fi
    fi
    
    echo -e "  ${RED}✗${NC} $name (端口 $port): ${RED}未运行${NC}"
    return 1
}

# ============================================
# 检查服务状态
# ============================================
echo -e "${CYAN}[服务状态]${NC}"
echo ""

HTTP_OK=false
WS_OK=false
API_OK=false

check_port 8811 "HTTP 代理" && HTTP_OK=true
check_port 9111 "WebSocket" && WS_OK=true

if $HTTP_OK; then
    OWNER_8811=$(describe_port_owner 8811)
    [ -n "$OWNER_8811" ] && echo -e "    ${CYAN}→ 8811 占用者: ${OWNER_8811}${NC}"
fi
if $WS_OK; then
    OWNER_9111=$(describe_port_owner 9111)
    [ -n "$OWNER_9111" ] && echo -e "    ${CYAN}→ 9111 占用者: ${OWNER_9111}${NC}"
fi

echo ""

# ============================================
# 检查运行依赖
# ============================================
echo -e "${CYAN}[环境依赖]${NC}"
echo ""

for cmd in git node npm curl; do
    if check_cmd "$cmd"; then
        echo -e "  ${GREEN}✓${NC} $cmd: ${GREEN}已安装${NC}"
    else
        echo -e "  ${RED}✗${NC} $cmd: ${RED}缺失${NC}"
    fi
done

echo ""

# ============================================
# 检查 API 状态
# ============================================
echo -e "${CYAN}[API 状态]${NC}"
echo ""

if check_cmd curl; then
    RESPONSE=$(curl -s --max-time 3 http://127.0.0.1:8811/status 2>/dev/null)
    
    if [ -n "$RESPONSE" ]; then
        if echo "$RESPONSE" | grep -q '"name":"CandyBox Proxy"'; then
            API_OK=true
            BROWSER=$(echo "$RESPONSE" | grep -o '"browser_connected":[^,}]*' | cut -d':' -f2)
            echo -e "  ${GREEN}✓${NC} /status: ${GREEN}CandyBox 响应正常${NC}"
            if [ "$BROWSER" = "true" ]; then
                echo -e "  ${GREEN}✓${NC} 浏览器连接: ${GREEN}已连接${NC}"
            else
                echo -e "  ${YELLOW}!${NC} 浏览器连接: ${YELLOW}未连接${NC}"
                echo -e "    ${CYAN}→ 请打开 AI Studio Applet 并点击「启动服务」${NC}"
            fi
        else
            echo -e "  ${RED}✗${NC} /status 返回了非 CandyBox 响应"
            echo -e "    ${CYAN}→ 8811 可能被其他程序占用${NC}"
        fi
    else
        echo -e "  ${RED}✗${NC} 无法获取状态 (服务未运行)"
    fi
else
    echo -e "  ${YELLOW}!${NC} curl 未安装，跳过 API 检查"
fi

echo ""

# ============================================
# 检查安装位置
# ============================================
echo -e "${CYAN}[安装状态]${NC}"
echo ""

# 查找 SillyTavern
ST_DIR=""
for path in "$(pwd)/SillyTavern" "$(pwd)/sillytavern" "$(pwd)/../SillyTavern" "$(pwd)" "$(pwd)/.." "$HOME/SillyTavern" "$HOME/sillytavern" "$HOME/st" "$HOME/ST" "/data/data/com.termux/files/home/SillyTavern" "/data/data/com.termux/files/home/sillytavern"; do
    if [ -d "$path" ] && [ -f "$path/server.js" ] && [ -d "$path/public" ]; then
        ST_DIR="$path"
        break
    fi
done

if [ -n "$ST_DIR" ]; then
    echo -e "  ${GREEN}✓${NC} SillyTavern: $ST_DIR"
    
    PLUGIN_DIR="$ST_DIR/plugins/CandyBox"
    EXT_DIR="$ST_DIR/public/scripts/extensions/third-party/CandyBox"
    
    if [ -d "$PLUGIN_DIR" ]; then
        echo -e "  ${GREEN}✓${NC} 插件已安装: $PLUGIN_DIR"
    else
        echo -e "  ${RED}✗${NC} 插件未安装"
    fi
    
    if [ -d "$EXT_DIR" ]; then
        echo -e "  ${GREEN}✓${NC} 扩展已安装: $EXT_DIR"
    else
        echo -e "  ${RED}✗${NC} 扩展未安装"
    fi

    CONFIG_FILE="$ST_DIR/config.yaml"
    if [ -f "$CONFIG_FILE" ]; then
        if grep -qE '^[[:space:]]*enableServerPlugins:[[:space:]]*true([[:space:]]|$)' "$CONFIG_FILE"; then
            echo -e "  ${GREEN}✓${NC} enableServerPlugins: true"
        elif grep -qE '^[[:space:]]*enableServerPlugins:[[:space:]]*false([[:space:]]|$)' "$CONFIG_FILE"; then
            echo -e "  ${RED}✗${NC} enableServerPlugins: false"
        else
            echo -e "  ${YELLOW}!${NC} config.yaml 未找到 enableServerPlugins"
        fi
    fi
else
    echo -e "  ${YELLOW}!${NC} 未找到 SillyTavern"
fi

echo ""

# ============================================
# 总结
# ============================================
echo -e "${CYAN}[总结]${NC}"
echo ""

if $HTTP_OK && $WS_OK && $API_OK; then
    echo -e "  ${GREEN}${BOLD}✓ CandyBox Proxy 运行正常${NC}"
else
    echo -e "  ${YELLOW}${BOLD}! CandyBox Proxy 未完全运行${NC}"
    echo ""
    echo -e "  ${CYAN}提示:${NC}"
    echo -e "  1. 先确认 git/node/npm/curl 已安装"
    echo -e "  2. 确保 SillyTavern 已启动，并且 config.yaml 中 enableServerPlugins: true"
    echo -e "  3. 确认 8811/9111 没被其他程序占用"
    echo -e "  4. 重启或启动 SillyTavern 后再检查一次"
fi

echo ""
echo -e "${MAGENTA}────────────────────────────────────────────────────────────────────${NC}"
echo -e "  作者: ${CYAN}WanWan${NC} | GitHub: ${CYAN}https://github.com/shleeshlee/CandyBox-Proxy${NC}"
echo -e "${MAGENTA}────────────────────────────────────────────────────────────────────${NC}"
echo ""
