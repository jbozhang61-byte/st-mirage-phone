#!/data/data/com.termux/files/usr/bin/bash
# 幻镜手机 · 一键启动：酒馆 + 中继
# 用法（Termux）：bash ~/mp.sh

cd "$HOME" || exit 1
LOG="$HOME/mp.log"
echo "==== $(date '+%F %T') 启动 ====" >> "$LOG"

termux-wake-lock 2>/dev/null || true

# 1) 酒馆（如果 8000 端口没在监听就启动）
if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:8000; then
  echo "[mp] 启动 SillyTavern…" | tee -a "$LOG"
  cd "$HOME/SillyTavern" || exit 1
  nohup node server.js >> "$LOG" 2>&1 &
  sleep 6
else
  echo "[mp] 酒馆已在运行" | tee -a "$LOG"
fi

# 2) 中继（如果 17650 没在监听就启动）
if ! (echo > /dev/tcp/127.0.0.1/17650) 2>/dev/null; then
  echo "[mp] 启动中继…" | tee -a "$LOG"
  cd "$HOME/st-mirage-phone/bridge" || exit 1
  nohup python relay.py >> "$LOG" 2>&1 &
  sleep 2
else
  echo "[mp] 中继已在运行" | tee -a "$LOG"
fi

echo "==== 完成 ====" | tee -a "$LOG"
