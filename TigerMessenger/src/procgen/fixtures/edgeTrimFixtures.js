// =====================================================================
//  城墙转角 / 屋顶边 / 阳台边 SimpleTiled fixture（V7-G4 · 纯数据）
//  覆盖 non-Wang 显式禁配：roof.edge 与 balcony.edge 使用同一 connector
//  "trim"（socket 层面完全兼容），但相互 excludedNeighbors 显式禁配——
//  兼容判据不止 connector 相等（Wang 砖假设），必须尊重显式排除。
// =====================================================================

const F = (connector, extra = {}) => ({ connector, parity: "symmetric", ...extra });

/** 城墙转角：N/E 朝外沿（trim），S/W 朝内侧墙（wall-inner） */
export const WALL_CORNER = Object.freeze({
  id: "wall.corner",
  family: "wall",
  weight: 1,
  orientationGroup: "Y4",
  faces: Object.freeze({
    N: F("trim"),
    E: F("trim"),
    S: F("wall-inner"),
    W: F("wall-inner"),
  }),
});

/** 屋顶边：四周 trim；显式禁配 balcony.edge（non-Wang） */
export const ROOF_EDGE = Object.freeze({
  id: "roof.edge",
  family: "roof",
  weight: 1,
  orientationGroup: "NONE",
  faces: Object.freeze({
    N: F("trim", { excludedNeighbors: Object.freeze(["balcony.edge"]) }),
    E: F("trim", { excludedNeighbors: Object.freeze(["balcony.edge"]) }),
    S: F("trim", { excludedNeighbors: Object.freeze(["balcony.edge"]) }),
    W: F("trim", { excludedNeighbors: Object.freeze(["balcony.edge"]) }),
  }),
});

/** 阳台边：四周 trim；显式禁配 roof.edge（non-Wang，双向声明） */
export const BALCONY_EDGE = Object.freeze({
  id: "balcony.edge",
  family: "balcony",
  weight: 1,
  orientationGroup: "NONE",
  faces: Object.freeze({
    N: F("trim", { excludedNeighbors: Object.freeze(["roof.edge"]) }),
    E: F("trim", { excludedNeighbors: Object.freeze(["roof.edge"]) }),
    S: F("trim", { excludedNeighbors: Object.freeze(["roof.edge"]) }),
    W: F("trim", { excludedNeighbors: Object.freeze(["roof.edge"]) }),
  }),
});

/** 内院地面 filler */
export const COURT_GROUND = Object.freeze({
  id: "court.ground",
  family: "ground",
  weight: 4,
  orientationGroup: "NONE",
  faces: Object.freeze({ N: F("ground"), E: F("ground"), S: F("ground"), W: F("ground") }),
});

export const EDGE_TRIM_FIXTURE = Object.freeze({
  kind: "edge-trim",
  prototypes: Object.freeze([WALL_CORNER, ROOF_EDGE, BALCONY_EDGE, COURT_GROUND]),
});
