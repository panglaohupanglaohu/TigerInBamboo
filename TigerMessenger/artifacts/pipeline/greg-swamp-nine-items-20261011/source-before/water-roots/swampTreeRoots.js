import * as THREE from 'three';
// 湖沼目标图（2026-10-11 定稿）：中央巨树的根在清澈水下放射状铺开、盘到湖底并顺斜坡爬上去。
// Greg 团队·异星生态（学 Patric Fallon）：根是这棵树"吃住"整个湖的证据——粗根贴底、末端变细、偶尔分叉，
// 颜色与树干同一粉褐色系（上表面亮、侧下暗，平涂顶点色，不受光照）。
// 全部根合并为一个网格 = 1 次绘制；根顶 y < 24.5（荷叶舟在 y≈25 水面，船道不受影响）。?swampTreeRoots=0 关闭。
const flag = k => new URLSearchParams(globalThis.location?.search || '').get(k) !== '0';
const MAX_ROOT_Y = 24.2;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** 向下射线采样湖底/坑壁高度（inner 本地坐标）。 */
export function makeSwampFloorSampler(inner) {
  const targets = [];
  inner.traverse(o => { if (o.isMesh && /swamp-lake-floor|swamp-sinkhole-wall/.test(o.name)) targets.push(o); });
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  const fallback = (x, z) => { const r = Math.hypot(x, z); return r < 12.5 ? 10.4 : 10.4 + (r - 12.5) * 1.45; };
  return (x, z) => {
    if (!targets.length) return fallback(x, z);
    o.set(x, 30, z); inner.localToWorld(o); d.set(x, 0, z); inner.localToWorld(d); d.sub(o).normalize();
    rc.set(o, d); rc.far = Infinity;
    const hit = rc.intersectObjects(targets, false)[0];
    if (!hit) return fallback(x, z);
    p.copy(hit.point); inner.worldToLocal(p); return p.y;
  };
}

// 把一条中心线扫成渐细六棱管；直接写入合并数组（位置、顶点色、索引）。
function sweep(out, pts, radii, sides, cTop, cSide) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const M = Math.max(6, pts.length * 2);
  const frames = curve.computeFrenetFrames(M, false);
  const base = out.pos.length / 3, P = new THREE.Vector3(), N = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i <= M; i++) {
    const s = i / M; curve.getPointAt(s, P);
    const fi = s * (radii.length - 1), i0 = Math.floor(fi), i1 = Math.min(radii.length - 1, i0 + 1);
    const r = radii[i0] + (radii[i1] - radii[i0]) * (fi - i0);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      N.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize();
      // 根略扁：竖向压一点，贴着湖底铺开
      out.pos.push(P.x + N.x * r, P.y + N.y * r * .72, P.z + N.z * r);
      c.copy(cSide).lerp(cTop, THREE.MathUtils.clamp(N.y * .5 + .5, 0, 1) ** 1.6);
      out.col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < M; i++) for (let k = 0; k < sides; k++) {
    const a = base + i * sides + k, b = base + i * sides + (k + 1) % sides, a2 = a + sides, b2 = b + sides;
    out.idx.push(a, a2, b, b, a2, b2);
  }
}

export function installSwampTreeRoots({swamp, enabled = flag('swampTreeRoots'), count = 10, seed = 5309, topColor = 0xd7a7b0, sideColor = 0xb8848f} = {}) {
  const report = {enabled, version: 1, roots: 0, branches: 0, triangles: 0, drawCalls: 0, maxReach: 0, maxY: -Infinity, minY: Infinity};
  const inner = swamp?.userData?.inner || swamp;
  const trunk = inner?.getObjectByName?.('world-tree-trunk');
  if (!enabled || !trunk) return {report, update() {}};
  (swamp.parent || swamp).updateWorldMatrix(true, true);
  const floorY = inner.userData.floorY ?? 10;
  // 树干底部中心（树干略倾斜，用几何包围盒底点换算到 inner 本地）
  trunk.geometry.computeBoundingBox();
  const bb = trunk.geometry.boundingBox;
  const baseC = trunk.localToWorld(new THREE.Vector3(0, bb.min.y + 3, 0)); inner.worldToLocal(baseC);
  const ws = new THREE.Vector3(); trunk.getWorldScale(ws); const iws = new THREE.Vector3(); inner.getWorldScale(iws);
  const R0 = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * .5 * (ws.x / iws.x);
  const ground = makeSwampFloorSampler(inner);
  const rnd = rng(seed);
  // 第 2 轮（组长）：水变透后根仍不显——顶面提亮偏粉 #d7a7b0，侧下 #b8848f（与树干 #bd929e 同色系）
  const cTop = new THREE.Color(topColor), cSide = new THREE.Color(sideColor);
  const out = {pos: [], col: [], idx: []};

  function growRoot(start, ang, L, r0, y0, depth) {
    const K = 22, pts = [], radii = [], wob = rnd() * 6.28, wobA = .12 + rnd() * .14;
    let reach = 0;
    for (let k = 0; k <= K; k++) {
      const s = k / K, d = s * L;
      const a = ang + Math.sin(s * 3.1 + wob) * wobA * s;
      const x = start.x + Math.cos(a) * d, z = start.z + Math.sin(a) * d;
      const r = r0 * Math.pow(1 - s, 1.15) + .07;
      const gy = ground(x, z);
      if (gy + r * 1.6 > MAX_ROOT_Y) break;          // 爬坡到近水面就停，船道不受影响
      const drop = 1 - THREE.MathUtils.smoothstep(s, 0, .32); // 从树干侧面拱出再落到湖底
      const y = gy + r * .55 + Math.max(0, y0 - gy) * drop * drop;
      pts.push(new THREE.Vector3(x, y, z)); radii.push(r);
      reach = Math.max(reach, Math.hypot(x - baseC.x, z - baseC.z));
      report.maxY = Math.max(report.maxY, y + r); report.minY = Math.min(report.minY, y - r);
    }
    if (pts.length < 5) return null;
    sweep(out, pts, radii, depth ? 5 : 6, cTop, cSide);
    report.maxReach = Math.max(report.maxReach, reach);
    return {pts, radii, ang};
  }

  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (rnd() - .5) * .5;
    const start = new THREE.Vector3(baseC.x + Math.cos(ang) * R0 * .55, 0, baseC.z + Math.sin(ang) * R0 * .55);
    const L = 14 + rnd() * 8.5;
    const root = growRoot(start, ang, L, 1.15 + rnd() * .35, floorY + 3.2 + rnd() * 3.2, 0);
    if (!root) continue;
    report.roots++;
    if (rnd() < .5 && root.pts.length > 10) {               // 少量分叉
      const j = Math.floor(root.pts.length * (.38 + rnd() * .2)), p = root.pts[j];
      const side = rnd() < .5 ? -1 : 1;
      const br = growRoot(new THREE.Vector3(p.x, 0, p.z), root.ang + side * (.45 + rnd() * .35), L * (.3 + rnd() * .15), root.radii[j] * .65, p.y, 1);
      if (br) report.branches++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  geo.setIndex(out.idx); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: 0xffffff, vertexColors: true, fog: false}));
  mesh.name = 'swamp-tree-radial-roots';
  mesh.raycast = () => {};            // 纯视觉：不参与地面采样/拾取
  inner.add(mesh);
  report.triangles = out.idx.length / 3; report.drawCalls = 1;
  report.base = baseC.toArray().map(v => +v.toFixed(2)); report.trunkRadius = +R0.toFixed(2);
  return {report, mesh, update() {}};
}
