// =====================================================================
// 场景距离剔除（主人验收 2026-08-28 古堡卡顿治理）
// 实测主页 4723 draw calls @10fps——CPU 提交瓶颈。小星球（R=160）的
// 地平线在低视角下天然遮蔽远处物体：把「小件静态装饰」按与相机的
// 距离显式 visible 开关，远处的 Props 不再提交绘制。
//   · 只管理 小件（包围球半径 ≤ maxObjectRadius）；
//   · 名字匹配 excluded（船/兵/云/天空/水体/星球壳…动态与巨物）不参与；
//   · 剔除半径随相机高度放大（航拍时看得远，剔除半径也变远）；
//   · 节流 interval 秒跑一次，恢复昼/夜与场景切换调用 recollect()。
// =====================================================================
import * as THREE from "three";

export const DISTANCE_CULLING_SCHEMA_VERSION = 1;

const DEFAULT_EXCLUDED = /boat|ship|soldier|warship|player|agent|bird|whale|pod|tram|bubble|cloud|sky|sun|moon|ocean|water|sea|planet|lantern-light|volume-shell|window-spark|canopy-groves|slope-grass|hero-cloud/i;

export function createSceneDistanceCulling(THREE_, {
  scene,
  getCamera,
  planetRadius = 160,
  cullDistance = 150,
  altitudeFactor = 5,
  maxObjectRadius = 25,
  interval = 0.3,
  excluded = DEFAULT_EXCLUDED,
} = {}) {
  if (!THREE_?.Scene || !scene || !getCamera) throw new Error("distance culling requires THREE, scene, getCamera");
  let entries = null; // null = 尚未收集
  let collectTimer = 0;
  let lastCull = -1;
  let lastVisibleCount = 0;
  const _center = new THREE_.Vector3();

  const isExcluded = (object) => {
    let node = object;
    for (let depth = 0; node && depth < 4; depth++) {
      if (excluded.test(node.name || "")) return true;
      node = node.parent;
    }
    return false;
  };

  const collect = () => {
    entries = [];
    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      if (!object.isMesh || object.visible === false) return;
      if (isExcluded(object)) return;
      const geometry = object.geometry;
      if (!geometry?.attributes?.position) return;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (!sphere || !Number.isFinite(sphere.radius)) return;
      if (sphere.radius > maxObjectRadius) return; // 巨物（星球壳/海壳/山体）不参与
      object.getWorldPosition(_center);
      const worldRadius = sphere.radius * object.getWorldScale(new THREE_.Vector3()).x;
      entries.push({
        mesh: object,
        center: _center.clone(),
        radius: Math.max(0.5, worldRadius),
      });
    });
    return entries;
  };

  const apply = (camera) => {
    const camPos = camera.position;
    const altitude = Math.max(0, camPos.length() - planetRadius);
    const cullDist = cullDistance + altitude * altitudeFactor;
    let visibleCount = 0;
    for (const entry of entries) {
      const dist = entry.center.distanceTo(camPos) - entry.radius;
      const show = dist < cullDist;
      if (entry.mesh.visible !== show) entry.mesh.visible = show;
      if (show) visibleCount += 1;
    }
    lastVisibleCount = visibleCount;
  };

  const update = (dt) => {
    if (entries === null) {
      collectTimer += Math.max(0, Number(dt) || 0);
      if (collectTimer >= 2.5) entries = collect();
      return;
    }
    collectTimer += Math.max(0, Number(dt) || 0);
    if (lastCull < 0 || collectTimer - lastCull >= interval) {
      lastCull = collectTimer;
      const camera = getCamera();
      if (camera) apply(camera);
    }
  };

  const recollect = () => {
    entries = collect();
  };

  const dispose = () => {
    if (entries) for (const entry of entries) entry.mesh.visible = true;
    entries = null;
  };

  return {
    update,
    recollect,
    dispose,
    get entryCount() {
      return entries ? entries.length : 0;
    },
    get lastVisibleCount() {
      return lastVisibleCount;
    },
    schemaVersion: DISTANCE_CULLING_SCHEMA_VERSION,
  };
}
