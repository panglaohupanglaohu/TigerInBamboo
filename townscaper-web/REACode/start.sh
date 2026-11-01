#!/bin/bash
# start.sh — 启动 REACode 的本地静态服务器，打开 index.html（three.js 场景 + 学习导航）。
#
# index.html 就是 three.js 场景（新版 Townscaper），右侧「学习导航」面板可以
# 逐项开关学到的技术、播放对应原片、跳到学习笔记 / 对比 / engine 各页。
#
# 用法:
#   ./start.sh                 默认端口 8765，起服务并打开 index.html
#   ./start.sh --port 9000     指定端口
#   ./start.sh --no-open       只起服务，不开浏览器
#   ./start.sh --open learn    起服务并直接打开某一页（learn / pipeline / guide / overview / compare / world / terrain / island / props / sphere / flow / old）
#   ./start.sh --stop          停止已在运行的服务
#
# 说明: 模块化页面（index.html、engine/*.html）必须走 http，ES module 在
#       file:// 下会被浏览器按 CORS 拦截。只有旧版单文件 Townscaper.html
#       可以直接双击。
#       视频：脚本会把 ../../REA-agent/gifs 链接成本目录的 gifs/，
#       learn.html 里点缩略图就能播放原视频。
set -uo pipefail

cd "$(dirname "$0")" || exit 1

PORT=8765
OPEN_BROWSER=1
OPEN_PAGE="index.html"
PID_FILE=".server.pid"
LOG_FILE=".server.log"

page_for() {
  case "$1" in
    index|home|"")      echo "index.html" ;;
    game|townscaper)    echo "index.html" ;;
    overview|hub)       echo "overview.html" ;;
    learn|notes)        echo "learn.html" ;;
    pipeline|road)      echo "pipeline.html" ;;
    guide)              echo "GUIDE.md" ;;
    compare|diff)       echo "compare.html" ;;
    world|mesa|engine)  echo "engine/world.html" ;;
    terrain)            echo "engine/terrain.html" ;;
    island|demo)        echo "engine/demo.html" ;;
    props)              echo "engine/props.html" ;;
    flow|field)         echo "flow.html" ;;
    sphere|planet)      echo "engine/sphere.html" ;;
    old|legacy)         echo "Townscaper.html" ;;
    *)                  echo "$1" ;;
  esac
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-8765}"; shift 2 ;;
    --no-open) OPEN_BROWSER=0; shift ;;
    --open) OPEN_PAGE="$(page_for "${2:-}")"; shift 2 ;;
    --stop) STOP=1; shift ;;
    --force) FORCE=1; shift ;;   # 连"不是本脚本起的"端口占用也一起停
    --status) STATUS=1; shift ;; # 只报告：pidfile 指向谁、端口上是谁
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "未知参数: $1（--help 看用法）" >&2; exit 1 ;;
  esac
done

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
pid_alive() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; }
# 光看 PID 活着不够：进程死了以后 PID 会被系统复用，`.server.pid` 陈旧时
# `kill $(cat .server.pid)` 可能杀掉一个完全无关的进程。所以结束前先确认
# 这个 PID 的命令行确实是 http.server。
pid_is_server() {
  local pid="${1:-}"
  [ -n "$pid" ] || return 1
  ps -o command= -p "$pid" 2>/dev/null | grep -q 'http\.server'
}
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2; exit}'; }
port_cwd() { local pid; pid="$(port_pid "$1")"; [ -n "$pid" ] && lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1; }
open_url() { if [ "$OPEN_BROWSER" = "1" ]; then open "$1" 2>/dev/null || xdg-open "$1" 2>/dev/null || true; fi; }

show_status() {
  echo "目录: $(pwd)"
  if [ -f "$PID_FILE" ]; then
    local pid; pid="$(cat "$PID_FILE" 2>/dev/null)"
    if kill -0 "$pid" 2>/dev/null; then
      echo "pidfile: .server.pid = ${pid}（活着，命令: $(ps -o command= -p "$pid" 2>/dev/null | cut -c1-80)）"
    else
      echo "pidfile: .server.pid = ${pid}（进程已不存在 → 陈旧文件）"
    fi
  else
    echo "pidfile: 没有 .server.pid"
  fi
  local lp; lp="$(port_pid "$PORT")"
  if [ -n "$lp" ]; then
    echo "端口 ${PORT}: PID ${lp} 在监听（cwd: $(port_cwd "$PORT")）"
    if [ -f "$PID_FILE" ] && [ "$lp" = "$(cat "$PID_FILE" 2>/dev/null)" ]; then
      echo "         → 就是本脚本起的"
    else
      echo "         → 不是本脚本起的（--stop 不会动它，除非加 --force）"
    fi
  else
    echo "端口 ${PORT}: 没人监听"
  fi
}

