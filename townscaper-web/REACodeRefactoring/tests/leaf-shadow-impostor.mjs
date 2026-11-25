// 1205420678859632640 残差补全（learn-queue plants 3c）：
//   ① 匹配的阴影 caster——树冠 castShadow 原来投实心团块影子（默认 MeshDepthMaterial
//      不认片元 discard，也没有风摆）。leaf-depth.js 给树冠配「与彩色材质同源」的
//      深度材质：同共享图集、同视角 alpha 判据（视角=阴影相机）、同风摆。
//   ② 远景 impostor——leaf-impostor.js 的共享 32² 图集交叉面片 + Vegetation
//      updateCrownLOD 距离阈值切换，远景仍出叶形轮廓，图集单例不分裂。
// 原作手绘轮廓仍属卡点·B（无原资产），本条不声称美术保真。
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
const { Vegetation } = await import('../src/life/vegetation.js');
const { makeLeafDepthMaterial } = await import('../src/life/leaf-depth.js');
const { LeafImpostorField, crossedLeafGeometry } = await import('../src/life/leaf-impostor.js');
const { makeLeafSurface, sharedLeafTexture } = await import('../src/life/leaf-surface.js');

/* ---- 16² 测试岛：2 层草台 + 4×4 高台（保证有树有崖） ---- */
const N = 16, cells = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const id = j * N + i;
  cells.push({ id, n: 4, cx: i + .5, cz: j + .5, pts: [{ id, x: i, z: j }, { id: id + 1, x: i + 1, z: j }, { id: id + 2, x: i + 1, z: j + 1 }, { id: id + 3, x: i, z: j + 1 }],
    edgeNeighbors: [j > 0 ? id - N : -1, i < N - 1 ? id + 1 : -1, j < N - 1 ? id + N : -1, i > 0 ? id - 1 : -1], cornerNeighbors: [] });
}
const world = new World({ cells });
const at = (i, j) => cells[j * N + i];
for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) world.fill(at(i, j), 2, { rock: true });
for (let j = 5; j < 9; j++) for (let i = 5; i < 9; i++) world.fill(at(i, j), 5, { rock: true });
const veg = new Vegetation({ scene: new THREE.Group(), levelHeight: .5 });
const stats = veg.refresh(world, null, {}, 11);
assert.ok(stats.trees > 0, '测试岛上要有树');
assert.equal(veg.crownPlacements.length, stats.trees, '树位留底 = 树冠实例数');

