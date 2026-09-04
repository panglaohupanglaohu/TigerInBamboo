// =====================================================================
//  城堡格图 WFC 模块原型（阶段 2）—— C5，Claude 2026-09-03
//
//  这是 V7 schema（procgen/wfc/moduleSchema.js）的 ModulePrototype[]，
//  给 wfcTownSelection（G-05）喂 compileVariants → compileCompatibilityTable → solveWfc。
//
//  域的含义变了：旧哈希路径每格同时选 8 个家族（foundation/floor/fence/...）；
//  这里 WFC 只决定每格的**体块角色**（body / roof / terrace / flat / garden /
//  tower / passage）。栏杆、窗、花箱、楼梯、支架、晾衣绳全部留给装饰 pass
//  按 assignment + exposure 构造（S20③ 装饰分离；S20④/N3 支架不进域）。
//
//  面标签见 socketVocabulary.js。Y4 展开由 socketCompiler 做，这里只写
//  每类的**规范朝向**；旋转等价的会被去重。
//
//  2026-09-03 实测（临时脚本，逐字见 TODOS C5）：22 原型 → 48 变体，无 dead variant，
//  六向全对相容率 18.9%（水平 25.3% / 竖向 6.2%）；随机 6×6×3 布局 200 seed 零失败零回溯；
//  S19 t=0.35 → terrace.w0，t=0.70 → 下格 body.plain（栏杆→墙），t=1.40 → 两格 roof.gable 共脊，
//  3×3 环形庭院中心 → top.garden。
//
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { SOCKET, NEIGHBOR_KIND, face } from "./socketVocabulary.js";

const { STACK, STACK_TOWER, SKY, WALL, TOWER_WALL, RIDGE, EAVE, TERRACE, FLAT, PASSAGE } = SOCKET;
const HORIZ = Object.freeze(["N", "E", "S", "W"]);

/** 四个水平面 + U/D */
function faces6(N, E, S, W, U, D) {
  return Object.freeze({ N: face(N), E: face(E), S: face(S), W: face(W), U: face(U), D: face(D) });
}

function proto(id, family, weight, faces, { tags = [], rules = {}, builderKey = family, orientationGroup = "Y4" } = {}) {
  return Object.freeze({ id, family, weight, orientationGroup, faces, tags: Object.freeze(tags), rules: Object.freeze(rules), builderKey });
}

/**
 * 「环」原型：四个水平面各取 base 或 alt（alt = 朝更高体块的实墙）。
 * 16 种组合在 Y4 下只有 6 个轨道，这里只写 6 个规范件，旋转由 compiler 展开。
 */
function ringPrototypes(family, base, alt, weights, { tags = [], rules = {}, builderKey = family, U = SKY, D = STACK } = {}) {
  const patterns = [
    ["w0", [base, base, base, base]],
    ["w1", [alt, base, base, base]],
    ["w2adj", [alt, alt, base, base]],
    ["w2opp", [alt, base, alt, base]],
    ["w3", [alt, alt, alt, base]],
    ["w4", [alt, alt, alt, alt]],
  ];
  return patterns.map(([name, [n, e, s, w]]) =>
    proto(`${family}.${name}`, family, weights[name], faces6(n, e, s, w, U, D), { tags, rules, builderKey })
  );
}

export const TOWN_MODULE_PROTOTYPES = Object.freeze([
  // ---------- 体块（上方有格） ----------
  proto("body.plain", "body", 1.0, faces6(WALL, WALL, WALL, WALL, STACK, STACK), { tags: ["body"], orientationGroup: "NONE" }),
  // 塔身：四面 tower.wall（parity normal，永不与同色格相接）；D 认塔身或普通体块（塔从楼上长出来）
  proto("body.tower", "body", 0.25, faces6(TOWER_WALL, TOWER_WALL, TOWER_WALL, TOWER_WALL, STACK_TOWER, STACK_TOWER),
    { tags: ["body", "tower"], builderKey: "tower", orientationGroup: "NONE" }),
  proto("body.tower.base", "body", 0.25, faces6(TOWER_WALL, TOWER_WALL, TOWER_WALL, TOWER_WALL, STACK_TOWER, STACK),
    { tags: ["body", "tower"], rules: { requiresBelow: "body" }, builderKey: "tower", orientationGroup: "NONE" }),
  // 底层拱洞（南北贯穿）：只在 iy=0，开口只能朝空或另一格拱洞
  proto("body.passage", "body", 0.15, faces6(PASSAGE, WALL, PASSAGE, WALL, STACK, STACK),
    { tags: ["body", "passage"], builderKey: "passage" }),

  // ---------- 顶格：坡屋顶（S19 t=0.70 / t=1.40） ----------
  // 脊沿 E–W 贯穿，N/S 落水；两端 ridge = 可延续到相邻顶格（或对空 = 山墙）
  proto("roof.gable", "roof", 1.0, faces6(EAVE, RIDGE, EAVE, RIDGE, SKY, STACK), { tags: ["roof", "gable"], builderKey: "gable" }),
  // 一端顶着更高的墙
  proto("roof.gable.end", "roof", 0.9, faces6(EAVE, RIDGE, EAVE, WALL, SKY, STACK), { tags: ["roof", "gable"], builderKey: "gable" }),
  // 两端都顶墙（夹在两堵高墙之间的坡顶）
  proto("roof.gable.closed", "roof", 0.5, faces6(EAVE, WALL, EAVE, WALL, SKY, STACK), { tags: ["roof", "gable"], builderKey: "gable" }),
  // 四坡尖顶：四面落水，只能孤立（eave 永不与格咬合）
  proto("roof.hip", "roof", 0.6, faces6(EAVE, EAVE, EAVE, EAVE, SKY, STACK), { tags: ["roof", "hip"], builderKey: "hip", orientationGroup: "NONE" }),
  // 塔锥顶：只坐在塔身上（S19 t=3.50）
  proto("roof.cone", "roof", 1.0, faces6(TOWER_WALL, TOWER_WALL, TOWER_WALL, TOWER_WALL, SKY, STACK_TOWER),
    { tags: ["roof", "tower"], rules: { requiresBelow: "tower" }, builderKey: "cone", orientationGroup: "NONE" }),

  // ---------- 顶格：晒台（S19 t=0.35）/ 平顶 / 花园（S20⑥） ----------
  ...ringPrototypes("terrace", TERRACE, WALL,
    { w0: 0.9, w1: 0.7, w2adj: 0.5, w2opp: 0.4, w3: 0.3, w4: 0.15 }, { tags: ["top", "terrace"] }),
  ...ringPrototypes("flat", FLAT, WALL,
    { w0: 0.35, w1: 0.35, w2adj: 0.35, w2opp: 0.3, w3: 0.3, w4: 0.2 }, { tags: ["top", "flat"] }),
  // 花园：四面周墙，只在封闭区可解（policy：任一水平面朝空即禁）；权重最高
  proto("top.garden", "garden", 3.0, faces6(WALL, WALL, WALL, WALL, SKY, STACK),
    { tags: ["top", "garden", "enclosed"], builderKey: "garden", orientationGroup: "NONE" }),
]);

