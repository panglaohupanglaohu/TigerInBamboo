// =====================================================================
// Marching Cubes — 256-case indexed chunk mesher（V7-G8）
// 共享边缓存保证同一 chunk 内索引复用；cellRange 供带 halo 的 chunk 只
// 输出核心单元。输入 ScalarField，输出 transferable-friendly typed arrays。
// 选项：normalMode = face（默认，面法线顶点累积）/ flat（low-poly 面法线）
// / gradient（中央差分，TODO 1198）；splitVertices 可控 split（TODO 1206）；
// materialGroups 按语义分组输出 index buffer（TODO 1199）。
// =====================================================================

import { EDGE_TABLE, TRI_TABLE } from "./marchingCubesTables.js";

// 角/边编号与 marchingCubesTables.js 同源（three.js MarchingCubes 约定）：
// bit i 必须对应第 i 个角，否则 TRI_TABLE 会引用不跨越 iso 的边，
// 插值 t 被钳到端点，产生重合顶点/退化三角形。
const CORNERS = Object.freeze([
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
]);
const EDGES = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
]);

function vertexId(field, x, y, z) { return (z * field.resolution.y + y) * field.resolution.x + x; }
function interpolate(a, b, va, vb, iso) {
  const denominator = vb - va;
  const t = Math.abs(denominator) < 1e-12 ? 0.5 : Math.max(0, Math.min(1, (iso - va) / denominator));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, t];
}

