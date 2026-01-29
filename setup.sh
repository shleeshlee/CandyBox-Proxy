#!/bin/bash
# CandyBox Proxy - 快速安装脚本
# CandyBox Proxy - Quick Install Script

echo "🍬 ════════════════════════════════════════"
echo "🍬  CandyBox Proxy 安装助手"
echo "🍬 ════════════════════════════════════════"
echo ""

# 显示菜单
echo "请选择操作："
echo ""
echo "  1) 安装 / 重装"
echo "  2) 一键卸载"
echo ""
read -p "请输入选项 [1/2]: " choice

case $choice in
    1)
        echo ""
        echo "📦 开始安装..."
        ;;
    2)
        echo ""
        echo "🗑️ 开始卸载..."
        if [ -d "SillyTavern" ]; then
            rm -rf SillyTavern/plugins/CandyBox
            rm -rf SillyTavern/public/scripts/extensions/third-party/CandyBox
            echo ""
            echo "🍬 ════════════════════════════════════════"
            echo "🍬  ✓ 卸载完成！"
            echo "🍬 ════════════════════════════════════════"
            echo ""
        else
            echo "❌ 未找到 SillyTavern 目录"
        fi
        exit 0
        ;;
    *)
        echo "❌ 无效选项，退出"
        exit 1
        ;;
esac

# 检查 SillyTavern 目录
if [ ! -d "SillyTavern" ]; then
    echo "❌ 未找到 SillyTavern 目录"
    echo "请在 SillyTavern 所在的父目录运行此脚本"
    exit 1
fi

echo "✓ 找到 SillyTavern 目录"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 清理旧安装
if [ -d "SillyTavern/plugins/CandyBox" ] || [ -d "SillyTavern/public/scripts/extensions/third-party/CandyBox" ]; then
    echo "🔄 检测到已安装，正在清理旧版本..."
    rm -rf SillyTavern/plugins/CandyBox
    rm -rf SillyTavern/public/scripts/extensions/third-party/CandyBox
fi

# 安装 Server 插件
echo ""
echo "📦 正在安装 Server 插件..."
mkdir -p SillyTavern/plugins/CandyBox
cp "$SCRIPT_DIR/server/"* SillyTavern/plugins/CandyBox/
cd SillyTavern/plugins/CandyBox && npm install --silent
cd - > /dev/null
echo "✓ Server 插件安装完成"

# 安装 Extension
echo ""
echo "📦 正在安装扩展..."
mkdir -p SillyTavern/public/scripts/extensions/third-party/CandyBox
cp "$SCRIPT_DIR/extension/"* SillyTavern/public/scripts/extensions/third-party/CandyBox/
echo "✓ 扩展安装完成"

echo ""
echo "🍬 ════════════════════════════════════════"
echo "🍬  安装完成！"
echo "🍬 ════════════════════════════════════════"
echo ""
echo "📝 接下来请："
echo "   1. 重启 SillyTavern"
echo "   2. 打开 CandyBox Applet"
echo "   3. 点击「启动服务」"
echo ""
echo "🎮 使用方法："
echo "   1. 打开 Applet → 点击「启动服务」"
echo "   2. 在API GoogleAIStudio的代理 → CandyBox"
echo ""
