// r56 C05-D · 1257213678056857600 / 1189902695303458816：钢架落点（共享角格最高实心层）、曲柄内倾腿落邻栋坡顶、
// 簇内约束求解系杆层（间隔≤2、不连层、共腿对齐）+ Y 撑 + 接头；world.steelFrame / yardWalls / propAnimYard 关时与去掉
// r56 挂钩行的 buildings.js 逐浮点一致。
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as F from './fixtures/g2-build.mjs';
const { steelScene, yardScene } = await import('../src/build/scenes-r56.js');
const { solveTieLevels, legLanding } = await import('../src/build/steel-r56.js');

/* ---- 1. 关开关 = 去掉本组挂钩行的原文件（另一分叉的 r56 挂钩两边都保留） ---- */
const src = join(F.root, 'src/build/buildings.js');
let text = readFileSync(src, 'utf8');
const drop = ["from './steel-r56.js'", "from './yard-r56.js'", 'if (world.steelFrame) { steelJobs.push', 'const steel = world.steelFrame ? emitSteelFrame', 'if (world.propAnimYard) continue;', 'const yardWalls = world.yardWalls ? drawYardWalls'];
let removed = 0;
text = text.split('\n').filter((l) => { const hit = drop.some((d) => l.includes(d)); if (hit) removed++; return !hit; }).join('\n');
assert.equal(removed, drop.length, 'every r56 C05-D hook line found exactly once');
text = text.replace('const postSeen = new Set(), steelJobs = [];', 'const postSeen = new Set();').replace('steel, yardWalls, lintels,', 'lintels,');
const abs = (rel) => pathToFileURL(join(F.root, 'src/build', rel)).href;
text = text.replace(/from '(\.\.?\/[^']+)'/g, (_, p) => `from '${abs(p)}'`);
const dir = mkdtempSync(join(tmpdir(), 'r56-c05d-'));
writeFileSync(join(dir, 'buildings-pristine.mjs'), text);
const pristine = (await import(pathToFileURL(join(dir, 'buildings-pristine.mjs')).href)).buildBuildings;
let identical = 0;
for (const kind of ['quad', 'mixed']) for (const scene of ['town', 'fusion', 'steel', 'yard']) {
  const w = F.world(kind, scene === 'steel' || scene === 'yard' ? 'town' : scene, 7);
  if (scene === 'steel') steelScene(w); if (scene === 'yard') yardScene(w);
  const a = new F.MeshWriter(), b = new F.MeshWriter();
  F.buildBuildings(a, w, { L: F.L }); pristine(b, w, { L: F.L });
  assert.equal(a.pos.length, b.pos.length, `${kind}/${scene} vertex count`);
  for (const k of ['pos', 'col']) for (let i = 0; i < a[k].length; i++) if (a[k][i] !== b[k][i]) assert.fail(`${kind}/${scene} ${k}[${i}]`);
  identical++;
}

/* ---- 2. 系杆约束求解（单元） ---- */
assert.deepEqual(solveTieLevels([{ lo: 1, hi: 7 }]).ties, [3, 5]);
assert.deepEqual(solveTieLevels([{ lo: 1, hi: 3 }]).ties, []);
assert.equal(solveTieLevels([{ lo: 1, hi: 8 }]).ties.length, 3);
assert.ok(solveTieLevels([{ lo: 1, hi: 5 }], { maxGap: 1 }).unsat, 'gap 1 + no consecutive ties → unsatisfiable, reported');
{ // 共腿两开间（不同落点）→ 同一套绝对层，且对两者都满足
  const s = solveTieLevels([{ lo: 1, hi: 9 }, { lo: 4, hi: 9 }]);
  for (const b of [{ lo: 1, hi: 9 }, { lo: 4, hi: 9 }]) { const p = [b.lo, ...s.ties.filter((m) => m > b.lo && m < b.hi), b.hi]; for (let i = 1; i < p.length; i++) assert.ok(p[i] - p[i - 1] <= 2); }
  for (let i = 1; i < s.ties.length; i++) assert.ok(s.ties[i] - s.ties[i - 1] >= 2);
}

