// 第 55 批 G2：1664565063552847873 GPU 平流实测（src/world/float-advect-gpu.js）。
// node 里没有 GPU：这里验证 ①无 WebGL2 时安全返回；②GPU 着色器与 CPU advect 用同一公式（速度场、clamp、纹素中心）；
// ③浏览器实测结果（artifacts/coverage/shots-r55/g2-floatprobe-gpu.json，headless Chromium SwiftShader）满足：GPU ≈ CPU 同格式仿真。
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
const { gpuAdvectionQuality, GPU_VARIANTS } = await import('../src/world/float-advect-gpu.js');
const { advect, seedBlob } = await import('../src/core/float-advect.js');
assert.deepEqual(gpuAdvectionQuality(), { webgl2: false, rows: [], scope: 'no-webgl2' });
assert.deepEqual(GPU_VARIANTS.map((v) => v.internal + '/' + v.filter), ['RGBA32F/linear', 'RGBA16F/linear', 'RGBA8/linear', 'RGBA32F/nearest']);
const src = readFileSync(join(root, 'src/world/float-advect-gpu.js'), 'utf8');
assert.match(src, /vec2 vel = vec2\(-\(uv\.y - \.5\) \* spin, \(uv\.x - \.5\) \* spin\)/, '与 CPU advect 默认速度场同式');
assert.match(src, /texture\(src, uv - vel \* dt\)/); assert.match(src, /CLAMP_TO_EDGE/);
// CPU 侧：同格式仿真自身对参考的误差排序（f32 < f16 < u8）——GPU 行应复现同一排序
const s = seedBlob(32), ref = advect(s, { size: 32, steps: 60, dt: .02, storage: 'f64' });
const e = (st) => { const o = advect(s, { size: 32, steps: 60, dt: .02, storage: st }); let l = 0; for (let i = 0; i < o.length; i++) l += Math.abs(o[i] - ref[i]); return l / o.length; };
assert.ok(e('f32') < e('f16') && e('f16') < e('u8'));
const file = join(root, 'artifacts/coverage/shots-r55/g2-floatprobe-gpu.json');
if (existsSync(file)) {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(r.rows.length, 4); assert.ok(r.rows.every((x) => x.ok));
  const by = Object.fromEntries(r.rows.map((x) => [x.internal + '/' + x.filter, x]));
  assert.ok(by['RGBA32F/linear'].vsReference.meanAbsError < 1e-6, 'f32 GPU 几乎等于 f64 参考');
  assert.ok(by['RGBA16F/linear'].vsEmulated.meanAbsError < by['RGBA16F/linear'].vsReference.meanAbsError / 50, 'f16：CPU 仿真能代表 GPU（误差比参考小两个量级）');
  assert.equal(by['RGBA8/linear'].vsEmulated.maxAbsError, 0, 'u8 与 CPU 仿真逐位一致');
  assert.equal(by['RGBA32F/nearest'].vsEmulated.maxAbsError, 0, 'nearest 与 CPU 仿真逐位一致');
  console.log('browser rows:', r.renderer, r.rows.map((x) => `${x.internal}/${x.filter} ref=${x.vsReference.meanAbsError.toExponential(2)} emu=${x.vsEmulated.meanAbsError.toExponential(2)}`).join(' | '));
} else console.log('（未找到浏览器结果 JSON，只跑了 node 部分）');
console.log('PASS float-advect-gpu');
