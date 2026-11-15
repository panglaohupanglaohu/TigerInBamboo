// 第 53 批 G5 · REACode/engine/outline.js（1482011744843223042「pixel thin lines from contrasts in my procedural normal map」/
// 1017355723171344385「thicker outlines for all you 4k high ballers」）。屏幕空间法线 + 线性深度描边迁为 world/outline-pass.js；
// 无浏览器，这里用 CPU 参考实现在合成缓冲上验判据：深度边=剪影、法线边=内部折痕、depthMix=0 只留法线反差、外圈淡出、线宽×DPR。
import assert from 'node:assert/strict';
import { THREE } from './fixtures/g5-battle.mjs';
const { ScreenOutlinePass, screenEdges } = await import('../src/world/outline-pass.js');
const w = 64, h = 64, normals = new Float32Array(w * h * 3), depth = new Float32Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = y * w + x, inBox = x >= 16 && x < 48 && y >= 16 && y < 48;
  depth[i] = inBox ? 20 : 100;
  const n = inBox && x >= 32 ? [Math.SQRT1_2, 0, Math.SQRT1_2] : [0, 0, 1];   // 盒子右半边是另一个朝向的面（折痕 x=32）
  // 用 >90° 的折痕才过法线阈值（1-n·n' ≥ .98）：右半边朝 +x
  if (inBox && x >= 32) { n[0] = 1; n[2] = 0; }
  normals.set(n, i * 3);
}
const at = (e, x, y) => e[y * w + x];
const full = screenEdges({ normals, depth, w, h });
assert.ok(at(full, 16, 30) > .9 && at(full, 15, 30) > .8, '剪影（深度跳变）有线（远处按距离略淡）');
assert.ok(at(full, 32, 30) > .9 && at(full, 31, 30) > .9, '盒内折痕（法线跳变）有线');
assert.equal(at(full, 24, 24), 0, '平面内部无线'); assert.equal(at(full, 5, 5), 0, '背景无线');
const normalOnly = screenEdges({ normals, depth, w, h }, { depthMix: 0 });
assert.ok(at(normalOnly, 32, 30) > .9, 'depthMix=0：折痕还在');
assert.equal(at(normalOnly, 20, 16), 0, 'depthMix=0：同朝向的剪影（只有深度跳变）没有线——「法线反差」一像素细线');
// 外圈淡出：把边界放到画面边上
const edgeDepth = depth.slice(); for (let y = 0; y < h; y++) edgeDepth[y * w] = 5;
assert.ok(screenEdges({ normals, depth: edgeDepth, w, h })[30 * w] < .2, '画面最外 2px 淡出（采样出界会画一圈框）');
// 线宽：设备像素 2（4K / DPR2）时线宽翻倍
const widthOf = (e) => { let n = 0; for (let x = 0; x < w; x++) if (at(e, x, 30) > .5) n++; return n; };
assert.equal(widthOf(screenEdges({ normals, depth, w, h }, { thickness: 2 })), 2 * widthOf(full), '粗细 ×2');
// GPU 类：线宽按 CSS 像素记，上传 = CSS × DPR；换分辨率重算
const renderer = { getPixelRatio: () => 2, getDrawingBufferSize: (v) => v.set(3840, 2160) };
const pass = new ScreenOutlinePass(renderer, { thickness: 1.5 });
assert.equal(pass.uniforms.uResolution.value.x, 3840);
pass.setThickness(1.5); assert.equal(pass.uniforms.uThickness.value, 3, 'DPR2 → 设备像素 3');
renderer.getPixelRatio = () => 1; pass.setSize(1920, 1080); assert.equal(pass.uniforms.uThickness.value, 1.5); assert.equal(pass.uniforms.uResolution.value.y, 1080);
assert.ok(/uDepthMix/.test(pass.material.fragmentShader) && /linearDepth/.test(pass.material.fragmentShader) && /normalAt/.test(pass.material.fragmentShader));
assert.throws(() => screenEdges({ normals, depth: new Float32Array(3), w, h }));
console.log('PASS CPU 参考：剪影/折痕/平面无线、depthMix=0 只留法线反差、外圈淡出、线宽×DPR；GPU 类 uniform 换算（未做浏览器渲染）', JSON.stringify({ width1: widthOf(full), width2: 2 * widthOf(full) }));
