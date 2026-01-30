#!/bin/bash

# ============================================
# 🍬 CandyBox Proxy 卸载脚本
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

echo ""
echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║  ${BOLD}CandyBox Proxy${NC}${MAGENTA} - 卸载工具                                 ║${NC}"
echo -e "${MAGENTA}║  ${CYAN}作者: WanWan${NC}${MAGENTA}                                              ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 查找 SillyTavern 目录
# ============================================
echo -e "${CYAN}[INFO]${NC} 正在查找 SillyTavern..."

ST_DIR=""

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

if [ -z "$ST_DIR" ]; then
    FOUND=$(find ~ -maxdepth 4 -name "server.js" -path "*SillyTavern*" 2>/dev/null | head -1)
    if [ -n "$FOUND" ]; then
        ST_DIR=$(dirname "$FOUND")
    fi
fi

if [ -z "$ST_DIR" ]; then
    echo -e "${RED}[ERROR]${NC} 找不到 SillyTavern 目录！"
    exit 1
fi

echo -e "${GREEN}[SUCCESS]${NC} 找到 SillyTavern: $ST_DIR"

# ============================================
# 定义路径
# ============================================
PLUGIN_DIR="$ST_DIR/plugins/CandyBox"
EXT_DIR="$ST_DIR/public/scripts/extensions/third-party/CandyBox"

# ============================================
# 确认卸载
# ============================================
echo ""
echo -e "${YELLOW}将删除以下目录:${NC}"
[ -d "$PLUGIN_DIR" ] && echo "  📁 $PLUGIN_DIR"
[ -d "$EXT_DIR" ] && echo "  📁 $EXT_DIR"
echo ""

if [ ! -d "$PLUGIN_DIR" ] && [ ! -d "$EXT_DIR" ]; then
    echo -e "${YELLOW}[WARN]${NC} CandyBox 未安装，无需卸载"
    exit 0
fi

read -p "确认卸载 CandyBox Proxy? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}已取消${NC}"
    exit 0
fi

# ============================================
# 停止相关进程
# ============================================
echo ""
echo -e "${CYAN}[INFO]${NC} 检查运行中的进程..."

# 检查端口占用
if command -v lsof &> /dev/null; then
    PID_8811=$(lsof -ti:8811 2>/dev/null)
    PID_9111=$(lsof -ti:9111 2>/dev/null)
    
    if [ -n "$PID_8811" ] || [ -n "$PID_9111" ]; then
        echo -e "${YELLOW}[WARN]${NC} 检测到 CandyBox 端口被占用"
        read -p "是否停止相关进程? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            [ -n "$PID_8811" ] && kill -9 $PID_8811 2>/dev/null
            [ -n "$PID_9111" ] && kill -9 $PID_9111 2>/dev/null
            echo -e "${GREEN}[SUCCESS]${NC} 进程已停止"
        fi
    fi
fi

# ============================================
# 删除文件
# ============================================
echo ""
echo -e "${CYAN}[INFO]${NC} 正在删除文件..."

if [ -d "$PLUGIN_DIR" ]; then
    rm -rf "$PLUGIN_DIR"
    echo -e "${GREEN}[SUCCESS]${NC} 已删除插件: $PLUGIN_DIR"
fi

if [ -d "$EXT_DIR" ]; then
    rm -rf "$EXT_DIR"
    echo -e "${GREEN}[SUCCESS]${NC} 已删除扩展: $EXT_DIR"
fi

# ============================================
# 完成
# ============================================
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ 卸载完成！${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  请重启 SillyTavern 以完成卸载"
echo ""
echo -e "${MAGENTA}────────────────────────────────────────────────────────────────────${NC}"
echo -e "  ${CYAN}感谢使用 CandyBox Proxy！${NC}"
echo -e "  如需重新安装: ${CYAN}curl -sL https://raw.githubusercontent.com/shleeshlee/CandyBox-Proxy/main/install.sh | bash${NC}"
echo -e "${MAGENTA}────────────────────────────────────────────────────────────────────${NC}"
echo ""
