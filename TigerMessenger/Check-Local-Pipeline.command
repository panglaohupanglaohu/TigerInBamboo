#!/bin/zsh
set -u
cd -- "${0:A:h}"
python3 tools/pipeline/local/runner.py \
  --catalog tools/pipeline/local/jobs.blender.example.json \
  --catalog tools/pipeline/local/jobs.godot.example.json \
  --catalog tools/pipeline/local/jobs.web.example.json --run
job_status=$?
python3 tools/pipeline/local/status.py \
  --config tools/pipeline/local/config.m5max64.example.json \
  --output artifacts/pipeline/local-runs/status.html
open artifacts/pipeline/local-runs/status.html
exit $job_status
