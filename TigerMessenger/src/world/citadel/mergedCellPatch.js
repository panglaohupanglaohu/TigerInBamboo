// =====================================================================
//  合并块局部替换（2026-09-03，Option C 第 2 步）
//
//  增量编辑原本的做法是「整块删掉 dirty 层的合并网格，再把 dirty 格挂回去」。
//  可合并块装的是那一层**所有**格子的几何——删一大块、补几小块，差额凭空消失。
//  上一版的止血是把 dirty 扩成整层重建，几何对了，但每次 edit 要重建整层模块，
//  P50 从 108ms 涨到 558ms。
//
//  这里换成「压缩」：只把 dirty 格占的三角形区间从顶点缓冲里剔掉，其余原样保留。
//  非 dirty 格不需要重新生成模块，这才是省下那 450ms 的地方。
//
//  合并几何是非索引化的（mergeStaticGroup 里 toNonIndexed），所以第 t 个三角形
//  固定占顶点 [3t, 3t+3)，区间寻址是纯算术。
// =====================================================================

/** 合并几何里没有被 faceToCell 认领的区间（无 cell 的装饰/地形）也必须留住。 */
function keepRanges(dropped, totalTris) {
  const keep = [];
  let cursor = 0;
  for (const d of dropped) {
    if (d.triStart > cursor) keep.push([cursor, d.triStart]);
    cursor = Math.max(cursor, d.triStart + d.triCount);
  }
  if (cursor < totalTris) keep.push([cursor, totalTris]);
  return keep;
}

/**
 * 从合并网格里摘掉 isDirty 命中的区间，顶点缓冲原地压缩，faceToCell 同步重编号。
 *
 * 谓词收的是**整个区间**而不是单格：跨格构件（屋顶分量/花园/晾衣绳）的归属
 * 是一组格，只传 cell 就表达不了。
 *
 * @param {THREE.Mesh} mesh 带 userData.faceToCell 的合并网格
 * @param {(seg: {triStart:number,triCount:number,cell?:object,cells?:string[]}) => boolean} isDirty
 * @returns {number} 摘掉的三角形数；0 = 没动。返回后若 triangleCount 为 0，调用方应移除该网格
 */
export function dropCellsFromMerged(mesh, isDirty) {
  const geometry = mesh?.geometry;
  const position = geometry?.attributes?.position;
  const faceToCell = mesh?.userData?.faceToCell;
  if (!position || !Array.isArray(faceToCell) || !faceToCell.length) return 0;

  const dropped = faceToCell
    .filter((seg) => seg && seg.triCount > 0 && isDirty(seg))
    .sort((a, b) => a.triStart - b.triStart);
  if (!dropped.length) return 0;

  const totalTris = Math.floor(position.count / 3);
  const keep = keepRanges(dropped, totalTris);
  const keptTris = keep.reduce((n, [a, b]) => n + (b - a), 0);
  const removedTris = totalTris - keptTris;
  if (removedTris <= 0) return 0;

  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    const size = attr.itemSize;
    const next = new attr.array.constructor(keptTris * 3 * size);
    let head = 0;
    for (const [a, b] of keep) {
      const from = a * 3 * size;
      const to = b * 3 * size;
      next.set(attr.array.subarray(from, to), head);
      head += to - from;
    }
    attr.array = next;
    attr.count = keptTris * 3;
    attr.needsUpdate = true;
  }

  // 保留段重编号：新起点 = 旧起点 − 它前面被摘掉的三角形数
  const shiftAt = (triStart) => {
    let shift = 0;
    for (const d of dropped) {
      if (d.triStart >= triStart) break;
      shift += d.triCount;
    }
    return shift;
  };
  const droppedSet = new Set(dropped);
  mesh.userData.faceToCell = faceToCell
    .filter((seg) => !droppedSet.has(seg))
    .map((seg) => ({ ...seg, triStart: seg.triStart - shiftAt(seg.triStart) }));
  mesh.userData.hasMergedCells = mesh.userData.faceToCell.length > 0;

  geometry.setDrawRange(0, keptTris * 3);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox?.();
  return removedTris;
}

/** 合并网格当前的三角形数——压缩后判断是否该整块移除。 */
export function mergedTriangleCount(mesh) {
  const position = mesh?.geometry?.attributes?.position;
  return position ? Math.floor(position.count / 3) : 0;
}