stop_server() {
  if pid_alive; then
    local pid; pid="$(cat "$PID_FILE")"
    if pid_is_server "$pid"; then
      kill "$pid" 2>/dev/null
      rm -f "$PID_FILE"
      echo "已停止本脚本起的服务（PID ${pid}）"
      return 0
    fi
    echo "pidfile 里的 PID ${pid} 现在不是 http.server（很可能被系统复用了），没有动它。"
    rm -f "$PID_FILE"
  fi

  local lp; lp="$(port_pid "$PORT")"
  if [ -n "$lp" ]; then
    if [ "${FORCE:-0}" = "1" ]; then
      kill "$lp" 2>/dev/null
      echo "已强制停止端口 ${PORT} 上的进程（PID ${lp}，不是本脚本起的）"
      rm -f "$PID_FILE"
      return 0
    fi
    echo "端口 $PORT 上有别的进程在监听（PID ${lp}，cwd: $(port_cwd "$PORT")）。"
    echo "它没有记录在 .server.pid 里，所以 --stop 不擅自结束它。"
    echo "确实要停: ./start.sh --stop --force   或   kill ${lp}"
    return 1
  fi

  echo "服务未在运行。"
  rm -f "$PID_FILE"
  return 0
}

if [ "${STATUS:-0}" = "1" ]; then
  show_status
  exit 0
fi

if [ "${STOP:-0}" = "1" ]; then
  stop_server
  exit $?
fi

# 视频目录：链接进来，learn.html 才能播放原片（不复制，不占空间）
GIFS_SRC="../../REA-agent/gifs"
if [ ! -e gifs ] && [ -d "$GIFS_SRC" ]; then
  ln -s "$GIFS_SRC" gifs && echo "已链接视频目录: gifs -> $GIFS_SRC"
fi
[ -e gifs ] || echo "提示: 没找到 $GIFS_SRC，learn.html 只能看缩略图，播放会跳到原帖。"

print_entries() {
  local base="http://localhost:$1"
  echo ""
  echo "  场景+导航    $base/index.html         （新版 Townscaper；右侧「学习导航」）"
  echo "  成果总览    $base/overview.html"
  echo "  管线与路线  $base/pipeline.html"
  echo "  接手指南    $base/GUIDE.md"
  echo "  学习笔记    $base/learn.html         （237 段视频：原文 → 学到什么 → 代码位置）"
  echo "  新旧对比    $base/compare.html"
  echo "  engine      $base/engine/world.html  /terrain.html  /demo.html"
  echo "  旧版        $base/Townscaper.html    （也可直接双击）"
  echo ""
  echo "  停止: ./start.sh --stop"
}

# 已经跑着就复用，不要重复起
if pid_alive && port_busy "$PORT"; then
  echo "服务已在运行。"
  print_entries "$PORT"
  open_url "http://localhost:$PORT/$OPEN_PAGE"
  exit 0
fi

# 端口被别的程序占用时自动换一个
if port_busy "$PORT"; then
  echo "端口 $PORT 被占用，尝试换一个…"
  for candidate in $(seq $((PORT + 1)) $((PORT + 20))); do
    if ! port_busy "$candidate"; then PORT=$candidate; break; fi
  done
fi

PYTHON=$(command -v python3 || command -v python)
if [ -z "$PYTHON" ]; then
  echo "没找到 python3，无法起静态服务器。" >&2
  echo "替代方案：直接双击 Townscaper.html（旧版单文件，不需要服务器）。" >&2
  exit 1
fi

"$PYTHON" -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

# 健康检查：总览页和新版游戏都要能回 200 再开浏览器
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/index.html" 2>/dev/null \
    && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/src/app.js" 2>/dev/null; then
    READY=1
    break
  fi
  sleep 0.15
done

if [ "${READY:-0}" != "1" ]; then
  echo "服务启动失败，日志:" >&2
  sed -n '1,20p' "$LOG_FILE" >&2
  kill "$(cat "$PID_FILE")" 2>/dev/null
  rm -f "$PID_FILE"
  exit 1
fi

echo "REACode 已启动（端口 $PORT）"
print_entries "$PORT"
open_url "http://localhost:$PORT/$OPEN_PAGE"
exit 0
