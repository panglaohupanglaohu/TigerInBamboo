/**
 * build.js — 建筑类能力（纯数据）。
 */
import { top, topIsBuilt, setVoxel, editable, straightNext, nbIds } from './ops.js';
import { layeredLattice, labelCompatible } from '../build/tile-assembly.js';
import { moduleTiles, courtyardHouseSet, courtyardPlan, bridgeArcadeSet, bridgeArcadePlan } from '../build/assembly-modules.js';
import { planAssembly, createAssembly, applyStep, verifyAssembly } from '../build/assembly-sequence.js';

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

/* ------------------------------------------------------------------ 分步拼装：围合楼体 / 桥廊
 * 787319655648100352（67 帧）：底板上逐块拼装，空中零件待置。
 * court：连通铺地块（顶 1 层的建筑平台）里，凡四邻全铺地的格作内院，外环铺地格砌墙盖顶；
 * bridge：两段铺地端头隔 1–3 格空当，跨空架有顶廊桥（墩→柱头→拱跨→廊柱→廊顶）。
 * 逐块提交走 assembly-sequence 的支撑序 + 逐步校验；未接撤销（一次性跑完全部步）。 */
const paved = (w, id) => top(w, id) === 1 && topIsBuilt(w, id);
export const assembly = {
  meta: {
    id: 'build.assembly', layer: 'building', kind: '建筑', name: '逐块拼装（围合楼体 / 桥廊）', kind2: 'geometry',
    summary: '在铺地底板上按 3D 模块集逐块拼装：铺地块内院自动砌一圈多层墙加顶（围合庭院），或两端铺地隔空架一道有顶廊桥。每块遵守 socket/WFC 约束且落地有支撑，空中零件按轨迹参数待置。原版模块美术未迁。',
    sources: ['787319655648100352'],
    modules: ['src/build/assembly-sequence.js', 'src/build/assembly-modules.js', 'src/build/tile-assembly.js'],
    ideas: ['townscaper-web/REACode/src/tileplace.js', 'townscaper-web/REACode/src/courtyard.js'],   // 787319655648100352 约束铺砖拼装 / 围合内院的原版实现
    targets: '连通铺地块（内院非空）或隔 1–3 格空当的两段铺地端头',
    keywords: ['拼装', '装配', '模块', '庭院', '围合', '桥', '廊桥', 'assembly', 'courtyard', 'bridge', 'tileplace', 'wfc'],
    params: {
      kind: { label: '拼什么', type: 'choice', options: ['auto', 'court', 'bridge'], default: 'auto' },
      count: { label: '几处', type: 'int', min: 1, max: 4, default: 1 },
      wallLevels: { label: '墙层数', type: 'int', min: 1, max: 5, default: 2 },
      deckLevel: { label: '廊面层', type: 'int', min: 1, max: 4, default: 2 },
      pillar: { label: '院里立细柱', type: 'bool', default: true },
      seed: { label: '种子', type: 'int', min: 1, max: 9999, default: 1 },
    },
  },
  match(w, ctx = {}, params = {}) {
    const out = [], cells = w.grid.cells, kind = params.kind ?? 'auto';
    if (kind !== 'bridge') {
      // 连通铺地块；内院 = 所有边邻居都铺地的格
      const seen = new Set();
      for (const start of cells) {
        if (seen.has(start.id) || !paved(w, start.id) || !editable(ctx, start.id)) continue;
        const comp = [], stack = [start]; seen.add(start.id);
        while (stack.length) {
          const c = stack.pop(); comp.push(c.id);
          for (const nb of nbIds(c)) if (!seen.has(nb) && paved(w, nb) && editable(ctx, nb)) { seen.add(nb); stack.push(cells[nb]); }
        }
        const inComp = new Set(comp);
        const interior = comp.filter((id) => cells[id].edgeNeighbors.every((nb) => nb >= 0 && inComp.has(nb)));
        if (!interior.length) continue;
        out.push({ id: 'court:' + comp[0], kind: 'court', cells: comp, interior, focus: interior[0],
          score: interior.length * 2 + comp.length * 0.1, reason: `${comp.length} 格连通铺地、${interior.length} 格内院，环铺地砌 ${params.wallLevels ?? 2} 层墙加顶即成围合楼体` });
      }
    }
    if (kind !== 'court') {
      const seenPair = new Set();
      for (const a of cells) {
        if (!paved(w, a.id) || !editable(ctx, a.id)) continue;
        for (let e = 0; e < a.n; e++) {
          let cur = a, edge = e; const gap = [];
          for (let s = 0; s < 4; s++) {
            const nx = straightNext(cells, cur, edge);
            if (!nx) break;
            const c = nx.cell;
            if (gap.length >= 1 && paved(w, c.id) && editable(ctx, c.id)) {
              if (gap.every((g) => !paved(w, g.id) && top(w, g.id) === 0)) {
                const key = [a.id, c.id].sort((x, y) => x - y).join('-');
                if (!seenPair.has(key)) {
                  seenPair.add(key);
                  out.push({ id: 'bridge:' + key, kind: 'bridge', cells: [a.id, ...gap.map((g) => g.id), c.id], ends: [a.id, c.id], focus: gap[(gap.length / 2) | 0].id,
                    score: 8 - gap.length, reason: `${a.id} ↔ ${c.id} 隔 ${gap.length} 格空当，可架有顶廊桥` });
                }
              }
              break;
            }
            if (top(w, c.id) !== 0) break;
            gap.push(c);
            if (nx.edge < 0) break;
            cur = c; edge = nx.edge;
          }
        }
      }
    }
    return out;
  },
  run(w, { targets, ctx = {}, params = {} }) {
    const applied = [];
    for (const t of targets) {
      if (!t.cells.every((id) => editable(ctx, id))) continue;
      let lattice, set, spec, ground = 1;
      if (t.kind === 'court') {
        set = { ...courtyardHouseSet() };
        const wallLevels = Math.max(1, Math.min(5, params.wallLevels ?? 2));
        lattice = layeredLattice(w, t.cells, wallLevels + 1);
        set.tiles = moduleTiles(set.modules, lattice.cells[0].n - 2);
        const pillars = params.pillar === false ? [] : [{ cell: t.interior[0], top: 2 }];
        spec = courtyardPlan(w, lattice, set.tiles, { interior: t.interior, wallLevels, pillars });
      } else {
        set = { ...bridgeArcadeSet() };
        const deckLevel = Math.max(1, Math.min(4, params.deckLevel ?? 2));
        const lat = new Set(t.cells);
        for (const id of t.cells) for (const nb of w.grid.cells[id].edgeNeighbors) if (nb >= 0) lat.add(nb);
        lattice = layeredLattice(w, [...lat], deckLevel + 2);
        set.tiles = moduleTiles(set.modules, lattice.cells[0].n - 2);
        spec = bridgeArcadePlan(w, lattice, set.tiles, { deck: t.cells, piers: t.ends, deckLevel });
      }
      if (!spec.ok) { t.fail = spec.reason; continue; }
      const comp = labelCompatible(set.joins, { gravity: set.gravity });
      const plan = planAssembly(w, lattice, spec.assignment, set.tiles, { compatible: comp, ground, seed: params.seed ?? 1, levelHeight: 1 });
      if (!plan.ok) { t.fail = plan.reason; continue; }
      const session = createAssembly(w, plan, { color: t.id.length % 8 });
      let steps = 0; let ok = true;
      while (true) { const r = applyStep(session); if (!r.ok) { ok = r.reason === 'done'; break; } steps++; }
      const v = verifyAssembly(session);
      if (ok && v.ok) applied.push(t.id); else t.fail = ok ? 'verify' : 'apply';
      t.detail = { steps: plan.steps.length, placed: steps, conflicts: v.conflicts.length, unsupported: v.unsupported.length };
    }
    return { applied };
  },
};
