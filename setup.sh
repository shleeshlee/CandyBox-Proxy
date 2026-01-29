#!/bin/bash

# CandyBox Proxy - 快速安装脚本
# 糖果盒代理安装助手

echo "🍬 ════════════════════════════════════════"
echo "🍬  CandyBox Proxy 安装助手"
echo "🍬 ════════════════════════════════════════"
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
echo "   2. 在酒馆选择代理 → 糖果盒代理"
echo ""
