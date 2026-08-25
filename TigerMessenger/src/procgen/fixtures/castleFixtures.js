// =====================================================================
//  三类城堡冻结 fixture（V7-G0）
//  纯数据，禁止 import Three.js / DOM / 生产模块。
//  · 高山城堡：输入即现有生产蓝图 createCitadelBlueprint 的参数；
//    重建后 canonical hash 必须等于 expectedHash（防止蓝图 schema 漂移）。
//  · 古堡 / 运河城堡：V7 引擎未来消费的 versioned 最小数据结构
//    （V7-G11~G13 的 hard planner 输入雏形），hash 用 FNV-1a 冻结。
// =====================================================================

import { hashHex } from "../../core/rng.js";

/** 高山城堡 · 真实 fixture：现有生产蓝图默认参数（五层台地 + 默认 ASCII 布局） */
export const HIGHLAND_REAL = Object.freeze({
  kind: "highland-citadel",
  scope: "real",
  /** 传给 createCitadelBlueprint 的冻结输入 */
  input: Object.freeze({}),
  expectedHash: "ee6deb08",
});

/** 高山城堡 · 最小 fixture：三层小台地、跳过外圈地形 */
export const HIGHLAND_MINIMAL = Object.freeze({
  kind: "highland-citadel",
  scope: "minimal",
  input: Object.freeze({
    floors: 3,
    contour: Object.freeze({
      layerCount: 3,
      baseRadius: 12,
      layerHeight: 2.5,
      shrink: 0.86,
    }),
    skipOuterTerrain: true,
  }),
  expectedHash: "00099826",
});

/** 古堡 · 最小 fixture：矩形闭合城墙环 + 一门 + 双塔 + 一条巡逻回路 */
export const ANCIENT_MINIMAL = Object.freeze({
  version: 1,
  kind: "ancient-fortress",
  scope: "minimal",
  wallRing: Object.freeze([[0, 0], [6, 0], [6, 6], [0, 6]].map((p) => Object.freeze(p))),
  gates: Object.freeze([{ at: Object.freeze([3, 0]), facing: "S" }]),
  towers: Object.freeze([
    { at: Object.freeze([0, 0]), h: 3 },
    { at: Object.freeze([6, 6]), h: 3 },
  ]),
  patrolLoops: Object.freeze([Object.freeze([[1, 1], [5, 1], [5, 5], [1, 5]].map((p) => Object.freeze(p)))]),
});

/** 古堡 · 真实 fixture：非城墙 + 双门 + 三塔 + 内院 + 长巡逻回路 */
export const ANCIENT_REAL = Object.freeze({
  version: 1,
  kind: "ancient-fortress",
  scope: "real",
  wallRing: Object.freeze([[0, 0], [10, 0], [10, 8], [0, 8]].map((p) => Object.freeze(p))),
  gates: Object.freeze([
    { at: Object.freeze([5, 0]), facing: "S" },
    { at: Object.freeze([10, 4]), facing: "E" },
  ]),
  towers: Object.freeze([
    { at: Object.freeze([0, 0]), h: 4 },
    { at: Object.freeze([10, 8]), h: 4 },
    { at: Object.freeze([10, 0]), h: 3 },
  ]),
  patrolLoops: Object.freeze([Object.freeze([[1, 1], [9, 1], [9, 7], [1, 7]].map((p) => Object.freeze(p)))]),
  courtyards: Object.freeze([Object.freeze([[2, 2], [8, 6]].map((p) => Object.freeze(p)))]),
});

/** 运河城堡 · 最小 fixture：折线水路 + 一桥 */
export const CANAL_MINIMAL = Object.freeze({
  version: 1,
  kind: "canal-citadel",
  scope: "minimal",
  canalCenterline: Object.freeze([[0, 0], [4, 2], [8, 2], [12, 0]].map((p) => Object.freeze(p))),
  width: 2,
  waterLevel: 0.4,
  bridges: Object.freeze([{ at: Object.freeze([4, 2]), clearance: 2.2 }]),
});

/** 运河城堡 · 真实 fixture：长水路 + 三桥 + 船闸 + 码头 */
export const CANAL_REAL = Object.freeze({
  version: 1,
  kind: "canal-citadel",
  scope: "real",
  canalCenterline: Object.freeze([[0, 0], [3, 1], [6, 1], [9, 3], [12, 3], [15, 1]].map((p) => Object.freeze(p))),
  width: 2.5,
  waterLevel: 0.5,
  bridges: Object.freeze([
    { at: Object.freeze([3, 1]), clearance: 2.4 },
    { at: Object.freeze([9, 3]), clearance: 2.4 },
    { at: Object.freeze([12, 3]), clearance: 2.2 },
  ]),
  locks: Object.freeze([{ at: Object.freeze([6, 1]), drop: 0.6 }]),
  docks: Object.freeze([{ at: Object.freeze([9, 3]), side: "N" }]),
});

/** 全部 fixture 清单（V7-G0 台账与测试消费） */
export const CASTLE_FIXTURES = Object.freeze([
  HIGHLAND_MINIMAL,
  HIGHLAND_REAL,
  ANCIENT_MINIMAL,
  ANCIENT_REAL,
  CANAL_MINIMAL,
  CANAL_REAL,
]);

/** fixture 自身 canonical hash（FNV-1a，冻结防漂移） */
export function castleFixtureHash(fixture) {
  const { scope, ...data } = fixture;
  return hashHex(JSON.stringify(data));
}

/** 冻结的期望 hash 表：kind -> { minimal, real } */
export const CASTLE_FIXTURE_HASHES = Object.freeze({
  "highland-citadel": Object.freeze({ minimal: "00099826", real: "ee6deb08" }),
  "ancient-fortress": Object.freeze({ minimal: "0d0f4a49", real: "165bac58" }),
  "canal-citadel": Object.freeze({ minimal: "2790c4d1", real: "500e65e3" }),
});
