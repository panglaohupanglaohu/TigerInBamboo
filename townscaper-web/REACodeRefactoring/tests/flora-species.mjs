// 第 55 批 G2：levelflora 物种几何 + dual 对偶落点 / 崖壁竖面（flora-species.js），在共享 World 上。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { dualFoliageSites } = await import('../src/core/vertex-dual.js');
const { speciesGeometry, SPECIES_SHAPES, SHAPE_PLAN, dualWallSites, FloraSpecies } = await import('../src/life/flora-species.js');
const { LEVEL_SPECIES } = await import('../src/core/level-flora.js');
// 1) 六种形状各不相同：包围盒高宽比可区分（松最高、白花最矮、蕨最扁宽）
const box = Object.fromEntries(SPECIES_SHAPES.map((s) => { const g = speciesGeometry(s); g.computeBoundingBox(); const b = g.boundingBox; return [s, { h: b.max.y - b.min.y, w: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), n: g.getAttribute('position').count }]; }));
assert.ok(box.conifer.h > box.blade.h && box.blade.h > box.puff.h && box.puff.h > box.dots.h, JSON.stringify(box));
assert.ok(box.fan.w / box.fan.h > 2, '蕨扁宽'); assert.ok(box.blade.h / box.blade.w > 1.5, '高草细高');
for (const k of Object.keys(LEVEL_SPECIES)) assert.ok(SPECIES_SHAPES.includes(LEVEL_SPECIES[k].shape), k + ' 的形状有几何');
assert.throws(() => speciesGeometry('palm'));
// 2) 共享 World：生成地形 + 形变
const g = buildQuadGrid({ radius: 7, seed: 5 }), world = new World(g); generateTerrain(world, { seed: 5 });
const shape = shapeTerrain(world), at = (p, s) => shape.at(p, s), L = .5;
// 崖壁竖面对偶落点：每个点在一条下落边端点的竖直列上、处在某层墙的半高、法线朝外（指向更低的一侧）
const walls = dualWallSites(world, { levelHeight: L, at });
assert.ok(walls.length > 20, 'walls ' + walls.length);
const vById = new Map(g.verts.map((v) => [v.id, v]));
for (const w of walls) {
  assert.ok(Math.abs((w.y / L - .5) - Math.round(w.y / L - .5)) < 1e-9, '半层高');
  const c = world.cells[w.cell]; assert.ok(world.ground(c) > w.level, '在本格台地之下');
  const v = vById.get(w.vertex); assert.ok(Math.hypot(w.x - v.x, w.z - v.z) < .6, '跟着顶点列（形变后）');
  assert.ok(w.nx * (w.x - c.cx) + w.nz * (w.z - c.cz) > -1e-6, '外法线');
}
assert.equal(new Set(walls.map((w) => w.vertex + ':' + w.level)).size, walls.length, '不重复');
// 3) FloraSpecies：用假 Vegetation 驱动
const veg = { group: new THREE.Group(), uLight: { value: 1 }, L, tufts: { visible: true }, layers: { grass: true }, levelFlora: false };
const fs = new FloraSpecies({ vegetation: veg });
assert.equal(fs.group.visible, false, '默认关'); assert.deepEqual(fs.rebuild(world, shape), {}, '关时不建');
fs.setModes({ levelFlora: true }); assert.equal(veg.levelFlora, true, 'Vegetation 物种调色一起切'); assert.equal(veg.tufts.visible, false, '通用地被丛隐藏');
const s1 = fs.rebuild(world, shape);
const used = SPECIES_SHAPES.filter((s) => s1.counts[s] > 0); assert.ok(used.length >= 4, '多种几何都用上 ' + JSON.stringify(s1.counts));
// 每级台地两物种、跨层不共用（形状 → 层级图例）
const per = new Map(); for (const r of fs.rows) { if (!per.has(r.level)) per.set(r.level, new Set()); per.get(r.level).add(r.key); }
for (const set of per.values()) assert.ok(set.size <= 2);
const levelsOf = new Map(); for (const r of fs.rows) { if (!levelsOf.has(r.key)) levelsOf.set(r.key, new Set()); levelsOf.get(r.key).add(r.level); }
assert.ok([...levelsOf.entries()].filter(([k]) => k !== 'pine' && k !== 'rock').every(([, s]) => s.size === 1), '低三级物种不跨层');
// 实例都落在本格所在台地高度
const m = new THREE.Matrix4(), ys = new Set(); for (const s of SPECIES_SHAPES) for (let i = 0; i < fs.meshes[s].count; i++) { fs.meshes[s].getMatrixAt(i, m); ys.add(+(m.elements[13] / L).toFixed(6)); }
assert.ok([...ys].every((y) => Number.isInteger(y)), '贴台地顶面');
// 4) dual：落点 = dualFoliageSites，外加崖壁
fs.setModes({ levelFlora: false, dual: true }); const s2 = fs.rebuild(world, shape);
const ds = dualFoliageSites(world, { levelHeight: L });
assert.ok(s2.dualSites > 0 && s2.dualSites <= ds.sites.length); assert.equal(s2.wallSites, walls.length);
assert.equal(s2.counts.tuft, Object.values(s2.counts).reduce((a, b) => a + b, 0), '不开物种时全是通用丛');
fs.setModes({ dual: false }); assert.equal(fs.group.visible, false); assert.equal(veg.tufts.visible, true, '全关恢复通用地被丛');
console.log('PASS flora-species: 6 shapes distinct', JSON.stringify(Object.fromEntries(Object.entries(box).map(([k, v]) => [k, +v.h.toFixed(3)]))), '| levelflora counts', JSON.stringify(s1.counts), '| dual sites', s2.dualSites, 'wall', s2.wallSites);
