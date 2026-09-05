// =====================================================================
//  stencil 挖窗原型（阶段 6 · G8）—— C11 [Claude] 规格，2026-09-04
//
//  S20②：Oskar 的窗**不是贴在墙上的几何**，是用 stencil 在墙上挖洞再画窗内壁。
//  好处有两条，都能量：① 窗洞有真实厚度（现在的 `town-window` 是贴片，
//  侧看是纸）；② 墙面不必为每扇窗切拓扑。
//
//  ---------------------------------------------------------------
//  为什么这件事在本仓库比教科书难：**描边壳**
//  ---------------------------------------------------------------
//  `assets/toon.js:addOutline` 给每个表面挂一个 **BackSide 放大壳**做描边。
//  墙被 stencil 丢掉片元之后，壳还在——于是窗洞里会露出一块黑。
//  所以壳材质**必须做同一道 stencil 测试**。这就是 PLAN §阶段6 点名的冲突，
//  也是本原型唯一真正的技术风险。
//
//  壳材质来自 `_outlineMatCache` 的**全局缓存**，直接改它会污染整个场景
//  （城门、废墟、岛屿都在用）。所以本模块**只 clone、不改原材质**，
//  clone 结果自己缓存，卸载时还原。`plan()` 里 `sharedMaterialsMutated` 恒为 0，
//  probe 会断言这一条。
//
//  ---------------------------------------------------------------
//  为什么是「每层两个 draw call」而不是「每扇窗两个」
//  ---------------------------------------------------------------
//  门 L 写的是 **draw call 增量 ≤ +2/层**。逐窗建 cutter/reveal 是 +2/窗
//  （高山 978 格里几百扇窗 → 上千 draw call，直接废掉）。
//  所以本原型把**一层里所有窗的 cutter 合成一个网格、reveal 合成一个网格**，
//  正好 +2/层。合并靠本文件里的 `mergeQuads`，不依赖 three 的 BufferGeometryUtils。
//
//  ---------------------------------------------------------------
//  渲染顺序（改动这里之前先读完）
//  ---------------------------------------------------------------
//    renderOrder  内容            colorWrite depthWrite stencil
//    base-20      cutter（每层1个） false      **true**   Always → Replace(ref)
//    base+0       墙 / 描边壳       true       true       NotEqual(ref) → Keep
//    base+10      reveal（每层1个） true       true       Equal(ref)    → Keep
//    base+20      玻璃              true       false      Equal(ref)    → Keep
//
//  cutter **写深度**是有意的：它落在窗面上，比墙面稍靠外一点点，
//  于是它身后更远的墙自然被深度剔掉，stencil 不会"穿透"打到远处的墙。
//  ⚠️ **已知失效场景**：相机与窗之间还隔着另一堵更近的墙时（例如透过拱洞看过去），
//  那堵近墙会被打洞。教科书解法是先做一遍深度预通道，代价是墙的 draw call 翻倍，
//  超出门 L 的预算。**先按现在这样做原型，等主人看过截图再决定要不要买单。**
//
//  ---------------------------------------------------------------
//  本模块**不**做的事
//  ---------------------------------------------------------------
//  · 不动 `citadelTown.js`：窗几何照旧生成，本模块是**装配后的一道 pass**，
//    与 `applyInkOutlines` 同一层次。这样开关一关就完全回到原路径。
//  · 不改任何共享材质（只 clone）。
//  · 不接生产：`P.stencilWindowsV1` 默认 **false**。
//    ⚠️ **我看不到画面**，所以「窗洞里不露描边壳」这一条**没有被验证过**，
//    只有材质状态机与 draw call 账目是机器判定的。上生产前必须有截图对照。
// =====================================================================

export const STENCIL_WINDOW_REF = 1;

/** 渲染顺序基准（相对当前 renderOrder 的偏移，见文件头表格） */
export const STENCIL_ORDER = Object.freeze({
  cutter: -20,
  surface: 0,
  reveal: 10,
  glass: 20,
});

const isOutline = (o) => o.userData?.isOutline === true;
const isWindowGlass = (o) => o.userData?.citadelWindow === true;
const isWindowPart = (o) => typeof o.userData?.citadelWindowPart === "string";