/* ---- 3. 场景：落点 / 不穿邻栋 / 曲柄 / 系杆 ---- */
const inside = (c, x, z) => { let s = 0; for (let i = 0; i < c.n; i++) { const a = c.pts[i], b = c.pts[(i + 1) % c.n], cr = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x); if (Math.abs(cr) < 1e-12) continue; if (!s) s = Math.sign(cr); else if (Math.sign(cr) !== s) return false; } return true; };
let legsChecked = 0, cranks = 0, ties = 0, oldPierce = 0, scenes = 0, ladders = 0;
for (const kind of ['quad', 'mixed']) for (const scene of ['steel', 'town', 'fusion']) {
  const w = F.world(kind, scene === 'steel' ? 'town' : scene, 7); if (scene === 'steel') steelScene(w);
  const { r } = F.build(w, { steelFrame: true }), st = r.steel;
  if (!st) { assert.equal(r.steel, null); continue; }
  scenes++;
  const keys = new Set();
  for (const leg of st.legs) {
    assert.ok(!keys.has(leg.key), 'one leg per (vertex, level)'); keys.add(leg.key);
    const ids = w.grid.vertexCells.get(leg.vid);
    let exp = 0; for (let l = leg.lv - 1; l >= 1 && !exp; l--) if (ids.some((id) => w.isSolid(w.cells[id], l))) exp = l;
    assert.equal(leg.landLevel, exp, 'lands on the highest solid among cells sharing the corner');
    for (let l = exp + 1; l <= leg.lv - 1; l++) assert.ok(!ids.some((id) => w.isSolid(w.cells[id], l)), 'leg never passes through a neighbour');
    // 旧规则只看本列：落在本列最高实心 → 统计旧版会穿过的邻栋
    const own = w.cells[leg.cell]; let ownL = 0; for (let l = leg.lv - 1; l >= 1; l--) if (w.isSolid(own, l)) { ownL = l; break; }
    if (ownL < exp) oldPierce++;
    if (leg.crank) {
      const s = w.cells[leg.landCell];
      assert.ok(w.isBuilt(s, exp) && exp >= 2 && !w.isSolid(s, exp + 1), 'crank only onto a roofed building top');
      assert.ok(inside(s, leg.crank.foot[0], leg.crank.foot[2]), 'cranked foot lands inside the supporting roof');
      assert.ok(leg.crank.knee > exp * F.L && leg.crank.knee <= leg.top[1], 'knee between roof and floor');
      cranks++;
    } else assert.ok(leg.flat);
    legsChecked++;
  }
  for (const c of st.clusters) { assert.ok(!c.unsat); for (let i = 1; i < c.ties.length; i++) assert.ok(c.ties[i] - c.ties[i - 1] >= 2); }
  ties += st.ties;
  if (scene === 'steel') { assert.ok(st.cranks >= 4 && st.ties >= 4 && st.joints >= st.ties && st.ladders.length >= 1, 'clip scene shows cranks + ties + joints + ladder'); }
  for (const ld of st.ladders) { assert.ok(ld.rungs >= 2 * (ld.lv - 2) && Math.abs(ld.length - ((ld.lv - 1) * F.L - .05 - F.L)) < 1e-9, 'ladder spans quay → floor'); ladders++; }
}
assert.ok(oldPierce > 0, 'old own-column rule would have pierced neighbouring houses');
assert.ok(cranks > 0 && ties > 0);
// legLanding 没有任何支撑 → 0（水底），与旧行为一致
{ const w = F.world('quad', 'town', 7); w.reset(); const c = w.cells[0]; w.setSolid(c, 3, true); assert.equal(legLanding(w, c.pts[0], 3).level, 0); }
console.log('PASS steel-frame-r56', { identical, scenes, legsChecked, cranks, ties, oldPierce, ladders });