/* ① 阴影 caster：castShadow + 同源深度材质 */
for (const [i, cr] of veg.crowns.entries()) {
  assert.equal(cr.m.castShadow, true, `crown ${i} castShadow`);
  const dm = cr.m.customDepthMaterial;
  assert.ok(dm && dm.isMeshDepthMaterial, `crown ${i} customDepthMaterial`);
  assert.equal(dm.depthPacking, THREE.RGBADepthPacking, '阴影图用 RGBADepthPacking（与默认深度材质同编码）');
  const sh = { uniforms: {}, vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n#include <project_vertex>\n}', fragmentShader: '#include <common>\n#include <packing>\nvoid main(){\n#include <clipping_planes_fragment>\nfloat z=0.;}' };
  dm.onBeforeCompile(sh);
  // 顶点：同风摆公式（uTime 绑同一 uniform 对象 → 影子随树一起摆）
  assert.equal(sh.uniforms.uTime, veg.uTime, '深度材质 uTime 与彩色材质同对象');
  assert.equal(sh.uniforms.uLeafy, veg.uLeafy, 'uLeafy 同对象');
  assert.equal(sh.uniforms.uLeafAtlas, veg.leafSurface.uniform, '深度材质绑共享图集 uniform 对象');
  assert.equal(sh.uniforms.uLeafAtlasOn, veg.leafSurface.on, '图集开关同对象');
  assert.ok(sh.vertexShader.includes('sway') && sh.vertexShader.includes('aTip * aTip'), '顶点含风摆');
  assert.ok(sh.vertexShader.includes('vLeafSphere = position - uLeafCenter'), '球面叶纹坐标与彩色同源');
  // 片元：同一 leafPattern × leafCoverage 判据，视角换阴影相机；旧噪声分支同式保留
  assert.ok(sh.fragmentShader.includes('leafCoverage(facing, leafPattern(vLeafSphere))'), '图集分支同源');
  assert.ok(sh.fragmentShader.includes('isOrthographic ? back : normalize(cameraPosition - vLeafW)'), '正交阴影相机视角');
  assert.ok(sh.fragmentShader.includes('rim > 0.52 + 0.4 * leaf'), '旧噪声阈值同式');
  assert.ok(sh.fragmentShader.includes('discard'), '深度通道叶隙裁片');
}
// 灌木/草丛维持既有取舍：不投影（注释原由：太小看不出）
assert.equal(veg.shrubs.castShadow, false); assert.equal(veg.tufts.castShadow, false);
// 独立构造一份：参数进入缓存键，不同摆幅不共用程序
const surf2 = makeLeafSurface();
assert.equal(surf2.texture, sharedLeafTexture().texture, 'makeLeafSurface 共享纹理单例');
const d1 = makeLeafDepthMaterial({ uTime: veg.uTime, uLeafy: veg.uLeafy, surface: surf2, center: new THREE.Vector3(), amount: .02, leafScale: 28 });
const d2 = makeLeafDepthMaterial({ uTime: veg.uTime, uLeafy: veg.uLeafy, surface: surf2, center: new THREE.Vector3(), amount: 0, leafScale: 70 });
assert.notEqual(d1.customProgramCacheKey(), d2.customProgramCacheKey(), '不同摆幅/频率程序缓存键不同');

/* ② 远景 impostor：交叉面片 + 共享图集单例 */
assert.throws(() => crossedLeafGeometry(null, 1), /planes/, '面片数下限校验');
const g3 = crossedLeafGeometry(veg.crowns[0].m.geometry);
assert.equal(g3.getAttribute('position').count, 3 * 4, '3 张交叉四边形 = 12 顶点');
assert.equal(g3.index.count, 3 * 6, '每片 2 三角');
assert.ok(g3.getAttribute('aCard'), '卡片空间坐标（球面判据用）');
const fA = new LeafImpostorField(veg.leafSurface, 4, { source: veg.crowns[0].m.geometry });
const fB = new LeafImpostorField(surf2, 4);
assert.equal(fA.material.uniforms.uLeafAtlas, veg.leafSurface.uniform, '替身绑共享 uniform 对象而非新纹理');
assert.equal(fA.material.uniforms.uLeafAtlasOn, veg.leafSurface.on);
assert.equal(fA.material.uniforms.uLeafAtlas.value, fB.material.uniforms.uLeafAtlas.value, '两个替身场同一张纹理（单例不分裂）');
assert.ok(fA.material.fragmentShader.includes('leafCoverage(zz, leafPattern(sph))'), '替身同视角 alpha × 球面叶纹判据');
assert.ok(fA.material.fragmentShader.includes('uLeafAtlasOn'), '图集开关统一');
assert.throws(() => fA.commit(5), /capacity/, 'commit 超上限拦截');

/* ③ 距离阈值切换 */
const total = stats.trees;
const camMid = new THREE.Vector3(8, 6, 8);
const dExpect = veg.crownPlacements.map((p) => Math.hypot(p.x - camMid.x, p.y - camMid.y, p.z - camMid.z));
const D = [...dExpect].sort((a, b) => a - b)[Math.floor(total / 2)];   // 取中位距离 → 近似对半分
const r = veg.updateCrownLOD(camMid, D);
assert.equal(r.near + r.far, total, '近网格 + 远面片 = 总树数');
assert.ok(r.near > 0 && r.far > 0, '中位阈值下两档都非空');
assert.equal(veg.crowns.reduce((s, c) => s + c.m.count, 0), r.near, '网格实例数 = near');
assert.equal(veg.farFields.reduce((s, f) => s + f.mesh.count, 0), r.far, '面片实例数 = far');
assert.equal(veg.trunks.count, r.near, '远树的树干不画（面片自带剪影）');
assert.ok(veg.farFields.every((f) => f.mesh.visible), 'LOD 生效时远面片场可见');
// 阈值硬边界：距离恰好 = 阈值算近
const pNear = veg.crownPlacements[dExpect.indexOf(D)];
{
  const exact = veg.updateCrownLOD(camMid, D);
  const mat = new THREE.Matrix4(); let hit = -1;
  for (let v = 0; v < 3; v++) for (let i = 0; i < veg.crowns[v].m.count; i++) { veg.crowns[v].m.getMatrixAt(i, mat); if (Math.abs(mat.elements[12] - pNear.x) < 1e-5 && Math.abs(mat.elements[14] - pNear.z) < 1e-5) hit = v; }
  assert.ok(hit === pNear.variant, '距离 ≤ 阈值的树留在网格档');
  assert.equal(exact.near + exact.far, total);
}
// 全远：阈值外一棵树没有
const rFar = veg.updateCrownLOD(new THREE.Vector3(1000, 0, 0), 5);
assert.equal(rFar.near, 0); assert.equal(rFar.far, total);
assert.equal(veg.trunks.count, 0);
// 全近 / 关闭：阈值 0 全回网格，远面片清空且隐藏
const rAll = veg.updateCrownLOD(camMid, 0);
assert.equal(rAll.near, total); assert.equal(rAll.far, 0);
assert.ok(veg.farFields.every((f) => f.mesh.count === 0 && !f.mesh.visible), '阈值 0：替身清空');
// 烘焙 impostor 优先：impostorOn 时远面片隐藏（数据仍按划分写好）
veg.updateCrownLOD(new THREE.Vector3(1000, 0, 0), 5);
veg.impostorFields = [0, 1, 2].map(() => ({ mesh: { visible: false }, set() {}, commit() {} }));   // 未烘图：stub 同步可见性分支
veg.impostor = true;
assert.ok(veg.farFields.every((f) => !f.mesh.visible), 'impostorOn：远面片隐藏');
veg.impostor = false;
assert.ok(veg.farFields.every((f) => f.mesh.visible), 'impostor 关回：远面片恢复');
// trees 层关掉：两边都隐藏
veg.setLayer('trees', false);
assert.ok(veg.farFields.every((f) => !f.mesh.visible));
veg.setLayer('trees', true);
assert.ok(veg.farFields.every((f) => f.mesh.visible));
// 缓存：同相机同阈值重调不重写（同一结果对象）
const again = veg.updateCrownLOD(new THREE.Vector3(1000, 0, 0), 5);
assert.equal(again.far, total);
assert.throws(() => veg.updateCrownLOD(camMid, -1), /distance/, '负阈值拦截');
assert.throws(() => veg.updateCrownLOD(camMid, NaN), /distance/);
// refresh 后划分保留（树位版本更新 → 按同一阈值重划）
veg.refresh(world, null, {}, 11);
assert.equal(veg.crownPlacements.length, total, '同种子重撒树数不变');
const re = veg.updateCrownLOD(new THREE.Vector3(1000, 0, 0), 5);
assert.equal(re.far, total, 'refresh 后阈值划分仍生效');

console.log(`PASS leaf-shadow-impostor: trees=${total} depthCaster=3 far=${rFar.far} planes=3 sharedAtlas=1`);
