#!/bin/bash
set -e
cd "$(dirname "$0")/godot"
exec /Applications/Godot.app/Contents/MacOS/Godot --path "$PWD" res://scenes/crystal_v7_review.tscn
