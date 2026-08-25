// =====================================================================
// SurfaceProviderFromIndexedMesh（V7-G9，TODO 1221）
// 纯数据 surface 提供者：三角形重心/重心坐标采样、法线、语义、最近面查询。
// 不依赖渲染库；visual/collision/nav 共用同一份 indexed mesh。
// =====================================================================

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

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

export function createSurfaceProviderFromIndexedMesh(mesh, { idPrefix = "mc", chunkId = "0" } = {}) {
  if (!mesh?.positions || !mesh?.indices) throw new Error("indexed mesh positions/indices required");
  const { positions, normals = null, indices, semantics = null } = mesh;
  if (indices.length % 3 !== 0) throw new Error("indices length must be a multiple of 3");
  const triangleCount = indices.length / 3;

  const vertex = (vi) => [positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]];
  const triangleVertices = (t) => {
    if (!(t >= 0 && t < triangleCount)) throw new Error(`triangle ${t} out of range`);
    return [vertex(indices[t * 3]), vertex(indices[t * 3 + 1]), vertex(indices[t * 3 + 2])];
  };

  return Object.freeze({
    kind: "surface-provider-from-indexed-mesh",
    mesh,
    positions,
    indices,
    triangleCount,
    surfaceId: (t) => `${idPrefix}:${chunkId}:${t}`,
    triangleVertices,
    barycenter(t) {
      const [a, b, c] = triangleVertices(t);
      return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    },
    /** u/v 为重心坐标（w = 1-u-v）；返回插值位置/法线/语义。 */
    sampleBarycentric(t, u, v) {
      const w = 1 - u - v;
      if (!(u >= -1e-9 && v >= -1e-9 && w >= -1e-9)) throw new Error("barycentric u/v must satisfy u>=0, v>=0, u+v<=1");
      const ia = indices[t * 3]; const ib = indices[t * 3 + 1]; const ic = indices[t * 3 + 2];
      const position = [0, 1, 2].map((axis) => positions[ia * 3 + axis] * w + positions[ib * 3 + axis] * u + positions[ic * 3 + axis] * v);
      let normal = null;
      if (normals) {
        normal = [0, 1, 2].map((axis) => normals[ia * 3 + axis] * w + normals[ib * 3 + axis] * u + normals[ic * 3 + axis] * v);
        const length = Math.hypot(...normal) || 1;
        normal = normal.map((n) => n / length);
      }
      const semantic = semantics ? Math.max(0, Math.min(255, Math.round(semantics[ia] * w + semantics[ib] * u + semantics[ic] * v))) : null;
      return { position, normal, semantic };
    },
    /** 最近面查询（暴力扫描；数据层正确性优先，加速结构留给上层）。 */
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
