// =====================================================================
//  V5 光照 · K6 表面光照只读接口 + current-mesh 适配器（TODO 565/566）
//
//  与 Grok procgen 侧的约定（TODO 565）：
//  - createSurfaceLightingQuery(provider) 只暴露只读方法
//    （occupancyAt / materialTokenAt / surfaceNormalAt / nearestSurface），
//    对 provider 只做函数调用与属性读取，从不写入；Kimi 侧不修改地形生成
//    或士兵导航。provider 鸭子类型对齐
//    TigerMessenger/src/procgen/bridge/surfaceProvider.js 的
//    createSurfaceProviderFromIndexedMesh：需要 nearestFace(point)、
//    sampleBarycentric(t, u, v)、triangleVertices(t)、surfaceId(t)。
//
//  - createCurrentMeshSurfaceAdapter(meshesDesc)（TODO 566）：
//    V4 接口未就绪时，从当前 mesh 描述数据（positions/indices/semantics
//    纯数组）构建同样鸭子类型的 occupancy 查询适配器。本文件零 import，
//    不依赖 procgen 模块，因此接口未就绪/被并行改动时适配器独立可用；
//    最近面算法与 surfaceProvider 同源（Ericson 最近点 + 暴力扫描），
//    接口到位后由 tools/test_lighting_surface_contract.mjs 做 parity。
//
//  occupancy 语义：只有表面数据没有实体体素，occupied 定义为
//  “点到最近表面的距离 <= shellRadius”（表面壳占据），半径显式可配。
// =====================================================================

export const SURFACE_QUERY_KIND = "surface-lighting-query";
export const SURFACE_ADAPTER_KIND = "current-mesh-surface-adapter";

/** occupancy 壳半径默认值（世界单位）：表面两侧各 0.3 视为占据。 */
export const OCCUPANCY_SHELL_RADIUS = 0.3;

// ---------- 纯函数向量小工具（与 surfaceProvider 同算法，保证 parity） ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (v) => {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
};

function assertPoint(point) {
  if (!Array.isArray(point) && !(ArrayBuffer.isView(point))) throw new Error("point must be [x,y,z]");
  if (point.length < 3 || [point[0], point[1], point[2]].some((n) => !Number.isFinite(n))) {
    throw new Error("point must be finite [x,y,z]");
  }
}

function assertProvider(provider) {
  for (const fn of ["nearestFace", "sampleBarycentric", "triangleVertices"]) {
    if (typeof provider?.[fn] !== "function") {
      throw new Error(`surface provider missing required method: ${fn}`);
    }
  }
}

/** 点到三角形最近点（Ericson, Real-Time Collision Detection），返回重心坐标。 */
function closestPointOnTriangle(p, a, b, c) {
  const ab = sub(b, a); const ac = sub(c, a); const ap = sub(p, a);
  const d1 = dot(ab, ap); const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { point: a.slice(), barycentric: [1, 0, 0] };
  const bp = sub(p, b); const d3 = dot(ab, bp); const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { point: b.slice(), barycentric: [0, 1, 0] };
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return { point: [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v], barycentric: [1 - v, v, 0] };
  }
  const cp = sub(p, c); const d5 = dot(ab, cp); const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { point: c.slice(), barycentric: [0, 0, 1] };
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return { point: [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w], barycentric: [1 - w, 0, w] };
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return { point: [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w], barycentric: [0, 1 - w, w] };
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom; const w = vc * denom;
  return { point: [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w], barycentric: [1 - v - w, v, w] };
}

function faceNormalOf(provider, t) {
  const [a, b, c] = provider.triangleVertices(t);
  return normalize(cross(sub(b, a), sub(c, a)));
}

/**
 * 只读表面光照查询。包装 provider（procgen SurfaceProvider 或本文件的
 * current-mesh adapter），只读：实现中没有任何对 provider 的写操作，
 * 测试用 Proxy 写计数 = 0 证明。
 */
export function createSurfaceLightingQuery(provider, { shellRadius = OCCUPANCY_SHELL_RADIUS } = {}) {
  assertProvider(provider);
  if (!(shellRadius > 0)) throw new Error("shellRadius must be > 0");

  /** 最近表面查询（provider.nearestFace 的直通只读封装）。 */
  function nearestSurface(point) {
    assertPoint(point);
    const hit = provider.nearestFace([point[0], point[1], point[2]]);
    if (!hit) return null;
    return Object.freeze({
      surfaceId: hit.id,
      triangle: hit.triangle,
      point: Object.freeze(hit.point.slice()),
      distance: hit.distance,
      barycentric: Object.freeze(hit.barycentric.slice()),
    });
  }

  /** 占据查询：distance <= shellRadius → occupied。 */
  function occupancyAt(point) {
    const hit = nearestSurface(point);
    if (!hit) return Object.freeze({ occupied: false, distance: Infinity, surfaceId: null });
    return Object.freeze({
      occupied: hit.distance <= shellRadius,
      distance: hit.distance,
      surfaceId: hit.surfaceId,
    });
  }

  /**
   * 材质 token：最近面重心坐标处插值 semantic → `material:<n>`；
   * 无 semantic 数据 → "material:unknown"。
   */
  function materialTokenAt(point) {
    const hit = nearestSurface(point);
    if (!hit) return Object.freeze({ token: "material:unknown", semantic: null, surfaceId: null });
    const s = provider.sampleBarycentric(hit.triangle, hit.barycentric[1], hit.barycentric[2]);
    const semantic = s?.semantic ?? null;
    return Object.freeze({
      token: semantic == null ? "material:unknown" : `material:${semantic}`,
      semantic,
      surfaceId: hit.surfaceId,
    });
  }

  /** 表面法线：顶点法线插值优先；mesh 无法线时退化到最近面平面法线。 */
  function surfaceNormalAt(point) {
    const hit = nearestSurface(point);
    if (!hit) return Object.freeze({ normal: null, surfaceId: null });
    const s = provider.sampleBarycentric(hit.triangle, hit.barycentric[1], hit.barycentric[2]);
    const normal = s?.normal ? normalize(s.normal) : faceNormalOf(provider, hit.triangle);
    return Object.freeze({ normal: Object.freeze(normal), surfaceId: hit.surfaceId });
  }

  return Object.freeze({
    kind: SURFACE_QUERY_KIND,
    shellRadius,
    nearestSurface,
    occupancyAt,
    materialTokenAt,
    surfaceNormalAt,
  });
}

