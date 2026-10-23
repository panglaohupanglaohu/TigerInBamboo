import * as THREE from 'three';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';
// 湖沼目标图：清水面上零星漂着小圆浮叶（睡莲叶）和小树枝——成簇、簇与簇之间大片留白。
// Greg 团队·异星生态：落叶落枝是坑缘树冠"掉进"湖里的痕迹，簇的位置避开巨树根脚、荷叶舟、
// 鲸换气区和船鲸水道，所以不会被船或鲸穿过；随水面极轻地漂、转、浮沉。
// 叶 1 个 InstancedMesh + 枝 1 个 InstancedMesh = 2 次绘制。?swampFloatingDebris=0 关闭。
const flag = k => new URLSearchParams(globalThis.location?.search || '').get(k) !== '0';
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function segDist(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2], l = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[2]) * dz) / l));
  return Math.hypot(px - a[0] - t * dx, pz - a[2] - t * dz);
}

export function installSwampFloatingDebris({swamp, enabled = flag('swampFloatingDebris'), clusters = 8, seed = 1207} = {}) {
  const report = {enabled, version: 1, leaves: 0, twigs: 0, clusters: 0, triangles: 0, drawCalls: 0};
  const inner = swamp?.userData?.inner || swamp;
  if (!enabled || !inner?.isObject3D) return {report, update() {}};
  const waterY = inner.userData.waterY ?? 25;
  const rnd = rng(seed);
  const trunk = inner.getObjectByName('world-tree-trunk');
  const tc = trunk ? inner.worldToLocal(trunk.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(-8, 0, -7);
  const lotuses = (inner.userData.lotuses || []).map(l => l.position);
  const sw = inner.userData.whale?.userData?.swim;
  const waterRoute = createSwampLivingPathConstraints(inner)?.waterRoute || [];
  const lakeR = 20;
  const okCenter = (x, z) => {
    const r = Math.hypot(x, z);
    if (r < 4 || r > lakeR - 2) return false;
    if (Math.hypot(x - tc.x, z - tc.z) < 6.5) return false;
    if (lotuses.some(p => Math.hypot(x - p.x, z - p.z) < 4.5)) return false;
    if (sw && Math.hypot(x - sw.cx, z - sw.cz) < Math.max(sw.rx, sw.rz) + 4) return false;
    for (let i = 1; i < waterRoute.length; i++) if (segDist(x, z, waterRoute[i - 1], waterRoute[i]) < 3) return false;
    return true;
  };
  const centers = [];
  for (let tries = 0; tries < 600 && centers.length < clusters; tries++) {
    const a = rnd() * Math.PI * 2, r = 5 + Math.sqrt(rnd()) * (lakeR - 7);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (okCenter(x, z) && centers.every(c => Math.hypot(c.x - x, c.z - z) > 7)) centers.push({x, z, ph: rnd() * 6.28});
  }
  report.clusters = centers.length;
  const leaves = [], twigs = [];
  for (const c of centers) {
    const nL = 4 + Math.floor(rnd() * 4), nT = 1 + Math.floor(rnd() * 2);
    for (let i = 0, tries = 0; i < nL && tries < 60; tries++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 2.6, s = .42 + rnd() * .5;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > lakeR || leaves.some(l => Math.hypot(l.x - x, l.z - z) < (l.s + s) * .95)) continue;
      leaves.push({x, z, s, yaw: rnd() * 6.28, ph: rnd() * 6.28, c, tint: rnd()}); i++;
    }
    for (let i = 0; i < nT; i++) {
      const a = rnd() * 6.28, d = 1 + rnd() * 2;
      twigs.push({x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d, s: .7 + rnd() * .5, yaw: rnd() * 6.28, ph: rnd() * 6.28, c, tint: rnd()});
    }
  }
  // 少量离群单片，留白处偶尔一片
  for (let tries = 0; tries < 200 && leaves.length < 50; tries++) {
    const a = rnd() * 6.28, r = 6 + rnd() * (lakeR - 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!okCenter(x, z) || leaves.some(l => Math.hypot(l.x - x, l.z - z) < 4)) continue;
    leaves.push({x, z, s: .4 + rnd() * .35, yaw: rnd() * 6.28, ph: rnd() * 6.28, c: {x, z, ph: rnd() * 6.28}, tint: rnd()});
  }
  for (let tries = 0; tries < 100 && twigs.length < 12; tries++) {
    const a = rnd() * 6.28, r = 6 + rnd() * (lakeR - 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!okCenter(x, z)) continue;
    twigs.push({x, z, s: .6 + rnd() * .4, yaw: rnd() * 6.28, ph: rnd() * 6.28, c: {x, z, ph: 0}, tint: rnd()});
  }
  // 睡莲叶：带一道缺口的圆片
  const leafGeo = new THREE.CircleGeometry(1, 14, .3, Math.PI * 2 - .6); leafGeo.rotateX(-Math.PI / 2);
  // 小枝：一根主枝 + 一根侧枝 + 一个小杈
  const parts = [new THREE.BoxGeometry(2.2, .11, .13), new THREE.BoxGeometry(.9, .09, .09), new THREE.BoxGeometry(.5, .07, .07)];
  parts[1].rotateY(.62); parts[1].translate(.45, 0, -.26); parts[2].rotateY(-.7); parts[2].translate(-.6, 0, .16);
  const twigGeo = mergeBoxes(parts);
  const leafMat = new THREE.MeshBasicMaterial({color: 0xffffff, fog: false});
  const twigMat = new THREE.MeshBasicMaterial({color: 0xffffff, fog: false});
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
  const twigMesh = new THREE.InstancedMesh(twigGeo, twigMat, twigs.length);
  leafMesh.name = 'swamp-floating-lily-leaves'; twigMesh.name = 'swamp-floating-twigs';
  const leafCols = [0x6aa874, 0x7fb980, 0x5b9670, 0x96c489, 0x4f8a68].map(c => new THREE.Color(c));
  const twigCols = [0x7a5a44, 0x8c6a50, 0x6a4c3a].map(c => new THREE.Color(c));
  leaves.forEach((l, i) => leafMesh.setColorAt(i, leafCols[Math.floor(l.tint * leafCols.length)]));
  twigs.forEach((l, i) => twigMesh.setColorAt(i, twigCols[Math.floor(l.tint * twigCols.length)]));
  for (const m of [leafMesh, twigMesh]) { m.frustumCulled = false; m.raycast = () => {}; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inner.add(m); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  function place(mesh, list, t, lift) {
    list.forEach((d, i) => {
      const cx = Math.sin(t * .045 + d.c.ph) * .45, cz = Math.cos(t * .038 + d.c.ph) * .45; // 整簇缓漂
      P.set(d.x + cx + Math.sin(t * .11 + d.ph) * .12, waterY + lift + Math.sin(t * .9 + d.ph) * .012, d.z + cz + Math.cos(t * .09 + d.ph) * .12);
      E.set(Math.sin(t * .7 + d.ph) * .02, d.yaw + Math.sin(t * .06 + d.ph) * .25, Math.cos(t * .6 + d.ph) * .02);
      mesh.setMatrixAt(i, M.compose(P, Q.setFromEuler(E), S.setScalar(d.s)));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  const update = t => { place(leafMesh, leaves, t, .06); place(twigMesh, twigs, t, .08); };
  update(0);
  report.leaves = leaves.length; report.twigs = twigs.length; report.drawCalls = 2;
  report.triangles = leaves.length * leafGeo.index.count / 3 + twigs.length * twigGeo.index.count / 3;
  report.maxRadius = +Math.max(...leaves.map(l => Math.hypot(l.x, l.z)), ...twigs.map(l => Math.hypot(l.x, l.z))).toFixed(2);
  return {report, leafMesh, twigMesh, items: {leaves, twigs}, update};
}

function mergeBoxes(geos) {
  const pos = [], idx = []; let off = 0;
  for (const g of geos) {
    const p = g.attributes.position.array; pos.push(...p);
    for (const i of g.index.array) idx.push(i + off);
    off += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out;
}
