#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""G01：建立「原作 ID → 源快照 → Blender 工作文件 → Godot 资源路径」的导入清单。

依据 docs/PROJECT_HANDOFF.md 的第一批任务第 2、3 条，以及 AGENTS.md 的基准要求。

**这个脚本不需要 Blender**，只读 inventory.json 与磁盘上的实际文件，
所以在任何环境都能跑，产出的每一条都能追溯到一个真实存在的文件。

---- 导出源怎么选（这是这一步唯一的设计判断，写在这里以便复核）----

每项原作在磁盘上有三份 .blend：

  A. `originals/blender-r3/<id>.blend`
     从用户的运行时几何导入的**原作存档**。72 项都有，且都带
     `import-report.json`（顶点误差、实例矩阵误差、图元统计）。
  B. `optimized/<id>.blend`
     完整优化 + **渲染对照通过** + 已回接运行时的版本。
     目前**只有 bookshop 和 moebiusTiger 两项**（inventory 里
     runtimeReplacement=true 的就这两个）。
  C. `optimized/batch-candidates-v2/<id>.blend`
     72 项重复顶点整理的**候选**，inventory 自己标着
     "candidate only; source review, visual parity and runtime integration pending"。

选 A 作为默认导出源。理由：AGENTS.md 写明「用户原有模型与代码生成规则是唯一
美术基准」，而这一批的目标是**让用户在 Godot 里看到自己的原作**——
候选（C）连视觉对照都还没做，拿它去做「原作检视场景」是自相矛盾的。
B 虽然对照过，但它是为 Web 运行时优化的产物；检视场景要回答的是
「Godot 里的是不是原作」，用 A 最直接。

C 和 B 的路径仍然逐项记录在 `alternates` 里并带上各自的状态，
将来要切换导出源时是一个字段的事，不必重新考古。
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # …/TigerMessenger
INVENTORY = ROOT / "assets/models/inventory.json"
OUT_JSON = ROOT / "assets/models/godot-import-map.json"
OUT_MD = ROOT / "docs/GODOT_IMPORT_MAP.md"

# Godot 工程根：res:// 指向 godot/，外层 assets 不会自动进工程
GODOT_DIR = ROOT / "godot"
# 新的原作资源单独放一层，**不碰**现有的 10 个旧实验 GLB（godot/assets/*.glb）
TARGET_SUBDIR = "assets/originals"

# 代表资产：先打通这几项再批量（PROJECT_HANDOFF 第一批第 3 条点名的）
REPRESENTATIVE = ["bookshop", "moebiusTiger", "classicAliFox", "fox",
                  "fisherBoat", "saihoji", "citadelWatchtower"]


def rel(p: Path) -> str:
    """相对 TigerMessenger/ 的路径，写进清单里好核对"""
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def probe(path: Path):
    """文件在不在、多大。清单里的每一条都必须能对上一个真实文件"""
    if path.exists():
        return {"path": rel(path), "exists": True, "bytes": path.stat().st_size}
    return {"path": rel(path), "exists": False, "bytes": 0}


