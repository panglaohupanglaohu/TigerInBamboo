// 高山圣城山体体素化（2026-11-10 用户：「建筑下基础平面不动，将原来的山体体素化，减少面……计算的方式简单可行」）。
//
// 做法（全部复用 REACodeRefactoring 的地形管线，vendor 副本）：
//   1. 在圣城中心取「贴球」局部坐标（x,z = 沿球面弧长，y = 离海面径向高度，单位米），把原山体 citadel-oskar-grid-mountain-surface 的三角形
//      全部换到这个坐标、按水平格分桶；
//   2. 铺一张 REA 不规则四边形网格（core/grid.js buildQuadGrid），每格中心竖直向下取原山面最高点 → 按层高取整写进 REA World（core/world.js）；
//   3. 用 REA 地形网格生成（terrain/terrainmesh.js buildTerrain：台地顶扇形混色、崖壁按层明暗 + 沉积线、崖顶暖色亮边、草皮垂边）出新山体；
//   4. 顶点从贴球坐标换回世界、再换到原山体父节点的局部坐标，挂在原山体旁边；
//   5. 原山体**不删、不改几何**：只把它的材质换成 visible=false 的克隆——走路 / 放房子 / 种树 / 岸线这些消费者仍读原平滑山面
//      （「建筑下基础平面不动」）；背光亮边层同样隐藏。
// 层数受 REA World 上限（MAX_LEVEL 12）限制：层高 = 山高 / 11 向上取整到 0.5 m。格宽默认 6 m（?citadelVoxelCell=），?citadelVoxel=0 关。
import * as THREE from 'three';
import { buildQuadGrid } from '../../vendor/townscaper-rea-refactoring/src/core/grid.js';
import { decorateCells } from '../../vendor/townscaper-rea-refactoring/src/core/spatial.js';
import { World, MAX_LEVEL } from '../../vendor/townscaper-rea-refactoring/src/core/world.js';
import { MeshWriter } from '../../vendor/townscaper-rea-refactoring/src/core/meshwriter.js';
import { buildTerrain } from '../../vendor/townscaper-rea-refactoring/src/terrain/terrainmesh.js';
import { officialOceanLevelAt } from '../waterV8/officialOcean.js';

const SOURCE = 'citadel-oskar-grid-mountain-surface';

/** 贴球局部坐标系（米）。center = 圣城中心方向上的海面点。 */
export function makeSphereFrame(up, seaR) {
  up = up.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up); if (east.lengthSq() < 1e-6) east.set(1, 0, 0); east.normalize();
  const north = up.clone().cross(east).normalize();
  return {
    up, east, north, seaR,
    toLocal(w, out = new THREE.Vector3()) {
      const r = w.length() || 1, d = Math.max(-1, Math.min(1, w.dot(up) / r)), th = Math.acos(d);
      const h = w.clone().multiplyScalar(1 / r).addScaledVector(up, -d), hl = h.length(), rho = th * seaR;
      if (hl < 1e-12) return out.set(0, r - seaR, 0);
      h.multiplyScalar(1 / hl);
      return out.set(h.dot(east) * rho, r - seaR, -h.dot(north) * rho);
    },
    toWorld(x, y, z, out = new THREE.Vector3()) {
      const rho = Math.hypot(x, z), th = rho / seaR, R = seaR + y;
      if (rho < 1e-9) return out.copy(up).multiplyScalar(R);
      const t = east.clone().multiplyScalar(x / rho).addScaledVector(north, -z / rho);
      return out.copy(up).multiplyScalar(Math.cos(th)).addScaledVector(t, Math.sin(th)).multiplyScalar(R);
    },
  };
}

