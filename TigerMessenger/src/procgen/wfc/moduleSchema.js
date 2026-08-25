// =====================================================================
//  Module Schema — versioned ModulePrototype / ModuleVariant（V7-G2）
//  schema 只引用 builder key（字符串），不内嵌 Three.js 对象；
//  familyBuilders.js 映射保留在表现层。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

export const WFC_MODULE_SCHEMA_VERSION = 1;
export const FACE_KEYS = Object.freeze(["N", "E", "S", "W", "U", "D"]);
export const HORIZONTAL_FACES = Object.freeze(["N", "E", "S", "W"]);
export const PARITIES = Object.freeze(["normal", "symmetric", "flipped"]);
export const ORIENTATION_GROUPS = Object.freeze(["NONE", "Y4", "D4", "CUBE24"]);

/**
 * ModulePrototype 校验。
 * @param {object} proto
 * proto = {
 *   id: string, family: string, weight: number>0 有限,
 *   tags?: string[], orientationGroup?: "NONE"|"Y4"|"D4"|"CUBE24",
 *   faces: { [face]: {
 *     connector: string,          // socket 连接器名；"boundary" 表示边界专用
 *     parity?: "normal"|"symmetric"|"flipped",
 *     walkable?: boolean, sealed?: boolean,
 *     load?: number, support?: number, clearance?: number,
 *     portal?: string|null,
 *   } },
 *   rules?: { requiresBelow?: string, excludes?: string[],
 *             requiresWalkableNeighbor?: string[] },
 *   builderKey?: string,          // familyBuilders.js 的工厂键
 * }
 */
export function validateModulePrototype(proto) {
  const errors = [];
  if (!proto || typeof proto !== "object") return { ok: false, errors: ["not-object"] };
  if (typeof proto.id !== "string" || !proto.id) errors.push("id");
  if (typeof proto.family !== "string" || !proto.family) errors.push("family");
  const w = proto.weight ?? 1;
  if (typeof w !== "number" || !Number.isFinite(w) || w <= 0) errors.push(`weight:${w}`); // 防 entropy NaN
  const og = proto.orientationGroup || "Y4";
  if (!ORIENTATION_GROUPS.includes(og)) errors.push(`orientationGroup:${og}`);
  if (!proto.faces || typeof proto.faces !== "object") {
    errors.push("faces");
    return { ok: errors.length === 0, errors };
  }
  for (const key of Object.keys(proto.faces)) {
    if (!FACE_KEYS.includes(key)) errors.push(`face:${key}`);
  }
  for (const [key, face] of Object.entries(proto.faces)) {
    if (!face || typeof face.connector !== "string" || !face.connector) {
      errors.push(`face.${key}.connector`);
    }
    if (face.parity !== undefined && !PARITIES.includes(face.parity)) {
      errors.push(`face.${key}.parity:${face.parity}`);
    }
    if (face.connector === "boundary" && (face.parity === "flipped" || face.parity === "normal")) {
      // boundary 连接器要求 symmetric（无方向性）
      errors.push(`face.${key}.boundary-parity`);
    }
  }
  // 城堡默认 Y4：门/烟囱等不得用 CUBE24 倒置（Oskar 边界：模块库按网格制作）
  if ((proto.family === "door" || proto.family === "chimney") && og === "CUBE24") {
    errors.push(`${proto.family}-must-not-cube24`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * ModuleSet manifest：三类城堡的 versioned 模块集（不复制 solver）。
 * @param {object} opts
 * @param {string} opts.id 如 "highland-citadel"
 * @param {string} opts.moduleSetVersion 如 "citadel-3"
 * @param {object[]} opts.prototypes ModulePrototype 数组
 */
export function createModuleSetManifest({ id, moduleSetVersion, prototypes }) {
  const errors = [];
  const seen = new Set();
  for (const proto of prototypes) {
    const v = validateModulePrototype(proto);
    if (!v.ok) errors.push(`${proto?.id}: ${v.errors.join(",")}`);
    if (seen.has(proto.id)) errors.push(`duplicate-id:${proto.id}`);
    seen.add(proto.id);
  }
  return {
    id,
    moduleSetVersion,
    schemaVersion: WFC_MODULE_SCHEMA_VERSION,
    prototypes,
    validation: { ok: errors.length === 0, errors },
  };
}

/** face 的兼容性摘要（供 compatibilityTable 消费） */
export function faceSignature(face) {
  return {
    connector: face.connector,
    parity: face.parity || "normal",
    walkable: face.walkable === true,
    sealed: face.sealed === true,
    load: face.load ?? 0,
    support: face.support ?? 0,
    clearance: face.clearance ?? 0,
    portal: face.portal ?? null,
  };
}
