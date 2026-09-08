#!/bin/zsh
set -eu
TM_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
TM_PORT="${TM_PORT:-8766}"
print "TigerMessenger: http://127.0.0.1:$TM_PORT/"
print "保留此窗口即可游玩；Ctrl+C 停止本地服务。"
(sleep 1; open "http://127.0.0.1:$TM_PORT/") &
exec python3 -m http.server "$TM_PORT" --bind 127.0.0.1 --directory "$TM_ROOT"
