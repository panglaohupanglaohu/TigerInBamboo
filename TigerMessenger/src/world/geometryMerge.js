// =====================================================================
//  静态几何合并（Static Geometry Merging）
//
//  大量同材质小网格 → 少数大几何，把绘制调用降 10~20 倍。
//  与 three/examples BufferGeometryUtils.mergeGeometries 同思路，
//  但针对本项目的 toon 管线做了三件事：
//    1) 变换烘焙：每个 mesh 的完整 world 变换（相对合并锚点 root）直接
//       烘焙进顶点（position/normal/uv/color），合并网格以单位变换挂回
//       root 下 —— root 自身的位移/旋转/缩放全部保留。
//    2) 统一非索引化：合并前每个几何 clone + toNonIndexed，三角形序号
//       即 faceIndex，供「面区间 → 数据」映射（圣城编辑器拾取 cell）。
//    3) 描边合并：addOutline 的反向壳子节点（userData.isOutline）按
//       描边材质分组合并，挂回合并网格下，保持 BackSide 描边语义。
//
//  适用条件（调用方保证）：组内全部为静态网格 —— 无逐帧位移/旋转、
//  无运行时材质切换、无 raycast 拾取依赖（或已通过 faceToCell 映射保留）。
// =====================================================================
import * as THREE from "three";

const _rel = new THREE.Matrix4();
const _rootInv = new THREE.Matrix4();

/**
 * 把 root 下所有表面网格按材质合并成少量大网格。
 * @param {THREE.Object3D} root 合并锚点：变换烘焙到 root 局部系，
 *   合并网格以单位变换挂回 root 下；root 自身的变换完全保留。
 * @param {{
 *   skip?: (mesh: THREE.Mesh) => boolean,
 *   onSurface?: (merged: THREE.Mesh, material: THREE.Material,
 *                segments: { mesh: THREE.Mesh, triStart: number, triCount: number }[],
 *                groupTriStart: number) => void,
 *   onOutline?: (merged: THREE.Mesh, material: THREE.Material,
 *                sources: THREE.Mesh[], groupTriStart: number) => void,
 * }} [options]
 *   - skip: 返回 true 的网格不合并、保持原样（如运行时换材质的窗口）。
 *   - onSurface: 每组合并完成后回调；segments 给出组内每个源网格在
 *     该组合并几何中的三角形区间（triStart 相对组起点，源几何已非索引化），
 *     groupTriStart 为该组合并几何在 root 全部合并几何中的三角形起始序号
 *     （跨组累计，供全局面索引映射，如编辑器 cell 拾取）。
 *   - onOutline: 描边组合并完成后回调（sources 为描边网格，几何与表面共享）。
 * @returns {{ surfaces: THREE.Mesh[], outlines: THREE.Mesh[],
 *             removedSurfaces: number, removedOutlines: number }}
 */
