// 886199305522085890：通道点线要像原片那样「被山脊挡住时逐渐淡出」。
// 这条测试只覆盖纯逻辑（高度栅格 + 视线判定），渲染侧由 traffic-dots-browser.cjs 量像素。
import assert from 'node:assert/strict';
import { heightRaster, rasterAt, sightFade } from '../src/world/traffic.js';

const L = 0.5;
// 8×1 条带：x=0..1 是低台（1 层），x=4..5 是高墙（4 层），其余 1 层。
const cell = (id, cx, cz, top) => ({
  id, cx, cz, top, n: 4,
  pts: [{ x: cx - .5, z: cz - .5 }, { x: cx + .5, z: cz - .5 }, { x: cx + .5, z: cz + .5 }, { x: cx - .5, z: cz + .5 }],
});
const cells = [];
for (let j = 0; j < 3; j++) for (let i = 0; i < 8; i++) cells.push(cell(j * 8 + i, i + .5, j + .5, i === 4 ? 4 : 1));
const world = { cells, top: (c) => c.top };

const r = heightRaster(world, { res: .1, levelHeight: L });
assert.equal(r.w > 0, true);
assert.equal(rasterAt(r, .5, .5), 1 * L, 'low terrace height');
assert.equal(rasterAt(r, 4.5, .5), 4 * L, 'wall top');
assert.equal(rasterAt(r, 50, 50), -1e9, 'outside raster is empty');

// 相机在高处、从 +x 侧看向 -x：低台上的点被 4 层墙挡住 → 完全淡出。
const cam = { x: 9, y: 2.8, z: 2.9 };
const hidden = { x: 1.5, y: 1 * L + .035, z: .5 };
const open = { x: 4.5, y: 4 * L + .035, z: .5 };
const fHidden = sightFade(r, cam, hidden);
const fOpen = sightFade(r, cam, open);
assert.equal(fHidden, 0, 'dot behind the ridge must be fully faded, got ' + fHidden);
assert.equal(fOpen, 1, 'dot on the near crest must stay visible, got ' + fOpen);

// 连续淡出：把相机逐步压低，墙对这条视线的遮挡量单调变大，淡出值必须单调变小；
// 并且中间必须出现 0<f<1 的过渡值（原片是渐隐，不是硬切）。
let prev = 1, seen = 0, samples = 0;
for (let cy = 7; cy >= 3; cy -= .1) {
  const f = sightFade(r, { x: 9, y: cy, z: 2.9 }, { x: 2.5, y: 1 * L + .035, z: .5 });
  assert.ok(f <= prev + 1e-9, 'fade must not rise as the camera drops: ' + f + ' after ' + prev);
  if (f > 1e-6 && f < 1 - 1e-6) seen++;
  prev = f; samples++;
}
assert.ok(seen >= 2, 'expected a gradual ramp, got ' + seen + ' intermediate values over ' + samples + ' camera heights');
assert.equal(prev, 0, 'lowest camera fully occludes the far dot');

// 点在自己脚下那一格上时不该被自己所在地面判定为被挡（near 区段跳过）。
const flat = sightFade(r, { x: 6.5, y: 3, z: 2.9 }, { x: 6.5, y: 1 * L + .035, z: 1.5 });
assert.equal(flat, 1, 'own ground must not count as an occluder, got ' + flat);

// 关闭/无栅格时退回不淡出，避免老调用点炸掉。
assert.equal(sightFade(null, cam, hidden), 1);

console.log(JSON.stringify({ raster: { w: r.w, h: r.h, res: r.res }, fHidden, fOpen, rampSamples: seen }, null, 2));
console.log('PASS passage sight fade');
