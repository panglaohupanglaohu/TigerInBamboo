// 第 55 批 G1：着色模块接 View 主材质（src/world/view-shading.js；现 13 键，fieldplots 为 1798310423554658732 批后加入）。node 里验证：
// onBeforeCompile 链式补丁（不吃掉 View 自己的补丁、锚点都在）、每个开关的烘焙数据（共享 World）、
// uniform 开关、World 编辑后按 version 重烘、体素场开关临时关 CPU 烘焙并恢复、体素软法线写回/还原、
// 扩展纹理阴影（贴形变网格 + 洞内地面 + 竖面）、色体角点编辑、?shade= 解析。GLSL 编译在浏览器里验（shots-r55/g1-*）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { buildScene } = await import('../src/world/scenes.js');
const { PALETTES } = await import('../src/core/palette.js');
const { WorldMesh } = await import('../src/world/worldmesh.js');
const { GroundSurfaceShadow, surfaceHeightsFromWorld, bakeFloorShadow, SURFACE_SHADOW_GLSL } = await import('../src/light/surface-shadow.js');
const { ShadingExtras, SHADING_KEYS, FEATURE_ORDER, shadingKeysFromURL } = await import('../src/world/view-shading.js');

const grid = decorateCells(buildQuadGrid({ radius: 9, hexSize: 1 })), index = buildCellIndex(grid), world = new World(grid);
world.palette = PALETTES.town; buildScene(world, 'fusion', 7);
const wm = new WorldMesh(world, { levelHeight: 0.5 }); wm.rebuild();
let invalidated = 0;
const material = new THREE.MeshStandardMaterial({ vertexColors: true });
// 模拟 View 自己的补丁：声明 vField / vWPos 并在 color_fragment 后面写一行
material.onBeforeCompile = (sh) => { sh.uniforms.uViewOwn = { value: 1 }; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vField;\nvarying vec3 vWPos;\n' + SURFACE_SHADOW_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\n//VIEW-COLOR'); };
const view = { town: world, index, levelHeight: 0.5, material, sunDir: new THREE.Vector3(-9, 21, 15).normalize(), sun: { color: new THREE.Color(1, 0.95, 0.88), intensity: 2.7 },
  mesh: { geometry: wm.geometry }, worldMesh: { get bake() { return wm.bake; }, set bake(v) { wm.bake = v; }, invalidate() { invalidated++; }, get shape() { return wm.shape; } } };
view.groundSurfaceShadow = new GroundSurfaceShadow(view);
const sx = new ShadingExtras(view);
assert.equal(SHADING_KEYS.length, 13);   // 12 个第 55 批开关 + fieldplots（1798310423554658732 批次后加入）

// ① 着色器补丁：链在 View 的补丁之后，View 的修改保留，所有锚点替换到位
const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
material.onBeforeCompile(shader, null);
assert.ok(shader.uniforms.uViewOwn && shader.fragmentShader.includes('//VIEW-COLOR'), 'View 自己的补丁保留');
for (const u of ['uShCV', 'uShCVC', 'uShCT', 'uShPN', 'uShPB', 'uShBR', 'uShBrush', 'uBlotchAtlas', 'uBlotchRim', 'uSpA', 'uShMtn', 'uShSB', 'uShVField', 'uFieldTex', 'uSurfaceShadowExt']) assert.ok(u in shader.uniforms, 'uniform ' + u);
for (const s of ['shColorVolume(diffuseColor.rgb', 'shContrast(diffuseColor.rgb', 'shPatchBlend(diffuseColor.rgb', 'blotchRimTint(vSpPos', 'shBrush(diffuseColor.rgb', 'surfacePatternShade(diffuseColor.rgb', 'surfaceShadowToneN(vSpPos', 'shMountain(vSpPos)', 'shBounce(vSpPos', 'uShPNMap']) assert.ok(shader.fragmentShader.includes(s), 'fragment uses ' + s);
assert.ok(shader.vertexShader.includes('vShVF=sampleField(') && shader.vertexShader.indexOf('vSpPos=(modelMatrix') < shader.vertexShader.indexOf('#include <project_vertex>'), '顶点着色器采样分层场（1168571866405097472 "sampled in the vertex shader"）');
assert.ok(shader.fragmentShader.indexOf('uniform vec4 uSurfaceShadowExt') < shader.fragmentShader.indexOf('void main()'), '扩展阴影 uniform 在 main 之前声明');
assert.ok(material.customProgramCacheKey().includes('view-shading-r55'));
for (const [k, u] of [['cvolume', 'uShCV'], ['contrasttex', 'uShCT'], ['paintnormal', 'uShPN'], ['patchblend', 'uShPB'], ['blotchatlas', 'uShBR'], ['brushscratch', 'uShBrush'], ['surfacepattern', 'uShSurf'], ['mountainatlas', 'uShMtn'], ['voxelfield', 'uShVField']]) assert.equal(sx.u[u].value, 0, k + ' 默认关');
assert.equal(sx.u.uShSB.value.x, 0); assert.equal(view.groundSurfaceShadow.strength.value, 0);

