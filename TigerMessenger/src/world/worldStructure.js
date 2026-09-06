// =====================================================================
//  球形世界空间结构：Planet → Region → Landmark → Zone
//
//  「场—区—元—约束」架构的**第二层（Region）数据层**。
//  设计与边界见 docs/WORLD_STRUCTURE_ARCHITECTURE.md。
//
//  ---------------------------------------------------------------
//  三条硬约束（改这个文件前先读）
//  ---------------------------------------------------------------
//  ① **禁止 import Three.js。** 本模块是纯数据 + 解析：不持有几何、不进
//     scene graph。角距计算自己用 {x,y,z} 点积实现。这样它能在 Node
//     headless 下被 tools/test_world_structure.mjs 直接测。
//
//  ② **位置一律惰性求值（getDir 函数），禁止存快照。**
//     理由只有一个：西芳寺骑在太古浮岛白鲸上（saihojiGarden.js 把苔庭
//     re-parent 进 islandGroup → leviathanGroup，鲸会 setAnchorRadius
//     升沉并抖动）。存快照会在鲸游走后指错方向，而且**不会报错**，
//     只会让导航悄悄骗人。这就是 REGION_KIND.MOBILE 存在的唯一理由。
//
//  ③ **六景 id/name 从 SAIHOJI_ZONES 派生，禁止手抄。**
//     2026-09-05 刚被同一个病坑过两次：编辑面板手抄了一份色值、生产用另一份
//     色板，结果「选松石绿建出风化白石」，15 个字符 14 个对不上。
//     凡是「同一份事实抄成两份」的地方，迟早会漂。
//
//  ---------------------------------------------------------------
//  这一层不做什么
//  ---------------------------------------------------------------
//  · 不做按场自动划区域边界（locateWorldContext 用「最近地标」近似）
//  · 不做气候场 / 大陆场
//  · 不动 SceneModule 契约，也不动 messenger.landmarks.* / saihoji.zones
//    —— 这是**加层**，不是重写
// =====================================================================

import { SAIHOJI_ZONES } from "./saihoji.js";

/** 地标分级：决定它在哪一级导航里出现 */
export const LANDMARK_TIER = Object.freeze({
  /** 从整个球体尺度就该看见 */
  WORLD: 0,
  /** 进入所属 region 后才出现 */
  REGION: 1,
  /** 进入该地标内部才出现（景区级 POI） */
  LOCAL: 2,
});

export const REGION_KIND = Object.freeze({
  STATIC: "static",
  /** 位置每帧变（骑在移动载体上）→ 必须惰性求值 */
  MOBILE: "mobile",
});

/** 西芳寺区域 id（区域与其 Tier0 地标同名，是有意的：它既是区域也是入口） */
export const SAIHOJI_REGION_ID = "saihoji";

/**
 * 区域表。
 * members 只列 Tier0/1 地标；Tier2 景区挂在 SAIHOJI_LOCAL_LANDMARKS 上。
 */
export const WORLD_REGIONS = Object.freeze([
  Object.freeze({
    id: "coast-civil",
    name: "文明海岸带",
    kind: REGION_KIND.STATIC,
    members: Object.freeze(["camp", "bookshop", "harbor", "city", "lake"]),
  }),
  Object.freeze({
    id: "highland-sanctum",
    name: "山地圣域",
    kind: REGION_KIND.STATIC,
    members: Object.freeze(["gate", "citadel"]),
  }),
  Object.freeze({
    id: "lake-wetland",
    name: "湖泊湿地生态区",
    kind: REGION_KIND.STATIC,
    members: Object.freeze(["moon"]),
  }),
  Object.freeze({
    // 预留：山脉 / 河流 / 森林 / 草原 / 沙漠 / 极地都还不存在。
    // 空区域是**有意保留**的，别因为「它是空的」就删掉——
    // 它标记了世界还没长出来的那一半，也是下一刀 Terrain Grammar 的落点。
    id: "far-nature",
    name: "远方自然世界",
    kind: REGION_KIND.STATIC,
    members: Object.freeze([]),
  }),
  Object.freeze({
    id: SAIHOJI_REGION_ID,
    name: "西芳寺苔庭",
    kind: REGION_KIND.MOBILE,
    members: Object.freeze([SAIHOJI_REGION_ID]),
  }),
]);

