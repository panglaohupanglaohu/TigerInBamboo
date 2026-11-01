#!/bin/bash
# 双击启动（macOS .command 会被终端执行）。
# 模块化版本用这个；只想玩的话直接双击 Townscaper.html 更快。
cd "$(dirname "$0")" || exit 1
exec ./start.sh "$@"