// ② 每个开关：开 → 烘出共享 World 数据 + uniform 置位；关 → uniform 归零
const on = (k) => { assert.ok(sx.set(k, true), k); };
on('cvolume'); { const st = sx.stats.cvolume; assert.ok(st.used.Grass > 0 && st.used.Cliff > 0 && st.used.Roof > 0, 'World 格分到五特征 ' + JSON.stringify(st.used)); assert.equal(sx.u.uShCVMap.value.image.width, st.res); assert.equal(sx.u.uShCV.value, 1); }
// 角点编辑：只改 OKLab uniform（不重烘）
{ const before = sx.u.uShCVC.value[0].clone(), key = sx.keys.cvolume; sx.setCorner('Grass', 0, '#d04a3a'); assert.ok(sx.u.uShCVC.value[0].distanceTo(before) > 0.05, '角点 0 改色'); assert.equal(sx.keys.cvolume, key, '不触发重烘'); assert.equal(FEATURE_ORDER.length * 8, sx.u.uShCVC.value.length); }
on('contrasttex'); { const st = sx.stats.contrasttex; assert.ok(st.after.sameDE < 1 && st.after.minContrastDE > 10, '同特征边 ΔE→' + st.after.sameDE.toFixed(2) + '，对比边最小 ' + st.after.minContrastDE.toFixed(1)); assert.equal(sx.u.uShCTMap.value.image.width, 512); }
on('paintnormal'); assert.equal(sx.u.uShPNMap.value.wrapS, THREE.RepeatWrapping, '笔触法线图可平铺');
on('patchblend'); { const st = sx.stats.patchblend, d = sx.u.uShPBMap.value.image.data; assert.ok(st.loops >= 1 && st.segs > 10); let shore = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 128) < 40 && d[i + 3]) shore++; assert.ok(shore > 50, '岸带纹素 ' + shore); }
on('blotchatlas'); assert.ok(sx.stats.rim.rimCells > 0 && sx.u.uBlotchAtlas.value.generateMipmaps, '图集 mip + 边缘场');
on('brushscratch'); assert.equal(sx.u.uShBrushMap.value.image.width, 256);
on('surfacepattern'); assert.equal(sx.u.uShSurf.value, 1);
on('mountainatlas'); assert.ok(sx.stats.mountainatlas.rockPx > 0 && sx.stats.mountainatlas.runtimeNormalTaps === 0);
on('surfacebounce'); { const st = sx.stats.surfacebounce; assert.equal(st.model, 'split'); assert.ok(st.maxGathered > 0 && sx.u.uShSB.value.y > 0 && st.history[1] < st.history[0], '两跳收敛 ' + st.history); }
// 扩展纹理阴影：贴形变网格、洞内地面、竖面窄条开关
on('surfaceshadow'); view.groundSurfaceShadow.refresh(); { const st = view.groundSurfaceShadow.stats; assert.equal(st.receivers, 'all'); assert.equal(st.deformed, !!wm.shape); assert.ok(st.hits > 0); assert.equal(view.groundSurfaceShadow.ext.value.x, 1); assert.ok(view.groundSurfaceShadow.ext.value.y > 0.5, 'G 通道高度上限');
  const d = view.groundSurfaceShadow.texture.image.data; let g = 0; for (let i = 1; i < d.length; i += 4) g = Math.max(g, d[i]); assert.equal(g, 255, '顶面高度写进 G'); }
