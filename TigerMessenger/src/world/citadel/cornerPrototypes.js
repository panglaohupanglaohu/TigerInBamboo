// =====================================================================
//  角落分段目录（阶段 4 · G6）—— C9 [Claude] 规格，2026-09-04
//
//  S20①：*模块挂在格角上，不是格上*。这份目录回答三件事，G-13 的图适配器与
//  G-14 的接缝测试只需要读它，不需要再做任何设计决定：
//    ① 一个「角柱」到底占哪块空间（`CORNER_CUBE` 段）
//    ② 有哪些基础件、每件六向 socket 是什么（`CORNER_PROTOTYPES`）
//    ③ 哪个 8-bit mask 允许哪些件（`cornerAllowedProtoIds` / `cornerAllowedClassIds`）
//  外加一件 G-14 需要的：④ 每件在给定 mask 下的几何零件表（`cornerGeometryParts`），
//  纯数字，不 import Three.js —— 接缝测试才能在 headless 下逐位比顶点。
//
//  ---------------------------------------------------------------
//  CORNER_CUBE · 角柱占哪块空间（这是整份目录的地基，先读这段）
//  ---------------------------------------------------------------
//  角柱节点 = (gx, gz, iy)。它坐在**四个格的公共角**上、**两层之间**：
//    · 水平方向：gx 是格顶点编号，左右各半格 → 覆盖格 (gx-1) 与 (gx) 各一半
//    · 竖直方向：iy 层与 iy+1 层各半层
//  于是它的 8 个「角」恰好是 8 个**格心**——这就是 PLAN 说的 marching cubes：
//  格心是采样点，角柱是对偶立方体。
//
//     mask 位序（与 tools/gen_corner_mask_table.mjs 逐字一致，别改）：
//       bit = dx | (dz << 1) | (dy << 2)
//       格坐标 = (gx - 1 + dx, iy + dy, gz - 1 + dz)
//       dy=0 → 下层（iy），dy=1 → 上层（iy+1）
//
//  单位立方体 [0,1]³ 的坐标约定（`cornerGeometryParts` 输出就用它）：
//       x: 0 → 格 (gx-1) 的中心，1 → 格 (gx) 的中心，**0.5 = 格边界（顶点所在竖线）**
//       z: 同理
//       y: 0 → 层 iy 的中心，1 → 层 iy+1 的中心，**0.5 = 层边界**
//  装配时乘 (cs, ch, cs) 并平移到 (顶点x - cs/2, (iy+0.5)*ch, 顶点z - cs/2)。
//  阶段 5 上不规则网格后，四个水平角换成 relax 后的四个顶点，y 不变（PLAN §阶段5-3）。
//
//  **为什么这样切就没有接缝（S19 t=1.05 / 3→4s）**：一堵墙、一条护栏、一段基座
//  的「转角」永远落在角柱**内部**，而不是落在两个模块的交界上。相邻两个角柱的
//  交界面在格中心（x=0 或 x=1 的平面），那里的截面完全由**共享的 4 个格心**决定，
//  两侧算出来必然逐位相同。G-14 测的就是这一条。
//
//  ---------------------------------------------------------------
//  这份目录**不**负责的事（别往里加）
//  ---------------------------------------------------------------
//  · 不决定颜色 / 材质（角柱跨四格，可能跨两户；着色由装配层按格心取）
//  · 不含窗、花箱、晾衣绳、鸟——那些是装饰 pass（S20③ / C8）
//  · 不含支架（构造式，PLAN §4 N3 不进域）
//  · 不做求解（G-13 建图、V7 solveWfc 求解）
//
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

// ---------------------------------------------------------------------
// 0 · mask 位运算原语（与 gen_corner_mask_table.mjs 同一套，重复实现是故意的：
//     那是工具脚本，这是生产模块，不互相 import）
// ---------------------------------------------------------------------

/** 位序：bit = dx | (dz<<1) | (dy<<2) */
export const cornerBit = (dx, dz, dy) => dx | (dz << 1) | (dy << 2);

/** 下层四格的 4-bit 图样（bit = dx | dz<<1） */
export const lowerNibble = (mask) => mask & 0xf;
/** 上层四格的 4-bit 图样 */
export const upperNibble = (mask) => (mask >> 4) & 0xf;

export const popcount4 = (n) => ((n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1));

/** 4-bit 图样绕 Y 转 90°（(dx,dz) → (1-dz, dx)），与 gen_corner_mask_table 的 transform 同向 */
export function rotNibble(n) {
  let out = 0;
  for (let dz = 0; dz < 2; dz++) {
    for (let dx = 0; dx < 2; dx++) {
      if (!((n >> (dx | (dz << 1))) & 1)) continue;
      const x = 1 - dz;
      const z = dx;
      out |= 1 << (x | (z << 1));
    }
  }
  return out;
}

