#!/data/data/com.termux/files/usr/bin/bash
# 幻镜手机 · 一键启动本机中转（Termux 里运行）
# 用法：bash start.sh

set -e
cd "$(dirname "$0")"

echo "== 1/3 检查 node =="
if ! command -v node >/dev/null 2>&1; then
  echo "没装 node，帮你装（需要几十秒）"
  pkg install nodejs -y
fi
echo "node: $(node -v)"

echo "== 2/3 检查 ws =="
if [ ! -d node_modules/ws ]; then
  echo "第一次运行，安装 ws…"
  npm config set registry https://registry.npmmirror.com >/dev/null 2>&1 || true
  npm i ws --no-audit --no-fund
fi
echo "ws: ok"

echo "== 3/3 启动中转 =="
termux-wake-lock 2>/dev/null || true
exec node relay.js