/**
 * 纯数据的「计划」：不碰材质、不建网格，只回答「哪些网格进哪一档」。
 * headless 可测，probe 与 G-19 都用它。
 *
 * @returns {{
 *   levels: Array<{ name:string, windows:number, surfaces:number, outlines:number }>,
 *   windows: Array<{ cell:{ix:number,iy:number,iz:number}, position:number[], quaternion:number[], scale:number[] }>,
 *   totals: { windows:number, surfaces:number, outlines:number, drawCallDelta:number, drawCallPerLevel:number },
 *   sharedMaterialsMutated: number,
 * }}
 */
export function stencilWindowPlan(root) {
  const levels = [];
  const windows = [];
  let surfaces = 0;
  let outlines = 0;

  const levelRoots = [];
  root.traverse?.((o) => {
    if (/^town-terrace-\d+-level-\d+$/.test(o.name || "") || /^town-level-\d+$/.test(o.name || "")) {
      levelRoots.push(o);
    }
  });

  for (const level of levelRoots) {
    let w = 0;
    let s = 0;
    let ol = 0;
    level.traverse((o) => {
      if (!o.isMesh) return;
      if (isOutline(o)) { ol++; return; }
      if (isWindowGlass(o)) {
        w++;
        const u = o.userData;
        // 窗的朝向：yaw = atan2(dx, dz)（citadelTown 里就是这么摆的），反解回 [dx,dz]
        const yaw = o.rotation?.y ?? 0;
        const dir = [Math.round(Math.sin(yaw)), Math.round(Math.cos(yaw))];
        windows.push({
          cell: { ix: u.cellIx ?? u.cell?.ix, iy: u.cellIy ?? u.cell?.iy, iz: u.cellIz ?? u.cell?.iz },
          dir,
          position: o.position?.toArray?.() ?? [0, 0, 0],
          quaternion: o.quaternion?.toArray?.() ?? [0, 0, 0, 1],
          scale: o.scale?.toArray?.() ?? [1, 1, 1],
        });
        return;
      }
      if (isWindowPart(o)) return;    // 框/棂跟着玻璃走，不算墙面
      s++;
    });
    if (w || s) levels.push({ name: level.name, windows: w, surfaces: s, outlines: ol });
    surfaces += s;
    outlines += ol;
  }

  const levelsWithWindows = levels.filter((l) => l.windows > 0).length;
  return {
    levels,
    windows,
    totals: {
      windows: windows.length,
      surfaces,
      outlines,
      // 每个有窗的层 +1 cutter +1 reveal
      drawCallDelta: levelsWithWindows * 2,
      drawCallPerLevel: levelsWithWindows ? 2 : 0,
    },
    sharedMaterialsMutated: 0,   // 本模块只 clone，永远是 0；probe 断言它
  };
}

/**
 * 门 L 的「窗位不跨格角」判据。
 *
 * ⚠️ **G-19 工单原来写的判据是错的**（2026-09-04 实测）：它说「每窗 AABB 落在单格内」。
 * 做不到，也不该做到——窗**就贴在墙面上**，而墙面就是两格的分界面（窗心在
 * `cx(ix) + dx*(cs/2 + 0.028)`）。所以每扇窗的 AABB 天然跨在分界线上：
 * 420 扇里 217 扇「跨格」，全部是这个原因，不是缺陷。
 *
 * 真正该守的是**不跨格角**：窗沿着墙走的那一段（along-wall 区间）必须完整落在
 * 它所属那一格的边长之内。跨过格角意味着一扇窗折过 90° 贴到两面墙上——
 * 那才是穿帮。
 *
 * @param {{cell:{ix:number,iz:number}, center:[number,number], dir:[number,number], halfWidth:number}} win
 *   `dir` 是墙的外法线在 XZ 上的方向（DIRS 里的 [dx,dz]，只会是 ±1/0）
 * @returns {{ ok:boolean, along:string, overhang:number }} overhang = 超出格边的量（世界单位，≤0 为合格）
 */