/** 4-bit 图样的 Y4 轨道名：c0 / c1 / c2adj / c2opp / c3 / c4 */
export function nibbleOrbit(n) {
  switch (popcount4(n)) {
    case 0: return "c0";
    case 1: return "c1";
    case 3: return "c3";
    case 4: return "c4";
    default:
      // 2 位：相邻（共边）还是对角
      return (n === 0b0011 || n === 0b1100 || n === 0b0101 || n === 0b1010) ? "c2adj" : "c2opp";
  }
}

/** mask 的整体形态：见 CORNER_SHAPE */
export function cornerShapeOf(mask) {
  const L = lowerNibble(mask);
  const U = upperNibble(mask);
  if (!L && !U) return "air";
  if (L && !U) return "top";        // 建筑顶面：屋顶 / 露台 / 平顶 / 花园
  if (!L && U) return "soffit";     // 悬挑底面（飞屋）
  if (L === U) return "through";    // 竖直贯通：墙
  if ((L & U) === U) return "setback";  // 上小下大：退台
  if ((L & U) === L) return "overhang"; // 下小上大：悬挑
  return "skew";                    // 互不包含：错位
}

export const CORNER_SHAPES = Object.freeze(["air", "top", "soffit", "through", "setback", "overhang", "skew"]);

// ---------------------------------------------------------------------
// 1 · socket 词汇表（角柱专用，与格图的 socketVocabulary.js 不共用）
//
//     角柱之间的面有两类：
//       · 水平面（N/E/S/W）：与左右角柱共享，落在**格心平面**上
//       · 竖直面（U/D）：与上下角柱共享，落在**层心平面**上
//     socket 只描述「贯穿这个面的是哪条线/哪个面」，占用一致性由 bans 保证
//     （每个节点的 mask 是布局给定的，不是求解出来的）。
//     全部 symmetric：角柱的构件都是**连续的线**（脊、檐、护栏、基座），
//     两侧必须是同一条线才能对上——没有 normal 面。
// ---------------------------------------------------------------------
export const CORNER_SOCKET = Object.freeze({
  /** 此面两侧都没有实体：什么都不贯穿 */
  AIR: "corner.air",
  /** 竖直墙面贯穿此面（墙沿着这条线继续走） */
  WALL: "corner.wall",
  /** 贴地基座裙边贯穿此面 —— S19 t=1.05「基座无缝并入」就是这条 */
  PLINTH: "corner.plinth",
  /** 楼板/层间实心贯穿（U/D 专用） */
  FLOOR: "corner.floor",
  /** 竖向体块延续（U/D）：上/下还有同一栋 */
  STACK: "corner.stack",
  /** U：上方无实体 */
  SKY: "corner.sky",
  /** D：下方无实体（悬空底） */
  VOID: "corner.void",
  /** 屋脊沿此面贯穿（两侧必须是同一条脊） */
  RIDGE: "corner.ridge",
  /** 檐口沿此面贯穿（连续的一条线，逐格拼会在格缝露接头，见 C13-4） */
  EAVE: "corner.eave",
  /** 坡面沿此面延续（同一坡向、同一坡度） */
  SLOPE: "corner.slope",
  /** 露台面延续 */
  TERRACE: "corner.terrace",
  /** 护栏折线沿此面延续 —— S19 3→4s「护栏沿新的合并轮廓重新流动，是一条连续的边」 */
  RAIL: "corner.rail",
  /** 平顶面延续（无护栏，内部） */
  FLAT: "corner.flat",
  /** 花园地面延续 */
  GARDEN: "corner.garden",
  /** 悬挑底面延续 */
  SOFFIT: "corner.soffit",
});

const S = CORNER_SOCKET;

/** 全部 symmetric —— 角柱构件都是连续线，没有「永不与邻居相接」的面 */
export const CORNER_SOCKET_PARITY = Object.freeze({});

const face = (connector) => Object.freeze({ connector, parity: "symmetric" });
const faces6 = (N, E, S_, W, U, D) =>
  Object.freeze({ N: face(N), E: face(E), S: face(S_), W: face(W), U: face(U), D: face(D) });

// ---------------------------------------------------------------------
// 2 · 基础件目录
//
//     每件带：
//       shape        允许出现在哪种 mask 形态（cornerShapeOf 的返回值）
//       lowerOrbits  允许的下层 4-bit 轨道（"*" = 任意非空）
//       upperOrbits  允许的上层 4-bit 轨道
//       faces        六向 socket（**规范朝向**；Y4 展开由 socketCompiler 做）
//       parts        几何生成器 key（见 §4 `cornerGeometryParts`）
//       weight       WFC 权重
//
//     朝向约定：规范朝向下，「实体偏向」指向 -Z（N 面）与 -X（W 面）那一侧。
//     也就是 c1 的那一格是 (dx=0, dz=0)、c2adj 的两格是 dz=0 那一排。
// ---------------------------------------------------------------------

