/**
 * terrain.js — 地形类能力（纯数据，可在 Worker 里跑）。
 * 每个能力：meta（描述 / 来源视频 / 参数）+ match(world, ctx)（找出能作用的物件，并说理由）
 *          + run(world, { targets, params, ctx })（在副本上执行，返回改了什么）。
 *
 * 逻辑来自 src/terrain/features.js、src/badnorth/island.js，这里拆成"先匹配、再执行"。
 */
import { top, ground, isSolid, isRock, topIsBuilt, isCave, setVoxel, straightNext, editable, pickSpread } from './ops.js';

/* ------------------------------------------------------------------ 石拱 / 天桥 */
export const arch = {
  meta: {
    id: 'terrain.arch', layer: 'terrain', kind: '地形', name: '石拱 / 天桥', kind2: 'geometry',
    summary: '两根够高的柱体（岩柱或楼）之间隔 1–3 格低处时，在两者较矮那一层架一道拱，下面留空能穿行。岩柱间架岩拱，楼之间架建筑天桥。',
    sources: ['1670794261669769217', '1584623053061099520', '1189908238566903808'],
    targets: '相隔 1–3 格、中间更低的两根柱体',
    keywords: ['拱', '石拱', '天桥', '桥', '连接', '跨', 'arch', 'bridge', '岩', '洞'],
    params: { count: { label: '最多架几道', type: 'int', min: 1, max: 6, default: 2 }, minHeight: { label: '柱体至少几层', type: 'int', min: 3, max: 10, default: 4 } },
  },
  match(w, ctx = {}, params = {}) {
    const cells = w.grid.cells, minH = params.minHeight ?? 4, out = [], seen = new Set();
    for (const a of cells) {
      const ha = top(w, a.id);
      if (ha < minH || !editable(ctx, a.id)) continue;
      for (let e = 0; e < a.n; e++) {
        let cur = a, edge = e;
        const path = [];
        for (let s = 0; s < 4; s++) {
          const nx = straightNext(cells, cur, edge);
          if (!nx) break;
          const c = nx.cell, h = top(w, c.id);
          if (path.length >= 1 && h >= minH) {
            const H = Math.min(ha, h);
            const ok = path.every((p) => top(w, p.id) <= H - 2 && editable(ctx, p.id) && !isCave(w, p.id));
            const key = [a.id, c.id].sort((x, y) => x - y).join('-');
            if (ok && !seen.has(key)) {
              seen.add(key);
              const rocky = isRock(w, a.id, H) && isRock(w, c.id, H);
              out.push({ id: 'arch:' + key, cells: path.map((p) => p.id), ends: [a.id, c.id], focus: path[(path.length / 2) | 0].id, level: H, rock: rocky,
                score: H - path.length * 0.5, reason: `${rocky ? '岩柱' : '楼'} ${a.id} ↔ ${c.id} 之间隔 ${path.length} 格、低 ≥2 层，可在第 ${H} 层架${rocky ? '石拱' : '天桥'}` });
            }
            break;
          }
          if (h >= minH) break;
          path.push(c);
          if (nx.edge < 0) break;
          cur = c; edge = nx.edge;
        }
      }
    }
    return out;
  },
  run(w, { targets, ctx = {} }) {
    const applied = [];
    for (const t of targets) {
      if (!t.cells.every((id) => editable(ctx, id) && top(w, id) <= t.level - 2)) continue;   // 先前步骤改过就跳过
      for (const id of t.cells) {
        const thick = t.rock && top(w, id) <= t.level - 3;   // 底下差 ≥3 层：拱厚 2
        setVoxel(w, id, t.level, true, { rock: t.rock });
        if (thick) setVoxel(w, id, t.level - 1, true, { rock: true });
        if (!t.rock && w.color[id] < 0) w.color[id] = w.color[t.ends[0]];
      }
      applied.push(t.id);
    }
    return { applied };
  },
};

/* ------------------------------------------------------------------ 悬垂 */
export const overhang = {
  meta: {
    id: 'terrain.overhang', layer: 'terrain', kind: '地形', name: '崖顶悬垂', kind2: 'geometry',
    summary: '高崖顶（≥4 层岩石）往外伸出一格，只写最上面一层，底下留空。',
    sources: ['1671808851895627776'],
    targets: '比邻格高 ≥3 层的岩石崖顶',
    keywords: ['悬垂', '悬崖', '崖', '伸出', 'overhang', 'cliff', '岩'],
    params: { count: { label: '最多几处', type: 'int', min: 1, max: 8, default: 3 } },
  },
  match(w, ctx = {}) {
    const cells = w.grid.cells, out = [];
    for (const c of cells) {
      const h = ground(w, c.id);
      if (h < 4 || top(w, c.id) !== h || w.river[c.id]) continue;
      for (const oid of c.edgeNeighbors) {
        if (oid < 0 || !editable(ctx, oid)) continue;
        const g = top(w, oid);
        if (g <= h - 3 && !topIsBuilt(w, oid) && !w.river[oid])
          out.push({ id: `overhang:${c.id}>${oid}`, cells: [oid], from: c.id, focus: oid, level: h, score: h - g, reason: `崖顶 ${c.id}（${h} 层）比邻格 ${oid}（${g} 层）高 ${h - g} 层，可外伸` });
      }
    }
    return out;
  },
  run(w, { targets, ctx = {} }) {
    const applied = [];
    for (const t of targets) {
      const id = t.cells[0];
      if (!editable(ctx, id) || top(w, id) >= t.level - 2) continue;
      setVoxel(w, id, t.level, true, { rock: true });
      applied.push(t.id);
    }
    return { applied };
  },
};