/** 把一组三角形（世界坐标）按局部 xz 分桶，返回 heightAt(x,z)：竖直线与三角形交点的最高 y（局部米）。 */
export function buildHeightField(frame, meshes, bin = 2) {
  const bins = new Map(), tris = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const o of meshes) {
    o.updateWorldMatrix(true, false);
    const g = o.geometry, pos = g.attributes.position, ix = g.index?.array, n = ix ? ix.length : pos.count;
    for (let i = 0; i < n; i += 3) {
      frame.toLocal(a.fromBufferAttribute(pos, ix ? ix[i] : i).applyMatrix4(o.matrixWorld), a);
      frame.toLocal(b.fromBufferAttribute(pos, ix ? ix[i + 1] : i + 1).applyMatrix4(o.matrixWorld), b);
      frame.toLocal(c.fromBufferAttribute(pos, ix ? ix[i + 2] : i + 2).applyMatrix4(o.matrixWorld), c);
      const k = tris.length; tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      const x0 = Math.floor(Math.min(a.x, b.x, c.x) / bin), x1 = Math.floor(Math.max(a.x, b.x, c.x) / bin), z0 = Math.floor(Math.min(a.z, b.z, c.z) / bin), z1 = Math.floor(Math.max(a.z, b.z, c.z) / bin);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2500) continue;
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = x * 100003 + z; let l = bins.get(key); if (!l) bins.set(key, (l = [])); l.push(k); }
    }
  }
  const T = Float32Array.from(tris);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
  for (let i = 0; i < T.length; i += 3) { minX = Math.min(minX, T[i]); maxX = Math.max(maxX, T[i]); maxY = Math.max(maxY, T[i + 1]); minZ = Math.min(minZ, T[i + 2]); maxZ = Math.max(maxZ, T[i + 2]); }
  const heightAt = (x, z) => {
    const l = bins.get(Math.floor(x / bin) * 100003 + Math.floor(z / bin)); if (!l) return null;
    let best = null;
    for (const k of l) {
      const ax = T[k], ay = T[k + 1], az = T[k + 2], bx = T[k + 3], by = T[k + 4], bz = T[k + 5], cx = T[k + 6], cy = T[k + 7], cz = T[k + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * ay + l2 * by + l3 * cy; if (best === null || y > best) best = y;
    }
    return best;
  };
  return { heightAt, tris: T.length / 9, bounds: { minX, maxX, minZ, maxZ, maxY } };
}

/**
 * 纯计算：原山体 → REA World → REA 地形网格（贴球局部米坐标转回世界）。
 * 返回 { geometry(世界坐标), stats }。
 */
export function voxelizeMountain({ frame, meshes, cell = 6, level = null, seaMin = 0.3 }) {
  const field = buildHeightField(frame, meshes, Math.max(1, cell / 3));
  const { bounds } = field;
  const L = level ?? Math.max(1, Math.ceil((bounds.maxY / (MAX_LEVEL - 1)) * 2) / 2);
  const extent = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX), Math.abs(bounds.minZ), Math.abs(bounds.maxZ));
  // REA 网格的格子比 hexSize 小（四边形约 0.46 单位）：先建一张小网格量平均边长与覆盖半径，再按格宽 cell 米定单位缩放 unit 和需要的网格半径。
  const probe = decorateCells(buildQuadGrid({ radius: 6, hexSize: 1, seed: 20261110 }));
  const edgeOf = (gr) => { let s = 0, n = 0; for (const c of gr.cells) for (let i = 0; i < c.n; i++) { const a = c.pts[i], b = c.pts[(i + 1) % c.n]; s += Math.hypot(a.x - b.x, a.z - b.z); n++; } return s / n; };
  const reach = (gr) => Math.min(...gr.cells.filter((c) => c.edgeNeighbors.some((x) => x < 0)).map((c) => Math.hypot(c.cx, c.cz)));
  const unit = cell / edgeOf(probe);                       // 1 网格单位 = unit 米
  const radius = Math.max(4, Math.ceil(6 * (extent + cell) / (reach(probe) * unit)) + 1);
  const grid = decorateCells(buildQuadGrid({ radius, hexSize: 1, seed: 20261110 }));
  const world = new World(grid);
  let land = 0, maxLv = 0;
  for (const c of grid.cells) {
    const y = field.heightAt(c.cx * unit, c.cz * unit);
    if (y == null || y < seaMin) continue;
    const lv = Math.max(1, Math.min(MAX_LEVEL - 1, Math.round(y / L)));
    world.fill(c, lv, { rock: true }); land++; maxLv = Math.max(maxLv, lv);
  }
  world.touch();
  const w = new MeshWriter();
  buildTerrain(w, world, { L: L / unit });
  const g = w.toGeometry();
  // 单位 → 米 → 世界（贴球）
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { frame.toWorld(pos.getX(i) * unit, pos.getY(i) * unit, pos.getZ(i) * unit, v); pos.setXYZ(i, v.x, v.y, v.z); }
  pos.needsUpdate = true;
  g.deleteAttribute('normal'); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  return { geometry: g, world, stats: { sourceTris: field.tris, voxelTris: pos.count / 3, cells: grid.cells.length, land, maxLevel: maxLv, cell, unit: +unit.toFixed(2), level: L, radius, extent: +extent.toFixed(1), maxY: +bounds.maxY.toFixed(1) } };
}