/**
 * Tier0 / Tier1 地标声明。
 * color 沿用接线前 main.js 里那 9 项的现值（换色是审美裁决，不在本刀范围）。
 */
export const WORLD_LANDMARKS = Object.freeze([
  // ---------- Tier 0：球体尺度可见 ----------
  Object.freeze({ id: "camp", name: "出发营地", color: "#4aa76c", tier: LANDMARK_TIER.WORLD, region: "coast-civil" }),
  Object.freeze({ id: "harbor", name: "旧港码头", color: "#8a9bb8", tier: LANDMARK_TIER.WORLD, region: "coast-civil" }),
  Object.freeze({ id: "city", name: "水晶城", color: "#7eb0ff", tier: LANDMARK_TIER.WORLD, region: "coast-civil" }),
  Object.freeze({ id: "citadel", name: "高山圣城", color: "#d4af37", tier: LANDMARK_TIER.WORLD, region: "highland-sanctum" }),
  Object.freeze({ id: SAIHOJI_REGION_ID, name: "西芳寺苔庭", color: "#2f8f7a", tier: LANDMARK_TIER.WORLD, region: SAIHOJI_REGION_ID }),
  // ---------- Tier 1：进区域才出现 ----------
  Object.freeze({ id: "bookshop", name: "书店镇", color: "#d98a2b", tier: LANDMARK_TIER.REGION, region: "coast-civil" }),
  Object.freeze({ id: "lake", name: "白鲸海水湖", color: "#48c9b0", tier: LANDMARK_TIER.REGION, region: "coast-civil" }),
  Object.freeze({ id: "gate", name: "叹息之门", color: "#b85a42", tier: LANDMARK_TIER.REGION, region: "highland-sanctum" }),
  Object.freeze({ id: "moon", name: "月亮湖", color: "#c9a8ff", tier: LANDMARK_TIER.REGION, region: "lake-wetland" }),
]);

/** 六景配色（按游线顺序的青绿渐变；id/name 仍从 SAIHOJI_ZONES 派生） */
const SAIHOJI_ZONE_COLORS = Object.freeze({
  "moss-entry": "#3fae8f",
  "master-stones": "#2f8f7a",
  "dry-cascade": "#7fb98f",
  "moss-islands": "#4fc2a8",
  "empty-court": "#9ecfb8",
  "return-view": "#2e7d68",
});

/**
 * Tier2 景区 —— **从 SAIHOJI_ZONES 派生**（见文件头约束 ③）。
 * 少一景多一景都会被 tools/test_world_structure.mjs 抓到。
 */
export const SAIHOJI_LOCAL_LANDMARKS = Object.freeze(
  SAIHOJI_ZONES.map((zone) =>
    Object.freeze({
      id: zone.id,
      name: zone.name,
      color: SAIHOJI_ZONE_COLORS[zone.id] ?? "#2f8f7a",
      tier: LANDMARK_TIER.LOCAL,
      region: SAIHOJI_REGION_ID,
      /** 所属 Tier0 地标：Tier2 只在进入 parent 内部后可见 */
      parent: SAIHOJI_REGION_ID,
      /** 景区在苔庭局部的净空半径（世界单位），用于 local 命中判定 */
      localRadius: zone.radius,
    })
  )
);

/** 全部地标声明（Tier0/1/2） */
export function allLandmarks() {
  return [...WORLD_LANDMARKS, ...SAIHOJI_LOCAL_LANDMARKS];
}

/** 地标 id → region id（未知返回 null） */
export function regionOfLandmark(id) {
  const found = allLandmarks().find((lm) => lm.id === id);
  return found ? found.region : null;
}

/**
 * 某 region 下的地标声明。
 * @param {string} regionId
 * @param {number} [tier] 给了就只返回该级
 */
export function landmarksOfRegion(regionId, tier) {
  return allLandmarks().filter(
    (lm) => lm.region === regionId && (tier === undefined || lm.tier === tier)
  );
}

export function regionById(regionId) {
  return WORLD_REGIONS.find((r) => r.id === regionId) ?? null;
}

