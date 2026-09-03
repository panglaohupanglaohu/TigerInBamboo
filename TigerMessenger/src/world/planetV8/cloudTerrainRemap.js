// 云集群贴地重投影（方案 A）· 阶段 1 核心：
// 用 THREE.Raycaster 对场景可见地形（hills / 旧港 / 圣城 / moebius 街区等）沿云锚点
// 方向从球外向球心采样真实高度，改写 clusters 的 JS 端数据（instance.altitude /
// pathPoints[].altitude = 真实高度 + 原有 terrainClearance），并重算 climateHash。
// 必须在 createCloudImpostorSystem 构建 GPU buffer 之前调用——buffer 建完后再改
// JS 端数据不会生效（见 runtime.js 的插入位置注释）。
import * as THREE from "three";
import { hashCloudInstances } from "../../render/clouds/cloudClusterCompiler.js";

// 命中链上任一节点命中这些名字/标记即视为水面，跳过（阶段 1 验收：
// 水域上方的 lowLayer/水雾云不允许被贴地逻辑拽进水面以下）。
const WATER_NAME_RE = /(?:water|ocean|lake)$/i;

function chainHidden(object) {
  for (let node = object; node; node = node.parent) {
    if (node.visible === false) return true;
  }
  return false;
}

function isWaterHit(object) {
  for (let node = object; node; node = node.parent) {
    if (WATER_NAME_RE.test(node.name || "")) return true;
    if (node.userData?.officialOcean || node.userData?.kind === "water") return true;
  }
  return false;
}

/**
 * 沿 direction 从球外向球心打一根射线，取第一个可见地形交点。
 * @returns {number} 高度 = 交点离球心距离 - radius；打不中（海面/远海）返回 fallbackHeight。
 */
export function sampleSceneHeightAt(terrainMeshes, direction, radius, {
  raycaster = null,
  fallbackHeight = 0,
  excludeWater = true,
  overhead = null,
} = {}) {
  if (!terrainMeshes?.length || !direction) return fallbackHeight;
  // 纵深防御：只对真正的 Object3D 打射线。包装对象（如 {group,...}）混进清单时
  // Raycaster 会在 object.layers.test 上抛 TypeError 并炸掉整个场景启动。
  const targets = terrainMeshes.filter((entry) => entry?.isObject3D);
  if (!targets.length) return fallbackHeight;
  const dir = Array.isArray(direction)
    ? new THREE.Vector3(direction[0], direction[1], direction[2])
    : direction.clone();
  if (dir.lengthSq() < 1e-10) return fallbackHeight;
  dir.normalize();
  const start = radius + (overhead ?? Math.max(64, radius * 0.75));
  const rc = raycaster || new THREE.Raycaster();
  rc.set(dir.clone().multiplyScalar(start), dir.clone().negate());
  rc.far = start; // 恰好够到球心，第一命中即该方向最高可见表面
  const hits = rc.intersectObjects(targets, true);
  for (const hit of hits) {
    if (chainHidden(hit.object)) continue; // 隐藏对象（如 harbor-water）不算地形
    if (excludeWater && isWaterHit(hit.object)) continue;
    return Math.max(0, hit.point.length() - radius);
  }
  return fallbackHeight;
}

/**
 * 收集 root 子树里的静态地形 mesh，供 terrainMeshes 清单构建。
 * - 跳过 exclude 里的子树（飞鸟群/气泡艇等瞬态对象——它们会动，采样到会把云贴到鸟上）；
 * - 跳过名字以 water/ocean/lake 结尾的水面节点（水面不是地形）。
 */
