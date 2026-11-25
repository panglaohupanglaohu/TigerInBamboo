// r214（1852334860137849222 残差补全）：裁判云风材质 + 前景云深度层 + 蓬松云烘焙
//   · ImpostorField 新 uniform（uWindAmt/uCloudParallax）默认 0 → 旧行为逐位保留
//   · 非 HORIZON 云分支：cd 视差 + engine cloudWindBob 起伏（im[3].xyz 实例相位）
//   · impostor-c09 球面补丁锚点仍匹配共享着色器
//   · vegetation 近云落点按 nearCloudDepth 分层、cloud-shadow CPU 镜像同式
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { ImpostorField } = await import('../src/life/impostor.js');
const C = await import('../src/life/impostor-c09.js');
const { cloudDrift, cloudWindBob, nearCloudDepth, CLOUD_WIND_AMT } = await import('../src/core/cloud-motion.js');

const baked = { frames: Array.from({ length: 8 * 4 }, (_, i) => (i % 4) / 10), size: 2, center: new THREE.Vector3(0, .4, 0), pitches: [.42] };

// ── ① 默认值零侵入：两个新 uniform 都是 0 → 着色器路径逐位等同旧行为
const f = new ImpostorField(null, baked, 4, { cloud: true });
assert.equal(f.material.uniforms.uWindAmt.value, 0, 'windAmt 默认 0');
assert.equal(f.material.uniforms.uCloudParallax.value, 0, 'cloudParallax 默认 0');
const vs = f.material.vertexShader;
assert.ok(vs.includes('cloudWindBob(uTime, im[3].xyz, uWindAmt)'), '近云分支含裁判风起伏（实例位置相位）');
assert.ok(vs.includes('float cd = mix(1.0, max(1.0, aCloudDepth), uCloudParallax);'), '近云分支含深度视差 cd');
assert.ok(vs.includes('cloudDrift(uTime,aYaw) / cd'), '漂移按 1/cd 减速');
assert.ok(vs.includes('vec3 cloudWindBob'), 'GLSL 风函数已注入');
const tree = new ImpostorField(null, baked, 4);
assert.ok(tree.material.vertexShader.includes('uniform float uWindAmt'), 'uniform 声明对所有 Field 存在（CLOUD=0 分支不执行）');
assert.equal(tree.material.uniforms.uWindAmt.value, 0, '树默认无风起伏');

// ── ② CPU 位移模型：与着色器同式（center = im·uCenter 后：drift/cd + bob/cd）
const displace = (center, t, yaw, depth, { amt = 0, par = 0 } = {}) => {
  const cd = 1 + par * Math.max(0, depth - 1), [bx, by, bz] = cloudWindBob(t, center[0], center[2], amt);
  return [center[0] + cloudDrift(t, yaw) / cd + bx / cd, center[1] + by / cd, center[2] + bz / cd];
};
// parallax=0 + amt=0 → 逐位等同旧公式
for (let i = 0; i < 200; i++) { const t = i * .91 - 40, yaw = i * .017, c = [i % 7 - 3, 5, i % 5 - 2];
  const d = displace(c, t, yaw, 1 + (i % 3));
  assert.ok(Math.abs(d[0] - (c[0] + cloudDrift(t, yaw))) < 1e-12 && d[1] === c[1] && d[2] === c[2], 'defaults = old behaviour'); }
// parallax=1：depth=2 的位移增量恰好减半（取无回绕窗口）
{
 const c = [3, 5, -2], t0 = 4, t1 = 8, yaw = .3;
 const dx1 = displace(c, t1, yaw, 1, { par: 1 })[0] - displace(c, t0, yaw, 1, { par: 1 })[0];
 const dx2 = displace(c, t1, yaw, 2, { par: 1 })[0] - displace(c, t0, yaw, 2, { par: 1 })[0];
 assert.ok(Math.abs(dx2 / dx1 - .5) < 1e-12, 'depth=2 漂移增量减半 ' + (dx2 / dx1));
}
// amt=0.6：y/z 也动（旧版只动 x），起伏被 cd 同步缩小
{
 const c = [3, 5, -2];
 const a = displace(c, 2, .3, 1, { amt: CLOUD_WIND_AMT, par: 1 }), b = displace(c, 9, .3, 1, { amt: CLOUD_WIND_AMT, par: 1 });
 assert.ok(Math.abs(a[1] - b[1]) > 1e-6 || Math.abs(a[2] - b[2]) > 1e-6, '云沿 y/z 起伏');
 const d2 = displace(c, 2, .3, 2, { amt: CLOUD_WIND_AMT, par: 1 });
 assert.ok(Math.abs(d2[1] - c[1]) <= CLOUD_WIND_AMT * .25 / 2 + 1e-12, '外层起伏同步减半');
}

// ── ③ 球面补丁锚点仍匹配：DRIFT_SRC 覆盖新两行 → 球面云无世界轴漂/起伏
const lu = C.localUpImpostorField(null, { ...baked }, 4, { cloud: true, sphere: true });
assert.ok(!lu.material.vertexShader.includes('center.x += cloudDrift'), '球面云无世界 X 漂移');
assert.ok(!lu.material.vertexShader.includes('cloudWindBob(uTime, im[3].xyz'), '球面云无世界轴起伏');
assert.throws(() => C.patchLocalUp('void main(){}'), /anchor missing/, '锚点缺失仍报错');

// ── ④ 植被接线（源码口径）：裁判幅度 + 视差开 + 蓬松云烘焙 + 分层落点
const vegSrc = readFileSync(join(root, 'src/life/vegetation.js'), 'utf8');
assert.ok(vegSrc.includes('windAmt: CLOUD_WIND_AMT') && vegSrc.includes('cloudParallax: 1'), '近云 Field 开裁判风材质与视差');
assert.ok(vegSrc.includes('baker.bake(fluffyCloudGeometry(7), 256, { vertexColors: true })'), '近云换蓬松菜花云烘焙');
assert.ok(vegSrc.includes('patchBakedCloudColor('), '近云片元用烘焙顶点色（灰蓝底/暖白顶）');
assert.ok(vegSrc.includes('nearCloudDepth(r, R)'), '近云落点按半径分层');
// ── ⑤ 云影 CPU 镜像与着色器同式（漂移/起伏同除 cd）
const shSrc = readFileSync(join(root, 'src/light/cloud-shadow.js'), 'utf8');
assert.ok(shSrc.includes('cloudDrift(time,f.yaw.getX(i))/cd') && shSrc.includes('cloudWindBob(time,e[12],e[14],amt)'), '云影镜像含 cd 与 bob');
console.log('PASS cloud wind material + depth parallax: uniforms default-off, engine bob CPU mirror, sphere anchors, veg/shadow wiring');