/**
 * banPolicy（G-05 的 `banPolicy` 参数）：返回 true = 该 variant 在该格允许。
 * 只看该格自己的暴露情况（邻空 / 异色 / 有边），不看邻居选了什么——邻居间的
 * 约束全部交给 compatibilityTable。
 *
 * @param {object} c
 * @param {number} c.iy 层
 * @param {{N:string,E:string,S:string,W:string,U:string,D:string}} c.exposure
 *   每向 NEIGHBOR_KIND：edge / edge-top / air / foreign（见 socketVocabulary.js）
 * @param {number} [c.columnHeight] 该格所在同列连续非空格数（含自己，向上向下都算）；缺省 1
 * @param {boolean} [c.columnIsolated] 整根柱子四面是否都没有同色邻居（塔的必要条件）
 * @param {object} c.variant compileVariants 输出的 variant（faces / tags / rules）
 */
export function townBanPolicy({ iy, exposure, columnHeight = 1, columnIsolated = false, variant }) {
  const f = variant.faces;
  const tags = variant.tags || [];
  const { AIR, EDGE, EDGE_TOP, FOREIGN } = NEIGHBOR_KIND;
  // 塔**不需要 policy 去逼**：tower.wall 是 parity normal，与任何面（包括另一根
  // 塔的外壁）都咬不上，所以只要柱子有一条同色水平边，整根柱子就自动不可能是塔。
  // 剩下的「孤立柱要不要长成塔」交给权重（tower 0.25 vs body 1.0）——
  // S20⑧：大形可预测，小形允许变化。
  // 这里只保留一条硬规则：矮柱不出塔（塔至少要有身子才谈得上锥顶）。
  if (tags.includes("tower") && columnHeight < 3) return false;
  if (!columnIsolated && tags.includes("tower")) return false;

  // 顶格 ⇔ 上方无格。U 面 sky 只许在顶格，体块只许在非顶格。
  const isTopCell = exposure.U === AIR;
  if (isTopCell !== (f.U.connector === SKY)) return false;

  // 塔身（长在楼上）与锥顶必须坐在格上；单格柱长不出塔
  if (variant.rules?.requiresBelow && exposure.D === AIR) return false;

  // 顶格（晒台/平顶/花园/坡顶）的 WALL 面只能顶着「更高的同色体块」或「异色邻居」：
  //   · 朝空不砌墙（晒台朝空是栏杆，由装饰 pass 加；素墙只属于体块）
  //   · 朝同层顶格不砌墙（同层顶格之间要么屋顶延续 ridge↔ridge，要么晒台/平顶连片）
  // 花园四面都是 WALL，于是自动只在封闭区可解（S20⑥）。
  if (tags.includes("top") || tags.includes("roof")) {
    for (const d of HORIZ) {
      if (f[d].connector === WALL && (exposure[d] === AIR || exposure[d] === EDGE_TOP)) return false;
    }
  }

  // 拱洞：只在底层；开口不能顶着别人的墙
  if (tags.includes("passage")) {
    if (iy !== 0) return false;
    if (HORIZ.some((d) => f[d].connector === PASSAGE && exposure[d] === FOREIGN)) return false;
  }

  // 孤立底层单格不出坡顶（S19 t=0.35：落地单格是晒台，不是小房子）
  if (tags.includes("roof") && iy === 0 && HORIZ.every((d) => exposure[d] !== EDGE && exposure[d] !== EDGE_TOP)) return false;

  return true;
}

/** 装饰 pass 用：assignment 的 builderKey → 该格是否有可开窗的实墙面等，由 C8 清单定义 */
export const TOWN_BUILDER_KEYS = Object.freeze(["body", "tower", "passage", "gable", "hip", "cone", "terrace", "flat", "garden"]);
