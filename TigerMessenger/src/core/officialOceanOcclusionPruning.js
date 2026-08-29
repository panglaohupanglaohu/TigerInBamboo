// =====================================================================
// 正式页海壳遮挡清理
//
// 正式页的 official ocean 是一层写 depth 的球壳。完全位于该球壳以内的
// 静态模型不会进入外部视野，却仍会被 renderer 逐个遍历并提交 draw call。
// 这里仅处理明确标记为可清理的子树，绝不按名字猜测、更不会动角色、战斗
// 单位、船只航线或水面倒影。关闭整棵子树能同时省下 CPU 场景遍历和 GPU
// 绘制。通过从场景树摘除子树来阻止运行时脚本重新把 visible 设回 true；
// 对象本身仍由原工厂的引用保留，便于以后需要时重新挂回场景。
// =====================================================================
import * as THREE from "three";
import {
  OFFICIAL_OCEAN_SEA_LEVEL,
  officialOceanLevelAt,
} from "../world/waterV8/officialOcean.js";

export const OFFICIAL_OCEAN_OCCLUSION_TAG = "officialOceanOcclusionCandidate";

const _worldBox = new THREE.Box3();
const _worldScale = new THREE.Vector3();
const _point = new THREE.Vector3();

function getOfficialOcean(scene) {
  let ocean = null;
  scene?.traverse?.((object) => {
    if (object.userData?.officialOcean === true) ocean = object;
  });
  return ocean;
}

function triangleCount(geometry) {
  const positions = geometry?.attributes?.position;
  if (!positions) return 0;
  return Math.floor((geometry.index?.count || positions.count) / 3);
}

/**
 * 采样一个世界 AABB。27 个点（角、边/面中点和中心）使峡谷边缘不会被
 * 仅靠中心点误判；全部低于海壳安全余量才返回 true。
 */
function boxIsFullyBelowOfficialOcean(box, radius, seaLevel, margin) {
  for (let ix = 0; ix < 3; ix++) {
    for (let iy = 0; iy < 3; iy++) {
      for (let iz = 0; iz < 3; iz++) {
        _point.set(
          THREE.MathUtils.lerp(box.min.x, box.max.x, ix * 0.5),
          THREE.MathUtils.lerp(box.min.y, box.max.y, iy * 0.5),
          THREE.MathUtils.lerp(box.min.z, box.max.z, iz * 0.5)
        );
        const pointRadius = _point.length();
        if (pointRadius < 1e-6) return false;
        const waterRadius = radius + officialOceanLevelAt(_point, seaLevel);
        if (pointRadius + margin >= waterRadius) return false;
      }
    }
  }
  return true;
}

function spriteIsFullyBelowOfficialOcean(sprite, radius, seaLevel, margin) {
  sprite.getWorldPosition(_point);
  const pointRadius = _point.length();
  if (pointRadius < 1e-6) return false;
  sprite.getWorldScale(_worldScale);
  // Sprite 的四角始终面向镜头，取最大边的一半作为保守的径向范围。
  const spriteRadius = Math.max(_worldScale.x, _worldScale.y, _worldScale.z) * 0.75;
  const waterRadius = radius + officialOceanLevelAt(_point, seaLevel);
  return pointRadius + spriteRadius + margin < waterRadius;
}

function subtreeIsFullyBelowOfficialOcean(root, radius, seaLevel, margin) {
  let renderableCount = 0;
  let meshCount = 0;
  let triangles = 0;
  let fullyBelow = true;

  root.traverse((object) => {
    if (!fullyBelow || object.visible === false) return;
    if (object.isMesh || object.isInstancedMesh) {
      const geometry = object.geometry;
      if (!geometry?.attributes?.position) {
        fullyBelow = false;
        return;
      }
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) {
        fullyBelow = false;
        return;
      }
      _worldBox.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld);
      if (!boxIsFullyBelowOfficialOcean(_worldBox, radius, seaLevel, margin)) {
        fullyBelow = false;
        return;
      }
      renderableCount += 1;
      meshCount += 1;
      triangles += triangleCount(geometry) * (object.isInstancedMesh ? object.count : 1);
      return;
    }
    if (object.isSprite) {
      if (!spriteIsFullyBelowOfficialOcean(object, radius, seaLevel, margin)) {
        fullyBelow = false;
        return;
      }
      renderableCount += 1;
    }
  });

  return { fullyBelow: fullyBelow && renderableCount > 0, meshCount, triangles };
}

/**
 * 关闭被正式页海壳完全盖住、且由内容工厂显式许可的静态子树。
 *
 * 不存在 official ocean 时保持 no-op，因此 V8/V9 地形水体、独立关卡和
 * 地图编辑器不会受到影响。
 */
export function pruneTaggedOfficialOceanOccludeds(scene, {
  radius = 160,
  seaLevel = OFFICIAL_OCEAN_SEA_LEVEL,
  margin = 0.24,
  tag = OFFICIAL_OCEAN_OCCLUSION_TAG,
} = {}) {
  if (!scene?.traverse || !getOfficialOcean(scene)) {
    return { enabled: false, checked: 0, hidden: 0, meshes: 0, triangles: 0, entries: [] };
  }

  scene.updateMatrixWorld(true);
  const candidates = [];
  scene.traverse((object) => {
    if (object.visible !== false && object.userData?.[tag] === true) candidates.push(object);
  });

  const entries = [];
  for (const candidate of candidates) {
    const coverage = subtreeIsFullyBelowOfficialOcean(candidate, radius, seaLevel, margin);
    if (!coverage.fullyBelow) continue;
    // 有些装饰的动画会在 update 中自行恢复 visible。只关 visible 会让它们
    // 下一帧重新进入 renderer；从场景树摘除才能稳定节省遍历和 draw call。
    candidate.removeFromParent();
    candidate.visible = false;
    candidate.userData.officialOceanOccluded = true;
    candidate.userData.officialOceanOcclusionStats = {
      meshCount: coverage.meshCount,
      triangles: coverage.triangles,
      margin,
      detached: true,
    };
    entries.push({ name: candidate.name || candidate.uuid, ...coverage });
  }

  return {
    enabled: true,
    checked: candidates.length,
    hidden: entries.length,
    meshes: entries.reduce((sum, entry) => sum + entry.meshCount, 0),
    triangles: entries.reduce((sum, entry) => sum + entry.triangles, 0),
    entries,
  };
}
