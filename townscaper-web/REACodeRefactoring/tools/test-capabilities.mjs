// 能力库自检：每个能力在测试岛上 match → run → verify；不改体素的显示层只检查 match。
import { buildQuadGrid } from '../src/core/grid.js';
import { decorateCells } from '../src/core/spatial.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { CAPABILITIES, matchAll, runPlan, routeGoal } from '../src/capabilities/registry.js';
import { verifyCandidate } from '../src/capabilities/verify.js';
import assert from 'node:assert/strict';
const grid = decorateCells(buildQuadGrid({ radius: 28, hexSize: 1 }));
const base = new World(grid);
generateTerrain(base, { seed: 3 });
let b = 0; for (const c of grid.cells) { const t = base.top(c); if (t >= 1 && t <= 2 && c.id % 37 === 0 && b < 25) { base.setSolid(c, t + 1, true); base.setSolid(c, t + 2, true); base.color[c.id] = c.id % 6; b++; } }
const fresh = () => { const w = new World(grid); w.restore(base.snapshot()); return w; };
let fails = 0;
const ids = new Set();
for (const cap of CAPABILITIES) {
  const m = cap.meta;
  try {
    assert.ok(/^[a-z]+\.[a-z0-9.-]+$/.test(m.id) && !ids.has(m.id), 'id 唯一且合法'); ids.add(m.id);
    assert.ok(m.name && m.summary && m.layer && m.kind2 && Array.isArray(m.sources) && m.sources.length, 'meta 完整（含来源视频）');
    assert.ok(Array.isArray(m.keywords) && m.keywords.length, 'Router 关键词');
    const rows = cap.match(fresh(), {}, {});
    assert.ok(Array.isArray(rows) && rows.every((r) => r.id && Array.isArray(r.cells) && Number.isFinite(r.focus) && r.reason), 'match 结构');
    if (cap.run) {
      const w = fresh(), before = fresh();
      const [rep] = runPlan(w, [{ id: m.id }]);
      if (rows.length) assert.equal(rep.status, 'applied', '有可作用物件时应执行');
      const v = verifyCandidate(before, w, { touchesBuilt: m.id.startsWith('build.') });
      assert.notEqual(v.status, 'fail', '验证不应失败：' + v.checks.filter((c) => c.status === 'fail').map((c) => c.detail).join('；'));
      // 不可编辑掩码：全部锁住时不得改动
      const locked = fresh(); runPlan(locked, [{ id: m.id }], { allowed: new Uint8Array(grid.cells.length) });
      assert.deepEqual([...locked.solid], [...before.solid], '锁定范围外不得改动');
      console.log('✓', m.id, '匹配', rows.length, '执行', rep.applied.length, '验证', v.status);
    } else console.log('✓', m.id, '显示层，匹配', rows.length);
  } catch (e) { fails++; console.log('✗', m.id, e.message); }
}
const routed = routeGoal('两栋楼之间架天桥，海边加灯塔', matchAll(fresh()));
assert.ok(routed.some((r) => r.id === 'terrain.arch') && routed.some((r) => r.id === 'build.lighthouse'), 'Router 关键词');
console.log(fails ? `✗ ${fails} 个能力未通过` : `✓ 全部 ${CAPABILITIES.length} 个能力通过`);
process.exit(fails ? 1 : 0);
