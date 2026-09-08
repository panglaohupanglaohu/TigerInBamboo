#!/bin/zsh
set -eu
TM_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
TM_GODOT="${TM_GODOT:-$HOME/Downloads/Godot.app/Contents/MacOS/Godot}"
if [[ ! -x "$TM_GODOT" ]]; then TM_GODOT="/Applications/Godot.app/Contents/MacOS/Godot"; fi
if [[ ! -x "$TM_GODOT" ]]; then print "找不到 Godot.app。"; exit 1; fi
"$TM_GODOT" --headless --editor --path "$TM_ROOT/godot" --import --quit
exec "$TM_GODOT" --path "$TM_ROOT/godot"