// 体素场：开 → 关掉 CPU 烘焙（invalidate），关 → 恢复
assert.equal(wm.bake, true); on('voxelfield'); assert.equal(wm.bake, false); assert.equal(invalidated, 1); { const st = sx.stats.voxelfield; assert.equal(st.texH, st.H * st.layers); assert.equal(sx.u.uFieldTex.value.type, THREE.FloatType); }
sx.set('voxelfield', false); assert.equal(wm.bake, true); assert.equal(invalidated, 2); assert.equal(sx.u.uShVField.value, 0);
// 体素软法线：写回、位置不动、关掉还原
{ const g = wm.geometry, before = Float32Array.from(g.attributes.normal.array), pos = Float32Array.from(g.attributes.position.array);
  on('voxelnormals'); const st = sx.stats.voxelnormals; assert.ok(st.moved > st.verts * 0.2, '软法线改了 ' + st.moved + '/' + st.verts);
  assert.deepEqual(Float32Array.from(g.attributes.position.array), pos, '顶点不动');
  sx.update(); assert.equal(sx.stats.voxelnormals.moved, st.moved, '同一几何不重复叠加');
  sx.set('voxelnormals', false); assert.deepEqual(Float32Array.from(g.attributes.normal.array), before, '关掉还原'); }
for (const [k] of SHADING_KEYS) sx.set(k, false);
assert.equal(sx.u.uShCV.value + sx.u.uShCT.value + sx.u.uShPN.value + sx.u.uShPB.value + sx.u.uShBR.value + sx.u.uShBrush.value + sx.u.uShSurf.value + sx.u.uShMtn.value + sx.u.uShSB.value.x, 0);
assert.equal(view.groundSurfaceShadow.strength.value, 0); assert.equal(view.groundSurfaceShadow.ext.value.x, 0);

// ③ World 编辑 → version 变 → 开着的功能重烘
sx.set('cvolume', true); const k0 = sx.keys.cvolume; const c = world.cells.find((x) => world.top(x) > 0); world.fill(c, world.top(c) + 3, { rock: true }); sx.update(true); assert.notEqual(sx.keys.cvolume, k0, '编辑后重烘');

// ④ surface-shadow：不给 shape 与旧版逐值一致；恒等 shape 栅格化接近；洞内地面
{ const a = surfaceHeightsFromWorld(world, index, { res: 64 }), id = { at: (p) => [p.x, p.z] }, b = surfaceHeightsFromWorld(world, index, { res: 64, shape: id });
  let same = 0; for (let i = 0; i < a.heights.length; i++) if (Math.abs(a.heights[i] - b.heights[i]) < 1e-6) same++; assert.ok(same / a.heights.length > 0.97, '恒等 shape 栅格化与格子栅格化一致 ' + (same / a.heights.length).toFixed(3));
  // 搭一个悬挑：某格 1、3、4 层实心、2 层空 → 洞内地面在 1·L，头顶有东西 → 洞里被挡
  const cell = world.cells.find((x) => world.top(x) === 1 && world.isRock(x, 1)); world.setSolid(cell, 3, true, { rock: true }); world.setSolid(cell, 4, true, { rock: true });
  const f = surfaceHeightsFromWorld(world, index, { res: 64 }), fl = bakeFloorShadow(world, index, f, { L: 0.5, sun: [view.sunDir.x, view.sunDir.y, view.sunDir.z] });
  assert.ok(fl.floors > 0 && fl.hits > 0, '悬挑下的地面接收洞内阴影 ' + fl.floors + '/' + fl.hits); }

// ⑤ ?shade= 解析
assert.deepEqual(shadingKeysFromURL('?scene=fusion&shade=cvolume,bogus,paintnormal'), ['cvolume', 'paintnormal']);
assert.deepEqual(shadingKeysFromURL(''), []);
console.log('PASS view shading extras: 12 toggles, chained shader patch, bakes', Object.fromEntries(Object.entries(sx.stats).map(([k, v]) => [k, v.bakeMs])));