function proto(id, {
  shape, lowerOrbits = ["*"], upperOrbits = ["*"], faces, parts,
  weight = 1, tags = [], orientationGroup = "Y4",
}) {
  return Object.freeze({
    id, family: id.split(".")[0], weight, orientationGroup, faces,
    tags: Object.freeze(tags), rules: Object.freeze({}), builderKey: parts,
    corner: Object.freeze({
      shape,
      lowerOrbits: Object.freeze([...lowerOrbits]),
      upperOrbits: Object.freeze([...upperOrbits]),
      parts,
    }),
  });
}

export const CORNER_PROTOTYPES = Object.freeze([
  // ---------- 空 ----------
  proto("air.empty", {
    shape: "air", lowerOrbits: ["c0"], upperOrbits: ["c0"], orientationGroup: "NONE",
    faces: faces6(S.AIR, S.AIR, S.AIR, S.AIR, S.SKY, S.VOID), parts: "empty", weight: 1,
  }),

  // ---------- 竖直贯通（墙）·  L === U ≠ 0 ----------
  // c4：四格全实 → 内部，无外墙面，只有楼板
  proto("wall.c4", {
    shape: "through", lowerOrbits: ["c4"], upperOrbits: ["c4"], orientationGroup: "NONE",
    faces: faces6(S.FLOOR, S.FLOOR, S.FLOOR, S.FLOOR, S.STACK, S.STACK), parts: "interior", weight: 1.0,
  }),
  // c3：一格空 → 一个凹角（两段墙在角柱内部拐弯）
  proto("wall.c3", {
    shape: "through", lowerOrbits: ["c3"], upperOrbits: ["c3"],
    faces: faces6(S.FLOOR, S.WALL, S.WALL, S.FLOOR, S.STACK, S.STACK), parts: "wall", weight: 1.0,
  }),
  // c2adj：两格共边 → 一段直墙穿过
  proto("wall.c2adj", {
    shape: "through", lowerOrbits: ["c2adj"], upperOrbits: ["c2adj"],
    faces: faces6(S.FLOOR, S.WALL, S.AIR, S.WALL, S.STACK, S.STACK), parts: "wall", weight: 1.0,
  }),
  // c2opp：两格对角 → 两个独立凸角（不同建筑贴角，别把它们连起来）
  proto("wall.c2opp", {
    shape: "through", lowerOrbits: ["c2opp"], upperOrbits: ["c2opp"], orientationGroup: "Y4",
    faces: faces6(S.WALL, S.WALL, S.WALL, S.WALL, S.STACK, S.STACK), parts: "wall", weight: 0.6,
  }),
  // c1：一格实 → 一个凸角
  proto("wall.c1", {
    shape: "through", lowerOrbits: ["c1"], upperOrbits: ["c1"],
    faces: faces6(S.WALL, S.AIR, S.AIR, S.WALL, S.STACK, S.STACK), parts: "wall", weight: 1.0,
  }),

  // ---------- 贴地基座（同上五形，但 D 面是地）· S19 t=1.05 ----------
  // 基座是**裙边**：沿外墙脚外扩一圈，转角在角柱内部完成 → 相邻格自动无缝
  proto("plinth.c4", {
    shape: "through", lowerOrbits: ["c4"], upperOrbits: ["c4"], orientationGroup: "NONE",
    faces: faces6(S.FLOOR, S.FLOOR, S.FLOOR, S.FLOOR, S.STACK, S.PLINTH), parts: "interior",
    weight: 1.0, tags: ["plinth"],
  }),
  proto("plinth.c3", {
    shape: "through", lowerOrbits: ["c3"], upperOrbits: ["c3"],
    faces: faces6(S.FLOOR, S.PLINTH, S.PLINTH, S.FLOOR, S.STACK, S.PLINTH), parts: "plinth",
    weight: 1.0, tags: ["plinth"],
  }),
  proto("plinth.c2adj", {
    shape: "through", lowerOrbits: ["c2adj"], upperOrbits: ["c2adj"],
    faces: faces6(S.FLOOR, S.PLINTH, S.AIR, S.PLINTH, S.STACK, S.PLINTH), parts: "plinth",
    weight: 1.0, tags: ["plinth"],
  }),
  proto("plinth.c1", {
    shape: "through", lowerOrbits: ["c1"], upperOrbits: ["c1"],
    faces: faces6(S.PLINTH, S.AIR, S.AIR, S.PLINTH, S.STACK, S.PLINTH), parts: "plinth",
    weight: 1.0, tags: ["plinth"],
  }),

  // ---------- 退台 / 悬挑 / 错位 ----------
  proto("step.setback", {
    shape: "setback",
    faces: faces6(S.WALL, S.WALL, S.TERRACE, S.TERRACE, S.STACK, S.STACK), parts: "setback", weight: 1.0,
  }),
  proto("step.overhang", {
    shape: "overhang",
    faces: faces6(S.WALL, S.WALL, S.SOFFIT, S.SOFFIT, S.STACK, S.STACK), parts: "overhang", weight: 1.0,
  }),
  proto("step.skew", {
    shape: "skew",
    faces: faces6(S.WALL, S.WALL, S.WALL, S.WALL, S.STACK, S.STACK), parts: "skew", weight: 0.4,
  }),
  proto("soffit.under", {
    shape: "soffit", lowerOrbits: ["c0"],
    faces: faces6(S.SOFFIT, S.SOFFIT, S.SOFFIT, S.SOFFIT, S.STACK, S.VOID), parts: "soffit", weight: 1.0,
  }),

  // ---------- 顶面 · 露台（带护栏，护栏沿轮廓连续）----------
  // 护栏出现在「实体侧邻空」的那条外缘线上；RAIL socket 保证它跨角柱连成一条折线
  proto("top.terrace.c4", {
    shape: "top", lowerOrbits: ["c4"], upperOrbits: ["c0"], orientationGroup: "NONE",
    faces: faces6(S.TERRACE, S.TERRACE, S.TERRACE, S.TERRACE, S.SKY, S.STACK), parts: "terrace", weight: 1.0,
    tags: ["top", "terrace"],
  }),
  proto("top.terrace.c3", {
    shape: "top", lowerOrbits: ["c3"], upperOrbits: ["c0"],
    faces: faces6(S.TERRACE, S.RAIL, S.RAIL, S.TERRACE, S.SKY, S.STACK), parts: "terrace", weight: 1.0,
    tags: ["top", "terrace"],
  }),
  proto("top.terrace.c2adj", {
    shape: "top", lowerOrbits: ["c2adj"], upperOrbits: ["c0"],
    faces: faces6(S.TERRACE, S.RAIL, S.AIR, S.RAIL, S.SKY, S.STACK), parts: "terrace", weight: 1.0,
    tags: ["top", "terrace"],
  }),
  proto("top.terrace.c2opp", {
    shape: "top", lowerOrbits: ["c2opp"], upperOrbits: ["c0"],
    faces: faces6(S.RAIL, S.RAIL, S.RAIL, S.RAIL, S.SKY, S.STACK), parts: "terrace", weight: 0.5,
    tags: ["top", "terrace"],
  }),
  proto("top.terrace.c1", {
    shape: "top", lowerOrbits: ["c1"], upperOrbits: ["c0"],
    faces: faces6(S.RAIL, S.AIR, S.AIR, S.RAIL, S.SKY, S.STACK), parts: "terrace", weight: 1.0,
    tags: ["top", "terrace"],
  }),

  // ---------- 顶面 · 平顶（无护栏，只在内部；c4/c3 才有意义）----------
  proto("top.flat.c4", {
    shape: "top", lowerOrbits: ["c4"], upperOrbits: ["c0"], orientationGroup: "NONE",
    faces: faces6(S.FLAT, S.FLAT, S.FLAT, S.FLAT, S.SKY, S.STACK), parts: "flat", weight: 0.8,
    tags: ["top", "flat"],
  }),
  proto("top.flat.c3", {
    shape: "top", lowerOrbits: ["c3"], upperOrbits: ["c0"],
    faces: faces6(S.FLAT, S.RAIL, S.RAIL, S.FLAT, S.SKY, S.STACK), parts: "flat", weight: 0.8,
    tags: ["top", "flat"],
  }),

  // ---------- 顶面 · 花园（S20⑥：只在被墙围起来时成立）----------
  proto("top.garden.c4", {
    shape: "top", lowerOrbits: ["c4"], upperOrbits: ["c0"], orientationGroup: "NONE",
    faces: faces6(S.GARDEN, S.GARDEN, S.GARDEN, S.GARDEN, S.SKY, S.STACK), parts: "garden", weight: 0.35,
    tags: ["top", "garden"],
  }),

  // ---------- 顶面 · 坡屋顶 ----------
  // 脊沿 X 轴（N/S 面是脊的两端），落水侧朝 ±Z
  proto("roof.ridge", {
    shape: "top", lowerOrbits: ["c4"], upperOrbits: ["c0"],
    faces: faces6(S.RIDGE, S.SLOPE, S.RIDGE, S.SLOPE, S.SKY, S.STACK), parts: "ridge", weight: 1.0,
    tags: ["top", "roof"],
  }),
  // 坡面中段：脊在别处，这里只是斜面 + 檐口
  proto("roof.slope", {
    shape: "top", lowerOrbits: ["c4", "c3"], upperOrbits: ["c0"],
    faces: faces6(S.SLOPE, S.EAVE, S.SLOPE, S.EAVE, S.SKY, S.STACK), parts: "slope", weight: 1.0,
    tags: ["top", "roof"],
  }),
  // 四坡收角（hip）：两条檐口在角柱内部拐弯 —— 这是「屋顶切进塔墙没有缝」的那一件
  proto("roof.hip", {
    shape: "top", lowerOrbits: ["c3", "c2adj"], upperOrbits: ["c0"],
    faces: faces6(S.SLOPE, S.EAVE, S.EAVE, S.SLOPE, S.SKY, S.STACK), parts: "hip", weight: 1.0,
    tags: ["top", "roof"],
  }),
  // 山墙端：脊在此终止，端面是三角山墙（C13-2 的菱形窗贴在它上面）
  proto("roof.gable.end", {
    shape: "top", lowerOrbits: ["c4", "c3", "c2adj"], upperOrbits: ["c0"],
    faces: faces6(S.RIDGE, S.EAVE, S.AIR, S.EAVE, S.SKY, S.STACK), parts: "gableEnd", weight: 1.0,
    tags: ["top", "roof"],
  }),
  // 天沟（valley）：两片屋顶内凹相交
  proto("roof.valley", {
    shape: "top", lowerOrbits: ["c3", "c4"], upperOrbits: ["c0"],
    faces: faces6(S.SLOPE, S.SLOPE, S.EAVE, S.EAVE, S.SKY, S.STACK), parts: "valley", weight: 0.5,
    tags: ["top", "roof"],
  }),
  // 屋顶撞上更高的墙：坡面直接切进去，交接处不留缝（PLAN §2.2「没有缝」那条）
  proto("roof.abut", {
    shape: "setback", lowerOrbits: ["c4", "c3"],
    faces: faces6(S.SLOPE, S.EAVE, S.WALL, S.EAVE, S.STACK, S.STACK), parts: "abut", weight: 0.8,
    tags: ["roof", "abut"],
  }),
]);

