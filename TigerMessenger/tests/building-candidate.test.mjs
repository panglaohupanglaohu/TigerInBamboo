// R57 建筑候选进高山圣城：计划 → 舞台坐标盒子（台基 / 墙身 / 屋顶 / 门 / 路）；采用记录不自动部署；游戏侧不碰已有建筑与存档。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildingBoxes, adoptRecord, adoptKey, ADOPT_PREFIX, STORY_H, layoutSig } from '../src/world/rea/building-geom.js';
import { solveJointLayout, cellCenter, DIRS } from '../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';
import { terraceField } from './lib/building-fixtures.mjs';

const F = terraceField(), r = solveJointLayout(F, { seed: 7, maxStep: 3 }), L = r.layout;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('candidate: one body + one roof per footprint cell, one door per building, roads drawn', () => {
  assert.ok(r.ok, r.reason);
  const b = buildingBoxes(L), cells = L.placements.reduce((s, p) => s + p.cells.length, 0), k = (kind) => b.filter((x) => x.kind === kind);
  assert.equal(k('body').length, cells); assert.equal(k('roof').length, cells); assert.equal(k('door').length, L.placements.length);
  assert.ok(k('road').length >= L.roads.length);
  for (const x of b) assert.ok([x.x, x.z, x.y0, x.y1, x.sx, x.sz].every(Number.isFinite) && x.y1 > x.y0, JSON.stringify(x));
});
test('candidate: bodies stand on the plan base, stories set the height, doors sit on the door edge', () => {
  const b = buildingBoxes(L);
  for (const p of L.placements) {
    const bodies = b.filter((x) => x.kind === 'body' && x.n === p.n);
    for (const x of bodies) { assert.equal(x.y0, p.base); assert.ok(x.y1 - x.y0 >= p.stories * STORY_H - 1e-9); }
    const d = b.find((x) => x.kind === 'door' && x.n === p.n), c = cellCenter(L, ...p.door.cell), [dx, dz] = DIRS[p.door.dir];
    assert.ok(Math.abs(d.x - (c.x + dx * L.cellSize * 0.46)) < 1e-6 && Math.abs(d.z - (c.z + dz * L.cellSize * 0.46)) < 1e-6);
  }
  // 足迹中心在场地里（采样网格以场景中心为原点）
  for (const x of b.filter((y) => y.kind === 'body')) assert.ok(Math.abs(x.x) <= F.half && Math.abs(x.z) <= F.half);
});
test('candidate: adopt record never auto-deploys and refuses an empty layout', () => {
  const rec = adoptRecord({ id: 'citadel', layout: L, terrain: 'original', at: 1 });
  assert.equal(rec.autoDeploy, false); assert.equal(rec.buildings, L.placements.length); assert.equal(rec.sig, layoutSig(L));
  assert.equal(adoptKey('citadel'), ADOPT_PREFIX + 'citadel'); assert.match(ADOPT_PREFIX, /^tm\.building\.adopted\.v1:/);
  assert.throws(() => adoptRecord({ id: 'citadel', layout: { placements: [] } }), /没有可采用/);
});
test('candidate: game side only writes its own adopt key, marks its meshes reaIgnore, never touches user saves / lake', () => {
  const src = read('../src/world/rea/buildingCandidate.js');
  const sets = [...src.matchAll(/localStorage\.setItem\(([^,]+),/g)].map((m) => m[1].trim());
  assert.deepEqual(sets, ['adoptKey(id)']);
  assert.ok(!/tm\.crystalCity|tm\.citadel|tm\.morris|tm\.lake|lakeBuild/i.test(src.replace(/\/\/.*$/gm, '')), 'must not reference user saves or the lake');
  assert.match(src, /userData\.reaIgnore = true/); assert.match(src, /removeFromParent\(\)/);
  const bridgeV = read('../src/scene-authoring/pipeline-bridge.js').match(/mountainCandidate\.js\?v=([\w-]+)/)?.[1];
  assert.ok(bridgeV && src.includes('mountainCandidate.js?v=' + bridgeV), 'must import mountainCandidate with the same ?v as pipeline-bridge (one module instance): ' + bridgeV);
  assert.ok(!/autoDeploy\s*:\s*true/.test(src));
});
test('candidate: building workshop exposes preview / compare / revert / commit hooks to the bridge', () => {
  const w = read('../src/system-workshop/building-workshop.js');
  for (const c of ['building.probe', 'building.preview', 'building.compare', 'building.revert', 'building.commit']) assert.ok(w.includes(`'${c}'`), c);
});
