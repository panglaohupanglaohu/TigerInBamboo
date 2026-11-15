// REA 战场舞台贴球（2026-11-10 用户截图：长船 / 尾迹飞在天上、红袍站在空中、小船应从李白 / Duke 出发）。
//   ① toWorld / worldToStage 互逆，舞台 y=0 恰在海面球上（远处不再高出球面）；
//   ② 着色器 tmWarpWorld 与 CPU toWorld 同一映射（JS 照抄 GLSL 公式比对）；材质被打补丁、程序缓存键带 tmwarp；
//   ③ 采样按贴球坐标：离中心 100 m 的海仍是海（平切面会把球面海算成负高 / 陆地错位）；双层轨桥不采成地面；
//   ④ 细网格地面高 fineAt；⑤ 长船从母船出发（boatOrigins），航向母船 → 滩。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {}, classList: { add() {}, remove() {} } });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [] }, { get: (t, k) => k in t ? t[k] : () => el() });
globalThis.window ??= globalThis; globalThis.location ??= { search: '' }; globalThis.addEventListener ??= () => {};
const THREE = await import('three');
const { ReaBattleStage } = await import(pathToFileURL(join(root, 'src/world/rea/reaBattleStage.js')).href);

// 场景：星球海面（R=160 附近）+ 一座圆台小岛（中心 30 m 半径、高 12 m）+ 一段双层轨桥（高 20 m）横在岛外
const scene = new THREE.Scene();
const dir = new THREE.Vector3(0.3, 0.9, 0.2).normalize();
const site = new THREE.Group(); scene.add(site);
const stageProbe = new ReaBattleStage({ scene: new THREE.Scene(), site: new THREE.Group(), dir, camera: new THREE.PerspectiveCamera(), scale: 8, gridRadius: 14 });
const seaR = stageProbe.seaR;
// 岛：用球面上的径向高度场做网格（球面坐标 → 世界），高 12 m 的台地，半径 30 m 外降回海下
function addDome(name, hAt, radiusM, segs = 48) {
  const pos = [];
  const P = (x, z) => { const h = hAt(Math.hypot(x, z)); return stageProbe.toWorld(x / 8, h / 8, z / 8); };
  const step = radiusM * 2 / segs;
  for (let i = 0; i < segs; i++) for (let j = 0; j < segs; j++) {
    const x0 = -radiusM + i * step, z0 = -radiusM + j * step, a = P(x0, z0), b = P(x0 + step, z0), c = P(x0 + step, z0 + step), d = P(x0, z0 + step);
    pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial()); m.name = name; site.add(m); return m;
}
addDome('island-rock', (r) => (r < 30 ? 12 : r < 36 ? 12 - (r - 30) * 3 : -6), 60);
// 轨桥：岛外 60–70 m 处一条 10 m 宽、20 m 高的桥面
{
  const pos = [], a = (x, z) => stageProbe.toWorld(x / 8, 20 / 8, z / 8);
  for (let k = -40; k < 40; k += 4) { const p = [a(60, k), a(70, k), a(70, k + 4), a(60, k + 4)]; pos.push(...p[0].toArray(), ...p[1].toArray(), ...p[2].toArray(), ...p[0].toArray(), ...p[2].toArray(), ...p[3].toArray()); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const deck = new THREE.Mesh(g, new THREE.MeshStandardMaterial()); deck.name = 'citadel-target-double-deck-test'; site.add(deck);
}
scene.updateMatrixWorld(true);
const stage = new ReaBattleStage({ scene, site, dir, camera: new THREE.PerspectiveCamera(), scale: 8, gridRadius: 14 });

// ① 互逆 + 舞台 y=0 在海面球上
for (const [x, y, z] of [[0, 0, 0], [5, 1, -3], [12, 0, 9], [-13, 2.5, 4]]) {
  const w = stage.toWorld(x, y, z), back = stage.worldToStage(w);
  assert.ok(back.distanceTo(new THREE.Vector3(x, y, z)) < 1e-6, '互逆');
  assert.ok(Math.abs(w.length() - (stage.seaR + y * 8)) < 1e-6, '舞台 y 是离海面的径向高度');
}
const flat = new THREE.Vector3(14, 0, 0).applyMatrix4(stage.anchor.matrixWorld);
assert.ok(flat.length() - stage.seaR > 30, `对照：平切面 112 m 处高出球面 ${(flat.length() - stage.seaR).toFixed(1)} m（就是飞船的原因）`);
// ② 着色器同式
const glsl = (w) => { const U = stage.warpUniforms, s = w.clone().applyMatrix4(U.uTmWarpInv.value), rho = Math.hypot(s.x, s.z), th = rho / U.uTmWarpR.value, dx = rho > 1e-6 ? s.x / rho : 0, dz = rho > 1e-6 ? s.z / rho : 0, rad = U.uTmWarpR.value + s.y; return new THREE.Vector3(dx * rad * Math.sin(th), rad * Math.cos(th) - U.uTmWarpR.value, dz * rad * Math.sin(th)).applyMatrix4(U.uTmWarpStage.value); };
for (const [x, y, z] of [[9, .3, -7], [-12, 0, 2], [0, 1, 13]]) { const flatWorld = new THREE.Vector3(x, y, z).applyMatrix4(stage.anchor.matrixWorld); assert.ok(glsl(flatWorld).distanceTo(stage.toWorld(x, y, z)) < 1e-4, '着色器映射 = toWorld'); }
stage.start();
let patched = 0, total = 0;
stage.anchor.traverse((o) => { if (o === stage.mesh || !(o.isMesh || o.isPoints || o.isLine)) return; total++; if ([].concat(o.material).every((m) => m.userData.tmWarp && m.customProgramCacheKey().includes('tmwarp'))) patched++; });
assert.equal(patched, total, `舞台里所有可见物材质都打了贴球补丁（${patched}/${total}）`);
// 模拟 three 的编译：标准材质 / 点 / 自定义 ShaderMaterial
for (const [name, mat] of [['standard', stage.battle.mBody.material], ['points', stage.battle.dropPoints.material], ['shader', stage.battle.unitShadows.mesh.material]]) {
  const lib = mat.isShaderMaterial ? { vertexShader: mat.vertexShader, fragmentShader: mat.fragmentShader } : THREE.ShaderLib[{ standard: 'standard', points: 'points' }[name]];
  const sh = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
  mat.onBeforeCompile(sh, {});
  assert.ok(sh.vertexShader.includes('tmWarpWorld(') && sh.uniforms.uTmWarpR, `${name} 顶点着色器带映射`);
  if (!mat.isShaderMaterial) assert.ok(!sh.vertexShader.includes('#include <project_vertex>'), `${name} 替换了 project_vertex`);
}
// ③ 采样：岛顶约 12 m → 3 层（L=4 m）；离中心 85 m 是海；轨桥那一带不是 5 层桥面
const cellAt = (xm, zm) => stage.index.cellAt(xm / 8, zm / 8);
assert.equal(stage.world.top(cellAt(0, 0)), 3, '岛顶 12 m = 3 层');
assert.equal(stage.world.top(cellAt(85, -10)), 0, '85 m 外是海（贴球采样）');
assert.equal(stage.world.top(cellAt(65, 0)), 0, '双层轨桥不当地面');
// ④ 细网格
const f = stage.fineAt(0.5, 0.5); assert.ok(f != null && Math.abs(f * 8 - 12) < 0.5, `细网格地面高 ${(f * 8).toFixed(2)} m`);
// ⑤ 长船从母船出发
const mother = stage.toWorld(-11, 0, 0);
stage.view.boatOrigins = () => [stage.worldToStage(mother.clone())];
stage.battle.nextWave = 0; stage.update(1 / 30);
const boat = stage.battle.boats[0];
assert.ok(boat, '来船');
assert.ok(Math.hypot(boat.from[0] + 11, boat.from[1]) < 1e-6, '起点 = 母船');
const toMother = [(-11 - boat.stop[0]), (0 - boat.stop[1])], l = Math.hypot(...toMother);
assert.ok(Math.abs(boat.dir[0] - toMother[0] / l) < 1e-6 && boat.inDur >= 9, '航向 母船→滩，按距离给时长');
console.log('PASS REA 舞台贴球：坐标互逆、y=0 在海面球上、着色器同式、全部材质打补丁、贴球采样、轨桥不采、细网格地面、长船从母船出发',
  JSON.stringify({ flatLiftAt112m: +(flat.length() - stage.seaR).toFixed(1), patched, boatFrom: boat.from.map((v) => +v.toFixed(2)), inDur: +boat.inDur.toFixed(1), sample: stage.report }));