// ---------------------------------------------------------------------
// 3 · mask → 允许哪些件
//
//     判据只有两条，都可机器判定：
//       ① mask 的形态（cornerShapeOf）必须在该件的 shape 里
//       ② 下/上层 4-bit 的 Y4 轨道必须在 lowerOrbits / upperOrbits 里（"*" = 任意非空）
//     朝向由 socketCompiler 的 Y4 展开负责，这里只判「形状对不对」。
//
//     ⚠️ 这不是「一个 mask 只对一件」——恰恰相反，一个 mask 通常允许 3–6 件
//     （同一块顶面可以是露台 / 平顶 / 花园 / 坡顶），**选哪件正是 WFC 要解的东西**。
//     如果某个 mask 的允许集为空，那是目录缺件，报回 Claude，不要在适配器里兜底。
// ---------------------------------------------------------------------
const orbitOk = (orbits, nib) => {
  if (orbits.includes("*")) return nib !== 0;
  return orbits.includes(nibbleOrbit(nib));
};

export function cornerProtoAllowsMask(proto, mask) {
  const c = proto.corner;
  if (cornerShapeOf(mask) !== c.shape) return false;
  const L = lowerNibble(mask);
  const U = upperNibble(mask);
  // c0 要显式允许（air/top/soffit 三种形态里有一边必然是 0）
  const lowOk = L === 0 ? c.lowerOrbits.includes("c0") : orbitOk(c.lowerOrbits, L);
  const upOk = U === 0 ? c.upperOrbits.includes("c0") : orbitOk(c.upperOrbits, U);
  return lowOk && upOk;
}

