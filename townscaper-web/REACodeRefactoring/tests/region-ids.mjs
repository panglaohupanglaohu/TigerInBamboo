/** 1120036868966502401 · 跨层区域 id（core/region-ids.js）纯逻辑测试。
 *
 *  判据直接对着原片口径：同一条台地长高时**颜色/id 不变**，只有分裂才出现新 id。
 *  跑法：node tests/region-ids.mjs
 */
import { buildSquareGrid } from '../src/core/grid.js';
import { regionComponentIds, regionIdAt } from '../src/core/region-ids.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${info ? ' · ' + info : ''}`); };

const grid = buildSquareGrid({ radius: 3 });
const cells = grid.cells;
ok('grid 49 格 / 每格有 edgeNeighbors', cells.length === 49 && cells.every((c) => Array.isArray(c.edgeNeighbors) || ArrayBuffer.isView(c.edgeNeighbors)));

// 坐标工具：按格心 xz 选格
const at = (x, z) => cells.find((c) => Math.abs(c.cx - x) < 0.01 && Math.abs(c.cz - z) < 0.01)
  ?? cells.find((c) => Math.abs((c.pts.reduce((s, p) => s + p.x, 0) / c.n) - x) < 0.01 && Math.abs((c.pts.reduce((s, p) => s + p.z, 0) / c.n) - z) < 0.01);
const cxs = cells.map((c) => c.pts.reduce((s, p) => s + p.x, 0) / c.n);
const czs = cells.map((c) => c.pts.reduce((s, p) => s + p.z, 0) / c.n);
const centre = (c) => ({ x: c.pts.reduce((s, p) => s + p.x, 0) / c.n, z: c.pts.reduce((s, p) => s + p.z, 0) / c.n });

// ── 1. 单台地：长高不换 id ─────────────────────────────────────────────
// 中间 3×3 抬到 3 层，其余 1 层。
const near = (c, r) => { const m = centre(c); return Math.abs(m.x) <= r + 1e-6 && Math.abs(m.z) <= r + 1e-6; };
const topA = (c) => (near(c, 1.0) ? 3 : 1);
const rA = regionComponentIds(cells, topA);
const plateau = cells.filter((c) => near(c, 1.0));
const idsByH = [1, 2, 3].map((h) => new Set(plateau.map((c) => regionIdAt(rA, h, c.id))));
ok('单台地：每层只有一个区域 id', idsByH.every((s) => s.size === 1), idsByH.map((s) => [...s].join('/')).join(' | '));
const stableId = [...idsByH[0]][0];
ok('单台地：h=1 与 h=3 的 id 相同（长高不换色）', [...idsByH[0]][0] === [...idsByH[2]][0], `id ${stableId} vs ${[...idsByH[2]][0]}`);

// 对照：旧的「按高度层循环」口径下同一条台地跨层一定换色
const oldColor = (h) => (h - 1) % 6;
ok('对照：旧口径 h=1/2/3 是三种颜色', new Set([1, 2, 3].map(oldColor)).size === 3, 'palette[(h-1)%6]');

// ── 2. 双台地：不同区域不同 id ─────────────────────────────────────────
// 方格格心 x/z 为整数（radius 3 → -3..3）。左台地 x∈{-1,0}、右台地 x∈{2,3}，中间 x=1 留 1 层沟。
const inBox = (c, xs, zs) => { const m = centre(c); return xs.includes(Math.round(m.x)) && zs.includes(Math.round(m.z)); };
const topB = (c) => (inBox(c, [-1, 0, 2, 3], [0, 1]) ? 3 : 1);
const rB = regionComponentIds(cells, topB);
const left = cells.filter((c) => topB(c) >= 3 && Math.round(centre(c).x) <= 0);
const right = cells.filter((c) => topB(c) >= 3 && Math.round(centre(c).x) >= 2);
const idL = new Set(left.map((c) => regionIdAt(rB, 3, c.id)));
const idR = new Set(right.map((c) => regionIdAt(rB, 3, c.id)));
ok('双台地：两块各自单一 id', idL.size === 1 && idR.size === 1, `L=${[...idL]} R=${[...idR]}`);
ok('双台地：两块 id 不同', [...idL][0] !== [...idR][0]);
ok('双台地：颜色索引不同', ([...idL][0] - 1) % 6 !== ([...idR][0] - 1) % 6, `ci ${([...idL][0] - 1) % 6} / ${([...idR][0] - 1) % 6}`);

// ── 3. 分裂：一个父变两个孩 → 只有最大那个继承父 id ───────────────────
// h=1 全岛一块；h=2 只剩左右两根 3 格柱（中间 x=0 是高度 1 的鞍），必然分裂。
const topC = (c) => (inBox(c, [-1, 1], [-1, 0, 1]) ? 2 : 1);
const rC = regionComponentIds(cells, topC);
const compsAt2 = rC.layers[1].regions.map((r) => r.id);
const compsAt1 = rC.layers[0].regions;
ok('分裂：h=1 是一块、h=2 至少两块', compsAt1.filter((r) => r.cells > 1).length === 1 && compsAt2.length >= 2, `h1=${compsAt1.length} h2=${compsAt2.length} · 块大小 ${rC.layers[1].regions.map((r) => r.cells).join('/')}`);
const keptParent = compsAt2.filter((id) => compsAt1.some((r) => r.id === id));
ok('分裂：恰好一个孩子继承父 id', keptParent.length === 1, `继承 ${keptParent.join(',')}`);
ok('分裂：新 id 与父不同且全表 id 唯一', new Set(compsAt2).size === compsAt2.length);

// ── 4. 确定性 / 入参校验 / regionCount ────────────────────────────────
const s1 = JSON.stringify([...rC.layers[1].ids.entries()]);
const s2 = JSON.stringify([...regionComponentIds(cells, topC).layers[1].ids.entries()]);
ok('确定复现（同输入两次 id 表一致）', s1 === s2);
ok('regionCount = 出现过的最大 id', rC.regionCount === Math.max(...rC.layers.flatMap((l) => l.regions.map((r) => r.id))), String(rC.regionCount));
let threw = 0;
try { regionComponentIds(cells, null); } catch { threw++; }
try { regionComponentIds(cells, topC, { paletteSize: 0 }); } catch { threw++; }
try { regionComponentIds(null, topC); } catch { threw++; }
ok('非法入参抛错', threw === 3, String(threw));

console.log(`\n${fail ? 'FAIL' : 'ALL PASS'} · ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
