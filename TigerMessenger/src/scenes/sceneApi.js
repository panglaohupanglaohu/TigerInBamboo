// =====================================================================
//  场景模块契约
//  每个场景文件导出一个 SceneModule：
//    { id, name, description?, load(ctx) -> SceneHandle }
//  SceneHandle 由主循环统一消费，互不耦合。
// =====================================================================

/**
 * @typedef {object} SceneContext
 * @property {import("three").Scene} scene
 * @property {number} planetRadius
 * @property {import("three").Mesh | null} [planet]
 * @property {object} [options] 场景私有参数（种子、密度等）
 */

/**
 * @typedef {object} SceneCollider
 * @property {import("three").Vector3} position
 * @property {number} radius
 */

/**
 * @typedef {object} SceneHandle
 * @property {string} id
 * @property {SceneCollider[]} [colliders]
 * @property {object} [platforms]  可走平台列表（仅 gameplay 场景）
 * @property {object} [hills]
 * @property {object} [clouds]
 * @property {object} [lake]
 * @property {object} [greatLake]
 * @property {object} [landmarks]
 * @property {object} [group]     根 Group，便于 dispose
 * @property {(dt:number, t:number, runtime:object) => void} [update]
 * @property {() => void} [dispose]
 * @property {object} [debug]
 */

/**
 * @typedef {object} SceneModule
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {(ctx: SceneContext) => SceneHandle} load
 */

/** 空更新（避免主循环判空分支） */
export function noopUpdate() {}

/**
 * 合并多个 SceneHandle 的碰撞体
 * @param {SceneHandle[]} handles
 */
export function mergeColliders(handles) {
  const out = [];
  for (const h of handles) {
    if (h?.colliders?.length) out.push(...h.colliders);
  }
  return out;
}

/**
 * 顺序调用各场景 update
 * @param {SceneHandle[]} handles
 */
export function updateScenes(handles, dt, t, runtime) {
  for (const h of handles) {
    if (h?.update) h.update(dt, t, runtime);
  }
}

/**
 * 卸载场景（若实现 dispose）
 * @param {SceneHandle[]} handles
 */
export function disposeScenes(handles) {
  for (const h of handles) {
    try {
      h?.dispose?.();
    } catch (e) {
      console.warn("[scene] dispose failed", h?.id, e);
    }
  }
}
