// R63–R64 嫁接进 REACodeRefactoring 的三个模块（原版 lighting.js / megatex.js / town.js）：单独的行为测试（不需要原版、不需要 three）。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/lightlife-grafts.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { buildVoxelField, bakeVertexAO, diffuseBounce } from '../../townscaper-web/REACodeRefactoring/src/light/voxel-light.js';
import { genFaces, facesFrom, measure, measureLayout, shelfLayout, atlasLayout, bake, resolve, bilinear, mipDown, mipBleedShare, CFG } from '../../townscaper-web/REACodeRefactoring/src/light/mega-atlas.js';
import { Town, MAX_HEIGHT, regionSummary } from '../../townscaper-web/REACodeRefactoring/src/core/town-graph.js';
import { World } from '../../townscaper-web/REACodeRefactoring/src/core/world.js';
import { squareGrid } from '../src/system-workshop/lightlife/scene-voxels.js';
const LIB = new URL('../../townscaper-web/REACodeRefactoring/src/', import.meta.url);

function town(n = 8) { const grid = squareGrid(n, 1), w = new World(grid); for (const c of grid.cells) w.fill(c, c.i === 3 && c.j === 3 ? 6 : c.i > 0 && c.j > 0 && c.i < n - 1 && c.j < n - 1 ? 1 : 0); return { grid, w }; }
const RED = { r: 1, g: 0.1, b: 0.1 }, WHITE = { r: 1, g: 1, b: 1 };

test('voxel-light：World 也能当体素集合；高塔旁边的地面被压暗，开阔处不压；空场不碰 document', () => {
  const { grid, w } = town(), f = buildVoxelField({ grid, levelHeight: 0.5, sets: [{ world: w, colorOf: () => WHITE }], res: 0.1, blurRadius: 3 });
  assert.ok(f.voxels > 0 && f.L >= 8);
  const nearTower = f.sampleOcc(3.5 + 0.7, 0.6, 3.5), open = f.sampleOcc(6.2, 0.6, 6.2);
  assert.ok(nearTower > open + 0.05, `塔脚 ${nearTower} 应比开阔 ${open} 更暗`);
  const empty = buildVoxelField({ grid, sets: [{ world: new World(grid) }] });
  assert.equal(empty.voxels, 0); assert.deepEqual(empty.sampleBounce(0, 0, 0), [1, 1, 1]);
  assert.throws(() => buildVoxelField({ grid, sets: [] }), /至少要一个/);
  assert.throws(() => buildVoxelField({ grid, sets: [{}] }), /town 或 world/);
});

test('voxel-light：烘顶点色确定性；多跳扩散后红塔旁的空气泛红（彩色反弹）', () => {
  const { grid, w } = town(), colorOf = (c) => (c.i === 3 && c.j === 3 ? RED : WHITE);
  const mk = () => buildVoxelField({ grid, levelHeight: 0.5, sets: [{ world: w, colorOf }], res: 0.1, blurRadius: 3 });
  const pos = [4.2, 0.5, 3.2, 4.2, 0.5, 3.8, 4.8, 0.5, 3.2], a = new Array(9).fill(1), b = new Array(9).fill(1);
  bakeVertexAO(mk(), pos, a); bakeVertexAO(mk(), pos, b); assert.deepEqual(a, b);
  const f = mk(); assert.equal(f._air, undefined); const ms = diffuseBounce(f, 3, 0.9, 3); assert.ok(ms >= 0); assert.equal(f._air, true);
  const [r, g] = f.sampleAir(4.3, 1.2, 3.5); assert.ok(r > g, `红塔旁的空气 r=${r} 应大于 g=${g}`);
  assert.equal(diffuseBounce(buildVoxelField({ grid, sets: [{ world: new World(grid) }] })), 0);
});

