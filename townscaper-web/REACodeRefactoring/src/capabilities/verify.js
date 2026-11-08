/**
 * verify.js — 验证 Worker 用的检查（纯数据）。比较"执行前 / 执行后"两个 World：
 *   bounds    改动是否都在允许编辑的格子里（湖面范围、保护区之外）
 *   built     手工建筑有没有被删 / 改（能力声明 touchesBuilt 时只允许"加"，不允许"删"）
 *   floating  新出现的悬空体素（3D 连通：从第 1 层实心往上 / 横向能走到的都算有支撑）
 *   nav       导航图：可走格数、从最大连通片能到达的格数（buildNav，含洞内可走）
 *   budget    外露面数（≈ 网格量）的增长
 * 每项 pass / warn / fail，附数值；fail 的候选不能被接受为定稿。
 */
import { buildNav } from '../world/navgraph.js';
import { top } from './ops.js';

function exposedFaces(w) {
  const cells = w.grid.cells; let n = 0;
  for (const c of cells) {
    const m = w.solid[c.id];
    if (!m) continue;
    for (let lv = 1; lv <= 12; lv++) {
      if (!((m >> (lv - 1)) & 1)) continue;
      if (!((m >> lv) & 1)) n++;                       // 顶
      if (lv > 1 && !((m >> (lv - 2)) & 1)) n++;       // 底（悬空的底面）
      for (const id of c.edgeNeighbors) if (id < 0 || !((w.solid[id] >> (lv - 1)) & 1)) n++;
    }
  }
  return n;
}

/** 从第 1 层出发的 3D 连通；返回没连到的实心体素数 */
function floatingCount(w) {
  const cells = w.grid.cells, seen = new Map(), q = [];
  const key = (id, lv) => id * 16 + lv;
  for (const c of cells) if (w.solid[c.id] & 1) { seen.set(key(c.id, 1), 1); q.push([c.id, 1]); }
  for (let h = 0; h < q.length; h++) {
    const [id, lv] = q[h];
    const nexts = [[id, lv + 1], [id, lv - 1], ...cells[id].edgeNeighbors.filter((n) => n >= 0).map((n) => [n, lv])];
    for (const [nid, nlv] of nexts) {
      if (nlv < 1 || nlv > 12 || !((w.solid[nid] >> (nlv - 1)) & 1)) continue;
      const k = key(nid, nlv);
      if (seen.has(k)) continue;
      seen.set(k, 1); q.push([nid, nlv]);
    }
  }
  let total = 0;
  for (const c of cells) { let m = w.solid[c.id]; while (m) { total += m & 1; m >>= 1; } }
  return total - seen.size;
}

function navStats(w) {
  const cells = w.grid.cells;
  // 起点：最大的同高可走片里任取一格（不同于"沙滩"假设，湖上建筑群也适用）
  let nav = buildNav(w, {});
  const counts = new Map();
  for (const c of cells) if (nav.walk[c.id]) counts.set(nav.region[c.id], (counts.get(nav.region[c.id]) || 0) + 1);
  if (!counts.size) return { walk: 0, reach: 0 };
  const big = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const start = cells.find((c) => nav.walk[c.id] && nav.region[c.id] === big);
  nav = buildNav(w, { start });
  let walk = 0, reach = 0;
  for (const c of cells) { if (nav.walk[c.id]) walk++; if (nav.walk[c.id] && Number.isFinite(nav.tree.time[c.id])) reach++; }
  return { walk, reach, stairs: nav.stairs.length };
}

export function verifyCandidate(before, after, { allowed = null, touchesBuilt = false } = {}) {
  const cells = before.grid.cells, changed = [];
  let outside = 0, builtRemoved = 0, builtChanged = 0;
  for (const c of cells) {
    const i = c.id;
    if (before.solid[i] === after.solid[i] && before.rock[i] === after.rock[i] && before.color[i] === after.color[i]) continue;
    changed.push(i);
    if (allowed && allowed[i] !== 1) outside++;
    const b0 = before.solid[i] & ~before.rock[i], b1 = after.solid[i] & ~after.rock[i];
    if (b0 & ~b1) builtRemoved++;                                   // 原有建筑体素没了
    else if (b0 && (b1 !== b0 || before.color[i] !== after.color[i])) builtChanged++;
  }
  const checks = [];
  checks.push({ id: 'bounds', name: '改动范围', status: outside ? 'fail' : 'pass', detail: outside ? `${outside} 格改动在可编辑范围之外` : `${changed.length} 格改动都在湖面可编辑范围内`, value: outside });
  checks.push({ id: 'built', name: '手工建筑保留', status: builtRemoved ? 'fail' : builtChanged ? (touchesBuilt ? 'warn' : 'fail') : 'pass',
    detail: builtRemoved ? `删掉了 ${builtRemoved} 格原有建筑体素` : builtChanged ? `${builtChanged} 格原有建筑被加高 / 改色（能力声明会改建筑：${touchesBuilt ? '是' : '否'}）` : '原有建筑体素一格未动', value: builtRemoved + builtChanged });
  const f0 = floatingCount(before), f1 = floatingCount(after);
  checks.push({ id: 'floating', name: '结构承托', status: f1 > f0 ? 'fail' : 'pass', detail: f1 > f0 ? `新增 ${f1 - f0} 个悬空体素（没有连到地面）` : `没有新增悬空体素（原有 ${f0}）`, value: f1 - f0 });
  const n0 = navStats(before), n1 = navStats(after);
  const lost = n0.reach - n1.reach;
  checks.push({ id: 'nav', name: '通行', status: lost > Math.max(2, n0.reach * 0.05) ? 'fail' : lost > 0 ? 'warn' : 'pass',
    detail: `可达格 ${n0.reach} → ${n1.reach}（可走 ${n0.walk} → ${n1.walk}，楼梯 ${n0.stairs ?? 0} → ${n1.stairs ?? 0}）`, value: n1.reach - n0.reach });
  const e0 = exposedFaces(before), e1 = exposedFaces(after), grow = e0 ? (e1 - e0) / e0 : 0;
  checks.push({ id: 'budget', name: '几何量', status: grow > 0.25 ? 'warn' : 'pass', detail: `外露面 ${e0} → ${e1}（${grow >= 0 ? '+' : ''}${(grow * 100).toFixed(1)}%）`, value: grow });
  const fail = checks.filter((c) => c.status === 'fail').length, warn = checks.filter((c) => c.status === 'warn').length;
  return { changedCells: changed, checks, status: fail ? 'fail' : warn ? 'warn' : 'pass', summary: fail ? `${fail} 项不通过` : warn ? `通过，${warn} 项需留意` : '全部通过' };
}

export { top };