export function collectStaticTerrainMeshes(root, excludeSubtrees = [], out = []) {
  const excluded = new Set();
  for (const item of excludeSubtrees) {
    if (Array.isArray(item)) for (const e of item) if (e?.isObject3D) excluded.add(e);
    else if (item?.isObject3D) excluded.add(item);
  }
  const walk = (node) => {
    if (!node?.isObject3D || excluded.has(node)) return;
    if (/(?:water|ocean|lake)$/i.test(node.name || "")) return;
    if (node.isMesh) out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}

/**
 * 阶段 2A：真实脊线评分。经典「脊 = 横切方向局部最大」：
 * 在 direction 的切平面上取两组正交小偏移（东西/南北）各采一对邻居高度，
 * - 横向坡度大（h0 夹在邻居中间）→ 是斜坡不是脊；
 * - h0 明显高于至少一对邻居 → 凸起，脊/峰。
 * @param {Function} sample (direction:Vector3) => height，由调用方绑定 sampleSceneHeightAt
 * @returns {number} 无量纲分值（凸起量 / 归一高度），越像“一条线上的最高点”分越高
 */
export function ridgeScoreAt(sample, direction, { epsilon = 0.008 } = {}) {
  const dir = Array.isArray(direction)
    ? new THREE.Vector3(direction[0], direction[1], direction[2])
    : direction.clone();
  if (dir.lengthSq() < 1e-10) return 0;
  dir.normalize();
  const h0 = sample(dir);
  // 切平面正交基（避开与 dir 平行的参考轴）
  const ref = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(dir, ref).normalize();
  const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
  const he = sample(dir.clone().addScaledVector(t1, epsilon).normalize());
  const hw = sample(dir.clone().addScaledVector(t1, -epsilon).normalize());
  const hn = sample(dir.clone().addScaledVector(t2, epsilon).normalize());
  const hs = sample(dir.clone().addScaledVector(t2, -epsilon).normalize());
  const cross1 = h0 * 2 - he - hw; // 横切凸度 1
  const cross2 = h0 * 2 - hn - hs; // 横切凸度 2
  const ridge = Math.max(0, cross1) + Math.max(0, cross2);
  return ridge / Math.max(0.5, h0);
}

/**
 * 阶段 2A/2C：用真实脊线得分重新摆放/筛选云实例。**必须在 remapCloudClustersToSceneTerrain
 * 之前调用**（先决定“云该出现在哪”，再由阶段一逻辑把高度贴到新位置的真实地表）。
 * 每个实例两步走：
 * ① 由近及远的环形探测（probeRings 0.03→0.5 rad）：找到最近一圈存在“高出海面地形”的半径；
 *    全部落空（周围是平地/海面）→ 直接丢弃该实例，云于是天然聚在山地周围；
 * ② 在该环上撒 candidateCount 个候选点（若锚点自身过门槛则含中心），取最高分候选：
 *    score = ridgeWeight*ridgeRatio + heightWeight*heightScore（canopy 项留给阶段 2B）。
 *    ridgeRatio=(h0-min4)/(relief+0.4) 是尺度无关的相对凸度：峰/脊顶→~1，坡→~0.5，平地→~0，
 *    修掉了“绝对凸度对宽缓山丘天然≈0”的尺度失配问题。
 * 命中则把 anchor 与 pathPoints 用同一旋转整体搬移。
 */
export function relocateCloudClustersToRidges(clusters, {
  terrainMeshes = null,
  radius = 160,
  seaLevel = 0,
  fallbackHeight = null,
  probeRings = [0.06, 0.12, 0.25, 0.5, 1.0, 2.0], // 由近及远的探测环（弧度）
  candidateCount = 12,      // 命中环上的候选点数（若锚点自身过门槛则另含中心）
  epsilon = 0.008,          // 脊线横切采样半角（弧度）
  ridgeWeight = 1,          // w1：相对凸度权重
  heightWeight = 0.6,       // 高度权重（云偏爱更高的山）
  heightRef = 6,            // 高度归一参考（高出海面的单位数）
  canopyWeight = 0,         // w2：树冠权重（阶段 2B 接入植被注册表后生效）
  scoreThreshold = 0.35,    // 最高分低于此值 → 丢弃实例
  minHeightAboveSea = 0.5,  // 候选点至少高出海面这个高度才有资格
} = {}) {
  if (!clusters?.instances?.length || !terrainMeshes?.length) return clusters;
  const raycaster = new THREE.Raycaster();
  const base = fallbackHeight ?? seaLevel;
  const sample = (d) => Math.max(
    sampleSceneHeightAt(terrainMeshes, d, radius, { raycaster, fallbackHeight: base }),
    seaLevel,
  );
  const tangentFrame = (dir) => {
    const ref = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const t1 = new THREE.Vector3().crossVectors(dir, ref).normalize();
    const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
    return [t1, t2];
  };
  const ringPoint = (dir, t1, t2, ring, i, count) => {
    const a = (i / count) * Math.PI * 2;
    const off = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a)).normalize();
    return dir.clone().addScaledVector(off, ring).normalize();
  };
  const kept = [];
  let dropped = 0;
  const ringHistogram = {};
  let maxH = 0;
  let maxScore = 0;
  for (const instance of clusters.instances) {
    if (!instance?.anchor) continue;
    const oldDir = new THREE.Vector3(instance.anchor[0], instance.anchor[1], instance.anchor[2]).normalize();
    const [t1, t2] = tangentFrame(oldDir);
    // ① 由近及远找最近一圈存在合格地形的半径
    let ring = -1;
    let centerH = sample(oldDir);
    if (centerH > maxH) maxH = centerH;
    if (centerH > seaLevel + minHeightAboveSea) {
      ring = 0; // 锚点自身就在山上
    } else {
      for (const r of probeRings) {
        let hit = false;
        for (let i = 0; i < 8; i++) {
          const h = sample(ringPoint(oldDir, t1, t2, r, i, 8));
          if (h > maxH) maxH = h;
          if (h > seaLevel + minHeightAboveSea) { hit = true; break; }
        }
        if (hit) { ring = r; break; }
      }
    }
    if (ring < 0) { dropped++; continue; }
    const ringKey = ring === 0 ? "center" : String(ring);
    ringHistogram[ringKey] = (ringHistogram[ringKey] || 0) + 1;
    // ② 在该环上细搜最高分候选
    let bestDir = null;
    let bestScore = -Infinity;
    if (ring === 0) {
      bestDir = oldDir.clone();
      bestScore = ridgeWeight * ridgeScoreAt(sample, oldDir, { epsilon });
    }
    for (let i = 0; i < candidateCount; i++) {
      const cand = ringPoint(oldDir, t1, t2, ring, i, candidateCount);
      const h0 = sample(cand);
      if (h0 <= seaLevel + minHeightAboveSea) continue;
      // 尺度无关的相对凸度：峰/脊顶→~1，坡→~0.5，平地→~0
      const ref = Math.abs(cand.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const c1 = new THREE.Vector3().crossVectors(cand, ref).normalize();
      const c2 = new THREE.Vector3().crossVectors(cand, c1).normalize();
      const he = sample(cand.clone().addScaledVector(c1, epsilon).normalize());
      const hw = sample(cand.clone().addScaledVector(c1, -epsilon).normalize());
      const hn = sample(cand.clone().addScaledVector(c2, epsilon).normalize());
      const hs = sample(cand.clone().addScaledVector(c2, -epsilon).normalize());
      const min4 = Math.min(he, hw, hn, hs);
      const max4 = Math.max(he, hw, hn, hs);
      const ridgeRatio = (h0 - min4) / (max4 - min4 + 0.4);
      const heightScore = Math.min(1, (h0 - seaLevel) / heightRef);
      const score = ridgeWeight * ridgeRatio + heightWeight * heightScore;
      if (score > maxScore) maxScore = score;
      if (score > bestScore) { bestScore = score; bestDir = cand; }
    }
    if (!bestDir || bestScore < scoreThreshold) { dropped++; continue; }
    if (!bestDir.equals(oldDir)) {
      // anchor 与 pathPoints 用同一个旋转整体搬移
      const q = new THREE.Quaternion().setFromUnitVectors(oldDir, bestDir);
      instance.anchor = [bestDir.x, bestDir.y, bestDir.z];
      if (Array.isArray(instance.pathPoints)) {
        for (const point of instance.pathPoints) {
          if (!point?.direction) continue;
          const d = new THREE.Vector3(point.direction[0], point.direction[1], point.direction[2])
            .applyQuaternion(q).normalize();
          point.direction = [d.x, d.y, d.z];
        }
      }
    }
    kept.push(instance);
  }
  clusters.instances = kept;
  clusters.climateHash = hashCloudInstances(clusters.instances);
  console.log("[CLOUD-RIDGE] kept=", kept.length, "dropped=", dropped,
              "rings=", JSON.stringify(ringHistogram),
              "maxH=", +maxH.toFixed(2), "maxScore=", +maxScore.toFixed(2),
              "threshold=", scoreThreshold);
  return clusters;
}

