// 第 56 批 C11：1580835075629133825 / 1580845127207387137 / 1580846877855338497
// SDF(UV) → mega texture ↔ 六向光体积 往返反弹（src/light/megatexture-gi.js）+ View 接入（src/world/view-c11-megagi.js）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { buildScene } = await import('../src/world/scenes.js');
const { PALETTES } = await import('../src/core/palette.js');
const { firstVoxelHit } = await import('../src/core/voxel-ray.js');
const M = await import('../src/light/megatexture-gi.js');
const D = await import('../src/light/megatexture-gi-debug.js');

const g = decorateCells(buildQuadGrid({ radius: 14, hexSize: 1 })), index = buildCellIndex(g), w = new World(g); w.palette = PALETTES.town; buildScene(w, 'terrain', 7);
const albedoOf = (c, lv) => w.isRock(c, lv) ? (lv === w.top(c) ? [.5, .6, .34] : [.6, .58, .55]) : [.9, .85, .8];
const version = w.version;
const r = M.bakeMegaTextureGI(w, index, { albedoOf, bounces: 6, keepSnapshots: true });
const { vox, mega, sdfuv } = r;

// ① mega texture：每个暴露面恰好一个纹素；图集无重叠；纹素 ↔ 图集像素互逆
let exposed = 0;
for (let k = 0; k < vox.N; k++) if (vox.solid[k]) for (let d = 0; d < 6; d++) {
  const x = k % vox.nx, y = Math.floor(k / vox.nx) % vox.ny, z = Math.floor(k / (vox.nx * vox.ny)), q = [x, y, z].map((v, i) => v + [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][d][i]);
  if (q.some((v, i) => v < 0 || v >= [vox.nx, vox.ny, vox.nz][i])) continue;
  if (!vox.solid[vox.id(...q)]) { exposed++; assert.ok(mega.faceTex[k * 6 + d] >= 0, 'exposed face has a texel'); }
}
assert.equal(exposed, mega.count, 'texels = exposed faces');
const seenPx = new Set();
for (let t = 0; t < mega.count; t++) { const px = mega.px[t * 2] + mega.px[t * 2 + 1] * mega.W; assert.ok(!seenPx.has(px), 'no overlap'); seenPx.add(px); assert.equal(mega.atlas[px], t); }
const fill = mega.count / (mega.W * mega.H);
assert.ok(fill > .2, 'atlas fill ' + fill.toFixed(3));

// ② SDF 体积：A = voxel-distance 有符号距离；RG 解码回纹素 = BFS 最近纹素；贴面空格的 RG 指向它贴着的那张面之一
for (let k = 0; k < vox.N; k += 7) { assert.equal(sdfuv.rgba[k * 4 + 3], sdfuv.sdf.signed[k]); if (!vox.solid[k] && sdfuv.near[k] >= 0) assert.equal(sdfuv.texelAtUV(sdfuv.rgba[k * 4], sdfuv.rgba[k * 4 + 1]), sdfuv.near[k]); }
let seedOK = 0, seedN = 0;
for (let t = 0; t < mega.count; t += 3) {
  const k = mega.voxel[t], d = mega.dir[t], A = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][d], q = vox.id(k % vox.nx + A[0], Math.floor(k / vox.nx) % vox.ny + A[1], Math.floor(k / (vox.nx * vox.ny)) + A[2]);
  const tq = sdfuv.texelAtUV(sdfuv.rgba[q * 4], sdfuv.rgba[q * 4 + 1]); seedN++;
  // 贴面空格的 RG 指向的纹素必须是该空格某个邻面（可能不是 t 本身：一个空格可贴多张面）
  const kq = mega.voxel[tq], dq = mega.dir[tq], Aq = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][dq];
  if (vox.id(kq % vox.nx + Aq[0], Math.floor(kq / vox.nx) % vox.ny + Aq[1], Math.floor(kq / (vox.nx * vox.ny)) + Aq[2]) === q) seedOK++;
}
assert.equal(seedOK, seedN, 'surface-adjacent RG references an adjacent face');

// ③ 射线：SDF 球步进 + DDA 与纯 DDA（firstVoxelHit）命中同一格（球步进不跳墙）
const trace = M.makeTracer(vox, sdfuv.sdf);
let rng = 9; const rnd = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
let same = 0, nRays = 0, anyHit = 0;
for (let i = 0; i < 1500; i++) {
  const o = [vox.minX + rnd() * vox.nx * vox.res, rnd() * vox.ny * vox.dy, vox.minZ + rnd() * vox.nz * vox.res], vk = vox.id(Math.floor((o[0] - vox.minX) / vox.res), Math.floor(o[1] / vox.dy), Math.floor((o[2] - vox.minZ) / vox.res));
  if (vox.solid[vk]) continue;
  let d = [rnd() - .5, rnd() - .5, rnd() - .5]; const l = Math.hypot(...d); d = d.map((x) => x / l);
  const h = trace(o, d, 4), A = [(o[0] - vox.minX) / vox.res, o[1] / vox.dy, (o[2] - vox.minZ) / vox.res], B = [A[0] + d[0] * 4 / vox.res, A[1] + d[1] * 4 / vox.dy, A[2] + d[2] * 4 / vox.res];
  const ref = firstVoxelHit(vox.solid, vox, A, B); nRays++; if (ref >= 0) anyHit++;
  if (ref === h.hit) same++;
}
assert.ok(same / nRays > .995 && anyHit > 100, `tracer agrees with DDA ${same}/${nRays}`);