// ---------------------------------------------------------------------
//  球面角距（自实现，不依赖 Three.js —— 见文件头约束 ①）
// ---------------------------------------------------------------------

/** 任意 {x,y,z} → 单位向量分量；零向量返回 null */
function unit(v) {
  if (!v) return null;
  const x = v.x;
  const y = v.y;
  const z = v.z;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const len = Math.sqrt(x * x + y * y + z * z);
  if (!(len > 1e-8)) return null;
  return { x: x / len, y: y / len, z: z / len };
}

/** 两个方向之间的球面角距（弧度）；任一为空返回 Infinity */
export function angularDistance(a, b) {
  const ua = unit(a);
  const ub = unit(b);
  if (!ua || !ub) return Infinity;
  const dot = Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y + ua.z * ub.z));
  return Math.acos(dot);
}

// ---------------------------------------------------------------------
//  绑定层：声明 → 活的 scene handle
// ---------------------------------------------------------------------

/**
 * 从 Object3D 读世界位置。
 *
 * 苔庭在动，所以优先取 matrixWorld 的平移分量（每次重算，不缓存）。
 * 需要调用方注入 makeVec 才能返回带 lengthSq() 的向量——minimap 会调
 * `d.lengthSq()`，纯 {x,y,z} 过不了。没注入就退回 fallback（静态方向），
 * 这让 headless 测试不必拉 Three.js 进来。
 */
function worldPosOf(object, makeVec) {
  if (!object || typeof makeVec !== "function") return null;
  const e = object.matrixWorld?.elements;
  if (!e || e.length < 16) return null;
  const v = makeVec();
  if (!v || typeof v.set !== "function") return null;
  return v.set(e[12], e[13], e[14]);
}

/**
 * 把层级声明绑定到活的 scene handle。
 *
 * @param {{
 *   messenger?: object|null,
 *   saihoji?: object|null,
 *   makeVec?: () => { set:(x:number,y:number,z:number)=>any },
 * }} bind
 *   - makeVec：可选的向量工厂（生产传 `() => new THREE.Vector3()`）。
 *     给了就能取移动苔庭的**实时**世界位置；不给则退回 `pathDirection`。
 * @returns {Array<{id,name,color,tier,region,parent?,localRadius?,getDir:()=>object|null}>}
 *   getDir 全部惰性；handle 缺失一律返回 null，**不抛**
 *   （`?scene=saihoji` 单独加载时 messenger 为空）。
 */
export function resolveWorldLandmarks(bind = {}) {
  const { messenger = null, saihoji = null, makeVec = null } = bind;

  // 取向路径与接线前 main.js 那 9 项逐字一致，避免这一刀顺手改了指向。
  const worldDirGetters = {
    camp: () => messenger?.landmarks?.camp?.landmarks?.anchor?.position ?? null,
    harbor: () => messenger?.landmarks?.boat?.position ?? null,
    city: () => messenger?.landmarks?.moebius?.grand?.dir ?? null,
    citadel: () => messenger?.landmarks?.odysseyCitadel?.position ?? null,
    bookshop: () => messenger?.landmarks?.bookshop?.position ?? null,
    lake: () => messenger?.landmarks?.citySeaLake?.centerDir ?? null,
    gate: () => messenger?.landmarks?.abandonedGate?.userData?.seatRoot?.position ?? null,
    moon: () => messenger?.landmarks?.moonLake?.centerWorld ?? null,
    [SAIHOJI_REGION_ID]: () => zoneDir(SAIHOJI_ZONES[0]?.id),
  };

  /** 景区方向：移动苔庭 → 优先实时世界位置，退回建造期 pathDirection */
  function zoneDir(zoneId) {
    if (!zoneId) return null;
    const zone = saihoji?.landmarks?.zones?.[zoneId];
    if (!zone) return null;
    const live = worldPosOf(zone.group, makeVec);
    if (live) return live;
    return zone.pathDirection ?? null;
  }

  const out = [];
  for (const lm of WORLD_LANDMARKS) {
    out.push({ ...lm, getDir: worldDirGetters[lm.id] ?? (() => null) });
  }
  for (const lm of SAIHOJI_LOCAL_LANDMARKS) {
    out.push({ ...lm, getDir: () => zoneDir(lm.id) });
  }
  return out;
}

