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

  // 压缩必须**原地**做：同一个 attribute、同一条 array，只收 count。
  //
  // 两条互相拉扯的约束，缺一条就出事：
  //
  // (1) 不许换 array（保留同一实例、换更短的数组）。three 的 WebGLAttributes
  //     用 WeakMap 按 attribute 实例记住 GPU buffer，并存下首次上传时的
  //     array.byteLength；此后每次 needsUpdate 都校验
  //     `data.size !== attribute.array.byteLength`，换短数组这条永远不相等，
  //     于是**每一帧 render 都 throw**。异常抛在 projectObject 里 = render
  //     半途中断：音频线程照跑（有声音），画面停在最后一帧、编辑器点不动。
  //     主人 2026-09-05：「系统播放声音，但是无法继续编辑，画面不动了」。
  //
  // (2) 也不许换 attribute 实例（那样能绕开校验，three 会给新实例建新 buffer）。
  //     旧实例连同它的 GPU buffer 会变成孤儿——three 只在 geometry.dispose()
  //     时释放 buffer，而这块几何还活着。一次编辑几 MB，连续编辑攒到几百 MB
  //     显存，就是主人说的「老是崩溃」。
  //
  // 同时满足两条的写法只有一个：缓冲区原封不动，只把要留的三角形往前搬，
  // 然后收 count 与 drawRange。byteLength 全程不变 → 校验通过；实例不变 →
  // 不产生孤儿 buffer；不分配 → 增量编辑这条热路径上零 GC 压力。
  //
  // 代价是数组尾部留着上一版的残数据。**所有下游都必须按 count 读几何，
  // 不能按 array.length 读**——geometryMerge.mergeGroup 就踩过这条（批量 set
  // 时按整条 array 长度算偏移，直接 RangeError: offset is out of bounds）。
  //
  // 前向压缩天然安全：head <= from 恒成立；且 TypedArray.prototype.set 对同
  // buffer 的重叠拷贝有规范定义（等价于先克隆源）。
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    const size = attr.itemSize;
    let head = 0;
    for (const [a, b] of keep) {
      const from = a * 3 * size;
      const to = b * 3 * size;
      if (head !== from) attr.array.set(attr.array.subarray(from, to), head);
      head += to - from;
    }
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
