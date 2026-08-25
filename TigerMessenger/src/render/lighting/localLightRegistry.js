// =====================================================================
//  V5 光照 · K4 LocalLightRegistry（PLAN.md 第九章 9.8）
//  局部灯统一提交入口的纯逻辑半区：请求注册、稳定 lightId、
//  score=优先级×屏幕影响 的选择与 stable sort（score 降序、lightId 升序
//  tie-break）、desktop/medium/low 预算、固定 tick 噪声火炬闪动、生命期管理。
//  本文件不 import Three.js：entry.object 是不透明宿主引用（桥接层才知道
//  它是 THREE.Light），因此可在 Node 下直接单测。
//  设计约束（9.8）：未进入 active budget 的火炬保留 emissive/halo 外观；
//  同镜头不因数组顺序随机跳灯；同 seed 闪动可重放。
// =====================================================================

// ---------- 预算档：真实局部灯（Three PointLight 池）上限 ----------
export const LOCAL_LIGHT_BUDGETS = Object.freeze({
  desktop: 8,
  medium: 4,
  low: 2,
});

/** 解析预算：档位名或正整数；非法输入回落 desktop */
export function resolveLocalLightBudget(tier) {
  if (Number.isFinite(tier) && tier > 0) return Math.min(32, Math.floor(tier));
  return LOCAL_LIGHT_BUDGETS[tier] ?? LOCAL_LIGHT_BUDGETS.desktop;
}