export function windowSpansCellCorner(win, { cellSize, gridSize }) {
  const half = (gridSize - 1) / 2;
  const [dx, dz] = win.dir;
  // 墙面朝 ±X → 窗沿 Z 走；朝 ±Z → 窗沿 X 走
  const alongZ = Math.abs(dx) > Math.abs(dz);
  const idx = alongZ ? win.cell.iz : win.cell.ix;
  const c = alongZ ? win.center[1] : win.center[0];
  const cellCenter = (idx - half) * cellSize;
  const overhang = Math.abs(c - cellCenter) + win.halfWidth - cellSize / 2;
  return { ok: overhang <= 1e-6, along: alongZ ? "z" : "x", overhang: Math.round(overhang * 1e6) / 1e6 };
}

/**
 * 旧名保留：单纯回答「AABB 四角落在同一格吗」。**不要拿它当门 L 的判据**
 * （理由见 `windowSpansCellCorner`）。留着是因为它对「装饰是否溢出到邻格」还有用。
 */
export function windowCellFootprint(cornersXZ, { cellSize, gridSize }) {
  const half = (gridSize - 1) / 2;
  const idx = ([x, z]) => [
    Math.floor(x / cellSize + half + 0.5),
    Math.floor(z / cellSize + half + 0.5),
  ];
  const first = idx(cornersXZ[0]);
  for (let i = 1; i < cornersXZ.length; i++) {
    const c = idx(cornersXZ[i]);
    if (c[0] !== first[0] || c[1] !== first[1]) return { cell: null, spans: true };
  }
  return { cell: first, spans: false };
}

// ---------------------------------------------------------------------
// 材质：只 clone，绝不改原件
// ---------------------------------------------------------------------
function stencilClone(THREE, material, mode, ref) {
  const key = `__stencilWin_${mode}_${ref}`;
  if (material[key]) return material[key];
  const m = material.clone();
  m.stencilWrite = true;
  m.stencilRef = ref;
  if (mode === "cut") {
    m.stencilFunc = THREE.AlwaysStencilFunc;
    m.stencilZPass = THREE.ReplaceStencilOp;
    m.stencilFail = THREE.KeepStencilOp;
    m.stencilZFail = THREE.KeepStencilOp;
    m.colorWrite = false;
    m.depthWrite = true;
  } else {
    m.stencilFunc = mode === "keepOutside" ? THREE.NotEqualStencilFunc : THREE.EqualStencilFunc;
    m.stencilFail = THREE.KeepStencilOp;
    m.stencilZFail = THREE.KeepStencilOp;
    m.stencilZPass = THREE.KeepStencilOp;
  }
  m.needsUpdate = true;
  Object.defineProperty(material, key, { value: m, enumerable: false, configurable: true });
  return m;
}

