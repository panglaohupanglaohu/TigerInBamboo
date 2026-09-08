#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""G02：原作 .blend → Godot GLB 的导出通路。

用法（必须在装有 Blender 的机器上跑；本脚本自己**不**依赖 Blender，
它负责调度，真正的导出在 Blender 的后台进程里）：

    # 先跑代表资产，验证通路
    python3 tools/originals/export_godot_originals.py --representative
    # 通路没问题再全量
    python3 tools/originals/export_godot_originals.py --all
    # 单项
    python3 tools/originals/export_godot_originals.py bookshop moebiusTiger

产物：
    godot/assets/originals/<id>.glb
    godot/assets/originals/export-report.json     每项成功/部分/失败 + 原因

---- 三条硬规则（PROJECT_HANDOFF / AGENTS.md）----

1. **导出源是原作存档**，由 assets/models/godot-import-map.json 指定。
   本脚本不自己挑源、不调用任何通用模型生成器——那正是被否掉的方向。
2. **不碰 godot/assets/*.glb**（前期 10 项实验资产）。新资源一律落在
   godot/assets/originals/ 这一层。脚本会在写之前断言这一点。
3. **不覆盖用户的编辑**：目标已存在时跳过，除非显式 --force。
   Blender 前台可能有未保存内容，本脚本只读 .blend，从不保存回去。

---- 导出边界 ----
glTF 支持线与点，本脚本显式启用 loose edges / vertices。
Three.js 着色器与程序动画不随网格自动迁移；所有输出先标 partial。
原作隐藏的描边保持隐藏，不导成重叠的不透明表面。
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]                 # …/TigerMessenger
MAP_JSON = ROOT / "assets/models/godot-import-map.json"
OUT_DIR = ROOT / "godot/assets/originals"
REPORT = OUT_DIR / "export-report.json"

BLENDER_CANDIDATES = [
    os.environ.get("BLENDER", ""),
    "/Applications/Blender.app/Contents/MacOS/Blender",
    shutil.which("blender") or "",
]

# 在 Blender 里跑的那一段。用 -- 之后的参数收 blend 路径与输出路径。
BLENDER_SCRIPT = ROOT / "tools/originals/export_godot_scene.py"


def find_blender():
    for c in BLENDER_CANDIDATES:
        if c and Path(c).exists():
            return c
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="资产 id；留空配合 --all / --representative")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--representative", action="store_true")
    ap.add_argument("--force", action="store_true", help="覆盖已存在的产物")
    ap.add_argument("--dry-run", action="store_true", help="只列要做什么，不调 Blender")
    args = ap.parse_args()

    if not MAP_JSON.exists():
        print("先跑 tools/originals/build_godot_import_map.py 生成导入映射", file=sys.stderr)
        return 2
    doc = json.loads(MAP_JSON.read_text(encoding="utf-8"))
    rows = doc["assets"]

    if args.all:
        picked = rows
    elif args.representative:
        picked = [r for r in rows if r["representative"]]
    elif args.ids:
        want = set(args.ids)
        picked = [r for r in rows if r["id"] in want]
        missing = want - {r["id"] for r in picked}
        if missing:
            print(f"清单里没有这些 id：{', '.join(sorted(missing))}", file=sys.stderr)
            return 2
    else:
        ap.print_help()
        return 2

    # 规则 2：断言输出目录不是旧实验资产那一层
    assert OUT_DIR.name == "originals" and OUT_DIR.parent.name == "assets", OUT_DIR


    blender = find_blender()
    if args.dry_run:
        print(f"Blender: {blender or '未找到'}")
        for r in picked:
            print(f"  {r['id']:<22} {r['exportSource']['path']}  →  {r['godot']['res']}")
        print(f"共 {len(picked)} 项（dry-run，未导出）")
        return 0
    if not blender:
        print("找不到 Blender。设 BLENDER=/path/to/Blender 或安装到 "
              "/Applications/Blender.app", file=sys.stderr)
        return 3

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    logs = ROOT / "artifacts/godot-export"
    logs.mkdir(parents=True, exist_ok=True)

    previous = json.loads(REPORT.read_text()).get("results", []) if REPORT.exists() else []
    results = {r["id"]: r for r in previous}
    def checkpoint():
        REPORT.write_text(json.dumps({"generatedBy": "tools/originals/export_godot_originals.py", "results": list(results.values())}, ensure_ascii=False, indent=2))
    for r in picked:
        aid = r["id"]
        src = ROOT / r["exportSource"]["path"]
        dst = ROOT / r["godot"]["file"]
        meta = logs / f"{aid}.counts.json"
        assert dst.resolve().parent == OUT_DIR.resolve(), f"Unsafe destination: {dst}"
        if dst.exists() and not args.force:
            print(f"EXPORT {aid} existing; preserved", flush=True)
            continue
        temp = logs / f"{aid}.glb"
        temp.unlink(missing_ok=True)
        row = {"id": aid, "status": "failed", "source": r["exportSource"]["path"],
               "target": r["godot"]["file"], "res": r["godot"]["res"]}
        try:
            p = subprocess.run([blender, "--background", "--python-exit-code", "1",
                "--python", str(BLENDER_SCRIPT), "--", str(src), str(temp), str(meta)],
                capture_output=True, text=True, timeout=900)
            (logs / f"{aid}.log").write_text(p.stdout + p.stderr)
            if p.returncode != 0 or not temp.exists():
                raise RuntimeError((p.stdout + p.stderr)[-1500:])
            row["blenderCounts"] = json.loads(meta.read_text())
            dst.parent.mkdir(parents=True, exist_ok=True)
            temp.replace(dst)
            row.update(status="partial", bytes=dst.stat().st_size,
                sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),
                outputSha256=hashlib.sha256(dst.read_bytes()).hexdigest(),
                lost=["Three.js 描边着色器、程序动画与交互尚未迁移；材质视觉待验收"])
        except Exception as ex:
            row["reason"] = str(ex)
        results[aid] = row
        checkpoint()
        print(f"EXPORT {aid:<22} {row['status']}", flush=True)
    values = list(results.values())
    summary = {"generatedBy": "tools/originals/export_godot_originals.py", "blender": blender,
        "counts": {k: sum(r["status"] == k for r in values) for k in ["ok", "partial", "failed"]},
        "results": values}
    REPORT.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary["counts"]))

    return 0 if summary["counts"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
