// 场景子系统对外入口
export {
  listScenes,
  getSceneModule,
  loadScenes,
  loadScenesIncrementally,
  resolveSceneIdsFromUrl,
  DEFAULT_SCENE_IDS,
} from "./registry.js";
export { mergeColliders, updateScenes, disposeScenes } from "./sceneApi.js";
