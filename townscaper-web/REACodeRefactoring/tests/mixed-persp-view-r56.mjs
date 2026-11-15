// 第 56 批 C05：1310503825510367232 混合透视接主视图（src/world/view-mixed-persp.js）。
// 用真 THREE.PerspectiveCamera + 与 View 同款 updateCamera 轨道相机，验证：
//   k=0 投影矩阵与原生逐元素相同；k=1 世界竖线两端屏幕 x 相同（<1e-9），远处仍变小；
//   转镜头（updateCamera）后仍成立；resize（updateProjectionMatrix）后仍成立；
//   fixRay 的射线上任意点都投到同一像素（拾取正确），而原生 setFromCamera 在 k=1 下会偏。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { attachMixedPerspective } = await import('../src/world/view-mixed-persp.js');

function makeView() {
  const view = {
    camera: new THREE.PerspectiveCamera(30, 1.6, 0.1, 500),
    target: new THREE.Vector3(0, 1.2, 0), yaw: Math.PI * 0.28, pitch: 0.62, distance: 30,
    renderer: { domElement: { width: 1280, height: 800 } },
    updateCamera() {
      const cp = Math.cos(this.pitch);
      this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.distance, this.target.y + Math.sin(this.pitch) * this.distance, this.target.z + Math.cos(this.yaw) * cp * this.distance);
      this.camera.lookAt(this.target); this.camera.updateMatrixWorld();
    },
    resize() { this.camera.aspect = 1.6; this.camera.updateProjectionMatrix(); },
  };
  view.camera.updateProjectionMatrix(); view.updateCamera();
  return view;
}
const proj = (cam, x, y, z) => new THREE.Vector3(x, y, z).project(cam);

// 1) k=0：与原生逐元素一致
{
  const a = makeView(), b = makeView();
  const mp = attachMixedPerspective(b, { k: 0 });
  b.updateCamera();
  a.camera.projectionMatrix.elements.forEach((v, i) => assert.ok(Math.abs(v - b.camera.projectionMatrix.elements[i]) < 1e-12, 'k=0 元素 ' + i));
  assert.equal(mp.k, 0);
}
// 2) k=1：竖线平行 + 近大远小，多个镜头角度、resize 后都成立
let worst = 0;
{
  const v = makeView(); const mp = attachMixedPerspective(v, { k: 1 });
  for (const yaw of [0, 0.7, 1.9, 3.3, 5.1]) for (const pitch of [0.35, 0.62, 1.0]) {
    v.yaw = yaw; v.pitch = pitch; v.updateCamera();
    if (yaw === 1.9) v.resize();
    for (const [x, z] of [[0, 0], [4, -3], [-6, 5], [8, 8], [-9, -7]]) {
      const lo = proj(v.camera, x, 0, z), hi = proj(v.camera, x, 3, z);
      const d = Math.abs(lo.x - hi.x); worst = Math.max(worst, d);
      assert.ok(d < 1e-9, `竖线横移 ${d} @yaw ${yaw} pitch ${pitch} (${x},${z})`);
    }
    // 同尺寸竖杆：远的屏幕高度更小（沿视线方向前后各放一根）
    const fwd = new THREE.Vector3().subVectors(v.target, v.camera.position).setY(0).normalize();
    const near = fwd.clone().multiplyScalar(-6), far = fwd.clone().multiplyScalar(8);
    const hN = Math.abs(proj(v.camera, near.x, 2, near.z).y - proj(v.camera, near.x, 0, near.z).y);
    const hF = Math.abs(proj(v.camera, far.x, 2, far.z).y - proj(v.camera, far.x, 0, far.z).y);
    assert.ok(hF < hN * 0.95, `远处应变小 near ${hN} far ${hF}`);
  }
  // 原生投影同一机位竖线确实收敛（证明测试有判别力）
  const s = makeView(); s.yaw = 0.7; s.pitch = 0.62; s.updateCamera();
  const d0 = Math.abs(proj(s.camera, 8, 0, 8).x - proj(s.camera, 8, 3, 8).x);
  assert.ok(d0 > 1e-3, '原生透视竖线应收敛 ' + d0);
  // 3) fixRay：射线上的点全投到同一 NDC
  v.yaw = 0.9; v.pitch = 0.62; v.updateCamera();
  let bad = 0, stockBad = 0;
  for (const [nx, ny] of [[0, 0], [0.5, -0.3], [-0.7, 0.6], [0.2, 0.8]]) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx, ny), v.camera);
    const sp = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 25).project(v.camera);
    stockBad = Math.max(stockBad, Math.hypot(sp.x - nx, sp.y - ny));
    mp.fixRay(ray, nx, ny);
    for (const t of [1, 10, 30, 60]) { const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t).project(v.camera); bad = Math.max(bad, Math.hypot(p.x - nx, p.y - ny)); }
  }
  assert.ok(bad < 1e-6, 'fixRay 后射线点应投回同一 NDC ' + bad);
  assert.ok(stockBad > 1e-3, '原生 setFromCamera 在 k=1 下应偏离 ' + stockBad);
  // 3b) 深度：岛面（y=0, 半径 12 内）凡原生可见的点在混合投影下 z_ndc 也在 [-1,1]；沿 fixRay 射线深度单调
  let clipped = 0, seen = 0;
  const st = makeView(); st.yaw = 0.9; st.pitch = 0.62; st.updateCamera();
  for (let x = -12; x <= 12; x += 1.5) for (let z = -12; z <= 12; z += 1.5) for (const y of [0, 0.5, 3]) {
    const a = proj(st.camera, x, y, z); if (Math.abs(a.x) > 1 || Math.abs(a.y) > 1 || Math.abs(a.z) > 1) continue; seen++;
    const b = proj(v.camera, x, y, z); if (Math.abs(b.z) > 1) clipped++;
  }
  assert.ok(seen > 200 && clipped === 0, `岛面点被深度裁掉 ${clipped}/${seen}`);
  { const ray = new THREE.Raycaster(); mp.fixRay(ray, 0.3, -0.2); let prev = -Infinity;
    for (const t of [0.5, 5, 15, 30, 60, 120]) { const zz = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t).project(v.camera).z; assert.ok(zz > prev, '深度沿射线单调'); prev = zz; } }
  // 4) setK(0) 回到原生
  mp.setK(0); const ref = makeView(); ref.yaw = 0.9; ref.pitch = 0.62; ref.updateCamera();
  ref.camera.projectionMatrix.elements.forEach((x, i) => assert.ok(Math.abs(x - v.camera.projectionMatrix.elements[i]) < 1e-12));
  console.log(`PASS mixed-persp view hook: k=0 原生逐元素相同；k=1 15 机位×5 竖线横移最大 ${worst.toExponential(2)}，远处变小，resize 后保持；fixRay 偏差 ${bad.toExponential(2)}（原生射线偏 ${stockBad.toFixed(3)} NDC）；setK(0) 复原`);
}