// ---------------------------------------------------------------------
//  定位与可见性
// ---------------------------------------------------------------------

/** 默认：玩家离某景区中心多近才算"进了这一景" */
const DEFAULT_LOCAL_ENTER_RAD = 0.06;
/** 默认：离某 region 最近地标多远之内算"在这个区域里" */
const DEFAULT_REGION_ENTER_RAD = 0.55;

/**
 * 玩家在哪个 region / 哪个 local 景区。
 *
 * ⚠️ 这是**近似**：按最近的 Tier0/1 地标反查 region，区域之间没有真边界。
 * 真边界要等 Region Generator（见 docs §6 已知缺口）。
 *
 * @param {{x:number,y:number,z:number}|null} playerPos 玩家世界位置（只用方向）
 * @param {Array<object>} resolved resolveWorldLandmarks 的结果
 * @param {{ regionEnterRad?:number, localEnterRad?:number }} [opts]
 * @returns {{ regionId: string|null, localId: string|null }}
 */
export function locateWorldContext(playerPos, resolved, opts = {}) {
  const regionEnterRad = opts.regionEnterRad ?? DEFAULT_REGION_ENTER_RAD;
  const localEnterRad = opts.localEnterRad ?? DEFAULT_LOCAL_ENTER_RAD;
  const dir = unit(playerPos);
  if (!dir || !Array.isArray(resolved)) return { regionId: null, localId: null };

  // ① region：最近的 Tier0/1 地标
  let regionId = null;
  let bestRegion = Infinity;
  for (const lm of resolved) {
    if (lm.tier === LANDMARK_TIER.LOCAL) continue;
    const d = angularDistance(dir, lm.getDir?.());
    if (d < bestRegion) {
      bestRegion = d;
      regionId = lm.region;
    }
  }
  if (!(bestRegion <= regionEnterRad)) regionId = null;

  // ② local：落进某个 Tier2 景区的角半径
  let localId = null;
  let bestLocal = Infinity;
  for (const lm of resolved) {
    if (lm.tier !== LANDMARK_TIER.LOCAL) continue;
    const d = angularDistance(dir, lm.getDir?.());
    if (d < bestLocal && d <= localEnterRad) {
      bestLocal = d;
      localId = lm.id;
    }
  }
  // 进了某一景 → 那一定在它的 region 里（哪怕 ① 因阈值判空）
  if (localId && !regionId) regionId = regionOfLandmark(localId);

  return { regionId, localId };
}

/**
 * 可见集 = Tier0（恒显） ∪ Tier1(当前 region) ∪ Tier2(当前 local 的 parent 内)
 *
 * Tier2 的口径是「进了苔庭就显示全部六景」而不是「只显示脚下这一景」——
 * 六景是一条游线，进了园子就该看见整条线，否则导航反而更难用。
 */
export function visibleLandmarks(resolved, context = {}) {
  const { regionId = null, localId = null } = context;
  if (!Array.isArray(resolved)) return [];
  const localParent = localId ? regionOfLandmark(localId) : null;
  return resolved.filter((lm) => {
    if (lm.tier === LANDMARK_TIER.WORLD) return true;
    if (lm.tier === LANDMARK_TIER.REGION) return !!regionId && lm.region === regionId;
    if (lm.tier === LANDMARK_TIER.LOCAL) return !!localParent && lm.region === localParent;
    return false;
  });
}

/** 调试/文档用：打印区域树 */
export function describeWorldStructure() {
  const lines = ["Planet"];
  for (const region of WORLD_REGIONS) {
    const mobile = region.kind === REGION_KIND.MOBILE ? " [mobile]" : "";
    lines.push(`├── ${region.id} · ${region.name}${mobile}`);
    for (const lm of landmarksOfRegion(region.id)) {
      const tag = lm.tier === LANDMARK_TIER.WORLD ? "T0" : lm.tier === LANDMARK_TIER.REGION ? "T1" : "T2";
      lines.push(`│   ├── [${tag}] ${lm.id} · ${lm.name}`);
    }
    if (!region.members.length) lines.push("│   └── (预留，尚无地标)");
  }
  return lines.join("\n");
}

export const WORLD_STRUCTURE_VERSION = 1;
