// r169 · 1696896119794479541：色块翻崖舌头（blotch-tongue-c09.js）的纯逻辑口径 —
// 舌头长度 ∝ 图集强度、顶面带宽度 ∝ 同一强度、世界深度上限、GLSL 与 CPU 同式、uniform 齐全。
import assert from 'node:assert/strict';
import { createBlotchAtlasData, sampleBlotchAtlas, swirlUV, buildBlotchRimField } from '../src/terrain/blotch-atlas.js';
import { tongueAmount, tongueWallMask, tongueTopMask, BLOTCH_TONGUE_GLSL, TONGUE_DEFAULTS } from '../src/terrain/blotch-tongue-c09.js';
import { buildQuadGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';

const atlas = createBlotchAtlasData();
const sample = (u, v) => sampleBlotchAtlas(atlas, u, v);

// 1) 强度只由图集 R 通道决定、且真的随位置变（舌头长短不一的前提）
const amts = [];
for (let x = -6; x <= 6; x += .37) for (let z = -6; z <= 6; z += .41) amts.push(tongueAmount(sample, x, z, { scale: .09, lobe: 2.2 }));
assert.ok(Math.min(...amts) < .05 && Math.max(...amts) > .9, `amt range ${Math.min(...amts)}..${Math.max(...amts)}`);
const sd = Math.sqrt(amts.reduce((s, v) => s + (v - amts.reduce((a, b) => a + b, 0) / amts.length) ** 2, 0) / amts.length);
assert.ok(sd > .25, `amt spread ${sd.toFixed(3)}`);
// 强度单调：R 通道越高 → 舌头越长（同一个世界深度，强处仍着色、弱处已收口）
const wallAt = (amt, below) => tongueWallMask({ below, amt, normalY: 0 });
assert.ok(wallAt(.9, .3) === 1 && wallAt(.1, .3) === 0, 'deep/weak vs shallow/strong');
assert.ok(wallAt(.9, .9) === 0, 'tongue stops at depth·amt');
for (let a = .1; a <= .95; a += .05) {                       // 逐档单调：amt 越大，能垂到的深度越深
  let reach = 0; for (let d = 0; d <= .6; d += .005) if (wallAt(a, d) > 0) reach = d;
  assert.ok(Math.abs(reach - .55 * a) < .02, `reach ${reach} vs ${(.55 * a).toFixed(3)} at amt ${a.toFixed(2)}`);
}
// 2) 平顶不受舌头影响、崖肩以下（below<0）不上色、非陡面不上色
assert.equal(tongueWallMask({ below: .05, amt: .9, normalY: 1 }), 0, 'flat top untouched');
assert.equal(tongueWallMask({ below: -.1, amt: .9, normalY: 0 }), 0, 'above the rim untouched');
assert.equal(tongueWallMask({ below: .05, amt: .01, normalY: 0 }), 0, 'weak streak leaves wall clean');
// 3) 顶面带：edge < topReach·amt 才铺，且只铺平顶
assert.equal(tongueTopMask({ edge: 0, amt: .9, normalY: 1 }), 1);
assert.equal(tongueTopMask({ edge: .5, amt: .9, normalY: 1 }), 0, 'top band only hugs the rim');
assert.equal(tongueTopMask({ edge: 0, amt: .9, normalY: 0 }), 0, 'no top band on walls');
assert.equal(tongueTopMask({ edge: .999, amt: 1, normalY: 1 }), 0, 'cell centre untouched');
// 4) 同一强度下：顶面带宽度与崖面深度的比例 = topReach/depth（原片「同一块色块翻过去」）
const ratio = TONGUE_DEFAULTS.topReach / TONGUE_DEFAULTS.depth;
assert.ok(ratio > .5 && ratio < .7, `topReach/depth ${ratio.toFixed(3)}`);
// 5) 真实 World：崖肩格里能看到舌头、内部格看不到（舌头只属于崖边）
const grid = buildQuadGrid({ radius: 8 }); const world = new World(grid); generateTerrain(world, { seed: 5 });
const rim = buildBlotchRimField(world, { res: 96, levelHeight: .5 });
let rimHits = 0, innerHits = 0, cells = 0;
for (const c of grid.cells) {
  const t = world.top(c); if (!t) continue; cells++;
  const amt = tongueAmount(sample, c.cx, c.cz, { scale: .09, lobe: 2.2 });
  const below = .55 * amt * .5;                                  // 舌头中段
  const hit = tongueWallMask({ below, amt, normalY: 0 });
  if (rim.rimCell[c.id]) rimHits += hit; else innerHits += hit;
}
assert.ok(cells > 100 && rimHits > 3, `rim tongue cells ${rimHits}/${cells}`);
assert.ok(innerHits === 0 || rimHits > innerHits, 'tongues live on rim cells');
// 6) GLSL：uniform 声明齐全、与 rim 着色器共用 buv 口径（scale 来自 uBlotchRimP.z）
for (const u of ['uBlotchTongue', 'uBlotchTongueColor', 'uBlotchTongueTop', 'uBlotchRimP', 'uBlotchRimX', 'uBlotchAtlas', 'uBlotchRim']) assert.ok(BLOTCH_TONGUE_GLSL.includes(u), u);
assert.ok(/smoothstep\(\.40,\.72/.test(BLOTCH_TONGUE_GLSL) && /smoothstep\(\.40,\.72/.test(tongueAmount.toString()) === false, 'glsl strength curve');
assert.ok(BLOTCH_TONGUE_GLSL.includes('col*.55') && BLOTCH_TONGUE_GLSL.includes('depth-aa'), 'ink outline + antialiased isodepth');
assert.throws(() => tongueWallMask({ below: NaN, amt: 1, normalY: 0 }), RangeError);
assert.throws(() => tongueTopMask({ edge: NaN, amt: 1, normalY: 1 }), RangeError);
console.log(`PASS blotch tongue (amt ${Math.min(...amts).toFixed(2)}..${Math.max(...amts).toFixed(2)}, reach=depth·amt, rim cells ${rimHits}/${cells}, glsl uniforms)`);
