import assert from 'node:assert/strict';
import { planFacade, isInsideOpening, holePixelStats, passOrder, openingArea, PUNCH_REF } from '../src/render/opening-punch.js';

const W = 2.4, H = 1.6;
const windows = [-0.72, 0, 0.72].flatMap((u) => [0.45, 0.1, -0.25].map((v) => ({ u, v, w: 0.2, h: 0.24 })));
const doors = [{ u: 0, v: -0.6, w: 0.3, h: 0.36, door: true }, { u: 0.72, v: -0.6, w: 0.3, h: 0.36, door: true }];
const plan = planFacade({ width: W, height: H, openings: [...windows, ...doors] });

// 面积账必须是解析值，不能靠栅格化凑
assert.equal(plan.openings.length, 11);
assert.equal(plan.doorCount, 2);
assert.ok(Math.abs(plan.holeArea - (9 * 0.048 + 2 * 0.108)) < 1e-12);
assert.equal(plan.area, W * H);
assert.ok(Math.abs(plan.coverage - 0.648 / 3.84) < 1e-12);
assert.equal(PUNCH_REF, 1);

// 点在洞内 / 墙面上（洞与墙的分界不能互相污染）
assert.equal(isInsideOpening(plan, 0, -0.08), false);
assert.equal(isInsideOpening(plan, 0, 0.1), true);
assert.equal(isInsideOpening(plan, 0.72, 0.45), true);
assert.equal(isInsideOpening(plan, 0.3, 0.1), false);
assert.equal(isInsideOpening(plan, 0.3, -0.6), false);
assert.equal(isInsideOpening(plan, 0.72, 0.45, 0.2), true);

// 像素账：洞 + 墙 = 全幅，且洞的像素数与解析面积成正比
const px = holePixelStats(plan, 512);
const expectHole = 0.648 * (512 / W) * (512 / H);
assert.ok(Math.abs(px.holePixels - expectHole) < 1e-6);
assert.equal(px.pixels, 512);
assert.ok(Math.abs(px.holePixels + px.wallPixels - 512 * 512) < 1e-6);
assert.equal(px.holes.length, 11);
// 矩形的像素包围盒不能越界（否则洞会画到立面外）
for (const o of px.holes) assert.ok(o.cy - o.h / 2 >= -1e-9 && o.cy + o.h / 2 <= 513 && o.cx - o.w / 2 >= -1e-9);

// 绘制顺序是 punch 的全部要害：室内先落色写深度，模板次之，墙最后按 stencil 拒绘
assert.deepEqual(passOrder(), ['interior', 'mask', 'wall', 'decal']);

// 拒绝非法输入（越界 / 重叠 / 尺寸非正 / 非数 / 空集）
assert.throws(() => planFacade({ width: W, height: H, openings: [{ u: 1.25, v: 0, w: 0.2, h: 0.2 }] }), /outside facade/);
assert.throws(() => planFacade({ width: W, height: H, openings: [{ u: 0, v: 0, w: 0.2, h: 0.2 }, { u: 0.1, v: 0.05, w: 0.2, h: 0.2 }] }), /overlap/);
assert.throws(() => planFacade({ width: W, height: H, openings: [{ u: 0, v: 0, w: 0, h: 0.2 }] }), /non-positive/);
assert.throws(() => planFacade({ width: W, height: H, openings: [{ u: NaN, v: 0, w: 0.2, h: 0.2 }] }), /Invalid opening/);
assert.throws(() => planFacade({ width: W, height: H, openings: [] }), /at least one/);
assert.throws(() => planFacade({ width: -1, height: H, openings: windows }), /facade size/);
assert.throws(() => holePixelStats(plan, 4), /pixel size/);
// 紧紧贴边（共边不重叠）必须放行：Townscaper 的窗就是紧挨着排的
const touching = planFacade({ width: 1, height: 1, openings: [{ u: -0.1, v: 0, w: 0.2, h: 0.2 }, { u: 0.1, v: 0, w: 0.2, h: 0.2 }] });
assert.equal(touching.openings.length, 2);
// 纯函数：同样输入两次结果一致
assert.deepEqual(planFacade({ width: W, height: H, openings: [...windows, ...doors] }), plan);

console.log('PASS facade plan, analytic hole area, pixel bookkeeping, pass order, boundary/overlap rejection');

// 1275089608758484992 的教堂高拱门：跨两层的高拱龛 = 带半椭圆拱顶的洞口（rise 是拱高）。
const portal = planFacade({ width: 2.4, height: 3.2, openings: [{ u: 0, v: -0.6, w: 0.34, h: 1.5, rise: 0.17, door: true }] });
assert.equal(portal.archCount, 1);
const expectPortal = 0.34 * (1.5 - 0.17) + (Math.PI * 0.34 * 0.17) / 4;
assert.ok(Math.abs(portal.holeArea - expectPortal) < 1e-12);
assert.equal(openingArea(portal.openings[0]), portal.holeArea);
// 拱脚以下按矩形、以上按半椭圆：包围盒四角必须判在洞外（矩形洞口会把它们算进洞里）
assert.equal(isInsideOpening(portal, 0, -0.05), true);
assert.equal(isInsideOpening(portal, 0, 0.15), true);
assert.equal(isInsideOpening(portal, 0.169, 0.15), false);
assert.equal(isInsideOpening(portal, -0.169, 0.149), false);
assert.equal(isInsideOpening(portal, 0.169, -0.04), true);
// 拱顶的像素账也走半椭圆面积，不能退回 w*h
const pp = holePixelStats(portal, 400);
assert.ok(Math.abs(pp.holePixels - expectPortal * (400 / 2.4) * (400 / 3.2)) < 1e-6);
assert.equal(pp.holes[0].rise, 0.17 * (400 / 3.2));
// 非法拱高必须拒绝（rise>=h 或负值）
assert.throws(() => planFacade({ width: 2, height: 2, openings: [{ u: 0, v: 0, w: 0.3, h: 0.5, rise: 0.5 }] }));
assert.throws(() => planFacade({ width: 2, height: 2, openings: [{ u: 0, v: 0, w: 0.3, h: 0.5, rise: -0.1 }] }));
assert.throws(() => openingArea({ w: 0.3, h: 0.5, rise: 0.6 }));
console.log('PASS arch-top portal: analytic area, spring-line hit test, pixel accounting');
