// =====================================================================
//  V5 光照 · K6 共享 stylized lighting uniforms（TODO 561）
//  单一真源：direct/sun、shadow、sky/ground、AO、bounce、emissive 六组
//  uniform 记录只创建一次（模块级单例），以浅引用分发给各材质 patch
//  （onBeforeCompile 风格的对象描述）。禁止每栋建筑 clone 管线：
//  applySharedUniformsToMaterialDesc() 做的是引用合并，不是拷贝。
//
//  本文件不 import Three.js：uniform 值是纯数据（数组/数字/字符串/null），
//  真实 THREE.Texture / Vector3 / Color 由宿主桥接层在挂载时写入对应
//  记录的 .value（记录本身不冻结，容器冻结防增删键）。
//
//  AO 组命名与 render/ao/voxelAoRenderer.js 注入的 uniforms 逐名对齐
//  （tVoxelAoAtlas / uVoxelAoOrigin / ...）；voxelAoRenderer 目前自建一份
//  sharedUniforms，属“需要改现有文件才能收编”的已知项，见 K6 报告。
// =====================================================================

export const STYLIZED_UNIFORM_GROUPS = Object.freeze([
  "direct",
  "shadow",
  "skyGround",
  "ao",
  "bounce",
  "emissive",
]);

// ---------- 初值：与 lightingTheme 正午基线 / voxelAoRenderer / BOUNCE_LIMITS 对齐 ----------
function buildGroups() {
  return {
    // 太阳直射（key light）
    direct: {
      uSunDirection: { value: [0.6, 0.72, 0.35] }, // 归一化方向，正午基线
      uSunColor: { value: "#FFE2B9" },
      uSunIntensity: { value: 1.35 },
    },
    // 阴影
    shadow: {
      uShadowEnabled: { value: 1 },
      uShadowStrength: { value: 1.0 },
      uShadowBias: { value: -0.001 },
    },
    // 天空/地面半球填充
    skyGround: {
      uSkyColor: { value: "#D8F2EF" },
      uGroundColor: { value: "#B6A790" },
      uHemiIntensity: { value: 0.96 },
    },
    // AO（K3 voxel AO；命名对齐 voxelAoRenderer 注入层）
    ao: {
      tVoxelAoAtlas: { value: null }, // 宿主绑定 THREE.DataTexture
      uVoxelAoOrigin: { value: [0, 0, 0] },
      uVoxelAoDims: { value: [0, 0, 0] },
      uVoxelAoSize: { value: 0 },
      uVoxelAoAtlasInv: { value: [0, 0] },
      uVoxelAoStrength: { value: 0 }, // 首次全量构建前不露 AO
      uVoxelAoGain: { value: 2.2 },
      uVoxelAoFade: { value: 3 },
      uVoxelAoEnabled: { value: 1 },
      uVoxelAoDebug: { value: 0 },
    },
    // 单次色彩反弹（K5；默认关闭，上限见 lightingBounce.BOUNCE_LIMITS）
    bounce: {
      uBounceEnabled: { value: 0 },
      uBounceIntensity: { value: 0 },
      uBounceMix: { value: 0 },
      uBounceTint: { value: "#FFFFFF" },
    },
    // 自发光（火炬火焰/窗光等的外观倍率，不产生真实灯）
    emissive: {
      uEmissiveBoost: { value: 1.0 },
    },
  };
}

let _shared = null;

/**
 * 幂等访问器：无论调用多少次，返回同一引用。
 * 容器（顶层 / groups / 每个组）冻结防增删键；uniform 记录 { value } 不冻结，
 * 宿主每帧写 .value 更新全场景所有已 patch 材质。
 */
export function getSharedStylizedUniforms() {
  if (_shared) return _shared;
  const groups = buildGroups();
  const uniforms = {};
  for (const name of STYLIZED_UNIFORM_GROUPS) {
    Object.freeze(groups[name]);
    Object.assign(uniforms, groups[name]);
  }
  Object.freeze(groups);
  Object.freeze(uniforms);
  _shared = Object.freeze({
    kind: "shared-stylized-uniforms-v1",
    groups,
    uniforms, // 六组拍平的合并视图（与 groups 共享同一批记录）
  });
  return _shared;
}

/**
 * 纯函数：把共享 uniforms 以浅引用合并进材质 patch 描述。
 *  - 不修改入参 desc，返回新对象；
 *  - 共享记录按引用放进 desc.uniforms（不是 clone）：所有经此函数 patch 的
 *    材质看到同一批 { value } 记录，改一处全场景生效；
 *  - desc 自带的同名 uniform 优先（视为该材质的刻意覆盖，断开共享）。
 * @param {object} desc 材质 patch 描述（onBeforeCompile 风格；uniforms 可选）
 * @param {{ groups?: string[] }} [opts] 只挂部分组（默认六组全挂）
 */
export function applySharedUniformsToMaterialDesc(desc, opts = {}) {
  if (!desc || typeof desc !== "object") throw new Error("material desc must be an object");
  const shared = getSharedStylizedUniforms();
  const names = opts.groups ?? STYLIZED_UNIFORM_GROUPS;
  const merged = {};
  for (const name of names) {
    if (!shared.groups[name]) throw new Error(`unknown stylized uniform group: ${name}`);
    Object.assign(merged, shared.groups[name]); // 浅引用：记录不拷贝
  }
  Object.assign(merged, desc.uniforms ?? {}); // 材质自带同名项优先
  return { ...desc, uniforms: merged };
}
