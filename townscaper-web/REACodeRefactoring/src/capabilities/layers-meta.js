/**
 * layers-meta.js — "显示层"能力的描述与匹配（纯数据，Worker 可用）。
 * 显示层不改体素：在场景里加一层会动的东西（灯室光束、体积浅水、烟）。真正的 three.js 实现在 layers.js（主线程）。
 */
import { top, topIsBuilt } from './ops.js';

const coast = (w) => w.grid.cells.filter((c) => top(w, c.id) > 0 && c.edgeNeighbors.some((id) => id < 0 || top(w, id) === 0));

export const LAYER_CAPS = [
  {
    meta: { id: 'water.volume', layer: 'water', kind: '水', name: '体积浅水（SDF 叠层）', kind2: 'layer', layer3d: 'watervol',
      summary: '海岸距离场 + 6 张平面叠在水面上，岸边一圈圈会流动的浅滩等深线。不改体素。',
      sources: ['1758251637280268481'], targets: '整条岸线', keywords: ['水', '浅水', '岸', '等深线', '水面', '体积', 'water', 'shore'], params: {} },
    match(w) { const c = coast(w); return c.length ? [{ id: 'watervol:all', cells: c.map((x) => x.id), focus: c[0].id, score: c.length, reason: `岸线 ${c.length} 格，可加浅滩等深线` }] : []; },
  },
  {
    meta: { id: 'build.lighthouse-light', layer: 'building', kind: '建筑', name: '灯塔灯室与光束', kind2: 'layer', layer3d: 'lighthouse',
      summary: '自动识别"海边、≥5 层、邻格都矮 2 层以上"的一格粗塔，加灯室、栏杆、红尖顶，夜里光束绕塔转。不改体素。',
      sources: ['1331905048801144836'], targets: '已有的海边细高塔', keywords: ['灯塔', '光束', '夜', 'lighthouse'], params: {} },
    match(w) {
      const out = [];
      for (const c of w.grid.cells) {
        const t = top(w, c.id);
        if (t < 5 || !topIsBuilt(w, c.id)) continue;
        let slim = true, sea = false;
        for (const id of c.edgeNeighbors) { const h = id >= 0 ? top(w, id) : 0; if (h > t - 2) slim = false; if (h === 0) sea = true; }
        if (slim && sea) out.push({ id: 'lantern:' + c.id, cells: [c.id], focus: c.id, score: t, reason: `塔 ${c.id}（${t} 层）临水且细高，加灯室` });
      }
      return out;
    },
  },
  {
    meta: { id: 'effects.smoke', layer: 'effects', kind: '烟', name: '特效层 · 烟（烟囱炊烟）', kind2: 'layer', layer3d: 'smoke',
      summary: '在建筑生成的烟囱口放烟：两遍画（黑描边 + 浅色），沿流向滚动噪声，越往上越模糊。不改体素。',
      sources: ['1015140880666300416', '1015142746372366336', '1015149712469524480', '1015151731804721152'], targets: '有屋顶的建筑', keywords: ['烟', '炊烟', '烟囱', '生活', 'smoke'], params: {} },
    match(w) { const r = w.grid.cells.filter((c) => topIsBuilt(w, c.id)); return r.length ? [{ id: 'smoke:all', cells: r.map((c) => c.id), focus: r[0].id, score: r.length, reason: `${r.length} 格建筑顶，烟囱口由建筑生成时决定` }] : []; },
  },
];