/* ------------------------------------------------------------------ 海中石柱 */
export const seastack = {
  meta: {
    id: 'terrain.seastack', layer: 'terrain', kind: '地形', name: '海中石柱', kind2: 'geometry',
    summary: '离岸 1–2 格的水里竖一根岩柱，顶上压一块更宽的帽（浪蚀台脚 + 蘑菇帽）。',
    sources: ['1708815475801505819'],
    targets: '靠岸、四周都是水的水格',
    keywords: ['石柱', '海柱', '礁', '海中', '岩柱', 'stack'],
    params: { count: { label: '几根', type: 'int', min: 1, max: 6, default: 2 }, height: { label: '高度（层）', type: 'int', min: 3, max: 9, default: 5 } },
  },
  match(w, ctx = {}) {
    const cells = w.grid.cells, out = [];
    const land = (id) => id >= 0 && top(w, id) > 0;
    for (const c of cells) {
      if (top(w, c.id) || !editable(ctx, c.id) || c.edgeNeighbors.some((id) => id < 0 || land(id))) continue;
      // 离岸距离：两圈内有陆地
      let near = false;
      for (const id of c.edgeNeighbors) for (const id2 of cells[id].edgeNeighbors) if (land(id2)) near = true;
      if (!near) continue;
      const ring = c.edgeNeighbors.filter((id) => editable(ctx, id));
      out.push({ id: 'stack:' + c.id, cells: [c.id], cap: ring, focus: c.id, score: 1 + (c.id % 97) / 1000, reason: `水格 ${c.id} 离岸两格、四周是水，可立石柱` });
    }
    return out;
  },
  run(w, { targets, params = {}, ctx = {} }) {
    const H = params.height ?? 5, applied = [];
    for (const t of targets) {
      const id = t.cells[0];
      if (top(w, id) || !editable(ctx, id)) continue;
      for (let lv = 1; lv <= H; lv++) setVoxel(w, id, lv, true, { rock: true });
      for (const n of t.cap) if (!top(w, n) && editable(ctx, n)) setVoxel(w, n, H, true, { rock: true });
      applied.push(t.id);
    }
    return { applied };
  },
};

/* ------------------------------------------------------------------ 穿山隧道 */
export const tunnel = {
  meta: {
    id: 'terrain.tunnel', layer: 'terrain', kind: '地形', name: '穿山隧道', kind2: 'geometry',
    summary: '两头是同一高度的地面，中间 1–6 格的岩体比它高 ≥2 层：把地面上一层挖空，底下能走、上面留岩顶（"瑞士奶酪"岛）。导航图会把洞里的格子当可走。',
    sources: ['906425294533394432', '906416813810049025'],
    targets: '两侧同高地面之间、更高的岩体',
    keywords: ['隧道', '洞', '穿', '奶酪', '洞窟', 'tunnel', 'cave', '通行'],
    params: { count: { label: '几条', type: 'int', min: 1, max: 4, default: 1 } },
  },
  match(w, ctx = {}) {
    const cells = w.grid.cells, out = [], seen = new Set();
    for (const a of cells) {
      const g0 = ground(w, a.id);
      if (g0 < 1 || top(w, a.id) !== g0 || w.river[a.id]) continue;
      for (let e = 0; e < a.n; e++) {
        let cur = a, edge = e;
        const path = [];
        for (let k = 0; k < 7; k++) {
          const nx = straightNext(cells, cur, edge);
          if (!nx) break;
          const c = nx.cell, g = ground(w, c.id);
          if (g === g0 && top(w, c.id) === g && path.length >= 1) {
            const key = [a.id, c.id].sort((x, y) => x - y).join('-');
            if (!seen.has(key) && path.every((p) => editable(ctx, p.id))) {
              seen.add(key);
              out.push({ id: 'tunnel:' + key, cells: path.map((p) => p.id), floor: g0, focus: path[(path.length / 2) | 0].id, score: 10 - path.length, reason: `${a.id} 与 ${c.id} 同在第 ${g0} 层，中间 ${path.length} 格岩体更高，可在第 ${g0 + 1} 层打通` });
            }
            break;
          }
          if (g < g0 + 2 || top(w, c.id) !== g || isCave(w, c.id) || !isRock(w, c.id, g0 + 1)) break;
          path.push(c);
          if (nx.edge < 0) break;
          cur = c; edge = nx.edge;
        }
      }
    }
    return out;
  },
  run(w, { targets, ctx = {} }) {
    const applied = [];
    for (const t of targets) {
      if (!t.cells.every((id) => editable(ctx, id) && isRock(w, id, t.floor + 1) && top(w, id) >= t.floor + 2)) continue;
      for (const id of t.cells) setVoxel(w, id, t.floor + 1, false);
      applied.push(t.id);
    }
    return { applied };
  },
};

export { pickSpread };
