// 第 56 批 C11 · 1783792917183606829「Texture test!」岸缘贴图：球面有向距离场 + 陆侧暗带 / 平行浪线 / 沙滩 / 两色草块
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const W = await import('../src/sphere/worldmap.js');
const S = await import('../src/sphere/worldmap-shore.js');
const { worldMapTexture } = await import('../src/sphere/worldmap-material.js');

// ① 合成图：赤道带一块经度 [0.4,0.6]·2π 的陆地条 → 距离按 cos(lat)·Δlon 量，且经度回绕
const w = 200, h = 100, land = new Uint8Array(w * h);
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (i >= 80 && i < 120) land[j * w + i] = 1;
const { dist } = S.shoreDistance({ w, h, land });
const dl = Math.PI * 2 / w, eq = h / 2;
const at = (i, j) => dist[j * w + i];
assert.ok(Math.abs(at(100, eq) - (20 - .5) * dl * Math.cos(.5 * Math.PI / h)) < dl * .6, `陆地中线到海岸 ≈ 19.5 格（${(at(100, eq) / dl).toFixed(2)}）`);
assert.ok(at(60, eq) > at(70, eq) && at(70, eq) > at(78, eq), '海里离岸越远距离越大');
// 回绕：i=0 与 i=199 对 i=80 的距离（经 0 回绕到 199→… 远离；海宽 160 格，中点在 i=0 附近）
assert.ok(Math.abs(at(0, eq) - at(199, eq)) < dl * 1.5, '经度 0/2π 接缝两侧距离连续');
// 高纬度：同样的经度格数，球面距离按 cos(lat) 变短
const jHi = 8; assert.ok(at(100, jHi) < at(100, eq) * .6, '高纬度经向距离按 cos(lat) 缩短');

// ② 真图：四种岸缘角色都出现，比例合理
const map = W.buildWorldMap({ w: 256, h: 128, seed: 7 });
const col = S.worldMapShoreColors(map);
const R = col.roles, total = w * h;
assert.equal(col.rgba.length, 256 * 128 * 4);
for (const k of ['wave', 'rim', 'sand', 'grass', 'grass2']) assert.ok(R[k] > 0, `有 ${k}`);
assert.ok(R.rim < R.grass + R.grass2 && R.wave < R.sea * .2, `暗带只在岸边、浪线只占海的一小部分 ${JSON.stringify(R)}`);
// 浪线像素都在海里、离岸 < (waves+1)·gap；暗带都在陆上近岸
const D = S.shoreDistance(map).dist; let waveFar = 0, rimFar = 0;
for (let k = 0; k < map.w * map.h; k++) {
  const c = [col.rgba[k * 4], col.rgba[k * 4 + 1], col.rgba[k * 4 + 2]];
  const isWave = !map.land[k] && c[0] > 150 && c[1] > 190; if (isWave && D[k] > 4 * .022) waveFar++;
  const isRim = map.land[k] && c[1] < 120; if (isRim && D[k] > .05) rimFar++;
}
assert.equal(waveFar, 0, '浪线不出离岸带'); assert.equal(rimFar, 0, '暗带不深入内陆');

// ③ 材质入口：默认仍是 r55 配色；shore:true 走岸缘配色
const a = worldMapTexture({ w: 64, h: 32, seed: 7 }), b = worldMapTexture({ w: 64, h: 32, seed: 7, shore: true });
const ref = W.worldMapColors(W.buildWorldMap({ w: 64, h: 32, seed: 7 }));
assert.deepEqual(Array.from(a.colors.rgba), Array.from(ref.rgba), '默认配色与 r55 逐值一致');
assert.ok('wave' in b.colors.roles && !('wave' in a.colors.roles), 'shore:true 用岸缘配色');
console.log('PASS worldmap-shore', JSON.stringify(R));
