// R54 多格 prefab / socket（补学 #2 网格 A+5、#6 模块约束 A+9）：重构库 prefab-socket.js 嫁接进来，并封装成建筑层的 building.prefabs 能力。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PREFAB_LIBRARY, prefabTiles, validateLibrary, rotatePrefab, DIRS } from '../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';
import { buildingPrefabs, describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
import { contractOf } from '../src/system-workshop/contracts.js';

test('prefab: library is valid, multi-cell, one door each, door turns with the prefab', () => {
  assert.ok(validateLibrary().ok);
  assert.ok(PREFAB_LIBRARY.some((p) => p.cells.length >= 3) && PREFAB_LIBRARY.some((p) => p.cells.length === 4), 'needs real multi-cell prefabs');
  for (const p of PREFAB_LIBRARY) for (let r = 0; r < 4; r++) { const v = rotatePrefab(p, r); assert.equal(v.cells.length, p.cells.length); assert.equal(v.door[1], (p.door[1] + r) % 4); }
});
test('prefab: every part tile pairs only with its partner (private socket labels)', () => {
  const { tiles } = prefabTiles(), pairs = new Map();
  for (const t of tiles) t.edges.forEach((e) => { if (e.startsWith('p:')) pairs.set(e, (pairs.get(e) || 0) + 1); });
  for (const [label, c] of pairs) assert.equal(c, 2, label + ' should appear on exactly two part edges');
  assert.equal(tiles.length, PREFAB_LIBRARY.reduce((s, p) => s + p.cells.length * 4, 0));
});
test('prefab: building.prefabs capability selects a subset and records the catalog in the plan', () => {
  const site = { field: null, plan: {} };
  const out = buildingPrefabs.run(site, { params: { cottage: true, hall: true, lhouse: false, chapel: true, manor: false } });
  assert.deepEqual(site.plan.prefabs.ids, ['cottage', 'hall', 'chapel']);
  assert.equal(site.plan.prefabs.tiles, (1 + 2 + 3) * 4);
  assert.deepEqual(out.applied, ['catalog']);
  const none = { plan: {} }; assert.deepEqual(buildingPrefabs.run(none, { params: Object.fromEntries(PREFAB_LIBRARY.map((p) => [p.id, false])) }).applied, []);
});
test('prefab: meta follows §5.3 + contract, and imports the real library module', () => {
  const m = describeBuildingCapabilities().find((c) => c.id === 'building.prefabs');
  for (const f of ['id', 'name', 'domain', 'line', 'requires', 'modules']) assert.ok(m[f] !== undefined, f);
  assert.equal(contractOf(m, 'building').source, 'meta'); assert.deepEqual(m.writes, ['prefabCatalog']);
  const src = fs.readFileSync(new URL('../src/system-workshop/building/capabilities.js', import.meta.url), 'utf8');
  assert.match(src, /from '\.\.\/\.\.\/\.\.\/\.\.\/townscaper-web\/REACodeRefactoring\/src\/build\/prefab-socket\.js'/);
  const lib = fs.readFileSync(new URL('../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js', import.meta.url), 'utf8');
  assert.match(lib, /from '\.\.\/core\/wfc\.js'/, 'graft must reuse core/wfc.js, not a copied solver');
  assert.match(lib, /solveWithPrefab/, 'header must record the alias check (§3.2 step 2)');
});
test('prefab: the building side panel draws the catalog (足迹 + 门 socket)', () => {
  const w = fs.readFileSync(new URL('../src/system-workshop/building-workshop.js', import.meta.url), 'utf8');
  assert.match(w, /prefab-grid/); assert.match(w, /data-socket/); assert.match(w, /多格 prefab 目录/);
});
