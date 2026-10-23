import * as THREE from 'three';
// 2026-10-15 perf: fast "top surface radius along a radial line" for a large static root (the citadel
// as a Batian fleet target). The fleet's bomb-landing prediction and the colossus ground shadow already
// prefer root.userData.groundHeightAt(dir); without it they raycast every mesh of the target (the
// colossus shadow did ~470 such rays per update over the citadel: 200+ ms per frame, 1-3 fps).
//
// Triangles are put through a central (gnomonic) projection about the target centre: every radial line
// becomes a point and every triangle stays a triangle, so a query tests only the triangles of one grid
// cell and returns the highest intersection radius. Built lazily on first query, then reused.
const SKIP = /shadow|steam|smoke|robot|weapon|beam/;

export function createRadialHeightIndex(root, {cell = 2, planetRadius = 160, skip = SKIP} = {}) {
  let built = null;
  const report = {built: false, triangles: 0, cells: 0, buildMs: 0, queries: 0};
  function build() {
    const t0 = performance.now();
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root), centre = box.getCenter(new THREE.Vector3());
    const c = centre.lengthSq() > 1 ? centre.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const e = new THREE.Vector3().crossVectors(Math.abs(c.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), c).normalize();
    const n = new THREE.Vector3().crossVectors(c, e);
    const tris = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
    root.traverse(o => {
      if (!o.isMesh || o.isSprite || o.userData.isOutline || !o.geometry?.attributes?.position) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat?.transparent || skip.test(o.name || '')) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index, count = idx ? idx.count : pos.count;
      const instances = o.isInstancedMesh ? o.count : 1;
      for (let k = 0; k < instances; k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, im); m.multiplyMatrices(o.matrixWorld, im); } else m.copy(o.matrixWorld);
        for (let i = 0; i + 2 < count; i += 3) {
          const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
          a.fromBufferAttribute(pos, i0).applyMatrix4(m); b.fromBufferAttribute(pos, i1).applyMatrix4(m); d.fromBufferAttribute(pos, i2).applyMatrix4(m);
          tris.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
        }
      }
    });
    const T = new Float32Array(tris), nt = T.length / 9, UV = new Float32Array(nt * 6);
    const proj = (x, y, z, out, o) => { const w = x * c.x + y * c.y + z * c.z; if (w <= 1e-6) return false; out[o] = (x * e.x + y * e.y + z * e.z) / w; out[o + 1] = (x * n.x + y * n.y + z * n.z) / w; return true; };
    const du = cell / planetRadius;
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    const ok = new Uint8Array(nt);
    for (let t = 0; t < nt; t++) {
      const q = t * 9, o = t * 6;
      if (!proj(T[q], T[q + 1], T[q + 2], UV, o) || !proj(T[q + 3], T[q + 4], T[q + 5], UV, o + 2) || !proj(T[q + 6], T[q + 7], T[q + 8], UV, o + 4)) continue;
      ok[t] = 1;
      for (let j = 0; j < 6; j += 2) { minU = Math.min(minU, UV[o + j]); maxU = Math.max(maxU, UV[o + j]); minV = Math.min(minV, UV[o + j + 1]); maxV = Math.max(maxV, UV[o + j + 1]); }
    }
    // Clamp the grid to the root's own footprint (+20%): far-off pieces must not inflate it.
    const halfUV = box.getSize(new THREE.Vector3()).length() * .6 / planetRadius;
    minU = Math.max(minU, -halfUV); minV = Math.max(minV, -halfUV); maxU = Math.min(maxU, halfUV); maxV = Math.min(maxV, halfUV);
    const W = Math.max(1, Math.ceil((maxU - minU) / du) + 1), H = Math.max(1, Math.ceil((maxV - minV) / du) + 1);
    const clampU = x => Math.min(W - 1, Math.max(0, x)), clampV = y => Math.min(H - 1, Math.max(0, y));
    // Flat buckets (count, prefix-sum, fill). Triangles covering more than LARGE cells go to a short
    // list tested by every query instead of being copied into hundreds of cells.
    const LARGE = 256, cbox = new Int32Array(nt * 4), counts = new Uint32Array(W * H + 1), large = [];
    for (let t = 0; t < nt; t++) {
      if (!ok[t]) { cbox[t * 4] = -1; continue; }
      const o = t * 6;
      const u0 = Math.floor((Math.min(UV[o], UV[o + 2], UV[o + 4]) - minU) / du), u1 = Math.floor((Math.max(UV[o], UV[o + 2], UV[o + 4]) - minU) / du);
      const v0 = Math.floor((Math.min(UV[o + 1], UV[o + 3], UV[o + 5]) - minV) / du), v1 = Math.floor((Math.max(UV[o + 1], UV[o + 3], UV[o + 5]) - minV) / du);
      if (u1 < 0 || v1 < 0 || u0 >= W || v0 >= H) { cbox[t * 4] = -1; continue; }   // wholly outside the footprint
      if ((u1 - u0 + 1) * (v1 - v0 + 1) > LARGE) { large.push(t); cbox[t * 4] = -1; continue; }
      cbox[t * 4] = clampU(u0); cbox[t * 4 + 1] = clampU(u1); cbox[t * 4 + 2] = clampV(v0); cbox[t * 4 + 3] = clampV(v1);
      { const a0 = cbox[t * 4], a1 = cbox[t * 4 + 1], b0 = cbox[t * 4 + 2], b1 = cbox[t * 4 + 3]; for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) counts[v * W + u + 1]++; }
    }
    for (let k = 1; k <= W * H; k++) counts[k] += counts[k - 1];
    const fill = counts.slice(0, W * H), items = new Uint32Array(counts[W * H]);
    for (let t = 0; t < nt; t++) {
      const u0 = cbox[t * 4]; if (u0 < 0) continue;
      const u1 = cbox[t * 4 + 1], v0 = cbox[t * 4 + 2], v1 = cbox[t * 4 + 3];
      for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) items[fill[v * W + u]++] = t;
    }
    const bucketsFlat = {counts, items, large: Uint32Array.from(large)};
    built = {T, UV, c, e, n, minU, minV, du, W, H, ...bucketsFlat};
    Object.assign(report, {built: true, triangles: nt, entries: items.length, large: large.length, grid: [W, H], buildMs: Math.round(performance.now() - t0)});
  }
  // Highest surface radius along the radial line through `dir`, or null when the root has nothing there.
  function heightAt(dir) {
    if (!built) build();
    report.queries++;
    const {T, UV, c, e, n, minU, minV, du, W, H, counts, items, large} = built;
    const w = dir.x * c.x + dir.y * c.y + dir.z * c.z; if (w <= 1e-6) return null;
    const pu = (dir.x * e.x + dir.y * e.y + dir.z * e.z) / w, pv = (dir.x * n.x + dir.y * n.y + dir.z * n.z) / w;
    const cu = Math.floor((pu - minU) / du), cv = Math.floor((pv - minV) / du);
    const inGrid = cu >= 0 && cv >= 0 && cu < W && cv < H;
    if (!inGrid && !large.length) return null;
    const len = Math.hypot(dir.x, dir.y, dir.z), dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
    let best = null;
    const test = t => {
      const o = t * 6, x0 = UV[o], y0 = UV[o + 1], x1 = UV[o + 2], y1 = UV[o + 3], x2 = UV[o + 4], y2 = UV[o + 5];
      const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(den) < 1e-14) return;
      const l0 = ((y1 - y2) * (pu - x2) + (x2 - x1) * (pv - y2)) / den, l1 = ((y2 - y0) * (pu - x2) + (x0 - x2) * (pv - y2)) / den, l2 = 1 - l0 - l1;
      if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) return;
      // radius where the radial line meets the triangle's plane
      const q = t * 9, ax = T[q], ay = T[q + 1], az = T[q + 2];
      const ux = T[q + 3] - ax, uy = T[q + 4] - ay, uz = T[q + 5] - az, vx = T[q + 6] - ax, vy = T[q + 7] - ay, vz = T[q + 8] - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nd = nx * dx + ny * dy + nz * dz;
      if (Math.abs(nd) < 1e-12) return;
      const r = (nx * ax + ny * ay + nz * az) / nd;
      if (r > 0 && (best === null || r > best)) best = r;
    };
    if (inGrid) { const k = cv * W + cu; for (let i = counts[k]; i < counts[k + 1]; i++) test(items[i]); }
    for (let i = 0; i < large.length; i++) test(large[i]);
    return best;
  }
  return {heightAt, report, build, invalidate() { built = null; report.built = false; }};
}
