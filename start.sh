#!/bin/bash
# TigerInBamboo 一键重启：杀掉占用端口的旧进程，重启后端 + 两个 worker
# 端口：8931 主后端(前端静态页同服) 7863 识别/深度/特征 7862 图生3D
set -u
cd "$(dirname "$0")"
ROOT="$PWD"
OUT="$ROOT/tools/out"
mkdir -p "$OUT"

# 本机统一 LLM 配置。密钥只存在被 git 忽略的 .env.local 或进程环境中。
if [ -f "$ROOT/.env.local" ]; then
  set -a
  . "$ROOT/.env.local"
  set +a
fi
export LLM_BASE_URL="${LLM_BASE_URL:-https://models.sjtu.edu.cn/api/v1}"
export LLM_MODEL="${LLM_MODEL:-glm-5.1}"

PORTS="8931 7862 7863 7864"

echo "== 清理旧进程 =="
# 先按启动命令的模式杀（覆盖 --reload 产生的父子进程树）
pkill -f "uvicorn backend.main:app" 2>/dev/null || true
pkill -f "trellis2_worker" 2>/dev/null || true
pkill -f "scene_lift_worker" 2>/dev/null || true
pkill -f "sculpt_worker" 2>/dev/null || true
# 再按端口杀残留
for port in $PORTS; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
done

# 等端口真正释放（--reload 子进程可能延迟松开 socket），最多 20 秒/端口
for port in $PORTS; do
  for i in $(seq 1 20); do
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -z "$pids" ]; then
      break
    fi
    if [ "$i" -gt 6 ]; then
      kill -9 $pids 2>/dev/null || true
    fi
    sleep 1
  done
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  :$port 仍被 $pids 占用，启动可能失败"
  else
    echo "  :$port 已释放"
  fi
done

PY_MAIN="$ROOT/.venv/bin/python"
PY_IMG="$ROOT/.venv-img2mesh/bin/python"
export HF_HUB_OFFLINE=1
export TOKENIZERS_PARALLELISM=false

echo "== 启动服务 =="
nohup "$PY_MAIN" -m uvicorn backend.main:app --host 127.0.0.1 --port 8931 --reload \
  > "$OUT/backend.log" 2>&1 &
PID_BACKEND=$!
echo "  后端      :8931  pid $PID_BACKEND  日志 tools/out/backend.log"

# 图生 3D：默认 MC 分辨率 192；可用 TRIPOSR_MC_RES 覆盖
export TRIPOSR_MC_RES="${TRIPOSR_MC_RES:-192}"
export TRIPOSR_DEVICE="${TRIPOSR_DEVICE:-auto}"
nohup "$PY_IMG" -m uvicorn tools.trellis2_worker:app --host 127.0.0.1 --port 7862 \
  > "$OUT/trellis2_worker.log" 2>&1 &
PID_TRELLIS=$!
echo "  图生3D    :7862  pid $PID_TRELLIS  日志 tools/out/trellis2_worker.log"

# Grounded SAM 2：有 checkpoint 则用全量分割，否则明确警告并降级 DINO+GrabCut
export GROUNDED_SAM2_ROOT="${GROUNDED_SAM2_ROOT:-$HOME/.cache/tigerinbamboo/Grounded-SAM-2}"
export SAM2_CHECKPOINT="${SAM2_CHECKPOINT:-$GROUNDED_SAM2_ROOT/checkpoints/sam2.1_hiera_large.pt}"
export SAM2_CONFIG="${SAM2_CONFIG:-configs/sam2.1/sam2.1_hiera_l.yaml}"
export GROUNDING_MODEL="${GROUNDING_MODEL:-IDEA-Research/grounding-dino-base}"
if [ ! -f "$SAM2_CHECKPOINT" ]; then
  echo "  [warn] SAM2 checkpoint 缺失：$SAM2_CHECKPOINT"
  echo "  [warn] 分割将降级为 grounding-dino + GrabCut（可设置 GROUNDED_SAM2_ROOT / SAM2_CHECKPOINT）"
fi
nohup "$PY_IMG" -m uvicorn tools.scene_lift_worker:app --host 127.0.0.1 --port 7863 \
  > "$OUT/scene_lift_worker.log" 2>&1 &
PID_SCENE=$!
echo "  识别/深度 :7863  pid $PID_SCENE  日志 tools/out/scene_lift_worker.log  grounding=$GROUNDING_MODEL"

# 塑形 SculptSpec（程序化 Three.js 主路径；可用主 venv）
nohup "$PY_MAIN" -m uvicorn tools.sculpt_worker:app --host 127.0.0.1 --port 7864 \
  > "$OUT/sculpt_worker.log" 2>&1 &
PID_SCULPT=$!
echo "  塑形      :7864  pid $PID_SCULPT  日志 tools/out/sculpt_worker.log"

echo "== 等待就绪 =="
wait_health() {
  local name="$1" url="$2" log="$3" i
  for i in $(seq 1 40); do
    if curl -s -m 2 "$url" | grep -q '"status":"ok"'; then
      echo "  $name 就绪"
      return 0
    fi
    sleep 1
  done
  echo "  $name 未就绪，日志尾部："
  tail -5 "$log" | sed 's/^/    /'
  return 1
}
wait_health "后端      :8931" "http://127.0.0.1:8931/api/health" "$OUT/backend.log"
wait_health "图生3D    :7862" "http://127.0.0.1:7862/health" "$OUT/trellis2_worker.log"
wait_health "识别/深度 :7863" "http://127.0.0.1:7863/health" "$OUT/scene_lift_worker.log"
wait_health "塑形      :7864" "http://127.0.0.1:7864/health" "$OUT/sculpt_worker.log"

echo ""
echo "打开 http://localhost:8931/wall-workspace.html"
echo ""
echo "== 日志输出中（Ctrl+C 停止全部服务）=="

cleanup() {
  echo ""
  echo "== 停止服务 =="
  kill "$PID_BACKEND" "$PID_TRELLIS" "$PID_SCENE" "$PID_SCULPT" 2>/dev/null || true
  sleep 1
  kill -9 "$PID_BACKEND" "$PID_TRELLIS" "$PID_SCENE" "$PID_SCULPT" 2>/dev/null || true
  echo "  已全部停止"
  exit 0
}
trap cleanup INT TERM

# 常驻前台，持续输出各服务日志；tail 放后台 + wait，保证 Ctrl+C 能立即触发清理
tail -F "$OUT/backend.log" "$OUT/trellis2_worker.log" "$OUT/scene_lift_worker.log" "$OUT/sculpt_worker.log" &
TAIL_PID=$!
wait $TAIL_PID
