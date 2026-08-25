// =====================================================================
//  HalfEdgeGraph — 任意邻接图适配器（V7-G1）
//  从 n-gon 面列表（顶点用稳定 ID）构建 cell-per-face 图：
//  方向 token = "e:{minVid}:{maxVid}"（共享边的两端点，与遍历序无关）。
//  保留主网格 face ID 与对偶顶点 ID（face 重心）的双向映射。
//  构建时验证：双向边 opposite 一致、无重复邻边、无悬空顶点 ID。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/**
 * @param {object} opts
 * @param {Array<Array<string|number>>} opts.faces n-gon 面列表，顶点以稳定 ID 标识，
 *   绕序一致（建议 CCW）；自环/退化面会报错。
 * @param {(a: [number,number,number], b: [number,number,number]) => [number,number,number]} [opts.centroidOf]
 *   面重心计算（对偶顶点位置）；缺省用顶点 ID 排序序代替（纯拓扑用途）。
 */
export function createHalfEdgeGraph({ faces, positions }) {
  if (!Array.isArray(faces) || faces.length === 0) throw new Error("HalfEdgeGraph: faces required");
  const faceIds = faces.map((f, i) => (Array.isArray(f) && f.id !== undefined ? f.id : `f:${i}`));

  // 共享边 → 邻接方向 token
  const edgeMap = new Map(); // "minVid|maxVid" -> [{faceIndex, faceId}]
  const faceEdges = faces.map((f, fi) => {
    if (!Array.isArray(f) || f.length < 3) {
      throw new Error(`HalfEdgeGraph: face ${faceIds[fi]} must have >= 3 vertices`);
    }
    const seen = new Set();
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      if (a === b) throw new Error(`HalfEdgeGraph: face ${faceIds[fi]} has degenerate edge`);
      const key = edgeKey(a, b);
      if (seen.has(key)) throw new Error(`HalfEdgeGraph: face ${faceIds[fi]} has duplicate edge ${key}`);
      seen.add(key);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({ faceIndex: fi, faceId: faceIds[fi], a, b });
    }
    return seen;
  });

  // 邻接表 + 主/对偶稳定 ID 映射
  const adjacency = faces.map(() => []);
  const edgeOwners = faces.map(() => []);
  for (const [key, owners] of edgeMap) {
    if (owners.length === 1) continue; // 边界边：无对偶邻居
    if (owners.length > 2) {
      throw new Error(`HalfEdgeGraph: non-manifold edge ${key} owned by ${owners.length} faces`);
    }
    const [f0, f1] = owners;
    const direction = `e:${key.replace("|", ":")}`;
    adjacency[f0.faceIndex].push({ to: f1.faceIndex, direction, edge: key });
    adjacency[f1.faceIndex].push({ to: f0.faceIndex, direction, edge: key });
    edgeOwners[f0.faceIndex].push(key);
    edgeOwners[f1.faceIndex].push(key);
  }
  // 稳定方向序：按 direction 字符串排序
  for (let i = 0; i < adjacency.length; i++) {
    adjacency[i].sort((a, b) => (a.direction < b.direction ? -1 : a.direction > b.direction ? 1 : 0));
  }

  // 对偶顶点 ID：face 重心（positions 可选）
  const dualVertexId = faceIds.map((id) => `d:${id}`);
  const idToIndex = new Map(faceIds.map((id, i) => [id, i]));

  // 边端点（稳定 min/max 序），供方向 token 分类（朝向/长度类别）使用
  const edgeVertices = new Map();
  for (const [key, owners] of edgeMap) {
    const { a, b } = owners[0];
    edgeVertices.set(key, String(a) < String(b) ? [a, b] : [b, a]);
  }

  const graph = {
    kind: "half-edge-graph",
    get cellCount() {
      return faces.length;
    },
    cells() {
      return faceIds.map((id, index) => ({ id, index }));
    },
    cellId(index) {
      return faceIds[index];
    },
    /** 对偶顶点 ID（face 重心的稳定命名） */
    dualVertexIdOf(index) {
      return dualVertexId[index];
    },
    indexOfId(id) {
      return idToIndex.get(id) ?? -1;
    },
    /** @returns {{to:number, direction:string}[]} */
    neighborsOf(index) {
      return adjacency[index] || [];
    },
    /** 面的边 key 列表（含边界边） */
    edgesOf(index) {
      return [...faceEdges[index]];
    },
    /** 全部边信息（跨面共享与否；vertices 为稳定 min/max 序端点 ID） */
    allEdges() {
      const out = [];
      for (const [key, owners] of edgeMap) {
        out.push({ key, vertices: edgeVertices.get(key), owners: owners.map((o) => o.faceId) });
      }
      return out;
    },
    /**
     * 边几何（需要 positions）：{ key, vertices, dx, dy, length }
     * dx/dy 取顶点平面前两分量；无 positions 时抛错（调用方需纯拓扑则别调）。
     */
    edgeGeometryOf(key) {
      const verts = edgeVertices.get(key);
      if (!verts) throw new Error(`HalfEdgeGraph: unknown edge ${key}`);
      if (!positions) throw new Error("HalfEdgeGraph: edgeGeometryOf requires positions");
      const pa = positions[verts[0]];
      const pb = positions[verts[1]];
      if (!pa || !pb) throw new Error(`HalfEdgeGraph: missing position for edge ${key}`);
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      return { key, vertices: verts, dx, dy, length: Math.hypot(dx, dy) };
    },
    validate() {
      const errors = [];
      // 1) 双向边 opposite 与无重复
      for (let i = 0; i < adjacency.length; i++) {
        const dirs = new Set();
        for (const e of adjacency[i]) {
          if (dirs.has(e.direction)) errors.push(`duplicate-adjacent-edge:${faceIds[i]}:${e.direction}`);
          dirs.add(e.direction);
          const back = adjacency[e.to].find((b) => b.to === i && b.direction === e.direction);
          if (!back) errors.push(`missing-reverse:${faceIds[i]}->${faceIds[e.to]}`);
        }
      }
      // 2) 悬空顶点 ID：边引用的顶点必须出现在至少一个面的顶点集
      const vertexSet = new Set();
      for (const f of faces) for (const v of f) vertexSet.add(v);
      for (const f of faces) {
        for (const v of f) {
          if (v === undefined || v === null) errors.push(`dangling-vertex:${v}`);
        }
      }
      return { ok: errors.length === 0, errors: [...new Set(errors)] };
    },
  };
  return graph;
}

/** 边 key：两端点 ID 排序后拼接（与遍历方向无关） */
function edgeKey(a, b) {
  const s = String(a) < String(b) ? [a, b] : [b, a];
  return `${s[0]}|${s[1]}`;
}

/** 主/对偶稳定交叉 ID 表（V7-G1：idMap.faceToDualVertex / vertexToDualFace） */
export function buildCrossIds(graph) {
  const faceToDualVertex = new Map();
  const vertexToDualFace = new Map();
  const cells = graph.cells();
  for (const { id, index } of cells) {
    faceToDualVertex.set(id, graph.dualVertexIdOf(index));
  }
  for (const { id, index } of cells) {
    vertexToDualFace.set(graph.dualVertexIdOf(index), id);
  }
  return { faceToDualVertex, vertexToDualFace };
}
