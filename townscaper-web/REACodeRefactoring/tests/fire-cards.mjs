// r53 G4: REACode smokefx.js makeFlame — flame cards with one noise sample, UV roll, mip along age,
// pulled-in cutoff rim, MAX blend kept, plus a firelight that follows live flame mass.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { fireCard, fireLightLevel, fireCardGLSL } = await import('../src/core/smoke-order.js');
const { Effects, popShaderChunk, fireNoiseTexture } = await import('../src/life/effects.js');

// card mask: interior solid, a rim band exists, tip (age 1) narrower than base (age 0)
const row = (age, n) => Array.from({ length: 101 }, (_, i) => fireCard(i / 100, .5, age, n));
const base = row(0, .8), tip = row(1, .8);
const width = (r) => r.filter((v) => v.alpha > .5).length;
assert.ok(base[50].alpha > .99 && base[50].rim < .01, 'solid centre');
assert.ok(base.some((v) => v.rim > .2), 'pulled-in cutoff leaves a rim band');
assert.ok(width(tip) < width(base), `tip narrower ${width(tip)} < ${width(base)}`);
assert.ok(fireCard(.5, .5, 0, .1).alpha < fireCard(.5, .5, 0, .9).alpha + 1e-9, 'noise breaks the body');
assert.ok(fireCardGLSL.includes('vec2 fireCard'));
assert.throws(() => fireCard(NaN, 0, 0, 0));

// noise texture tiles (wrap continuity) and has mips
const tex = fireNoiseTexture(), d = tex.image.data, S = tex.image.width;
let seam = 0, inner = 0;
for (let y = 0; y < S; y++) { seam += Math.abs(d[(y * S) * 4] - d[(y * S + S - 1) * 4]); inner += Math.abs(d[(y * S + 31) * 4] - d[(y * S + 32) * 4]); }
assert.ok(seam < inner * 3 + S * 4, `tiling seam ${seam} vs interior step ${inner}`);
assert.ok(tex.generateMipmaps && tex.minFilter === THREE.LinearMipmapLinearFilter && tex.wrapS === THREE.RepeatWrapping);

// live Effects: attributes, shader wiring, light following mass
const scene = new THREE.Scene(), uTime = { value: 0 };
let seed = 1; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const e = new Effects({ scene, uTime, popUniforms: popShaderChunk().uniforms, random });
const roll = e.fire.geometry.getAttribute('aRoll').array;
assert.ok(roll.some((v) => v > .3) && roll.some((v) => v < -.3), 'UV roll forward and backward');
const fs = e.fire.material.fragmentShader;
assert.ok(fs.includes('fireCard(pc, vAge, n)') && /texture2D\(uFireNoise, nuv, vAge \* uMipBias\)/.test(fs), 'one noise sample per card, mip grows with age');
assert.equal(e.fire.material.blendEquation, THREE.MaxEquation, 'MAX blend kept');
assert.equal(e.fireLight.visible, false);
e.showFire = true; e.setFireSources([{ x: 1, y: 2, z: 3 }]);
for (let i = 0; i < 40; i++) { uTime.value += 1 / 30; e.update(1 / 30, new THREE.Vector3(1, 0, 0)); }
assert.ok(e.fireLight.visible && e.fireLight.intensity > .2, 'burning fire lights its surroundings ' + e.fireLight.intensity);
assert.ok(Math.abs(e.fireLight.position.x - 1) < 1e-9 && e.fireLight.position.y > 2);
const lit = e.fireLight.intensity;
assert.ok(fireLightLevel(e.fsize.map((v) => v * .5), e.fage, uTime.value) < lit, 'smaller flame mass → dimmer light');
assert.equal(fireLightLevel([.1], [1], 0), 0, 'expired cards emit nothing');
e.setFireSources([]);
assert.equal(e.fireLight.visible, false); assert.equal(e.fireLight.intensity, 0);
e.dispose();
console.log('PASS flame cards + firelight', { baseWidth: width(base), tipWidth: width(tip), light: +lit.toFixed(3) });
