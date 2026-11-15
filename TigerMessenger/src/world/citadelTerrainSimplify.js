// 高山圣城山体减面（2026-11-09 用户要求「优化高山圣城的山体，减少面的数量」）。
// 山体 citadel-oskar-grid-mountain-surface 经过十几道生成工序（细分、裁切、软化、崖肩…），最后是 14.5 万个不共享顶点的平面三角形。
// 不改生成器（下游植被、岩层、海岸对齐都依赖它），只在圣城建好、各消费者都用完之后做最后一步：
//   1. 按位置（1 mm）焊接成共享顶点；颜色取同一位置各面的平均；
//   2. meshoptimizer 简化（vendor/jsm/libs/meshopt_simplifier.module.js，MIT），绝对误差上限 ERR 米，锁住开口边界（和海岸、城墙、裁切口对得上）；
//   3. 展开回不共享顶点 + 重算平面法线（保持原来的平面着色画风）；背光高亮层（backlit-highlight-…）同步换。
// ?citadelTerrainLod=0 关闭；?citadelTerrainErr=0.1 改误差（米）。
import * as THREE from 'three';
import { MeshoptSimplifier } from '../../vendor/jsm/libs/meshopt_simplifier.module.js';

const NAMES = ['citadel-oskar-grid-mountain-surface'];

export async function simplifyCitadelTerrain(castle) {
  const q = new URLSearchParams(globalThis.location?.search || '');
  if (q.get('citadelTerrainLod') === '0' || !castle) return { skipped: true };
  const ERR = Number(q.get('citadelTerrainErr')) > 0 ? Number(q.get('citadelTerrainErr')) : 0.12;
  await MeshoptSimplifier.ready;
  const report = [];
  for (const name of NAMES) {
    const mesh = castle.getObjectByName(name);
    const g = mesh?.geometry; if (!g?.attributes?.position || g.userData.tmSimplified) continue;
    const P = g.attributes.position.array, C = g.attributes.color?.array, n = P.length / 3;
    const map = new Map(), idx = new Uint32Array(g.index ? g.index.count : n), pos = [], col = [], cnt = [];
    const src = g.index ? g.index.array : null;
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(P[i * 3] * 1000)},${Math.round(P[i * 3 + 1] * 1000)},${Math.round(P[i * 3 + 2] * 1000)}`;
      let v = map.get(k);
      if (v === undefined) { v = cnt.length; map.set(k, v); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); col.push(0, 0, 0); cnt.push(0); }
      if (C) { col[v * 3] += C[i * 3]; col[v * 3 + 1] += C[i * 3 + 1]; col[v * 3 + 2] += C[i * 3 + 2]; } cnt[v]++;
      if (!src) idx[i] = v; else map.set('#' + i, v);
    }
    if (src) for (let i = 0; i < src.length; i++) idx[i] = map.get('#' + src[i]);
    const posA = new Float32Array(pos);
    const [out] = MeshoptSimplifier.simplify(idx, posA, 3, 0, ERR, ['ErrorAbsolute', 'LockBorder']);
    const tris = out.length / 3;
    const np = new Float32Array(out.length * 3), nc = C ? new Float32Array(out.length * 3) : null;
    for (let i = 0; i < out.length; i++) {
      const v = out[i]; np[i * 3] = posA[v * 3]; np[i * 3 + 1] = posA[v * 3 + 1]; np[i * 3 + 2] = posA[v * 3 + 2];
      if (nc) { const c = cnt[v] || 1; nc[i * 3] = col[v * 3] / c; nc[i * 3 + 1] = col[v * 3 + 1] / c; nc[i * 3 + 2] = col[v * 3 + 2] / c; }
    }
    const before = (g.index ? g.index.count : n) / 3;
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
    if (nc) ng.setAttribute('color', new THREE.BufferAttribute(nc, 3));
    ng.computeVertexNormals(); ng.computeBoundingBox(); ng.computeBoundingSphere();
    ng.userData = { ...g.userData, tmSimplified: { before, after: tris, maxError: ERR, method: 'meshoptimizer simplify (weld 1mm, LockBorder, ErrorAbsolute)' } };
    mesh.geometry = ng;
    const hl = castle.getObjectByName('backlit-highlight-' + name);
    if (hl?.geometry?.attributes?.position) { const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(np.slice(), 3)); hg.computeVertexNormals(); hg.computeBoundingSphere(); hl.geometry.dispose(); hl.geometry = hg; }
    g.dispose();
    report.push({ name, before, after: tris, maxError: ERR });
  }
  globalThis.__tmCitadelTerrainLod = report;
  return { report };
}