/** 装进游戏：生成体素山体、隐藏原山体显示（几何留作地面）。 */
export function installCitadelVoxelMountain(castle, { seaR = 160, oceanLevelAt = officialOceanLevelAt } = {}) {
  const q = new URLSearchParams(globalThis.location?.search || '');
  if (q.get('citadelVoxel') === '0' || !castle) return { skipped: true };
  const src = castle.getObjectByName(SOURCE);
  if (!src?.geometry?.attributes?.position || src.userData.tmVoxelized) return { skipped: !src ? 'no-source' : 'done' };
  const t0 = performance.now();
  src.updateWorldMatrix(true, false);
  if (!src.geometry.boundingSphere) src.geometry.computeBoundingSphere();
  const centre = src.geometry.boundingSphere.center.clone().applyMatrix4(src.matrixWorld), up = centre.clone().normalize();
  const frame = makeSphereFrame(up, seaR + oceanLevelAt(up));
  const cell = Number(q.get('citadelVoxelCell')) > 0 ? Number(q.get('citadelVoxelCell')) : 6;
  const level = Number(q.get('citadelVoxelLevel')) > 0 ? Number(q.get('citadelVoxelLevel')) : null;
  const { geometry, stats } = voxelizeMountain({ frame, meshes: [src], cell, level });
  // 世界 → 原山体父节点局部
  const inv = src.parent.matrixWorld.clone().invert();
  geometry.applyMatrix4(inv); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.name = 'citadel-voxel-mountain';
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = 'citadel-voxel-mountain'; mesh.castShadow = src.castShadow; mesh.receiveShadow = true;
  mesh.userData.voxelOf = SOURCE; mesh.userData.noRaycast = true; mesh.raycast = () => {};   // 只是外观；地面 / 碰撞仍是原山面
  src.parent.add(mesh);
  // 原山体：几何保留给走路 / 放置 / 岸线，材质换成不画的克隆
  const hide = (o) => { if (!o) return; const m = o.material; o.userData.tmVoxelOrigMaterial = m; const h = (Array.isArray(m) ? m : [m]).map((x) => { const c = x.clone(); c.visible = false; return c; }); o.material = Array.isArray(m) ? h : h[0]; o.castShadow = false; };
  hide(src); hide(castle.getObjectByName('backlit-highlight-' + SOURCE));
  src.userData.tmVoxelized = true;
  const report = { ...stats, ms: Math.round(performance.now() - t0) };
  globalThis.__tmCitadelVoxel = { report, mesh, restore() { for (const o of [src, castle.getObjectByName('backlit-highlight-' + SOURCE)]) if (o?.userData.tmVoxelOrigMaterial) { o.material = o.userData.tmVoxelOrigMaterial; o.castShadow = true; } mesh.removeFromParent(); src.userData.tmVoxelized = false; } };
  return report;
}
