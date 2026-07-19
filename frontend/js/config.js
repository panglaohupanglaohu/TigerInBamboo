// 配置读写：优先走后端 /api/config，离线（file:// 等）回退 localStorage
export const DEFAULT_CONFIG = {
  scene: {
    bambooCount: 90,
    mist: 0.6,
    goldBackground: true,
  },
  weather: {
    temperature: -5,     // 摄氏度：> 0 下雨，<= 0 下雪
    snowfall: 1.0,       // 降水强度
    wind: 0.3,           // 风力（吹偏雨雪、摇动竹子）
    windDirection: 0,    // 风向（度）：0=北(+Z) 90=东(+X)，风往该方向吹
  },
  tiger: {
    speed: 1.0,
    patrolRadius: 1.0,
    stripeContrast: 1.0,
    tailCurl: true,
    furLength: 1.0,      // 皮毛长度倍率（壳层纹理）
    furLayers: 12,       // 皮毛壳层数（越多越厚实，性能开销越大）
    pauseInterval: 16,   // 驻足平均间隔（秒）
    pauseDuration: 2.4,  // 驻足时长（秒）
    tailCurlDistance: 1.75, // 缠竹触发距离（米）
  },
  bamboo: {
    stiffness: 3.0,      // 回正刚度（角速度增益）
    sway: 1.0,           // 风摆幅度倍率
  },
  pheasant: {
    enabled: true,
    fleeDistance: 6.0,
    returnDistance: 14.0,
    drinkInterval: 25.0,
    perchTime: 4.0,
  },
  ecology: {
    relations: [
      { a: "tiger", b: "pheasant", type: "predator-prey", drive: "fear", strength: 0.7,
        note: "锦鸡对虎保持警戒，进入警戒距离即惊飞" },
      { a: "tiger", b: "bamboo", type: "physical", drive: "none", strength: 1.0,
        note: "虎身挤开竹竿，尾巴缠绕竹竿" },
      { a: "pheasant", b: "stream", type: "resource", drive: "thirst", strength: 0.5,
        note: "锦鸡定时到涧水边饮水" },
    ],
  },
  style: {
    inkOutline: false,
    cameraPreset: "panorama",
  },
  bgm: {
    volume: 0.5,         // 背景音乐音量 0~1
  },
};

const STORAGE_KEY = "living-classical-art-config";

function merge(base, override) {
  const out = JSON.parse(JSON.stringify(base));
  if (!override || typeof override !== "object") return out;
  for (const [k, v] of Object.entries(override)) {
    if (k in out && typeof out[k] === "object" && !Array.isArray(out[k]) && typeof v === "object" && !Array.isArray(v)) {
      out[k] = merge(out[k], v);
    } else if (k in out) {
      out[k] = v;
    }
  }
  return out;
}

export async function loadConfig() {
  let cfg = null;
  try {
    const res = await fetch("/api/config");
    if (res.ok) cfg = await res.json();
  } catch (_) { /* 离线回退 */ }
  if (!cfg) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) cfg = JSON.parse(raw);
    } catch (_) { /* ignore */ }
  }
  // 迁移：旧版 scene.snowfall / scene.wind 并入 weather 栏目
  if (cfg?.scene && cfg.weather === undefined) {
    cfg.weather = {};
    if (cfg.scene.snowfall !== undefined) cfg.weather.snowfall = cfg.scene.snowfall;
    if (cfg.scene.wind !== undefined) cfg.weather.wind = cfg.scene.wind;
  }
  return merge(DEFAULT_CONFIG, cfg);
}

export async function saveConfig(config) {
  const merged = merge(DEFAULT_CONFIG, config);
  try {
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
    });
    if (res.ok) return true;
  } catch (_) { /* 离线回退 */ }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return true;
  } catch (_) {
    return false;
  }
}

export async function resetConfig() {
  try {
    await fetch("/api/config/reset", { method: "POST" });
  } catch (_) { /* ignore */ }
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
