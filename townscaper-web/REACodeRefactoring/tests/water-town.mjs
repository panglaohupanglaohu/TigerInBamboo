// tests/water-town.mjs — 1215642481162887168「整个项目放到水上：小镇场景就是水上码头」残差核账。
// 原片（330帧全核，shore-topology-review.md）：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。
// 本文件在真实 World + 真实 buildings.js 管线上断言这条片子的机制性落点：
//   ① 水上码头平台：一格 1 层实心 = 灰石基座从 y=0（水面以下）外鼓到台面 + 临水栏杆；
//   ② 水上悬浮块：钢腿脚端停在水面 y=0，逐角给出 posts —— 岸裙泡沫圈锚点（shore.js 消费）；
//   ③ 跨水拱：两对边 1 层码头撑着 2 层悬浮块 → 解析拱底（floor=0、端点/拱顶精确、形变误差有界）；
//   ④ 种子水上小镇（townDemo）：码头 + 后院 + 拱 + 水上钢腿房一次齐出。
// 岸线闭环拓扑在 tests/shore-loops.mjs、实际场景截图在 tests/shore-topology-browser.cjs，这里不重复。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { generateTown } = await import('../src/world/townDemo.js');
const { archSoffitAt, archPassage } = await import('../src/core/arch-floor-budget.js');

const L = F.L;
const fresh = (kind) => { const w = new F.World(F.grid(kind)); w.palette = F.PALETTES.town; return w; };
const near0 = (g) => g.cells.reduce((a, c) => (c.cx * c.cx + c.cz * c.cz < a.cx * a.cx + a.cz * a.cz ? c : a));
const yRange = (m) => {
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < m.pos.length; i += 3) { lo = Math.min(lo, m.pos[i]); hi = Math.max(hi, m.pos[i]); }
  return [lo, hi];
};

/* ① 空水面放一格 → 水上码头 -------------------------------------------------- */
{
  const w = fresh('quad'), c = near0(w.grid);
  w.setSolid(c, 1, true);
  const { r, m } = F.build(w);
  assert.ok(m.triangles > 0, '码头几何非空');
  const [lo, hi] = yRange(m);
  assert.equal(lo, 0, '码头基座从水面 y=0 起（入水外鼓）');
  assert.ok(hi > L + 0.1, `临水栏杆高出台面（实测 max y=${hi.toFixed(3)}，台面 ${L}）`);
  assert.equal(r.posts.length, 0, '纯码头没有水中桩锚点');
}

/* ② 水上悬浮块 → 钢腿到水面 + 泡沫锚点 --------------------------------------- */
{
  const w = fresh('mixed'), c = near0(w.grid);
  w.setSolid(c, 2, true);                                    // 只放第 2 层：整根柱悬空在水上
  const { r, m } = F.build(w);
  const [lo] = yRange(m);
  assert.equal(lo, 0, '钢腿脚端停在水面 y=0（原片：柱到水面就断）');
  assert.equal(r.posts.length, c.n, '每个悬空角一根桩 → 岸裙泡沫圈锚点');
  for (const p of r.posts) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), '锚点坐标有限');
}

/* ③ 跨水拱：对边码头支撑悬浮块 → 精确拱底截面 --------------------------------- */
{
  const w = fresh('quad');
  const c = w.grid.cells.find((c) => c.n === 4 && c.edgeNeighbors[0] >= 0 && c.edgeNeighbors[2] >= 0);
  assert.ok(c, '需要带对边邻居的方格');
  const A = w.grid.cells[c.edgeNeighbors[0]], B = w.grid.cells[c.edgeNeighbors[2]];
  w.setSolid(A, 1, true); w.setSolid(B, 1, true);            // 两座水上码头
  w.setSolid(c, 2, true);                                    // 第 2 层悬浮，本格第 1 层是水
  const { r, m } = F.build(w);
  const rec = r.archBudgets.find((a) => a.cell === c.id);
  assert.ok(rec, '对边码头支撑 → 拱（不是平底+钢架）');
  assert.equal(rec.floorLevel, 0, '拱脚之下没有体素：拱底悬在水面上');
  assert.equal(rec.floor, 0, '拱的净空基准 = 水面 y=0');
  assert.equal(rec.points[0].height, 0, '拱脚 u=0 落在 spring 上');
  assert.equal(rec.points.at(-1).height, 0, '拱脚 u=1 落在 spring 上');
  assert.ok(rec.spring > rec.floor && rec.spring < rec.base, `spring=${rec.spring} 在水面与块底之间`);
  assert.ok(rec.errorBound > 0 && Number.isFinite(rec.errorBound), '分段误差有解析上界');
  assert.ok(Number.isFinite(rec.deformedError) && rec.deformedError >= 0, '形变后实测误差有限');
  assert.equal(archSoffitAt(rec, 0), rec.spring, '拱脚底=弹簧线');
  assert.ok(Math.abs(archSoffitAt(rec, 0.5) - (rec.spring + rec.rise)) < 1e-9, '拱顶=spring+rise 精确');
  assert.ok(archPassage(rec, { height: rec.spring - rec.floor - 1e-6 }).ok, '拱下过水净空≥spring');
  assert.equal(r.posts.length, 0, '拱走两肩，不落水中桩');
  assert.ok(m.triangles > 0);
}

/* ④ 种子水上小镇：码头 + 房 + 拱 + 后院 + 水上钢腿房 -------------------------- */
{
  const w = fresh('quad');
  generateTown(w, 330);                                      // 种子 330（=本片解码帧数）：实测出拱+水上钢腿+后院
  const { r } = F.build(w);
  assert.ok(r.posts.length > 0, '水上钢腿房 → 泡沫锚点存在');
  assert.ok(r.archCount > 0, '种子镇含拱');
  assert.ok(r.yards > 0, '围合后院存在');
  assert.ok(r.archBudgets.some((a) => a.floorLevel >= 1 || a.floorLevel === 0), '拱预算已记录');
}

console.log('water-town: 水上码头 / 水上钢腿泡沫锚点 / 跨水拱精确拱底 / 种子小镇 全部通过');
