// =====================================================================
// Chunk seam validator（V7-G8）
// 以量化世界坐标比较相邻 chunk 的共享平面顶点；只报告几何不连续，
// 不把三角形绕序差异误判为裂缝。
// =====================================================================

function key(position, tolerance) { return position.map((v) => Math.round(v / tolerance)).join(":"); }

export function seamVertexKeys(mesh, { axis = 0, coordinate, tolerance = 1e-5 } = {}) {
  if (!mesh?.positions) throw new Error("seamVertexKeys requires a mesh");
  const out = new Set();
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const position = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
    if (coordinate === undefined || Math.abs(position[axis] - coordinate) <= tolerance) {
      // Floating-point interpolation can put the same shared-plane vertex at
      // coordinate±epsilon in adjacent chunks. Canonicalize that one axis
      // before quantization; otherwise 0.99999 and 1.00001 become false cracks.
      if (coordinate !== undefined) position[axis] = coordinate;
      out.add(key(position, tolerance));
    }
  }
  return out;
}

export function validateChunkSeam(left, right, options = {}) {
  const a = seamVertexKeys(left, options); const b = seamVertexKeys(right, options);
  const onlyLeft = [...a].filter((value) => !b.has(value));
  const onlyRight = [...b].filter((value) => !a.has(value));
  return { ok: onlyLeft.length === 0 && onlyRight.length === 0, onlyLeft, onlyRight, shared: [...a].filter((value) => b.has(value)).length };
}
