// =====================================================================
// 固定容量灯池（2026-09-02）
//
// 实测（A-B-A 对照，漂移 0.9%）：78 盏点光/聚光 = 140ms / 62% 帧时间。
// 但【不能】简单按距离开关灯——Three 在灯数变化时会重编译所有材质，
// 开关会造成持续的编译风暴（这正是 progs 在 128/162/225/318/348 之间
// 乱跳、以及进场卡顿的成因）。
//
// 本模块的做法：
//   · 场景常驻【固定 capacity 盏】PointLight，永远 visible=true；
//   · 接管场景里其余 PointLight：永久 visible=false，只作为「逻辑灯」数据源
//     （它们的 intensity 仍由各自原有逻辑驱动，如 highlandLightVolumes 的夜权重）；
//   · 每 interval 秒挑出得分最高的 capacity 盏，把池灯【移过去】并赋色。
//
// 灯数恒定 → 永不重编译 → 无编译卡顿，且逐片元光照成本封顶。
// 远处灯的视觉由各自既有的自发光网格（灯晕壳/驾驶舱发光）承担，本模块不碰网格。
// =====================================================================
import * as THREE from "three";

export const LIGHT_POOL_SCHEMA_VERSION = 1;

const _lampWorld = new THREE.Vector3();

export function createLightPool({
  scene,
  getCamera,
  capacity = 8,
  interval = 0.2,
  recollectInterval = 5,
  minIntensity = 0.002,
} = {}) {
  if (!scene || !getCamera) throw new Error("light pool requires scene and getCamera");

  const pool = [];
  for (let i = 0; i < capacity; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 10, 2);
    light.name = `light-pool-${i}`;
    light.userData.isLightPool = true;
    light.castShadow = false;
    scene.add(light);
    pool.push(light);
  }

  /** 被接管的真实灯：保留引用以读取其实时 intensity / color / 世界位置 */
  let adopted = [];
  const savedVisible = new Map();
  let sinceScan = 0;
  let sinceCollect = Infinity;
  let lastActive = 0;
  let enabled = true;
  let lastCollectMs = 0;

  const collect = () => {
    if (!enabled) return;
    const started = performance.now();
    adopted = [];
    scene.traverse((o) => {
      // 只接管 PointLight：SpotLight 有方向/锥角，用 PointLight 代理会失真
      if (!o.isPointLight || o.userData.isLightPool) return;
      if (!savedVisible.has(o)) savedVisible.set(o, o.visible);
      o.visible = false;
      // 接管前就被别人隐藏的灯不参与竞选，否则会被池灯「复活」
      if (savedVisible.get(o) !== false) adopted.push(o);
    });
    // 每 recollectInterval 秒一次全场 traverse，本身可能就是周期性卡顿源
    lastCollectMs = performance.now() - started;
    sinceCollect = 0;
  };

  const scratch = [];

  const update = (dt) => {
    if (!enabled) return;
    const step = Math.max(0, Number(dt) || 0);
    sinceCollect += step;
    sinceScan += step;
    if (sinceCollect >= recollectInterval) collect();
    if (sinceScan < interval) return;
    sinceScan = 0;

    const camera = getCamera();
    if (!camera) return;
    const camPos = camera.position;

    scratch.length = 0;
    for (const lamp of adopted) {
      const intensity = Number(lamp.intensity) || 0;
      if (intensity <= minIntensity) continue;
      lamp.getWorldPosition(_lampWorld);
      const d2 = _lampWorld.distanceToSquared(camPos);
      // 近且亮者优先；+1 防止贴脸时除零
      scratch.push({ lamp, intensity, score: intensity / (1 + d2), x: _lampWorld.x, y: _lampWorld.y, z: _lampWorld.z });
    }
    scratch.sort((a, b) => b.score - a.score);

    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i];
      const pick = scratch[i];
      if (!pick) {
        // 空槽位保持 visible=true 但强度 0：灯数恒定才不会触发重编译
        slot.intensity = 0;
        continue;
      }
      slot.position.set(pick.x, pick.y, pick.z);
      slot.color.copy(pick.lamp.color);
      slot.intensity = pick.intensity;
      slot.distance = pick.lamp.distance;
      slot.decay = pick.lamp.decay;
    }
    lastActive = Math.min(scratch.length, pool.length);
  };

  /** 运行时开关：关掉后还原全部真实灯并撤下池灯，用于同一次加载内做 A-B-A 对照。 */
  const setEnabled = (on) => {
    const want = on !== false;
    if (want === enabled) return enabled;
    enabled = want;
    if (enabled) {
      for (const light of pool) light.visible = true;
      sinceScan = Infinity;
      collect();
    } else {
      for (const [lamp, visible] of savedVisible) lamp.visible = visible;
      for (const light of pool) light.visible = false;
      adopted = [];
      lastActive = 0;
    }
    return enabled;
  };

  const dispose = () => {
    for (const [lamp, visible] of savedVisible) lamp.visible = visible;
    savedVisible.clear();
    adopted = [];
    for (const light of pool) light.removeFromParent();
    pool.length = 0;
  };

  collect();
  return {
    update,
    dispose,
    setEnabled,
    get enabled() {
      return enabled;
    },
    recollect: collect,
    get capacity() {
      return pool.length;
    },
    get adoptedCount() {
      return adopted.length;
    },
    get activeCount() {
      return lastActive;
    },
    /** 上一次全场扫描耗时（毫秒）。明显 > 1ms 就该把 recollectInterval 调大或改成按需。 */
    get lastCollectMs() {
      return +lastCollectMs.toFixed(2);
    },
    schemaVersion: LIGHT_POOL_SCHEMA_VERSION,
  };
}
