#!/bin/bash
# 双击停止本地服务器。
cd "$(dirname "$0")" || exit 1
exec ./start.sh --stop