def main():
    if not INVENTORY.exists():
        print(f"找不到 {rel(INVENTORY)}", file=sys.stderr)
        return 2
    inv = json.loads(INVENTORY.read_text(encoding="utf-8"))
    catalog = inv["catalog"]

    # 现有的旧实验 GLB：**不能被覆盖**，也不算这一批的成果
    legacy = sorted(p.name for p in (GODOT_DIR / "assets").glob("*.glb"))

    rows = []
    for e in catalog:
        aid = e["id"]
        original = ROOT / "assets/models" / e["blend"]
        snapshot = ROOT / "assets/models" / e["sourceSnapshot"]
        cand = e.get("batchCandidate") or {}
        cand_blend = ROOT / "assets/models" / cand["blend"] if cand.get("blend") else None
        opt = e.get("optimization")
        opt_blend = None
        if isinstance(opt, dict) and opt.get("result"):
            # optimization.result 是相对仓库根写的（assets/models/optimized/x.blend）
            opt_blend = ROOT / opt["result"]

        ir = e.get("importReport") or {}
        prims = ir.get("primitiveNodes") or {}
        # 线段/点图元是 Godot 导入最容易丢的东西，逐项先标出来
        line_like = sum(int(prims.get(k, 0)) for k in
                        ("Line", "LineSegments", "LineLoop", "Points"))

        gaps = ["Godot 材质、描边、程序动画与交互仍需适配和视觉验收"]
        if line_like:
            gaps.append(f"{line_like} 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）")
        if ir.get("expandedInstances"):
            gaps.append(f"{ir['expandedInstances']} 个实例被展开（层级与实例关系需复核）")
        for w in (ir.get("warnings") or []):
            gaps.append(f"导入告警：{w}")
        if not isinstance(opt, dict):
            gaps.append("尚无优化/渲染对照记录（optimization=%s）" % opt)

        target = GODOT_DIR / TARGET_SUBDIR / f"{aid}.glb"
        rows.append({
            "id": aid,
            "label": e.get("label"),
            "representative": aid in REPRESENTATIVE,
            # ---- 来源链：快照 → 原作 blend ----
            "sourceSnapshot": probe(snapshot),
            "exportSource": {
                **probe(original),
                "why": "原作存档（AGENTS.md：用户原作是唯一美术基准）",
            },
            "alternates": {
                "batchCandidate": ({**probe(cand_blend),
                                    "status": cand.get("status")}
                                   if cand_blend else None),
                "optimizedRuntime": ({**probe(opt_blend),
                                      "renderParity": opt.get("renderParity"),
                                      "runtimeIntegrated": opt.get("runtimeIntegrated")}
                                     if opt_blend else None),
            },
            # ---- 去处 ----
            "godot": {
                "file": rel(target),
                "res": f"res://{TARGET_SUBDIR}/{aid}.glb",
                "exists": target.exists(),
            },
            # ---- 原作规模与已知缺口 ----
            "scale": {
                "nodes": ir.get("nodes"),
                "meshDatablocks": ir.get("meshDatablocks"),
                "verticesIncludingOutline": ir.get("verticesIncludingOutline"),
            },
            "knownGaps": gaps,
            # 文件存在不代表视觉与运行时验收完成
            "status": "exported; validation pending" if target.exists() else "mapped; not exported",
        })

    doc = {
        "version": 1,
        "generatedBy": "tools/originals/build_godot_import_map.py",
        "note": (
            "G01 导入映射。只描述**映射关系**，不代表已导出或已导入。"
            "导出请用 tools/originals/export_godot_originals.py（需要 Blender）。"
        ),
        "godotProjectRoot": rel(GODOT_DIR),
        "targetSubdir": TARGET_SUBDIR,
        "legacyGlbKeepOut": {
            "files": legacy,
            "rule": "godot/assets/*.glb 是前期 10 项实验资产，本批不覆盖、不计入成果",
        },
        "exportSourceRule": (
            "默认 originals/blender-r3/<id>.blend（原作存档）。"
            "batch-candidates-v2 视觉对照未做，不作默认源；"
            "optimized/<id>.blend 只有 bookshop 与 moebiusTiger 有，且是 Web 运行时优化产物。"
        ),
        "counts": {
            "catalog": len(rows),
            "exportSourceExists": sum(1 for r in rows if r["exportSource"]["exists"]),
            "withKnownGaps": sum(1 for r in rows if r["knownGaps"]),
            "representatives": sum(1 for r in rows if r["representative"]),
            "alreadyInGodot": sum(1 for r in rows if r["godot"]["exists"]),
        },
        "assets": rows,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    # 再往 Godot 工程里放一份：res:// 只看得见 godot/ 底下的东西，
    # 外层 assets/ 不会自动进工程（PROJECT_HANDOFF 第一批第 3 条点名的坑）。
    # asset_review.tscn 读的就是这一份。
    godot_copy = GODOT_DIR / TARGET_SUBDIR / "import-map.json"
    godot_copy.parent.mkdir(parents=True, exist_ok=True)
    godot_copy.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---- 人读版 ----
    md = []
    md.append("# Godot 原作导入映射（G01）\n")
    md.append(f"由 `tools/originals/build_godot_import_map.py` 生成，"
              f"数据源 `assets/models/inventory.json` + 磁盘实际文件。\n")
    md.append("**这份表只描述映射关系。**「已映射」不等于已导出，更不等于已在 Godot 里看到。"
              "导出要在装有 Blender 的机器上跑 "
              "`tools/originals/export_godot_originals.py`。\n")
    md.append("## 规则\n")
    md.append(f"- Godot 工程根 `{rel(GODOT_DIR)}`，`res://` 指向它；"
              f"原作 GLB 落在 `{TARGET_SUBDIR}/`。\n")
    md.append(f"- **不碰** `godot/assets/` 下现有的 {len(legacy)} 个旧实验 GLB"
              f"（{', '.join(legacy)}）——那是前期偏离方向的实验，不计入本批成果。\n")
    md.append(f"- 导出源：{doc['exportSourceRule']}\n")
    md.append("\n## 统计\n")
    for k, v in doc["counts"].items():
        md.append(f"- {k}: {v}\n")
    md.append("\n## 代表资产（先打通这几项）\n\n")
    md.append("| id | 名称 | 导出源 | 节点 | 顶点 | 已知缺口 |\n|---|---|---|---|---|---|\n")
    for r in rows:
        if not r["representative"]:
            continue
        md.append(f"| `{r['id']}` | {r['label']} | "
                  f"{'✅' if r['exportSource']['exists'] else '❌ 缺文件'} | "
                  f"{r['scale']['nodes']} | {r['scale']['verticesIncludingOutline']} | "
                  f"{'；'.join(r['knownGaps']) or '—'} |\n")
    md.append("\n## 全部 72 项\n\n")
    md.append("| id | 名称 | 源存在 | 目标 res:// | 已知缺口 |\n|---|---|---|---|---|\n")
    for r in rows:
        md.append(f"| `{r['id']}` | {r['label']} | "
                  f"{'✅' if r['exportSource']['exists'] else '❌'} | "
                  f"`{r['godot']['res']}` | "
                  f"{'；'.join(r['knownGaps']) or '—'} |\n")
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("".join(md), encoding="utf-8")

    print(f"写出 {rel(OUT_JSON)}")
    print(f"写出 {rel(godot_copy)}（Godot 工程内的副本）")
    print(f"写出 {rel(OUT_MD)}")
    for k, v in doc["counts"].items():
        print(f"  {k}: {v}")
    missing = [r["id"] for r in rows if not r["exportSource"]["exists"]]
    if missing:
        print(f"  ⚠️ 导出源缺文件: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
