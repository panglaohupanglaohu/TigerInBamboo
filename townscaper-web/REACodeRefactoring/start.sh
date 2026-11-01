#!/bin/bash
# start.sh — 启动 REACode 重构版：起本地静态服务并打开 index.html（三场景 + 学习面板）。
#
# 用法:
#   ./start.sh                  默认端口 8766（原版 REACode 用 8765，两个可以同时开）
#   ./start.sh --port 9000      指定端口
#   ./start.sh --no-open        只起服务，不开浏览器
#   ./start.sh --open <页面>    town | terrain | fusion | walk | mixed | arch | pipeline | learn | guide
#   ./start.sh --stop           停止服务
#
# 为什么需要它：页面用 ES module，file:// 下会被浏览器拦截；另外它会把
# ../../REA-agent/gifs 链接成 gifs/，学习面板里的 ▶ 才能播放原视频。
set -uo pipefail
cd "$(dirname "$0")" || exit 1

PORT=8766
OPEN_BROWSER=1
OPEN_PAGE="index.html"
PID_FILE=".server.pid"
PORT_FILE=".server.port"
ROOT="$(pwd -P)"
LOG_FILE=".server.log"

page_for() {
  case "$1" in
    town|terrain|fusion) echo "index.html?scene=$1" ;;
    walk|demo)           echo "index.html?walk=1" ;;
    mixed)               echo "index.html?grid=mixed&scene=fusion" ;;
    arch|architecture)   echo "architecture.html" ;;
    pipeline|road)       echo "pipeline.html" ;;
    learn|notes)         echo "learn.html" ;;
    guide)               echo "GUIDE.md" ;;
    *)                   echo "${1:-index.html}" ;;
  esac
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-8766}"; shift 2 ;;
    --no-open) OPEN_BROWSER=0; shift ;;
    --open) OPEN_PAGE="$(page_for "${2:-}")"; shift 2 ;;
    --stop) STOP=1; shift ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数: $1（--help 看用法）" >&2; exit 1 ;;
  esac
done

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
pid_alive() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; }
open_url() { [ "$OPEN_BROWSER" = "1" ] && { open "$1" 2>/dev/null || xdg-open "$1" 2>/dev/null || true; }; }

if [ "${STOP:-0}" = "1" ]; then
  if pid_alive; then kill "$(cat "$PID_FILE")" 2>/dev/null; rm -f "$PID_FILE"; echo "已停止服务"; exit 0; fi
  echo "服务未在运行。"; rm -f "$PID_FILE"; exit 0
fi

# 视频目录：链接进来（不复制）
GIFS_SRC="../../REA-agent/gifs"
if [ ! -e gifs ] && [ -d "$GIFS_SRC" ]; then ln -s "$GIFS_SRC" gifs && echo "已链接视频目录: gifs -> $GIFS_SRC"; fi
[ -e gifs ] || echo "提示: 没找到 $GIFS_SRC，▶ 会跳到原帖而不是播放本地视频。"

entries() {
  local b="http://localhost:$1"
  echo ""
  echo "  场景（小镇 / 地形 / 融合）  $b/index.html      ?scene=terrain  ?scene=fusion"
  echo "  系统全局（架构图）          $b/architecture.html"
  echo "  管线图与学习路线            $b/pipeline.html"
  echo "  学习笔记（237 段视频）      $b/learn.html"
  echo "  接手指南                    $b/GUIDE.md"
  echo ""
  echo "  停止: ./start.sh --stop"
}

same_root() {
  curl -fsS --max-time 2 "http://127.0.0.1:$1/__rea_identity__" 2>/dev/null | "$PYTHON" -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("root") == sys.argv[1] else 1)' "$ROOT" 2>/dev/null
}
PYTHON=$(command -v python3 || command -v python)
[ -n "$PYTHON" ] || { echo "需要 python3" >&2; exit 1; }
if [ -f "$PORT_FILE" ] && pid_alive; then
  SAVED_PORT=$(cat "$PORT_FILE")
  if same_root "$SAVED_PORT"; then PORT="$SAVED_PORT"; fi
fi
if pid_alive && same_root "$PORT"; then
  echo "服务已在运行。"; entries "$PORT"; open_url "http://localhost:$PORT/$OPEN_PAGE"; exit 0
fi
if port_busy "$PORT"; then
  for c in $(seq $((PORT + 1)) $((PORT + 20))); do if ! port_busy "$c"; then PORT=$c; break; fi; done
  echo "端口被占用，改用 $PORT"
fi

PYTHON=$(command -v python3 || command -v python)
[ -z "$PYTHON" ] && { echo "没找到 python3，无法起静态服务器。" >&2; exit 1; }
"$PYTHON" tools/serve.py "$PORT" >"$LOG_FILE" 2>&1 &   # 带 no-store，改了代码刷新就生效
echo $! >"$PID_FILE"

for _ in $(seq 1 40); do
  if kill -0 "$(cat "$PID_FILE")" 2>/dev/null && same_root "$PORT" && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/index.html" 2>/dev/null && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/src/world/app.js" 2>/dev/null; then READY=1; break; fi
  sleep 0.15
done
if [ "${READY:-0}" != "1" ]; then
  echo "服务启动失败，日志:" >&2; sed -n '1,20p' "$LOG_FILE" >&2
  kill "$(cat "$PID_FILE")" 2>/dev/null; rm -f "$PID_FILE"; exit 1
fi

echo "$PORT" >"$PORT_FILE"
echo "REACode 重构版已启动（端口 ${PORT}）"
entries "$PORT"
open_url "http://localhost:$PORT/$OPEN_PAGE"
exit 0
