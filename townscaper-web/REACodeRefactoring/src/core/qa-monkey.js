/**
 * qa-monkey.js — 1344290848180203523「A rare look at Townscapers sophisticated QA process」（第 56 批 C05）。
 *
 * 片子（814 帧）：一座已经很复杂的悬空建筑群上，连续快速地加块、删块、换色（底部色槽来回切），
 * 悬空体块、钢柱、拱和楼梯不停重组——"QA"就是把生成器往乱七八糟的配置里怼，看它会不会坏。
 * 旧 qa-replay.js 只有中心 4 格 16 步固定序列；这里补成"猴子测试"：
 *   - 种子化随机操作流，限定在建筑最密的一片格子里（片中镜头只盯一团建筑）：
 *     stack 顶上加一层 / float 隔空加一块（制造悬空 → 钢柱）/ carve 掏掉中间一层（制造悬挑）/
 *     drop 削掉顶层 / paint 换墙色槽（片中底部色槽不停切）。
 *   - 每一步：几何属性有限、索引合法、退化面计数（沿用 auditQAGeometry）；
 *   - 每 checkEvery 步：增量重建 vs 同一 World 的全新整体重建，位置做顺序无关摘要必须逐三角相同
 *     （这是 WorldMesh 分块缓存最容易坏的地方：块哈希/脏区判断漏了就会留下旧几何）；
 *   - 结束：restore 回起点快照，重建后位置摘要必须等于起点摘要（编辑可逆、无残留）。
 * 不声称原作 QA 工具或流程；也不检查流形/漏面（本仓几何本身不是流形）。
 */
import { MAX_LEVEL } from './world.js';
import { auditQAGeometry } from './qa-replay.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 建筑最密的一团格子：已建格的质心附近 count 格（含其中的空格，便于"隔空加块"）。 */
export function monkeyRegion(world, count = 28) {
  const built = world.cells.filter((c) => world.top(c) > 1 || (world.top(c) === 1 && !world.isRock?.(c, 1)));
  const src = built.length ? built : world.cells;
  const cx = src.reduce((s, c) => s + c.cx, 0) / src.length, cz = src.reduce((s, c) => s + c.cz, 0) / src.length;
  // 质心可能落在院子里；取离质心最近的已建格当锚点
  const anchor = src.slice().sort((a, b) => Math.hypot(a.cx - cx, a.cz - cz) - Math.hypot(b.cx - cx, b.cz - cz))[0];
  return world.cells.slice().sort((a, b) => Math.hypot(a.cx - anchor.cx, a.cz - anchor.cz) - Math.hypot(b.cx - anchor.cx, b.cz - anchor.cz) || a.id - b.id).slice(0, count);
}

const OPS = [['stack', 0.32], ['float', 0.14], ['carve', 0.18], ['drop', 0.2], ['paint', 0.16]];

/** 按当前 World 状态抽一步并执行；返回 {op, cell, level?, color?} 记录（可回放）。 */
export function monkeyStep(world, region, rng, maxLevel = Math.min(MAX_LEVEL, 9)) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  let r = rng(), op = OPS[OPS.length - 1][0];
  for (const [name, w] of OPS) { if (r < w) { op = name; break; } r -= w; }
  const cell = pick(region), top = world.top(cell), colors = world.palette.colors.length;
  const solidLevels = []; for (let l = 1; l <= top; l++) if (world.isSolid(cell, l)) solidLevels.push(l);
  if (op === 'stack' && top < maxLevel) { world.setSolid(cell, top + 1, true); return { op, cell: cell.id, level: top + 1 }; }
  if (op === 'float' && top + 2 <= maxLevel) { const l = Math.min(maxLevel, top + 2 + Math.floor(rng() * 2)); world.setSolid(cell, l, true); return { op, cell: cell.id, level: l }; }
  if (op === 'carve' && solidLevels.length >= 3) { const mid = solidLevels.slice(1, -1), l = pick(mid); world.setSolid(cell, l, false); return { op, cell: cell.id, level: l }; }
  if (op === 'drop' && top >= 2 && !world.isRock?.(cell, top)) { world.setSolid(cell, top, false); return { op, cell: cell.id, level: top }; }
  if (op === 'paint' && top >= 2) { const k = Math.floor(rng() * colors); if (world.color[cell.id] !== k) { world.color[cell.id] = k; world.touch(); } return { op, cell: cell.id, color: k }; }
  // 抽到的操作在该格不成立：退化为 stack（保证每步都有编辑）
  if (top < maxLevel) { world.setSolid(cell, top + 1, true); return { op: 'stack', cell: cell.id, level: top + 1, fallback: op }; }
  world.setSolid(cell, top, false); return { op: 'drop', cell: cell.id, level: top, fallback: op };
}

