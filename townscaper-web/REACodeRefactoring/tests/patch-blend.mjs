// src/patchblend.js → src/terrain/patch-blend.js：共享 World 岸线上的投影/手工UV patch 高度混合 + seamStats/edgeJump/abModes。
import assert from 'node:assert/strict';
import { buildQuadGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { decorateCells, buildCellIndex } from '../src/core/spatial.js';
import { buildPatchField, makePatches, renderPatches, seamStats, edgeJump, abModes, shoreArcs, shoreColor, grassColor } from '../src/terrain/patch-blend.js';

const grid = decorateCells(buildQuadGrid({ radius: 8 }));
const world = new World(grid); generateTerrain(world, { seed: 3 });
const index = buildCellIndex(grid);
const field = buildPatchField(world, { res: .1, index });
assert.equal(field.version, world.version);
assert.ok(field.loops >= 1 && field.segs.length > 20, 'shore loops traced from shared World');

// 1) 有符号距离：陆正水负，且与共享 World 的 isLand 一致；岸带宽度用世界单位定义（不随坡度暴涨）
let agree = 0, total = 0;
for (let i = 0; i < field.w * field.h; i++) { total++; if ((field.SD[i] > 0) === !!field.land[i]) agree++; }
assert.equal(agree, total);
const patches = makePatches({ shoreHalf: .45 });
let shoreTexels = 0; for (let i = 0; i < field.w * field.h; i++) if (patches[1].coverage(field, i)) { shoreTexels++; assert.ok(Math.abs(field.SD[i]) <= .45); }
const perim = shoreArcs(world).segs.reduce((s, g) => s + g.len, 0);
const bandWidth = shoreTexels * field.res * field.res / perim;
assert.ok(bandWidth > .6 && bandWidth < 1.2, `constant-width shore band ≈ 2·shoreHalf, got ${bandWidth.toFixed(2)}`);

// 2) 手工 UV：u = 沿岸弧长（每个环从 0 增到周长）；v 进图案（同一 u 不同 v 颜色不同 → 不会海胆放射纹）
for (const g of field.segs) { assert.ok(g.s0 >= 0 && g.s0 + g.len <= g.perimeter + 1e-9); }
const uAlong = []; for (let i = 0; i < field.w * field.h; i++) if (Math.abs(field.SD[i]) < .05 && field.loop[i] === 0) uAlong.push(field.U[i]);
assert.ok(Math.max(...uAlong) - Math.min(...uAlong) > .8 * field.segs.filter((g) => g.loop === 0)[0].perimeter, 'u spans the whole loop');
assert.notDeepEqual(shoreColor(1.2, .1, -.3), shoreColor(1.2, .9, .3), 'v participates in shore pattern');
// 等距白点：沿弧长每 dotSpacing 一颗，与岸线朝向无关
const dots = []; for (let u = 0; u < 4; u += .01) if (shoreColor(u, .2, -.25)[2] > .9) dots.push(u);
const starts = dots.filter((u, k) => k === 0 || u - dots[k - 1] > .02); const gaps = starts.slice(2).map((u, k) => u - starts[k + 1]); // 第一颗在 u=0 被截半
assert.ok(gaps.length >= 8 && gaps.every((g) => Math.abs(g - .4) < .02), 'dots equidistant in arc length');
// 投影 patch：只吃世界坐标 → 跨格子连续
assert.deepEqual(grassColor(1.234, -2.5), grassColor(1.234, -2.5));

// 3) 三种合成 A/B：hard 有缝细节全、alpha 无缝但抹平、height 介于两者之间并有柔和过渡带
const ab = abModes(field, patches);
assert.ok(ab.height.jump.meanJump < ab.hard.jump.meanJump * .7, `height cuts seam jump ${ab.height.jump.meanJump} vs ${ab.hard.jump.meanJump}`);
assert.ok(ab.height.jump.meanJump > ab.alpha.jump.meanJump, 'alpha is the seamless-but-flat extreme');
assert.ok(ab.height.seam.gradBand > ab.alpha.seam.gradBand, `height keeps more detail than alpha ${ab.height.seam.gradBand} > ${ab.alpha.seam.gradBand}`);
assert.ok(ab.hard.seam.softMeanPx === 0 && ab.height.seam.softMeanPx > .5, 'height mode has a soft band');
assert.ok(ab.hard.covHist[2] > 100, 'patches overlap (shore over land/water)');
const img = renderPatches(field, patches, 'height');
assert.deepEqual(edgeJump(img), ab.height.jump); assert.deepEqual(seamStats(img), ab.height.seam);
// 混合只在重叠区：远离岸线的纹素保持各自 patch 本色
const far = [...field.SD.keys()].find((i) => field.SD[i] > 2);
const fx = field.minX + (far % field.w + .5) * field.res, fz = field.minZ + (Math.floor(far / field.w) + .5) * field.res;
assert.deepEqual([...img.data.slice(far * 4, far * 4 + 3)], grassColor(fx, fz).map((v) => Math.round(Math.min(255, v * 255))));

// 4) 编辑共享 World：新造一块离岸陆地 → 新岸线环、版本前进
const sea = grid.cells.find((c) => !world.isLand(c) && Math.hypot(c.cx, c.cz) > 6 && c.edgeNeighbors.every((n) => n >= 0 && !world.isLand(grid.cells[n])));
assert.ok(sea, 'found open sea cell');
world.fill(sea, 1, { rock: true });
const field2 = buildPatchField(world, { res: .1, index });
assert.ok(field2.version > field.version && field2.loops === field.loops + 1, `loops ${field.loops}→${field2.loops}`);
assert.throws(() => renderPatches(field, patches, 'bogus'), RangeError);
assert.throws(() => buildPatchField({}), TypeError);
console.log(`PASS patch blend on shared World (${field.loops} shore loops, band ${bandWidth.toFixed(2)}); jump hard ${ab.hard.jump.meanJump} / height ${ab.height.jump.meanJump} / alpha ${ab.alpha.jump.meanJump}; detail ${ab.hard.seam.gradBand}/${ab.height.seam.gradBand}/${ab.alpha.seam.gradBand}`);
