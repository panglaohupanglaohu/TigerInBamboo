#!/usr/bin/env python3
"""jev-asset-scout.py — 使用通用 JEV（tools/jev/ask.py，单项缓存）对两类对象做低成本批量研判：
  1. REACode 中未完全重构的 JS 候选模块 → 判别对球系统 / 场景系统 / 物件系统 / 跨系统的价值；
  2. 本系统真实资产表（assets/models/inventory.json）7 大类 → 判别最快的能力补充策略。
随后调用 build-asset-radar.mjs 生成 catalog/asset-capability-radar.json。

在仓库根运行：
  NODE_PATH_BIN=$NODE python3 TigerMessenger/tools/refactor/jev-asset-scout.py
"""
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TM = ROOT / 'TigerMessenger'
sys.path.insert(0, str(TM / 'tools/jev'))
from ask import ask

OUT_DIR = TM / 'artifacts/pipeline/jev'
OUT_DIR.mkdir(parents=True, exist_ok=True)

inventory = json.loads((TM / 'assets/models/inventory.json').read_text(encoding='utf-8'))
catalog = json.loads((TM / 'src/scene-authoring/catalog/system-catalog.json').read_text(encoding='utf-8'))
maturity = json.loads((TM / 'src/scene-authoring/catalog/capability-maturity.json').read_text(encoding='utf-8'))

# 1) 挑选高信号 REACode JS 候选（最多 24 个，单项紧凑文字，省 token）
js_rows = [
    a for a in catalog.get('alignment', [])
    if (a.get('source', '').endswith('.js') or a.get('source', '').endswith('.mjs'))
    and (a.get('status') == 'missing-target' or len(a.get('unmatchedExports') or []) > 0)
]
# 优先覆盖有代表性导出与三系统关键词的候选
js_rows.sort(key=lambda a: (
    -(1 if a.get('status') == 'missing-target' else 0),
    -len(a.get('unmatchedExports') or []),
    a.get('source', '')
))
selected_js = js_rows[:24]

disc_items = {}
for a in selected_js:
    disc_items[a['source']] = {
        'file': a['source'],
        'status': a.get('status'),
        'unmatched_exports': (a.get('unmatchedExports') or a.get('originalExports') or [])[:8],
        'targets': (a.get('targets') or [])[:2],
        'gap': (a.get('gap') or '')[:140],
    }

disc_criteria = {
    'planet': 'Best refactored for the Planet System (sphere grids, geodesic tessellation, continents, orbital oceans/clouds, global climate).',
    'scene': 'Best refactored for the Scene System (terrain cliffs/mesas/rivers, shorelines, WFC building layouts, navigation, weather/foliage).',
    'object': 'Best refactored for the Object System (mesh cage deformation, prop holes/frames, mesh QA check, impostors/billboards, characters/birds/vehicles).',
    'multi': 'Foundational rendering/lighting/shadow/material/atlas kernel that strongly accelerates multiple game pipeline tiers.',
    'skip': 'Pure demo glue, obsolete test helper, or trivial utility not worth fast-track refactoring into the game pipeline.',
}

disc_res = ask(
    task='Judge which game pipeline tier benefits most from fast-track refactoring this unrefactored REACode prototype module into REACodeRefactoring.',
    items=disc_items,
    criteria=disc_criteria,
    qtype='choice',
    instructions='Classify by technical value to Planet, Scene, Object, Multi-tier, or Skip.',
    threshold=0.80,
    batch=6,
)
disc_path = OUT_DIR / 'asset-scout-discovery.json'
disc_path.write_text(json.dumps(disc_res, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# 2) 按资产表大类做策略判断
cat_groups = {}
for s in inventory.get('sources', []):
    c = s.get('category') or '未分类'
    g = cat_groups.setdefault(c, {'count': 0, 'samples': [], 'geos': set()})
    g['count'] += 1
    if len(g['samples']) < 6:
        g['samples'].append(s.get('id', '').replace('assets__', ''))
    for geo in s.get('geometry') or []:
        g['geos'].add(geo)

cat_items = {}
for c, g in cat_groups.items():
    cat_items[c] = {
        'category': c,
        'asset_count': g['count'],
        'sample_assets': g['samples'],
        'geometry_types': sorted(g['geos'])[:8],
        'total_exec_caps_in_system': len(maturity.get('rows') or []),
    }

cat_criteria = {
    'refactor-reacode': 'High payoff from fast-track refactoring existing REACode algorithms (terrain, roofs, cages, lighting, nav, water, impostors) into REACodeRefactoring.',
    'wrap-existing-refactored': 'REACodeRefactoring already has strong modules; fastest gain is wrapping them as executable pipeline capabilities with contracts.',
    'synthesize-new': 'Need fresh domain-specific capability (e.g. vehicle/character/custom asset rigging or layout constraints) not covered by REACode.',
    'sufficient': 'Current executable capability coverage is already adequate for this asset category.',
}

cat_res = ask(
    task='Choose the fastest capability-library supplement strategy for this game asset category.',
    items=cat_items,
    criteria=cat_criteria,
    qtype='choice',
    instructions='Pick the highest-leverage next strategy based on asset count and geometry profile.',
    threshold=0.75,
    batch=7,
)
cat_path = OUT_DIR / 'asset-scout-categories.json'
cat_path.write_text(json.dumps(cat_res, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('JEV discovery usage:', json.dumps(disc_res['usage'], ensure_ascii=False))
print('JEV categories usage:', json.dumps(cat_res['usage'], ensure_ascii=False))

node_bin = os.environ.get('NODE_PATH_BIN') or '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
subprocess.run(
    [node_bin, 'tools/refactor/build-asset-radar.mjs', '--jev-discovery', str(disc_path), '--jev-categories', str(cat_path)],
    cwd=str(TM),
    check=True,
)
