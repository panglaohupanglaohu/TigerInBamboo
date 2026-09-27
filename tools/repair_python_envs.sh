#!/bin/bash
# Repair copied virtual environments without deleting their packages or backups.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd -P)"
UV_BIN="${UV_BIN:-$PROJECT_ROOT/.venv-bootstrap/bin/uv}"
if [ ! -x "$UV_BIN" ]; then
  python3 -m venv "$PROJECT_ROOT/.venv-bootstrap"
  "$PROJECT_ROOT/.venv-bootstrap/bin/python" -m pip install uv
fi
"$UV_BIN" python install 3.11
repair_env() {
  local env_dir="$1"
  # A matching 3.11 environment can retain copied wheels. Other ABIs get a backup.
  if [ -d "$env_dir" ] && [ ! -d "$env_dir/lib/python3.11/site-packages" ]; then
    local backup="${env_dir}-copied-$(date +%Y%m%d-%H%M%S)"
    mv "$env_dir" "$backup"
    echo "原环境已保留：$backup"
  fi
  "$UV_BIN" venv --allow-existing --python 3.11 "$env_dir"
}
repair_env "$PROJECT_ROOT/.venv"
repair_env "$PROJECT_ROOT/.venv-img2mesh"
"$UV_BIN" pip install --python "$PROJECT_ROOT/.venv/bin/python" -r "$PROJECT_ROOT/backend/requirements.txt"
"$UV_BIN" pip install --python "$PROJECT_ROOT/.venv-img2mesh/bin/python" 'fastapi>=0.110' 'uvicorn>=0.29' pillow
"$PROJECT_ROOT/.venv/bin/python" -c 'import backend.main, tools.sculpt_worker; print("后端与塑形入口导入通过")'
"$PROJECT_ROOT/.venv-img2mesh/bin/python" -c 'import tools.trellis2_worker, tools.scene_lift_worker; print("图生3D与深度入口导入通过；模型权重另行检查")'
echo '环境修复完成。运行 ./start.sh；此脚本没有下载推理模型权重。'