export function mergeStaticGroup(root, options = {}) {
  const {
    skip = () => false,
    onSurface = null,
    onOutline = null,
    // Namespaced merged marker: callers that merge multiple independent
    // static groups into the same root (e.g. town layers vs highland
    // decoration) must use distinct tags so idempotent cleanup of one
    // group never removes another group's merged meshes.
    mergedTag = true,
  } = options;

  root.updateWorldMatrix(true, true);
  _rootInv.copy(root.matrixWorld).invert();

  // ---------- 1. 收集表面网格与描边子节点 ----------
  const surfaces = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    if (skip(o)) return;
    surfaces.push(o);
  });
  if (!surfaces.length) return { surfaces: [], outlines: [], removedSurfaces: 0, removedOutlines: 0 };

  // 每个表面烘焙一次；描边与表面共享几何实例，直接用表面烘焙结果
  const bakedByMesh = new Map(); // mesh -> { geo, triCount }
  const bake = (mesh) => {
    let entry = bakedByMesh.get(mesh);
    if (!entry) {
      // G30 增量性能：先变换（indexed 顶点少 2-3x）后展开，减少热路径矩阵变换量。
      const src = mesh.geometry;
      const hasIndex = !!src.index;
      const geo = src.clone();
      _rel.copy(mesh.matrixWorld).premultiply(_rootInv);
      geo.applyMatrix4(_rel);
      const final = hasIndex ? geo.toNonIndexed() : geo;
      const pos = final.getAttribute("position");
      entry = { geo: final, triCount: pos ? pos.count / 3 : 0 };
      bakedByMesh.set(mesh, entry);
    }
    return entry;
  };

  /** 合并一组已烘焙几何：统一 attrs（position/normal/uv/color），容错缺失属性 */
  const mergeGroup = (baked) => {
    const all = baked.map((b) => b.geo);
    const attrNames = ["position", "normal", "uv", "color"].filter((name) =>
      all.every((g) => g.getAttribute(name))
    );
    // G30 增量性能：预分配 TypedArray + 批量 set，替代逐顶点 push（dirty
    // level 每 edit 重合并，这是热路径）。
    let totalVerts = 0;
    for (const g of all) totalVerts += g.getAttribute("position").count;
    const arrays = {};
    for (const name of attrNames) {
      arrays[name] = new Float32Array(totalVerts * all[0].getAttribute(name).itemSize);
    }
    let offset = 0;
    for (const g of all) {
      const pos = g.getAttribute("position");
      const count = pos.count;
      for (const name of attrNames) {
        const attr = g.getAttribute(name);
        if (!attr) continue;
        const src = attr.count === count ? attr.array : attr.array.subarray(0, count * attr.itemSize);
        arrays[name].set(src, offset * attr.itemSize);
      }
      offset += count;
    }
    const merged = new THREE.BufferGeometry();
    for (const name of attrNames) {
      merged.setAttribute(
        name,
        new THREE.Float32BufferAttribute(arrays[name], all[0].getAttribute(name).itemSize)
      );
    }
    merged.computeBoundingSphere();
    return { merged, totalVerts };
  };

  // ---------- 2. 描边收集：必须在表面网格移除前执行。
  // 描边按材质分组（同键共享材质实例），几何用表面烘焙副本。
  // 遍历 root 下所有非 outline 网格的子节点——包括被 skip 的表面（如窗口）：
  // 表面因运行时材质切换不合并，但描边无切换仍可合并。 ----------
  const outlineGroups = new Map(); // material -> { outline, surface }[]
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    for (const child of o.children) {
      if (child.isMesh && child.userData.isOutline) {
        let list = outlineGroups.get(child.material);
        if (!list) outlineGroups.set(child.material, (list = []));
        list.push({ outline: child, surface: o });
      }
    }
  });

  // ---------- 3. 表面网格按材质分组 ----------
  const surfaceGroups = new Map(); // material -> mesh[]
  for (const mesh of surfaces) {
    let list = surfaceGroups.get(mesh.material);
    if (!list) surfaceGroups.set(mesh.material, (list = []));
    list.push(mesh);
  }

  const madeSurfaces = [];
  const madeOutlines = [];
  const removedSurfaces = [];
  const removedOutlines = [];
  let triCursor = 0;

  for (const [material, meshes] of surfaceGroups) {
    // 组内每个源网格的三角形区间（相对组起点）
    const segments = [];
    let groupTri = 0;
    const baked = meshes.map((mesh) => {
      const entry = bake(mesh);
      segments.push({ mesh, triStart: groupTri, triCount: entry.triCount });
      groupTri += entry.triCount;
      return entry;
    });
    const { merged, totalVerts } = mergeGroup(baked);
    const mergedMesh = new THREE.Mesh(merged, material);
    mergedMesh.castShadow = meshes.some((m) => m.castShadow);
    mergedMesh.receiveShadow = meshes.some((m) => m.receiveShadow);
    mergedMesh.userData.mergedGeometry = mergedTag;
    mergedMesh.userData.mergedSourceCount = meshes.length;
    root.add(mergedMesh);
    madeSurfaces.push(mergedMesh);
    const triCount = totalVerts / 3;
    if (onSurface) onSurface(mergedMesh, material, segments, triCursor);
    triCursor += triCount;
    for (const mesh of meshes) {
      removedSurfaces.push(mesh);
      mesh.removeFromParent();
    }
  }

  // ---------- 4. 描边合并：描边材质分组，几何用表面烘焙副本 ----------
  for (const [material, entries] of outlineGroups) {
    const { merged, totalVerts } = mergeGroup(entries.map((e) => bake(e.surface)));
    const mergedMesh = new THREE.Mesh(merged, material);
    mergedMesh.raycast = () => {};
    mergedMesh.userData.isOutline = true;
    mergedMesh.userData.mergedGeometry = mergedTag;
    root.add(mergedMesh);
    madeOutlines.push(mergedMesh);
    if (onOutline) onOutline(mergedMesh, material, entries.map((e) => e.outline), triCursor);
    triCursor += totalVerts / 3;
    for (const { outline } of entries) {
      removedOutlines.push(outline);
      outline.removeFromParent();
    }
  }

  // ---------- 4. 释放不再被引用的几何（去重；材质共享，不 dispose）。
  // 注意 addOutline 的描边与表面共享同一几何实例：若表面被 skip（如窗口），
  // 其描边虽被合并但表面仍引用原几何——只 dispose 无任何存活网格引用的几何。 ----------
  const stillUsed = new Set();
  root.traverse((o) => {
    if (o.isMesh && o.geometry) stillUsed.add(o.geometry);
  });
  const dead = new Set();
  for (const mesh of removedSurfaces) if (!stillUsed.has(mesh.geometry)) dead.add(mesh.geometry);
  for (const mesh of removedOutlines) if (!stillUsed.has(mesh.geometry)) dead.add(mesh.geometry);
  for (const g of dead) g.dispose();

  return {
    surfaces: madeSurfaces,
    outlines: madeOutlines,
    removedSurfaces: removedSurfaces.length,
    removedOutlines: removedOutlines.length,
  };
}

/** 便捷统计：数 root 下的网格总数（含描边）。供测试/探针验证合并前后。 */
export function countMeshes(root) {
  let n = 0;
  root.traverse((o) => {
    if (o.isMesh) n++;
  });
  return n;
}