/** 位置的顺序无关摘要：每个三角形把 3 个顶点量化排序后哈希，再求和/异或（块拼接顺序不影响）。 */
export function positionDigest(geometry, q = 1e-4) {
  const p = geometry.getAttribute('position').array, idx = geometry.index?.array, n = idx ? idx.length : p.length / 3;
  let sum = 0, xor = 0, tris = 0;
  const key = (i) => `${Math.round(p[i * 3] / q)},${Math.round(p[i * 3 + 1] / q)},${Math.round(p[i * 3 + 2] / q)}`;
  for (let t = 0; t + 2 < n; t += 3) {
    const ks = [0, 1, 2].map((k) => key(idx ? idx[t + k] : t + k)).sort();
    let h = 0x811c9dc5; const s = ks.join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    sum = (sum + h) >>> 0; xor = (xor ^ Math.imul(h, 0x9e3779b1)) >>> 0; tris++;
  }
  return `${tris}:${sum.toString(16)}:${xor.toString(16)}`;
}

/**
 * 主循环。api = {world, view}；freshGeometry(world) → 同一 World 的全新整体重建几何（页面注入 new WorldMesh）。
 * 无论成功、失败还是中途抛错，finally 都恢复体素/色槽/河道/配色。
 */
export async function runMonkeyQA(api, { seed = 1, steps = 120, checkEvery = 10, region = 28, freshGeometry = null, afterStep = async () => {} } = {}) {
  const { world, view } = api, saved = world.snapshot(), palette = world.palette;
  view.changed(); view.render(0);
  const startDigest = positionDigest(view.worldMesh.geometry);
  const cells = monkeyRegion(world, region), rng = mulberry32(seed), log = [], checks = [];
  const counts = {}; let maxDegenerate = 0, floating = 0;
  try {
    for (let s = 0; s < steps; s++) {
      const rec = monkeyStep(world, cells, rng); log.push(rec); counts[rec.op] = (counts[rec.op] ?? 0) + 1;
      view.changed(); view.render(0);
      const a = auditQAGeometry(view.worldMesh.geometry);
      if (!a.valid) throw Error(`step ${s} ${rec.op}: ${a.errors.join('; ')}`);
      maxDegenerate = Math.max(maxDegenerate, a.degenerateTriangles);
      if (freshGeometry && ((s + 1) % checkEvery === 0 || s === steps - 1)) {
        const inc = positionDigest(view.worldMesh.geometry), full = positionDigest(freshGeometry(world));
        checks.push({ step: s + 1, inc, full, same: inc === full });
        if (inc !== full) throw Error(`step ${s + 1}: incremental mesh ≠ full rebuild (${inc} vs ${full})`);
      }
      await afterStep({ step: s + 1, rec, audit: a });
    }
    // 悬空体块数（下面一层空、上面实心）：证明序列确实制造了片中那种悬空/钢柱配置
    for (const c of cells) for (let l = 2; l <= MAX_LEVEL; l++) if (world.isSolid(c, l) && !world.isSolid(c, l - 1)) floating++;
    const endState = { floating, tops: cells.map((c) => world.top(c)) };
    world.restore(saved); world.palette = palette; view.changed(); view.render(0);
    const backDigest = positionDigest(view.worldMesh.geometry);
    if (backDigest !== startDigest) throw Error(`restore digest mismatch ${backDigest} vs ${startDigest}`);
    return { valid: true, seed, steps, counts, checks, maxDegenerate, startDigest, backDigest, endState, log,
      scope: '有限属性/索引、增量=整体重建（位置逐三角）、编辑后还原零残留；不含流形/漏面/视觉等价' };
  } finally {
    world.restore(saved); world.palette = palette; view.changed(); view.render(0);
  }
}