/** mask（0..255）→ 允许的 prototype id 列表（稳定序 = 目录声明序） */
export function cornerAllowedProtoIds(mask) {
  return CORNER_PROTOTYPES.filter((p) => cornerProtoAllowsMask(p, mask)).map((p) => p.id);
}

/**
 * 供 G-13 用：`allowedClassesOf(variant) → Set<classId>`。
 * 传入 `tools/out/corner_mask_table.json` 解析出来的 table（256 行，含 classId）。
 * 同一 D4 类里的所有 mask 允许集相同（目录只按轨道判，轨道是 D4 不变量），
 * 所以取该类任一 mask 即可——`cornerBuildAllowedClasses` 会顺带断言这一点。
 */
export function cornerBuildAllowedClasses(maskTable) {
  const byProto = new Map(CORNER_PROTOTYPES.map((p) => [p.id, new Set()]));
  const seenClass = new Map();
  for (const row of maskTable) {
    const ids = cornerAllowedProtoIds(row.mask);
    const sig = ids.join(",");
    const prev = seenClass.get(row.classId);
    if (prev === undefined) seenClass.set(row.classId, sig);
    else if (prev !== sig) {
      throw new Error(
        `角落目录 bug：class ${row.classId} 里两个 mask 的允许集不同（${prev} vs ${sig}）。` +
        `目录的判据必须是 D4 不变量。`
      );
    }
    for (const id of ids) byProto.get(id).add(row.classId);
  }
  return byProto;
}