test('mega-atlas：同 n / seed 同一批面；货架与增量图集两种排布都能反查回自己的面（垫边 2 时内框反查 100%）', () => {
  assert.deepEqual(genFaces(20, 7), genFaces(20, 7));
  const faces = genFaces(60, 3);
  for (const pack of ['shelf', 'atlas']) {
    const m = measureLayout(faces, { size: 512, pad: 2, pack, keep: true });
    assert.equal(m.fail, 0, pack); assert.equal(m.exactRate, 1, pack); assert.ok(m.occupancy > 0.1 && m.occupancy < 1, pack);
    assert.ok(m.bleedRate <= measureLayout(faces, { size: 512, pad: 0, pack }).bleedRate, pack + '：垫边不应让串色变多');
    assert.ok(mipBleedShare(m.A, 1) >= 0);
  }
  const lay = shelfLayout(faces, 128, 0, 64); assert.ok(lay.fail > 0, '装不下要记失败，不硬塞'); assert.ok(lay.usedH <= 64);
  const A = bake(faces, atlasLayout(faces, 512, 1).rects, 512, 512, 1); assert.equal(A.owner.length, 512 * 512);
  const r = atlasLayout(faces, 512, 1).rects[0], hit = resolve(A, atlasLayout(faces, 512, 1).rects, r.x, r.y); assert.equal(hit.face, 0); assert.equal(hit.inPad, false);
  assert.equal(bilinear(A, r.x + 1, r.y + 1).hits.length, 1);
  assert.equal(mipDown(A, 1).atlasW, 256);
  assert.equal(facesFrom([{ w: 4, h: 8, hue: 30 }])[0].hue, 30);
  assert.equal(measure().faces, CFG.FACES);
});

test('town-graph：Town 的体素就是传入的 World；9 层上限；区域图含走道；颜色改动让区域缓存失效', () => {
  const grid = squareGrid(5, 1), w = new World(grid), t = new Town(grid, { world: w });
  assert.equal(t.world, w); assert.equal(MAX_HEIGHT, 9);
  t.fill(grid.cells[0], 1); t.fill(grid.cells[1], 1); t.fill(grid.cells[2], 3); t.fill(grid.cells[3], 12);
  assert.equal(w.top(grid.cells[2]), 3, 'World 看到的是同一份体素'); assert.equal(t.top(grid.cells[3]), 9, '超过 9 层按原版截掉');
  assert.equal(t.setSolid(grid.cells[2], 10, true), false);
  t.setSolid(grid.cells[2], 1, false); assert.equal(t.isFloating(grid.cells[2]), true); assert.equal(t.bottom(grid.cells[2]), 2);
  const r = t.regions(); assert.equal(r.regions.length, 3); assert.equal(r.regions.filter((x) => x.isWalkway).length, 1); assert.equal(r.regionOf[grid.cells[4].id], -2);
  assert.equal(t.neighborTop(grid.cells[0], 1), 1); assert.equal(t.neighborTop(grid.cells[0], 3), 0);
  const v0 = t.version; t.setColor(grid.cells[0], 4); assert.ok(t.version > v0); assert.notEqual(t.regions(), r);
  const s = t.snapshot(); t.reset(); assert.equal(t.top(grid.cells[2]), 0); t.restore(s); assert.equal(t.top(grid.cells[2]), 3); assert.equal(t.color(grid.cells[0]), 4);
  assert.deepEqual(regionSummary(t), { regions: 3, walkways: 1, buildings: 3, largest: 2 });
});

test('嫁接模块：头注释写明原版文件、帖子、与原版的不同；不 import three、不 import 原版 REACode；头注释在 import 之前结束', () => {
  for (const [f, orig] of [['light/voxel-light.js', 'REACode/src/lighting.js'], ['light/mega-atlas.js', 'REACode/src/megatex.js'], ['core/town-graph.js', 'REACode/src/town.js']]) {
    const s = fs.readFileSync(new URL(f, LIB), 'utf8'), head = s.slice(0, s.indexOf('*/'));
    assert.ok(head.includes(orig), f); assert.match(head, /嫁接/); assert.match(head, /不同|瑕疵/);
    assert.doesNotMatch(s, /from ['"]three['"]/); assert.doesNotMatch(s, /REACode\/src\/[\w-]+\.js['"]/);
    assert.ok(s.indexOf('*/') < s.search(/^import /m), f + '：头注释应在第一个 import 之前结束');
  }
});
