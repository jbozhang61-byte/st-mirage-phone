#!/data/data/com.termux/files/usr/bin/bash
# 幻镜手机 · 一键更新（Termux）
# 用法：bash ~/st-mirage-phone/termux/update.sh
set -e

REPO="$HOME/st-mirage-phone"
echo "== 1/3 拉取最新代码 =="
cd "$REPO"
if ! git pull --ff-only 2>/dev/null; then
  echo "直连失败，切镜像重试…"
  git remote set-url origin https://ghfast.top/https://github.com/jbozhang61-byte/st-mirage-phone
  git pull --ff-only || {
    git remote set-url origin https://github.com/jbozhang61-byte/st-mirage-phone
    echo "拉取失败：检查网络或代理"
    exit 1
  }
fi
echo "当前版本：$(grep '"'"'"version"'"'"' "$REPO/manifest.json" | head -1)"

echo "== 2/3 复制到酒馆扩展目录 =="
ST="$HOME/SillyTavern"
TARGETS=(
  "$ST/public/scripts/extensions/third-party/mirage-phone"
  "$ST/data/default-user/extensions/st-mirage-phone"
  "$ST/public/scripts/extensions/st-mirage-phone"
  "$ST/public/scripts/extensions/third-party/st-mirage-phone"
)
FOUND=0
for T in "${TARGETS[@]}"; do
  if [ -d "$T" ]; then
    echo "  更新 $T"
    cp -r "$REPO/src" "$REPO/css" "$REPO/index.js" "$REPO/manifest.json" "$REPO/package.json" "$T"/
    FOUND=1
  fi
done
if [ "$FOUND" = "0" ]; then
  echo "  没找到已安装的小手机，装到 third-party/mirage-phone"
  T="$ST/public/scripts/extensions/third-party/mirage-phone"
  mkdir -p "$T"
  cp -r "$REPO/src" "$REPO/css" "$REPO/index.js" "$REPO/manifest.json" "$REPO/package.json" "$T"/
fi

echo "== 3/3 完成 =="
echo "刷新酒馆页面（下拉刷新或重新打开）即可看到新界面"
echo "Discord 侧栏应该变成白色圆角方块，夜约应该支持搜索生成"
