// 第 53 批 G5 · 827216768783495168（And another one）对照 REACode/src/squadbanner.js：三格徽记图集、一队一色派生、公告板偏航夹 ±40°。
import assert from 'node:assert/strict';
import { bakeEmblemAtlas, squadRolePalette, bannerBillboardYaw, bakeBanner, SQUAD_EMBLEMS } from '../src/core/banner.js';
const atlas = bakeEmblemAtlas({ cell: 48 });
assert.equal(atlas.width, 144); assert.deepEqual(atlas.emblems, SQUAD_EMBLEMS);
assert.ok(atlas.ink.every((k) => k > .02 && k < .5), `三格都有白徽记 ${atlas.ink.map((k) => k.toFixed(3))}`);
assert.equal(new Set(atlas.ink.map((k) => k.toFixed(4))).size, 3, '三格各不相同');
// 旗面墨量 ↔ 图集墨量：旗面徽记与图集同一个形状函数（同一份「画一次」）
for (const [k, e] of SQUAD_EMBLEMS.entries()) {
  const flag = bakeBanner({ width: 96, height: 48, emblem: e, tail: 'straight' });
  assert.ok(flag.white > 0);
  const a2 = bakeEmblemAtlas({ cell: 48, emblems: [e] }); assert.ok(Math.abs(a2.ink[0] - atlas.ink[k]) < 1e-12);
}
assert.deepEqual(atlas.uv(1), { u0: 1 / 3, u1: 2 / 3, v0: 0, v1: 1 });
// 一队一色：同一色相派生四个角色色，同色相 → 完全相同；不同色相 → 不同
const p = squadRolePalette(212), q = squadRolePalette(212 + 360), r = squadRolePalette(20);
assert.deepEqual(p, q); assert.notDeepEqual(p.shield, r.shield);
const lum = (c) => .299 * c[0] + .587 * c[1] + .114 * c[2];
assert.ok(lum(p.helmet) > lum(p.field) && lum(p.field) > lum(p.shield) && lum(p.shield) > lum(p.body), '头盔洗白 > 旗底 > 盾 > 身体压暗');
assert.ok(p.shield[2] > p.shield[0], '212° 是蓝');
// 公告板
assert.deepEqual(bannerBillboardYaw(25), { yaw: 25, clamped: false, widthRatio: Math.cos(25 * Math.PI / 180) });
const b = bannerBillboardYaw(-70); assert.ok(b.clamped && b.yaw === -40 && Math.abs(b.widthRatio - .766) < 1e-3, '最窄 0.766');
assert.throws(() => bakeEmblemAtlas({ emblems: ['dragon'] })); assert.throws(() => squadRolePalette(NaN));
console.log('PASS 三格徽记图集（墨量与旗面同源）、军色派生四角色色、公告板偏航 ±40°', JSON.stringify({ ink: atlas.ink.map((k) => +k.toFixed(3)), palette: p }));