export function marchingCubes(field, { isoLevel = 0, semanticAt, flowAt, cellRange, normalMode = "face", splitVertices = false, materialGroups = false } = {}) {
  if (!field?.resolution || !field?.valueAt || !field?.worldPosition) throw new Error("marchingCubes requires a ScalarField-like input");
  const nx = field.resolution.x; const ny = field.resolution.y; const nz = field.resolution.z;
  const min = cellRange?.min || [0, 0, 0];
  const max = cellRange?.max || [nx - 1, ny - 1, nz - 1];
  const vertices = []; const semantic = []; const flow = []; const indices = []; const edgeCache = new Map();
  const scalarAt = (x, y, z) => field.valueAt(x, y, z);
  const semanticGrid = semanticAt || (field.semantics ? (_position, x, y, z) => field.semantics[vertexId(field, x, y, z)] : null);
  // flow/tangent 顶点通道（TODO 1199）：优先外部 sampler，否则读 field.flow 网格
  const flowGrid = flowAt || (field.flow && typeof field.flowAt === "function" ? (_position, x, y, z) => field.flowAt(x, y, z) : null);
  const tStart = performance.now();
  const addVertex = (x, y, z, edge, values) => {
    const [ca, cb] = EDGES[edge];
    const a = CORNERS[ca]; const b = CORNERS[cb];
    const ax = x + a[0]; const ay = y + a[1]; const az = z + a[2];
    const bx = x + b[0]; const by = y + b[1]; const bz = z + b[2];
    const ida = vertexId(field, ax, ay, az); const idb = vertexId(field, bx, by, bz);
    const cacheKey = ida < idb ? `${ida}:${idb}` : `${idb}:${ida}`;
    const existing = edgeCache.get(cacheKey);
    if (existing !== undefined) return existing;
    const pa = field.worldPosition(ax, ay, az); const pb = field.worldPosition(bx, by, bz);
    const [px, py, pz, t] = interpolate(pa, pb, values[ca], values[cb], isoLevel);
    const index = vertices.length / 3;
    vertices.push(px, py, pz);
    if (semanticGrid) {
      const sa = Number(semanticGrid(pa, ax, ay, az) ?? 0); const sb = Number(semanticGrid(pb, bx, by, bz) ?? 0);
      semantic.push(Math.max(0, Math.min(255, Math.round(sa + (sb - sa) * t))));
    }
    if (flowGrid) {
      const fa = flowGrid(pa, ax, ay, az) || [0, 0, 0]; const fb = flowGrid(pb, bx, by, bz) || [0, 0, 0];
      flow.push(fa[0] + (fb[0] - fa[0]) * t, fa[1] + (fb[1] - fa[1]) * t, fa[2] + (fb[2] - fa[2]) * t);
    }
    edgeCache.set(cacheKey, index);
    return index;
  };
  let cellsVisited = 0; let activeCells = 0; let degenerateTriangles = 0;
  for (let z = min[2]; z < Math.min(max[2], nz - 1); z++) for (let y = min[1]; y < Math.min(max[1], ny - 1); y++) for (let x = min[0]; x < Math.min(max[0], nx - 1); x++) {
    cellsVisited++;
    const values = CORNERS.map(([dx, dy, dz]) => scalarAt(x + dx, y + dy, z + dz));
    // 命中（含浮点噪声级近命中）iso 的采样先收拢再向内侧挪一个 epsilon：
    // 否则插值 t 恰好落在端点，同一格点上多条边产生重合顶点，
    // 退化为零面积三角形（V7-G16 shapes 门禁，torus 网格对齐实例）。
    // epsilon 须使 L⁴ > 1e-24 的退化判定（L≈t·cell），取 1e-6 对应 t≥1e-5 量级，
    // 对典型梯度≈1 的 SDF 仅移动曲面 ~1e-6 世界单位，视觉不可见。
    for (let c = 0; c < 8; c++) if (Math.abs(values[c] - isoLevel) < 1e-6) values[c] = isoLevel - 1e-6;
    let cube = 0;
    for (let c = 0; c < 8; c++) if (values[c] < isoLevel) cube |= 1 << c;
    const edgeMask = EDGE_TABLE[cube];
    if (edgeMask === 0) continue;
    activeCells++;
    const local = new Array(12);
    for (let edge = 0; edge < 12; edge++) if (edgeMask & (1 << edge)) local[edge] = addVertex(x, y, z, edge, values);
    const tableOffset = cube * 16;
    for (let i = 0; i < 16 && TRI_TABLE[tableOffset + i] !== -1; i += 3) {
      const a = local[TRI_TABLE[tableOffset + i]];
      const b = local[TRI_TABLE[tableOffset + i + 1]];
      const c = local[TRI_TABLE[tableOffset + i + 2]];
      // 退化过滤与报告（TODO V7-G8）：重复 index 或零面积三角形不进入 index buffer
      if (a === b || b === c || a === c) { degenerateTriangles++; continue; }
      const ax = vertices[a * 3]; const ay = vertices[a * 3 + 1]; const az = vertices[a * 3 + 2];
      const ux = vertices[b * 3] - ax; const uy = vertices[b * 3 + 1] - ay; const uz = vertices[b * 3 + 2] - az;
      const vx = vertices[c * 3] - ax; const vy = vertices[c * 3 + 1] - ay; const vz = vertices[c * 3 + 2] - az;
      const cx = uy * vz - uz * vy; const cy = uz * vx - ux * vz; const cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz <= 1e-24) { degenerateTriangles++; continue; }
      // 发射顺序取 (a, c, b)：本模块约定 value<iso 为实体内部，
      // 该绕序下 cross(b-a, c-a) 指向外侧（球体 fixture 全顶点验证）。
      indices.push(a, c, b);
    }
  }
  const tMeshEnd = performance.now();
  let normals = new Float32Array(vertices.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3; const ib = indices[i + 1] * 3; const ic = indices[i + 2] * 3;
    const ax = vertices[ib] - vertices[ia]; const ay = vertices[ib + 1] - vertices[ia + 1]; const az = vertices[ib + 2] - vertices[ia + 2];
    const bx = vertices[ic] - vertices[ia]; const by = vertices[ic + 1] - vertices[ia + 1]; const bz = vertices[ic + 2] - vertices[ia + 2];
    const nxv = ay * bz - az * by; const nyv = az * bx - ax * bz; const nzv = ax * by - ay * bx;
    for (const index of [ia, ib, ic]) { normals[index] += nxv; normals[index + 1] += nyv; normals[index + 2] += nzv; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length;
  }
  let positionArray = Float32Array.from(vertices);
  if (normalMode === "gradient" && typeof field.sampleWorld === "function") {
    const epsilon = Math.max(1e-4, Math.min(...field.spacing) * 0.5);
    for (let i = 0; i < positionArray.length; i += 3) {
      const p = [positionArray[i], positionArray[i + 1], positionArray[i + 2]];
      const sample = (axis, delta) => { const q = p.slice(); q[axis] += delta; return field.sampleWorld(q, 0); };
      const gx = sample(0, epsilon) - sample(0, -epsilon);
      const gy = sample(1, epsilon) - sample(1, -epsilon);
      const gz = sample(2, epsilon) - sample(2, -epsilon);
      const length = Math.hypot(gx, gy, gz) || 1;
      normals[i] = gx / length; normals[i + 1] = gy / length; normals[i + 2] = gz / length;
    }
  }
  let semanticArray = semantic.length ? Uint8Array.from(semantic) : null;
  let flowArray = flow.length ? Float32Array.from(flow) : null;
  let indexArray = Uint32Array.from(indices);
  // 可控 vertex split（TODO 1206）：每三角形独立顶点，flat 法线精确；位置值不变
  if (splitVertices && indexArray.length > 0) {
    const n = indexArray.length;
    const sp = new Float32Array(n * 3); const sn = new Float32Array(n * 3);
    const ss = semanticArray ? new Uint8Array(n) : null;
    const sf = flowArray ? new Float32Array(n * 3) : null;
    const si = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const src = indexArray[i];
      sp.set(positionArray.subarray(src * 3, src * 3 + 3), i * 3);
      sn.set(normals.subarray(src * 3, src * 3 + 3), i * 3);
      if (ss) ss[i] = semanticArray[src];
      if (sf) sf.set(flowArray.subarray(src * 3, src * 3 + 3), i * 3);
      si[i] = i;
    }
    positionArray = sp; normals = sn; semanticArray = ss; flowArray = sf; indexArray = si;
  }
  // low-poly flat normal（TODO 1206）：在最终数组上按三角形重写面法线；
  // split 后每三角形顶点独立 → 精确 flat；共享顶点时被后写面覆盖（近似）。
  if (normalMode === "flat") {
    normals = new Float32Array(positionArray.length);
    for (let i = 0; i < indexArray.length; i += 3) {
      const ia = indexArray[i] * 3; const ib = indexArray[i + 1] * 3; const ic = indexArray[i + 2] * 3;
      const ax = positionArray[ib] - positionArray[ia]; const ay = positionArray[ib + 1] - positionArray[ia + 1]; const az = positionArray[ib + 2] - positionArray[ia + 2];
      const bx = positionArray[ic] - positionArray[ia]; const by = positionArray[ic + 1] - positionArray[ia + 1]; const bz = positionArray[ic + 2] - positionArray[ia + 2];
      const nxv = ay * bz - az * by; const nyv = az * bx - ax * bz; const nzv = ax * by - ay * bx;
      const length = Math.hypot(nxv, nyv, nzv) || 1;
      for (const index of [ia, ib, ic]) { normals[index] = nxv / length; normals[index + 1] = nyv / length; normals[index + 2] = nzv / length; }
    }
  }
  const tNormalEnd = performance.now();
  // material group 输出（TODO 1199）：按三角形首顶点语义重排 index buffer，groups 连续覆盖
  let groups = null;
  if (materialGroups && semanticArray && indexArray.length > 0) {
    const tris = [];
    for (let i = 0; i < indexArray.length; i += 3) tris.push([indexArray[i], indexArray[i + 1], indexArray[i + 2], semanticArray[indexArray[i]]]);
    tris.sort((a, b) => a[3] - b[3]);
    const reordered = new Uint32Array(indexArray.length);
    groups = [];
    let cursor = 0;
    for (const [a, b, c, material] of tris) {
      if (groups.length === 0 || groups[groups.length - 1].material !== material) groups.push({ material, start: cursor, count: 0 });
      reordered[cursor++] = a; reordered[cursor++] = b; reordered[cursor++] = c;
      groups[groups.length - 1].count += 3;
    }
    indexArray = reordered;
  }
  const tGroupEnd = performance.now();
  return {
    kind: "indexed-marching-cubes",
    positions: positionArray,
    normals,
    indices: indexArray,
    semantics: semanticArray,
    flow: flowArray,
    groups,
    // visual/collision 共用同一 position/index 数据（TODO 1206），不派生第二份网格
    collision: { positions: positionArray, indices: indexArray },
    stats: {
      cellsVisited, activeCells, vertexCount: positionArray.length / 3, triangleCount: indexArray.length / 3,
      edgeCacheSize: edgeCache.size, degenerateTriangles, normalMode, splitVertices,
      timings: { meshMs: tMeshEnd - tStart, normalMs: tNormalEnd - tMeshEnd, groupMs: tGroupEnd - tNormalEnd },
    },
  };
}

export const MARCHING_CUBES_CASE_COUNT = 256;
export const MARCHING_CUBES_TABLE_SIZE = TRI_TABLE.length;