/**
 * current-mesh 适配器（TODO 566）：从当前 mesh 描述数据构建与
 * SurfaceProvider 同鸭子类型的只读表面源。
 * @param {Array<{positions: ArrayLike<number>, indices: ArrayLike<number>, semantics?: ArrayLike<number>}>} meshesDesc
 *   每个元素是一条 indexed mesh 的纯数据描述（世界坐标已在 positions 里
 *   烘好；适配器不做矩阵变换）。多个 mesh 合并为一锅三角形汤。
 */
export function createCurrentMeshSurfaceAdapter(meshesDesc, { idPrefix = "cm", chunkId = "0" } = {}) {
  if (!Array.isArray(meshesDesc) || meshesDesc.length === 0) throw new Error("meshesDesc must be a non-empty array");
  const positions = [];
  const indices = [];
  const semantics = [];
  let hasSemantics = false;
  for (const [mi, mesh] of meshesDesc.entries()) {
    if (!mesh?.positions || !mesh?.indices) throw new Error(`meshesDesc[${mi}]: positions/indices required`);
    if (mesh.positions.length % 3 !== 0) throw new Error(`meshesDesc[${mi}]: positions length must be a multiple of 3`);
    if (mesh.indices.length % 3 !== 0) throw new Error(`meshesDesc[${mi}]: indices length must be a multiple of 3`);
    const vertexOffset = positions.length / 3;
    const vertexCount = mesh.positions.length / 3;
    if (mesh.semantics != null && mesh.semantics.length !== vertexCount) {
      throw new Error(`meshesDesc[${mi}]: semantics length must equal vertex count`);
    }
    for (let i = 0; i < mesh.positions.length; i++) {
      const v = Number(mesh.positions[i]);
      if (!Number.isFinite(v)) throw new Error(`meshesDesc[${mi}]: positions must be finite`);
      positions.push(v);
    }
    for (let i = 0; i < mesh.indices.length; i++) {
      const idx = Number(mesh.indices[i]);
      if (!Number.isInteger(idx) || idx < 0 || idx >= vertexCount) {
        throw new Error(`meshesDesc[${mi}]: index ${idx} out of range`);
      }
      indices.push(vertexOffset + idx);
    }
    if (mesh.semantics != null) {
      hasSemantics = true;
      for (let i = 0; i < vertexCount; i++) semantics.push(Number(mesh.semantics[i]) || 0);
    } else {
      for (let i = 0; i < vertexCount; i++) semantics.push(0);
    }
  }
  const triangleCount = indices.length / 3;

  const vertex = (vi) => [positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]];
  const triangleVertices = (t) => {
    if (!(t >= 0 && t < triangleCount)) throw new Error(`triangle ${t} out of range`);
    return [vertex(indices[t * 3]), vertex(indices[t * 3 + 1]), vertex(indices[t * 3 + 2])];
  };

  return Object.freeze({
    kind: SURFACE_ADAPTER_KIND,
    positions,
    indices,
    triangleCount,
    surfaceId: (t) => `${idPrefix}:${chunkId}:${t}`,
    triangleVertices,
    barycenter(t) {
      const [a, b, c] = triangleVertices(t);
      return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    },
    /** u/v 为重心坐标（w = 1-u-v）；返回插值位置/语义。法线恒 null（交给查询层退化为面法线）。 */
    sampleBarycentric(t, u, v) {
      const w = 1 - u - v;
      if (!(u >= -1e-9 && v >= -1e-9 && w >= -1e-9)) throw new Error("barycentric u/v must satisfy u>=0, v>=0, u+v<=1");
      const ia = indices[t * 3]; const ib = indices[t * 3 + 1]; const ic = indices[t * 3 + 2];
      const position = [0, 1, 2].map((axis) => positions[ia * 3 + axis] * w + positions[ib * 3 + axis] * u + positions[ic * 3 + axis] * v);
      const semantic = hasSemantics
        ? Math.max(0, Math.min(255, Math.round(semantics[ia] * w + semantics[ib] * u + semantics[ic] * v)))
        : null;
      return { position, normal: null, semantic };
    },
    /** 最近面查询（与 surfaceProvider 同源：Ericson 最近点 + 暴力扫描）。 */
    nearestFace(point) {
      const p = [point[0], point[1], point[2]];
      if (p.some((n) => !Number.isFinite(n))) throw new Error("point must be finite");
      let best = null;
      for (let t = 0; t < triangleCount; t++) {
        const [a, b, c] = triangleVertices(t);
        const hit = closestPointOnTriangle(p, a, b, c);
        const distance = Math.hypot(p[0] - hit.point[0], p[1] - hit.point[1], p[2] - hit.point[2]);
        if (!best || distance < best.distance) best = { triangle: t, id: `${idPrefix}:${chunkId}:${t}`, point: hit.point, distance, barycentric: hit.barycentric };
      }
      return best;
    },
  });
}