// ④ 反弹：往返迭代变化递减；第 3 轮相对变化 < 2%（原文「about the 3rd bounce … not noticeable」，本场景实测）
const rc = r.bounceStats.map((b) => b.relativeChange);
for (let i = 2; i < rc.length; i++) assert.ok(rc[i] < rc[i - 1], 'monotone decay');
assert.ok(rc[2] < .02 && rc[1] < .1, 'bounce 3 rel change ' + rc[2]);
assert.ok(r.stats.uvMatchRate > .7, 'SDF-UV hit = exact crossed face ' + r.stats.uvMatchRate);
assert.equal(r.snapshots.length, 2 + 2 * 6); assert.equal(r.snapshots[0].stage, 'reset'); assert.ok(r.snapshots[0].exitance.every((x) => x === 0));
assert.ok(r.snapshots[1].lv.every((x) => x === 0) && r.snapshots[1].exitance.some((x) => x > 0), 'direct: texture lit, volume still black');

// ⑤ 与暴力参考（每纹素 64 条余弦射线、直接取精确穿越面、不经 SDF-UV/光体积）对照
const ref = M.referenceTexelBounce(r, { rays: 64, bounces: 6 });
const pr = M.pearson(Array.from(r.indirect), Array.from(ref.indirect)), ratio = r.indirect.reduce((s, x) => s + x, 0) / ref.indirect.reduce((s, x) => s + x, 0);
assert.ok(pr > .75 && ratio > .75 && ratio < 1.25, `vs reference r=${pr.toFixed(3)} ratio=${ratio.toFixed(3)}`);

// ⑥ 太阳：被遮挡纹素直射为 0；同一纹素反照率变暗 → 邻近间接光下降（反馈确实来自 mega texture）
const blocked = Array.from({ length: mega.count }, (_, t) => t).filter((t) => { const n = mega.nrm.subarray(t * 3, t * 3 + 3), S = [.4, .8, .45]; return n[0] * S[0] + n[1] * S[1] + n[2] * S[2] > 0 && r.direct[t * 3] === 0; });
assert.ok(blocked.length > 20, 'some sun-facing texels are shadowed');
// 关掉天光，间接光只剩表面反弹：反照率 ×0.3 → 间接光显著下降（反馈确实来自 mega texture 的出射光）
const sum = (a) => a.reduce((s, x) => s + x, 0), noSky = M.bakeMegaTextureGI(w, index, { albedoOf, bounces: 3, skyIntensity: 0 }), dark = M.bakeMegaTextureGI(w, index, { albedoOf: (c, lv) => albedoOf(c, lv).map((x) => x * .3), bounces: 3, skyIntensity: 0 });
assert.ok(sum(noSky.indirect) > 0 && sum(dark.indirect) < sum(noSky.indirect) * .5, 'darker albedo → less bounce ' + (sum(dark.indirect) / sum(noSky.indirect)).toFixed(3));
assert.equal(w.version, version, 'World untouched');

// ⑦ 调试图尺寸
const si = D.sdfImage(r), li = D.lightVolumeImage(r), mi = D.megaTextureImage(r);
assert.equal(si.data.length, si.w * si.h * 4); assert.equal(li.data.length, li.w * li.h * 4); assert.equal(mi.w, mega.W);

// ⑧ View 接入：bakeGI 换成 mega 烘焙、写 aGI、giOn=1；关闭还原；慢放阶段
const { install } = await import('../src/world/view-c11-megagi.js');
const geo = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(); geo.translate(0, 1.5, 0);
const origBake = () => 'orig';
const view = { town: w, index, levelHeight: .5, sunDir: new THREE.Vector3(.4, .8, .45).normalize(), sun: { color: new THREE.Color(1, 1, 1), intensity: 2 }, ambient: { intensity: 1 }, hemi: { intensity: 1 }, giOn: { value: 0 }, mesh: new THREE.Mesh(geo), bakeGI: origBake };
const gi = install(view);
gi.set(true);
assert.equal(view.giOn.value, 1); assert.notEqual(view.bakeGI, origBake); assert.ok(view.mesh.geometry.attributes.aGI.array.some((x) => x > 0), 'aGI written');
assert.ok(view.giStats.megatexture && view.giStats.texels > 0);
gi.options({ keepSnapshots: true, bounces: 3 });
const s0 = gi.showStage(0); assert.equal(s0.stage, 'reset'); assert.equal(view.sun.intensity, 0); assert.ok(view.mesh.geometry.attributes.aGI.array.every((x) => x === 0));
gi.showStage(1); assert.equal(view.sun.intensity, 2); assert.equal(view.ambient.intensity, 0);
gi.showStage(2); assert.ok(view.mesh.geometry.attributes.aGI.array.some((x) => x > 0), 'volume stage fills');
gi.endStages(); assert.equal(view.ambient.intensity, 1); assert.equal(view.hemi.intensity, 1);
gi.set(false); assert.equal(view.bakeGI, origBake); assert.equal(view.giOn.value, 0);

console.log('PASS megatexture-gi', JSON.stringify({ texels: mega.count, atlas: [mega.W, mega.H], fill: +fill.toFixed(3), charts: mega.charts, tracerAgree: `${same}/${nRays}`, uvMatch: +r.stats.uvMatchRate.toFixed(3), relChange: rc.map((x) => +x.toFixed(4)), refPearson: +pr.toFixed(3), refRatio: +ratio.toFixed(3), shadowedSunTexels: blocked.length, ms: r.stats.ms }));
