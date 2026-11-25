// r220 · 1727324352264474664「快速转镜拖抹」残差核销：
//   速度场 = velocityField（裁判 REACode smear.js 逐式移植）；
//   CPU 审计接口 = sharpness / smearAudit（逐式移植，含 rimPx/drop/bandDrop）；
//   轮廓涂抹近似 = whipSmear（历史帧沿内容速度 streak + 轮廓加权 alpha，edgeStrength 掩码）。
import assert from 'node:assert/strict';
import {
  velocityField, smearField, sharpness, smearAudit, edgeStrength, whipSmear, WHIP_SMEAR_GLSL,
  smearImage, smearLengthPx, orbitVelocity, cameraAngularSpeed, smearHistoryWeight,
} from '../src/core/camera-motion.js';

const mkImg = (w, h, fn) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b, a] = fn(x, y); d.set([r, g, b, a ?? 255], (y * w + x) * 4); } return { data: d, w, h }; };
const lum = (im, x, y) => { const i = (y * im.w + x) * 4; return .2126 * im.data[i] + .7152 * im.data[i + 1] + .0722 * im.data[i + 2]; };

/* ---- 速度场：逐式移植 = 切向、∝半径、与 orbitVelocity·dt 同式 ---- */
{
  const vel = velocityField(96, 96, 2, 1 / 60);
  assert.ok(vel instanceof Float32Array && vel.length === 96 * 96 * 2);
  const [vx, vy] = orbitVelocity(80, 48, 2, 1 / 60, 48, 48);
  assert.ok(Math.abs(vel[(48 * 96 + 80) * 2] - vx) < 1e-6 && Math.abs(vel[(48 * 96 + 80) * 2 + 1] - vy) < 1e-6, '与 orbitVelocity 同式');
  assert.ok(Math.abs(vx) < 1e-12 && vy > 0, '切向不径向');
  assert.ok(Math.abs(Math.hypot(vx, vy) - smearLengthPx(2, 32)) < 1e-12, '长度 ∝ r');
  assert.throws(() => velocityField(0, 96, 1), RangeError);
  assert.throws(() => velocityField(96, 96, 1, -1), RangeError);
}
/* ---- smearField 与 smearImage 同核：omega 便捷入口 == velocityField 显式场 ---- */
{
  const img = mkImg(64, 64, (x, y) => [((x >> 3) + (y >> 3)) & 1 ? 230 : 25, 0, 0]);
  const a = smearImage(img, 1.8), b = smearField(img, velocityField(64, 64, 1.8));
  assert.deepEqual([...b.data], [...a.data], 'smearField(velocityField(ω)) ≠ smearImage(ω)');
  assert.ok(Number.isFinite(b.ms) && b.ms >= 0);
  assert.throws(() => smearField(img, new Float32Array(8)), RangeError);
}
/* ---- CPU 审计接口：sharpness 全指标 + smearAudit 表 ---- */
{
  const img = mkImg(64, 64, (x, y) => { const v = x & 1 ? 230 : 25; return [v, v, v]; });
  const s = sharpness(img);
  for (const k of ['p50', 'p95', 'mean', 'samples']) assert.ok(k in s, 'sharpness 缺 ' + k);
  assert.ok(s.p95 > 100 && s.samples > 0);
  const au = smearAudit({ size: 128, omegas: [0, 1.2, 2.4] });
  assert.equal(au.rows.length, 3); assert.equal(au.size, 128);
  for (const row of au.rows) for (const k of ['omega', 'rimPx', 'ms', 'p95', 'drop', 'bandP95', 'bandDrop']) assert.ok(k in row, 'audit 行缺 ' + k);
  assert.ok(Math.abs(au.rows[0].drop) < 1e-9, 'ω=0 不该掉锐度');
  assert.ok(au.rows[2].drop > au.rows[1].drop && au.rows[1].drop > 0, '锐度损失应随 ω 单调');
  assert.ok(Math.abs(au.rows[1].rimPx - Math.abs(1.2) * 64 * (1 / 60)) < 1e-12, 'rimPx = |ω|·r·dt');
  assert.throws(() => sharpness({ data: new Uint8ClampedArray(4), w: 9, h: 9 }), RangeError);
}
/* ---- 轮廓强度掩码：平区 0、硬边 1 ---- */
{
  const img = mkImg(32, 32, (x) => { const v = x < 16 ? 0 : 255; return [v, v, v]; });
  const e = edgeStrength(img, 48);
  assert.equal(e[16 * 32 + 4], 0, '平区轮廓强度应 0');
  assert.equal(e[16 * 32 + 16], 1, '硬边轮廓强度应封顶 1');
  const red = mkImg(32, 32, (x) => [x < 16 ? 0 : 255, 0, 0]);            // 亮度只占 .2126 → 同阈值不满格
  assert.ok(edgeStrength(red, 48)[16 * 32 + 16] < 1 && edgeStrength(red, 24)[16 * 32 + 16] === 1, 'ref 阈值参与归一');
  assert.throws(() => edgeStrength(img, 0), RangeError);
}
/* ---- whipSmear：恒等 / 方向性拉长 / 轮廓加权 / 上限 ---- */
{
  const w = 96, h = 96;
  const cur = mkImg(w, h, (x) => { const v = x >= 52 ? 230 : 25; return [v, v, v]; });              // 当前帧竖直轮廓在 x=52
  const prev = mkImg(w, h, (x) => { const v = x >= 44 ? 230 : 25; return [v, v, v]; });             // 上一帧轮廓在 x=44（内容右移 8px/帧）
  const flat = new Float32Array(w * h * 2);
  const right = new Float32Array(w * h * 2); for (let i = 0; i < w * h; i++) right[i * 2] = 8;   // 内容速度 +x 8px/帧

  // ① alpha=0 / 零速度场+自身历史 → 与当前帧逐位相同（停转清晰、无历史残留）
  assert.deepEqual([...whipSmear(cur, prev, right, { alpha: 0 }).data], [...cur.data]);
  assert.deepEqual([...whipSmear(cur, cur, flat, { alpha: .9 }).data], [...cur.data], '零速度场+自身历史 → 恒等');

  // ② 轮廓沿流向被拉长：x∈[44,52) 是轮廓刚扫过的暗区，应被上一帧亮轮廓的拖尾点亮
  const sm = whipSmear(cur, prev, right, { alpha: .9 });
  let lit = 0;
  for (let x = 45; x < 51; x++) if (lum(sm, x, 48) > lum(cur, x, 48) + 20) lit++;
  assert.ok(lit >= 5, `轮廓后方拖尾没拉长（只亮 ${lit}/6 px）`);
  // ③ 拉长只发生在 −v 侧（轮廓身后）：前方 x≥52 处 prev/cur 同为亮 → 与当前帧一致
  for (const x of [56, 64, 80]) assert.ok(Math.abs(lum(sm, x, 48) - lum(cur, x, 48)) < 15,
    `轮廓前方 x=${x} 不该变（Δ=${Math.abs(lum(sm, x, 48) - lum(cur, x, 48)).toFixed(1)}）`);

  // ④ 拖尾方向跟随速度场符号：亮条残影出现在运动后方（−v 侧），反转 v 残影换边
  const dark = mkImg(w, h, () => [25, 25, 25]);
  const stripe = mkImg(w, h, (x) => { const v = x >= 58 && x <= 62 ? 230 : 25; return [v, v, v]; });
  const left = new Float32Array(w * h * 2); for (let i = 0; i < w * h; i++) left[i * 2] = -8;
  const fwd = whipSmear(dark, stripe, right, { alpha: .9 }), bwd = whipSmear(dark, stripe, left, { alpha: .9 });
  assert.ok(lum(fwd, 66, 48) - lum(dark, 66, 48) > 20 && lum(fwd, 52, 48) - lum(dark, 52, 48) < 15,
    '+v 时残影应在亮条 +x 侧（身后）');
  assert.ok(lum(bwd, 54, 48) - lum(dark, 54, 48) > 20 && lum(bwd, 66, 48) - lum(dark, 66, 48) < 15,
    '−v 时残影应在亮条 −x 侧（身后）');

  // ⑤ 轮廓加权 alpha：隐含混合率 a_eff=(out−cur)/(trail−cur)，硬轮廓 ≈alpha、平区 ≈alpha·.45
  //    x=51 是当前帧硬边（e=1），x=48 是当前帧平区（e=0）
  const impliedA = (out, trail, x) => (lum(out, x, 48) - lum(cur, x, 48)) / (trail - lum(cur, x, 48));
  const aEdge = impliedA(sm, 200.7, 51), aFlat = impliedA(sm, 156.8, 48);
  assert.ok(Math.abs(aEdge - .9) < .03, `硬边隐含 alpha=${aEdge.toFixed(3)}，期望 ≈.9`);
  assert.ok(Math.abs(aFlat - .405) < .03, `平区隐含 alpha=${aFlat.toFixed(3)}，期望 ≈.405`);

  // ⑥ maxPx 截断：|v|=200 截到 8 → 与 |v|=8 逐位相同；不截断则不同
  const clamped = whipSmear(cur, prev, (() => { const v = new Float32Array(w * h * 2); for (let i = 0; i < w * h; i++) v[i * 2] = 200; return v; })(), { alpha: .9, maxPx: 8 });
  const exact = whipSmear(cur, prev, right, { alpha: .9 });
  assert.deepEqual([...clamped.data], [...exact.data], 'maxPx 截断未生效');
  const free = whipSmear(cur, prev, (() => { const v = new Float32Array(w * h * 2); for (let i = 0; i < w * h; i++) v[i * 2] = 200; return v; })(), { alpha: .9, maxPx: 200 });
  assert.notDeepEqual([...free.data], [...exact.data], '不截断时应与 8px 场不同');
  assert.throws(() => whipSmear(cur, prev, right, { alpha: 1.5 }), RangeError);
  assert.throws(() => whipSmear(cur, prev, new Float32Array(4)), RangeError);
}
/* ---- GLSL 孪生与既有口径 ---- */
assert.ok(WHIP_SMEAR_GLSL.includes('vec4 whipSmear') && WHIP_SMEAR_GLSL.includes('edgeRef') && WHIP_SMEAR_GLSL.includes('k<4'));
// 相机口径不变：包裹角速度仍喂 smearHistoryWeight（dt 留存不变）
assert.ok(Math.abs(cameraAngularSpeed(Math.PI - .01, 0, -Math.PI + .01, 0, 1 / 60) - 1.2) < 1e-9);
assert.ok(smearHistoryWeight(2.4, 1 / 60) > 0 && smearHistoryWeight(0, 1 / 60) === 0);
console.log('PASS whip smear r220: 速度场/CPU审计/轮廓加权方向拖尾（恒等·拉长·随v向·轮廓加权·maxPx·验参）');
