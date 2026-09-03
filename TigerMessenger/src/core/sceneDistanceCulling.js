// =====================================================================
// 场景距离剔除（主人验收 2026-08-28 古堡卡顿治理，2026-09-01 修复）
// 小星球（R=160）的地平线在低视角下天然遮蔽远处物体：把「小件静态装饰」按与相机的
// 距离显式 visible 开关，远处的 Props 不再提交绘制。
//   · 只管理 小件（包围球半径 ≤ maxObjectRadius）；
//   · 名字匹配 excluded（船/兵/云/天空/水体/星球壳…动态与巨物）不参与；
//   · 动态物体现算世界坐标，避免出生点快照导致走远被误剔；
//   · 剔除半径随相机高度放大（航拍时看得远，剔除半径也变远）；
//   · 节流 interval 秒跑一次，恢复昼/夜与场景切换调用 recollect()。
// =====================================================================
import * as THREE from "three";

export const DISTANCE_CULLING_SCHEMA_VERSION = 2;

const DEFAULT_EXCLUDED = /boat|ship|soldier|warship|player|agent|bird|whale|pod|tram|bubble|cloud|sky|sun|moon|ocean|water|sea|planet|lantern-light|volume-shell|window-spark|canopy-groves|slope-grass|hero-cloud/i;
const DYNAMIC_RE = /messenger|agent|soldier|npc|fox|tiger|boat|ship|tram|pod|whale|bird|aircraft|airship/i;

export function createSceneDistanceCulling(THREE_, {
  scene,
  getCamera,
  planetRadius = 160,
  cullDistance = 150,
  altitudeFactor = 5,
  // 只管真正的小件装饰（树≈2 / 房子≈5）。旧值 25 相当于一整个城区，
  // 会把 mergeStaticGroup 合并出的城体/港口当成摆件整块剔掉
  // （即 2026-08-29 回滚的「远景整体误隐藏」）。
  maxObjectRadius = 8,
  interval = 0.3,
  excluded = DEFAULT_EXCLUDED,
} = {}) {
  if (!THREE_?.Scene || !scene || !getCamera) throw new Error("distance culling requires THREE, scene, getCamera");
  let entries = null; // null = 尚未收集
  let collectTimer = 0;
  let lastCull = -1;
  let lastVisibleCount = 0;
  const _center = new THREE_.Vector3();
  const _scale = new THREE_.Vector3();

  const matchesUpChain = (object, regex) => {
    let node = object;
    for (let depth = 0; node && depth < 4; depth++) {
      if (regex.test(node.name || "")) return true;
      node = node.parent;
    }
    return false;
  };

  const isExcluded = (object) => matchesUpChain(object, excluded);

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

      const dynamic = matchesUpChain(object, DYNAMIC_RE);
      // 用几何包围球中心而非 mesh 原点：合并网格的顶点常远离自身原点，
      // 按原点算距离会让近在眼前的几何体被判成很远。
      _center.copy(sphere.center);
      object.localToWorld(_center);
      object.getWorldScale(_scale);
      const maxScale = Math.max(Math.abs(_scale.x), Math.abs(_scale.y), Math.abs(_scale.z));
      const worldRadius = sphere.radius * maxScale;
      entries.push({
        mesh: object,
        dynamic,
        localCenter: dynamic ? sphere.center.clone() : null,
        center: dynamic ? null : _center.clone(),
        radius: Math.max(0.5, worldRadius),
        wasVisible: object.visible,
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
      let c = entry.center;
      if (entry.dynamic) {
        // 动态物每次现算，避免出生点快照让送信人/船走远后被误剔
        c = entry.mesh.localToWorld(_center.copy(entry.localCenter));
      }
      const dist = c.distanceTo(camPos) - entry.radius;
      // 迟滞：已显示的物体给 10% 缓冲，避免边缘抖动
      const threshold = entry.mesh.visible ? cullDist * 1.1 : cullDist;
      const show = dist < threshold;
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
    if (entries) {
      for (const entry of entries) {
        entry.mesh.visible = entry.wasVisible ?? true;
      }
    }
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
