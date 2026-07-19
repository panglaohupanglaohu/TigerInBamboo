#!/bin/bash
# 批量：tools/crops/*.png → TripoSR → frontend/assets/models/<name>.glb
# 每个模型独立进程，单个失败不影响其余；日志 tools/out/gen.log
set -u
cd "$(dirname "$0")/.."            # 仓库根
ROOT="$PWD"
PY="$ROOT/.venv-img2mesh/bin/python"
TRIPOSR="$ROOT/tools/TripoSR"
MODELS_DIR="$ROOT/frontend/assets/models"
mkdir -p "$MODELS_DIR"

export HF_HUB_OFFLINE=1           # 权重已缓存，避免联网检查卡死
export TOKENIZERS_PARALLELISM=false

NAMES="tiger crane goose rocks bamboo plum"
FAILED=""
for name in $NAMES; do
  src="$ROOT/tools/crops/$name.png"
  out="$ROOT/tools/out/$name"
  glb="$out/0/mesh.glb"
  dst="$MODELS_DIR/$name.glb"
  if [ -s "$dst" ]; then
    echo "[$(date +%H:%M:%S)] SKIP ${name} (already exists)"
    continue
  fi
  echo "[$(date +%H:%M:%S)] === ${name} start ==="
  rm -rf "$out"; mkdir -p "$out"
  ( cd "$TRIPOSR" && "$PY" run.py "$src" \
      --device cpu --model-save-format glb \
      --output-dir "$out" ) > "$out/run.log" 2>&1
  if [ -s "$glb" ]; then
    cp "$glb" "$dst"
    echo "[$(date +%H:%M:%S)] OK   ${name} -> $dst ($(du -h "$dst" | cut -f1))"
  else
    FAILED="$FAILED $name"
    echo "[$(date +%H:%M:%S)] FAIL ${name} (log: $out/run.log)"
  fi
done

echo "---- summary ----"
ls -lh "$MODELS_DIR"
if [ -n "$FAILED" ]; then
  echo "FAILED:${FAILED}"
  exit 1
fi
echo "ALL OK"