/** 把若干「已烘到世界/层坐标」的四边形合成一个 BufferGeometry（避免依赖 BufferGeometryUtils） */
export function mergeQuads(THREE, quads) {
  const pos = [];
  const nor = [];
  const idx = [];
  let base = 0;
  for (const q of quads) {
    for (const v of q.corners) pos.push(v[0], v[1], v[2]);
    for (let i = 0; i < 4; i++) nor.push(q.normal[0], q.normal[1], q.normal[2]);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/**
 * 装配后的一道 pass。与 `applyInkOutlines` 同层次；`enabled=false` 时原样返回。
 *
 * @param {object} root 城堡容器
 * @param {object} THREE three 命名空间（本模块不 import three，保持可 headless 测）
 * @returns {object} `stencilWindowPlan` 的 totals + 实际建了几个 cutter/reveal
 */
export function applyStencilWindows(root, THREE, {
  enabled = false,
  ref = STENCIL_WINDOW_REF,
  revealDepth = 0.12,
  cutterInset = 0.006,
} = {}) {
  const plan = stencilWindowPlan(root);
  if (!enabled) return { ...plan.totals, applied: false, cutters: 0, reveals: 0 };

  const levelRoots = [];
  root.traverse((o) => {
    if (/^town-terrace-\d+-level-\d+$/.test(o.name || "") || /^town-level-\d+$/.test(o.name || "")) levelRoots.push(o);
  });

  let cutters = 0;
  let reveals = 0;
  const cleanup = [];

  for (const level of levelRoots) {
    const glass = [];
    const surfaces = [];
    level.traverse((o) => {
      if (!o.isMesh) return;
      if (isWindowGlass(o)) { glass.push(o); return; }
      if (isWindowPart(o)) return;
      surfaces.push(o);                 // 含描边壳：壳也要做同一道测试，否则窗洞露黑
    });
    if (!glass.length) continue;

    // ① 墙 + 描边壳：NotEqual(ref) → 窗洞处丢弃
    for (const s of surfaces) {
      const before = s.material;
      s.material = Array.isArray(before)
        ? before.map((m) => stencilClone(THREE, m, "keepOutside", ref))
        : stencilClone(THREE, before, "keepOutside", ref);
      s.renderOrder = (s.renderOrder || 0) + STENCIL_ORDER.surface;
      cleanup.push(() => { s.material = before; });
    }

    // ② cutter：整层所有窗合成一个网格
    const quads = [];
    const normal = new THREE.Vector3();
    for (const g of glass) {
      g.updateMatrixWorld?.(true);
      const m = g.matrix;                       // 层组局部坐标即可：cutter 挂在同一层组下
      const half = 0.5;
      const corners = [
        [-half, -half, 0], [half, -half, 0], [half, half, 0], [-half, half, 0],
      ].map((p) => {
        const v = new THREE.Vector3(p[0], p[1], p[2] - cutterInset);
        // 玻璃几何是单位化的平面 → 用它自身的包围盒尺寸还原
        g.geometry.computeBoundingBox?.();
        const bb = g.geometry.boundingBox;
        if (bb) {
          v.x *= (bb.max.x - bb.min.x) || 1;
          v.y *= (bb.max.y - bb.min.y) || 1;
        }
        return v.applyMatrix4(m).toArray();
      });
      normal.set(0, 0, 1).applyQuaternion(g.quaternion);
      quads.push({ corners, normal: normal.toArray() });
    }
    const cutterMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
    cutterMat.stencilWrite = true;
    cutterMat.stencilRef = ref;
    cutterMat.stencilFunc = THREE.AlwaysStencilFunc;
    cutterMat.stencilZPass = THREE.ReplaceStencilOp;
    cutterMat.stencilFail = THREE.KeepStencilOp;
    cutterMat.stencilZFail = THREE.KeepStencilOp;
    const cutter = new THREE.Mesh(mergeQuads(THREE, quads), cutterMat);
    cutter.name = "town-window-stencil-cutter";
    cutter.renderOrder = STENCIL_ORDER.cutter;
    cutter.userData.skipInkOutline = true;
    cutter.userData.transientFx = true;        // 不进合并块（`geometryMerge` 认这个标记）
    cutter.raycast = () => {};
    level.add(cutter);
    cutters++;

    // ③ reveal：窗内壁，往里退 revealDepth；Equal(ref) 只画在洞里
    const revealQuads = [];
    for (const q of quads) {
      const n = q.normal;
      const back = q.corners.map((c) => [
        c[0] - n[0] * revealDepth, c[1] - n[1] * revealDepth, c[2] - n[2] * revealDepth,
      ]);
      revealQuads.push({ corners: back, normal: [-n[0], -n[1], -n[2]] });
    }
    const revealSrc = glass[0].material;
    const revealMat = stencilClone(THREE, revealSrc, "keepInside", ref);
    const reveal = new THREE.Mesh(mergeQuads(THREE, revealQuads), revealMat);
    reveal.name = "town-window-stencil-reveal";
    reveal.renderOrder = STENCIL_ORDER.reveal;
    reveal.userData.skipInkOutline = true;
    reveal.userData.transientFx = true;
    reveal.raycast = () => {};
    level.add(reveal);
    reveals++;

    // ④ 玻璃本体：Equal(ref)，最后画
    for (const g of glass) {
      const before = g.material;
      g.material = stencilClone(THREE, before, "keepInside", ref);
      g.renderOrder = STENCIL_ORDER.glass;
      cleanup.push(() => { g.material = before; });
    }
  }

  root.userData.stencilWindowCleanup = () => {
    for (const fn of cleanup) fn();
    // 先收集再删：traverse 期间 removeFromParent 会改 children 数组，
    // three 的 traverse 用的是索引循环，删着删着就读到 undefined 了。
    const doomed = [];
    root.traverse((o) => {
      if (o.name === "town-window-stencil-cutter" || o.name === "town-window-stencil-reveal") doomed.push(o);
    });
    for (const o of doomed) {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
      o.removeFromParent();
    }
    root.userData.stencilWindowCleanup = null;
  };

  return { ...plan.totals, applied: true, cutters, reveals };
}
