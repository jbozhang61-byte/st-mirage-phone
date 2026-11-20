#!/data/data/com.termux/files/usr/bin/bash
# 幻镜手机 · 让「任何方式启动酒馆」都自动带上中继
# 只需运行一次：bash ~/st-mirage-phone/termux/install-autorelay.sh

set -e
HOME_DIR="$HOME"
RELAY_DIR="$HOME_DIR/st-mirage-phone/bridge"
GUARD_START='# >>> mirage-relay-auto >>>'
GUARD_END='# <<< mirage-relay-auto <<<'

if [ ! -f "$RELAY_DIR/relay.py" ]; then
  echo "找不到 $RELAY_DIR/relay.py，请先把仓库放到 ~/st-mirage-phone"
  exit 1
fi

# 中继启动片段：已经在跑就不重复启动
BLOCK="$GUARD_START
# 幻镜手机：酒馆启动时顺手把中继开起来（已运行则跳过）
if ! (echo > /dev/tcp/127.0.0.1/17650) 2>/dev/null; then
  ( cd \"$RELAY_DIR\" && nohup python relay.py >> \"$HOME_DIR/mp-relay.log\" 2>&1 & )
fi
$GUARD_END"

patched=0
for FILE in "$HOME_DIR/foxium.sh" "$HOME_DIR/angler_toolbox.sh" "$HOME_DIR/SillyTavern/start.sh" "$HOME_DIR/sillytavern/start.sh"; do
  [ -f "$FILE" ] || continue
  if grep -q "mirage-relay-auto" "$FILE"; then
    echo "已装过：$FILE"
    continue
  fi
  # 备份一次
  cp "$FILE" "$FILE.bak-mirage" 2>/dev/null || true
  # 在第一行 shebang 之后插入
  if head -1 "$FILE" | grep -q '^#!'; then
    head -1 "$FILE" > "$FILE.tmp"
    printf '%s\n' "$BLOCK" >> "$FILE.tmp"
    tail -n +2 "$FILE" >> "$FILE.tmp"
  else
    printf '%s\n' "$BLOCK" > "$FILE.tmp"
    cat "$FILE" >> "$FILE.tmp"
  fi
  mv "$FILE.tmp" "$FILE"
  chmod +x "$FILE" 2>/dev/null || true
  echo "已注入中继：$FILE"
  patched=$((patched + 1))
done

if [ "$patched" = "0" ]; then
  echo "没找到 foxium.sh / angler_toolbox.sh / SillyTavern/start.sh"
  echo "你可以在启动酒馆前手动跑一次：cd ~/st-mirage-phone/bridge && python relay.py"
else
  echo
  echo "完成：以后不管用「输 1」还是粘贴命令启动酒馆，中继都会自动起来。"
  echo "日志：~/mp-relay.log"
fi
