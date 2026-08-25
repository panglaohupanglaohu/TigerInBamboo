// =====================================================================
//  V5 光照 · K4 局部灯 Three 桥接（PLAN.md 第九章 9.8）
//  LocalLightRegistry（纯逻辑）与真实 PointLight 池的绑定层：
//    - V5 开启时接管局部灯：原创建点的灯被静音（visible=false，不删不改
//      参数，emissive/halo 外观保留），registry 选出的 active 请求映射到
//      固定大小的 PointLight 池（池灯永不投影：castShadow=false，
//      火炬近距离遮挡由 K3 脚底 contact shadow 贴片承担）。
//    - 闪电：weather 的 flash 强度每帧采样 → LightingDirector.setLightning
//      短时 override（由导演合成并平滑恢复，不直接改 ambient/sun）。
//    - 开关关闭：恢复原灯可见性，池灯全部熄灭，行为逐字节回到 legacy。
// =====================================================================
import * as THREE from "three";
import { torchFlicker } from "./localLightRegistry.js";

const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _warm = new THREE.Color(0xffd9a0);
const _color = new THREE.Color();

/**
 * @param {object} deps
 *   { scene, camera, registry, budget, director? }
 *   registry 为 createLocalLightRegistry() 实例（生产用 getLocalLightHub()）。
 */
export function createLocalLightBridge({ scene, camera, registry, budget = 8, director = null } = {}) {
  if (!scene || !camera || !registry) {
    throw new Error("local light bridge requires scene, camera and registry");
  }
  const poolSize = Math.max(0, Math.floor(budget));

  const poolGroup = new THREE.Group();
  poolGroup.name = "osk-v5-local-light-pool";
  poolGroup.visible = false;
  scene.add(poolGroup);

  const pool = [];
  for (let i = 0; i < poolSize; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 1, 2);
    light.name = `osk-v5-pool-light-${i}`;
    light.castShadow = false; // K4：局部灯（含火炬）默认不投动态阴影
    light.visible = false;
    poolGroup.add(light);
    pool.push(light);
  }

  let enabled = false;
  const muted = new Map(); // 原灯对象 → 原 visible（关闭时逐一恢复）
  let lastActive = [];
  let budgetCap = poolSize; // K7 面板：运行时预算上限（不重建池，只收窄选择）

  function isInScene(object) {
    // 灯挂在场景子树上即视为存活；parent=null 说明宿主已被重建移除
    return !!object && object.parent !== null;
  }

  // 祖先链可见性（不含灯自身——桥接静音只改灯自身）：木马腹内待命的
  // 火炬手白天整组隐藏，此时请求视为熄灭，不占预算、不产生池灯
  function ancestorsVisible(object) {
    let p = object?.parent;
    while (p) {
      if (p.visible === false) return false;
      p = p.parent;
    }
    return true;
  }

  function muteOriginal(object) {
    if (!object || muted.has(object)) return;
    muted.set(object, object.visible);
    object.visible = false;
  }

  function restoreAll() {
    for (const [object, visible] of muted) {
      object.visible = visible;
    }
    muted.clear();
  }

  return {
    pool,
    registry,

    isEnabled: () => enabled,

    setEnabled(next) {
      next = next === true;
      if (next === enabled) return enabled;
      enabled = next;
      poolGroup.visible = enabled;
      if (enabled) {
        for (const e of registry.list()) {
          if (!e.exception) muteOriginal(e.object);
        }
      } else {
        restoreAll();
        for (const light of pool) light.visible = false;
        director?.setLightning?.(0);
        lastActive = [];
      }
      return enabled;
    },

    /**
     * 每帧：宿主状态回灌 registry（位置/强度/存活）→ 选择 → 写池灯。
     * 开关关闭时完全 no-op。
     */
    update(dt) {
      if (!enabled) return;
      registry.update(dt);
      // 宿主回灌：世界位置与实时强度（闪电/持信光环由各自系统驱动强度）
      for (const e of registry.list()) {
        if (!e.object) continue;
        if (e.exception) continue;
        if (!isInScene(e.object)) {
          registry.unregister(e.lightId);
          continue;
        }
        muteOriginal(e.object); // 后注册的灯（重建/新火炬手）也要静音
        e.object.getWorldPosition(_pos);
        registry.setPosition(e.lightId, _pos.x, _pos.y, _pos.z);
        registry.setIntensity(
          e.lightId,
          ancestorsVisible(e.object) ? e.object.intensity : 0
        );
      }
      camera.getWorldPosition(_pos);
      camera.getWorldDirection(_fwd);
      const active = registry.selectActive(
        { position: [_pos.x, _pos.y, _pos.z], forward: [_fwd.x, _fwd.y, _fwd.z] },
        Math.min(poolSize, budgetCap)
      );
      lastActive = active;
      const tick = registry.tick();
      for (let i = 0; i < pool.length; i++) {
        const light = pool[i];
        const a = active[i];
        if (!a) {
          light.visible = false;
          light.intensity = 0;
          continue;
        }
        let intensityMul = 1;
        let radiusMul = 1;
        _color.set(typeof a.color === "string" ? a.color : (a.color ?? 0xffffff));
        if (a.flicker) {
          // 固定 tick 噪声：同 seed（稳定 lightId 派生）可重放，亮度/半径/色温有上限
          const f = torchFlicker(a.seed, tick);
          intensityMul = f.intensityMul;
          radiusMul = f.radiusMul;
          if (f.warmShift > 0) _color.lerp(_warm, f.warmShift);
        }
        light.position.set(a.position[0], a.position[1], a.position[2]);
        light.color.copy(_color);
        light.intensity = a.intensity * intensityMul;
        light.distance = a.radius * radiusMul;
        light.visible = true;
      }
      // 闪电：registry 里 kind=lightning 的请求强度（weather 驱动）→ 导演 override
      let lightning = 0;
      for (const e of registry.list()) {
        if (e.kind === "lightning" && e.intensity > lightning) {
          lightning = Math.min(1, e.intensity / 10);
        }
      }
      director?.setLightning?.(lightning);
    },

    /** K7 面板：运行时预算上限（0..poolSize；只收窄选择，不重建池） */
    setBudgetCap(n) {
      budgetCap = Math.max(0, Math.min(poolSize, Math.floor(Number(n) || 0)));
      return budgetCap;
    },
    getBudgetCap: () => budgetCap,

    /** 调试/验收：预算、注册数、当前 active 列表（稳定 lightId） */
    getDebugInfo() {
      return {
        enabled,
        budget: poolSize,
        budgetCap,
        ...registry.getDebugInfo(),
        activeCount: lastActive.length,
        active: lastActive.map((a) => ({
          lightId: a.lightId,
          kind: a.kind,
          score: +a.score.toFixed(4),
        })),
      };
    },
  };
}
