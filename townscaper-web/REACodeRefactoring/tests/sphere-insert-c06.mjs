// 第 56 批 C06：1338829205157646336 球极投影平面逐点插入回放；1338825080844021760 松弛 + 动态重三角化。
import assert from 'node:assert/strict';
import { buildSphere, sphereTopologyReport } from '../src/sphere/planet.js';
import { createInsertionReplay, liftToSphere, relaxRetriangulate, projectionOrder } from '../src/sphere/stereo-insert-c06.js';

for (const [n, seed] of [[200, 1], [600, 3]]) {
  const sp = buildSphere({ n, seed, spacing: 20, relax: 0 });
  const { pole, items } = projectionOrder(sp.pts);
  assert.equal(items.length, n - 1); assert.ok(!items.some((o) => o.i === pole));
  for (let i = 1; i < items.length; i++) assert.ok(items[i].r >= items[i - 1].r, '按半径（= 纵向）排序');
  const r = createInsertionReplay(sp.pts);
  // 逐点：每插一个点，三角数 +2（含超级三角，平面 Euler），超级三角始终在
  let prev = r.frame(0); assert.equal(prev.tris.length, 1); assert.equal(prev.superTris, 1);
  for (const k of [1, 2, 3, 10, 50, n - 1]) { const f = r.frame(k); assert.equal(f.tris.length, 1 + 2 * k, `k=${k} 三角数 = 1+2k`); assert.ok(f.superTris >= 3); }
  // 往回拖：从头重放结果一致
  const a = r.frame(40).tris.map(String).sort().join(';'), b = (r.frame(n - 1), r.frame(40)).tris.map(String).sort().join(';');
  assert.equal(a, b, '回放可往回拖');
  // 抬回球面 = 闭合球网，且与 buildSphere 的投影三角化一致
  const L = liftToSphere(sp.pts, r), topo = sphereTopologyReport(sp.pts, L.tris);
  assert.ok(topo.closed && topo.euler === 2 && L.tris.length === 2 * n - 4, '闭合球网 F=2n-4');
  assert.ok(L.roundTrip < 1e-12, '投影往返误差 ' + L.roundTrip);
  const key = (t) => { const s = [...t]; const m = s.indexOf(Math.min(...s)); return [s[m], s[(m + 1) % 3], s[(m + 2) % 3]].join(','); };
  const mine = new Set(L.tris.map(key));
  let same = 0; for (const t of sp.tris) if (mine.has(key(t)) || mine.has(key([t[0], t[2], t[1]]))) same++;
  assert.ok(same / sp.tris.length > .97, `与 buildSphere 的投影三角化一致 ${same}/${sp.tris.length}`);
}
// 动态重三角化：从随机点出发，每轮改边数收敛到 0，最终闭合
const sp = buildSphere({ n: 300, seed: 5, spacing: 0, relax: 0 });
const rr = relaxRetriangulate(sp.steps.random, { iters: 12 });
assert.ok(rr.changed[0] > 5, '第一轮连接变化大 ' + rr.changed[0]);
assert.ok(rr.changed.slice(-4).reduce((s, x) => s + x, 0) <= 2, '后几轮连接基本稳定 ' + rr.changed.join(','));
assert.ok(sphereTopologyReport(rr.points, rr.tris).closed);
console.log('PASS sphere-insert-c06', JSON.stringify({ retri: rr.changed }));