/**
 * 把云集群重投影到场景真实地形上：
 * - instance.altitude = sample(instance.anchor) + instance.terrainClearance
 * - pathPoints[].altitude = sample(point.direction) + point.terrainClearance
 * - 收尾重算 clusters.climateHash（altitude 变了，哈希必须同步，否则下游缓存失配）
 */
export function remapCloudClustersToSceneTerrain(clusters, {
  terrainMeshes = null,
  radius = 160,
  seaLevel = 0,
  fallbackHeight = null,
} = {}) {
  if (!clusters?.instances?.length || !terrainMeshes?.length) return clusters;
  const raycaster = new THREE.Raycaster();
  const base = fallbackHeight ?? seaLevel;
  const sample = (direction) => Math.max(
    sampleSceneHeightAt(terrainMeshes, direction, radius, { raycaster, fallbackHeight: base }),
    seaLevel,
  );
  for (const instance of clusters.instances) {
    if (!instance) continue;
    const clearance = Number(instance.terrainClearance) || 1.2;
    const realHeight = sample(instance.anchor);
    instance.terrainHeight = realHeight;
    instance.altitude = realHeight + clearance;
    if (Array.isArray(instance.pathPoints)) {
      for (const point of instance.pathPoints) {
        if (!point) continue;
        const pointClearance = Number(point.terrainClearance) || clearance;
        const pointHeight = sample(point.direction || instance.anchor);
        point.terrainHeight = pointHeight;
        point.altitude = pointHeight + pointClearance;
      }
    }
  }
  clusters.climateHash = hashCloudInstances(clusters.instances);
  return clusters;
}
