// r55 G5: REACode squigglefield.js → ornament.html 换用。卷草胶囊场（REACode buildOrnament 版式）
// 一次烘焙、着色器里四折镜像 + 扭动相位；验证烘焙与逐段暴力一致、相位只挪边不改墨量、ornament 材质开关。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const F = await import('../src/core/ornament-field.js');
const segs = F.squiggleOrnament();
assert.ok(segs.length >= 45 && segs.every((s) => s.x0 >= 0 && s.x1 >= 0 && s.r > 0), '只摆右半（大卷草下摆越过 v=0 由折叠镜像，同 REACode）');
assert.ok(segs.every((s) => Math.max(s.x0, s.x1) + s.r < F.SQUIGGLE_EXTENT.w && Math.max(Math.abs(s.y0), Math.abs(s.y1)) + s.r < F.SQUIGGLE_EXTENT.h), '版式落在烘焙范围内');
const baked = F.bakeSquiggleField(segs);
assert.ok(baked.bucketShare < .4, '桶加速：每像素只测部分胶囊 ' + baked.bucketShare);
// 烘焙 == 逐段暴力（墨带内，量化误差内）
let maxErr = 0, n = 0;
for (let y = 0; y < baked.h; y += 3) for (let x = 0; x < baked.w; x += 3) {
  const u = (x + .5) / baked.w * baked.extent.w, v = (y + .5) / baked.h * baked.extent.h, brute = F.squiggleSdf(segs, u, v, { amp: 0 }).d;
  if (brute < .05) { n++; maxErr = Math.max(maxErr, Math.abs(baked.field[y * baked.w + x] - brute)); }
}
assert.ok(n > 500 && maxErr < 1e-6, '烘焙场（Float32）与逐段暴力一致 ' + maxErr);
// 着色器镜像：四折、解码误差、相位
assert.equal(F.squiggleShadeSdf(baked, .2, -.1, { t: .3 }), F.squiggleShadeSdf(baked, -.2, .1, { t: .3 }), '四折镜像');
let dec = 0; for (const [x, y] of [[.1, .085], [.3, .05], [.415, .1], [.24, .16]]) dec = Math.max(dec, Math.abs(F.squiggleShadeSdf(baked, x, y, { amp: 0 }) - F.squiggleSdf(segs, x, y, { amp: 0 }).d));
assert.ok(dec < .003, '8 位解码 + 双线性误差 < 0.003 世界单位 ' + dec);
const ink = (t, amp = .005) => { let k = 0, moved = 0; for (let j = 0; j < 160; j++) for (let i = 0; i < 320; i++) { const x = -.52 + 1.04 * (i + .5) / 320, y = -.26 + .52 * (j + .5) / 160, a = F.squiggleShadeSdf(baked, x, y, { amp, t }) < 0; if (a) k++; if (a !== (F.squiggleShadeSdf(baked, x, y, { amp, t: t + 1.3 }) < 0)) moved++; } return { k, moved }; };
const i0 = ink(0), i1 = ink(1.7), still = ink(0, 0);
assert.ok(i0.moved > 300, '相位推进时边在爬 ' + i0.moved);
assert.equal(still.moved, 0, 'amp=0 时不动');
assert.ok(Math.abs(i0.k - i1.k) / i0.k < .08, '相位只挪边，不改墨量 ' + i0.k + ' ' + i1.k);
// GPU 材质：与 CPU 同一份扭动公式
assert.ok(F.SQUIGGLE_WOBBLE_GLSL.includes('freq*3.7*3.14159265359-t*3.3') && F.SQUIGGLE_WOBBLE_GLSL.includes('t*2.1'), 'GLSL 与 JS 扭动同式');
const { createSquiggleOrnament, createOrnament } = await import('../src/ui/ornament.js');
const sq = createSquiggleOrnament();
assert.ok(sq.material.fragmentShader.includes('squiggleWobble(p,amp,freq,phase)') && sq.material.fragmentShader.includes('abs(world)'));
sq.set({ phase: 2, amp: .008, width: 800, height: 400 }); assert.equal(sq.uniforms.phase.value, 2); assert.equal(sq.uniforms.panel.value.x, 800);
assert.throws(() => sq.set({ amp: .5 }), RangeError);
assert.equal(sq.baked.rgba.length, 256 * 128 * 4);
createOrnament().dispose(); sq.dispose(); assert.throws(() => sq.set({}), /disposed/);
// ornament.html 换用：默认关，?squiggle=1 / 复选框打开
const html = readFileSync(join(root, 'ornament.html'), 'utf8');
assert.ok(html.includes('createSquiggleOrnament') && html.includes("qs.get('squiggle')==='1'") && html.includes('id="squiggle" type="checkbox"') && !/id="squiggle" type="checkbox" checked/.test(html), 'ornament.html 接入且默认关');
console.log('PASS squiggle ornament', { segs: segs.length, bucketShare: +baked.bucketShare.toFixed(3), decodeErr: +dec.toFixed(4), ink0: i0.k, ink17: i1.k, moved: i0.moved });
