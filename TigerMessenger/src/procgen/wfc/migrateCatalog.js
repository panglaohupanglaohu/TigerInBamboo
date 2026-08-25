// =====================================================================
//  Catalog Migration — 现有 47 模块 → V7 ModulePrototype schema（V7-G2）
//  旧 catalog 的 sockets 是纯字符串（按相等匹配）；迁移后等价于
//  parity: "symmetric" 的语义。walkable = connector === "open"。
//  记录 prototype 数 / 展开后 variant 数 / 2450 组合指标 三者差异。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/**
 * @param {object} oldModule createModuleCatalog().modules 中的一项
 * @returns {object} ModulePrototype
 */
export function migrateCatalogModule(oldModule) {
  const faces = {};
  for (const [dir, connector] of Object.entries(oldModule.sockets)) {
    faces[dir] = {
      connector,
      parity: "symmetric", // 旧系统字符串相等匹配 ≡ symmetric
      walkable: connector === "open",
      sealed: connector === "wall" || connector === "support" || connector === "roof",
      portal: null,
    };
  }
  const tags = [];
  if (oldModule.rarity === "rare") tags.push("rare");
  if (oldModule.rarity === "uncommon") tags.push("uncommon");
  if (oldModule.walkSurface === "flower-tile") tags.push("flower-tile");
  const rules = {};
  if (oldModule.requires?.includes("support-below")) rules.requiresBelow = "bearing>=1";
  if (oldModule.forbids?.length) rules.excludes = [...oldModule.forbids];
  return {
    id: oldModule.id,
    family: oldModule.family,
    weight: oldModule.weight ?? 1,
    tags,
    orientationGroup: "Y4", // 旧 transforms = r0..r270
    faces,
    rules,
    builderKey: oldModule.meshFactory, // familyBuilders 映射键，不内嵌 Three 对象
  };
}

/**
 * @param {object[]} oldModules
 * @returns {{prototypes: object[], report: object}}
 */
export function migrateCatalogModules(oldModules) {
  const prototypes = oldModules.map(migrateCatalogModule);
  const report = {
    oldModuleCount: oldModules.length,
    prototypeCount: prototypes.length,
    note:
      "2450 = TOWNSCAPER_MODULE_VARIANTS 组合空间指标（旧口径）；" +
      "新 variant 数 = prototype × 方向群去重后的展开数，两者口径不同，不得混用。",
  };
  return { prototypes, report };
}
