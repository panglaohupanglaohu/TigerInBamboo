/**
 * build.js — 建筑类能力（纯数据）。
 */
import { top, topIsBuilt, setVoxel, editable } from './ops.js';

/* ------------------------------------------------------------------ 灯塔 */
export const lighthouse = {
  meta: {
    id: 'build.lighthouse', layer: 'building', kind: '建筑', name: '海边灯塔', kind2: 'geometry',
    summary: '把一座海边、四周较矮的单格楼加高成 ≥5 层的细塔；灯塔层（灯室、栏杆、红尖顶、夜间旋转光束）按"海边、≥5 层、邻格都矮 2 层以上"的规则自动识别。',
    sources: ['1331905048801144836'],
    targets: '临水、一格粗、邻格都不高的建筑',
    keywords: ['灯塔', '塔', '海边', '夜', '光束', 'lighthouse', 'tower'],
    params: { count: { label: '几座', type: 'int', min: 1, max: 3, default: 1 }, height: { label: '塔高（层）', type: 'int', min: 5, max: 10, default: 6 } },
    layer3d: 'lighthouse',
  },
  match(w, ctx = {}, params = {}) {
    const cells = w.grid.cells, H = params.height ?? 6, out = [];
    for (const c of cells) {
      if (!topIsBuilt(w, c.id) || !editable(ctx, c.id)) continue;
      const t = top(w, c.id);
      let sea = false, maxN = 0;
      for (const id of c.edgeNeighbors) { const h = id >= 0 ? top(w, id) : 0; if (h === 0) sea = true; maxN = Math.max(maxN, h); }
      const target = Math.max(H, t, maxN + 2);
      if (!sea || target > 11) continue;
      out.push({ id: 'lighthouse:' + c.id, cells: [c.id], focus: c.id, height: target, score: (t >= 5 ? 10 : 0) + (c.edgeNeighbors.filter((id) => id < 0 || top(w, id) === 0).length) - Math.max(0, target - t) * 0.2,
        reason: t >= target ? `楼 ${c.id} 已 ${t} 层、临水、邻格都矮 —— 直接是灯塔` : `楼 ${c.id}（${t} 层）临水、邻格最高 ${maxN} 层，加高到 ${target} 层即成灯塔` });
    }
    return out;
  },
  run(w, { targets, ctx = {} }) {
    const applied = [];
    for (const t of targets) {
      const id = t.cells[0];
      if (!editable(ctx, id) || !topIsBuilt(w, id)) continue;
      for (let lv = top(w, id) + 1; lv <= t.height; lv++) setVoxel(w, id, lv, true);
      applied.push(t.id);
    }
    return { applied };
  },
};