// ---------------------------------------------------------------------
// 4 · 几何零件表（G-14 接缝测试的输入）
//
//     输出是**单位对偶立方体 [0,1]³ 里的零件列表**，纯数字：
//       { part, kind:"box", min:[x,y,z], max:[x,y,z] }
//       { part, kind:"prism", quad:[[x,z]×4], y0, y1, slope:{axis,dir} }
//     装配层负责乘 (cs, ch, cs)、平移、按格心取色、按四角做笼形变形。
//
//     **接缝为什么必然对齐**（G-14 断言的正是这条）：每个零件的坐标只由
//     「它所属象限的 8 个 bit 中与那个面相关的 4 个」算出来，而相邻角柱看到的
//     是同一批 bit（同一批格心）。所以两侧在 x=0 / x=1（或 z、y）平面上的截面
//     逐位相同。任何**依赖节点自身坐标 (gx,gz,iy) 的随机扰动都会破坏这条**，
//     因此本函数**不接受 seed，也不许引入随机**。
// ---------------------------------------------------------------------

/** 墙厚 / 基座外扩 / 护栏高 等：单位立方体里的比例，改这里等于改整套外观 */
export const CORNER_METRICS = Object.freeze({
  wallThickness: 0.10,   // 墙厚（× cs）
  plinthSkirt: 0.06,     // 基座比墙外扩
  plinthHeight: 0.18,    // 基座高（× ch）
  railHeight: 0.22,      // 护栏高（× ch）
  railThickness: 0.05,
  slabThickness: 0.08,   // 露台 / 平顶板厚
  eaveOvershoot: 0.08,   // 檐口出挑（× cs）
  roofRise: 0.42,        // 脊比檐高多少（× ch）
  gardenSoil: 0.05,
});

const M = CORNER_METRICS;

/** 象限 q 的水平范围 [x0,x1]×[z0,z1]（dx,dz ∈ {0,1}） */
const quadRange = (dx, dz) => ({ x0: dx * 0.5, x1: dx * 0.5 + 0.5, z0: dz * 0.5, z1: dz * 0.5 + 0.5 });

const solid = (mask, dx, dz, dy) => ((mask >> cornerBit(dx, dz, dy)) & 1) === 1;

const box = (part, min, max) => ({ part, kind: "box", min: min.map(r6), max: max.map(r6) });
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/**
 * 给定 mask 与选中的件，返回零件表。
 * @param {number} mask 0..255
 * @param {string} protoId `CORNER_PROTOTYPES` 里的 id
 * @returns {Array<object>} 零件表（稳定序：象限序 dx,dz 升序，再按零件名）
 */
