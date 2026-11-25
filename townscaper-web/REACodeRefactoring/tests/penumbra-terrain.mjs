// 第 55 批 G2：体素半影接到地形/悬挑接收面（penumbra-terrain.js）。打包纹理 = bakeVoxelPenumbra 接收者；着色器链在 View 地形材质之后。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { buildCellIndex } = await import('../src/core/spatial.js');
const { generateModulePatch } = await import('../src/core/module-patch.js');
const { bakeVoxelPenumbra } = await import('../src/light/penumbra.js');
const { packPenumbraReceivers, samplePacked, PenumbraTerrain, PENUMBRA_TERRAIN_GLSL } = await import('../src/world/penumbra-terrain.js');
const vertices = [], faces = []; for (let x = 0; x <= 8; x++) for (let z = 0; z <= 6; z++) vertices.push([x, z]); for (let x = 0; x < 8; x++) for (let z = 0; z < 6; z++) { const a = x * 7 + z; faces.push([a, a + 7, a + 8, a + 1]); }
const g = generateModulePatch({ vertices, faces }), world = new World(g), index = buildCellIndex(g); world.cells.forEach((c) => world.fill(c, 1, { rock: true }));
for (const c of world.cells.filter((c) => c.cx > 3 && c.cx < 6 && c.cz > 2 && c.cz < 4)) world.setSolid(c, 4, true);   // 悬挑板
for (const c of world.cells.filter((c) => c.cx > 6.5 && c.cz < 2)) world.fill(c, 3, { rock: true });                    // 一座高台
const sun = [.15, 1, .1], f = bakeVoxelPenumbra(world, index, sun, { L: .5, res: .25 }), p = packPenumbraReceivers(f);
assert.equal(p.width, f.nx); assert.equal(p.height, f.nz * f.ny);
let maxErr = 0; for (const r of f.receivers) maxErr = Math.max(maxErr, Math.abs(samplePacked(p, f, f.minX + (r.x + .5) * f.res, r.y * f.L, f.minZ + (r.z + .5) * f.res) - r.alpha));
assert.ok(maxErr <= 1 / 255 + 1e-9, '每个接收者打包后可按 (x, round(y/L), z) 取回 ' + maxErr);
// 悬挑：同一列两个接收面，板下地面在影里、板顶不在
const under = samplePacked(p, f, 4.5, .5, 3.5), top = samplePacked(p, f, 4.5, 2, 3.5);
assert.ok(under > .5 && top === 0, '板下 ' + under + ' / 板顶 ' + top);
assert.ok(f.stats.multiReceiverColumns > 0);
// 材质链：原 onBeforeCompile 先跑，再把 penumbraTone 乘进 outgoingLight
const mat = new THREE.MeshStandardMaterial(); let orig = 0;
mat.onBeforeCompile = (sh) => { orig++; sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight*=cloudShadowTone(vWPos);\n#include <opaque_fragment>'); };
mat.customProgramCacheKey = () => 'base';
const shadowCatcher = { visible: true }, view = { levelHeight: .5, material: mat, mesh: { receiveShadow: true }, town: world, index, sunDir: new THREE.Vector3(...sun).normalize(), penumbra: null, setPenumbra(on) { this.penumbra = on ? {} : null; }, requestShadowUpdate() {} };
const pt = new PenumbraTerrain(view);
const sh = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader, vertexShader: '' };
mat.onBeforeCompile(sh); assert.equal(orig, 1);
assert.ok(sh.fragmentShader.includes(PENUMBRA_TERRAIN_GLSL.trim().slice(0, 40)));
assert.ok(sh.fragmentShader.indexOf('cloudShadowTone') < sh.fragmentShader.indexOf('penumbraTone(vWPos'), '在原有链之后');
assert.equal(mat.customProgramCacheKey(), 'base|penumbra-terrain');
assert.equal(sh.uniforms.uPenOn.value, 0, '默认关');
pt.setEnabled(true);
assert.equal(view.mesh.receiveShadow, false, '开：半影替代 PCF 接收'); assert.ok(view.penumbra, '水面半影层一起开');
assert.equal(sh.uniforms.uPenOn.value, 1); assert.deepEqual(sh.uniforms.uPenDims.value.toArray(), [pt.field.nx, pt.field.nz, pt.field.ny]);
const v0 = pt.texture; pt.refresh(); assert.equal(pt.texture, v0, '世界与太阳不变不重烘');
view.sunDir.set(.5, .8, .1).normalize(); pt.refresh(); assert.notEqual(pt.texture, v0, '太阳变了重烘');
pt.setEnabled(false); assert.equal(view.mesh.receiveShadow, true); assert.equal(view.penumbra, null); assert.equal(sh.uniforms.uPenOn.value, 0);
// dispose：材质补丁/缓存键还原、纹理销毁、可重复调用
pt.setEnabled(true); const tex = pt.texture; assert.ok(tex);
let disposed = 0; tex.addEventListener?.('dispose', () => disposed++); const origDispose = tex.dispose.bind(tex); tex.dispose = () => { disposed++; origDispose(); };
pt.dispose();
assert.ok(disposed >= 1, '打包纹理被 dispose'); assert.equal(pt.texture, null);
const sh2 = { uniforms: {}, fragmentShader: 'A#include <common>B#include <opaque_fragment>', vertexShader: '' };
mat.onBeforeCompile(sh2);
assert.equal(orig, 2, 'dispose 后材质补丁还原为原链');
assert.ok(!sh2.fragmentShader.includes('penumbraTone'), '还原后不再注入半影着色');
assert.equal(mat.customProgramCacheKey(), 'base', 'cacheKey 还原');
assert.equal(pt.uniforms.uPenOn.value, 0); assert.equal(pt.uniforms.uPenTex.value, null);
pt.dispose();   // 幂等
console.log('PASS penumbra-terrain: receivers packed per level (max err', maxErr.toFixed(4) + '), overhang two receivers, material chain, toggle restores PCF/water layer, dispose restores material+texture');
