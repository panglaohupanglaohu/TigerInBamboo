// =====================================================================
//  Socket 词汇表（阶段 2 · 格图 WFC）—— C5，Claude 2026-09-03
//
//  连接器描述的是「两格之间的界面」，不是「模块本身」：两个模块在共享面上
//  声明了同一个界面名，V7 compatibilityTable 就认为它们咬合。
//  所以词汇表的每一项都要能回答：隔着这个面，对面那格必须是什么。
//
//  parity 约定：全部 symmetric（同名即咬合），只有 EAVE 用 normal——
//  normal↔normal 在 V7 里不咬合，而 Y4 没有镜像变体，于是「坡面落水侧」
//  永远不能与另一格相接，只能朝空气 / 异色邻居。这就是 S19 t=1.40
//  「两格并排加盖 → 合成一个共享脊的坡顶」的来源：平行双坡（M 顶）被禁止，
//  求解器只剩 ridge↔ridge（同一屋顶延续）或 terrace / flat 可选。
//
//  对应 S19 帧：
//    TERRACE  t=0.35 单格落地 → 带栏杆晒台
//    WALL     t=0.70 上面叠格 → 下格栏杆消失变墙（U 面从 SKY 变 STACK，
//             policy 禁掉所有顶格模块，只剩 body）
//    RIDGE    t=1.40 两格并排 → 一个更宽的人字坡
//    TOWER_*  t=3.50 孤立高柱 → 圆塔 + 锥顶（tower.wall 只与 tower.wall 咬合，
//             锥顶 D 面只认 stack.tower，所以单格柱长不出塔）
//
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

export const SOCKET = Object.freeze({
  // —— 竖向（U/D 面）——
  /** U/D：普通体块叠放；顶格模块的 D 面也是它（坐在体块上） */
  STACK: "stack",
  /** U/D：塔身叠放；锥顶 D 面只认它 → 塔至少两格高 */
  STACK_TOWER: "stack.tower",
  /** U：上方无格。永不与任何面咬合（顶格标记，供 policy 读） */
  SKY: "sky",

  // —— 水平（N/E/S/W 面）——
  /** 实墙界面：体块↔体块、顶格↔更高的体块、花园周墙。对空 = 素墙（装饰 pass 开窗） */
  WALL: "wall",
  /** 圆塔外壁：parity normal，永不与格咬合 → 塔身只在孤立柱（或异色邻居旁）出现 */
  TOWER_WALL: "tower.wall",
  /** 坡屋顶脊线贯穿此面：对面那格必须是同一屋顶的延续（也是 ridge） */
  RIDGE: "ridge",
  /** 坡面落水侧：parity normal，永不与格咬合，只许朝空 / 异色 */
  EAVE: "eave",
  /** 晒台↔晒台连成一片（外缘栏杆由装饰 pass 按 exposure 加） */
  TERRACE: "terrace",
  /** 平顶↔平顶（plaza / 花园顶盖） */
  FLAT: "flat",
  /** 底层拱洞贯穿：对面是空气或另一格拱洞 */
  PASSAGE: "passage",
});

/**
 * 每个 socket 的 parity。normal↔normal 在 V7 里不咬合、Y4 又没有镜像变体，
 * 所以标 normal 的面**永远不能与另一格相接**，只能朝空 / 异色：
 *   EAVE       坡面落水侧（禁止平行双坡 M 顶，见文件头）
 *   TOWER_WALL 圆塔外壁（禁止两根塔并排贴成一堵「塔墙」；塔只在孤立柱或异色邻居旁）
 */
export const SOCKET_PARITY = Object.freeze({
  [SOCKET.EAVE]: "normal",
  [SOCKET.TOWER_WALL]: "normal",
});

/** 生成一个 face 描述（compatibilityTable 只读 connector / parity / walkable） */
export function face(connector, extra = {}) {
  return Object.freeze({
    connector,
    parity: SOCKET_PARITY[connector] ?? "symmetric",
    ...extra,
  });
}

/**
 * 邻居种类（由 wfcGraphAdapter.exposure(index)[dir] 给出）：
 *   "edge"      同色相邻格，图上有边，且该邻居上方还有格（它是体块）
 *   "edge-top"  同色相邻格，图上有边，且该邻居上方无格（它也是顶格）
 *   "air"       无格
 *   "foreign"   异色相邻格：不建边（不同颜色 = 不同建筑，屋顶不合并），
 *               对 policy 来说等同一堵别人的墙
 * U/D 方向只会出现 edge / air（竖向不分颜色：叠在一起就是同一栋）。
 */
export const NEIGHBOR_KIND = Object.freeze({ EDGE: "edge", EDGE_TOP: "edge-top", AIR: "air", FOREIGN: "foreign" });
