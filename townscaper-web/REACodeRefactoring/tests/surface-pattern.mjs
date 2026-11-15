// engine/surface.js → src/terrain/surface-pattern.js：像素宽细线/缩小淡出、法线混合 patch、弯曲层理、田野干涉线、坡面草、链式材质 API。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const S = await import('../src/terrain/surface-pattern.js');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');

// 1) 像素宽细线：放大时线宽（像素）不随距离变（1241096929490149376 "crisp antialiasing up close"）
const widthPx = (fp) => { let on = 0, n = 0; for (let y = 0; y < 1 / 5.4; y += fp / 8) { n++; if (S.spLine1(y * 5.4, 5.4 * fp, 1.25) > .5) on++; } return on / n * (1 / 5.4) / fp; };
const widths = [.0015, .003, .006].map(widthPx);
assert.ok(widths.every((w) => w > .3 && w < 2.5), `line ≈1px wide ${widths}`);
assert.ok(Math.max(...widths) / Math.min(...widths) < 1.3, `pixel width independent of zoom ${widths}`);
// 缩小：格子 < ~2px 时淡出到无线（代替 mip，避免摩尔纹）
assert.equal(S.spLine1(0, .5, 1.25), 0); assert.equal(S.spLine2([0, 0], [.5, .5], 1.35), 0);
const near = S.surfaceShade([.8, .8, .8], [0, 1.0 / 5.4, .3], [1, 0, 0], .002, { sedAmp: 0 });
const far = S.surfaceShade([.8, .8, .8], [0, 1.0 / 5.4, .3], [1, 0, 0], .5, { sedAmp: 0 });
assert.ok(near.cliff > .5 && far.cliff < .05, `strata line drawn up close (${near.cliff}), faded far (${far.cliff})`);
assert.ok(far.gravel === 0, 'gravel off when a pixel is bigger than a stone');

// 2) patch 按法线混合：顶面用地面格纹、崖面用层理，过渡对 n.y 连续（无硬缝）
const p = [.31, 2.0, .77];
let prev = null, maxStep = 0;
for (let a = 0; a <= 90; a += 1) { const r = a * Math.PI / 180, s = S.surfaceShade([.7, .7, .7], p, [Math.cos(r), Math.sin(r), 0], .004); if (prev) maxStep = Math.max(maxStep, Math.abs(s.color[0] - prev)); prev = s.color[0]; }
assert.ok(maxStep < .03, `normal blend continuous, max step ${maxStep}`);
const flat = S.surfaceShade([.7, .7, .7], p, [0, 1, 0], .004), wall = S.surfaceShade([.7, .7, .7], p, [1, 0, 0], .004);
assert.equal(flat.flatness, 1); assert.equal(wall.flatness, 0); assert.equal(flat.mask, flat.ground); assert.equal(wall.mask, wall.cliff);

// 3) "把世界弄歪再算，再撤掉"：只偏采样坐标；同一高度上层理随 xz 弯曲，幅度 ≤ sedAmp/2
let maxWarp = 0, tones = new Set();
for (let x = 0; x < 8; x += .25) { const w = S.spWarp([x, 1, x * .5]); maxWarp = Math.max(maxWarp, Math.abs(w[1])); tones.add(S.spBandTone([x + w[0], 6 / 5.4 + w[1], x * .5 + w[2]])); }
assert.ok(maxWarp > .03 && maxWarp <= .12 + 1e-9, `warp amplitude ${maxWarp}`);
assert.equal(tones.size, 2, 'two-tone strata curve across a fixed world height');
const noWarp = S.surfaceShade([.7, .7, .7], [1, 1, 1], [1, 0, 0], .004, { sedAmp: 0 });
assert.deepEqual(noWarp.warp, [0, 0, 0]);