// ---------- 稳定 lightId → 闪动种子（FNV-1a 32bit） ----------
export function hashLightSeed(lightId) {
  const s = String(lightId);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// uint32 → [0,1) 整数混合哈希（固定输入固定输出，无 Math.random）
function hash01(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/**
 * 固定 tick 值噪声：tick 取整得到两个相邻晶格，smoothstep 插值。
 * 同 (seed, tick) 必得同值——战斗重放/截图回归不因帧率漂移。
 */
export function flickerNoise01(seed, tick) {
  const t0 = Math.floor(tick);
  const f = tick - t0;
  const a = hash01((seed + Math.imul(t0, 0x85ebca6b)) >>> 0);
  const b = hash01((seed + Math.imul(t0 + 1, 0x85ebca6b)) >>> 0);
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

// ---------- 火炬闪动上限（9.8：亮度、半径和色温变化有上限） ----------
export const TORCH_FLICKER_LIMITS = Object.freeze({
  intensityMin: 0.78, // 亮度倍率下限
  intensityMax: 1.18, // 亮度倍率上限
  radiusMin: 0.9, // 半径倍率下限
  radiusMax: 1.1, // 半径倍率上限
  warmShiftMax: 0.08, // 色温偏移上限（向暖色 #FFD9A0 的 lerp 量）
});

/**
 * 火炬闪动采样：两个不同种子通道分别驱动亮度与半径，色温随亮度微移。
 * @returns {{ intensityMul: number, radiusMul: number, warmShift: number }}
 */
export function torchFlicker(seed, tick) {
  const L = TORCH_FLICKER_LIMITS;
  const n1 = flickerNoise01(seed, tick);
  const n2 = flickerNoise01((seed ^ 0x9e3779b9) >>> 0, tick * 0.5 + 7.31);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    intensityMul: clamp(0.9 + (n1 - 0.5) * 0.56, L.intensityMin, L.intensityMax),
    radiusMul: clamp(1 + (n2 - 0.5) * 0.2, L.radiusMin, L.radiusMax),
    warmShift: clamp((n1 - 0.5) * 0.16, -L.warmShiftMax, L.warmShiftMax),
  };
}

// ---------- 屏幕影响与稳定选择 ----------
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 屏幕影响：近/大/在视线前方得分高。纯几何近似（无投影矩阵），
 * 相机背后仍保留 25% 底分（局部灯会照亮镜头附近表面）。
 * @param request { position:[x,y,z], radius }
 * @param camera { position:[x,y,z], forward:[x,y,z]（单位向量） }
 */
export function screenInfluence(request, camera) {
  const p = request.position || [0, 0, 0];
  const cp = camera?.position || [0, 0, 0];
  const dx = p[0] - cp[0];
  const dy = p[1] - cp[1];
  const dz = p[2] - cp[2];
  const dist = Math.hypot(dx, dy, dz);
  const radius = Math.max(0.01, request.radius || 1);
  const proximity = radius / (radius + dist); // 1 近 → 0 远
  let facing = 0.5;
  if (dist > 1e-4 && camera?.forward) {
    const f = camera.forward;
    facing = clamp01(((dx * f[0] + dy * f[1] + dz * f[2]) / dist) * 0.5 + 0.5);
  }
  return proximity * (0.25 + 0.75 * facing);
}

/** stable sort 比较器：score 降序，lightId 字典序升序 tie-break */
export function compareScoreThenId(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return a.lightId < b.lightId ? -1 : a.lightId > b.lightId ? 1 : 0;
}

/**
 * 选择 active lights（9.8 伪代码的落地）：
 * 过滤可见/未过期 → score=优先级×屏幕影响 → stable sort → slice(预算)。
 * 输入数组顺序不影响输出（排序键完全由请求内容决定）。
 */
export function selectLocalLights(requests, camera, budget) {
  const maxActive = Number.isFinite(budget) ? budget : LOCAL_LIGHT_BUDGETS.desktop;
  const scored = [];
  for (const r of requests || []) {
    if (!r || r.exception) continue; // 例外灯（layer-1 全局 rig）只登记、不占预算
    if (r.remainingLife != null && r.remainingLife <= 0) continue;
    if (!(r.intensity > 0)) continue; // 未点亮（闪电间隙/未持信）不参与
    const influence = screenInfluence(r, camera);
    scored.push({
      ...r,
      lightId: r.lightId ?? r.id, // 裸请求（非 registry entry）用 id 兜底
      influence,
      score: (r.priority || 1) * influence,
    });
  }
  scored.sort(compareScoreThenId);
  return scored.slice(0, Math.max(0, maxActive));
}

// =====================================================================
//  LocalLightRegistry：请求生命期 + 固定 tick 闪动时钟
// =====================================================================

/**
 * 请求字段（PLAN 9.8）：owner、kind（类型）、color、radius、priority、
 * lifetimeSec（生命期，缺省无限）、语义 { flicker, affectsSoldiers, exception }。
 * object 为不透明宿主引用（Three 灯对象），纯逻辑层从不解引用。
 */
export function createLocalLightRegistry() {
  const entries = new Map(); // lightId → entry
  const ownerSeq = new Map(); // owner → 已派生序号（稳定 lightId 用）
  let tickFloat = 0; // 闪动时钟（12 tick/秒，固定步进累积）

  function deriveLightId(owner) {
    const key = String(owner || "anon");
    const n = ownerSeq.get(key) || 0;
    ownerSeq.set(key, n + 1);
    return `${key}#${n}`;
  }

  return {
    /** 注册请求；显式 id 幂等（重复注册同 id = 更新请求字段） */
    register(request) {
      const r = request || {};
      const lightId = r.id || deriveLightId(r.owner);
      const prev = entries.get(lightId);
      const entry = {
        lightId,
        owner: String(r.owner || "anon"),
        kind: r.kind || "point",
        color: r.color ?? 0xffffff,
        intensity: Number.isFinite(r.intensity) ? r.intensity : 1,
        radius: Number.isFinite(r.radius) ? r.radius : 5,
        priority: Number.isFinite(r.priority) ? r.priority : 1,
        lifetimeSec: Number.isFinite(r.lifetimeSec) ? r.lifetimeSec : Infinity,
        remainingLife: Number.isFinite(r.lifetimeSec) ? r.lifetimeSec : Infinity,
        flicker: r.flicker === true,
        affectsSoldiers: r.affectsSoldiers === true,
        exception: r.exception === true,
        position: Array.isArray(r.position) ? [...r.position] : [0, 0, 0],
        object: r.object ?? null,
        seed: hashLightSeed(lightId),
      };
      // 幂等更新时保留已消耗的生命期，避免刷新请求把闪电灯“复活”
      if (prev && Number.isFinite(prev.remainingLife)) {
        entry.remainingLife = Math.min(prev.remainingLife, entry.lifetimeSec);
      }
      entries.set(lightId, entry);
      return entry;
    },

    unregister(lightId) {
      return entries.delete(lightId);
    },

    get(lightId) {
      return entries.get(lightId) || null;
    },

    setPosition(lightId, x, y, z) {
      const e = entries.get(lightId);
      if (e) e.position = [x, y, z];
    },

    setIntensity(lightId, v) {
      const e = entries.get(lightId);
      if (e) e.intensity = v;
    },

    /** 固定 tick 推进 + 生命期扣减；返回本帧过期的 entry 列表 */
    update(dt) {
      tickFloat += Math.max(0, dt || 0) * 12; // 12 tick/秒闪动节拍
      const expired = [];
      for (const e of entries.values()) {
        if (!Number.isFinite(e.remainingLife)) continue;
        e.remainingLife -= dt || 0;
        if (e.remainingLife <= 0) {
          expired.push(e);
          entries.delete(e.lightId);
        }
      }
      return expired;
    },

    /** 当前闪动 tick（浮点；torchFlicker 的直接输入） */
    tick() {
      return tickFloat;
    },

    /** 选择 active lights（委托纯函数 selectLocalLights） */
    selectActive(camera, budget) {
      return selectLocalLights([...entries.values()], camera, budget);
    },

    list() {
      return [...entries.values()];
    },

    getDebugInfo() {
      const all = [...entries.values()];
      return {
        registered: all.filter((e) => !e.exception).length,
        exceptions: all.filter((e) => e.exception).map((e) => e.lightId),
        tick: +tickFloat.toFixed(3),
      };
    },
  };
}

// ---------- 共享 hub：资产创建点在 Three 装配之前即可注册 ----------
// 场景构建顺序先于 main.js 的桥接创建，因此注册先进 hub，
// 桥接以 hub 为 registry 接管（V5 关闭时 hub 只是无旁路的登记表）。
let hub = null;
export function getLocalLightHub() {
  if (!hub) hub = createLocalLightRegistry();
  return hub;
}

/**
 * 创建点便捷注册：request 里带上 object（Three 灯）即可。
 * 同一对象重复调用幂等（显式 id 更新语义）。
 */
export function registerLocalLight(object, request = {}) {
  return getLocalLightHub().register({ ...request, object });
}
