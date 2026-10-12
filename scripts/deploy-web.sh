#!/usr/bin/env bash
# 前端生产发布：新版本 + 保留上一版本 hashed 资源，避免在途页面懒加载分块 404。
# 2026-10-10 起，重建版 th4-decoboon-web 已切换为线上承载源码。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DECOBOON_PROD_HOST:-120.55.15.159}"
USER_NAME="${DECOBOON_PROD_USER:-root}"
SSH_KEY="${DECOBOON_PROD_SSH_KEY:-$HOME/.ssh/id_ed25519}"
WEB_ROOT="${DECOBOON_WEB_ROOT:-/opt/decoboon-web}"
API_URL="${DECOBOON_API_URL:-https://decoboon.joytsing.com}"
DIST_DIR="$ROOT_DIR/dist"
STAMP="${DECOBOON_RELEASE_STAMP:-$(date +%Y%m%d-%H%M%S)}"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-web.sh [--dist <dir>] [--stamp <YYYYmmdd-HHMMSS>]
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dist) DIST_DIR="${2:-}"; shift 2 ;;
    --stamp) STAMP="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

[ -f "$DIST_DIR/index.html" ] || { echo "[deploy-web] 缺少 $DIST_DIR/index.html，请先 npm run build" >&2; exit 2; }

ssh_run() {
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes \
      -o ConnectTimeout=15 -i "$SSH_KEY" "$USER_NAME@$HOST" "$@"
}

REMOTE_RELEASE="$WEB_ROOT/releases/$STAMP"
echo "[deploy-web] 上传 dist -> $REMOTE_RELEASE"
ssh_run "mkdir -p '$REMOTE_RELEASE'"
tar czf - -C "$DIST_DIR" . | ssh_run "tar xzf - -C '$REMOTE_RELEASE'"

ssh_run "chown -R decoboon:decoboon '$REMOTE_RELEASE'"

PREVIOUS="$(ssh_run "readlink -f '$WEB_ROOT/current' 2>/dev/null || true")"
echo "[deploy-web] previous=$PREVIOUS"

# 合并上一版本的 hashed 资源：文件名带内容哈希、内容不可变，保留后老页面分块仍可命中。
if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$REMOTE_RELEASE" ]; then
  ssh_run "if [ -d '$PREVIOUS/assets' ]; then cp -an '$PREVIOUS/assets/.' '$REMOTE_RELEASE/assets/' 2>/dev/null || true; fi"
fi

echo "[deploy-web] 切换 current -> $STAMP"
ssh_run "ln -sfn '$REMOTE_RELEASE' '$WEB_ROOT/current' && nginx -t >/dev/null && systemctl reload nginx"

smoke_ok=1
index_js="$(curl -fsS "$API_URL/" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
if [ -z "$index_js" ]; then
  smoke_ok=0
else
  curl -fsS -o /dev/null "$API_URL/$index_js" || smoke_ok=0
  curl -fsS -o /dev/null "$API_URL/login" || smoke_ok=0
fi

if [ "$smoke_ok" != "1" ]; then
  echo "[deploy-web] 冒烟失败，回滚到 $PREVIOUS" >&2
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$REMOTE_RELEASE" ]; then
    ssh_run "ln -sfn '$PREVIOUS' '$WEB_ROOT/current' && nginx -t >/dev/null && systemctl reload nginx"
  fi
  exit 1
fi

# 唯一入口守卫（2026-10-12）：/v3/ 测试入口已退役，必须 301 到生产根，防止旧构建被重新暴露。
v3_head="$(curl -sS -o /dev/null -D - -H 'Cache-Control: no-cache' "$API_URL/v3/" 2>/dev/null | head -1 || true)"
if printf '%s' "$v3_head" | grep -qE 'HTTP/[0-9.]+ 30[12]'; then
  echo "[deploy-web] 入口守卫通过：/v3/ 仍为退役状态（${v3_head%$'\r'}），唯一生产入口 $API_URL/"
else
  echo "[deploy-web] 告警：/v3/ 未重定向到生产根（${v3_head%$'\r'}）；若属重新暴露旧构建，请回退 nginx 配置。" >&2
fi

echo "[deploy-web] 发布完成：release=$REMOTE_RELEASE previous=$PREVIOUS"
echo "[deploy-web] 回滚命令：ssh $USER_NAME@$HOST \"ln -sfn $PREVIOUS $WEB_ROOT/current && nginx -t && systemctl reload nginx\""
