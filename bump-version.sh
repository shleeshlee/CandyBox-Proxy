#!/usr/bin/env bash
# 发版盖章：把仓库里所有版本号一次性改齐并校验，杜绝漏改。
# 用法: ./bump-version.sh 1.4.0
set -euo pipefail
V="${1:?用法: ./bump-version.sh <新版本号>}"
D="$(date +%Y-%m-%d)"

sed -i.bak -E "s/(const VERSION = ')[0-9.]+(')/\1${V}\2/; s/(\* 版本: )[0-9.]+/\1${V}/" extension/index.js
sed -i.bak -E "s/(\"version\": \")[0-9.]+(\")/\1${V}\2/" extension/manifest.json manifest.json
sed -i.bak -E "s/(\* 版本: )[0-9.]+/\1${V}/; s/(CandyBox Proxy v)[0-9.]+/\1${V}/; s/(version: ')[0-9.]+(',)/\1${V}\2/" server/server.js
sed -i.bak -E "s/^(VERSION=\")[0-9.]+(\")/\1${V}\2/; s/^(RELEASE_DATE=\")[0-9-]+(\")/\1${D}\2/" install.sh
[ -f server/package.json ] && sed -i.bak -E "s/(\"version\": \")[0-9.]+(\")/\1${V}\2/" server/package.json
rm -f extension/*.bak server/*.bak ./*.bak

echo "== 校验：以下每行都必须是 ${V} =="
FAIL=0
while IFS= read -r line; do
  echo "$line"
  echo "$line" | grep -q "${V}" || FAIL=1
done < <(grep -Hn "const VERSION = \|\"version\": \|CandyBox Proxy v[0-9]\|version: '\|^VERSION=" extension/index.js extension/manifest.json manifest.json server/server.js install.sh server/package.json 2>/dev/null)
if [ "$FAIL" = "1" ]; then echo "✗ 有版本号没盖到，禁止发版"; exit 1; fi
bash -n install.sh && node --check server/server.js
echo "✓ 全部盖章为 v${V}（${D}），语法检查通过"