export function cornerGeometryParts(mask, protoId) {
  const proto = CORNER_PROTOTYPES.find((p) => p.id === protoId);
  if (!proto) throw new Error(`unknown corner prototype: ${protoId}`);
  const kind = proto.corner.parts;
  const out = [];
  const t = M.wallThickness;

  // ---- 墙：每个实心象限，朝「同层横向邻空」的那两条内边各出一片墙 ----
  //      墙片只覆盖本象限，转角在角柱内部由两片墙对接完成
  const emitWalls = (dy, y0, y1, thickness = t, name = "wall") => {
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        if (!solid(mask, dx, dz, dy)) continue;
        const q = quadRange(dx, dz);
        // 朝 X 方向的邻象限（跨格边界平面 x=0.5）
        if (!solid(mask, 1 - dx, dz, dy)) {
          const xInner = dx === 0 ? q.x1 : q.x0;           // 靠近 x=0.5 的那条边
          const xa = dx === 0 ? xInner - thickness : xInner;
          out.push(box(`${name}-x`, [xa, y0, q.z0], [xa + thickness, y1, q.z1]));
        }
        if (!solid(mask, dx, 1 - dz, dy)) {
          const zInner = dz === 0 ? q.z1 : q.z0;
          const za = dz === 0 ? zInner - thickness : zInner;
          out.push(box(`${name}-z`, [q.x0, y0, za], [q.x1, y1, za + thickness]));
        }
      }
    }
  };

  // ---- 实心楼板 / 内部 ----
  const emitSlab = (dy, y0, y1, name) => {
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        if (!solid(mask, dx, dz, dy)) continue;
        const q = quadRange(dx, dz);
        out.push(box(name, [q.x0, y0, q.z0], [q.x1, y1, q.z1]));
      }
    }
  };

  // ---- 外缘线：实心象限里「同层横向邻空」的边，护栏/檐口沿它走 ----
  const emitOutline = (dy, y0, h, thickness, name) => {
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        if (!solid(mask, dx, dz, dy)) continue;
        const q = quadRange(dx, dz);
        if (!solid(mask, 1 - dx, dz, dy)) {
          const xInner = dx === 0 ? q.x1 : q.x0;
          const xa = dx === 0 ? xInner - thickness : xInner;
          out.push(box(`${name}-x`, [xa, y0, q.z0], [xa + thickness, y0 + h, q.z1]));
        }
        if (!solid(mask, dx, 1 - dz, dy)) {
          const zInner = dz === 0 ? q.z1 : q.z0;
          const za = dz === 0 ? zInner - thickness : zInner;
          out.push(box(`${name}-z`, [q.x0, y0, za], [q.x1, y0 + h, za + thickness]));
        }
      }
    }
  };

  switch (kind) {
    case "empty":
      break;

    case "interior":
      emitSlab(0, 0, 0.5, "body-lower");
      emitSlab(1, 0.5, 1, "body-upper");
      break;

    case "wall":
      emitWalls(0, 0, 0.5);
      emitWalls(1, 0.5, 1);
      emitSlab(0, 0.5 - M.slabThickness / 2, 0.5 + M.slabThickness / 2, "floor-slab");
      break;

    case "plinth":
      emitWalls(0, M.plinthHeight, 0.5);
      emitWalls(1, 0.5, 1);
      // 裙边：比墙外扩 plinthSkirt，贴地一段。转角在角柱内部 → 相邻格无缝
      emitWalls(0, 0, M.plinthHeight, M.wallThickness + M.plinthSkirt, "plinth");
      break;

    case "setback":
      emitWalls(0, 0, 0.5);
      emitWalls(1, 0.5, 1);
      // 露出的那圈台面（下层实、上层空的象限）
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          if (!solid(mask, dx, dz, 0) || solid(mask, dx, dz, 1)) continue;
          const q = quadRange(dx, dz);
          out.push(box("setback-slab", [q.x0, 0.5 - M.slabThickness, q.z0], [q.x1, 0.5, q.z1]));
        }
      }
      break;

    case "overhang":
      emitWalls(1, 0.5, 1);
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          if (solid(mask, dx, dz, 0) || !solid(mask, dx, dz, 1)) continue;
          const q = quadRange(dx, dz);
          out.push(box("soffit-slab", [q.x0, 0.5, q.z0], [q.x1, 0.5 + M.slabThickness, q.z1]));
        }
      }
      emitWalls(0, 0, 0.5);
      break;

    case "skew":
      emitWalls(0, 0, 0.5);
      emitWalls(1, 0.5, 1);
      emitSlab(0, 0.5 - M.slabThickness / 2, 0.5 + M.slabThickness / 2, "floor-slab");
      break;

    case "soffit":
      emitWalls(1, 0.5, 1);
      emitSlab(1, 0.5, 0.5 + M.slabThickness, "soffit-slab");
      break;

    case "terrace":
      emitWalls(0, 0, 0.5);
      emitSlab(0, 0.5 - M.slabThickness, 0.5, "terrace-slab");
      emitOutline(0, 0.5, M.railHeight, M.railThickness, "rail");
      break;

    case "flat":
      emitWalls(0, 0, 0.5);
      emitSlab(0, 0.5 - M.slabThickness, 0.5, "flat-slab");
      break;

    case "garden":
      emitWalls(0, 0, 0.5);
      emitSlab(0, 0.5 - M.slabThickness, 0.5, "garden-slab");
      emitSlab(0, 0.5, 0.5 + M.gardenSoil, "garden-soil");
      break;

    // ---- 屋顶四件：坡面用 prism，脊/檐用 box，全部只依赖 mask ----
    case "ridge":
    case "slope":
    case "hip":
    case "gableEnd":
    case "valley":
    case "abut": {
      emitWalls(0, 0, 0.5);
      emitSlab(0, 0.5 - M.slabThickness, 0.5, "roof-base");
      const ridgeAlongX = kind === "ridge" || kind === "slope" || kind === "gableEnd";
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          if (!solid(mask, dx, dz, 0)) continue;
          const q = quadRange(dx, dz);
          // 坡面：沿落水方向从脊高降到檐高。四边形四角的 y 由「离脊多远」决定，
          // 而脊线固定在 x=0.5（或 z=0.5）平面上 —— 那正是相邻角柱共享的面，
          // 所以两侧算出来的脊高逐位相同。
          const along = ridgeAlongX ? "x" : "z";
          const yAt = (u) => 0.5 + M.roofRise * (1 - Math.abs(u - 0.5) * 2);
          const c0 = along === "x" ? q.z0 : q.x0;
          const c1 = along === "x" ? q.z1 : q.x1;
          out.push({
            part: "roof-slope", kind: "prism", along,
            quad: [
              [r6(q.x0), r6(q.z0)], [r6(q.x1), r6(q.z0)],
              [r6(q.x1), r6(q.z1)], [r6(q.x0), r6(q.z1)],
            ],
            yLo: r6(yAt(c0)), yHi: r6(yAt(c1)),
            base: r6(0.5),
          });
        }
      }
      // 檐口：沿**外缘轮廓**走，落在角柱自己的顶点十字上（x=0.5 / z=0.5），
      // 不是落在对偶立方体的外边界上。这一条是接缝零间隙的关键：
      // 外边界上的零件两侧看到的是**不同的格**（A 看 gx-1，B 看 gx+1），
      // 必然对不齐；顶点十字上的零件两侧看到的是**同一批共享格心**，必然对齐。
      // 2026-09-04 的 test_corner_prototypes ④b 就是被这条抓出来的（roof.hip 的 eave 差 4 对）。
      {
        const along = (kind === "ridge" || kind === "slope" || kind === "gableEnd") ? "x" : null;
        const t2 = M.eaveOvershoot;
        for (let dz = 0; dz < 2; dz++) {
          for (let dx = 0; dx < 2; dx++) {
            if (!solid(mask, dx, dz, 0)) continue;
            const q = quadRange(dx, dz);
            // 脊沿 X → 落水侧朝 ±Z → 檐口是沿 X 的一条线，压在 z=0.5 上
            if (along !== "z" && !solid(mask, dx, 1 - dz, 0)) {
              const zInner = dz === 0 ? q.z1 : q.z0;
              const za = dz === 0 ? zInner : zInner - t2;
              out.push(box("eave", [q.x0, 0.5 - 0.04, za], [q.x1, 0.5, za + t2]));
            }
            if (along !== "x" && !solid(mask, 1 - dx, dz, 0)) {
              const xInner = dx === 0 ? q.x1 : q.x0;
              const xa = dx === 0 ? xInner : xInner - t2;
              out.push(box("eave", [xa, 0.5 - 0.04, q.z0], [xa + t2, 0.5, q.z1]));
            }
          }
        }
      }
      if (kind === "gableEnd") {
        // 山墙端面：脊在此终止，端面补一块三角（C13-2 的菱形窗贴这上面）
        for (let dz = 0; dz < 2; dz++) {
          for (let dx = 0; dx < 2; dx++) {
            if (!solid(mask, dx, dz, 0)) continue;
            const q = quadRange(dx, dz);
            if (solid(mask, 1 - dx, dz, 0)) continue;
            const xEdge = dx === 0 ? q.x1 : q.x0;
            const xa = dx === 0 ? xEdge - M.wallThickness : xEdge;
            out.push({
              part: "gable-face", kind: "prism", along: "z",
              quad: [[r6(xa), r6(q.z0)], [r6(xa + M.wallThickness), r6(q.z0)],
                     [r6(xa + M.wallThickness), r6(q.z1)], [r6(xa), r6(q.z1)]],
              yLo: r6(0.5), yHi: r6(0.5 + M.roofRise), base: r6(0.5),
            });
          }
        }
      }
      if (kind === "abut") {
        emitWalls(1, 0.5, 1);
      }
      break;
    }

    default:
      throw new Error(`unknown corner parts kind: ${kind}`);
  }

  // 稳定序：先按零件名，再按 min 坐标字典序。G-14 逐位比顶点要靠这个顺序。
  out.sort((a, b) => {
    if (a.part !== b.part) return a.part < b.part ? -1 : 1;
    const ka = JSON.stringify(a.min ?? a.quad);
    const kb = JSON.stringify(b.min ?? b.quad);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return out;
}

// ---------------------------------------------------------------------
// 5 · 面 → 共享的 4 个 bit（G-13 建图与 G-14 挑顶点都要用）
//
//     两个角柱的交界面落在格心平面上，面上的截面完全由**共享的 4 个格心**决定。
//     N/S 面共享的是 dz 固定的那两列 × 上下两层；E/W 面同理；U/D 面共享的是
//     同一层的四格。
// ---------------------------------------------------------------------
export const CORNER_DIRS = Object.freeze(["N", "E", "S", "W", "U", "D"]);
export const CORNER_OPP = Object.freeze({ N: "S", S: "N", E: "W", W: "E", U: "D", D: "U" });
/** 方向 → 邻居节点偏移 (dgx, dgz, diy) */
export const CORNER_DELTA = Object.freeze({
  N: [0, -1, 0], S: [0, 1, 0], W: [-1, 0, 0], E: [1, 0, 0], U: [0, 0, 1], D: [0, 0, -1],
});

/** mask 在某个面上的 4-bit 截面（顺序固定，两侧用同一个函数取，所以必然一致） */
export function cornerFaceBits(mask, dir) {
  const b = (dx, dz, dy) => (mask >> cornerBit(dx, dz, dy)) & 1;
  switch (dir) {
    // N 面在 z = 0 一侧：共享 dz=0 的两格 × 上下两层
    case "N": return b(0, 0, 0) | (b(1, 0, 0) << 1) | (b(0, 0, 1) << 2) | (b(1, 0, 1) << 3);
    case "S": return b(0, 1, 0) | (b(1, 1, 0) << 1) | (b(0, 1, 1) << 2) | (b(1, 1, 1) << 3);
    case "W": return b(0, 0, 0) | (b(0, 1, 0) << 1) | (b(0, 0, 1) << 2) | (b(0, 1, 1) << 3);
    case "E": return b(1, 0, 0) | (b(1, 1, 0) << 1) | (b(1, 0, 1) << 2) | (b(1, 1, 1) << 3);
    case "U": return upperNibble(mask);
    case "D": return lowerNibble(mask);
    default: throw new Error(`bad dir ${dir}`);
  }
}

export const CORNER_CATALOG_VERSION = 1;