// 4) 抽象田野（1714613599035863191）：干涉线间距不等、跨越格子连续
const xs = []; let last = 0;
for (let x = 0; x < 12; x += .002) { const v = S.spFieldLines([x, 0, 1.7], .002); if (v > .5 && last <= .5) xs.push(x); last = v; }
const gaps = xs.slice(1).map((x, i) => x - xs[i]), mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length);
assert.ok(gaps.length > 20 && sd / mean > .1, `non-uniform line spacing cv=${(sd / mean).toFixed(2)} mean=${mean.toFixed(3)}`);
assert.equal(S.spFieldLines([1, 0, 1], .5), 0, 'field lines off when sub-pixel');
// 坡面草：只在中间坡度带
const band = (deg) => S.surfaceShade([.7, .7, .7], p, [Math.sin(deg * Math.PI / 180), Math.cos(deg * Math.PI / 180), 0], .004, { slopeGrass: 1 }).slopeBand;
assert.equal(band(0), 0); assert.equal(band(89), 0); assert.equal(band(15), 0); assert.ok(band(55) > .9, 'walkable slope band');

// 5) 共享 World：顶面/崖面实际法线下 patch 选择与世界高度一致
const grid = buildQuadGrid({ radius: 6 }), world = new World(grid); generateTerrain(world, { seed: 5 });
let tops = 0, walls = 0;
for (const c of world.cells) { const t = world.top(c); if (!t) continue; const y = t * .5;
  const top = S.surfaceShade([.6, .7, .5], [c.cx, y, c.cz], [0, 1, 0], .01); assert.equal(top.mask, top.ground); tops++;
  const e = c.pts[0], f = c.pts[1], nx = f.z - e.z, nz = -(f.x - e.x); const side = S.surfaceShade([.6, .6, .6], [(e.x + f.x) / 2, y - .25, (e.z + f.z) / 2], [nx, 0, nz], .01); assert.equal(side.mask, side.cliff); walls++;
  assert.ok(top.color.every((v) => v > 0 && v < 1.2) && side.color.every((v) => v > 0 && v < 1.2)); }
assert.ok(tops > 50 && walls > 50);

// 6) 链式材质 API：保留之前的 onBeforeCompile 与缓存键，替换真实 three 标准着色器的注入点
const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
let prevCalled = 0; mat.onBeforeCompile = () => { prevCalled++; }; mat.customProgramCacheKey = () => 'prev';
const uniforms = S.attachSurfacePattern(mat, { fieldAmt: .5, viewMode: 1 }, { wrap: (v) => ({ value: Array.isArray(v) ? new THREE.Vector4(...v) : v }) });
const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
mat.onBeforeCompile(shader, null);
assert.equal(prevCalled, 1); assert.equal(mat.customProgramCacheKey(), 'prev+surface-pattern-v1');
assert.ok(shader.vertexShader.includes('vSpPos=(modelMatrix*vec4(transformed,1.)).xyz;'));
assert.ok(shader.fragmentShader.includes('diffuseColor.rgb=surfacePatternShade(diffuseColor.rgb,vSpPos,vSpNrm);'));
assert.ok(shader.fragmentShader.includes('#include <opaque_fragment>') && shader.fragmentShader.includes('if(uSpA.w>.5)'));
assert.equal(shader.uniforms.uSpA.value.w, 1); assert.equal(shader.uniforms.uSpB.value.z, .5); assert.equal(uniforms, mat.userData.surfacePattern);
for (const k of Object.keys(uniforms)) assert.ok(S.SURFACE_PATTERN_GLSL.includes(k), k);
assert.throws(() => S.attachSurfacePattern(new THREE.MeshStandardMaterial(), { viewMode: 3 }), RangeError);
const bad = new THREE.MeshStandardMaterial(); S.attachSurfacePattern(bad); assert.throws(() => bad.onBeforeCompile({ uniforms: {}, vertexShader: 'void main(){}', fragmentShader: '' }), /missing/);
console.log(`PASS surface pattern: px line widths ${widths.map((w) => w.toFixed(2))}, far fade, normal blend step ${maxStep.toFixed(3)}, curved two-tone strata, field cv ${(sd / mean).toFixed(2)}, slope band, World ${tops} tops/${walls} walls, chained material API`);
